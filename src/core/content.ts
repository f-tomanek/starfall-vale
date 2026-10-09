/**
 * Turns raw JSON files into validated Content.
 *
 * `files` maps a path relative to /content (e.g. "dialogue/tobbin.json") to its
 * parsed JSON. The game passes the output of import.meta.glob; tests read the
 * files from disk.
 */
import { z } from 'zod';
import {
  CharacterSchema,
  DialogueSchema,
  ItemSchema,
  QuestSchema,
  StringsSchema,
  WorldSchema,
  type Content,
} from './schema.js';

export class ContentError extends Error {
  constructor(readonly problems: string[]) {
    super(`Content has ${problems.length} problem(s):\n- ${problems.join('\n- ')}`);
  }
}

function zodProblems(file: string, err: z.ZodError): string[] {
  return err.issues.map((i) => `${file}: ${i.path.join('.') || '(root)'}: ${i.message}`);
}

export function parseContent(files: Record<string, unknown>, locale = 'en'): Content {
  const problems: string[] = [];
  const need = (name: string): unknown => {
    if (!(name in files)) problems.push(`missing file content/${name}`);
    return files[name];
  };
  const parse = <S extends z.ZodTypeAny>(name: string, schema: S, value: unknown): z.output<S> | undefined => {
    const r = schema.safeParse(value);
    if (!r.success) {
      problems.push(...zodProblems(name, r.error));
      return undefined;
    }
    return r.data;
  };

  const world = parse('world.json', WorldSchema, need('world.json'));
  const characters = parse('characters.json', z.array(CharacterSchema), need('characters.json')) ?? [];
  const items = parse('items.json', z.array(ItemSchema), need('items.json')) ?? [];
  const quests = parse('quests.json', z.array(QuestSchema), need('quests.json')) ?? [];
  const strings = parse(`strings.${locale}.json`, StringsSchema, need(`strings.${locale}.json`)) ?? {};

  const dialogues: Content['dialogues'] = {};
  for (const [name, value] of Object.entries(files)) {
    if (!name.startsWith('dialogue/')) continue;
    const d = parse(name, DialogueSchema, value);
    if (!d) continue;
    if (dialogues[d.id]) problems.push(`${name}: duplicate dialogue id "${d.id}"`);
    dialogues[d.id] = d;
  }

  const byId = <T extends { id: string }>(kind: string, list: T[]): Record<string, T> => {
    const out: Record<string, T> = {};
    for (const x of list) {
      if (out[x.id]) problems.push(`duplicate ${kind} id "${x.id}"`);
      out[x.id] = x;
    }
    return out;
  };

  const content: Content = {
    world: world as Content['world'],
    characters: byId('character', characters),
    items: byId('item', items),
    quests,
    dialogues,
    strings,
  };
  byId('quest', quests);
  if (problems.length > 0 || !world) throw new ContentError(problems);
  return content;
}
