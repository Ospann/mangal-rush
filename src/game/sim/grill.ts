import { balance, type Doneness, type MeatKind } from '../balance';
import { Coals } from './coals';
import type { Rng } from './rng';
import {
  cookSkewer,
  createSkewer,
  downSide,
  flipSkewer,
  meatOf,
  sideStage,
  type Skewer,
} from './skewer';

export interface GrillSlot {
  skewer: Skewer | null;
  lifted: boolean;
  flare: boolean;
  flareEmptySec: number;
}

export type GrillEvent =
  | { type: 'flare'; slot: number }
  | { type: 'flareOut'; slot: number; by: 'water' | 'empty' }
  | { type: 'stage'; slot: number; skewerId: number; stage: Doneness };

export function flareChancePerSec(heat: number, fat: number): number {
  const { minHeat, chancePerSec } = balance.flare;
  if (heat < minHeat) return 0;
  return chancePerSec * fat * (heat / minHeat);
}

export class Grill {
  readonly slots: GrillSlot[];
  readonly coals: Coals;
  private nextId = 1;

  constructor(
    slotCount: number,
    private readonly rng: Rng,
    startLevel?: number,
  ) {
    this.coals = new Coals(slotCount, startLevel);
    this.slots = Array.from({ length: slotCount }, () => ({
      skewer: null,
      lifted: false,
      flare: false,
      flareEmptySec: 0,
    }));
  }

  slot(index: number): GrillSlot | null {
    return this.slots[index] ?? null;
  }

  isFree(index: number): boolean {
    const slot = this.slot(index);
    return slot !== null && slot.skewer === null;
  }

  place(kind: MeatKind, index: number): Skewer | null {
    const slot = this.slot(index);
    if (!slot || slot.skewer) return null;
    slot.skewer = createSkewer(this.nextId, kind);
    this.nextId += 1;
    slot.lifted = false;
    return slot.skewer;
  }

  flip(index: number): boolean {
    const skewer = this.slot(index)?.skewer;
    if (!skewer) return false;
    flipSkewer(skewer);
    return true;
  }

  setLifted(index: number, lifted: boolean): void {
    const slot = this.slot(index);
    if (slot?.skewer) slot.lifted = lifted;
  }

  take(index: number): Skewer | null {
    const slot = this.slot(index);
    if (!slot?.skewer) return null;
    const skewer = slot.skewer;
    slot.skewer = null;
    slot.lifted = false;
    return skewer;
  }

  move(from: number, to: number): boolean {
    const source = this.slot(from);
    const target = this.slot(to);
    if (!source?.skewer || !target || target.skewer) return false;
    target.skewer = source.skewer;
    target.lifted = false;
    source.skewer = null;
    source.lifted = false;
    return true;
  }

  splash(index: number): boolean {
    const slot = this.slot(index);
    if (!slot?.flare) return false;
    slot.flare = false;
    slot.flareEmptySec = 0;
    this.coals.chill(index);
    return true;
  }

  tick(dtSec: number): GrillEvent[] {
    const events: GrillEvent[] = [];
    this.coals.tick(dtSec);

    this.slots.forEach((slot, index) => {
      const heat = this.coals.heat(index);
      const skewer = slot.skewer;
      const cooking = skewer !== null && !slot.lifted;

      if (slot.flare && !cooking) {
        slot.flareEmptySec += dtSec;
        if (slot.flareEmptySec >= balance.flare.emptySlotSec) {
          slot.flare = false;
          slot.flareEmptySec = 0;
          events.push({ type: 'flareOut', slot: index, by: 'empty' });
        }
      } else {
        slot.flareEmptySec = 0;
      }

      if (!cooking) return;

      const before = sideStage(skewer, skewer.down);
      cookSkewer(skewer, dtSec, heat, slot.flare ? balance.flare.cookMult : 1);
      const after = sideStage(skewer, skewer.down);
      if (after !== before) {
        events.push({ type: 'stage', slot: index, skewerId: skewer.id, stage: after });
      }

      if (!slot.flare && downSide(skewer) >= balance.flare.minCook) {
        const chance = flareChancePerSec(heat, meatOf(skewer.kind).fat) * dtSec;
        if (chance > 0 && this.rng.next() < chance) {
          slot.flare = true;
          events.push({ type: 'flare', slot: index });
        }
      }
    });

    return events;
  }
}
