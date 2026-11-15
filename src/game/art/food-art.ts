import type Phaser from 'phaser';
import {
  balance,
  drinkKinds,
  meatKinds,
  sideKinds,
  type DrinkKind,
  type MeatKind,
  type SideKind,
} from '../balance';
import { Tex } from '../keys';
import { cssColor, meatColor } from '../view/meat-color';
import { circle, ellipse, makeTexture, roundRect, vGradient, type Ctx } from './canvas';
import { palette } from './palette';

export const CHUNK_W = 76;
export const CHUNK_H = 56;
export const STICK_W = 20;
export const STICK_H = 290;
export const CHUNKS_PER_SKEWER = 4;

const VEG_COLORS = ['#e8503a', '#6fb04a', '#e9d9ee', '#7b4a9a'] as const;
const DRINK_COLORS: Record<DrinkKind, string> = {
  ayran: '#fbfbf4',
  tea: '#c9792a',
  kompot: '#d8455f',
};

export function chunkTextures(kind: MeatKind): string[] {
  return Array.from({ length: CHUNKS_PER_SKEWER }, (_, index) =>
    kind === 'veg' ? `${Tex.Chunk}veg-${index}` : `${Tex.Chunk}${kind}`,
  );
}

export function trayTexture(kind: MeatKind): string {
  return `${Tex.Tray}${kind}`;
}

export function miniTexture(kind: MeatKind): string {
  return `${Tex.Mini}${kind}`;
}

export function sideTexture(kind: SideKind): string {
  return `${Tex.Side}${kind}`;
}

export function drinkTexture(kind: DrinkKind): string {
  return `${Tex.Drink}${kind}`;
}

export function stationTexture(kind: SideKind | DrinkKind): string {
  return `${Tex.Station}${kind}`;
}

function drawStick(ctx: Ctx, width: number, height: number): void {
  const cx = width / 2;
  ctx.fillStyle = palette.stickDark;
  ctx.beginPath();
  ctx.moveTo(cx - 3, 40);
  ctx.lineTo(cx + 3, 40);
  ctx.lineTo(cx + 3, height - 16);
  ctx.lineTo(cx, height);
  ctx.lineTo(cx - 3, height - 16);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = palette.stick;
  ctx.fillRect(cx - 3, 40, 3, height - 58);

  roundRect(ctx, cx - 9, 0, 18, 50, 8);
  ctx.fillStyle = palette.handle;
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  roundRect(ctx, cx - 6, 4, 5, 40, 3);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(cx - 9, 40, 18, 5);
}

function chunkRadius(kind: MeatKind): number {
  if (kind === 'lamb' || kind === 'beef') return 13;
  if (kind === 'lula') return 20;
  return 24;
}

function chunkBody(ctx: Ctx, kind: MeatKind, width: number, height: number): void {
  if (kind === 'fish') ellipse(ctx, width / 2, height / 2, width / 2 - 2, height / 2 - 5);
  else if (kind === 'lula') roundRect(ctx, 0, 3, width, height - 6, chunkRadius(kind));
  else roundRect(ctx, 2, 2, width - 4, height - 4, chunkRadius(kind));
}

