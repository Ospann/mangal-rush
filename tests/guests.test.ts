import { describe, expect, it } from 'vitest';
import { balance, type GuestKind, type MeatKind } from '../src/game/balance';
import type { DayLevel } from '../src/game/levels/types';
import { LevelError, parseDayLevel } from '../src/game/levels/validate';
import { baseMods } from '../src/game/locations';
import { evaluateDay } from '../src/game/progress';
import { lineIndex, regularFor, regulars } from '../src/game/regulars';
import { isTranslationKey } from '../src/i18n';
import { DaySim, type Guest } from '../src/game/sim/day-sim';
import { orderFor, pickGuestKind } from '../src/game/sim/guests';
import { createRng } from '../src/game/sim/rng';
import { createSkewer, meatOf, type Skewer } from '../src/game/sim/skewer';

function level(kind: GuestKind, overrides: Partial<DayLevel> = {}): DayLevel {
  return {
    id: 'guests',
    location: 'restaurant',
    day: 0,
    durationSec: 120,
    seed: 11,
    grillSlots: 6,
    plates: 3,
    seats: 3,
    meats: ['chicken', 'lamb'],
    sides: ['onion', 'lavash'],
    drinks: ['kompot'],
    start: { coalLevel: 0.8, ayran: 2 },
    guests: {
      firstDelaySec: 0.5,
      intervalSec: [50, 50],
      patienceSec: 40,
      types: [{ type: kind, weight: 1, fromSec: 0, untilSec: 9999 }],
    },
    goal: { type: 'serve', value: 1 },
    stars: [10, 20, 30],
    events: [],
    orders: [
      {
        weight: 1,
        items: [{ kind: 'chicken', count: 1 }],
        sides: ['lavash', 'onion'],
        drink: null,
      },
      { weight: 1, items: [{ kind: 'lamb', count: 2 }], sides: ['lavash'], drink: 'kompot' },
    ],
    ...overrides,
  };
}

function advance(sim: DaySim, seconds: number): void {
  for (let t = 0; t < seconds; t += 0.1) sim.step(0.1);
}

function cooked(kind: MeatKind, stage: 'perfect' | 'overdone' | 'done'): Skewer {
  const meat = meatOf(kind);
  const value =
    stage === 'perfect' ? meat.perfectFrom + 0.05 : stage === 'done' ? 1.05 : meat.perfectTo + 0.1;
  const skewer = createSkewer(1, kind);
  skewer.sides = [value, value];
  return skewer;
}

function arrive(kind: GuestKind, overrides: Partial<DayLevel> = {}): { sim: DaySim; guest: Guest } {
  const sim = new DaySim(level(kind, overrides), baseMods(), {});
  advance(sim, 1);
  const guest = sim.seats.find((seat) => seat !== null);
  if (!guest) throw new Error('no guest arrived');
  return { sim, guest };
}

function fill(sim: DaySim, guest: Guest, stage: 'perfect' | 'overdone' | 'done'): void {
  const plate = sim.plates[0];
  if (!plate) throw new Error('no plate');
  for (const item of guest.order.items) {
    for (let index = 0; index < item.count; index += 1)
      plate.skewers.push(cooked(item.kind, stage));
  }
  plate.sides.push(...guest.order.sides);
  plate.drink = guest.order.drink;
}

function tipOf(kind: GuestKind, stage: 'perfect' | 'overdone' | 'done'): number {
  const { sim, guest } = arrive(kind, {
    orders: [{ weight: 1, items: [{ kind: 'lamb', count: 1 }], sides: [], drink: null }],
  });
  fill(sim, guest, stage);
  expect(sim.serve(0, guest.seat)).toBe(true);
  return sim.tips;
}

