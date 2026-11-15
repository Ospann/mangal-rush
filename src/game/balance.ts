export const meatKinds = ['chicken', 'lamb', 'beef', 'lula', 'veg', 'fish'] as const;
export type MeatKind = (typeof meatKinds)[number];

export const sideKinds = ['onion', 'lavash', 'tomato', 'sauce'] as const;
export type SideKind = (typeof sideKinds)[number];

export const drinkKinds = ['ayran', 'tea', 'kompot'] as const;
export type DrinkKind = (typeof drinkKinds)[number];

export const upgradeIds = [
  'grill',
  'coal',
  'fan',
  'sprayer',
  'helper',
  'plates',
  'fridge',
  'canopy',
  'decor',
  'marinade',
] as const;
export type UpgradeId = (typeof upgradeIds)[number];

export const eventKinds = ['wind', 'rain', 'rush', 'toy'] as const;
export type EventKind = (typeof eventKinds)[number];

export const guestKinds = [
  'local',
  'taxi',
  'granny',
  'student',
  'office',
  'blogger',
  'athlete',
  'critic',
] as const;
export type GuestKind = (typeof guestKinds)[number];

export interface GuestBalance {
  patienceMult: number;
  tipMult: number;
}

export const goalKinds = ['earn', 'serve', 'noBurn', 'combo'] as const;
export type GoalKind = (typeof goalKinds)[number];

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

  guestTypes: {
    local: { patienceMult: 1, tipMult: 1 },
    taxi: { patienceMult: 0.62, tipMult: 1.6 },
    granny: { patienceMult: 1.6, tipMult: 1 },
    student: { patienceMult: 1, tipMult: 0.4 },
    office: { patienceMult: 1.15, tipMult: 1.1 },
    blogger: { patienceMult: 0.95, tipMult: 1 },
    athlete: { patienceMult: 0.9, tipMult: 1.2 },
    critic: { patienceMult: 1.1, tipMult: 1.3 },
  } satisfies Record<GuestKind, GuestBalance>,

  guestRules: {
    grannyTipRate: 0.2,
    studentFriendsAbove: 0.6,
    studentFriends: [1, 2],
    studentFriendDelaySec: 2.5,
    officeSkewers: [3, 4],
    regularChance: 0.75,
    buzzTipMult: 1.15,
    buzzPatienceMult: 0.9,
  },

  toy: {
    bonusPerSkewer: 25,
  },

  toyMode: {
    maxLost: 3,
    rampSec: 540,
    minIntervalMult: 0.2,
    patienceGraceSec: 240,
    patienceRampSec: 900,
    minPatienceMult: 0.45,
  },

  daily: {
    reward: 250,
    perfect: [4, 7],
    serve: [10, 16],
    tips: [120, 220],
  },

  events: {
    wind: { flareMult: 2.4 },
    rain: { decayMult: 2.6 },
    rush: { intervalMult: 0.5 },
  },

  upgrades: {
    grill: { costs: [450, 900, 1500, 2300], slotsPerLevel: 1 },
    coal: { costs: [250, 600, 1100], decayMult: [1, 0.8, 0.64, 0.5] },
    fan: { costs: [500, 1200], boost: 0.25 },
    sprayer: { costs: [600, 1400], delaySec: [0, 3, 1.4] },
    helper: { costs: [900] },
    plates: { costs: [400, 1000] },
    fridge: { costs: [300, 700], stockPerLevel: 2 },
    canopy: { costs: [800] },
    decor: { costs: [200, 500, 950], patienceMult: [1, 1.1, 1.2, 1.3] },
    marinade: { costs: [350, 800, 1400], tipMult: [1, 1.2, 1.4, 1.6] },
  },

  progress: {
    starsToUnlockLocation: 16,
    goalStarCap: 2,
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
