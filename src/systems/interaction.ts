/**
 * Everything the player does with their hands:
 * - talk: point + trigger at a character (VR), click (desktop), or A/X / E nearby
 * - grab parts: DistanceGrabbable in VR, E to carry/drop on desktop
 * - deliver: release a carried part over its receptacle (content "deliver" triggers)
 * - Pulse Lantern: left trigger (VR) or F (desktop) fires "pulse" triggers
 * - area triggers and world events from content
 */
import {
  DistanceGrabbable,
  Grabbed,
  InputComponent,
  MeshBasicMaterial,
  Mesh,
  MovementMode,
  Pressed,
  RayInteractable,
  SphereGeometry,
  Vector3,
  VisibilityState,
  createSystem,
  type Entity,
  type Group,
} from '@iwsdk/core';
import { Npc, Pickup } from '../components.js';
import { TextBillboard } from '../ui/billboard.js';
import { groundAt, surfaceAt } from '../world/layout.js';
import { buildItem } from '../world/models.js';
import { haptic, immersive, rt, t, viewer, viewerForward, viewerPosition, waypoint } from '../runtime.js';
import { NpcSystem } from './npc.js';

type Focus = { kind: 'npc'; id: string; pos: Vector3 } | { kind: 'pickup'; entity: Entity; pos: Vector3 } | null;

const TALK_RANGE = 3.2;
const PICK_RANGE = 2.3;
const PULSE_COOLDOWN = 1.2;

