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
if ($text -notmatch "versionCode='1' versionName='0.1.0'") { throw 'Unexpected application version.' }
if ($text -notmatch "sdkVersion:'26'") { throw 'Unexpected minimum SDK; update documented device support after investigation.' }
if ($text -notmatch "targetSdkVersion:'36'") { throw 'Unexpected target SDK.' }
if ($text -notmatch "uses-permission: name='android.permission.CAMERA'") { throw 'Camera permission missing.' }
if ($text -notmatch "uses-permission: name='android.permission.INTERNET'") { throw 'Authentication INTERNET permission missing.' }
foreach ($permission in @('RECORD_AUDIO','READ_MEDIA_AUDIO','READ_MEDIA_IMAGES','READ_MEDIA_VIDEO','MANAGE_EXTERNAL_STORAGE','READ_EXTERNAL_STORAGE','WRITE_EXTERNAL_STORAGE','SYSTEM_ALERT_WINDOW')) {
  if ($text -match "uses-permission: name='android.permission.$permission'") { throw "Unexpected release permission: $permission" }
}
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [IO.Compression.ZipFile]::OpenRead((Resolve-Path $Apk))
try {
  foreach ($entry in @('assets/index.android.bundle', 'assets/pose_landmarker_full.task', 'lib/arm64-v8a/libmediapipe_tasks_vision_jni.so', 'lib/x86_64/libmediapipe_tasks_vision_jni.so')) {
    if (!$zip.GetEntry($entry)) { throw "APK is missing $entry" }
  }
  if ($zip.Entries | Where-Object { $_.FullName -match '(?i)\.(mov|mp4|avi|mkv|webm|csv|jsonl|pkl|pickle|db|sqlite|keystore|jks|pem|key|p12|pfx)$|(^|/)(research|private|participant_data|dataset_samples)/' }) { throw 'Private media/data or key material was packaged in the release APK.' }
  $stream = $zip.GetEntry('assets/pose_landmarker_full.task').Open()
  $sha = [Security.Cryptography.SHA256]::Create()
  try { $hash = ([BitConverter]::ToString($sha.ComputeHash($stream))).Replace('-', '').ToLowerInvariant() }
  finally { $stream.Dispose(); $sha.Dispose() }
  if ($hash -ne '5134a3aad27a58b93da0088d431f366da362b44e3ccfbe3462b3827a839011b1') { throw 'Packaged pose model hash mismatch.' }
} finally { $zip.Dispose() }
$tree = (& $aapt dump xmltree $Apk --file AndroidManifest.xml) -join "`n"
if ($LASTEXITCODE -ne 0 -or $tree -notmatch 'android:allowBackup[^\r\n]*0x0') { throw 'APK backup disabling could not be verified.' }
if ($tree -notmatch 'com.google.firebase.provider.FirebaseInitProvider') { throw 'Firebase native initialization provider missing.' }
$resources = (& $aapt dump resources $Apk) -join "`n"
if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect Firebase resources.' }
foreach ($name in @('google_app_id', 'google_api_key', 'gcm_defaultSenderId', 'project_id', 'default_web_client_id')) {
  if ($resources -notmatch "string/$name(?:\s|:)") { throw "Firebase client resource missing: $name" }
}
# Inspect resource names only; never output resource/API-key values.
$apksigner = Join-Path $SdkRoot 'build-tools/36.0.0/apksigner.bat'
$signature = (& $apksigner verify --print-certs $Apk) -join "`n"
if ($LASTEXITCODE -ne 0 -or $signature -notmatch 'certificate SHA-1 digest: 5e8f16062ea3cd2c4a0d547876baa6f38cabf625' -or $signature -notmatch 'certificate SHA-256 digest: fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c') { throw 'APK signature does not match the established engineering signer.' }
Write-Output 'PASS: release identity/version/API levels/signature, auth INTERNET, forbidden permissions absent, backup disabled, Firebase provider/resource names, bundled JavaScript/model, arm64/x64 inference libraries and no private media/data/keys.'
Get-FileHash $Apk -Algorithm SHA256 | Select-Object Path,Hash
