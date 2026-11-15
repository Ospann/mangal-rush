export const meatKinds = ['chicken', 'lamb', 'beef', 'lula', 'veg', 'fish'] as const;
export type MeatKind = (typeof meatKinds)[number];

export const sideKinds = ['onion', 'lavash', 'tomato', 'sauce'] as const;
export type SideKind = (typeof sideKinds)[number];

export const drinkKinds = ['ayran', 'tea', 'kompot'] as const;
export type DrinkKind = (typeof drinkKinds)[number];

export type Doneness = 'raw' | 'done' | 'perfect' | 'overdone' | 'burnt';

export interface MeatBalance {
  cookSec: number;
  perfectFrom: number;
  perfectTo: number;
  burntAt: number;
  fat: number;
  price: number;
  minFlipCook?: number;
  maxFlips?: number;
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
    beef: {
      cookSec: 7.5,
      perfectFrom: 1.3,
      perfectTo: 1.52,
      burntAt: 2.2,
      fat: 0.55,
      price: 65,
    },
    lula: {
      cookSec: 7,
      perfectFrom: 1.3,
      perfectTo: 1.7,
      burntAt: 2.4,
      fat: 0.8,
      price: 55,
      minFlipCook: 0.75,
    },
    veg: {
      cookSec: 4,
      perfectFrom: 1.25,
      perfectTo: 1.8,
      burntAt: 2.5,
      fat: 0,
      price: 20,
    },
    fish: {
      cookSec: 5,
      perfectFrom: 1.3,
      perfectTo: 1.7,
      burntAt: 2.3,
      fat: 0.3,
      price: 80,
      maxFlips: 2,
    },
  } satisfies Record<MeatKind, MeatBalance>,

  sides: {
    onion: 8,
    lavash: 10,
    tomato: 10,
    sauce: 6,
  } satisfies Record<SideKind, number>,

  drinks: {
    ayran: 18,
    tea: 12,
    kompot: 15,
  } satisfies Record<DrinkKind, number>,

  tea: {
    brewSec: 6,
    hotSec: 22,
  },

  ayran: {
    defaultStock: 4,
    refillSec: 14,
  },

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
