import Phaser from 'phaser';
import { generateArt } from '../art';
import { generateAudio } from '../audio/sfx';
import { devParams } from '../dev-params';
import { SceneKey } from '../keys';
import { hasDay } from '../levels';
import { services } from '../services';
import { addLabel } from '../ui/text';
import type { DaySceneData } from './day';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super(SceneKey.Preload);
  }

  create(): void {
    const { i18n, platform } = services();
    const { width, height } = this.scale;
    addLabel(this, width / 2, height / 2, i18n.t('loading', { percent: 100 }), 36);

    generateArt(this);
    generateAudio(this);
    platform.gameReady();

    if (devParams.day !== null && hasDay(devParams.day)) {
      this.scene.start(SceneKey.Day, { dayId: devParams.day } satisfies DaySceneData);
      return;
    }
    this.scene.start(SceneKey.Menu);
  }
}
