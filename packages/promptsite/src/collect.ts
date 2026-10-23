import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';

const SKIP_DIRS = new Set(['node_modules', '.git', '.next', 'dist-cache']);
const TEXT = /\.(html?|css|js|mjs|json|txt|xml|svg|webmanifest|map|md|ya?ml|env|ts|tsx|jsx|cjs|vue|svelte|astro|py|rb|go|php|java|sh|bash|toml|ini|cfg|conf|properties|pem|key|crt|csv|tsv)$|(^|\/)_headers$/i;
const MAX_FILES = 2000;
const MAX_BYTES = 2_000_000;

/**
 * Read the text files an audit should look at, keyed by path relative to `target`.
 * For a generated site folder that is `public/*`, `project.json` and `promptsite.json`; for any other
 * folder it is every text file (depth-limited, without `node_modules` or `.git`).
 */
export async function collectAuditFiles(target: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const isSite = await stat(join(target, 'project.json')).then(() => true, () => false);
  const roots = isSite ? ['public', 'project.json', 'promptsite.json'] : [''];

  const visit = async (abs: string, depth: number) => {
    if (Object.keys(out).length >= MAX_FILES) return;
    const info = await stat(abs).catch(() => undefined);
    if (!info) return;
    if (info.isDirectory()) {
      if (depth > 6) return;
      for (const entry of await readdir(abs, { withFileTypes: true })) {
        if (entry.isSymbolicLink() || SKIP_DIRS.has(entry.name)) continue;
        await visit(join(abs, entry.name), depth + 1);
      }
    } else if (info.isFile() && info.size <= MAX_BYTES && TEXT.test(abs)) {
      out[relative(target, abs).split('\\').join('/')] = await readFile(abs, 'utf8');
    }
  };
  for (const r of roots) await visit(join(target, r), 0);
  return out;
}
