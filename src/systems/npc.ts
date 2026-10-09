/**
 * Characters in the world: placement from content (conditions), guide paths
 * (the Warden leads the player), turning to look at the player, idle motion,
 * ambient one-liners and nameplates.
 */
import { RayInteractable, Vector3, createSystem, type Entity } from '@iwsdk/core';
import { Npc } from '../components.js';
import type { Character } from '../core/schema.js';
import { TextBillboard } from '../ui/billboard.js';
import { buildCharacter, type CharacterModel } from '../world/models.js';
import { rt, viewer, viewerPosition, waypoint } from '../runtime.js';

interface NpcRuntime {
  character: Character;
  model: CharacterModel;
  entity: Entity;
  placement: number;
  /** Remaining path waypoints (world positions) to walk through. */
  route: Vector3[];
  /** True while leading the player along a path (waits when they fall behind). */
  guiding: boolean;
  target: Vector3;
  yaw: number;
  speed: number;
  hover: number;
  nameplate: TextBillboard;
  bubble: TextBillboard;
  bubbleTime: number;
  ambientCooldown: number;
  lastAmbient: number;
  phase: number;
  glitch: number;
}

const LOOK_RANGE = 5;
const AMBIENT_RANGE = 4.5;

export class NpcSystem extends createSystem({
  npcs: { required: [Npc] },
}) {
  private byId = new Map<string, NpcRuntime>();
  private globalAmbient = 4;
  private eye = new Vector3();
  private tmp = new Vector3();
  private feet = new Vector3();

  /** Read-only lookups for other systems (interaction, waypoints). */
  static instance: NpcSystem | null = null;

  init(): void {
    NpcSystem.instance = this;
    for (const def of rt.content.world.npcs) {
      const character = rt.content.characters[def.character];
      const model = buildCharacter(character);
      const entity = this.world.createTransformEntity(model.root, { persistent: true });
      entity.addComponent(Npc, { character: character.id });
      entity.addComponent(RayInteractable);
      const nameplate = new TextBillboard({ width: 1.0, fontPx: 58, maxLines: 1 });
      nameplate.setText(`#${character.name}`);
      const bubble = new TextBillboard({ width: 1.6, fontPx: 56, maxLines: 3 });
      this.scene.add(nameplate.mesh, bubble.mesh);
      const isOrb = character.look.kind === 'orb';
      const rtNpc: NpcRuntime = {
        character,
        model,
        entity,
        placement: -1,
        route: [],
        guiding: false,
        target: new Vector3(),
        yaw: 0,
        speed: isOrb ? 2.6 : 1.4,
        hover: 0,
        nameplate,
        bubble,
        bubbleTime: 0,
        ambientCooldown: 6 + Math.random() * 6,
        lastAmbient: -1,
        phase: Math.random() * 10,
        glitch: 3,
      };
      this.byId.set(character.id, rtNpc);
      this.snapToPlacement(rtNpc);
    }
    // When a save is loaded or a new game starts, put everyone where they belong.
    this.cleanupFuncs.push(
      rt.game.on((e) => {
        if (e.type === 'changed' && rt.mode !== 'play') for (const n of this.byId.values()) this.snapToPlacement(n);
      }),
    );
  }

  /** World position of a character (for waypoints and dialogue). */
  positionOf(id: string, out: Vector3): Vector3 | null {
    const n = this.byId.get(id);
    return n ? out.copy(n.model.root.position) : null;
  }

  characterOf(entity: Entity): string | null {
    return entity.hasComponent(Npc) ? (entity.getValue(Npc, 'character') as string) : null;
  }

  ids(): IterableIterator<string> {
    return this.byId.keys();
  }

  resetAll(): void {
    for (const n of this.byId.values()) this.snapToPlacement(n);
  }

  private currentPlacement(n: NpcRuntime): number {
    const def = rt.content.world.npcs.find((d) => d.character === n.character.id);
    if (!def) return 0;
    const i = def.placements.findIndex((p) => rt.game.check(p.when));
    return i < 0 ? def.placements.length - 1 : i;
  }

  private snapToPlacement(n: NpcRuntime): void {
    const def = rt.content.world.npcs.find((d) => d.character === n.character.id);
    if (!def) return;
    n.placement = this.currentPlacement(n);
    const p = def.placements[n.placement];
    waypoint(p.at, n.target);
    n.route = [];
    n.guiding = false;
    n.model.root.position.copy(n.target);
  }

  private onPlacementChanged(n: NpcRuntime, index: number): void {
    const def = rt.content.world.npcs.find((d) => d.character === n.character.id);
    if (!def) return;
    n.placement = index;
    const p = def.placements[index];
    waypoint(p.at, n.target);
    n.guiding = !!p.path;
    n.route = p.path ? rt.content.world.paths[p.path].map((id) => waypoint(id, new Vector3())) : [n.target.clone()];
    // Skip path points behind the NPC (closest first).
    let best = 0;
    let bestD = Infinity;
    n.route.forEach((v, i) => {
      const d = v.distanceToSquared(n.model.root.position);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    n.route = n.route.slice(best);
  }

  update(delta: number, time: number): void {
    const dt = Math.min(delta, 0.1);
    viewerPosition(this.eye);
    this.feet.copy(this.player.position);
    this.globalAmbient -= dt;
    const talking = rt.dialogue?.talkingTo ?? null;

    for (const n of this.byId.values()) {
      const root = n.model.root;
      const placement = this.currentPlacement(n);
      if (placement !== n.placement) this.onPlacementChanged(n, placement);

      // ---- movement along the route (guides wait for the player)
      let moving = false;
      if (n.route.length > 0 && talking !== n.character.id) {
        const next = n.route[0];
        const toPlayer = Math.hypot(this.feet.x - root.position.x, this.feet.z - root.position.z);
        // Guides wait only when the player has fallen behind (not when they ran ahead).
        const end = n.route[n.route.length - 1];
        const playerToEnd = Math.hypot(this.feet.x - end.x, this.feet.z - end.z);
        const npcToEnd = Math.hypot(root.position.x - end.x, root.position.z - end.z);
        const waiting = n.guiding && toPlayer > 8 && playerToEnd > npcToEnd && rt.mode === 'play';
        if (!waiting) {
          this.tmp.subVectors(next, root.position);
          const dist = this.tmp.length();
          const step = n.speed * dt;
          if (dist <= step) {
            root.position.copy(next);
            n.route.shift();
          } else {
            root.position.addScaledVector(this.tmp, step / dist);
            moving = true;
            n.yaw = lerpAngle(n.yaw, Math.atan2(this.tmp.x, this.tmp.z), dt * 6);
          }
        }
      }

      // ---- facing the player
      const dx = this.eye.x - root.position.x;
      const dz = this.eye.z - root.position.z;
      const distXZ = Math.hypot(dx, dz);
      const engaged = talking === n.character.id || distXZ < LOOK_RANGE;
      if (!moving && engaged) n.yaw = lerpAngle(n.yaw, Math.atan2(dx, dz), dt * 4);
      root.rotation.y = n.yaw;
      // Head looks a bit further (pitch toward the eyes).
      const headWorldY = root.position.y + n.model.head.position.y;
      const pitch = engaged ? Math.atan2(headWorldY - this.eye.y, Math.max(0.5, distXZ)) * 0.6 : 0;
      n.model.head.rotation.x += (pitch - n.model.head.rotation.x) * dt * 4;

      // ---- idle motion
      const kind = n.character.look.kind;
      if (kind === 'orb' || kind === 'drone') {
        n.hover = Math.sin(time * 1.6 + n.phase) * 0.08;
        n.model.head.position.y = n.hover;
        for (const [i, s] of n.model.spinners.entries()) s.rotation.z += dt * (i ? -0.9 : 1.4);
        // Occasional glitch jitter (the Warden's "buffering")
        n.glitch -= dt;
        if (n.glitch < 0) {
          n.model.head.position.x = (Math.random() - 0.5) * 0.06;
          if (n.glitch < -0.12) {
            n.model.head.position.x = 0;
            n.glitch = 3 + Math.random() * 6;
          }
        }
      } else {
        const bob = moving ? Math.abs(Math.sin(time * 7)) * 0.03 : Math.sin(time * 1.3 + n.phase) * 0.008;
        n.model.root.children[0].position.y = bob;
        n.model.root.children[0].rotation.z = moving ? Math.sin(time * 7) * 0.03 : Math.sin(time * 0.7 + n.phase) * 0.012;
      }

      // ---- labels
      const top = root.position.y + n.model.top + (kind === 'orb' ? n.hover : 0);
      const showName = distXZ < 7 && talking !== n.character.id && rt.mode === 'play';
      n.nameplate.mesh.visible = showName && n.bubbleTime <= 0;
      if (n.nameplate.mesh.visible) {
        n.nameplate.mesh.position.set(root.position.x, top + 0.12, root.position.z);
        n.nameplate.face(viewer());
      }
      if (n.bubbleTime > 0) {
        n.bubbleTime -= dt;
        n.bubble.mesh.visible = n.bubbleTime > 0 && talking !== n.character.id;
        n.bubble.mesh.position.set(root.position.x, top + 0.3, root.position.z);
        n.bubble.face(viewer());
      }

      // ---- ambient one-liners
      n.ambientCooldown -= dt;
      if (rt.mode === 'play' && !talking && distXZ < AMBIENT_RANGE && n.ambientCooldown <= 0 && this.globalAmbient <= 0) {
        const lines = n.character.ambient.map((a, i) => ({ a, i })).filter(({ a, i }) => rt.game.check(a.when) && (i !== n.lastAmbient || n.character.ambient.length === 1));
        if (lines.length) {
          const pick = lines[Math.floor(Math.random() * lines.length)];
          n.lastAmbient = pick.i;
          n.bubble.setText(pick.a.text);
          n.bubbleTime = 4.5;
          rt.audio.speak(pick.a.text, n.character.voice, root.position);
        }
        n.ambientCooldown = 18 + Math.random() * 12;
        this.globalAmbient = 6;
      }
    }
  }
}

function lerpAngle(a: number, b: number, t: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * Math.min(1, t);
}
