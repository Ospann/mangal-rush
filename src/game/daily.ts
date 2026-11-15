import { balance, meatKinds, type MeatKind } from './balance';
import { createRng } from './sim/rng';

export const dailyKinds = ['perfect', 'serve', 'tips'] as const;
export type DailyKind = (typeof dailyKinds)[number];

export interface DailyTask {
  date: string;
  kind: DailyKind;
  meat: MeatKind | null;
  target: number;
  reward: number;
  progress: number;
  claimed: boolean;
}

export type DailyEvent =
  | { kind: 'perfect'; meat: MeatKind }
  | { kind: 'serve' }
  | { kind: 'tips'; amount: number };

export function dateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function hash(text: string): number {
  let value = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    value = Math.imul(value ^ text.charCodeAt(index), 16777619);
  }
  return value >>> 0;
}

export function createDaily(date: string, meats: readonly MeatKind[]): DailyTask {
  const rng = createRng(hash(date));
  const rules = balance.daily;
  const kinds = meats.length > 0 ? dailyKinds : dailyKinds.filter((kind) => kind !== 'perfect');
  const kind = kinds[rng.int(0, kinds.length - 1)] ?? 'serve';
  const [min, max] = rules[kind];
  const raw = rng.int(min, max);
  return {
    date,
    kind,
    meat: kind === 'perfect' ? (meats[rng.int(0, meats.length - 1)] ?? null) : null,
    target: kind === 'tips' ? Math.round(raw / 10) * 10 : raw,
    reward: rules.reward,
    progress: 0,
    claimed: false,
  };
}

export function isDailyTask(value: unknown): value is DailyTask {
  if (typeof value !== 'object' || value === null) return false;
  const task = value as Partial<Record<keyof DailyTask, unknown>>;
  return (
    typeof task.date === 'string' &&
    (dailyKinds as readonly unknown[]).includes(task.kind) &&
    (task.meat === null || (meatKinds as readonly unknown[]).includes(task.meat)) &&
    typeof task.target === 'number' &&
    task.target > 0 &&
    typeof task.reward === 'number' &&
    typeof task.progress === 'number' &&
    typeof task.claimed === 'boolean'
  );
}

export function currentDaily(saved: unknown, date: string, meats: readonly MeatKind[]): DailyTask {
  if (isDailyTask(saved) && saved.date === date) return saved;
  return createDaily(date, meats);
}

export function advanceDaily(task: DailyTask, event: DailyEvent): DailyTask {
  if (task.claimed || task.kind !== event.kind || task.progress >= task.target) return task;
  if (event.kind === 'perfect' && event.meat !== task.meat) return task;
  const amount = event.kind === 'tips' ? Math.max(0, event.amount) : 1;
  if (amount === 0) return task;
  return { ...task, progress: Math.min(task.target, task.progress + amount) };
}

export function isDailyDone(task: DailyTask): boolean {
  return task.progress >= task.target;
}
