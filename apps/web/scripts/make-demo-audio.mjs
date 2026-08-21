/**
 * Generate a placeholder narration track.
 *
 * The audio player needs a real file to be worth demonstrating — real
 * duration, real seeking, real resume-from-position. Soulfables has no
 * recorded narration yet, so this writes a short piece of quiet ambient
 * tone that the player can actually load.
 *
 * It is deliberately NOT silence: a silent file makes a broken player
 * look identical to a working one. It is also deliberately not music —
 * the UI says plainly that narration has not been recorded, and this is
 * only there so the transport controls can be exercised.
 *
 * Run: node apps/web/scripts/make-demo-audio.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, '..', 'public', 'audio');

const SAMPLE_RATE = 8000; // Speech-ish. Keeps the file small.
const SECONDS = 90;
const CHANNELS = 1;
const BITS = 16;

function writeWav(path, samples) {
  const dataBytes = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataBytes);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(CHANNELS, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE((SAMPLE_RATE * CHANNELS * BITS) / 8, 28);
  buffer.writeUInt16LE((CHANNELS * BITS) / 8, 32);
  buffer.writeUInt16LE(BITS, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataBytes, 40);

  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(clamped * 32767), 44 + i * 2);
  }

  writeFileSync(path, buffer);
  return buffer.length;
}

const total = SAMPLE_RATE * SECONDS;
const samples = new Float32Array(total);

// A slow pair of low tones with a gentle swell — quiet enough to sit
// under a demo, audible enough to prove the player is running.
for (let i = 0; i < total; i++) {
  const t = i / SAMPLE_RATE;
  const swell = 0.5 - 0.5 * Math.cos((2 * Math.PI * t) / 20); // 20s breath
  const tone =
    Math.sin(2 * Math.PI * 110 * t) * 0.6 +
    Math.sin(2 * Math.PI * 164.81 * t) * 0.4;
  samples[i] = tone * swell * 0.05;
}

// Fade in and out so it does not click.
const fade = SAMPLE_RATE * 2;
for (let i = 0; i < fade; i++) {
  samples[i] *= i / fade;
  samples[total - 1 - i] *= i / fade;
}

mkdirSync(OUT_DIR, { recursive: true });
const bytes = writeWav(join(OUT_DIR, 'narration-placeholder.wav'), samples);

console.log(
  `wrote public/audio/narration-placeholder.wav — ${SECONDS}s, ${(bytes / 1024 / 1024).toFixed(2)} MB`,
);
