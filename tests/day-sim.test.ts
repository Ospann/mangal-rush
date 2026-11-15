import { describe, expect, it } from 'vitest';
import { balance, meatKinds } from '../src/game/balance';
import { loadDay } from '../src/game/levels';
import type { DayLevel } from '../src/game/levels/types';
import { LevelError, parseDayLevel } from '../src/game/levels/validate';
import { DaySim } from '../src/game/sim/day-sim';
import {
  checkPlate,
  comboMultiplier,
  emptyPlate,
  payFor,
  type Order,
  type Plate,
} from '../src/game/sim/orders';
import { createSkewer, meatOf, type Skewer } from '../src/game/sim/skewer';
import type { DrinkKind, MeatKind, SideKind } from '../src/game/balance';

function cooked(kind: MeatKind, a: number, b: number): Skewer {
  const skewer = createSkewer(1, kind);
  skewer.sides = [a, b];
  return skewer;
}

function perfect(kind: MeatKind): Skewer {
  const value = meatOf(kind).perfectFrom + 0.05;
  return cooked(kind, value, value);
}

function plate(skewers: Skewer[], sides: SideKind[] = [], drink: DrinkKind | null = null): Plate {
  return { ...emptyPlate(), skewers, sides, drink };
}

function windowOf(kind: MeatKind): number {
  return meatOf(kind).perfectTo - meatOf(kind).perfectFrom;
}

function level(overrides: Partial<DayLevel> = {}): DayLevel {
  return {
    id: 'unit',
    location: 'roadside',
    durationSec: 30,
    seed: 5,
    grillSlots: 4,
    plates: 2,
    seats: 2,
    meats: ['chicken', 'lamb'],
    sides: ['onion', 'lavash'],
    drinks: ['ayran', 'tea', 'kompot'],
    start: { coalLevel: 0.8, ayran: 2 },
    day: 0,
    goal: { type: 'serve', value: 3 },
    stars: [50, 100, 150],
    events: [],
    guests: { firstDelaySec: 1, intervalSec: [2, 2], patienceSec: 10 },
    orders: [{ weight: 1, items: [{ kind: 'chicken', count: 1 }], sides: [], drink: null }],
    ...overrides,
  };
}

function advance(sim: DaySim, seconds: number): void {
  for (let t = 0; t < seconds; t += 0.1) sim.step(0.1);
}

function arrivals(): string {
  const sim = new DaySim(level({ durationSec: 20 }));
  const log: string[] = [];
  sim.events.on('guestArrived', ({ guest }) => log.push(`${sim.timeSec.toFixed(2)}:${guest.look}`));
  for (let t = 0; t < 30; t += 0.1) sim.step(0.1);
  return log.join('|');
}

function levelErrorOf(raw: unknown): string {
  try {
    parseDayLevel(raw, 'broken');
  } catch (error) {
    return error instanceof LevelError ? error.message : '';
  }
  return '';
}

describe('orders', () => {
  const order: Order = {
    items: [
      { kind: 'chicken', count: 2 },
      { kind: 'lamb', count: 1 },
    ],
    sides: [],
    drink: null,
  };

  it('accepts a plate that matches the order exactly', () => {
    expect(
      checkPlate(order, plate([perfect('chicken'), perfect('lamb'), perfect('chicken')])),
    ).toBeNull();
  });

  it('rejects wrong, raw and burnt plates', () => {
    expect(checkPlate(order, plate([perfect('chicken'), perfect('lamb')]))).toBe('wrong');
    expect(checkPlate(order, plate([perfect('chicken'), perfect('lamb'), perfect('lamb')]))).toBe(
      'wrong',
    );
    expect(
      checkPlate(order, plate([perfect('chicken'), perfect('lamb'), cooked('chicken', 1.4, 0.2)])),
    ).toBe('raw');
    expect(
      checkPlate(order, plate([perfect('chicken'), perfect('lamb'), cooked('chicken', 9, 1.4)])),
    ).toBe('burnt');
  });
});

