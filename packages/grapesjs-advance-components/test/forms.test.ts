import grapesjs, { type Editor } from 'grapesjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import plugin, { type FormActionOptions } from '../src';

let editors: Editor[] = [];
function make() {
  const el = document.createElement('div');
  document.body.append(el);
  const editor = grapesjs.init({ container: el, storageManager: false, headless: true, plugins: [plugin] });
  editors.push(editor);
  return editor;
}
afterEach(() => {
  editors.forEach((e) => e.destroy());
  editors = [];
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

/** Render the block's real markup into the page and run its runtime script on it, like a published page. */
function mount(block: 'form-block' | 'newsletter-block', action: string, props: Record<string, unknown> = {}) {
  const editor = make();
  const fa: FormActionOptions = { endpoint: action };
  const content = editor.Blocks.get(block)!.getContent() as Record<string, unknown>;
  const [cmp] = editor.addComponents({ ...content, attributes: { ...(content.attributes as object), action: fa.endpoint } });
  const holder = document.createElement('div');
  holder.innerHTML = cmp!.toHTML();
  document.body.append(holder);
  const form = holder.querySelector('form')!;
  const script = cmp!.get('script') as (this: HTMLFormElement, p: unknown) => void;
  script.call(form, { encoding: 'json', successMessage: 'Sent!', errorMessage: 'Nope.', redirectUrl: '', ...props });
  const fill = (values: Record<string, string>) =>
    Object.entries(values).forEach(([name, v]) => ((form.querySelector(`[name="${name}"]`) as HTMLInputElement).value = v));
  const submit = () => form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
  const status = () => form.querySelector('.aac-form-status')!;
  return { form, fill, submit, status, cmp: cmp! };
}

const ok = () => vi.fn(async () => new Response('{}', { status: 200 }));

describe('form blocks', () => {
  it('render accessible, labelled markup with a honeypot and live status', () => {
    const { form } = mount('form-block', 'https://api.example.com/contact');
    expect(form.getAttribute('method')).toBe('post');
    expect(form.getAttribute('action')).toBe('https://api.example.com/contact');
    const labels = [...form.querySelectorAll('label[for]')];
    expect(labels.length).toBeGreaterThanOrEqual(3);
    labels.forEach((l) => expect(form.querySelector(`#${l.getAttribute('for')}`)).not.toBeNull());
    expect(form.querySelector('.aac-hp [name="_gotcha"]')).not.toBeNull();
    expect(form.querySelector('[role=status][aria-live=polite]')).not.toBeNull();
    expect(form.querySelector('button[type=submit]')).not.toBeNull();
  });

  it('exposes endpoint, encoding and messages as traits', () => {
    const { cmp } = mount('form-block', '/x');
    expect(cmp.getTraits().map((t) => t.get('name'))).toEqual(['action', 'encoding', 'successMessage', 'errorMessage', 'redirectUrl']);
    expect(cmp.get('script-props')).toEqual(['encoding', 'successMessage', 'errorMessage', 'redirectUrl']);
  });

  it('is recognised again when saved HTML is loaded', () => {
    const editor = make();
    editor.setComponents('<form class="aac-form" action="/x"><input name="a"></form>');
    expect(editor.getWrapper()!.components().at(0)!.get('type')).toBe('aac-form');
  });
});

describe('form submission', () => {
  it('posts JSON to the endpoint and reports success', async () => {
    const fetchMock = ok();
    vi.stubGlobal('fetch', fetchMock);
    const { form, fill, submit, status } = mount('form-block', 'https://api.example.com/contact');
    const success = vi.fn();
    form.addEventListener('aac:form-success', success);
    fill({ name: 'Ada', email: 'ada@example.com', message: 'Hello' });
    submit();
    expect(form.getAttribute('aria-busy')).toBe('true');
    expect(status().getAttribute('data-state')).toBe('pending');

    await vi.waitFor(() => expect(status().getAttribute('data-state')).toBe('success'));
    expect(status().textContent).toBe('Sent!');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.example.com/contact');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body as string)).toEqual({ name: 'Ada', email: 'ada@example.com', message: 'Hello' });
    expect(success).toHaveBeenCalledOnce();
    await vi.waitFor(() => expect(form.hasAttribute('aria-busy')).toBe(false));
    expect((form.querySelector('[name=name]') as HTMLInputElement).value).toBe(''); // reset
  });

  it('can send form-encoded data for form services', async () => {
    const fetchMock = ok();
    vi.stubGlobal('fetch', fetchMock);
    const { fill, submit, status } = mount('form-block', 'https://formspree.io/f/abc', { encoding: 'form' });
    fill({ name: 'Ada', email: 'ada@example.com', message: 'Hi there' });
    submit();
    await vi.waitFor(() => expect(status().getAttribute('data-state')).toBe('success'));
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(init.body).toBeInstanceOf(URLSearchParams);
    expect((init.body as URLSearchParams).get('email')).toBe('ada@example.com');
    expect((init.headers as Record<string, string>)['Content-Type']).toBeUndefined();
  });

  it('does not send invalid forms', () => {
    const fetchMock = ok();
    vi.stubGlobal('fetch', fetchMock);
    const { fill, submit, status } = mount('form-block', 'https://api.example.com/contact');
    fill({ name: 'Ada', email: 'not-an-email', message: 'Hi' });
    submit();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(status().getAttribute('data-state')).toBe('error');
  });

  it('pretends to succeed but sends nothing when the honeypot is filled', () => {
    const fetchMock = ok();
    vi.stubGlobal('fetch', fetchMock);
    const { fill, submit, status } = mount('form-block', 'https://api.example.com/contact');
    fill({ name: 'Bot', email: 'bot@example.com', message: 'Buy now', _gotcha: 'gotcha' });
    submit();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(status().getAttribute('data-state')).toBe('success');
  });

  it('shows the error message and emits aac:form-error when the server fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('x', { status: 500 })));
    const { form, fill, submit, status } = mount('form-block', 'https://api.example.com/contact');
    const error = vi.fn();
    form.addEventListener('aac:form-error', error);
    fill({ name: 'Ada', email: 'ada@example.com', message: 'Hello' });
    submit();
    await vi.waitFor(() => expect(status().getAttribute('data-state')).toBe('error'));
    expect(status().textContent).toBe('Nope.');
    expect((error.mock.calls[0]![0] as CustomEvent).detail.message).toMatch(/500/);
    await vi.waitFor(() => expect(form.hasAttribute('aria-busy')).toBe(false));
  });

  it('keeps the entered values when sending fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    const { form, fill, submit, status } = mount('form-block', 'https://api.example.com/contact');
    fill({ name: 'Ada', email: 'ada@example.com', message: 'Hello' });
    submit();
    await vi.waitFor(() => expect(status().getAttribute('data-state')).toBe('error'));
    expect((form.querySelector('[name=message]') as HTMLInputElement).value).toBe('Hello');
  });

  it('lets the host page take over via a cancelable aac:form-submit', () => {
    const fetchMock = ok();
    vi.stubGlobal('fetch', fetchMock);
    const { form, fill, submit } = mount('form-block', 'https://api.example.com/contact');
    form.addEventListener('aac:form-submit', (e) => {
      e.preventDefault();
      expect((e as CustomEvent).detail.data.email).toBe('ada@example.com');
    });
    fill({ name: 'Ada', email: 'ada@example.com', message: 'Hello' });
    submit();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(['', 'javascript:alert(1)', 'http://api.example.com/contact', 'ftp://x.example/y'])('refuses endpoint %j', (endpoint) => {
    const fetchMock = ok();
    vi.stubGlobal('fetch', fetchMock);
    const { fill, submit, status } = mount('form-block', endpoint);
    fill({ name: 'Ada', email: 'ada@example.com', message: 'Hello' });
    submit();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(status().textContent).toMatch(/valid endpoint/);
  });

  it('allows http on localhost for development', async () => {
    const fetchMock = ok();
    vi.stubGlobal('fetch', fetchMock);
    const { fill, submit, status } = mount('newsletter-block', 'http://localhost:3000/subscribe');
    fill({ email: 'ada@example.com' });
    submit();
    await vi.waitFor(() => expect(status().getAttribute('data-state')).toBe('success'));
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe('http://localhost:3000/subscribe');
  });

  it('ignores a second submit while one is in flight', async () => {
    let release: (r: Response) => void = () => {};
    const fetchMock = vi.fn(() => new Promise<Response>((res) => (release = res)));
    vi.stubGlobal('fetch', fetchMock);
    const { fill, submit } = mount('form-block', 'https://api.example.com/contact');
    fill({ name: 'Ada', email: 'ada@example.com', message: 'Hello' });
    submit();
    submit();
    expect(fetchMock).toHaveBeenCalledOnce();
    release(new Response('{}'));
  });
});
