/**
 * Title screen, pause menu, journal, settings, hint cards and toasts.
 * Menu: left controller menu button (VR), Tab or Escape (desktop).
 */
import { InputComponent, Vector3, VisibilityState, createSystem } from '@iwsdk/core';
import { clearSave, loadGame, type Settings } from '../core/save.js';
import { TextBillboard } from '../ui/billboard.js';
import { Panel } from '../ui/panel.js';
import { applySettings, haptic, immersive, persistSettings, placeInFront, rt, saveNow, t, viewer, viewerForward, viewerPosition, waypoint } from '../runtime.js';
import { InteractionSystem } from './interaction.js';
import { NpcSystem } from './npc.js';
import { PlayerSystem } from './player.js';

type Page = 'main' | 'journal' | 'settings';

const HINT_SECONDS = 16;
const TOAST_SECONDS = 3.2;

export class MenuSystem extends createSystem({}) {
  private menu: Panel | null = null;
  private hintPanel: Panel | null = null;
  private page: Page = 'main';
  private confirmNew = false;
  private hints: string[] = [];
  private hintTime = 0;
  private toastBoard!: TextBillboard;
  private toasts: string[] = [];
  private toastTime = 0;
  private eye = new Vector3();
  private fwd = new Vector3();
  private dirty = false;

  init(): void {
    this.toastBoard = new TextBillboard({ width: 1.1, fontPx: 42, maxLines: 2, background: 'rgba(14,22,30,0.88)' });
    this.scene.add(this.toastBoard.mesh);

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    rt.ui = {
      toast: (text) => this.toasts.push(text),
      hint: (id) => {
        if (!this.hints.includes(id)) this.hints.push(id);
      },
      openMenu: (page) => this.openMenu(page ?? 'main'),
      closeMenu: () => this.closeMenu(),
      get menuOpen() {
        return self.menu?.visible ?? false;
      },
    };

    // Story events -> feedback
    this.cleanupFuncs.push(
      rt.game.on((e) => {
        if (rt.mode !== 'play') return;
        // Save on the next frame, after every effect of this change has applied.
        if (e.type === 'changed') this.dirty = true;
        else if (e.type === 'hint') rt.ui.hint(e.id);
        else if (e.type === 'questStarted') {
          const q = rt.game.quest(e.quest);
          if (q) {
            this.toasts.push(t('toast_quest', { name: q.title }));
            rt.audio.sfx('quest');
          }
        } else if (e.type === 'questCompleted') {
          const q = rt.game.quest(e.quest);
          if (q) {
            this.toasts.push(t('toast_quest_done', { name: q.title }));
            rt.audio.sfx('quest');
          }
        } else if (e.type === 'objectiveCompleted') {
          rt.audio.sfx('objective');
          haptic('both', 0.25, 30);
          const next = rt.game.currentObjective(e.quest);
          if (next) this.toasts.push(t('toast_objective', { text: next.text }));
        } else if (e.type === 'itemGained' && e.item === 'pulse_lantern') {
          this.toasts.push(t('toast_item', { name: rt.content.items[e.item].name }));
        }
      }),
    );

    void Promise.all([Panel.create(this.world, 'menu-panel', 'MenuPanel'), Panel.create(this.world, 'hint-panel', 'HintPanel')]).then(([menu, hint]) => {
      this.menu = menu;
      this.hintPanel = hint;
      const on = (id: string, fn: () => void) =>
        this.cleanupFuncs.push(
          menu.onClick(id, () => {
            rt.audio.unlock();
            rt.audio.sfx('click');
            haptic('right', 0.3, 25);
            fn();
          }),
        );
      on('btn_continue', () => this.startGame(false));
      on('btn_new', () => {
        if (loadGame(rt.store) && !this.confirmNew) {
          this.confirmNew = true;
          menu.text('btn_new', 'Start over? Your save will be replaced.');
          return;
        }
        this.startGame(true);
      });
      on('btn_resume', () => this.closeMenu());
      on('btn_journal', () => this.showPage('journal'));
      on('btn_settings', () => this.showPage('settings'));
      on('btn_vr', () => this.world.launchXR());
      on('btn_quit', () => this.quitToTitle());
      on('j_back', () => this.showPage('main'));
      on('s_back', () => this.showPage('main'));
      const cycle = <K extends keyof Settings>(id: string, key: K, values: Settings[K][]) =>
        on(id, () => {
          const i = values.indexOf(rt.settings[key]);
          rt.settings[key] = values[(i + 1) % values.length];
          persistSettings();
          this.renderSettings();
        });
      cycle('s_move', 'moveMode', ['smooth', 'teleport']);
      on('s_turn', () => {
        const s = rt.settings;
        const order: Array<[Settings['turnMode'], Settings['snapAngle']]> = [['snap', 30], ['snap', 45], ['snap', 90], ['smooth', 45]];
        const i = order.findIndex(([m, a]) => m === s.turnMode && (m === 'smooth' || a === s.snapAngle));
        [s.turnMode, s.snapAngle] = order[(i + 1) % order.length];
        persistSettings();
        this.renderSettings();
      });
      cycle('s_vignette', 'vignette', ['off', 'low', 'high']);
      cycle('s_seated', 'seated', [false, true]);
      cycle('s_speed', 'moveSpeed', [1.8, 2.5, 3.5]);
      cycle('s_music', 'music', [0, 0.3, 0.6, 1]);
      cycle('s_sfx', 'sfx', [0, 0.4, 0.8, 1]);
      cycle('s_voice', 'voice', [0, 0.4, 0.8, 1]);
      cycle('s_debug', 'debugHud', [false, true]);
      this.cleanupFuncs.push(
        hint.onClick('hint_ok', () => {
          rt.audio.sfx('click');
          hint.hide();
          this.hints.shift();
          this.hintTime = 0;
        }),
        this.world.visibilityState.subscribe((v) => {
          // Re-place the open menu in front of the player when entering or leaving VR.
          if (this.menu?.visible) this.openMenu(this.page);
          if (v !== VisibilityState.NonImmersive) rt.audio.unlock();
        }),
      );
      this.openMenu('main');
    });
  }

