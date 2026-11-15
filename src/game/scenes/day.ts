import Phaser from 'phaser';
import { isTranslationKey } from '../../i18n';
import { ui } from '../art/palette';
import { SfxPlayer } from '../audio/sfx';
import { balance, eventKinds, type MeatKind } from '../balance';
import { devParams } from '../dev-params';
import { FONT_FAMILY, SceneKey, Sfx, Tex } from '../keys';
import { DEFAULT_DAY_ID, hasDay, loadDay } from '../levels';
import { baseMods, modsFor, withBuzz } from '../locations';
import { applyOutcome, evaluateDay } from '../progress';
import { regulars } from '../regulars';
import { DaySim } from '../sim/day-sim';
import { services } from '../services';
import { Button } from '../ui/button';
import { goalShortText, goalText } from '../ui/goal-text';
import { addLabel } from '../ui/text';
import { Depth, Fx } from '../view/fx';
import { GrillView } from '../view/grill-view';
import { GuestView } from '../view/guest-view';
import {
  inCoalStrip,
  inGrill,
  inMeatZone,
  layout,
  plateScale,
  plateX,
  seatX,
  skewerScaleX,
  skewerScaleY,
  slotAt,
  slotWidth,
  slotX,
} from '../view/layout';
import { PlateView } from '../view/plate-view';
import { SkewerSprite } from '../view/skewer-sprite';
import { StationsView } from '../view/stations-view';
import type { DayResultData } from './day-result';
import { REGISTRY_LOCATION } from './day-select';
import { pauseGame } from './pause';

export interface DaySceneData {
  dayId: string;
}

type Gesture =
  | {
      kind: 'skewer';
      slot: number;
      sprite: SkewerSprite;
      startX: number;
      startY: number;
      grabX: number;
      grabY: number;
      dragging: boolean;
    }
  | { kind: 'raw'; meat: MeatKind; ghost: SkewerSprite }
  | { kind: 'plate'; plate: number; startX: number; startY: number; dragging: boolean }
  | { kind: 'fan'; lastX: number; startX: number; startY: number; moved: number };

type DropTarget =
  | { kind: 'slot'; slot: number }
  | { kind: 'plate'; plate: number }
  | { kind: 'seat'; seat: number }
  | { kind: 'bucket' }
  | null;

