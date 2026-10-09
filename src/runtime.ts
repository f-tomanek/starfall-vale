/**
 * Shared runtime services for the ECS systems: the story engine, settings,
 * audio, and small helpers for viewer pose, haptics and strings.
 */
import { LocomotionSystem, Object3D, TurningMethod, Vector3, type World } from '@iwsdk/core';
import type { AudioEngine } from './audio/audio.js';
import type { Game } from './core/game.js';
import { saveGame, saveSettings, type KeyValueStore, type Settings } from './core/save.js';
import type { Content } from './core/schema.js';
import { groundAt } from './world/layout.js';
import type { VillageMeshes } from './world/village.js';

export type Mode = 'title' | 'play';

export interface UiApi {
  toast(text: string): void;
  hint(id: string): void;
  openMenu(page?: 'main' | 'journal' | 'settings'): void;
  closeMenu(): void;
  readonly menuOpen: boolean;
}

export interface DialogueApi {
  open(characterId: string): boolean;
  close(): void;
  readonly talkingTo: string | null;
}

export interface Runtime {
  world: World;
  content: Content;
  game: Game;
  store: KeyValueStore | null;
  settings: Settings;
  audio: AudioEngine;
  village: VillageMeshes;
  mode: Mode;
  ui: UiApi;
  dialogue: DialogueApi;
  /** Current zone id (from content/world.json zones). */
  zone: string;
  /** Fade the view to black and back; `mid` runs while fully black. */
  fade: (mid: () => void) => void;
}

export const rt = {} as Runtime;

const _v = new Vector3();
const _f = new Vector3();

export function immersive(): boolean {
  return rt.world.session != null;
}

/** The object whose pose is the player's eyes (XR head or desktop camera). */
export function viewer(): Object3D {
  return immersive() ? rt.world.player.head : rt.world.camera;
}

export function viewerPosition(out: Vector3): Vector3 {
  return viewer().getWorldPosition(out);
}

/** Horizontal forward direction of the view. */
export function viewerForward(out: Vector3): Vector3 {
  viewer().getWorldDirection(out);
  // Camera looks down -Z; getWorldDirection returns +Z of the object for non-cameras.
  if (viewer() !== rt.world.camera) out.negate();
  out.y = 0;
  if (out.lengthSq() < 1e-6) out.set(0, 0, -1);
  return out.normalize();
}

/** Put a panel `dist` meters in front of the viewer, facing them. */
export function placeInFront(obj: Object3D, dist: number, dy: number, sideways = 0): void {
  const p = viewerPosition(_v);
  const f = viewerForward(_f);
  obj.position.set(p.x + f.x * dist - f.z * sideways, p.y + dy, p.z + f.z * dist + f.x * sideways);
  obj.rotation.set(0, Math.atan2(p.x - obj.position.x, p.z - obj.position.z), 0);
}

/** A content waypoint in world space (its y is height above the walkable ground). */
export function waypoint(id: string, out: Vector3): Vector3 {
  const w = rt.content.world.waypoints[id];
  if (!w) return out.set(0, 0, 0);
  return out.set(w[0], groundAt(w[0], w[2]) + w[1], w[2]);
}

export function t(key: string, vars: Record<string, string> = {}): string {
  let s = rt.content.strings[key] ?? key;
  for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v);
  return s;
}

export function haptic(hand: 'left' | 'right' | 'both', intensity = 0.5, ms = 40): void {
  if (!immersive()) return;
  const hands = hand === 'both' ? (['left', 'right'] as const) : [hand];
  for (const h of hands) {
    try {
      const gp = rt.world.input.xr.gamepads[h]?.gamepad as (Gamepad & { hapticActuators?: Array<{ pulse(v: number, d: number): Promise<boolean> }> }) | undefined;
      void gp?.hapticActuators?.[0]?.pulse(intensity, ms);
    } catch {
      /* haptics unsupported */
    }
  }
}

export function persistSettings(): void {
  saveSettings(rt.store, rt.settings);
  applySettings();
}

export function saveNow(showToast: boolean): void {
  if (rt.mode !== 'play') return;
  if (saveGame(rt.store, rt.game.state) && showToast) rt.ui.toast(t('toast_saved'));
}

/** Push comfort/audio settings into IWSDK systems and the audio engine. */
export function applySettings(): void {
  const s = rt.settings;
  rt.audio.setVolumes({ music: s.music, sfx: s.sfx, voice: s.voice });
  const loco = rt.world.getSystem(LocomotionSystem);
  if (loco) {
    loco.config.turningMethod.value = s.turnMode === 'snap' ? TurningMethod.SnapTurn : TurningMethod.SmoothTurn;
    loco.config.turningAngle.value = s.snapAngle;
    loco.config.turningSpeed.value = 120;
    loco.config.comfortAssist.value = s.vignette === 'off' ? 0 : s.vignette === 'low' ? 0.5 : 1;
    // No walking while the title screen is up.
    loco.config.slidingSpeed.value = rt.mode === 'play' ? s.moveSpeed : 0;
  }
  // Teleport-only mode: drop the left-stick slide binding (keyboard stays).
  const actions = rt.world.input.actions;
  const move = 'locomotion.move';
  const xrMove = actions.getBindings(move).filter((b) => b.source === 'xrGamepad');
  if (s.moveMode === 'teleport') for (const b of xrMove) actions.removeBinding(b);
  else if (xrMove.length === 0) {
    actions.addBinding({ source: 'xrGamepad', kind: 'axis2d', action: move, handedness: 'left', componentId: 'xr-standard-thumbstick' } as Parameters<typeof actions.addBinding>[0]);
  }
}
