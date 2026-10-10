# Starfall Vale

A story-driven VR adventure for the **Meta Quest 3 browser**, also playable on a desktop
browser with mouse and keyboard. Three hundred years ago the colony ship *Meridian* crashed
into a misty valley. You arrive as the Stranger, the only one its half-awake AI will accept.

Built with Meta's Immersive Web SDK (IWSDK 1.0.1: Three.js and an entity-component system),
TypeScript and Vite. It is all static files: no server, no accounts, no analytics.

> **Status: Milestone 1 (vertical slice).** Act 1 is playable from start to finish.
> See [DESIGN.md](DESIGN.md) for the full plan.

---

## 1. Run it on your computer

You need **Node.js 20.19+, 22.12+ or 24** (`node --version` should print one of those).

Open a terminal (Command Prompt or PowerShell) and **go to the project folder first**. Every
`npm` command below only works from inside it:

```bash
cd C:\Users\ftomanek\Projects\starfall-vale
```

Then, the first time only:

```bash
npm install
```

Then start the development server. Pick one:

| Command | Address | Use it for |
|---|---|---|
| `npm run dev:http` | http://localhost:8082 | Playing on this PC. It includes the built-in VR emulator. |
| `npm run dev:runtime` | https://localhost:8081 | Playing on the Quest over Wi-Fi (see section 2). |
| `npm run dev` | https://localhost:8081 | IWSDK's AI-assisted workflow (managed browser plus MCP). It may not work on locked-down company laptops; see "Known issues". |

Open the address in Chrome or Edge.

The page shows an **"Enter XR"** button at the top. It belongs to the emulator, which fakes a
Quest headset in the desktop browser, with on-screen controllers and panels. You can also just
play with mouse and keyboard.

### Desktop controls

| Action | Keys |
|---|---|
| Walk | **W A S D** or the arrow keys |
| Look around | **drag with the mouse** (Q and R also turn) |
| Talk, pick up, drop | **E**, or click a character or part |
| Dialogue choices | click, or keys **1 to 4**; **Space** or **Enter** to continue |
| Pulse Lantern | **F** |
| Menu, journal, settings | **Tab** or **Esc** |

### Quest controls

| Action | Controller |
|---|---|
| Walk | left stick (smooth movement with a comfort vignette) |
| Turn | right stick left or right (snap turn by default) |
| Teleport | push the right stick down, aim, release |
| Talk, choose | point the ray and pull the **trigger**, or press **A** or **X** near a character |
| Grab a part | point at it and **hold the trigger**; let go above the basket |
| Pulse Lantern | **left trigger** (the lantern hangs from your left hand) |
| Menu | **menu button** on the left controller (or **Y**) |

Settings (in the menu) let you switch to teleport-only movement, smooth turning, a stronger or
weaker vignette, seated mode (raises your view by 45 cm), walking speed, volumes, and the
debug stats display (fps, draw calls, triangles).

---

## 2. Play it on your Quest 3

