import Phaser from 'phaser';
import { FONT_FAMILY, Tex } from '../keys';

export const Depth = {
  Background: 0,
  Guests: 1,
  Counter: 2,
  GuestUi: 3,
  Props: 4,
  Grill: 5,
  Glow: 6,
  Skewers: 7,
  Flames: 8,
  Particles: 9,
  Bars: 10,
  Hint: 15,
  Dragged: 20,
  Hud: 30,
  Float: 40,
  Modal: 50,
} as const;

type Emitter = Phaser.GameObjects.Particles.ParticleEmitter;

export class Fx {
  private readonly smoke: Emitter;
  private readonly darkSmoke: Emitter;
  private readonly steam: Emitter;
  private readonly sparks: Emitter;
  private readonly water: Emitter;
  private readonly fat: Emitter;
  private readonly rain: Emitter;
  private readonly gust: Emitter;
  private readonly shade: Phaser.GameObjects.Rectangle;

  constructor(private readonly scene: Phaser.Scene) {
    this.smoke = scene.add
      .particles(0, 0, Tex.Puff, {
        emitting: false,
        lifespan: { min: 800, max: 1400 },
        speedY: { min: -110, max: -50 },
        speedX: { min: -18, max: 18 },
        scale: { start: 0.35, end: 1.3 },
        alpha: { start: 0.3, end: 0 },
        tint: 0xfff0dd,
      })
      .setDepth(Depth.Particles);

    this.darkSmoke = scene.add
      .particles(0, 0, Tex.Puff, {
        emitting: false,
        lifespan: { min: 1000, max: 1700 },
        speedY: { min: -130, max: -60 },
        speedX: { min: -30, max: 30 },
        scale: { start: 0.5, end: 1.9 },
        alpha: { start: 0.55, end: 0 },
        tint: 0x5b534f,
      })
      .setDepth(Depth.Particles);

    this.steam = scene.add
      .particles(0, 0, Tex.Puff, {
        emitting: false,
        lifespan: { min: 500, max: 900 },
        speedY: { min: -260, max: -120 },
        speedX: { min: -70, max: 70 },
        scale: { start: 0.5, end: 1.8 },
        alpha: { start: 0.75, end: 0 },
        tint: 0xffffff,
      })
      .setDepth(Depth.Particles);

    this.sparks = scene.add
      .particles(0, 0, Tex.Spark, {
        emitting: false,
        lifespan: { min: 280, max: 650 },
        speed: { min: 80, max: 300 },
        angle: { min: -125, max: -55 },
        gravityY: 420,
        scale: { start: 0.9, end: 0 },
        tint: [0xffd060, 0xff8a2a, 0xfff2b0],
        blendMode: Phaser.BlendModes.ADD,
      })
      .setDepth(Depth.Particles);

    this.water = scene.add
      .particles(0, 0, Tex.Drop, {
        emitting: false,
        lifespan: { min: 260, max: 420 },
        speed: { min: 140, max: 330 },
        angle: { min: 60, max: 120 },
        gravityY: 700,
        scale: { start: 0.9, end: 0.4 },
        alpha: { start: 0.95, end: 0.3 },
        tint: 0x9fdcff,
      })
      .setDepth(Depth.Particles);

    this.fat = scene.add
      .particles(0, 0, Tex.Drop, {
        emitting: false,
        lifespan: 380,
        speedY: { min: 40, max: 90 },
        gravityY: 900,
        scale: { start: 0.55, end: 0.3 },
        alpha: { start: 0.9, end: 0.5 },
        tint: 0xffdf9a,
      })
      .setDepth(Depth.Particles);

    const { width, height } = scene.scale;
    this.shade = scene.add
      .rectangle(0, 0, width, height, 0x1c3a66, 1)
      .setOrigin(0)
      .setAlpha(0)
      .setDepth(Depth.Hint);

    this.rain = scene.add
      .particles(0, 0, Tex.Drop, {
        emitting: false,
        x: { min: 0, max: width + 120 },
        y: -20,
        lifespan: 1100,
        speedY: { min: 1000, max: 1300 },
        speedX: { min: -160, max: -90 },
        scale: 0.8,
        alpha: 0.5,
        tint: 0xa8dcff,
        quantity: 3,
        frequency: 28,
      })
      .setDepth(Depth.Hint);

    this.gust = scene.add
      .particles(0, 0, Tex.Puff, {
        emitting: false,
        x: -40,
        y: { min: 90, max: 1150 },
        lifespan: 1300,
        speedX: { min: 520, max: 820 },
        scaleX: { start: 1.2, end: 2.6 },
        scaleY: 0.25,
        alpha: { start: 0.32, end: 0 },
        tint: 0xffffff,
        quantity: 1,
        frequency: 70,
      })
      .setDepth(Depth.Hint);
  }

  setRain(on: boolean): void {
    if (on) this.rain.start();
    else this.rain.stop();
    this.scene.tweens.add({ targets: this.shade, alpha: on ? 0.16 : 0, duration: 600 });
  }

  setWind(on: boolean): void {
    if (on) this.gust.start();
    else this.gust.stop();
  }

  puff(x: number, y: number, count = 1): void {
    this.smoke.emitParticleAt(x, y, count);
  }

  soot(x: number, y: number, count = 1): void {
    this.darkSmoke.emitParticleAt(x, y, count);
  }

  spark(x: number, y: number, count = 1): void {
    this.sparks.emitParticleAt(x, y, count);
  }

  fatDrop(x: number, y: number): void {
    this.fat.emitParticleAt(x, y, 1);
  }

  splash(x: number, y: number): void {
    this.water.emitParticleAt(x, y - 150, 14);
    this.steam.emitParticleAt(x, y, 12);
  }

  sparkle(x: number, y: number, count = 5, spread = 60): void {
    for (let index = 0; index < count; index += 1) {
      const star = this.scene.add
        .image(
          x + Phaser.Math.Between(-spread, spread) * 0.5,
          y + Phaser.Math.Between(-spread, spread),
          Tex.Sparkle,
        )
        .setDepth(Depth.Float)
        .setScale(0)
        .setTint(0xfff3a0)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.scene.tweens.add({
        targets: star,
        scale: { from: 0, to: Phaser.Math.FloatBetween(0.45, 0.9) },
        angle: Phaser.Math.Between(-60, 60),
        duration: 170,
        delay: index * 45,
        yoyo: true,
        hold: 90,
        onComplete: () => star.destroy(),
      });
    }
  }

  floatText(x: number, y: number, text: string, color: string, size = 36): void {
    const label = this.scene.add
      .text(x, y, text, {
        fontFamily: FONT_FAMILY,
        fontSize: `${size}px`,
        fontStyle: 'bold',
        color,
        stroke: '#3a2418',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(Depth.Float)
      .setScale(0.6);
    this.scene.tweens.add({ targets: label, scale: 1, duration: 140, ease: 'Back.easeOut' });
    this.scene.tweens.add({
      targets: label,
      y: y - 80,
      alpha: 0,
      duration: 800,
      delay: 300,
      ease: 'Cubic.easeIn',
      onComplete: () => label.destroy(),
    });
  }

  coin(fromX: number, fromY: number, toX: number, toY: number, delay = 0): void {
    const coin = this.scene.add.image(fromX, fromY, Tex.Coin).setDepth(Depth.Float).setScale(0.9);
    this.scene.tweens.add({
      targets: coin,
      x: toX,
      y: toY,
      scale: 0.5,
      duration: 480,
      delay,
      ease: 'Cubic.easeIn',
      onComplete: () => coin.destroy(),
    });
  }
}
