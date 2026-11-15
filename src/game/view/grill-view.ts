import Phaser from 'phaser';
import { balance } from '../balance';
import { FONT_FAMILY, Tex } from '../keys';
import type { Grill } from '../sim/grill';
import { downSide, meatOf, stageOf, upSide, type Skewer } from '../sim/skewer';
import { Depth, type Fx } from './fx';
import { layout, skewerScaleX, skewerScaleY, slotWidth, slotX } from './layout';
import { SkewerSprite } from './skewer-sprite';

const ZONE_COLORS = {
  raw: 0x6e5a4c,
  done: 0xd9a441,
  perfect: 0xfff06a,
  overdone: 0x9a4a22,
  burnt: 0x1c1410,
} as const;

function mixColor(a: number, b: number, t: number): number {
  const from = Phaser.Display.Color.IntegerToColor(a);
  const to = Phaser.Display.Color.IntegerToColor(b);
  const mixed = Phaser.Display.Color.Interpolate.ColorWithColor(from, to, 100, Math.round(t * 100));
  return Phaser.Display.Color.GetColor(mixed.r, mixed.g, mixed.b);
}

export class GrillView {
  private readonly slots: number;
  private readonly glows: Phaser.GameObjects.Image[] = [];
  private readonly stripGlows: Phaser.GameObjects.Image[] = [];
  private readonly flames: Phaser.GameObjects.Image[] = [];
  private readonly debugTexts: Phaser.GameObjects.Text[] = [];
  private readonly bars: Phaser.GameObjects.Graphics;
  private readonly bedGlow: Phaser.GameObjects.Rectangle;
  private readonly sprites = new Map<number, SkewerSprite>();
  private readonly smokeAcc: number[];
  private readonly dripAcc: number[];
  private spawnPoint: { x: number; y: number } | null = null;
  private coalSmokeAcc = 0;
  private clock = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly grill: Grill,
    private readonly fx: Fx,
    debug: boolean,
  ) {
    this.slots = grill.slots.length;
    this.smokeAcc = Array.from({ length: this.slots }, () => 0);
    this.dripAcc = Array.from({ length: this.slots }, () => 0);

    scene.add.image(layout.grillX, layout.grillTop, Tex.Grill).setOrigin(0).setDepth(Depth.Grill);

    this.bedGlow = scene.add
      .rectangle(
        layout.grillX + 22,
        layout.grillTop + 34,
        layout.grillW - 44,
        layout.grillH - 56,
        0xff5a14,
        0.2,
      )
      .setOrigin(0)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(Depth.Glow);

    const width = slotWidth(this.slots);
    const meatMid = (layout.meatTop + layout.meatBottom) / 2;
    const stripMid = (layout.stripTop + layout.stripBottom) / 2;
    for (let slot = 0; slot < this.slots; slot += 1) {
      const x = slotX(slot, this.slots);
      this.glows.push(
        scene.add
          .image(x, meatMid, Tex.Glow)
          .setDisplaySize(width * 1.5, 330)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDepth(Depth.Glow),
      );
      this.stripGlows.push(
        scene.add
          .image(x, stripMid, Tex.Glow)
          .setDisplaySize(width * 1.5, 150)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDepth(Depth.Glow),
      );
      this.flames.push(
        scene.add
          .image(x, layout.meatBottom + 14, Tex.Flame)
          .setOrigin(0.5, 1)
          .setDepth(Depth.Flames)
          .setVisible(false),
      );
      if (debug) {
        this.debugTexts.push(
          scene.add
            .text(x, layout.grillTop - 6, '', {
              fontFamily: FONT_FAMILY,
              fontSize: '18px',
              color: '#ffffff',
              backgroundColor: 'rgba(0,0,0,0.6)',
              align: 'center',
            })
            .setOrigin(0.5, 1)
            .setDepth(Depth.Hud),
        );
      }
    }

    this.bars = scene.add.graphics().setDepth(Depth.Bars);
  }

  spriteFor(skewerId: number): SkewerSprite | null {
    return this.sprites.get(skewerId) ?? null;
  }

  spawnNextAt(x: number, y: number): void {
    this.spawnPoint = { x, y };
  }

  update(dtSec: number): void {
    this.clock += dtSec;
    const coals = this.grill.coals;
    const alive = new Set<number>();
    this.bars.clear();
    this.bedGlow.setAlpha(
      coals.level * coals.smokeFactor * (0.3 + 0.04 * Math.sin(this.clock * 2.3)),
    );

    this.grill.slots.forEach((slot, index) => {
      const x = slotX(index, this.slots);
      const heat = coals.heat(index);
      const mod = coals.mods[index] ?? 0;
      this.drawGlow(index, heat, mod);
      this.drawFlame(index, slot.flare);

      const skewer = slot.skewer;
      if (skewer) {
        alive.add(skewer.id);
        const sprite = this.ensureSprite(skewer, x);
        sprite.homeX = x;
        sprite.homeY = layout.skewerY;
        sprite.sync(skewer);
        sprite.settle(dtSec);
        if (!slot.lifted) {
          this.drawBar(x, skewer);
          this.ambient(index, x, heat, skewer, slot.flare, dtSec);
        }
      }

      const text = this.debugTexts[index];
      if (text) {
        const cook = skewer ? `\n${downSide(skewer).toFixed(2)}/${upSide(skewer).toFixed(2)}` : '';
        text.setText(`${heat.toFixed(2)}${cook}`);
      }
    });

    for (const [id, sprite] of this.sprites) {
      if (alive.has(id)) continue;
      sprite.destroy();
      this.sprites.delete(id);
    }

    if (coals.isSmoking) {
      this.coalSmokeAcc += dtSec * 26;
      while (this.coalSmokeAcc >= 1) {
        this.coalSmokeAcc -= 1;
        this.fx.soot(
          Phaser.Math.Between(layout.slotsLeft, layout.slotsRight),
          Phaser.Math.Between(layout.meatBottom, layout.stripBottom),
        );
      }
    }
  }

  private ensureSprite(skewer: Skewer, x: number): SkewerSprite {
    const existing = this.sprites.get(skewer.id);
    if (existing) return existing;
    const sprite = new SkewerSprite(this.scene, skewer.kind, skewer.id);
    sprite.setScale(skewerScaleX(this.slots), skewerScaleY(this.slots)).setDepth(Depth.Skewers);
    const spawn = this.spawnPoint ?? { x, y: layout.skewerY };
    this.spawnPoint = null;
    sprite.setPosition(spawn.x, spawn.y);
    this.sprites.set(skewer.id, sprite);
    return sprite;
  }

  private drawGlow(slot: number, heat: number, mod: number): void {
    const pulse = 0.88 + 0.12 * Math.sin(this.clock * 3.1 + slot * 1.7);
    const boost = Math.max(0, mod) / balance.fan.maxBoost;
    const tint =
      mod < 0 ? 0x8a6a66 : mixColor(0xff5a14, 0xffc24a, Math.min(1, boost + heat * 0.25));
    const alpha = Math.min(1, heat * 1.15) * pulse;
    this.glows[slot]?.setAlpha(alpha).setTint(tint);
    this.stripGlows[slot]?.setAlpha(Math.min(1, alpha + boost * 0.3)).setTint(tint);
  }

  private drawFlame(slot: number, burning: boolean): void {
    const flame = this.flames[slot];
    if (!flame) return;
    flame.setVisible(burning);
    if (!burning) return;
    const width = Math.min(150, slotWidth(this.slots) * 0.95);
    const wobble = Math.sin(this.clock * 23 + slot) * 0.06 + Math.sin(this.clock * 37) * 0.05;
    flame.setDisplaySize(width * (1 - wobble), 250 * (1 + wobble * 1.6));
    flame.setAlpha(0.9 + wobble);
  }

  private ambient(
    slot: number,
    x: number,
    heat: number,
    skewer: Skewer,
    burning: boolean,
    dtSec: number,
  ): void {
    const meat = meatOf(skewer.kind);
    const cook = downSide(skewer);
    const spread = slotWidth(this.slots) * 0.25;
    const y = Phaser.Math.Between(layout.meatTop + 20, layout.meatBottom - 20);

    this.smokeAcc[slot] = (this.smokeAcc[slot] ?? 0) + dtSec * heat * (burning ? 9 : 3.2);
    while ((this.smokeAcc[slot] ?? 0) >= 1) {
      this.smokeAcc[slot] = (this.smokeAcc[slot] ?? 0) - 1;
      const px = x + Phaser.Math.FloatBetween(-spread, spread);
      if (cook >= meat.burntAt) this.fx.soot(px, y);
      else this.fx.puff(px, y);
    }

    if (cook < balance.flare.minCook || cook >= meat.burntAt) return;
    this.dripAcc[slot] = (this.dripAcc[slot] ?? 0) + dtSec * heat * meat.fat * 2.4;
    while ((this.dripAcc[slot] ?? 0) >= 1) {
      this.dripAcc[slot] = (this.dripAcc[slot] ?? 0) - 1;
      const px = x + Phaser.Math.FloatBetween(-spread, spread);
      this.fx.fatDrop(px, y);
      this.scene.time.delayedCall(240, () => this.fx.spark(px, y + 46, burning ? 4 : 2));
    }
  }

  private drawBar(x: number, skewer: Skewer): void {
    const meat = meatOf(skewer.kind);
    const width = Math.min(slotWidth(this.slots) - 14, 146);
    const height = 16;
    const left = x - width / 2;
    const top = layout.barY - height / 2;
    const max = meat.burntAt + 0.25;
    const at = (cook: number): number => left + (Math.min(cook, max) / max) * width;
    const down = downSide(skewer);
    const stage = stageOf(down, meat);
    const g = this.bars;

    g.fillStyle(0x1a110d, 0.9);
    g.fillRoundedRect(left - 4, top - 4, width + 8, height + 8, 7);

    const zones: readonly (readonly [number, number, number])[] = [
      [0, 1, ZONE_COLORS.raw],
      [1, meat.perfectFrom, ZONE_COLORS.done],
      [meat.perfectFrom, meat.perfectTo, ZONE_COLORS.perfect],
      [meat.perfectTo, meat.burntAt, ZONE_COLORS.overdone],
      [meat.burntAt, max, ZONE_COLORS.burnt],
    ];
    for (const [from, to, color] of zones) {
      g.fillStyle(color, 1);
      g.fillRect(at(from), top, at(to) - at(from), height);
    }

    if (stage === 'perfect') {
      const blink = 0.5 + 0.5 * Math.sin(this.clock * 14);
      g.lineStyle(3, 0xffffff, 0.5 + 0.5 * blink);
      g.strokeRect(
        at(meat.perfectFrom) - 1,
        top - 2,
        at(meat.perfectTo) - at(meat.perfectFrom) + 2,
        height + 4,
      );
    }

    const upX = at(upSide(skewer));
    g.fillStyle(0xffffff, 0.55);
    g.fillTriangle(upX - 6, top - 13, upX + 6, top - 13, upX, top - 4);

    const downX = at(down);
    g.fillStyle(0x1a110d, 1);
    g.fillRect(downX - 4, top - 5, 8, height + 10);
    g.fillStyle(0xffffff, 1);
    g.fillRect(downX - 2, top - 3, 4, height + 6);
  }
}
