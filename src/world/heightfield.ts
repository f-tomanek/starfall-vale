/**
 * Pure world math (no Three.js): the height function, roads and the Mist
 * boundary. Shared by mesh builders, runtime systems and unit tests.
 *
 * Coordinates: meters, north is -Z. The valley spans x/z in [-125, 125].
 */

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
export function smoothstep(e0: number, e1: number, x: number): number {
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

function polyDist(x: number, z: number, pts: ReadonlyArray<readonly [number, number]>): number {
  let d = Infinity;
  for (let i = 0; i < pts.length - 1; i++) d = Math.min(d, segDist(x, z, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]));
  return d;
}

// ---------------------------------------------------------------- roads

/** The footpath from the Beacon Ring down to the village gate. */
export const PATH_POINTS: Array<[number, number]> = [
  [0, 56],
  [0.5, 46],
  [-2.5, 35],
  [1, 24],
  [0, 14],
];

/** Roads from the village gate to each zone; the zone id gates them in the Mist. */
export const ROADS: Array<{ zone: string; points: Array<[number, number]> }> = [
  { zone: 'beacon', points: PATH_POINTS },
  { zone: 'glimmerwood', points: [[-3, 16], [-16, 19], [-32, 13], [-46, 3], [-58, -6]] },
  { zone: 'rustdune', points: [[3, 16], [16, 19], [32, 14], [46, 6], [56, 1]] },
  { zone: 'skyreach', points: [[8, 16], [18, 6], [19, -24], [18, -50], [9, -66]] },
];

export function distToPath(x: number, z: number): number {
  return polyDist(x, z, PATH_POINTS);
}

export function distToRoad(x: number, z: number, zone?: string): number {
  let d = Infinity;
  for (const r of ROADS) if (!zone || r.zone === zone) d = Math.min(d, polyDist(x, z, r.points));
  return d;
}

// ------------------------------------------------------------ landmarks

export const GLIMMER = { x: -78, z: -14, grove: [-80, -20] as const, eye: [-95, -4] as const, spire: [-90, -30] as const };
export const RUST = { x: 76, z: 2, camp: [62, -8] as const, engine: [90, 6] as const };
export const LIFT_BASE = [6, -70] as const;

/** Floating islands of Skyreach: top surface height y, radius r. */
export const ISLANDS = [
  { id: 'i1', x: 6, z: -84, y: 26, r: 9 },
  { id: 'i2', x: -16, z: -96, y: 28, r: 7.5 },
  { id: 'i3', x: 24, z: -100, y: 28, r: 7 },
  { id: 'i4', x: 2, z: -110, y: 30, r: 8 },
  { id: 'i5', x: -18, z: -116, y: 32, r: 7.5 },
] as const;

/** Light bridges between islands (ids are referenced from content/world.json). */
export const BRIDGES = [
  { id: 'b12', from: 'i1', to: 'i2' },
  { id: 'b13', from: 'i1', to: 'i3' },
  { id: 'b24', from: 'i2', to: 'i4' },
  { id: 'b34', from: 'i3', to: 'i4' },
  { id: 'b45', from: 'i4', to: 'i5' },
] as const;

export function island(id: string) {
  return ISLANDS.find((i) => i.id === id);
}

/** Bridge endpoints at the island rims and the deck height along it. */
export function bridgeGeometry(id: string) {
  const b = BRIDGES.find((x) => x.id === id);
  if (!b) return null;
  const a = island(b.from)!;
  const c = island(b.to)!;
  const dx = c.x - a.x;
  const dz = c.z - a.z;
  const d = Math.hypot(dx, dz);
  const ux = dx / d;
  const uz = dz / d;
  const start = [a.x + ux * (a.r - 1), a.y, a.z + uz * (a.r - 1)] as const;
  const end = [c.x - ux * (c.r - 1), c.y, c.z - uz * (c.r - 1)] as const;
  return { start, end, length: Math.hypot(end[0] - start[0], end[2] - start[2]), yaw: Math.atan2(ux, uz) };
}

// ------------------------------------------------------------- height

