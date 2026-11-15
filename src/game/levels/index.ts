import { locationIds, locations, type LocationId } from '../locations';
import { meatKinds, type MeatKind } from '../balance';
import { isDayUnlocked, type DayRef, type Progress } from '../progress';
import testDay2 from './test-day-2.json';
import testDay from './test-day.json';
import { TOY_DAY_ID, toyLevel } from './toy';
import type { DayLevel } from './types';
import { parseDayLevel } from './validate';

const campaign = import.meta.glob<unknown>('./days/*.json', { eager: true, import: 'default' });

const levels = new Map<string, DayLevel>();
for (const [path, raw] of Object.entries(campaign)) {
  const level = parseDayLevel(raw, path);
  if (levels.has(level.id)) throw new Error(`Duplicate day id "${level.id}" in ${path}`);
  levels.set(level.id, level);
}
for (const [source, raw] of [
  ['test-day.json', testDay],
  ['test-day-2.json', testDay2],
] as const) {
  const level = parseDayLevel(raw, source);
  levels.set(level.id, level);
}
levels.set(TOY_DAY_ID, toyLevel());

export const campaignDays: readonly DayLevel[] = [...levels.values()]
  .filter((level) => level.day > 0)
  .toSorted((a, b) => locations[a.location].index - locations[b.location].index || a.day - b.day);

export const dayRefs: readonly DayRef[] = campaignDays.map(({ id, location, day }) => ({
  id,
  location,
  day,
}));

export const campaignLocations: readonly LocationId[] = locationIds.filter((location) =>
  campaignDays.some((level) => level.location === location),
);

export const DEFAULT_DAY_ID = campaignDays[0]?.id ?? 'test-2';

export function hasDay(id: string): boolean {
  return levels.has(id);
}

export function loadDay(id: string): DayLevel {
  const level = levels.get(id);
  if (!level) throw new Error(`Unknown day "${id}"`);
  return level;
}

export function daysOf(location: LocationId): DayLevel[] {
  return campaignDays.filter((level) => level.location === location);
}

export function availableMeats(progress: Progress): MeatKind[] {
  const open = campaignDays.filter((level) => isDayUnlocked(progress, level, dayRefs));
  return meatKinds.filter((kind) => open.some((level) => level.meats.includes(kind)));
}

export function nextDayId(id: string): string | null {
  const index = campaignDays.findIndex((level) => level.id === id);
  return index === -1 ? null : (campaignDays[index + 1]?.id ?? null);
}

export { TOY_DAY_ID, toyLevel, toyMods } from './toy';
export type { DayEvent, DayGoal, DayLevel, OrderItem, OrderTemplate } from './types';
