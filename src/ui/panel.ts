/**
 * Helper around a code-owned UIKitML panel: instantiate from the manifest,
 * show/hide (also toggling ray interaction), and typed element access.
 */
import { RayInteractable, type Entity, type UIKit, type UIKitMLAsset, type World } from '@iwsdk/core';

type Element = ReturnType<UIKitMLAsset['requireElementById']>;

export class Panel {
  private constructor(
    readonly entity: Entity,
    readonly doc: UIKitMLAsset,
  ) {}

  static async create(world: World, assetId: string, name: string): Promise<Panel> {
    const doc = await world.assets.instantiate<UIKitMLAsset>(assetId);
    doc.name = name;
    const entity = world.createTransformEntity(doc, { persistent: true });
    const p = new Panel(entity, doc);
    p.hide();
    return p;
  }

  get visible(): boolean {
    return this.doc.visible;
  }

  show(): void {
    this.doc.visible = true;
    if (!this.entity.hasComponent(RayInteractable)) this.entity.addComponent(RayInteractable);
  }

  hide(): void {
    this.doc.visible = false;
    if (this.entity.hasComponent(RayInteractable)) this.entity.removeComponent(RayInteractable);
  }

  el(id: string): Element {
    const e = this.doc.requireElementById<UIKit.Text>(id);
    e.name = id;
    return e;
  }

  text(id: string, text: string): void {
    this.el(id).setProperties({ text });
  }

  display(id: string, shown: boolean): void {
    this.el(id).setProperties({ display: shown ? 'flex' : 'none' });
  }

  /** Register a click handler; returns the cleanup function. */
  onClick(id: string, fn: () => void): () => void {
    const e = this.el(id);
    e.addEventListener('click', fn);
    return () => e.removeEventListener('click', fn);
  }
}
