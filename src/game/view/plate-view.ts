import Phaser from 'phaser';
import { Tex } from '../keys';
import type { Plate } from '../sim/day-sim';
import { Depth } from './fx';
import { SkewerSprite } from './skewer-sprite';

const MINI_SCALE = 0.44;

export class PlateView {
  held = false;
  private readonly root: Phaser.GameObjects.Container;
  private readonly minis: SkewerSprite[] = [];
  private signature = '';

  constructor(
    private readonly scene: Phaser.Scene,
    readonly homeX: number,
    readonly homeY: number,
  ) {
    this.root = scene.add.container(homeX, homeY).setDepth(Depth.Props);
    this.root.add(new Phaser.GameObjects.Image(scene, 0, 0, Tex.Plate));
  }

  get x(): number {
    return this.root.x;
  }

  get y(): number {
    return this.root.y;
  }

  setHeld(held: boolean): void {
    this.held = held;
    this.root.setDepth(held ? Depth.Dragged : Depth.Props);
    this.scene.tweens.add({ targets: this.root, scale: held ? 1.08 : 1, duration: 100 });
  }

  moveTo(x: number, y: number): void {
    this.root.setPosition(x, y);
  }

  bump(): void {
    this.scene.tweens.add({
      targets: this.root,
      scale: { from: 1.12, to: 1 },
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

    const signature = plate.skewers.map((skewer) => skewer.id).join(',');
    if (signature === this.signature) return;
    this.signature = signature;
    for (const mini of this.minis) mini.destroy();
    this.minis.length = 0;

    const count = plate.skewers.length;
    plate.skewers.forEach((skewer, index) => {
      const mini = new SkewerSprite(this.scene, skewer.kind, skewer.id);
      mini.sync(skewer);
      mini.setScale(MINI_SCALE).setAngle(-90);
      mini.setPosition(-10, (index - (count - 1) / 2) * 24 - 2);
      this.root.add(mini);
      this.minis.push(mini);
    });
  }
}
