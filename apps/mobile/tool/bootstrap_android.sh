#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
./tool/prepare_android.sh
flutter pub get
flutter analyze
flutter test
