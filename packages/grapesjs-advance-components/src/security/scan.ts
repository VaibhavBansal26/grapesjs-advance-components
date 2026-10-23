/**
 * Scans generated output for leaked secrets and risky markup.
 *
 * Everything in a static site is public, so a key that reaches `public/`, `project.json` or
 * `aac.json` is a leak. The scanner runs before anything is written (fail closed) and never
 * returns or prints a full secret: matches are redacted to a short prefix and a length.
 *
 * It is a heuristic net, not a proof: it catches well-known token formats and secret-looking
 * URLs, not every possible secret.
 */

export type Severity = 'high' | 'medium' | 'low';

export interface Finding {
  severity: Severity;
  rule: string;
  file: string;
  line: number;
  message: string;
  /** Redacted evidence, e.g. `sk-a…(48)`. Never the full value. */
  match: string;
}

interface Rule {
  id: string;
  severity: Severity;
  message: string;
  pattern: RegExp;
  /** Only run on these file extensions (default: all text files). */
  ext?: string[];
}

const TEXT_EXT = /\.(html?|css|js|mjs|json|txt|xml|svg|webmanifest|map|md|ya?ml|env|ts|tsx|jsx|cjs|vue|svelte|astro|py|rb|go|php|java|sh|bash|toml|ini|cfg|conf|properties|pem|key|crt|csv|tsv)$/i;

/** Show enough to recognise the kind of value, never enough to use it. */
export const redactMatch = (value: string): string => `${value.slice(0, 4)}…(${value.length})`;

const SECRET_PARAM = '(?:api[_-]?key|apikey|access[_-]?token|auth[_-]?token|token|secret|client[_-]?secret|password|passwd|signature|sig)';

