#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MOBILE="$ROOT/apps/mobile"
TOOLS="$HOME/.local/share/yd-play-build"
FLUTTER_DIR="$TOOLS/flutter"
ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"

export ANDROID_HOME
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$FLUTTER_DIR/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"

echo "== YD Play zero-cost Ubuntu APK builder =="

sudo apt-get update
sudo apt-get install -y \
  curl git unzip xz-utils zip libglu1-mesa \
  openjdk-17-jdk ca-certificates python3

mkdir -p "$TOOLS" "$ANDROID_HOME"

if ! command -v flutter >/dev/null 2>&1; then
  if [[ ! -d "$FLUTTER_DIR/.git" ]]; then
    echo "Installing Flutter stable..."
    git clone --depth 1 --branch stable https://github.com/flutter/flutter.git "$FLUTTER_DIR"
  fi
fi

export PATH="$FLUTTER_DIR/bin:$PATH"
flutter --version

if ! command -v sdkmanager >/dev/null 2>&1; then
  echo "Installing Android command-line tools..."
  TMP="$(mktemp -d)"
  curl -fsSL https://dl.google.com/android/repository/repository2-1.xml -o "$TMP/repository2-1.xml"

  python3 - "$TMP/repository2-1.xml" "$TMP/url.txt" <<'PY'
import sys, xml.etree.ElementTree as ET
src, out = sys.argv[1], sys.argv[2]
root = ET.parse(src).getroot()
best = None
for pkg in root.findall('.//remotePackage'):
    if pkg.attrib.get('path') != 'cmdline-tools;latest':
        continue
    for arch in pkg.findall('.//archive'):
        if arch.findtext('./host-os') == 'linux':
            u = arch.findtext('./complete/url')
            if u:
                best = u
                break
if not best:
    raise SystemExit("Android command-line tools URL not found")
open(out, 'w').write(best)
PY

  URL="$(cat "$TMP/url.txt")"
  curl -fsSL "https://dl.google.com/android/repository/$URL" -o "$TMP/tools.zip"
  mkdir -p "$ANDROID_HOME/cmdline-tools/latest"
  unzip -q "$TMP/tools.zip" -d "$TMP/unpacked"
  if [[ -d "$TMP/unpacked/cmdline-tools" ]]; then
    cp -a "$TMP/unpacked/cmdline-tools/." "$ANDROID_HOME/cmdline-tools/latest/"
  else
    cp -a "$TMP/unpacked/." "$ANDROID_HOME/cmdline-tools/latest/"
  fi
  rm -rf "$TMP"
fi

export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"

yes | sdkmanager --licenses >/dev/null || true
sdkmanager "platform-tools" "platforms;android-35" "build-tools;35.0.0"
flutter config --android-sdk "$ANDROID_HOME"

cd "$MOBILE"

if [[ -x tool/prepare_android.sh ]]; then
  ./tool/prepare_android.sh
fi

flutter pub get
flutter analyze
flutter test

API_URL="${YD_API_URL:-http://10.0.2.2:3000/v1}"
WS_URL="${YD_WS_URL:-ws://10.0.2.2:3001/ws}"

flutter build apk --debug \
  --dart-define=YD_API_URL="$API_URL" \
  --dart-define=YD_WS_URL="$WS_URL"

APK="$MOBILE/build/app/outputs/flutter-apk/app-debug.apk"
OUT="$ROOT/YD-Play-debug.apk"
cp "$APK" "$OUT"
sha256sum "$OUT" | tee "$OUT.sha256"

echo
echo "APK READY: $OUT"
echo "SHA256: $(cut -d' ' -f1 "$OUT.sha256")"
