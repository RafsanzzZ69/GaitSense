param([string]$Apk = '', [string]$SdkRoot = '')
$ErrorActionPreference = 'Stop'
if (!$Apk) { $Apk = Join-Path (Split-Path $PSScriptRoot -Parent) 'android/app/build/outputs/apk/release/app-release.apk' }
if (!$SdkRoot) { $SdkRoot = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { Join-Path $env:LOCALAPPDATA 'Android/Sdk' } }
$aapt = Join-Path $SdkRoot 'build-tools/36.0.0/aapt2.exe'
if (!(Test-Path $Apk) -or !(Test-Path $aapt)) { throw 'Release APK or Android build-tools 36.0.0 missing.' }
$badging = & $aapt dump badging $Apk
if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect APK.' }
$text = $badging -join "`n"
if ($text -notmatch "package: name='com.gaitsense.research'") { throw 'Wrong application ID.' }
if ($text -notmatch "sdkVersion:'26'") { throw 'Unexpected minimum SDK; update documented device support after investigation.' }
if ($text -notmatch "uses-permission: name='android.permission.CAMERA'") { throw 'Camera permission missing.' }
foreach ($permission in @('INTERNET','RECORD_AUDIO','READ_MEDIA_IMAGES','READ_MEDIA_VIDEO','READ_EXTERNAL_STORAGE','WRITE_EXTERNAL_STORAGE','SYSTEM_ALERT_WINDOW')) {
  if ($text -match "uses-permission: name='android.permission.$permission'") { throw "Unexpected release permission: $permission" }
}
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [IO.Compression.ZipFile]::OpenRead((Resolve-Path $Apk))
try {
  foreach ($entry in @('assets/index.android.bundle', 'assets/pose_landmarker_full.task', 'lib/arm64-v8a/libmediapipe_tasks_vision_jni.so', 'lib/x86_64/libmediapipe_tasks_vision_jni.so')) {
    if (!$zip.GetEntry($entry)) { throw "APK is missing $entry" }
  }
  if ($zip.Entries | Where-Object { $_.FullName -match '\.(MOV|mp4)$' }) { throw 'A test/participant video was packaged in the release APK.' }
  $stream = $zip.GetEntry('assets/pose_landmarker_full.task').Open()
  $sha = [Security.Cryptography.SHA256]::Create()
  try { $hash = ([BitConverter]::ToString($sha.ComputeHash($stream))).Replace('-', '').ToLowerInvariant() }
  finally { $stream.Dispose(); $sha.Dispose() }
  if ($hash -ne '5134a3aad27a58b93da0088d431f366da362b44e3ccfbe3462b3827a839011b1') { throw 'Packaged pose model hash mismatch.' }
} finally { $zip.Dispose() }
$tree = (& $aapt dump xmltree $Apk --file AndroidManifest.xml) -join "`n"
if ($LASTEXITCODE -ne 0 -or $tree -notmatch 'android:allowBackup[^\r\n]*0x0') { throw 'APK backup disabling could not be verified.' }
Write-Output 'PASS: release APK identity, API 26 floor, offline/camera-only permissions, backup disabled, bundled JavaScript/model, arm64/x64 inference libraries and absence of participant videos.'
Get-FileHash $Apk -Algorithm SHA256 | Select-Object Path,Hash
