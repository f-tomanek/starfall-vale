import { STATE_VERSION, type GameState } from './state.js';

/** Minimal storage interface so tests can use an in-memory map. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const SAVE_KEY = 'starfall-vale.save';
export const SETTINGS_KEY = 'starfall-vale.settings';

export interface SaveFile {
  savedAt: string;
  state: GameState;
}

/** Upgrade older save versions here as the format evolves. */
function migrate(raw: { state: GameState }): GameState | null {
  const s = raw.state;
  if (!s || typeof s.version !== 'number') return null;
  if (s.version > STATE_VERSION) return null;
  // v1 is the first version: nothing to migrate yet.
  return { ...s, version: STATE_VERSION };
}

export function safeStore(): KeyValueStore | null {
  try {
    const ls = globalThis.localStorage;
    const probe = '__starfall_probe__';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return ls;
  } catch {
    return null;
  }
}

export function loadGame(store: KeyValueStore | null): SaveFile | null {
  if (!store) return null;
  try {
    const text = store.getItem(SAVE_KEY);
    if (!text) return null;
    const raw = JSON.parse(text) as SaveFile;
    const state = migrate(raw);
    return state ? { savedAt: raw.savedAt, state } : null;
  } catch {
    return null;
  }
}

export function saveGame(store: KeyValueStore | null, state: GameState): boolean {
  if (!store) return false;
  try {
    const file: SaveFile = { savedAt: new Date().toISOString(), state };
    store.setItem(SAVE_KEY, JSON.stringify(file));
    return true;
  } catch {
    return false;
  }
}

export function clearSave(store: KeyValueStore | null): void {
  try {
    store?.removeItem(SAVE_KEY);
  } catch {
    /* storage unavailable */
  }
}

// --------------------------------------------------------------- settings

export interface Settings {
  moveMode: 'smooth' | 'teleport';
  turnMode: 'snap' | 'smooth';
  snapAngle: 30 | 45 | 90;
  vignette: 'off' | 'low' | 'high';
  seated: boolean;
  moveSpeed: number;
  music: number;
  sfx: number;
  voice: number;
  debugHud: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  moveMode: 'smooth',
  turnMode: 'snap',
  snapAngle: 45,
  vignette: 'low',
  seated: false,
  moveSpeed: 2.5,
  music: 0.6,
  sfx: 0.8,
  voice: 0.8,
  debugHud: false,
};

export function loadSettings(store: KeyValueStore | null): Settings {
  try {
    const text = store?.getItem(SETTINGS_KEY);
    if (!text) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(text) as Partial<Settings>) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(store: KeyValueStore | null, s: Settings): void {
  try {
    store?.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable */
  }
}
