/**
 * Small non-interactive world-space text (nameplates, speech bubbles, prompts,
 * toasts) rendered to a canvas texture. Interactive panels use UIKitML instead.
 */
import { CanvasTexture, LinearFilter, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace, Vector3, type Object3D } from '@iwsdk/core';

export interface BillboardStyle {
  /** World width of the plane in meters. */
  width: number;
  /** Canvas pixels per meter (text sharpness). */
  ppm?: number;
  fontPx?: number;
  color?: string;
  background?: string;
  accent?: string;
  maxLines?: number;
}

const _v = new Vector3();

export class TextBillboard {
  readonly mesh: Mesh;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private texture: CanvasTexture;
  private text = '';
  private style: Required<BillboardStyle>;

  constructor(style: BillboardStyle) {
    this.style = {
      ppm: 900,
      fontPx: 44,
      color: '#f4f1e8',
      background: 'rgba(14, 22, 30, 0.86)',
      accent: '#ffb347',
      maxLines: 3,
      ...style,
    };
    const w = Math.round(this.style.width * this.style.ppm);
    const lineH = Math.round(this.style.fontPx * 1.3);
    const h = lineH * this.style.maxLines + Math.round(this.style.fontPx * 0.9);
    this.canvas = document.createElement('canvas');
    this.canvas.width = nextPow2(w);
    this.canvas.height = nextPow2(h);
    this.ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D;
    this.texture = new CanvasTexture(this.canvas);
    this.texture.colorSpace = SRGBColorSpace;
    this.texture.minFilter = LinearFilter;
    this.texture.generateMipmaps = false;
    const aspect = this.canvas.height / this.canvas.width;
    const mat = new MeshBasicMaterial({ map: this.texture, transparent: true, depthWrite: false, fog: false });
    this.mesh = new Mesh(new PlaneGeometry(this.style.width, this.style.width * aspect), mat);
    this.mesh.renderOrder = 10;
    this.mesh.visible = false;
  }

  /** Lines starting with "#" are drawn in the accent color (titles). */
  setText(text: string): void {
    if (text === this.text) return;
    this.text = text;
    const { ctx, canvas, style } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!text) {
      this.texture.needsUpdate = true;
      return;
    }
    ctx.font = `600 ${style.fontPx}px system-ui, "Segoe UI", Roboto, sans-serif`;
    const pad = style.fontPx * 0.6;
    const maxW = canvas.width - pad * 2;
    const lines: Array<{ text: string; accent: boolean }> = [];
    for (const para of text.split('\n')) {
      const accent = para.startsWith('#');
      const words = (accent ? para.slice(1) : para).split(' ');
      let line = '';
      for (const word of words) {
        const test = line ? `${line} ${word}` : word;
        if (ctx.measureText(test).width > maxW && line) {
          lines.push({ text: line, accent });
          line = word;
        } else line = test;
      }
      lines.push({ text: line, accent });
    }
    const shown = lines.slice(0, style.maxLines);
    const lineH = style.fontPx * 1.3;
    const boxW = Math.min(canvas.width, Math.max(...shown.map((l) => ctx.measureText(l.text).width)) + pad * 2);
    const boxH = shown.length * lineH + pad;
    const x0 = (canvas.width - boxW) / 2;
    const y0 = (canvas.height - boxH) / 2;
    ctx.fillStyle = style.background;
    roundRect(ctx, x0, y0, boxW, boxH, style.fontPx * 0.4);
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    shown.forEach((l, i) => {
      ctx.fillStyle = l.accent ? style.accent : style.color;
      ctx.fillText(l.text, canvas.width / 2, y0 + pad / 2 + lineH * (i + 0.5));
    });
    this.texture.needsUpdate = true;
  }

  /** Yaw toward the viewer (stays upright). Billboards live directly under the scene. */
  face(viewer: Object3D): void {
    viewer.getWorldPosition(_v);
    const p = this.mesh.position;
    this.mesh.rotation.set(0, Math.atan2(_v.x - p.x, _v.z - p.z), 0);
  }

  dispose(): void {
    this.texture.dispose();
    (this.mesh.material as MeshBasicMaterial).dispose();
    this.mesh.geometry.dispose();
  }
}

function nextPow2(n: number): number {
  return 2 ** Math.ceil(Math.log2(Math.max(2, n)));
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
