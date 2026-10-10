/**
 * Skyreach Isles (north): floating islands reached by the old cargo lift and
 * linked by light bridges; the antenna array crowns the highest island.
 */
import {
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  OctahedronGeometry,
  SphereGeometry,
  TorusGeometry,
} from '@iwsdk/core';
import { GeoBuilder, Materials, meshFrom, rng } from '../geo.js';
import { BRIDGES, ISLANDS, LIFT_BASE, bridgeGeometry, heightAt, island } from '../heightfield.js';
import { box, countTriangles, type ZoneBuild } from './common.js';

export const LIFT = {
  x: LIFT_BASE[0],
  z: -72.5,
  top: ISLANDS[0].y,
};

export interface BridgeParts {
  id: string;
  mesh: Mesh;
  /** Walkable deck + side rails; added to locomotion only while active. */
  collider: Mesh;
  /** Plugs the rim gaps at both ends while the bridge is inactive. */
  gates: Mesh;
}

export interface SkyreachBuild extends ZoneBuild {
  liftPlatform: Mesh;
  beaconLight: Mesh;
  bridges: BridgeParts[];
}

/** Angle (atan2(dx, dz)) from island center toward a point. */
const angleTo = (ix: number, iz: number, x: number, z: number) => Math.atan2(x - ix, z - iz);

