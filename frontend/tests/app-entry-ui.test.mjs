import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createEntryPreferences, ENTRY_PREFERENCES_KEY } from '../src/entry/entry-preferences.ts';
import { gate } from './helpers/entry-gate-harness.mjs';
import { entryScreen } from './helpers/entry-screen-harness.mjs';
import { deferred } from './helpers/auth-controller-harness.mjs';
import { screen } from './helpers/auth-screen-harness.mjs';
const require = createRequire(import.meta.url);
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const state = (ack = 0, guide = 0, status = 'READY') => ({ status, versions: { acknowledgementVersion: ack, onboardingVersion: guide }, busy: false, message: '' });
const flush = () => new Promise(resolve => setImmediate(resolve));
async function fixture(versions = state().versions, overrides = {}) {
  const writes = [];
  const controller = createEntryPreferences({ getItem: async () => JSON.stringify(versions),
    setItem: async (...args) => writes.push(args), ...overrides });
  await controller.start(); return { controller, writes };
}
function lastPage(h) { for (let i = 0; i < 3; i++) { h.button('Next').onPress(); h.render(); } }

test('actual gate has no Home/onboarding while auth or local preferences are restoring', () => {
  for (const [auth, preferences] of [['RESTORING', state()], ['SIGNED_IN', state(1, 1, 'RESTORING')]]) {
    const h = gate(auth, preferences); assert.deepEqual(h.routes(), []); assert.equal(h.tree().type, 'SafeAreaView'); assert.equal(h.boundary.canStart(), false);
  }
});
test('actual signed-out gate ignores device-local prerequisite states', () => {
  for (const preferences of [state(), state(1, 1), state(1, 1, 'ERROR')]) assert.deepEqual(gate('SIGNED_OUT', preferences).routes(), ['account']);
});
test('current route order deterministically selects acknowledgement, guide, then Home', () => {
  assert.deepEqual(gate('SIGNED_IN', state()).routes(), ['acknowledgement', 'account']);
  assert.deepEqual(gate('SIGNED_IN', state(1)).routes(), ['guide', 'acknowledgement', 'account']);
  const h = gate('SIGNED_IN', state(1, 1)); assert.equal(h.routes()[0], 'index'); assert.ok(h.routes().includes('offline'));
});
test('protected direct offline and legacy routes cannot bypass first-use requirements', () => {
  const { StackRouter } = require('expo-router/build/react-navigation/routers/StackRouter');
  for (const preferences of [state(), state(1), state(1, 1, 'ERROR')]) {
    const h = gate('SIGNED_IN', preferences); assert.equal(h.boundary.canStart(), false);
    if (!h.routes().length) continue;
    const router = StackRouter({}), options = { routeNames: h.routes(), routeParamList: {}, routeGetIdList: {} }, initial = router.getInitialState(options);
    for (const name of ['offline', ...h.protectedAppRoutes]) assert.equal(router.getStateForAction(initial, { type: 'PUSH', payload: { name } }, options), null);
  }
});
test('preference failure offers only local retry and does not call auth retry', () => {
  const h = gate('SIGNED_IN', state(1, 1, 'ERROR')); let authRetries = 0, localRetries = 0;
  h.auth.retry = () => authRetries++; h.preferences.retry = () => localRetries++;
  const children = h.tree().props.children.flat().filter(Boolean);
  const button = children.find(node => node.props?.accessibilityLabel === 'Retry app preferences');
  button.props.onPress(); assert.equal(localRetries, 1); assert.equal(authRetries, 0); assert.deepEqual(h.routes(), []);
});
test('stable prerequisite combinations do not alternate into redirect loops', () => {
  for (const preferences of [state(), state(1), state(1, 1)]) {
    const h = gate('SIGNED_IN', preferences), expected = h.routes(); for (let i = 0; i < 10; i++) assert.deepEqual(h.routes(), expected);
  }
});
test('first-use cannot replace an unsafe admitted gait workspace or its sign-out settlement', () => {
  const h = gate('SIGNED_IN', state(1, 1)); let safe = false; h.boundary.register(() => safe);
  h.preferences.versions = state().versions; assert.deepEqual(h.routes(), ['offline']); assert.equal(h.boundary.canStart(), false);
  safe = true; h.boundary.changed(); assert.equal(h.routes()[0], 'acknowledgement');
});
test('acknowledgement starts unchecked, accessible, and cannot silently accept', async () => {
  const f = await fixture(), h = entryScreen('acknowledgement', f.controller);
  assert.equal(h.button('I understand the app acknowledgement').accessibilityState.checked, false);
  assert.equal(h.button('Continue').disabled, true); h.button('Continue').onPress(); await flush();
  assert.equal(f.writes.length, 0); assert.deepEqual(h.navigations, []);
});
test('explicit acknowledgement waits for storage and rapid activation cannot duplicate navigation', async () => {
  const write = deferred(); let writes = 0; const f = await fixture(undefined, { setItem: () => { writes++; return write.promise; } });
  const h = entryScreen('acknowledgement', f.controller);
  h.button('I understand the app acknowledgement').onPress(); h.render();
  const press = h.button('Continue').onPress; press(); press(); assert.equal(writes, 1); assert.deepEqual(h.navigations, []);
  h.render(); assert.equal(h.button('Continue').disabled, true);
  write.resolve(); await flush(); assert.deepEqual(h.navigations, [['replace', '/guide']]);
});
test('acknowledgement write failure stays on screen with bounded retry message', async () => {
  const f = await fixture(undefined, { async setItem() { throw Error('fixture internal'); } }), h = entryScreen('acknowledgement', f.controller);
  h.button('I understand the app acknowledgement').onPress(); h.render(); h.button('Continue').onPress(); await flush(); h.render();
  assert.deepEqual(h.navigations, []); assert.match(h.text(), /could not be saved/); assert.equal(h.button('Continue').disabled, false);
});
test('unmount before acknowledgement save resolves cannot navigate stale screen', async () => {
  const write = deferred(), f = await fixture(undefined, { setItem: () => write.promise }), h = entryScreen('acknowledgement', f.controller);
  h.button('I understand the app acknowledgement').onPress(); h.render(); h.button('Continue').onPress(); h.unmount(); write.resolve(); await flush();
  assert.deepEqual(h.navigations, []);
});
test('guide has four pages and rapid Next does not skip unseen pages', async () => {
  const f = await fixture(state(1).versions), h = entryScreen('guide', f.controller);
  assert.match(h.text(), /1 of 4/); const press = h.button('Next').onPress; press(); press(); h.render(); assert.match(h.text(), /2 of 4/);
  assert.equal(h.button('Done'), undefined); assert.equal(f.writes.length, 0);
});
test('guide Back and Android hardware Back visit previous step and current acknowledgement', async () => {
  const f = await fixture(state(1).versions), h = entryScreen('guide', f.controller);
  h.button('Next').onPress(); h.render(); assert.equal(h.back(), true); h.render(); assert.match(h.text(), /1 of 4/);
  assert.equal(h.back(), true); assert.deepEqual(h.navigations, [['replace', '/acknowledgement']]);
});
test('guide Done persists before clearing first-use stack and replacing Home', async () => {
  const write = deferred(), f = await fixture(state(1).versions, { setItem: () => write.promise }), h = entryScreen('guide', f.controller); lastPage(h);
  const press = h.button('Done').onPress; press(); press(); assert.deepEqual(h.navigations, []);
  write.resolve(); await flush(); assert.deepEqual(h.navigations, [['dismissAll'], ['replace', '/']]);
});
test('installed Android stack router cannot reopen first-use after dismissAll and Home replacement', () => {
  const { StackRouter } = require('expo-router/build/react-navigation/routers/StackRouter'), router = StackRouter({});
  const options = { routeNames: ['acknowledgement', 'guide', 'index', 'account'], routeParamList: {}, routeGetIdList: {} };
  let nav = router.getInitialState(options); nav = router.getStateForAction(nav, { type: 'REPLACE', payload: { name: 'guide' } }, options);
  // Expo dismissAll uses POP_TO_TOP; replace('/') maps to index.
  nav = router.getStateForAction(nav, { type: 'POP_TO_TOP' }, options) ?? nav;
  nav = router.getStateForAction(nav, { type: 'REPLACE', payload: { name: 'index' } }, options);
  assert.deepEqual(nav.routes.map(route => route.name), ['index']); assert.equal(router.getStateForAction(nav, { type: 'POP', payload: { count: 1 } }, options), null);
});
test('guide completion failure remains on final page and Back cannot race an active write', async () => {
  const write = deferred(), f = await fixture(state(1).versions, { setItem: () => write.promise }), h = entryScreen('guide', f.controller); lastPage(h);
  h.button('Done').onPress(); h.back(); h.render(); assert.match(h.text(), /4 of 4/);
  write.reject(Error('internal fixture')); await flush(); h.render(); assert.deepEqual(h.navigations, []); assert.match(h.text(), /could not be saved/);
});
test('replay guide reads same four pages without clearing or rewriting completion', async () => {
  const f = await fixture(state(1, 1).versions), h = entryScreen('guide', f.controller); lastPage(h); h.button('Done').onPress(); await flush();
  assert.deepEqual(h.navigations, [['dismissTo', '/account']]); assert.equal(f.writes.length, 0); assert.deepEqual(f.controller.getSnapshot().versions, state(1, 1).versions);
});
test('replay hardware Back returns to Account without resetting state', async () => {
  const f = await fixture(state(1, 1).versions), h = entryScreen('guide', f.controller); h.back();
  assert.deepEqual(h.navigations, [['dismissTo', '/account']]); assert.equal(f.writes.length, 0);
});
test('acknowledgement review has no acceptance checkbox, no write and returns to Account', async () => {
  const f = await fixture(state(1, 1).versions), h = entryScreen('acknowledgement', f.controller);
  assert.equal(h.button('I understand the app acknowledgement'), undefined); h.button('Done').onPress(); await flush();
  assert.deepEqual(h.navigations, [['dismissTo', '/account']]); assert.equal(f.writes.length, 0);
});
test('accepted acknowledgement review can return to incomplete guide without reacceptance', async () => {
  const f = await fixture(state(1).versions), h = entryScreen('acknowledgement', f.controller); h.button('Continue').onPress(); await flush();
  assert.deepEqual(h.navigations, [['replace', '/guide']]); assert.equal(f.writes.length, 0);
});
test('accepting a missing or updated acknowledgement goes to Home when guide is already complete', async () => {
  const f = await fixture(state(0, 1).versions), h = entryScreen('acknowledgement', f.controller);
  h.button('I understand the app acknowledgement').onPress(); h.render(); h.button('Continue').onPress(); await flush();
  assert.equal(f.writes.length, 1); assert.deepEqual(h.navigations, [['dismissAll'], ['replace', '/']]);
});
test('Account offers real replay entries and disables them during pending sign-out', () => {
  const h = screen('welcome', { signedIn: true }); h.button('View app guide').onPress(); h.button('Review app acknowledgement').onPress();
  assert.deepEqual(h.navigations, [['push', '/guide'], ['push', '/acknowledgement']]);
  h.auth.busy = 'signout'; h.render(); assert.equal(h.button('View app guide').disabled, true); assert.equal(h.button('Review app acknowledgement').disabled, true);
});
test('successful auth form leaves toward local prerequisites without rendering Home first', () => {
  for (const [preferences, expected] of [[state(), '/acknowledgement'], [state(1), '/guide'], [state(1, 1), '/']]) {
    const h = screen('login', { signedIn: true, preferences }); assert.deepEqual(h.navigations, [['dismissAll'], ['replace', expected]]);
  }
});
test('product text is explicit app acknowledgement, non-diagnostic, local and device-wide', async () => {
  const f = await fixture(), h = entryScreen('acknowledgement', f.controller), text = h.text();
  for (const pattern of [/non-diagnostic/, /does not provide medical diagnosis or treatment advice/, /not evaluated/, /not consent to participate in a research study/, /stored on this device/, /does not upload/, /shared across accounts/, /Signing out does not delete/]) assert.match(text, pattern);
  assert.doesNotMatch(text, /SQLite|UID|AuthProvider|native module|metadata-v2|HIPAA|GDPR|guaranteed|IRB|clinically validated/);
});
test('guide preserves scientific names and normal capture instructions without inflated claims', async () => {
  const f = await fixture(), h = entryScreen('guide', f.controller);
  const text = h.screens.guideSteps.flatMap(step => step.paragraphs).join(' ');
  for (const pattern of [/whole body/, /anatomical side/, /Travel direction/, /upright/, /projected 2D knee flexion/, /candidate ankle-motion extrema/, /candidate-to-candidate temporal intervals/]) assert.match(text, pattern);
  assert.doesNotMatch(text, /heel strikes|toe-offs|cadence|fall-risk|SQLite|UID|metadata-v2/);
});
test('Android root has one stable preference owner and web route variants stay native-free', () => {
  assert.equal((read('src/app/_layout.android.tsx').match(/<EntryPreferencesProvider>/g) ?? []).length, 1);
  assert.doesNotMatch(read('src/entry/EntryPreferencesProvider.tsx'), /useAuth|uid|firebase|onAuthStateChanged/);
  for (const file of ['_layout.web.tsx', 'guide.tsx', 'acknowledgement.tsx']) assert.doesNotMatch(read('src/app/' + file), /EntryPreferences|AsyncStorage|firebase|EntryScreens/);
  for (const route of ['guide', 'acknowledgement']) assert.match(read('src/app/' + route + '.tsx'), /Redirect href="\/"/);
});
test('nonsecret preference storage and first-use UI never write gait database or access a network', () => {
  const sources = readdirSync(new URL('../src/entry/', import.meta.url)).map(name => read('src/entry/' + name)).join('\n');
  assert.doesNotMatch(sources, /getIdToken|refreshToken|accessToken|user\.uid|fetch\(|NetInfo|axios|onAuthStateChanged|SQLite|sqlite|executeSql|deleteSession|insertSession|firestore|FirebaseStorage/);
  assert.equal(ENTRY_PREFERENCES_KEY, 'gaitsense.app-entry.v1');
  assert.doesNotMatch(read('src/offline/OfflineCapture.tsx'), /EntryPreferences|acknowledgementVersion|onboardingVersion|AsyncStorage/);
});
