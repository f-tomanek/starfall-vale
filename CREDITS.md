# Credits

## Original content

All story, characters, dialogue, world layout, 3D models, UI layouts, sound effects, voices and
music in Starfall Vale are original and **generated procedurally in code** in this repository:

- 3D models: `src/world/` (terrain, village, characters, items), built from Three.js primitives
  at runtime
- Audio: `src/audio/audio.ts`, synthesized with the Web Audio API at runtime
- UI: `public/ui/*.uikitml`

No third-party models, textures, sounds or music are used. If any are added later (for example
CC0 packs from Kenney or Quaternius), each one will be listed below with its source URL and
license.

| Asset | Source | License |
|---|---|---|
| *(none yet)* | | |

## Software

| Package | License | Use |
|---|---|---|
| [Immersive Web SDK](https://github.com/facebook/immersive-web-sdk) (`@iwsdk/*` 1.0.1) | MIT | WebXR framework, emulator (IWER), locomotion, grabbing, spatial UI |
| [three.js](https://threejs.org) (via `super-three` 0.181.0) | MIT | 3D rendering |
| [@pmndrs/uikit](https://github.com/pmndrs/uikit) 1.0.76 | MIT | In-world UI panels |
| Inter font (bundled by IWSDK/uikit) | SIL Open Font License 1.1 | UI text |
| [zod](https://zod.dev) 3.25.76 | MIT | Content validation |
| [Vite](https://vitejs.dev) 7.3.7, [Vitest](https://vitest.dev) 3.2.4, TypeScript 5.9.3 | MIT / Apache-2.0 | Build and tests |

"Meta", "Quest" and "Horizon" are trademarks of Meta Platforms, Inc. They're used here only to
describe compatibility. This project is not affiliated with or endorsed by Meta.
