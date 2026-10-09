import { describe, expect, it } from 'vitest';
import { Game, type GameEvent } from '../src/core/game.js';
import { parseContent } from '../src/core/content.js';
import { loadGame, saveGame, type KeyValueStore } from '../src/core/save.js';
import { evaluate, createInitialState } from '../src/core/state.js';
import { sentenceCount } from '../src/core/validate.js';

/** A tiny self-contained story used to test the engine independently of /content. */
function miniContent() {
  return parseContent({
    'world.json': {
      spawn: { at: 'a', yawDeg: 0 },
      zones: [],
      waypoints: { a: [0, 0, 0], b: [5, 0, 0] },
      paths: {},
      npcs: [{ character: 'bob', placements: [{ at: 'a' }] }],
      pickups: [{ item: 'key', at: 'b' }],
      triggers: [{ id: 'door', kind: 'area', at: 'b', when: { item: 'key' }, effects: [{ setFlag: 'door_open' }] }],
      events: ['boom'],
    },
    'characters.json': [
      {
        id: 'bob',
        name: 'Bob',
        look: { kind: 'humanoid', height: 1.7, primary: '#000000', secondary: '#111111', accent: '#222222' },
        voice: { pitch: 200, wave: 'sine', speed: 1 },
        trust: { start: 0, min: -2, max: 2 },
        dialogue: 'bob',
      },
    ],
    'items.json': [{ id: 'key', name: 'Key', description: 'A key.', kind: 'key', color: '#ffffff', shape: 'gear' }],
    'quests.json': [
      {
        id: 'q',
        title: 'Q',
        kind: 'main',
        act: 1,
        description: 'd',
        startWhen: { flag: 'talked' },
        objectives: [
          { id: 'get_key', text: 'Get key', completeWhen: { item: 'key' }, target: 'b' },
          { id: 'open', text: 'Open door', completeWhen: { flag: 'door_open' }, target: 'b' },
        ],
        onComplete: [{ setFlag: 'q_done' }, { emit: 'boom' }],
      },
    ],
    'strings.en.json': {},
    'dialogue/bob.json': {
      id: 'bob',
      owner: 'bob',
      entries: [{ when: { not: { flag: 'talked' } }, start: 'hi' }, { start: 'again' }],
      nodes: {
        hi: {
          text: 'Hello.',
          choices: [
            { text: 'Nice', effects: [{ addTrust: { character: 'bob', amount: 5 } }], next: 'bye' },
            { text: 'Rude', effects: [{ addTrust: { character: 'bob', amount: -5 } }], next: 'bye' },
            { text: 'Secret', when: { flag: 'never' }, next: 'bye' },
          ],
        },
        bye: { text: 'Bye.', effects: [{ setFlag: 'talked' }], end: true },
        again: { text: 'Again?', end: true },
      },
    },
  });
}

describe('conditions', () => {
  it('evaluates flags, items, trust, quests and combinators', () => {
    const c = miniContent();
    const s = createInitialState(c);
    s.flags.a = true;
    s.flags.n = 3;
    s.inventory.push('key');
    s.trust.bob = 1;
    expect(evaluate({ flag: 'a' }, s)).toBe(true);
    expect(evaluate({ flag: 'missing' }, s)).toBe(false);
    expect(evaluate({ flag: 'n', equals: 3 }, s)).toBe(true);
    expect(evaluate({ flag: 'missing', equals: false }, s)).toBe(true);
    expect(evaluate({ item: 'key' }, s)).toBe(true);
    expect(evaluate({ trust: { character: 'bob', gte: 1, lte: 1 } }, s)).toBe(true);
    expect(evaluate({ trust: { character: 'bob', gte: 2 } }, s)).toBe(false);
    expect(evaluate({ quest: { id: 'q', status: 'locked' } }, s)).toBe(true);
    expect(evaluate({ all: [{ flag: 'a' }, { not: { flag: 'missing' } }] }, s)).toBe(true);
    expect(evaluate({ any: [{ flag: 'missing' }, { item: 'key' }] }, s)).toBe(true);
    expect(evaluate(undefined, s)).toBe(true);
  });
});

describe('game engine', () => {
  it('runs dialogue, clamps trust, hides conditional choices and starts quests', () => {
    const g = new Game(miniContent());
    const events: GameEvent[] = [];
    g.on((e) => events.push(e));
    const d = g.startDialogue('bob');
    expect(d).not.toBeNull();
    expect(d!.choices.map((c) => c.choice.text)).toEqual(['Nice', 'Rude']);
    d!.choose(0);
    expect(g.state.trust.bob).toBe(2); // clamped to max
    expect(d!.isLast).toBe(true);
    d!.advance();
    expect(d!.done).toBe(true);
    expect(g.state.quests.q.status).toBe('active');
    expect(events.some((e) => e.type === 'questStarted' && e.quest === 'q')).toBe(true);
    // Second conversation uses the next entry.
    expect(g.startDialogue('bob')!.nodeId).toBe('again');
  });

  it('completes ordered objectives and runs onComplete effects', () => {
    const g = new Game(miniContent());
    const emitted: string[] = [];
    g.on((e) => e.type === 'emit' && emitted.push(e.event));
    g.apply([{ setFlag: 'talked' }]);
    expect(g.fireTrigger('door')).toBe(false); // needs the key
    g.collect('key@b', 'key');
    expect(g.currentObjective('q')?.id).toBe('open');
    expect(g.fireTrigger('door')).toBe(true);
    expect(g.fireTrigger('door')).toBe(false); // once
    expect(g.state.quests.q.status).toBe('completed');
    expect(g.state.flags.q_done).toBe(true);
    expect(emitted).toEqual(['boom']);
  });

  it('round-trips through save/load', () => {
    const mem = new Map<string, string>();
    const store: KeyValueStore = {
      getItem: (k) => mem.get(k) ?? null,
      setItem: (k, v) => void mem.set(k, v),
      removeItem: (k) => void mem.delete(k),
    };
    const c = miniContent();
    const g = new Game(c);
    g.apply([{ setFlag: 'talked' }, { giveItem: 'key' }]);
    expect(saveGame(store, g.state)).toBe(true);
    const loaded = loadGame(store);
    expect(loaded).not.toBeNull();
    const g2 = new Game(c, loaded!.state);
    expect(g2.state.inventory).toEqual(['key']);
    expect(g2.currentObjective('q')?.id).toBe('open');
  });

  it('rejects corrupt or future saves', () => {
    const store: KeyValueStore = { getItem: () => '{"state":{"version":999}}', setItem: () => {}, removeItem: () => {} };
    expect(loadGame(store)).toBeNull();
    const broken: KeyValueStore = { getItem: () => 'not json', setItem: () => {}, removeItem: () => {} };
    expect(loadGame(broken)).toBeNull();
  });

  it('counts sentences', () => {
    expect(sentenceCount('One. Two!')).toBe(2);
    expect(sentenceCount('Scanning... You have ears.')).toBe(2);
    expect(sentenceCount('No punctuation')).toBe(1);
  });
});
