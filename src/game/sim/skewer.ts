import { balance, type Doneness, type MeatBalance, type MeatKind } from '../balance';

export type Side = 0 | 1;

export interface Skewer {
  id: number;
  kind: MeatKind;
  sides: [number, number];
  down: Side;
  flips: number;
}

export function createSkewer(id: number, kind: MeatKind): Skewer {
  return { id, kind, sides: [0, 0], down: 0, flips: 0 };
}

export function meatOf(kind: MeatKind): MeatBalance {
  return balance.meats[kind];
}

export function stageOf(cook: number, meat: MeatBalance): Doneness {
  if (cook < 1) return 'raw';
  if (cook < meat.perfectFrom) return 'done';
  if (cook <= meat.perfectTo) return 'perfect';
  if (cook < meat.burntAt) return 'overdone';
  return 'burnt';
}

export function sideStage(skewer: Skewer, side: Side): Doneness {
  return stageOf(skewer.sides[side], meatOf(skewer.kind));
}

export function downSide(skewer: Skewer): number {
  return skewer.sides[skewer.down];
}

export function upSide(skewer: Skewer): number {
  return skewer.sides[skewer.down === 0 ? 1 : 0];
}

export function flipSkewer(skewer: Skewer): void {
  skewer.down = skewer.down === 0 ? 1 : 0;
  skewer.flips += 1;
}

export function cookSkewer(skewer: Skewer, dtSec: number, heat: number, mult = 1): void {
  const meat = meatOf(skewer.kind);
  const gain = (dtSec * Math.max(0, heat) * mult) / meat.cookSec;
  skewer.sides[skewer.down] = Math.min(meat.burntAt + 1, skewer.sides[skewer.down] + gain);
}

export function qualityOf(skewer: Skewer): Doneness {
  const a = sideStage(skewer, 0);
  const b = sideStage(skewer, 1);
  if (a === 'raw' || b === 'raw') return 'raw';
  if (a === 'burnt' || b === 'burnt') return 'burnt';
  if (a === 'overdone' || b === 'overdone') return 'overdone';
  if (a === 'perfect' && b === 'perfect') return 'perfect';
  return 'done';
}
