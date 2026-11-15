import { balance, type GuestKind, type MeatKind } from '../balance';
import type { DayLevel, GuestSlot, OrderItem, OrderTemplate } from '../levels/types';
import { checkPlate, type Order, type Plate, type RejectReason } from './orders';
import type { Rng } from './rng';
import { qualityOf } from './skewer';

export interface Banquet {
  remaining: OrderItem[];
  total: number;
}

export function pickGuestKind(slots: readonly GuestSlot[], timeSec: number, rng: Rng): GuestKind {
  const open = slots.filter(
    (slot) => slot.weight > 0 && timeSec >= slot.fromSec && timeSec < slot.untilSec,
  );
  if (open.length === 0) return 'local';
  return rng.pick(open, (slot) => slot.weight).type;
}

function sizeOf(items: readonly OrderItem[]): number {
  return items.reduce((sum, item) => sum + item.count, 0);
}

function copy(template: OrderTemplate): Order {
  return {
    items: template.items.map((item) => ({ ...item })),
    sides: [...template.sides],
    drink: template.drink,
  };
}

function grow(order: Order, target: number): void {
  const limit = Math.min(target, balance.plate.capacity);
  for (let index = 0; sizeOf(order.items) < limit; index += 1) {
    const item = order.items[index % order.items.length];
    if (!item) return;
    item.count += 1;
  }
}

export function orderFor(kind: GuestKind, level: DayLevel, rng: Rng): Order {
  const weighted = (pool: readonly OrderTemplate[]): OrderTemplate =>
    rng.pick(pool, (template) => template.weight);
  const all = level.orders;

  if (kind === 'student') {
    const small = all.filter((template) => sizeOf(template.items) === 1);
    const order = copy(weighted(small.length > 0 ? small : all));
    const first = order.items[0];
    order.items = first ? [{ kind: first.kind, count: 1 }] : [];
    order.sides = order.sides.slice(0, 1);
    return order;
  }

  if (kind === 'office') {
    const order = copy(weighted(all));
    const [min, max] = balance.guestRules.officeSkewers;
    grow(order, rng.int(min, max));
    return order;
  }

  if (kind === 'athlete') {
    const order = copy(weighted(all));
    order.sides = order.sides.filter((side) => side !== 'lavash');
    grow(order, sizeOf(order.items) * 2);
    return order;
  }

  if (kind === 'critic') {
    const score = (template: OrderTemplate): number =>
      sizeOf(template.items) +
      template.items.length +
      template.sides.length +
      (template.drink ? 1 : 0);
    const ranked = all.toSorted((a, b) => score(b) - score(a));
    return copy(weighted(ranked.slice(0, 2)));
  }

  return copy(weighted(all));
}

export function banquetOf(items: readonly OrderItem[]): Banquet {
  return { remaining: items.map((item) => ({ ...item })), total: sizeOf(items) };
}

export function banquetLeft(banquet: Banquet): number {
  return sizeOf(banquet.remaining);
}

export function banquetNeeds(banquet: Banquet, kind: MeatKind): number {
  return banquet.remaining.find((item) => item.kind === kind)?.count ?? 0;
}

export function checkBanquetPlate(banquet: Banquet, plate: Plate): RejectReason | null {
  if (plate.sides.length > 0 || plate.drink !== null || plate.skewers.length === 0) return 'wrong';
  const given = new Map<MeatKind, number>();
  for (const skewer of plate.skewers) given.set(skewer.kind, (given.get(skewer.kind) ?? 0) + 1);
  for (const [kind, count] of given) {
    if (count > banquetNeeds(banquet, kind)) return 'wrong';
  }
  const qualities = plate.skewers.map((skewer) => qualityOf(skewer));
  if (qualities.includes('raw')) return 'raw';
  if (qualities.includes('burnt')) return 'burnt';
  return null;
}

export function checkGuestPlate(
  kind: GuestKind,
  order: Order,
  banquet: Banquet | null,
  plate: Plate,
): RejectReason | null {
  if (banquet) return checkBanquetPlate(banquet, plate);
  const reason = checkPlate(order, plate);
  if (reason) return reason;
  if (kind === 'athlete' && plate.skewers.some((skewer) => qualityOf(skewer) === 'overdone')) {
    return 'overdone';
  }
  return null;
}
