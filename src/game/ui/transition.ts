import Phaser from 'phaser';

const FADE_MS = 200;
const SHADE = [24, 14, 10] as const;
const LEAVING = 'transition-leaving';

export function fadeIn(scene: Phaser.Scene): void {
  scene.data.set(LEAVING, false);
  scene.cameras.main.fadeIn(FADE_MS, ...SHADE);
}

export function switchScene(scene: Phaser.Scene, key: string, data?: object): void {
  if (scene.data.get(LEAVING) === true) return;
  scene.data.set(LEAVING, true);
  scene.input.enabled = false;
  const camera = scene.cameras.main;
  camera.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
    scene.input.enabled = true;
    scene.scene.start(key, data);
  });
  camera.fadeOut(FADE_MS, ...SHADE);
}
