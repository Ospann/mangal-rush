import { describe, expect, it } from 'vitest';
import { migrate } from '@core/save';
import { balance, upgradeIds } from '../src/game/balance';
import { campaignDays, dayRefs, daysOf, nextDayId } from '../src/game/levels';
import {
  locationIds,
  locationUpgrades,
  maxUpgradeLevel,
  modsFor,
  upgradeCost,
} from '../src/game/locations';
import {
  applyOutcome,
  buyUpgrade,
  canBuyUpgrade,
  evaluateDay,
  isDayUnlocked,
  isLocationUnlocked,
  totalUpgradeCost,
  type Progress,
} from '../src/game/progress';
import { saveSchema } from '../src/game/save';
import { averageBot, expertBot, reportDay } from '../src/game/sim/bot';
import { DaySim } from '../src/game/sim/day-sim';
import { createSkewer, meatOf } from '../src/game/sim/skewer';

function progress(overrides: Partial<Progress> = {}): Progress {
  return { money: 0, stars: {}, upgrades: {}, ...overrides };
}

function starsFor(location: 'roadside' | 'lake', stars: number): Record<string, number> {
  return Object.fromEntries(daysOf(location).map((day) => [day.id, stars]));
}

describe('stars', () => {
  it('counts revenue thresholds and caps the result when the goal is missed', () => {
    expect(evaluateDay([100, 200, 300], 99, true)).toMatchObject({ stars: 0, passed: false });
    expect(evaluateDay([100, 200, 300], 100, true)).toMatchObject({ stars: 1, passed: true });
    expect(evaluateDay([100, 200, 300], 250, true).stars).toBe(2);
    expect(evaluateDay([100, 200, 300], 999, true).stars).toBe(3);
    expect(evaluateDay([100, 200, 300], 999, false).stars).toBe(balance.progress.goalStarCap);
  });

  it('keeps the best star result and always adds the revenue', () => {
    let state = applyOutcome(progress(), '1-1', evaluateDay([100, 200, 300], 320, true));
    expect(state).toMatchObject({ money: 320, stars: { '1-1': 3 } });
    state = applyOutcome(state, '1-1', evaluateDay([100, 200, 300], 120, true));
    expect(state).toMatchObject({ money: 440, stars: { '1-1': 3 } });
  });
});

describe('unlocks', () => {
  it('opens days one by one', () => {
    const [first, second, third] = daysOf('roadside');
    if (!first || !second || !third) throw new Error('campaign is missing days');
    expect(isDayUnlocked(progress(), first, dayRefs)).toBe(true);
    expect(isDayUnlocked(progress(), second, dayRefs)).toBe(false);
    const state = progress({ stars: { [first.id]: 1 } });
    expect(isDayUnlocked(state, second, dayRefs)).toBe(true);
    expect(isDayUnlocked(state, third, dayRefs)).toBe(false);
  });

  it('opens the next location after every day is passed with enough stars', () => {
    expect(isLocationUnlocked(progress(), 'roadside', dayRefs)).toBe(true);
    expect(isLocationUnlocked(progress(), 'lake', dayRefs)).toBe(false);
    expect(isLocationUnlocked(progress({ stars: starsFor('roadside', 1) }), 'lake', dayRefs)).toBe(
      false,
    );
    const enough = progress({ stars: starsFor('roadside', 2) });
    expect(isLocationUnlocked(enough, 'lake', dayRefs)).toBe(true);
    const first = daysOf('lake')[0];
    if (!first) throw new Error('campaign is missing days');
    expect(isDayUnlocked(enough, first, dayRefs)).toBe(true);
  });

  it('chains campaign days in order', () => {
    expect(nextDayId('1-1')).toBe('1-2');
    expect(nextDayId('1-10')).toBe('2-1');
    expect(nextDayId('2-10')).toBe('3-1');
    expect(nextDayId('5-10')).toBeNull();
  });
});

