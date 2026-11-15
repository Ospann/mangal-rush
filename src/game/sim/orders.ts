import { balance, type Doneness, type DrinkKind, type MeatKind, type SideKind } from '../balance';
import type { OrderItem } from '../levels/types';
import { meatOf, qualityOf, type Skewer } from './skewer';

export interface Order {
  items: OrderItem[];
  sides: SideKind[];
  drink: DrinkKind | null;
}

export type PlateItem = 'skewer' | 'side' | 'drink';

export interface Plate {
  skewers: Skewer[];
  sides: SideKind[];
  drink: DrinkKind | null;
  added: PlateItem[];
}

export type RejectReason = 'wrong' | 'raw' | 'burnt';

export interface Payment {
  price: number;
  tip: number;
  allPerfect: boolean;
}

export function emptyPlate(): Plate {
  return { skewers: [], sides: [], drink: null, added: [] };
}

export function isPlateEmpty(plate: Plate): boolean {
  return plate.skewers.length === 0 && plate.sides.length === 0 && plate.drink === null;
}

export function clearPlate(plate: Plate): void {
  plate.skewers = [];
  plate.sides = [];
  plate.drink = null;
  plate.added = [];
}

export function orderSize(order: Order): number {
  return order.items.reduce((sum, item) => sum + item.count, 0);
}

export function checkPlate(order: Order, plate: Plate): RejectReason | null {
  const wanted = new Map<MeatKind, number>();
  for (const item of order.items) wanted.set(item.kind, (wanted.get(item.kind) ?? 0) + item.count);
  const given = new Map<MeatKind, number>();
  for (const skewer of plate.skewers) given.set(skewer.kind, (given.get(skewer.kind) ?? 0) + 1);
  if (wanted.size !== given.size) return 'wrong';
  for (const [kind, count] of wanted) {
    if (given.get(kind) !== count) return 'wrong';
  }
  if (order.sides.length !== plate.sides.length) return 'wrong';
  if (order.sides.some((side) => !plate.sides.includes(side))) return 'wrong';
  if (order.drink !== plate.drink) return 'wrong';

  const qualities = plate.skewers.map((skewer) => qualityOf(skewer));
  if (qualities.includes('raw')) return 'raw';
  if (qualities.includes('burnt')) return 'burnt';
  return null;
}

export function comboMultiplier(combo: number): number {
  const { comboStep, comboMax } = balance.tips;
  return Math.min(comboMax, 1 + comboStep * Math.max(0, combo));
}

export function payFor(plate: Plate, patienceFraction: number, combo: number): Payment {
  const { quality, speedBonus } = balance.tips;
  let price = 0;
  let tip = 0;
  let allPerfect = plate.skewers.length > 0;
  for (const skewer of plate.skewers) {
    const stage: Doneness = qualityOf(skewer);
    const cost = meatOf(skewer.kind).price;
    price += cost;
    tip += cost * quality[stage];
    if (stage !== 'perfect') allPerfect = false;
  }
  for (const side of plate.sides) price += balance.sides[side];
  if (plate.drink) price += balance.drinks[plate.drink];
  const speed = price * speedBonus * Math.min(1, Math.max(0, patienceFraction));
  return {
    price,
    tip: Math.round((tip + speed) * comboMultiplier(combo)),
    allPerfect,
  };
}
