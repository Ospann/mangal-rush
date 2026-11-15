import { describe, expect, it } from 'vitest';
import { balance } from '../src/game/balance';
import {
  advanceDaily,
  createDaily,
  currentDaily,
  dateKey,
  isDailyDone,
  isDailyTask,
  type DailyTask,
} from '../src/game/daily';
import { availableMeats, dayRefs, toyLevel, toyMods } from '../src/game/levels';
import { isToyUnlocked, type Progress } from '../src/game/progress';
import { averageBot, runToy } from '../src/game/sim/bot';
import { DaySim } from '../src/game/sim/day-sim';

const fresh: Progress = { money: 0, stars: {}, upgrades: {} };

function idleToy(): DaySim {
  return new DaySim(toyLevel(7), toyMods(), null, balance.toyMode);
}

function runUntil(sim: DaySim, done: () => boolean, limitSec = 900): void {
  while (!done() && !sim.finished && sim.timeSec < limitSec) sim.step(balance.simStepSec);
}

describe('toy mode', () => {
  it('unlocks once every day of the first location is passed', () => {
    expect(isToyUnlocked(fresh, dayRefs)).toBe(false);
    const stars = Object.fromEntries(
      dayRefs.filter((day) => day.location === 'roadside').map((day) => [day.id, 1]),
    );
    expect(isToyUnlocked({ ...fresh, stars }, dayRefs)).toBe(true);
    const { '1-10': _last, ...partial } = stars;
    expect(isToyUnlocked({ ...fresh, stars: partial }, dayRefs)).toBe(false);
  });

  it('ends when the third unhappy guest has left, not on a timer', () => {
    const sim = idleToy();
    runUntil(sim, () => false);
    expect(sim.finished).toBe(true);
    expect(sim.stats.lost).toBe(balance.toyMode.maxLost);
    expect(sim.timeSec).toBeLessThan(sim.level.durationSec);
  });

  it('sends guests faster as the feast goes on', () => {
    const arrivals: number[] = [];
    const level = toyLevel(3);
    const guests = { ...level.guests, patienceSec: 1 };
    const sim = new DaySim({ ...level, guests, events: [] }, toyMods(), null, {
      ...balance.toyMode,
      maxLost: 10_000,
    });
    sim.events.on('guestArrived', () => arrivals.push(sim.timeSec));
    runUntil(sim, () => false, 800);
    const early = arrivals.filter((time) => time < 150).length;
    const late = arrivals.filter((time) => time >= 650).length;
    expect(late).toBeGreaterThan(early);
  });

  it('brings an angry guest back with full patience', () => {
    const sim = idleToy();
    let seat = -1;
    sim.events.on('guestLeft', ({ guest }) => {
      if (guest.state === 'angry' && seat === -1) seat = guest.seat;
    });
    runUntil(sim, () => seat !== -1);
    expect(sim.stats.lost).toBe(1);
    expect(sim.reviveGuest(seat)).toBe(true);
    const guest = sim.seats[seat];
    expect(guest?.state).toBe('waiting');
    expect(guest?.patienceLeft).toBe(guest?.patienceSec);
    expect(sim.stats.lost).toBe(0);
    expect(sim.reviveGuest(seat)).toBe(false);
  });

  it('restores full heat without smoke on fresh coals', () => {
    const sim = idleToy();
    runUntil(sim, () => sim.timeSec > 20);
    sim.addCoals();
    expect(sim.grill.coals.isSmoking).toBe(true);
    expect(sim.freshCoals()).toBe(true);
    expect(sim.grill.coals.level).toBe(1);
    expect(sim.grill.coals.isSmoking).toBe(false);
  });

  it('lets an average bot hold out for a while but not forever', () => {
    const runs = [1, 2, 3, 4].map((seed) => runToy(toyLevel(), toyMods(), averageBot, seed));
    for (const run of runs) {
      expect(run.timeSec).toBeGreaterThan(60);
      expect(run.timeSec).toBeLessThan(3600);
      expect(run.served).toBeGreaterThan(3);
    }
  });
});

describe('daily task', () => {
  it('formats the device date as a local day key', () => {
    expect(dateKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(dateKey(new Date(2026, 10, 15, 0, 1))).toBe('2026-11-15');
  });

  it('is the same all day and changes between days', () => {
    const meats = ['chicken', 'lamb'] as const;
    expect(createDaily('2026-11-15', meats)).toEqual(createDaily('2026-11-15', meats));
    const month = Array.from({ length: 30 }, (_, day) =>
      createDaily(`2026-11-${String(day + 1).padStart(2, '0')}`, meats),
    );
    expect(new Set(month.map((task) => task.kind)).size).toBe(3);
    for (const task of month) {
      expect(task.target).toBeGreaterThan(0);
      expect(task.reward).toBe(balance.daily.reward);
      expect(task.kind === 'perfect').toBe(task.meat !== null);
      expect([null, ...meats]).toContain(task.meat);
    }
  });

  it('only asks for meat the player can already grill', () => {
    expect(availableMeats(fresh)).toEqual(['chicken']);
    const month = Array.from({ length: 30 }, (_, day) =>
      createDaily(`2027-01-${String(day + 1).padStart(2, '0')}`, availableMeats(fresh)),
    );
    for (const task of month) expect(task.meat ?? 'chicken').toBe('chicken');
  });

  it('keeps progress within a day and resets on a new date', () => {
    const today = createDaily('2026-11-15', ['chicken']);
    const saved = { ...today, progress: 2 };
    expect(currentDaily(saved, '2026-11-15', ['chicken'])).toBe(saved);
    const next = currentDaily(saved, '2026-11-16', ['chicken']);
    expect(next.date).toBe('2026-11-16');
    expect(next.progress).toBe(0);
    expect(currentDaily({ date: '2026-11-15', kind: 'dance' }, '2026-11-15', []).progress).toBe(0);
    expect(isDailyTask(null)).toBe(false);
  });

  it('counts only matching events and stops at the target', () => {
    const task: DailyTask = {
      date: '2026-11-15',
      kind: 'perfect',
      meat: 'lamb',
      target: 2,
      reward: 250,
      progress: 0,
      claimed: false,
    };
    expect(advanceDaily(task, { kind: 'serve' })).toBe(task);
    expect(advanceDaily(task, { kind: 'perfect', meat: 'chicken' })).toBe(task);
    const one = advanceDaily(task, { kind: 'perfect', meat: 'lamb' });
    const two = advanceDaily(one, { kind: 'perfect', meat: 'lamb' });
    expect(one.progress).toBe(1);
    expect(isDailyDone(one)).toBe(false);
    expect(isDailyDone(two)).toBe(true);
    expect(advanceDaily(two, { kind: 'perfect', meat: 'lamb' })).toBe(two);

    const tips: DailyTask = { ...task, kind: 'tips', meat: null, target: 100 };
    expect(advanceDaily(tips, { kind: 'tips', amount: 70 }).progress).toBe(70);
    expect(
      advanceDaily(advanceDaily(tips, { kind: 'tips', amount: 70 }), { kind: 'tips', amount: 70 })
        .progress,
    ).toBe(100);
    expect(advanceDaily({ ...two, claimed: true }, { kind: 'perfect', meat: 'lamb' }).claimed).toBe(
      true,
    );
  });
});