/** Terrain height in meters at world XZ (the valley floor only). */
export function heightAt(x: number, z: number): number {
  // Rolling ground
  let h = (fbm(x * 0.035 + 10, z * 0.035 - 4) - 0.45) * 5;
  // Valley rim rises toward the world edge
  const r = Math.hypot(x, z + 5);
  h += Math.min(24, Math.pow(Math.max(0, r - 100), 1.2) * 0.45);

  // Glimmerwood: softer, higher hills with two flat clearings
  const gw = Math.hypot(x - GLIMMER.x, z - GLIMMER.z);
  if (gw < 46) {
    const k = 1 - smoothstep(30, 46, gw);
    h += k * (fbm(x * 0.08, z * 0.08) - 0.4) * 4;
    const clear = Math.min(
      smoothstep(6, 11, Math.hypot(x - GLIMMER.grove[0], z - GLIMMER.grove[1])),
      smoothstep(6, 11, Math.hypot(x - GLIMMER.eye[0], z - GLIMMER.eye[1])),
    );
    h = h * clear + 0.6 * (1 - clear);
  }

  // Rustdune: wind-shaped dunes, flattened at the camp and around the engine
  const rd = Math.hypot(x - RUST.x, z - RUST.z);
  if (rd < 48) {
    const k = 1 - smoothstep(30, 48, rd);
    const dune = Math.sin(x * 0.16 + Math.sin(z * 0.07) * 2.2) * 1.4 + Math.sin(z * 0.11 + x * 0.05) * 0.8;
    h += k * (dune + 1.2);
    const flat = Math.min(
      smoothstep(7, 12, Math.hypot(x - RUST.camp[0], z - RUST.camp[1])),
      smoothstep(9, 15, Math.hypot(x - RUST.engine[0], z - RUST.engine[1])),
    );
    h = h * flat + 0.8 * (1 - flat);
  }

  // The Beacon Ring sits on a gentle rise in the south
  const beacon = Math.hypot(x, z - 62);
  h += (1 - smoothstep(10, 28, beacon)) * 1.2;
  // Footpath and beacon plaza (descending from 1.2 m to 0 at the gate)
  const target = beacon < 12 ? 1.2 : 1.2 * (1 - smoothstep(14, 56, 62 - z));
  const k = Math.min(smoothstep(2.2, 7, distToPath(x, z)), smoothstep(8, 12, beacon));
  h = target + (h - target) * k;
  // Other roads: smooth out bumps rather than flattening to a fixed height
  let rd2 = Infinity;
  for (const road of ROADS) if (road.zone !== 'beacon') rd2 = Math.min(rd2, polyDist(x, z, road.points));
  const roadK = smoothstep(2.5, 7, rd2);
  h = h * (0.35 + 0.65 * roadK);
  // Lift base plateau
  h *= smoothstep(6, 11, Math.hypot(x - LIFT_BASE[0], z - LIFT_BASE[1]));
  // Flatten the village (hull interior and surroundings) to y = 0
  const hubX = Math.max(0, Math.abs(x) - 16);
  const hubZ = Math.max(0, z - 18, -58 - z);
  return h * smoothstep(0, 10, Math.hypot(hubX, hubZ));
}

// -------------------------------------------------------------- the Mist

export interface ZoneArea {
  id: string;
  center: readonly [number, number, number];
  radius: number;
}

/**
 * Can the player stand here? Inside an open zone, or on a road leading to one.
 * Returns the id of the zone the point is in ("" on a road between zones), or
 * null when the Mist should turn the player back.
 */
export function regionAt(x: number, z: number, zones: readonly ZoneArea[], isOpen: (zone: string) => boolean): string | null {
  let best: string | null = null;
  let bestD = Infinity;
  for (const zn of zones) {
    if (!isOpen(zn.id)) continue;
    const d = Math.hypot(x - zn.center[0], z - zn.center[2]);
    if (d < zn.radius && d < bestD) {
      bestD = d;
      best = zn.id;
    }
  }
  if (best !== null) return best;
  for (const r of ROADS) if (isOpen(r.zone) && polyDist(x, z, r.points) < 7) return '';
  return null;
}
