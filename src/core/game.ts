/**
 * The story engine: applies effects, advances quests and runs dialogue.
 * Pure TypeScript, no rendering; the ECS systems listen to its events.
 */
import { END, type Choice, type Content, type Dialogue, type DialogueNode, type Effect, type Quest, type Trigger } from './schema.js';
import { createInitialState, evaluate, type GameState } from './state.js';

export type GameEvent =
  | { type: 'changed' }
  | { type: 'emit'; event: string }
  | { type: 'hint'; id: string }
  | { type: 'questStarted'; quest: string }
  | { type: 'questCompleted'; quest: string }
  | { type: 'objectiveCompleted'; quest: string; objective: string }
  | { type: 'itemGained'; item: string }
  | { type: 'itemLost'; item: string }
  | { type: 'trustChanged'; character: string; delta: number };

type Listener = (e: GameEvent) => void;

export class Game {
  readonly content: Content;
  state: GameState;
  private listeners = new Set<Listener>();
  private questById = new Map<string, Quest>();

  constructor(content: Content, state?: GameState) {
    this.content = content;
    this.state = state ?? createInitialState(content);
    for (const q of content.quests) this.questById.set(q.id, q);
    this.reconcile();
  }

  /** Replace the whole state (Continue / New Game) and notify listeners. */
  load(state?: GameState): void {
    this.state = state ?? createInitialState(this.content);
    this.reconcile();
    this.emit({ type: 'changed' });
  }

