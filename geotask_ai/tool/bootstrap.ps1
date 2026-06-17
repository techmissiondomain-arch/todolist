# ======================================================================
# GeoTask AI — one-command bootstrap (Windows / PowerShell)
# ----------------------------------------------------------------------
# Run from the geotask_ai/ folder:   ./tool/bootstrap.ps1
#
# It will:
#   1) verify Flutter is installed
#   2) generate the native android/ ios/ folders (flutter create .)
#   3) fetch packages (flutter pub get)
#   4) drop in our native config (manifest, Info.plist, AppDelegate)
#   5) inject your Google Maps key from .env
#   6) bump Android minSdk to 23
# ======================================================================

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
Write-Host "==> GeoTask AI bootstrap in $root" -ForegroundColor Cyan

# 1) Flutter present?
if (-not (Get-Command flutter -ErrorAction SilentlyContinue)) {
    Write-Error "Flutter not found. Install it first: https://docs.flutter.dev/get-started/install"
}

# .env present?
if (-not (Test-Path ".env")) {
    Write-Host "No .env found — copying .env.example. EDIT IT before running the app." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
}

# 2) Generate native project (does not overwrite lib/)
Write-Host "==> flutter create ." -ForegroundColor Cyan
flutter create --project-name geotask_ai --org com.geotask .

# 3) Packages
Write-Host "==> flutter pub get" -ForegroundColor Cyan
flutter pub get

# Helper: read a key from .env
function Get-EnvValue($key) {
    $line = (Get-Content ".env" | Where-Object { $_ -match "^$key=" } | Select-Object -First 1)
    if ($line) { return ($line -replace "^$key=", "").Trim() }
    return ""
}
$mapsKey = Get-EnvValue "GOOGLE_MAPS_API_KEY"
if (-not $mapsKey) { $mapsKey = "MISSING_GOOGLE_MAPS_API_KEY" }

# 4) Android manifest
$androidManifest = "android/app/src/main/AndroidManifest.xml"
Write-Host "==> Writing $androidManifest" -ForegroundColor Cyan
$manifest = Get-Content "native_templates/android/AndroidManifest.xml" -Raw
$manifest = $manifest.Replace("__GOOGLE_MAPS_API_KEY__", $mapsKey)
Set-Content -Path $androidManifest -Value $manifest -Encoding UTF8

# 4b) iOS AppDelegate
$appDelegate = "ios/Runner/AppDelegate.swift"
if (Test-Path $appDelegate) {
    Write-Host "==> Writing $appDelegate" -ForegroundColor Cyan
    $swift = Get-Content "native_templates/ios/AppDelegate.swift" -Raw
    $swift = $swift.Replace("__GOOGLE_MAPS_API_KEY__", $mapsKey)
    Set-Content -Path $appDelegate -Value $swift -Encoding UTF8
}

# 4c) iOS Info.plist — insert our keys before the final </dict>
$infoPlist = "ios/Runner/Info.plist"
if (Test-Path $infoPlist) {
    Write-Host "==> Patching $infoPlist" -ForegroundColor Cyan
    $additions = Get-Content "native_templates/ios/Info_additions.plist" -Raw
    $plist = Get-Content $infoPlist -Raw
    if ($plist -notmatch "NSLocationWhenInUseUsageDescription") {
        $idx = $plist.LastIndexOf("</dict>")
        if ($idx -ge 0) {
            $plist = $plist.Substring(0, $idx) + $additions + "`n" + $plist.Substring($idx)
            Set-Content -Path $infoPlist -Value $plist -Encoding UTF8
        }
    } else {
        Write-Host "   (location keys already present, skipping)" -ForegroundColor DarkGray
    }
}

# 6) Bump Android minSdk to 23 (geolocator background needs >= 21; 23 is safe)
foreach ($g in @("android/app/build.gradle.kts", "android/app/build.gradle")) {
    if (Test-Path $g) {
        Write-Host "==> Setting minSdk = 23 in $g" -ForegroundColor Cyan
        $content = Get-Content $g -Raw
        $content = $content -replace "flutter\.minSdkVersion", "23"
        $content = $content -replace "minSdk(Version)?\s*=?\s*2[012]", "minSdk = 23"
        Set-Content -Path $g -Value $content -Encoding UTF8
    }
}

Write-Host ""
Write-Host "✅ Bootstrap complete." -ForegroundColor Green
Write-Host "Next:"
Write-Host "  1) Make sure .env has your Supabase + Maps + AI values."
Write-Host "  2) Run the Supabase schema + deploy the parse-task function (see README)."
Write-Host "  3) IMPORTANT (Android): enable core-library desugaring in"
Write-Host "     android/app/build.gradle  -> see 'Android build note' in README.md" -ForegroundColor Yellow
Write-Host "  4) flutter run"
