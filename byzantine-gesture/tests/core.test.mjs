import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BYZ, N, BYZ_RATIO, BYZ_MORIA, BYZ_CENTS,
  handBand, voiceBand, medianOf, newSessionLog, summarizeHand, summarizeVoice, binTimeline,
  bufRms, detectPitch, hzToVoiceNote, centsDiff, foldedCents,
  yToNoteF, yToNote, classifyGesture,
  medianArr, meanArr, stdArr, pearsonArr,
  upsertGuide, lookupGuide, computeOffset, fmt,
} from '../lib/core.mjs';

/* ── helpers ── */
function sine(freq, sr, n, amp = 0.5) {
  const buf = new Float32Array(n);
  for (let i = 0; i < n; i++) buf[i] = amp * Math.sin(2 * Math.PI * freq * i / sr);
  return buf;
}
function silence(n) { return new Float32Array(n); }
function landmarks(fingers) {
  // fingers: {tipIdx, pipIdx, tip:[x,y], pip:[x,y]} — wrist defaults to (0.5, 0.8)
  const lm = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.8, z: 0 }));
  for (const f of fingers) {
    lm[f.tipIdx]  = { x: f.tip[0],  y: f.tip[1],  z: 0 };
    lm[f.pipIdx]  = { x: f.pip[0],  y: f.pip[1],  z: 0 };
  }
  return lm;
}
const TIPS = { i: [8, 6], m: [12, 10], r: [16, 14], p: [20, 18] };

/* ── pitch detection (YIN) ── */
test('detectPitch finds a 220 Hz sine at 44.1 kHz', () => {
  const hz = detectPitch(sine(220, 44100, 4096), 44100);
  assert.ok(Math.abs(hz - 220) < 3, `expected ~220 Hz, got ${hz}`);
});
test('detectPitch finds a low male fundamental (110 Hz)', () => {
  const hz = detectPitch(sine(110, 44100, 4096), 44100);
  assert.ok(Math.abs(hz - 110) < 3, `expected ~110 Hz, got ${hz}`);
});
test('detectPitch reaches the top of the search range (960, 980, 995 and 1,000 Hz at 48 kHz)', () => {
  for (const f of [960, 980, 995, 1000]) {
    const hz = detectPitch(sine(f, 48000, 4096), 48000);
    assert.ok(Math.abs(1200 * Math.log2(hz / f)) < 10, `${f} Hz read as ${hz}`);
  }
});
test('detectPitch reaches the bottom of the search range (65 Hz at 44.1 and 48 kHz)', () => {
  for (const sr of [44100, 48000])
    for (const f of [65, 65.5, 67]) {
      const hz = detectPitch(sine(f, sr, 4096), sr);
      assert.ok(hz > 0 && Math.abs(1200 * Math.log2(hz / f)) < 10, `${f} Hz at ${sr} read as ${hz}`);
    }
});
test('detectPitch returns -1 for silence', () => {
  assert.equal(detectPitch(silence(4096), 44100), -1);
});
test('detectPitch returns -1 for noise (no periodicity)', () => {
  const buf = new Float32Array(4096);
  let seed = 42;
  for (let i = 0; i < buf.length; i++) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; buf[i] = (seed / 0x7fffffff - 0.5) * 0.5; }
  assert.equal(detectPitch(buf, 44100), -1);
});

/* ── Byzantine scale mapping ── */
test('hzToVoiceNote maps scale tones onto the right degrees', () => {
  const ni = 130.81; // C3 as Ni
  for (let deg = 0; deg < N; deg++) {
    const ratio = BYZ_RATIO[deg];
    assert.equal(hzToVoiceNote(ni * ratio, ni), deg, `ratio ${ratio} should be degree ${deg} (${BYZ[deg]})`);
  }
});
test('hzToVoiceNote rejects non-positive input and missing tonic', () => {
  assert.equal(hzToVoiceNote(-5, 130), -1);
  assert.equal(hzToVoiceNote(220, 0), -1);
});

