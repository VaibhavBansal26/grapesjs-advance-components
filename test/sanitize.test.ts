import { describe, expect, it } from 'vitest';
import { sanitizeHtml } from '../src/ai/sanitize';

describe('sanitizeHtml', () => {
  it('keeps ordinary semantic markup', () => {
    const html = '<section class="x"><h2>Hi</h2><p>Text <a href="https://a.com" target="_blank">link</a></p></section>';
    const out = sanitizeHtml(html);
    expect(out).toContain('<h2>Hi</h2>');
    expect(out).toContain('href="https://a.com"');
    expect(out).toContain('rel="noopener noreferrer"');
  });

  it('removes scripts, iframes, svg and their content', () => {
    const out = sanitizeHtml('<p>a</p><script>alert(1)</script><iframe src="https://evil"></iframe><svg onload="x()"><circle/></svg>');
    expect(out).toBe('<p>a</p>');
  });

  it('strips event handlers', () => {
    const out = sanitizeHtml('<img src="https://a.com/x.png" onerror="alert(1)"><div onclick="x()">k</div>');
    expect(out).not.toMatch(/onerror|onclick/);
    expect(out).toContain('src="https://a.com/x.png"');
  });

  it.each(['javascript:alert(1)', ' JaVa\nScRiPt:alert(1)', 'data:text/html;base64,PHNjcmlwdD4=', 'vbscript:x'])(
    'drops script-capable URL %j',
    (url) => {
      const out = sanitizeHtml(`<a href="${url}">x</a>`);
      expect(out).not.toMatch(/href/);
    },
  );

  it('allows relative, anchor, mailto and base64 image URLs', () => {
    expect(sanitizeHtml('<a href="/pricing">a</a>')).toContain('href="/pricing"');
    expect(sanitizeHtml('<a href="#top">a</a>')).toContain('href="#top"');
    expect(sanitizeHtml('<a href="mailto:a@b.co">a</a>')).toContain('mailto:');
    expect(sanitizeHtml('<img src="data:image/png;base64,iVBORw0KGgo=">')).toContain('data:image/png');
  });

  it('drops protocol-relative URLs and dangerous inline styles', () => {
    expect(sanitizeHtml('<a href="//evil.com">a</a>')).not.toContain('href');
    expect(sanitizeHtml('<p style="background:url(https://evil/x)">a</p>')).not.toContain('style');
    expect(sanitizeHtml('<p style="color:red">a</p>')).toContain('style="color:red"');
  });

  it('unwraps unknown elements but keeps their text', () => {
    expect(sanitizeHtml('<custom-box><b>hi</b></custom-box>')).toBe('<b>hi</b>');
  });

  it('removes comments and image-type inputs', () => {
    expect(sanitizeHtml('<!-- x --><p>a</p>')).toBe('<p>a</p>');
    expect(sanitizeHtml('<input type="image" src="x">')).toContain('type="text"');
  });
});
