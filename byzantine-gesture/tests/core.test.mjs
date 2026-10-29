import { pose, place } from './hand-poses.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BYZ, N, BYZ_RATIO, BYZ_MORIA, BYZ_CENTS,
  handBand, voiceBand, emaStep, HAND_EMA_TAU, medianOf, newSessionLog, summarizeHand, summarizeVoice, binTimeline,
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
test('hzToVoiceNote: a voice an octave above or below is named with the same degree', () => {
  const ni = 110;                                   // male teacher's Ni
  for (let deg = 0; deg < N; deg++) {
    const teacher = ni * BYZ_RATIO[deg];
    assert.equal(hzToVoiceNote(teacher * 2, ni, teacher), deg, `woman an octave up, ${BYZ[deg]}`);
    assert.equal(hzToVoiceNote(teacher * 4, ni, teacher), deg, `child two octaves up, ${BYZ[deg]}`);
    assert.equal(hzToVoiceNote(teacher / 2, ni, teacher), deg, `man an octave below, ${BYZ[deg]}`);
  }
  // a wrong note stays wrong: Ga sung an octave up while the teacher sings Di
  assert.equal(hzToVoiceNote(ni * BYZ_RATIO[3] * 2, ni, ni * BYZ_RATIO[4]), 3);
});
test('hzToVoiceNote without a reference: a voice outside Ni..Pa′ is moved by octaves into the scale', () => {
  const ni = 110;
  assert.equal(hzToVoiceNote(ni * BYZ_RATIO[4] * 2, ni), 4);   // Di an octave up → Di
  assert.equal(hzToVoiceNote(ni * BYZ_RATIO[5] / 2, ni), 5);   // Ke an octave down → Ke
  assert.equal(hzToVoiceNote(ni * 2, ni), 7);                  // Ni an octave up is Ni′, inside the scale
  for (let deg = 0; deg < N; deg++) assert.equal(hzToVoiceNote(ni * BYZ_RATIO[deg], ni), deg); // unchanged in range
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
const EXPECT = { palm: 'freeze', 'palm-thumbin': 'freeze', fist: 'play', v: 'replay', index: 'slow', ok: null };
test('gestures are recognised at any distance from the camera (70-280 px hand, ±30°, noisy)', () => {
  let seed = 5; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (const [name, want] of Object.entries(EXPECT))
    for (const px of [70, 100, 140, 200, 280])
      for (let k = 0; k < 40; k++) {
        const lm = place(pose(name), px, (rnd() - 0.5) * 60, 0.04, rnd);
        assert.equal(classifyGesture(lm, 960 / 540), want, `${name} at ${px}px`);
      }
});
test('open palm does not need a spread thumb; an OK sign is not a command', () => {
  const rnd = () => 0.5;
  assert.equal(classifyGesture(place(pose('palm-thumbin'), 120, 0, 0, rnd), 960 / 540), 'freeze');
  assert.equal(classifyGesture(place(pose('ok'), 120, 0, 0, rnd), 960 / 540), null);
});
test('a degenerate hand (all landmarks on one point) is not a command', () => {
  const lm = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.8, z: 0 }));
  assert.equal(classifyGesture(lm), null);
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
test('handBand follows the documented rules (1.1.0)', () => {
  assert.equal(handBand(0.9, 0.2), 0);    // exact: r >= 0.35 and MAD < 0.45
  assert.equal(handBand(0.4, 0.3), 0);
  assert.equal(handBand(0.7, 0.7), 0);    // exact: r >= 0.60 and MAD < 0.8
  assert.equal(handBand(0.5, 0.7), 1);    // close: r >= 0.35
  assert.equal(handBand(0.4, 2.0), 1);
  assert.equal(handBand(0.2, 0.1), 2);    // r < 0.35 is off, however small the MAD
  assert.equal(handBand(0.2, 1.0), 2);
  assert.equal(handBand(-0.1, 0.1), 2);   // anti-correlated: off
  assert.equal(handBand(null, 0.3), 0);   // r undefined (a hand exactly flat): MAD alone decides
  assert.equal(handBand(null, 0.9), 1);
  assert.equal(handBand(null, 1.4), 2);
});
test('handBand: a still student hand while the teacher moves is off, whatever r and MAD', () => {
  assert.equal(handBand(0.9, 0.1, true), 2);
  assert.equal(handBand(null, 0.1, true), 2);
  assert.equal(handBand(0.9, 0.1, false), 0);
});
test('summarizeHand counts still-student windows as off', () => {
  const log = newSessionLog();
  log.hand.push({ t: 0, r: 0.9, mad: 0.1, sStill: true }, { t: 1, r: 0.9, mad: 0.1 });
  const h = summarizeHand(log);
  assert.equal(h.exact, 1); assert.equal(h.off, 1);
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

test('emaStep: one 90 ms step has the former weight of 0.32', () => {
  assert.ok(Math.abs(emaStep(0, 1, 0.09) - 0.32) < 1e-12);
  assert.ok(Math.abs(HAND_EMA_TAU - 0.2334) < 1e-3);
});
test('emaStep depends on elapsed time, not on the number of frames', () => {
  const one = emaStep(2, 5, 0.18);                       // a dropped frame: one 180 ms step
  const two = emaStep(emaStep(2, 5, 0.09), 5, 0.09);     // two 90 ms steps
  assert.ok(Math.abs(one - two) < 1e-12);
});
test('emaStep restarts after a backward jump, a gap over 0.5 s, or with no previous value', () => {
  assert.equal(emaStep(2, 5, -0.3), 5);
  assert.equal(emaStep(2, 5, 0.8), 5);
  assert.equal(emaStep(-1, 5, 0.09), 5);
  assert.equal(emaStep(null, 5, 0.09), 5);
  assert.ok(Math.abs(emaStep(2, 5, 0) - (2 + 0.32 * 3)) < 1e-12);   // clock not advancing
});