The Quest browser only allows VR on **HTTPS** pages (or on `localhost`, which doesn't apply,
because the headset isn't your PC). There are two ways to get an HTTPS page.

### Option A: from your PC over Wi-Fi (quick testing)

1. Connect the PC and the Quest to **the same Wi-Fi network**. Company or guest networks often
   block device-to-device traffic. A home network or a phone hotspot usually works.
2. On the PC, run `npm run dev:runtime`. It prints a **Network** address such as
   `https://192.168.1.23:8081/`. If Windows asks about the firewall, allow access on
   *private* networks.
3. On the Quest, open the **Browser** and type that address exactly, including `https://` and
   `:8081`.
4. You'll see a warning that the connection isn't private. That's expected: the development
   certificate is self-made. Choose **Advanced**, then **Proceed**.
5. When the game loads, press **Enter VR** (on the title panel or in the browser bar).

### Option B: publish it and open a link (recommended)

See section 3. Then open the published `https://...` address in the Quest browser. You can
bookmark it, and there's no certificate warning.

---

## 3. Publish it to a free static HTTPS host

First build the game:

```bash
npm run build
```

This creates a **`dist`** folder: the whole game as static files. Upload that folder to any
static host. Two easy free options:

**Netlify Drop (no account setup, drag and drop):**
1. Go to https://app.netlify.com/drop and sign in.
2. Drag the **`dist`** folder onto the page.
3. After a few seconds you get an address like `https://something.netlify.app`. Open it on the
   Quest.
4. To update the game later, rebuild and drag the new `dist` folder onto the same site's
   *Deploys* page.

**GitHub Pages:**
1. Push the project to a GitHub repository.
2. In the repository settings, open **Pages** and select **GitHub Actions** as the source. Use
   the standard *Static HTML* workflow, with `npm ci && npm run build` and `dist` as the
   folder to upload.
3. The game is served at `https://<user>.github.io/<repo>/`. Relative paths are already
   configured, so it works in a subfolder.

> **Before publishing:** this is a personal or demo project. If you're doing it on a company
> laptop or as company work, check with your manager or IT whether publishing on a public host
> and using a personal account is allowed.

---

## 4. Edit or translate the story

Everything the characters say, every quest and item, and where things are placed lives in
plain JSON under **`/content`**. No code changes are needed.

| File | What's in it |
|---|---|
| `content/characters.json` | names, look (colors, height, accessories), voice pitch, trust, ambient one-liners |
| `content/dialogue/*.json` | one conversation tree per character |
| `content/quests.json` | quests, ordered objectives, and the conditions that complete them |
| `content/items.json` | items and their descriptions |
| `content/world.json` | waypoints (positions), character placements, pickups, triggers |
| `content/strings.en.json` | menu text, hints, prompts |

**Dialogue basics** (see `content/dialogue/tobbin.json` for a full example):

```json
"help": {
  "text": "Lens at the market stall, spring on my bench. Drop them in my basket!",
  "effects": [{ "setFlag": "met_tobbin" }, { "hint": "hint_grab" }],
  "end": true
}
```

- Each node has `text` (at most **two sentences**) and then exactly one of: `next` (the next
  node id), `choices` (2 to 4 options, each with `text`, `next`, and optional `when` and
  `effects`), or `"end": true`. Use `"next": "END"` to end the conversation from a choice.
- `entries` at the top decide where a conversation starts: the first entry whose `when`
  condition is true wins.
- **Conditions:** `{"flag": "x"}`, `{"item": "lens"}`, `{"trust": {"character": "maren", "gte": 2}}`,
  `{"quest": {"id": "act1_stranger", "status": "active"}}`, `{"objective": {...}}`, combined
  with `{"all": [...]}`, `{"any": [...]}` and `{"not": ...}`.
- **Effects:** `setFlag`, `addTrust`, `giveItem`, `takeItem`, `startQuest`, `completeQuest`,
  `hint` (shows a tip from the strings file), `emit` (a world event the game reacts to, listed
  in `world.json` → `events`).
- **Positions** in `world.json` are `[x, height above the ground, z]` in meters. North is −z.
  The village spans roughly x −12…12, z −52…12.
- **Translating:** copy `strings.en.json` and translate the dialogue and quest texts. UI fonts
  cover Latin characters. Accented letters such as Czech ones should work but haven't been
  tested on the headset yet.

**Check your changes.** The game validates all content when it starts and shows a readable
list of problems instead of a broken game. Before you publish, also run:

```bash
npm run validate
```

This checks every reference, makes sure every dialogue node can be reached, that there are no
dead ends and no lines longer than two sentences, and plays through every possible route to
prove every quest can be completed and nothing soft-locks.

---

## 5. For developers

```bash
npm test            # unit tests: story engine, saves, content solver, scripted playthroughs
npm run typecheck
npm run build       # production build in dist/
```

- `src/core/`: the story engine (plain TypeScript, no 3D). It covers conditions, effects,
  quests, dialogue, saves and the content validator/solver.
- `src/world/`: procedural terrain, village, characters and items. There are no model files.
- `src/systems/`: ECS systems for the player, characters, interaction, dialogue, menu and
  effects.
- `src/audio/`: procedural Web Audio for effects, voices, ambience and music. There are no
  audio files.
- `public/ui/*.uikitml`: the dialogue, menu and tip panels.
- In dev builds, `starfall.debug.goto('<waypoint>')` in the browser console moves you next to
  any waypoint.

Project notes for AI-assisted work are in `AGENTS.md` / `CLAUDE.md` (generated by IWSDK).

## Known issues

- **Only one dev server can run per project at a time.** If `npm run dev:runtime` or
  `npm run dev:http` prints nothing and seems stuck, another one is still running, possibly
  in another terminal window. Stop it with **Ctrl+C** in that window, then start again. If it
  still won't start, run `npx iwsdk dev down` once.

- On some company laptops, Windows policy stops IWSDK's managed emulator browser from starting
  (`npm run dev` reports `spawn UNKNOWN`). Use `npm run dev:http` and open the page in Chrome
  or Edge instead. The in-page emulator works the same.
- The production bundle is about 1.8 MB gzipped. Most of it is IWSDK's own runtime (UI icon
  set, fonts, locomotion engine). The first load on the Quest takes a few seconds.

## License and credits

See [CREDITS.md](CREDITS.md).
