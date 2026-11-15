import type Phaser from 'phaser';
import { Tex } from '../keys';
import { makeTexture, rGradient, roundRect, vGradient, type Ctx } from './canvas';

function drawFlame(ctx: Ctx, width: number, height: number): void {
  const cx = width / 2;
  const shape = (scale: number, lift: number): void => {
    const w = (width / 2 - 6) * scale;
    const top = height * (1 - scale) + lift;
    ctx.beginPath();
    ctx.moveTo(cx, top);
    ctx.bezierCurveTo(
      cx + w * 0.5,
      top + height * 0.3 * scale,
      cx + w,
      height * 0.62,
      cx + w * 0.72,
      height - 8,
    );
    ctx.quadraticCurveTo(cx, height + 4, cx - w * 0.72, height - 8);
    ctx.bezierCurveTo(cx - w, height * 0.62, cx - w * 0.5, top + height * 0.3 * scale, cx, top);
    ctx.closePath();
  };

  shape(1, 4);
  ctx.fillStyle = vGradient(ctx, 0, height, [
    [0, 'rgba(255,90,20,0.0)'],
    [0.25, 'rgba(255,90,20,0.9)'],
    [1, 'rgba(255,140,30,1)'],
  ]);
  ctx.fill();

  shape(0.68, 0);
  ctx.fillStyle = vGradient(ctx, height * 0.3, height, [
    [0, 'rgba(255,190,50,0.9)'],
    [1, 'rgba(255,220,90,1)'],
  ]);
  ctx.fill();

  shape(0.36, 0);
  ctx.fillStyle = 'rgba(255,250,210,0.95)';
  ctx.fill();
}

function drawSoft(ctx: Ctx, size: number, inner: string, outer: string): void {
  ctx.fillStyle = rGradient(ctx, size / 2, size / 2, size / 2, [
    [0, inner],
    [1, outer],
  ]);
  ctx.fillRect(0, 0, size, size);
}

function drawDrop(ctx: Ctx, width: number, height: number): void {
  const cx = width / 2;
  ctx.beginPath();
  ctx.moveTo(cx, 0);
  ctx.quadraticCurveTo(width, height * 0.7, cx, height);
  ctx.quadraticCurveTo(0, height * 0.7, cx, 0);
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();
}

function drawSparkle(ctx: Ctx, size: number): void {
  const c = size / 2;
  const thin = size * 0.09;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(c, 0);
  ctx.quadraticCurveTo(c + thin, c - thin, size, c);
  ctx.quadraticCurveTo(c + thin, c + thin, c, size);
  ctx.quadraticCurveTo(c - thin, c + thin, 0, c);
  ctx.quadraticCurveTo(c - thin, c - thin, c, 0);
  ctx.closePath();
  ctx.fill();
}

function drawStar(ctx: Ctx, size: number): void {
  const c = size / 2;
  ctx.beginPath();
  for (let point = 0; point < 10; point += 1) {
    const radius = point % 2 === 0 ? c - 3 : (c - 3) * 0.46;
    const angle = -Math.PI / 2 + (point * Math.PI) / 5;
    const x = c + Math.cos(angle) * radius;
    const y = c + 2 + Math.sin(angle) * radius;
    if (point === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineJoin = 'round';
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(90,60,20,0.55)';
  ctx.stroke();
}

function drawFinger(ctx: Ctx): void {
  const parts: readonly (readonly [number, number, number, number, number])[] = [
    [30, 6, 24, 62, 12],
    [18, 46, 52, 50, 18],
    [6, 58, 24, 30, 12],
    [52, 52, 20, 22, 10],
    [52, 70, 18, 20, 9],
  ];
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#3a2418';
  ctx.lineWidth = 8;
  for (const [x, y, w, h, r] of parts) {
    roundRect(ctx, x, y, w, h, r);
    ctx.stroke();
  }
  ctx.fillStyle = '#fff7ec';
  for (const [x, y, w, h, r] of parts) {
    roundRect(ctx, x, y, w, h, r);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(58,36,24,0.18)';
  roundRect(ctx, 34, 10, 16, 10, 5);
  ctx.fill();
}

export function generateFxArt(scene: Phaser.Scene): void {
  makeTexture(scene, Tex.Finger, 80, 104, drawFinger);
  makeTexture(scene, Tex.Star, 64, 64, (ctx) => drawStar(ctx, 64));
  makeTexture(scene, Tex.Flame, 120, 180, drawFlame);
  makeTexture(scene, Tex.Puff, 64, 64, (ctx) =>
    drawSoft(ctx, 64, 'rgba(255,255,255,0.9)', 'rgba(255,255,255,0)'),
  );
  makeTexture(scene, Tex.Spark, 20, 20, (ctx) =>
    drawSoft(ctx, 20, 'rgba(255,255,255,1)', 'rgba(255,255,255,0)'),
  );
  makeTexture(scene, Tex.Drop, 14, 22, drawDrop);
  makeTexture(scene, Tex.Sparkle, 64, 64, (ctx) => drawSparkle(ctx, 64));
}
