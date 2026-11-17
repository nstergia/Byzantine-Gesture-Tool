// Time of one pitch detection (lib/core.mjs, 4,096 samples at 48 kHz) on this machine.
// The application runs it twice every 110 ms (teacher and student). Node.js uses V8, the engine
// of Chrome and Edge; in the browser, ?perf=1 reports the same quantity for a real session.
// Usage: node bench/yin-timing.mjs
import { detectPitch } from '../lib/core.mjs';
import os from 'node:os';
const SR = 48000, N = 4096, bufs = [];
let seed = 5; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
for (const f of [80, 150, 300, 600]) {
  const b = new Float32Array(N);
  for (let i = 0; i < N; i++) { let s = 0; for (let h = 1; h <= 8; h++) s += Math.sin(2 * Math.PI * h * f * i / SR) / h; b[i] = 0.3 * s + 0.01 * (rnd() - 0.5); }
  bufs.push(b);
}
for (let k = 0; k < 200; k++) detectPitch(bufs[k % 4], SR);            // warm-up (JIT)
const t = [];
for (let k = 0; k < 2000; k++) { const t0 = performance.now(); detectPitch(bufs[k % 4], SR); t.push(performance.now() - t0); }
t.sort((a, b) => a - b);
const mean = t.reduce((a, b) => a + b, 0) / t.length;
console.log(JSON.stringify({ cpu: os.cpus()[0]?.model, node: process.version,
  meanMs: +mean.toFixed(2), medianMs: +t[1000].toFixed(2), p95Ms: +t[1900].toFixed(2),
  shareOfMainThread: +(100 * 2 * mean / 110).toFixed(1) + '%' }, null, 2));
