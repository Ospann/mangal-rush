import Phaser from 'phaser';
import { drinkTexture, sideTexture } from '../art/food-art';
import { Tex } from '../keys';
import type { Plate } from '../sim/orders';
import { Depth } from './fx';
import { SkewerSprite } from './skewer-sprite';

const MINI_SCALE = 0.4;

export class PlateView {
  held = false;
  private readonly root: Phaser.GameObjects.Container;
  private readonly ring: Phaser.GameObjects.Graphics;
  private readonly items: Phaser.GameObjects.GameObject[] = [];
  private signature = '';
  private active = false;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly homeX: number,
    readonly homeY: number,
    readonly baseScale: number,
  ) {
    this.root = scene.add.container(homeX, homeY).setDepth(Depth.Props).setScale(baseScale);
    this.ring = new Phaser.GameObjects.Graphics(scene);
    this.ring.lineStyle(6, 0xfff06a, 0.95);
    this.ring.strokeEllipse(0, 0, 214, 152);
    this.ring.setVisible(false);
    this.root.add([this.ring, new Phaser.GameObjects.Image(scene, 0, 0, Tex.Plate)]);
  }

  get halfWidth(): number {
    return 104 * this.baseScale;
  }

  get halfHeight(): number {
    return 74 * this.baseScale;
  }

  setActive(active: boolean): void {
    if (active === this.active) return;
    this.active = active;
    this.ring.setVisible(active);
  }

  setHeld(held: boolean): void {
    this.held = held;
    this.root.setDepth(held ? Depth.Dragged : Depth.Props);
    this.scene.tweens.add({
      targets: this.root,
      scale: this.baseScale * (held ? 1.08 : 1),
      duration: 100,
    });
  }

  moveTo(x: number, y: number): void {
    this.root.setPosition(x, y);
  }

  bump(): void {
    this.scene.tweens.add({
      targets: this.root,
      scale: { from: this.baseScale * 1.12, to: this.baseScale },
      duration: 180,
      ease: 'Back.easeOut',
    });
  }

  update(plate: Plate, dtSec: number): void {
    if (!this.held) {
      const k = Math.min(1, dtSec * 18);
      this.root.x += (this.homeX - this.root.x) * k;
      this.root.y += (this.homeY - this.root.y) * k;
    }

    const signature = [
      plate.skewers.map((skewer) => skewer.id).join(','),
      plate.sides.join(','),
      plate.drink ?? '',
    ].join('|');
    if (signature === this.signature) return;
    this.signature = signature;
    for (const item of this.items) item.destroy();
    this.items.length = 0;

    const count = plate.skewers.length;
    plate.skewers.forEach((skewer, index) => {
      const mini = new SkewerSprite(this.scene, skewer.kind, skewer.id);
      mini.sync(skewer);
      mini.setScale(MINI_SCALE).setAngle(-90);
      mini.setPosition(-26, (index - (count - 1) / 2) * 21 - 12);
      this.root.add(mini);
      this.items.push(mini);
    });

    plate.sides.forEach((side, index) => {
      const icon = new Phaser.GameObjects.Image(
        this.scene,
        -54 + index * 31,
        40,
        sideTexture(side),
      ).setScale(0.6);
      this.root.add(icon);
      this.items.push(icon);
    });

    if (plate.drink) {
      const icon = new Phaser.GameObjects.Image(this.scene, 70, -4, drinkTexture(plate.drink));
      icon.setScale(0.85);
      this.root.add(icon);
      this.items.push(icon);
    }
  }
}