describe('upgrade economy', () => {
  it('gets more expensive with each level and each location', () => {
    for (const location of locationIds) {
      for (const upgrade of locationUpgrades(location)) {
        const costs = Array.from({ length: maxUpgradeLevel(location, upgrade) }, (_, level) =>
          upgradeCost(location, upgrade, level),
        );
        expect(costs.every((cost) => cost !== null && cost > 0)).toBe(true);
        expect(costs).toEqual(costs.toSorted((a, b) => (a ?? 0) - (b ?? 0)));
        expect(upgradeCost(location, upgrade, costs.length)).toBeNull();
      }
    }
    expect(upgradeCost('lake', 'coal', 0)).toBeGreaterThan(upgradeCost('roadside', 'coal', 0) ?? 0);
  });

  it('charges money, raises the level and stops at the location limit', () => {
    const cost = upgradeCost('roadside', 'grill', 0) ?? 0;
    expect(buyUpgrade(progress({ money: cost - 1 }), 'roadside', 'grill')).toBeNull();
    const bought = buyUpgrade(progress({ money: cost + 5 }), 'roadside', 'grill');
    expect(bought).toMatchObject({ money: 5, upgrades: { roadside: { grill: 1 } } });
    if (!bought) throw new Error('purchase failed');
    expect(canBuyUpgrade({ ...bought, money: 99999 }, 'roadside', 'grill')).toBe(false);
    expect(buyUpgrade(progress({ money: 99999 }), 'roadside', 'canopy')).toBeNull();
  });

  it('keeps upgrades separate per location', () => {
    const state = buyUpgrade(progress({ money: 99999 }), 'roadside', 'coal');
    if (!state) throw new Error('purchase failed');
    expect(modsFor('roadside', state.upgrades.roadside).coalDecayMult).toBeLessThan(1);
    expect(modsFor('lake', state.upgrades.lake).coalDecayMult).toBe(1);
  });

  it('turns levels into day modifiers', () => {
    expect(modsFor('roadside')).toMatchObject({ grillSlots: 4, plates: 2, helper: false });
    const maxed = Object.fromEntries(upgradeIds.map((id) => [id, 99]));
    const mods = modsFor('embankment', maxed);
    expect(mods).toMatchObject({ grillSlots: 8, plates: 4, helper: true, canopy: true });
    expect(mods.autoFanSlots).toBe(2);
    expect(mods.sprayerDelaySec).toBe(balance.upgrades.sprayer.delaySec[2]);
    expect(mods.patienceMult).toBeGreaterThan(1);
    expect(mods.tipMult).toBeGreaterThan(1);
    expect(modsFor('roadside', maxed).grillSlots).toBe(5);
  });

  it('prices a location within reach of its ten days', () => {
    for (const location of locationIds) {
      const twoStarIncome = daysOf(location).reduce((sum, day) => sum + day.stars[1], 0);
      const total = totalUpgradeCost(location);
      expect(total).toBeGreaterThan(twoStarIncome * 0.4);
      expect(total).toBeLessThan(twoStarIncome * 1.6);
    }
  });
});

describe('upgrade effects in the simulation', () => {
  const level = daysOf('lake')[4];
  if (!level) throw new Error('campaign is missing days');

  it('sprayer puts flares out on its own', () => {
    const sim = new DaySim(level, { ...modsFor('lake'), sprayerDelaySec: 1 });
    sim.placeSkewer('lamb', 2);
    const slot = sim.grill.slot(2);
    if (!slot) throw new Error('setup failed');
    slot.flare = true;
    for (let t = 0; t < 1.5; t += 0.1) sim.step(0.1);
    expect(slot.flare).toBe(false);
  });

  it('fan keeps an edge slot boosted while it is in use', () => {
    const sim = new DaySim(level, { ...modsFor('lake'), autoFanSlots: 1 });
    sim.placeSkewer('chicken', 0);
    sim.step(0.1);
    expect(sim.grill.coals.mods[0]).toBeCloseTo(balance.upgrades.fan.boost, 1);
    expect(sim.grill.coals.mods[1]).toBe(0);
  });

  it('helper adds the ordered sides when the plate is served', () => {
    const sim = new DaySim(level, { ...modsFor('lake'), helper: true });
    for (let t = 0; t < 4; t += 0.1) sim.step(0.1);
    const guest = sim.seats.find((seat) => seat !== null);
    const plate = sim.plates[0];
    if (!guest || !plate) throw new Error('setup failed');
    guest.order = { items: [{ kind: 'lamb', count: 1 }], sides: ['onion', 'lavash'], drink: null };
    const skewer = createSkewer(1, 'lamb');
    const cook = meatOf('lamb').perfectFrom + 0.05;
    skewer.sides = [cook, cook];
    plate.skewers.push(skewer);
    expect(sim.serve(0, guest.seat)).toBe(true);
  });

  it('wind raises flares and rain cools the coals unless there is a canopy', () => {
    const windy = {
      ...level,
      events: [{ type: 'wind' as const, atSec: 0, durationSec: 999, order: [] }],
    };
    const flares = (events: typeof level): number => {
      let total = 0;
      for (let seed = 1; seed <= 6; seed += 1) {
        const sim = new DaySim(
          { ...events, seed, guests: { ...events.guests, firstDelaySec: 9999 } },
          { ...modsFor('lake'), sprayerDelaySec: 0.2 },
        );
        for (let slot = 0; slot < 5; slot += 1) sim.placeSkewer('lamb', slot);
        for (let t = 0; t < 25; t += 0.1) sim.step(0.1);
        total += sim.stats.flares;
      }
      return total;
    };
    expect(flares(windy)).toBeGreaterThan(flares({ ...level, events: [] }));

    const rainy = {
      ...level,
      events: [{ type: 'rain' as const, atSec: 0, durationSec: 999, order: [] }],
    };
    const coalAfter = (canopy: boolean): number => {
      const sim = new DaySim(rainy, { ...modsFor('lake'), canopy });
      for (let t = 0; t < 20; t += 0.1) sim.step(0.1);
      return sim.grill.coals.level;
    };
    expect(coalAfter(false)).toBeLessThan(coalAfter(true));
  });
});

