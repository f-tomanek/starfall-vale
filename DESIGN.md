# Starfall Vale — Design Document

Status: **Milestone 1 done (vertical slice), waiting for feedback** · Design approved 2026-10-09 · Last updated: 2026-10-09

This is the living design document. Every decision I make without asking you gets recorded here, under "Decision log" at the end.

---

## 1. Pitch

Three hundred years ago the colony starship *Meridian* crashed into a misty valley ringed by floating islands. The survivors' descendants forgot the technology and built a village called **Wreckhaven** inside the hull. They revere the ship's half-awake AI as a guardian spirit, **the Warden**. Now the islands are sinking and a violet energy storm is closing in. You arrive through an ancient beacon as **the Stranger**, the only person the Warden's systems will accept. To wake the ship, you must recover three **Resonance Cores**.

- **Tone:** wonder, discovery, warm humor, a touch of melancholy. Family-friendly.
- **Challenge:** exploration, environmental puzzles and dialogue choices. There is no combat.
- **Length target:** about 45–75 minutes for the main story, plus about 20 minutes of side content.
- **Platform:** Meta Quest 3 browser (WebXR) first. Desktop browser with mouse and keyboard is a full second target.

---

## 2. Story summary

### Act 1: The Stranger (tutorial, Wreckhaven)
1. The player wakes on the **Beacon Ring**, a stone circle on the southern ridge. The Warden's orb flickers on, with a greeting that glitches mid-sentence.
2. The Warden leads the player down the path to Wreckhaven. This part teaches **movement** with smooth locomotion, snap turn and the comfort options.
3. At the village gate, **Elder Maren** blocks the way. Her trust starts low and she asks why the Warden chose an outsider. The player's first dialogue choice sets her starting trust: honest, humble or boastful.
4. **Tobbin** waves the player into his workshop. There the player learns to **grab**: hand him three parts (a lens, a spring and a valve) for his "flying machine". In return he gives the player the **Pulse Lantern**. It reveals hidden glyphs, powers dormant machines, and later aims and charges light beams.
5. On the bridge shrine, the Warden explains the three Cores and marks the three zone landmarks. **Act 1 complete:** the journal opens and the zones unlock.

### Act 2: Three Cores (any order)
- **Glimmerwood (Core of Light).** **Old Hesk** guards the grove and speaks only in riddles. Solving his riddle points to the "eye that sleeps", a sealed shrine. Inside, the player rotates 3–4 crystal mirrors to guide the Lantern's beam onto the core socket. Hesk also starts the song-stone side quest.
- **Rustdune Canyon (Core of Motion).** Vex's salvagers have walled off the broken engine. The engine bay door only answers to a ship drone, so the player must find **Kip**, a lost scout drone hiding in the dunes, by tracking its beeps with the Lantern. Kip opens the bay and becomes the player's companion. Vex then wants the core. The player resolves the standoff in one of three ways:
  - **Persuade:** requires Maren's trust ≥ 2, or learning from Sela's rumor that Vex's crew is starving. Vex lets the player go and gains trust.
  - **Trade:** give Vex an item of value, either Tobbin's spare gyroscope (which costs Tobbin trust) or Sela's star chart. This is neutral.
  - **Sneak:** Kip distracts the guards and the player slips out the back vent. Vex loses trust, which colors the epilogue.
- **Skyreach Isles (Core of Memory).** The old cargo lift is broken. The player repairs it with three salvaged parts in a small hunt, one of them a grab puzzle. At the top, five light-bridge pylons must be activated in the order shown by an old star-map mural. Reading the mural is the puzzle, and Kip gives hints after two wrong tries. The core sits at the antenna array.

### Act 3: Starfall
- The cores are returned to the bridge as the violet storm reaches the valley. The sky darkens, the lanterns flicker and the music changes. There is no danger, only drama.
- The Warden fully wakes, regains its true name *MERIDIAN-WARD*, and presents **the choice**:
  - **Wake the Meridian:** the ship rises, carrying everyone who chooses to come, and the valley is left behind.
  - **Anchor the Vale:** the ship's reactor is buried to hold the islands up forever. The Meridian never flies, and the Warden stays as a quieter guardian.
