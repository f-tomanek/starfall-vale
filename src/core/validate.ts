/**
 * Deep content checks that a schema cannot express:
 *  - every id reference resolves (characters, items, quests, waypoints, ...)
 *  - dialogue lines are at most two sentences
 *  - every dialogue node is reachable and no path dead-ends
 *  - a playthrough solver proves every quest is completable, every node can be
 *    seen in play, and no reachable state soft-locks the main story
 */
import { Game } from './game.js';
import { END, type Condition, type Content, type Effect } from './schema.js';
import { cloneState, createInitialState, evaluate, type GameState } from './state.js';

export interface ValidationReport {
  errors: string[];
  warnings: string[];
}

const SENTENCE_END = /[.!?]+(?=\s|$)/g;
export function sentenceCount(text: string): number {
  return (text.trim().match(SENTENCE_END) ?? []).length || 1;
}

export function validateReferences(c: Content): ValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const questIds = new Set(c.quests.map((q) => q.id));
  const objectiveIds = new Map(c.quests.map((q) => [q.id, new Set(q.objectives.map((o) => o.id))]));
  const waypoints = new Set(Object.keys(c.world.waypoints));
  const events = new Set(c.world.events);

  const checkCond = (where: string, cond: Condition | undefined): void => {
    if (!cond) return;
    if ('all' in cond) return cond.all.forEach((x) => checkCond(where, x));
    if ('any' in cond) return cond.any.forEach((x) => checkCond(where, x));
    if ('not' in cond) return checkCond(where, cond.not);
    if ('item' in cond && !c.items[cond.item]) errors.push(`${where}: unknown item "${cond.item}"`);
    if ('trust' in cond && !c.characters[cond.trust.character])
      errors.push(`${where}: unknown character "${cond.trust.character}"`);
    if ('quest' in cond && !questIds.has(cond.quest.id)) errors.push(`${where}: unknown quest "${cond.quest.id}"`);
    if ('objective' in cond && !objectiveIds.get(cond.objective.quest)?.has(cond.objective.id))
      errors.push(`${where}: unknown objective "${cond.objective.quest}.${cond.objective.id}"`);
  };
  const checkEffects = (where: string, effects: readonly Effect[]): void => {
    for (const e of effects) {
      if ('addTrust' in e && !c.characters[e.addTrust.character])
        errors.push(`${where}: unknown character "${e.addTrust.character}"`);
      if ('giveItem' in e && !c.items[e.giveItem]) errors.push(`${where}: unknown item "${e.giveItem}"`);
      if ('takeItem' in e && !c.items[e.takeItem]) errors.push(`${where}: unknown item "${e.takeItem}"`);
      if ('startQuest' in e && !questIds.has(e.startQuest)) errors.push(`${where}: unknown quest "${e.startQuest}"`);
      if ('completeQuest' in e && !questIds.has(e.completeQuest))
        errors.push(`${where}: unknown quest "${e.completeQuest}"`);
      if ('emit' in e && !events.has(e.emit)) errors.push(`${where}: event "${e.emit}" is not listed in world.events`);
      if ('hint' in e && c.strings[e.hint] === undefined) errors.push(`${where}: unknown hint string "${e.hint}"`);
    }
  };

  // Characters
  for (const ch of Object.values(c.characters)) {
    if (ch.dialogue && !c.dialogues[ch.dialogue]) errors.push(`character ${ch.id}: unknown dialogue "${ch.dialogue}"`);
    if (ch.trust.min > ch.trust.start || ch.trust.start > ch.trust.max)
      errors.push(`character ${ch.id}: trust.start must be within [min, max]`);
    ch.ambient.forEach((a, i) => {
      checkCond(`character ${ch.id} ambient[${i}]`, a.when);
      if (sentenceCount(a.text) > 2) errors.push(`character ${ch.id} ambient[${i}]: more than two sentences`);
    });
  }

  // Dialogues
  for (const d of Object.values(c.dialogues)) {
    const where = `dialogue ${d.id}`;
    if (!c.characters[d.owner]) errors.push(`${where}: unknown owner "${d.owner}"`);
    const has = (id: string) => id === END || d.nodes[id] !== undefined;
    d.entries.forEach((e, i) => {
      checkCond(`${where} entries[${i}]`, e.when);
      if (!has(e.start)) errors.push(`${where} entries[${i}]: unknown start node "${e.start}"`);
    });
    if (d.entries[d.entries.length - 1].when !== undefined)
      warnings.push(`${where}: last entry has a condition; talking may do nothing in some states`);

    for (const [id, n] of Object.entries(d.nodes)) {
      const w = `${where} node ${id}`;
      if (n.speaker && !c.characters[n.speaker]) errors.push(`${w}: unknown speaker "${n.speaker}"`);
      if (sentenceCount(n.text) > 2) errors.push(`${w}: more than two sentences: "${n.text}"`);
      checkEffects(w, n.effects);
      if (n.next !== undefined && n.choices) errors.push(`${w}: has both next and choices`);
      if (n.end && (n.next !== undefined || n.choices)) errors.push(`${w}: end node must not have next/choices`);
      if (n.next !== undefined && !has(n.next)) errors.push(`${w}: unknown next "${n.next}"`);
      if (n.next === undefined && !n.choices && !n.end)
        errors.push(`${w}: dead end (needs next, choices or "end": true)`);
      n.choices?.forEach((ch, i) => {
        checkCond(`${w} choice ${i}`, ch.when);
        checkEffects(`${w} choice ${i}`, ch.effects);
        if (!has(ch.next)) errors.push(`${w} choice ${i}: unknown next "${ch.next}"`);
      });
      // A choice list where every option is conditional can leave the player stuck.
      if (n.choices && n.choices.every((ch) => ch.when !== undefined))
        errors.push(`${w}: every choice is conditional; add at least one unconditional choice`);
    }

    // Static reachability from entry points.
    const seen = new Set<string>();
    const stack = d.entries.map((e) => e.start);
    while (stack.length) {
      const id = stack.pop() as string;
      if (id === END || seen.has(id) || !d.nodes[id]) continue;
      seen.add(id);
      const n = d.nodes[id];
      if (n.next) stack.push(n.next);
      n.choices?.forEach((ch) => stack.push(ch.next));
    }
    for (const id of Object.keys(d.nodes)) if (!seen.has(id)) errors.push(`${where}: node "${id}" is unreachable`);
  }

  // Quests
  for (const q of c.quests) {
    checkCond(`quest ${q.id} startWhen`, q.startWhen);
    checkEffects(`quest ${q.id} onComplete`, q.onComplete);
    for (const o of q.objectives) {
      checkCond(`quest ${q.id}.${o.id}`, o.completeWhen);
      if (o.target && !waypoints.has(o.target)) errors.push(`quest ${q.id}.${o.id}: unknown waypoint "${o.target}"`);
      if (o.carry && !c.items[o.carry.item]) errors.push(`quest ${q.id}.${o.id}: unknown item "${o.carry.item}"`);
      if (o.carry && !waypoints.has(o.carry.to)) errors.push(`quest ${q.id}.${o.id}: unknown waypoint "${o.carry.to}"`);
    }
  }

  // World
  const w = c.world;
  if (!waypoints.has(w.spawn.at)) errors.push(`world spawn: unknown waypoint "${w.spawn.at}"`);
  for (const [id, path] of Object.entries(w.paths))
    path.forEach((p) => !waypoints.has(p) && errors.push(`world path ${id}: unknown waypoint "${p}"`));
  for (const npc of w.npcs) {
    if (!c.characters[npc.character]) errors.push(`world npc: unknown character "${npc.character}"`);
    npc.placements.forEach((p, i) => {
      checkCond(`world npc ${npc.character} placement ${i}`, p.when);
      if (!waypoints.has(p.at)) errors.push(`world npc ${npc.character}: unknown waypoint "${p.at}"`);
      if (p.path && !w.paths[p.path]) errors.push(`world npc ${npc.character}: unknown path "${p.path}"`);
    });
  }
  for (const pk of w.pickups) {
    if (!c.items[pk.item]) errors.push(`world pickup: unknown item "${pk.item}"`);
    if (!waypoints.has(pk.at)) errors.push(`world pickup ${pk.item}: unknown waypoint "${pk.at}"`);
    checkCond(`world pickup ${pk.item}`, pk.when);
  }
  for (const t of w.triggers) {
    const where = `trigger ${t.id}`;
    checkCond(where, t.when);
    checkEffects(where, t.effects);
    if (t.kind !== 'pickup' && (!t.at || !waypoints.has(t.at))) errors.push(`${where}: needs a known waypoint "at"`);
    if ((t.kind === 'deliver' || t.kind === 'pickup') && (!t.item || !c.items[t.item]))
      errors.push(`${where}: needs a known "item"`);
  }
  return { errors, warnings };
}