function formatTime(seconds: number): string {
  const whole = Math.ceil(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

export class DayScene extends Phaser.Scene {
  private dayId = DEFAULT_DAY_ID;
  private sim!: DaySim;
  private fx!: Fx;
  private sfx!: SfxPlayer;
  private grillView!: GrillView;
  private stations!: StationsView;
  private plateViews: PlateView[] = [];
  private guestViews = new Map<number, GuestView>();
  private gestures = new Map<number, Gesture>();
  private hint!: Phaser.GameObjects.Graphics;
  private moneyText!: Phaser.GameObjects.Text;
  private timeText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private eventText!: Phaser.GameObjects.Text;
  private goalText!: Phaser.GameObjects.Text;
  private closingShown = false;
  private goalMet: boolean | null = null;
  private buzz = 0;
  private toastY = 0;
  private shownEvent = '';
  private shownGoal = '';
  private helpText: Phaser.GameObjects.Text | null = null;
  private coalsButton!: Button;
  private coalsLabel = '';
  private shownMoney = 0;
  private leaving = false;

  constructor() {
    super(SceneKey.Day);
  }

  init(data: Partial<DaySceneData>): void {
    this.dayId = data.dayId !== undefined && hasDay(data.dayId) ? data.dayId : DEFAULT_DAY_ID;
  }

  create(): void {
    const { platform, gameplay } = services();
    const { save } = services();
    const level = loadDay(this.dayId);
    const campaign = level.day > 0;
    this.buzz = campaign ? Math.sign(save.data.buzz) : 0;
    const mods = campaign
      ? withBuzz(modsFor(level.location, save.data.upgrades[level.location]), this.buzz)
      : baseMods();
    this.sim = new DaySim(level, mods, campaign ? { ...save.data.regulars } : null);
    if (campaign && save.data.buzz !== 0) save.set('buzz', 0);
    this.toastY = 0;
    this.registry.set(REGISTRY_LOCATION, level.location);
    this.shownEvent = '';
    this.shownGoal = '';
    this.closingShown = false;
    this.goalMet = null;
    this.plateViews = [];
    this.guestViews = new Map();
    this.gestures = new Map();
    this.shownMoney = 0;
    this.leaving = false;
    this.coalsLabel = '';

    this.buildWorld();
    this.buildHud();
    this.bindSim();
    this.bindInput();

    this.sfx.startSizzle();
    platform.levelStart({ world: this.sim.level.location, level: this.sim.level.id });
    gameplay.start();
    this.showIntro();
    if (this.buzz !== 0) {
      const { i18n } = services();
      this.time.delayedCall(2900, () =>
        this.toast(i18n.t(this.buzz > 0 ? 'day.buzz.good' : 'day.buzz.bad')),
      );
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.sfx.stop();
      this.sim.events.clear();
      this.input.removeAllListeners();
      for (const view of this.guestViews.values()) view.destroy();
    });
  }

  override update(_time: number, delta: number): void {
    const dtSec = delta / 1000;
    this.sim.step(dtSec * devParams.speed);

    this.grillView.update(dtSec);
    this.sim.plates.forEach((plate, index) => {
      const view = this.plateViews[index];
      view?.update(plate, dtSec);
      view?.setActive(index === this.sim.activePlate && this.sim.plates.length > 1);
    });
    this.stations.update(dtSec);
    for (const guest of this.sim.seats) {
      if (guest) this.guestViews.get(guest.id)?.update(guest, dtSec);
    }

    this.updateSizzle(dtSec);
    this.updateHud(dtSec);
  }

  private buildWorld(): void {
    const { i18n } = services();

    this.add.image(0, 0, Tex.Background).setOrigin(0).setDepth(Depth.Background);
    this.add.image(0, layout.counterY, Tex.Counter).setOrigin(0).setDepth(Depth.Counter);

    this.fx = new Fx(this);
    this.sfx = new SfxPlayer(this);
    this.grillView = new GrillView(this, this.sim.grill, this.fx, devParams.debug);

    const scale = plateScale(this.sim.plates.length);
    for (let index = 0; index < this.sim.plates.length; index += 1) {
      this.plateViews.push(
        new PlateView(this, plateX(index, this.sim.plates.length), layout.plateY, scale),
      );
    }
    this.stations = new StationsView(this, this.sim);

    this.hint = this.add.graphics().setDepth(Depth.Hint);

    this.helpText = null;
    const { day, location } = this.sim.level;
    if (day > 1 || (day === 1 && location !== 'roadside')) return;
    this.helpText = addLabel(
      this,
      layout.width / 2,
      layout.skewerY,
      i18n.t('day.hint'),
      30,
      ui.text,
    )
      .setDepth(Depth.Hint)
      .setWordWrapWidth(560)
      .setStroke('#2a1b14', 8)
      .setLineSpacing(8);
  }

  private toast(text: string): void {
    const label = addLabel(this, layout.width / 2, 0, text, 22, ui.text)
      .setWordWrapWidth(680)
      .setDepth(Depth.Float);
    const height = label.height + 16;
    const y = layout.counterY + 14 + height / 2 + this.toastY;
    this.toastY += height + 4;
    const panel = this.add
      .rectangle(layout.width / 2, y, 704, height, ui.panel, 0.9)
      .setStrokeStyle(2, 0xffd447, 0.7)
      .setDepth(Depth.Float);
    label.setY(y);
    this.tweens.add({
      targets: [panel, label],
      alpha: { from: 0, to: 1 },
      duration: 200,
    });
    this.tweens.add({
      targets: [panel, label],
      alpha: 0,
      duration: 350,
      delay: 4200,
      onComplete: () => {
        panel.destroy();
        label.destroy();
        this.toastY = Math.max(0, this.toastY - height - 4);
      },
    });
  }

  private showIntro(): void {
    const { i18n } = services();
    const level = this.sim.level;
    const title =
      level.day > 0
        ? `${i18n.t(`location.${level.location}`)} · ${i18n.t('select.day', { day: level.day })}`
        : level.id;
    const panel = this.add.container(layout.width / 2, 600).setDepth(Depth.Float);
    panel.add([
      this.add.rectangle(0, 0, 640, 170, ui.panel, 0.92).setStrokeStyle(4, 0xffd447, 0.9),
      addLabel(this, 0, -34, title, 36, ui.gold).setFontStyle('bold'),
      addLabel(this, 0, 28, goalText(i18n, level.goal), 30, ui.text).setWordWrapWidth(600),
    ]);
    panel.setScale(0.8).setAlpha(0);
    this.tweens.add({ targets: panel, scale: 1, alpha: 1, duration: 220, ease: 'Back.easeOut' });
    this.tweens.add({
      targets: panel,
      alpha: 0,
      y: 560,
      duration: 350,
      delay: 2400,
      onComplete: () => panel.destroy(),
    });
  }

  private buildHud(): void {
    const { i18n } = services();
    this.add
      .rectangle(0, 0, layout.width, layout.hudH, ui.panel, 0.86)
      .setOrigin(0)
      .setDepth(Depth.Hud);
    this.add.image(40, layout.hudH / 2, Tex.Coin).setDepth(Depth.Hud);
    this.moneyText = this.add
      .text(70, layout.hudH / 2, '0', {
        fontFamily: FONT_FAMILY,
        fontSize: '38px',
        fontStyle: 'bold',
        color: ui.gold,
      })
      .setOrigin(0, 0.5)
      .setDepth(Depth.Hud);
    this.timeText = addLabel(this, layout.width / 2, layout.hudH / 2, '', 38)
      .setFontStyle('bold')
      .setDepth(Depth.Hud);
    this.eventText = this.add
      .text(190, layout.hudH / 2, '', {
        fontFamily: FONT_FAMILY,
        fontSize: '24px',
        fontStyle: 'bold',
        color: '#ffb347',
      })
      .setOrigin(0, 0.5)
      .setDepth(Depth.Hud);
    this.goalText = addLabel(this, 536, layout.hudH / 2, '', 24, ui.text)
      .setFontStyle('bold')
      .setDepth(Depth.Hud);
    this.comboText = addLabel(this, layout.width - 20, layout.hudH + 30, '', 32, ui.gold)
      .setOrigin(1, 0.5)
      .setFontStyle('bold')
      .setStroke('#3a2418', 6)
      .setDepth(Depth.Hud)
      .setVisible(false);

    const pause = new Button(
      this,
      layout.width - 44,
      layout.hudH / 2,
      'II',
      () => pauseGame(this.game),
      {
        width: 72,
        height: 56,
        fontSize: 30,
        color: ui.secondary,
      },
    );
    pause.setDepth(Depth.Hud);

    this.coalsButton = new Button(
      this,
      layout.width / 2,
      layout.coalsButtonY,
      i18n.t('day.coals'),
      () => {
        this.sim.addCoals();
      },
      { width: 360, height: 60, fontSize: 30, color: ui.primary },
    );
    this.coalsButton.setDepth(Depth.Hud);
  }

  private bindSim(): void {
    const { i18n } = services();
    const events = this.sim.events;
    const slots = this.sim.slotCount;
    const meatMid = (layout.meatTop + layout.meatBottom) / 2;

    events.on('placed', () => {
      this.sfx.play(Sfx.Place, 0.7);
      this.dismissHelp();
    });

    events.on('flipped', ({ slot }) => {
      this.sfx.play(Sfx.Flip, 0.6, Phaser.Math.FloatBetween(0.92, 1.1));
      const skewer = this.sim.grill.slot(slot)?.skewer;
      if (skewer) this.grillView.spriteFor(skewer.id)?.playFlip();
      this.fx.spark(slotX(slot, slots), meatMid + 40, 3);
    });

    events.on('broke', ({ slot }) => {
      const x = slotX(slot, slots);
      this.sfx.play(Sfx.Trash, 0.9, 0.8);
      this.sfx.play(Sfx.Hm, 0.5, 1.1);
      this.fx.soot(x, meatMid, 6);
      this.fx.spark(x, layout.meatBottom - 30, 10);
      this.fx.floatText(x, meatMid - 40, i18n.t('day.broke'), ui.bad, 32);
      this.cameras.main.shake(100, 0.003);
    });

    events.on('sideAdded', ({ plate, side }) => {
      this.sfx.play(Sfx.Pop, 0.7, Phaser.Math.FloatBetween(0.95, 1.1));
      this.stations.bump(side);
      this.plateViews[plate]?.bump();
    });

    events.on('drinkAdded', ({ plate, drink }) => {
      this.sfx.play(Sfx.Pour, 0.7);
      this.stations.bump(drink);
      this.plateViews[plate]?.bump();
    });

    events.on('plateSelected', ({ plate }) => {
      this.sfx.play(Sfx.Flip, 0.35, 1.3);
      this.plateViews[plate]?.bump();
    });

    events.on('denied', () => {
      this.sfx.play(Sfx.Hm, 0.4, 1.3, 200);
      this.plateViews[this.sim.activePlate]?.bump();
    });

    events.on('tea', ({ state }) => {
      const x = this.stations.xOf('tea');
      if (state === 'brewing') this.sfx.play(Sfx.Pour, 0.5, 0.8);
      else if (state === 'hot') this.sfx.play(Sfx.Perfect, 0.35, 0.8);
      else if (state === 'cold') {
        this.sfx.play(Sfx.Hm, 0.4, 1.2);
        this.fx.floatText(x, layout.stationY - 50, i18n.t('day.tea.cold'), ui.bad, 26);
      }
    });

    events.on('ayranRefill', ({ done }) => {
      const x = this.stations.xOf('ayran');
      if (done) this.sfx.play(Sfx.Pop, 0.7, 0.8);
      else this.fx.floatText(x, layout.stationY - 50, i18n.t('day.ayran.out'), ui.muted, 26);
    });

    events.on('stage', ({ slot, stage }) => {
      const x = slotX(slot, slots);
      if (stage === 'perfect') {
        this.sfx.play(Sfx.Perfect, 0.45, 1, 90);
        this.fx.sparkle(x, meatMid, 4, 90);
      } else if (stage === 'burnt') {
        this.fx.soot(x, meatMid, 8);
        this.sfx.play(Sfx.Hm, 0.35, 0.8, 300);
      }
    });

    events.on('flare', ({ slot }) => {
      this.sfx.play(Sfx.Flare, 0.8, Phaser.Math.FloatBetween(0.9, 1.1));
      this.fx.spark(slotX(slot, slots), layout.meatBottom, 16);
      this.cameras.main.shake(90, 0.003);
    });

    events.on('flareOut', ({ slot, by }) => {
      if (by !== 'water') return;
      this.sfx.play(Sfx.Splash, 0.8);
      this.fx.splash(slotX(slot, slots), meatMid + 40);
    });

    events.on('taken', ({ plate, quality }) => {
      const view = this.plateViews[plate];
      this.sfx.play(Sfx.Place, 0.8, 1.2);
      view?.bump();
      if (quality !== 'perfect' || !view) return;
      this.sfx.play(Sfx.Perfect, 0.7, 1.12);
      this.fx.sparkle(view.homeX, view.homeY, 6, 70);
      this.fx.floatText(view.homeX, view.homeY - 70, i18n.t('day.perfect'), ui.gold, 34);
      if ('vibrate' in navigator) navigator.vibrate(30);
    });

    events.on('trashed', () => {
      this.sfx.play(Sfx.Trash, 0.7);
      this.fx.soot(layout.bucketX, layout.bucketY - 30, 3);
    });

    events.on('fanned', ({ slot }) => {
      this.sfx.play(Sfx.Fan, 0.5, Phaser.Math.FloatBetween(0.9, 1.15), 150);
      if (Math.random() < 0.5) {
        this.fx.spark(
          slotX(slot, slots) + Phaser.Math.Between(-30, 30),
          Phaser.Math.Between(layout.stripTop, layout.stripBottom),
          2,
        );
      }
    });

    events.on('coalsAdded', () => {
      this.sfx.play(Sfx.Coals, 0.9);
      this.cameras.main.shake(120, 0.004);
    });

    events.on('guestArrived', ({ guest }) => {
      const view = new GuestView(this, guest, seatX(guest.seat, this.sim.level.seats));
      this.guestViews.set(guest.id, view);
      const regular = regulars.find((entry) => entry.id === guest.regular);
      if (!regular) return;
      const key = `regular.${regular.id}.${guest.line}`;
      if (!isTranslationKey(key)) return;
      this.toast(`${i18n.t(`guest.${guest.kind}`)}: «${i18n.t(key)}»`);
      services().save.update((draft) => {
        draft.regulars = { ...draft.regulars, [regular.id]: (draft.regulars[regular.id] ?? 0) + 1 };
      });
    });

    events.on('friendsComing', ({ guest, count }) => {
      this.fx.floatText(
        seatX(guest.seat, this.sim.level.seats),
        layout.guestY + 40,
        i18n.t('day.friends', { count }),
        ui.good,
        28,
      );
    });

    events.on('banquetProgress', ({ guest, left }) => {
      if (left <= 0) return;
      this.fx.floatText(
        seatX(guest.seat, this.sim.level.seats),
        layout.guestY + 40,
        i18n.t('toy.left', { count: left }),
        ui.gold,
        28,
      );
    });

    events.on('banquetDone', ({ guest, bonus }) => {
      const x = seatX(guest.seat, this.sim.level.seats);
      this.sfx.play(Sfx.Bell, 0.8, 1.2);
      this.fx.sparkle(x, layout.guestY, 10, 120);
      this.fx.floatText(layout.width / 2, 300, i18n.t('toy.done', { amount: bonus }), ui.gold, 44);
      for (let index = 0; index < 8; index += 1) {
        this.fx.coin(x + index * 12 - 40, layout.guestY, 40, layout.hudH / 2, index * 60);
      }
    });

    events.on('eventEnd', ({ type }) => {
      if (type === 'rain') this.fx.setRain(false);
      if (type === 'wind') this.fx.setWind(false);
    });

    events.on('served', ({ guest, price, tip, combo }) => {
      const x = seatX(guest.seat, this.sim.level.seats);
      this.sfx.play(Sfx.Bell, 0.6);
      this.time.delayedCall(160, () => this.sfx.play(Sfx.Coin, 0.7));
      this.fx.floatText(x, layout.guestY - 60, `+${price}`, ui.gold, 44);
      if (tip > 0) {
        this.time.delayedCall(220, () =>
          this.fx.floatText(x, layout.guestY - 10, i18n.t('day.tip', { amount: tip }), ui.good, 30),
        );
      }
      for (let index = 0; index < 4; index += 1) {
        this.fx.coin(x + index * 14 - 20, layout.guestY, 40, layout.hudH / 2, index * 70);
      }
      if (combo >= 2) {
        this.fx.floatText(
          layout.width / 2,
          layout.plateY - 110,
          i18n.t('day.combo', { count: combo }),
          ui.gold,
          48,
        );
      }
    });

    events.on('rejected', ({ guest, reason }) => {
      this.sfx.play(Sfx.Hm, 0.8);
      this.guestViews.get(guest.id)?.shake();
      this.fx.floatText(
        seatX(guest.seat, this.sim.level.seats),
        layout.guestY - 40,
        i18n.t(`day.reject.${reason}`),
        ui.bad,
        30,
      );
    });

    events.on('guestLeft', ({ guest }) => {
      const happy = guest.state === 'served';
      this.guestViews.get(guest.id)?.leave(happy);
      if (!happy) this.sfx.play(Sfx.Hm, 0.9, 0.9);
    });

    events.on('guestGone', () => {
      const present = new Set(this.sim.seats.flatMap((guest) => (guest ? [guest.id] : [])));
      for (const [id, view] of this.guestViews) {
        if (present.has(id)) continue;
        view.destroy();
        this.guestViews.delete(id);
      }
    });

    events.on('eventStart', ({ type }) => {
      this.sfx.play(type === 'rush' ? Sfx.Bell : Sfx.Fan, 0.8, 0.7);
      this.fx.floatText(layout.width / 2, 300, i18n.t(`event.${type}`), '#ffb347', 44);
      if (type === 'rain') this.fx.setRain(true);
      if (type === 'wind') this.fx.setWind(true);
    });

    events.on('finished', () => this.finish());
  }

  private bindInput(): void {
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) =>
      this.onDown(pointer),
    );
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (pointer: Phaser.Input.Pointer) =>
      this.onMove(pointer),
    );
    this.input.on(Phaser.Input.Events.POINTER_UP, (pointer: Phaser.Input.Pointer) =>
      this.onUp(pointer),
    );
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, (pointer: Phaser.Input.Pointer) =>
      this.onUp(pointer),
    );
    this.events.on(Phaser.Scenes.Events.PAUSE, () => this.cancelGestures());
  }

  private onDown(pointer: Phaser.Input.Pointer): void {
    if (this.sim.finished || this.gestures.has(pointer.id)) return;
    const { x, y } = pointer;
    const slots = this.sim.slotCount;
    const insideSlots = x >= layout.slotsLeft - 12 && x <= layout.slotsRight + 12;

    if (insideSlots && inMeatZone(y)) {
      const slot = slotAt(x, slots);
      const state = this.sim.grill.slot(slot);
      const sprite = state?.skewer ? this.grillView.spriteFor(state.skewer.id) : null;
      if (state?.skewer && sprite && !state.lifted) {
        this.gestures.set(pointer.id, {
          kind: 'skewer',
          slot,
          sprite,
          startX: x,
          startY: y,
          grabX: sprite.x - x,
          grabY: sprite.y - y,
          dragging: false,
        });
        return;
      }
      this.gestures.set(pointer.id, { kind: 'fan', lastX: x, startX: x, startY: y, moved: 0 });
      return;
    }

    if (insideSlots && inCoalStrip(y)) {
      this.gestures.set(pointer.id, { kind: 'fan', lastX: x, startX: x, startY: y, moved: 0 });
      return;
    }

    const station = this.stations.hit(x, y);
    if (station?.kind === 'raw') {
      const ghost = new SkewerSprite(this, station.meat);
      ghost
        .setScale(skewerScaleX(slots), skewerScaleY(slots))
        .setDepth(Depth.Dragged)
        .setPosition(x, y);
      ghost.held = true;
      this.sfx.play(Sfx.Flip, 0.4, 0.8);
      this.gestures.set(pointer.id, { kind: 'raw', meat: station.meat, ghost });
      return;
    }
    if (station?.kind === 'side') {
      this.sim.addSide(station.side);
      return;
    }
    if (station?.kind === 'drink') {
      this.sim.tapDrink(station.drink);
      return;
    }

    for (const [index, view] of this.plateViews.entries()) {
      const plate = this.sim.plates[index];
      if (!plate || view.held) continue;
      if (Math.abs(x - view.homeX) > view.halfWidth || Math.abs(y - view.homeY) > view.halfHeight) {
        continue;
      }
      this.gestures.set(pointer.id, {
        kind: 'plate',
        plate: index,
        startX: x,
        startY: y,
        dragging: false,
      });
      return;
    }
  }

  private onMove(pointer: Phaser.Input.Pointer): void {
    const gesture = this.gestures.get(pointer.id);
    if (!gesture) return;
    const { x, y } = pointer;

    if (gesture.kind === 'skewer') {
      if (!gesture.dragging) {
        if (Phaser.Math.Distance.Between(x, y, gesture.startX, gesture.startY) < layout.tapSlop)
          return;
        gesture.dragging = true;
        gesture.sprite.held = true;
        gesture.sprite.setDepth(Depth.Dragged);
        this.sim.lift(gesture.slot, true);
      }
      gesture.sprite.setPosition(x + gesture.grabX, y + gesture.grabY);
      this.drawHint(this.cookedTarget(x, y, gesture.slot));
      return;
    }

    if (gesture.kind === 'raw') {
      gesture.ghost.setPosition(x, y);
      this.drawHint(this.rawTarget(x, y));
      return;
    }

    if (gesture.kind === 'plate') {
      const view = this.plateViews[gesture.plate];
      if (!view) return;
      if (!gesture.dragging) {
        if (Phaser.Math.Distance.Between(x, y, gesture.startX, gesture.startY) < layout.tapSlop)
          return;
        gesture.dragging = true;
        view.setHeld(true);
      }
      view.moveTo(x, y);
      this.drawHint(this.plateTarget(x, y));
      return;
    }

    const dx = Math.abs(x - gesture.lastX);
    gesture.lastX = x;
    gesture.moved += dx;
    if (dx <= 0 || !inGrill(y)) return;
    const slots = this.sim.slotCount;
    this.sim.fan(slotAt(x, slots), (dx / slotWidth(slots)) * balance.fan.perSlotWidth);
  }

  private onUp(pointer: Phaser.Input.Pointer): void {
    const gesture = this.gestures.get(pointer.id);
    if (!gesture) return;
    this.gestures.delete(pointer.id);
    this.hint.clear();
    const { x, y } = pointer;

    if (gesture.kind === 'skewer') {
      if (!gesture.dragging) {
        if (!this.sim.splash(gesture.slot)) this.sim.flip(gesture.slot);
        return;
      }
      gesture.sprite.held = false;
      gesture.sprite.setDepth(Depth.Skewers);
      const target = this.cookedTarget(x, y, gesture.slot);
      this.sim.lift(gesture.slot, false);
      if (target?.kind === 'plate') this.sim.takeToPlate(gesture.slot, target.plate);
      else if (target?.kind === 'bucket') this.sim.trashFromGrill(gesture.slot);
      else if (target?.kind === 'slot' && target.slot !== gesture.slot) {
        this.sim.moveSkewer(gesture.slot, target.slot);
      }
      return;
    }

    if (gesture.kind === 'raw') {
      const target = this.rawTarget(x, y);
      if (target?.kind === 'slot') {
        this.grillView.spawnNextAt(gesture.ghost.x, gesture.ghost.y);
        this.sim.placeSkewer(gesture.meat, target.slot);
      }
      gesture.ghost.destroy();
      return;
    }

    if (gesture.kind === 'plate') {
      const view = this.plateViews[gesture.plate];
      if (!view) return;
      if (!gesture.dragging) {
        this.sim.selectPlate(gesture.plate);
        return;
      }
      view.setHeld(false);
      const target = this.plateTarget(x, y);
      if (target?.kind === 'seat') this.sim.serve(gesture.plate, target.seat);
      else if (target?.kind === 'bucket') this.sim.removeLast(gesture.plate);
      return;
    }

    if (gesture.moved < layout.tapSlop && inMeatZone(gesture.startY)) {
      this.sim.splash(slotAt(gesture.startX, this.sim.slotCount));
    }
  }

  private cancelGestures(): void {
    for (const gesture of this.gestures.values()) {
      if (gesture.kind === 'skewer') {
        gesture.sprite.held = false;
        gesture.sprite.setDepth(Depth.Skewers);
        this.sim.lift(gesture.slot, false);
      } else if (gesture.kind === 'raw') {
        gesture.ghost.destroy();
      } else if (gesture.kind === 'plate') {
        this.plateViews[gesture.plate]?.setHeld(false);
      }
    }
    this.gestures.clear();
    this.hint.clear();
  }

  private nearBucket(x: number, y: number): boolean {
    return Phaser.Math.Distance.Between(x, y, layout.bucketX, layout.bucketY) < layout.bucketMagnet;
  }

  private freeSlotNear(x: number, keep: number | null): number | null {
    const slots = this.sim.slotCount;
    let best: number | null = null;
    let bestDistance = slotWidth(slots) * 1.1;
    for (let slot = 0; slot < slots; slot += 1) {
      if (slot !== keep && !this.sim.grill.isFree(slot)) continue;
      const distance = Math.abs(slotX(slot, slots) - x);
      if (distance < bestDistance) {
        best = slot;
        bestDistance = distance;
      }
    }
    return best;
  }

  private rawTarget(x: number, y: number): DropTarget {
    if (y < layout.grillTop - 50) return null;
    const slot = this.freeSlotNear(x, null);
    return slot === null ? null : { kind: 'slot', slot };
  }

  private cookedTarget(x: number, y: number, from: number): DropTarget {
    if (this.nearBucket(x, y)) return { kind: 'bucket' };
    if (y >= layout.grillTop - 50) {
      const slot = this.freeSlotNear(x, from);
      return slot === null ? null : { kind: 'slot', slot };
    }
    let best: DropTarget = null;
    let bestDistance: number = layout.plateMagnet;
    this.plateViews.forEach((view, index) => {
      const plate = this.sim.plates[index];
      if (!plate || plate.skewers.length >= balance.plate.capacity) return;
      const distance = Phaser.Math.Distance.Between(x, y, view.homeX, view.homeY);
      if (distance < bestDistance) {
        best = { kind: 'plate', plate: index };
        bestDistance = distance;
      }
    });
    return best;
  }

  private plateTarget(x: number, y: number): DropTarget {
    if (this.nearBucket(x, y)) return { kind: 'bucket' };
    const seats = this.sim.level.seats;
    let best: DropTarget = null;
    let bestDistance: number = layout.seatMagnet;
    this.sim.seats.forEach((guest, seat) => {
      if (!guest || guest.state !== 'waiting') return;
      const distance = Phaser.Math.Distance.Between(x, y, seatX(seat, seats), layout.guestY + 40);
      if (distance < bestDistance) {
        best = { kind: 'seat', seat };
        bestDistance = distance;
      }
    });
    return best;
  }

  private drawHint(target: DropTarget): void {
    const g = this.hint;
    g.clear();
    if (!target) return;
    g.lineStyle(6, 0xfff06a, 0.9);
    g.fillStyle(0xfff06a, 0.16);
    if (target.kind === 'slot') {
      const slots = this.sim.slotCount;
      const width = slotWidth(slots) - 14;
      const x = slotX(target.slot, slots) - width / 2;
      const height = layout.meatBottom - layout.meatTop + 24;
      g.fillRoundedRect(x, layout.meatTop - 12, width, height, 18);
      g.strokeRoundedRect(x, layout.meatTop - 12, width, height, 18);
    } else if (target.kind === 'plate') {
      const view = this.plateViews[target.plate];
      if (!view) return;
      g.fillEllipse(view.homeX, view.homeY, 230 * view.baseScale, 168 * view.baseScale);
      g.strokeEllipse(view.homeX, view.homeY, 230 * view.baseScale, 168 * view.baseScale);
    } else if (target.kind === 'seat') {
      const x = seatX(target.seat, this.sim.level.seats);
      g.fillCircle(x, layout.guestY, 118);
      g.strokeCircle(x, layout.guestY, 118);
    } else {
      g.fillCircle(layout.bucketX, layout.bucketY, 54);
      g.strokeCircle(layout.bucketX, layout.bucketY, 54);
    }
  }

  private updateSizzle(dtSec: number): void {
    let intensity = 0;
    this.sim.grill.slots.forEach((slot, index) => {
      if (!slot.skewer || slot.lifted) return;
      intensity += this.sim.grill.coals.heat(index) * (slot.flare ? 1.8 : 1);
    });
    this.sfx.updateSizzle(intensity, dtSec);
  }

  private updateHud(dtSec: number): void {
    const { i18n } = services();
    const total = this.sim.money + this.sim.tips;
    if (this.shownMoney !== total) {
      const step = Math.max(1, Math.ceil(Math.abs(total - this.shownMoney) * dtSec * 8));
      this.shownMoney = Math.min(total, this.shownMoney + step);
      this.moneyText.setText(String(this.shownMoney));
    }

    const closing = this.sim.isClosing;
    this.timeText.setText(formatTime(this.sim.timeLeftSec));
    this.timeText.setColor(closing || this.sim.timeLeftSec < 15 ? ui.bad : ui.text);
    if (closing && !this.closingShown) {
      this.closingShown = true;
      this.fx.floatText(layout.width / 2, 300, i18n.t('day.closing'), ui.bad, 44);
    }

    const active = eventKinds.filter((type) => this.sim.isEventActive(type));
    const eventLabel = active.map((type) => i18n.t(`event.short.${type}`)).join(' · ');
    if (eventLabel !== this.shownEvent) {
      this.shownEvent = eventLabel;
      this.eventText.setText(eventLabel);
    }

    const goal = this.sim.goalProgress();
    const goalLabel = goalShortText(i18n, this.sim.level.goal, goal.value);
    if (goalLabel !== this.shownGoal || this.goalMet !== goal.met) {
      this.shownGoal = goalLabel;
      this.goalMet = goal.met;
      this.goalText.setText(goalLabel);
      const failed = this.sim.level.goal.type === 'noBurn' && !goal.met;
      this.goalText.setColor(failed ? ui.bad : goal.met ? ui.good : ui.text);
    }

    this.comboText.setVisible(this.sim.combo >= 2);
    if (this.sim.combo >= 2) this.comboText.setText(i18n.t('day.combo', { count: this.sim.combo }));

    const coals = this.sim.grill.coals;
    const label = coals.canAdd
      ? i18n.t('day.coals')
      : i18n.t('day.coals.wait', { seconds: Math.ceil(coals.cooldownSec) });
    if (label !== this.coalsLabel) {
      this.coalsLabel = label;
      this.coalsButton.setText(label).setEnabled(coals.canAdd);
    }
  }

  private dismissHelp(): void {
    const help = this.helpText;
    if (!help) return;
    this.helpText = null;
    this.tweens.add({ targets: help, alpha: 0, duration: 400, onComplete: () => help.destroy() });
  }

  private finish(): void {
    if (this.leaving) return;
    this.leaving = true;
    const { platform, gameplay, ads, save } = services();
    const level = this.sim.level;
    this.cancelGestures();
    gameplay.stop();

    const { critic, blogger } = this.sim.verdicts;
    const outcome = evaluateDay(level.stars, this.sim.revenue, this.sim.goalProgress().met, critic);
    const info = { world: level.location, level: level.id };
    if (outcome.passed) platform.levelComplete(info);
    else platform.levelFail(info);
    ads.markLevelCompleted();
    if (level.day > 0) {
      const next = applyOutcome(save.data, level.id, outcome);
      save.update((draft) => {
        draft.money = next.money;
        draft.stars = next.stars;
        draft.buzz = blogger;
      });
    }

    const result: DayResultData = {
      dayId: this.dayId,
      money: this.sim.money,
      tips: this.sim.tips,
      stars: outcome.stars,
      goalMet: outcome.goalMet,
      critic,
      blogger,
      stats: { ...this.sim.stats },
    };
    this.time.delayedCall(700, () => this.scene.start(SceneKey.DayResult, result));
  }
}
