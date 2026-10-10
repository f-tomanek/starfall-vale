import { BoxGeometry, CylinderGeometry, type Mesh, type Object3D } from '@iwsdk/core';
import { GeoBuilder } from '../geo.js';
import { heightAt } from '../heightfield.js';

/** What each zone builder returns. */
export interface ZoneBuild {
  id: string;
  /** Hidden when the player is far away (zone streaming). */
  detail: Object3D[];
  /** Always visible: the silhouette you can see from the village. */
  landmark: Object3D[];
  /** Invisible walkable/blocking geometry for the locomotion engine. */
  colliders: Mesh | null;
  triangles: number;
}

export const box = (w: number, h: number, d: number) => new BoxGeometry(w, h, d);

/** Ground-standing collider cylinder (blocks walking). */
export function colCylinder(col: GeoBuilder, x: number, z: number, r: number, h: number, base = heightAt(x, z)): void {
  col.add(new CylinderGeometry(r, r, h, 8), '#000000', { pos: [x, base + h / 2, z] });
}

export function countTriangles(objs: Object3D[]): number {
  let n = 0;
  for (const o of objs) {
    o.traverse((c) => {
      const m = c as Mesh & { count?: number; isInstancedMesh?: boolean };
      if (!m.isMesh) return;
      const g = m.geometry;
      const tris = (g.index ? g.index.count : g.getAttribute('position').count) / 3;
      n += tris * (m.isInstancedMesh ? (m.count ?? 1) : 1);
    });
  }
  return n;
}
