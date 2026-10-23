import type { Component, Editor } from 'grapesjs';
import type { AiOptions, AiRequest } from '../types';
import { sanitizeHtml } from './sanitize';

export const DEFAULT_SYSTEM = [
  'You write HTML fragments for a drag-and-drop page builder.',
  'Respond with ONLY the HTML fragment: no markdown fences, no explanation, no <html>, <head> or <body>.',
  'Never use <script>, <style>, <iframe>, event-handler attributes or javascript: URLs; they are stripped.',
  'Use semantic, accessible elements (headings in order, <button> for actions, alt text on images, <label> for inputs).',
  'Style with a few inline style attributes at most. Prefer neutral colours and relative units so it fits any theme.',
  'Use realistic copy that matches the request, not lorem ipsum.',
  'If asked to rewrite existing HTML, keep its structure unless the request says otherwise.',
].join('\n');

export interface GenerateParams {
  prompt: string;
  /** `insert` adds after the target (or at the end of the page); `replace` swaps the target. */
  mode?: 'insert' | 'replace';
  target?: Component;
  signal?: AbortSignal;
}

/** Models often wrap output in ```html fences despite instructions; unwrap them. */
export function extractHtml(raw: string): string {
  const fenced = raw.match(/```(?:html)?\s*\n([\s\S]*?)```/i);
  return (fenced ? fenced[1]! : raw).trim();
}

function withTimeout(ms: number, outer?: AbortSignal) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new Error('The AI request timed out.')), ms);
  const onAbort = () => ctrl.abort(outer?.reason);
  outer?.addEventListener('abort', onAbort);
  return {
    signal: ctrl.signal,
    done: () => {
      clearTimeout(timer);
      outer?.removeEventListener('abort', onAbort);
    },
  };
}

/** Run the user's `generate` function, sanitize the result, and put it on the canvas. */
export async function runAiGeneration(editor: Editor, ai: AiOptions, params: GenerateParams): Promise<Component[]> {
  const prompt = params.prompt.trim();
  if (!prompt) throw new Error('Describe what you want to generate.');

  const wrapper = editor.getWrapper();
  const selected = params.target ?? editor.getSelected();
  const target = selected && selected !== wrapper ? selected : undefined;
  const mode = params.mode === 'replace' && target ? 'replace' : 'insert';

  const request: AiRequest = {
    prompt,
    mode,
    system: ai.system ?? DEFAULT_SYSTEM,
    currentHtml: mode === 'replace' ? target!.toHTML() : undefined,
  };

  const { signal, done } = withTimeout(ai.timeoutMs ?? 60_000, params.signal);
  let raw: string | { html: string };
  try {
    raw = await Promise.race([
      ai.generate({ ...request, signal }),
      new Promise<never>((_, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason ?? new Error('Cancelled.')), { once: true });
      }),
    ]);
  } finally {
    done();
  }

  const text = typeof raw === 'string' ? raw : raw?.html;
  if (typeof text !== 'string') throw new Error('The AI provider returned no HTML.');
  const html = (ai.sanitize ?? sanitizeHtml)(extractHtml(text));
  if (!html) throw new Error('The AI response had no usable content.');

  let added: Component | Component[];
  if (mode === 'replace') {
    added = target!.replaceWith(html) as Component | Component[];
  } else if (target?.parent()) {
    added = target.parent()!.append(html, { at: target.index() + 1 }) as Component[];
  } else {
    added = wrapper!.append(html) as Component[];
  }
  const components = Array.isArray(added) ? added : [added];
  if (components[0]) editor.select(components[0]);
  editor.trigger('aac:ai:generated', { prompt, mode, components });
  return components;
}
