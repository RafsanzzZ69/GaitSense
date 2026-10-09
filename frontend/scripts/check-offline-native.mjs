// Checks generated inputs, not a substitute for Gradle or physical-device tests.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { checkFirebaseBase } from './check-firebase-base.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => readFileSync(resolve(root,path),'utf8');

// Use the project's existing TS parser so quotes, whitespace and local import
// aliases do not define the Android route contract. This is a source preflight;
// behavioral navigation/lifecycle coverage remains in home-navigation tests.
function parse(read, path) {
  const source = ts.createSourceFile(path, read(path), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  assert.equal(source.parseDiagnostics.length, 0, `Cannot parse ${path}`);
  return source;
}
function nodes(source, predicate) {
  const found = [];
  const visit = node => { if (predicate(node)) found.push(node); ts.forEachChild(node, visit); };
  visit(source);
  return found;
}
function imports(source, moduleName, importedName = 'default') {
  return source.statements.filter(ts.isImportDeclaration).flatMap(node => {
    if (node.moduleSpecifier.text !== moduleName) return [];
    const clause = node.importClause;
    if (importedName === 'default') return clause?.name ? [clause.name.text] : [];
    const bindings = clause?.namedBindings;
    return bindings && ts.isNamedImports(bindings)
      ? bindings.elements.filter(item => (item.propertyName ?? item.name).text === importedName).map(item => item.name.text) : [];
  });
}
function exposesDefault(source, moduleName) {
  const bindings = imports(source, moduleName);
  return source.statements.some(node =>
    (ts.isExportDeclaration(node) && node.moduleSpecifier?.text === moduleName &&
      node.exportClause && ts.isNamedExports(node.exportClause) && node.exportClause.elements.some(item =>
        item.name.text === 'default' && (item.propertyName ?? item.name).text === 'default')) ||
    (ts.isExportAssignment(node) && !node.isExportEquals && ts.isIdentifier(node.expression) && bindings.includes(node.expression.text)));
}
function jsxOpenings(source, names) {
  return nodes(source, node => (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
    ts.isIdentifier(node.tagName) && names.includes(node.tagName.text));
}

export function checkAndroidRoutes(read) {
  assert.ok(exposesDefault(parse(read, 'src/app/index.android.tsx'), '@/home/HomeScreen'), 'Android index must expose HomeScreen');
  const home = parse(read, 'src/home/HomeScreen.tsx');
  const routerHooks = imports(home, 'expo-router', 'useRouter');
  const routers = nodes(home, node => ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) &&
    node.initializer && ts.isCallExpression(node.initializer) && ts.isIdentifier(node.initializer.expression) &&
    routerHooks.includes(node.initializer.expression.text)).map(node => node.name.text);
  assert.ok(nodes(home, node => ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) &&
    ts.isIdentifier(node.expression.expression) && routers.includes(node.expression.expression.text) &&
    node.expression.name.text === 'push' && node.arguments[0] && ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text === '/offline').length,
  'Home must enter /offline through Expo Router');
  const forbiddenHomeImports = home.statements.filter(ts.isImportDeclaration).filter(node =>
    /^(expo-camera|expo-video)$|OfflineCapture|gaitsense-pose/.test(node.moduleSpecifier.text));
  assert.equal(forbiddenHomeImports.length, 0, 'Home must not own camera or measurement implementation');

  const workspace = parse(read, 'src/app/offline.android.tsx');
  assert.equal(jsxOpenings(workspace, imports(workspace, '@/offline/OfflineCapture')).length, 1,
    '/offline must mount exactly one existing OfflineCapture');
  assert.ok(exposesDefault(parse(read, 'src/app/offline.tsx'), '@/offline/OfflineCapture'),
    'Generic /offline must retain OfflineCapture');
  for (const route of ['assess','dashboard','history','profile','login','register','report/[id]']) {
    const source = parse(read, `src/app/${route}.android.tsx`);
    const redirects = jsxOpenings(source, imports(source, 'expo-router', 'Redirect'));
    assert.equal(redirects.length, 1, `Legacy Android ${route} must retain its redirect`);
    assert.ok(redirects[0].attributes.properties.some(attribute => ts.isJsxAttribute(attribute) &&
      attribute.name.text === 'href' && attribute.initializer && ts.isStringLiteral(attribute.initializer) && attribute.initializer.text === '/offline'),
    `Legacy Android ${route} must redirect to /offline`);
  }
}

