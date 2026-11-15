import Phaser from 'phaser';
import { ui } from '../art/palette';
import { FONT_FAMILY, SceneKey, Sfx, Tex } from '../keys';
import {
  locationUpgrades,
  maxUpgradeLevel,
  upgradeCost,
  upgradeLevel,
  type LocationId,
} from '../locations';
import { buyUpgrade, locationLevels } from '../progress';
import { services } from '../services';
import { Button } from '../ui/button';
import { addLabel } from '../ui/text';
import { fadeIn, switchScene } from '../ui/transition';
import type { DaySelectData } from './day-select';

export interface UpgradesSceneData {
  location: LocationId;
}

const ROW_H = 96;

export class UpgradesScene extends Phaser.Scene {
  private location: LocationId = 'roadside';

  constructor() {
    super(SceneKey.Upgrades);
  }

  init(data: Partial<UpgradesSceneData>): void {
    this.location = data.location ?? 'roadside';
  }

  create(): void {
    fadeIn(this);
    const { i18n, save } = services();
    const { width, height } = this.scale;
    const cx = width / 2;
    const levels = locationLevels(save.data, this.location);

    this.add.image(0, 0, Tex.Background).setOrigin(0);
    this.add.rectangle(0, 0, width, height, 0x2a1b14, 0.82).setOrigin(0);

    addLabel(this, cx, 60, i18n.t('upgrades.title'), 46, ui.gold)
      .setFontStyle('bold')
      .setStroke('#3a2418', 8);
    addLabel(this, cx, 112, i18n.t(`location.${this.location}`), 26, ui.muted);
    this.add.image(cx - 70, 160, Tex.Coin);
    this.add
      .text(cx - 42, 160, String(save.data.money), {
        fontFamily: FONT_FAMILY,
        fontSize: '38px',
        fontStyle: 'bold',
        color: ui.gold,
      })
      .setOrigin(0, 0.5);

    locationUpgrades(this.location).forEach((upgrade, row) => {
      const y = 250 + row * ROW_H;
      const level = upgradeLevel(this.location, levels, upgrade);
      const max = maxUpgradeLevel(this.location, upgrade);
      const cost = upgradeCost(this.location, upgrade, level);

      this.add.rectangle(cx, y, 680, ROW_H - 10, 0x000000, 0.3).setStrokeStyle(2, 0xffffff, 0.08);
      this.add
        .text(34, y - 20, i18n.t(`upgrade.${upgrade}.name`), {
          fontFamily: FONT_FAMILY,
          fontSize: '28px',
          fontStyle: 'bold',
          color: ui.text,
        })
        .setOrigin(0, 0.5);
      this.add
        .text(34, y + 18, i18n.t(`upgrade.${upgrade}.desc`), {
          fontFamily: FONT_FAMILY,
          fontSize: '21px',
          color: ui.muted,
        })
        .setOrigin(0, 0.5);

      for (let pip = 0; pip < max; pip += 1) {
        this.add.circle(432 + pip * 26, y, 9, pip < level ? 0xffd447 : 0x5a4636);
      }

      const button = new Button(
        this,
        width - 104,
        y,
        cost === null ? i18n.t('upgrades.max') : String(cost),
        () => this.buy(upgrade),
        { width: 170, height: 68, fontSize: 30, color: cost === null ? ui.secondary : ui.green },
      );
      button.setEnabled(cost !== null && save.data.money >= cost);
    });

    Button.create(
      this,
      cx,
      height - 70,
      i18n.t('upgrades.back'),
      () =>
        switchScene(this, SceneKey.DaySelect, { location: this.location } satisfies DaySelectData),
      { color: ui.secondary, height: 86 },
    );
  }

  private buy(upgrade: Parameters<typeof buyUpgrade>[2]): void {
    const { save } = services();
    const next = buyUpgrade(save.data, this.location, upgrade);
    if (!next) return;
    save.update((draft) => {
      draft.money = next.money;
      draft.upgrades = next.upgrades;
    });
    if (this.cache.audio.exists(Sfx.Coin)) this.sound.play(Sfx.Coin, { volume: 0.7 });
    this.scene.restart({ location: this.location } satisfies UpgradesSceneData);
  }
}
