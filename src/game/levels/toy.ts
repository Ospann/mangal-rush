import { baseMods, type DayMods } from '../locations';
import type { DayEvent, DayLevel } from './types';
import { parseDayLevel } from './validate';

export const TOY_DAY_ID = 'toy';

const DURATION_SEC = 6 * 3600;
const CYCLE_SEC = 240;
const SCHEDULED_SEC = 3600;

function schedule(): DayEvent[] {
  const events: DayEvent[] = [];
  for (let start = 0; start < SCHEDULED_SEC; start += CYCLE_SEC) {
    const round = start / CYCLE_SEC;
    events.push({
      type: round % 2 === 0 ? 'wind' : 'rain',
      atSec: start + 60,
      durationSec: 22,
      order: [],
    });
    events.push({
      type: 'toy',
      atSec: start + 120,
      durationSec: 110,
      order: [
        { kind: 'lamb', count: 2 },
        { kind: 'chicken', count: 3 },
        { kind: round % 2 === 0 ? 'lula' : 'veg', count: 1 },
      ],
    });
  }
  return events;
}

const base: DayLevel = parseDayLevel(
  {
    id: TOY_DAY_ID,
    location: 'restaurant',
    durationSec: DURATION_SEC,
    seed: 1,
    seats: 4,
    meats: ['chicken', 'lamb', 'lula', 'veg'],
    sides: ['onion', 'lavash', 'tomato', 'sauce'],
    drinks: ['ayran', 'tea', 'kompot'],
    start: { coalLevel: 0.85, ayran: 6 },
    guests: {
      firstDelaySec: 3,
      intervalSec: [13, 18],
      patienceSec: 60,
      types: [
        { type: 'local', weight: 5 },
        { type: 'taxi', weight: 2 },
        { type: 'granny', weight: 1 },
        { type: 'student', weight: 2 },
        { type: 'office', weight: 2 },
        { type: 'athlete', weight: 1 },
      ],
    },
    goal: { type: 'serve', value: 1 },
    stars: [1, 2, 3],
    events: schedule(),
    orders: [
      { weight: 4, items: [{ kind: 'chicken', count: 1 }] },
      { weight: 3, items: [{ kind: 'lamb', count: 1 }], sides: ['onion'] },
      { weight: 3, items: [{ kind: 'chicken', count: 2 }], sides: ['lavash'] },
      { weight: 3, items: [{ kind: 'lula', count: 1 }], sides: ['lavash'], drink: 'ayran' },
      { weight: 2, items: [{ kind: 'veg', count: 1 }], drink: 'kompot' },
      { weight: 2, items: [{ kind: 'lamb', count: 2 }], sides: ['onion', 'tomato'] },
      {
        weight: 2,
        items: [
          { kind: 'chicken', count: 1 },
          { kind: 'lamb', count: 1 },
        ],
        drink: 'tea',
      },
      {
        weight: 2,
        items: [
          { kind: 'lula', count: 1 },
          { kind: 'veg', count: 1 },
        ],
        sides: ['sauce'],
      },
      {
        weight: 1,
        items: [
          { kind: 'lamb', count: 2 },
          { kind: 'lula', count: 1 },
        ],
        sides: ['lavash', 'sauce'],
        drink: 'tea',
      },
    ],
  },
  'toy',
);

export function toyLevel(seed: number = base.seed): DayLevel {
  return { ...base, seed };
}

export function toyMods(): DayMods {
  return {
    ...baseMods(),
    grillSlots: 7,
    plates: 3,
    coalDecayMult: 0.64,
    autoFanSlots: 2,
    sprayerDelaySec: 3,
    patienceMult: 1.2,
  };
}
