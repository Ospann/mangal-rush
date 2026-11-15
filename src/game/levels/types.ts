import type { MeatKind } from '../balance';

export interface OrderItem {
  kind: MeatKind;
  count: number;
}

export interface OrderTemplate {
  weight: number;
  items: OrderItem[];
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
  start: {
    coalLevel: number;
  };
  guests: {
    firstDelaySec: number;
    intervalSec: [number, number];
    patienceSec: number;
  };
  orders: OrderTemplate[];
}
