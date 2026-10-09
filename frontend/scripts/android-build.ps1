param(
  [ValidateSet('assemble', 'test', 'install')][string]$Action = 'assemble',
  [string]$Architectures = 'arm64-v8a,x86_64',
  [hashtable]$TestRunnerArguments = @{}
)
$ErrorActionPreference = 'Stop'
# Capture native statuses ourselves, including when PS7 native-error mode is set.
$PSNativeCommandUseErrorActionPreference = $false
$script:buildExitCode = 0
function Invoke-BuildCommand {
  param([string]$File, [string[]]$Arguments, [string]$Label)
  Get-Command -Name $File -ErrorAction Stop | Out-Null
  $previousErrorAction = $ErrorActionPreference
  try {
    # Windows PowerShell can turn redirected native stderr into error records
    # even for exit zero. Judge the completed process by its native status.
    $ErrorActionPreference = 'Continue'
    $global:LASTEXITCODE = $null
    & $File @Arguments
    $nativeExitCode = $global:LASTEXITCODE
  } finally { $ErrorActionPreference = $previousErrorAction }
  if ($null -eq $nativeExitCode) { throw "$Label did not return a native exit status." }
  if ($nativeExitCode -ne 0) {
    $script:buildExitCode = $nativeExitCode
    throw "$Label failed (exit $nativeExitCode)."
  }
}
try {
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
  Invoke-BuildCommand -File node -Arguments @('scripts/prepare-pose-model.mjs') -Label 'Model preparation'
  if (!(Test-Path android/gradlew.bat)) {
    Invoke-BuildCommand -File npx.cmd -Arguments @('expo', 'prebuild', '--platform', 'android', '--no-install', '--no-clean') -Label 'Android prebuild'
  }
  Invoke-BuildCommand -File node -Arguments @('scripts/check-offline-native.mjs') -Label 'Native input checks'
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
    Invoke-BuildCommand -File .\gradlew.bat -Arguments (@($gradleTask, "-PreactNativeArchitectures=$Architectures") + $runnerArgs + @('--max-workers=2', '--console=plain')) -Label "Gradle $Action"
  } finally { Pop-Location }
} finally { Pop-Location }
Write-Output "PASS: Gradle $Action completed."
} catch {
  if ($script:buildExitCode -eq 0) { $script:buildExitCode = 1 }
  Write-Error -Message $_.Exception.Message -ErrorAction Continue
}
# An explicit exit propagates status to nested callers and -File processes;
# throwing alone can leave the caller's LASTEXITCODE at a stale successful value.
exit $script:buildExitCode
