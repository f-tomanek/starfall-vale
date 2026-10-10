/**
 * Ambient sky life: drifting clouds (one merged mesh) and bird flocks
 * (one instanced mesh animated on the CPU, ~40 matrices per frame).
 */
import {
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  MeshLambertMaterial,
  Quaternion,
  Vector3,
  type Mesh,
} from '@iwsdk/core';
import { GeoBuilder, meshFrom, rng } from './geo.js';

export function buildClouds(): Mesh {
  const rand = rng(31);
  const g = new GeoBuilder();
  for (let k = 0; k < 26; k++) {
    const a = rand() * Math.PI * 2;
    const r = 40 + rand() * 75;
    const x = Math.cos(a) * r;
    const z = -10 + Math.sin(a) * r;
    const y = 30 + rand() * 30;
    const n = 3 + Math.floor(rand() * 4);
    for (let i = 0; i < n; i++) {
      g.add(new IcosahedronGeometry(2.5 + rand() * 3, 0), rand() < 0.5 ? '#e8f4f2' : '#cfe3e6', {
        pos: [x + (i - n / 2) * 3.2, y + rand() * 1.5, z + (rand() - 0.5) * 3],
        scale: [1.4, 0.55, 1],
      });
    }
  }
  const mat = new MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.85, emissive: '#5a7f88', emissiveIntensity: 0.6 });
  const mesh = meshFrom(g, mat, 'Clouds');
  mesh.matrixAutoUpdate = true;
  return mesh;
}

export interface Flock {
  center: Vector3;
  radius: number;
  height: number;
  speed: number;
  count: number;
}

export const FLOCKS: Flock[] = [
  { center: new Vector3(0, 24, -20), radius: 22, height: 3, speed: 0.22, count: 9 },
  { center: new Vector3(-78, 20, -14), radius: 18, height: 2, speed: -0.18, count: 7 },
  { center: new Vector3(76, 26, 2), radius: 26, height: 4, speed: 0.15, count: 8 },
  { center: new Vector3(2, 44, -100), radius: 30, height: 5, speed: -0.12, count: 10 },
  { center: new Vector3(0, 16, 50), radius: 14, height: 2, speed: 0.25, count: 6 },
];

/** A tiny V-shaped bird: two wing triangles (flapping is done by scaling Y). */
function birdGeometry(): BufferGeometry {
  const v = [
    0, 0, 0.18, -0.45, 0.08, -0.05, 0, 0, -0.12,
    0, 0, 0.18, 0, 0, -0.12, 0.45, 0.08, -0.05,
  ];
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
}

export class Birds {
  readonly mesh: InstancedMesh;
  private m = new Matrix4();
  private q = new Quaternion();
  private p = new Vector3();
  private s = new Vector3();
  private up = new Vector3(0, 1, 0);
  private phases: number[] = [];

  constructor() {
    const total = FLOCKS.reduce((n, f) => n + f.count, 0);
    this.mesh = new InstancedMesh(birdGeometry(), new MeshBasicMaterial({ color: '#2a3036', side: DoubleSide }), total);
    this.mesh.name = 'Birds';
    this.mesh.frustumCulled = false;
    const rand = rng(5);
    for (let i = 0; i < total; i++) this.phases.push(rand() * Math.PI * 2);
  }

  update(time: number): void {
    let i = 0;
    for (const f of FLOCKS) {
      for (let k = 0; k < f.count; k++, i++) {
        const ph = this.phases[i];
        const a = time * f.speed + (k / f.count) * Math.PI * 2 + Math.sin(time * 0.3 + ph) * 0.15;
        const r = f.radius + Math.sin(ph * 3 + time * 0.2) * 3;
        this.p.set(f.center.x + Math.cos(a) * r, f.center.y + Math.sin(time * 0.5 + ph) * f.height, f.center.z + Math.sin(a) * r);
        // Face along the circle
        const heading = f.speed > 0 ? -a : Math.PI - a;
        this.q.setFromAxisAngle(this.up, heading);
        const flap = 0.4 + Math.abs(Math.sin(time * 9 + ph)) * 1.4;
        this.s.set(1.2, flap, 1.2);
        this.m.compose(this.p, this.q, this.s);
        this.mesh.setMatrixAt(i, this.m);
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
