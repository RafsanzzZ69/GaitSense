import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkOfflineNativeInputs } from '../scripts/check-offline-native.mjs';

const modelHash = '5134a3aad27a58b93da0088d431f366da362b44e3ccfbe3462b3827a839011b1';
const releasePath = 'android/app/src/release/AndroidManifest.xml';
const mainPath = 'android/app/src/main/AndroidManifest.xml';
const sdkPath = 'android/gradle.properties';
const modulePath = 'modules/gaitsense-pose/expo-module.config.json';
// Generated inputs are fixture values, so the full source suite also works in a
// checkout without ignored Android output/model assets. CLI acceptance hashes
// the actual model separately; these tests exercise its pinned digest gate.
function inputs(overrides = {}) {
  const fixtures = {
    [releasePath]: '<manifest><uses-permission android:name="android.permission.INTERNET" tools:node="remove"/><uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" tools:node="remove"/></manifest>',
    [mainPath]: '<manifest><uses-permission android:name="android.permission.RECORD_AUDIO" tools:node="remove"/><application android:allowBackup="false"/></manifest>',
    [sdkPath]: 'android.minSdkVersion=26\n',
    [modulePath]: JSON.stringify({ android: { modules: ['expo.modules.gaitsensepose.GaitSensePoseModule'] } }),
    ...overrides,
  };
  return path => Object.hasOwn(fixtures, path) ? fixtures[path] : readFileSync(new URL('../' + path, import.meta.url), 'utf8');
}
const source = path => inputs()(path);
const check = (overrides, digest = modelHash) => checkOfflineNativeInputs(inputs(overrides), digest);

test('native preflight accepts actual Phase 1 Home and measurement source', () => {
  assert.doesNotThrow(() => check());
});

test('route relationships tolerate formatting, quote and local import alias changes', () => {
  assert.doesNotThrow(() => check({
    'src/app/index.android.tsx': 'import Landing from "@/home/HomeScreen";\nexport default Landing;',
    'src/home/HomeScreen.tsx': source('src/home/HomeScreen.tsx').replace('useRouter }', 'useRouter as getRouter }').replace('useRouter()', 'getRouter()').replace("router.push('/offline')", 'router . push ( "/offline" )'),
    'src/app/offline.android.tsx': source('src/app/offline.android.tsx').replaceAll('OfflineCapture', 'Capture').replace('@/offline/Capture', '@/offline/OfflineCapture'),
    'src/app/dashboard.android.tsx': 'import { Redirect as Forward } from "expo-router"; export default function Legacy() { return <Forward href="/offline" />; }',
  }));
});

test('pre-Phase-1 index redirect is rejected rather than required', () => {
  assert.throws(() => check({ 'src/app/index.android.tsx': 'import { Redirect } from "expo-router"; export default function Entry() { return <Redirect href="/offline" />; }' }), /index must expose HomeScreen/);
});

test('Home must retain the Expo Router measurement entry', () => {
  assert.throws(() => check({ 'src/home/HomeScreen.tsx': source('src/home/HomeScreen.tsx').replace("router.push('/offline')", "router.push('/dashboard')") }), /Home must enter \/offline/);
});

test('commented-out navigation is not a measurement entry', () => {
  assert.throws(() => check({ 'src/home/HomeScreen.tsx': source('src/home/HomeScreen.tsx').replace("router.push('/offline');", "// router.push('/offline');") }), /Home must enter \/offline/);
});

for (const dependency of ['expo-camera', '@/offline/OfflineCapture', '../../modules/gaitsense-pose']) {
  test(`Home cannot take measurement ownership through ${dependency}`, () => {
    assert.throws(() => check({ 'src/home/HomeScreen.tsx': `import HiddenCapture from '${dependency}';\n` + source('src/home/HomeScreen.tsx') }), /Home must not own camera/);
  });
}

test('/offline must render the proven capture implementation', () => {
  assert.throws(() => check({ 'src/app/offline.android.tsx': source('src/app/offline.android.tsx').replace('@/offline/OfflineCapture', '@/home/HomeScreen') }), /mount exactly one/);
});

test('/offline cannot mount two capture implementations', () => {
  assert.throws(() => check({ 'src/app/offline.android.tsx': "import Capture from '@/offline/OfflineCapture'; export default function Workspace() { return <><Capture /><Capture /></>; }" }), /mount exactly one/);
});

test('generic /offline fallback still exposes OfflineCapture', () => {
  assert.throws(() => check({ 'src/app/offline.tsx': "export { default } from '@/home/HomeScreen';" }), /Generic \/offline/);
});

for (const route of ['assess', 'dashboard', 'history', 'profile', 'login', 'register', 'report/[id]']) {
  test(`transitional ${route} redirect remains required`, () => {
    const path = `src/app/${route}.android.tsx`;
    assert.throws(() => check({ [path]: source(path).replace('/offline', '/') }), /must redirect to \/offline/);
  });
}

for (const [name, overrides] of [
  ['release INTERNET removal', { [releasePath]: inputs()(releasePath).replace('android.permission.INTERNET', 'android.permission.VIBRATE') }],
  ['release overlay permission removal', { [releasePath]: inputs()(releasePath).replace('android.permission.SYSTEM_ALERT_WINDOW', 'android.permission.VIBRATE') }],
  ['backup disabled', { [mainPath]: inputs()(mainPath).replace('allowBackup="false"', 'allowBackup="true"') }],
  ['audio permission removal', { [mainPath]: inputs()(mainPath).replace('RECORD_AUDIO', 'VIBRATE') }],
  ['API 26 floor', { [sdkPath]: 'android.minSdkVersion=25\n' }],
  ['native module declaration', { [modulePath]: JSON.stringify({ android: { modules: [] } }) }],
]) {
  test(`native preflight retains ${name}`, () => assert.throws(() => check(overrides)));
}

test('bundled model digest must match the pinned model', () => {
  assert.throws(() => check({}, '0'.repeat(64)), /Assertion/);
});
