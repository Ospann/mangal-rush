import { balance, type DrinkKind, type MeatKind } from '../balance';
import type { DayLevel } from '../levels/types';
import type { DayMods } from '../locations';
import { evaluateDay, type DayOutcome } from '../progress';
import { DaySim, type DayStats, type Guest } from './day-sim';
import { banquetNeeds, checkGuestPlate } from './guests';
import type { Plate } from './orders';
import { createRng, type Rng } from './rng';
import { downSide, meatOf, qualityOf, upSide, type Skewer } from './skewer';

export interface BotSkill {
  actionGapSec: [number, number];
  flareReactionSec: [number, number];
  window: [number, number];
  sloppyChance: number;
  fanBelowPatience: number;
}

export const averageBot: BotSkill = {
  actionGapSec: [0.8, 1.6],
  flareReactionSec: [1, 3.2],
  window: [0.05, 1],
  sloppyChance: 0.3,
  fanBelowPatience: 0.5,
};

export const expertBot: BotSkill = {
  actionGapSec: [0.3, 0.5],
  flareReactionSec: [0.3, 0.8],
  window: [0.25, 0.75],
  sloppyChance: 0.03,
  fanBelowPatience: 0.8,
};

interface Targets {
  flip: number;
  take: number;
}

export class Bot {
  private cooldown = 0;
  private readonly targets = new Map<number, Targets>();
  private readonly plateOf = new Map<number, number>();
  private readonly flareDelay = new Map<number, number>();

  constructor(
    private readonly sim: DaySim,
    private readonly rng: Rng,
    private readonly skill: BotSkill = averageBot,
  ) {}

  update(dtSec: number): void {
    this.cooldown -= dtSec;
    if (this.cooldown > 0 || this.sim.finished) return;
    this.assignPlates();
    if (this.act()) {
      const [min, max] = this.skill.actionGapSec;
      this.cooldown = this.rng.range(min, max);
    }
  }

  private act(): boolean {
    return (
      this.splash() ||
      this.tidy() ||
      this.serve() ||
      this.take() ||
      this.flip() ||
      this.coals() ||
      this.place() ||
      this.garnish() ||
      this.fan()
    );
  }

  private waiting(): Guest[] {
    return this.sim.seats
      .filter((guest): guest is Guest => guest !== null && guest.state === 'waiting')
      .toSorted((a, b) => a.patienceLeft - b.patienceLeft);
  }

  private assignPlates(): void {
    const present = new Set(this.waiting().map((guest) => guest.id));
    for (const id of this.plateOf.keys()) {
      if (!present.has(id)) this.plateOf.delete(id);
    }
    const taken = new Set(this.plateOf.values());
    for (const guest of this.waiting().toSorted((a, b) => a.id - b.id)) {
      if (this.plateOf.has(guest.id)) continue;
      const free = this.sim.plates.findIndex((_, index) => !taken.has(index));
      if (free === -1) return;
      this.plateOf.set(guest.id, free);
      taken.add(free);
    }
  }

  private missing(guest: Guest, plate: Plate): Map<MeatKind, number> {
    const need = new Map<MeatKind, number>();
    if (guest.banquet) {
      let room = balance.plate.capacity;
      for (const item of guest.banquet.remaining) {
        const count = Math.min(room, banquetNeeds(guest.banquet, item.kind));
        need.set(item.kind, count);
        room -= count;
      }
    } else {
      for (const item of guest.order.items) need.set(item.kind, item.count);
    }
    for (const skewer of plate.skewers) need.set(skewer.kind, (need.get(skewer.kind) ?? 0) - 1);
    return need;
  }

  private targetsFor(skewer: Skewer): Targets {
    const known = this.targets.get(skewer.id);
    if (known) return known;
    const meat = meatOf(skewer.kind);
    const pick = (): number => {
      if (this.rng.next() < this.skill.sloppyChance) {
        return this.rng.next() < 0.5
          ? this.rng.range(1.02, meat.perfectFrom)
          : this.rng.range(meat.perfectTo, meat.perfectTo + 0.35);
      }
      const [from, to] = this.skill.window;
      return meat.perfectFrom + (meat.perfectTo - meat.perfectFrom) * this.rng.range(from, to);
    };
    const created = { flip: pick(), take: pick() };
    this.targets.set(skewer.id, created);
    return created;
  }

