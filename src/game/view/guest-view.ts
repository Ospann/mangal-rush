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
  private offsetX = 0;
  private offsetY = 0;
  private walking = true;
  private eager = false;
  private sweatSec = 0;
  private readonly side: -1 | 1;

  constructor(
    private readonly scene: Phaser.Scene,
    guest: Guest,
    readonly x: number,
  ) {
    this.guestId = guest.id;
    this.side = x < layout.width / 2 ? -1 : 1;
    this.offsetX = this.offscreenX();
    this.clock = Math.random() * 10;

    this.body = scene.add.container(x + this.offsetX, layout.guestY).setDepth(Depth.Guests);
    this.face = new Phaser.GameObjects.Image(scene, 0, HEAD_Y + 8, `${Tex.Face}waiting`);
    this.body.add([new Phaser.GameObjects.Image(scene, 0, 0, lookTexture(guest.look)), this.face]);
    if (guest.regular) {
      this.body.add(
        new Phaser.GameObjects.Image(scene, -62, HEAD_Y - 40, Tex.Star)
          .setScale(0.5)
          .setTint(0xffd447),
      );
    }
    const walkMs = Math.abs(this.offsetX) * 2.1;
    scene.tweens.add({
      targets: this,
      offsetX: 0,
      duration: walkMs,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.walking = false;
        this.squash();
      },
    });

    this.bubble = scene.add.container(x, layout.bubbleY).setDepth(Depth.GuestUi).setScale(0);
    this.content = new Phaser.GameObjects.Container(scene, 0, 0);
    this.bubble.add([new Phaser.GameObjects.Image(scene, 0, 0, Tex.Bubble), this.content]);
    this.fill(guest);
    scene.tweens.add({
      targets: this.bubble,
      scale: 1,
      duration: 260,
      delay: walkMs + 80,
      ease: 'Back.easeOut',
    });

    this.bar = scene.add.graphics().setDepth(Depth.GuestUi);
  }

  update(guest: Guest, dtSec: number): void {
    this.clock += dtSec;
    const fraction = guest.patienceLeft / guest.patienceSec;
    if (guest.state === 'waiting') {
      const mood = fraction < 0.35 ? 'hurry' : 'waiting';
      this.setEmotion(this.eager && mood === 'waiting' ? 'happy' : mood);
    }
    this.fill(guest);

    const hurry = this.emotion === 'hurry' && !this.leaving;
    const bob = this.walking
      ? -Math.abs(Math.sin(this.clock * 11)) * 12
      : Math.sin(this.clock * (hurry ? 9 : 2.4)) * (hurry ? 3 : 4);
    const sway = hurry ? Math.sin(this.clock * 13) * 2 : 0;
    const tilt = this.walking ? Math.sin(this.clock * 11) * 3 : this.eager ? -this.side * 4 : 0;
    this.body.setPosition(this.x + this.offsetX + sway, layout.guestY + this.offsetY + bob);
    this.body.setAngle(Phaser.Math.Linear(this.body.angle, tilt, Math.min(1, dtSec * 10)));
    if (!this.walking && !this.leaving) {
      const breath = 1 + Math.sin(this.clock * 2.4 + 1) * 0.012;
      const target = this.eager ? 1.07 : 1;
      const scale = Phaser.Math.Linear(this.body.scaleX, target, Math.min(1, dtSec * 12));
      this.body.setScale(scale, scale * breath);
    }

    if (hurry && guest.state === 'waiting') {
      this.sweatSec -= dtSec;
      if (this.sweatSec <= 0) {
        this.sweatSec = 1.1;
        this.sweat();
      }
    }

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

  setEager(eager: boolean): void {
    this.eager = eager && !this.leaving;
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
    this.eager = false;
    this.setEmotion(happy ? 'happy' : 'angry');
    this.bar.clear();
    this.body.setScale(1);
    this.scene.tweens.add({ targets: this.bubble, scale: 0, duration: 160, ease: 'Back.easeIn' });
    if (happy) {
      this.scene.tweens.add({
        targets: this,
        offsetY: -30,
        duration: 140,
        yoyo: true,
        repeat: 1,
        ease: 'Quad.easeOut',
      });
      this.heart();
    } else {
      this.body.each((child: Phaser.GameObjects.GameObject) => {
        if (child instanceof Phaser.GameObjects.Image) child.setTint(0xff9c8a);
      });
      this.scene.tweens.add({
        targets: this,
        offsetX: { from: -8, to: 8 },
        duration: 50,
        yoyo: true,
        repeat: 3,
        onComplete: () => {
          this.offsetX = 0;
          this.body.each((child: Phaser.GameObjects.GameObject) => {
            if (child instanceof Phaser.GameObjects.Image && child !== this.face) child.clearTint();
          });
        },
      });
      this.steam();
    }
    this.scene.tweens.add({
      targets: this,
      offsetX: this.offscreenX(),
      duration: happy ? 560 : 460,
      delay: happy ? 560 : 420,
      ease: 'Quad.easeIn',
      onStart: () => {
        this.walking = true;
      },
    });
  }

  destroy(): void {
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.killTweensOf(this.bubble);
    this.body.destroy();
    this.bubble.destroy();
    this.bar.destroy();
  }

  private offscreenX(): number {
    return this.side < 0 ? -(this.x + 120) : layout.width - this.x + 120;
  }

  private squash(): void {
    this.body.setScale(1.1);
  }

  private sweat(): void {
    const drop = this.scene.add
      .image(this.body.x + 40 * this.side, this.body.y + HEAD_Y - 18, Tex.Drop)
      .setTint(0xaee4ff)
      .setScale(0.9)
      .setDepth(Depth.GuestUi);
    this.scene.tweens.add({
      targets: drop,
      y: drop.y + 34,
      alpha: 0,
      duration: 700,
      ease: 'Quad.easeIn',
      onComplete: () => drop.destroy(),
    });
  }

  private heart(): void {
    for (let index = 0; index < 3; index += 1) {
      const star = this.scene.add
        .image(this.body.x + (index - 1) * 36, this.body.y + HEAD_Y - 40, Tex.Sparkle)
        .setTint(0xffd447)
        .setScale(0)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(Depth.GuestUi);
      this.scene.tweens.add({
        targets: star,
        scale: 0.7,
        y: star.y - 60,
        alpha: { from: 1, to: 0 },
        duration: 700,
        delay: index * 90,
        ease: 'Quad.easeOut',
        onComplete: () => star.destroy(),
      });
    }
  }

  private steam(): void {
    for (let index = 0; index < 4; index += 1) {
      const puff = this.scene.add
        .image(this.body.x + (index % 2 === 0 ? -46 : 46), this.body.y + HEAD_Y - 30, Tex.Puff)
        .setTint(0xff8a7a)
        .setAlpha(0.8)
        .setScale(0.4)
        .setDepth(Depth.GuestUi);
      this.scene.tweens.add({
        targets: puff,
        y: puff.y - 70,
        x: puff.x + (index % 2 === 0 ? -20 : 20),
        scale: 1.1,
        alpha: 0,
        duration: 650,
        delay: index * 110,
        onComplete: () => puff.destroy(),
      });
    }
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
