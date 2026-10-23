import type { Editor } from 'grapesjs';
import type { AiOptions } from '../types';
import { runAiGeneration } from './generate';

const t = (editor: Editor, key: string, fallback: string) => {
  const out = editor.I18n.t(`aac.ai.${key}`) as string | undefined;
  return out && out !== `aac.ai.${key}` ? out : fallback;
};

/** Modal with a prompt box. Built with DOM APIs (textContent) so nothing here is injected as HTML. */
export function openAiModal(editor: Editor, ai: AiOptions, opts: { mode?: 'insert' | 'replace'; prompt?: string } = {}) {
  const selected = editor.getSelected();
  const hasTarget = !!selected && selected !== editor.getWrapper();
  const doc = document;

  const root = doc.createElement('div');
  root.className = 'aac-ai-modal';
  root.style.cssText = 'display:flex;flex-direction:column;gap:12px;';

  const input = doc.createElement('textarea');
  input.rows = 4;
  input.placeholder = t(editor, 'placeholder', '');
  input.value = opts.prompt ?? '';
  input.style.cssText = 'width:100%;box-sizing:border-box;padding:8px;font:inherit;color:#111;';
  input.setAttribute('aria-label', t(editor, 'title', 'Generate with AI'));

  const modeRow = doc.createElement('div');
  modeRow.style.cssText = 'display:flex;gap:16px;';
  let mode: 'insert' | 'replace' = opts.mode === 'replace' && hasTarget ? 'replace' : 'insert';
  (['insert', 'replace'] as const).forEach((value) => {
    const label = doc.createElement('label');
    label.style.cssText = 'display:flex;gap:6px;align-items:center;';
    const radio = doc.createElement('input');
    radio.type = 'radio';
    radio.name = 'aac-ai-mode';
    radio.checked = mode === value;
    radio.disabled = value === 'replace' && !hasTarget;
    radio.addEventListener('change', () => (mode = value));
    label.append(radio, doc.createTextNode(t(editor, value, value)));
    modeRow.append(label);
  });

  const status = doc.createElement('div');
  status.setAttribute('role', 'status');
  status.style.cssText = 'min-height:1.2em;color:#ef4444;';

  const actions = doc.createElement('div');
  actions.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;';
  const cancel = doc.createElement('button');
  cancel.type = 'button';
  cancel.textContent = t(editor, 'cancel', 'Cancel');
  const go = doc.createElement('button');
  go.type = 'button';
  go.textContent = t(editor, 'generate', 'Generate');
  [cancel, go].forEach((b) => (b.style.cssText = 'padding:8px 14px;cursor:pointer;'));
  actions.append(cancel, go);

  root.append(input, modeRow, status, actions);

  let ctrl: AbortController | undefined;
  const close = () => {
    ctrl?.abort(new Error('Cancelled.'));
    editor.Modal.close();
  };
  cancel.addEventListener('click', close);
  go.addEventListener('click', async () => {
    ctrl = new AbortController();
    go.disabled = true;
    go.textContent = t(editor, 'working', 'Generating…');
    status.textContent = '';
    try {
      await runAiGeneration(editor, ai, { prompt: input.value, mode, target: selected, signal: ctrl.signal });
      editor.Modal.close();
    } catch (err) {
      status.textContent = err instanceof Error ? err.message : String(err);
    } finally {
      go.disabled = false;
      go.textContent = t(editor, 'generate', 'Generate');
    }
  });

  editor.Modal.open({ title: t(editor, 'title', 'Generate with AI'), content: root });
  editor.Modal.onceClose(() => ctrl?.abort(new Error('Cancelled.')));
  input.focus();
}
