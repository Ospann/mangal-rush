import {
  balance,
  drinkKinds,
  eventKinds,
  goalKinds,
  sideKinds,
  type DrinkKind,
  type EventKind,
  type GoalKind,
  type MeatKind,
  type SideKind,
} from '../balance';
import { isLocationId, type LocationId } from '../locations';
import type { DayEvent, DayGoal, DayLevel, OrderItem, OrderTemplate } from './types';

export class LevelError extends Error {
  constructor(source: string, problems: string[]) {
    super(`Invalid level "${source}":\n- ${problems.join('\n- ')}`);
    this.name = 'LevelError';
  }
}

type Json = Record<string, unknown>;

function isRecord(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isMeatKind(value: unknown): value is MeatKind {
  return typeof value === 'string' && Object.hasOwn(balance.meats, value);
}

function isSideKind(value: unknown): value is SideKind {
  return typeof value === 'string' && (sideKinds as readonly string[]).includes(value);
}

function isDrinkKind(value: unknown): value is DrinkKind {
  return typeof value === 'string' && (drinkKinds as readonly string[]).includes(value);
}

function isGoalKind(value: unknown): value is GoalKind {
  return typeof value === 'string' && (goalKinds as readonly string[]).includes(value);
}

function isEventKind(value: unknown): value is EventKind {
  return typeof value === 'string' && (eventKinds as readonly string[]).includes(value);
}

function parseList<T>(
  check: Checker,
  raw: unknown,
  path: string,
  guard: (value: unknown) => value is T,
  label: string,
): T[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    check.fail(path, 'expected an array');
    return [];
  }
  const result: T[] = [];
  raw.forEach((value, index) => {
    if (!guard(value)) check.fail(`${path}[${index}]`, `unknown ${label} ${JSON.stringify(value)}`);
    else if (result.includes(value))
      check.fail(`${path}[${index}]`, `duplicate ${label} "${String(value)}"`);
    else result.push(value);
  });
  return result;
}

class Checker {
  readonly problems: string[] = [];

  fail(path: string, message: string): void {
    this.problems.push(`${path}: ${message}`);
  }

  string(source: Json, key: string, path: string): string {
    const value = source[key];
    if (typeof value === 'string' && value !== '') return value;
    this.fail(`${path}${key}`, 'expected a non-empty string');
    return '';
  }

  number(source: Json, key: string, path: string, min: number, max = Infinity): number {
    const value = source[key];
    if (typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max) {
      return value;
    }
    const range = max === Infinity ? `>= ${min}` : `between ${min} and ${max}`;
    this.fail(`${path}${key}`, `expected a number ${range}, got ${JSON.stringify(value)}`);
    return min;
  }

  integer(source: Json, key: string, path: string, min: number, max = Infinity): number {
    const value = this.number(source, key, path, min, max);
    if (!Number.isInteger(value)) this.fail(`${path}${key}`, 'expected an integer');
    return Math.round(value);
  }

  record(source: Json, key: string, path: string): Json {
    const value = source[key];
    if (isRecord(value)) return value;
    this.fail(`${path}${key}`, 'expected an object');
    return {};
  }

  array(source: Json, key: string, path: string): unknown[] {
    const value = source[key];
    if (Array.isArray(value) && value.length > 0) return value;
    this.fail(`${path}${key}`, 'expected a non-empty array');
    return [];
  }
}

interface Menu {
  meats: MeatKind[];
  sides: SideKind[];
  drinks: DrinkKind[];
}

function parseOrder(check: Checker, raw: unknown, path: string, menu: Menu): OrderTemplate {
  const { meats } = menu;
  if (!isRecord(raw)) {
    check.fail(path, 'expected an object');
    return { weight: 0, items: [], sides: [], drink: null };
  }
  const weight = check.number(raw, 'weight', `${path}.`, 0);
  const items: OrderItem[] = [];
  let total = 0;
  check.array(raw, 'items', `${path}.`).forEach((item, index) => {
    const itemPath = `${path}.items[${index}]`;
    if (!isRecord(item)) {
      check.fail(itemPath, 'expected an object');
      return;
    }
    const count = check.integer(item, 'count', `${itemPath}.`, 1, balance.plate.capacity);
    const kind = item.kind;
    if (!isMeatKind(kind)) {
      check.fail(`${itemPath}.kind`, `unknown meat ${JSON.stringify(kind)}`);
      return;
    }
    if (!meats.includes(kind)) check.fail(`${itemPath}.kind`, `"${kind}" is not listed in meats`);
    total += count;
    items.push({ kind, count });
  });
  if (total > balance.plate.capacity) {
    check.fail(path, `order has ${total} skewers, a plate holds ${balance.plate.capacity}`);
  }
  const sides = parseList(check, raw.sides, `${path}.sides`, isSideKind, 'side');
  for (const side of sides) {
    if (!menu.sides.includes(side)) check.fail(`${path}.sides`, `"${side}" is not listed in sides`);
  }
  let drink: DrinkKind | null = null;
  if (raw.drink !== undefined && raw.drink !== null) {
    if (!isDrinkKind(raw.drink)) {
      check.fail(`${path}.drink`, `unknown drink ${JSON.stringify(raw.drink)}`);
    } else if (!menu.drinks.includes(raw.drink)) {
      check.fail(`${path}.drink`, `"${raw.drink}" is not listed in drinks`);
    } else {
      drink = raw.drink;
    }
  }
  return { weight, items, sides, drink };
}

