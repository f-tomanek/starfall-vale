/**
 * Procedural character and item models, built from content/characters.json
 * and content/items.json "look" / "shape" fields.
 */
import {
  BoxGeometry,
  CatmullRomCurve3,
  ConeGeometry,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  OctahedronGeometry,
  PlaneGeometry,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector3,
  type Object3D,
} from '@iwsdk/core';
import type { Character, Item } from '../core/schema.js';
import { GeoBuilder, Materials, meshFrom } from './geo.js';

export interface CharacterModel {
  root: Group;
  /** Turns toward the player independently of the body. */
  head: Object3D;
  /** Spinning parts (Warden rings, Kip's propeller). */
  spinners: Object3D[];
  /** Height of the top of the head, for nameplates. */
  top: number;
}

const SKIN = ['#e0b48c', '#c68e64', '#8d5a3b', '#f0c9a4'];

export function buildCharacter(c: Character): CharacterModel {
  if (c.look.kind === 'orb') return buildOrb(c);
  if (c.look.kind === 'drone') return buildDrone(c);
  return buildHumanoid(c);
}

function buildHumanoid(c: Character): CharacterModel {
  const H = c.look.height;
  const s = H / 1.7;
  const { primary, secondary, accent, accessories } = c.look;
  const skin = SKIN[[...c.id].reduce((a, ch) => a + ch.charCodeAt(0), 0) % SKIN.length];
  const body = new GeoBuilder();
  const head = new GeoBuilder();
  const glow = new GeoBuilder();
  const has = (a: string) => accessories.includes(a);

  // Robe / legs and torso
  body.add(new CylinderGeometry(0.17 * s, 0.3 * s, 0.62 * H, 8), has('coat') ? secondary : primary, { pos: [0, 0.31 * H, 0] });
  body.add(new CylinderGeometry(0.15 * s, 0.18 * s, 0.24 * H, 8), primary, { pos: [0, 0.72 * H, 0] });
  body.add(new BoxGeometry(0.11 * s, 0.06 * s, 0.14 * s), '#2f2a26', { pos: [-0.08 * s, 0.03, 0.05 * s] });
  body.add(new BoxGeometry(0.11 * s, 0.06 * s, 0.14 * s), '#2f2a26', { pos: [0.08 * s, 0.03, 0.05 * s] });
  // Arms
  for (const sx of [-1, 1]) {
    const mech = has('arm') && sx > 0;
    body.add(new CylinderGeometry(0.045 * s, 0.05 * s, 0.36 * H, 6), mech ? '#9aa3a8' : primary, {
      pos: [sx * 0.2 * s, 0.66 * H, 0.02],
      rot: [0.15, 0, sx * 0.12],
    });
    body.add(new SphereGeometry(0.05 * s, 6, 4), mech ? '#c9cfd2' : skin, { pos: [sx * 0.23 * s, 0.47 * H, 0.06 * s] });
  }
  if (has('coat')) body.add(new CylinderGeometry(0.2 * s, 0.34 * s, 0.7 * H, 8, 1, true), primary, { pos: [0, 0.4 * H, -0.02] });
  if (has('cloak')) body.add(new ConeGeometry(0.34 * s, 0.85 * H, 8, 1, true), secondary, { pos: [0, 0.45 * H, -0.04] });
  if (has('scarf')) body.add(new TorusGeometry(0.15 * s, 0.045 * s, 5, 10), accent, { pos: [0, 0.83 * H, 0], rot: [Math.PI / 2, 0, 0] });
  if (has('wings')) {
    for (const sx of [-1, 1]) {
      body.add(new PlaneGeometry(0.5 * s, 0.3 * s), accent, { pos: [sx * 0.3 * s, 0.75 * H, -0.2 * s], rot: [0.2, sx * 0.5, sx * 0.4] });
    }
  }
  if (has('staff')) {
    body.add(new CylinderGeometry(0.025, 0.03, H * 1.05, 5), '#5a4030', { pos: [0.32 * s, H * 0.52, 0.1 * s] });
    glow.add(new OctahedronGeometry(0.07, 0), accent, { pos: [0.32 * s, H * 1.07, 0.1 * s] });
  }

  // Head (local to the head pivot at neck height)
  const r = 0.11 * H;
  head.add(new IcosahedronGeometry(r, 1), skin, { pos: [0, r, 0] });
  for (const sx of [-1, 1]) head.add(new BoxGeometry(0.03 * s, 0.04 * s, 0.01), '#1b1b1b', { pos: [sx * 0.04 * s, r * 1.1, r * 0.95] });
  head.add(new ConeGeometry(0.02 * s, 0.05 * s, 4), skin, { pos: [0, r * 0.9, r * 1.02], rot: [Math.PI / 2, 0, 0] });
  head.add(new SphereGeometry(r * 1.02, 8, 4, 0, Math.PI * 2, 0, Math.PI * 0.45), secondary === '#8e5cff' ? '#d8d8d8' : '#3b2a20', {
    pos: [0, r * 1.05, -0.01],
  });
  if (has('goggles')) {
    head.add(new BoxGeometry(r * 2.1, 0.035 * s, r * 2.1), '#3a2a1c', { pos: [0, r * 1.35, 0] });
    for (const sx of [-1, 1]) head.add(new CylinderGeometry(0.035 * s, 0.035 * s, 0.03, 8), accent, { pos: [sx * 0.045 * s, r * 1.38, r * 0.95], rot: [Math.PI / 2, 0, 0] });
  }
  if (has('hat')) {
    head.add(new CylinderGeometry(r * 2, r * 2, 0.02, 10), secondary, { pos: [0, r * 1.75, 0] });
    head.add(new ConeGeometry(r * 0.9, r * 1.2, 8), secondary, { pos: [0, r * 2.3, 0] });
  }
  if (has('beard')) head.add(new ConeGeometry(r * 0.7, r * 1.6, 6), '#d9d4c7', { pos: [0, r * 0.05, r * 0.45], rot: [Math.PI + 0.25, 0, 0] });

  const root = new Group();
  root.name = `NPC:${c.id}`;
  const bodyMesh = meshFrom(body, Materials.litDouble, `${c.id}-body`);
  root.add(bodyMesh);
  if (glow.triangleCount) root.add(meshFrom(glow, Materials.glow, `${c.id}-glow`));
  const headPivot = new Group();
  headPivot.position.y = 0.84 * H;
  headPivot.add(meshFrom(head, Materials.lit, `${c.id}-head`));
  root.add(headPivot);
  return { root, head: headPivot, spinners: [], top: H + 0.1 };
}

