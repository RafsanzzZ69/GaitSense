import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createDepartureBoundary } from '../src/navigation/departure-boundary.ts';
import { fixture, user, deferred, load } from './helpers/auth-controller-harness.mjs';
import { screen } from './helpers/auth-screen-harness.mjs';
import { flush, capture } from './helpers/capture-harness.mjs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
function signedIn(overrides = {}) {
  const f = fixture(overrides); f.controller.start(); f.emit(user('A'));
  const boundary = createDepartureBoundary(() => f.controller.getSnapshot().session.status === 'SIGNED_IN');
  return { ...f, boundary };
}
const signOutCalls = f => f.calls.filter(call => call[0] === 'signout').length;

test('Account exposes sign-out only to SDK-established signed-in users', () => {
  assert.ok(screen('welcome', { signedIn: true }).button('Sign out'));
  for (const status of ['SIGNED_OUT', 'RESTORING', 'ERROR']) {
    assert.equal(screen('welcome', { status }).nodes.some(n => n.props?.accessibilityLabel === 'Sign out'), false);
  }
  assert.equal(screen('verification', { signedIn: true }).nodes.some(n => n.props?.accessibilityLabel === 'Sign out'), false);
});
test('confirmation accurately explains retained device-wide measurements', () => {
  const h = screen('welcome', { signedIn: true }); h.button('Sign out').onPress();
  assert.equal(h.alerts[0][0], 'Sign out of GaitSense?');
  assert.match(h.alerts[0][1], /remain here.*shared across accounts/);
  assert.deepEqual(h.alerts[0][2].map(button => button.text), ['Cancel', 'Sign out']);
});
test('Cancel changes neither auth nor navigation nor settlement', () => {
  const h = screen('welcome', { signedIn: true }); h.button('Sign out').onPress(); h.alerts[0][2][0].onPress();
  assert.deepEqual(h.operations, []); assert.deepEqual(h.navigations, []); assert.equal(h.auth.session.status, 'SIGNED_IN');
  h.alerts[0][2][1].onPress(); assert.deepEqual(h.operations, []);
});
test('dismissing confirmation also leaves session and navigation alone', () => {
  const h = screen('welcome', { signedIn: true }); h.button('Sign out').onPress(); h.alerts[0][3].onDismiss();
  h.alerts[0][2][1].onPress(); assert.deepEqual(h.operations, []); assert.deepEqual(h.navigations, []);
});
test('rapid taps and repeated confirmation issue exactly one provider-owned request', async () => {
  const pending = deferred(); const h = screen('welcome', { signedIn: true, requestSignOut: () => pending.promise });
  const button = h.button('Sign out'); button.onPress(); button.onPress(); assert.equal(h.alerts.length, 1);
  const confirm = h.alerts[0][2][1].onPress; confirm(); confirm(); button.onPress();
  assert.deepEqual(h.operations, [['signout', h.boundary]]); assert.deepEqual(h.navigations, []);
  pending.resolve({ ok: true }); await flush();
});
test('a stale confirmation cannot act on another identity', () => {
  const h = screen('welcome', { signedIn: true }); h.button('Sign out').onPress();
  h.auth.session = { status: 'SIGNED_IN', user: { uid: 'B' } }; h.alerts[0][2][1].onPress();
  assert.deepEqual(h.operations, []);
});
test('stale dialog callbacks cannot accept or cancel a later confirmation', () => {
  const h = screen('welcome', { signedIn: true }); h.button('Sign out').onPress(); const old = h.alerts[0]; old[2][0].onPress();
  h.button('Sign out').onPress(); old[3].onDismiss(); old[2][1].onPress(); assert.deepEqual(h.operations, []);
  h.alerts[1][2][1].onPress(); assert.equal(h.operations.length, 1);
});
test('unmount before confirmation prevents sign-out', () => {
  const h = screen('welcome', { signedIn: true }); h.button('Sign out').onPress(); h.unmount();
  h.alerts[0][2][1].onPress(); assert.deepEqual(h.operations, []);
});
test('provider operation survives Account unmount without stale React updates', async () => {
  const pending = deferred(); const h = screen('welcome', { signedIn: true, requestSignOut: () => pending.promise });
  h.button('Sign out').onPress(); h.alerts[0][2][1].onPress(); h.unmount(); const updates = h.updates;
  pending.resolve({ ok: false, message: 'Unable to sign out. Please try again.' }); await flush();
  assert.equal(h.updates, updates); assert.equal(h.operations.length, 1);
});
test('bounded provider error survives remount and allows retry', () => {
  const h = screen('welcome', { signedIn: true }); h.auth.signOutMessage = 'Unable to sign out. Please try again.'; h.render();
  assert.match(h.text(), /Unable to sign out/); assert.equal(h.button('Sign out').disabled, false);
});
test('account operations and local Continue are blocked while sign-out waits', () => {
  const h = screen('welcome', { signedIn: true }); h.auth.busy = 'signout'; h.render();
  assert.equal(h.button('Sign out').disabled, true); assert.equal(h.button('Continue to local app').disabled, true);
  assert.match(h.text(), /Waiting for account session removal/);
});
test('successful signOut command cannot fabricate SIGNED_OUT before native callback', async () => {
  const f = signedIn(); const result = f.controller.requestSignOut(f.boundary); await flush();
  assert.equal(signOutCalls(f), 1); assert.equal(f.controller.getSnapshot().session.status, 'SIGNED_IN');
  assert.equal(f.controller.getSnapshot().busy, 'signout'); assert.equal(f.boundary.canStart(), false);
  assert.equal((await f.controller.requestSignOut(f.boundary)).ok, false); assert.equal(signOutCalls(f), 1);
  f.emit(null); assert.equal((await result).ok, true); assert.equal(f.controller.getSnapshot().session.status, 'SIGNED_OUT');
  assert.equal(f.controller.getSnapshot().busy, null); assert.equal(f.boundary.isPending(), false); assert.equal(f.boundary.canStart(), false);
  assert.equal(f.calls.filter(call => call[0] === 'subscribe').length, 1);
});
test('idle Home departure calls signOut once and leaves no fake session state', async () => {
  const f = signedIn({ signOut: async () => { f.calls.push(['signout']); f.emit(null); } });
  assert.equal((await f.controller.requestSignOut(f.boundary)).ok, true);
  assert.equal(signOutCalls(f), 1); assert.equal(f.controller.getSnapshot().session.status, 'SIGNED_OUT');
});
test('native modular signOut uses only the existing auth instance, including offline', async () => {
  const auth = { currentUser: {} }; let count = 0;
  const sdk = new Proxy({ getAuth: () => auth, signOut: async instance => { assert.equal(instance, auth); count++; } }, {
    get(target, key) { if (key in target) return target[key]; return () => { throw Error('Unexpected network/token/SDK operation'); }; },
  });
  const { authAdapter } = load('src/auth/firebase-auth-adapter.android.ts', { '@react-native-firebase/auth': sdk });
  await authAdapter.signOut(); assert.equal(count, 1);
});
test('offline sign-out clears restored access; offline new login stays closed on SDK network failure', async () => {
  const f = signedIn({ signOut: async () => f.emit(null), login: async () => { throw { code: 'auth/network-request-failed' }; } });
  assert.equal((await f.controller.requestSignOut(f.boundary)).ok, true);
  const result = await f.controller.run('login', 'B@example.test', 'secret');
  assert.match(result.message, /internet/); assert.equal(f.controller.getSnapshot().session.status, 'SIGNED_OUT'); assert.equal(f.boundary.canStart(), false);
});
test('native failure preserves signed-in truth, returns neutral error and allows retry', async () => {
  let failure = true;
  const f = signedIn({ signOut: async () => { f.calls.push(['signout']); if (failure) throw Error('PRIVATE_TOKEN'); f.emit(null); } });
  assert.deepEqual(await f.controller.requestSignOut(f.boundary), { ok: false, message: 'Unable to sign out. Please try again.' });
  assert.equal(f.controller.getSnapshot().session.status, 'SIGNED_IN'); assert.equal(f.boundary.canStart(), true);
  assert.equal(f.controller.getSnapshot().signOutMessage, 'Unable to sign out. Please try again.');
  failure = false; assert.equal((await f.controller.requestSignOut(f.boundary)).ok, true); assert.equal(signOutCalls(f), 2);
});
test('listener null remains authoritative even when native command subsequently fails', async () => {
  const f = signedIn({ signOut: async () => { f.emit(null); throw Error('late SDK error'); } });
  await f.controller.requestSignOut(f.boundary); assert.equal(f.controller.getSnapshot().session.status, 'SIGNED_OUT');
  assert.equal(f.controller.getSnapshot().signOutMessage, undefined);
});
test('another operation latch prevents concurrent sign-out requests', async () => {
  const d = deferred(); const f = signedIn({ verify: () => d.promise }); const verify = f.controller.run('resend');
  assert.equal((await f.controller.requestSignOut(f.boundary)).ok, false); assert.equal(f.boundary.isPending(), false); assert.equal(signOutCalls(f), 0);
  d.resolve(); await verify;
});
test('signed-out sign-out request neither invokes SDK nor acquires departure', async () => {
  const f = signedIn(); f.emit(null); assert.equal((await f.controller.requestSignOut(f.boundary)).ok, false);
  assert.equal(f.boundary.isPending(), false); assert.equal(signOutCalls(f), 0);
});
test('stop before safe settlement cancels pending SDK work', async () => {
  const f = signedIn(); f.boundary.register(() => false); const operation = f.controller.requestSignOut(f.boundary); f.controller.stop();
  assert.equal((await operation).ok, false); assert.equal(signOutCalls(f), 0); assert.equal(f.boundary.isPending(), false);
});
test('stale native completion cannot overwrite restarted provider or clear its operation', async () => {
  const d = deferred(); const f = signedIn({ signOut: () => d.promise }); const operation = f.controller.requestSignOut(f.boundary); await flush();
  f.controller.stop(); f.controller.start(); f.emit(user('B')); const verify = f.controller.run('resend');
  d.resolve(); assert.equal((await operation).ok, false); await verify;
  assert.equal(f.controller.getSnapshot().session.user.uid, 'B'); assert.equal(f.boundary.isPending(), false);
});
test('stopping while awaiting SDK listener releases its wait without leaking a departure', async () => {
  const f = signedIn(); const operation = f.controller.requestSignOut(f.boundary); await flush(); f.controller.stop();
  assert.equal((await operation).ok, false); assert.equal(f.boundary.isPending(), false);
});
test('identity replacement while unsafe does not sign out the replacement account', async () => {
  const f = signedIn(); let safe = false; f.boundary.register(() => safe); const operation = f.controller.requestSignOut(f.boundary);
  f.emit(user('B')); safe = true; f.boundary.changed(); assert.equal((await operation).ok, false); assert.equal(signOutCalls(f), 0);
  assert.equal(f.controller.getSnapshot().session.user.uid, 'B');
});
test('account B can log in without restart and remains authorized while unverified', async () => {
  const f = signedIn({ signOut: async () => f.emit(null), login: async () => f.emit(user('B', false)) });
  await f.controller.requestSignOut(f.boundary);
  assert.equal((await f.controller.run('login', 'B@example.test', 'secret')).ok, true);
  assert.equal(f.controller.getSnapshot().session.user.uid, 'B'); assert.equal(f.controller.getSnapshot().session.user.emailVerified, false);
  assert.equal(f.boundary.canStart(), true); assert.equal(f.calls.filter(call => call[0] === 'subscribe').length, 1);
});
test('account B registration requests verification and preserves per-identity cooldown/manual refresh', async () => {
  const f = signedIn({ signOut: async () => f.emit(null), register: async () => { f.emit(user('B')); return 'B'; }, refresh: async () => user('B', true) });
  await f.controller.requestSignOut(f.boundary); const result = await f.controller.run('register', 'B@example.test', 'secret', 'secret');
  assert.equal(result.ok, true); assert.deepEqual(f.calls.at(-1), ['verify', 'B']); assert.equal(f.boundary.canStart(), true);
  assert.equal((await f.controller.run('resend')).ok, false); f.advance(60000); assert.equal((await f.controller.run('resend')).ok, true);
  assert.equal((await f.controller.run('refresh')).ok, true); assert.equal(f.controller.getSnapshot().session.user.emailVerified, true);
});
test('registration verification failure after switching preserves account B', async () => {
  const f = signedIn({ signOut: async () => f.emit(null), register: async () => { f.emit(user('B')); return 'B'; }, verify: async () => { throw Error('email failure'); } });
  await f.controller.requestSignOut(f.boundary); const result = await f.controller.run('register', 'B@example.test', 'secret', 'secret');
  assert.equal(result.ok, true); assert.match(result.message, /could not be sent/); assert.equal(f.controller.getSnapshot().session.user.uid, 'B');
});
test('sign-out and account switching preserve the same rendered device-wide History', async () => {
  const sessions = [{ id: 'existing-device-session', createdAt: 1, durationMs: 12000, sampledFrames: 120, poseFrames: 100,
    usableFrameRatio: .8, landmarkCount: 33, view: 'side_left', rawVideoRetained: false, modelSha256: 'a'.repeat(64),
    extractorVersion: 'test', consentVersion: 'local-prototype-notice-v1', timestampMethod: 'requested-100ms-nearest-decoded-frame' }];
  const f = signedIn({ signOut: async () => f.emit(null), login: async () => f.emit(user('B')) }); const a = capture(f.boundary, sessions);
  await flush(); a.render(); assert.equal(a.hasSession(sessions[0].id), true);
  await f.controller.requestSignOut(f.boundary); a.unmount(); assert.deepEqual(a.destroyed, []);
  await f.controller.run('login', 'B@example.test', 'secret'); const b = capture(f.boundary, sessions);
  await flush(); b.render(); assert.equal(b.hasSession(sessions[0].id), true); assert.deepEqual(b.destroyed, []); b.unmount();
});
test('local sessions and frames schema has no Firebase account ownership', () => {
  const native = read('modules/gaitsense-pose/android/src/main/java/expo/modules/gaitsensepose/GaitSensePoseModule.kt');
  const schemas = [...native.matchAll(/CREATE TABLE[^\r\n]+/g)].map(match => match[0]);
  assert.equal(schemas.length, 2);
  assert.match(schemas.join('\n'), /sessions/); assert.match(schemas.join('\n'), /frames/);
  assert.doesNotMatch(schemas.join('\n'), /uid|account|owner|firebase/i);
});
test('no UID filtering or auth storage/network calls enter the gait layer', () => {
  const sources = readdirSync(new URL('../src/offline/', import.meta.url)).filter(n => /\.tsx?$/.test(n)).map(n => read('src/offline/' + n)).join('\n');
  assert.doesNotMatch(sources, /firebase|Firebase|useAuth|currentUser|firebaseUid|accountUid/);
  const controller = read('src/auth/auth-controller.ts'); assert.doesNotMatch(controller, /deleteAll|deleteSession|readFrames|SQLite|sqlite|landmark|knee|MediaPipe/);
});
test('no tokens, persistence, deletion, Google or cloud features accompany sign-out', () => {
  const auth = readdirSync(new URL('../src/auth/', import.meta.url)).map(n => read('src/auth/' + n)).join('\n');
  assert.doesNotMatch(auth, /console\.|getIdToken|JSON\.stringify|AsyncStorage|SecureStore|localStorage|fetch\(|NetInfo|deleteUser|reauthenticate|GoogleAuthProvider|linkWithCredential|firestore|storage\(/);
  assert.equal((auth.match(/onAuthStateChanged\(getAuth\(/g) || []).length, 1);
});
