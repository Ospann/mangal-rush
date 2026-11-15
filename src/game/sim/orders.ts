import { balance, type Doneness, type MeatKind } from '../balance';
import type { OrderItem } from '../levels/types';
import { meatOf, qualityOf, type Skewer } from './skewer';

export interface Order {
  items: OrderItem[];
}

export type RejectReason = 'wrong' | 'raw' | 'burnt';

export interface Payment {
  price: number;
  tip: number;
  allPerfect: boolean;
}

function countKinds(kinds: readonly MeatKind[]): Map<MeatKind, number> {
  const counts = new Map<MeatKind, number>();
  for (const kind of kinds) counts.set(kind, (counts.get(kind) ?? 0) + 1);
  return counts;
}

export function orderSize(order: Order): number {
  return order.items.reduce((sum, item) => sum + item.count, 0);
}

export function checkPlate(order: Order, skewers: readonly Skewer[]): RejectReason | null {
  const wanted = new Map<MeatKind, number>();
  for (const item of order.items) wanted.set(item.kind, (wanted.get(item.kind) ?? 0) + item.count);
  const given = countKinds(skewers.map((skewer) => skewer.kind));
  if (wanted.size !== given.size) return 'wrong';
  for (const [kind, count] of wanted) {
    if (given.get(kind) !== count) return 'wrong';
  }
  const qualities = skewers.map((skewer) => qualityOf(skewer));
  if (qualities.includes('raw')) return 'raw';
  if (qualities.includes('burnt')) return 'burnt';
  return null;
}

export function comboMultiplier(combo: number): number {
  const { comboStep, comboMax } = balance.tips;
  return Math.min(comboMax, 1 + comboStep * Math.max(0, combo));
}

export function payFor(
  skewers: readonly Skewer[],
  patienceFraction: number,
  combo: number,
): Payment {
  const { quality, speedBonus } = balance.tips;
  let price = 0;
  let tip = 0;
  let allPerfect = skewers.length > 0;
  for (const skewer of skewers) {
    const stage: Doneness = qualityOf(skewer);
    const cost = meatOf(skewer.kind).price;
    price += cost;
    tip += cost * quality[stage];
    if (stage !== 'perfect') allPerfect = false;
  }
  const speed = price * speedBonus * Math.min(1, Math.max(0, patienceFraction));
  return {
    price,
    tip: Math.round((tip + speed) * comboMultiplier(combo)),
    allPerfect,
  };
}
