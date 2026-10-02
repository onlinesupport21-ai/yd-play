# YD Play v1.0.0 — Stable Source Release

YD Play is a non-real-money virtual-coin gaming platform. Virtual coins have no real-world value, cannot be deposited, transferred for money, or cashed out.

## v0.9 adds

- Claimable missions with one-time/daily/weekly periods.
- Claimable achievements.
- Server-validated Pulse Grid daily, weekly and all-time leaderboards.
- Idempotent engagement event processing, preventing duplicate progress on completion retries.
- Authenticated, deduplicated analytics-event ingestion.
- Admin analytics event summary.
- In-app notification inbox for mobile.
- Admin campaign dispatch to active-user inboxes.
- Provider-neutral external push bridge with encrypted push-token storage.
- User report history/status.
- Mobile Safety & reports screen.
- Signal Clash opponent reporting from the active room.
- Migration `006_engagement.sql`.

## Preserved

Everything from v0.2–v0.8 remains: user auth, rotating sessions, device proof, balanced virtual-coin ledger, referrals/anti-abuse, Pulse Grid, Signal Clash, Flutter Android client/APK pipeline, admin/RBAC/moderation, REST API, WebSockets, PostgreSQL and Redis.

## Local stack

```bash
cp .env.example .env
# Replace all JWT/admin secrets before use.
# For push-device registration also set a real 32-byte base64 PUSH_TOKEN_ENCRYPTION_KEY.
docker compose up --build
```

Create the first named admin after migrations:

```bash
export DATABASE_URL=postgresql://ydplay:ydplay_dev@localhost:5432/ydplay
npm --workspace @ydplay/api run admin:create -- \
  admin@example.com 'replace-with-a-long-password' super_admin 'YD Play Owner'
```

Admin UI default: `http://localhost:3002`

See `docs/V0.9.md`, `docs/ADMIN.md`, `docs/MOBILE.md`, and `BUILD_STATUS.md`.


## v1.0 RC1 release hardening

- release APK endpoint guard: HTTPS/WSS only, no localhost/emulator addresses
- production secret validation for API and realtime services
- liveness/readiness endpoints
- Android network security configuration (cleartext disabled)
- in-app About/Privacy/Legal summary
- global Flutter error boundary for uncaught framework/platform errors
- production environment template
- release QA workflow with PostgreSQL + Redis services
- signed release-candidate build script and checksum generation
- production deployment and rollback runbook

This is still a release candidate: final jurisdiction-specific legal review, penetration testing,
real-device QA, and a successfully compiled/signed APK remain release gates.


## Zero-cost Ubuntu APK build

Run:

```bash
chmod +x scripts/ubuntu_build_apk.sh
./scripts/ubuntu_build_apk.sh
```

The script installs Flutter stable and Android command-line tools if they are missing, runs
analysis/tests, and creates `YD-Play-debug.apk` in the project root.

For a phone that must reach a backend on the same LAN, set `YD_API_URL` and `YD_WS_URL`
to the Ubuntu machine's LAN address before running the script.
