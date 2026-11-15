export type Orientation = 'portrait' | 'landscape';

const orientation: Orientation = 'portrait';
const baseSize = { width: 720, height: 1280 };

export const gameConfig = {
  id: 'mangal-rush',
  orientation,
  width: orientation === 'portrait' ? baseSize.width : baseSize.height,
  height: orientation === 'portrait' ? baseSize.height : baseSize.width,
  backgroundColor: '#2a1b14',
  ads: {
    interstitialCooldownSec: 60,
  },
  save: {
    key: 'save',
    debounceMs: 500,
  },
} as const;
