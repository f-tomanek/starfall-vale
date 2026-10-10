/**
 * Rustdune Canyon (east): glassy dunes around the Meridian's broken engine,
 * the salvagers' camp and the canyon mesas.
 */
import {
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  IcosahedronGeometry,
  OctahedronGeometry,
  PlaneGeometry,
  TorusGeometry,
} from '@iwsdk/core';
import { GeoBuilder, Materials, instanced, meshFrom, rng, type Place } from '../geo.js';
import { RUST, distToRoad, heightAt } from '../heightfield.js';
import { box, colCylinder, countTriangles, type ZoneBuild } from './common.js';

export function buildRustdune(): ZoneBuild {
  const rand = rng(77);
  const lit = new GeoBuilder();
  const glow = new GeoBuilder();
  const col = new GeoBuilder();
  const landLit = new GeoBuilder();
  const landGlow = new GeoBuilder();

  // ---- landmark: the broken engine nacelle lying in the sand
  const [nx, nz] = RUST.engine;
  const ny = heightAt(nx, nz);
  const tilt: [number, number, number] = [0.18, 0.35, Math.PI / 2 - 0.12];
  landLit.add(new CylinderGeometry(7, 8, 28, 14, 1, true), '#7a4a2e', { pos: [nx, ny + 4, nz], rot: tilt });
  landLit.add(new CylinderGeometry(7.2, 7.2, 1.2, 14, 1, true), '#3c4549', { pos: [nx - 6, ny + 3, nz - 2], rot: tilt });
  landLit.add(new CylinderGeometry(7.2, 7.2, 1.2, 14, 1, true), '#3c4549', { pos: [nx + 5, ny + 5.5, nz + 2], rot: tilt });
  landLit.add(new ConeGeometry(9.5, 8, 14, 1, true), '#4d3a2c', { pos: [nx + 15, ny + 7, nz + 5], rot: [0.18, 0.35, -Math.PI / 2 - 0.12] });
  for (let k = 0; k < 3; k++) {
    landLit.add(box(0.6, 9, 4), '#5d6b70', { pos: [nx - 4 + k * 6, ny + 11, nz + 1], rot: [0.3 + k * 0.2, 0.35, 0.2] });
  }
  // Inner glow deep in the exhaust bell
  landGlow.add(new IcosahedronGeometry(2.4, 0), '#ff8a4c', { pos: [nx + 12, ny + 6.3, nz + 4] });
  colCylinder(col, nx, nz, 8, 9, ny);
  colCylinder(col, nx + 12, nz + 4, 7, 9, ny);
  // Engine bay door facing the camp (opens in Act 2)
  lit.add(box(0.4, 4.2, 4.6), '#3c4549', { pos: [nx - 8.1, ny + 2.1, nz - 1.5], rot: [0, 0.35, 0] });
  lit.add(box(0.5, 4.6, 0.3), '#c8642c', { pos: [nx - 8.2, ny + 2.3, nz - 3.8], rot: [0, 0.35, 0] });
  lit.add(box(0.5, 4.6, 0.3), '#c8642c', { pos: [nx - 8.0, ny + 2.3, nz + 0.8], rot: [0, 0.35, 0] });
  glow.add(box(0.1, 0.2, 2.4), '#ff6a3d', { pos: [nx - 8.4, ny + 3.6, nz - 1.5], rot: [0, 0.35, 0] });

  // ---- salvager camp: tents, scrap barricade, fire pit, crane, flags
  const [cx, cz] = RUST.camp;
  const cy = heightAt(cx, cz);
  const tentColors = ['#8a5a3a', '#6b4a2f', '#a0784a', '#5d6b70'];
  [
    [-4, -4],
    [4, -5],
    [-5, 4],
    [5, 4],
  ].forEach(([dx, dz], i) => {
    lit.add(new ConeGeometry(2, 2.6, 4), tentColors[i], { pos: [cx + dx, cy + 1.3, cz + dz], rot: [0, Math.PI / 4 + i, 0] });
    colCylinder(col, cx + dx, cz + dz, 1.4, 2.4, cy);
  });
  // Fire pit
  lit.add(new TorusGeometry(0.7, 0.18, 4, 10), '#5f5e5a', { pos: [cx, cy + 0.1, cz], rot: [Math.PI / 2, 0, 0] });
  glow.add(new ConeGeometry(0.35, 0.8, 5), '#ffb347', { pos: [cx, cy + 0.4, cz] });
  glow.add(new ConeGeometry(0.2, 0.55, 5), '#ff6a3d', { pos: [cx + 0.2, cy + 0.3, cz + 0.1] });
  // Scrap barricade on the east side of the camp (toward the engine)
  for (let k = 0; k < 9; k++) {
    const a = -0.9 + k * 0.22;
    const x = cx + Math.cos(a) * 10;
    const z = cz + Math.sin(a) * 10;
    if (k === 4) continue; // gap: the way to the engine
    lit.add(box(0.3, 1.8 + rand() * 0.8, 2.2), rand() < 0.5 ? '#5d6b70' : '#9a5530', {
      pos: [x, heightAt(x, z) + 0.9, z],
      rot: [0, -a, (rand() - 0.5) * 0.3],
    });
    col.add(box(0.5, 2.2, 2.2), '#000000', { pos: [x, heightAt(x, z) + 1.1, z], rot: [0, -a, 0] });
  }
  // Crane made of scrap
  lit.add(box(0.4, 7, 0.4), '#5d6b70', { pos: [cx - 8, cy + 3.5, cz - 6] });
  lit.add(box(6, 0.35, 0.35), '#5d6b70', { pos: [cx - 5.5, cy + 6.8, cz - 6], rot: [0, 0, -0.15] });
  lit.add(new CylinderGeometry(0.02, 0.02, 3, 3), '#2a2a2a', { pos: [cx - 3, cy + 5.2, cz - 6] });
  lit.add(box(0.8, 0.8, 0.8), '#9a5530', { pos: [cx - 3, cy + 3.5, cz - 6] });
  colCylinder(col, cx - 8, cz - 6, 0.5, 7, cy);
  // Crates and flags
  for (let k = 0; k < 8; k++) {
    const x = cx - 7 + rand() * 14;
    const z = cz - 7 + rand() * 14;
    if (Math.hypot(x - cx, z - cz) < 2.5) continue;
    lit.add(box(0.8, 0.8, 0.8), '#7a5638', { pos: [x, heightAt(x, z) + 0.4, z], rot: [0, rand() * 3, 0] });
  }
  for (const [dx, dz, c] of [
    [-6, 0, '#ff6a3d'],
    [6, 1, '#c99a3e'],
  ] as const) {
    lit.add(new CylinderGeometry(0.05, 0.05, 4, 4), '#3b2a1f', { pos: [cx + dx, cy + 2, cz + dz] });
    lit.add(new PlaneGeometry(1.2, 0.7), c, { pos: [cx + dx + 0.6, cy + 3.6, cz + dz] });
  }

  // ---- canyon mesas around the outer edge (layered rock)
  const strata = ['#9a5530', '#b8683a', '#7a4428', '#c47b4a'];
  for (let k = 0; k < 16; k++) {
    const a = -1.4 + (k / 15) * 2.8;
    const r = 36 + rand() * 8;
    const x = RUST.x + Math.cos(a) * r;
    const z = RUST.z + Math.sin(a) * r;
    if (distToRoad(x, z) < 8) continue;
    const y = heightAt(x, z);
    const h = 6 + rand() * 12;
    const w = 3 + rand() * 4;
    for (let s = 0; s < 3; s++) {
      lit.add(new CylinderGeometry(w * (1 - s * 0.12), w * (1.05 - s * 0.12), h / 3, 7), strata[(k + s) % strata.length], {
        pos: [x, y + (h / 3) * (s + 0.5), z],
        rot: [0, rand(), 0],
      });
    }
    colCylinder(col, x, z, w, h, y);
  }

  // ---- glass shards and half-buried debris in the dunes (instanced)
  const shard = new GeoBuilder();
  shard.add(new OctahedronGeometry(0.5, 0), '#ffe1c2', { scale: [0.4, 1.6, 0.4] });
  const shardPlaces: Place[] = [];
  const debris = new GeoBuilder();
  debris.add(new DodecahedronGeometry(0.8, 0), '#5d6b70');
  const debrisPlaces: Place[] = [];
  for (let k = 0; k < 140; k++) {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * 34;
    const x = RUST.x + Math.cos(a) * r;
    const z = RUST.z + Math.sin(a) * r;
    if (distToRoad(x, z) < 3 || Math.hypot(x - cx, z - cz) < 11) continue;
    const y = heightAt(x, z);
    if (k % 3) shardPlaces.push({ pos: [x, y + 0.3, z], rot: [(rand() - 0.5) * 0.8, rand() * 3, (rand() - 0.5) * 0.8], scale: 0.5 + rand() })
    else debrisPlaces.push({ pos: [x, y + 0.1, z], rot: [rand() * 3, rand() * 3, rand() * 3], scale: [1 + rand() * 2, 0.4, 0.8 + rand()] });
  }
  const shards = instanced(shard, Materials.lit, shardPlaces, 'RustShards');
  const scrap = instanced(debris, Materials.lit, debrisPlaces, 'RustDebris', ['#5d6b70', '#9a5530', '#3c4549']);

  const detail = [shards, scrap, meshFrom(lit, Materials.litDouble, 'RustLit'), meshFrom(glow, Materials.glow, 'RustGlow')];
  const landmark = [meshFrom(landLit, Materials.litDouble, 'RustEngine'), meshFrom(landGlow, Materials.glow, 'RustEngineGlow')];
  return {
    id: 'rustdune',
    detail,
    landmark,
    colliders: meshFrom(col, Materials.collider, 'RustColliders'),
    triangles: countTriangles([...detail, ...landmark]),
  };
}
