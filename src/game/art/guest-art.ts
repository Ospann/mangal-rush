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

type Extra =
  | 'taxi'
  | 'granny'
  | 'student'
  | 'office'
  | 'blogger'
  | 'athlete'
  | 'critic'
  | 'toy'
  | null;

interface LookSpec {
  shirt: string;
  shirtDark: string;
  hair: string;
  hat: string | null;
  extra: Extra;
}

const [localA, localB, localC] = guestLooks;

export const lookSpecs: Record<string, LookSpec> = {
  'local-0': { ...localA, extra: null },
  'local-1': { ...localB, extra: null },
  'local-2': { ...localC, extra: null },
  taxi: { shirt: '#6b6f7a', shirtDark: '#4c4f58', hair: '#3a2c24', hat: '#f2c230', extra: 'taxi' },
  granny: { shirt: '#9a6fb0', shirtDark: '#7a548f', hair: '#d6d6de', hat: null, extra: 'granny' },
  student: { shirt: '#3fa7a0', shirtDark: '#2c8079', hair: '#6a4a2e', hat: null, extra: 'student' },
  office: { shirt: '#e9eef5', shirtDark: '#c3ccd9', hair: '#3b3431', hat: null, extra: 'office' },
  blogger: { shirt: '#e0559a', shirtDark: '#b83d7b', hair: '#f0c35a', hat: null, extra: 'blogger' },
  athlete: { shirt: '#3fa37a', shirtDark: '#2d7d5c', hair: '#4a3326', hat: null, extra: 'athlete' },
  critic: { shirt: '#3d3f55', shirtDark: '#2a2c3d', hair: '#8a8f99', hat: null, extra: 'critic' },
  toy: { shirt: '#e0a030', shirtDark: '#b87c1c', hair: '#3b3431', hat: null, extra: 'toy' },
};

export function lookTexture(look: string): string {
  return `${Tex.GuestBody}${Object.hasOwn(lookSpecs, look) ? look : 'local-0'}`;
}

function drawCompanions(ctx: Ctx, cx: number, colors: readonly [string, string]): void {
  ([-1, 1] as const).forEach((side, index) => {
    const x = cx + side * 60;
    ctx.beginPath();
    ctx.moveTo(x - 34, 240);
    ctx.quadraticCurveTo(x - 36, 140, x, 136);
    ctx.quadraticCurveTo(x + 36, 140, x + 34, 240);
    ctx.closePath();
    ctx.fillStyle = colors[index] ?? colors[0];
    ctx.fill();
    ctx.strokeStyle = palette.ink;
    ctx.lineWidth = 3;
    ctx.stroke();
    circle(ctx, x, 104, 30);
    ctx.fillStyle = palette.skinShade;
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = index === 0 ? '#5a3b2a' : '#2e2a33';
    ctx.beginPath();
    ctx.arc(x, 100, 31, Math.PI * 1.05, Math.PI * 1.95);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = palette.ink;
    circle(ctx, x - 9, 106, 3);
    ctx.fill();
    circle(ctx, x + 9, 106, 3);
    ctx.fill();
  });
}