- **Endings are colored by** the trust of Maren, Vex, Sela, Hesk and Tobbin, plus flags such as `kip_companion`, `telescope_fixed`, `ledger_read` and `songstones_5`. The epilogue is a slideshow-style sequence of world-space tableaux. Each character gets one of two or three epilogue lines depending on their trust and flags. For example, if the telescope was fixed, Tobbin navigates the Meridian himself.

### Side quests
| Quest | Giver | Reward / consequence |
|---|---|---|
| **Songs of the Fallen**: find five song-stones hidden across all zones | Old Hesk | Lore about the crash. All five unlock an extra epilogue line and +Hesk trust. |
| **Eyes on the Sky**: fix Tobbin's telescope (one lens from Glimmerwood, alignment mini-puzzle) | Tobbin | A view of the ship's origin star in the sky, +Tobbin trust, and a better Wake ending. |
| **The Lost Ledger**: return Sela's ledger, found in Rustdune | Sela | Reading it reveals her secret (she is Vex's sister). Reading and admitting it gives +trust. Reading and lying gives −trust if Kip "beeps". Not reading gives +trust. |

---

## 3. Characters

| Character | Look (low-poly) | Voice and style | Idle behavior | Example ambient line |
|---|---|---|---|---|
| **The Warden** | Floating teal holo-orb with orbiting ring segments, flickering scanlines | Formal, curious, glitchy humor ("Welcome, Stranger. Welcome, Str— apologies. Buffer.") | Bobs, rings rotate, occasional glitch jitter | "Atmospheric storm proximity: concerning. Also, pretty." |
| **Elder Maren** | Tall, long coat made from hull plating, staff with an amber lamp | Short, guarded and dry; softens as trust grows | Paces at the gate, leans on staff | "We've survived three centuries without strangers." |
| **Tobbin** | Small, goggles, oversized gloves, glider wings on his back | Fast, excited, runs sentences together | Fiddles with tools, hops | "Do you think birds get dizzy? I'd get dizzy." |
| **Sela** | Cart with lanterns, wide hat, scarf | Sardonic, transactional, secretly kind | Polishes goods, counts coins | "Everything's for sale. Except my opinion. That's free." |
| **Old Hesk** | Hunched, crystal shards in beard, moss cloak | Riddles, rhymes, long pauses | Hums, taps crystals | "What sleeps with open eyes? …No? Pity." |
| **Vex** | Patchwork armor, mechanical arm | Blunt, proud, a survivor; respects honesty | Arms crossed, inspects salvage | "Finders keepers. I find. I keep." |
| **Kip** | Football-sized round drone, one big eye, little antenna | Beeps plus short translated subtitles | Follows the player, looks around, gets distracted | "*beep-boop* (That rock looks suspicious.)" |

Shared behavior for all characters: they turn their head and body toward the player within 4 m, play an idle animation, and say an ambient one-liner on proximity with a cooldown. Their low-poly bodies are built procedurally from primitives, and their animation is procedural (bob, sway, head-look). Skeletal rigs are not used.

---

## 4. World layout (about 250 × 250 m)

```
                         N
          ┌──────────────────────────────────────┐
          │        ☁  SKYREACH ISLES  ☁          │  islands at +20…+60 m height
          │    ◇ antenna array (finale core)     │  ◇ landmark: blinking antenna
          │      ◇──◇──◇  light bridges          │
          │          ║ restored cargo lift       │
          │  ~~~~~~~~║~~~~~~~ fog bank ~~~~~~~~  │
          │          ║                           │
  GLIMMER-│  ✦✦✦     ║                 ▲▲▲       │
  WOOD    │ ✦ ✦ ✦  ┌─╨──────────────┐  ▲ RUST-   │
  (west)  │✦ HESK ✦│   WRECKHAVEN   │  DUNE ▲   │
  ✦ crystal│ ✦shrine │ (hull village) │ CANYON    │  ▲ landmark: broken engine
  spire   │  ✦✦✦  ═│ market·workshop│═  ▲ VEX   │      nacelle, smoking
  landmark│        │ bridge shrine  │   camp ▲  │
          │        └───────┬────────┘   ▲▲▲     │
          │                │ path                │
          │            ◎ BEACON RING (spawn)     │
          └──────────────────────────────────────┘
                         S       scale: 1 char ≈ 6 m
```