  private splash(): boolean {
    for (const [index, slot] of this.sim.grill.slots.entries()) {
      if (!slot.flare) {
        this.flareDelay.delete(index);
        continue;
      }
      let delay = this.flareDelay.get(index);
      if (delay === undefined) {
        const [min, max] = this.skill.flareReactionSec;
        delay = this.rng.range(min, max);
        this.flareDelay.set(index, delay);
      }
      if (slot.flareSec >= delay && this.sim.splash(index)) return true;
    }
    return false;
  }

  private tidy(): boolean {
    for (const guest of this.waiting()) {
      const index = this.plateOf.get(guest.id);
      const plate = index === undefined ? undefined : this.sim.plates[index];
      if (index === undefined || !plate) continue;
      const surplus = [...this.missing(guest, plate).values()].some((count) => count < 0);
      const wrongSide = plate.sides.some((side) => !guest.order.sides.includes(side));
      const wrongDrink = plate.drink !== null && plate.drink !== guest.order.drink;
      const spoiled = plate.skewers.some((skewer) => {
        const quality = qualityOf(skewer);
        return quality === 'burnt' || (guest.kind === 'athlete' && quality === 'overdone');
      });
      if ((surplus || wrongSide || wrongDrink || spoiled) && this.sim.removeLast(index))
        return true;
    }
    return false;
  }

  private serve(): boolean {
    for (const guest of this.waiting()) {
      const index = this.plateOf.get(guest.id);
      const plate = index === undefined ? undefined : this.sim.plates[index];
      if (index === undefined || !plate) continue;
      const helper = this.sim.mods.helper && !guest.banquet;
      const probe: Plate = helper ? { ...plate, sides: [...guest.order.sides] } : plate;
      if (guest.banquet) {
        const complete = [...this.missing(guest, plate).values()].every((count) => count <= 0);
        if (!complete) continue;
      }
      if (
        checkGuestPlate(guest.kind, guest.order, guest.banquet, probe) === null &&
        this.sim.serve(index, guest.seat)
      ) {
        return true;
      }
    }
    return false;
  }

  private take(): boolean {
    for (const [index, slot] of this.sim.grill.slots.entries()) {
      const skewer = slot.skewer;
      if (!skewer) continue;
      const quality = qualityOf(skewer);
      if (quality === 'burnt') return this.sim.trashFromGrill(index);
      if (skewer.flips === 0 || downSide(skewer) < this.targetsFor(skewer).take) continue;
      if (upSide(skewer) < 1) continue;
      for (const guest of this.waiting()) {
        const plateIndex = this.plateOf.get(guest.id);
        const plate = plateIndex === undefined ? undefined : this.sim.plates[plateIndex];
        if (plateIndex === undefined || !plate) continue;
        if ((this.missing(guest, plate).get(skewer.kind) ?? 0) <= 0) continue;
        if (this.sim.takeToPlate(index, plateIndex)) return true;
      }
      if (downSide(skewer) > meatOf(skewer.kind).perfectTo + 0.3)
        return this.sim.trashFromGrill(index);
    }
    return false;
  }

  private flip(): boolean {
    for (const [index, slot] of this.sim.grill.slots.entries()) {
      const skewer = slot.skewer;
      if (!skewer || skewer.flips > 0) continue;
      if (downSide(skewer) >= this.targetsFor(skewer).flip) {
        this.sim.flip(index);
        return true;
      }
    }
    return false;
  }

  private coals(): boolean {
    const coals = this.sim.grill.coals;
    return coals.level < 0.5 && coals.canAdd && this.sim.addCoals();
  }

  private place(): boolean {
    const demand = new Map<MeatKind, number>();
    for (const guest of this.waiting()) {
      const index = this.plateOf.get(guest.id);
      const plate = index === undefined ? undefined : this.sim.plates[index];
      if (!plate) continue;
      for (const [kind, count] of this.missing(guest, plate)) {
        if (count > 0) demand.set(kind, (demand.get(kind) ?? 0) + count);
      }
    }
    for (const slot of this.sim.grill.slots) {
      if (slot.skewer && qualityOf(slot.skewer) !== 'burnt') {
        demand.set(slot.skewer.kind, (demand.get(slot.skewer.kind) ?? 0) - 1);
      }
    }
    const kind = [...demand.entries()].find(([, count]) => count > 0)?.[0];
    if (kind === undefined) return false;
    const center = (this.sim.slotCount - 1) / 2;
    const free = this.sim.grill.slots
      .map((_, index) => index)
      .filter((index) => this.sim.grill.isFree(index))
      .toSorted((a, b) => Math.abs(a - center) - Math.abs(b - center))[0];
    return free !== undefined && this.sim.placeSkewer(kind, free);
  }

