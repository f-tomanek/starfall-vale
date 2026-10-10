/**
 * Cheap ambient particles: one Points draw call per emitter, positions
 * animated on the CPU (a few hundred floats per frame).
 */
import { AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, NormalBlending, Points, PointsMaterial } from '@iwsdk/core';
import { rng } from './geo.js';

export interface EmitterDef {
  name: string;
  count: number;
  /** Spawn volume: center and half-extents. */
  center: [number, number, number];
  extent: [number, number, number];
  color: string;
  size: number;
  /** drift: wander in place; rise: float upward and respawn (smoke, embers); blow: stream sideways (dust). */
  motion: 'drift' | 'rise' | 'blow';
  speed: number;
  additive?: boolean;
  opacity?: number;
}

let dot: CanvasTexture | null = null;
function dotTexture(): CanvasTexture {
  if (dot) return dot;
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.6)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 32);
  dot = new CanvasTexture(c);
  return dot;
}

export class Emitter {
  readonly points: Points;
  private base: Float32Array;
  private phase: Float32Array;

  constructor(readonly def: EmitterDef) {
    const rand = rng(def.name.length * 97 + def.count);
    this.base = new Float32Array(def.count * 3);
    this.phase = new Float32Array(def.count);
    for (let i = 0; i < def.count; i++) {
      for (let a = 0; a < 3; a++) this.base[i * 3 + a] = def.center[a] + (rand() * 2 - 1) * def.extent[a];
      this.phase[i] = rand();
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(this.base), 3));
    this.points = new Points(
      g,
      new PointsMaterial({
        map: dotTexture(),
        color: def.color,
        size: def.size,
        sizeAttenuation: true,
        transparent: true,
        opacity: def.opacity ?? 0.85,
        depthWrite: false,
        blending: def.additive === false ? NormalBlending : AdditiveBlending,
      }),
    );
    this.points.name = `Particles:${def.name}`;
    this.points.frustumCulled = false;
  }

  update(time: number): void {
    const { def, base, phase } = this;
    const attr = this.points.geometry.getAttribute('position') as BufferAttribute;
    const arr = attr.array as Float32Array;
    const s = def.speed;
    for (let i = 0; i < def.count; i++) {
      const p = phase[i] * 100;
      const j = i * 3;
      if (def.motion === 'drift') {
        arr[j] = base[j] + Math.sin(time * 0.3 * s + p) * 0.8;
        arr[j + 1] = base[j + 1] + Math.sin(time * 0.7 * s + p * 1.3) * 0.3;
        arr[j + 2] = base[j + 2] + Math.cos(time * 0.25 * s + p) * 0.8;
      } else if (def.motion === 'rise') {
        // Loop each particle from the bottom to the top of the volume.
        const t = (time * s * 0.05 + phase[i]) % 1;
        arr[j] = base[j] + Math.sin(t * 6 + p) * def.extent[0] * 0.4 * t;
        arr[j + 1] = def.center[1] - def.extent[1] + t * def.extent[1] * 2;
        arr[j + 2] = base[j + 2] + Math.cos(t * 5 + p) * def.extent[2] * 0.4 * t;
      } else {
        const t = (time * s * 0.04 + phase[i]) % 1;
        arr[j] = def.center[0] - def.extent[0] + t * def.extent[0] * 2;
        arr[j + 1] = base[j + 1] + Math.sin(time + p) * 0.2;
        arr[j + 2] = base[j + 2] + Math.sin(t * 4 + p) * 1.5;
      }
    }
    attr.needsUpdate = true;
  }
}
