import type { DrinkKind, EventKind, GoalKind, MeatKind, SideKind } from '../balance';
import type { LocationId } from '../locations';

export interface OrderItem {
  kind: MeatKind;
  count: number;
}

export interface OrderTemplate {
  weight: number;
  items: OrderItem[];
  sides: SideKind[];
  drink: DrinkKind | null;
}

export interface DayGoal {
  type: GoalKind;
  value: number;
}

export interface DayEvent {
  type: EventKind;
  atSec: number;
  durationSec: number;
}

export interface DayLevel {
  id: string;
  location: LocationId;
  day: number;
  durationSec: number;
  seed: number;
  grillSlots: number | null;
  plates: number | null;
  seats: number;
  meats: MeatKind[];
  sides: SideKind[];
  drinks: DrinkKind[];
  start: {
    coalLevel: number;
    ayran: number;
  };
  guests: {
    firstDelaySec: number;
    intervalSec: [number, number];
    patienceSec: number;
  };
  goal: DayGoal;
  stars: [number, number, number];
  events: DayEvent[];
  orders: OrderTemplate[];
}
