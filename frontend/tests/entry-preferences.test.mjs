import test from 'node:test';
import assert from 'node:assert/strict';
import { createEntryPreferences, parseEntryVersions, entryReady, ENTRY_PREFERENCES_KEY } from '../src/entry/entry-preferences.ts';
import { deferred, fixture, user, load } from './helpers/auth-controller-harness.mjs';
import { createDepartureBoundary } from '../src/navigation/departure-boundary.ts';
const { appEntry } = load('src/entry/app-entry.ts');
const completed = { acknowledgementVersion: 1, onboardingVersion: 1 };
function store(raw = null, overrides = {}) {
  const calls = [], values = new Map(raw === null ? [] : [[ENTRY_PREFERENCES_KEY, raw]]);
  const storage = { async getItem(key) { calls.push(['read', key]); return values.get(key) ?? null; },
    async setItem(key, value) { calls.push(['write', key, value]); values.set(key, value); }, ...overrides };
  const controller = createEntryPreferences(storage);
  return { storage, controller, calls, values };
}

test('auth restoration takes precedence over both complete and unresolved local preferences', () => {
  for (const status of ['RESTORING', 'READY', 'ERROR']) assert.equal(appEntry('RESTORING', { status, versions: completed }), 'AUTH_RESTORING');
});
test('signed-out startup uses authentication regardless of local completion or failure', () => {
  for (const status of ['RESTORING', 'READY', 'ERROR']) assert.equal(appEntry('SIGNED_OUT', { status, versions: completed }), 'SIGNED_OUT');
});
test('local restoration never admits Home before asynchronous storage resolves', async () => {
  const read = deferred(), f = store(null, { getItem: () => read.promise }); const restoring = f.controller.start();
  assert.equal(appEntry('SIGNED_IN', f.controller.getSnapshot()), 'PREFERENCES_RESTORING');
  read.resolve(JSON.stringify(completed)); await restoring;
  assert.equal(appEntry('SIGNED_IN', f.controller.getSnapshot()), 'APP_READY');
});
test('missing record requires acknowledgement and onboarding cannot bypass it', async () => {
  const f = store(); await f.controller.start();
  assert.equal(appEntry('SIGNED_IN', f.controller.getSnapshot()), 'ACK_REQUIRED');
  assert.equal(await f.controller.completeOnboarding(), false); assert.equal(f.calls.length, 1);
});
test('acknowledgement requires explicit true action before any persistence write', async () => {
  const f = store(); await f.controller.start(); assert.equal(await f.controller.acknowledge(false), false);
  assert.equal(f.calls.length, 1); assert.equal(f.controller.getSnapshot().versions.acknowledgementVersion, 0);
});
test('acknowledgement is published only after successful durable write', async () => {
  const write = deferred(), f = store(null, { setItem: () => write.promise }); await f.controller.start();
  const pending = f.controller.acknowledge(true);
  assert.equal(f.controller.getSnapshot().busy, true); assert.equal(appEntry('SIGNED_IN', f.controller.getSnapshot()), 'ACK_REQUIRED');
  write.resolve(); assert.equal(await pending, true);
  assert.equal(appEntry('SIGNED_IN', f.controller.getSnapshot()), 'ONBOARDING_REQUIRED');
});
test('write rejection preserves incomplete acknowledgement and permits bounded retry', async () => {
  let failing = true; const f = store(null, { async setItem() { if (failing) throw Error('internal fixture'); } }); await f.controller.start();
  assert.equal(await f.controller.acknowledge(true), false); assert.equal(f.controller.getSnapshot().busy, false);
  assert.match(f.controller.getSnapshot().message, /could not be saved/); assert.equal(appEntry('SIGNED_IN', f.controller.getSnapshot()), 'ACK_REQUIRED');
  failing = false; assert.equal(await f.controller.acknowledge(true), true); assert.equal(f.controller.getSnapshot().message, '');
});
test('completed onboarding is published only after persistence resolves', async () => {
  const write = deferred(), f = store(JSON.stringify({ acknowledgementVersion: 1, onboardingVersion: 0 }), { setItem: () => write.promise }); await f.controller.start();
  const pending = f.controller.completeOnboarding(); assert.equal(entryReady(f.controller.getSnapshot()), false);
  write.resolve(); assert.equal(await pending, true); assert.equal(entryReady(f.controller.getSnapshot()), true);
});
test('onboarding write failure keeps required gate and accepted acknowledgement', async () => {
  const f = store(JSON.stringify({ acknowledgementVersion: 1 }), { async setItem() { throw Error('fixture'); } }); await f.controller.start();
  assert.equal(await f.controller.completeOnboarding(), false); assert.equal(appEntry('SIGNED_IN', f.controller.getSnapshot()), 'ONBOARDING_REQUIRED');
  assert.deepEqual(f.controller.getSnapshot().versions, { acknowledgementVersion: 1, onboardingVersion: 0 });
});
test('both version numbers survive fresh controller and simulated offline app restart', async () => {
  const f = store(); await f.controller.start(); await f.controller.acknowledge(true); await f.controller.completeOnboarding(); f.controller.stop();
  const restarted = createEntryPreferences(f.storage); await restarted.start();
  assert.equal(appEntry('SIGNED_IN', restarted.getSnapshot()), 'APP_READY'); assert.deepEqual(restarted.getSnapshot().versions, completed);
  assert.deepEqual(f.calls.map(call => call[0]), ['read', 'write', 'write', 'read']);
});
test('auth account A sign-out and account B sign-in leave device preference record unchanged', async () => {
  const f = store(JSON.stringify(completed)); await f.controller.start();
  const auth = fixture({ signOut: async () => auth.emit(null), login: async () => auth.emit(user('B')) }); auth.controller.start(); auth.emit(user('A'));
  const boundary = createDepartureBoundary(() => auth.controller.getSnapshot().session.status === 'SIGNED_IN' && entryReady(f.controller.getSnapshot()));
  await auth.controller.requestSignOut(boundary); assert.equal(appEntry(auth.controller.getSnapshot().session.status, f.controller.getSnapshot()), 'SIGNED_OUT');
  await auth.controller.run('login', 'fixture@example.test', 'synthetic-password');
  assert.equal(appEntry(auth.controller.getSnapshot().session.status, f.controller.getSnapshot()), 'APP_READY');
  assert.equal(auth.controller.getSnapshot().session.user.uid, 'B'); assert.equal(f.calls.length, 1);
});
test('outdated or missing acknowledgement is required even with completed guide', async () => {
  for (const versions of [{ onboardingVersion: 1 }, { acknowledgementVersion: 0, onboardingVersion: 1 }]) {
    const f = store(JSON.stringify(versions)); await f.controller.start(); assert.equal(appEntry('SIGNED_IN', f.controller.getSnapshot()), 'ACK_REQUIRED');
  }
});
test('outdated or missing onboarding requires guide after current acknowledgement', async () => {
  for (const versions of [{ acknowledgementVersion: 1 }, { acknowledgementVersion: 1, onboardingVersion: 0 }]) {
    const f = store(JSON.stringify(versions)); await f.controller.start(); assert.equal(appEntry('SIGNED_IN', f.controller.getSnapshot()), 'ONBOARDING_REQUIRED');
  }
});
test('matching current versions enter Home; unexpected future versions conservatively require review', async () => {
  for (const [versions, expected] of [[completed, 'APP_READY'], [{ acknowledgementVersion: 2, onboardingVersion: 2 }, 'ACK_REQUIRED']]) {
    const f = store(JSON.stringify(versions)); await f.controller.start(); assert.equal(appEntry('SIGNED_IN', f.controller.getSnapshot()), expected);
  }
});
test('preference record is exactly two nonsecret version fields and never requires identity', async () => {
  const f = store(); await f.controller.start(); await f.controller.acknowledge(true); await f.controller.completeOnboarding();
  for (const call of f.calls.filter(call => call[0] === 'write')) {
    assert.equal(call[1], ENTRY_PREFERENCES_KEY); assert.deepEqual(Object.keys(JSON.parse(call[2])), ['acknowledgementVersion', 'onboardingVersion']);
    assert.doesNotMatch(call[2], /uid|token|password|email|participant/i);
  }
});
test('parse rejects malformed/invalid versions and strips any unknown fields', () => {
  for (const raw of ['invalid', 'null', '[]', '{"acknowledgementVersion":-1}', '{"onboardingVersion":"1"}', '{"onboardingVersion":1.5}']) assert.throws(() => parseEntryVersions(raw));
  assert.deepEqual(parseEntryVersions('{"acknowledgementVersion":1,"unexpected":"ignored"}'), { acknowledgementVersion: 1, onboardingVersion: 0 });
});
test('read failure closes gate without bypass, exposes neutral retry, and recovers locally', async () => {
  let fail = true; const f = store(null, { async getItem() { if (fail) throw Error('sensitive internal fixture'); return JSON.stringify(completed); } }); await f.controller.start();
  assert.equal(appEntry('SIGNED_IN', f.controller.getSnapshot()), 'PREFERENCES_ERROR'); assert.doesNotMatch(f.controller.getSnapshot().message, /sensitive/);
  fail = false; await f.controller.retry(); assert.equal(appEntry('SIGNED_IN', f.controller.getSnapshot()), 'APP_READY');
});
test('malformed saved preference produces same bounded restoration error', async () => {
  const f = store('{'); await f.controller.start(); assert.equal(appEntry('SIGNED_IN', f.controller.getSnapshot()), 'PREFERENCES_ERROR');
});
test('rapid completion requests issue one write and cannot skip prerequisite', async () => {
  let writes = 0; const wait = deferred(), f = store(null, { setItem: () => { writes++; return wait.promise; } }); await f.controller.start();
  const pending = f.controller.acknowledge(true); assert.equal(await f.controller.acknowledge(true), false);
  assert.equal(await f.controller.completeOnboarding(), false); assert.equal(writes, 1); wait.resolve(); await pending;
});
test('stale restoration cannot overwrite retry or publish after provider unmount', async () => {
  const old = deferred(); let reads = 0; const f = store(null, { getItem: () => ++reads === 1 ? old.promise : Promise.resolve(JSON.stringify(completed)) });
  const pending = f.controller.start(); await f.controller.retry(); old.resolve(null); await pending;
  assert.equal(entryReady(f.controller.getSnapshot()), true); f.controller.stop();
});
test('stale write completion does not claim entry after provider stops', async () => {
  const write = deferred(), f = store(null, { setItem: () => write.promise }); await f.controller.start();
  const pending = f.controller.acknowledge(true); f.controller.stop(); write.resolve(); assert.equal(await pending, false);
  assert.equal(f.controller.getSnapshot().versions.acknowledgementVersion, 0);
});
test('idempotent completed record does not rewrite during re-view', async () => {
  const f = store(JSON.stringify(completed)); await f.controller.start();
  assert.equal(await f.controller.acknowledge(true), true); assert.equal(await f.controller.completeOnboarding(), true); assert.equal(f.calls.length, 1);
});