- **Wreckhaven** sits in the center. The hull is about 80 m long, on its side and half-buried, with openings that serve as streets. It is the safe zone and tutorial area.
- **Glimmerwood** is west, about 70 m from the hub. Its landmark is a giant violet crystal spire that glows at night.
- **Rustdune Canyon** is east, about 70 m from the hub. Its landmark is the broken engine nacelle, with a slow smoke column.
- **Skyreach Isles** is north. The islands float 20–60 m above the valley, and the antenna array blinks red at the top.
- Fog starts at about 30 m and closes in fully at about 110 m. This hides the world's edge, keeps the GPU budget low, and lets each landmark show as a silhouette through the fog.
- A low invisible boundary is explained in the fiction as "the Mist". Walking into it gently fades the screen and moves the player back. The camera is never pulled.

---

## 5. Technical architecture

### Stack
- **IWSDK** (Three.js + ECS), TypeScript, Vite, scaffolded with the official `npm create @iwsdk@latest`. Exact versions are pinned in `package.json` (no `^` or `~`), with a lockfile committed.
- **Version:** IWSDK **1.0.1** (no longer pre-1.0), scaffolded with `@iwsdk/create@1.0.1` (`npm create @iwsdk@latest`). Exact versions are pinned in `package.json`.
- **AI workflow:** the scaffold configures the **`iwsdk-runtime`** MCP server (emulator, screenshots, console logs, ECS inspection, render stats) and **`iwsdk-reference`** (SDK code search); the same features are in the `iwsdk` CLI. On this machine Windows application control blocks the managed Chromium that the server launches from `AppData`, so testing uses the same in-page IWER emulator in the desktop app's browser pane over `npm run dev:http`. I drive controllers through IWER's programmatic API and read stats from `window.__stats`.
- **Removed `@meta-quest/metavr`:** an optional CLI in the scaffold that sends usage telemetry to Meta. It isn't needed, and the IWSDK dev plugin skips telemetry when it is absent.
- **Content validation:** `zod` schemas, run at startup and in CI/tests.
- **Tests:** `vitest` for engine logic and content graph analysis.

### Folder structure (planned)
```
/content          ← ALL story data (edit or translate without touching code)
  world.json        zones, spawn points, landmarks, song-stone positions
  characters.json   names, looks (colors, proportions), voice blip, ambient lines
  items.json
  quests.json       quest state machines + objectives
  dialogue/*.json   one file per character
  strings.en.json   UI strings (journal, menus, settings)
/src
  core/           save, events, flags, trust, inventory (pure TS, no Three.js → testable)
  story/          dialogue runner, condition/effect evaluator, quest machine
  systems/        ECS systems: NPC, interaction, puzzles, audio, comfort, waypoint
  world/          procedural zone builders (merged geometry, instancing)
  ui/             world-space panels: dialogue, wrist journal, menus, debug HUD
  audio/          procedural Web Audio: ambience, music layers, SFX
/tests            vitest: logic + content validation
/public           static assets only (no secrets)
```

### Data-driven story engine
- **Conditions** form a small expression language in JSON:
  `{"all":[{"flag":"met_maren"},{"trust":{"maren":{"gte":2}}},{"item":"pulse_lantern"},{"quest":{"core_light":"active"}}]}`
  Supported operators: `all`, `any`, `not`.
- **Effects** are typed actions, for example `setFlag`, `addTrust`, `giveItem`, `takeItem`, `startQuest`, `advanceObjective` and `completeQuest`. Dialogue can also trigger allow-listed world events with `emit` (for example `open_engine_bay`).
- **Dialogue nodes** hold a speaker, one or two short sentences, and either a `next` node or 2–4 `choices`. Each choice can have a condition (hidden or greyed out when unmet) and effects.
- **Quests** are state machines (`locked → active → completed`, plus optional `failed`) with ordered or unordered objectives. Each objective has a waypoint target ID.
- **The validator** runs at startup and in tests. It checks the schema, that every ID reference resolves, that every dialogue node is **reachable**, that there are **no dead ends** (every path ends in an `end` node), that each quest is **completable** (a solver walks effects to show every objective can be reached from a new game), and that both endings are reachable. In dev builds, invalid content shows a readable error panel. In production, the build refuses to compile.

### Save
- Autosaves to `localStorage` on quest progress, zone change, and every 60 s. The save is versioned with a migration hook.
- The title panel offers **Continue** (when a save exists), **New Game** and **Settings**.