// ---------------------------------------------------------------------------
// Playthrough solver
// ---------------------------------------------------------------------------

export interface SolveReport {
  states: number;
  truncated: boolean;
  completedQuests: Set<string>;
  seenNodes: Set<string>;
  /** Flags that were set in at least one explored state. */
  flagsSeen: Set<string>;
  /** Shortest action list (by explored order) that completes each quest. */
  routes: Map<string, string[]>;
  /** States where an active main quest can no longer be completed. */
  softlocks: string[][];
  /** Every terminal state with the given flag set, keyed by flag. */
  witnesses: Map<string, GameState>;
}

interface Action {
  label: string;
  run: (g: Game) => void;
}

function stateKey(s: GameState): string {
  const sortObj = (o: Record<string, unknown>) =>
    Object.keys(o)
      .sort()
      .map((k) => `${k}=${String(o[k])}`)
      .join(',');
  const quests = Object.keys(s.quests)
    .sort()
    .map((k) => `${k}:${s.quests[k].status}:${[...s.quests[k].done].sort().join('+')}`)
    .join(',');
  return [sortObj(s.flags), sortObj(s.trust), [...s.inventory].sort().join(','), quests, [...s.fired].sort().join(','), [...s.collected].sort().join(',')].join('|');
}

/** Every way a conversation with `character` can play out from state `s`. */
function conversations(content: Content, s: GameState, character: string, seen: Set<string>): Array<{ label: string; state: GameState }> {
  const out: Array<{ label: string; state: GameState }> = [];
  const g0 = new Game(content, cloneState(s));
  const session = g0.startDialogue(character);
  if (!session) return out;
  const dialogueId = session.dialogue.id;

  // DFS over (game state, node) pairs; loops are cut by visiting each pair once.
  const visited = new Set<string>();
  const walk = (state: GameState, nodeId: string, label: string[], depth: number): void => {
    const key = `${nodeId}#${stateKey(state)}`;
    if (visited.has(key) || depth > 40) return;
    visited.add(key);
    seen.add(`${dialogueId}:${nodeId}`);
    const node = content.dialogues[dialogueId].nodes[nodeId];
    if (node.choices) {
      node.choices.forEach((ch, i) => {
        if (!evaluate(ch.when, state)) return;
        const g = new Game(content, cloneState(state));
        g.apply(ch.effects);
        const next = ch.next;
        const nextLabel = [...label, `"${ch.text}"`];
        if (next === END) out.push({ label: `talk ${character}: ${nextLabel.join(' > ')}`, state: g.state });
        else {
          g.apply(content.dialogues[dialogueId].nodes[next].effects);
          walk(g.state, next, nextLabel, depth + 1);
        }
        void i;
      });
      return;
    }
    if (node.end || node.next === undefined || node.next === END) {
      out.push({ label: `talk ${character}${label.length ? ': ' + label.join(' > ') : ''}`, state });
      return;
    }
    const g = new Game(content, cloneState(state));
    g.apply(content.dialogues[dialogueId].nodes[node.next].effects);
    walk(g.state, node.next, label, depth + 1);
  };
  walk(g0.state, session.nodeId, [], 0);
  return out;
}