describe('guest types', () => {
  it('taxi drivers are impatient but tip well', () => {
    const taxi = arrive('taxi').guest;
    const local = arrive('local').guest;
    expect(taxi.patienceSec).toBeLessThan(local.patienceSec);
    expect(tipOf('taxi', 'perfect')).toBeGreaterThan(tipOf('local', 'perfect'));
  });

  it('grandmothers wait long and do not care about the golden window', () => {
    expect(arrive('granny').guest.patienceSec).toBeGreaterThan(arrive('local').guest.patienceSec);
    expect(tipOf('granny', 'overdone')).toBe(tipOf('granny', 'perfect'));
    expect(tipOf('granny', 'overdone')).toBeGreaterThan(tipOf('local', 'overdone'));
  });

  it('students order one skewer, tip little and bring friends when served fast', () => {
    const { sim, guest } = arrive('student');
    expect(guest.order.items).toHaveLength(1);
    expect(guest.order.items[0]?.count).toBe(1);
    expect(tipOf('student', 'perfect')).toBeLessThan(tipOf('local', 'perfect'));

    const coming: number[] = [];
    sim.events.on('friendsComing', ({ count }) => coming.push(count));
    fill(sim, guest, 'perfect');
    expect(sim.serve(0, guest.seat)).toBe(true);
    expect(coming[0]).toBeGreaterThanOrEqual(1);
    advance(sim, 6);
    const friends = sim.seats.filter((seat) => seat?.state === 'waiting');
    expect(friends.length).toBe(coming[0]);
    expect(friends.every((friend) => friend?.kind === 'student' && friend.invited)).toBe(true);
  });

  it('students served slowly come alone', () => {
    const { sim, guest } = arrive('student');
    guest.patienceLeft = guest.patienceSec * 0.3;
    const coming: number[] = [];
    sim.events.on('friendsComing', ({ count }) => coming.push(count));
    fill(sim, guest, 'perfect');
    sim.serve(0, guest.seat);
    expect(coming).toEqual([]);
  });

  it('office groups share one order of three or four skewers', () => {
    const rng = createRng(3);
    for (let index = 0; index < 20; index += 1) {
      const order = orderFor('office', level('office'), rng);
      const total = order.items.reduce((sum, item) => sum + item.count, 0);
      expect(total).toBeGreaterThanOrEqual(3);
      expect(total).toBeLessThanOrEqual(balance.plate.capacity);
    }
  });

  it('athletes double the meat, skip the bread and refuse overdone skewers', () => {
    const rng = createRng(5);
    for (let index = 0; index < 20; index += 1) {
      const order = orderFor('athlete', level('athlete'), rng);
      expect(order.sides).not.toContain('lavash');
      expect(order.items.reduce((sum, item) => sum + item.count, 0)).toBeGreaterThanOrEqual(2);
    }
    const { sim, guest } = arrive('athlete');
    const reasons: string[] = [];
    sim.events.on('rejected', ({ reason }) => reasons.push(reason));
    fill(sim, guest, 'overdone');
    expect(sim.serve(0, guest.seat)).toBe(false);
    expect(reasons).toEqual(['overdone']);
  });

  it('bloggers and critics remember how they were served', () => {
    for (const kind of ['blogger', 'critic'] as const) {
      const good = arrive(kind);
      fill(good.sim, good.guest, 'perfect');
      good.sim.serve(0, good.guest.seat);
      expect(good.sim.verdicts[kind]).toBe(1);

      const poor = arrive(kind);
      fill(poor.sim, poor.guest, 'overdone');
      poor.sim.serve(0, poor.guest.seat);
      expect(poor.sim.verdicts[kind]).toBe(-1);

      const gone = arrive(kind);
      advance(gone.sim, gone.guest.patienceSec + 1);
      expect(gone.sim.verdicts[kind]).toBe(-1);
    }
  });

  it('a critic moves the day result by one star', () => {
    expect(evaluateDay([100, 200, 300], 250, true, 1).stars).toBe(3);
    expect(evaluateDay([100, 200, 300], 250, true, -1).stars).toBe(1);
    expect(evaluateDay([100, 200, 300], 999, true, 1).stars).toBe(3);
    expect(evaluateDay([100, 200, 300], 150, true, -1).stars).toBe(1);
    expect(evaluateDay([100, 200, 300], 50, true, 1).stars).toBe(0);
  });

  it('picks guest types by schedule windows', () => {
    const slots = [
      { type: 'local' as const, weight: 1, fromSec: 0, untilSec: 100 },
      { type: 'office' as const, weight: 50, fromSec: 40, untilSec: 60 },
    ];
    const rng = createRng(9);
    const early = new Set(Array.from({ length: 30 }, () => pickGuestKind(slots, 10, rng)));
    expect([...early]).toEqual(['local']);
    const lunch = Array.from({ length: 30 }, () => pickGuestKind(slots, 50, rng));
    expect(lunch.filter((kind) => kind === 'office').length).toBeGreaterThan(20);
  });
});

