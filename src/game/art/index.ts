import type Phaser from 'phaser';
import { generateFoodArt } from './food-art';
import { generateFxArt } from './fx-art';
import { generateGuestArt } from './guest-art';
import { generateSceneArt } from './scene-art';

export function generateArt(scene: Phaser.Scene): void {
  generateSceneArt(scene);
  generateFoodArt(scene);
  generateGuestArt(scene);
  generateFxArt(scene);
}
