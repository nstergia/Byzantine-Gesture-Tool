// Pitch track of a raw mono 48 kHz float32 file with the application's detector (lib/core.mjs):
// 4,096-sample frames every 110 ms, as in the application. Used by bench/pyin_compare.py.
// Usage: node bench/yin-frames.mjs input.f32 > frames.json
import { readFileSync } from 'node:fs';
import { detectPitch } from '../lib/core.mjs';
const b = readFileSync(process.argv[2]);
const x = new Float32Array(b.buffer, b.byteOffset, Math.floor(b.length / 4));
const SR = 48000, N = 4096, HOP = Math.round(0.110 * SR), out = [];
for (let s = 0; s + N <= x.length; s += HOP) out.push(detectPitch(x.subarray(s, s + N), SR));
console.log(JSON.stringify(out));
