import { describe, expect, it } from 'vitest';
import { balance } from '../src/game/balance';
import { Coals } from '../src/game/sim/coals';
import { flareChancePerSec, Grill, type GrillEvent } from '../src/game/sim/grill';
import { createRng } from '../src/game/sim/rng';
import {
  cookSkewer,
  createSkewer,
  flipSkewer,
  meatOf,
  qualityOf,
  sideStage,
  stageOf,
} from '../src/game/sim/skewer';

const STEP = balance.simStepSec;

function run(grill: Grill, seconds: number): GrillEvent[] {
  const events: GrillEvent[] = [];
  for (let t = 0; t < seconds; t += STEP) events.push(...grill.tick(STEP));
  return events;
}

function flareTimeline(seed: number): string {
  const grill = new Grill(4, createRng(seed), 1);
  for (let slot = 0; slot < 4; slot += 1) grill.place('lamb', slot);
  const marks: string[] = [];
  for (let step = 0; step < 900; step += 1) {
    for (const event of grill.tick(STEP)) {
      if (event.type === 'flare') marks.push(`${step}:${event.slot}`);
    }
  }
  return marks.join(',');
}

describe('doneness', () => {
  it('maps cook values to stages using the meat windows', () => {
    const lamb = meatOf('lamb');
    expect(stageOf(0.99, lamb)).toBe('raw');
    expect(stageOf(1, lamb)).toBe('done');
    expect(stageOf(lamb.perfectFrom, lamb)).toBe('perfect');
    expect(stageOf(lamb.perfectTo, lamb)).toBe('perfect');
    expect(stageOf(lamb.perfectTo + 0.01, lamb)).toBe('overdone');
    expect(stageOf(lamb.burntAt, lamb)).toBe('burnt');
  });

  it('gives chicken a wider golden window than lamb', () => {
    const chicken = meatOf('chicken');
    const lamb = meatOf('lamb');
    const window = (meat: typeof chicken): number =>
      (meat.perfectTo - meat.perfectFrom) * meat.cookSec;
    expect(window(chicken)).toBeGreaterThan(window(lamb));
    expect(chicken.cookSec).toBeLessThan(lamb.cookSec);
  });
});

describe('skewer', () => {
  it('cooks only the side facing the coals', () => {
    const skewer = createSkewer(1, 'chicken');
    cookSkewer(skewer, meatOf('chicken').cookSec, 1);
    expect(skewer.sides[0]).toBeCloseTo(1);
    expect(skewer.sides[1]).toBe(0);
    flipSkewer(skewer);
    cookSkewer(skewer, meatOf('chicken').cookSec / 2, 1);
    expect(skewer.sides[0]).toBeCloseTo(1);
    expect(skewer.sides[1]).toBeCloseTo(0.5);
    expect(skewer.flips).toBe(1);
  });

  it('cooks proportionally to heat', () => {
    const hot = createSkewer(1, 'lamb');
    const cold = createSkewer(2, 'lamb');
    cookSkewer(hot, 3, 1);
    cookSkewer(cold, 3, 0.5);
    expect(hot.sides[0]).toBeCloseTo(cold.sides[0] * 2);
  });

  it('rates a skewer by its worst side', () => {
    const meat = meatOf('chicken');
    const skewer = createSkewer(1, 'chicken');
    skewer.sides = [meat.perfectFrom + 0.1, 0.5];
    expect(qualityOf(skewer)).toBe('raw');
    skewer.sides = [meat.perfectFrom + 0.1, 1.05];
    expect(qualityOf(skewer)).toBe('done');
    skewer.sides = [meat.perfectFrom + 0.1, meat.perfectFrom + 0.2];
    expect(qualityOf(skewer)).toBe('perfect');
    skewer.sides = [meat.perfectFrom + 0.1, meat.perfectTo + 0.1];
    expect(qualityOf(skewer)).toBe('overdone');
    skewer.sides = [meat.burntAt, meat.perfectFrom + 0.1];
    expect(qualityOf(skewer)).toBe('burnt');
    expect(sideStage(skewer, 0)).toBe('burnt');
  });
});

