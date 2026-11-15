import Phaser from 'phaser';
import type { Language } from '../../i18n';
import { ui } from '../art/palette';
import { SceneKey, Tex } from '../keys';
import { services } from '../services';
import { Button } from '../ui/button';
import { addLabel } from '../ui/text';
import { layout } from '../view/layout';
import { SkewerSprite } from '../view/skewer-sprite';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super(SceneKey.Menu);
  }

  create(): void {
    const { i18n, save, mute } = services();
    const { width, height } = this.scale;
    const cx = width / 2;

    this.add.image(0, 0, Tex.Background).setOrigin(0);
    this.add.image(layout.grillX, layout.grillTop, Tex.Grill).setOrigin(0);
    this.add.rectangle(0, 0, width, height, 0x2a1b14, 0.55).setOrigin(0);

    const skewer = new SkewerSprite(this, 'lamb');
    skewer.paint(1.45, 1.45);
    skewer
      .setPosition(cx, height * 0.36)
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

    const title = addLabel(this, cx, height * 0.18, '', 92, ui.gold).setFontStyle('bold');
    title.setStroke('#3a2418', 12);
    const subtitle = addLabel(this, cx, height * 0.255, '', 30, ui.muted);
    subtitle.setWordWrapWidth(620);

    const play = new Button(
      this,
      cx,
      height * 0.52,
      '',
      () => {
        this.scene.start(SceneKey.DaySelect);
      },
      { color: ui.primary },
    );

    const sound = new Button(
      this,
      cx,
      height * 0.64,
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
      height * 0.76,
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
      sound.setText(i18n.t(save.data.soundEnabled ? 'menu.sound.on' : 'menu.sound.off'));
      language.setText(i18n.t('menu.language', { language: i18n.t(`language.${i18n.language}`) }));
    };

    render();
  }
}
