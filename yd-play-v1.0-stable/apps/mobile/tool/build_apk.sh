#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v flutter >/dev/null 2>&1; then
  echo "Flutter SDK is required (stable channel recommended)." >&2
  exit 1
fi

./tool/prepare_android.sh

MODE="${1:-debug}"
API_URL="${YD_API_URL:-http://10.0.2.2:3000/v1}"
WS_URL="${YD_WS_URL:-ws://10.0.2.2:3001/ws}"

flutter pub get
flutter analyze
flutter test

case "$MODE" in
  debug|release) ;;
  *) echo "Usage: $0 [debug|release]" >&2; exit 2 ;;
esac

flutter build apk --"$MODE" \
  --dart-define=YD_API_URL="$API_URL" \
  --dart-define=YD_WS_URL="$WS_URL"

APK="build/app/outputs/flutter-apk/app-$MODE.apk"
if [[ ! -f "$APK" ]]; then
  echo "Expected APK not found: $APK" >&2
  exit 3
fi

sha256sum "$APK"
echo "APK: $APK"