  private garnish(): boolean {
    for (const guest of this.waiting()) {
      const index = this.plateOf.get(guest.id);
      const plate = index === undefined ? undefined : this.sim.plates[index];
      if (index === undefined || !plate) continue;
      if (guest.banquet) continue;
      const side = this.sim.mods.helper
        ? undefined
        : guest.order.sides.find((wanted) => !plate.sides.includes(wanted));
      const drink: DrinkKind | null = plate.drink === null ? guest.order.drink : null;
      if (side === undefined && drink === null) continue;
      if (this.sim.activePlate !== index) this.sim.selectPlate(index);
      if (side !== undefined) return this.sim.addSide(side);
      if (drink === 'tea' && this.sim.teapot.state === 'brewing') continue;
      if (drink !== null && this.sim.tapDrink(drink)) return true;
    }
    return false;
  }

  private fan(): boolean {
    const hurried = this.waiting().some(
      (guest) => guest.patienceLeft / guest.patienceSec < this.skill.fanBelowPatience,
    );
    if (!hurried) return false;
    const coals = this.sim.grill.coals;
    const slot = this.sim.grill.slots
      .map((state, index) => ({ state, index }))
      .filter(({ state, index }) => state.skewer && (coals.mods[index] ?? 0) < 0.2)
      .toSorted((a, b) => coals.heat(a.index) - coals.heat(b.index))[0];
    if (!slot) return false;
    this.sim.fan(slot.index, balance.fan.perSlotWidth * 1.5);
    return true;
  }
}

export interface DayRun extends DayOutcome {
  stats: DayStats;
}

export function runDay(level: DayLevel, mods: DayMods, skill: BotSkill, seed: number): DayRun {
  const sim = new DaySim({ ...level, seed: level.seed + seed * 7919 }, mods, {});
  const bot = new Bot(sim, createRng(seed * 104729 + 17), skill);
  const step = balance.simStepSec;
  const limit = level.durationSec + 240;
  while (!sim.finished && sim.timeSec < limit) {
    sim.step(step);
    bot.update(step);
  }
  const outcome = evaluateDay(
    level.stars,
    sim.revenue,
    sim.goalProgress().met,
    sim.verdicts.critic,
  );
  return { ...outcome, stats: { ...sim.stats } };
}

export interface ToyRun {
  timeSec: number;
  revenue: number;
  served: number;
}

export function runToy(level: DayLevel, mods: DayMods, skill: BotSkill, seed: number): ToyRun {
  const sim = new DaySim({ ...level, seed: level.seed + seed * 7919 }, mods, null, balance.toyMode);
  const bot = new Bot(sim, createRng(seed * 104729 + 17), skill);
  const step = balance.simStepSec;
  while (!sim.finished && sim.timeSec < 3600) {
    sim.step(step);
    bot.update(step);
  }
  return { timeSec: sim.timeSec, revenue: sim.revenue, served: sim.stats.served };
}

export interface DayReport {
  id: string;
  runs: number;
  passRate: number;
  goalRate: number;
  threeStarRate: number;
  avgStars: number;
  avgRevenue: number;
  minRevenue: number;
  maxRevenue: number;
  avgServed: number;
  avgLost: number;
  avgBurnt: number;
}

export function reportDay(
  level: DayLevel,
  mods: DayMods,
  skill: BotSkill,
  runs: number,
): DayReport {
  const results = Array.from({ length: runs }, (_, seed) => runDay(level, mods, skill, seed + 1));
  const avg = (pick: (run: DayRun) => number): number =>
    results.reduce((sum, run) => sum + pick(run), 0) / runs;
  const revenues = results.map((run) => run.revenue);
  return {
    id: level.id,
    runs,
    passRate: avg((run) => (run.passed ? 1 : 0)),
    goalRate: avg((run) => (run.goalMet ? 1 : 0)),
    threeStarRate: avg((run) => (run.stars === 3 ? 1 : 0)),
    avgStars: avg((run) => run.stars),
    avgRevenue: avg((run) => run.revenue),
    minRevenue: Math.min(...revenues),
    maxRevenue: Math.max(...revenues),
    avgServed: avg((run) => run.stats.served),
    avgLost: avg((run) => run.stats.lost),
    avgBurnt: avg((run) => run.stats.burntSkewers),
  };
}