export class InteractionSystem extends createSystem({
  npcPressed: { required: [Npc, Pressed] },
  pickups: { required: [Pickup] },
  pickupPressed: { required: [Pickup, Pressed] },
  grabbed: { required: [Pickup, Grabbed] },
}) {
  private focus: Focus = null;
  private prompt!: TextBillboard;
  /** Desktop: the pickup currently carried in front of the camera. */
  private carried: Entity | null = null;
  /** Pickups animating down to the ground after a release. */
  private falling = new Map<Entity, number>();
  private lantern!: Group;
  private pulseRing!: Mesh;
  private pulseTime = -1;
  private pulseCooldown = 0;
  private eye = new Vector3();
  private fwd = new Vector3();
  private tmp = new Vector3();
  private tmp2 = new Vector3();
  private awakenGlow = 0;
  private npcPos = new Map<string, Vector3>();

  init(): void {
    this.prompt = new TextBillboard({ width: 0.9, fontPx: 40, maxLines: 1, background: 'rgba(14,22,30,0.75)' });
    this.scene.add(this.prompt.mesh);

    // Pulse Lantern (held in the left hand in VR, bottom-right of the view on desktop)
    this.lantern = buildItem(rt.content.items.pulse_lantern);
    this.lantern.scale.setScalar(1);
    this.lantern.visible = false;
    this.pulseRing = new Mesh(new SphereGeometry(1, 16, 10), new MeshBasicMaterial({ color: '#ffc76b', transparent: true, opacity: 0, wireframe: true, depthWrite: false }));
    this.pulseRing.visible = false;
    this.scene.add(this.pulseRing);

    // Pickups from content
    for (const p of rt.content.world.pickups) {
      const item = rt.content.items[p.item];
      const model = buildItem(item);
      const e = this.world.createTransformEntity(model, { persistent: true });
      e.addComponent(Pickup, { item: p.item, key: `${p.item}@${p.at}` });
      e.addComponent(RayInteractable);
    }
    this.resetPickups();


    // Talk by pointing + trigger (VR) or clicking (desktop)
    this.queries.npcPressed.subscribe('qualify', (e) => {
      const id = NpcSystem.instance?.characterOf(e);
      if (!id || rt.mode !== 'play') return;
      const pos = NpcSystem.instance?.positionOf(id, this.tmp);
      if (pos && pos.distanceTo(viewerPosition(this.eye)) < 8) this.talk(id);
    });
    // Desktop click on a part picks it up
    this.queries.pickupPressed.subscribe('qualify', (e) => {
      if (!immersive() && rt.mode === 'play' && !this.carried) {
        if (e.object3D && e.object3D.position.distanceTo(viewerPosition(this.eye)) < 4) this.carry(e);
      }
    });
    // VR grab lifecycle
    this.queries.grabbed.subscribe('qualify', (e) => this.onGrab(e));
    this.queries.grabbed.subscribe('disqualify', (e) => this.onRelease(e));

    // Only offer distance-grab inside XR; desktop uses E to carry.
    this.cleanupFuncs.push(
      this.world.visibilityState.subscribe((v) => {
        const xr = v !== VisibilityState.NonImmersive;
        for (const e of this.queries.pickups.entities) {
          if (xr && !e.hasComponent(DistanceGrabbable)) {
            e.addComponent(DistanceGrabbable, { movementMode: MovementMode.MoveTowardsTarget, moveSpeedFactor: 0.06, rotate: true, translate: true, scale: false });
          } else if (!xr && e.hasComponent(DistanceGrabbable)) {
            e.removeComponent(DistanceGrabbable);
          }
        }
        this.attachLantern();
      }),
      rt.game.on((ev) => {
        if (ev.type === 'emit') this.onWorldEvent(ev.event);
        if (ev.type === 'itemGained' && ev.item === 'pulse_lantern') this.attachLantern();
      }),
    );
  }

  /** Put pickups where the save says they are (called on load / new game). */
  resetPickups(): void {
    this.carried = null;
    this.falling.clear();
    const s = rt.game.state;
    for (const e of this.queries.pickups.entities) {
      const key = e.getValue(Pickup, 'key') as string;
      const item = e.getValue(Pickup, 'item') as string;
      const obj = e.object3D;
      if (!obj) continue;
      obj.removeFromParent();
      this.scene.add(obj);
      const collected = s.collected.includes(key);
      const held = s.inventory.includes(item);
      obj.visible = !collected || held;
      const at = key.split('@')[1];
      if (collected && held && s.player) {
        // Collected but not delivered: drop it at the player's feet.
        const [x, , z] = s.player.position;
        obj.position.set(x + 0.4, groundAt(x + 0.4, z) + 0.12, z);
      } else {
        waypoint(at, obj.position);
        obj.position.y += 0.1;
      }
      obj.rotation.set(0, 0, 0);
    }
    this.attachLantern();
  }

  private attachLantern(): void {
    const has = rt.game.state.inventory.includes('pulse_lantern');
    this.lantern.removeFromParent();
    this.lantern.visible = has;
    if (!has) return;
    if (immersive()) {
      this.player.gripSpaces.left.add(this.lantern);
      this.lantern.position.set(0, -0.17, 0.06);
      this.lantern.scale.setScalar(1);
    } else {
      this.camera.add(this.lantern);
      this.lantern.position.set(0.34, -0.3, -0.75);
      this.lantern.scale.setScalar(0.7);
    }
  }

  private talk(id: string): void {
    if (rt.dialogue.talkingTo || rt.ui.menuOpen) return;
    if (rt.dialogue.open(id)) haptic('right', 0.3, 30);
  }

  private carry(e: Entity): void {
    const obj = e.object3D;
    if (!obj) return;
    this.carried = e;
    this.falling.delete(e);
    this.collectIfNew(e);
    this.camera.add(obj);
    obj.position.set(0.18, -0.2, -0.55);
    obj.rotation.set(0.3, 0.4, 0);
    rt.audio.sfx('grab');
  }

  private collectIfNew(e: Entity): void {
    const key = e.getValue(Pickup, 'key') as string;
    const item = e.getValue(Pickup, 'item') as string;
    if (!rt.game.state.collected.includes(key)) {
      rt.game.collect(key, item);
      rt.audio.sfx('pickup');
      rt.ui.toast(t('toast_item', { name: rt.content.items[item].name }));
    }
  }

  private onGrab(e: Entity): void {
    this.collectIfNew(e);
    this.falling.delete(e);
    rt.audio.sfx('grab', e.object3D?.position);
    haptic('both', 0.4, 40);
  }

  private onRelease(e: Entity): void {
    const obj = e.object3D;
    if (!obj) return;
    obj.getWorldPosition(this.tmp);
    if (!this.tryDeliver(e, this.tmp, 0.4)) {
      this.falling.set(e, 0);
      haptic('both', 0.2, 20);
    }
  }

  /** Deliver a pickup if it is within a matching deliver trigger. */
  private tryDeliver(e: Entity, at: Vector3, slack: number): boolean {
    const item = e.getValue(Pickup, 'item') as string;
    for (const tr of rt.content.world.triggers) {
      if (tr.kind !== 'deliver' || tr.item !== item || !tr.at) continue;
      waypoint(tr.at, this.tmp2);
      const dXZ = Math.hypot(at.x - this.tmp2.x, at.z - this.tmp2.z);
      if (dXZ > tr.radius + slack || at.y > this.tmp2.y + 2.2) continue;
      if (!rt.game.state.inventory.includes(item) || !rt.game.fireTrigger(tr.id)) {
        if (!rt.game.canFire(tr)) rt.audio.sfx('denied', at);
        continue;
      }
      const obj = e.object3D;
      if (obj) {
        obj.removeFromParent();
        this.scene.add(obj);
        obj.visible = false;
      }
      if (this.carried === e) this.carried = null;
      rt.audio.sfx('deliver', this.tmp2);
      haptic('both', 0.7, 80);
      return true;
    }
    return false;
  }

  private drop(e: Entity): void {
    const obj = e.object3D;
    if (!obj) return;
    obj.getWorldPosition(this.tmp);
    obj.removeFromParent();
    this.scene.add(obj);
    this.carried = null;
    if (this.tryDeliver(e, this.tmp, 1.0)) return;
    viewerPosition(this.eye);
    viewerForward(this.fwd);
    obj.position.set(this.eye.x + this.fwd.x * 0.8, this.tmp.y, this.eye.z + this.fwd.z * 0.8);
    obj.rotation.set(0, 0, 0);
    this.falling.set(e, 0);
  }

  private pulse(): void {
    if (this.pulseCooldown > 0) return;
    this.pulseCooldown = PULSE_COOLDOWN;
    this.lantern.getWorldPosition(this.tmp);
    this.pulseRing.position.copy(this.tmp);
    this.pulseRing.visible = true;
    this.pulseTime = 0;
    rt.audio.sfx('pulse', this.tmp);
    haptic('left', 0.8, 120);
    for (const tr of rt.content.world.triggers) {
      if (tr.kind !== 'pulse' || !tr.at) continue;
      waypoint(tr.at, this.tmp2);
      if (this.tmp2.distanceTo(this.player.position) < tr.radius + 1) rt.game.fireTrigger(tr.id);
    }
  }

  private onWorldEvent(event: string): void {
    if (event === 'shrine_awaken') {
      this.awakenGlow = 1;
      waypoint('shrine_console', this.tmp);
      rt.audio.sfx('awaken', this.tmp);
      haptic('both', 0.6, 300);
    } else if (event === 'lantern_given') {
      rt.audio.sfx('pickup');
    }
  }

  private computeFocus(): Focus {
    viewerPosition(this.eye);
    viewerForward(this.fwd);
    let best: Focus = null;
    let bestScore = Infinity;
    const npcs = NpcSystem.instance;
    if (npcs) {
      for (const id of npcs.ids()) {
        if (!rt.content.characters[id]?.dialogue) continue;
        if (!this.npcPos.has(id)) this.npcPos.set(id, new Vector3());
        const p = npcs.positionOf(id, this.npcPos.get(id) as Vector3);
        if (!p) continue;
        const score = this.score(p, TALK_RANGE);
        if (score < bestScore) {
          bestScore = score;
          best = { kind: 'npc', id, pos: p };
        }
      }
    }
    if (!this.carried) {
      for (const e of this.queries.pickups.entities) {
        const o = e.object3D;
        if (!o || !o.visible || e.hasComponent(Grabbed)) continue;
        const score = this.score(o.position, PICK_RANGE);
        if (score < bestScore) {
          bestScore = score;
          best = { kind: 'pickup', entity: e, pos: o.position };
        }
      }
    }
    return best;
  }

  /** Lower is better; Infinity when out of range or outside a 45 degree cone. */
  private score(p: Vector3, range: number): number {
    const dx = p.x - this.eye.x;
    const dz = p.z - this.eye.z;
    const d = Math.hypot(dx, dz);
    if (d > range) return Infinity;
    const cos = d < 0.4 ? 1 : (dx * this.fwd.x + dz * this.fwd.z) / d;
    if (cos < 0.7) return Infinity;
    return d * (2 - cos);
  }

  update(delta: number): void {
    const dt = Math.min(delta, 0.1);
    this.pulseCooldown -= dt;

    // Pulse ring + shrine glow animation
    if (this.pulseTime >= 0) {
      this.pulseTime += dt;
      const k = this.pulseTime / 0.9;
      this.pulseRing.scale.setScalar(0.2 + k * 3.5);
      (this.pulseRing.material as MeshBasicMaterial).opacity = Math.max(0, 0.5 * (1 - k));
      if (k >= 1) {
        this.pulseTime = -1;
        this.pulseRing.visible = false;
      }
    }
    const awake = rt.game.state.flags.shrine_awakened === true;
    this.awakenGlow = Math.max(0, this.awakenGlow - dt * 0.4);
    const glyphMat = rt.village.consoleGlyphs.material as MeshBasicMaterial;
    glyphMat.color.setRGB(awake ? 0.6 + this.awakenGlow : 0.25, awake ? 1 : 0.28, awake ? 1 : 0.3);
    const needParts = rt.game.state.flags.met_tobbin === true && rt.game.state.quests.act1_stranger?.done.includes('bring_valve') !== true;
    const rimMat = rt.village.basketRim.material as MeshBasicMaterial;
    const pulse = 0.65 + Math.sin(performance.now() * 0.004) * 0.35;
    rimMat.color.setRGB(needParts ? 1 * pulse : 0.35, needParts ? 0.7 * pulse : 0.28, needParts ? 0.28 * pulse : 0.2);

    // Falling pickups settle on the ground
    for (const [e, v] of this.falling) {
      const o = e.object3D;
      if (!o) continue;
      const floor = surfaceAt(o.position.x, o.position.z) + 0.1;
      const nv = v + dt * 9.8;
      o.position.y = Math.max(floor, o.position.y - nv * dt);
      if (o.position.y <= floor) {
        this.falling.delete(e);
        rt.audio.sfx('drop', o.position);
      } else this.falling.set(e, nv);
    }

    // Floating idle spin for items lying in the world
    for (const e of this.queries.pickups.entities) {
      const o = e.object3D;
      if (o && o.visible && o.parent === this.scene && !e.hasComponent(Grabbed) && !this.falling.has(e)) o.rotation.y += dt * 0.8;
    }

    if (rt.mode !== 'play' || rt.ui.menuOpen) {
      this.prompt.mesh.visible = false;
      return;
    }

    // Area triggers
    for (const tr of rt.content.world.triggers) {
      if (tr.kind !== 'area' || !tr.at || !rt.game.canFire(tr)) continue;
      waypoint(tr.at, this.tmp2);
      if (Math.hypot(this.tmp2.x - this.player.position.x, this.tmp2.z - this.player.position.z) < tr.radius) rt.game.fireTrigger(tr.id);
    }

    // Lantern
    const hasLantern = rt.game.state.inventory.includes('pulse_lantern');
    const left = this.input.xr.gamepads.left;
    if (hasLantern && !rt.dialogue.talkingTo) {
      if (immersive() ? left?.getButtonDown(InputComponent.Trigger) : this.input.keyboard.getKeyDown('KeyF')) this.pulse();
    }

    // Focus + prompt
    this.focus = rt.dialogue.talkingTo ? null : this.computeFocus();
    const vr = immersive();
    const right = this.input.xr.gamepads.right;
    const actPressed = vr
      ? !!(right?.getButtonDown(InputComponent.A_Button) || left?.getButtonDown(InputComponent.X_Button))
      : this.input.keyboard.getKeyDown('KeyE');

    if (!vr && this.carried) {
      const name = rt.content.items[this.carried.getValue(Pickup, 'item') as string].name;
      this.showPrompt(`[E] ${t('prompt_drop', { name })}`, null);
      if (actPressed) this.drop(this.carried);
      return;
    }
    const f = this.focus;
    if (!f) {
      this.prompt.mesh.visible = false;
      return;
    }
    const key = vr ? '(A)' : '[E]';
    if (f.kind === 'npc') {
      this.showPrompt(`${key} ${t('prompt_talk', { name: rt.content.characters[f.id].name })}`, f.pos);
      if (actPressed) this.talk(f.id);
    } else {
      const name = rt.content.items[f.entity.getValue(Pickup, 'item') as string].name;
      this.showPrompt(vr ? `Point + trigger: ${t('prompt_pickup', { name })}` : `${key} ${t('prompt_pickup', { name })}`, f.pos);
      if (actPressed && !vr) this.carry(f.entity);
    }
  }

  private showPrompt(text: string, at: Vector3 | null): void {
    this.prompt.setText(text);
    this.prompt.mesh.visible = true;
    if (at) {
      this.prompt.mesh.position.set(at.x, Math.min(at.y + 0.45, this.eye.y - 0.25), at.z);
      // Pull it slightly toward the viewer so it is not inside the target.
      this.tmp.subVectors(this.eye, this.prompt.mesh.position).setY(0).normalize();
      this.prompt.mesh.position.addScaledVector(this.tmp, 0.35);
    } else {
      viewerForward(this.fwd);
      this.prompt.mesh.position.set(this.eye.x + this.fwd.x * 1.2, this.eye.y - 0.35, this.eye.z + this.fwd.z * 1.2);
    }
    this.prompt.face(viewer());
  }
}
