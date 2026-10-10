import { describe, expect, it } from 'vitest';
import { countTriangles } from '../src/world/zones/common.js';
import { buildGlimmerwood } from '../src/world/zones/glimmerwood.js';
import { buildRustdune } from '../src/world/zones/rustdune.js';
import { buildSkyreach } from '../src/world/zones/skyreach.js';

/** Static performance budget per zone (the whole game: 150 calls / 500k triangles). */
describe('zone builds stay within budget', () => {
  for (const [name, build] of [
    ['glimmerwood', buildGlimmerwood],
    ['rustdune', buildRustdune],
    ['skyreach', buildSkyreach],
  ] as const) {
    it(name, () => {
      const z = build();
      const meshes = [...z.detail, ...z.landmark];
      const calls = meshes.length;
      const tris = countTriangles(meshes);
      console.info(`${name}: ${calls} draw calls, ${Math.round(tris / 1000)}k triangles`);
      expect(calls).toBeLessThanOrEqual(12);
      expect(tris).toBeLessThan(60000);
      expect(z.colliders).not.toBeNull();
    });
  }
});
