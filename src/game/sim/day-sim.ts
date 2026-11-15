import { Emitter } from '@core/events';
import { balance, type Doneness, type MeatKind } from '../balance';
import type { DayLevel } from '../levels/types';
import { Grill } from './grill';
import { checkPlate, payFor, type Order, type RejectReason } from './orders';
import { createRng, type Rng } from './rng';
import { qualityOf, type Skewer } from './skewer';

export type GuestState = 'waiting' | 'served' | 'angry';

export interface Guest {
  id: number;
  seat: number;
  look: number;
  order: Order;
  patienceSec: number;
  patienceLeft: number;
  state: GuestState;
  leaveLeftSec: number;
}

export interface Plate {
  skewers: Skewer[];
}

export interface DayStats {
  served: number;
  lost: number;
  perfectSkewers: number;
  burntSkewers: number;
  trashed: number;
  bestCombo: number;
  flares: number;
}

export type DayEvents = {
  flare: { slot: number };
  flareOut: { slot: number; by: 'water' | 'empty' };
  stage: { slot: number; skewerId: number; stage: Doneness };
  placed: { slot: number; skewer: Skewer };
  flipped: { slot: number };
  taken: { slot: number; plate: number; quality: Doneness };
  trashed: { count: number };
  fanned: { slot: number };
  coalsAdded: undefined;
  guestArrived: { guest: Guest };
  guestLeft: { guest: Guest };
  guestGone: { seat: number };
  served: { guest: Guest; plate: number; price: number; tip: number; combo: number };
  rejected: { guest: Guest; plate: number; reason: RejectReason };
  finished: undefined;
};

export class DaySim {
  readonly events = new Emitter<DayEvents>();
  readonly grill: Grill;
  readonly plates: Plate[];
  readonly seats: (Guest | null)[];
  readonly stats: DayStats = {
    served: 0,
    lost: 0,
    perfectSkewers: 0,
    burntSkewers: 0,
    trashed: 0,
    bestCombo: 0,
    flares: 0,
  };
  timeSec = 0;
  money = 0;
  tips = 0;
  combo = 0;
  finished = false;

  private readonly rng: Rng;
  private accumulator = 0;
  private nextArrivalSec: number;
  private nextGuestId = 1;

  constructor(readonly level: DayLevel) {
    this.rng = createRng(level.seed);
    this.grill = new Grill(
      level.grillSlots,
      createRng(level.seed ^ 0x9e3779b9),
      level.start.coalLevel,
    );
    this.plates = Array.from({ length: level.plates }, () => ({ skewers: [] }));
    this.seats = Array.from({ length: level.seats }, () => null);
    this.nextArrivalSec = level.guests.firstDelaySec;
  }

  get timeLeftSec(): number {
    return Math.max(0, this.level.durationSec - this.timeSec);
  }

  get isClosing(): boolean {
    return this.timeSec >= this.level.durationSec;
  }

  step(dtSec: number): void {
    if (this.finished) return;
    this.accumulator += Math.min(dtSec, 0.5);
    while (this.accumulator >= balance.simStepSec && !this.finished) {
      this.accumulator -= balance.simStepSec;
      this.tick(balance.simStepSec);
    }
  }

  placeSkewer(kind: MeatKind, slot: number): boolean {
    if (this.finished || !this.level.meats.includes(kind)) return false;
    const skewer = this.grill.place(kind, slot);
    if (!skewer) return false;
    this.events.emit('placed', { slot, skewer });
    return true;
  }

  flip(slot: number): boolean {
    if (this.finished || !this.grill.flip(slot)) return false;
    this.events.emit('flipped', { slot });
    return true;
  }

  lift(slot: number, lifted: boolean): void {
    this.grill.setLifted(slot, lifted);
  }

  moveSkewer(from: number, to: number): boolean {
    return !this.finished && this.grill.move(from, to);
  }

  takeToPlate(slot: number, plateIndex: number): boolean {
    const plate = this.plates[plateIndex];
    if (this.finished || !plate || plate.skewers.length >= balance.plate.capacity) return false;
    const skewer = this.grill.take(slot);
    if (!skewer) return false;
    plate.skewers.push(skewer);
    const quality = qualityOf(skewer);
    if (quality === 'perfect') this.stats.perfectSkewers += 1;
    this.events.emit('taken', { slot, plate: plateIndex, quality });
    return true;
  }

  trashFromGrill(slot: number): boolean {
    if (this.finished || !this.grill.take(slot)) return false;
    this.stats.trashed += 1;
    this.events.emit('trashed', { count: 1 });
    return true;
  }

