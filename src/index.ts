/**
 * Starfall Vale entry point: validate /content, build the procedural world,
 * create the IWSDK world and register the game systems.
 */
import {
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  LocomotionEnvironment,
  Vector3,
  VisibilityState,
  World,
} from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { AudioEngine } from './audio/audio.js';
import { ContentError, parseContent } from './core/content.js';
import { Game } from './core/game.js';
import { loadSettings, safeStore } from './core/save.js';
import { validateReferences } from './core/validate.js';
import { applySettings, rt, waypoint } from './runtime.js';
import { groundAt } from './world/layout.js';
import { DialogueSystem } from './systems/dialogue.js';
import { FxSystem } from './systems/fx.js';
import { InteractionSystem } from './systems/interaction.js';
import { MenuSystem } from './systems/menu.js';
import { NpcSystem } from './systems/npc.js';
import { PlayerSystem } from './systems/player.js';
import { ZoneSystem } from './systems/zones.js';
import { buildVillage } from './world/village.js';

function showFatal(title: string, lines: string[]): void {
  const el = document.createElement('pre');
  el.style.cssText =
    'position:fixed;inset:0;margin:0;padding:24px;overflow:auto;background:#10161c;color:#ffd27a;font:14px/1.5 ui-monospace,monospace;white-space:pre-wrap;z-index:99';
  el.textContent = `${title}\n\n${lines.map((l) => `- ${l}`).join('\n')}`;
  document.body.appendChild(el);
}

function loadContent() {
  // All story data is plain JSON under /content (bundled at build time).
  const raw = import.meta.glob('../content/**/*.json', { eager: true, import: 'default' });
  const files: Record<string, unknown> = {};
  for (const [path, json] of Object.entries(raw)) files[path.replace('../content/', '')] = json;
  const content = parseContent(files);
  const report = validateReferences(content);
  if (report.errors.length) throw new ContentError(report.errors);
  for (const w of report.warnings) console.warn('[content]', w);
  return content;
}

async function main(): Promise<void> {
  let content;
  try {
    content = loadContent();
  } catch (err) {
    const lines = err instanceof ContentError ? err.problems : [String(err)];
    showFatal('Starfall Vale could not start: the story files in /content have problems.', lines);
    throw err;
  }

  const store = safeStore();
  rt.content = content;
  rt.store = store;
  rt.settings = loadSettings(store);
  rt.game = new Game(content);
  rt.audio = new AudioEngine();
  rt.mode = 'title';
  rt.usables = new Map();
  rt.zone = content.world.spawn.at === 'spawn' ? 'beacon' : '';
  rt.fade = (mid) => mid();

  const t0 = performance.now();
  const world = await World.create(document.getElementById('scene-container') as HTMLDivElement, projectOptions);
  rt.world = world;
  const t1 = performance.now();

  // Atmosphere: fog limits view distance (and GPU cost); one directional light.
  const fogColor = new Color(content.world.zones[0]?.fog ?? '#3f8f96');
  world.scene.fog = new Fog(fogColor, 30, 150);
  const sun = new DirectionalLight('#ffe2b8', 1.5);
  sun.position.set(-40, 60, 30);
  world.scene.add(sun, new HemisphereLight('#a8d8e0', '#3a4a3c', 1.4));

  // Procedural world
  const village = buildVillage();
  rt.village = village;
  world.createTransformEntity(village.terrain, { persistent: true }).addComponent(LocomotionEnvironment);
  world.createTransformEntity(village.colliders, { persistent: true }).addComponent(LocomotionEnvironment);
  world.createTransformEntity(village.lit, { persistent: true });
  world.createTransformEntity(village.glow, { persistent: true });
  world.createTransformEntity(village.consoleGlyphs, { persistent: true });
  world.createTransformEntity(village.basketRim, { persistent: true });
  console.info(`[world] static triangles: ${Math.round(village.triangles / 1000)}k; World.create ${Math.round(t1 - t0)} ms, world build ${Math.round(performance.now() - t1)} ms (page at ${Math.round(t0)} ms)`);

  world
    .registerSystem(PlayerSystem)
    .registerSystem(NpcSystem)
    .registerSystem(InteractionSystem)
    .registerSystem(DialogueSystem)
    .registerSystem(MenuSystem)
    .registerSystem(FxSystem)
    .registerSystem(ZoneSystem);
  console.info(`[world] zone triangles: ${Math.round((world.getSystem(ZoneSystem)?.triangles ?? 0) / 1000)}k`);

  // Quest 3 performance: request 72 Hz and fixed foveation when VR starts.
  world.visibilityState.subscribe((state) => {
    if (state === VisibilityState.Visible) {
      try {
        void world.session?.updateTargetFrameRate?.(72);
      } catch {
        /* not supported */
      }
      world.renderer.xr.setFoveation(1);
    }
  });

  applySettings();
  document.getElementById('loading')?.classList.add('done');
  // Expose a tiny debug handle for the emulator tooling and the console.
  const debug = import.meta.env.DEV
    ? {
        /** Dev-only shortcut for testing: stand next to a content waypoint. */
        goto: (id: string) => {
          const v = waypoint(id, new Vector3());
          v.z += 1.6;
          PlayerSystem.teleport(v.setY(groundAt(v.x, v.z)), 0);
        },
      }
    : undefined;
  (window as unknown as { starfall: unknown }).starfall = { rt, debug };
}

void main();