### Interaction and comfort (VR)
- **Locomotion:** IWSDK built-in locomotion (smooth on the left stick, snap turn on the right stick, teleport). A **comfort vignette** strengthens with speed and turn. If IWSDK's own vignette is missing or not adjustable, I'll add a lightweight vignette mesh attached to the camera. It is a mesh, not post-processing.
- **Settings:** smooth move or teleport, snap angle (30°/45°/90°) or smooth turn, vignette strength (off/low/high), **seated mode** (raises the view height), dominant hand, subtitle size, and music, SFX and voice-blip volumes.
- **Grab:** IWSDK `OneHandGrabbable` and `DistanceGrabbable`. Distance grab helps seated players.
- **Talking:** point at an NPC and press the trigger, or walk close and press A/X.
- **Hand tracking:** IWSDK exposes it with a config flag. I'll enable pinch-to-select and grab only in Milestone 4, and only if it works reliably in the emulator and on device. Controllers stay the primary input.
- **Haptics and sound** play on every hover, grab, release, dialogue choice and puzzle step.
- **Text:** world-space panels 1.2–1.6 m away, placed in front of the player when they open and then fixed in the world (never head-locked). Light text on a dark background, minimum about 40 mm glyph height at 1.4 m.
- **Transitions:** 300 ms fade to black for teleports and scene changes. No forced camera movement, no flashing, and the storm's lightning is a slow glow, not a strobe.
- **Wrist menu:** look at the left wrist, or press the menu button, to open a small panel with Journal, Inventory, Settings and Save & Quit.

### Desktop controls
- IWSDK supports browser controls (WASD and click). It does **not** ship mouse-look, so I'll add a small pointer-lock mouse-look system.
- Mouse plus WASD, E to talk or grab, Tab for the journal, Esc for the menu. Panels render in front of the camera exactly as in VR.

### Art pipeline
- Almost everything is built in code: low-poly primitives and noise-displaced terrain with flat shading, vertex colors instead of textures, and a few gradient lookup textures.
- **Palette:** teal mist `#3fa7a3`, amber lanterns `#ffb347`, violet crystals `#8e5cff`, rust-orange canyon `#c8642c`, dusk sky `#1c2340`.
- Static geometry is **merged per zone**, and repeated props (crystals, rocks, dune grass, debris) use **InstancedMesh**.
- **One directional light.** Shadows are faked with blob decals under characters and baked darker vertex colors on terrain. There are no real-time shadow maps.
- **Sky:** a gradient dome shader with drifting cloud billboards. The storm grows by lerping sky and fog colors.
- **Particles:** GPU points for fireflies, dust, sparks and storm motes, one draw call per system.
- **CC0 assets:** none are needed for v1. If I add any, each one is logged in CREDITS.md with source URL and license.

### Audio
- Fully procedural with the Web Audio API, so there are no audio files and no licensing questions:
  - **Zone ambience:** filtered noise for wind, sand and hum; FM chimes in Glimmerwood; metallic creaks in Rustdune; airy pads in Skyreach.
  - **Adaptive music:** 3–4 synth layers (pad, arpeggio, bass, percussion). Layers crossfade by zone, tension and dialogue, and Starfall adds a storm layer.
  - **Voices:** each character "speaks" in short pitched blips in the style of Animal Crossing, which suits a family-friendly stylized game. Subtitles carry the actual words.
  - **Spatial audio:** Three.js `PositionalAudio` (HRTF panning) for NPCs, Kip, puzzle objects and landmarks.

### Performance budget and strategy
| Metric | Budget | Strategy |
|---|---|---|
| FPS | 72 stable (try 90) | Measured on device. Fall back to lower particle counts and fog distance. |
| Draw calls | ≤ 150 | Merge static geometry per zone, instancing, shared materials (about 6–8 total) |
| Triangles | ≤ 500k visible | Low-poly by design. Fog culls distant geometry. Far zones swap to merged low-LOD silhouettes. |
| Textures | minimal | Vertex colors. Any texture is small, with KTX2 if needed. |
| Lighting | 1 directional light, no shadow maps | Baked vertex AO plus blob shadows |
| Post-processing | none | Fog, vignette mesh and fades are geometry or shaders |
| Foveation | fixed foveation on | Through the XR renderer setting (`setFoveation`) or IWSDK config |
| Zones | Distant zones are drawn as LOD silhouettes. Full detail only loads within about 90 m. | |

