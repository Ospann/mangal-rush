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
  Chunk: 'chunk-',
  Tray: 'tray-',
  Mini: 'mini-',
  Side: 'side-',
  Drink: 'drink-',
  Station: 'station-',
  Flame: 'flame',
  Puff: 'puff',
  Spark: 'spark',
  Drop: 'drop',
  Sparkle: 'sparkle',
  Plate: 'plate',
  Bucket: 'bucket',
  Bubble: 'bubble',
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
  Pop: 'sfx-pop',
  Pour: 'sfx-pour',
} as const;

export type SfxKey = (typeof Sfx)[keyof typeof Sfx];

export const FONT_FAMILY =
  'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
