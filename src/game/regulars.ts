import type { GuestKind } from './balance';

export interface RegularDef {
  id: string;
  kind: GuestKind;
  lines: number;
}

export const regulars: readonly RegularDef[] = [
  { id: 'taxi', kind: 'taxi', lines: 6 },
  { id: 'student', kind: 'student', lines: 6 },
  { id: 'granny', kind: 'granny', lines: 6 },
  { id: 'blogger', kind: 'blogger', lines: 6 },
];

export function regularFor(kind: GuestKind): RegularDef | null {
  return regulars.find((regular) => regular.kind === kind) ?? null;
}

export type RegularVisits = Record<string, number>;

export function lineIndex(regular: RegularDef, visits: number): number {
  return (Math.max(0, Math.floor(visits)) % regular.lines) + 1;
}