describe('regulars', () => {
  it('come back with the next line on every visit', () => {
    const taxi = regularFor('taxi');
    if (!taxi) throw new Error('taxi regular is missing');
    expect(lineIndex(taxi, 0)).toBe(1);
    expect(lineIndex(taxi, 1)).toBe(2);
    expect(lineIndex(taxi, taxi.lines)).toBe(1);
    expect(regularFor('local')).toBeNull();
  });

  it('have a translated line for every visit', () => {
    for (const regular of regulars) {
      const keys = Array.from(
        { length: regular.lines },
        (_, visit) => `regular.${regular.id}.${lineIndex(regular, visit)}`,
      );
      expect(keys.filter((key) => !isTranslationKey(key))).toEqual([]);
    }
  });

  it('visit at most once a day and only when visits are tracked', () => {
    const tracked = new DaySim(
      level('taxi', { guests: { ...level('taxi').guests, intervalSec: [1, 1] } }),
      baseMods(),
      { taxi: 2 },
    );
    const seen: Guest[] = [];
    tracked.events.on('guestArrived', ({ guest }) => seen.push(guest));
    advance(tracked, 12);
    const regularsSeen = seen.filter((guest) => guest.regular === 'taxi');
    expect(regularsSeen).toHaveLength(1);
    expect(regularsSeen[0]?.line).toBe(3);

    const untracked = new DaySim(level('taxi'));
    advance(untracked, 2);
    expect(untracked.seats.find((seat) => seat !== null)?.regular).toBeNull();
  });
});

describe('toy banquet', () => {
  const toy: Partial<DayLevel> = {
    guests: { ...level('local').guests, firstDelaySec: 999 },
    events: [
      {
        type: 'toy',
        atSec: 1,
        durationSec: 60,
        order: [
          { kind: 'lamb', count: 6 },
          { kind: 'chicken', count: 4 },
        ],
      },
    ],
  };

  function banquet(): { sim: DaySim; guest: Guest } {
    const sim = new DaySim(level('local', toy));
    advance(sim, 1.5);
    const guest = sim.seats.find((seat) => seat !== null);
    if (!guest?.banquet) throw new Error('banquet did not start');
    return { sim, guest };
  }

  it('takes the big order plate by plate and pays a bonus at the end', () => {
    const { sim, guest } = banquet();
    expect(guest.banquet?.total).toBe(10);
    const deliver = (kind: MeatKind, count: number): boolean => {
      const plate = sim.plates[0];
      if (!plate) throw new Error('no plate');
      for (let index = 0; index < count; index += 1) plate.skewers.push(cooked(kind, 'perfect'));
      return sim.serve(0, guest.seat);
    };
    expect(deliver('lamb', 4)).toBe(true);
    expect(guest.state).toBe('waiting');
    expect(deliver('lamb', 2)).toBe(true);
    const before = sim.money;
    expect(deliver('chicken', 4)).toBe(true);
    expect(guest.state).toBe('served');
    expect(sim.money - before).toBe(4 * meatOf('chicken').price + 10 * balance.toy.bonusPerSkewer);
    expect(sim.stats.served).toBe(1);
  });

  it('refuses extras, garnish and more skewers than ordered', () => {
    const { sim, guest } = banquet();
    const plate = sim.plates[0];
    if (!plate) throw new Error('no plate');
    plate.skewers.push(cooked('chicken', 'perfect'));
    plate.sides.push('onion');
    expect(sim.serve(0, guest.seat)).toBe(false);
    plate.sides = [];
    for (let index = 0; index < 3; index += 1) plate.skewers.push(cooked('chicken', 'perfect'));
    expect(sim.serve(0, guest.seat)).toBe(true);
    plate.skewers.push(cooked('chicken', 'perfect'));
    expect(sim.serve(0, guest.seat)).toBe(false);
  });

  it('leaves unhappy when the deadline passes', () => {
    const { sim, guest } = banquet();
    advance(sim, 61);
    expect(guest.state).toBe('angry');
    expect(sim.stats.lost).toBe(1);
  });
});

describe('guest and event validation', () => {
  it('rejects unknown guest types and toy events without an order', () => {
    const raw = {
      ...level('local'),
      guests: { ...level('local').guests, types: [{ type: 'pirate', weight: 1 }] },
      events: [{ type: 'toy', atSec: 5, durationSec: 30 }],
    };
    let message = '';
    try {
      parseDayLevel(raw, 'bad');
    } catch (error) {
      message = error instanceof LevelError ? error.message : '';
    }
    expect(message).toContain('guests.types[0].type');
    expect(message).toContain('events[0].order');
  });
});
