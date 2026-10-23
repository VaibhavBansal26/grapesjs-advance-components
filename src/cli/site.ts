import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import type { SiteOptions } from './generate';

/** What `aac.json` remembers so `build`, `edit` and `serve` reproduce a site exactly. Never holds a secret. */
export interface SavedConfig extends SiteOptions {
  template?: string;
  brief?: string;
  accent?: string;
  theme?: string;
}

export async function readConfig(dir: string): Promise<SavedConfig> {
  try {
    return JSON.parse(await readFile(join(dir, 'aac.json'), 'utf8')) as SavedConfig;
  } catch {
    return {};
  }
}

export async function writeFiles(dir: string, files: Record<string, string>): Promise<void> {
  await mkdir(dir, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    const target = join(dir, name);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content);
  }
}

/** Write a generated site: project.json, aac.json and public/. Called only after the scanner has passed. */
export async function saveSite(
  dir: string,
  site: { project: Record<string, unknown>; files: Record<string, string>; config: SavedConfig },
): Promise<void> {
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'project.json'), JSON.stringify(site.project, null, 2));
  await writeFile(join(dir, 'aac.json'), JSON.stringify(site.config, null, 2));
  await writeFiles(join(dir, 'public'), site.files);
}

/** Replace project.json atomically so an interrupted write cannot leave a half-written project. */
export async function writeProject(dir: string, project: unknown): Promise<void> {
  const file = join(dir, 'project.json');
  await writeFile(`${file}.tmp`, JSON.stringify(project, null, 2));
  await rename(`${file}.tmp`, file);
}

/** Resolve `name` under `root` and refuse anything that escapes it. */
export function confined(root: string, name: string): string {
  const base = resolve(root);
  const target = resolve(base, name);
  if (target !== base && !target.startsWith(base + sep)) throw new Error('Path escapes the root folder.');
  return target;
}
