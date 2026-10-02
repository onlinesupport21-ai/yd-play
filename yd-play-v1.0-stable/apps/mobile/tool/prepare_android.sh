#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v flutter >/dev/null 2>&1; then
  echo "Flutter SDK is required." >&2
  exit 1
fi

if [[ -f android/gradlew ]]; then
  exit 0
fi

echo "Android Gradle wrapper is missing; generating Flutter platform glue while preserving YD Play custom Android files."
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

files=(
  android/app/build.gradle
  android/app/proguard-rules.pro
  android/build.gradle
  android/settings.gradle
  android/gradle.properties
  android/app/src/main/AndroidManifest.xml
  android/app/src/debug/AndroidManifest.xml
  android/app/src/main/kotlin/com/ydplay/app/MainActivity.kt
  android/app/src/main/res/drawable/ic_launcher.xml
  android/app/src/main/res/drawable/launch_background.xml
  android/app/src/main/res/values/styles.xml
  android/app/src/main/res/values-v31/styles.xml
  android/app/src/main/res/xml/data_extraction_rules.xml
  android/app/src/main/res/xml/network_security_config.xml
)

for f in "${files[@]}"; do
  if [[ -f "$f" ]]; then
    mkdir -p "$tmp/$(dirname "$f")"
    cp "$f" "$tmp/$f"
  fi
done

flutter create --platforms=android --org com.ydplay --project-name yd_play .

for f in "${files[@]}"; do
  if [[ -f "$tmp/$f" ]]; then
    mkdir -p "$(dirname "$f")"
    cp "$tmp/$f" "$f"
  fi
done
