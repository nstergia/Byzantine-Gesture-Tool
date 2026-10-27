/**
 * core.mjs — Pure, side-effect-free algorithms extracted from src/index.html
 * (Byzantine Gesture alignment & evaluation tool).
 *
 * These functions are the testable scientific core of the application:
 *   - YIN fundamental-frequency (pitch) detection
 *   - Byzantine scale (Ni–Pa–Vou–Ga–Di–Ke–Zo, 72-moria division) note quantisation
 *   - Cent-difference computation with octave folding
 *   - Hand-gesture classification from MediaPipe 21-landmark models
 *   - Time-series helpers (guide curves, Pearson shape correlation)
 *
 * Ported 1:1 from the inline <script> of index.html so that the tests
 * exercise exactly the code that runs in the browser.
 */

/* ── Byzantine scale: Chrysanthine diatonic, 12-10-8-12-12-10-8 moria (72 per octave) ── */
export const BYZ = ['Νη', 'Πα', 'Βου', 'Γα', 'Δι', 'Κε', 'Ζω', 'Νη΄', 'Πα΄'];
export const N = BYZ.length;
export const BYZ_MORIA = [0, 12, 22, 30, 42, 54, 64, 72, 84];
export const BYZ_CENTS = BYZ_MORIA.map((m) => m * 1200 / 72);
export const BYZ_RATIO = BYZ_CENTS.map((c) => 2 ** (c / 1200));

/* ── audio ── */
export function bufRms(buf) {
  let s = 0;
  for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
  return Math.sqrt(s / buf.length);
}

/**
 * YIN pitch detector (de Cheveigné & Kawahara, 2002), as implemented
 * in the browser app. Returns the fundamental frequency in Hz, or -1
 * when no reliable periodicity is found (silence / noise).
 */
export function detectPitch(buf, sampleRate) {
  const SIZE = buf.length;
  const rms = bufRms(buf);
  if (rms < 0.003) return -1;
  const MIN_F = 65, MAX_F = 1000;
  const minLag = Math.max(2, Math.floor(sampleRate / MAX_F));
  const maxLag = Math.min(Math.floor(sampleRate / MIN_F), Math.floor(SIZE / 2) - 2);
  const yin = new Float32Array(maxLag + 1);
  yin[0] = 1;
  let running = 0;
  const half = Math.floor(SIZE / 2);
  for (let tau = 1; tau <= maxLag; tau++) {
    let sum = 0;
    for (let j = 0; j < half; j++) { const d = buf[j] - buf[j + tau]; sum += d * d; }
    running += sum;
    yin[tau] = running ? sum * tau / running : 1;
  }
  let tauEst = -1;
  for (let t = minLag; t < maxLag; t++) {
    if (yin[t] < 0.20 && yin[t] < yin[t - 1] && yin[t] <= yin[t + 1]) { tauEst = t; break; }
  }
  if (tauEst < 0) {
    let best = 1, bestTau = -1;
    for (let t = minLag; t < maxLag; t++) if (yin[t] < best) { best = yin[t]; bestTau = t; }
    if (best < 0.45) tauEst = bestTau;
  }
  if (tauEst < 0) return -1;
  const x0 = tauEst > 0 ? tauEst - 1 : tauEst;
  const x2 = tauEst + 1 <= maxLag ? tauEst + 1 : tauEst;
  const s0 = yin[x0], s1 = yin[tauEst], s2 = yin[x2];
  let better = tauEst;
  const den = s0 - 2 * s1 + s2;               // parabolic interpolation around the dip
  if (den !== 0) better = tauEst + (s0 - s2) / (2 * den);
  if (better < 1) return -1;
  const hz = sampleRate / better;
  return (hz < MIN_F || hz > MAX_F) ? -1 : hz;
}

/** Map a frequency to the nearest Byzantine scale degree (0..N-1). */
export function hzToVoiceNote(hz, tonicHz) {
  if (hz <= 0 || !tonicHz) return -1;
  let best = 0, bestC = 1e9;
  for (let i = 0; i < N; i++) {
    const cents = 1200 * Math.log2(hz / (tonicHz * BYZ_RATIO[i]));
    if (Math.abs(cents) < bestC) { bestC = Math.abs(cents); best = i; }
  }
  return best;
}