/* ── cents / octave folding ── */
test('centsDiff: one octave = 1200 cents', () => {
  assert.ok(Math.abs(centsDiff(440, 220) - 1200) < 1e-6);
});
test('foldedCents folds an octave to zero', () => {
  assert.ok(Math.abs(foldedCents(440, 220)) < 1e-6);
});
test('foldedCents folds downward octaves', () => {
  assert.ok(Math.abs(foldedCents(220, 440) - 0) < 1e-6);
  assert.ok(Math.abs(foldedCents(233.08, 220) - centsDiff(233.08, 220)) < 1e-6);
});

/* ── hand height → scale degree ── */
test('yToNoteF clamps to the 4%..96% band', () => {
  assert.equal(yToNote(0), N - 1);   // top of frame = highest degree
  assert.equal(yToNote(1), 0);       // bottom = Ni
  assert.ok(yToNoteF(0.5) > 0 && yToNoteF(0.5) < N - 1);
});

/* ── gesture classification ── */
test('open palm with extended fingers = freeze', () => {
  const lm = landmarks([
    { tipIdx: 4,  pipIdx: 2,  tip: [0.28, 0.30], pip: [0.44, 0.38] },  // thumb far from index tip → not OK-sign
    { tipIdx: 8,  pipIdx: 6,  tip: [0.44, 0.20], pip: [0.46, 0.35] },
    { tipIdx: 12, pipIdx: 10, tip: [0.50, 0.18], pip: [0.50, 0.33] },
    { tipIdx: 16, pipIdx: 14, tip: [0.58, 0.20], pip: [0.56, 0.35] },
    { tipIdx: 20, pipIdx: 18, tip: [0.64, 0.25], pip: [0.62, 0.40] },
  ]);
  assert.equal(classifyGesture(lm), 'freeze');
});
test('fist = play', () => {
  const lm = landmarks([]);
  assert.equal(classifyGesture(lm), 'play');
});
test('index + middle up (V sign) = replay', () => {
  const lm = landmarks([
    { tipIdx: 8,  pipIdx: 6,  tip: [0.44, 0.20], pip: [0.46, 0.35] },
    { tipIdx: 12, pipIdx: 10, tip: [0.50, 0.18], pip: [0.50, 0.33] },
  ]);
  assert.equal(classifyGesture(lm), 'replay');
});
test('index only, clearly above knuckle = slow', () => {
  const lm = landmarks([
    { tipIdx: 8, pipIdx: 6, tip: [0.44, 0.20], pip: [0.46, 0.35] },
    { tipIdx: 5, pipIdx: 5, tip: [0.45, 0.55], pip: [0.45, 0.55] }, // lm[5] reference
  ]);
  assert.equal(classifyGesture(lm), 'slow');
});
test('OK sign is not a command', () => {
  const lm = landmarks([
    { tipIdx: 4,  pipIdx: 2,  tip: [0.52, 0.32], pip: [0.50, 0.45] },
    { tipIdx: 8,  pipIdx: 6,  tip: [0.50, 0.30], pip: [0.50, 0.45] },
    { tipIdx: 12, pipIdx: 10, tip: [0.55, 0.28], pip: [0.55, 0.43] },
    { tipIdx: 16, pipIdx: 14, tip: [0.60, 0.30], pip: [0.60, 0.45] },
    { tipIdx: 20, pipIdx: 18, tip: [0.64, 0.35], pip: [0.62, 0.48] },
  ]);
  assert.equal(classifyGesture(lm), null);
});
test('ambiguous pose returns null', () => {
  const lm = landmarks([
    { tipIdx: 8, pipIdx: 6, tip: [0.44, 0.20], pip: [0.46, 0.35] }, // only index, but not far enough from knuckle line
  ]);
  // index up but tip barely above MCP(5): y 0.20 vs 0.8-0.05 → slow needs lm[8].y < lm[5].y-0.05, holds (0.20<0.75)
  // however ext(8) = dist((0.44,0.20),(0.5,0.8)) ≈ 0.60 > 0.22 → iExt true; but lm[5] is wrist-ish (0.5,0.8) → slow
  assert.equal(classifyGesture(lm), 'slow');
});

