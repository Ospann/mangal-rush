export const SceneKey = {
  Boot: 'Boot',
  Preload: 'Preload',
  Menu: 'Menu',
  Day: 'Day',
  Pause: 'Pause',
  DayResult: 'DayResult',
} as const;

export type SceneKey = (typeof SceneKey)[keyof typeof SceneKey];

export const Tex = {
  Background: 'bg',
  Counter: 'counter',
  Grill: 'grill',
  Glow: 'glow',
  Stick: 'stick',
  ChunkChicken: 'chunk-chicken',
  ChunkLamb: 'chunk-lamb',
  Flame: 'flame',
  Puff: 'puff',
  Spark: 'spark',
  Drop: 'drop',
  Sparkle: 'sparkle',
  Plate: 'plate',
  BowlChicken: 'bowl-chicken',
  BowlLamb: 'bowl-lamb',
  Bucket: 'bucket',
  Bubble: 'bubble',
  MiniChicken: 'mini-chicken',
  MiniLamb: 'mini-lamb',
  Coin: 'coin',
  GuestBody: 'guest-body-',
  Face: 'face-',
} as const;

export const Sfx = {
  Sizzle: 'sfx-sizzle',
  Flare: 'sfx-flare',
  Splash: 'sfx-splash',
  Perfect: 'sfx-perfect',
  Bell: 'sfx-bell',
  Coin: 'sfx-coin',
  Flip: 'sfx-flip',
  Hm: 'sfx-hm',
  Coals: 'sfx-coals',
  Fan: 'sfx-fan',
  Place: 'sfx-place',
  Trash: 'sfx-trash',
} as const;

export type SfxKey = (typeof Sfx)[keyof typeof Sfx];

export const FONT_FAMILY =
  'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
