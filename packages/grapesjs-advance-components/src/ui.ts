import { escapeHtml } from './utils';

export const GENERIC_ICON =
  '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 4 7v10l8 4 8-4V7z"/><path d="m4 7 8 4 8-4M12 11v10"/></svg>';

/** Block tile: an icon (SVG markup, or short text such as an emoji) above the label. */
export function blockLabel(icon: string | undefined, text: string): string {
  const art = !icon ? GENERIC_ICON : icon.trimStart().startsWith('<') ? icon : `<span style="font-size:24px;line-height:28px" aria-hidden="true">${escapeHtml(icon)}</span>`;
  return `${art}<div class="gjs-block-label">${escapeHtml(text)}</div>`;
}

// Inline SVG so the blocks don't depend on Font Awesome being loaded in the host page.
export const icon = (path: string) =>
  `<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;

export const ICONS = {
  text: icon('<path d="M4 6h16M4 12h16M4 18h10"/>'),
  heading: icon('<path d="M6 4v16M18 4v16M6 12h12"/>'),
  list: icon('<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>'),
  link: icon('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
  image: icon('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="m21 16-5-5-8 8"/>'),
  video: icon('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3z"/>'),
  divider: icon('<path d="M4 12h16"/>'),
  input: icon('<rect x="3" y="8" width="18" height="8" rx="2"/><path d="M7 12h4"/>'),
  select: icon('<rect x="3" y="7" width="18" height="10" rx="2"/><path d="m15 11 2 2 2-2"/>'),
  map: icon('<path d="M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>'),
  progress: icon('<rect x="3" y="10" width="18" height="4" rx="2"/><path d="M3 12h10"/>'),
  button: icon('<rect x="3" y="8" width="18" height="8" rx="4"/>'),
  slider: icon('<rect x="6" y="6" width="12" height="12" rx="2"/><path d="m3 10-1 2 1 2M21 10l1 2-1 2"/>'),
  layout: icon('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/>'),
  card: icon('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/>'),
  mail: icon('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>'),
  hero: icon('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 10h10M9 14h6"/>'),
  grid: icon('<rect x="3" y="4" width="7" height="7" rx="1"/><rect x="14" y="4" width="7" height="7" rx="1"/><rect x="3" y="13" width="7" height="7" rx="1"/><rect x="14" y="13" width="7" height="7" rx="1"/>'),
  quote: icon('<path d="M8 8H5v5h3v3l3-3V8zM18 8h-3v5h3v3l3-3V8z"/>'),
};
