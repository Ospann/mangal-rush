import Phaser from 'phaser';
import type { MeatKind } from '../balance';
import { chunkTextures, STICK_H } from '../art/food-art';
import { Tex } from '../keys';
import { downSide, upSide, type Skewer } from '../sim/skewer';
import { meatColor } from './meat-color';

const CHUNK_OFFSETS = [-84, -28, 28, 84] as const;
const STICK_TOP = -166;

export class SkewerSprite extends Phaser.GameObjects.Container {
  homeX = 0;
  homeY = 0;
  held = false;
  private readonly inner: Phaser.GameObjects.Container;
  private readonly tops: Phaser.GameObjects.Image[] = [];
  private readonly unders: Phaser.GameObjects.Image[] = [];
  private frozen = false;

  constructor(
    scene: Phaser.Scene,
    readonly kind: MeatKind,
    readonly skewerId = 0,
  ) {
    super(scene, 0, 0);
    this.inner = new Phaser.GameObjects.Container(scene, 0, 0);
    const stick = new Phaser.GameObjects.Image(scene, 0, STICK_TOP, Tex.Stick).setOrigin(0.5, 0);
    this.inner.add(stick);

    const textures = chunkTextures(kind);
    const texture = (index: number): string => textures[index] ?? textures[0] ?? '';
    for (const [index, offset] of CHUNK_OFFSETS.entries()) {
      const under = new Phaser.GameObjects.Image(scene, 0, offset + 7, texture(index));
      under.setScale(1.05);
      this.unders.push(under);
      this.inner.add(under);
    }
    for (const [index, offset] of CHUNK_OFFSETS.entries()) {
      const top = new Phaser.GameObjects.Image(scene, 0, offset, texture(index));
      this.tops.push(top);
      this.inner.add(top);
    }

    this.add(this.inner);
    this.setSize(80, STICK_H);
    this.paint(0, 0);
    scene.add.existing(this);
  }

  sync(skewer: Skewer): void {
    if (this.frozen) return;
    this.paint(upSide(skewer), downSide(skewer));
  }

  paint(up: number, down: number): void {
    const topColor = meatColor(this.kind, up);
    const underColor = meatColor(this.kind, down);
    for (const image of this.tops) image.setTint(topColor);
    for (const image of this.unders) image.setTint(underColor);
  }

  playFlip(): void {
    this.frozen = true;
    this.scene.tweens.killTweensOf(this.inner);
    this.inner.scaleX = 1;
    this.scene.tweens.add({
      targets: this.inner,
      scaleX: 0.05,
      duration: 70,
      ease: 'Sine.easeIn',
      onComplete: () => {
        this.frozen = false;
        this.scene.tweens.add({
          targets: this.inner,
          scaleX: 1,
          duration: 110,
          ease: 'Back.easeOut',
        });
      },
    });
  }

  settle(dtSec: number): void {
    if (this.held) return;
    const k = Math.min(1, dtSec * 22);
    this.x += (this.homeX - this.x) * k;
    this.y += (this.homeY - this.y) * k;
  }
}
