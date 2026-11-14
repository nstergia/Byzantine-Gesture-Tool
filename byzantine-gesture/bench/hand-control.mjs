// Negative-control benchmark for the hand-contour score (Section 3 of the paper).
//
// Does the score tell a hand that follows the teacher from one that does not?
// Synthetic 2.5 s windows are built exactly as shapeWindow() in src/index.html builds them:
// 28 student samples (one every 90 ms), each paired with the teacher's guide value, both
// medians removed, then Pearson r and MAD. Windows where both hands are still are skipped,
// as in the application. Each window is graded with the current rule (lib/core.mjs, 1.1.0)
// and with the rule of versions 1.0.0-1.0.3, for comparison.
//
// Teacher movement: a sum of three sinusoids (0.2-1.0 Hz, random phase and weight),
// scaled to a standard deviation of 0.3, 0.6 or 1.0 scale degrees within the window.
// Student conditions:
//   follows          same contour, 150 ms late, tracking noise SD 0.08 degrees
//   follows-wider    as above, 2.4 times wider (as in the example of Section 3.1)
//   still            hand held still: tracking jitter only (SD 0.03 degrees)
//   unrelated        an independent contour of the same size
//   opposite         the teacher's contour upside down, 150 ms late, noise SD 0.08
//
// Usage: node bench/hand-control.mjs > bench/hand-control.json
// Deterministic (fixed seed); 2,000 windows per cell.

import { handBand, HAND_STILL_SD, medianArr, pearsonArr, stdArr, meanArr } from '../lib/core.mjs';

const N_WIN = 2000, N_PTS = 28, DT = 0.09, LAG = 0.15;
let seed = 20261027;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const gauss = () => Math.sqrt(-2 * Math.log(rnd() || 1e-12)) * Math.cos(2 * Math.PI * rnd());

const components = () => [0, 1, 2].map(() => ({ f: 0.2 + 0.8 * rnd(), p: 2 * Math.PI * rnd(), a: rnd() }));
function contour(comp, shift) {           // unit-SD contour sampled over the window
  const xs = [];
  for (let i = 0; i < N_PTS; i++) {
    const t = i * DT - shift;
    xs.push(comp.reduce((s, c) => s + c.a * Math.sin(2 * Math.PI * c.f * t + c.p), 0));
  }
  const m = meanArr(xs), s = stdArr(xs, m) || 1;
  return xs.map((x) => (x - m) / s);
}

// The rule of versions 1.0.0-1.0.3, kept here only for the comparison.
function legacyBand(r, mad) {
  if (r != null && r < 0) return 2;
  if ((r != null && r >= 0.60 && mad < 0.8) || mad < 0.45) return 0;
  if ((r != null && r >= 0.35) || mad < 1.1) return 1;
  return 2;
}

const conditions = {
  'follows':       (c, sd) => contour(c, LAG).map((x) => x * sd + 0.08 * gauss()),
  'follows-wider': (c, sd) => contour(c, LAG).map((x) => 2.4 * x * sd + 0.08 * gauss()),
  'still':         ()      => Array.from({ length: N_PTS }, () => 0.03 * gauss()),
  'unrelated':     (c, sd) => contour(components(), 0).map((x) => x * sd),
  'opposite':      (c, sd) => contour(c, LAG).map((x) => -x * sd + 0.08 * gauss()),
};

const pct = (k, n) => Math.round(1000 * k / n) / 10;
const out = { settings: { windows: N_WIN, points: N_PTS, stepS: DT, lagS: LAG, stillSD: HAND_STILL_SD }, results: [] };

for (const sdT of [0.3, 0.6, 1.0]) {
  for (const [name, make] of Object.entries(conditions)) {
    const now = [0, 0, 0], old = [0, 0, 0];
    let n = 0, skipped = 0;
    for (let w = 0; w < N_WIN; w++) {
      const comp = components();
      const t = contour(comp, 0).map((x) => x * sdT);
      const s = make(comp, sdT);
      const stdT = stdArr(t, meanArr(t)), stdS = stdArr(s, meanArr(s));
      if (stdT < HAND_STILL_SD && stdS < HAND_STILL_SD) { skipped++; continue; }
      const mt = medianArr(t), ms = medianArr(s);
      const tp = t.map((x) => x - mt), sp = s.map((x) => x - ms);
      const mad = tp.reduce((a, x, i) => a + Math.abs(x - sp[i]), 0) / N_PTS;
      const r = pearsonArr(tp, sp);
      const studentStill = stdS < HAND_STILL_SD && stdT >= HAND_STILL_SD;
      now[handBand(r, mad, studentStill)]++;
      old[legacyBand(r, mad)]++;
      n++;
    }
    out.results.push({
      teacherSD: sdT, student: name, scored: n, skippedStill: skipped,
      current: { exact: pct(now[0], n), close: pct(now[1], n), off: pct(now[2], n) },
      v1_0:    { exact: pct(old[0], n), close: pct(old[1], n), off: pct(old[2], n) },
    });
  }
}
console.log(JSON.stringify(out, null, 2));
