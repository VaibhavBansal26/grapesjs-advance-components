const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export const escapeHtml = (value: unknown): string =>
  String(value ?? '').replace(/[&<>"']/g, (ch) => ESCAPES[ch]!);

let uid = 0;
/** Unique, stable-per-call id so labels and inputs of different blocks never collide. */
export const nextId = (prefix: string): string => `${prefix}-${Date.now().toString(36)}${(uid++).toString(36)}`;