function drawChunk(
  ctx: Ctx,
  kind: MeatKind,
  width: number,
  height: number,
  base = '#f4f4f4',
): void {
  chunkBody(ctx, kind, width, height);
  ctx.fillStyle = vGradient(ctx, 0, height, [
    [0, '#ffffff'],
    [0.5, base],
    [1, kind === 'veg' ? base : '#b9b9b9'],
  ]);
  ctx.fill();

  ctx.save();
  chunkBody(ctx, kind, width, height);
  ctx.clip();
  ctx.fillStyle = 'rgba(110,110,110,0.32)';
  ctx.strokeStyle = 'rgba(110,110,110,0.4)';
  ctx.lineWidth = 3;
  if (kind === 'lamb') {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(0, 0, width, 11);
    ctx.fillStyle = 'rgba(120,120,120,0.35)';
    ctx.fillRect(22, 26, 30, 4);
  } else if (kind === 'beef') {
    for (const [x0, y0, x1, y1] of [
      [12, 16, 34, 26],
      [38, 14, 62, 22],
      [18, 38, 44, 32],
      [48, 40, 64, 34],
    ] as const) {
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }
  } else if (kind === 'lula') {
    for (let x = 14; x < width; x += 16) {
      ctx.beginPath();
      ctx.moveTo(x, 8);
      ctx.quadraticCurveTo(x - 5, height / 2, x, height - 8);
      ctx.stroke();
    }
  } else if (kind === 'fish') {
    for (let row = 0; row < 3; row += 1) {
      for (let x = 14 + (row % 2) * 8; x < width - 6; x += 16) {
        ctx.beginPath();
        ctx.arc(x, 16 + row * 12, 7, 0.1 * Math.PI, 0.9 * Math.PI);
        ctx.stroke();
      }
    }
  } else if (kind === 'veg') {
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ellipse(ctx, width / 2, height / 2, 16, 9);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(0, height - 12, width, 12);
  } else {
    ctx.fillRect(16, 20, 40, 4);
    ctx.fillRect(22, 34, 30, 4);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ellipse(ctx, width * 0.32, height * 0.3, 12, 5);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = 'rgba(70,70,70,0.55)';
  ctx.lineWidth = 3;
  chunkBody(ctx, kind, width, height);
  ctx.stroke();
}

function rawColor(kind: MeatKind, index: number): string {
  if (kind === 'veg') return VEG_COLORS[index % VEG_COLORS.length] ?? '#ffffff';
  return cssColor(meatColor(kind, 0));
}

function drawPlate(ctx: Ctx, width: number, height: number): void {
  const cx = width / 2;
  const cy = height / 2;
  ellipse(ctx, cx, cy + 8, width / 2 - 4, height / 2 - 10);
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fill();
  ellipse(ctx, cx, cy, width / 2 - 4, height / 2 - 10);
  ctx.fillStyle = palette.plateRim;
  ctx.fill();
  ellipse(ctx, cx, cy - 2, width / 2 - 16, height / 2 - 20);
  ctx.fillStyle = palette.plate;
  ctx.fill();
  ctx.strokeStyle = 'rgba(160,140,110,0.5)';
  ctx.lineWidth = 2;
  ellipse(ctx, cx, cy - 1, width / 2 - 34, height / 2 - 32);
  ctx.stroke();
}

function drawTray(ctx: Ctx, kind: MeatKind, width: number, height: number): void {
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  roundRect(ctx, 4, 12, width - 8, height - 14, 14);
  ctx.fill();
  roundRect(ctx, 3, 6, width - 6, height - 14, 14);
  ctx.fillStyle = palette.bowlDark;
  ctx.fill();
  roundRect(ctx, 8, 10, width - 16, height - 24, 10);
  ctx.fillStyle = '#2a4d66';
  ctx.fill();

  const spots: readonly (readonly [number, number])[] = [
    [26, 30],
    [52, 26],
    [78, 31],
    [38, 46],
    [66, 46],
  ];
  spots.forEach(([x, y], index) => {
    if (kind === 'fish') ellipse(ctx, x, y, 15, 10);
    else roundRect(ctx, x - 14, y - 11, 28, 22, kind === 'lamb' || kind === 'beef' ? 6 : 10);
    ctx.fillStyle = rawColor(kind, index);
    ctx.fill();
    ctx.strokeStyle = 'rgba(60,30,30,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
    if (kind === 'lamb') {
      ctx.fillStyle = 'rgba(255,240,230,0.85)';
      ctx.fillRect(x - 11, y - 9, 22, 4);
    }
  });
  ctx.strokeStyle = palette.stick;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(width - 34, 30);
  ctx.lineTo(width - 8, 6);
  ctx.stroke();
}

function drawBucket(ctx: Ctx, width: number, height: number): void {
  const cx = width / 2;
  ctx.strokeStyle = palette.steelDark;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(cx, 34, width / 2 - 12, Math.PI, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(8, 34);
  ctx.lineTo(20, height - 8);
  ctx.lineTo(width - 20, height - 8);
  ctx.lineTo(width - 8, 34);
  ctx.closePath();
  ctx.fillStyle = vGradient(ctx, 30, height, [
    [0, '#9aa3ad'],
    [1, palette.bucket],
  ]);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(22, 44, 10, height - 60);
  ellipse(ctx, cx, 34, width / 2 - 8, 13);
  ctx.fillStyle = '#2b2f36';
  ctx.fill();
  ctx.strokeStyle = '#c3cad3';
  ctx.lineWidth = 4;
  ctx.stroke();
}

function drawMini(ctx: Ctx, kind: MeatKind, width: number, height: number): void {
  const cx = width / 2;
  const meat = balance.meats[kind];
  ctx.fillStyle = palette.stickDark;
  ctx.fillRect(cx - 2, 2, 4, height - 4);
  ctx.fillStyle = palette.handle;
  roundRect(ctx, cx - 5, 0, 10, 16, 4);
  ctx.fill();
  const cooked = cssColor(meatColor(kind, (meat.perfectFrom + meat.perfectTo) / 2));
  for (let index = 0; index < 3; index += 1) {
    const y = 20 + index * 20;
    if (kind === 'fish') ellipse(ctx, cx, y + 8.5, width / 2 - 2, 8.5);
    else if (kind === 'lula') roundRect(ctx, 1, y - 1, width - 2, 21, 7);
    else roundRect(ctx, 3, y, width - 6, 17, kind === 'lamb' || kind === 'beef' ? 4 : 8);
    ctx.fillStyle = kind === 'veg' ? rawColor(kind, index) : cooked;
    ctx.fill();
    ctx.strokeStyle = 'rgba(58,36,24,0.7)';
    ctx.lineWidth = 2;
    ctx.stroke();
    if (kind === 'lamb') {
      ctx.fillStyle = 'rgba(255,235,215,0.75)';
      ctx.fillRect(5, y + 2, width - 10, 3);
    }
  }
}

function drawSide(ctx: Ctx, kind: SideKind, size: number): void {
  const c = size / 2;
  ctx.lineWidth = 3;
  ctx.strokeStyle = palette.ink;
  if (kind === 'onion') {
    for (const [x, y, r] of [
      [c - 8, c + 4, 16],
      [c + 10, c - 6, 13],
    ] as const) {
      circle(ctx, x, y, r);
      ctx.fillStyle = '#f3e3f2';
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#b77fc0';
      ctx.lineWidth = 2;
      circle(ctx, x, y, r * 0.62);
      ctx.stroke();
      circle(ctx, x, y, r * 0.3);
      ctx.stroke();
      ctx.strokeStyle = palette.ink;
      ctx.lineWidth = 3;
    }
    return;
  }
  if (kind === 'lavash') {
    ctx.beginPath();
    ctx.moveTo(6, c + 16);
    ctx.quadraticCurveTo(c, c - 30, size - 6, c + 16);
    ctx.quadraticCurveTo(c, c + 26, 6, c + 16);
    ctx.closePath();
    ctx.fillStyle = '#f1d6a0';
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#c99755';
    for (const [x, y] of [
      [c - 12, c + 6],
      [c + 4, c - 4],
      [c + 14, c + 10],
      [c - 2, c + 14],
    ] as const) {
      ellipse(ctx, x, y, 4, 3);
      ctx.fill();
    }
    return;
  }
  if (kind === 'tomato') {
    circle(ctx, c, c + 2, 20);
    ctx.fillStyle = '#e8503a';
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ellipse(ctx, c - 7, c - 6, 6, 4);
    ctx.fill();
    ctx.fillStyle = '#4f9a3a';
    ctx.beginPath();
    ctx.moveTo(c - 9, c - 16);
    ctx.lineTo(c, c - 12);
    ctx.lineTo(c + 9, c - 16);
    ctx.lineTo(c + 3, c - 21);
    ctx.lineTo(c - 3, c - 21);
    ctx.closePath();
    ctx.fill();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(8, c - 4);
  ctx.quadraticCurveTo(c, size + 6, size - 8, c - 4);
  ctx.closePath();
  ctx.fillStyle = '#f4efe6';
  ctx.fill();
  ctx.stroke();
  ellipse(ctx, c, c - 4, c - 8, 9);
  ctx.fillStyle = '#c93a2c';
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ellipse(ctx, c - 6, c - 6, 6, 2.5);
  ctx.fill();
}

function drawDrink(ctx: Ctx, kind: DrinkKind, width: number, height: number): void {
  const cx = width / 2;
  const glass = (): void => {
    ctx.beginPath();
    if (kind === 'tea') {
      ctx.moveTo(8, 6);
      ctx.quadraticCurveTo(18, height * 0.48, 9, height - 12);
      ctx.quadraticCurveTo(cx, height - 2, width - 9, height - 12);
      ctx.quadraticCurveTo(width - 18, height * 0.48, width - 8, 6);
    } else {
      ctx.moveTo(7, 6);
      ctx.lineTo(11, height - 8);
      ctx.quadraticCurveTo(cx, height - 2, width - 11, height - 8);
      ctx.lineTo(width - 7, 6);
    }
    ctx.closePath();
  };
  glass();
  ctx.fillStyle = 'rgba(235,245,250,0.9)';
  ctx.fill();
  ctx.save();
  glass();
  ctx.clip();
  ctx.fillStyle = DRINK_COLORS[kind];
  ctx.fillRect(0, 16, width, height);
  if (kind === 'kompot') {
    ctx.fillStyle = '#8f1f3a';
    for (const [x, y] of [
      [cx - 7, height - 18],
      [cx + 6, height - 24],
      [cx, height - 34],
    ] as const) {
      circle(ctx, x, y, 5);
      ctx.fill();
    }
  }
  if (kind === 'ayran') {
    ctx.fillStyle = '#7fb56a';
    ellipse(ctx, cx + 4, 20, 6, 3);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(12, 10, 5, height - 26);
  ctx.restore();
  ctx.strokeStyle = palette.ink;
  ctx.lineWidth = 3;
  glass();
  ctx.stroke();
}

function drawSideStation(ctx: Ctx, kind: SideKind, width: number, height: number): void {
  const cx = width / 2;
  ellipse(ctx, cx, height - 14, width / 2 - 6, 12);
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(5, 34);
  ctx.quadraticCurveTo(10, height - 4, cx, height - 8);
  ctx.quadraticCurveTo(width - 10, height - 4, width - 5, 34);
  ctx.closePath();
  ctx.fillStyle = '#b06f3c';
  ctx.fill();
  ellipse(ctx, cx, 34, width / 2 - 5, 16);
  ctx.fillStyle = '#d99a5c';
  ctx.fill();
  ellipse(ctx, cx, 36, width / 2 - 13, 11);
  ctx.fillStyle = '#7d4a28';
  ctx.fill();
  ctx.save();
  ctx.translate(cx - 28, 2);
  drawSide(ctx, kind, 56);
  ctx.restore();
}

function drawDrinkStation(ctx: Ctx, kind: DrinkKind, width: number, height: number): void {
  const cx = width / 2;
  ctx.lineWidth = 3;
  ctx.strokeStyle = palette.ink;
  if (kind === 'ayran') {
    roundRect(ctx, 8, 4, width - 16, height - 8, 10);
    ctx.fillStyle = vGradient(ctx, 0, height, [
      [0, '#f4fbff'],
      [1, '#bcd6e6'],
    ]);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#8fb3c9';
    ctx.fillRect(10, 30, width - 20, 3);
    roundRect(ctx, width - 22, 12, 6, 14, 3);
    ctx.fill();
    roundRect(ctx, width - 22, 40, 6, 22, 3);
    ctx.fill();
    ctx.save();
    ctx.translate(cx - 22, 34);
    ctx.scale(0.7, 0.7);
    drawDrink(ctx, 'ayran', 48, 64);
    ctx.restore();
    return;
  }
  if (kind === 'tea') {
    ctx.beginPath();
    ctx.moveTo(width - 20, 40);
    ctx.quadraticCurveTo(width + 2, 30, width - 6, 16);
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#b5532c';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(14, 46, 13, Math.PI * 0.5, Math.PI * 1.5);
    ctx.lineWidth = 6;
    ctx.stroke();
    ellipse(ctx, cx, 48, 30, 26);
    ctx.fillStyle = '#d9683a';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = palette.ink;
    ctx.stroke();
    ellipse(ctx, cx, 24, 18, 6);
    ctx.fillStyle = '#b5532c';
    ctx.fill();
    ctx.stroke();
    circle(ctx, cx, 15, 5);
    ctx.fillStyle = '#f0c94a';
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ellipse(ctx, cx - 10, 40, 6, 10);
    ctx.fill();
    return;
  }
  roundRect(ctx, 14, 14, width - 28, height - 20, 14);
  ctx.fillStyle = 'rgba(235,245,250,0.9)';
  ctx.fill();
  ctx.save();
  roundRect(ctx, 14, 14, width - 28, height - 20, 14);
  ctx.clip();
  ctx.fillStyle = DRINK_COLORS.kompot;
  ctx.fillRect(0, 28, width, height);
  ctx.fillStyle = '#8f1f3a';
  for (const [x, y] of [
    [cx - 14, height - 22],
    [cx + 4, height - 28],
    [cx + 16, height - 18],
    [cx - 4, height - 42],
  ] as const) {
    circle(ctx, x, y, 6);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(20, 20, 6, height - 34);
  ctx.restore();
  roundRect(ctx, 14, 14, width - 28, height - 20, 14);
  ctx.stroke();
  roundRect(ctx, 20, 4, width - 40, 12, 5);
  ctx.fillStyle = '#e9c46a';
  ctx.fill();
  ctx.stroke();
}

function drawBubble(ctx: Ctx, width: number, height: number): void {
  const body = height - 18;
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  roundRect(ctx, 4, 6, width - 8, body, 22);
  ctx.fill();
  ctx.fillStyle = palette.bubble;
  roundRect(ctx, 4, 2, width - 8, body, 22);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(width / 2 - 14, body);
  ctx.lineTo(width / 2, height - 2);
  ctx.lineTo(width / 2 + 14, body);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(58,36,24,0.25)';
  ctx.lineWidth = 2;
  roundRect(ctx, 4, 2, width - 8, body, 22);
  ctx.stroke();
}

function drawCoin(ctx: Ctx, size: number): void {
  circle(ctx, size / 2, size / 2, size / 2 - 2);
  ctx.fillStyle = palette.coinDark;
  ctx.fill();
  circle(ctx, size / 2, size / 2 - 2, size / 2 - 5);
  ctx.fillStyle = palette.coin;
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ellipse(ctx, size * 0.4, size * 0.34, size * 0.14, size * 0.08);
  ctx.fill();
}

export const BUBBLE_W = 176;
export const BUBBLE_H = 120;
export const STATION_W = 88;
export const STATION_H = 80;
export const TRAY_W = 104;
export const TRAY_H = 78;

export function generateFoodArt(scene: Phaser.Scene): void {
  makeTexture(scene, Tex.Stick, STICK_W, STICK_H, drawStick);
  for (const kind of meatKinds) {
    if (kind === 'veg') {
      VEG_COLORS.forEach((color, index) => {
        makeTexture(scene, `${Tex.Chunk}veg-${index}`, CHUNK_W, CHUNK_H, (ctx, w, h) =>
          drawChunk(ctx, kind, w, h, color),
        );
      });
    } else {
      makeTexture(scene, `${Tex.Chunk}${kind}`, CHUNK_W, CHUNK_H, (ctx, w, h) =>
        drawChunk(ctx, kind, w, h, kind === 'lamb' || kind === 'beef' ? '#e2e2e2' : '#f1f1f1'),
      );
    }
    makeTexture(scene, trayTexture(kind), TRAY_W, TRAY_H, (ctx, w, h) => drawTray(ctx, kind, w, h));
    makeTexture(scene, miniTexture(kind), 34, 84, (ctx, w, h) => drawMini(ctx, kind, w, h));
  }
  for (const kind of sideKinds) {
    makeTexture(scene, sideTexture(kind), 56, 56, (ctx) => drawSide(ctx, kind, 56));
    makeTexture(scene, stationTexture(kind), STATION_W, STATION_H, (ctx, w, h) =>
      drawSideStation(ctx, kind, w, h),
    );
  }
  for (const kind of drinkKinds) {
    makeTexture(scene, drinkTexture(kind), 48, 64, (ctx, w, h) => drawDrink(ctx, kind, w, h));
    makeTexture(scene, stationTexture(kind), STATION_W, STATION_H, (ctx, w, h) =>
      drawDrinkStation(ctx, kind, w, h),
    );
  }
  makeTexture(scene, Tex.Plate, 210, 150, drawPlate);
  makeTexture(scene, Tex.Bucket, 110, 120, drawBucket);
  makeTexture(scene, Tex.Bubble, BUBBLE_W, BUBBLE_H, drawBubble);
  makeTexture(scene, Tex.Coin, 40, 40, (ctx) => drawCoin(ctx, 40));
}
