import Phaser from 'phaser';
import { ui } from '../art/palette';
import { SceneKey, Sfx, Tex } from '../keys';
import { dayRefs, hasDay, loadDay, nextDayId } from '../levels';
import { isDayUnlocked } from '../progress';
import type { DayStats } from '../sim/day-sim';
import { services } from '../services';
import { Button } from '../ui/button';
import { goalText } from '../ui/goal-text';
import { addLabel } from '../ui/text';
import type { DaySceneData } from './day';
import type { DaySelectData } from './day-select';
import type { UpgradesSceneData } from './upgrades';

export interface DayResultData {
  dayId: string;
  money: number;
  tips: number;
  stars: number;
  goalMet: boolean;
  critic: number;
  blogger: number;
  stats: DayStats;
  toy: { best: number; record: boolean; timeSec: number } | null;
}

function formatTime(seconds: number): string {
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
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
    if (!result || !hasDay(result.dayId)) {
      this.scene.start(SceneKey.Menu);
      return;
    }
    const { i18n, save } = services();
    const { width, height } = this.scale;
    const cx = width / 2;
    const level = loadDay(result.dayId);
    const campaign = level.day > 0;
    const toy = result.toy;
    const passed = result.stars >= 1 || toy !== null;

    this.add.image(0, 0, Tex.Background).setOrigin(0);
    this.add.rectangle(0, 0, width, height, 0x2a1b14, 0.78).setOrigin(0);

    addLabel(this, cx, 96, i18n.t(toy ? 'toy.result.title' : 'result.title'), 64, ui.gold)
      .setFontStyle('bold')
      .setStroke('#3a2418', 10);

    const jingle = passed ? Sfx.Fanfare : Sfx.Fail;
    if (this.cache.audio.exists(jingle)) this.sound.play(jingle, { volume: 0.55 });

    if (toy) {
      const record = addLabel(
        this,
        cx,
        224,
        toy.record ? i18n.t('toy.result.record') : i18n.t('toy.result.best', { score: toy.best }),
        toy.record ? 56 : 44,
        toy.record ? ui.gold : ui.text,
      ).setFontStyle('bold');
      if (toy.record) {
        this.tweens.add({
          targets: record,
          scale: { from: 0.6, to: 1.1 },
          duration: 420,
          ease: 'Back.easeOut',
          yoyo: true,
          hold: 200,
          repeat: 1,
        });
      }
    }

    for (let star = 0; star < (toy ? 0 : 3); star += 1) {
      const earned = star < result.stars;
      const image = this.add
        .image(cx + (star - 1) * 130, 232 - (star === 1 ? 18 : 0), Tex.Star)
        .setScale(earned ? 0 : 1.7)
        .setTint(earned ? 0xffd447 : 0x3a2418)
        .setAlpha(earned ? 1 : 0.6);
      if (!earned) continue;
      this.tweens.add({
        targets: image,
        scale: 1.9,
        duration: 320,
        delay: 250 + star * 280,
        ease: 'Back.easeOut',
        onStart: () => {
          if (this.cache.audio.exists(Sfx.Perfect)) {
            this.sound.play(Sfx.Perfect, { volume: 0.5, rate: 0.9 + star * 0.12 });
          }
        },
      });
    }

    const total = result.money + result.tips;
    this.add.image(cx - 160, 356, Tex.Coin).setScale(1.4);
    const totalLabel = addLabel(
      this,
      cx + 16,
      356,
      i18n.t('result.total', { amount: total }),
      52,
    ).setFontStyle('bold');

    const goalLine = result.goalMet ? i18n.t('result.goal.met') : i18n.t('result.goal.missed');
    const verdicts: (readonly [string, string])[] = [];
    if (result.critic !== 0) {
      verdicts.push(
        result.critic > 0
          ? [i18n.t('result.critic.good'), ui.good]
          : [i18n.t('result.critic.bad'), ui.bad],
      );
    }
    if (result.blogger !== 0 && campaign) {
      verdicts.push(
        result.blogger > 0
          ? [i18n.t('result.blogger.good'), ui.good]
          : [i18n.t('result.blogger.bad'), ui.bad],
      );
    }
    const header: (readonly [string, string])[] = toy
      ? [[i18n.t('toy.result.time', { time: formatTime(toy.timeSec) }), ui.gold]]
      : [
          ...verdicts,
          [goalText(i18n, level.goal), ui.muted],
          [
            passed ? goalLine : i18n.t('result.failed'),
            passed && result.goalMet ? ui.good : ui.bad,
          ],
        ];
    const lines: readonly (readonly [string, string])[] = [
      ...header,
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
    ];
    lines.forEach(([text, color], index) => {
      const label = addLabel(this, cx, 426 + index * 42, text, 28, color).setAlpha(0);
      label.setWordWrapWidth(660);
      this.tweens.add({ targets: label, alpha: 1, duration: 220, delay: 150 + index * 80 });
    });

    const nextId = nextDayId(result.dayId);
    const nextRef = dayRefs.find((day) => day.id === nextId);
    const canContinue =
      campaign && nextRef !== undefined && isDayUnlocked(save.data, nextRef, dayRefs);
    const toDay = (dayId: string): void =>
      this.leave(() => this.scene.start(SceneKey.Day, { dayId } satisfies DaySceneData));

    let y = 968;
    if (campaign && total > 0) {
      const double = Button.create(
        this,
        cx,
        872,
        i18n.t('result.double'),
        () => {
          if (this.busy) return;
          this.busy = true;
          void services()
            .ads.showRewarded()
            .then((rewarded) => {
              this.busy = false;
              if (!rewarded) return;
              save.update((draft) => {
                draft.money += Math.round(total);
              });
              double.setText(i18n.t('result.doubled', { amount: Math.round(total) }));
              double.setEnabled(false);
              totalLabel.setText(i18n.t('result.total', { amount: total * 2 }));
              if (this.cache.audio.exists(Sfx.Coin)) this.sound.play(Sfx.Coin, { volume: 0.7 });
            });
        },
        { color: ui.green, width: 560, height: 76, fontSize: 30 },
      );
    }
    if (canContinue && nextId) {
      Button.create(this, cx, y, i18n.t('result.next'), () => toDay(nextId), {
        color: ui.primary,
        height: 96,
      });
      y += 104;
    }
    Button.create(this, cx, y, i18n.t('result.again'), () => toDay(result.dayId), {
      color: canContinue ? ui.secondary : ui.primary,
      height: 88,
    });
    y += 100;

    if (!campaign) {
      Button.create(
        this,
        cx,
        y,
        i18n.t('result.menu'),
        () => this.leave(() => this.scene.start(SceneKey.Menu)),
        { color: ui.secondary, height: 88 },
      );
      return;
    }

    Button.create(
      this,
      cx - 172,
      y,
      i18n.t('result.upgrades'),
      () =>
        this.leave(() =>
          this.scene.start(SceneKey.Upgrades, {
            location: level.location,
          } satisfies UpgradesSceneData),
        ),
      { color: ui.green, width: 330, height: 88, fontSize: 34 },
    );
    Button.create(
      this,
      cx + 172,
      y,
      i18n.t('result.days'),
      () =>
        this.leave(() =>
          this.scene.start(SceneKey.DaySelect, {
            location: level.location,
          } satisfies DaySelectData),
        ),
      { color: ui.secondary, width: 330, height: 88, fontSize: 34 },
    );
  }

  private leave(go: () => void): void {
    if (this.busy) return;
    this.busy = true;
    void services()
      .ads.showInterstitial()
      .finally(() => {
        this.busy = false;
        go();
      });
  }
}
