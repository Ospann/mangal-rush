import { balance, type MeatKind } from '../balance';

type Stop = readonly [cook: number, color: number];

const ramps: Record<MeatKind, readonly Stop[]> = {
  chicken: buildRamp('chicken', [0xf7c4b4, 0xf0c078, 0xe09a3c, 0xbd742c, 0x40281a, 0x1a1210]),
  lamb: buildRamp('lamb', [0xcf5560, 0xb06a40, 0x94502a, 0x73391b, 0x2e1a12, 0x140e0c]),
  beef: buildRamp('beef', [0xb23a48, 0x96553a, 0x7a4226, 0x5a2c14, 0x2a1810, 0x120c0a]),
  lula: buildRamp('lula', [0xdc8f86, 0xbd8050, 0xa06030, 0x78401e, 0x32201a, 0x16100e]),
  veg: buildRamp('veg', [0xffffff, 0xf4e6c8, 0xe2c493, 0xb08a58, 0x45301f, 0x1c1410]),
  fish: buildRamp('fish', [0xdfe8ee, 0xf2dca6, 0xe6ae52, 0xb47c30, 0x3c2a1a, 0x18120e]),
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
