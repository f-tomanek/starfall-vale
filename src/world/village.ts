/**
 * Procedural Wreckhaven: the Meridian's hull, the street, the workshop, the
 * market, the bridge shrine and the Beacon Ring. Everything static is merged
 * into a handful of meshes (lit, glow, colliders).
 */
import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  IcosahedronGeometry,
  Matrix4,
  Mesh,
  OctahedronGeometry,
  PlaneGeometry,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from '@iwsdk/core';
import { GeoBuilder, Materials, lerpColor, meshFrom, rng } from './geo.js';
import { HULL, PLATFORM, SOLIDS, groundAt } from './layout.js';
import { PATH_POINTS, buildTerrainGeometry, heightAt } from './terrain.js';

export const PALETTE = {
  teal: '#3fa7a3',
  tealDark: '#24585a',
  hull: '#5d6b70',
  hullDark: '#3c4549',
  rust: '#9a5530',
  rustDark: '#6b3a22',
  amber: '#ffb347',
  amberGlow: '#ffc76b',
  violet: '#8e5cff',
  wood: '#7a5638',
  woodDark: '#563b26',
  cloth1: '#b5533c',
  cloth2: '#3f7d84',
  cloth3: '#c99a3e',
  stone: '#8b8a84',
  stoneDark: '#5f5e5a',
  leaf: '#4f8a5a',
};

export interface VillageMeshes {
  terrain: Mesh;
  lit: Mesh;
  glow: Mesh;
  colliders: Mesh;
  /** Glyph strip on the shrine console; lit up by the Pulse Lantern. */
  consoleGlyphs: Mesh;
  /** Tobbin's basket rim (glows while parts are needed). */
  basketRim: Mesh;
  /** World positions of hanging lanterns (for flicker / audio). */
  lanterns: Vector3[];
  triangles: number;
}

const Z_AXIS = new Vector3(0, 0, 1);
const box = (w: number, h: number, d: number) => new BoxGeometry(w, h, d);

