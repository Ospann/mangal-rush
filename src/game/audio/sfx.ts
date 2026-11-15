import type Phaser from 'phaser';
import { Sfx, type SfxKey } from '../keys';
import { renderSounds } from './synth';

type LoopSound =
  | Phaser.Sound.WebAudioSound
  | Phaser.Sound.HTML5AudioSound
  | Phaser.Sound.NoAudioSound;

function audioContextOf(scene: Phaser.Scene): BaseAudioContext | null {
  const manager: unknown = scene.sound;
  if (typeof manager !== 'object' || manager === null || !('context' in manager)) return null;
  const context = manager.context;
  return context instanceof BaseAudioContext ? context : null;
}

export function generateAudio(scene: Phaser.Scene): void {
  const context = audioContextOf(scene);
  if (!context) return;
  for (const [key, buffer] of renderSounds(context)) {
    if (!scene.cache.audio.exists(key)) scene.cache.audio.add(key, buffer);
  }
}

interface Loop {
  sound: LoopSound;
  volume: number;
  target: number;
}

export class SfxPlayer {
  private readonly loops = new Map<SfxKey, Loop>();
  private sizzle: LoopSound | null = null;
  private sizzleVolume = 0;
  private readonly lastPlayed = new Map<SfxKey, number>();

  constructor(private readonly scene: Phaser.Scene) {}

  play(key: SfxKey, volume = 1, rate = 1, minGapMs = 0): void {
    if (!this.scene.cache.audio.exists(key)) return;
    const now = this.scene.time.now;
    if (minGapMs > 0 && now - (this.lastPlayed.get(key) ?? -Infinity) < minGapMs) return;
    this.lastPlayed.set(key, now);
    this.scene.sound.play(key, { volume, rate });
  }

  startSizzle(): void {
    if (this.sizzle || !this.scene.cache.audio.exists(Sfx.Sizzle)) return;
    const sound = this.scene.sound.add(Sfx.Sizzle, { loop: true, volume: 0 });
    sound.play();
    this.sizzle = sound;
    this.sizzleVolume = 0;
  }

  updateSizzle(intensity: number, dtSec: number): void {
    if (!this.sizzle) return;
    const target = Math.min(0.55, intensity * 0.16);
    this.sizzleVolume += (target - this.sizzleVolume) * Math.min(1, dtSec * 6);
    this.sizzle.setVolume(this.sizzleVolume);
    this.sizzle.setRate(0.85 + Math.min(1.5, intensity) * 0.22);
  }

  setLoop(key: SfxKey, target: number): void {
    const existing = this.loops.get(key);
    if (existing) {
      existing.target = target;
      return;
    }
    if (target <= 0 || !this.scene.cache.audio.exists(key)) return;
    const sound = this.scene.sound.add(key, { loop: true, volume: 0 });
    sound.play();
    this.loops.set(key, { sound, volume: 0, target });
  }

  updateLoops(dtSec: number): void {
    for (const loop of this.loops.values()) {
      if (loop.volume === loop.target) continue;
      const step = dtSec * 0.6;
      loop.volume =
        loop.volume < loop.target
          ? Math.min(loop.target, loop.volume + step)
          : Math.max(loop.target, loop.volume - step);
      loop.sound.setVolume(loop.volume);
    }
  }

  stop(): void {
    for (const loop of this.loops.values()) {
      loop.sound.stop();
      loop.sound.destroy();
    }
    this.loops.clear();
    this.sizzle?.stop();
    this.sizzle?.destroy();
    this.sizzle = null;
  }
}