export function centsDiff(a, b) {
  if (a <= 0 || b <= 0) return null;
  return 1200 * Math.log2(a / b);
}

/** Signed cent difference folded into ±400 cents (nearest octave/pitch class). */
export function foldedCents(sHz, tHz) {
  const c = centsDiff(sHz, tHz);
  if (c == null) return null;
  let best = c, ab = Math.abs(c);
  const alts = [c - 1200, c + 1200, c - 2400, c + 2400];
  for (const a of alts) {
    if (Math.abs(a) < ab) { best = a; ab = Math.abs(a); }
  }
  return best;
}

/* ── hand-height → scale-degree mapping ── */
export function yToNoteF(y) {
  const c = Math.max(0.04, Math.min(0.96, y));
  return (1 - (c - 0.04) / 0.92) * (N - 1);
}
export function yToNote(y) { return Math.round(yToNoteF(y)); }

/* ── left-hand transport gestures (MediaPipe 21 landmarks) ──
 * Same rules as classifyGesture() in src/index.html (checked by tests/mirror.test.mjs):
 * fist = play, open palm = freeze, V sign = replay, raised index = slow. */
export function classifyGesture(lm) {
  const up = (tip, pip) => lm[tip].y < lm[pip].y - 0.012;
  const ext = (tip) => Math.hypot(lm[tip].x - lm[0].x, lm[tip].y - lm[0].y);
  const iUp = up(8, 6), mUp = up(12, 10), rUp = up(16, 14), pUp = up(20, 18);
  const upN = [iUp, mUp, rUp, pUp].filter(Boolean).length;
  const iExt = ext(8) > 0.15, mExt = ext(12) > 0.15, rExt = ext(16) > 0.13, pExt = ext(20) > 0.12;
  const tTip = lm[4], tBase = lm[2];
  const thumbOut = Math.abs(tTip.x - tBase.x) > 0.04;
  if (upN === 0 && !iExt && !mExt && !rExt && !pExt) return 'play';
  if (upN >= 3 && iExt && mExt && rExt && thumbOut) return 'freeze';
  if (iUp && mUp && iExt && mExt && !rUp && !pUp) return 'replay';
  if (iUp && iExt && !mUp && !rUp && !pUp && lm[8].y < lm[12].y - 0.02) return 'slow';
  return null;
}

/* ── statistics / shape correlation ── */
export function medianArr(xs) {
  if (!xs.length) return 0;
  const a = xs.slice().sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : 0.5 * (a[m - 1] + a[m]);
}
export function meanArr(xs) {
  if (!xs.length) return 0;
  let s = 0; for (const x of xs) s += x;
  return s / xs.length;
}
export function stdArr(xs, mu) {
  if (xs.length < 2) return 0;
  let s = 0; for (const x of xs) s += (x - mu) * (x - mu);
  return Math.sqrt(s / xs.length);
}
export function pearsonArr(a, b) {
  if (a.length < 3) return null;
  const ma = meanArr(a), mb = meanArr(b), n = a.length;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    const xa = a[i] - ma, xb = b[i] - mb;
    num += xa * xb; da += xa * xa; db += xb * xb;
  }
  if (da < 1e-8 || db < 1e-8) return null;
  return num / Math.sqrt(da * db);
}

/* ── guide curves (recorded teacher reference, 25 Hz slots) ── */
export function upsertGuide(arr, t, val) {
  if (val == null || val < 0 || !isFinite(t)) return;
  const slot = Math.round(t * 25) / 25;
  let i = arr.length - 1;
  while (i >= 0 && arr[i].t > slot + 0.001) i--;
  if (i >= 0 && Math.abs(arr[i].t - slot) < 0.021) { arr[i].v = val; arr[i].t = slot; return; }
  arr.splice(i + 1, 0, { t: slot, v: val });
}
export function lookupGuide(arr, t) {
  if (!arr.length || !isFinite(t)) return -1;
  if (t <= arr[0].t) return arr[0].v;
  const last = arr[arr.length - 1];
  if (t >= last.t) return last.v;
  for (let i = 1; i < arr.length; i++) {
    if (arr[i].t >= t) {
      const a = arr[i - 1], b = arr[i], span = b.t - a.t;
      if (span <= 0) return b.v;
      return a.v + (b.v - a.v) * ((t - a.t) / span);
    }
  }
  return last.v;
}

