import { AssetType, defineAssets } from '@iwsdk/core';

const publicAssetUrl = (filePath: string): string =>
  `${import.meta.env.BASE_URL}${filePath.replace(/^\/+/u, '')}`;

// Everything else in the game is procedural; only the UI panels are files.
export default defineAssets({
  'dialogue-panel': {
    url: publicAssetUrl('ui/dialogue.uikitml'),
    type: AssetType.UIKitML,
    name: 'Dialogue Panel',
  },
  'menu-panel': {
    url: publicAssetUrl('ui/menu.uikitml'),
    type: AssetType.UIKitML,
    name: 'Menu Panel',
  },
  'hint-panel': {
    url: publicAssetUrl('ui/hint.uikitml'),
    type: AssetType.UIKitML,
    name: 'Hint Panel',
  },
});