  // ------------------------------------------------------------ title / game

  private startGame(fresh: boolean): void {
    this.confirmNew = false;
    rt.audio.unlock();
    rt.fade(() => {
      const save = fresh ? null : loadGame(rt.store);
      if (fresh) clearSave(rt.store);
      rt.game.load(save?.state);
      NpcSystem.instance?.resetAll();
      this.world.getSystem(InteractionSystem)?.resetPickups();
      const st = rt.game.state;
      if (st.player) {
        const [x, y, z] = st.player.position;
        PlayerSystem.teleport(new Vector3(x, y, z), st.player.yawDeg);
      } else {
        PlayerSystem.teleport(waypoint(rt.content.world.spawn.at, new Vector3()), rt.content.world.spawn.yawDeg);
      }
      rt.mode = 'play';
      applySettings();
      this.menu?.hide();
      if (!st.flags.warden_intro_done) this.hints.push('hint_talk');
      if (fresh) this.hints.push('hint_menu');
      this.hintTime = 0;
      saveNow(false);
    });
  }

  private quitToTitle(): void {
    saveNow(true);
    this.menu?.hide();
    rt.dialogue.close();
    rt.mode = 'title';
    applySettings();
    this.openMenu('main');
  }

  // ------------------------------------------------------------------ menu

  private openMenu(page: Page): void {
    const m = this.menu;
    if (!m) return;
    placeInFront(m.doc, 1.5, 0.05);
    m.show();
    rt.audio.sfx('open');
    this.showPage(page);
  }

  private closeMenu(): void {
    if (rt.mode !== 'play') return; // the title screen stays up
    this.menu?.hide();
    rt.audio.sfx('close');
  }

  private showPage(page: Page): void {
    const m = this.menu;
    if (!m) return;
    this.page = page;
    m.display('page_main', page === 'main');
    m.display('page_journal', page === 'journal');
    m.display('page_settings', page === 'settings');
    const title = rt.mode === 'title';
    m.text('title', page === 'main' ? t('game_title') : page === 'journal' ? t('menu_journal') : t('menu_settings'));
    m.text('subtitle', page === 'main' ? (title ? t('game_subtitle') : 'Paused') : '');
    m.display('subtitle', page === 'main');
    if (page === 'main') {
      const hasSave = !!loadGame(rt.store);
      m.display('btn_continue', title && hasSave);
      m.display('btn_new', title);
      if (title && !this.confirmNew) m.text('btn_new', t('menu_new_game'));
      m.display('btn_resume', !title);
      m.display('btn_journal', !title);
      m.display('btn_quit', !title);
      m.display('btn_vr', this.world.xrEnabled && !immersive());
      m.text('main_note', immersive() ? 'Menu button: pause. Trigger: select.' : 'Desktop: WASD walk, drag mouse to look, E interact, F lantern, Tab menu.');
    }
    if (page === 'journal') this.renderJournal();
    if (page === 'settings') this.renderSettings();
  }

  private renderJournal(): void {
    const m = this.menu;
    if (!m) return;
    const q = rt.game.trackedQuest();
    const lines: string[] = [];
    if (q) {
      m.text('j_title', `Act ${q.act}: ${q.title}`);
      m.text('j_desc', q.description);
      const qs = rt.game.state.quests[q.id];
      const done = q.objectives.filter((o) => qs.done.includes(o.id));
      for (const o of done.slice(-3)) lines.push(`[x] ${o.text}`);
      const cur = rt.game.currentObjective(q.id);
      if (cur) lines.push(`> ${cur.text}`);
      if (q.comingSoon) lines.push('(This part of the story arrives in a later build.)');
    } else {
      m.text('j_title', t('journal_empty'));
      m.text('j_desc', '');
    }
    for (let i = 0; i < 5; i++) {
      m.display(`j_obj${i}`, i < lines.length);
      if (i < lines.length) m.text(`j_obj${i}`, lines[i]);
    }
    const inv = rt.game.state.inventory.map((id) => rt.content.items[id]?.name ?? id);
    m.text('j_inv', `${t('journal_inventory')}: ${inv.length ? inv.join(', ') : '-'}`);
  }

