#!/usr/bin/env bash
set -euo pipefail

# YD Play remote Android build bootstrap.
# Intended for a fresh Debian/Ubuntu cloud workspace with outbound internet access.
# Produces apps/mobile/build/app/outputs/flutter-apk/app-debug.apk by default.

MODE="${1:-debug}"
case "$MODE" in debug|release) ;; *) echo "Usage: $0 [debug|release]" >&2; exit 2;; esac

API_URL="${YD_API_URL:-http://127.0.0.1:3000/v1}"
WS_URL="${YD_WS_URL:-ws://127.0.0.1:3001/ws}"

if [[ "$MODE" == "release" ]]; then
  if [[ "${YD_API_URL:-}" != https://* || "${YD_WS_URL:-}" != wss://* ]]; then
    echo "Release builds require explicit YD_API_URL=https://... and YD_WS_URL=wss://..." >&2
    exit 2
  fi
  if [[ "$API_URL" == *localhost* || "$API_URL" == *127.0.0.1* || "$API_URL" == *10.0.2.2* || "$WS_URL" == *localhost* || "$WS_URL" == *127.0.0.1* || "$WS_URL" == *10.0.2.2* ]]; then
    echo "Release builds cannot use local/emulator backend addresses." >&2
    exit 2
  fi
fi

ROOT_DIR="$(cd "$(dirname "$0")/../../.." && pwd)"
MOBILE_DIR="$ROOT_DIR/apps/mobile"
TOOLS_DIR="${YD_TOOLS_DIR:-$HOME/yd-build-tools}"
ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$TOOLS_DIR/android-sdk}"
FLUTTER_HOME="${FLUTTER_HOME:-$TOOLS_DIR/flutter}"
CMDLINE_TOOLS_URL="${ANDROID_CMDLINE_TOOLS_URL:-https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip}"

export ANDROID_SDK_ROOT
export ANDROID_HOME="$ANDROID_SDK_ROOT"
export PATH="$FLUTTER_HOME/bin:$ANDROID_SDK_ROOT/cmdline-tools/latest/bin:$ANDROID_SDK_ROOT/platform-tools:$PATH"

need_cmd() { command -v "$1" >/dev/null 2>&1; }

if [[ "$(id -u)" -eq 0 ]]; then SUDO=""; else SUDO="sudo"; fi

if ! need_cmd curl || ! need_cmd unzip || ! need_cmd git || ! need_cmd xz || ! need_cmd java; then
  $SUDO apt-get update
  DEBIAN_FRONTEND=noninteractive $SUDO apt-get install -y \
    ca-certificates curl git unzip xz-utils zip libglu1-mesa openjdk-17-jdk
fi

mkdir -p "$TOOLS_DIR" "$ANDROID_SDK_ROOT/cmdline-tools"

if [[ ! -x "$FLUTTER_HOME/bin/flutter" ]]; then
  git clone --depth 1 --branch stable https://github.com/flutter/flutter.git "$FLUTTER_HOME"
fi

if [[ ! -x "$ANDROID_SDK_ROOT/cmdline-tools/latest/bin/sdkmanager" ]]; then
  TMP_ZIP="$(mktemp --suffix=.zip)"
  TMP_DIR="$(mktemp -d)"
  curl -fL "$CMDLINE_TOOLS_URL" -o "$TMP_ZIP"
  unzip -q "$TMP_ZIP" -d "$TMP_DIR"
  rm -rf "$ANDROID_SDK_ROOT/cmdline-tools/latest"
  mv "$TMP_DIR/cmdline-tools" "$ANDROID_SDK_ROOT/cmdline-tools/latest"
  rm -f "$TMP_ZIP"
  rm -rf "$TMP_DIR"
fi

yes | sdkmanager --licenses >/dev/null || true
sdkmanager \
  "platform-tools" \
  "platforms;android-35" \
  "build-tools;35.0.0" \
  "cmdline-tools;latest"

flutter config --android-sdk "$ANDROID_SDK_ROOT"
flutter precache --android
flutter doctor -v

cd "$MOBILE_DIR"
./tool/prepare_android.sh
flutter pub get
flutter analyze
flutter test
flutter build apk --"$MODE" \
  --dart-define=YD_API_URL="$API_URL" \
  --dart-define=YD_WS_URL="$WS_URL"

APK="$MOBILE_DIR/build/app/outputs/flutter-apk/app-$MODE.apk"
test -f "$APK"
sha256sum "$APK" | tee "$APK.sha256"
printf '\nYD Play APK ready:\n%s\n' "$APK"
