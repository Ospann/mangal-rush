import testDay2 from './test-day-2.json';
import testDay from './test-day.json';
import type { DayLevel } from './types';
import { parseDayLevel } from './validate';

const sources: Readonly<Record<string, unknown>> = {
  test: testDay,
  'test-2': testDay2,
};

export const DEFAULT_DAY_ID = 'test-2';

export function hasDay(id: string): boolean {
  return Object.hasOwn(sources, id);
}

export function loadDay(id: string): DayLevel {
  if (!hasDay(id)) throw new Error(`Unknown day "${id}"`);
  return parseDayLevel(sources[id], id);
}

export type { DayLevel, OrderItem, OrderTemplate } from './types';
