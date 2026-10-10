// Pretty-prints content JSON, keeping short objects/arrays on one line.
// Usage: node scripts/format-json.mjs content/world.json [more files...]
import { readFileSync, writeFileSync } from 'node:fs';

function fmt(v, indent = '') {
  const flat = JSON.stringify(v);
  if (flat.length + indent.length <= 110 || v === null || typeof v !== 'object') {
    return flat.replace(/":/g, '": ').replace(/,(?=["{[\d-]|true|false|null)/g, ', ').replace(/^\{/, '{ ').replace(/\}$/, ' }').replace(/\{ \}/g, '{}');
  }
  const inner = indent + '  ';
  if (Array.isArray(v)) return `[\n${v.map((x) => inner + fmt(x, inner)).join(',\n')}\n${indent}]`;
  return `{\n${Object.entries(v).map(([k, x]) => `${inner}${JSON.stringify(k)}: ${fmt(x, inner)}`).join(',\n')}\n${indent}}`;
}

for (const f of process.argv.slice(2)) writeFileSync(f, fmt(JSON.parse(readFileSync(f, 'utf8'))) + '\n');
