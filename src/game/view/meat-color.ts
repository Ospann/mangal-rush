import { balance, type MeatKind } from '../balance';

type Stop = readonly [cook: number, color: number];

const ramps: Record<MeatKind, readonly Stop[]> = {
  chicken: buildRamp('chicken', [0xf7c4b4, 0xf0c078, 0xe09a3c, 0xbd742c, 0x40281a, 0x1a1210]),
  lamb: buildRamp('lamb', [0xcf5560, 0xb06a40, 0x94502a, 0x73391b, 0x2e1a12, 0x140e0c]),
};

function buildRamp(kind: MeatKind, colors: readonly number[]): Stop[] {
  const meat = balance.meats[kind];
  const cooks = [0, 1, meat.perfectFrom, meat.perfectTo, meat.burntAt, meat.burntAt + 0.6];
  return cooks.map((cook, index) => [cook, colors[index] ?? 0] as const);
}

function mix(a: number, b: number, t: number): number {
  const channel = (shift: number): number => {
    const from = (a >> shift) & 0xff;
    const to = (b >> shift) & 0xff;
    return Math.round(from + (to - from) * t);
  };
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

export function meatColor(kind: MeatKind, cook: number): number {
  const ramp = ramps[kind];
  const first = ramp[0];
  const last = ramp.at(-1);
  if (!first || !last) return 0xffffff;
  if (cook <= first[0]) return first[1];
  for (let index = 1; index < ramp.length; index += 1) {
    const from = ramp[index - 1];
    const to = ramp[index];
    if (!from || !to) continue;
    if (cook <= to[0]) return mix(from[1], to[1], (cook - from[0]) / (to[0] - from[0]));
  }
  return last[1];
}

export function cssColor(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}
