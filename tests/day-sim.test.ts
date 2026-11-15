import { describe, expect, it } from 'vitest';
import { balance } from '../src/game/balance';
import { loadDay } from '../src/game/levels';
import type { DayLevel } from '../src/game/levels/types';
import { LevelError, parseDayLevel } from '../src/game/levels/validate';
import { DaySim } from '../src/game/sim/day-sim';
import { checkPlate, comboMultiplier, payFor } from '../src/game/sim/orders';
import { createSkewer, meatOf, type Skewer } from '../src/game/sim/skewer';
import type { MeatKind } from '../src/game/balance';

function cooked(kind: MeatKind, a: number, b: number): Skewer {
  const skewer = createSkewer(1, kind);
  skewer.sides = [a, b];
  return skewer;
}

function perfect(kind: MeatKind): Skewer {
  const value = meatOf(kind).perfectFrom + 0.05;
  return cooked(kind, value, value);
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
    start: { coalLevel: 0.8 },
    guests: { firstDelaySec: 1, intervalSec: [2, 2], patienceSec: 10 },
    orders: [{ weight: 1, items: [{ kind: 'chicken', count: 1 }] }],
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
  const order = {
    items: [
      { kind: 'chicken' as const, count: 2 },
      { kind: 'lamb' as const, count: 1 },
    ],
  };

  it('accepts a plate that matches the order exactly', () => {
    expect(checkPlate(order, [perfect('chicken'), perfect('lamb'), perfect('chicken')])).toBeNull();
  });

  it('rejects wrong, raw and burnt plates', () => {
    expect(checkPlate(order, [perfect('chicken'), perfect('lamb')])).toBe('wrong');
    expect(checkPlate(order, [perfect('chicken'), perfect('lamb'), perfect('lamb')])).toBe('wrong');
    expect(
      checkPlate(order, [perfect('chicken'), perfect('lamb'), cooked('chicken', 1.4, 0.2)]),
    ).toBe('raw');
    expect(
      checkPlate(order, [perfect('chicken'), perfect('lamb'), cooked('chicken', 9, 1.4)]),
    ).toBe('burnt');
  });
});

describe('tips and combo', () => {
  it('tips perfect over done over overdone', () => {
    const lamb = meatOf('lamb');
    const done = payFor([cooked('lamb', 1.05, 1.05)], 0, 0);
    const best = payFor([perfect('lamb')], 0, 0);
    const over = payFor([cooked('lamb', lamb.perfectTo + 0.1, 1.4)], 0, 0);
    expect(best.price).toBe(lamb.price);
    expect(best.tip).toBeGreaterThan(done.tip);
    expect(done.tip).toBeGreaterThan(over.tip);
    expect(over.tip).toBe(0);
    expect(best.allPerfect).toBe(true);
    expect(done.allPerfect).toBe(false);
  });

  it('tips more for fast service', () => {
    expect(payFor([perfect('lamb')], 1, 0).tip).toBeGreaterThan(
      payFor([perfect('lamb')], 0.1, 0).tip,
    );
  });

  it('multiplies tips by the combo up to a cap', () => {
    expect(comboMultiplier(0)).toBe(1);
    expect(comboMultiplier(3)).toBeCloseTo(1 + 3 * balance.tips.comboStep);
    expect(comboMultiplier(999)).toBe(balance.tips.comboMax);
    expect(payFor([perfect('lamb')], 1, 4).tip).toBeGreaterThan(
      payFor([perfect('lamb')], 1, 0).tip,
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
      level({ orders: [{ weight: 1, items: [{ kind: 'chicken', count: 1 }] }] }),
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
    expect(sim.trashPlate(0)).toBe(true);
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
