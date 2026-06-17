#!/usr/bin/env bash
# ======================================================================
# GeoTask AI — one-command bootstrap (macOS / Linux)
# Run from the geotask_ai/ folder:   bash tool/bootstrap.sh
# ======================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
echo "==> GeoTask AI bootstrap in $ROOT"

# 1) Flutter present?
if ! command -v flutter >/dev/null 2>&1; then
  echo "Flutter not found. Install: https://docs.flutter.dev/get-started/install" >&2
  exit 1
fi

# .env present?
if [ ! -f ".env" ]; then
  echo "No .env found — copying .env.example. EDIT IT before running the app."
  cp .env.example .env
fi

# 2) Generate native project (does not overwrite lib/)
echo "==> flutter create ."
flutter create --project-name geotask_ai --org com.geotask .

# 3) Packages
echo "==> flutter pub get"
flutter pub get

# Helper: read a key from .env
env_value() { grep -E "^$1=" .env | head -n1 | sed -E "s/^$1=//" | tr -d '\r' | xargs; }
MAPS_KEY="$(env_value GOOGLE_MAPS_API_KEY)"
[ -z "$MAPS_KEY" ] && MAPS_KEY="MISSING_GOOGLE_MAPS_API_KEY"

# 4) Android manifest
echo "==> Writing android/app/src/main/AndroidManifest.xml"
sed "s|__GOOGLE_MAPS_API_KEY__|$MAPS_KEY|g" \
  native_templates/android/AndroidManifest.xml > android/app/src/main/AndroidManifest.xml

# 4b) iOS AppDelegate
if [ -f ios/Runner/AppDelegate.swift ]; then
  echo "==> Writing ios/Runner/AppDelegate.swift"
  sed "s|__GOOGLE_MAPS_API_KEY__|$MAPS_KEY|g" \
    native_templates/ios/AppDelegate.swift > ios/Runner/AppDelegate.swift
fi

# 4c) iOS Info.plist — insert keys before the final </dict>
if [ -f ios/Runner/Info.plist ] && ! grep -q NSLocationWhenInUseUsageDescription ios/Runner/Info.plist; then
  echo "==> Patching ios/Runner/Info.plist"
  python3 - "$ROOT" <<'PY'
import sys, pathlib
root = pathlib.Path(sys.argv[1])
plist = root / "ios/Runner/Info.plist"
add = (root / "native_templates/ios/Info_additions.plist").read_text()
text = plist.read_text()
i = text.rfind("</dict>")
plist.write_text(text[:i] + add + "\n" + text[i:])
PY
fi

# 6) Bump Android minSdk to 23
for g in android/app/build.gradle.kts android/app/build.gradle; do
  if [ -f "$g" ]; then
    echo "==> Setting minSdk = 23 in $g"
    sed -i.bak -E "s/flutter\.minSdkVersion/23/; s/minSdk(Version)?[[:space:]]*=?[[:space:]]*2[012]/minSdk = 23/" "$g" && rm -f "$g.bak"
  fi
done

# 7) App icon + splash screen
echo "==> Generating app icon + splash"
dart run flutter_launcher_icons
dart run flutter_native_splash:create

echo ""
echo "✅ Bootstrap complete."
echo "Next:"
echo "  1) Configure Supabase + deploy parse-task (README)."
echo "  2) Android: enable core-library desugaring in android/app/build.gradle"
echo "     (see 'Android build note' in README.md)."
echo "  3) flutter run"
