// Tests of the browser application (src/index.html) that run without a browser.
// Since 1.2.0 the page imports every numerical routine from lib/core.mjs instead of keeping a copy;
// these tests check that this stays so, and test the logic that exists only in the page.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as core from '../lib/core.mjs';

const html = readFileSync(new URL('../src/index.html', import.meta.url), 'utf8');
const mod = html.match(/<script type="module">([\s\S]*?)<\/script>/);
assert.ok(mod, 'the page script must be an ES module');
const app = mod[1];

function extractFn(name) {
  const start = app.indexOf('function ' + name + '(');
  assert.ok(start >= 0, name + ' not found in src/index.html');
  let depth = 0, i = app.indexOf('{', start);
  for (; i < app.length; i++) {
    if (app[i] === '{') depth++;
    else if (app[i] === '}' && --depth === 0) break;
  }
  return app.slice(start, i + 1);
}

/* ── single source of truth ── */
test('app: the page imports the numerical core from lib/core.mjs', () => {
  const imp = app.match(/import\s*\{([\s\S]*?)\}\s*from\s*'\.\.\/lib\/core\.mjs';/);
  assert.ok(imp, 'import from ../lib/core.mjs missing');
  const names = imp[1].split(',').map((x) => x.trim().split(/\s+as\s+/)[0]).filter(Boolean);
  for (const n of names) assert.ok(n in core, `${n} is not exported by lib/core.mjs`);
  for (const n of ['detectPitch', 'classifyGesture', 'handBand', 'voiceBand', 'emaStep', 'summarizeHand',
                   'summarizeVoice', 'binTimeline', 'foldedCents', 'yToNoteF', 'pearsonArr', 'lookupGuide'])
    assert.ok(names.includes(n), `${n} is not imported`);
});
test('app: no core routine is defined a second time in the page', () => {
  for (const n of Object.keys(core)) {
    if (n === 'hzToVoiceNote') continue;          // a one-line adapter that passes the page's tonic
    if (n === 'VOICE_EXACT_C' || n === 'VOICE_CLOSE_C') continue;   // page settings, initialised from the core defaults
    assert.doesNotMatch(app, new RegExp('function\\s+' + n + '\\s*\\('), `${n} redefined in src/index.html`);
    assert.doesNotMatch(app, new RegExp('^\\s*(var|let|const)\\s+' + n + '\\b', 'm'), `${n} redeclared in src/index.html`);
  }
});
test('app: the page script parses as an ES module', () => {
  const dir = mkdtempSync(join(tmpdir(), 'bg-'));
  const f = join(dir, 'page.mjs');
  writeFileSync(f, app);
  const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
});
test('app: the voice band limits start from the core defaults (URL parameters may override them)', () => {
  assert.match(app, /var VOICE_EXACT_C=DEFAULT_EXACT_C, VOICE_CLOSE_C=DEFAULT_CLOSE_C;/);
});
test('app: hzToVoiceNote passes the page tonic to the core rule', () => {
  for (const tonic of [98, 110, 146.8, 220]) {
    const fn = new Function('coreHzToVoiceNote', `var tonicHz=${tonic};` + extractFn('hzToVoiceNote') + '; return hzToVoiceNote;')(core.hzToVoiceNote);
    for (let k = -30; k <= 60; k++) {
      const hz = tonic * 2 ** (k / 20);
      for (const ref of [0, tonic * 1.5, tonic / 2]) assert.equal(fn(hz, ref), core.hzToVoiceNote(hz, tonic, ref));
    }
  }
  assert.match(app, /studentVoiceNote=hzToVoiceNote\(sh, teacherHz>0 \? teacherHz : 0\)/);
});

