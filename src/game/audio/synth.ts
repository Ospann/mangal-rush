import { Sfx, type SfxKey } from '../keys';
import { createRng, type Rng } from '../sim/rng';

type Render = (out: Float32Array, rate: number, rng: Rng) => void;

interface SoundSpec {
  seconds: number;
  render: Render;
}

const TAU = Math.PI * 2;

function noise(rng: Rng): number {
  return rng.next() * 2 - 1;
}

function fadeEdges(out: Float32Array, rate: number, seconds: number): void {
  const count = Math.min(Math.floor(rate * seconds), Math.floor(out.length / 2));
  for (let index = 0; index < count; index += 1) {
    const gain = index / count;
    out[index] = (out[index] ?? 0) * gain;
    const tail = out.length - 1 - index;
    out[tail] = (out[tail] ?? 0) * gain;
  }
}

const sizzle: Render = (out, rate, rng) => {
  let previous = 0;
  let low = 0;
  let crackle = 0;
  let wobble = 0.7;
  for (let index = 0; index < out.length; index += 1) {
    const white = noise(rng);
    const high = white - previous * 0.82;
    previous = white;
    low += (white - low) * 0.25;
    if (rng.next() < 26 / rate) crackle = rng.range(0.5, 1);
    crackle *= 0.9985;
    wobble += (rng.range(0.45, 1) - wobble) * (8 / rate);
    out[index] = (high * 0.3 * wobble + (white - low) * 0.5 * crackle) * 0.55;
  }
  fadeEdges(out, rate, 0.04);
};

const flare: Render = (out, _rate, rng) => {
  let low = 0;
  for (let index = 0; index < out.length; index += 1) {
    const t = index / out.length;
    const envelope = Math.min(1, t * 12) * (1 - t) ** 1.6;
    low += (noise(rng) - low) * (0.05 + 0.25 * (1 - t));
    out[index] = low * envelope * 1.5;
  }
};

const splash: Render = (out, _rate, rng) => {
  let previous = 0;
  for (let index = 0; index < out.length; index += 1) {
    const t = index / out.length;
    const white = noise(rng);
    const high = white - previous * (0.5 + 0.45 * t);
    previous = white;
    const envelope = Math.min(1, t * 40) * Math.exp(-t * 5.5);
    out[index] = high * envelope * 0.55;
  }
};

function bell(partials: readonly (readonly [number, number, number])[]): Render {
  return (out, rate) => {
    for (let index = 0; index < out.length; index += 1) {
      const t = index / rate;
      let sample = 0;
      for (const [frequency, gain, decay] of partials) {
        sample += Math.sin(TAU * frequency * t) * gain * Math.exp(-t * decay);
      }
      out[index] = sample * Math.min(1, t * 400);
    }
  };
}

const coin: Render = (out, rate) => {
  for (let index = 0; index < out.length; index += 1) {
    const t = index / rate;
    const frequency = t < 0.07 ? 1568 : 2093;
    const local = t < 0.07 ? t : t - 0.07;
    out[index] =
      (Math.sin(TAU * frequency * t) + 0.3 * Math.sin(TAU * frequency * 2 * t)) *
      Math.exp(-local * 16) *
      0.32;
  }
};

const flip: Render = (out, rate, rng) => {
  for (let index = 0; index < out.length; index += 1) {
    const t = index / rate;
    out[index] =
      (noise(rng) * 0.35 + Math.sin(TAU * 520 * t) * 0.5) *
      Math.exp(-t * 70) *
      Math.min(1, t * 900);
  }
};

const hm: Render = (out, rate) => {
  let phase = 0;
  let low = 0;
  for (let index = 0; index < out.length; index += 1) {
    const t = index / out.length;
    const frequency = 150 - 45 * t;
    phase += frequency / rate;
    const saw = (phase % 1) * 2 - 1;
    low += (saw - low) * 0.08;
    out[index] = low * Math.sin(Math.PI * t) ** 0.7 * 0.9;
  }
};

