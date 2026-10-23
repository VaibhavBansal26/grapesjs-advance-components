import type { Editor } from 'grapesjs';
import type { AiOptions } from '../types';
import { runAiGeneration } from './generate';
import { openAiModal } from './ui';

export { sanitizeHtml } from './sanitize';
export { createFetchGenerator } from './fetch';
export { runAiGeneration, DEFAULT_SYSTEM } from './generate';

const TOOLBAR_MARK = 'aac-ai-toolbar';

export function loadAi(editor: Editor, ai: AiOptions) {
  const commandId = ai.commandId ?? 'aac:ai-generate';

  // `editor.runCommand(id, { prompt })` generates headlessly; without a prompt it opens the modal.
  editor.Commands.add(commandId, {
    run(ed, _sender, opts: { prompt?: string; mode?: 'insert' | 'replace' } = {}) {
      if (opts.prompt) return runAiGeneration(ed, ai, { prompt: opts.prompt, mode: opts.mode });
      openAiModal(ed, ai, opts);
    },
  });

  if (ai.toolbar === false) return;
  editor.on('component:selected', (component) => {
    if (component === editor.getWrapper()) return;
    const toolbar = (component.get('toolbar') ?? []) as Array<{ attributes?: Record<string, string> }>;
    if (toolbar.some((item) => item.attributes?.class?.includes(TOOLBAR_MARK))) return;
    const title = (editor.I18n.t('aac.ai.toolbar') as string) || 'Rewrite with AI';
    component.set({
      toolbar: [
        ...toolbar,
        {
          label: '✨',
          attributes: { class: TOOLBAR_MARK, title },
          command: (ed: Editor) => ed.runCommand(commandId, { mode: 'replace' }),
        },
      ],
    } as Record<string, unknown>);
  });
}
