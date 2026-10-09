import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { parseContent } from '../src/core/content.js';
import type { Content } from '../src/core/schema.js';

export const CONTENT_DIR = join(__dirname, '..', 'content');

export function readContentFiles(dir = CONTENT_DIR): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const walk = (d: string) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (name.endsWith('.json')) out[relative(dir, p).split(sep).join('/')] = JSON.parse(readFileSync(p, 'utf8'));
    }
  };
  walk(dir);
  return out;
}

export function loadContent(): Content {
  return parseContent(readContentFiles());
}
