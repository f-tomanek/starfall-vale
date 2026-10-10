/**
 * The outer zones: builds Glimmerwood, Rustdune and Skyreach, streams their
 * detail in and out by distance, runs the cargo lift and the light bridges
 * (both content-driven), and animates ambient life (particles, birds, clouds).
 */
import { CylinderGeometry, LocomotionEnvironment, Mesh, MeshBasicMaterial, RayInteractable, Vector3, createSystem, type Entity, type Object3D } from '@iwsdk/core';
import { Usable } from '../components.js';
import { GeoBuilder, Materials, meshFrom } from '../world/geo.js';
import { GLIMMER, RUST, heightAt } from '../world/heightfield.js';
import { Emitter, type EmitterDef } from '../world/particles.js';
import { Birds, buildClouds } from '../world/sky.js';
import type { ZoneBuild } from '../world/zones/common.js';
import { buildGlimmerwood } from '../world/zones/glimmerwood.js';
import { buildRustdune } from '../world/zones/rustdune.js';
import { LIFT, buildSkyreach, type BridgeParts } from '../world/zones/skyreach.js';
import { haptic, rt, waypoint } from '../runtime.js';
import { PlayerSystem } from './player.js';

/** Zone detail is shown within this distance beyond the zone radius. */
const STREAM_MARGIN = 85;

const EMITTERS: Array<EmitterDef & { zone: string }> = [
  { zone: 'glimmerwood', name: 'motes', count: 140, center: [GLIMMER.x, 3, GLIMMER.z], extent: [34, 2.5, 34], color: '#b79bff', size: 0.12, motion: 'drift', speed: 0.8 },
  { zone: 'rustdune', name: 'dust', count: 110, center: [RUST.x, 1.6, RUST.z], extent: [34, 1.4, 30], color: '#f0c89a', size: 0.08, motion: 'blow', speed: 1, opacity: 0.55, additive: false },
  { zone: 'rustdune', name: 'smoke', count: 70, center: [RUST.engine[0] + 13, 22, RUST.engine[1] + 4], extent: [3, 16, 3], color: '#9a9590', size: 2.4, motion: 'rise', speed: 0.8, opacity: 0.35, additive: false },
  { zone: 'rustdune', name: 'embers', count: 30, center: [RUST.camp[0], 2.5, RUST.camp[1]], extent: [0.6, 2, 0.6], color: '#ffb347', size: 0.07, motion: 'rise', speed: 2.5 },
  { zone: 'skyreach', name: 'wisps', count: 110, center: [2, 34, -100], extent: [32, 10, 22], color: '#e8fbff', size: 0.16, motion: 'drift', speed: 0.5, opacity: 0.6 },
];

interface ZoneRuntime {
  build: ZoneBuild;
  center: Vector3;
  radius: number;
  shown: boolean;
}

export class ZoneSystem extends createSystem({}) {
  private zones: ZoneRuntime[] = [];
  private bridges: Array<BridgeParts & { colEntity: Entity; gateEntity: Entity; active: boolean | null }> = [];
  private emitters: Array<{ emitter: Emitter; zone: string }> = [];
  private birds!: Birds;
  private clouds!: Mesh;
  private beacon!: Mesh;
  private liftPlatform!: Mesh;
  private liftAt: 'bottom' | 'top' = 'bottom';
  private liftAnim = -1;
  private streamTimer = 0;
  triangles = 0;

