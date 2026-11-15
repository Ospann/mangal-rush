import Phaser from 'phaser';
import type { Language } from '../../i18n';
import { ui } from '../art/palette';
import { currentDaily, dateKey } from '../daily';
import { SceneKey, Tex } from '../keys';
import { availableMeats, dayRefs, TOY_DAY_ID } from '../levels';
import { isToyUnlocked } from '../progress';
import { services } from '../services';
import { Button } from '../ui/button';
import { dailyText } from '../ui/daily-text';
import { addLabel } from '../ui/text';
import { fadeIn, switchScene } from '../ui/transition';
import { layout } from '../view/layout';
import { SkewerSprite } from '../view/skewer-sprite';
import type { DaySceneData } from './day';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super(SceneKey.Menu);
  }

  create(): void {
    fadeIn(this);
    const { i18n, save, mute } = services();
    const { width, height } = this.scale;
    const cx = width / 2;

    this.add.image(0, 0, Tex.Background).setOrigin(0);
    this.add.image(layout.grillX, layout.grillTop, Tex.Grill).setOrigin(0);
    this.add.rectangle(0, 0, width, height, 0x2a1b14, 0.55).setOrigin(0);
    this.add.particles(0, 0, Tex.Spark, {
      x: { min: layout.grillX + 40, max: width - layout.grillX - 40 },
      y: height + 10,
      lifespan: { min: 2600, max: 4200 },
      speedY: { min: -200, max: -90 },
      speedX: { min: -30, max: 30 },
      scale: { start: 0.7, end: 0 },
      alpha: { start: 0.9, end: 0 },
      tint: [0xffd060, 0xff8a2a, 0xffb347],
      blendMode: Phaser.BlendModes.ADD,
      frequency: 140,
    });

    const skewer = new SkewerSprite(this, 'lamb');
    skewer.paint(1.45, 1.45);
    skewer
      .setPosition(cx, height * 0.345)
      .setAngle(-78)
      .setScale(1.25);
    this.tweens.add({
      targets: skewer,
      angle: -72,
      duration: 1600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    const title = addLabel(this, cx, height * 0.15, '', 92, ui.gold).setFontStyle('bold');
    title.setStroke('#3a2418', 12);
    const subtitle = addLabel(this, cx, height * 0.225, '', 30, ui.muted);
    subtitle.setWordWrapWidth(620);

    const toyOpen = isToyUnlocked(save.data, dayRefs);
    const daily = currentDaily(save.data.daily, dateKey(new Date()), availableMeats(save.data));
    if (daily !== save.data.daily) save.set('daily', daily);

    this.add
      .rectangle(cx, height * 0.925, 660, 112, ui.panel, 0.85)
      .setStrokeStyle(2, 0xffd447, 0.6);
    const dailyTitle = addLabel(this, cx, height * 0.925 - 24, '', 26, ui.gold).setFontStyle(
      'bold',
    );
    const dailyLine = addLabel(this, cx, height * 0.925 + 20, '', 26, ui.text);
    dailyLine.setWordWrapWidth(630);

    const play = new Button(
      this,
      cx,
      height * 0.47,
      '',
      () => {
        switchScene(this, SceneKey.DaySelect);
      },
      { color: ui.primary },
    );

    const toy = new Button(
      this,
      cx,
      height * 0.57,
      '',
      () => {
        switchScene(this, SceneKey.Day, { dayId: TOY_DAY_ID } satisfies DaySceneData);
      },
      { color: ui.green, fontSize: toyOpen ? 44 : 30 },
    );
    toy.setEnabled(toyOpen);

    const sound = new Button(
      this,
      cx,
      height * 0.67,
      '',
      () => {
        const enabled = !save.data.soundEnabled;
        save.set('soundEnabled', enabled);
        mute.set('settings', !enabled);
        render();
      },
      { color: ui.secondary },
    );

    const language = new Button(
      this,
      cx,
      height * 0.77,
      '',
      () => {
        const list = i18n.languages;
        const next: Language = list[(list.indexOf(i18n.language) + 1) % list.length] ?? 'en';
        i18n.setLanguage(next);
        save.set('language', next);
        render();
      },
      { color: ui.secondary },
    );

    const render = (): void => {
      title.setText(i18n.t('menu.title'));
      subtitle.setText(i18n.t('menu.subtitle'));
      play.setText(i18n.t('menu.play'));
      const best = save.data.toyBest;
      toy.setText(
        !toyOpen
          ? i18n.t('menu.toy.locked')
          : best > 0
            ? i18n.t('menu.toy.best', { score: best })
            : i18n.t('menu.toy'),
      );
      dailyTitle.setText(
        daily.claimed ? i18n.t('menu.daily.done') : i18n.t('menu.daily', { reward: daily.reward }),
      );
      dailyLine.setText(dailyText(i18n, daily));
      sound.setText(i18n.t(save.data.soundEnabled ? 'menu.sound.on' : 'menu.sound.off'));
      language.setText(i18n.t('menu.language', { language: i18n.t(`language.${i18n.language}`) }));
    };

    render();
  }
}
