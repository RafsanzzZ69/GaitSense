import test from 'node:test';
import assert from 'node:assert/strict';
import { createDepartureBoundary } from '../src/navigation/departure-boundary.ts';
import { fixture, user } from './helpers/auth-controller-harness.mjs';
import { capture, flush, recordedPreview } from './helpers/capture-harness.mjs';

function setup(sessions = []) {
  const calls = [];
  const f = fixture({ signOut: async () => { calls.push('signout'); f.emit(null); } }); f.controller.start(); f.emit(user('A'));
  const boundary = createDepartureBoundary(() => f.controller.getSnapshot().session.status === 'SIGNED_IN');
  const h = capture(boundary, sessions);
  return { ...f, boundary, h, calls, signOut: () => f.controller.requestSignOut(boundary) };
}
test('idle mounted workspace sign-out settles with no data/media deletion', async () => {
  const f = setup(); assert.equal(f.h.canLeave(), true); assert.equal((await f.signOut()).ok, true);
  assert.deepEqual(f.calls, ['signout']); assert.deepEqual(f.h.destroyed, []); assert.deepEqual(f.h.discarded, []); f.h.unmount();
});
test('countdown sign-out waits for existing Cancel countdown and its timer settlement', async () => {
  const f = setup(); const original = globalThis.setTimeout; let timer;
  try {
    globalThis.setTimeout = fn => { timer = fn; return 0; };
    f.h.press('Record 15-second video'); const operation = f.signOut(); await flush();
    assert.deepEqual(f.calls, []); assert.equal(f.controller.getSnapshot().session.status, 'SIGNED_IN'); assert.equal(f.boundary.isPending(), true);
    f.h.render(); f.h.press('Cancel countdown'); assert.deepEqual(f.calls, []);
    timer(); await flush(); f.h.render(); assert.equal((await operation).ok, true); assert.deepEqual(f.calls, ['signout']);
    assert.deepEqual(f.h.destroyed, []); assert.deepEqual(f.h.discarded, []);
  } finally { globalThis.setTimeout = original; f.h.unmount(); }
});
test('active recording survives sign-out request, Stop, preview, then explicit discard', async () => {
  const f = setup(); const original = globalThis.setTimeout;
  try {
    globalThis.setTimeout = fn => { queueMicrotask(fn); return 0; };
    f.h.press('Record 15-second video'); await flush(); f.h.render(); const operation = f.signOut();
    assert.equal(f.boundary.mustRetain(), true); assert.equal(f.boundary.canStart(), false); assert.deepEqual(f.calls, []);
    f.h.press('Stop recording'); f.h.resolveClip(); await flush(); f.h.render(); assert.deepEqual(f.calls, []);
    f.h.press('Discard video / retake'); await flush(); f.h.render(); assert.equal((await operation).ok, true);
    assert.deepEqual(f.calls, ['signout']); assert.equal(f.h.discarded.length, 1); assert.deepEqual(f.h.destroyed, []);
  } finally { globalThis.setTimeout = original; f.h.unmount(); }
});
test('preview remains recoverable until existing discard completes', async () => {
  const f = setup(); await recordedPreview(f.h); const operation = f.signOut(); await flush();
  assert.deepEqual(f.calls, []); assert.equal(f.boundary.mustRetain(), true);
  f.h.press('Discard video / retake'); await flush(); f.h.render(); assert.equal((await operation).ok, true); f.h.unmount();
});
test('processing remains mounted through its existing result/failure cleanup before sign-out', async () => {
  const f = setup(); await recordedPreview(f.h); f.h.press('Extract landmarks on this phone'); f.h.render(); const operation = f.signOut();
  await flush(); assert.deepEqual(f.calls, []); assert.equal(f.controller.getSnapshot().session.status, 'SIGNED_IN');
  f.h.resolveProcessing(); await flush(); f.h.render(); assert.equal((await operation).ok, true);
  assert.deepEqual(f.calls, ['signout']); assert.deepEqual(f.h.destroyed, []); f.h.unmount();
});
test('successful native save/readback survives pending sign-out in the same local History', async () => {
  const sessions = []; const f = setup(sessions); await recordedPreview(f.h); let resolveFrames;
  f.h.readFrames(() => new Promise(resolve => { resolveFrames = resolve; }));
  f.h.press('Extract landmarks on this phone'); f.h.render(); const operation = f.signOut();
  const saved = { id: 'saved-during-signout', createdAt: 1, durationMs: 12000, sampledFrames: 120, poseFrames: 100,
    usableFrameRatio: .8, landmarkCount: 33, view: 'side_left', rawVideoRetained: false, modelSha256: 'a'.repeat(64),
    extractorVersion: 'test', consentVersion: 'local-prototype-notice-v1', timestampMethod: 'requested-100ms-nearest-decoded-frame' };
  sessions.push(saved); // Native process completion returns an already-persisted session.
  f.h.resolveProcessing(JSON.stringify(saved)); await flush(); f.h.render(); assert.deepEqual(f.calls, []);
  assert.equal(f.boundary.mustRetain(), true); resolveFrames('[]'); await flush(); f.h.render();
  assert.equal((await operation).ok, true); assert.deepEqual(f.h.destroyed, []); assert.equal(f.h.hasSession(saved.id), true);
  assert.deepEqual(sessions, [saved]); f.h.unmount(); assert.deepEqual(sessions, [saved]);
});
test('cleanup failure keeps pending request and recovery until retry succeeds', async () => {
  const f = setup(); await recordedPreview(f.h); f.h.failCleanup(true);
  f.h.press('Extract landmarks on this phone'); f.h.render(); const operation = f.signOut(); f.h.resolveProcessing(); await flush(); f.h.render();
  assert.equal(f.boundary.mustRetain(), true); assert.deepEqual(f.calls, []); assert.equal(f.controller.getSnapshot().session.status, 'SIGNED_IN');
  f.h.press('Discard video / retake'); await flush(); f.h.render(); assert.deepEqual(f.calls, []);
  f.h.failCleanup(false); f.h.press('Discard video / retake'); await flush(); f.h.render(); assert.equal((await operation).ok, true);
  assert.deepEqual(f.calls, ['signout']); assert.deepEqual(f.h.destroyed, []); f.h.unmount();
});
test('pending request blocks stale Record handler synchronously and repeated requests cannot duplicate SDK calls', async () => {
  const f = setup(); const operation = f.signOut(); f.h.press('Record 15-second video');
  assert.equal(f.h.canLeave(), true); assert.equal((await f.signOut()).ok, false);
  assert.equal((await operation).ok, true); f.h.render(); assert.equal(f.h.control('Record 15-second video').disabled, true);
  f.boundary.changed(); f.boundary.changed(); assert.deepEqual(f.calls, ['signout']); f.h.unmount();
});
test('generic departure leases stay blocking until released and release is idempotent', async () => {
  const b = createDepartureBoundary(() => true); let safe = false; b.register(() => safe);
  const first = b.requestDeparture(); const second = b.requestDeparture(); assert.equal(b.canStart(), false);
  first.release(); assert.equal(await first.ready, false); first.release(); assert.equal(b.isPending(), true);
  safe = true; b.changed(); assert.equal(await second.ready, true); assert.equal(b.canStart(), false);
  second.release(); assert.equal(b.canStart(), true); assert.equal(b.isPending(), false);
});