  trashPlate(plateIndex: number): boolean {
    const plate = this.plates[plateIndex];
    if (this.finished || !plate || plate.skewers.length === 0) return false;
    const count = plate.skewers.length;
    plate.skewers = [];
    this.stats.trashed += count;
    this.events.emit('trashed', { count });
    return true;
  }

  fan(slot: number, amount: number): void {
    if (this.finished || amount <= 0) return;
    this.grill.coals.fan(slot, amount);
    this.events.emit('fanned', { slot });
  }

  splash(slot: number): boolean {
    if (this.finished || !this.grill.splash(slot)) return false;
    this.events.emit('flareOut', { slot, by: 'water' });
    return true;
  }

  addCoals(): boolean {
    if (this.finished || !this.grill.coals.add()) return false;
    this.events.emit('coalsAdded', undefined);
    return true;
  }

  serve(plateIndex: number, seat: number): boolean {
    const plate = this.plates[plateIndex];
    const guest = this.seats[seat];
    if (this.finished || !plate || !guest || guest.state !== 'waiting') return false;
    if (plate.skewers.length === 0) return false;

    const reason = checkPlate(guest.order, plate.skewers);
    if (reason) {
      this.events.emit('rejected', { guest, plate: plateIndex, reason });
      return false;
    }

    const payment = payFor(plate.skewers, guest.patienceLeft / guest.patienceSec, this.combo);
    this.combo = payment.allPerfect ? this.combo + 1 : 0;
    this.stats.bestCombo = Math.max(this.stats.bestCombo, this.combo);
    this.money += payment.price;
    this.tips += payment.tip;
    this.stats.served += 1;
    plate.skewers = [];
    guest.state = 'served';
    guest.leaveLeftSec = balance.guests.leaveSec;
    this.events.emit('served', {
      guest,
      plate: plateIndex,
      price: payment.price,
      tip: payment.tip,
      combo: this.combo,
    });
    this.events.emit('guestLeft', { guest });
    return true;
  }

  private tick(dtSec: number): void {
    this.timeSec += dtSec;

    for (const event of this.grill.tick(dtSec)) {
      if (event.type === 'flare') {
        this.stats.flares += 1;
        this.events.emit('flare', { slot: event.slot });
      } else if (event.type === 'flareOut') {
        this.events.emit('flareOut', { slot: event.slot, by: event.by });
      } else {
        if (event.stage === 'burnt') this.stats.burntSkewers += 1;
        this.events.emit('stage', {
          slot: event.slot,
          skewerId: event.skewerId,
          stage: event.stage,
        });
      }
    }

    this.tickGuests(dtSec);
    this.tickArrivals(dtSec);

    if (this.isClosing && this.seats.every((guest) => guest === null)) {
      this.finished = true;
      this.events.emit('finished', undefined);
    }
  }

  private tickGuests(dtSec: number): void {
    this.seats.forEach((guest, seat) => {
      if (!guest) return;
      if (guest.state === 'waiting') {
        guest.patienceLeft -= dtSec;
        if (guest.patienceLeft <= 0) {
          guest.patienceLeft = 0;
          guest.state = 'angry';
          guest.leaveLeftSec = balance.guests.leaveSec;
          this.combo = 0;
          this.stats.lost += 1;
          this.events.emit('guestLeft', { guest });
        }
        return;
      }
      guest.leaveLeftSec -= dtSec;
      if (guest.leaveLeftSec <= 0) {
        this.seats[seat] = null;
        this.events.emit('guestGone', { seat });
      }
    });
  }

  private tickArrivals(dtSec: number): void {
    if (this.isClosing) return;
    this.nextArrivalSec -= dtSec;
    if (this.nextArrivalSec > 0) return;
    const seat = this.seats.indexOf(null);
    if (seat === -1) return;

    const template = this.rng.pick(this.level.orders, (order) => order.weight);
    const guest: Guest = {
      id: this.nextGuestId,
      seat,
      look: this.rng.int(0, 2),
      order: { items: template.items.map((item) => ({ ...item })) },
      patienceSec: this.level.guests.patienceSec,
      patienceLeft: this.level.guests.patienceSec,
      state: 'waiting',
      leaveLeftSec: 0,
    };
    this.nextGuestId += 1;
    this.seats[seat] = guest;
    const [min, max] = this.level.guests.intervalSec;
    this.nextArrivalSec = this.rng.range(min, max);
    this.events.emit('guestArrived', { guest });
  }
}
