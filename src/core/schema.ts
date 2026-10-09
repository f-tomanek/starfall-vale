/**
 * Content schemas for everything under /content.
 *
 * This module is pure TypeScript (no Three.js, no DOM) so the same schemas run
 * in the game, in the content validator and in vitest.
 */
import { z } from 'zod';

const Id = z.string().regex(/^[a-z0-9_]+$/, 'ids use lower_snake_case');
const Vec3 = z.tuple([z.number(), z.number(), z.number()]);

// ---------------------------------------------------------------------------
// Conditions and effects
// ---------------------------------------------------------------------------

export type Condition =
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition }
  | { flag: string; equals?: boolean | number }
  | { item: string }
  | { trust: { character: string; gte?: number; lte?: number } }
  | { quest: { id: string; status: QuestStatus } }
  | { objective: { quest: string; id: string } };

export const QuestStatusSchema = z.enum(['locked', 'active', 'completed']);
export type QuestStatus = z.infer<typeof QuestStatusSchema>;

export const ConditionSchema: z.ZodType<Condition> = z.lazy(() =>
  z.union([
    z.object({ all: z.array(ConditionSchema).min(1) }).strict(),
    z.object({ any: z.array(ConditionSchema).min(1) }).strict(),
    z.object({ not: ConditionSchema }).strict(),
    z
      .object({ flag: Id, equals: z.union([z.boolean(), z.number()]).optional() })
      .strict(),
    z.object({ item: Id }).strict(),
    z
      .object({
        trust: z
          .object({ character: Id, gte: z.number().optional(), lte: z.number().optional() })
          .strict(),
      })
      .strict(),
    z.object({ quest: z.object({ id: Id, status: QuestStatusSchema }).strict() }).strict(),
    z.object({ objective: z.object({ quest: Id, id: Id }).strict() }).strict(),
  ]),
);

export const EffectSchema = z.union([
  z.object({ setFlag: Id, value: z.union([z.boolean(), z.number()]).optional() }).strict(),
  z.object({ addTrust: z.object({ character: Id, amount: z.number().int() }).strict() }).strict(),
  z.object({ giveItem: Id }).strict(),
  z.object({ takeItem: Id }).strict(),
  z.object({ startQuest: Id }).strict(),
  z.object({ completeQuest: Id }).strict(),
  /** Allow-listed world event (see world.json "events"). */
  z.object({ emit: Id }).strict(),
  /** Show a tutorial / hint card (string id from strings.*.json). */
  z.object({ hint: Id }).strict(),
]);
export type Effect = z.infer<typeof EffectSchema>;

// ---------------------------------------------------------------------------
// Characters & items
// ---------------------------------------------------------------------------

