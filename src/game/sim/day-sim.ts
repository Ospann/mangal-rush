import { Emitter } from '@core/events';
import { balance, type Doneness, type DrinkKind, type MeatKind, type SideKind } from '../balance';
import type { DayLevel } from '../levels/types';
import { Grill } from './grill';
import {
  checkPlate,
  clearPlate,
  emptyPlate,
  isPlateEmpty,
  payFor,
  type Order,
  type Plate,
  type PlateItem,
  type RejectReason,
} from './orders';
import { createRng, type Rng } from './rng';
import { qualityOf, type FlipBreak, type Skewer } from './skewer';

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

export type TeaState = 'idle' | 'brewing' | 'hot' | 'cold';

export interface Teapot {
  state: TeaState;
  leftSec: number;
}

export interface Fridge {
  stock: number;
  capacity: number;
  refillLeftSec: number;
}

export type { Plate } from './orders';

export interface DayStats {
  served: number;
  lost: number;
  perfectSkewers: number;
  burntSkewers: number;
  trashed: number;
  broken: number;
  bestCombo: number;
  flares: number;
}

export type DayEvents = {
  flare: { slot: number };
  flareOut: { slot: number; by: 'water' | 'empty' };
  stage: { slot: number; skewerId: number; stage: Doneness };
  placed: { slot: number; skewer: Skewer };
  flipped: { slot: number };
  broke: { slot: number; kind: MeatKind; reason: FlipBreak };
  sideAdded: { plate: number; side: SideKind };
  drinkAdded: { plate: number; drink: DrinkKind };
  removed: { plate: number; item: PlateItem };
  plateSelected: { plate: number };
  tea: { state: TeaState };
  ayranRefill: { done: boolean };
  denied: { drink: DrinkKind | null };
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
    broken: 0,
    bestCombo: 0,
    flares: 0,
  };
  timeSec = 0;
  money = 0;
  tips = 0;
  combo = 0;
  finished = false;
  activePlate = 0;
  readonly teapot: Teapot = { state: 'idle', leftSec: 0 };
  readonly fridge: Fridge;

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
    this.plates = Array.from({ length: level.plates }, () => emptyPlate());
    this.fridge = { stock: level.start.ayran, capacity: level.start.ayran, refillLeftSec: 0 };
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
    if (this.finished) return false;
    const kind = this.grill.slot(slot)?.skewer?.kind;
    const result = this.grill.flip(slot);
    if (result === null || kind === undefined) return false;
    if (result === 'flipped') {
      this.events.emit('flipped', { slot });
      return true;
    }
    this.stats.broken += 1;
    this.events.emit('broke', { slot, kind, reason: result });
    return false;
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
    plate.added.push('skewer');
    this.activePlate = plateIndex;
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

  selectPlate(plateIndex: number): boolean {
    if (this.finished || !this.plates[plateIndex]) return false;
    this.activePlate = plateIndex;
    this.events.emit('plateSelected', { plate: plateIndex });
    return true;
  }

  removeLast(plateIndex: number): boolean {
    const plate = this.plates[plateIndex];
    const item = plate?.added.pop();
    if (this.finished || !plate || !item) return false;
    if (item === 'skewer') plate.skewers.pop();
    else if (item === 'side') plate.sides.pop();
    else plate.drink = null;
    this.stats.trashed += 1;
    this.events.emit('removed', { plate: plateIndex, item });
    this.events.emit('trashed', { count: 1 });
    return true;
  }

  addSide(side: SideKind): boolean {
    const plate = this.plates[this.activePlate];
    if (this.finished || !plate || !this.level.sides.includes(side)) return false;
    if (plate.sides.includes(side)) {
      this.events.emit('denied', { drink: null });
      return false;
    }
    plate.sides.push(side);
    plate.added.push('side');
    this.events.emit('sideAdded', { plate: this.activePlate, side });
    return true;
  }

  tapDrink(drink: DrinkKind): boolean {
    const plate = this.plates[this.activePlate];
    if (this.finished || !plate || !this.level.drinks.includes(drink)) return false;

    if (drink === 'tea') {
      const tea = this.teapot;
      if (tea.state === 'idle' || tea.state === 'cold') {
        tea.state = 'brewing';
        tea.leftSec = balance.tea.brewSec;
        this.events.emit('tea', { state: 'brewing' });
        return true;
      }
      if (tea.state === 'brewing') return false;
    }

    if (drink === 'ayran' && this.fridge.stock <= 0) {
      if (this.fridge.refillLeftSec > 0) return false;
      this.fridge.refillLeftSec = balance.ayran.refillSec;
      this.events.emit('ayranRefill', { done: false });
      return true;
    }

    if (plate.drink !== null) {
      this.events.emit('denied', { drink });
      return false;
    }

    if (drink === 'tea') {
      this.teapot.state = 'idle';
      this.teapot.leftSec = 0;
      this.events.emit('tea', { state: 'idle' });
    } else if (drink === 'ayran') {
      this.fridge.stock -= 1;
    }
    plate.drink = drink;
    plate.added.push('drink');
    this.events.emit('drinkAdded', { plate: this.activePlate, drink });
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
    if (isPlateEmpty(plate)) return false;

    const reason = checkPlate(guest.order, plate);
    if (reason) {
      this.events.emit('rejected', { guest, plate: plateIndex, reason });
      return false;
    }

    const payment = payFor(plate, guest.patienceLeft / guest.patienceSec, this.combo);
    this.combo = payment.allPerfect ? this.combo + 1 : 0;
    this.stats.bestCombo = Math.max(this.stats.bestCombo, this.combo);
    this.money += payment.price;
    this.tips += payment.tip;
    this.stats.served += 1;
    clearPlate(plate);
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

    this.tickStations(dtSec);
    this.tickGuests(dtSec);
    this.tickArrivals(dtSec);

    if (this.isClosing && this.seats.every((guest) => guest === null)) {
      this.finished = true;
      this.events.emit('finished', undefined);
    }
  }

  private tickStations(dtSec: number): void {
    const tea = this.teapot;
    if (tea.state === 'brewing' || tea.state === 'hot') {
      tea.leftSec -= dtSec;
      if (tea.leftSec <= 0) {
        tea.state = tea.state === 'brewing' ? 'hot' : 'cold';
        tea.leftSec = tea.state === 'hot' ? balance.tea.hotSec : 0;
        this.events.emit('tea', { state: tea.state });
      }
    }

    const fridge = this.fridge;
    if (fridge.refillLeftSec > 0) {
      fridge.refillLeftSec -= dtSec;
      if (fridge.refillLeftSec <= 0) {
        fridge.refillLeftSec = 0;
        fridge.stock = fridge.capacity;
        this.events.emit('ayranRefill', { done: true });
      }
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
      order: {
        items: template.items.map((item) => ({ ...item })),
        sides: [...template.sides],
        drink: template.drink,
      },
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
