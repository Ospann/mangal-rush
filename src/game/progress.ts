import { balance, type UpgradeId } from './balance';
import {
  locationIds,
  locationUpgrades,
  upgradeCost,
  upgradeLevel,
  type LocationId,
  type UpgradeLevels,
} from './locations';

export interface Progress {
  money: number;
  stars: Record<string, number>;
  upgrades: Partial<Record<LocationId, UpgradeLevels>>;
}

export interface DayRef {
  id: string;
  location: LocationId;
  day: number;
}

export interface DayOutcome {
  revenue: number;
  goalMet: boolean;
  stars: number;
  passed: boolean;
}

export function evaluateDay(
  thresholds: readonly [number, number, number],
  revenue: number,
  goalMet: boolean,
): DayOutcome {
  const reached = thresholds.filter((threshold) => revenue >= threshold).length;
  const stars = goalMet ? reached : Math.min(reached, balance.progress.goalStarCap);
  return { revenue, goalMet, stars, passed: stars >= 1 };
}

export function dayStars(progress: Progress, dayId: string): number {
  return Math.min(3, Math.max(0, Math.floor(progress.stars[dayId] ?? 0)));
}

export function locationStars(
  progress: Progress,
  location: LocationId,
  days: readonly DayRef[],
): number {
  return days
    .filter((day) => day.location === location)
    .reduce((sum, day) => sum + dayStars(progress, day.id), 0);
}

export function isLocationUnlocked(
  progress: Progress,
  location: LocationId,
  days: readonly DayRef[],
): boolean {
  const index = locationIds.indexOf(location);
  if (index <= 0) return true;
  const previous = locationIds[index - 1];
  if (previous === undefined) return true;
  const previousDays = days.filter((day) => day.location === previous);
  return (
    previousDays.every((day) => dayStars(progress, day.id) >= 1) &&
    locationStars(progress, previous, days) >= balance.progress.starsToUnlockLocation
  );
}

export function isDayUnlocked(progress: Progress, day: DayRef, days: readonly DayRef[]): boolean {
  if (!isLocationUnlocked(progress, day.location, days)) return false;
  const earlier = days.filter((other) => other.location === day.location && other.day < day.day);
  return earlier.every((other) => dayStars(progress, other.id) >= 1);
}

export function locationLevels(progress: Progress, location: LocationId): UpgradeLevels {
  return progress.upgrades[location] ?? {};
}

export function canBuyUpgrade(
  progress: Progress,
  location: LocationId,
  upgrade: UpgradeId,
): boolean {
  const level = upgradeLevel(location, locationLevels(progress, location), upgrade);
  const cost = upgradeCost(location, upgrade, level);
  return cost !== null && progress.money >= cost;
}

export function buyUpgrade(
  progress: Progress,
  location: LocationId,
  upgrade: UpgradeId,
): Progress | null {
  const levels = locationLevels(progress, location);
  const level = upgradeLevel(location, levels, upgrade);
  const cost = upgradeCost(location, upgrade, level);
  if (cost === null || progress.money < cost) return null;
  return {
    ...progress,
    money: progress.money - cost,
    upgrades: { ...progress.upgrades, [location]: { ...levels, [upgrade]: level + 1 } },
  };
}

export function applyOutcome(progress: Progress, dayId: string, outcome: DayOutcome): Progress {
  return {
    ...progress,
    money: progress.money + Math.max(0, Math.round(outcome.revenue)),
    stars: { ...progress.stars, [dayId]: Math.max(dayStars(progress, dayId), outcome.stars) },
  };
}

export function totalUpgradeCost(location: LocationId): number {
  let total = 0;
  for (const upgrade of locationUpgrades(location)) {
    for (let level = 0; ; level += 1) {
      const cost = upgradeCost(location, upgrade, level);
      if (cost === null) break;
      total += cost;
    }
  }
  return total;
}
