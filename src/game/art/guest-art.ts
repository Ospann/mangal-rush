import type Phaser from 'phaser';
import { Tex } from '../keys';
import { circle, ellipse, makeTexture, roundRect, type Ctx } from './canvas';
import { guestLooks, palette } from './palette';

export type Emotion = 'waiting' | 'hurry' | 'happy' | 'angry';

export const emotions: readonly Emotion[] = ['waiting', 'hurry', 'happy', 'angry'];

export const GUEST_W = 180;
export const GUEST_H = 240;
export const FACE_W = 100;
export const FACE_H = 76;
export const HEAD_Y = -52;

function drawBody(
  ctx: Ctx,
  look: (typeof guestLooks)[number],
  width: number,
  height: number,
): void {
  const cx = width / 2;
  const headY = height / 2 + HEAD_Y;

  ctx.beginPath();
  ctx.moveTo(cx - 74, height);
  ctx.quadraticCurveTo(cx - 80, 138, cx - 30, 130);
  ctx.lineTo(cx + 30, 130);
  ctx.quadraticCurveTo(cx + 80, 138, cx + 74, height);
  ctx.closePath();
  ctx.fillStyle = look.shirt;
  ctx.fill();
  ctx.strokeStyle = palette.ink;
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.fillStyle = look.shirtDark;
  ctx.beginPath();
  ctx.moveTo(cx - 22, 131);
  ctx.lineTo(cx, 160);
  ctx.lineTo(cx + 22, 131);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = palette.skinShade;
  roundRect(ctx, cx - 15, 112, 30, 30, 8);
  ctx.fill();

  circle(ctx, cx, headY, 54);
  ctx.fillStyle = palette.skin;
  ctx.fill();
  ctx.strokeStyle = palette.ink;
  ctx.lineWidth = 4;
  ctx.stroke();

  for (const side of [-1, 1]) {
    ellipse(ctx, cx + side * 54, headY + 4, 8, 12);
    ctx.fillStyle = palette.skin;
    ctx.fill();
    ctx.stroke();
  }

  ctx.fillStyle = look.hair;
  ctx.beginPath();
  ctx.arc(cx, headY - 4, 55, Math.PI * 1.05, Math.PI * 1.95);
  ctx.quadraticCurveTo(cx, headY - 34, cx - 54, headY - 12);
  ctx.closePath();
  ctx.fill();

  if (look.hat) {
    ctx.fillStyle = look.hat;
    ctx.beginPath();
    ctx.arc(cx, headY - 20, 52, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    roundRect(ctx, cx - 10, headY - 30, 78, 14, 7);
    ctx.fill();
    ctx.stroke();
  }
}

function eye(ctx: Ctx, x: number, y: number, r: number): void {
  circle(ctx, x, y, r);
  ctx.fillStyle = palette.ink;
  ctx.fill();
  circle(ctx, x - r * 0.3, y - r * 0.35, r * 0.35);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
}

function drawFace(ctx: Ctx, emotion: Emotion, width: number): void {
  const cx = width / 2;
  const eyeY = 26;
  const mouthY = 54;
  ctx.strokeStyle = palette.ink;
  ctx.lineCap = 'round';
  ctx.lineWidth = 5;

  if (emotion === 'happy') {
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(cx + side * 22, eyeY + 4, 10, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(cx, mouthY - 8, 20, Math.PI * 0.08, Math.PI * 0.92);
    ctx.closePath();
    ctx.fillStyle = '#8a2f2a';
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,120,110,0.45)';
    for (const side of [-1, 1]) {
      ellipse(ctx, cx + side * 38, eyeY + 20, 9, 6);
      ctx.fill();
    }
    return;
  }

  if (emotion === 'waiting') {
    eye(ctx, cx - 22, eyeY, 7);
    eye(ctx, cx + 22, eyeY, 7);
    ctx.beginPath();
    ctx.arc(cx, mouthY - 10, 15, Math.PI * 0.18, Math.PI * 0.82);
    ctx.stroke();
    return;
  }

  if (emotion === 'hurry') {
    eye(ctx, cx - 22, eyeY, 9);
    eye(ctx, cx + 22, eyeY, 9);
    ctx.lineWidth = 4;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + side * 34, eyeY - 20);
      ctx.lineTo(cx + side * 14, eyeY - 15);
      ctx.stroke();
    }
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(cx - 14, mouthY);
    ctx.quadraticCurveTo(cx - 7, mouthY - 7, cx, mouthY);
    ctx.quadraticCurveTo(cx + 7, mouthY + 7, cx + 14, mouthY);
    ctx.stroke();
    ctx.fillStyle = '#7fd0ff';
    ctx.beginPath();
    ctx.moveTo(width - 10, 6);
    ctx.quadraticCurveTo(width - 2, 22, width - 10, 24);
    ctx.quadraticCurveTo(width - 18, 22, width - 10, 6);
    ctx.fill();
    return;
  }

  eye(ctx, cx - 22, eyeY + 2, 7);
  eye(ctx, cx + 22, eyeY + 2, 7);
  ctx.lineWidth = 6;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + side * 36, eyeY - 20);
    ctx.lineTo(cx + side * 10, eyeY - 8);
    ctx.stroke();
  }
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(cx, mouthY + 12, 16, Math.PI * 1.2, Math.PI * 1.8);
  ctx.stroke();
}

export function generateGuestArt(scene: Phaser.Scene): void {
  guestLooks.forEach((look, index) => {
    makeTexture(scene, `${Tex.GuestBody}${index}`, GUEST_W, GUEST_H, (ctx, w, h) =>
      drawBody(ctx, look, w, h),
    );
  });
  for (const emotion of emotions) {
    makeTexture(scene, `${Tex.Face}${emotion}`, FACE_W, FACE_H, (ctx, w) =>
      drawFace(ctx, emotion, w),
    );
  }
}
