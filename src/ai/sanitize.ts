/**
 * Allowlist HTML sanitizer for model output. Model output is untrusted: it can be steered
 * by the prompt (or by content the prompt was built from) and ends up both in the canvas
 * and in exported pages, so scripts, event handlers and script-capable URLs never pass.
 */

const ALLOWED_TAGS = new Set([
  'a', 'abbr', 'article', 'aside', 'b', 'blockquote', 'br', 'button', 'caption', 'cite', 'code', 'dd', 'details',
  'div', 'dl', 'dt', 'em', 'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header',
  'hr', 'i', 'img', 'input', 'label', 'li', 'main', 'mark', 'nav', 'ol', 'option', 'p', 'pre', 'section', 'select',
  'small', 'span', 'strong', 'sub', 'summary', 'sup', 'table', 'tbody', 'td', 'textarea', 'tfoot', 'th', 'thead',
  'tr', 'u', 'ul',
]);

/** Removed together with their content (unknown tags are merely unwrapped). */
const DROP_WITH_CONTENT = new Set([
  'script', 'style', 'iframe', 'frame', 'frameset', 'object', 'embed', 'link', 'meta', 'base', 'noscript',
  'template', 'svg', 'math', 'audio', 'video', 'source', 'applet', 'title', 'head',
]);

const GLOBAL_ATTRS = new Set(['class', 'id', 'title', 'role', 'lang', 'dir', 'style']);
const TAG_ATTRS: Record<string, string[]> = {
  a: ['href', 'target', 'rel'],
  img: ['src', 'alt', 'width', 'height', 'loading'],
  input: ['type', 'name', 'value', 'placeholder', 'required', 'checked', 'disabled', 'min', 'max', 'step'],
  button: ['type', 'disabled'],
  label: ['for'],
  select: ['name', 'required', 'disabled'],
  option: ['value', 'selected'],
  textarea: ['name', 'placeholder', 'rows', 'cols', 'required', 'disabled'],
  form: ['action', 'method'],
  td: ['colspan', 'rowspan'],
  th: ['colspan', 'rowspan', 'scope'],
  details: ['open'],
  ol: ['start'],
};

const SAFE_SCHEME = /^(?:https?|mailto|tel):/i;
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const SAFE_DATA_IMAGE = /^data:image\/(?:png|jpe?g|gif|webp);base64,[a-z0-9+/=]+$/i;
const BAD_STYLE = /url\s*\(|expression\s*\(|@import|javascript:|behavior\s*:|-moz-binding/i;

// eslint-disable-next-line no-control-regex
const stripControl = (s: string) => s.replace(/[\u0000- \u007f-\u009f]+/g, '');

function urlIsSafe(value: string, tag: string): boolean {
  const compact = stripControl(value);
  if (tag === 'img' && SAFE_DATA_IMAGE.test(compact)) return true;
  if (compact.startsWith('//') || compact.startsWith('\\\\')) return false; // protocol-relative: points off-site
  if (HAS_SCHEME.test(compact)) return SAFE_SCHEME.test(compact);
  return true; // relative path, query or #anchor
}

function cleanNode(node: Element) {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === 8) {
      node.removeChild(child); // comments
      continue;
    }
    if (child.nodeType !== 1) continue; // text
    const el = child as Element;
    const tag = el.tagName.toLowerCase();

    if (DROP_WITH_CONTENT.has(tag)) {
      node.removeChild(el);
      continue;
    }
    if (!ALLOWED_TAGS.has(tag)) {
      // Unknown wrapper: keep its (cleaned) children, drop the element itself.
      cleanNode(el);
      while (el.firstChild) node.insertBefore(el.firstChild, el);
      node.removeChild(el);
      continue;
    }

    const allowed = new Set([...GLOBAL_ATTRS, ...(TAG_ATTRS[tag] ?? [])]);
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      const ok = allowed.has(name) || name.startsWith('aria-') || name.startsWith('data-');
      if (!ok || name.startsWith('on')) {
        el.removeAttribute(attr.name);
        continue;
      }
      if ((name === 'href' || name === 'src' || name === 'action') && !urlIsSafe(attr.value, tag)) {
        el.removeAttribute(attr.name);
      } else if (name === 'style' && BAD_STYLE.test(attr.value)) {
        el.removeAttribute(attr.name);
      } else if (name === 'type' && tag === 'input' && attr.value.toLowerCase() === 'image') {
        el.setAttribute('type', 'text');
      }
    }
    if (tag === 'a' && el.getAttribute('target') === '_blank') el.setAttribute('rel', 'noopener noreferrer');

    cleanNode(el);
  }
}

export function sanitizeHtml(html: string): string {
  // DOMParser documents are inert: nothing in `html` executes while we inspect it.
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  cleanNode(doc.body);
  return doc.body.innerHTML.trim();
}
