param(
  [ValidateSet('assemble', 'test', 'install')][string]$Action = 'assemble',
  [string]$Architectures = 'arm64-v8a,x86_64',
  [hashtable]$TestRunnerArguments = @{}
)
$ErrorActionPreference = 'Stop'
$frontendRoot = Split-Path $PSScriptRoot -Parent
if (!$env:JAVA_HOME) {
  $portableJdk = Join-Path $env:LOCALAPPDATA 'GaitSenseBuild\jdk'
  if (Test-Path $portableJdk) {
    $env:JAVA_HOME = (Get-ChildItem $portableJdk -Directory | Sort-Object Name -Descending | Select-Object -First 1).FullName
  }
}
if (!$env:JAVA_HOME -or !(Test-Path "$env:JAVA_HOME\bin\java.exe")) { throw 'Install JDK 21 and set JAVA_HOME first.' }
if (!$env:ANDROID_HOME) { $env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
if (!(Test-Path "$env:ANDROID_HOME\platform-tools\adb.exe")) { throw 'Android SDK platform-tools are missing.' }
$env:PATH = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:PATH"
$env:NODE_ENV = 'production'
Push-Location $frontendRoot
try {
  & node scripts/prepare-pose-model.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Model preparation failed.' }
  if (!(Test-Path android/gradlew.bat)) {
    & npx.cmd expo prebuild --platform android --no-install
    if ($LASTEXITCODE -ne 0) { throw 'Android prebuild failed.' }
  }
  & node scripts/check-offline-native.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Native input checks failed.' }
  $gradleTask = switch ($Action) {
    'assemble' { ':app:assembleRelease' }
    'install' { ':app:installRelease' }
    'test' { ':gaitsense-pose:connectedDebugAndroidTest' }
  }
  if ($Action -eq 'test') {
    $fixtureDir = 'modules/gaitsense-pose/android/src/androidTest/assets'
    foreach ($name in @('walking.MOV', 'short.MOV', 'full-duration.MOV')) {
      if (!(Test-Path "$fixtureDir/$name")) { throw "Missing private test fixture: $fixtureDir/$name. See docs/OFFLINE_ANDROID.md." }
    }
  }
  Push-Location android
  try {
    $runnerArgs = @()
    if ($Action -eq 'test') {
      foreach ($key in $TestRunnerArguments.Keys) {
        $runnerArgs += "-Pandroid.testInstrumentationRunnerArguments.$key=$($TestRunnerArguments[$key])"
      }
    }
    & .\gradlew.bat $gradleTask "-PreactNativeArchitectures=$Architectures" @runnerArgs --max-workers=2 --console=plain
    if ($LASTEXITCODE -ne 0) { throw "Gradle $Action failed." }
  } finally { Pop-Location }
} finally { Pop-Location }