/* ── alignment ── */
/** offset = student_time − teacher_time, rounded to 10 ms. */
export function computeOffset(markT, markS) {
  return Math.round((markS - markT) * 100) / 100;
}

/* ── formatting ── */
export function fmt(t) {
  if (!isFinite(t) || t < 0) t = 0;
  const m = Math.floor(t / 60), s = t - m * 60;
  return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1);
}

/* ── Session evaluation (scoring bands, summaries, timeline) ──
   The same logic is mirrored, in ES5, between the BEGIN/END_SCORING_MIRROR
   markers of src/index.html; tests/mirror.test.mjs checks that both agree. */
export const VOICE_EXACT_C = 50;
export const VOICE_CLOSE_C = 150;
export const BAND_NAMES = ['exact', 'close', 'off'];

/** 0 = exact, 1 = close, 2 = off, for a window of the hand contour. */
export function handBand(r, mad) {
  if (r != null && r < 0) return 2;
  if ((r != null && r >= 0.60 && mad < 0.8) || mad < 0.45) return 0;
  if ((r != null && r >= 0.35) || mad < 1.1) return 1;
  return 2;
}
/** 0 = exact, 1 = close, 2 = off, for an absolute pitch difference in cents. */
export function voiceBand(absCents, exactC, closeC) {
  return absCents <= exactC ? 0 : (absCents <= closeC ? 1 : 2);
}
export function medianOf(a) {
  if (!a.length) return null;
  const s = a.slice().sort((x, y) => x - y), m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
export function newSessionLog() {
  return { hand: [], voice: [], handStill: 0, tVoiced: 0, syncSkipHand: 0, syncSkipVoice: 0, t0: null };
}
export function summarizeHand(log) {
  const n = log.hand.length, c = [0, 0, 0];
  let sr = 0, nr = 0, sm = 0;
  for (let i = 0; i < n; i++) {
    const h = log.hand[i];
    c[handBand(h.r, h.mad)]++; sm += h.mad;
    if (h.r != null) { sr += h.r; nr++; }
  }
  return { n, exact: c[0], close: c[1], off: c[2], meanR: nr ? sr / nr : null,
           meanMad: n ? sm / n : null, stillSkipped: log.handStill, syncSkipped: log.syncSkipHand };
}
export function summarizeVoice(log, exactC, closeC) {
  const n = log.voice.length, c = [0, 0, 0], cents = [];
  let sa = 0, ss = 0;
  for (let i = 0; i < n; i++) {
    const v = log.voice[i];
    c[voiceBand(Math.abs(v.c), exactC, closeC)]++; sa += Math.abs(v.c); ss += v.c; cents.push(v.c);
  }
  const med = medianOf(cents);
  let after = 0;
  for (let i = 0; i < n; i++) if (Math.abs(log.voice[i].c - med) <= exactC) after++;
  const cov = log.tVoiced > 0 ? Math.min(1, n / log.tVoiced) : null;
  return { n, exact: c[0], close: c[1], off: c[2], meanAbs: n ? sa / n : null,
           meanSigned: n ? ss / n : null, medianSigned: med, exactAfterOffset: n ? after : 0,
           coverage: cov, syncSkipped: log.syncSkipVoice };
}
/** Colour band per time bin: -1 = nothing evaluated; ties go to the worse band. */
export function binTimeline(recs, bandOf, tMax, nBins) {
  const counts = [];
  for (let i = 0; i < nBins; i++) counts.push([0, 0, 0]);
  if (!(tMax > 0)) tMax = 1;
  for (let i = 0; i < recs.length; i++) {
    let k = Math.floor(recs[i].t / tMax * nBins);
    if (k < 0) continue;
    if (k >= nBins) k = nBins - 1;
    counts[k][bandOf(recs[i])]++;
  }
  return counts.map((cc) => {
    if (cc[0] + cc[1] + cc[2] === 0) return -1;
    let best = 0;
    if (cc[1] >= cc[best]) best = 1;
    if (cc[2] >= cc[best]) best = 2;
    return best;
  });
}