/** Shared translucent material for holograms (Warden shell). */
const holoMaterial = new MeshBasicMaterial({ color: '#5ff0e0', transparent: true, opacity: 0.35, depthWrite: false });

function buildOrb(c: Character): CharacterModel {
  const R = c.look.height / 2;
  const root = new Group();
  root.name = `NPC:${c.id}`;
  const head = new Group();
  root.add(head);
  const core = new GeoBuilder();
  core.add(new IcosahedronGeometry(R * 0.55, 1), c.look.accent);
  // The "eye": a darker band facing forward
  core.add(new TorusGeometry(R * 0.32, R * 0.06, 4, 16), c.look.secondary, { pos: [0, 0, R * 0.5] });
  head.add(meshFrom(core, Materials.glow, `${c.id}-core`));
  const shell = new Mesh(new IcosahedronGeometry(R, 1), holoMaterial.clone());
  (shell.material as MeshBasicMaterial).color.set(c.look.primary);
  head.add(shell);
  const spinners: Object3D[] = [];
  for (let k = 0; k < 2; k++) {
    const ringGeo = new GeoBuilder();
    ringGeo.add(new TorusGeometry(R * (1.35 + k * 0.25), R * 0.05, 4, 24, Math.PI * 1.4), k ? c.look.primary : c.look.accent);
    const ring = meshFrom(ringGeo, Materials.glow, `${c.id}-ring${k}`);
    ring.matrixAutoUpdate = true;
    ring.rotation.x = k ? 1.1 : -0.4;
    root.add(ring);
    spinners.push(ring);
  }
  return { root, head, spinners, top: R * 1.8 };
}

