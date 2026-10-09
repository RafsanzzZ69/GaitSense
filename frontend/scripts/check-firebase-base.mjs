import assert from 'node:assert/strict';

export const firebaseVersion = '26.4.0';
export const firebaseConfigPath = 'google-services.json';
export const androidPackage = 'com.gaitsense.research';

// Never include parsed client configuration in assertion messages or logs.
export function validateFirebaseConfig(text) {
  let config;
  try { config = JSON.parse(text); } catch { throw new Error('Firebase client configuration is not valid JSON'); }
  assert.ok(config && typeof config === 'object', 'Firebase client configuration must be an object');
  const info = config.project_info;
  assert.ok(info && typeof info.project_id === 'string' && info.project_id.length > 0 &&
    /^\d+$/.test(info.project_number), 'Firebase project identifiers are missing');
  const clients = Array.isArray(config.client) ? config.client.filter(client =>
    client?.client_info?.android_client_info?.package_name === androidPackage) : [];
  assert.equal(clients.length, 1, 'Firebase config must contain exactly one matching GaitSense Android client');
  const client = clients[0];
  assert.ok(typeof client.client_info.mobilesdk_app_id === 'string' &&
    client.client_info.mobilesdk_app_id.startsWith(`1:${info.project_number}:android:`), 'Firebase Android app identifier is missing or inconsistent');
  assert.ok(client.api_key?.some(key => typeof key.current_key === 'string' && key.current_key.length > 0), 'Firebase Android API key is missing');
  const oauth = Array.isArray(client.oauth_client) ? client.oauth_client : [];
  assert.ok(oauth.every(entry => typeof entry.client_id === 'string' && entry.client_id.length > 0), 'Firebase OAuth client entry is malformed');
  assert.ok(oauth.filter(entry => entry.client_type === 1).every(entry =>
    entry.android_info?.package_name === androidPackage), 'Firebase Android OAuth package mismatch');
  return { androidClient: true, androidOAuth: oauth.some(entry => entry.client_type === 1), webOAuth: oauth.some(entry => entry.client_type === 3) };
}

export function checkFirebaseBase(read) {
  const manifest = JSON.parse(read('package.json'));
  const dependencies = { ...manifest.devDependencies, ...manifest.dependencies };
  for (const name of ['app', 'auth']) {
    assert.equal(dependencies[`@react-native-firebase/${name}`], firebaseVersion, `Firebase ${name} must use the audited exact version`);
  }
  assert.ok(Object.keys(dependencies).filter(name => name.startsWith('@react-native-firebase/')).every(name =>
    ['@react-native-firebase/app', '@react-native-firebase/auth'].includes(name)), 'Only Firebase App/Auth are permitted');
  assert.ok(!dependencies.firebase, 'Do not directly configure a second Firebase JS SDK');
  const config = JSON.parse(read('app.json')).expo;
  assert.equal(config.android.package, androidPackage, 'Android package must remain GaitSense');
  assert.equal(config.android.googleServicesFile, './' + firebaseConfigPath, 'Use the approved locally provisioned Firebase config path');
  const plugins = config.plugins.map(plugin => Array.isArray(plugin) ? plugin[0] : plugin);
  for (const name of ['app', 'auth']) {
    assert.equal(plugins.filter(plugin => plugin === `@react-native-firebase/${name}`).length, 1, `Firebase ${name} config plugin must appear exactly once`);
  }
  for (const permission of ['RECORD_AUDIO', 'READ_MEDIA_IMAGES', 'READ_MEDIA_VIDEO', 'READ_EXTERNAL_STORAGE', 'WRITE_EXTERNAL_STORAGE']) {
    assert.ok(config.android.blockedPermissions.includes(`android.permission.${permission}`), `Retain ${permission} restriction`);
  }
  assert.ok(!config.android.blockedPermissions.includes('android.permission.INTERNET'), 'Authentication networking must not be blocked');
  assert.ok(read('.gitignore').split(/\r?\n/).includes('/google-services.json'), 'Keep owner Firebase configuration locally provisioned and ignored');
  validateFirebaseConfig(read(firebaseConfigPath));
}