describe('sides and drinks', () => {
  const order: Order = {
    items: [{ kind: 'lamb', count: 1 }],
    sides: ['onion', 'lavash'],
    drink: 'tea',
  };

  it('requires exactly the ordered sides and drink', () => {
    expect(checkPlate(order, plate([perfect('lamb')], ['lavash', 'onion'], 'tea'))).toBeNull();
    expect(checkPlate(order, plate([perfect('lamb')], ['onion'], 'tea'))).toBe('wrong');
    expect(checkPlate(order, plate([perfect('lamb')], ['onion', 'lavash'], null))).toBe('wrong');
    expect(checkPlate(order, plate([perfect('lamb')], ['onion', 'lavash'], 'ayran'))).toBe('wrong');
    expect(checkPlate(order, plate([perfect('lamb')], ['onion', 'lavash', 'sauce'], 'tea'))).toBe(
      'wrong',
    );
  });

  it('charges for sides and drinks', () => {
    const full = payFor(plate([perfect('lamb')], ['onion', 'lavash'], 'tea'), 0, 0);
    expect(full.price).toBe(
      meatOf('lamb').price + balance.sides.onion + balance.sides.lavash + balance.drinks.tea,
    );
  });

  it('adds sides and drinks to the active plate and removes the last item first', () => {
    const sim = new DaySim(level());
    sim.selectPlate(1);
    expect(sim.addSide('onion')).toBe(true);
    expect(sim.addSide('onion')).toBe(false);
    expect(sim.addSide('tomato')).toBe(false);
    expect(sim.tapDrink('kompot')).toBe(true);
    expect(sim.tapDrink('kompot')).toBe(false);
    expect(sim.plates[1]).toMatchObject({ sides: ['onion'], drink: 'kompot' });
    expect(sim.plates[0]).toMatchObject({ sides: [], drink: null });
    expect(sim.removeLast(1)).toBe(true);
    expect(sim.plates[1]).toMatchObject({ sides: ['onion'], drink: null });
    expect(sim.removeLast(1)).toBe(true);
    expect(sim.plates[1]?.sides).toEqual([]);
  });

  it('brews tea, pours it hot and lets it go cold', () => {
    const sim = new DaySim(level({ durationSec: 300 }));
    expect(sim.tapDrink('tea')).toBe(true);
    expect(sim.teapot.state).toBe('brewing');
    expect(sim.tapDrink('tea')).toBe(false);
    advance(sim, balance.tea.brewSec + 0.2);
    expect(sim.teapot.state).toBe('hot');
    expect(sim.tapDrink('tea')).toBe(true);
    expect(sim.plates[0]?.drink).toBe('tea');
    expect(sim.teapot.state).toBe('idle');

    sim.tapDrink('tea');
    advance(sim, balance.tea.brewSec + balance.tea.hotSec + 0.5);
    expect(sim.teapot.state).toBe('cold');
    sim.selectPlate(1);
    expect(sim.tapDrink('tea')).toBe(true);
    expect(sim.teapot.state).toBe('brewing');
    expect(sim.plates[1]?.drink).toBeNull();
  });

  it('runs out of ayran and restocks after a cooldown', () => {
    const sim = new DaySim(level({ durationSec: 300 }));
    expect(sim.tapDrink('ayran')).toBe(true);
    sim.selectPlate(1);
    expect(sim.tapDrink('ayran')).toBe(true);
    expect(sim.fridge.stock).toBe(0);
    sim.removeLast(1);
    expect(sim.tapDrink('ayran')).toBe(true);
    expect(sim.plates[1]?.drink).toBeNull();
    expect(sim.fridge.refillLeftSec).toBeGreaterThan(0);
    advance(sim, balance.ayran.refillSec + 0.2);
    expect(sim.fridge.stock).toBe(2);
    expect(sim.tapDrink('ayran')).toBe(true);
    expect(sim.plates[1]?.drink).toBe('ayran');
  });
});

describe('delicate skewers', () => {
  it('lula falls apart when flipped too early', () => {
    const sim = new DaySim(level({ meats: ['lula'] }));
    const broke: string[] = [];
    sim.events.on('broke', ({ reason }) => broke.push(reason));
    sim.placeSkewer('lula', 1);
    advance(sim, 1);
    expect(sim.flip(1)).toBe(false);
    expect(broke).toEqual(['early']);
    expect(sim.grill.isFree(1)).toBe(true);

    sim.placeSkewer('lula', 1);
    const skewer = sim.grill.slot(1)?.skewer;
    if (!skewer) throw new Error('setup failed');
    skewer.sides[0] = meatOf('lula').minFlipCook ?? 0;
    expect(sim.flip(1)).toBe(true);
  });

  it('fish survives two flips and breaks on the third', () => {
    const sim = new DaySim(level({ meats: ['fish'] }));
    sim.placeSkewer('fish', 2);
    expect(sim.flip(2)).toBe(true);
    expect(sim.flip(2)).toBe(true);
    expect(sim.flip(2)).toBe(false);
    expect(sim.grill.isFree(2)).toBe(true);
    expect(sim.stats.broken).toBe(1);
  });

  it('beef has the narrowest window and vegetables cook fastest', () => {
    const others = meatKinds.filter((kind) => kind !== 'beef');
    expect(Math.min(...others.map(windowOf))).toBeGreaterThan(windowOf('beef'));
    const meats = meatKinds.filter((kind) => kind !== 'veg');
    expect(Math.min(...meats.map((kind) => meatOf(kind).cookSec))).toBeGreaterThan(
      meatOf('veg').cookSec,
    );
  });
});