function drawExtra(ctx: Ctx, extra: Extra, cx: number, headY: number): void {
  ctx.strokeStyle = palette.ink;
  ctx.lineWidth = 3;
  if (extra === 'taxi') {
    ctx.fillStyle = palette.ink;
    for (let index = 0; index < 6; index += 1) {
      if (index % 2 === 0) ctx.fillRect(cx - 48 + index * 16, headY - 30, 16, 9);
    }
    return;
  }
  if (extra === 'granny') {
    circle(ctx, cx, headY - 60, 17);
    ctx.fillStyle = '#d6d6de';
    ctx.fill();
    ctx.stroke();
    for (const side of [-1, 1]) {
      circle(ctx, cx + side * 22, headY - 4, 14);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(cx - 8, headY - 4);
    ctx.lineTo(cx + 8, headY - 4);
    ctx.stroke();
    ctx.fillStyle = '#e9d6f0';
    ctx.beginPath();
    ctx.moveTo(cx - 40, 134);
    ctx.lineTo(cx, 176);
    ctx.lineTo(cx + 40, 134);
    ctx.lineTo(cx + 22, 131);
    ctx.lineTo(cx, 156);
    ctx.lineTo(cx - 22, 131);
    ctx.closePath();
    ctx.fill();
    return;
  }
  if (extra === 'student') {
    ctx.lineWidth = 9;
    ctx.strokeStyle = '#2b3a55';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + side * 40, 136);
      ctx.lineTo(cx + side * 48, 240);
      ctx.stroke();
    }
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#ffffff';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + side * 9, 150);
      ctx.lineTo(cx + side * 11, 186);
      ctx.stroke();
    }
    return;
  }
  if (extra === 'office' || extra === 'toy') {
    ctx.fillStyle = extra === 'office' ? '#c8372f' : '#d8473a';
    ctx.beginPath();
    if (extra === 'office') {
      ctx.moveTo(cx - 9, 150);
      ctx.lineTo(cx + 9, 150);
      ctx.lineTo(cx + 12, 208);
      ctx.lineTo(cx, 224);
      ctx.lineTo(cx - 12, 208);
    } else {
      ctx.moveTo(cx, 152);
      ctx.lineTo(cx - 26, 138);
      ctx.lineTo(cx - 26, 168);
      ctx.lineTo(cx, 152);
      ctx.lineTo(cx + 26, 138);
      ctx.lineTo(cx + 26, 168);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    return;
  }
  if (extra === 'blogger') {
    roundRect(ctx, cx + 38, 128, 36, 62, 7);
    ctx.fillStyle = '#23252e';
    ctx.fill();
    ctx.stroke();
    circle(ctx, cx + 56, 144, 7);
    ctx.fillStyle = '#7fd0ff';
    ctx.fill();
    circle(ctx, cx + 66, 180, 4);
    ctx.fillStyle = '#ff4b4b';
    ctx.fill();
    circle(ctx, cx + 50, 196, 13);
    ctx.fillStyle = palette.skin;
    ctx.fill();
    ctx.stroke();
    return;
  }
  if (extra === 'athlete') {
    for (const side of [-1, 1]) {
      ellipse(ctx, cx + side * 60, 178, 17, 40);
      ctx.fillStyle = palette.skin;
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = '#e0473a';
    ctx.fillRect(cx - 52, headY - 36, 104, 13);
    ctx.strokeRect(cx - 52, headY - 36, 104, 13);
    return;
  }
  if (extra === 'critic') {
    ellipse(ctx, cx - 6, headY - 46, 54, 20);
    ctx.fillStyle = '#5a2a3a';
    ctx.fill();
    ctx.stroke();
    circle(ctx, cx - 6, headY - 66, 5);
    ctx.fill();
    ctx.fillStyle = '#8f2f4a';
    ctx.beginPath();
    ctx.moveTo(cx, 146);
    ctx.lineTo(cx - 22, 134);
    ctx.lineTo(cx - 22, 158);
    ctx.lineTo(cx, 146);
    ctx.lineTo(cx + 22, 134);
    ctx.lineTo(cx + 22, 158);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    roundRect(ctx, cx + 36, 170, 40, 52, 4);
    ctx.fillStyle = '#fffaf0';
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = 2;
    for (let line = 0; line < 3; line += 1) {
      ctx.beginPath();
      ctx.moveTo(cx + 42, 184 + line * 11);
      ctx.lineTo(cx + 70, 184 + line * 11);
      ctx.stroke();
    }
  }
}

function drawBody(ctx: Ctx, look: LookSpec, width: number, height: number): void {
  const cx = width / 2;
  const headY = height / 2 + HEAD_Y;

  if (look.extra === 'office') drawCompanions(ctx, cx, ['#7d8fb3', '#b38f7d']);
  if (look.extra === 'toy') drawCompanions(ctx, cx, ['#5fae72', '#e0559a']);

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
  for (const [key, look] of Object.entries(lookSpecs)) {
    makeTexture(scene, `${Tex.GuestBody}${key}`, GUEST_W, GUEST_H, (ctx, w, h) => {
      drawBody(ctx, look, w, h);
      drawExtra(ctx, look.extra, w / 2, h / 2 + HEAD_Y);
    });
  }
  for (const emotion of emotions) {
    makeTexture(scene, `${Tex.Face}${emotion}`, FACE_W, FACE_H, (ctx, w) =>
      drawFace(ctx, emotion, w),
    );
  }
}
