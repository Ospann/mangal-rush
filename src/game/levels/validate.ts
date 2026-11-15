import { balance, type MeatKind } from '../balance';
import type { DayLevel, OrderItem, OrderTemplate } from './types';

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

function parseOrder(check: Checker, raw: unknown, path: string, meats: MeatKind[]): OrderTemplate {
  if (!isRecord(raw)) {
    check.fail(path, 'expected an object');
    return { weight: 0, items: [] };
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
  return { weight, items };
}

export function parseDayLevel(raw: unknown, source = 'level'): DayLevel {
  const check = new Checker();
  if (!isRecord(raw)) throw new LevelError(source, ['expected an object at the top level']);

  const meats: MeatKind[] = [];
  check.array(raw, 'meats', '').forEach((value, index) => {
    if (isMeatKind(value)) meats.push(value);
    else check.fail(`meats[${index}]`, `unknown meat ${JSON.stringify(value)}`);
  });

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

  const level: DayLevel = {
    id: check.string(raw, 'id', ''),
    location: check.string(raw, 'location', ''),
    durationSec: check.number(raw, 'durationSec', '', 10),
    seed: check.integer(raw, 'seed', '', 0),
    grillSlots: check.integer(raw, 'grillSlots', '', 1, 8),
    plates: check.integer(raw, 'plates', '', 1, 4),
    seats: check.integer(raw, 'seats', '', 1, balance.guests.maxSeats),
    meats,
    start: { coalLevel: check.number(start, 'coalLevel', 'start.', 0, 1) },
    guests: {
      firstDelaySec: check.number(guests, 'firstDelaySec', 'guests.', 0),
      intervalSec,
      patienceSec: check.number(guests, 'patienceSec', 'guests.', 1),
    },
    orders: check
      .array(raw, 'orders', '')
      .map((order, index) => parseOrder(check, order, `orders[${index}]`, meats)),
  };

  if (level.orders.length > 0 && level.orders.every((order) => order.weight <= 0)) {
    check.fail('orders', 'at least one order needs a positive weight');
  }

  if (check.problems.length > 0) throw new LevelError(source, check.problems);
  return level;
}
