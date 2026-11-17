// Sensitivity of the hand-contour rule to its thresholds (Table 4 of the paper).
//
// Synthetic windows built as in bench/hand-control.mjs (same generator and seed; without the
// 'follows-wider' case, so the individual windows differ). Each threshold of the
// rule is moved one step down and one step up while the others keep their defaults, and the share
// of windows in the exact band is reported for a hand that follows the teacher, an unrelated hand,
// a still hand and a hand moving the opposite way. A useful rule keeps "follows" high and the
// others low under every variant.
//   exact:  (r >= R_EXACT and MAD < MAD_EXACT) or (r >= R_MIN and MAD < MAD_TIGHT)
//   close:  r >= R_MIN;  off otherwise, and when only the student's hand is still
// Usage: node bench/hand-sensitivity.mjs > bench/hand-sensitivity.json   (deterministic)

import { HAND_STILL_SD, medianArr, pearsonArr, stdArr, meanArr } from '../lib/core.mjs';

const N_WIN = 2000, N_PTS = 28, DT = 0.09, LAG = 0.15;
const DEF = { R_EXACT: 0.60, R_MIN: 0.35, MAD_EXACT: 0.8, MAD_TIGHT: 0.45 };
const STEP = { R_EXACT: 0.05, R_MIN: 0.05, MAD_EXACT: 0.1, MAD_TIGHT: 0.05 };

function band(r, mad, still, P) {
  if (still) return 2;
  if (r == null || r < P.R_MIN) return 2;
  if ((r >= P.R_EXACT && mad < P.MAD_EXACT) || mad < P.MAD_TIGHT) return 0;
  return 1;
}

// windows, generated once with the generator of bench/hand-control.mjs
let seed = 20261027;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const gauss = () => Math.sqrt(-2 * Math.log(rnd() || 1e-12)) * Math.cos(2 * Math.PI * rnd());
const components = () => [0, 1, 2].map(() => ({ f: 0.2 + 0.8 * rnd(), p: 2 * Math.PI * rnd(), a: rnd() }));
function contour(comp, shift) {
  const xs = [];
  for (let i = 0; i < N_PTS; i++) { const t = i * DT - shift; xs.push(comp.reduce((s, c) => s + c.a * Math.sin(2 * Math.PI * c.f * t + c.p), 0)); }
  const m = meanArr(xs), s = stdArr(xs, m) || 1;
  return xs.map((x) => (x - m) / s);
}
const conditions = {
  follows:   (c, sd) => contour(c, LAG).map((x) => x * sd + 0.08 * gauss()),
  unrelated: (c, sd) => contour(components(), 0).map((x) => x * sd),
  still:     ()      => Array.from({ length: N_PTS }, () => 0.03 * gauss()),
  opposite:  (c, sd) => contour(c, LAG).map((x) => -x * sd + 0.08 * gauss()),
};
const windows = [];
for (const sdT of [0.3, 0.6, 1.0]) for (const [name, make] of Object.entries(conditions)) for (let w = 0; w < N_WIN; w++) {
  const comp = components(), t = contour(comp, 0).map((x) => x * sdT), s = make(comp, sdT);
  const stdT = stdArr(t, meanArr(t)), stdS = stdArr(s, meanArr(s));
  if (stdT < HAND_STILL_SD && stdS < HAND_STILL_SD) continue;
  const mt = medianArr(t), ms = medianArr(s), tp = t.map((x) => x - mt), sp = s.map((x) => x - ms);
  windows.push({ sdT, name, r: pearsonArr(tp, sp), mad: tp.reduce((a, x, i) => a + Math.abs(x - sp[i]), 0) / N_PTS,
                 still: stdS < HAND_STILL_SD && stdT >= HAND_STILL_SD });
}

const variants = [['default', DEF]];
for (const k of Object.keys(DEF)) for (const d of [-1, 1]) {
  const P = { ...DEF, [k]: +(DEF[k] + d * STEP[k]).toFixed(2) };
  variants.push([`${k} ${P[k]}`, P]);
}
const out = { settings: { windows: N_WIN, defaults: DEF, step: STEP }, results: [] };
for (const [label, P] of variants) {
  const row = { variant: label };
  for (const name of Object.keys(conditions)) {
    const ws = windows.filter((w) => w.name === name);
    const ex = ws.filter((w) => band(w.r, w.mad, w.still, P) === 0).length;
    row[name] = Math.round(1000 * ex / ws.length) / 10;
  }
  out.results.push(row);
}
console.log(JSON.stringify(out, null, 2));