/* ── statistics ── */
test('pearsonArr: identical series r = 1, inverted r = -1', () => {
  const a = [1, 2, 3, 4, 5, 6];
  assert.ok(Math.abs(pearsonArr(a, a) - 1) < 1e-9);
  assert.ok(Math.abs(pearsonArr(a, a.slice().reverse()) + 1) < 1e-9);
});
test('pearsonArr returns null for constant series', () => {
  assert.equal(pearsonArr([2, 2, 2, 2], [1, 2, 3, 4]), null);
  assert.equal(pearsonArr([1, 2], [1, 2]), null); // too short
});
test('medianArr / meanArr / stdArr behave sanely', () => {
  assert.equal(medianArr([3, 1, 2]), 2);
  assert.equal(medianArr([4, 1, 3, 2]), 2.5);
  assert.equal(meanArr([2, 4]), 3);
  assert.ok(Math.abs(stdArr([2, 4], 3) - 1) < 1e-9);
});

/* ── guide curves ── */
test('upsertGuide deduplicates same slot and keeps order', () => {
  const arr = [];
  upsertGuide(arr, 1.000, 3);
  upsertGuide(arr, 1.010, 5);   // same 25 Hz slot → overwrite
  upsertGuide(arr, 2.000, 7);
  assert.equal(arr.length, 2);
  assert.equal(arr[0].v, 5);
  assert.equal(arr[1].t, 2);
});
test('lookupGuide interpolates linearly between slots', () => {
  const arr = [];
  upsertGuide(arr, 1.0, 0);
  upsertGuide(arr, 1.2, 4);
  assert.equal(lookupGuide(arr, 0.5), 0);      // before first → first
  assert.equal(lookupGuide(arr, 2.0), 4);      // after last → last
  assert.ok(Math.abs(lookupGuide(arr, 1.1) - 2) < 1e-6);
});

/* ── alignment & formatting ── */
test('computeOffset = student − teacher, rounded to 10 ms', () => {
  assert.equal(computeOffset(10.0, 12.345), 2.35);
  assert.equal(computeOffset(12.345, 10.0), -2.35);
  assert.equal(computeOffset(5, 5), 0);
});
test('fmt renders m:ss.d', () => {
  assert.equal(fmt(0), '0:00.0');
  assert.equal(fmt(65.54), '1:05.5');
  assert.equal(fmt(-3), '0:00.0');
});

/* ── Chrysanthine 72-moria scale ── */
test('scale has the 12-10-8-12-12-10-8 moria pattern and 72 moria per octave', () => {
  const steps = BYZ_MORIA.slice(1).map((m, i) => m - BYZ_MORIA[i]);
  assert.deepEqual(steps, [12, 10, 8, 12, 12, 10, 8, 12]);
  assert.equal(BYZ_MORIA[7], 72);
  assert.ok(Math.abs(BYZ_CENTS[7] - 1200) < 1e-9);
});
test('Ni-Pa is 200 cents and Ni-Vou is about 367 cents', () => {
  assert.ok(Math.abs(BYZ_CENTS[1] - 200) < 1e-9);
  assert.ok(Math.abs(BYZ_CENTS[2] - 366.667) < 0.01);
});
test('a voice 30 cents sharp of Vou is still assigned to Vou', () => {
  const ni = 130.81;
  assert.equal(hzToVoiceNote(ni * BYZ_RATIO[2] * 2 ** (30 / 1200), ni), 2);
});

