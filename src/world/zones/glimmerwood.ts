/**
 * Glimmerwood (west): a forest of glowing crystal trees, Old Hesk's grove,
 * the sealed "eye that sleeps" shrine and the crystal spire landmark.
 */
import {
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  IcosahedronGeometry,
  OctahedronGeometry,
  SphereGeometry,
  TorusGeometry,
} from '@iwsdk/core';
import { GeoBuilder, Materials, instanced, meshFrom, rng, type Place } from '../geo.js';
import { GLIMMER, distToRoad, heightAt } from '../heightfield.js';
import { box, colCylinder, countTriangles, type ZoneBuild } from './common.js';

const VIOLET = ['#8e5cff', '#a787ff', '#6fd6ff', '#c9b6ff', '#5ff0e0'];

export function buildGlimmerwood(): ZoneBuild {
  const rand = rng(2024);
  const lit = new GeoBuilder();
  const glow = new GeoBuilder();
  const col = new GeoBuilder();
  const landLit = new GeoBuilder();
  const landGlow = new GeoBuilder();

  // ---- crystal trees (instanced: trunk + crystal crown)
  const trunk = new GeoBuilder();
  trunk.add(new CylinderGeometry(0.12, 0.22, 2.2, 5), '#3b3550', { pos: [0, 1.1, 0] });
  trunk.add(new CylinderGeometry(0.05, 0.08, 1.1, 4), '#3b3550', { pos: [0.35, 1.9, 0], rot: [0, 0, -0.7] });
  trunk.add(new CylinderGeometry(0.05, 0.08, 1.0, 4), '#3b3550', { pos: [-0.3, 2.1, 0.1], rot: [0.2, 0, 0.8] });
  const crown = new GeoBuilder();
  crown.add(new OctahedronGeometry(0.75, 0), '#ffffff', { pos: [0, 2.9, 0], scale: [0.8, 1.6, 0.8] });
  crown.add(new OctahedronGeometry(0.45, 0), '#d8d0ff', { pos: [0.75, 2.4, 0.1], scale: [0.7, 1.4, 0.7], rot: [0, 0, -0.5] });
  crown.add(new OctahedronGeometry(0.4, 0), '#d8d0ff', { pos: [-0.62, 2.6, 0.15], scale: [0.7, 1.4, 0.7], rot: [0.3, 0, 0.6] });
  const places: Place[] = [];
  const tints: string[] = [];
  for (let tries = 0; places.length < 95 && tries < 2000; tries++) {
    const a = rand() * Math.PI * 2;
    const r = 6 + Math.sqrt(rand()) * 34;
    const x = GLIMMER.x + Math.cos(a) * r;
    const z = GLIMMER.z + Math.sin(a) * r;
    if (distToRoad(x, z) < 4) continue;
    if (Math.hypot(x - GLIMMER.grove[0], z - GLIMMER.grove[1]) < 10) continue;
    if (Math.hypot(x - GLIMMER.eye[0], z - GLIMMER.eye[1]) < 11) continue;
    if (Math.hypot(x - GLIMMER.spire[0], z - GLIMMER.spire[1]) < 8) continue;
    if (places.some((p) => Math.hypot((p.pos as number[])[0] - x, (p.pos as number[])[2] - z) < 3.2)) continue;
    const s = 0.8 + rand() * 1.1;
    const y = heightAt(x, z) - 0.1;
    places.push({ pos: [x, y, z], rot: [0, rand() * 6.28, (rand() - 0.5) * 0.15], scale: s });
    tints.push(VIOLET[Math.floor(rand() * VIOLET.length)]);
    if (s > 1.2) colCylinder(col, x, z, 0.3 * s, 3, y);
  }
  const trunks = instanced(trunk, Materials.lit, places, 'GlimmerTrunks');
  const crowns = instanced(crown, Materials.glow, places, 'GlimmerCrowns', tints);

  // Small crystal shards and glowing mushrooms on the forest floor
  for (let k = 0; k < 120; k++) {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * 40;
    const x = GLIMMER.x + Math.cos(a) * r;
    const z = GLIMMER.z + Math.sin(a) * r;
    if (distToRoad(x, z) < 3) continue;
    const y = heightAt(x, z);
    if (k % 3 === 0) {
      glow.add(new ConeGeometry(0.06, 0.25, 4), '#ffd27a', { pos: [x, y + 0.12, z] });
      glow.add(new SphereGeometry(0.13, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2), '#6fd6ff', { pos: [x, y + 0.25, z] });
    } else {
      glow.add(new OctahedronGeometry(0.12 + rand() * 0.2, 0), VIOLET[k % VIOLET.length], {
        pos: [x, y + 0.1, z],
        rot: [rand(), rand(), rand()],
        scale: [0.6, 1.8, 0.6],
      });
    }
  }
  // Fallen logs and mossy boulders
  for (let k = 0; k < 18; k++) {
    const a = rand() * Math.PI * 2;
    const r = 8 + rand() * 30;
    const x = GLIMMER.x + Math.cos(a) * r;
    const z = GLIMMER.z + Math.sin(a) * r;
    if (distToRoad(x, z) < 4) continue;
    const y = heightAt(x, z);
    if (k % 2) lit.add(new CylinderGeometry(0.3, 0.35, 4 + rand() * 3, 6), '#4a3f3a', { pos: [x, y + 0.25, z], rot: [Math.PI / 2, rand() * 3, 0] });
    else lit.add(new DodecahedronGeometry(0.8 + rand(), 0), '#3f5a52', { pos: [x, y + 0.3, z], rot: [rand(), rand(), rand()] });
  }

  // ---- Old Hesk's grove: round hut, stone seats, wind chimes, lanterns
  const [gx, gz] = GLIMMER.grove;
  const gy = heightAt(gx, gz);
  lit.add(new CylinderGeometry(2.2, 2.4, 2.4, 9), '#6b5a48', { pos: [gx - 3, gy + 1.2, gz - 3] });
  lit.add(new ConeGeometry(3.1, 2.4, 9), '#3f5a46', { pos: [gx - 3, gy + 3.4, gz - 3] });
  lit.add(box(0.1, 1.8, 1), '#3b2a1f', { pos: [gx - 0.78, gy + 0.9, gz - 2.2], rot: [0, 0.8, 0] });
  colCylinder(col, gx - 3, gz - 3, 2.4, 3, gy);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    lit.add(new CylinderGeometry(0.35, 0.45, 0.45, 6), '#7d7c76', { pos: [gx + 1.5 + Math.cos(a) * 2.6, gy + 0.22, gz + 1.5 + Math.sin(a) * 2.6] });
  }
  glow.add(new IcosahedronGeometry(0.25, 0), '#ffb347', { pos: [gx + 1.5, gy + 0.35, gz + 1.5] }); // ember bowl
  lit.add(new CylinderGeometry(0.5, 0.6, 0.3, 8), '#5f5e5a', { pos: [gx + 1.5, gy + 0.15, gz + 1.5] });
  for (let k = 0; k < 5; k++) {
    glow.add(new CylinderGeometry(0.02, 0.02, 0.4 + k * 0.08, 4), '#c9b6ff', { pos: [gx - 0.6 + k * 0.12, gy + 2.6 - k * 0.04, gz - 0.5] });
  }
  lit.add(box(1.2, 0.05, 0.05), '#3b2a1f', { pos: [gx - 0.36, gy + 2.85, gz - 0.5] });

  // ---- the "eye that sleeps": a half-buried stone dome with a carved eye
  const [ex, ez] = GLIMMER.eye;
  const ey = heightAt(ex, ez);
  lit.add(new SphereGeometry(5.5, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), '#5a5868', { pos: [ex - 2, ey - 0.3, ez] });
  lit.add(new TorusGeometry(1.4, 0.18, 5, 18), '#3a3848', { pos: [ex + 3.15, ey + 2.4, ez], rot: [0, Math.PI / 2, 0], scale: [1, 0.55, 1] });
  lit.add(box(0.1, 0.4, 2.4), '#2e2c3a', { pos: [ex + 3.25, ey + 2.4, ez] }); // closed lid
  glow.add(new OctahedronGeometry(0.18, 0), '#8e5cff', { pos: [ex + 3.3, ey + 2.4, ez] });
  lit.add(box(0.3, 2.4, 1.8), '#3a3848', { pos: [ex + 3.4, ey + 1.1, ez] }); // sealed door
  colCylinder(col, ex - 2, ez, 5.5, 5, ey - 0.3);
  // Circle of worn plinths in front of the shrine (the light puzzle stands here later)
  for (let k = 0; k < 7; k++) {
    const a = -Math.PI / 2 + (k / 6) * Math.PI;
    lit.add(box(0.5, 0.25, 0.5), '#6d6a66', { pos: [ex + 6 + Math.cos(a) * 5, ey + 0.12, ez + Math.sin(a) * 5] });
  }

  // ---- landmark: the crystal spire (visible from Wreckhaven)
  const [sx, sz] = GLIMMER.spire;
  const sy = heightAt(sx, sz);
  landGlow.add(new ConeGeometry(4, 36, 6), '#8e5cff', { pos: [sx, sy + 17, sz] });
  landGlow.add(new ConeGeometry(2.4, 22, 5), '#a787ff', { pos: [sx + 4, sy + 9, sz + 2], rot: [0.12, 0, -0.22] });
  landGlow.add(new ConeGeometry(2, 18, 5), '#6fd6ff', { pos: [sx - 3.5, sy + 7, sz - 2.5], rot: [-0.2, 0, 0.25] });
  landLit.add(new DodecahedronGeometry(5, 0), '#3d3a52', { pos: [sx, sy, sz] });
  colCylinder(col, sx, sz, 5, 8, sy);

  const detail = [trunks, crowns, meshFrom(lit, Materials.litDouble, 'GlimmerLit'), meshFrom(glow, Materials.glow, 'GlimmerGlow')];
  const landmark = [meshFrom(landLit, Materials.lit, 'GlimmerSpireBase'), meshFrom(landGlow, Materials.glow, 'GlimmerSpire')];
  return {
    id: 'glimmerwood',
    detail,
    landmark,
    colliders: meshFrom(col, Materials.collider, 'GlimmerColliders'),
    triangles: countTriangles([...detail, ...landmark]),
  };
}