export function buildVillage(): VillageMeshes {
  const lit = new GeoBuilder();
  const glow = new GeoBuilder();
  const col = new GeoBuilder();
  const rand = rng(1337);
  const lanterns: Vector3[] = [];

  // ------------------------------------------------------------------ hull
  const segA = 18; // around
  const segL = 16; // along
  const A = Math.acos(-HULL.cy / HULL.r); // angle where the arc meets y = 0
  const len = HULL.zSouth - HULL.zNorth;
  const at = (a: number, z: number): [number, number, number] => [HULL.r * Math.sin(a), HULL.cy + HULL.r * Math.cos(a), z];
  for (let j = 0; j < segL; j++) {
    const z0 = HULL.zSouth - (len * j) / segL;
    const z1 = HULL.zSouth - (len * (j + 1)) / segL;
    for (let i = 0; i < segA; i++) {
      const a0 = -A + (2 * A * i) / segA;
      const a1 = -A + (2 * A * (i + 1)) / segA;
      // Torn holes in the roof let light in (never on the low walls).
      const top = Math.abs((a0 + a1) / 2) < 0.9;
      if (top && rand() < 0.22 && j > 1 && j < segL - 2) continue;
      const p00 = at(a0, z0);
      const p10 = at(a1, z0);
      const p01 = at(a0, z1);
      const p11 = at(a1, z1);
      const patch = rand();
      const c = patch < 0.15 ? PALETTE.rust : patch < 0.25 ? PALETTE.rustDark : lerpColor(PALETTE.hull, PALETTE.hullDark, rand()).getStyle();
      lit.addTriangles([...p00, ...p10, ...p11, ...p00, ...p11, ...p01], c);
    }
  }
  // Ribs every 8 m
  for (let z = HULL.zSouth - 2; z > HULL.zNorth; z -= 8) {
    for (let i = 0; i < segA; i++) {
      const a0 = -A + (2 * A * i) / segA;
      const a1 = -A + (2 * A * (i + 1)) / segA;
      const [x0, y0] = at(a0, z);
      const [x1, y1] = at(a1, z);
      const mx = (x0 + x1) / 2;
      const my = (y0 + y1) / 2;
      const segLen = Math.hypot(x1 - x0, y1 - y0);
      const m = new Matrix4().compose(
        new Vector3(mx * 0.96, HULL.cy + (my - HULL.cy) * 0.96, z),
        new Quaternion().setFromAxisAngle(Z_AXIS, Math.atan2(y1 - y0, x1 - x0)),
        new Vector3(segLen + 0.05, 0.45, 0.6),
      );
      lit.add(box(1, 1, 1), PALETTE.rustDark, m);
    }
  }
  // North bulkhead with a big window frame behind the shrine
  for (let i = 0; i < segA; i++) {
    const a0 = -A + (2 * A * i) / segA;
    const a1 = -A + (2 * A * (i + 1)) / segA;
    const p0 = at(a0, HULL.zNorth);
    const p1 = at(a1, HULL.zNorth);
    const c: [number, number, number] = [0, 0, HULL.zNorth];
    const window = Math.abs((a0 + a1) / 2) < 0.55;
    if (window) {
      // Only the outer ring of the window frame
      const k = 0.62;
      const q0: [number, number, number] = [p0[0] * k, HULL.cy + (p0[1] - HULL.cy) * k, HULL.zNorth];
      const q1: [number, number, number] = [p1[0] * k, HULL.cy + (p1[1] - HULL.cy) * k, HULL.zNorth];
      lit.addTriangles([...p0, ...q0, ...q1, ...p0, ...q1, ...p1], PALETTE.hullDark);
    } else {
      lit.addTriangles([...c, ...p0, ...p1], PALETTE.hullDark);
    }
  }
  // Floor of the bulkhead section below the window
  lit.add(box(18, 3, 0.4), PALETTE.hullDark, { pos: [0, 1.5, HULL.zNorth] });

  // ---------------------------------------------------------------- street
  // Deck plates down the middle of the hull
  for (let z = HULL.zSouth - 1; z > PLATFORM.rampZ0; z -= 2.2) {
    lit.add(box(5.2, 0.08, 2.1), rand() < 0.5 ? '#6f7478' : '#666b6e', { pos: [0, 0.04, z] });
  }
  // Gate: two posts, a crossbeam, hanging banners and lanterns
  for (const sx of [-1, 1]) {
    lit.add(box(0.7, 5.5, 0.7), PALETTE.rustDark, { pos: [sx * 4.2, 2.75, 13] });
    lit.add(box(0.12, 2.2, 1.2), sx < 0 ? PALETTE.cloth2 : PALETTE.cloth1, { pos: [sx * 3.75, 3.6, 13] });
    addLantern(sx * 4.2, 4.3, 12.4);
  }
  lit.add(box(9.4, 0.6, 0.8), PALETTE.rust, { pos: [0, 5.6, 13] });

  // Market stalls (west side)
  const stallCloth = [PALETTE.cloth1, PALETTE.cloth2, PALETTE.cloth3];
  [-5, -11, -17].forEach((z, i) => {
    lit.add(box(2, 0.9, 2), PALETTE.wood, { pos: [-6.6, 0.45, z] });
    lit.add(box(2.1, 0.06, 2.1), PALETTE.woodDark, { pos: [-6.6, 0.92, z] });
    for (const [dx, dz] of [[-0.95, -0.95], [0.95, -0.95], [-0.95, 0.95], [0.95, 0.95]]) {
      lit.add(new CylinderGeometry(0.05, 0.05, 2.4, 5), PALETTE.woodDark, { pos: [-6.6 + dx, 1.2, z + dz] });
    }
    lit.add(new ConeGeometry(1.9, 0.8, 4, 1), stallCloth[i], { pos: [-6.6, 2.75, z], rot: [0, Math.PI / 4, 0] });
    if (i > 0) {
      // Goods on the occupied stalls
      for (let k = 0; k < 5; k++) {
        lit.add(new DodecahedronGeometry(0.12, 0), rand() < 0.5 ? '#c96f3b' : '#9ec26a', {
          pos: [-6.6 + (rand() - 0.5) * 1.4, 1.02, z + (rand() - 0.5) * 1.4],
        });
      }
    }
  });

  // Workshop (east side): bench, shelves, scrap pile, flying-machine frame, basket
  lit.add(box(1.6, 0.9, 3), PALETTE.wood, { pos: [9.8, 0.45, -6.5] });
  lit.add(box(1.7, 0.06, 3.1), PALETTE.woodDark, { pos: [9.8, 0.92, -6.5] });
  lit.add(box(1, 2.2, 5), PALETTE.woodDark, { pos: [10.9, 1.1, -11.5] });
  for (let s = 0; s < 3; s++) {
    for (let k = 0; k < 4; k++) {
      lit.add(box(0.3, 0.3, 0.3), rand() < 0.5 ? PALETTE.rust : PALETTE.hull, {
        pos: [10.5, 0.55 + s * 0.7, -13.4 + k * 1.2],
        rot: [0, rand(), 0],
      });
    }
  }
  for (let k = 0; k < 14; k++) {
    lit.add(new DodecahedronGeometry(0.25 + rand() * 0.25, 0), rand() < 0.4 ? PALETTE.rustDark : PALETTE.hullDark, {
      pos: [6.5 + rand() * 2.5, 0.2, -3 + rand() * 2.5],
      rot: [rand() * 3, rand() * 3, rand() * 3],
    });
  }
  // Tobbin's flying machine: a seat, a frame and canvas wings
  lit.add(box(0.8, 0.5, 0.8), PALETTE.wood, { pos: [4.5, 0.6, -14] });
  lit.add(new CylinderGeometry(0.06, 0.06, 4.5, 5), PALETTE.woodDark, { pos: [4.5, 1.2, -14], rot: [0, 0, Math.PI / 2] });
  for (const sx of [-1, 1]) {
    lit.add(new PlaneGeometry(2.2, 1.1), PALETTE.cloth3, { pos: [4.5 + sx * 1.3, 1.25, -14], rot: [-Math.PI / 2 + 0.1 * sx, 0, 0] });
  }
  // Basket for parts
  lit.add(new CylinderGeometry(0.5, 0.38, 0.6, 10, 1, true), '#a8844f', { pos: [8.2, 0.3, -12.2] });
  lit.add(new CylinderGeometry(0.38, 0.38, 0.04, 10), '#7d6038', { pos: [8.2, 0.03, -12.2] });
  const basketRim = new Mesh(new TorusGeometry(0.5, 0.035, 5, 16), Materials.glow.clone());
  basketRim.rotation.x = Math.PI / 2;
  basketRim.position.set(8.2, 0.62, -12.2);
  basketRim.name = 'BasketRim';

  // Pipes along the west wall and the valve crate
  for (const y of [0.6, 1.3]) {
    lit.add(new CylinderGeometry(0.22, 0.22, 16, 7), PALETTE.rust, { pos: [-10.8, y, -26], rot: [Math.PI / 2, 0, 0] });
  }
  lit.add(box(1.2, 0.4, 2), PALETTE.wood, { pos: [-8.6, 0.2, -26] });

  // Houses built inside the hull
  for (const [x0, x1, z0, z1, h] of SOLIDS.slice(-4)) {
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    lit.add(box(x1 - x0, h, z1 - z0), rand() < 0.5 ? '#8a6b4c' : '#6f7a6e', { pos: [cx, h / 2, cz] });
    lit.add(new ConeGeometry(Math.max(x1 - x0, z1 - z0) * 0.75, 1.4, 4), rand() < 0.5 ? PALETTE.rust : PALETTE.cloth2, {
      pos: [cx, h + 0.7, cz],
      rot: [0, Math.PI / 4, 0],
    });
    // Door + window glow
    const face = cx < 0 ? x1 + 0.01 : x0 - 0.01;
    lit.add(box(0.02, 1.8, 0.9), PALETTE.woodDark, { pos: [face, 0.9, cz] });
    glow.add(box(0.03, 0.5, 0.6), PALETTE.amberGlow, { pos: [face, 2, cz + 1.3] });
    addLantern(face + (cx < 0 ? 0.5 : -0.5), 2.6, cz - 1.4);
  }

  // Planters with little trees
  for (const [x, z] of [[-3.5, 4], [3.5, 4], [-3.5, -22], [3.5, -22]]) {
    lit.add(box(1.2, 0.5, 1.2), PALETTE.woodDark, { pos: [x, 0.25, z] });
    lit.add(new ConeGeometry(0.6, 1.6, 6), PALETTE.leaf, { pos: [x, 1.4, z] });
  }

  // Street lanterns on poles
  for (let z = 8; z > -28; z -= 9) {
    for (const sx of [-1, 1]) {
      lit.add(new CylinderGeometry(0.06, 0.08, 3, 5), PALETTE.rustDark, { pos: [sx * 3.2, 1.5, z] });
      addLantern(sx * 3.2, 3.05, z);
    }
  }

  // ---------------------------------------------------------- bridge shrine
  const P = PLATFORM;
  lit.add(box(P.x1 - P.x0, P.height, P.z1 - P.z0), '#55616a', { pos: [0, P.height / 2, (P.z0 + P.z1) / 2] });
  // Ramp (a sloped slab)
  const rampLen = Math.hypot(P.rampZ0 - P.z1, P.height);
  const rampAngle = Math.atan2(P.height, P.rampZ0 - P.z1);
  lit.add(box(P.rampX * 2, 0.15, rampLen), '#5b666e', {
    pos: [0, P.height / 2, (P.rampZ0 + P.z1) / 2],
    rot: [rampAngle, 0, 0],
  });
  // Railings
  for (const sx of [-1, 1]) {
    lit.add(box(0.1, 0.1, P.z1 - P.z0), PALETTE.rust, { pos: [sx * (P.x1 - 0.1), P.height + 1, (P.z0 + P.z1) / 2] });
    for (let z = P.z1; z >= P.z0; z -= 2) {
      lit.add(box(0.08, 1, 0.08), PALETTE.rustDark, { pos: [sx * (P.x1 - 0.1), P.height + 0.5, z] });
    }
  }
  // Console: pedestal, slanted screen, glyph strip
  lit.add(new CylinderGeometry(0.45, 0.6, 1, 8), PALETTE.hullDark, { pos: [0, P.height + 0.5, -47.4] });
  lit.add(box(1.4, 0.08, 0.8), '#2a3236', { pos: [0, P.height + 1.05, -47.3], rot: [0.5, 0, 0] });
  const glyphs = new GeoBuilder();
  for (let k = 0; k < 6; k++) {
    glyphs.add(box(0.14, 0.02, 0.14), PALETTE.teal, { pos: [-0.5 + k * 0.2, P.height + 1.1, -47.3 + (k % 2) * 0.1 - 0.05], rot: [0.5, 0, 0] });
  }
  const consoleGlyphs = meshFrom(glyphs, Materials.glow.clone(), 'ConsoleGlyphs');
  // Offerings, candles and hanging cloth at the shrine
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI - Math.PI;
    const x = Math.cos(a) * 2.3;
    const z = -47.4 + Math.sin(a) * 1.6;
    lit.add(new CylinderGeometry(0.05, 0.05, 0.25, 5), '#e8dcc0', { pos: [x, P.height + 0.12, z] });
    glow.add(new OctahedronGeometry(0.04, 0), PALETTE.amberGlow, { pos: [x, P.height + 0.3, z] });
  }
  for (const sx of [-1, 1]) {
    lit.add(new PlaneGeometry(1.2, 3.5), sx < 0 ? PALETTE.cloth2 : PALETTE.violet, { pos: [sx * 4, P.height + 3, HULL.zNorth + 0.4] });
    addLantern(sx * 5.5, P.height + 2.4, -44);
  }

  // --------------------------------------------------------- Beacon Ring
  const bY = heightAt(0, 62);
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    if (k === 9) continue; // gap to the north where the path leaves the ring
    const h = 1.8 + rand() * 1.4;
    lit.add(box(0.8, h, 0.5), k % 3 === 0 ? PALETTE.stoneDark : PALETTE.stone, {
      pos: [Math.cos(a) * 7, bY + h / 2 - 0.2, 62 + Math.sin(a) * 7],
      rot: [0, -a, (rand() - 0.5) * 0.12],
    });
  }
  lit.add(new CylinderGeometry(2.4, 2.8, 0.4, 12), PALETTE.stoneDark, { pos: [0, bY + 0.05, 62] });
  glow.add(new TorusGeometry(1.9, 0.06, 4, 24), PALETTE.teal, { pos: [0, bY + 0.28, 62], rot: [Math.PI / 2, 0, 0] });
  glow.add(new OctahedronGeometry(0.35, 0), '#9ff7ef', { pos: [0, bY + 2.4, 62] });

  // Path edging stones
  for (let i = 0; i < PATH_POINTS.length - 1; i++) {
    const [ax, az] = PATH_POINTS[i];
    const [bx, bz] = PATH_POINTS[i + 1];
    const n = Math.ceil(Math.hypot(bx - ax, bz - az) / 3);
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const x = ax + (bx - ax) * t;
      const z = az + (bz - az) * t;
      for (const sx of [-1, 1]) {
        const px = x + sx * (2.6 + rand() * 0.5);
        lit.add(new DodecahedronGeometry(0.2 + rand() * 0.15, 0), PALETTE.stoneDark, { pos: [px, heightAt(px, z) + 0.05, z] });
      }
      if (k % 3 === 1 && z < 52) {
        const px = x + 3.2;
        lit.add(new CylinderGeometry(0.05, 0.06, 1.8, 5), PALETTE.woodDark, { pos: [px, heightAt(px, z) + 0.9, z] });
        addLantern(px, heightAt(px, z) + 1.85, z);
      }
    }
  }

  // ------------------------------------------------------ distant landmarks
  // Skyreach Isles (north), Glimmerwood spire (west), Rustdune engine (east).
  // Low-detail silhouettes for now; full zones arrive in milestone 2.
  for (let k = 0; k < 6; k++) {
    const x = -40 + k * 16 + (rand() - 0.5) * 8;
    const z = -95 - rand() * 20;
    const y = 26 + rand() * 26;
    const r = 5 + rand() * 6;
    lit.add(new ConeGeometry(r, r * 1.6, 7), '#4d5a66', { pos: [x, y - r * 0.8, z], rot: [Math.PI, rand(), 0] });
    lit.add(new CylinderGeometry(r, r * 0.95, 1.2, 7), '#4f7a62', { pos: [x, y + 0.6, z] });
  }
  lit.add(box(1.2, 8, 1.2), '#3d4248', { pos: [8, 58, -105] });
  glow.add(new SphereGeometry(0.7, 6, 4), '#ff5a4a', { pos: [8, 62.5, -105] });
  lit.add(new ConeGeometry(4, 34, 6), PALETTE.violet, { pos: [-80, heightAt(-80, -10) + 15, -10] });
  lit.add(new ConeGeometry(2.5, 20, 5), '#a787ff', { pos: [-74, heightAt(-74, -16) + 8, -16], rot: [0.2, 0, 0.15] });
  lit.add(new CylinderGeometry(7, 9, 26, 10, 1, true), PALETTE.rustDark, { pos: [78, heightAt(78, 0) + 6, 0], rot: [0.3, 0, Math.PI / 2 - 0.25] });
  lit.add(new IcosahedronGeometry(5, 0), PALETTE.rust, { pos: [72, heightAt(72, 6) + 3, 6] });

  // Scattered rocks and shrubs on the valley floor
  for (let k = 0; k < 140; k++) {
    const x = (rand() - 0.5) * 220;
    const z = (rand() - 0.5) * 220;
    if (Math.abs(x) < 20 && z < 22 && z > -62) continue;
    if (Math.hypot(x, z - 62) < 12) continue;
    const y = heightAt(x, z);
    if (rand() < 0.5) {
      lit.add(new DodecahedronGeometry(0.4 + rand() * 1.2, 0), PALETTE.stoneDark, { pos: [x, y + 0.2, z], rot: [rand(), rand(), rand()] });
    } else {
      lit.add(new ConeGeometry(0.5 + rand() * 0.6, 1.4 + rand() * 1.6, 5), rand() < 0.5 ? PALETTE.leaf : PALETTE.tealDark, { pos: [x, y + 0.8, z] });
    }
  }

  // ------------------------------------------------------------- colliders
  for (const [x0, x1, z0, z1, h] of SOLIDS) {
    col.add(box(x1 - x0, h, z1 - z0), '#000000', { pos: [(x0 + x1) / 2, h / 2, (z0 + z1) / 2] });
  }
  for (const sx of [-1, 1]) {
    // Hull walls
    col.add(box(0.8, 5, len), '#000000', { pos: [sx * 12.4, 2.5, (HULL.zSouth + HULL.zNorth) / 2] });
    // Platform railings
    col.add(box(0.2, 1.2, P.z1 - P.z0), '#000000', { pos: [sx * (P.x1 - 0.1), P.height + 0.6, (P.z0 + P.z1) / 2] });
  }
  col.add(box(26, 8, 0.6), '#000000', { pos: [0, 4, HULL.zNorth] });
  // Platform: walkable top + ramp + side walls so you take the ramp
  col.add(box(P.x1 - P.x0, P.height, P.z1 - P.z0), '#000000', { pos: [0, P.height / 2, (P.z0 + P.z1) / 2] });
  col.add(box(P.rampX * 2, 0.15, rampLen), '#000000', { pos: [0, P.height / 2, (P.rampZ0 + P.z1) / 2], rot: [rampAngle, 0, 0] });
  col.add(new CylinderGeometry(0.6, 0.6, 1.1, 8), '#000000', { pos: [0, P.height + 0.55, -47.4] });
  col.add(new CylinderGeometry(2.4, 2.8, 0.4, 12), '#000000', { pos: [0, heightAt(0, 62) + 0.05, 62] });
  // Gate posts
  for (const sx of [-1, 1]) col.add(box(0.7, 5, 0.7), '#000000', { pos: [sx * 4.2, 2.5, 13] });

  const terrain = new Mesh(buildTerrainGeometry(), Materials.lit);
  terrain.name = 'Terrain';
  const litMesh = meshFrom(lit, Materials.litDouble, 'VillageLit');
  const glowMesh = meshFrom(glow, Materials.glow, 'VillageGlow');
  const colliders = meshFrom(col, Materials.collider, 'VillageColliders');
  const triangles =
    (terrain.geometry.getAttribute('position').count + litMesh.geometry.getAttribute('position').count + glowMesh.geometry.getAttribute('position').count) / 3;

  return { terrain, lit: litMesh, glow: glowMesh, colliders, consoleGlyphs, basketRim, lanterns, triangles };

  function addLantern(x: number, y: number, z: number): void {
    lit.add(new CylinderGeometry(0.11, 0.13, 0.05, 6), PALETTE.rustDark, { pos: [x, y + 0.18, z] });
    glow.add(new OctahedronGeometry(0.14, 0), PALETTE.amberGlow, { pos: [x, y, z] });
    lanterns.push(new Vector3(x, y, z));
  }
}

export { groundAt };
