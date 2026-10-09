import type { Condition, Content, QuestStatus } from './schema.js';

export interface QuestState {
  status: QuestStatus;
  /** Ids of completed objectives. */
  done: string[];
}

/** Everything that is saved. Plain JSON so it survives localStorage. */
export interface GameState {
  version: number;
  flags: Record<string, boolean | number>;
  trust: Record<string, number>;
  inventory: string[];
  quests: Record<string, QuestState>;
  /** Trigger ids that already fired (for once-only triggers). */
  fired: string[];
  /** Item pickups already collected from the world. */
  collected: string[];
  /** Player position [x, y, z] and yaw in degrees. */
  player: { position: [number, number, number]; yawDeg: number } | null;
  playSeconds: number;
}

export const STATE_VERSION = 1;

export function createInitialState(content: Content): GameState {
  const trust: Record<string, number> = {};
  for (const c of Object.values(content.characters)) trust[c.id] = c.trust.start;
  const quests: Record<string, QuestState> = {};
  for (const q of content.quests) quests[q.id] = { status: 'locked', done: [] };
  return {
    version: STATE_VERSION,
    flags: {},
    trust,
    inventory: [],
    quests,
    fired: [],
    collected: [],
    player: null,
    playSeconds: 0,
  };
}

export function cloneState(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state)) as GameState;
}

export function evaluate(cond: Condition | undefined, s: GameState): boolean {
  if (cond == null) return true;
  if ('all' in cond) return cond.all.every((c) => evaluate(c, s));
  if ('any' in cond) return cond.any.some((c) => evaluate(c, s));
  if ('not' in cond) return !evaluate(cond.not, s);
  if ('flag' in cond) {
    const v = s.flags[cond.flag];
    if (cond.equals === undefined) return v === true || (typeof v === 'number' && v !== 0);
    return (v ?? false) === cond.equals;
  }
  if ('item' in cond) return s.inventory.includes(cond.item);
  if ('trust' in cond) {
    const t = s.trust[cond.trust.character] ?? 0;
    if (cond.trust.gte !== undefined && t < cond.trust.gte) return false;
    if (cond.trust.lte !== undefined && t > cond.trust.lte) return false;
    return true;
  }
  if ('quest' in cond) return (s.quests[cond.quest.id]?.status ?? 'locked') === cond.quest.status;
  if ('objective' in cond) return s.quests[cond.objective.quest]?.done.includes(cond.objective.id) ?? false;
  return false;
}
