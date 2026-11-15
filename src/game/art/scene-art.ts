import type Phaser from 'phaser';
import { Tex } from '../keys';
import { createRng } from '../sim/rng';
import { layout } from '../view/layout';
import { circle, ellipse, makeTexture, rGradient, roundRect, vGradient, type Ctx } from './canvas';
import { palette } from './palette';

function drawAwning(ctx: Ctx, width: number): void {
  const stripe = 60;
  const height = 58;
  for (let x = 0, index = 0; x < width; x += stripe, index += 1) {
    ctx.fillStyle = index % 2 === 0 ? palette.awningA : palette.awningB;
    ctx.fillRect(x, 0, stripe, height);
    circle(ctx, x + stripe / 2, height, stripe / 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(58,36,24,0.18)';
  ctx.fillRect(0, 0, width, 10);
}

function drawPlanks(ctx: Ctx, y: number, height: number, width: number): void {
  ctx.fillStyle = palette.table;
  ctx.fillRect(0, y, width, height);
  ctx.strokeStyle = palette.tableLine;
  ctx.lineWidth = 3;
  const rng = createRng(11);
  for (let row = y + 54; row < y + height; row += 54) {
    ctx.beginPath();
    ctx.moveTo(0, row);
    ctx.lineTo(width, row);
    ctx.stroke();
  }
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.5;
  for (let index = 0; index < 26; index += 1) {
    const x = rng.range(0, width);
    const row = y + rng.range(0, height);
    ctx.beginPath();
    ctx.moveTo(x, row);
    ctx.lineTo(x + rng.range(20, 70), row);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawBackground(ctx: Ctx, width: number, height: number): void {
  const horizon = layout.counterY;
  ctx.fillStyle = vGradient(ctx, 0, horizon, [
    [0, palette.skyTop],
    [1, palette.skyBottom],
  ]);
  ctx.fillRect(0, 0, width, horizon);

  ctx.fillStyle = rGradient(ctx, 560, 150, 130, [
    [0, 'rgba(255,241,184,1)'],
    [0.35, 'rgba(255,241,184,0.9)'],
    [1, 'rgba(255,241,184,0)'],
  ]);
  ctx.fillRect(400, 0, 320, 320);

  ctx.fillStyle = palette.hillFar;
  ctx.beginPath();
  ctx.moveTo(0, 300);
  ctx.quadraticCurveTo(170, 190, 360, 290);
  ctx.quadraticCurveTo(540, 210, 720, 280);
  ctx.lineTo(720, horizon);
  ctx.lineTo(0, horizon);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = palette.hillNear;
  ctx.beginPath();
  ctx.moveTo(0, 340);
  ctx.quadraticCurveTo(240, 270, 470, 335);
  ctx.quadraticCurveTo(610, 300, 720, 330);
  ctx.lineTo(720, horizon);
  ctx.lineTo(0, horizon);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = palette.road;
  ctx.fillRect(0, 352, width, horizon - 352);
  ctx.fillStyle = palette.roadLine;
  for (let x = 20; x < width; x += 120) ctx.fillRect(x, 372, 64, 7);

  drawAwning(ctx, width);
  drawPlanks(ctx, horizon, layout.grillTop - horizon, width);

  ctx.fillStyle = palette.ground;
  ctx.fillRect(0, layout.grillTop - 14, width, height - layout.grillTop + 14);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(0, layout.grillTop - 14, width, 10);
}

function drawCounter(ctx: Ctx, width: number, height: number): void {
  ctx.fillStyle = palette.counterFront;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = palette.counterTop;
  ctx.fillRect(0, 0, width, 22);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(0, 0, width, 5);
  ctx.strokeStyle = palette.counterDark;
  ctx.lineWidth = 3;
  for (let x = 90; x < width; x += 90) {
    ctx.beginPath();
    ctx.moveTo(x, 24);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(0, height - 8, width, 8);
}

function drawGrill(ctx: Ctx, width: number, height: number): void {
  roundRect(ctx, 0, 0, width, height, 26);
  ctx.fillStyle = vGradient(ctx, 0, height, [
    [0, palette.steelLight],
    [0.08, palette.steel],
    [1, palette.steelDark],
  ]);
  ctx.fill();

  const inset = 22;
  const bedX = inset;
  const bedY = inset + 12;
  const bedW = width - inset * 2;
  const bedH = height - inset * 2 - 12;
  roundRect(ctx, bedX, bedY, bedW, bedH, 14);
  ctx.fillStyle = palette.coalBed;
  ctx.fill();

  ctx.save();
  roundRect(ctx, bedX, bedY, bedW, bedH, 14);
  ctx.clip();
  const rng = createRng(42);
  for (let index = 0; index < 230; index += 1) {
    const x = bedX + rng.range(0, bedW);
    const y = bedY + rng.range(0, bedH);
    const r = rng.range(11, 24);
    ellipse(ctx, x, y, r, r * rng.range(0.6, 0.95));
    ctx.fillStyle = rng.next() < 0.5 ? palette.coal : '#3a2f29';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
    if (rng.next() < 0.55) {
      ctx.strokeStyle = `rgba(255,${Math.round(rng.range(90, 170))},40,${rng.range(0.35, 0.8)})`;
      ctx.lineWidth = rng.range(1.5, 3.5);
      ctx.beginPath();
      ctx.moveTo(x - r * 0.5, y + rng.range(-4, 4));
      ctx.lineTo(x + rng.range(-3, 3), y + rng.range(-5, 5));
      ctx.lineTo(x + r * 0.5, y + rng.range(-4, 4));
      ctx.stroke();
    }
  }
  ctx.fillStyle = vGradient(ctx, bedY, bedY + 40, [
    [0, 'rgba(0,0,0,0.65)'],
    [1, 'rgba(0,0,0,0)'],
  ]);
  ctx.fillRect(bedX, bedY, bedW, 40);
  ctx.restore();

  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (const x of [14, width - 14]) {
    for (const y of [16, height - 16]) {
      circle(ctx, x, y, 5);
      ctx.fill();
    }
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 4;
  roundRect(ctx, 2, 2, width - 4, height - 4, 26);
  ctx.stroke();
}

function drawGlow(ctx: Ctx, size: number): void {
  ctx.fillStyle = rGradient(ctx, size / 2, size / 2, size / 2, [
    [0, 'rgba(255,255,255,1)'],
    [0.45, 'rgba(255,255,255,0.55)'],
    [1, 'rgba(255,255,255,0)'],
  ]);
  ctx.fillRect(0, 0, size, size);
}

export function generateSceneArt(scene: Phaser.Scene): void {
  makeTexture(scene, Tex.Background, layout.width, layout.height, drawBackground);
  makeTexture(scene, Tex.Counter, layout.width, layout.counterH, drawCounter);
  makeTexture(scene, Tex.Grill, layout.grillW, layout.grillH, drawGrill);
  makeTexture(scene, Tex.Glow, 128, 128, (ctx) => drawGlow(ctx, 128));
}