  private renderSettings(): void {
    const m = this.menu;
    if (!m) return;
    const s = rt.settings;
    const pct = (v: number) => `${Math.round(v * 100)}%`;
    m.text('s_move', s.moveMode === 'smooth' ? 'Smooth' : 'Teleport only');
    m.text('s_turn', s.turnMode === 'smooth' ? 'Smooth' : `Snap ${s.snapAngle}`);
    m.text('s_vignette', s.vignette === 'off' ? 'Off' : s.vignette === 'low' ? 'Low' : 'High');
    m.text('s_seated', s.seated ? 'On' : 'Off');
    m.text('s_speed', s.moveSpeed < 2 ? 'Slow' : s.moveSpeed > 3 ? 'Fast' : 'Normal');
    m.text('s_music', pct(s.music));
    m.text('s_sfx', pct(s.sfx));
    m.text('s_voice', pct(s.voice));
    m.text('s_debug', s.debugHud ? 'On' : 'Off');
    applySettings();
  }

  // ---------------------------------------------------------------- update

  update(delta: number): void {
    const dt = Math.min(delta, 0.1);
    if (this.dirty) {
      this.dirty = false;
      saveNow(false);
    }
    // Menu toggle
    const left = this.input.xr.gamepads.left;
    const kb = this.input.keyboard;
    const toggle = immersive() ? !!left?.getButtonDown(InputComponent.Menu) || !!left?.getButtonDown(InputComponent.Y_Button) : kb.getKeyDown('Tab') || kb.getKeyDown('Escape');
    if (toggle && rt.mode === 'play') {
      if (this.menu?.visible) this.closeMenu();
      else this.openMenu('main');
    }
    if (rt.mode === 'play' && this.menu?.visible && this.page === 'journal') this.renderJournalThrottled(dt);
    if (this.menu?.visible) this.keepInView(this.menu.doc);

    // Hints: one at a time, placed in the world in front of the player.
    const hp = this.hintPanel;
    if (hp) {
      if (this.hintTime > 0 && (rt.dialogue.talkingTo || this.menu?.visible)) {
        // Step aside while talking or in the menu; show it again afterwards.
        hp.hide();
        this.hintTime = 0;
      } else if (this.hintTime > 0) {
        this.hintTime -= dt;
        if (this.hintTime <= 0) {
          hp.hide();
          this.hints.shift();
        }
      } else if (this.hints.length > 0 && rt.mode === 'play' && !rt.dialogue.talkingTo && !this.menu?.visible) {
        hp.text('hint_text', t(this.hints[0]));
        placeInFront(hp.doc, 1.4, -0.12, -0.45);
        hp.show();
        this.hintTime = HINT_SECONDS;
        rt.audio.sfx('hint');
      }
    }

    // Toasts
    if (this.toastTime > 0) {
      this.toastTime -= dt;
      if (this.toastTime <= 0) this.toastBoard.mesh.visible = false;
    } else if (this.toasts.length > 0) {
      this.toastBoard.setText(this.toasts.shift() as string);
      viewerPosition(this.eye);
      viewerForward(this.fwd);
      this.toastBoard.mesh.position.set(this.eye.x + this.fwd.x * 1.6, this.eye.y + 0.35, this.eye.z + this.fwd.z * 1.6);
      this.toastBoard.face(viewer());
      this.toastBoard.mesh.visible = true;
      this.toastTime = TOAST_SECONDS;
    }
  }

  /**
   * World-fixed, but re-centered when it drifts out of a comfortable view
   * (e.g. after entering VR, recentering, or turning around).
   */
  private keepInView(obj: import('@iwsdk/core').Object3D): void {
    viewerPosition(this.eye);
    viewerForward(this.fwd);
    const dx = obj.position.x - this.eye.x;
    const dz = obj.position.z - this.eye.z;
    const dist = Math.hypot(dx, dz);
    const cos = dist > 0.01 ? (dx * this.fwd.x + dz * this.fwd.z) / dist : 1;
    if (dist > 3 || dist < 0.6 || cos < 0.35 || Math.abs(obj.position.y - this.eye.y) > 0.9) placeInFront(obj, 1.5, 0.05);
  }

  private journalTimer = 0;
  private renderJournalThrottled(dt: number): void {
    this.journalTimer -= dt;
    if (this.journalTimer > 0) return;
    this.journalTimer = 1;
    this.renderJournal();
  }
}