describe('tips and combo', () => {
  it('tips perfect over done over overdone', () => {
    const lamb = meatOf('lamb');
    const done = payFor(plate([cooked('lamb', 1.05, 1.05)]), 0, 0);
    const best = payFor(plate([perfect('lamb')]), 0, 0);
    const over = payFor(plate([cooked('lamb', lamb.perfectTo + 0.1, 1.4)]), 0, 0);
    expect(best.price).toBe(lamb.price);
    expect(best.tip).toBeGreaterThan(done.tip);
    expect(done.tip).toBeGreaterThan(over.tip);
    expect(over.tip).toBe(0);
    expect(best.allPerfect).toBe(true);
    expect(done.allPerfect).toBe(false);
  });

  it('tips more for fast service', () => {
    expect(payFor(plate([perfect('lamb')]), 1, 0).tip).toBeGreaterThan(
      payFor(plate([perfect('lamb')]), 0.1, 0).tip,
    );
  });

  it('multiplies tips by the combo up to a cap', () => {
    expect(comboMultiplier(0)).toBe(1);
    expect(comboMultiplier(3)).toBeCloseTo(1 + 3 * balance.tips.comboStep);
    expect(comboMultiplier(999)).toBe(balance.tips.comboMax);
    expect(payFor(plate([perfect('lamb')]), 1, 4).tip).toBeGreaterThan(
      payFor(plate([perfect('lamb')]), 1, 0).tip,
    );
  });
});

describe('DaySim', () => {
  it('seats guests, pays for a correct plate and builds a combo', () => {
    const sim = new DaySim(level());
    advance(sim, 1.2);
    const guest = sim.seats[0];
    expect(guest?.state).toBe('waiting');

    sim.plates[0]?.skewers.push(perfect('chicken'));
    expect(sim.serve(0, 0)).toBe(true);
    expect(sim.money).toBe(meatOf('chicken').price);
    expect(sim.tips).toBeGreaterThan(0);
    expect(sim.combo).toBe(1);
    expect(sim.plates[0]?.skewers).toHaveLength(0);
    expect(sim.stats.served).toBe(1);
  });

  it('rejects a wrong plate and keeps it', () => {
    const sim = new DaySim(level());
    advance(sim, 1.2);
    const reasons: string[] = [];
    sim.events.on('rejected', ({ reason }) => reasons.push(reason));
    sim.plates[0]?.skewers.push(perfect('lamb'));
    expect(sim.serve(0, 0)).toBe(false);
    expect(reasons).toEqual(['wrong']);
    expect(sim.plates[0]?.skewers).toHaveLength(1);
    expect(sim.money).toBe(0);
  });

  it('loses impatient guests and resets the combo', () => {
    const sim = new DaySim(level());
    sim.combo = 3;
    for (let t = 0; t < 12; t += 0.25) sim.step(0.25);
    expect(sim.stats.lost).toBeGreaterThan(0);
    expect(sim.combo).toBe(0);
  });

  it('finishes after the timer once the counter is empty', () => {
    const sim = new DaySim(level({ durationSec: 12 }));
    let finished = 0;
    sim.events.on('finished', () => {
      finished += 1;
    });
    for (let t = 0; t < 40; t += 0.25) sim.step(0.25);
    expect(sim.finished).toBe(true);
    expect(finished).toBe(1);
    expect(sim.timeSec).toBeGreaterThanOrEqual(12);
  });

  it('cooks, flips and plates a skewer through commands', () => {
    const sim = new DaySim(
      level({
        orders: [{ weight: 1, items: [{ kind: 'chicken', count: 1 }], sides: [], drink: null }],
      }),
    );
    expect(sim.placeSkewer('chicken', 1)).toBe(true);
    expect(sim.placeSkewer('chicken', 1)).toBe(false);
    const skewer = sim.grill.slot(1)?.skewer;
    if (!skewer) throw new Error('setup failed');
    sim.step(0.4);
    sim.step(0.4);
    expect(skewer.sides[0]).toBeGreaterThan(0);
    expect(sim.flip(1)).toBe(true);
    expect(skewer.down).toBe(1);
    expect(sim.takeToPlate(1, 0)).toBe(true);
    expect(sim.grill.isFree(1)).toBe(true);
    expect(sim.plates[0]?.skewers[0]).toBe(skewer);
    expect(sim.removeLast(0)).toBe(true);
    expect(sim.plates[0]?.skewers).toHaveLength(0);
    expect(sim.removeLast(0)).toBe(false);
    expect(sim.stats.trashed).toBe(1);
  });

  it('is deterministic for the same level', () => {
    expect(arrivals()).not.toBe('');
    expect(arrivals()).toBe(arrivals());
  });
});

describe('level validation', () => {
  it('loads the bundled test day', () => {
    const day = loadDay('test');
    expect(day.grillSlots).toBe(4);
    expect(day.meats).toEqual(['chicken', 'lamb']);
  });

  it('reports every problem with its path', () => {
    const broken = {
      ...level(),
      durationSec: -5,
      meats: ['chicken', 'tofu'],
      orders: [{ weight: 1, items: [{ kind: 'lamb', count: 9 }] }],
    };
    const message = levelErrorOf(broken);
    expect(message).toContain('Invalid level "broken"');
    expect(message).toContain('durationSec');
    expect(message).toContain('meats[1]');
    expect(message).toContain('orders[0].items[0].count');
    expect(message).toContain('orders[0].items[0].kind');
  });

  it('rejects non-object input', () => {
    expect(() => parseDayLevel(null)).toThrow(LevelError);
  });
});