describe('coals', () => {
  it('is hotter in the centre than at the edges', () => {
    const coals = new Coals(4, 0.8);
    expect(coals.heat(1)).toBeGreaterThan(coals.heat(0));
    expect(coals.heat(1)).toBeCloseTo(coals.heat(2));
    expect(coals.heat(0)).toBeCloseTo(coals.heat(3));
  });

  it('loses heat over time but never below the minimum', () => {
    const coals = new Coals(4, 0.8);
    const before = coals.heat(1);
    for (let t = 0; t < 30; t += STEP) coals.tick(STEP);
    expect(coals.heat(1)).toBeLessThan(before);
    for (let t = 0; t < 600; t += STEP) coals.tick(STEP);
    expect(coals.level).toBeCloseTo(balance.coals.minLevel);
  });

  it('fanning boosts only the fanned slot and the boost fades', () => {
    const coals = new Coals(4, 0.6);
    const base = coals.heat(1);
    const other = coals.heat(2);
    coals.fan(1, 0.3);
    expect(coals.heat(1)).toBeCloseTo(base + 0.3);
    expect(coals.heat(2)).toBeCloseTo(other);
    coals.fan(1, 5);
    expect(coals.mods[1]).toBe(balance.fan.maxBoost);
    for (let t = 0; t < 10; t += STEP) coals.tick(STEP);
    expect(coals.mods[1]).toBe(0);
  });

  it('fresh coals smoke first, then burn hotter, and have a cooldown', () => {
    const coals = new Coals(4, 0.4);
    const before = coals.heat(1);
    expect(coals.add()).toBe(true);
    expect(coals.isSmoking).toBe(true);
    expect(coals.heat(1)).toBeLessThan(before);
    expect(coals.add()).toBe(false);
    for (let t = 0; t < balance.coals.smokeSec + 0.1; t += STEP) coals.tick(STEP);
    expect(coals.isSmoking).toBe(false);
    expect(coals.heat(1)).toBeGreaterThan(before);
    for (let t = 0; t < balance.coals.addCooldownSec; t += STEP) coals.tick(STEP);
    expect(coals.add()).toBe(true);
  });
});

describe('flares', () => {
  it('never flare below the minimum heat and flare more with heat and fat', () => {
    const { minHeat } = balance.flare;
    expect(flareChancePerSec(minHeat - 0.01, 1)).toBe(0);
    expect(flareChancePerSec(1, 1)).toBeGreaterThan(flareChancePerSec(0.6, 1));
    expect(flareChancePerSec(1, meatOf('lamb').fat)).toBeGreaterThan(
      flareChancePerSec(1, meatOf('chicken').fat),
    );
  });

  it('are deterministic for a given seed', () => {
    expect(flareTimeline(7)).not.toBe('');
    expect(flareTimeline(7)).toBe(flareTimeline(7));
    expect(flareTimeline(7)).not.toBe(flareTimeline(8));
  });

  it('overcook the skewer above them until splashed, and water chills the slot', () => {
    const calm = new Grill(4, createRng(1), 1);
    const burning = new Grill(4, createRng(1), 1);
    const a = calm.place('chicken', 1);
    const b = burning.place('chicken', 1);
    const slot = burning.slot(1);
    if (!a || !b || !slot) throw new Error('setup failed');
    a.sides[0] = 0.3;
    b.sides[0] = 0.3;
    slot.flare = true;
    calm.tick(STEP);
    burning.tick(STEP);
    expect(b.sides[0] - 0.3).toBeCloseTo((a.sides[0] - 0.3) * balance.flare.cookMult);

    const heatBefore = burning.coals.heat(1);
    expect(burning.splash(1)).toBe(true);
    expect(slot.flare).toBe(false);
    expect(burning.coals.heat(1)).toBeLessThan(heatBefore);
    expect(burning.splash(1)).toBe(false);
  });

  it('die out on their own shortly after the slot is emptied', () => {
    const grill = new Grill(4, createRng(1), 1);
    grill.place('lamb', 2);
    const slot = grill.slot(2);
    if (!slot) throw new Error('setup failed');
    slot.flare = true;
    grill.take(2);
    const events = run(grill, balance.flare.emptySlotSec + 0.2);
    expect(slot.flare).toBe(false);
    expect(events).toContainEqual({ type: 'flareOut', slot: 2, by: 'empty' });
  });
});

describe('grill', () => {
  it('does not cook a lifted skewer', () => {
    const grill = new Grill(4, createRng(1), 1);
    const skewer = grill.place('chicken', 1);
    if (!skewer) throw new Error('setup failed');
    grill.setLifted(1, true);
    run(grill, 3);
    expect(skewer.sides[0]).toBe(0);
    grill.setLifted(1, false);
    run(grill, 1);
    expect(skewer.sides[0]).toBeGreaterThan(0);
  });

  it('reports stage changes of the side facing the coals', () => {
    const grill = new Grill(1, createRng(1), 1);
    grill.place('chicken', 0);
    const stages = run(grill, 14)
      .filter((event) => event.type === 'stage')
      .map((event) => event.stage);
    expect(stages.slice(0, 3)).toEqual(['done', 'perfect', 'overdone']);
  });

  it('moves skewers only into free slots', () => {
    const grill = new Grill(4, createRng(1));
    grill.place('chicken', 0);
    grill.place('lamb', 1);
    expect(grill.move(0, 1)).toBe(false);
    expect(grill.move(0, 3)).toBe(true);
    expect(grill.isFree(0)).toBe(true);
    expect(grill.slot(3)?.skewer?.kind).toBe('chicken');
    expect(grill.place('lamb', 3)).toBeNull();
  });
});
