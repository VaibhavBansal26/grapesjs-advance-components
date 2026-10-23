/**
 * Security headers for a published static site, in the `_headers` format that Netlify and
 * Cloudflare Pages read. The policy is strict (no inline script or style, no `unsafe-eval`)
 * and relies on `assets: 'external'` exports, which contain neither.
 */

export interface SecurityHeaderOptions {
  /** Origins the pages may send data to (a form endpoint on another host). `'self'` is always allowed. */
  connectOrigins?: Array<string | undefined>;
}

/** `https://api.example.com/hook?x=1` becomes `https://api.example.com`. Relative paths and junk give `undefined`. */
export function originOf(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.origin : undefined;
  } catch {
    return undefined;
  }
}

export function contentSecurityPolicy(opts: SecurityHeaderOptions = {}): string {
  const origins = [...new Set((opts.connectOrigins ?? []).filter(Boolean))];
  const self = ["'self'", ...origins].join(' ');
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data: https:",
    "font-src 'self'",
    `connect-src ${self}`,
    `form-action ${self}`,
    "base-uri 'none'",
    "object-src 'none'",
    "frame-ancestors 'none'",
  ].join('; ');
}

export function securityHeaders(opts: SecurityHeaderOptions = {}): string {
  return `/*
  Content-Security-Policy: ${contentSecurityPolicy(opts)}
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
`;
}