const RULES: Rule[] = [
  // Known token formats
  { id: 'anthropic-key', severity: 'high', message: 'Anthropic API key', pattern: /\bsk-ant-[A-Za-z0-9_-]{20,}/g },
  { id: 'openai-key', severity: 'high', message: 'OpenAI-style API key', pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}/g },
  { id: 'stripe-secret-key', severity: 'high', message: 'Stripe secret or restricted key (publishable pk_ keys are fine)', pattern: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}/g },
  { id: 'stripe-webhook-secret', severity: 'high', message: 'Stripe webhook signing secret', pattern: /\bwhsec_[A-Za-z0-9]{16,}/g },
  { id: 'github-token', severity: 'high', message: 'GitHub token', pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{50,})/g },
  { id: 'aws-access-key', severity: 'high', message: 'AWS access key id', pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g },
  { id: 'slack-token', severity: 'high', message: 'Slack token', pattern: /\bxox[abprs]-[A-Za-z0-9-]{10,}/g },
  { id: 'private-key', severity: 'high', message: 'Private key block', pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY(?: BLOCK)?-----/g },
  { id: 'n8n-api-key', severity: 'high', message: 'n8n API key header or value', pattern: /X-N8N-API-KEY["'\s:=]+[A-Za-z0-9._-]{8,}/gi },
  { id: 'google-api-key', severity: 'medium', message: 'Google API key (fine only if it is a browser key restricted by referrer)', pattern: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { id: 'jwt', severity: 'medium', message: 'JSON Web Token', pattern: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g },

  // Secrets carried by URLs (including webhook URLs that act as bearer credentials)
  { id: 'url-credentials', severity: 'high', message: 'Username and password inside a URL', pattern: /\bhttps?:\/\/[^\s/:@"'<>]+:[^\s/@"'<>]+@[^\s"'<>]+/g },
  { id: 'url-secret-param', severity: 'high', message: 'URL carries a secret-looking query parameter (anything in a static site is public)', pattern: new RegExp(`[?&]${SECRET_PARAM}=[^&\\s"'<>)]{8,}`, 'gi') },
  { id: 'webhook-test-url', severity: 'medium', message: 'n8n test webhook URL (/webhook-test/ is for development only)', pattern: /\bhttps?:\/\/[^\s"'<>]+\/webhook-test\/[^\s"'<>]+/g },
  { id: 'public-webhook-url', severity: 'low', message: 'A webhook URL is a bearer capability and is public here: keep privileged workflows off it and validate input server-side', pattern: /\bhttps?:\/\/[^\s"'<>]+\/webhook\/[^\s"'<>]+/g },
  { id: 'hardcoded-secret', severity: 'medium', message: 'Hard-coded secret-like assignment', pattern: /\b(?:secret|password|passwd|api[_-]?key|access[_-]?token|auth[_-]?token)\b["']?\s*[:=]\s*["'][^"'\s]{12,}["']/gi, ext: ['js', 'mjs', 'html', 'htm', 'json'] },

  // Risky markup
  { id: 'inline-event-handler', severity: 'medium', message: 'Inline event handler attribute (XSS risk, blocks a strict CSP)', pattern: /<[a-z][^>]*\son[a-z]+\s*=/gi, ext: ['html', 'htm'] },
  { id: 'javascript-url', severity: 'high', message: 'javascript: URL', pattern: /\b(?:href|src|action)\s*=\s*["']\s*javascript:/gi, ext: ['html', 'htm'] },
  { id: 'insecure-form-action', severity: 'high', message: 'Form posts over plain http', pattern: /<form[^>]*\saction\s*=\s*["']http:\/\/(?!localhost|127\.0\.0\.1)[^"']*/gi, ext: ['html', 'htm'] },
  { id: 'mixed-content', severity: 'medium', message: 'Loads a resource over plain http', pattern: /\b(?:src|href)\s*=\s*["']http:\/\/(?!localhost|127\.0\.0\.1)[^"']*["']/gi, ext: ['html', 'htm', 'css'] },
  { id: 'third-party-script', severity: 'medium', message: 'Loads a script from another host (supply-chain risk, blocked by a strict CSP)', pattern: /<script[^>]*\ssrc\s*=\s*["']https?:\/\/[^"']+["']/gi, ext: ['html', 'htm'] },
  { id: 'inline-script', severity: 'low', message: 'Inline script (use assets: external for a strict CSP)', pattern: /<script(?![^>]*\ssrc=)[^>]*>\s*\S/gi, ext: ['html', 'htm'] },
  { id: 'dynamic-eval', severity: 'medium', message: 'eval() or new Function() in script', pattern: /\b(?:eval\s*\(|new\s+Function\s*\()/g, ext: ['js', 'mjs'] },
];

export const RULE_IDS = RULES.map((r) => r.id);

export interface ScanOptions {
  /** Rule ids to ignore, e.g. `['public-webhook-url']`. Explicit and recorded in the result. */
  allow?: string[];
}

const extOf = (name: string) => (name.match(/\.([a-z0-9]+)$/i)?.[1] ?? '').toLowerCase();

/** Scan a `{ fileName: content }` map. Files that are not text are skipped. */
export function scanFiles(files: Record<string, string>, opts: ScanOptions = {}): Finding[] {
  const allow = new Set(opts.allow ?? []);
  const findings: Finding[] = [];
  for (const [file, content] of Object.entries(files)) {
    if (typeof content !== 'string' || !TEXT_EXT.test(file) || content.length > 5_000_000) continue;
    const ext = extOf(file);
    for (const rule of RULES) {
      if (allow.has(rule.id) || (rule.ext && !rule.ext.includes(ext))) continue;
      rule.pattern.lastIndex = 0;
      for (const m of content.matchAll(rule.pattern)) {
        const line = content.slice(0, m.index ?? 0).split('\n').length;
        findings.push({ severity: rule.severity, rule: rule.id, file, line, message: rule.message, match: redactMatch(m[0]) });
        if (findings.length > 500) return findings; // a pathological file should not flood the report
      }
    }
  }
  const rank: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
  return findings.sort((a, b) => rank[a.severity] - rank[b.severity] || a.file.localeCompare(b.file) || a.line - b.line);
}

export class SecurityError extends Error {
  constructor(public findings: Finding[]) {
    super(formatFindings(findings, 'Blocked: potential leak or unsafe output found. Nothing was written.'));
    this.name = 'SecurityError';
  }
}

export const formatFindings = (findings: Finding[], heading?: string): string =>
  [heading, ...findings.slice(0, 20).map((f) => `  [${f.severity}] ${f.file}:${f.line} ${f.rule}: ${f.message} (${f.match})`), findings.length > 20 ? `  …and ${findings.length - 20} more` : undefined]
    .filter(Boolean)
    .join('\n');

/** Throw if anything at or above `threshold` is found. Default `high`: secrets and exploitable markup. */
export function assertSafe(files: Record<string, string>, opts: ScanOptions & { threshold?: Severity } = {}): Finding[] {
  const findings = scanFiles(files, opts);
  const order: Severity[] = ['high', 'medium', 'low'];
  const limit = order.indexOf(opts.threshold ?? 'high');
  const blocking = findings.filter((f) => order.indexOf(f.severity) <= limit);
  if (blocking.length) throw new SecurityError(blocking);
  return findings;
}

/**
 * Remove known secret formats and any literal secret values from text before it is shown or logged.
 * `literals` are exact values (for example the contents of ANTHROPIC_API_KEY) that must never appear.
 */
export function redactSecrets(text: string, literals: Array<string | undefined> = []): string {
  let out = text;
  for (const lit of literals) if (lit && lit.length >= 8) out = out.split(lit).join('[redacted]');
  for (const rule of RULES) {
    if (rule.severity !== 'high' || rule.id.startsWith('url-') || rule.id === 'private-key') continue;
    rule.pattern.lastIndex = 0;
    out = out.replace(rule.pattern, '[redacted]');
  }
  return out.replace(new RegExp(`([?&]${SECRET_PARAM}=)[^&\\s"'<>)]+`, 'gi'), '$1[redacted]');
}