export function buildSkyreach(): SkyreachBuild {
  const rand = rng(909);
  const lit = new GeoBuilder();
  const glow = new GeoBuilder();
  const col = new GeoBuilder();
  const landLit = new GeoBuilder();

  // Connection angles per island: bridges + the lift on i1
  const openings = new Map<string, number[]>();
  const addOpening = (id: string, a: number) => openings.set(id, [...(openings.get(id) ?? []), a]);
  for (const b of BRIDGES) {
    const a = island(b.from)!;
    const c = island(b.to)!;
    addOpening(a.id, angleTo(a.x, a.z, c.x, c.z));
    addOpening(c.id, angleTo(c.x, c.z, a.x, a.z));
  }
  addOpening('i1', angleTo(ISLANDS[0].x, ISLANDS[0].z, LIFT.x, LIFT.z));

  // ---- islands
  for (const isl of ISLANDS) {
    const { x, z, y, r } = isl;
    // Grass top, earth rim, rocky underside (silhouette is part of the landmark)
    landLit.add(new CylinderGeometry(r, r * 0.96, 1.2, 14), '#4f7a62', { pos: [x, y - 0.6, z] });
    // Walkable top surface for the locomotion engine
    col.add(new CylinderGeometry(r, r, 1.2, 14), '#000000', { pos: [x, y - 0.6, z] });
    landLit.add(new ConeGeometry(r * 0.95, r * 1.6, 9), '#4d5a66', { pos: [x, y - 1.2 - r * 0.8, z], rot: [Math.PI, rand(), 0] });
    landLit.add(new DodecahedronGeometry(r * 0.35, 0), '#5d6873', { pos: [x + r * 0.3, y - r * 1.2, z - r * 0.2] });
    // Hanging roots
    for (let k = 0; k < 6; k++) {
      const a = rand() * Math.PI * 2;
      lit.add(new CylinderGeometry(0.04, 0.08, 2 + rand() * 4, 4), '#3b2f26', { pos: [x + Math.sin(a) * r * 0.85, y - 2.5, z + Math.cos(a) * r * 0.85] });
    }
    // Low stone curb (visual) and invisible rim walls with gaps at openings
    const segs = 22;
    for (let k = 0; k < segs; k++) {
      const a = (k / segs) * Math.PI * 2;
      const open = (openings.get(isl.id) ?? []).some((o) => Math.abs(Math.atan2(Math.sin(a - o), Math.cos(a - o))) < 0.32);
      if (open) continue;
      const px = x + Math.sin(a) * (r - 0.25);
      const pz = z + Math.cos(a) * (r - 0.25);
      const len = (2 * Math.PI * r) / segs + 0.1;
      lit.add(box(len, 0.35, 0.35), '#7d7c76', { pos: [px, y + 0.17, pz], rot: [0, a + Math.PI / 2, 0] });
      col.add(box(len, 1.4, 0.3), '#000000', { pos: [px, y + 0.7, pz], rot: [0, a + Math.PI / 2, 0] });
    }
    // Small trees and stones
    for (let k = 0; k < 4 + Math.floor(r / 3); k++) {
      const a = rand() * Math.PI * 2;
      // Keep the middle and the walking lines to bridges and the lift clear
      const nearOpening = (openings.get(isl.id) ?? []).some((o) => Math.abs(Math.atan2(Math.sin(a - o), Math.cos(a - o))) < 0.7);
      if (nearOpening) continue;
      const d = r * 0.5 + rand() * (r * 0.5 - 2);
      const tx = x + Math.sin(a) * d;
      const tz = z + Math.cos(a) * d;
      if (k % 2) {
        lit.add(new CylinderGeometry(0.08, 0.12, 1.4, 5), '#4a3a2e', { pos: [tx, y + 0.7, tz] });
        lit.add(new ConeGeometry(0.8, 1.8, 6), '#4f8a5a', { pos: [tx, y + 2.1, tz] });
        col.add(new CylinderGeometry(0.2, 0.2, 2, 5), '#000000', { pos: [tx, y + 1, tz] });
      } else {
        lit.add(new DodecahedronGeometry(0.4, 0), '#7d7c76', { pos: [tx, y + 0.2, tz] });
      }
    }
    // A pylon of the old light-bridge network on every island (activated in Act 2)
    const pa = (openings.get(isl.id) ?? [0])[0] + Math.PI;
    const px = x + Math.sin(pa) * (r * 0.45);
    const pz = z + Math.cos(pa) * (r * 0.45);
    lit.add(new CylinderGeometry(0.35, 0.5, 2.2, 6), '#5d6b70', { pos: [px, y + 1.1, pz] });
    glow.add(new OctahedronGeometry(0.35, 0), '#3fa7a3', { pos: [px, y + 2.6, pz] });
    col.add(new CylinderGeometry(0.5, 0.5, 2.4, 6), '#000000', { pos: [px, y + 1.2, pz] });
  }

  // Ruined arch on i2 and a little observatory platform on i3
  const i2 = island('i2')!;
  for (const s of [-1, 1]) lit.add(box(0.6, 3.5, 0.6), '#8b8a84', { pos: [i2.x + s * 1.6, i2.y + 1.75, i2.z - 2] });
  lit.add(box(4, 0.6, 0.7), '#8b8a84', { pos: [i2.x, i2.y + 3.6, i2.z - 2] });
  const i3 = island('i3')!;
  lit.add(new CylinderGeometry(1.4, 1.6, 0.4, 8), '#6d6a66', { pos: [i3.x + 2, i3.y + 0.2, i3.z + 1] });

  // ---- landmark: antenna array on i5 with a blinking beacon
  const i5 = island('i5')!;
  const ax = i5.x - 1;
  const az = i5.z - 1.5;
  for (const [dx, dz] of [
    [-0.8, -0.8],
    [0.8, -0.8],
    [0, 0.9],
  ]) {
    landLit.add(box(0.18, 13, 0.18), '#3d4248', { pos: [ax + dx * (1 - 0.0), i5.y + 6.5, az + dz], rot: [dz * 0.04, 0, -dx * 0.04] });
  }
  for (let h = 2; h < 13; h += 2.2) landLit.add(new TorusGeometry(0.9 - h * 0.03, 0.05, 3, 6), '#3d4248', { pos: [ax, i5.y + h, az], rot: [Math.PI / 2, 0, 0] });
  landLit.add(new SphereGeometry(2.2, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2.6), '#9aa3a8', { pos: [ax + 2.6, i5.y + 3.5, az + 1.5], rot: [-1.0, 0.6, 0] });
  landLit.add(new SphereGeometry(1.4, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2.6), '#9aa3a8', { pos: [ax - 2.2, i5.y + 6, az + 1], rot: [-0.9, -0.7, 0] });
  col.add(new CylinderGeometry(1.2, 1.2, 4, 6), '#000000', { pos: [ax, i5.y + 2, az] });
  const beaconLight = new Mesh(new SphereGeometry(0.45, 8, 6), new MeshBasicMaterial({ color: '#ff5a4a', fog: false }));
  beaconLight.position.set(ax, i5.y + 13.4, az);
  beaconLight.name = 'AntennaBeacon';

  // ---- the cargo lift: base pad, lattice tower, top landing and the platform
  const by = heightAt(LIFT.x, LIFT.z);
  lit.add(new CylinderGeometry(3.2, 3.4, 0.3, 10), '#5d6b70', { pos: [LIFT.x, by + 0.15, LIFT.z + 1.5] });
  for (const [dx, dz] of [
    [-2.2, -1.6],
    [2.2, -1.6],
    [-2.2, 1.6],
    [2.2, 1.6],
  ]) {
    lit.add(box(0.3, LIFT.top + 4, 0.3), '#7a4a2e', { pos: [LIFT.x + dx, by + (LIFT.top + 4) / 2, LIFT.z + dz] });
    col.add(box(0.4, 3, 0.4), '#000000', { pos: [LIFT.x + dx, by + 1.5, LIFT.z + dz] });
  }
  for (let h = 3; h < LIFT.top + 3; h += 3.2) {
    lit.add(box(4.6, 0.15, 0.15), '#9a5530', { pos: [LIFT.x, by + h, LIFT.z - 1.6], rot: [0, 0, (h % 2 ? 1 : -1) * 0.55] });
    lit.add(box(4.6, 0.15, 0.15), '#9a5530', { pos: [LIFT.x, by + h, LIFT.z + 1.6], rot: [0, 0, (h % 2 ? -1 : 1) * 0.55] });
  }
  lit.add(new CylinderGeometry(0.5, 0.5, 0.6, 8), '#3c4549', { pos: [LIFT.x, by + LIFT.top + 4.2, LIFT.z], rot: [0, 0, Math.PI / 2] });
  lit.add(new CylinderGeometry(0.02, 0.02, LIFT.top + 4, 3), '#222222', { pos: [LIFT.x, by + (LIFT.top + 4) / 2, LIFT.z] });
  const platGeo = new GeoBuilder();
  platGeo.add(box(3.6, 0.25, 2.8), '#6f7478');
  for (const s of [-1, 1]) platGeo.add(box(3.6, 0.9, 0.08), '#c8642c', { pos: [0, 0.55, s * 1.36] });
  const liftPlatform = meshFrom(platGeo, Materials.lit, 'LiftPlatform');
  liftPlatform.matrixAutoUpdate = true;
  liftPlatform.position.set(LIFT.x, by + 0.15, LIFT.z);

  // ---- light bridges (each its own mesh so it can light up independently)
  const bridges: BridgeParts[] = BRIDGES.map((b) => {
    const g = bridgeGeometry(b.id)!;
    const mx = (g.start[0] + g.end[0]) / 2;
    const my = (g.start[1] + g.end[1]) / 2;
    const mz = (g.start[2] + g.end[2]) / 2;
    const pitch = -Math.atan2(g.end[1] - g.start[1], g.length);
    const len = Math.hypot(g.length, g.end[1] - g.start[1]) + 1.2;
    const deck = new GeoBuilder();
    deck.add(box(2.2, 0.12, len), '#ffffff', { rot: [0, 0, 0] });
    for (const s of [-1, 1]) deck.add(box(0.08, 0.08, len), '#ffffff', { pos: [s * 1.1, 0.9, 0] });
    const mesh = new Mesh(deck.build(), new MeshBasicMaterial({ color: '#7ff7ee', transparent: true, opacity: 0.25, depthWrite: false }));
    mesh.position.set(mx, my - 0.02, mz);
    mesh.rotation.set(pitch, g.yaw, 0, 'YXZ');
    mesh.name = `Bridge:${b.id}`;
    const c = new GeoBuilder();
    c.add(box(2.2, 0.3, len), '#000000');
    for (const s of [-1, 1]) c.add(box(0.2, 1.6, len), '#000000', { pos: [s * 1.2, 0.8, 0] });
    const collider = meshFrom(c, Materials.collider, `BridgeCol:${b.id}`);
    collider.matrixAutoUpdate = true;
    collider.position.copy(mesh.position);
    collider.rotation.copy(mesh.rotation);
    const gates = new GeoBuilder();
    for (const end of [g.start, g.end]) gates.add(box(2.8, 1.4, 0.3), '#000000', { pos: [end[0], end[1] + 0.7, end[2]], rot: [0, g.yaw, 0] });
    return { id: b.id, mesh, collider, gates: meshFrom(gates, Materials.collider, `BridgeGate:${b.id}`) };
  });

  const detail = [meshFrom(lit, Materials.litDouble, 'SkyLit'), meshFrom(glow, Materials.glow, 'SkyGlow'), liftPlatform, ...bridges.map((b) => b.mesh)];
  const landmark = [meshFrom(landLit, Materials.litDouble, 'SkyIslands'), beaconLight];
  return {
    id: 'skyreach',
    detail,
    landmark,
    colliders: meshFrom(col, Materials.collider, 'SkyColliders'),
    triangles: countTriangles([...detail, ...landmark]),
    liftPlatform,
    beaconLight,
    bridges,
  };
}