const coals: Render = (out, rate, rng) => {
  let low = 0;
  let crackle = 0;
  for (let index = 0; index < out.length; index += 1) {
    const t = index / out.length;
    const white = noise(rng);
    low += (white - low) * 0.03;
    if (rng.next() < 40 / rate) crackle = rng.range(0.4, 1);
    crackle *= 0.997;
    out[index] = low * Math.exp(-t * 6) * 3 + white * crackle * 0.25 * (1 - t);
  }
};

const fan: Render = (out, _rate, rng) => {
  let low = 0;
  for (let index = 0; index < out.length; index += 1) {
    const t = index / out.length;
    low += (noise(rng) - low) * 0.09;
    out[index] = low * Math.sin(Math.PI * t) ** 1.5 * 1.1;
  }
};

const place: Render = (out, rate, rng) => {
  let low = 0;
  for (let index = 0; index < out.length; index += 1) {
    const t = index / rate;
    low += (noise(rng) - low) * 0.2;
    out[index] = (low * 0.8 + Math.sin(TAU * 180 * t) * 0.5) * Math.exp(-t * 45);
  }
};

const trash: Render = (out, rate, rng) => {
  let low = 0;
  for (let index = 0; index < out.length; index += 1) {
    const t = index / rate;
    low += (noise(rng) - low) * 0.12;
    out[index] = (low * 1.2 + Math.sin(TAU * (110 - 200 * t) * t) * 0.5) * Math.exp(-t * 18);
  }
};

const pop: Render = (out, rate) => {
  for (let index = 0; index < out.length; index += 1) {
    const t = index / rate;
    const frequency = 520 + 900 * Math.exp(-t * 40);
    out[index] = Math.sin(TAU * frequency * t) * Math.exp(-t * 28) * 0.5 * Math.min(1, t * 600);
  }
};

const pour: Render = (out, rate, rng) => {
  let low = 0;
  let phase = 0;
  for (let index = 0; index < out.length; index += 1) {
    const t = index / out.length;
    low += (noise(rng) - low) * 0.18;
    phase += (380 + 520 * t + 60 * Math.sin(t * 70)) / rate;
    out[index] = (low * 0.6 + Math.sin(TAU * phase) * 0.25) * Math.sin(Math.PI * t) ** 0.8 * 0.8;
  }
};

const specs: Record<SfxKey, SoundSpec> = {
  [Sfx.Sizzle]: { seconds: 2.4, render: sizzle },
  [Sfx.Flare]: { seconds: 0.7, render: flare },
  [Sfx.Splash]: { seconds: 0.55, render: splash },
  [Sfx.Perfect]: {
    seconds: 0.7,
    render: bell([
      [1318.5, 0.3, 7],
      [1975.5, 0.22, 9],
      [2637, 0.12, 12],
    ]),
  },
  [Sfx.Bell]: {
    seconds: 0.9,
    render: bell([
      [880, 0.35, 5],
      [1760, 0.18, 7],
      [2640, 0.1, 10],
    ]),
  },
  [Sfx.Coin]: { seconds: 0.32, render: coin },
  [Sfx.Flip]: { seconds: 0.09, render: flip },
  [Sfx.Hm]: { seconds: 0.38, render: hm },
  [Sfx.Coals]: { seconds: 0.7, render: coals },
  [Sfx.Fan]: { seconds: 0.3, render: fan },
  [Sfx.Place]: { seconds: 0.12, render: place },
  [Sfx.Trash]: { seconds: 0.3, render: trash },
  [Sfx.Pop]: { seconds: 0.14, render: pop },
  [Sfx.Pour]: { seconds: 0.45, render: pour },
};

export function renderSounds(context: BaseAudioContext): Map<SfxKey, AudioBuffer> {
  const buffers = new Map<SfxKey, AudioBuffer>();
  const rate = context.sampleRate;
  let seed = 1;
  for (const key of Object.values(Sfx)) {
    const spec = specs[key];
    const buffer = context.createBuffer(1, Math.floor(rate * spec.seconds), rate);
    const data = buffer.getChannelData(0);
    spec.render(data, rate, createRng(seed));
    seed += 1;
    for (let index = 0; index < data.length; index += 1) {
      data[index] = Math.max(-1, Math.min(1, data[index] ?? 0));
    }
    buffers.set(key, buffer);
  }
  return buffers;
}
