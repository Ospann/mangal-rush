import Phaser from 'phaser';
import { SceneKey } from '../keys';
import { TOY_DAY_ID } from '../levels';
import { services } from '../services';
import { ui } from '../art/palette';
import { Button } from '../ui/button';
import { addLabel } from '../ui/text';

export const REGISTRY_DAY = 'day';
export const QUIT_EVENT = 'quit-day';

function isToy(game: Phaser.Game): boolean {
  return game.registry.get(REGISTRY_DAY) === TOY_DAY_ID;
}

export class PauseScene extends Phaser.Scene {
  constructor() {
    super(SceneKey.Pause);
  }

  create(): void {
    const { i18n } = services();
    const { width, height } = this.scale;

    const shade = this.add
      .rectangle(0, 0, width, height, 0x000000, 0.65)
      .setOrigin(0)
      .setInteractive();
    shade.setAlpha(0);
    this.tweens.add({ targets: shade, alpha: 1, duration: 160 });
    addLabel(this, width / 2, height * 0.4, i18n.t('pause.title'), 80);
    Button.create(
      this,
      width / 2,
      height * 0.55,
      i18n.t('pause.resume'),
      () => {
        resumeGame(this.game);
      },
      { color: ui.primary },
    );
    Button.create(
      this,
      width / 2,
      height * 0.66,
      i18n.t(isToy(this.game) ? 'pause.finish' : 'pause.quit'),
      () => {
        quitDay(this.game);
      },
      { color: ui.secondary },
    );
  }
}

export function pauseGame(game: Phaser.Game): void {
  const { scene } = game;
  if (!scene.isActive(SceneKey.Day) || scene.isActive(SceneKey.Pause)) return;
  const { gameplay, mute } = services();
  scene.pause(SceneKey.Day);
  gameplay.stop();
  mute.set('pause', true);
  scene.run(SceneKey.Pause);
  scene.bringToTop(SceneKey.Pause);
}

export function resumeGame(game: Phaser.Game): void {
  const { gameplay, mute } = services();
  game.scene.stop(SceneKey.Pause);
  game.scene.resume(SceneKey.Day);
  mute.set('pause', false);
  gameplay.start();
}

export function quitDay(game: Phaser.Game): void {
  const { mute, platform } = services();
  game.scene.stop(SceneKey.Pause);
  mute.set('pause', false);
  if (isToy(game)) {
    game.scene.resume(SceneKey.Day);
    game.scene.getScene(SceneKey.Day).events.emit(QUIT_EVENT);
    return;
  }
  platform.levelFail();
  game.scene.stop(SceneKey.Day);
  game.scene.start(SceneKey.DaySelect);
}