/* ── Scoring bands and session summaries ── */
test('handBand follows the documented rules, and r < 0 is always off', () => {
  assert.equal(handBand(0.9, 0.2), 0);    // exact: MAD < 0.45
  assert.equal(handBand(0.7, 0.7), 0);    // exact: r >= 0.60 and MAD < 0.8
  assert.equal(handBand(0.5, 0.7), 1);    // close: r >= 0.35
  assert.equal(handBand(0.2, 1.0), 1);    // close: MAD < 1.1
  assert.equal(handBand(0.2, 1.5), 2);    // off
  assert.equal(handBand(-0.1, 0.1), 2);   // r < 0 is always off, even with a tiny MAD
  assert.equal(handBand(null, 0.3), 0);   // no correlation: MAD alone decides
  assert.equal(handBand(null, 0.9), 1);
  assert.equal(handBand(null, 1.4), 2);
});
test('voiceBand uses the exact and close limits in cents', () => {
  assert.equal(voiceBand(0, 50, 150), 0);
  assert.equal(voiceBand(50, 50, 150), 0);
  assert.equal(voiceBand(50.1, 50, 150), 1);
  assert.equal(voiceBand(150, 50, 150), 1);
  assert.equal(voiceBand(150.1, 50, 150), 2);
  assert.equal(voiceBand(60, 70, 150), 0);   // the limit is a parameter
});
test('medianOf handles odd, even and empty arrays', () => {
  assert.equal(medianOf([]), null);
  assert.equal(medianOf([3, 1, 2]), 2);
  assert.equal(medianOf([4, 1, 3, 2]), 2.5);
});
test('summarizeVoice reports bands, signed bias, coverage and offset-corrected exact', () => {
  const log = newSessionLog();
  for (let i = 0; i < 9; i++) log.voice.push({ t: i, c: -40 });   // constantly 40 cents flat
  log.voice.push({ t: 9, c: -200 });                                // plus one 200-cent miss
  log.tVoiced = 20;
  const v = summarizeVoice(log, 50, 150);
  assert.equal(v.n, 10);
  assert.equal(v.exact, 9); assert.equal(v.close, 0); assert.equal(v.off, 1);
  assert.ok(Math.abs(v.meanSigned - (-56)) < 1e-9);
  assert.ok(Math.abs(v.meanAbs - 56) < 1e-9);
  assert.equal(v.medianSigned, -40);
  assert.equal(v.exactAfterOffset, 9);       // after removing -40: nine frames at 0, one at -160
  assert.equal(v.coverage, 0.5);             // 10 evaluated of 20 teacher-voiced ticks
});
test('a constant offset beyond the exact limit is exact only after offset removal', () => {
  const log = newSessionLog();
  for (let i = 0; i < 10; i++) log.voice.push({ t: i, c: 80 + (i % 2) * 4 });
  log.tVoiced = 10;
  const v = summarizeVoice(log, 50, 150);
  assert.equal(v.exact, 0); assert.equal(v.close, 10);
  assert.equal(v.exactAfterOffset, 10);
});
test('summaries are safe on empty logs', () => {
  const log = newSessionLog();
  const v = summarizeVoice(log, 50, 150), h = summarizeHand(log);
  assert.equal(v.n, 0); assert.equal(v.meanAbs, null); assert.equal(v.coverage, null); assert.equal(v.exactAfterOffset, 0);
  assert.equal(h.n, 0); assert.equal(h.meanR, null); assert.equal(h.meanMad, null);
});
test('summarizeHand counts bands, means and skipped windows', () => {
  const log = newSessionLog();
  log.hand.push({ t: 0, r: 0.9, mad: 0.2 }, { t: 1, r: 0.5, mad: 0.9 }, { t: 2, r: -0.2, mad: 0.3 }, { t: 3, r: null, mad: 2 });
  log.handStill = 5; log.syncSkipHand = 3;
  const h = summarizeHand(log);
  assert.equal(h.n, 4); assert.equal(h.exact, 1); assert.equal(h.close, 1); assert.equal(h.off, 2);
  assert.ok(Math.abs(h.meanR - (0.9 + 0.5 - 0.2) / 3) < 1e-9);
  assert.ok(Math.abs(h.meanMad - (0.2 + 0.9 + 0.3 + 2) / 4) < 1e-9);
  assert.equal(h.stillSkipped, 5); assert.equal(h.syncSkipped, 3);
});
test('binTimeline marks empty bins, takes the majority and gives ties to the worse band', () => {
  const recs = [
    { t: 0.1, b: 0 }, { t: 0.2, b: 0 }, { t: 0.3, b: 2 },     // bin 0: majority exact
    { t: 1.1, b: 0 }, { t: 1.2, b: 2 },                         // bin 1: tie -> off
    { t: 3.9, b: 1 }, { t: 4.0, b: 1 },                         // last bin (t == tMax is clamped)
  ];
  assert.deepEqual(binTimeline(recs, (r) => r.b, 4, 4), [0, 2, -1, 1]);
});