describe('campaign', () => {
  it('has ten valid days for each of the five locations', () => {
    expect(daysOf('roadside').map((day) => day.day)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(daysOf('lake').map((day) => day.day)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(daysOf('roadside').every((day) => !day.meats.includes('lamb'))).toBe(true);
    expect(daysOf('lake').every((day) => day.meats.includes('lamb'))).toBe(true);
    for (const location of locationIds) {
      expect(daysOf(location)).toHaveLength(10);
    }
    expect(daysOf('bazaar').every((day) => day.meats.includes('lula'))).toBe(true);
    expect(daysOf('embankment').every((day) => day.meats.includes('fish'))).toBe(true);
    expect(daysOf('embankment').every((day) => day.events.some((e) => e.type === 'rain'))).toBe(
      true,
    );
    expect(daysOf('restaurant').some((day) => day.events.some((e) => e.type === 'toy'))).toBe(true);
    expect(daysOf('restaurant').at(-1)?.meats).toHaveLength(6);
    expect(campaignDays).toHaveLength(50);
  });

  it('days 1-10 are passable for an average bot but not trivial', () => {
    for (const level of daysOf('roadside')) {
      const average = reportDay(level, modsFor(level.location), averageBot, 12);
      expect(average.passRate, `${level.id} pass rate`).toBeGreaterThanOrEqual(0.75);
      expect(average.threeStarRate, `${level.id} three stars`).toBeLessThanOrEqual(0.34);
      const expert = reportDay(level, modsFor(level.location), expertBot, 6);
      expect(expert.avgStars, `${level.id} expert stars`).toBeGreaterThan(average.avgStars);
    }
  });
});

describe('save migration', () => {
  it('migrates a template save to the campaign schema', () => {
    const migrated = migrate(
      { v: 1, data: { highScore: 12, levelsCompleted: 3, soundEnabled: false, language: 'ru' } },
      saveSchema,
    );
    expect(migrated).toEqual({
      money: 0,
      stars: {},
      upgrades: {},
      regulars: {},
      buzz: 0,
      soundEnabled: false,
      language: 'ru',
    });
  });

  it('keeps settings from version 2 and starts fresh progress', () => {
    const migrated = migrate(
      { v: 2, data: { bestScore: 40, levelsCompleted: 1, soundEnabled: true, language: null } },
      saveSchema,
    );
    expect(migrated).toMatchObject({ money: 0, stars: {}, upgrades: {}, soundEnabled: true });
    expect(migrated).not.toHaveProperty('bestScore');
  });

  it('loads a current save unchanged', () => {
    const data = {
      money: 500,
      stars: { '1-1': 3 },
      upgrades: { roadside: { grill: 1 } },
      regulars: { taxi: 2 },
      buzz: 1,
      soundEnabled: true,
      language: 'tr',
    };
    expect(migrate({ v: saveSchema.version, data }, saveSchema)).toEqual(data);
  });
});