/* ── how the page uses the core ── */
test('app: gestures use the frame aspect ratio, and hand smoothing runs in video time on both sides', () => {
  assert.match(app, /classifyGesture\(leftLm, vW\/vH, gf\)/);
  assert.equal((app.match(/emaT=emaStep\(emaT,yf,tStamp-emaTt\)/g) || []).length, 1);
  assert.equal((app.match(/emaS=emaStep\(emaS,yf,sStamp-emaSt\)/g) || []).length, 2);
});
test('app: every pitch detection is timed for the performance counters', () => {
  assert.equal((app.match(/detectPitch\(/g) || []).length, 2);
  assert.equal((app.match(/perfAdd\(perf\.yin, performance\.now\(\)-p[01]\)/g) || []).length, 2);
});

/* ── properties the paper relies on ── */
test('app: the redirect pages keep URL parameters (?perf=1, ?echo=on, ?gestures=debug)', () => {
  for (const f of ['../index.html', '../../index.html']) {
    const page = readFileSync(new URL(f, import.meta.url), 'utf8');
    assert.match(page, /location\.replace\("[^"]*src\/index\.html" \+ window\.location\.search \+ window\.location\.hash\)/, f);
  }
});
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
  assert.match(app, /new AC\(\{\s*sampleRate:\s*48000\s*\}\)/);
});
test('app: resuming playback in any way ends a FREEZE (the play event clears the flag)', () => {
  assert.match(app, /teacherVideo\.addEventListener\('play', function\(\)\{\s*teacherFrozen=false;/);
});
test('app: echo cancellation is off by default and switched on only by ?echo=on', () => {
  assert.match(app, /var ECHO_ON=\/\(\^\|\[\?&\]\)echo=on\(&\|\$\)\/\.test\(location\.search\);/);
  assert.match(app, /MIC_AUDIO = \{ echoCancellation:ECHO_ON, noiseSuppression:false, autoGainControl:false/);
  assert.match(app, /function attachMicFromStream\(stream\) \{\s*ensureAudio\(\);\s*maybeHeadphoneHint\(\);/);
});

test('app: takes are recorded as WebM (real frame times) and repaired before they are stored', () => {
  const fn = new Function('window', 'MediaRecorder', extractFn('pickMime') + '; return pickMime;');
  const supportsAll = { isTypeSupported: () => true };
  const mp4Only = { isTypeSupported: (m) => m.startsWith('video/mp4') };
  assert.match(fn({ MediaRecorder: supportsAll }, supportsAll)(), /^video\/webm/);
  assert.match(fn({ MediaRecorder: mp4Only }, mp4Only)(), /^video\/mp4/);
  assert.match(app, /import \{ fixWebm \} from '\.\.\/lib\/webm\.mjs';/);
  assert.match(extractFn('finalizeTake'), /fixWebm\(new Uint8Array\(buf\)\)/);
  assert.match(extractFn('seekableFile'), /fixWebm\(new Uint8Array\(buf\)\)/);   // old takes, repaired on loading
  assert.match(app, /seekableFile\(file\)\.then\(function\(blob\)\{/);
  assert.match(extractFn('downloadTake'), /\/mp4\/i\.test\(\(tk\.blob && tk\.blob\.type\)/);
});

/* ── left-hand command logic (exists only in the page) ── */
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

test('app: with a locked guide the teacher tracker runs every 300 ms; while recording a guide, every 90 ms', () => {
  const src = extractFn('teacherGuided');
  const mk = (rec, n) => new Function(`var guideRecording=${rec}; var guideHand=[${Array.from({length:n},(_,i)=>`{t:${i*0.04},v:3}`).join(',')}];` + src + '; return teacherGuided;')();
  assert.equal(mk(false, 250)(5), true);          // locked guide, inside its span
  assert.equal(mk(false, 250)(20), false);        // beyond the guide: full rate
  assert.equal(mk(true, 250)(5), false);          // guide being recorded: full rate
  assert.equal(mk(false, 0)(5), false);           // no guide
  assert.match(app, /teacherGuided\(video\.currentTime\|\|0\) && performance\.now\(\)-teacherLastSend<TEACHER_GUIDED_MS/);
});

test('app: the evaluation card exports the session log as CSV through the core', () => {
  assert.match(app, /sessionCsv\(SL, meta\)/);
  assert.match(app, /SL\.voice\.push\(\{t:evalNow\(\), c:c, tHz:teacherHz, sHz:studentHz\}\)/);
  assert.match(app, /SL\.hand\.push\(\{t:evalNow\(\), r:r, mad:mad, sStill:sStill, tDeg:tRef, sDeg:studentNote-yBias\}\)/);
  assert.doesNotMatch(extractFn('evalExport'), /fetch|XMLHttpRequest|sendBeacon/);
});

/* ── time link with slow seeks (recorded WebM on a slow computer) ── */
function linkSim(seekDelayMs) {
  let now = 0; const timers = [];
  const setTimeout = (fn, ms) => timers.push({ at: now + ms, fn });
  const performance = { now: () => now };
  const listeners = {};
  const teacherVideo = { paused: false, playbackRate: 1, currentTime: 2.0 };
  const studentVideo = {
    paused: false, playbackRate: 1, seeking: false, _t: 0, seeks: 0,
    get currentTime() { return this._t; },
    set currentTime(v) { this.seeks++; this.seeking = true; this._target = v;
      setTimeout(() => { this._t = this._target; this.seeking = false; (listeners.seeked || []).slice().forEach((f) => f()); }, seekDelayMs); },
    addEventListener(n, f) { (listeners[n] = listeners[n] || []).push(f); },
    removeEventListener(n, f) { listeners[n] = (listeners[n] || []).filter((g) => g !== f); },
    pause() { this.paused = true; }, play() { this.paused = false; return Promise.resolve(); },
  };
  const env = { teacherVideo, studentVideo, setTimeout, performance, Math };
  const src = `var linkEnabled=true, studentMode='video', teacherLoaded=true, studentVideoLoaded=true, scrubbingS=false, scrubbingT=false,
    linkApplying=false, studentDuration=11, studentPlaying=true;
    var LINK_RESEEK_S=0.5, LINK_MIN_GAP_MS=600, linkSeekMs=150, linkLastSeekEnd=0, linkPendingForce=false;
    function studentTargetTime(){ return teacherVideo.currentTime - 1.0; }   // offset set by Lock here
    function updateSPlayBtn(){}
    ${extractFn('applyLink')}
    return applyLink;`;
  const applyLink = new Function(...Object.keys(env), src)(...Object.values(env));
  const drifts = [];
  applyLink(true);                                   // Lock here
  for (let step = 0; step < 160; step++) {           // 8 s in 50 ms steps
    now += 50;
    teacherVideo.currentTime += 0.05;
    if (!studentVideo.seeking && !studentVideo.paused) studentVideo._t += 0.05 * studentVideo.playbackRate;
    for (const t of timers.splice(0).sort((a, b) => a.at - b.at)) { if (t.at <= now) t.fn(); else timers.push(t); }
    applyLink(false);
    drifts.push(Math.abs(studentVideo.currentTime - (teacherVideo.currentTime - 1.0)));
  }
  return { seeks: studentVideo.seeks, lastSecond: drifts.slice(-20) };
}
test('time link: a slow seek (600 ms) does not start a loop of seeks, and the two players lock together', () => {
  const r = linkSim(600);
  assert.ok(r.seeks <= 4, `seeks: ${r.seeks}`);
  assert.ok(r.lastSecond.every((d) => d < 0.06), `drift in the last second: ${Math.max(...r.lastSecond).toFixed(3)} s`);
});
test('time link: with fast seeks the players stay within 60 ms', () => {
  const r = linkSim(40);
  assert.ok(r.seeks <= 3, `seeks: ${r.seeks}`);
  assert.ok(r.lastSecond.every((d) => d < 0.06));
});