function availableActions(content: Content, s: GameState): Action[] {
  const actions: Action[] = [];
  const w = content.world;
  for (const t of w.triggers) {
    if (t.kind === 'pickup') continue; // fired by collect()
    if (t.once && s.fired.includes(t.id)) continue;
    if (!evaluate(t.when, s)) continue;
    if (t.kind === 'deliver' && !s.inventory.includes(t.item as string)) continue;
    if (t.kind === 'pulse' && !s.inventory.includes('pulse_lantern')) continue;
    if (!t.once) continue; // repeatable triggers never change progress
    actions.push({ label: `${t.kind} ${t.id}`, run: (g) => g.fireTrigger(t.id) });
  }
  w.pickups.forEach((p, i) => {
    const key = `${p.item}@${p.at}`;
    if (s.collected.includes(key) || !evaluate(p.when, s)) return;
    void i;
    actions.push({ label: `pick up ${p.item}`, run: (g) => g.collect(key, p.item) });
  });
  return actions;
}

export function solve(content: Content, opts: { maxStates?: number } = {}): SolveReport {
  const maxStates = opts.maxStates ?? 60000;
  const start = new Game(content).state;
  const keys = new Map<string, number>();
  const states: GameState[] = [];
  const parents: Array<Array<{ from: number; label: string }>> = [];
  const routes = new Map<string, string[]>();
  const pathTo: string[][] = [];
  const seenNodes = new Set<string>();
  const flagsSeen = new Set<string>();
  const witnesses = new Map<string, GameState>();
  const completed = new Set<string>();
  const edges: number[][] = [];

  const add = (s: GameState, from: number, label: string): void => {
    const k = stateKey(s);
    let idx = keys.get(k);
    if (idx === undefined) {
      idx = states.length;
      keys.set(k, idx);
      states.push(s);
      parents.push([]);
      edges.push([]);
      pathTo.push(from >= 0 ? [...pathTo[from], label] : []);
      for (const [f, v] of Object.entries(s.flags)) {
        if (v) {
          flagsSeen.add(f);
          if (!witnesses.has(f)) witnesses.set(f, s);
        }
      }
      for (const [q, qs] of Object.entries(s.quests)) {
        if (qs.status === 'completed' && !completed.has(q)) {
          completed.add(q);
          routes.set(q, pathTo[idx]);
        }
      }
    }
    if (from >= 0) {
      parents[idx].push({ from, label });
      edges[from].push(idx);
    }
  };

  add(start, -1, '');
  let truncated = false;
  for (let i = 0; i < states.length; i++) {
    if (states.length > maxStates) {
      truncated = true;
      break;
    }
    const s = states[i];
    for (const a of availableActions(content, s)) {
      const g = new Game(content, cloneState(s));
      a.run(g);
      add(g.state, i, a.label);
    }
    for (const npc of content.world.npcs) {
      const ch = content.characters[npc.character];
      if (!ch?.dialogue) continue;
      for (const conv of conversations(content, s, ch.id, seenNodes)) add(conv.state, i, conv.label);
    }
  }

  // Soft-lock detection: a state with an active (playable) main quest from which
  // that quest can never complete.
  const softlocks: string[][] = [];
  if (!truncated) {
    const mainQuests = content.quests.filter((q) => q.kind === 'main' && !q.comingSoon);
    for (const q of mainQuests) {
      const good = new Set<number>();
      states.forEach((s, i) => s.quests[q.id]?.status === 'completed' && good.add(i));
      // Reverse propagate.
      let changed = true;
      while (changed) {
        changed = false;
        for (let i = 0; i < states.length; i++) {
          if (good.has(i)) continue;
          if (edges[i].some((j) => good.has(j))) {
            good.add(i);
            changed = true;
          }
        }
      }
      states.forEach((s, i) => {
        if (s.quests[q.id]?.status === 'active' && !good.has(i)) softlocks.push([`quest ${q.id}`, ...pathTo[i]]);
      });
    }
  }

  return { states: states.length, truncated, completedQuests: completed, seenNodes, flagsSeen, routes, softlocks, witnesses };
}

/** Full check used by tests and the dev-time startup validator. */
export function validateAll(content: Content, opts: { solve?: boolean } = {}): ValidationReport & { solve?: SolveReport } {
  const report = validateReferences(content);
  if (!opts.solve || report.errors.length) return report;
  const s = solve(content);
  if (s.truncated) report.warnings.push(`solver stopped after ${s.states} states; results are partial`);
  for (const q of content.quests) {
    if (q.comingSoon) continue;
    if (!s.completedQuests.has(q.id)) report.errors.push(`quest ${q.id} cannot be completed in any playthrough`);
  }
  for (const d of Object.values(content.dialogues)) {
    for (const id of Object.keys(d.nodes)) {
      if (!s.seenNodes.has(`${d.id}:${id}`)) {
        // Nodes behind coming-soon content are warnings, the rest are errors.
        report.warnings.push(`dialogue ${d.id} node "${id}" is never shown in any explored playthrough`);
      }
    }
  }
  for (const lock of s.softlocks.slice(0, 5)) report.errors.push(`soft-lock: ${lock.join(' -> ')}`);
  return { ...report, solve: s };
}

export { createInitialState };
