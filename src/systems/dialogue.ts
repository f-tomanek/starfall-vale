/**
 * Dialogue UI: a world-space panel placed in front of the player when a
 * conversation starts. Choices: point + trigger (VR), click or 1-4 keys
 * (desktop); Continue: A / Space / Enter as well.
 */
import { InputComponent, Vector3, createSystem } from '@iwsdk/core';
import type { DialogueSession } from '../core/game.js';
import { Panel } from '../ui/panel.js';
import { haptic, immersive, placeInFront, rt, t, viewerPosition } from '../runtime.js';
import { NpcSystem } from './npc.js';

const WALK_AWAY = 6;

export class DialogueSystem extends createSystem({}) {
  private panel: Panel | null = null;
  private session: DialogueSession | null = null;
  private character: string | null = null;
  /** Visible choice -> original choice index; -1 means "continue / end". */
  private slots: number[] = [];
  private npcPos = new Vector3();
  private eye = new Vector3();
  private openedAt = 0;

  init(): void {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    rt.dialogue = {
      open: (id) => this.open(id),
      close: () => this.close(),
      get talkingTo() {
        return self.character;
      },
    };
    void Panel.create(this.world, 'dialogue-panel', 'DialoguePanel').then((p) => {
      this.panel = p;
      for (let i = 0; i < 4; i++) this.cleanupFuncs.push(p.onClick(`choice${i}`, () => this.pick(i)));
    });
  }

  private open(id: string): boolean {
    if (!this.panel || this.session) return false;
    const s = rt.game.startDialogue(id);
    if (!s) return false;
    this.session = s;
    this.character = id;
    this.openedAt = performance.now();
    placeInFront(this.panel.doc, 1.2, -0.3, 0.35);
    this.panel.show();
    rt.audio.sfx('open');
    this.render();
    return true;
  }

  private close(): void {
    if (!this.panel) return;
    this.panel.hide();
    this.session = null;
    this.character = null;
    rt.audio.sfx('close');
  }

  private render(): void {
    const s = this.session;
    const p = this.panel;
    if (!s || !p) return;
    if (s.done) {
      this.close();
      return;
    }
    const speaker = rt.content.characters[s.speaker];
    p.text('speaker', speaker?.name ?? s.speaker);
    p.text('line', s.node.text);
    const choices = s.node.choices ? s.choices : [];
    this.slots = [];
    for (let i = 0; i < 4; i++) {
      if (choices.length > 0 && i < choices.length) {
        p.display(`choice${i}`, true);
        p.text(`choice${i}`, `${i + 1}. ${choices[i].choice.text}`);
        this.slots.push(choices[i].index);
      } else if (choices.length === 0 && i === 0) {
        p.display('choice0', true);
        p.text('choice0', s.isLast ? t('dialogue_end') : `${t('dialogue_continue')}  >`);
        this.slots.push(-1);
      } else {
        p.display(`choice${i}`, false);
      }
    }
    const pos = NpcSystem.instance?.positionOf(s.speaker, this.npcPos) ?? undefined;
    if (speaker) rt.audio.speak(s.node.text, speaker.voice, pos);
  }

  private pick(slot: number): void {
    const s = this.session;
    if (!s || slot >= this.slots.length) return;
    rt.audio.sfx('click');
    haptic('right', 0.35, 25);
    const choice = this.slots[slot];
    if (choice === -1) s.advance();
    else s.choose(choice);
    this.render();
  }

  update(): void {
    if (!this.session || !this.character) return;
    // Walking away ends the conversation.
    const pos = NpcSystem.instance?.positionOf(this.character, this.npcPos);
    if (pos && pos.distanceTo(viewerPosition(this.eye)) > WALK_AWAY) {
      this.close();
      return;
    }
    if (rt.ui.menuOpen) {
      this.close();
      return;
    }
    if (performance.now() - this.openedAt < 200) return; // ignore the button that opened it
    const kb = this.input.keyboard;
    if (!immersive()) {
      for (let i = 0; i < 4; i++) if (kb.getKeyDown(`Digit${i + 1}`)) this.pick(i);
      if (this.slots.length === 1 && this.slots[0] === -1 && (kb.getKeyDown('Space') || kb.getKeyDown('Enter'))) this.pick(0);
    } else if (this.slots.length === 1 && this.slots[0] === -1) {
      const r = this.input.xr.gamepads.right;
      if (r?.getButtonDown(InputComponent.A_Button)) this.pick(0);
    }
  }
}
