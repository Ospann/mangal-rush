import type Phaser from 'phaser';
import { STATION_H, STATION_W, stationTexture, TRAY_H, TRAY_W, trayTexture } from '../art/food-art';
import {
  balance,
  drinkKinds,
  sideKinds,
  type DrinkKind,
  type MeatKind,
  type SideKind,
} from '../balance';
import { FONT_FAMILY, Tex } from '../keys';
import type { DaySim } from '../sim/day-sim';
import { Depth } from './fx';
import { layout, stationX, trayX } from './layout';

export type StationHit =
  | { kind: 'raw'; meat: MeatKind; x: number; y: number }
  | { kind: 'side'; side: SideKind; x: number; y: number }
  | { kind: 'drink'; drink: DrinkKind; x: number; y: number }
  | null;

const STATION_ORDER: readonly (SideKind | DrinkKind)[] = [...sideKinds, ...drinkKinds];

function isSide(kind: SideKind | DrinkKind): kind is SideKind {
  return (sideKinds as readonly string[]).includes(kind);
}

export class StationsView {
  private readonly images = new Map<string, Phaser.GameObjects.Image>();
  private readonly overlay: Phaser.GameObjects.Graphics;
  private readonly stockText: Phaser.GameObjects.Text | null = null;
  private clock = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly sim: DaySim,
  ) {
    const level = sim.level;

    STATION_ORDER.forEach((kind, index) => {
      if (!this.available(kind)) return;
      const image = scene.add
        .image(stationX(index), layout.stationY, stationTexture(kind))
        .setDepth(Depth.Props);
      this.images.set(kind, image);
    });

    level.meats.forEach((meat, index) => {
      scene.add
        .image(trayX(index, level.meats.length), layout.trayY, trayTexture(meat))
        .setDepth(Depth.Props);
    });

    scene.add
      .image(layout.bucketX, layout.bucketY, Tex.Bucket)
      .setScale(0.72)
      .setDepth(Depth.Props);

    this.overlay = scene.add.graphics().setDepth(Depth.Props);

    if (level.drinks.includes('ayran')) {
      this.stockText = scene.add
        .text(this.xOf('ayran') - 22, layout.stationY - 22, '', {
          fontFamily: FONT_FAMILY,
          fontSize: '24px',
          fontStyle: 'bold',
          color: '#ffffff',
          stroke: '#3a2418',
          strokeThickness: 5,
        })
        .setOrigin(0.5)
        .setDepth(Depth.Props);
    }
  }

  xOf(kind: SideKind | DrinkKind): number {
    return stationX(STATION_ORDER.indexOf(kind));
  }

  hit(x: number, y: number): StationHit {
    const level = this.sim.level;
    if (Math.abs(y - layout.stationY) <= STATION_H / 2 + 4) {
      for (const kind of STATION_ORDER) {
        if (!this.available(kind)) continue;
        const cx = this.xOf(kind);
        if (Math.abs(x - cx) > STATION_W / 2) continue;
        return isSide(kind)
          ? { kind: 'side', side: kind, x: cx, y: layout.stationY }
          : { kind: 'drink', drink: kind, x: cx, y: layout.stationY };
      }
      return null;
    }
    if (Math.abs(y - layout.trayY) <= TRAY_H / 2 + 6) {
      const count = level.meats.length;
      for (const [index, meat] of level.meats.entries()) {
        const cx = trayX(index, count);
        if (Math.abs(x - cx) <= TRAY_W / 2 + 4) {
          return { kind: 'raw', meat, x: cx, y: layout.trayY };
        }
      }
    }
    return null;
  }

  bump(kind: SideKind | DrinkKind): void {
    const image = this.images.get(kind);
    if (!image) return;
    this.scene.tweens.add({
      targets: image,
      scale: { from: 1.18, to: 1 },
      duration: 160,
      ease: 'Back.easeOut',
    });
  }

  update(dtSec: number): void {
    this.clock += dtSec;
    const g = this.overlay;
    g.clear();

    const teapot = this.images.get('tea');
    if (teapot) {
      const tea = this.sim.teapot;
      const x = this.xOf('tea');
      const y = layout.stationY;
      teapot.setTint(tea.state === 'cold' ? 0x8fb4e8 : tea.state === 'idle' ? 0xcfcfcf : 0xffffff);
      if (tea.state === 'brewing') {
        this.arc(x, y, 1 - tea.leftSec / balance.tea.brewSec, 0xffc93c);
      } else if (tea.state === 'hot') {
        const left = tea.leftSec / balance.tea.hotSec;
        this.arc(x, y, left, left < 0.3 ? 0xff5a47 : 0x7ed957);
        const wave = Math.sin(this.clock * 5);
        g.lineStyle(4, 0xffffff, 0.7);
        for (const dx of [-12, 2, 16]) {
          g.beginPath();
          g.moveTo(x + dx, y - 34);
          g.lineTo(x + dx + wave * 3, y - 44);
          g.lineTo(x + dx - wave * 3, y - 54);
          g.strokePath();
        }
      }
    }

    const fridge = this.images.get('ayran');
    if (fridge && this.stockText) {
      const state = this.sim.fridge;
      const x = this.xOf('ayran');
      const empty = state.stock <= 0;
      fridge.setTint(empty ? 0x9a9a9a : 0xffffff);
      this.stockText.setText(empty ? (state.refillLeftSec > 0 ? '' : '+') : String(state.stock));
      this.stockText.setColor(empty ? '#ffd447' : '#ffffff');
      if (state.refillLeftSec > 0) {
        this.arc(x, layout.stationY, 1 - state.refillLeftSec / balance.ayran.refillSec, 0x7fd0ff);
      }
    }
  }

  private available(kind: SideKind | DrinkKind): boolean {
    const level = this.sim.level;
    return isSide(kind) ? level.sides.includes(kind) : level.drinks.includes(kind);
  }

  private arc(x: number, y: number, fraction: number, color: number): void {
    const g = this.overlay;
    const clamped = Math.min(1, Math.max(0, fraction));
    g.lineStyle(7, 0x2a1b14, 0.55);
    g.strokeCircle(x, y, 40);
    g.lineStyle(7, color, 1);
    g.beginPath();
    g.arc(x, y, 40, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamped);
    g.strokePath();
  }
}
