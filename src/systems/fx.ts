/**
 * Ambient life and markers:
 * - quest waypoint marker (small amber diamond above the current target)
 * - fireflies / drifting motes around the village and path (one draw call)
 * - debug HUD with fps, draw calls and triangles (also on window.__stats)
 */
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Mesh,
  MeshBasicMaterial,
  OctahedronGeometry,
  Points,
  PointsMaterial,
  Vector3,
  createSystem,
} from '@iwsdk/core';
import { TextBillboard } from '../ui/billboard.js';
import { groundAt } from '../world/layout.js';
import { immersive, rt, viewerPosition, waypoint } from '../runtime.js';

const FIREFLIES = 160;

declare global {
  interface Window {
    __stats?: { fps: number; ms: number; calls: number; triangles: number; zone: string; mode: string };
  }
}

export class FxSystem extends createSystem({}) {
  private marker!: Mesh;
  private target = new Vector3();
  private eye = new Vector3();
  private flies!: Points;
  private flyBase!: Float32Array;
  private flyPhase!: Float32Array;
  private hud!: TextBillboard;
  private frames = 0;
  private acc = 0;
  private fps = 0;
  private ms = 0;

  init(): void {
    // Waypoint marker: drawn without fog so it reads through the mist, but small.
    this.marker = new Mesh(new OctahedronGeometry(0.16, 0), new MeshBasicMaterial({ color: '#ffc76b', fog: false, transparent: true, opacity: 0.85 }));
    this.marker.scale.set(1, 1.6, 1);
    this.marker.visible = false;
    this.scene.add(this.marker);

    // Fireflies
    const pos = new Float32Array(FIREFLIES * 3);
    this.flyBase = new Float32Array(FIREFLIES * 3);
    this.flyPhase = new Float32Array(FIREFLIES);
    let seed = 7;
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < FIREFLIES; i++) {
      // Half along the path, half inside/around the village
      const onPath = i % 2 === 0;
      const x = onPath ? (r() - 0.5) * 14 : (r() - 0.5) * 24;
      const z = onPath ? 14 + r() * 50 : 12 - r() * 64;
      this.flyBase.set([x, groundAt(x, z) + 0.6 + r() * 2.2, z], i * 3);
      this.flyPhase[i] = r() * 100;
    }
    pos.set(this.flyBase);
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(pos, 3));
    this.flies = new Points(
      g,
      new PointsMaterial({ map: dotTexture(), color: '#ffd27a', size: 0.09, sizeAttenuation: true, transparent: true, opacity: 0.9, blending: AdditiveBlending, depthWrite: false }),
    );
    this.flies.frustumCulled = false;
    this.scene.add(this.flies);

    // Debug HUD: a developer tool, so it is attached to the camera.
    this.hud = new TextBillboard({ width: 0.5, fontPx: 34, maxLines: 3, background: 'rgba(0,0,0,0.7)', color: '#9ff7ef' });
    this.camera.add(this.hud.mesh);
    this.hud.mesh.position.set(0.0, 0.2, -0.8);
  }

  update(delta: number, time: number): void {
    // ---- stats
    this.frames++;
    this.acc += delta;
    if (this.acc >= 0.5) {
      this.fps = this.frames / this.acc;
      this.ms = (this.acc / this.frames) * 1000;
      this.frames = 0;
      this.acc = 0;
      const info = this.renderer.info.render;
      window.__stats = { fps: Math.round(this.fps), ms: +this.ms.toFixed(1), calls: info.calls, triangles: info.triangles, zone: rt.zone, mode: rt.mode };
      if (rt.settings.debugHud) {
        this.hud.setText(`#${Math.round(this.fps)} fps  ${this.ms.toFixed(1)} ms\ncalls ${info.calls}  tris ${(info.triangles / 1000).toFixed(1)}k\nzone ${rt.zone}${immersive() ? '  XR' : ''}`);
      }
    }
    this.hud.mesh.visible = rt.settings.debugHud;

    // ---- fireflies drift
    const attr = this.flies.geometry.getAttribute('position') as BufferAttribute;
    const arr = attr.array as Float32Array;
    for (let i = 0; i < FIREFLIES; i++) {
      const p = this.flyPhase[i];
      arr[i * 3] = this.flyBase[i * 3] + Math.sin(time * 0.3 + p) * 0.8;
      arr[i * 3 + 1] = this.flyBase[i * 3 + 1] + Math.sin(time * 0.7 + p * 1.3) * 0.25;
      arr[i * 3 + 2] = this.flyBase[i * 3 + 2] + Math.cos(time * 0.25 + p) * 0.8;
    }
    attr.needsUpdate = true;

    // ---- waypoint marker
    const show = rt.mode === 'play' && !rt.ui.menuOpen && this.resolveTarget();
    if (!show) {
      this.marker.visible = false;
      return;
    }
    viewerPosition(this.eye);
    const d = Math.hypot(this.target.x - this.eye.x, this.target.z - this.eye.z);
    this.marker.visible = d > 2.5;
    this.marker.position.set(this.target.x, this.target.y + 1.1 + Math.sin(time * 2) * 0.08, this.target.z);
    // Keep roughly constant apparent size, within limits.
    this.marker.scale.setScalar(Math.min(4, Math.max(1, d / 8)));
    this.marker.scale.y *= 1.6;
    this.marker.rotation.y += delta * 1.5;
  }

  private resolveTarget(): boolean {
    const q = rt.game.trackedQuest();
    if (!q) return false;
    const o = rt.game.currentObjective(q.id);
    if (!o) return false;
    let id = o.target;
    if (o.carry && rt.game.state.inventory.includes(o.carry.item)) id = o.carry.to;
    if (!id) return false;
    // If the target is where a character stands, follow the character instead.
    waypoint(id, this.target);
    return true;
  }
}

/** Soft round dot so points do not render as squares. */
function dotTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.6)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 32);
  return new CanvasTexture(c);
}
