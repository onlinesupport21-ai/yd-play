# Production deployment runbook

## 1. Infrastructure
Use PostgreSQL, Redis, API, realtime service and admin web app. Put API and realtime
behind TLS-terminating reverse proxy/load balancer.

Suggested public layout:
- `https://api.example.com/v1` -> API service
- `wss://api.example.com/ws` -> realtime service
- `https://admin.example.com` -> admin panel

## 2. Secrets
Copy `.env.production.example` to your secret-management system. Never commit the populated file.
Generate independent random values for JWT access, JWT refresh, admin JWT and optional bootstrap key.
Generate `PUSH_TOKEN_ENCRYPTION_KEY` as exactly 32 random bytes encoded as base64.

## 3. Database
Run migrations before application rollout:
`npm run migrate`

Back up the database before migration on an existing environment.

## 4. Health
Probe:
- `GET /v1/health/live`
- `GET /v1/health/ready`
- realtime `GET /health`

Only route production traffic after readiness succeeds.

## 5. Android
From `apps/mobile`:
`YD_API_URL=https://api.example.com/v1 YD_WS_URL=wss://api.example.com/ws ./tool/build_release_candidate.sh`

A production signing keystore is required for a distributable signed release APK.

## 6. Rollback
Keep the previous container images/APK and a database backup. Application rollback must not
blindly reverse already-applied destructive migrations; schema changes require an explicit
forward-fix/rollback plan.
