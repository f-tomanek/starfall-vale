/**
 * Tiny procedural-geometry toolkit: bake vertex colors into primitives and merge
 * many of them into one flat-shaded mesh (one draw call per material).
 */
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Euler,
  Float32BufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  Quaternion,
  Vector3,
  type Material,
} from '@iwsdk/core';

const _c = new Color();
const _m = new Matrix4();
const _q = new Quaternion();
const _e = new Euler();
const _s = new Vector3();
const _p = new Vector3();

/** Deterministic PRNG so the world looks the same on every load. */
export function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

export interface Place {
  pos?: [number, number, number];
  rot?: [number, number, number];
  scale?: number | [number, number, number];
}

export function placeMatrix(p: Place, out = new Matrix4()): Matrix4 {
  _p.set(...(p.pos ?? [0, 0, 0]));
  _q.setFromEuler(_e.set(...(p.rot ?? [0, 0, 0])));
  const sc = p.scale ?? 1;
  if (typeof sc === 'number') _s.set(sc, sc, sc);
  else _s.set(...sc);
  return out.compose(_p, _q, _s);
}

/** Accumulates colored, transformed, non-indexed triangles. */
export class GeoBuilder {
  private positions: number[] = [];
  private colors: number[] = [];

  get triangleCount(): number {
    return this.positions.length / 9;
  }

  /**
   * Add a geometry. `color` may be a hex string or a function that gets the
   * world-space vertex and returns a color (used for gradients / fake AO).
   */
  add(geo: BufferGeometry, color: string | ((p: Vector3) => string | Color), place: Place | Matrix4 = {}): this {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const pos = g.getAttribute('position');
    const m = place instanceof Matrix4 ? place : placeMatrix(place, _m);
    const fixed = typeof color === 'string' ? _c.set(color).clone() : null;
    const v = new Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m);
      this.positions.push(v.x, v.y, v.z);
      const c = fixed ?? (() => {
        const r = (color as (p: Vector3) => string | Color)(v);
        return typeof r === 'string' ? _c.set(r) : r;
      })();
      this.colors.push(c.r, c.g, c.b);
    }
    if (g !== geo) g.dispose();
    geo.dispose();
    return this;
  }

  /** Add raw triangles (already in world space). */
  addTriangles(verts: number[], color: string): this {
    _c.set(color);
    for (let i = 0; i < verts.length; i += 3) {
      this.positions.push(verts[i], verts[i + 1], verts[i + 2]);
      this.colors.push(_c.r, _c.g, _c.b);
    }
    return this;
  }

  build(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(this.positions, 3));
    g.setAttribute('color', new Float32BufferAttribute(this.colors, 3));
    g.computeVertexNormals(); // non-indexed => flat normals
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

/** Shared materials: keep the material count tiny for batching. */
export const Materials = {
  lit: new MeshLambertMaterial({ vertexColors: true }),
  litDouble: new MeshLambertMaterial({ vertexColors: true, side: DoubleSide }),
  glow: new MeshBasicMaterial({ vertexColors: true }),
  glowDouble: new MeshBasicMaterial({ vertexColors: true, side: DoubleSide }),
  /** Invisible collision proxies for the locomotion engine. */
  collider: new MeshBasicMaterial({ visible: false }),
};

export function meshFrom(builder: GeoBuilder, material: Material, name: string): Mesh {
  const mesh = new Mesh(builder.build(), material);
  mesh.name = name;
  mesh.matrixAutoUpdate = false;
  mesh.updateMatrix();
  return mesh;
}

/**
 * One draw call for many copies of the same prototype. `tints` multiply the
 * prototype's vertex colors per instance.
 */
export function instanced(proto: GeoBuilder, material: Material, places: Place[], name: string, tints?: string[]): InstancedMesh {
  const mesh = new InstancedMesh(proto.build(), material, places.length);
  const m = new Matrix4();
  places.forEach((p, i) => {
    mesh.setMatrixAt(i, placeMatrix(p, m));
    if (tints) mesh.setColorAt(i, _c.set(tints[i % tints.length]));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
  mesh.name = name;
  return mesh;
}

/** Multiply every vertex color of a geometry (used for fake ambient occlusion). */
export function shade(geo: BufferGeometry, fn: (y: number) => number): void {
  const pos = geo.getAttribute('position') as BufferAttribute;
  const col = geo.getAttribute('color') as BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const k = fn(pos.getY(i));
    col.setXYZ(i, col.getX(i) * k, col.getY(i) * k, col.getZ(i) * k);
  }
  col.needsUpdate = true;
}

export function lerpColor(a: string, b: string, t: number): Color {
  return new Color(a).lerp(new Color(b), Math.min(1, Math.max(0, t)));
}
