import type Phaser from 'phaser';
import { balance, type MeatKind } from '../balance';
import { Tex } from '../keys';
import { cssColor, meatColor } from '../view/meat-color';
import { circle, ellipse, makeTexture, roundRect, vGradient, type Ctx } from './canvas';
import { palette } from './palette';

export const CHUNK_W = 76;
export const CHUNK_H = 56;
export const STICK_W = 20;
export const STICK_H = 290;

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

function drawChunk(ctx: Ctx, kind: MeatKind, width: number, height: number): void {
  const boxy = kind === 'lamb';
  roundRect(ctx, 2, 2, width - 4, height - 4, boxy ? 13 : 24);
  ctx.fillStyle = vGradient(ctx, 0, height, [
    [0, '#ffffff'],
    [0.55, boxy ? '#e2e2e2' : '#f1f1f1'],
    [1, '#b9b9b9'],
  ]);
  ctx.fill();

  ctx.save();
  roundRect(ctx, 2, 2, width - 4, height - 4, boxy ? 13 : 24);
  ctx.clip();
  if (boxy) {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(0, 0, width, 11);
    ctx.fillStyle = 'rgba(120,120,120,0.35)';
    ctx.fillRect(22, 26, 30, 4);
  } else {
    ctx.fillStyle = 'rgba(130,130,130,0.28)';
    ctx.fillRect(16, 20, 40, 4);
    ctx.fillRect(22, 34, 30, 4);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ellipse(ctx, width * 0.32, height * 0.3, 13, 6);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = 'rgba(70,70,70,0.55)';
  ctx.lineWidth = 3;
  roundRect(ctx, 2, 2, width - 4, height - 4, boxy ? 13 : 24);
  ctx.stroke();
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

function drawBowl(ctx: Ctx, kind: MeatKind, width: number, height: number): void {
  const cx = width / 2;
  ellipse(ctx, cx, height - 22, width / 2 - 8, 16);
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(8, 44);
  ctx.quadraticCurveTo(14, height - 8, cx, height - 12);
  ctx.quadraticCurveTo(width - 14, height - 8, width - 8, 44);
  ctx.closePath();
  ctx.fillStyle = palette.bowlDark;
  ctx.fill();

  ellipse(ctx, cx, 44, width / 2 - 8, 24);
  ctx.fillStyle = palette.bowl;
  ctx.fill();
  ellipse(ctx, cx, 46, width / 2 - 18, 17);
  ctx.fillStyle = '#2a4d66';
  ctx.fill();

  const raw = cssColor(meatColor(kind, 0));
  const spots: readonly (readonly [number, number])[] = [
    [cx - 34, 44],
    [cx - 6, 50],
    [cx + 26, 44],
    [cx - 20, 32],
    [cx + 10, 30],
  ];
  for (const [x, y] of spots) {
    roundRect(ctx, x - 17, y - 13, 34, 26, kind === 'lamb' ? 7 : 12);
    ctx.fillStyle = raw;
    ctx.fill();
    ctx.strokeStyle = 'rgba(80,30,30,0.45)';
    ctx.lineWidth = 2;
    ctx.stroke();
    if (kind === 'lamb') {
      ctx.fillStyle = 'rgba(255,240,230,0.8)';
      ctx.fillRect(x - 13, y - 11, 26, 5);
    }
  }
  ctx.strokeStyle = palette.stick;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx + 18, 34);
  ctx.lineTo(cx + 52, 4);
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
  const color = cssColor(meatColor(kind, (meat.perfectFrom + meat.perfectTo) / 2));
  for (let index = 0; index < 3; index += 1) {
    const y = 20 + index * 20;
    roundRect(ctx, 3, y, width - 6, 17, kind === 'lamb' ? 4 : 8);
    ctx.fillStyle = color;
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

export function generateFoodArt(scene: Phaser.Scene): void {
  makeTexture(scene, Tex.Stick, STICK_W, STICK_H, drawStick);
  makeTexture(scene, Tex.ChunkChicken, CHUNK_W, CHUNK_H, (ctx, w, h) =>
    drawChunk(ctx, 'chicken', w, h),
  );
  makeTexture(scene, Tex.ChunkLamb, CHUNK_W, CHUNK_H, (ctx, w, h) => drawChunk(ctx, 'lamb', w, h));
  makeTexture(scene, Tex.Plate, 210, 150, drawPlate);
  makeTexture(scene, Tex.BowlChicken, 150, 120, (ctx, w, h) => drawBowl(ctx, 'chicken', w, h));
  makeTexture(scene, Tex.BowlLamb, 150, 120, (ctx, w, h) => drawBowl(ctx, 'lamb', w, h));
  makeTexture(scene, Tex.Bucket, 110, 120, drawBucket);
  makeTexture(scene, Tex.MiniChicken, 34, 84, (ctx, w, h) => drawMini(ctx, 'chicken', w, h));
  makeTexture(scene, Tex.MiniLamb, 34, 84, (ctx, w, h) => drawMini(ctx, 'lamb', w, h));
  makeTexture(scene, Tex.Bubble, 176, 116, drawBubble);
  makeTexture(scene, Tex.Coin, 40, 40, (ctx) => drawCoin(ctx, 40));
}

export const chunkTexture: Record<MeatKind, string> = {
  chicken: Tex.ChunkChicken,
  lamb: Tex.ChunkLamb,
};

export const bowlTexture: Record<MeatKind, string> = {
  chicken: Tex.BowlChicken,
  lamb: Tex.BowlLamb,
};

export const miniTexture: Record<MeatKind, string> = {
  chicken: Tex.MiniChicken,
  lamb: Tex.MiniLamb,
};
