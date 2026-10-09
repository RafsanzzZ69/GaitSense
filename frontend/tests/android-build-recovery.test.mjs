import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
function applyProperties(properties) {
  let action;
  const require = createRequire(import.meta.url);
  const module = { exports: {} };
  vm.runInNewContext(read('plugins/withOfflinePrivacy.cjs'), { module, require: name => name === 'expo/config-plugins'
    ? { withGradleProperties: (config, callback) => { action = callback; return config; }, withAndroidManifest: config => config, withDangerousMod: config => config }
    : require(name) });
  module.exports({});
  return action({ modResults: properties }).modResults;
}
test('tracked plugin raises only Metaspace, preserving heap and other JVM flags', () => {
  const properties = [{ type: 'property', key: 'org.gradle.jvmargs', value: '-Xmx2048m -XX:MaxMetaspaceSize=512m -Dfile.encoding=UTF-8' }];
  applyProperties(properties);
  assert.equal(properties[0].value, '-Xmx2048m -Dfile.encoding=UTF-8 -XX:MaxMetaspaceSize=1024m');
});
test('resource plugin is idempotent and keeps a deliberately configured heap', () => {
  const properties = [{ type: 'property', key: 'org.gradle.jvmargs', value: '-Xmx1536m -XX:MaxMetaspaceSize=512m' }];
  applyProperties(properties); applyProperties(properties);
  assert.equal(properties[0].value, '-Xmx1536m -XX:MaxMetaspaceSize=1024m');
  assert.equal(properties.filter(item => item.key === 'org.gradle.jvmargs').length, 1);
});
test('fresh generation gets the current bounded heap/Metaspace defaults', () => {
  const properties = applyProperties([]);
  assert.equal(properties.find(item => item.key === 'org.gradle.jvmargs').value, '-Xmx2048m -XX:MaxMetaspaceSize=1024m');
});

const windows = process.platform === 'win32';
const hosts = windows ? [
  ['PowerShell 7', 'pwsh.exe'],
  ['Windows PowerShell', join(process.env.WINDIR, 'System32/WindowsPowerShell/v1.0/powershell.exe')],
] : [['Windows build helper', 'pwsh']];
function runFixture(host, { gradleExit = 0, nodeExit = 0, pipe = false, missingSdk = false, nativeErrorMode = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'gaitsense-build-status-'));
  const frontend = join(root, 'frontend');
  const scripts = join(frontend, 'scripts');
  const android = join(frontend, 'android');
  const tools = join(root, 'tools');
  const jdk = join(root, 'jdk');
  const sdk = join(root, 'sdk');
  try {
    for (const directory of [scripts, android, tools, join(jdk, 'bin'), join(sdk, 'platform-tools')]) mkdirSync(directory, { recursive: true });
    copyFileSync(new URL('../scripts/android-build.ps1', import.meta.url), join(scripts, 'android-build.ps1'));
    writeFileSync(join(jdk, 'bin/java.exe'), '');
    if (!missingSdk) writeFileSync(join(sdk, 'platform-tools/adb.exe'), '');
    // Actual native batch processes, not mocked PowerShell LASTEXITCODE values.
    writeFileSync(join(tools, 'node.cmd'), '@echo off\r\nexit /b %GAITSENSE_TEST_NODE_EXIT%\r\n');
    writeFileSync(join(android, 'gradlew.bat'), '@echo off\r\necho GRADLE_ARGS:%*\r\necho native diagnostic 1>&2\r\nexit /b %GAITSENSE_TEST_GRADLE_EXIT%\r\n');
    const quote = value => "'" + value.replaceAll("'", "''") + "'";
    const log = join(root, 'build.log');
    const caller = join(root, 'caller.ps1');
    writeFileSync(caller, `$ErrorActionPreference='Continue'\n$PSNativeCommandUseErrorActionPreference=$${nativeErrorMode ? 'true' : 'false'}\n$global:LASTEXITCODE=0\n$before=(Get-Location).Path\n& ${quote(join(scripts, 'android-build.ps1'))}${pipe ? ` 2>&1 | Tee-Object -FilePath ${quote(log)} | Out-Null` : ` *> ${quote(log)}`}\n$status=$LASTEXITCODE\nWrite-Output ('RESULT:'+ $status)\nWrite-Output ('RESTORED:'+ ((Get-Location).Path -eq $before))\nGet-Content -LiteralPath ${quote(log)}\nexit $status\n`);
    const result = spawnSync(host, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', caller], {
      cwd: root, encoding: 'utf8', timeout: 30000,
      env: { ...process.env, JAVA_HOME: jdk, ANDROID_HOME: sdk, PATH: tools + ';' + process.env.PATH,
        GAITSENSE_TEST_GRADLE_EXIT: String(gradleExit), GAITSENSE_TEST_NODE_EXIT: String(nodeExit) },
    });
    assert.ifError(result.error);
    return { status: result.status, output: result.stdout + result.stderr };
  } finally { rmSync(root, { recursive: true, force: true }); }
}
for (const [label, host] of hosts) {
  for (const pipe of [false, true]) {
    test(`${label}: successful native helper exits zero${pipe ? ' through Tee-Object' : ''}`, { skip: !windows }, () => {
      const result = runFixture(host, { pipe });
      assert.equal(result.status, 0, result.output);
      assert.match(result.output, /PASS: Gradle assemble completed/);
      assert.match(result.output, /RESTORED:True/);
      assert.match(result.output, /:app:assembleRelease/);
      assert.match(result.output, /--max-workers=2 --console=plain/);
    });
    test(`${label}: native Gradle failure retains exit 7${pipe ? ' through Tee-Object' : ''}`, { skip: !windows }, () => {
      const result = runFixture(host, { gradleExit: 7, pipe });
      assert.equal(result.status, 7, result.output);
      assert.match(result.output, /Gradle assemble\s+failed \(exit 7\)/);
      assert.doesNotMatch(result.output, /PASS: Gradle/);
      assert.match(result.output, /RESTORED:True/);
    });
  }
  test(`${label}: failing preparation stops before Gradle with native exit 9`, { skip: !windows }, () => {
    const result = runFixture(host, { nodeExit: 9 });
    assert.equal(result.status, 9, result.output);
    assert.doesNotMatch(result.output, /GRADLE_ARGS/);
  });
  test(`${label}: non-native setup error exits nonzero`, { skip: !windows }, () => {
    const result = runFixture(host, { missingSdk: true });
    assert.equal(result.status, 1, result.output);
    assert.match(result.output, /platform-tools are missing/);
  });
}
test('PowerShell native-error preference cannot mask Gradle status through logging', { skip: !windows }, () => {
  const result = runFixture('pwsh.exe', { gradleExit: 7, pipe: true, nativeErrorMode: true });
  assert.equal(result.status, 7, result.output);
});
