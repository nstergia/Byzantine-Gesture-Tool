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
