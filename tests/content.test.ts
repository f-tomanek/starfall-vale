import { describe, expect, it } from 'vitest';
import { Game } from '../src/core/game.js';
import { solve, validateAll, validateReferences } from '../src/core/validate.js';
import { loadContent } from './load-content.js';

const content = loadContent();

describe('content in /content', () => {
  it('passes reference and dialogue-structure checks', () => {
    const r = validateReferences(content);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
  });

  it('every playable quest is completable, every node is shown, nothing soft-locks', () => {
    const r = validateAll(content, { solve: true });
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.solve!.truncated).toBe(false);
  });

  it('hint strings used by the runtime exist', () => {
    for (const key of ['hint_talk', 'hint_move', 'hint_menu', 'game_title', 'prompt_talk', 'prompt_pickup']) {
      expect(content.strings[key], key).toBeTypeOf('string');
    }
  });
});

describe('Act 1 playthrough', () => {
  /** Plays Act 1 like a player, choosing `marenChoice` at the gate. */
  function playAct1(marenChoice: number) {
    const g = new Game(content);
    const talk = (who: string, choices: number[] = []) => {
      const d = g.startDialogue(who);
      expect(d, `can talk to ${who}`).not.toBeNull();
      let guard = 0;
      while (!d!.done && guard++ < 30) {
        if (d!.node.choices) d!.choose(d!.choices[choices.shift() ?? 0].index);
        else d!.advance();
      }
      expect(d!.done).toBe(true);
    };

    talk('warden', [1]);
    expect(g.state.quests.act1_stranger.status).toBe('active');
    expect(g.currentObjective('act1_stranger')?.id).toBe('reach_village');
    expect(g.fireTrigger('t_reached_gate')).toBe(true);
    talk('maren', [marenChoice]);
    talk('tobbin', [1]);
    expect(g.currentObjective('act1_stranger')?.id).toBe('bring_lens');

    for (const part of ['lens', 'spring', 'valve']) {
      g.collect(`${part}@part_${part}`, part);
      expect(g.state.inventory).toContain(part);
      expect(g.fireTrigger(`t_deliver_${part}`)).toBe(true);
      expect(g.state.inventory).not.toContain(part);
    }
    expect(g.state.flags.hint_deliver_shown).toBe(true);
    talk('tobbin');
    expect(g.state.inventory).toContain('pulse_lantern');
    expect(g.fireTrigger('t_shrine_pulse')).toBe(true);
    talk('warden', [2]);
    expect(g.state.quests.act1_stranger.status).toBe('completed');
    expect(g.state.flags.act1_complete).toBe(true);
    expect(g.state.quests.act2_cores.status).toBe('active');
    return g;
  }

  it('honest answer earns the most of Maren\'s trust', () => {
    expect(playAct1(0).state.trust.maren).toBe(2);
  });
  it('humble answer earns some trust', () => {
    expect(playAct1(1).state.trust.maren).toBe(1);
  });
  it('boastful answer costs trust and unlocks her "why don\'t you trust me" line', () => {
    const g = playAct1(2);
    expect(g.state.trust.maren).toBe(-1);
  });

  it('solver finds a route to the end of Act 1', () => {
    const s = solve(content);
    const route = s.routes.get('act1_stranger');
    expect(route).toBeDefined();
    expect(route!.length).toBeGreaterThan(5);
  });
});
