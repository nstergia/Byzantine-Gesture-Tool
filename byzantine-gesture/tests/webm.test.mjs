// lib/webm.mjs: repair of WebM takes written by MediaRecorder (no duration, no seek index).
// The fixture is a 2.5 s synthetic clip (test pattern and tone) written by ffmpeg as a live WebM,
// which has the same structure as a MediaRecorder take: unknown sizes, no Duration, no Cues.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fixWebm, webmDuration, listBlocks, hasCues } from '../lib/webm.mjs';

const live = new Uint8Array(readFileSync(new URL('./fixtures/live-recording.webm', import.meta.url)));

test('webm: the fixture has no duration and no seek index, like a MediaRecorder take', () => {
  assert.equal(webmDuration(live), null);
  assert.equal(hasCues(live), false);
});
test('webm: fixWebm writes the duration and a seek index', () => {
  const out = fixWebm(live);
  const d = webmDuration(out);
  assert.ok(d > 2.4 && d < 2.7, `duration ${d}`);
  assert.ok(hasCues(out));
});
test('webm: every frame is kept, byte for byte and in order', () => {
  const a = listBlocks(live), b = listBlocks(fixWebm(live));
  assert.ok(a.length > 50);
  assert.equal(a.length, b.length);
  for (let i = 0; i < a.length; i++) {
    assert.equal(a[i].track, b[i].track); assert.equal(a[i].time, b[i].time);
    assert.deepEqual(a[i].bytes, b[i].bytes);
  }
  // independent of the parser: each frame of the output occurs, in order, in the original file
  const src = Buffer.from(live); let from = 0;
  for (const blk of b) { const at = src.indexOf(Buffer.from(blk.bytes), from); assert.ok(at >= 0); from = at + blk.bytes.length; }
});
test('webm: repairing twice changes nothing more; other data is returned unchanged', () => {
  const once = fixWebm(live), twice = fixWebm(once);
  assert.equal(webmDuration(twice), webmDuration(once));
  assert.equal(listBlocks(twice).length, listBlocks(once).length);
  const notWebm = new Uint8Array([0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70]);   // an MP4 header
  assert.equal(fixWebm(notWebm), notWebm);
});
