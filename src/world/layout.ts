/**
 * Fixed architecture of Wreckhaven, shared by the mesh builders, the colliders
 * and groundAt(). Story positions (NPCs, items, triggers) live in
 * content/world.json; this file only describes the buildings.
 */
import { heightAt } from './terrain.js';

export const HULL = {
  /** Hull cross-section circle: center height and radius. */
  cy: 3,
  r: 13,
  zSouth: 12,
  zNorth: -52,
};

export const PLATFORM = {
  /** Raised bridge deck the shrine sits on. */
  x0: -7,
  x1: 7,
  z0: -52,
  z1: -38,
  height: 2,
  /** Ramp from the street up to the deck. */
  rampX: 2.2,
  rampZ0: -30,
};

/** Walkable surface height (terrain plus built floors) at XZ. */
export function groundAt(x: number, z: number): number {
  const p = PLATFORM;
  if (x > p.x0 && x < p.x1 && z > p.z0 && z < p.z1) return p.height;
  if (Math.abs(x) < p.rampX && z <= p.rampZ0 && z >= p.z1) {
    return (p.height * (p.rampZ0 - z)) / (p.rampZ0 - p.z1);
  }
  return heightAt(x, z);
}

/** Static obstacles as axis-aligned boxes: [minX, maxX, minZ, maxZ, height]. */
export const SOLIDS: Array<[number, number, number, number, number]> = [
  // Market stalls (west)
  [-7.6, -5.6, -6, -4, 0.9],
  [-7.6, -5.6, -12, -10, 0.9],
  [-7.6, -5.6, -18, -16, 0.9],
  // Workshop bench and shelves (east)
  [9, 10.6, -8, -5, 0.9],
  [10.4, 11.4, -14, -9, 2.2],
  // Pipe crates (west)
  [-9.2, -8, -27, -25, 0.4],
  // Houses
  [-11.5, -7.5, -36, -30, 3],
  [7.5, 11.5, -36, -30, 3],
  [-11.5, -8, -24, -19, 3],
  [8.5, 11.5, -24, -18, 3],
];

/** Where a dropped item comes to rest: the ground or the top of furniture. */
export function surfaceAt(x: number, z: number): number {
  let h = groundAt(x, z);
  for (const [x0, x1, z0, z1, top] of SOLIDS) if (x > x0 && x < x1 && z > z0 && z < z1) h = Math.max(h, top);
  return h;
}
