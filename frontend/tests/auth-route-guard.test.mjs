import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
import { gate } from './helpers/entry-gate-harness.mjs';

test('RESTORING mounts a bounded retry/loading surface and neither Home nor capture', () => {
  const h = gate(); assert.deepEqual(h.routes(), []); assert.equal(h.tree().type, 'SafeAreaView');
  assert.match(read('src/auth/AndroidAuthGate.tsx'), /Retry account access/);
});
test('initial ERROR is closed, preserves local data and offers retry', () => {
  const h = gate('ERROR'); assert.deepEqual(h.routes(), []);
  assert.match(read('src/auth/AndroidAuthGate.tsx'), /have not been deleted/);
});
test('SIGNED_OUT root resolves only to the real account flow', () => { assert.deepEqual(gate('SIGNED_OUT').routes(), ['account']); });
test('SIGNED_IN has Home as the first eligible route and permits offline workspace', () => {
  const h = gate('SIGNED_IN'); assert.equal(h.routes()[0], 'index'); assert.ok(h.routes().includes('offline'));
});
test('signed-out direct /offline cannot construct a workspace navigation entry', () => {
  const h = gate('SIGNED_OUT'); const { StackRouter } = require('expo-router/build/react-navigation/routers/StackRouter');
  const router = StackRouter({}); const options = { routeNames: h.routes(), routeParamList: {}, routeGetIdList: {} };
  const state = router.getInitialState(options);
  assert.equal(router.getStateForAction(state, { type: 'PUSH', payload: { name: 'offline' } }, options), null);
  assert.equal(h.boundary.mustRetain(), false);
});
test('online and offline restored signed-in identity use the identical local gate', () => {
  for (const network of ['online', 'Airplane mode']) {
    const h = gate(); assert.deepEqual(h.routes(), [], network); h.auth.session = { status: 'SIGNED_IN', user: { emailVerified: false } };
    assert.equal(h.routes()[0], 'index', network);
  }
  assert.doesNotMatch(read('src/auth/AndroidAuthGate.tsx'), /fetch\(|getIdToken|reload\(|NetInfo|connectivity|Firestore|axios/);
});
test('unverified SDK user remains authorized and verification route remains available', () => {
  const h = gate('SIGNED_IN'); assert.equal(h.auth.session.user.emailVerified, false); assert.ok(h.routes().includes('offline'));
  assert.ok(h.routes().includes('account')); assert.doesNotMatch(read('src/auth/AndroidAuthGate.tsx'), /emailVerified/);
});
test('all current main routes and legacy aliases are enumerated behind protection', () => {
  const h = gate('SIGNED_OUT');
  assert.deepEqual(h.protectedAppRoutes, ['index', 'dashboard', 'assess', 'history', 'login', 'register', 'profile', 'report/[id]']);
  assert.deepEqual(h.routes(), ['account']);
  for (const route of h.protectedAppRoutes.filter(route => route !== 'index')) assert.match(read(`src/app/${route}.android.tsx`), /href="\/offline"/);
});
test('idle signed-out change removes protected Home/offline history using installed stack router', () => {
  const h = gate('SIGNED_IN'); const { StackRouter } = require('expo-router/build/react-navigation/routers/StackRouter'); const router = StackRouter({});
  let options = { routeNames: h.routes(), routeParamList: {}, routeGetIdList: {}, routeKeyChanges: [] };
  let state = router.getInitialState(options);
  state = router.getStateForAction(state, { type: 'PUSH', payload: { name: 'offline' } }, options);
  h.auth.session = { status: 'SIGNED_OUT', user: null }; options = { ...options, routeNames: h.routes() };
  state = router.getStateForRouteNamesChange(state, options);
  assert.deepEqual(state.routes.map(route => route.name), ['account']);
  assert.equal(router.getStateForAction(state, { type: 'POP', payload: { count: 1 } }, options), null);
});
test('an admitted unsafe owner retains only offline; auth and other routes cannot cover it', () => {
  const h = gate('SIGNED_IN'); let safe = false; const release = h.boundary.register(() => safe);
  h.auth.session = { status: 'SIGNED_OUT', user: null };
  assert.deepEqual(h.routes(), ['offline']); assert.equal(h.boundary.canStart(), false);
  safe = true; h.boundary.changed(); assert.deepEqual(h.routes(), ['account']); release();
});

test('pending sign-out retains the unsafe owner while Firebase still reports SIGNED_IN', async () => {
  const h = gate('SIGNED_IN'); let safe = false; h.boundary.register(() => safe);
  const departure = h.boundary.requestDeparture(); assert.deepEqual(h.routes(), ['offline']);
  assert.equal(h.auth.session.status, 'SIGNED_IN'); assert.equal(h.boundary.canStart(), false);
  safe = true; h.boundary.changed(); assert.equal(await departure.ready, true);
  assert.deepEqual(h.routes(), ['account']);
  h.auth.session = { status: 'SIGNED_OUT', user: null }; departure.release(); assert.deepEqual(h.routes(), ['account']);
});

test('safe sign-out waiting for listener cannot reopen Home or mount a fresh camera', async () => {
  const h = gate('SIGNED_IN'); const departure = h.boundary.requestDeparture();
  assert.equal(await departure.ready, true); assert.deepEqual(h.routes(), ['account']);
  departure.release(); assert.equal(h.routes()[0], 'index');
});

test('pending sign-out prunes covering routes while preserving the admitted workspace route key', () => {
  const h = gate('SIGNED_IN'); const { StackRouter } = require('expo-router/build/react-navigation/routers/StackRouter');
  const router = StackRouter({}); let options = { routeNames: h.routes(), routeParamList: {}, routeGetIdList: {}, routeKeyChanges: [] };
  let state = router.getInitialState(options);
  state = router.getStateForAction(state, { type: 'PUSH', payload: { name: 'offline' } }, options);
  const ownerKey = state.routes.at(-1).key;
  state = router.getStateForAction(state, { type: 'PUSH', payload: { name: 'account' } }, options);
  let safe = false; h.boundary.register(() => safe); const departure = h.boundary.requestDeparture();
  options = { ...options, routeNames: h.routes() }; state = router.getStateForRouteNamesChange(state, options);
  assert.deepEqual(state.routes.map(route => route.name), ['offline']); assert.equal(state.routes[0].key, ownerKey);
  assert.equal(router.getStateForAction(state, { type: 'POP', payload: { count: 1 } }, options), null);
  safe = true; h.boundary.changed(); options = { ...options, routeNames: h.routes() };
  state = router.getStateForRouteNamesChange(state, options); assert.deepEqual(state.routes.map(route => route.name), ['account']);
  h.auth.session = { status: 'SIGNED_OUT', user: null }; departure.release(); assert.deepEqual(h.routes(), ['account']);
});
test('ERROR/restoration during an admitted attempt retains settlement, then closes entry safely', () => {
  for (const status of ['ERROR', 'RESTORING']) {
    const h = gate('SIGNED_IN'); let safe = false; h.boundary.register(() => safe); h.auth.session = { status, user: null };
    assert.deepEqual(h.routes(), ['offline']); safe = true; h.boundary.changed(); assert.deepEqual(h.routes(), []);
  }
});
test('stable session/root route sets do not alternate into redirect loops', () => {
  for (const status of ['RESTORING', 'SIGNED_OUT', 'SIGNED_IN', 'ERROR']) {
    const h = gate(status); const initial = h.routes(); for (let i = 0; i < 10; i++) assert.deepEqual(h.routes(), initial);
  }
});
test('single native subscription owner and synchronous new-work permission share controller truth', () => {
  const h = gate('SIGNED_IN'); assert.equal(h.boundary.canStart(), true); h.auth.session = { status: 'SIGNED_OUT', user: null };
  assert.equal(h.boundary.canStart(), false); // before a gate render
  assert.match(read('src/auth/AuthProvider.tsx'), /getSnapshot: controller.getSnapshot/);
  assert.match(read('src/auth/auth-controller.ts'), /adapter\.subscribe/);
  for (const path of ['src/auth/AndroidAuthGate.tsx', 'src/app/offline.android.tsx', 'src/home/HomeScreen.tsx', 'src/offline/OfflineCapture.tsx']) {
    assert.doesNotMatch(read(path), /onAuthStateChanged|adapter\.subscribe|firebase-auth-adapter/);
  }
});
test('web route/layout and measurement layer do not acquire Firebase or account storage', () => {
  assert.doesNotMatch(read('src/app/_layout.web.tsx'), /AuthProvider|AndroidAuthGate|firebase/);
  assert.doesNotMatch(read('src/offline/OfflineCapture.tsx'), /Firebase|firebase|useAuth|SIGNED_OUT|SIGNED_IN/);
  const native = read('modules/gaitsense-pose/android/src/main/java/expo/modules/gaitsensepose/GaitSensePoseModule.kt');
  assert.doesNotMatch(native, /Firebase|firebase|\bUID\b/);
  const auth = readdirSync(new URL('../src/auth/', import.meta.url)).map(name => read('src/auth/' + name)).join('\n');
  assert.doesNotMatch(auth, /console\.|getIdToken|AsyncStorage|SecureStore|localStorage|deleteUser|GoogleAuthProvider|linkWithCredential/);
});