function buildDrone(c: Character): CharacterModel {
  const R = c.look.height / 2;
  const root = new Group();
  root.name = `NPC:${c.id}`;
  const head = new Group();
  root.add(head);
  const b = new GeoBuilder();
  b.add(new SphereGeometry(R, 10, 8), c.look.primary);
  b.add(new CylinderGeometry(R * 1.05, R * 1.05, R * 0.25, 12), c.look.secondary);
  b.add(new CylinderGeometry(0.008, 0.008, R * 1.2, 4), '#555555', { pos: [0, R * 1.5, 0] });
  head.add(meshFrom(b, Materials.lit, `${c.id}-body`));
  const e = new GeoBuilder();
  e.add(new SphereGeometry(R * 0.38, 10, 8), c.look.accent, { pos: [0, R * 0.1, R * 0.75] });
  e.add(new SphereGeometry(R * 0.1, 6, 4), c.look.accent, { pos: [0, R * 2.1, 0] });
  head.add(meshFrom(e, Materials.glow, `${c.id}-eye`));
  return { root, head, spinners: [], top: R * 2.6 };
}

// ---------------------------------------------------------------- items

export function buildItem(item: Item): Group {
  const lit = new GeoBuilder();
  const glow = new GeoBuilder();
  const c = item.color;
  switch (item.shape) {
    case 'lens':
      lit.add(new TorusGeometry(0.08, 0.018, 6, 16), '#8b7355');
      glow.add(new CylinderGeometry(0.075, 0.075, 0.012, 16), c, { rot: [Math.PI / 2, 0, 0] });
      break;
    case 'spring': {
      const pts: Vector3[] = [];
      for (let i = 0; i <= 48; i++) {
        const a = (i / 48) * Math.PI * 2 * 5;
        pts.push(new Vector3(Math.cos(a) * 0.05, -0.09 + (i / 48) * 0.18, Math.sin(a) * 0.05));
      }
      lit.add(new TubeGeometry(new CatmullRomCurve3(pts), 60, 0.009, 4), c);
      break;
    }
    case 'valve':
      lit.add(new TorusGeometry(0.1, 0.018, 6, 16), c);
      for (let k = 0; k < 3; k++) lit.add(new BoxGeometry(0.2, 0.016, 0.016), c, { rot: [0, 0, (k * Math.PI) / 3] });
      lit.add(new CylinderGeometry(0.03, 0.03, 0.06, 8), '#7a6a50', { rot: [Math.PI / 2, 0, 0] });
      break;
    case 'lantern':
      lit.add(new CylinderGeometry(0.06, 0.07, 0.02, 8), '#5a3a22', { pos: [0, -0.09, 0] });
      lit.add(new CylinderGeometry(0.04, 0.06, 0.03, 8), '#5a3a22', { pos: [0, 0.09, 0] });
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2;
        lit.add(new CylinderGeometry(0.006, 0.006, 0.17, 4), '#5a3a22', { pos: [Math.cos(a) * 0.055, 0, Math.sin(a) * 0.055] });
      }
      lit.add(new TorusGeometry(0.035, 0.006, 4, 10, Math.PI), '#5a3a22', { pos: [0, 0.11, 0] });
      glow.add(new IcosahedronGeometry(0.045, 0), c);
      break;
    case 'core':
      glow.add(new OctahedronGeometry(0.09, 0), c);
      lit.add(new TorusGeometry(0.11, 0.008, 4, 16), '#d0d0d0', { rot: [Math.PI / 2, 0, 0] });
      break;
    case 'stone':
      lit.add(new IcosahedronGeometry(0.08, 0), '#6b6a70');
      glow.add(new BoxGeometry(0.1, 0.01, 0.01), c, { pos: [0, 0, 0.075] });
      break;
    case 'book':
      lit.add(new BoxGeometry(0.16, 0.04, 0.22), c);
      lit.add(new BoxGeometry(0.15, 0.03, 0.21), '#efe6d0', { pos: [0.01, 0, 0] });
      break;
    case 'gear':
      lit.add(new CylinderGeometry(0.08, 0.08, 0.03, 10), c, { rot: [Math.PI / 2, 0, 0] });
      break;
  }
  const g = new Group();
  g.name = `Item:${item.id}`;
  if (lit.triangleCount) g.add(meshFrom(lit, Materials.lit, `${item.id}-lit`));
  if (glow.triangleCount) g.add(meshFrom(glow, Materials.glow, `${item.id}-glow`));
  return g;
}
