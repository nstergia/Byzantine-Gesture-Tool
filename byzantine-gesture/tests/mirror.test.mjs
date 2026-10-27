// The browser app keeps an ES5 copy of the scoring helpers between two markers.
// These tests extract that copy and check that it behaves exactly like lib/core.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as core from '../lib/core.mjs';

const html = readFileSync(new URL('../src/index.html', import.meta.url), 'utf8');
const m = html.match(/\/\* BEGIN_SCORING_MIRROR[\s\S]*?\*\/([\s\S]*?)\/\* END_SCORING_MIRROR \*\//);
assert.ok(m, 'scoring mirror markers not found in src/index.html');
const app = new Function(m[1] + '; return {BAND_NAMES, handBand, voiceBand, medianOf, newSessionLog, summarizeHand, summarizeVoice, binTimeline};')();

test('app copy: band names are the same', () => {
  assert.deepEqual(app.BAND_NAMES, core.BAND_NAMES);
});
test('app copy: handBand agrees with the core on a dense grid', () => {
  for (let r = -1; r <= 1.0001; r += 0.05)
    for (let mad = 0; mad <= 2.5; mad += 0.05)
      assert.equal(app.handBand(r, mad), core.handBand(r, mad), `r=${r} mad=${mad}`);
  for (let mad = 0; mad <= 2.5; mad += 0.05) assert.equal(app.handBand(null, mad), core.handBand(null, mad));
});
test('app copy: voiceBand agrees with the core', () => {
  for (const limits of [[50, 150], [70, 150], [30, 100]])
    for (let c = 0; c <= 400; c += 1.5)
      assert.equal(app.voiceBand(c, limits[0], limits[1]), core.voiceBand(c, limits[0], limits[1]));
});
test('app copy: summaries and timeline agree with the core on a random log', () => {
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const a = app.newSessionLog(), b = core.newSessionLog();
  for (let i = 0; i < 300; i++) {
    const hv = { t: i * 0.11, r: rnd() < 0.1 ? null : rnd() * 2 - 0.6, mad: rnd() * 2 };
    const vv = { t: i * 0.11, c: (rnd() - 0.5) * 360 };
    a.hand.push(hv); b.hand.push({ ...hv });
    if (rnd() < 0.8) { a.voice.push(vv); b.voice.push({ ...vv }); }
  }
  a.tVoiced = b.tVoiced = 350; a.handStill = b.handStill = 4; a.syncSkipVoice = b.syncSkipVoice = 2;
  assert.deepEqual(app.summarizeHand(a), core.summarizeHand(b));
  assert.deepEqual(app.summarizeVoice(a, 50, 150), core.summarizeVoice(b, 50, 150));
  const bandA = (r) => app.voiceBand(Math.abs(r.c), 50, 150), bandB = (r) => core.voiceBand(Math.abs(r.c), 50, 150);
  assert.deepEqual(app.binTimeline(a.voice, bandA, 33, 120), core.binTimeline(b.voice, bandB, 33, 120));
});

// The pitch detector and the gesture classifier live outside the scoring mirror,
// so they are extracted by name and compared with the core as well.
function extractFn(name) {
  const start = html.indexOf('function ' + name + '(');
  assert.ok(start >= 0, name + ' not found in src/index.html');
  let depth = 0, i = html.indexOf('{', start);
  for (; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}' && --depth === 0) break;
  }
  return html.slice(start, i + 1);
}
const appPitch = new Function(extractFn('bufRms') + extractFn('detectPitch') + '; return detectPitch;')();
const appGesture = new Function(extractFn('classifyGesture') + '; return classifyGesture;')();

test('app copy: detectPitch agrees with the core from 65 to 990 Hz', () => {
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let k = 0; k < 96; k++) {
    const f = 65 * 2 ** (k / 24), b = new Float32Array(4096);
    for (let i = 0; i < 4096; i++) {
      let s = 0;
      for (let h = 1; h <= 8 && h * f < 24000; h++) s += Math.sin(2 * Math.PI * h * f * i / 48000) / h;
      b[i] = 0.3 * s + 0.02 * (rnd() - 0.5);
    }
    assert.equal(appPitch(b, 48000), core.detectPitch(b, 48000), `f=${f}`);
  }
});
test('app copy: classifyGesture agrees with the core on random hands', () => {
  let seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let n = 0; n < 2000; n++) {
    const spread = n % 4 === 0 ? 0.12 : 0.6; // every fourth hand is compact, like a fist
    const lm = Array.from({ length: 21 }, () => ({ x: 0.5 + spread * (rnd() - 0.5), y: 0.8 - spread * rnd(), z: 0 }));
    lm[0] = { x: 0.5, y: 0.8, z: 0 };
    assert.equal(appGesture(lm), core.classifyGesture(lm));
  }
});