// The CLI computes this digest from the actual bundled bytes. Keeping input
// validation callable lets tests mutate individual contracts without generating
// an Android project or bundling a model fixture in the test suite.
export function checkOfflineNativeInputs(read, modelHash) {
  const release=read('android/app/src/release/AndroidManifest.xml');
  assert.doesNotMatch(release, /android:name="android.permission.INTERNET"/, 'Release overlay must permit authentication networking');
  assert.match(release, /android:name="android.permission.SYSTEM_ALERT_WINDOW"\s+tools:node="remove"/);
  const main=read('android/app/src/main/AndroidManifest.xml');
  assert.match(main, /android:allowBackup="false"/);
  assert.match(main, /android:name="android.permission.RECORD_AUDIO"\s+tools:node="remove"/);
  assert.match(main, /android:name="android.permission.INTERNET"\s*\/>/, 'Main manifest must request authentication networking');
  for (const permission of ['READ_MEDIA_IMAGES', 'READ_MEDIA_VIDEO', 'READ_EXTERNAL_STORAGE', 'WRITE_EXTERNAL_STORAGE']) {
    assert.match(main, new RegExp(`android:name="android.permission.${permission}"\\s+tools:node="remove"`), `Retain ${permission} removal`);
  }
  const sdk=read('android/gradle.properties').match(/^android.minSdkVersion=(\d+)$/m);
  assert.ok(sdk && Number(sdk[1]) >= 26, 'Minimum Android SDK configuration missing');
  const jvm = read('android/gradle.properties').match(/^org.gradle.jvmargs=(.+)$/m)?.[1];
  assert.ok(jvm && /(?:^|\s)-XX:MaxMetaspaceSize=1024m(?:\s|$)/.test(jvm), 'Generated Gradle must use the bounded 1024m Metaspace budget');
  const module=JSON.parse(read('modules/gaitsense-pose/expo-module.config.json'));
  assert.ok(module.android.modules.includes('expo.modules.gaitsensepose.GaitSensePoseModule'));
  assert.equal(modelHash,'5134a3aad27a58b93da0088d431f366da362b44e3ccfbe3462b3827a839011b1');
  checkFirebaseBase(read);
  // Expo supplies its Google-services version before RN Firebase's idempotent
  // plugin runs. Verify one versioned declaration; report resolution in Gradle.
  assert.equal((read('android/build.gradle').match(/classpath\s*\(?\s*['"]com\.google\.gms:google-services:\d+\.\d+\.\d+['"]/g) ?? []).length, 1, 'Generated Google services classpath must appear exactly once');
  assert.equal((read('android/app/build.gradle').match(/apply plugin:\s*['"]com\.google\.gms\.google-services['"]/g) ?? []).length, 1, 'Generated Google services plugin must appear exactly once');
  assert.ok(read('android/app/google-services.json') === read('google-services.json'), 'Generated Firebase configuration must match owner-provisioned file');
  checkAndroidRoutes(read);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
try {
  const model=readFileSync(resolve(root,'modules/gaitsense-pose/android/src/main/assets/pose_landmarker_full.task'));
  checkOfflineNativeInputs(read, createHash('sha256').update(model).digest('hex'));
  console.log('PASS: Firebase App/Auth provisioning, generated Google services integration, auth networking, privacy inputs, SDK floor, bundled model, native-module declaration and Android route isolation.');
  console.log('NOT VERIFIED HERE: Kotlin compile, final merged APK permissions, camera/inference, physical-device offline behavior.');
} catch(error) {
  console.error('Android input check failed:',error.message);
  console.error('Inspect the named input/route failure. Prepare the model or regenerate native inputs only if those inputs are missing or stale.');
  process.exitCode=1;
}
}
