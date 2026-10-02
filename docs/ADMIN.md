# YD Play Admin Console — v0.8

## Security model

- Daily admin operations use a named admin account and short-lived admin JWT.
- `ADMIN_API_KEY` remains a bootstrap/compatibility secret only and must never be embedded in the browser admin app.
- Admin roles: `support`, `moderator`, `analyst`, `operator`, `admin`, `super_admin`.
- User bans/status changes and coin adjustments require a written reason and are audit logged.
- Coin adjustments still use the balanced virtual-coin ledger. There is no cash value or cash-out path.
- Moderation decisions require a named admin account; the bootstrap API key cannot resolve reports or create push campaigns.

## First admin account

After database migrations:

```bash
export DATABASE_URL=postgresql://ydplay:ydplay_dev@localhost:5432/ydplay
npm --workspace @ydplay/api run admin:create -- \
  admin@example.com 'replace-with-a-long-password' super_admin 'YD Play Owner'
```

Set these environment variables before starting the API:

```bash
ADMIN_JWT_SECRET='at-least-32-random-characters-change-this'
ADMIN_ACCESS_TOKEN_TTL_SECONDS=1800
```

## Local admin UI

```bash
npm install
npm run dev:api
npm run dev:admin
```

Admin UI: `http://localhost:3002`
API: `http://localhost:3000/v1`

## Included operations

- Dashboard: users, game activity, referral/fraud status, coin supply, estimated D1 login retention.
- User search and account detail.
- Suspend, ban, reactivate.
- Audited virtual-coin credit/debit through the existing ledger.
- Referral reward/cap/fraud-rule configuration.
- Referral abuse review queue.
- Moderation report queue and resolution notes.
- Coin economy sources/sinks.
- Push campaign composer/storage.
- Admin audit log.

## Push delivery boundary

v0.8 stores and schedules push campaigns, but does **not** fake provider delivery. Actual device delivery needs a provider integration such as FCM/APNs in a later milestone. Campaign creation and delivery state are intentionally separated.

## v0.9 notification dispatch

The Push tab can save a campaign and dispatch it. Dispatch creates one in-app inbox notification per active user with a database uniqueness guard, so retries do not duplicate inbox messages.

If `PUSH_PROVIDER_URL` is configured, the API also forwards each registered encrypted device token to that HTTPS provider bridge. If it is not configured, push delivery is recorded as `skipped` while the in-app notification is still delivered.

Scheduled campaigns are checked once per minute by the API notification scheduler. Repeated/manual dispatch is protected by campaign state and unique campaign/device delivery records.