  on(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(e: GameEvent): void {
    for (const l of this.listeners) l(e);
  }

  /** Make an older save consistent with the current content (new quests, characters). */
  private reconcile(): void {
    for (const c of Object.values(this.content.characters)) {
      if (this.state.trust[c.id] === undefined) this.state.trust[c.id] = c.trust.start;
    }
    for (const q of this.content.quests) {
      if (!this.state.quests[q.id]) this.state.quests[q.id] = { status: 'locked', done: [] };
    }
    this.refreshQuests();
  }

  check = (cond: Parameters<typeof evaluate>[0]): boolean => evaluate(cond, this.state);

  apply(effects: readonly Effect[]): void {
    if (effects.length === 0) return;
    for (const e of effects) this.applyOne(e);
    this.refreshQuests();
    this.emit({ type: 'changed' });
  }

  private applyOne(e: Effect): void {
    const s = this.state;
    if ('setFlag' in e) {
      s.flags[e.setFlag] = e.value ?? true;
    } else if ('addTrust' in e) {
      const c = this.content.characters[e.addTrust.character];
      const before = s.trust[e.addTrust.character] ?? 0;
      const after = Math.max(c?.trust.min ?? -99, Math.min(c?.trust.max ?? 99, before + e.addTrust.amount));
      s.trust[e.addTrust.character] = after;
      if (after !== before) this.emit({ type: 'trustChanged', character: e.addTrust.character, delta: after - before });
    } else if ('giveItem' in e) {
      if (!s.inventory.includes(e.giveItem)) {
        s.inventory.push(e.giveItem);
        this.emit({ type: 'itemGained', item: e.giveItem });
      }
    } else if ('takeItem' in e) {
      const i = s.inventory.indexOf(e.takeItem);
      if (i >= 0) {
        s.inventory.splice(i, 1);
        this.emit({ type: 'itemLost', item: e.takeItem });
      }
    } else if ('startQuest' in e) {
      this.startQuest(e.startQuest);
    } else if ('completeQuest' in e) {
      const qs = s.quests[e.completeQuest];
      if (qs && qs.status !== 'completed') {
        qs.status = 'completed';
        this.emit({ type: 'questCompleted', quest: e.completeQuest });
        this.applyNested(this.questById.get(e.completeQuest)?.onComplete ?? []);
      }
    } else if ('emit' in e) {
      this.emit({ type: 'emit', event: e.emit });
    } else if ('hint' in e) {
      this.emit({ type: 'hint', id: e.hint });
    }
  }

  private applyNested(effects: readonly Effect[]): void {
    for (const e of effects) this.applyOne(e);
  }

  private startQuest(id: string): void {
    const qs = this.state.quests[id];
    if (qs && qs.status === 'locked') {
      qs.status = 'active';
      this.emit({ type: 'questStarted', quest: id });
    }
  }

  /** Start quests whose startWhen holds and tick ordered objectives until stable. */
  refreshQuests(): void {
    for (let guard = 0; guard < 32; guard++) {
      let progressed = false;
      for (const q of this.content.quests) {
        const qs = this.state.quests[q.id];
        if (qs.status === 'locked' && q.startWhen && evaluate(q.startWhen, this.state)) {
          this.startQuest(q.id);
          progressed = true;
        }
        if (qs.status !== 'active') continue;
        for (const o of q.objectives) {
          if (qs.done.includes(o.id)) continue;
          if (!evaluate(o.completeWhen, this.state)) break;
          qs.done.push(o.id);
          progressed = true;
          this.emit({ type: 'objectiveCompleted', quest: q.id, objective: o.id });
        }
        if (qs.done.length === q.objectives.length) {
          qs.status = 'completed';
          progressed = true;
          this.emit({ type: 'questCompleted', quest: q.id });
          this.applyNested(q.onComplete);
        }
      }
      if (!progressed) return;
    }
  }

  // ------------------------------------------------------------------ quests

  quest(id: string): Quest | undefined {
    return this.questById.get(id);
  }

  currentObjective(questId: string) {
    const q = this.questById.get(questId);
    const qs = this.state.quests[questId];
    if (!q || !qs || qs.status !== 'active') return null;
    return q.objectives.find((o) => !qs.done.includes(o.id)) ?? null;
  }

  /** The quest the waypoint follows: the first active main quest, else the first active side quest. */
  trackedQuest(): Quest | null {
    const active = this.content.quests.filter((q) => this.state.quests[q.id].status === 'active');
    return active.find((q) => q.kind === 'main') ?? active[0] ?? null;
  }

  // ---------------------------------------------------------------- triggers

  canFire(t: Trigger): boolean {
    if (t.once && this.state.fired.includes(t.id)) return false;
    return evaluate(t.when, this.state);
  }

  fireTrigger(id: string): boolean {
    const t = this.content.world.triggers.find((x) => x.id === id);
    if (!t || !this.canFire(t)) return false;
    if (t.once) this.state.fired.push(t.id);
    this.apply(t.effects);
    return true;
  }

  collect(pickupKey: string, item: string): void {
    if (!this.state.collected.includes(pickupKey)) this.state.collected.push(pickupKey);
    this.apply([{ giveItem: item }]);
    for (const t of this.content.world.triggers) {
      if (t.kind === 'pickup' && t.item === item) this.fireTrigger(t.id);
    }
  }

  // ---------------------------------------------------------------- dialogue

  startDialogue(characterId: string): DialogueSession | null {
    const id = this.content.characters[characterId]?.dialogue;
    const d = id ? this.content.dialogues[id] : undefined;
    if (!d) return null;
    const entry = d.entries.find((e) => evaluate(e.when, this.state));
    if (!entry) return null;
    return new DialogueSession(this, d, entry.start);
  }
}

export interface VisibleChoice {
  index: number;
  choice: Choice;
}

export class DialogueSession {
  nodeId: string;
  done = false;

  constructor(
    private game: Game,
    readonly dialogue: Dialogue,
    start: string,
  ) {
    this.nodeId = start;
    this.enter(start);
  }

  get node(): DialogueNode {
    return this.dialogue.nodes[this.nodeId];
  }

  get speaker(): string {
    return this.node.speaker ?? this.dialogue.owner;
  }

  /** Choices whose condition holds, keeping their original index. */
  get choices(): VisibleChoice[] {
    return (this.node.choices ?? [])
      .map((choice, index) => ({ index, choice }))
      .filter((c) => this.game.check(c.choice.when));
  }

  get isLast(): boolean {
    const n = this.node;
    return !n.choices && (n.end === true || n.next === undefined || n.next === END);
  }

  private enter(id: string): void {
    if (id === END) {
      this.done = true;
      return;
    }
    this.nodeId = id;
    this.game.apply(this.node.effects);
  }

  /** Continue a line without choices. */
  advance(): void {
    if (this.done) return;
    const n = this.node;
    if (n.choices) return;
    if (this.isLast) {
      this.done = true;
      return;
    }
    this.enter(n.next as string);
  }

  choose(index: number): void {
    if (this.done) return;
    const c = this.node.choices?.[index];
    if (!c || !this.game.check(c.when)) return;
    this.game.apply(c.effects);
    this.enter(c.next);
  }
}
