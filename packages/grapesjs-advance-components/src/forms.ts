import type { Editor } from 'grapesjs';

export const FORM_TYPE = 'aac-form';

/**
 * A form that submits to YOUR endpoint (or a form service such as Formspree or Netlify Forms).
 *
 * - Without JavaScript it falls back to a normal POST to `action`.
 * - With JavaScript it validates, blocks bots through a honeypot, sends JSON or form-encoded data
 *   with `fetch`, and reports progress in an `aria-live` status line.
 * - It emits cancelable `aac:form-submit` (take over sending) and `aac:form-success` /
 *   `aac:form-error` events, so host pages can add analytics or their own transport.
 * - Inert inside the editor canvas.
 *
 * The runtime is a plain function exported inline with the page (GrapesJS `script`).
 */
export function loadForms(editor: Editor) {
  editor.Components.addType(FORM_TYPE, {
    isComponent: (el) =>
      el.tagName === 'FORM' && el.classList?.contains('aac-form') ? { type: FORM_TYPE } : undefined,
    model: {
      defaults: {
        name: 'Form',
        tagName: 'form',
        attributes: { class: 'aac-form', method: 'post', action: '' },
        encoding: 'json',
        successMessage: 'Thanks! Your message has been sent.',
        errorMessage: 'Something went wrong. Please try again.',
        redirectUrl: '',
        traits: [
          { type: 'text', name: 'action', label: 'Endpoint URL', placeholder: 'https://… or /api/contact' },
          { type: 'select', name: 'encoding', label: 'Send as', changeProp: true, options: [
            { id: 'json', label: 'JSON' },
            { id: 'form', label: 'Form-encoded' },
          ] },
          { type: 'text', name: 'successMessage', label: 'Success message', changeProp: true },
          { type: 'text', name: 'errorMessage', label: 'Error message', changeProp: true },
          { type: 'text', name: 'redirectUrl', label: 'Redirect after success', placeholder: '/thanks.html', changeProp: true },
        ],
        'script-props': ['encoding', 'successMessage', 'errorMessage', 'redirectUrl'],
        script: function (props: Record<string, any>) {
          const form = this as unknown as HTMLFormElement;
          form.addEventListener('submit', (e) => {
            const frame = window.frameElement as HTMLElement | null;
            if (frame && String(frame.className).indexOf('gjs-frame') > -1) {
              e.preventDefault(); // inert while editing
              return;
            }
            e.preventDefault();
            if (form.getAttribute('aria-busy') === 'true') return;

            const status = form.querySelector('.aac-form-status');
            const say = (text: string, state: string) => {
              if (!status) return;
              status.textContent = text;
              status.setAttribute('data-state', state);
            };
            const emit = (name: string, detail: unknown, cancelable?: boolean) =>
              form.dispatchEvent(new CustomEvent(name, { bubbles: true, cancelable: !!cancelable, detail }));
            // https, or http only on localhost; relative URLs resolve against the page.
            const safeUrl = (raw: string) => {
              try {
                const u = new URL(raw, window.location.href);
                const local = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
                return u.protocol === 'https:' || (u.protocol === 'http:' && local) ? u.href : '';
              } catch (_) {
                return '';
              }
            };

            if (!form.checkValidity()) {
              form.reportValidity();
              say('Please check the highlighted fields.', 'error');
              return;
            }
            const trap = form.querySelector('[name="_gotcha"]') as HTMLInputElement | null;
            if (trap && trap.value) {
              // A bot filled the hidden field: look successful, send nothing.
              say(props.successMessage, 'success');
              form.reset();
              return;
            }

            const data: Record<string, any> = {};
            new FormData(form).forEach((value, key) => {
              if (key === '_gotcha') return;
              data[key] = key in data ? [].concat(data[key], value as any) : value;
            });

            // An empty action would resolve to this very page, so it counts as not configured.
            const raw = (form.getAttribute('action') || '').trim();
            const target = raw ? safeUrl(raw) : '';
            if (!target) {
              say('This form has no valid endpoint configured.', 'error');
              emit('aac:form-error', { message: 'invalid endpoint', data });
              return;
            }
            if (!emit('aac:form-submit', { data, endpoint: target }, true)) return; // host took over

            form.setAttribute('aria-busy', 'true');
            say('Sending…', 'pending');
            let body: BodyInit;
            const headers: Record<string, string> = { Accept: 'application/json' };
            if (props.encoding === 'form') {
              const params = new URLSearchParams();
              Object.keys(data).forEach((k) => [].concat(data[k]).forEach((v) => params.append(k, String(v))));
              body = params;
            } else {
              headers['Content-Type'] = 'application/json';
              body = JSON.stringify(data);
            }
            fetch(target, { method: 'POST', headers, body })
              .then((res) => {
                if (!res.ok) throw new Error('Request failed (' + res.status + ')');
                say(props.successMessage, 'success');
                form.reset();
                emit('aac:form-success', { data, endpoint: target });
                const next = props.redirectUrl ? safeUrl(props.redirectUrl) : '';
                if (next) window.location.assign(next);
              })
              .catch((err) => {
                say(props.errorMessage, 'error');
                emit('aac:form-error', { message: err.message, data });
              })
              .then(() => form.removeAttribute('aria-busy'));
          });
        },
      },
    },
  });
}
