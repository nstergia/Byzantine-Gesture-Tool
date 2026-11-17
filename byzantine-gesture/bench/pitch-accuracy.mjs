// Accuracy test of the YIN pitch detector (Section 3.2 of the paper).
// Usage: node bench/pitch-accuracy.mjs        (writes bench/results.csv, prints a summary)
// Settings follow the application: 48 kHz, 4,096-sample frames.
import { writeFileSync } from 'node:fs';
import { detectPitch } from '../lib/core.mjs';

const SR = 48000, N = 4096, FRAMES = 5, STEPS = 95;   // 95 quarter-tones from 65 Hz (65 … 982 Hz)
let seed = 42;                                          // fixed seed: the run is reproducible
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const gauss = () => { const u = rnd() || 1e-9, v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

const CONDITIONS = [
  { name: 'sine',     harmonics: 1, snr: null },
  { name: 'voice',    harmonics: 8, snr: null },   // eight harmonics, amplitude 1/h, random phases
  { name: 'voice20',  harmonics: 8, snr: 20 },
  { name: 'voice10',  harmonics: 8, snr: 10 },
];

function frame(f, harmonics, snr) {
  const b = new Float32Array(N);
  const ph = Array.from({ length: harmonics }, () => rnd() * 2 * Math.PI);
  let power = 0;
  for (let i = 0; i < N; i++) {
    let s = 0;
    for (let h = 1; h <= harmonics && h * f < SR / 2; h++) s += Math.sin(2 * Math.PI * h * f * i / SR + ph[h - 1]) / h;
    b[i] = 0.3 * s; power += b[i] * b[i];
  }
  if (snr !== null) {
    const sd = Math.sqrt(power / N / 10 ** (snr / 10));
    for (let i = 0; i < N; i++) b[i] += sd * gauss();
  }
  return b;
}

const rows = ['condition,true_hz,frame,detected_hz,error_cents'];
const summary = {};
for (const c of CONDITIONS) {
  const errs = [];
  for (let k = 0; k < STEPS; k++) {
    const f = 65 * 2 ** (k / 24);
    for (let r = 0; r < FRAMES; r++) {
      const hz = detectPitch(frame(f, c.harmonics, c.snr), SR);
      const e = hz > 0 ? 1200 * Math.log2(hz / f) : NaN;
      errs.push({ f, e });
      rows.push(`${c.name},${f.toFixed(2)},${r},${hz > 0 ? hz.toFixed(3) : ''},${isNaN(e) ? '' : e.toFixed(4)}`);
    }
  }
  const share = (t) => +(100 * errs.filter((x) => Math.abs(x.e) <= t).length / errs.length).toFixed(1);
  const med = (a) => { const s = a.slice().sort((p, q) => p - q); return s.length ? +s[s.length >> 1].toFixed(1) : null; };
  const abs = (sel) => errs.filter((x) => sel(x.f) && !isNaN(x.e)).map((x) => Math.abs(x.e));
  const low = errs.filter((x) => x.f < 70 && !isNaN(x.e)).map((x) => x.e);
  summary[c.name] = {
    within10: share(10), within50: share(50), within150: share(150),
    medianAbs: med(abs(() => true)), p95Abs: (() => { const s = abs(() => true).sort((p, q) => p - q); return +s[Math.floor(s.length * 0.95)].toFixed(1); })(),
    medianAbs65to130: med(abs((f) => f < 130)), medianAbsAbove520: med(abs((f) => f > 520)),
    meanSignedBelow70: +(low.reduce((a, b) => a + b, 0) / low.length).toFixed(1),
    missedOrOver100c: errs.filter((x) => !(Math.abs(x.e) <= 100)).map((x) => +x.f.toFixed(0)),
  };
}
writeFileSync(new URL('./results.csv', import.meta.url), rows.join('\n') + '\n');
console.log(JSON.stringify(summary, null, 2));
