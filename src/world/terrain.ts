/**
 * The valley floor: a deterministic height function shared by the terrain mesh,
 * prop placement and item dropping.
 */
import { BufferGeometry, Color, Float32BufferAttribute } from '@iwsdk/core';

export const WORLD_HALF = 125;

// ---- value noise ----------------------------------------------------------
function hash(x: number, z: number): number {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function smooth(t: number) {
  return t * t * (3 - 2 * t);
}
export function noise(x: number, z: number): number {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const xf = smooth(x - xi);
  const zf = smooth(z - zi);
  const a = hash(xi, zi);
  const b = hash(xi + 1, zi);
  const c = hash(xi, zi + 1);
  const d = hash(xi + 1, zi + 1);
  return a + (b - a) * xf + (c - a) * zf + (a - b - c + d) * xf * zf;
}
export function fbm(x: number, z: number): number {
  return noise(x, z) * 0.6 + noise(x * 2.1, z * 2.1) * 0.3 + noise(x * 4.3, z * 4.3) * 0.1;
}

function smoothstep(e0: number, e1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/** Distance from point to segment in XZ. */
function segDist(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax;
  const dz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz)));
  const x = ax + dx * t - px;
  const z = az + dz * t - pz;
  return Math.sqrt(x * x + z * z);
}

/** The footpath from the Beacon Ring down to the village gate (XZ points). */
export const PATH_POINTS: Array<[number, number]> = [
  [0, 56],
  [0.5, 46],
  [-2.5, 35],
  [1, 24],
  [0, 14],
];

export function distToPath(x: number, z: number): number {
  let d = Infinity;
  for (let i = 0; i < PATH_POINTS.length - 1; i++) {
    const [ax, az] = PATH_POINTS[i];
    const [bx, bz] = PATH_POINTS[i + 1];
    d = Math.min(d, segDist(x, z, ax, az, bx, bz));
  }
  return d;
}

/** Ground height in meters at world XZ. */
export function heightAt(x: number, z: number): number {
  // Rolling ground
  let h = (fbm(x * 0.035 + 10, z * 0.035 - 4) - 0.45) * 5;
  // Valley rim rises toward the world edge
  const r = Math.hypot(x, z + 5);
  h += Math.min(22, Math.pow(Math.max(0, r - 98), 1.2) * 0.4);
  // The Beacon Ring sits on a gentle rise in the south
  const beacon = Math.hypot(x, z - 62);
  h += (1 - smoothstep(10, 28, beacon)) * 1.2;

  // Flatten the footpath and the beacon plaza (descending from 1.2 m to 0 at the gate)
  const target = beacon < 12 ? 1.2 : 1.2 * (1 - smoothstep(14, 56, 62 - z));
  const k = Math.min(smoothstep(2.2, 7, distToPath(x, z)), smoothstep(8, 12, beacon));
  h = target + (h - target) * k;
  // Flatten the village (hull interior and surroundings) to y = 0
  const hubX = Math.max(0, Math.abs(x) - 16);
  const hubZ = Math.max(0, z - 18, -58 - z);
  return h * smoothstep(0, 10, Math.hypot(hubX, hubZ));
}

export const TERRAIN_COLORS = {
  grass: '#3e6b5a',
  grassLight: '#5a8a68',
  path: '#8a7a5e',
  rock: '#6d6a66',
  rim: '#4d5560',
};

/** Builds the terrain mesh geometry with vertex colors (flat shaded). */
export function buildTerrainGeometry(segments = 100): BufferGeometry {
  const size = WORLD_HALF * 2;
  const step = size / segments;
  const positions: number[] = [];
  const colors: number[] = [];
  const c = new Color();
  const grass = new Color(TERRAIN_COLORS.grass);
  const grassLight = new Color(TERRAIN_COLORS.grassLight);
  const path = new Color(TERRAIN_COLORS.path);
  const rock = new Color(TERRAIN_COLORS.rock);
  const earth = new Color('#5e5648');

  const vert = (x: number, z: number) => {
    const y = heightAt(x, z);
    positions.push(x, y, z);
  };
  const colorTri = (x: number, z: number, y: number, slope: number) => {
    c.copy(grass).lerp(grassLight, fbm(x * 0.15, z * 0.15));
    const pd = distToPath(x, z);
    if (pd < 2.4 || Math.hypot(x, z - 62) < 9) c.lerp(path, 0.85);
    // Packed earth inside the Meridian's hull
    if (Math.abs(x) < 12.8 && z < 12.5 && z > -52.5) c.copy(earth);
    if (slope > 0.45 || y > 9) c.lerp(rock, Math.min(1, (slope - 0.3) * 2 + Math.max(0, y - 9) * 0.1));
    for (let i = 0; i < 3; i++) colors.push(c.r, c.g, c.b);
  };

  for (let iz = 0; iz < segments; iz++) {
    for (let ix = 0; ix < segments; ix++) {
      const x0 = -WORLD_HALF + ix * step;
      const z0 = -WORLD_HALF + iz * step;
      const x1 = x0 + step;
      const z1 = z0 + step;
      // Two triangles, counter-clockwise when seen from above.
      const tris: Array<[number, number][]> = [
        [[x0, z0], [x0, z1], [x1, z0]],
        [[x1, z0], [x0, z1], [x1, z1]],
      ];
      for (const t of tris) {
        let ys = 0;
        let ymin = Infinity;
        let ymax = -Infinity;
        for (const [x, z] of t) {
          const y = heightAt(x, z);
          ys += y;
          ymin = Math.min(ymin, y);
          ymax = Math.max(ymax, y);
          vert(x, z);
        }
        const cx = (t[0][0] + t[1][0] + t[2][0]) / 3;
        const cz = (t[0][1] + t[1][1] + t[2][1]) / 3;
        colorTri(cx, cz, ys / 3, (ymax - ymin) / step);
      }
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(positions, 3));
  g.setAttribute('color', new Float32BufferAttribute(colors, 3));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}
