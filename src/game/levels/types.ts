import type { DrinkKind, MeatKind, SideKind } from '../balance';

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

export interface DayLevel {
  id: string;
  location: string;
  durationSec: number;
  seed: number;
  grillSlots: number;
  plates: number;
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
  orders: OrderTemplate[];
}
