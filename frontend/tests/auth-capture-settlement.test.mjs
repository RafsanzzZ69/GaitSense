import test from 'node:test';
import assert from 'node:assert/strict';
import { createDepartureBoundary } from '../src/navigation/departure-boundary.ts';
import { capture, flush, recordedPreview } from './helpers/capture-harness.mjs';

function fixture() {
  let allowed = true, changes = 0;
  const boundary = createDepartureBoundary(() => allowed);
  boundary.subscribe(() => { changes++; });
  const h = capture(boundary);
  return { h, boundary, loseAuth: () => { allowed = false; }, get changes() { return changes; } };
}
test('idle departure is safe without deleting or clearing saved data', () => {
  const f = fixture(); f.loseAuth(); assert.equal(f.boundary.mustRetain(), false); assert.deepEqual(f.h.discarded, []);
  assert.deepEqual(f.h.destroyed, []); f.h.unmount(); assert.deepEqual(f.h.destroyed, []);
});
test('pending departure blocks a stale enabled record handler before React rerenders', () => {
  const f = fixture(); f.loseAuth(); f.h.press('Record 15-second video');
  assert.equal(f.h.canLeave(), true); f.h.render(); assert.equal(f.h.control('Record 15-second video').disabled, true); f.h.unmount();
});
test('countdown is retained until its existing cancellation completes', async () => {
  const f = fixture(); const original = globalThis.setTimeout; let timer;
  try {
    globalThis.setTimeout = fn => { timer = fn; return 0; };
    f.h.press('Record 15-second video'); f.loseAuth();
    assert.equal(f.boundary.mustRetain(), true); f.h.render(); f.h.press('Cancel countdown');
    assert.equal(f.boundary.mustRetain(), true); timer(); await flush(); f.h.render();
    assert.equal(f.boundary.mustRetain(), false); assert.ok(f.changes > 1); assert.deepEqual(f.h.discarded, []);
  } finally { globalThis.setTimeout = original; f.h.unmount(); }
});
test('active recording and retained preview survive departure until explicit discard', async () => {
  const f = fixture(); const original = globalThis.setTimeout;
  try {
    globalThis.setTimeout = fn => { queueMicrotask(fn); return 0; };
    f.h.press('Record 15-second video'); await flush(); f.h.render(); f.loseAuth();
    assert.equal(f.boundary.mustRetain(), true); f.h.press('Stop recording');
    assert.equal(f.boundary.mustRetain(), true); f.h.resolveClip(); await flush(); f.h.render();
    assert.equal(f.boundary.mustRetain(), true); assert.deepEqual(f.h.discarded, []);
    f.h.press('Discard video / retake'); await flush(); f.h.render(); assert.equal(f.boundary.mustRetain(), false);
  } finally { globalThis.setTimeout = original; f.h.unmount(); }
});
test('existing processing settles without an auth-driven cancel/unmount', async () => {
  const f = fixture(); await recordedPreview(f.h); f.h.press('Extract landmarks on this phone'); f.h.render();
  const retentionNotifications = [];
  f.boundary.subscribe(() => retentionNotifications.push(f.boundary.mustRetain()));
  f.loseAuth(); assert.equal(f.boundary.mustRetain(), true); assert.deepEqual(f.h.discarded, []);
  f.h.resolveProcessing(); await flush(); f.h.render(); assert.equal(f.boundary.mustRetain(), false);
  assert.equal(retentionNotifications.at(-1), false); assert.deepEqual(f.h.destroyed, []); f.h.unmount();
});
test('retained cleanup failure stays recoverable and blocks redirect until discard succeeds', async () => {
  const f = fixture(); await recordedPreview(f.h); f.h.failCleanup(true);
  f.h.press('Extract landmarks on this phone'); f.h.render(); f.loseAuth(); f.h.resolveProcessing(); await flush(); f.h.render();
  assert.equal(f.boundary.mustRetain(), true); assert.equal(f.h.idle(), false);
  f.h.failCleanup(false); f.h.press('Discard video / retake'); await flush(); f.h.render();
  assert.equal(f.boundary.mustRetain(), false); assert.equal(f.boundary.canStart(), false); f.h.unmount();
});
test('successful-save/readback transition remains retained until existing cleanup finishes', async () => {
  const f = fixture(); await recordedPreview(f.h); let resolveFrames;
  f.h.readFrames(() => new Promise(resolve => { resolveFrames = resolve; }));
  f.h.press('Extract landmarks on this phone'); f.h.render(); f.loseAuth();
  f.h.resolveProcessing(JSON.stringify({ id: 'synthetic', createdAt: 1, durationMs: 12000, sampledFrames: 120, poseFrames: 100,
    usableFrameRatio: .8, landmarkCount: 33, view: 'side_left', rawVideoRetained: false, modelSha256: 'a'.repeat(64),
    extractorVersion: 'test', consentVersion: 'local-prototype-notice-v1', timestampMethod: 'requested-100ms-nearest-decoded-frame' }));
  await flush(); f.h.render(); assert.equal(f.boundary.mustRetain(), true); assert.deepEqual(f.h.discarded, []);
  resolveFrames('[]'); await flush(); f.h.render(); assert.equal(f.boundary.mustRetain(), false); f.h.unmount();
});
test('settlement refuses a second simultaneous measurement owner and unregisters once', () => {
  const b = createDepartureBoundary(() => true); const release = b.register(() => false);
  assert.throws(() => b.register(() => true), /already owns/); release(); release(); assert.equal(b.mustRetain(), false);
});
test('boundary observes same-tick locks and leaves data services outside its contract', () => {
  const b = createDepartureBoundary(() => false); let locked = false; b.register(() => !locked);
  assert.equal(b.mustRetain(), false); locked = true; assert.equal(b.mustRetain(), true);
  assert.deepEqual(Object.keys(b).sort(), ['canStart', 'changed', 'getSnapshot', 'isPending', 'mustRetain', 'register', 'requestDeparture', 'subscribe']);
});
