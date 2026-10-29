// The browser app keeps an ES5 copy of the scoring helpers between two markers.
// These tests extract that copy and check that it behaves exactly like lib/core.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as core from '../lib/core.mjs';

const html = readFileSync(new URL('../src/index.html', import.meta.url), 'utf8');
const m = html.match(/\/\* BEGIN_SCORING_MIRROR[\s\S]*?\*\/([\s\S]*?)\/\* END_SCORING_MIRROR \*\//);
assert.ok(m, 'scoring mirror markers not found in src/index.html');
const app = new Function(m[1] + '; return {BAND_NAMES, handBand, emaStep, voiceBand, medianOf, newSessionLog, summarizeHand, summarizeVoice, binTimeline};')();

test('app copy: band names are the same', () => {
  assert.deepEqual(app.BAND_NAMES, core.BAND_NAMES);
});
test('app copy: handBand agrees with the core on a dense grid', () => {
  for (let r = -1; r <= 1.0001; r += 0.05)
    for (let mad = 0; mad <= 2.5; mad += 0.05)
      for (const st of [false, true])
        assert.equal(app.handBand(r, mad, st), core.handBand(r, mad, st), `r=${r} mad=${mad} still=${st}`);
  for (let mad = 0; mad <= 2.5; mad += 0.05)
    for (const st of [false, true]) assert.equal(app.handBand(null, mad, st), core.handBand(null, mad, st));
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
    const hv = { t: i * 0.11, r: rnd() < 0.1 ? null : rnd() * 2 - 0.6, mad: rnd() * 2, sStill: rnd() < 0.1 };
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

test('app copy: detectPitch agrees with the core from 65 to 1,000 Hz', () => {
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
test('app copy: classifyGesture agrees with the core on the test poses', async () => {
  const { pose, place } = await import('./hand-poses.mjs');
  let seed = 9; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (const name of ['palm', 'palm-thumbin', 'fist', 'v', 'index', 'ok'])
    for (const px of [70, 140, 280]) {
      const lm = place(pose(name), px, (rnd() - 0.5) * 60, 0.04, rnd);
      assert.equal(appGesture(lm, 960 / 540), core.classifyGesture(lm, 960 / 540), name);
    }
  assert.match(html, /classifyGesture\(leftLm, vW\/vH, gf\)/);
});
test('app copy: classifyGesture agrees with the core on random hands', () => {
  let seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let n = 0; n < 2000; n++) {
    const spread = n % 4 === 0 ? 0.12 : 0.6; // every fourth hand is compact, like a fist
    const lm = Array.from({ length: 21 }, () => ({ x: 0.5 + spread * (rnd() - 0.5), y: 0.8 - spread * rnd(), z: 0 }));
    lm[0] = { x: 0.5, y: 0.8, z: 0 };
    assert.equal(appGesture(lm), core.classifyGesture(lm));
    assert.equal(appGesture(lm, 4 / 3), core.classifyGesture(lm, 4 / 3));
  }
});

// Two properties the paper relies on, checked on the application source itself.
test('app: the page loads nothing from the network (scripts, styles, fonts, requests)', () => {
  const css = readFileSync(new URL('../vendor/fonts/fonts.css', import.meta.url), 'utf8');
  for (const [name, text] of [['src/index.html', html], ['vendor/fonts/fonts.css', css]]) {
    assert.doesNotMatch(text, /(src|href)\s*=\s*["']\s*(https?:)?\/\//i, `${name}: external src/href`);
    assert.doesNotMatch(text, /url\(\s*["']?\s*(https?:)?\/\//i, `${name}: external url()`);
    assert.doesNotMatch(text, /@import/i, `${name}: @import`);
  }
  assert.doesNotMatch(html, /\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|EventSource/, 'network API in src/index.html');
});
test('app: audio is opened at 48 kHz, the rate of the benchmark', () => {
  assert.match(html, /new AC\(\{\s*sampleRate:\s*48000\s*\}\)/);
});
test('app copy: emaStep agrees with the core, and hand smoothing uses it on both sides', () => {
  for (const prev of [-1, 0, 2.5, 7]) for (const dt of [-0.2, 0, 0.03, 0.09, 0.2, 0.49, 0.6])
    assert.equal(app.emaStep(prev, 4.2, dt), core.emaStep(prev, 4.2, dt), `prev=${prev} dt=${dt}`);
  assert.equal((html.match(/emaT=emaStep\(emaT,yf,tStamp-emaTt\)/g) || []).length, 1);
  assert.equal((html.match(/emaS=emaStep\(emaS,yf,sStamp-emaSt\)/g) || []).length, 2);
  assert.doesNotMatch(html, /\bema\(\s*ema[TS]/);
});
test('app: resuming playback in any way ends a FREEZE (the play event clears the flag)', () => {
  assert.match(html, /teacherVideo\.addEventListener\('play', function\(\)\{\s*teacherFrozen=false;/);
});

// The left-hand command logic (hold, cooldown, release) runs in the app only; it is extracted
// with stubbed globals and driven with sequences of recognised poses, one every 100 ms.
function gestureMachine() {
  const env = { now: 10000 };
  const src = extractFn('gestNeed') + extractFn('triggerGesture') + extractFn('noteLeftGesture');
  const api = new Function('env', `
    var gesturesEnabled=true, lastGestureType=null, lastGestureTime=0, COOLDOWN=900, lastSlowFire=0;
    var gestHold={type:null,n:0,miss:0}, needRelease=false, fired=[];
    var ACTIONS={freeze:function(){fired.push('freeze');}, play:function(){fired.push('play');},
                 replay:function(){fired.push('replay');}, slow:function(){fired.push('slow');}};
    function recBusy(){ return false; }
    var document={ querySelectorAll:function(){ return []; }, getElementById:function(){ return null; } };
    var Date={ now:function(){ return env.now; } };
    function setTimeout(){}
    ${src}
    return { note: noteLeftGesture, fired: fired };`)(env);
  return { fired: api.fired, run(seq) { for (const g of seq) { env.now += 100; api.note(g); } } };
}
const rep = (g, n) => Array(n).fill(g);
test('commands: fist straight into open palm gives PLAY then FREEZE', () => {
  const m = gestureMachine();
  m.run([...rep('play', 6), ...rep('freeze', 6)]);
  assert.deepEqual(m.fired, ['play', 'freeze']);
});
test('commands: a held pose runs once; one lost frame inside the hold is forgiven', () => {
  const m = gestureMachine();
  m.run(rep('freeze', 40));
  assert.deepEqual(m.fired, ['freeze']);
  const k = gestureMachine();
  k.run(['freeze', 'freeze', null, 'freeze', 'freeze']);
  assert.deepEqual(k.fired, ['freeze']);
});
test('commands: FREEZE, PLAY, FREEZE in a row all run', () => {
  const m = gestureMachine();
  m.run([...rep('freeze', 6), ...rep('play', 6), ...rep('freeze', 20)]);
  assert.deepEqual(m.fired, ['freeze', 'play', 'freeze']);
});
test('app copy: hzToVoiceNote agrees with the core, with and without a reference voice', () => {
  for (const tonic of [98, 110, 146.8, 220]) {
    const app = new Function('core', `var tonicHz=${tonic}, N=core.N, BYZ_RATIO=core.BYZ_RATIO;`
      + extractFn('hzToVoiceNote') + '; return hzToVoiceNote;')(core);
    for (let k = -30; k <= 60; k++) {
      const hz = tonic * 2 ** (k / 20);
      for (const ref of [0, tonic * 1.5, tonic * 3, tonic / 2])
        assert.equal(app(hz, ref), core.hzToVoiceNote(hz, tonic, ref), `tonic ${tonic} hz ${hz} ref ${ref}`);
    }
  }
  assert.match(html, /studentVoiceNote=hzToVoiceNote\(sh, teacherHz>0 \? teacherHz : 0\)/);
});
