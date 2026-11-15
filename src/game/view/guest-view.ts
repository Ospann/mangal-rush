import Phaser from 'phaser';
import { drinkTexture, miniTexture, sideTexture } from '../art/food-art';
import { HEAD_Y, lookTexture, type Emotion } from '../art/guest-art';
import { FONT_FAMILY, Tex } from '../keys';
import type { Guest } from '../sim/day-sim';
import { Depth } from './fx';
import { layout } from './layout';

const BAR_W = 132;
const BAR_H = 14;

export class GuestView {
  readonly guestId: number;
  private readonly body: Phaser.GameObjects.Container;
  private readonly face: Phaser.GameObjects.Image;
  private readonly bubble: Phaser.GameObjects.Container;
  private readonly content: Phaser.GameObjects.Container;
  private signature = '';
  private readonly bar: Phaser.GameObjects.Graphics;
  private emotion: Emotion = 'waiting';
  private clock = 0;
  private leaving = false;
  private offsetY = 130;

  constructor(
    private readonly scene: Phaser.Scene,
    guest: Guest,
    readonly x: number,
  ) {
    this.guestId = guest.id;

    this.body = scene.add.container(x, layout.guestY + this.offsetY).setDepth(Depth.Guests);
    this.face = new Phaser.GameObjects.Image(scene, 0, HEAD_Y + 8, `${Tex.Face}waiting`);
    this.body.add([new Phaser.GameObjects.Image(scene, 0, 0, lookTexture(guest.look)), this.face]);
    if (guest.regular) {
      this.body.add(
        new Phaser.GameObjects.Image(scene, -62, HEAD_Y - 40, Tex.Star)
          .setScale(0.5)
          .setTint(0xffd447),
      );
    }
    scene.tweens.add({ targets: this, offsetY: 0, duration: 380, ease: 'Back.easeOut' });

    this.bubble = scene.add.container(x, layout.bubbleY).setDepth(Depth.GuestUi).setScale(0);
    this.content = new Phaser.GameObjects.Container(scene, 0, 0);
    this.bubble.add([new Phaser.GameObjects.Image(scene, 0, 0, Tex.Bubble), this.content]);
    this.fill(guest);
    scene.tweens.add({
      targets: this.bubble,
      scale: 1,
      duration: 260,
      delay: 260,
      ease: 'Back.easeOut',
    });

    this.bar = scene.add.graphics().setDepth(Depth.GuestUi);
  }

  update(guest: Guest, dtSec: number): void {
    this.clock += dtSec;
    const fraction = guest.patienceLeft / guest.patienceSec;
    if (guest.state === 'waiting') this.setEmotion(fraction < 0.35 ? 'hurry' : 'waiting');
    this.fill(guest);

    const hurry = this.emotion === 'hurry';
    const bob = Math.sin(this.clock * (hurry ? 9 : 2.4)) * (hurry ? 3 : 4);
    const sway = hurry ? Math.sin(this.clock * 13) * 2 : 0;
    this.body.setPosition(this.x + sway, layout.guestY + this.offsetY + bob);

    this.bar.clear();
    if (guest.state !== 'waiting') return;
    const left = this.x - BAR_W / 2;
    const top = layout.patienceY - BAR_H / 2;
    this.bar.fillStyle(0x2a1b14, 0.9);
    this.bar.fillRoundedRect(left - 3, top - 3, BAR_W + 6, BAR_H + 6, 9);
    const color = fraction > 0.6 ? 0x7ed957 : fraction > 0.35 ? 0xffc93c : 0xff5a47;
    const blink = fraction < 0.2 ? 0.6 + 0.4 * Math.sin(this.clock * 16) : 1;
    this.bar.fillStyle(color, blink);
    this.bar.fillRoundedRect(left, top, Math.max(BAR_H, BAR_W * fraction), BAR_H, 7);
  }

  shake(): void {
    this.scene.tweens.add({
      targets: this.bubble,
      x: { from: this.x - 12, to: this.x + 12 },
      duration: 55,
      yoyo: true,
      repeat: 3,
      onComplete: () => this.bubble.setX(this.x),
    });
  }

  leave(happy: boolean): void {
    if (this.leaving) return;
    this.leaving = true;
    this.setEmotion(happy ? 'happy' : 'angry');
    this.bar.clear();
    this.scene.tweens.add({ targets: this.bubble, scale: 0, duration: 160, ease: 'Back.easeIn' });
    if (happy) {
      this.scene.tweens.add({ targets: this, offsetY: -26, duration: 150, yoyo: true, repeat: 1 });
    }
    this.scene.tweens.add({
      targets: this,
      offsetY: 190,
      duration: 380,
      delay: 720,
      ease: 'Cubic.easeIn',
    });
  }

  destroy(): void {
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.killTweensOf(this.bubble);
    this.body.destroy();
    this.bubble.destroy();
    this.bar.destroy();
  }

  private fill(guest: Guest): void {
    const items = guest.order.items.filter((item) => item.count > 0);
    const { sides, drink } = guest.order;
    const signature = [
      items.map((item) => `${item.kind}${item.count}`).join(','),
      sides.join(','),
      drink ?? '',
    ].join('|');
    if (signature === this.signature) return;
    this.signature = signature;
    this.content.removeAll(true);
    if (items.length === 0) return;
    const scene = this.scene;
    const extras = sides.length + (drink ? 1 : 0);
    const rowY = extras > 0 ? -28 : -10;
    const step = Math.min(78, 160 / items.length);
    const scale = extras > 0 || items.length > 2 ? 0.66 : 0.95;
    items.forEach((item, index) => {
      const cx = (index - (items.length - 1) / 2) * step;
      this.content.add(
        new Phaser.GameObjects.Image(scene, cx - 15, rowY, miniTexture(item.kind)).setScale(scale),
      );
      this.content.add(
        new Phaser.GameObjects.Text(scene, cx, rowY, `×${item.count}`, {
          fontFamily: FONT_FAMILY,
          fontSize: scale < 0.9 ? '27px' : '34px',
          fontStyle: 'bold',
          color: '#3a2418',
        }).setOrigin(0, 0.5),
      );
    });
    const extraStep = Math.min(36, 150 / Math.max(1, extras));
    sides.forEach((side, index) => {
      const cx = (index - (extras - 1) / 2) * extraStep;
      this.content.add(
        new Phaser.GameObjects.Image(scene, cx, 17, sideTexture(side)).setScale(0.6),
      );
    });
    if (drink) {
      const cx = (extras - 1 - (extras - 1) / 2) * extraStep;
      this.content.add(
        new Phaser.GameObjects.Image(scene, cx, 15, drinkTexture(drink)).setScale(0.6),
      );
    }
  }

  private setEmotion(emotion: Emotion): void {
    if (emotion === this.emotion) return;
    this.emotion = emotion;
    this.face.setTexture(`${Tex.Face}${emotion}`);
  }
}