function parseGoal(check: Checker, raw: unknown): DayGoal {
  if (!isRecord(raw)) {
    check.fail('goal', 'expected an object');
    return { type: 'serve', value: 1 };
  }
  const type = raw.type;
  if (!isGoalKind(type)) {
    check.fail('goal.type', `expected one of ${goalKinds.join(', ')}, got ${JSON.stringify(type)}`);
    return { type: 'serve', value: 1 };
  }
  const value = type === 'noBurn' ? 0 : check.integer(raw, 'value', 'goal.', 1);
  return { type, value };
}

function parseStars(check: Checker, raw: unknown): [number, number, number] {
  const values: unknown[] = Array.isArray(raw) ? raw : [];
  const [one, two, three] = values;
  if (
    values.length === 3 &&
    typeof one === 'number' &&
    typeof two === 'number' &&
    typeof three === 'number' &&
    one > 0 &&
    one <= two &&
    two <= three &&
    Number.isFinite(three)
  ) {
    return [one, two, three];
  }
  check.fail('stars', 'expected three ascending positive revenue thresholds');
  return [1, 2, 3];
}

function parseEvents(check: Checker, raw: unknown, durationSec: number): DayEvent[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    check.fail('events', 'expected an array');
    return [];
  }
  const events: DayEvent[] = [];
  raw.forEach((value, index) => {
    const path = `events[${index}]`;
    if (!isRecord(value)) {
      check.fail(path, 'expected an object');
      return;
    }
    const type = value.type;
    if (!isEventKind(type)) {
      check.fail(
        `${path}.type`,
        `expected one of ${eventKinds.join(', ')}, got ${JSON.stringify(type)}`,
      );
      return;
    }
    const atSec = check.number(value, 'atSec', `${path}.`, 0, durationSec);
    const length = check.number(value, 'durationSec', `${path}.`, 1);
    events.push({ type, atSec, durationSec: length });
  });
  return events;
}

function optionalInteger(
  check: Checker,
  source: Json,
  key: string,
  min: number,
  max: number,
): number | null {
  if (source[key] === undefined || source[key] === null) return null;
  return check.integer(source, key, '', min, max);
}

export function parseDayLevel(raw: unknown, source = 'level'): DayLevel {
  const check = new Checker();
  if (!isRecord(raw)) throw new LevelError(source, ['expected an object at the top level']);

  const meats: MeatKind[] = [];
  check.array(raw, 'meats', '').forEach((value, index) => {
    if (isMeatKind(value)) meats.push(value);
    else check.fail(`meats[${index}]`, `unknown meat ${JSON.stringify(value)}`);
  });

  const sides = parseList(check, raw.sides, 'sides', isSideKind, 'side');
  const drinks = parseList(check, raw.drinks, 'drinks', isDrinkKind, 'drink');
  const menu: Menu = { meats, sides, drinks };

  const start = check.record(raw, 'start', '');
  const guests = check.record(raw, 'guests', '');
  const interval = guests.intervalSec;
  let intervalSec: [number, number] = [1, 1];
  if (
    Array.isArray(interval) &&
    interval.length === 2 &&
    typeof interval[0] === 'number' &&
    typeof interval[1] === 'number' &&
    interval[0] >= 0 &&
    interval[1] >= interval[0]
  ) {
    intervalSec = [interval[0], interval[1]];
  } else {
    check.fail('guests.intervalSec', 'expected [min, max] with 0 <= min <= max');
  }

  let location: LocationId = 'roadside';
  if (isLocationId(raw.location)) location = raw.location;
  else check.fail('location', `unknown location ${JSON.stringify(raw.location)}`);
  const durationSec = check.number(raw, 'durationSec', '', 10);

  const level: DayLevel = {
    id: check.string(raw, 'id', ''),
    location,
    day: raw.day === undefined ? 0 : check.integer(raw, 'day', '', 0, 99),
    durationSec,
    seed: check.integer(raw, 'seed', '', 0),
    grillSlots: optionalInteger(check, raw, 'grillSlots', 1, 8),
    plates: optionalInteger(check, raw, 'plates', 1, 4),
    seats: check.integer(raw, 'seats', '', 1, balance.guests.maxSeats),
    meats,
    sides,
    drinks,
    start: {
      coalLevel: check.number(start, 'coalLevel', 'start.', 0, 1),
      ayran:
        start.ayran === undefined
          ? balance.ayran.defaultStock
          : check.integer(start, 'ayran', 'start.', 0, 99),
    },
    guests: {
      firstDelaySec: check.number(guests, 'firstDelaySec', 'guests.', 0),
      intervalSec,
      patienceSec: check.number(guests, 'patienceSec', 'guests.', 1),
    },
    goal: parseGoal(check, raw.goal),
    stars: parseStars(check, raw.stars),
    events: parseEvents(check, raw.events, durationSec),
    orders: check
      .array(raw, 'orders', '')
      .map((order, index) => parseOrder(check, order, `orders[${index}]`, menu)),
  };

  if (level.orders.length > 0 && level.orders.every((order) => order.weight <= 0)) {
    check.fail('orders', 'at least one order needs a positive weight');
  }

  if (check.problems.length > 0) throw new LevelError(source, check.problems);
  return level;
}
