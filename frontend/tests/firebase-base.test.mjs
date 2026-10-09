import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { checkFirebaseBase, validateFirebaseConfig } from '../scripts/check-firebase-base.mjs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
// Synthetic configuration only. Tests never read the owner's ignored file.
const fixture = () => ({ project_info: { project_id: 'unit-fixture', project_number: '123' }, client: [{
  client_info: { android_client_info: { package_name: 'com.gaitsense.research' }, mobilesdk_app_id: '1:123:android:fixture' },
  api_key: [{ current_key: 'unit-fixture-only' }],
  oauth_client: [{ client_type: 1, client_id: 'android-fixture', android_info: { package_name: 'com.gaitsense.research' } }, { client_type: 3, client_id: 'web-fixture' }],
}] });
const check = (overrides = {}) => checkFirebaseBase(path => path === 'google-services.json'
  ? JSON.stringify(fixture()) : Object.hasOwn(overrides, path) ? overrides[path] : read(path));

test('real tracked base configuration accepts the approved local provisioning path', () => assert.doesNotThrow(() => check()));
test('approved Google config has structurally valid Android and Web OAuth clients', () => {
  assert.deepEqual(validateFirebaseConfig(JSON.stringify(fixture())), { androidClient: true, androidOAuth: true, webOAuth: true });
});
test('malformed Firebase JSON fails with a bounded message', () => {
  assert.throws(() => validateFirebaseConfig('{private-material'), error => error.message === 'Firebase client configuration is not valid JSON');
});
for (const [name, mutate] of [
  ['wrong Android package', value => { value.client[0].client_info.android_client_info.package_name = 'wrong.package'; }],
  ['missing project ID', value => { delete value.project_info.project_id; }],
  ['missing project number', value => { delete value.project_info.project_number; }],
  ['inconsistent Android app ID', value => { value.client[0].client_info.mobilesdk_app_id = '1:999:android:fixture'; }],
  ['missing API key', value => { delete value.client[0].api_key; }],
  ['duplicate Android clients', value => { value.client.push(value.client[0]); }],
  ['wrong Android OAuth package', value => { value.client[0].oauth_client[0].android_info.package_name = 'wrong.package'; }],
  ['malformed OAuth client', value => { delete value.client[0].oauth_client[0].client_id; }],
]) {
  test(`reject ${name} without leaking client material`, () => {
    const value = fixture(); mutate(value);
    assert.throws(() => validateFirebaseConfig(JSON.stringify(value)), error => !error.message.includes('unit-fixture-only'));
  });
}
for (const name of ['app', 'auth']) {
  test(`Firebase ${name} must retain the matching exact dependency version`, () => {
    const value = JSON.parse(read('package.json')); delete value.dependencies[`@react-native-firebase/${name}`];
    assert.throws(() => check({ 'package.json': JSON.stringify(value) }), /audited exact version/);
    value.dependencies[`@react-native-firebase/${name}`] = '26.3.0';
    assert.throws(() => check({ 'package.json': JSON.stringify(value) }), /audited exact version/);
  });
  test(`Firebase ${name} plugin is required exactly once`, () => {
    const value = JSON.parse(read('app.json')); value.expo.plugins.push(`@react-native-firebase/${name}`);
    assert.throws(() => check({ 'app.json': JSON.stringify(value) }), /exactly once/);
  });
}
for (const name of ['firestore', 'storage', 'analytics', 'crashlytics', 'messaging', 'functions']) {
  test(`Firebase ${name} feature dependency is outside base scope`, () => {
    const value = JSON.parse(read('package.json')); value.dependencies[`@react-native-firebase/${name}`] = '26.4.0';
    assert.throws(() => check({ 'package.json': JSON.stringify(value) }), /Only Firebase App\/Auth/);
  });
}
test('no directly configured second Firebase JS SDK', () => {
  const value = JSON.parse(read('package.json')); value.dependencies.firebase = '12.17.1';
  assert.throws(() => check({ 'package.json': JSON.stringify(value) }), /second Firebase JS SDK/);
});
test('wrong provisioning path and package are rejected', () => {
  const value = JSON.parse(read('app.json')); value.expo.android.googleServicesFile = './other.json';
  assert.throws(() => check({ 'app.json': JSON.stringify(value) }), /approved locally provisioned/);
  value.expo.android.package = 'wrong.package';
  assert.throws(() => check({ 'app.json': JSON.stringify(value) }), /must remain GaitSense/);
});
test('owner client file must remain narrowly ignored', () => {
  assert.throws(() => check({ '.gitignore': read('.gitignore').replace('/google-services.json', '') }), /locally provisioned and ignored/);
});
for (const permission of ['RECORD_AUDIO', 'READ_MEDIA_IMAGES', 'READ_MEDIA_VIDEO', 'READ_EXTERNAL_STORAGE', 'WRITE_EXTERNAL_STORAGE']) {
  test(`tracked app config retains ${permission} blocking`, () => {
    const value = JSON.parse(read('app.json')); value.expo.android.blockedPermissions = value.expo.android.blockedPermissions.filter(item => item !== `android.permission.${permission}`);
    assert.throws(() => check({ 'app.json': JSON.stringify(value) }), /Retain/);
  });
}
test('tracked config cannot block authentication networking', () => {
  const value = JSON.parse(read('app.json')); value.expo.android.blockedPermissions.push('android.permission.INTERNET');
  assert.throws(() => check({ 'app.json': JSON.stringify(value) }), /must not be blocked/);
});

