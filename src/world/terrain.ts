/**
 * The valley floor mesh. The height function itself lives in heightfield.ts
 * (pure math, unit-tested); this file only turns it into colored triangles.
 */
import { BufferGeometry, Color, Float32BufferAttribute } from '@iwsdk/core';
import { GLIMMER, RUST, WORLD_HALF, distToPath, distToRoad, fbm, heightAt } from './heightfield.js';

export { WORLD_HALF, PATH_POINTS, distToPath, fbm, heightAt, noise } from './heightfield.js';

export const TERRAIN_COLORS = {
  grass: '#3e6b5a',
  grassLight: '#5a8a68',
  path: '#8a7a5e',
  rock: '#6d6a66',
  earth: '#5e5648',
  moss: '#2f4f55',
  mossViolet: '#3d3a63',
  sand: '#c8642c',
  sandLight: '#e0894a',
  glass: '#e9b98a',
};

/** Builds the terrain mesh geometry with vertex colors (flat shaded). */
export function buildTerrainGeometry(segments = 100): BufferGeometry {
  const size = WORLD_HALF * 2;
  const step = size / segments;
  const positions: number[] = [];
  const colors: number[] = [];
  const c = new Color();
  const C = Object.fromEntries(Object.entries(TERRAIN_COLORS).map(([k, v]) => [k, new Color(v)])) as Record<keyof typeof TERRAIN_COLORS, Color>;

  // Heights and colors are computed once per grid point; colors blend per vertex
  // so roads and zone edges look smooth while faces stay flat-shaded.
  const n = segments + 1;
  const H = new Float32Array(n * n);
  const RGB = new Float32Array(n * n * 3);
  const gx = (i: number) => -WORLD_HALF + i * step;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) H[j * n + i] = heightAt(gx(i), gx(j));
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = gx(i);
      const z = gx(j);
      const y = H[j * n + i];
      const hx = H[j * n + Math.min(n - 1, i + 1)] - H[j * n + Math.max(0, i - 1)];
      const hz = H[Math.min(n - 1, j + 1) * n + i] - H[Math.max(0, j - 1) * n + i];
      const slope = Math.hypot(hx, hz) / (2 * step);
      c.copy(C.grass).lerp(C.grassLight, fbm(x * 0.15, z * 0.15));
      // Zone tints blend in by distance
      const gw = Math.hypot(x - GLIMMER.x, z - GLIMMER.z);
      if (gw < 44) c.lerp(C.moss, 1 - Math.max(0, (gw - 26) / 18)).lerp(C.mossViolet, fbm(x * 0.2, z * 0.2) * (gw < 34 ? 0.6 : 0.2));
      const rd = Math.hypot(x - RUST.x, z - RUST.z);
      if (rd < 46) {
        c.lerp(C.sand, 1 - Math.max(0, (rd - 28) / 18)).lerp(C.sandLight, fbm(x * 0.3, z * 0.3) * 0.5);
        // Glassy patches where the engine fire melted the sand
        if (rd < 34 && fbm(x * 0.12 + 3, z * 0.12) > 0.62) c.lerp(C.glass, 0.7);
      }
      const pd = Math.min(distToPath(x, z), distToRoad(x, z));
      if (pd < 2.4 || Math.hypot(x, z - 62) < 9) c.lerp(C.path, 0.8);
      // Packed earth inside the Meridian's hull
      if (Math.abs(x) < 12.8 && z < 12.5 && z > -52.5) c.copy(C.earth);
      if (slope > 0.45 || y > 9) c.lerp(C.rock, Math.min(1, (slope - 0.3) * 2 + Math.max(0, y - 9) * 0.1));
      RGB.set([c.r, c.g, c.b], (j * n + i) * 3);
    }
  }
  const vert = (i: number, j: number) => {
    const k = j * n + i;
    positions.push(gx(i), H[k], gx(j));
    colors.push(RGB[k * 3], RGB[k * 3 + 1], RGB[k * 3 + 2]);
  };
  for (let j = 0; j < segments; j++) {
    for (let i = 0; i < segments; i++) {
      // Two triangles, counter-clockwise when seen from above.
      vert(i, j);
      vert(i, j + 1);
      vert(i + 1, j);
      vert(i + 1, j);
      vert(i, j + 1);
      vert(i + 1, j + 1);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(positions, 3));
  g.setAttribute('color', new Float32BufferAttribute(colors, 3));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}