export const CharacterSchema = z
  .object({
    id: Id,
    name: z.string().min(1),
    title: z.string().default(''),
    /** Procedural look: the builder in src/world/characters.ts reads these. */
    look: z
      .object({
        kind: z.enum(['orb', 'humanoid', 'drone']),
        height: z.number().min(0.3).max(2.5),
        primary: z.string().regex(/^#[0-9a-fA-F]{6}$/),
        secondary: z.string().regex(/^#[0-9a-fA-F]{6}$/),
        accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
        accessories: z.array(z.string()).default([]),
      })
      .strict(),
    /** Voice blip synth settings (no audio files). */
    voice: z
      .object({ pitch: z.number().min(60).max(1200), wave: z.enum(['sine', 'square', 'triangle', 'sawtooth']), speed: z.number().min(0.3).max(3) })
      .strict(),
    trust: z.object({ start: z.number().int(), min: z.number().int(), max: z.number().int() }).strict(),
    /** Short lines said when the player walks past (with a cooldown). */
    ambient: z.array(z.object({ text: z.string().min(1), when: ConditionSchema.optional() }).strict()).default([]),
    dialogue: Id.nullable(),
  })
  .strict();
export type Character = z.infer<typeof CharacterSchema>;

export const ItemSchema = z
  .object({
    id: Id,
    name: z.string().min(1),
    description: z.string().min(1),
    kind: z.enum(['tool', 'part', 'key', 'lore']),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    /** Procedural mesh shape for world pickups. */
    shape: z.enum(['lens', 'spring', 'valve', 'lantern', 'core', 'stone', 'book', 'gear']),
  })
  .strict();
export type Item = z.infer<typeof ItemSchema>;

// ---------------------------------------------------------------------------
// Dialogue
// ---------------------------------------------------------------------------

export const ChoiceSchema = z
  .object({
    text: z.string().min(1).max(80),
    when: ConditionSchema.optional(),
    effects: z.array(EffectSchema).default([]),
    next: z.string().min(1),
  })
  .strict();
export type Choice = z.infer<typeof ChoiceSchema>;

export const DialogueNodeSchema = z
  .object({
    /** Defaults to the dialogue's owner. */
    speaker: Id.optional(),
    text: z.string().min(1).max(180),
    effects: z.array(EffectSchema).default([]),
    next: z.string().optional(),
    choices: z.array(ChoiceSchema).min(2).max(4).optional(),
    end: z.boolean().optional(),
  })
  .strict();
export type DialogueNode = z.infer<typeof DialogueNodeSchema>;

export const DialogueSchema = z
  .object({
    id: Id,
    owner: Id,
    /** Ordered: the first entry whose condition holds starts the conversation. */
    entries: z.array(z.object({ when: ConditionSchema.optional(), start: z.string() }).strict()).min(1),
    nodes: z.record(z.string(), DialogueNodeSchema),
  })
  .strict();
export type Dialogue = z.infer<typeof DialogueSchema>;

/** Node id that ends a conversation when used as `next`. */
export const END = 'END';

// ---------------------------------------------------------------------------
// Quests
// ---------------------------------------------------------------------------

export const ObjectiveSchema = z
  .object({
    id: Id,
    text: z.string().min(1).max(90),
    completeWhen: ConditionSchema,
    /** Waypoint id from world.json; null hides the marker. */
    target: Id.nullable(),
    /** While the player carries `item`, the marker points at waypoint `to` instead. */
    carry: z.object({ item: Id, to: Id }).strict().optional(),
  })
  .strict();
export type Objective = z.infer<typeof ObjectiveSchema>;

export const QuestSchema = z
  .object({
    id: Id,
    title: z.string().min(1),
    kind: z.enum(['main', 'side']),
    act: z.number().int().min(1).max(3),
    description: z.string().min(1),
    /** Auto-start condition; omit to start only via a startQuest effect. */
    startWhen: ConditionSchema.optional(),
    /** Objectives complete in order; each is checked only once the previous ones are done. */
    objectives: z.array(ObjectiveSchema).min(1),
    onComplete: z.array(EffectSchema).default([]),
    /** Present in content but not yet playable (milestone gating). Skipped by the solver. */
    comingSoon: z.boolean().optional(),
  })
  .strict();
export type Quest = z.infer<typeof QuestSchema>;

// ---------------------------------------------------------------------------
// World
// ---------------------------------------------------------------------------

export const PlacementSchema = z
  .object({
    when: ConditionSchema.optional(),
    at: Id,
    /** Optional guide path: the NPC leads the player along it. */
    path: Id.optional(),
  })
  .strict();

export const TriggerSchema = z
  .object({
    id: Id,
    /**
     * area:    player enters radius around waypoint `at`
     * deliver: item `item` is dropped within radius of waypoint `at`
     * pulse:   Pulse Lantern is used within radius of waypoint `at`
     * pickup:  item `item` is picked up for the first time
     */
    kind: z.enum(['area', 'deliver', 'pulse', 'pickup']),
    at: Id.optional(),
    radius: z.number().positive().default(2),
    item: Id.optional(),
    when: ConditionSchema.optional(),
    once: z.boolean().default(true),
    effects: z.array(EffectSchema).min(1),
  })
  .strict();
export type Trigger = z.infer<typeof TriggerSchema>;

export const WorldSchema = z
  .object({
    spawn: z.object({ at: Id, yawDeg: z.number() }).strict(),
    zones: z.array(
      z
        .object({
          id: Id,
          name: z.string(),
          center: Vec3,
          radius: z.number().positive(),
          fog: z.string().regex(/^#[0-9a-fA-F]{6}$/),
        })
        .strict(),
    ),
    waypoints: z.record(Id, Vec3),
    paths: z.record(Id, z.array(Id).min(2)),
    npcs: z.array(z.object({ character: Id, placements: z.array(PlacementSchema).min(1) }).strict()),
    pickups: z.array(z.object({ item: Id, at: Id, when: ConditionSchema.optional() }).strict()),
    triggers: z.array(TriggerSchema),
    /** World events dialogue/triggers may `emit`; the runtime must handle each. */
    events: z.array(Id),
  })
  .strict();
export type WorldDef = z.infer<typeof WorldSchema>;

export const StringsSchema = z.record(z.string(), z.string());

export interface Content {
  world: WorldDef;
  characters: Record<string, Character>;
  items: Record<string, Item>;
  quests: Quest[];
  dialogues: Record<string, Dialogue>;
  strings: Record<string, string>;
}
