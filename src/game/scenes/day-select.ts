import Phaser from 'phaser';
import { ui } from '../art/palette';
import { balance } from '../balance';
import { FONT_FAMILY, SceneKey, Tex } from '../keys';
import { campaignLocations, dayRefs, daysOf } from '../levels';
import type { LocationId } from '../locations';
import { dayStars, isDayUnlocked, isLocationUnlocked, locationStars } from '../progress';
import { services } from '../services';
import { Button } from '../ui/button';
import { goalText } from '../ui/goal-text';
import { addLabel } from '../ui/text';
import type { DaySceneData } from './day';
import type { UpgradesSceneData } from './upgrades';

export interface DaySelectData {
  location?: LocationId;
}

export const REGISTRY_LOCATION = 'location';

export class DaySelectScene extends Phaser.Scene {
  private location: LocationId = 'roadside';

  constructor() {
    super(SceneKey.DaySelect);
  }

  init(data: DaySelectData): void {
    const { save } = services();
    const remembered: unknown = this.registry.get(REGISTRY_LOCATION);
    const wanted =
      data.location ??
      campaignLocations.find((location) => location === remembered) ??
      campaignLocations.findLast((location) => isLocationUnlocked(save.data, location, dayRefs));
    this.location = wanted ?? 'roadside';
    this.registry.set(REGISTRY_LOCATION, this.location);
  }

  create(): void {
    const { i18n, save } = services();
    const { width, height } = this.scale;
    const cx = width / 2;
    const progress = save.data;
    const days = daysOf(this.location);
    const unlocked = isLocationUnlocked(progress, this.location, dayRefs);

    this.add.image(0, 0, Tex.Background).setOrigin(0);
    this.add.rectangle(0, 0, width, height, 0x2a1b14, 0.78).setOrigin(0);

    this.add.image(44, 56, Tex.Coin).setScale(1.2);
    this.add
      .text(78, 56, String(progress.money), {
        fontFamily: FONT_FAMILY,
        fontSize: '40px',
        fontStyle: 'bold',
        color: ui.gold,
      })
      .setOrigin(0, 0.5);
    this.add
      .image(width - 150, 54, Tex.Star)
      .setScale(0.75)
      .setTint(0xffd447);
    this.add
      .text(
        width - 120,
        56,
        i18n.t('select.stars', {
          count: locationStars(progress, this.location, dayRefs),
          total: days.length * 3,
        }),
        { fontFamily: FONT_FAMILY, fontSize: '36px', fontStyle: 'bold', color: ui.text },
      )
      .setOrigin(0, 0.5);

    addLabel(this, cx, 158, i18n.t(`location.${this.location}`), 50, ui.gold)
      .setFontStyle('bold')
      .setStroke('#3a2418', 8);

    const index = campaignLocations.indexOf(this.location);
    const previous = campaignLocations[index - 1];
    const next = campaignLocations[index + 1];
    if (previous) this.arrow(64, 158, '◀', previous);
    if (next) this.arrow(width - 64, 158, '▶', next);

    if (!unlocked) {
      addLabel(
        this,
        cx,
        height * 0.42,
        i18n.t('select.locked', { count: balance.progress.starsToUnlockLocation }),
        36,
        ui.muted,
      ).setWordWrapWidth(560);
    } else {
      days.forEach((day, order) => {
        const x = order % 2 === 0 ? cx - 170 : cx + 170;
        const y = 290 + Math.floor(order / 2) * 142;
        const open = isDayUnlocked(progress, day, dayRefs);
        const stars = dayStars(progress, day.id);
        const cell = new Button(
          this,
          x,
          y,
          i18n.t('select.day', { day: day.day }),
          () => this.scene.start(SceneKey.Day, { dayId: day.id } satisfies DaySceneData),
          {
            width: 310,
            height: 122,
            fontSize: 36,
            textOffsetY: open ? -34 : 0,
            color: stars > 0 ? ui.green : ui.primary,
          },
        );
        cell.setEnabled(open);
        if (!open) return;
        for (let star = 0; star < 3; star += 1) {
          this.add
            .image(x - 40 + star * 40, y + 6, Tex.Star)
            .setScale(0.5)
            .setTint(star < stars ? 0xffd447 : 0x000000)
            .setAlpha(star < stars ? 1 : 0.3);
        }
        addLabel(this, x, y + 42, goalText(i18n, day.goal), 19, ui.text).setAlpha(0.9);
      });
    }

    Button.create(
      this,
      cx,
      height - 190,
      i18n.t('select.upgrades'),
      () =>
        this.scene.start(SceneKey.Upgrades, {
          location: this.location,
        } satisfies UpgradesSceneData),
      { color: ui.primary, height: 96 },
    ).setEnabled(unlocked);

    Button.create(
      this,
      cx,
      height - 78,
      i18n.t('select.back'),
      () => this.scene.start(SceneKey.Menu),
      {
        color: ui.secondary,
        height: 90,
      },
    );
  }

  private arrow(x: number, y: number, label: string, target: LocationId): void {
    Button.create(
      this,
      x,
      y,
      label,
      () => this.scene.start(SceneKey.DaySelect, { location: target } satisfies DaySelectData),
      { width: 84, height: 84, fontSize: 40, color: ui.secondary },
    );
  }
}
