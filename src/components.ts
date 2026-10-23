import type { Editor } from 'grapesjs';

const clamp = (n: number) => Math.min(100, Math.max(0, Number.isFinite(n) ? n : 0));

/**
 * Progress bar: a container with an inner bar whose width and colour are driven by the
 * `percentage` and `color` traits. State lives in the inner element's style, so the
 * exported HTML needs no script.
 */
export function loadComponents(editor: Editor) {
  editor.Components.addType('aac-progress-bar', {
    isComponent: (el) =>
      el.classList?.contains('aac-progress') ? { type: 'aac-progress-bar' } : undefined,
    model: {
      defaults: {
        name: 'Progress Bar',
        attributes: { class: 'aac-progress', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '65' },
        percentage: 65,
        color: '', // empty = use the --aac-accent theme token
        components: [{ tagName: 'div', attributes: { class: 'aac-progress-inner' }, selectable: false, hoverable: false }],
        droppable: false,
        traits: [
          { type: 'number', name: 'percentage', label: 'Percentage', min: 0, max: 100, changeProp: true },
          { type: 'color', name: 'color', label: 'Colour', changeProp: true },
        ],
      },
      init() {
        this.on('change:percentage change:color', this.updateBar);
        // Saved pages carry their state in the inner style; adopt it instead of resetting.
        const inner = this.components().at(0);
        const style = inner?.getStyle() as Record<string, string> | undefined;
        if (style?.width) this.set('percentage', clamp(parseFloat(style.width)), { silent: true });
        if (style?.['background-color']) this.set('color', style['background-color'], { silent: true });
      },
      updateBar() {
        const pct = clamp(Number(this.get('percentage')));
        const color = this.get('color');
        this.components().at(0)?.setStyle({ width: `${pct}%`, ...(color ? { 'background-color': color } : {}) });
        this.addAttributes({ 'aria-valuenow': String(pct) });
      },
    },
  });
}
