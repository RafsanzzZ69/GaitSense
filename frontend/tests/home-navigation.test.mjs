import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import * as theme from '../src/constants/theme.ts';
import * as contract from '../src/offline/contract.ts';
import * as framing from '../src/offline/framing.ts';
import * as setup from '../src/offline/recording-analysis-setup.ts';

const require = createRequire(import.meta.url);
const web = require('react-native-web');
const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
function component(path, replacements) {
  const js = ts.transpileModule(source(path), { compilerOptions: {
    jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', js)(id => {
    if (!Object.hasOwn(replacements, id)) return require(id);
    const replacement = replacements[id];
    // Preserve ES default-import semantics for test-injected module seams.
    return Object.hasOwn(replacement, 'default') ? { __esModule: true, ...replacement } : replacement;
  }, module, module.exports);
  return module.exports;
}

function home({ failPush = false } = {}) {
  const controls = [], pushes = [], focus = [];
  const Screen = component('src/home/HomeScreen.tsx', {
    'react-native': { ...web, Pressable: props => { controls.push(props); return React.createElement(web.Pressable, props); } },
    'react-native-safe-area-context': { SafeAreaView: web.View },
    '@expo/vector-icons': { Ionicons: () => null }, '@/constants/theme': theme,
    'expo-router': { useFocusEffect: fn => focus.push(fn), useRouter: () => ({
      push: href => { if (failPush) { failPush = false; throw Error('synthetic route failure'); } pushes.push(href); },
    }) },
  }).default;
  const html = renderToStaticMarkup(React.createElement(Screen));
  return { html, controls, pushes, refocus: () => focus[0]() };
}

test('Android index renders real Home and the primary accessible action opens /offline', () => {
  const h = home();
  assert.equal(component('src/app/index.android.tsx', { '@/home/HomeScreen': { default: 'real-home' } }).default, 'real-home');
  assert.match(h.html, /GaitSense/);
  assert.match(h.html, /Offline gait analysis using your phone camera/);
  assert.equal(h.controls.length, 2);
  const button = h.controls[0];
  assert.equal(button.accessibilityRole, 'button');
  assert.equal(button.accessibilityLabel, 'Start Gait Measurement');
  assert.equal(button.disabled, false);
  assert.ok(button.style({ pressed: false })[0].minHeight >= 48);
  button.onPress();
  assert.deepEqual(h.pushes, ['/offline']);
});

test('rapid activations before a render open once; returning focus permits a new measurement', () => {
  const h = home();
  for (let i = 0; i < 20; i++) h.controls[0].onPress();
  assert.deepEqual(h.pushes, ['/offline']);
  h.refocus();
  h.controls[0].onPress();
  assert.deepEqual(h.pushes, ['/offline', '/offline']);
});
test('Email account entry shares the rapid-tap latch with measurement navigation', () => {
  const h = home();
  h.controls[1].onPress(); h.controls[1].onPress(); h.controls[0].onPress();
  assert.deepEqual(h.pushes, ['/account']);
  h.refocus(); h.controls[0].onPress(); assert.deepEqual(h.pushes, ['/account', '/offline']);
});

test('synchronous navigation failure releases the tap latch for retry', () => {
  const h = home({ failPush: true });
  assert.throws(() => h.controls[0].onPress(), /synthetic route failure/);
  h.controls[0].onPress();
  assert.deepEqual(h.pushes, ['/offline']);
});

test('Home states local storage, transitional History and scientific limits without fake accounts or scores', () => {
  const h = home();
  assert.match(h.html, /Stored on this phone/);
  assert.match(h.html, /work without internet/);
  assert.match(h.html, /History are available inside the measurement workspace/);
  assert.match(h.html, /Scientific status: not evaluated/);
  assert.match(h.html, /not clinically validated/);
  assert.match(h.html, /does not provide a diagnosis or treatment guidance/);
  assert.doesNotMatch(h.html, /gait score|health score|fall.risk|patient|signed in|sign in|login|create account|profile|settings/i);
  assert.equal(h.controls[1].accessibilityLabel, 'Email account');
  h.controls[1].onPress();
  assert.deepEqual(h.pushes, ['/account']);
  assert.doesNotMatch(source('src/home/HomeScreen.tsx'), /OfflineCapture|CameraView|Pose\.|@\/components\/ui|WebApp|firebase|authenticate|loggedIn/);
});

function layout(os) {
  const Stack = () => null;
  Stack.Screen = () => null;
  const Layout = component('src/app/_layout.tsx', {
    'expo-router': { Stack }, 'expo-status-bar': { StatusBar: () => null },
    'react-native-safe-area-context': { SafeAreaProvider: () => null }, 'react-native': { Platform: { OS: os } },
  }).default;
  const stack = React.Children.toArray(Layout().props.children).find(child => child.type === Stack);
  return { stack, route: stack.props.children.props };
}

test('Android root configures a constant workspace identity and existing Router reuses its route key', () => {
  const { route } = layout('android');
  assert.equal(route.name, 'offline');
  assert.equal(typeof route.dangerouslySingular, 'function');
  const id = route.dangerouslySingular;
  assert.equal(id('offline', {}), id('offline', { arbitrary: 'deep-link-query' }));
  // Exercise the installed Router's actual underlying stack implementation,
  // rather than a test-owned array simulating navigation. Native transitions
  // and Expo's href dispatcher remain a physical acceptance requirement.
  const { StackRouter } = require('expo-router/build/react-navigation/routers/StackRouter');
  const router = StackRouter({ initialRouteName: 'index' });
  const options = { routeNames: ['index', 'offline'], routeParamList: {}, routeGetIdList: {
    offline: ({ params }) => id('offline', params ?? {}),
  } };
  let state = router.getInitialState(options);
  state = router.getStateForAction(state, { type: 'PUSH', payload: { name: 'offline' } }, options);
  const key = state.routes.at(-1).key;
  for (let i = 0; i < 20; i++) {
    state = router.getStateForAction(state, { type: 'PUSH', payload: { name: 'offline', params: { attempt: i } } }, options);
    assert.equal(state.routes.filter(r => r.name === 'offline').length, 1);
    assert.equal(state.routes.at(-1).key, key);
  }
  assert.deepEqual(state.routes.map(r => r.name), ['index', 'offline']);
  assert.equal(layout('ios').route.dangerouslySingular, undefined);
});

test('/offline keeps one real capture, and Home exit dismisses/replaces instead of pushing', () => {
  const calls = [];
  const Capture = () => null, Header = () => null;
  const Route = component('src/app/offline.android.tsx', {
    'expo-router': { useRouter: () => ({ dismissTo: href => calls.push(href) }) },
    '@/offline/OfflineCapture': { default: Capture }, '@/home/MeasurementWorkspaceHeader': { MeasurementWorkspaceHeader: Header },
  }).default;
  const tree = Route();
  assert.equal(tree.type, Capture);
  const access = { canLeave: () => true, idle: true };
  const header = tree.props.renderWorkspaceHeader(access);
  assert.equal(header.type, Header);
  assert.equal(header.props.canLeave, access.canLeave);
  header.props.onHome();
  assert.deepEqual(calls, ['/']);
  assert.equal(component('src/app/offline.tsx', { '@/offline/OfflineCapture': { default: Capture } }).default, Capture);
});

test('web entry, web offline redirect and web layout remain independent of Android Home', () => {
  const WebApp = () => null, Redirect = () => null;
  const WebHome = component('src/app/index.web.tsx', { '@/web/WebApp': { default: WebApp } }).default;
  assert.equal(WebHome().type, WebApp);
  assert.equal(WebHome().props.screen, 'home');
  const WebOffline = component('src/app/offline.web.tsx', { 'expo-router': { Redirect } }).default;
  assert.equal(WebOffline().type, Redirect);
  assert.equal(WebOffline().props.href, '/');
  assert.doesNotMatch(source('src/app/_layout.web.tsx'), /HomeScreen|OfflineCapture|MeasurementWorkspaceHeader/);
  assert.match(source('src/app/_layout.web.tsx'), /WebProvider/);
});

test('all seven legacy Android aliases intentionally remain redirects to the existing workspace', () => {
  const Redirect = () => null;
  for (const route of ['dashboard', 'assess', 'history', 'login', 'register', 'profile', 'report/[id]']) {
    const Screen = component(`src/app/${route}.android.tsx`, { 'expo-router': { Redirect } }).default;
    assert.equal(Screen().type, Redirect, route);
    assert.equal(Screen().props.href, '/offline', route);
  }
});

function header({ safe = true, idle = true } = {}) {
  const controls = [], alerts = [], homes = [], dispatches = [], focus = [];
  let prevent, back, removed = 0;
  const Header = component('src/home/MeasurementWorkspaceHeader.tsx', {
    'react-native': { ...web, Alert: { alert: (...args) => alerts.push(args) },
      BackHandler: { addEventListener: (name, fn) => { assert.equal(name, 'hardwareBackPress'); back = fn; return { remove: () => removed++ }; } },
      Pressable: props => { controls.push(props); return React.createElement(web.Pressable, props); } },
    'expo-router': { useNavigation: () => ({ dispatch: action => dispatches.push(action) }), useFocusEffect: fn => focus.push(fn) },
    'expo-router/react-navigation': { usePreventRemove: (enabled, fn) => { assert.equal(enabled, true); prevent = fn; } },
    '@/constants/theme': theme,
  }).MeasurementWorkspaceHeader;
  const html = renderToStaticMarkup(React.createElement(Header, {
    canLeave: () => safe, idle, onHome: () => homes.push('/'),
  }));
  const cleanup = focus[0]();
  return { html, controls, alerts, homes, dispatches, prevent, cleanup,
    get removed() { return removed; }, back: () => back(), setSafe: value => { safe = value; } };
}

test('idle Home and system Back return exactly once; focus listener is removed on cleanup', () => {
  const h = header();
  assert.match(h.html, /Gait Measurement/);
  assert.equal(h.controls[0].accessibilityLabel, 'Return to Home');
  assert.equal(h.controls[0].disabled, false);
  assert.ok(h.controls[0].style[0].minHeight >= 48);
  h.controls[0].onPress();
  h.controls[0].onPress();
  assert.equal(h.back(), true);
  assert.deepEqual(h.homes, ['/']);
  h.cleanup();
  assert.equal(h.removed, 1);
});

test('system Back and a stale enabled Home handler recheck live safety before navigation', () => {
  const h = header();
  h.setSafe(false); // Recording began before React rendered a disabled header.
  h.controls[0].onPress();
  assert.equal(h.back(), true);
  assert.deepEqual(h.homes, []);
  assert.equal(h.alerts.length, 2);
  h.setSafe(true);
  h.back();
  assert.deepEqual(h.homes, ['/']);
});

test('nonidle header disables Home and provides existing cancellation/cleanup guidance', () => {
  const h = header({ safe: false, idle: false });
  assert.equal(h.controls[0].disabled, true);
  assert.equal(h.controls[0].accessibilityState.disabled, true);
  assert.match(h.html, /Finish or discard this attempt/);
  assert.equal(h.back(), true);
  assert.deepEqual(h.homes, []);
  assert.match(h.alerts[0][1], /Cancel the countdown/);
  assert.match(h.alerts[0][1], /processing and cleanup/);
  assert.match(h.alerts[0][1], /cleanup failed/);
});

test('route removal guard refuses active exits and replays only the original action when safe', () => {
  const h = header({ safe: false });
  const action = { type: 'REPLACE', payload: { name: 'index' } };
  h.prevent({ data: { action } });
  assert.deepEqual(h.dispatches, []);
  h.setSafe(true);
  h.prevent({ data: { action } });
  assert.equal(h.dispatches[0], action);
});

// Controlled hooks execute real capture handlers and the new header access seam.
// They do not simulate MediaPipe, Android rendering or actual file deletion.
function capture() {
  const states = [], refs = [], effects = [], discarded = [];
  let stateIndex = 0, refIndex = 0, access, clipResolve, processResolve, cleanupFails = false;
  const camera = { recordAsync: () => new Promise(resolve => { clipResolve = resolve; }), stopRecording() {} };
  const pose = { listSessions: async () => '[]', cancel() {}, addListener: () => ({ remove() {} }),
    discardVideo: async uri => { discarded.push(uri); if (cleanupFails) throw Error('synthetic cleanup failure'); },
    processVideoWithSetup: () => new Promise(resolve => { processResolve = resolve; }) };
  const react = { ...React, useCallback: fn => fn, useEffect: fn => effects.push(fn),
    useState: initial => { const i = stateIndex++; if (!(i in states)) states[i] = initial;
      return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value; }]; },
    useRef: initial => { const i = refIndex++; refs[i] ??= { current: initial };
      if (initial === null && i === 2) refs[i].current = camera; return refs[i]; } };
  const Capture = component('src/offline/OfflineCapture.tsx', {
    react, 'react-native': { ...web, useWindowDimensions: () => ({ width: 360, height: 720 }), AppState: { addEventListener: () => ({ remove() {} }) } },
    'expo-router': { useFocusEffect: fn => effects.push(fn) }, 'expo-camera': { useCameraPermissions: () => [{ granted: true }, () => {}], CameraView: () => null },
    'expo-video': { useVideoPlayer: () => null, VideoView: () => null }, 'react-native-safe-area-context': { SafeAreaView: web.View },
    '../../modules/gaitsense-pose': { default: pose }, './contract': contract, './framing': framing, './recording-analysis-setup': setup,
    './saved-analysis-binding': { createSavedAnalysisBinding: () => ({ dispose() {}, leave() {} }) },
    './SavedAnalysisPanel': { SavedAnalysisPanel: () => null }, './RecordingAnalysisSetupControls': { RecordingAnalysisSetupControls: () => null },
  }).default;
  let tree;
  function render() { stateIndex = refIndex = 0; effects.length = 0;
    tree = Capture({ renderWorkspaceHeader: value => { access = value; return null; } }); }
  function find(predicate, node) {
    if (Array.isArray(node)) return node.map(child => find(predicate, child)).find(Boolean);
    if (React.isValidElement(node)) return predicate(node) ? node : find(predicate, node.props.children);
  }
  render();
  const cleanups = effects.map(fn => fn()).filter(fn => typeof fn === 'function');
  find(n => typeof n.props.onCameraReady === 'function', tree).props.onCameraReady();
  find(n => n.props.accessibilityRole === 'checkbox', tree).props.onPress();
  render();
  return { render, canLeave: () => access.canLeave(), idle: () => access.idle,
    press: label => find(n => n.props.label === label, tree).props.onPress(),
    resolveClip: () => clipResolve({ uri: 'file:///cache/Camera/synthetic.mp4' }),
    resolveProcessing: () => processResolve('{}'), // Parser rejects: exercises real failure cleanup.
    failCleanup: value => { cleanupFails = value; }, discarded,
    unmount: () => cleanups.forEach(fn => fn()) };
}
async function flush() { for (let i = 0; i < 32; i++) await Promise.resolve(); }
async function recordedPreview(h) {
  const previous = globalThis.setTimeout;
  try { globalThis.setTimeout = fn => { queueMicrotask(fn); return 0; };
    h.press('Record 15-second video');
    assert.equal(h.canLeave(), false); // Same tick, before phase/disabled UI renders.
    await flush(); h.render();
    assert.equal(h.canLeave(), false);
    h.resolveClip(); await flush(); h.render();
  } finally { globalThis.setTimeout = previous; }
}

test('real capture exit seam is idle-only through countdown, recording, preview and discard', async () => {
  const h = capture();
  assert.equal(h.canLeave(), true);
  await recordedPreview(h);
  assert.equal(h.canLeave(), false);
  assert.equal(h.idle(), false);
  h.press('Discard video / retake');
  assert.equal(h.canLeave(), false);
  await flush(); h.render();
  assert.equal(h.canLeave(), true);
  assert.equal(h.idle(), true);
  assert.deepEqual(h.discarded, ['file:///cache/Camera/synthetic.mp4']);
  h.unmount();
  assert.equal(h.canLeave(), false);
});

test('real processing and retained cleanup failure block exits until successful explicit discard', async () => {
  const h = capture();
  await recordedPreview(h);
  h.failCleanup(true);
  h.press('Extract landmarks on this phone'); h.render();
  assert.equal(h.canLeave(), false);
  h.resolveProcessing(); await flush(); h.render();
  assert.equal(h.canLeave(), false);
  assert.equal(h.idle(), false);
  h.failCleanup(false);
  h.press('Discard video / retake'); await flush(); h.render();
  assert.equal(h.canLeave(), true);
  assert.equal(h.idle(), true);
  h.unmount();
});