  init(): void {
    const add = (o: Object3D, walkable = false) => {
      const e = this.world.createTransformEntity(o, { persistent: true });
      if (walkable) e.addComponent(LocomotionEnvironment);
      return e;
    };
    const sky = buildSkyreach();
    for (const b of [buildGlimmerwood(), buildRustdune(), sky]) {
      const def = rt.content.world.zones.find((z) => z.id === b.id);
      for (const o of b.landmark) add(o);
      for (const o of b.detail) if (!sky.bridges.some((br) => br.mesh === o)) add(o);
      if (b.colliders) add(b.colliders, true);
      this.triangles += b.triangles;
      this.zones.push({
        build: b,
        center: new Vector3(def?.center[0] ?? 0, 0, def?.center[2] ?? 0),
        radius: def?.radius ?? 40,
        shown: true,
      });
    }

    // Light bridges: visual + collider + rim gates, toggled by content conditions
    for (const br of sky.bridges) {
      add(br.mesh);
      const colEntity = this.world.createTransformEntity(br.collider, { persistent: true });
      const gateEntity = this.world.createTransformEntity(br.gates, { persistent: true });
      this.bridges.push({ ...br, colEntity, gateEntity, active: null });
    }

    // Cargo lift: platform animation + a lever at each end
    this.liftPlatform = sky.liftPlatform;
    this.beacon = sky.beaconLight;
    const lift = rt.content.world.lifts.find((l) => l.id === 'cargo_lift');
    if (lift) {
      for (const end of ['bottom', 'top'] as const) {
        const at = waypoint(end === 'bottom' ? lift.bottom : lift.top, new Vector3());
        const lever = new GeoBuilder();
        lever.add(new CylinderGeometry(0.18, 0.22, 1, 6), '#3c4549', { pos: [0, 0.5, 0] });
        lever.add(new CylinderGeometry(0.04, 0.04, 0.7, 4), '#c8642c', { pos: [0, 1.25, 0], rot: [0, 0, 0.5] });
        const leverMesh = meshFrom(lever, Materials.lit, `LiftLever:${end}`);
        leverMesh.matrixAutoUpdate = true;
        leverMesh.position.set(at.x - 2.2, at.y, at.z);
        const knob = new Mesh(new CylinderGeometry(0.09, 0.09, 0.12, 8), new MeshBasicMaterial({ color: '#ffb347' }));
        knob.position.set(-0.17, 1.55, 0);
        leverMesh.add(knob);
        const e = add(leverMesh);
        e.addComponent(Usable, { id: `lift:${end}` });
        e.addComponent(RayInteractable);
        rt.usables.set(`lift:${end}`, {
          label: () => (rt.game.check(lift.when) ? (end === 'bottom' ? 'Ride the lift up' : 'Ride the lift down') : 'Pull the lift lever'),
          use: () => this.useLift(lift.bottom, lift.top, end, lift.when, lift.brokenText),
        });
      }
    }

    // Ambient life
    for (const def of EMITTERS) {
      const emitter = new Emitter(def);
      this.scene.add(emitter.points);
      this.emitters.push({ emitter, zone: def.zone });
    }
    this.birds = new Birds();
    this.scene.add(this.birds.mesh);
    this.clouds = buildClouds();
    this.scene.add(this.clouds);

    this.cleanupFuncs.push(rt.game.on((e) => e.type === 'changed' && this.refreshBridges()));
    this.refreshBridges();
  }

  private refreshBridges(): void {
    for (const b of this.bridges) {
      const def = rt.content.world.bridges.find((x) => x.id === b.id);
      const active = !!def && rt.game.check(def.when);
      if (active === b.active) continue;
      b.active = active;
      const mat = b.mesh.material as MeshBasicMaterial;
      mat.opacity = active ? 0.75 : 0.12;
      if (active) {
        if (!b.colEntity.hasComponent(LocomotionEnvironment)) b.colEntity.addComponent(LocomotionEnvironment);
        if (b.gateEntity.hasComponent(LocomotionEnvironment)) b.gateEntity.removeComponent(LocomotionEnvironment);
      } else {
        if (b.colEntity.hasComponent(LocomotionEnvironment)) b.colEntity.removeComponent(LocomotionEnvironment);
        if (!b.gateEntity.hasComponent(LocomotionEnvironment)) b.gateEntity.addComponent(LocomotionEnvironment);
      }
    }
  }

  private useLift(bottom: string, top: string, from: 'bottom' | 'top', when: Parameters<typeof rt.game.check>[0], brokenText: string): void {
    if (!rt.game.check(when)) {
      rt.audio.sfx('denied');
      rt.ui.toast(brokenText);
      return;
    }
    const dest = waypoint(from === 'bottom' ? top : bottom, new Vector3());
    rt.audio.sfx('awaken', this.liftPlatform.position);
    haptic('both', 0.4, 200);
    // Comfort: no forced camera motion. The platform moves while the view is faded.
    rt.fade(() => {
      PlayerSystem.teleport(dest);
      this.liftAt = from === 'bottom' ? 'top' : 'bottom';
      this.liftAnim = 0;
    });
  }

  update(delta: number, time: number): void {
    const dt = Math.min(delta, 0.1);

    // Zone streaming (cheap; twice a second)
    this.streamTimer -= dt;
    if (this.streamTimer <= 0) {
      this.streamTimer = 0.5;
      const p = this.player.position;
      for (const z of this.zones) {
        const show = Math.hypot(p.x - z.center.x, p.z - z.center.z) < z.radius + STREAM_MARGIN;
        if (show !== z.shown) {
          z.shown = show;
          for (const o of z.build.detail) o.visible = show;
        }
      }
      for (const em of this.emitters) {
        const z = this.zones.find((x) => x.build.id === em.zone);
        em.emitter.points.visible = !!z?.shown;
      }
    }

    for (const em of this.emitters) if (em.emitter.points.visible) em.emitter.update(time);
    this.birds.update(time);
    this.clouds.rotation.y = time * 0.004;
    // Antenna beacon: a slow, soft pulse (no flashing)
    const k = 0.55 + 0.45 * Math.sin(time * 1.6);
    (this.beacon.material as MeshBasicMaterial).color.setRGB(1 * k + 0.2, 0.3 * k, 0.25 * k);

    // Lift platform glides to its end position
    const by = heightAt(LIFT.x, LIFT.z) + 0.15;
    const target = this.liftAt === 'top' ? LIFT.top - 0.1 : by;
    if (this.liftAnim >= 0) {
      this.liftAnim += dt;
      this.liftPlatform.position.y += (target - this.liftPlatform.position.y) * Math.min(1, dt * 3);
      if (Math.abs(target - this.liftPlatform.position.y) < 0.01) this.liftAnim = -1;
    }
  }
}

