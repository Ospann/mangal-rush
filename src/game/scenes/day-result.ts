import Phaser from 'phaser';
import { ui } from '../art/palette';
import { SceneKey, Tex } from '../keys';
import type { DayStats } from '../sim/day-sim';
import { services } from '../services';
import { Button } from '../ui/button';
import { addLabel } from '../ui/text';
import type { DaySceneData } from './day';

export interface DayResultData {
  dayId: string;
  money: number;
  tips: number;
  stats: DayStats;
}

export class DayResultScene extends Phaser.Scene {
  private result: DayResultData | null = null;
  private busy = false;

  constructor() {
    super(SceneKey.DayResult);
  }

  init(data: DayResultData): void {
    this.result = data;
    this.busy = false;
  }

  create(): void {
    const result = this.result;
    if (!result) {
      this.scene.start(SceneKey.Menu);
      return;
    }
    const { i18n, ads } = services();
    const { width, height } = this.scale;
    const cx = width / 2;

    this.add.image(0, 0, Tex.Background).setOrigin(0);
    this.add.rectangle(0, 0, width, height, 0x2a1b14, 0.72).setOrigin(0);

    addLabel(this, cx, height * 0.13, i18n.t('result.title'), 72, ui.gold)
      .setFontStyle('bold')
      .setStroke('#3a2418', 10);

    const total = result.money + result.tips;
    this.add.image(cx - 150, height * 0.235, Tex.Coin).setScale(1.5);
    addLabel(
      this,
      cx + 20,
      height * 0.235,
      i18n.t('result.total', { amount: total }),
      56,
    ).setFontStyle('bold');

    const lines: readonly (readonly [string, string])[] = [
      [i18n.t('result.revenue', { amount: result.money }), ui.text],
      [i18n.t('result.tips', { amount: result.tips }), ui.text],
      [i18n.t('result.served', { count: result.stats.served }), ui.good],
      [
        i18n.t('result.lost', { count: result.stats.lost }),
        result.stats.lost > 0 ? ui.bad : ui.muted,
      ],
      [i18n.t('result.perfect', { count: result.stats.perfectSkewers }), ui.gold],
      [
        i18n.t('result.burnt', { count: result.stats.burntSkewers }),
        result.stats.burntSkewers > 0 ? ui.bad : ui.muted,
      ],
      [i18n.t('result.combo', { count: result.stats.bestCombo }), ui.text],
    ];
    lines.forEach(([text, color], index) => {
      const label = addLabel(this, cx, height * 0.32 + index * 58, text, 38, color).setAlpha(0);
      this.tweens.add({ targets: label, alpha: 1, duration: 220, delay: 150 + index * 90 });
    });

    Button.create(
      this,
      cx,
      height * 0.76,
      i18n.t('result.again'),
      () => {
        void this.guard(async () => {
          await ads.showInterstitial();
          this.scene.start(SceneKey.Day, { dayId: result.dayId } satisfies DaySceneData);
        });
      },
      { color: ui.primary },
    );

    Button.create(
      this,
      cx,
      height * 0.87,
      i18n.t('result.menu'),
      () => {
        void this.guard(async () => {
          await ads.showInterstitial();
          this.scene.start(SceneKey.Menu);
        });
      },
      { color: ui.secondary },
    );
  }

  private async guard(action: () => Promise<void>): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      await action();
    } finally {
      this.busy = false;
    }
  }
}
