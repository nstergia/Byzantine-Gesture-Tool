// Self-agreement benchmark for the hand-contour score (Section 3 of the paper).
//
// When the teacher's video is loaded on both sides, the two hand trackers see the same hand
// but not the same frames: each asks for a frame every 90 ms and skips one when the previous
// request has not returned. This script simulates that situation and grades the result with
// the current rule, smoothing the hand either per tracked frame (versions up to 1.1.0-pre,
// weight 0.32 per frame) or in media time (emaStep in lib/core.mjs).
//
// Hand movement: 20 synthetic contours of 120 s (sum of six sinusoids, 0.15-1.15 Hz),
// about one scale degree SD. Each tracker adds landmark noise (SD 0.02 degrees) and drops
// frames at random with the given probability. Windows are built as in shapeWindow()
// (2.5 s, medians removed, both-still windows skipped).
//
// Usage: node bench/self-agreement.mjs > bench/self-agreement.json   (deterministic)

import { handBand, emaStep, HAND_STILL_SD, medianArr, pearsonArr, stdArr, meanArr } from '../lib/core.mjs';

let seed = 4242;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const gauss = () => Math.sqrt(-2 * Math.log(rnd() || 1e-12)) * Math.cos(2 * Math.PI * rnd());

function makeContour() {
  const c = Array.from({ length: 6 }, () => ({ f: 0.15 + rnd(), p: 2 * Math.PI * rnd(), a: 0.3 + 0.7 * rnd() }));
  return (t) => 4 + 0.55 * c.reduce((s, k) => s + k.a * Math.sin(2 * Math.PI * k.f * t + k.p), 0);
}
function track(truth, drop, phase, smoothing) {
  const out = [];
  let e = -1, lastT = 0;
  for (let t = phase; t < 120; t += 0.09) {
    if (rnd() < drop) continue;
    const y = truth(t) + 0.02 * gauss();
    e = smoothing === 'time' ? emaStep(e, y, t - lastT) : (e < 0 ? y : e + 0.32 * (y - e));
    lastT = t;
    out.push({ t, v: e });
  }
  return out;
}
function lookup(arr, t) {                       // linear interpolation, as lookupGuide()
  let lo = 0, hi = arr.length - 1;
  if (t <= arr[0].t) return arr[0].v;
  if (t >= arr[hi].t) return arr[hi].v;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (arr[m].t <= t) lo = m; else hi = m; }
  const a = arr[lo], b = arr[hi];
  return a.v + (b.v - a.v) * (t - a.t) / (b.t - a.t);
}
function grade(T, S) {
  const c = [0, 0, 0];
  for (const p of S) {
    if (p.t < 3) continue;
    const ts = [], ss = [];
    for (const q of S) if (q.t >= p.t - 2.5 && q.t <= p.t + 0.05) { ts.push(lookup(T, q.t)); ss.push(q.v); }
    if (ts.length < 8) continue;
    const sT = stdArr(ts, meanArr(ts)), sS = stdArr(ss, meanArr(ss));
    if (sT < HAND_STILL_SD && sS < HAND_STILL_SD) continue;
    const mt = medianArr(ts), ms = medianArr(ss);
    const tp = ts.map((x) => x - mt), sp = ss.map((x) => x - ms);
    const mad = tp.reduce((a, x, i) => a + Math.abs(x - sp[i]), 0) / tp.length;
    c[handBand(pearsonArr(tp, sp), mad, sS < HAND_STILL_SD && sT >= HAND_STILL_SD)]++;
  }
  return c;
}

const contours = Array.from({ length: 20 }, makeContour);
const pct = (k, n) => Math.round(1000 * k / n) / 10;
const results = [];
for (const [dropT, dropS] of [[0, 0], [0.1, 0.1], [0.1, 0.35], [0.3, 0.3]]) {
  const row = { teacherDrop: dropT, studentDrop: dropS };
  for (const smoothing of ['frame', 'time']) {
    const tot = [0, 0, 0];
    for (const truth of contours) {
      const T = track(truth, dropT, 0, smoothing), S = track(truth, dropS, 0.037, smoothing);
      grade(T, S).forEach((v, i) => { tot[i] += v; });
    }
    const n = tot[0] + tot[1] + tot[2];
    row[smoothing === 'frame' ? 'perFrame' : 'mediaTime'] = { windows: n, exact: pct(tot[0], n), close: pct(tot[1], n), off: pct(tot[2], n) };
  }
  results.push(row);
}
console.log(JSON.stringify({ contours: 20, seconds: 120, results }, null, 2));
