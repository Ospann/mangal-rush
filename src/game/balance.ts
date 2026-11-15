export type MeatKind = 'chicken' | 'lamb';

export type Doneness = 'raw' | 'done' | 'perfect' | 'overdone' | 'burnt';

export interface MeatBalance {
  cookSec: number;
  perfectFrom: number;
  perfectTo: number;
  burntAt: number;
  fat: number;
  price: number;
}

export const balance = {
  simStepSec: 1 / 30,

  meats: {
    chicken: {
      cookSec: 6,
      perfectFrom: 1.3,
      perfectTo: 1.85,
      burntAt: 2.6,
      fat: 0.35,
      price: 40,
    },
    lamb: {
      cookSec: 9,
      perfectFrom: 1.3,
      perfectTo: 1.65,
      burntAt: 2.3,
      fat: 1,
      price: 70,
    },
  } satisfies Record<MeatKind, MeatBalance>,

  coals: {
    startLevel: 0.8,
    minLevel: 0.15,
    decayPerSec: 0.0045,
    edgeDrop: 0.4,
    maxSlotHeat: 1.6,
    addAmount: 0.45,
    addCooldownSec: 18,
    smokeSec: 4,
    smokeFactor: 0.45,
  },

  fan: {
    perSlotWidth: 0.22,
    maxBoost: 0.6,
    decayPerSec: 0.13,
  },

  flare: {
    minHeat: 0.5,
    minCook: 0.25,
    chancePerSec: 0.035,
    cookMult: 2.6,
    emptySlotSec: 0.8,
    waterChill: -0.25,
    chillRecoverPerSec: 0.08,
  },

  plate: {
    capacity: 4,
  },

  guests: {
    maxSeats: 4,
    leaveSec: 1.2,
  },

  tips: {
    quality: {
      raw: 0,
      done: 0.1,
      perfect: 0.3,
      overdone: 0,
      burnt: 0,
    } satisfies Record<Doneness, number>,
    speedBonus: 0.2,
    comboStep: 0.1,
    comboMax: 2,
  },
} as const;
