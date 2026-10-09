import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';

const require = createRequire(import.meta.url);
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const cache = new Map();
function load(path, replacements = {}) {
  const js = ts.transpileModule(read(path), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', js)(id => {
    if (Object.hasOwn(replacements, id)) return replacements[id];
    if (id.startsWith('.')) {
      const target = path.slice(0, path.lastIndexOf('/') + 1) + id.slice(2) + '.ts';
      if (!cache.has(target)) cache.set(target, load(target));
      return cache.get(target);
    }
    return require(id);
  }, module, module.exports);
  return module.exports;
}
const { createAuthController } = load('src/auth/auth-controller.ts');
const { authErrorMessage, resetConfirmation, validateAuthForm } = load('src/auth/auth-errors.ts');
const user = (uid = 'test-user', emailVerified = false) => ({ uid, email: 'fixture@example.test', displayName: null, photoURL: null, emailVerified, providerIds: ['password'] });
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
function fixture(overrides = {}) {
  const calls = []; let next, error, removals = 0, clock = 100000;
  const adapter = {
    subscribe: (a, b) => { calls.push(['subscribe']); next = a; error = b; return () => { removals++; }; },
    register: async (...args) => { calls.push(['register', ...args]); return 'test-user'; },
    login: async (...args) => { calls.push(['login', ...args]); },
    reset: async (...args) => { calls.push(['reset', ...args]); },
    verify: async (...args) => { calls.push(['verify', ...args]); },
    refresh: async () => { calls.push(['refresh']); return user('test-user', true); }, ...overrides,
  };
  const controller = createAuthController(adapter, () => clock);
  return { controller, calls, emit: value => next(value), error: () => error(), advance: ms => { clock += ms; }, get removals() { return removals; } };
}
test('restoration starts unresolved and subscribes once without any online operation', () => {
  const h = fixture(); assert.equal(h.controller.getSnapshot().session.status, 'RESTORING');
  h.controller.start(); h.controller.start();
  assert.deepEqual(h.calls, [['subscribe']]);
  h.emit(user()); assert.equal(h.controller.getSnapshot().session.status, 'SIGNED_IN');
  assert.equal(h.controller.getSnapshot().session.user.emailVerified, false);
  assert.deepEqual(h.calls, [['subscribe']]);
});
test('SDK null resolves signed out; cleanup ignores late callbacks and is idempotent', () => {
  const h = fixture(); h.controller.start(); h.emit(null);
  assert.equal(h.controller.getSnapshot().session.status, 'SIGNED_OUT');
  h.controller.stop(); h.controller.stop(); h.emit(user());
  assert.equal(h.removals, 1); assert.equal(h.controller.getSnapshot().session.status, 'SIGNED_OUT');
});
test('initialization failure alone creates ERROR; explicit retry resubscribes', () => {
  let fail = true;
  const h = fixture({ subscribe: next => { if (fail) throw Error('private initialization detail'); next(null); return () => {}; } });
  h.controller.start(); assert.equal(h.controller.getSnapshot().session.status, 'ERROR');
  fail = false; h.controller.retry(); assert.equal(h.controller.getSnapshot().session.status, 'SIGNED_OUT');
});
test('register calls adapter and verification but never fabricates signed-in state', async () => {
  const h = fixture(); h.controller.start(); h.emit(null);
  const result = await h.controller.run('register', ' fixture@example.test ', ' pass ', ' pass ');
  assert.equal(result.ok, true);
  assert.deepEqual(h.calls.slice(1), [['register', 'fixture@example.test', ' pass '], ['verify', 'test-user']]);
  assert.equal(h.controller.getSnapshot().session.status, 'SIGNED_OUT');
  h.emit(user()); assert.equal(h.controller.getSnapshot().session.status, 'SIGNED_IN');
});
test('registration verification failure preserves the SDK-established account', async () => {
  const h = fixture({ register: async () => { h.emit(user()); return 'test-user'; }, verify: async () => { throw { code: 'auth/network-request-failed' }; } });
  h.controller.start(); h.emit(null);
  const result = await h.controller.run('register', 'fixture@example.test', 'secret', 'secret');
  assert.equal(result.ok, true); assert.match(result.message, /could not be sent/);
  assert.equal(h.controller.getSnapshot().session.status, 'SIGNED_IN');
});
test('login operation succeeds without independently changing session state', async () => {
  const h = fixture(); h.controller.start(); h.emit(null);
  assert.equal((await h.controller.run('login', 'fixture@example.test', 'secret')).ok, true);
  assert.deepEqual(h.calls[1], ['login', 'fixture@example.test', 'secret']);
  assert.equal(h.controller.getSnapshot().session.status, 'SIGNED_OUT');
});
for (const operation of ['register', 'login', 'reset', 'resend', 'refresh']) {
  test(`${operation}: simultaneous activations share one operation latch`, async () => {
    const pending = deferred(); let count = 0;
    const method = { register: 'register', login: 'login', reset: 'reset', resend: 'verify', refresh: 'refresh' }[operation];
    const h = fixture({ [method]: () => { count++; return pending.promise; } });
    h.controller.start(); h.emit(['resend', 'refresh'].includes(operation) ? user() : null);
    const first = h.controller.run(operation, 'fixture@example.test', 'secret', 'secret');
    const duplicate = await h.controller.run(operation, 'fixture@example.test', 'secret', 'secret');
    assert.equal(duplicate.ok, false); assert.equal(count, 1);
    assert.equal((await h.controller.run('reset', 'fixture@example.test')).ok, false);
    pending.resolve(operation === 'register' ? 'test-user' : operation === 'refresh' ? user('test-user', true) : undefined);
    await first; assert.equal(h.controller.getSnapshot().busy, null);
  });
}
test('operation errors are local, release busy state, and permit retry', async () => {
  let failure = true;
  const h = fixture({ login: async () => { if (failure) throw { code: 'auth/wrong-password', message: 'private secret' }; } });
  h.controller.start(); h.emit(null);
  const result = await h.controller.run('login', 'fixture@example.test', 'secret');
  assert.equal(result.message, 'Unable to sign in with those credentials.');
  assert.equal(h.controller.getSnapshot().session.status, 'SIGNED_OUT');
  assert.equal(h.controller.getSnapshot().busy, null);
  failure = false; assert.equal((await h.controller.run('login', 'fixture@example.test', 'secret')).ok, true);
});
for (const exists of [true, false]) {
  test(`reset uses the same neutral confirmation for ${exists ? 'accepted' : 'unknown-account'} requests`, async () => {
    const h = fixture({ reset: async () => { if (!exists) throw { code: 'auth/user-not-found' }; } });
    h.controller.start(); h.emit(null);
    assert.deepEqual(await h.controller.run('reset', 'fixture@example.test'), { ok: true, message: resetConfirmation });
  });
}
test('resend cooldown is per identity and does not block local signed-in access', async () => {
  const h = fixture(); h.controller.start(); h.emit(user());
  assert.equal((await h.controller.run('resend')).ok, true);
  assert.equal((await h.controller.run('resend')).ok, false);
  assert.equal(h.controller.getSnapshot().session.status, 'SIGNED_IN');
  h.advance(60000); assert.equal((await h.controller.run('resend')).ok, true);
  h.emit(user('other')); assert.equal((await h.controller.run('resend')).ok, true);
});
test('manual refresh updates only the same SDK-established identity', async () => {
  const h = fixture(); h.controller.start(); h.emit(user());
  assert.equal(h.calls.length, 1); // no startup reload
  assert.equal((await h.controller.run('refresh')).ok, true);
  assert.equal(h.controller.getSnapshot().session.user.emailVerified, true);
});
test('late refresh cannot restore a signed-out or different identity', async () => {
  const pending = deferred(); const h = fixture({ refresh: () => pending.promise });
  h.controller.start(); h.emit(user()); const refresh = h.controller.run('refresh');
  h.emit(user('other')); pending.resolve(user('test-user', true));
  assert.equal((await refresh).ok, false);
  assert.equal(h.controller.getSnapshot().session.user.uid, 'other');
});
test('stopped registration never sends verification or publishes a late outcome', async () => {
  const pending = deferred(); const h = fixture({ register: () => pending.promise });
  let changes = 0; const cleanup = h.controller.subscribe(() => changes++);
  h.controller.start(); h.emit(null); const result = h.controller.run('register', 'fixture@example.test', 'secret', 'secret');
  h.controller.stop(); cleanup(); const before = changes; pending.resolve('test-user');
  assert.equal((await result).ok, false); assert.equal(changes, before);
  assert.equal(h.calls.some(call => call[0] === 'verify'), false);
});
test('basic validation preserves password whitespace and defers policy to Firebase', () => {
  assert.equal(validateAuthForm('register', 'fixture@example.test', 'a', 'a'), null);
  assert.equal(validateAuthForm('register', 'fixture@example.test', ' ', ' '), null);
  assert.match(validateAuthForm('register', 'fixture@example.test', 'a', 'b'), /do not match/);
  assert.match(validateAuthForm('login', 'fixture@example.test', ''), /password/);
  assert.match(validateAuthForm('reset', 'invalid'), /valid email/);
});
for (const [code, expression] of [
  ['invalid-email', /valid email/], ['invalid-credential', /those credentials/], ['wrong-password', /those credentials/],
  ['user-not-found', /those credentials/], ['user-disabled', /those credentials/], ['weak-password', /password policy/],
  ['password-does-not-meet-requirements', /password policy/], ['email-already-in-use', /Try signing in or resetting/],
  ['too-many-requests', /wait/], ['network-request-failed', /internet/], ['operation-not-allowed', /unavailable/], ['unknown', /Unable to complete/],
]) {
  test(`safe ${code} mapping never exposes raw exceptions`, () => {
    const message = authErrorMessage({ code: 'auth/' + code, message: 'SECRET_TOKEN_PASSWORD_EMAIL' }, 'login');
    assert.match(message, expression); assert.doesNotMatch(message, /SECRET/);
  });
}
test('adapter uses installed modular APIs, exposes only allowlisted identity and never forces startup refresh', async () => {
  const raw = { ...user(), providerData: [{ providerId: 'password' }], refreshToken: 'private', getIdToken: () => { throw Error('must not access'); } };
  const calls = []; const auth = { currentUser: raw }; let observer;
  const sdk = { getAuth: () => auth, onAuthStateChanged: (instance, callback) => { assert.equal(instance, auth); observer = callback; return () => {}; },
    createUserWithEmailAndPassword: async (...args) => { calls.push(['create', ...args]); return { user: raw }; },
    signInWithEmailAndPassword: async (...args) => { calls.push(['login', ...args]); },
    sendPasswordResetEmail: async (...args) => { calls.push(['reset', ...args]); },
    sendEmailVerification: async (...args) => { calls.push(['verify', ...args]); }, reload: async (...args) => { calls.push(['reload', ...args]); },
  };
  const { authAdapter, publicUser } = load('src/auth/firebase-auth-adapter.android.ts', { '@react-native-firebase/auth': sdk });
  const snapshot = publicUser(raw);
  assert.deepEqual(Object.keys(snapshot).sort(), ['displayName', 'email', 'emailVerified', 'photoURL', 'providerIds', 'uid']);
  assert.equal(Object.isFrozen(snapshot), true); assert.equal(Object.isFrozen(snapshot.providerIds), true);
  let restored; authAdapter.subscribe(value => { restored = value; }, () => {}); observer(raw);
  assert.deepEqual(restored, snapshot); assert.deepEqual(calls, []);
  assert.equal(await authAdapter.register('fixture@example.test', 'secret'), raw.uid);
  await authAdapter.login('fixture@example.test', 'secret'); await authAdapter.reset('fixture@example.test');
  await authAdapter.verify(raw.uid); await authAdapter.refresh();
  assert.deepEqual(calls.map(call => call[0]), ['create', 'login', 'reset', 'verify', 'reload']);
  assert.equal(calls[0][1], auth); assert.equal(calls[0][3], 'secret');
  await assert.rejects(authAdapter.verify('wrong-identity'));
});
test('provider mounts one controller subscription, preserves children and unsubscribes', () => {
  const effects = [];
  const h = fixture();
  const fakeReact = { ...React, useState: fn => [fn()], useEffect: fn => effects.push(fn), useSyncExternalStore: (subscribe, snapshot) => snapshot() };
  const { AuthProvider } = load('src/auth/AuthProvider.tsx', { react: fakeReact, './firebase-auth-adapter': { authAdapter: {} }, './auth-controller': { createAuthController } });
  const tree = AuthProvider({ children: 'unchanged measurement child', adapter: {
    subscribe: (next, error) => { h.calls.push(['provider-subscribe']); next(user()); return () => h.calls.push(['provider-cleanup']); },
  } });
  assert.equal(tree.props.value.session.status, 'RESTORING'); assert.equal(tree.props.children, 'unchanged measurement child');
  const cleanup = effects[0](); assert.deepEqual(h.calls, [['provider-subscribe']]); cleanup();
  assert.deepEqual(h.calls, [['provider-subscribe'], ['provider-cleanup']]);
});
test('native root wraps stable shell once, and web root never imports native auth', () => {
  const root = read('src/app/_layout.android.tsx');
  assert.equal((root.match(/<AuthProvider>/g) || []).length, 1);
  assert.match(root, /dangerouslySingular.*gaitsense-measurement/);
  assert.doesNotMatch(root, /Redirect|useAuth|uid|Protected|OfflineCapture/);
  assert.doesNotMatch(read('src/app/_layout.web.tsx'), /AuthProvider|firebase/);
  assert.doesNotMatch(read('src/auth/firebase-auth-adapter.ts'), /from.*firebase/);
});
test('source security boundaries: no secret persistence, Google, account destruction or gait coupling', () => {
  const authSources = readdirSync(new URL('../src/auth/', import.meta.url)).map(name => read('src/auth/' + name)).join('\n');
  assert.doesNotMatch(authSources, /AsyncStorage|SecureStore|localStorage|JSON\.stringify|console\.|getIdToken|fetch\(|setTimeout|GoogleAuthProvider|signOut|deleteUser|linkWithCredential|OfflineCapture|sqlite|MediaPipe|gaitsense-pose/);
  assert.doesNotMatch(read('src/app/index.android.tsx') + read('src/app/offline.android.tsx'), /useAuth|AuthProvider|Redirect|firebase/);
  const unchangedPaths = ['modules/gaitsense-pose/android/src/main/java/expo/modules/gaitsensepose/GaitSensePoseModule.kt', 'modules/gaitsense-pose/android/src/main/java/expo/modules/gaitsensepose/RequiredJointQualityGate.kt'];
  for (const path of unchangedPaths) assert.doesNotMatch(read(path), /firebase|Firebase|\bUID\b/);
  assert.match(read('src/auth/auth-controller.ts'), /adapter\.subscribe/);
  assert.doesNotMatch(read('src/auth/auth-controller.ts'), /loggedIn|SIGNED_IN.*register|SIGNED_IN.*login/);
});
