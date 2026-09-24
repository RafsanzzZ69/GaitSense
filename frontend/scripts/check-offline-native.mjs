// Checks generated inputs, not a substitute for Gradle or physical-device tests.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => readFileSync(resolve(root,path),'utf8');
try {
  const release=read('android/app/src/release/AndroidManifest.xml');
  assert.match(release, /android:name="android.permission.INTERNET"\s+tools:node="remove"/);
  assert.match(release, /android:name="android.permission.SYSTEM_ALERT_WINDOW"\s+tools:node="remove"/);
  const main=read('android/app/src/main/AndroidManifest.xml');
  assert.match(main, /android:allowBackup="false"/);
  assert.match(main, /android:name="android.permission.RECORD_AUDIO"\s+tools:node="remove"/);
  const sdk=read('android/gradle.properties').match(/^android.minSdkVersion=(\d+)$/m);
  assert.ok(sdk && Number(sdk[1]) >= 26, 'Minimum Android SDK configuration missing');
  const module=JSON.parse(read('modules/gaitsense-pose/expo-module.config.json'));
  assert.ok(module.android.modules.includes('expo.modules.gaitsensepose.GaitSensePoseModule'));
  const model=readFileSync(resolve(root,'modules/gaitsense-pose/android/src/main/assets/pose_landmarker_full.task'));
  assert.equal(createHash('sha256').update(model).digest('hex'),'5134a3aad27a58b93da0088d431f366da362b44e3ccfbe3462b3827a839011b1');
  for (const route of ['index','assess','dashboard','history','profile','login','register','report/[id]']) {
    assert.match(read(`src/app/${route}.android.tsx`), /Redirect href="\/offline"/);
  }
  console.log('PASS: generated privacy inputs, SDK floor, bundled model, native-module declaration and Android route isolation.');
  console.log('NOT VERIFIED HERE: Kotlin compile, final merged APK permissions, camera/inference, physical-device offline behavior.');
} catch(error) {
  console.error('Android input check failed:',error.message);
  console.error('Run npm run prepare:pose and npx expo prebuild --platform android --no-install, then retry.');
  process.exitCode=1;
}
