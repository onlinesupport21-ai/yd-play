#!/usr/bin/env bash
set -euo pipefail

API_URL="${YD_API_URL:-}"
WS_URL="${YD_WS_URL:-}"

if [[ -z "$API_URL" || -z "$WS_URL" ]]; then
  echo "YD_API_URL and YD_WS_URL are required." >&2
  exit 2
fi
if [[ "$API_URL" != https://* ]]; then
  echo "Release candidate requires YD_API_URL=https://..." >&2
  exit 2
fi
if [[ "$WS_URL" != wss://* ]]; then
  echo "Release candidate requires YD_WS_URL=wss://..." >&2
  exit 2
fi
if [[ "$API_URL" == *localhost* || "$API_URL" == *10.0.2.2* || "$WS_URL" == *localhost* || "$WS_URL" == *10.0.2.2* ]]; then
  echo "Release candidate cannot point to localhost/emulator endpoints." >&2
  exit 2
fi

flutter pub get
flutter analyze
flutter test
flutter build apk --release \
  --dart-define=YD_API_URL="$API_URL" \
  --dart-define=YD_WS_URL="$WS_URL"

APK="build/app/outputs/flutter-apk/app-release.apk"
sha256sum "$APK" > "$APK.sha256"
echo "Built: $APK"
cat "$APK.sha256"
