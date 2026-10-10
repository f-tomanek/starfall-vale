import { createComponent, defineComponents, Types } from '@iwsdk/core';

/** A story character placed in the world (id from content/characters.json). */
export const Npc = createComponent('Npc', {
  character: { type: Types.String, default: '' },
});

/** A physical item the player can carry (id from content/items.json). */
export const Pickup = createComponent('Pickup', {
  item: { type: Types.String, default: '' },
  /** Stable key "item@waypoint" so saves remember what was collected. */
  key: { type: Types.String, default: '' },
});

/** Something the player can use (lever, mirror, pylon). Handlers live in rt.usables. */
export const Usable = createComponent('Usable', {
  id: { type: Types.String, default: '' },
});

export default defineComponents([Npc, Pickup, Usable]);
