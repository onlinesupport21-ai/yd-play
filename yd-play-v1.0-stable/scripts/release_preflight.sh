#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

fail=0
need_file() {
  if [[ ! -f "$1" ]]; then echo "MISSING: $1"; fail=1; fi
}

for f in   services/api/db/001_core.sql   services/api/db/002_referrals.sql   services/api/db/003_games.sql   services/api/db/004_multiplayer.sql   services/api/db/005_admin_ops.sql   services/api/db/006_engagement.sql   docs/openapi.yaml   .env.production.example   apps/mobile/tool/build_release_candidate.sh   apps/mobile/android/app/src/main/res/xml/network_security_config.xml
do
  need_file "$f"
done

if grep -R --line-number --exclude-dir=.git --exclude='*.example'   -E 'BEGIN (RSA|OPENSSH|EC) PRIVATE KEY|AKIA[0-9A-Z]{16}' .; then
  echo "Potential secret material found." >&2
  fail=1
fi

if [[ -f package-lock.json ]]; then
  echo "Dependency lockfile: present"
else
  echo "Dependency lockfile: NOT PRESENT (must be generated/pinned before public release)"
fi

if [[ "$fail" -ne 0 ]]; then
  echo "Preflight failed." >&2
  exit 1
fi

echo "Static release preflight passed. Runtime/build/security/legal gates remain as documented."
