import { Emitter } from '@core/events';
import {
  balance,
  type Doneness,
  type DrinkKind,
  type EventKind,
  type GuestKind,
  type MeatKind,
  type SideKind,
} from '../balance';
import type { DayLevel } from '../levels/types';
import { baseMods, type DayMods } from '../locations';
import { lineIndex, regularFor, type RegularVisits } from '../regulars';
import { Grill } from './grill';
import {
  banquetLeft,
  banquetOf,
  checkGuestPlate,
  orderFor,
  pickGuestKind,
  type Banquet,
} from './guests';
import {
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
  kind: GuestKind;
  look: string;
  regular: string | null;
  line: number;
  invited: boolean;
  banquet: Banquet | null;
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

export interface EndlessRules {
  maxLost: number;
  rampSec: number;
  minIntervalMult: number;
  patienceGraceSec: number;
  patienceRampSec: number;
  minPatienceMult: number;
}

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
  banquetProgress: { guest: Guest; left: number };
  banquetDone: { guest: Guest; bonus: number };
  friendsComing: { guest: Guest; count: number };
  eventStart: { type: EventKind };
  eventEnd: { type: EventKind };
  taken: { slot: number; plate: number; kind: MeatKind; quality: Doneness };
  trashed: { count: number };
  fanned: { slot: number };
  coalsAdded: undefined;
  guestBack: { guest: Guest };
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

  readonly mods: DayMods;
  readonly slotCount: number;
  readonly verdicts = { blogger: 0, critic: 0 };
  private readonly activeEvents = new Set<EventKind>();
  private readonly pendingKinds: GuestKind[] = [];
  private readonly pendingBanquets: Banquet[] = [];
  private readonly startedEvents = new Set<number>();
  private readonly visitedToday = new Set<string>();
  private readonly regularVisits: RegularVisits | null;
  readonly endless: EndlessRules | null;

  constructor(
    readonly level: DayLevel,
    mods: DayMods = baseMods(),
    regularVisits: RegularVisits | null = null,
    endless: EndlessRules | null = null,
  ) {
    this.mods = mods;
    this.regularVisits = regularVisits;
    this.endless = endless;
    this.slotCount = level.grillSlots ?? mods.grillSlots;
    this.rng = createRng(level.seed);
    this.grill = new Grill(
      this.slotCount,
      createRng(level.seed ^ 0x9e3779b9),
      level.start.coalLevel,
    );
    this.plates = Array.from({ length: level.plates ?? mods.plates }, () => emptyPlate());
    const ayran = level.start.ayran + mods.fridgeBonus;
    this.fridge = { stock: ayran, capacity: ayran, refillLeftSec: 0 };
    this.seats = Array.from({ length: level.seats }, () => null);
    this.nextArrivalSec = level.guests.firstDelaySec;
  }

  get timeLeftSec(): number {
    return Math.max(0, this.level.durationSec - this.timeSec);
  }

  get isClosing(): boolean {
    if (this.endless) return this.stats.lost >= this.endless.maxLost;
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
    this.events.emit('taken', { slot, plate: plateIndex, kind: skewer.kind, quality });
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

  freshCoals(): boolean {
    if (this.finished) return false;
    this.grill.coals.refresh();
    this.events.emit('coalsAdded', undefined);
    return true;
  }

  reviveGuest(seat: number): boolean {
    const guest = this.seats[seat];
    if (this.finished || !guest || guest.state !== 'angry') return false;
    guest.state = 'waiting';
    guest.patienceLeft = guest.patienceSec;
    guest.leaveLeftSec = 0;
    this.stats.lost = Math.max(0, this.stats.lost - 1);
    if (guest.kind === 'blogger') this.verdicts.blogger = 0;
    if (guest.kind === 'critic') this.verdicts.critic = 0;
    this.events.emit('guestBack', { guest });
    return true;
  }

  serve(plateIndex: number, seat: number): boolean {
    const plate = this.plates[plateIndex];
    const guest = this.seats[seat];
    if (this.finished || !plate || !guest || guest.state !== 'waiting') return false;
    if (isPlateEmpty(plate)) return false;

    if (this.mods.helper && plate.sides.every((side) => guest.order.sides.includes(side))) {
      for (const side of guest.order.sides) {
        if (plate.sides.includes(side)) continue;
        plate.sides.push(side);
        plate.added.push('side');
      }
    }

    const reason = checkGuestPlate(guest.kind, guest.order, guest.banquet, plate);
    if (reason) {
      this.events.emit('rejected', { guest, plate: plateIndex, reason });
      return false;
    }

    const fraction = guest.patienceLeft / guest.patienceSec;
    const flat = guest.kind === 'granny' ? balance.guestRules.grannyTipRate : null;
    const payment = payFor(plate, fraction, this.combo, flat);
    const overdone = plate.skewers.some((skewer) => qualityOf(skewer) === 'overdone');
    this.combo = payment.allPerfect ? this.combo + 1 : 0;
    this.stats.bestCombo = Math.max(this.stats.bestCombo, this.combo);
    const tip = Math.round(
      payment.tip * this.mods.tipMult * balance.guestTypes[guest.kind].tipMult,
    );
    this.money += payment.price;
    this.tips += tip;

    const banquet = guest.banquet;
    if (banquet) {
      for (const skewer of plate.skewers) {
        const item = banquet.remaining.find((entry) => entry.kind === skewer.kind);
        if (item) item.count -= 1;
      }
      clearPlate(plate);
      const left = banquetLeft(banquet);
      this.events.emit('served', {
        guest,
        plate: plateIndex,
        price: payment.price,
        tip,
        combo: this.combo,
      });
      this.events.emit('banquetProgress', { guest, left });
      if (left > 0) return true;
      const bonus = banquet.total * balance.toy.bonusPerSkewer;
      this.money += bonus;
      this.stats.served += 1;
      guest.state = 'served';
      guest.leaveLeftSec = balance.guests.leaveSec;
      this.events.emit('banquetDone', { guest, bonus });
      this.events.emit('guestLeft', { guest });
      return true;
    }

    this.stats.served += 1;
    clearPlate(plate);
    guest.state = 'served';
    guest.leaveLeftSec = balance.guests.leaveSec;
    if (guest.kind === 'blogger')
      this.verdicts.blogger = payment.allPerfect ? 1 : overdone ? -1 : 0;
    if (guest.kind === 'critic') this.verdicts.critic = payment.allPerfect ? 1 : overdone ? -1 : 0;
    this.events.emit('served', {
      guest,
      plate: plateIndex,
      price: payment.price,
      tip,
      combo: this.combo,
    });
    this.events.emit('guestLeft', { guest });

    const rules = balance.guestRules;
    if (guest.kind === 'student' && !guest.invited && fraction >= rules.studentFriendsAbove) {
      const [min, max] = rules.studentFriends;
      const count = this.isClosing ? 0 : this.rng.int(min, max);
      for (let index = 0; index < count; index += 1) this.pendingKinds.push('student');
      if (count > 0) {
        this.nextArrivalSec = Math.min(this.nextArrivalSec, rules.studentFriendDelaySec);
        this.events.emit('friendsComing', { guest, count });
      }
    }
    return true;
  }

  private tick(dtSec: number): void {
    this.timeSec += dtSec;

    this.tickEvents();
    const env = {
      decayMult:
        this.mods.coalDecayMult *
        (this.isEventActive('rain') && !this.mods.canopy ? balance.events.rain.decayMult : 1),
      flareMult: this.isEventActive('wind') ? balance.events.wind.flareMult : 1,
    };
    this.tickHelpers();

    for (const event of this.grill.tick(dtSec, env)) {
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

    const over = this.endless
      ? this.isClosing && !this.seats.some((guest) => guest?.state === 'angry')
      : this.isClosing && this.seats.every((guest) => guest === null);
    if (over) {
      this.finished = true;
      this.events.emit('finished', undefined);
    }
  }

  get revenue(): number {
    return this.money + this.tips;
  }

  isEventActive(type: EventKind): boolean {
    return this.activeEvents.has(type);
  }

  goalProgress(): { value: number; target: number; met: boolean } {
    const goal = this.level.goal;
    if (goal.type === 'noBurn') {
      return { value: this.stats.burntSkewers, target: 0, met: this.stats.burntSkewers === 0 };
    }
    const value =
      goal.type === 'earn'
        ? this.revenue
        : goal.type === 'serve'
          ? this.stats.served
          : this.stats.bestCombo;
    return { value, target: goal.value, met: value >= goal.value };
  }

  private tickEvents(): void {
    const now = new Set<EventKind>();
    for (const event of this.level.events) {
      if (this.timeSec >= event.atSec && this.timeSec < event.atSec + event.durationSec) {
        now.add(event.type);
      }
    }
    for (const type of now) {
      if (this.activeEvents.has(type)) continue;
      this.activeEvents.add(type);
      this.events.emit('eventStart', { type });
    }
    for (const type of this.activeEvents) {
      if (now.has(type)) continue;
      this.activeEvents.delete(type);
      this.events.emit('eventEnd', { type });
    }
  }

  private tickHelpers(): void {
    const slots = this.grill.slots;
    for (let index = 0; index < this.mods.autoFanSlots; index += 1) {
      const slot = index % 2 === 0 ? index / 2 : slots.length - 1 - (index - 1) / 2;
      const state = slots[slot];
      if (state?.skewer && !state.lifted) this.grill.coals.hold(slot, balance.upgrades.fan.boost);
    }
    const delay = this.mods.sprayerDelaySec;
    if (delay === null) return;
    slots.forEach((state, slot) => {
      if (state.flare && state.flareSec >= delay) this.splash(slot);
    });
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
          if (guest.kind === 'blogger') this.verdicts.blogger = -1;
          if (guest.kind === 'critic') this.verdicts.critic = -1;
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
    this.level.events.forEach((event, index) => {
      if (event.type !== 'toy' || this.startedEvents.has(index) || this.timeSec < event.atSec)
        return;
      this.startedEvents.add(index);
      this.pendingBanquets.push(banquetOf(event.order));
    });

    const seat = this.seats.indexOf(null);
    const banquet = this.pendingBanquets[0];
    if (banquet && seat !== -1) {
      this.pendingBanquets.shift();
      const event = this.level.events.find((entry) => entry.type === 'toy');
      this.seat(seat, 'office', true, banquet, event?.durationSec ?? 60);
      return;
    }

    if (this.isClosing) return;
    const rush = this.isEventActive('rush') ? balance.events.rush.intervalMult : 1;
    this.nextArrivalSec -= dtSec / (rush * this.rampMult());
    if (this.nextArrivalSec > 0 || seat === -1) return;

    const friend = this.pendingKinds.shift();
    const kind = friend ?? pickGuestKind(this.level.guests.types, this.timeSec, this.rng);
    this.seat(seat, kind, friend !== undefined, null, null);
    const [min, max] = this.level.guests.intervalSec;
    this.nextArrivalSec =
      this.pendingKinds.length > 0
        ? balance.guestRules.studentFriendDelaySec
        : this.rng.range(min, max);
  }

  private rampMult(): number {
    const rules = this.endless;
    if (!rules) return 1;
    return Math.max(rules.minIntervalMult, 1 / (1 + this.timeSec / rules.rampSec));
  }

  private patienceRamp(): number {
    const rules = this.endless;
    if (!rules) return 1;
    const late = Math.max(0, this.timeSec - rules.patienceGraceSec);
    return Math.max(rules.minPatienceMult, 1 - late / rules.patienceRampSec);
  }

  private seat(
    seat: number,
    kind: GuestKind,
    invited: boolean,
    banquet: Banquet | null,
    patienceOverride: number | null,
  ): void {
    const order = banquet
      ? { items: banquet.remaining, sides: [], drink: null }
      : orderFor(kind, this.level, this.rng);
    const patience =
      patienceOverride ??
      this.level.guests.patienceSec *
        this.mods.patienceMult *
        this.patienceRamp() *
        balance.guestTypes[kind].patienceMult;

    let regular: string | null = null;
    let line = 0;
    const def = banquet || invited ? null : regularFor(kind);
    if (
      def &&
      this.regularVisits &&
      !this.visitedToday.has(def.id) &&
      this.rng.next() < balance.guestRules.regularChance
    ) {
      this.visitedToday.add(def.id);
      regular = def.id;
      line = lineIndex(def, this.regularVisits[def.id] ?? 0);
    }

    const guest: Guest = {
      id: this.nextGuestId,
      seat,
      kind,
      look: banquet ? 'toy' : kind === 'local' ? `local-${this.rng.int(0, 2)}` : kind,
      regular,
      line,
      invited,
      banquet,
      order,
      patienceSec: patience,
      patienceLeft: patience,
      state: 'waiting',
      leaveLeftSec: 0,
    };
    this.nextGuestId += 1;
    this.seats[seat] = guest;
    this.events.emit('guestArrived', { guest });
  }
}
