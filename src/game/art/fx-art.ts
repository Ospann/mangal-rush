import type Phaser from 'phaser';
import { Tex } from '../keys';
import { makeTexture, rGradient, vGradient, type Ctx } from './canvas';

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

export function generateFxArt(scene: Phaser.Scene): void {
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