- **Debug HUD**, toggled with the left-stick click in VR or F3 on desktop, shows fps, frame ms, draw calls, triangles and the active zone. The same numbers go to `window.__stats`, so the emulator tooling can read them through the console.

---

## 6. Testing plan
1. **Unit tests (vitest):** condition evaluator, effects, quest machine, trust, inventory, save and migrate.
2. **Content tests:** schema, references, reachability, no dead ends, all quests completable, both endings reachable, and every Vex resolution path reachable.
3. **Scripted playthroughs (headless, vitest):** drive the story engine through each quest path (persuade, trade and sneak, read and don't read the ledger) and both endings.
4. **Emulator playthroughs (`iwer` MCP):** play each main path in the browser emulator, take screenshots at key beats and check that console errors are zero. A dev-only **debug console** (jump to zone, set flags, skip to an act) lets the emulator reach late-game states without replaying the whole game every time.
5. **Device check:** you run a short checklist on your Quest 3 after each milestone. I can't run the real headset, so on-device fps is measured by you, using the debug HUD.

---

## 7. Milestone plan

| # | Milestone | Contents | Exit criteria |
|---|---|---|---|
| 0 | **Design** | This document | You approve it |
| 1 | **Vertical slice** | Scaffold and tooling, Beacon Ring, the gate and workshop parts of Wreckhaven, locomotion and comfort, desktop controls, the Warden and Tobbin (Maren in a basic form), dialogue engine, Act 1 complete, Pulse Lantern, save/load, debug HUD, content validation and first tests | Act 1 playable start to finish in the emulator and on Quest, 72 fps, zero console errors |
| 2 | **World** | All four zones with landmarks, ambient life (fireflies, birds, clouds, dust), zone soundscapes, LOD and zone streaming, the lift, the bridges as set pieces | Free roaming across all zones within budget |
| 3 | **Story** | All seven characters, Acts 2 and 3, all puzzles, the three Vex resolutions, both endings with epilogue variations, three side quests, wrist journal and inventory, waypoints | Every quest path and both endings completed in tests and the emulator |
| 4 | **Polish** | Adaptive music, SFX and haptics pass, VFX, onboarding hints, settings panel, hand tracking (if cheap), performance pass, bug bash, README, CREDITS and DESIGN updates | Release candidate |

After each milestone: a git commit, a short changelog, a Quest 3 test checklist (at most 10 steps), and known issues. Then I wait for your feedback.

---

## 8. Risks and honest feasibility notes

| Risk | Impact | Mitigation / closest alternative |
|---|---|---|
| ~~Node.js is not installed~~ | Resolved | Node.js 24 installed by the user |
| IWSDK APIs differ from my assumptions (young SDK) | Rework | Read the scaffold's docs, `AGENTS.md` and skills, and the RAG MCP before coding. Wrap SDK use behind thin adapters. |
| Quest browser text readability | Eye strain | Large fonts, high contrast, tested on device. Subtitle size in settings. |
| **"Play every quest path end-to-end in the emulator"** | Driving every combination of choices through the emulator by hand is very slow | **Alternative:** the engine plays **every** path headlessly in automated tests. In the emulator I play each distinct path (three Vex resolutions, both ledger branches, both endings) using debug-console shortcuts to skip already-tested sections. |
| **Render stats via MCP** | The emulator MCP doesn't seem to offer this | **Alternative:** my own debug HUD plus `window.__stats`, read through the console tool. Real fps only counts on device. |
| **Hand tracking** | Reliable grab and pinch UX costs time | Controllers stay primary. Hand tracking ships in Milestone 4 only if it is cheap and reliable. Otherwise it is listed as a known limitation. |
| **"Turns to look at the player" plus idles for seven NPCs** | Rigs and animation clips are heavy | Procedural animation on primitive bodies (head/body yaw, bob, gestures). No skeletal animation. |
| **Voice acting** | Not in the brief, and recorded or TTS voices add licensing and size problems | Pitched voice blips plus subtitles |
| Performance on Quest 3 with fog, particles and audio | Below 72 fps | Strict budgets and early on-device tests in Milestone 1. Cut scope before frame rate (fewer particles, shorter fog distance, simpler islands). |
| Web Audio autoplay rules | No sound before the first interaction | Audio starts on "Enter VR" or the first click |
| HTTPS needed on Quest | Can't open the game from the dev PC | The README will cover the Vite HTTPS dev server, or USB with `adb reverse`, and publishing to a static HTTPS host |
| Scope (seven characters, four zones, two endings) | Overrun | Content is data-driven, so adding story is cheap. Art stays procedural and stylized. Each zone gets one puzzle mechanic. |

**Cut list, if frame rate or schedule forces it (in this order):** hand tracking → bird flocks → telescope mini-puzzle (reduced to a fetch) → seated-mode fine-tuning → second epilogue variant per character.

---

## 9. Open questions for you
1. **Hosting account:** whether the game goes on a public host (Netlify, GitHub Pages and so on), and under which account, is your call. If it is company work, check what is allowed. See the README.

## 10. Milestone 1 notes (what was built)
- **Scope delivered:** Beacon Ring, the footpath, and the Wreckhaven hull with gate, market, workshop, houses and the bridge shrine. The Warden (guides along the path, glitch idle), Maren (trust choice) and Tobbin. The whole of Act 1, the Pulse Lantern, save/load (autosave plus Continue/New Game), and the settings, journal, tips and debug HUD.
- **Placeholders for later milestones:** the three outer zones appear only as distant silhouettes (islands, crystal spire, engine). Act 2 exists in the journal as "coming soon". Sela, Hesk, Vex and Kip are defined in content but not placed yet.
- **Measured (emulator, stereo):** about 46 to 60 draw calls and 83 to 87k triangles in total (both eyes), against a budget of 150 calls and 500k triangles. Real frame rate has to be measured on the Quest with the debug HUD.
- **World coordinates:** north is −Z. Waypoint Y in `content/world.json` is height above the walkable surface (`groundAt` = terrain plus the shrine deck and ramp).

## 11. Decision log
| Date | Decision | Reason |
|---|---|---|
| 2026-10-09 | Procedural art and audio, no third-party assets in v1 | No licensing risk, tiny download, fits the low-poly style |
| 2026-10-09 | Voice blips instead of voice acting | Family-friendly, no assets, works in any language |
| 2026-10-09 | `zod` for content validation, `vitest` for tests | Standard, small, TypeScript-native |
| 2026-10-09 | Procedural NPC animation, no skeletal rigs | Performance and scope |
| 2026-10-09 | Vex standoff: persuade, trade or sneak, each with trust consequences | Matches the brief, and gives each path weight in the ending |
| 2026-10-09 | Sela is secretly Vex's sister (ledger secret) | Connects side quest to main quest |
| 2026-10-09 | Project lives in `C:\Users\ftomanek\Projects\starfall-vale` | AppData is not a project location, and OneDrive would sync `node_modules` |
| 2026-10-09 | Project lives in `C:UserstomanekProjectsstarfall-vale` | Confirmed by the user's approval |
| 2026-10-09 | Static world built in code (ECS entities), scene JSON holds only sky/IBL | The world is procedural; scene JSON cannot describe merged procedural meshes |
| 2026-10-09 | UIKitML for interactive panels (dialogue, menu, tips); canvas billboards for nameplates, bubbles, prompts and toasts | MSDF text stays crisp for reading; billboards are cheap for short labels |
| 2026-10-09 | Desktop: drag-to-look instead of pointer lock | Clicking UI panels and characters keeps working without leaving pointer lock |
| 2026-10-09 | Distance grab only inside VR; E to carry on desktop | A mouse ray pulling objects toward the camera felt wrong |
| 2026-10-09 | Content is bundled with `import.meta.glob` at build time | Simple static hosting; edits need a rebuild (`npm run build`) |
| 2026-10-09 | Separate `--mode http` dev server on port 8082 | Plain HTTP on localhost is a secure context for WebXR and works in the built-in browser; HTTPS (8081) stays for the Quest over Wi-Fi |
| 2026-10-09 | Story flag changes are saved one frame later | Quest onComplete effects must be included in the save |
| 2026-10-09 | Teleport-only mode removes only the controller slide binding | Keyboard movement on desktop keeps working |