function plugin() {
  const callbacks = {};
  const capture = name => (config, action) => { callbacks[name] = action; return config; };
  const require = createRequire(import.meta.url);
  const module = { exports: {} };
  vm.runInNewContext(read('plugins/withOfflinePrivacy.cjs'), { module, require: name => name === 'expo/config-plugins'
    ? { withAndroidManifest: capture('manifest'), withGradleProperties: capture('properties'), withDangerousMod: (config, [, action]) => { callbacks.overlay = action; return config; } }
    : require(name) });
  module.exports({});
  return callbacks;
}
test('privacy plugin disables backup and retains a minimum API 26 floor', () => {
  const callbacks = plugin();
  const manifest = { modResults: { manifest: { $: {}, application: [{ $: { 'android:allowBackup': 'true', 'tools:replace': 'existing' } }] } } };
  callbacks.manifest(manifest);
  assert.equal(manifest.modResults.manifest.application[0].$['android:allowBackup'], 'false');
  assert.equal(manifest.modResults.manifest.application[0].$['tools:replace'], 'existing,android:allowBackup');
  const properties = { modResults: [{ type: 'property', key: 'android.minSdkVersion', value: '23' }] };
  callbacks.properties(properties); assert.equal(properties.modResults[0].value, '26');
});
test('marked release overlay permits INTERNET but still removes overlays; unmarked work is preserved', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'gaitsense-auth-policy-'));
  const path = join(directory, 'app/src/release/AndroidManifest.xml');
  try {
    mkdirSync(join(directory, 'app/src/release'), { recursive: true });
    writeFileSync(path, '<!-- Generated by GaitSense offline privacy plugin -->\n<old/>');
    await plugin().overlay({ modRequest: { platformProjectRoot: directory } });
    const result = readFileSync(path, 'utf8');
    assert.doesNotMatch(result, /android.permission.INTERNET/);
    assert.match(result, /android.permission.SYSTEM_ALERT_WINDOW" tools:node="remove"/);
    writeFileSync(path, 'unrelated native work');
    await assert.rejects(plugin().overlay({ modRequest: { platformProjectRoot: directory } }), /refusing to overwrite/);
    assert.equal(readFileSync(path, 'utf8'), 'unrelated native work');
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
test('Expo build helper uses explicit non-clearing generation on SDK 57', () => {
  assert.match(read('scripts/android-build.ps1'), /'expo', 'prebuild', '--platform', 'android', '--no-install', '--no-clean'/);
});
test('gait, SQLite and analysis source remain independent of Firebase', () => {
  const sources = [];
  function walk(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (['build', '.cxx', '.gradle', 'node_modules', 'assets'].includes(entry.name)) continue;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (/\.(ts|tsx|kt|java|gradle)$/.test(entry.name)) sources.push(path);
    }
  }
  walk(fileURLToPath(new URL('../src/offline', import.meta.url)));
  walk(fileURLToPath(new URL('../modules/gaitsense-pose', import.meta.url)));
  assert.ok(sources.length > 20);
  for (const path of sources) assert.doesNotMatch(readFileSync(path, 'utf8'), /@react-native-firebase|com\.google\.firebase|io\.invertase\.firebase|from\s+['"]firebase(?:\/|['"])/, path);
});
