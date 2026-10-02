# API Notes

Base URL: `/v1`

## Referral user endpoints

### GET `/referrals/me`
Returns the user's referral code, public reward configuration, invite counts, earned referral coins and any referral attribution on their own account.

### POST `/referrals/apply`

```json
{ "code": "YDABC2345" }
```

A user can only have one referral attribution. Applying the same code again is idempotent; applying a different code after attribution returns a conflict.

### POST `/referrals/evaluate`
Re-runs server-side qualification for the current user's referral. This is useful when account-age qualification has become satisfied. The client cannot set risk, status or reward amount.

## Admin referral endpoints

All current v0.3 admin referral endpoints require `X-Admin-Api-Key`.

### GET `/admin/referrals/config`
Reads rewards, caps and fraud thresholds.

### PATCH `/admin/referrals/config`
Updates selected configuration fields and writes an audit event.

### GET `/admin/referrals/fraud-flags?status=open&limit=50`
Returns evidence-bearing fraud flags.

### PATCH `/admin/referrals/fraud-flags/:flagId`

```json
{ "status": "dismissed", "reason": "Shared household device verified" }
```

### PATCH `/admin/referrals/:referralId/decision`

```json
{ "decision": "approve", "reason": "Manual evidence review completed" }
```

or

```json
{ "decision": "reject", "reason": "Confirmed multi-account reward farming" }
```

Approvals still use the normal cap-reservation and idempotent wallet flow.

## Pulse Grid game endpoints (v0.4)

All game endpoints require a bearer access token.

### POST `/games/pulse-grid/sessions`
Starts a 45-second authoritative session. The response includes timing/config metadata and a schedule hash, but deliberately does **not** expose the complete future target schedule.

### GET `/games/sessions/:sessionId/cues?after=N`
Returns only the short near-future cue window. The client should keep the largest target index it has seen and send it back as `after`.

### POST `/games/sessions/:sessionId/input`

```json
{ "seq": 1, "elapsedMs": 1012, "lane": 2 }
```

The server requires the exact next sequence number, checks the gameplay timestamp against server time, replays all stored inputs, and returns the authoritative score/combo.

### POST `/games/sessions/:sessionId/complete`

```json
{ "claimedScore": 1080 }
```

`claimedScore` is optional telemetry only. The server rebuilds the result from stored inputs, validates schedule/state hashes and anti-cheat flags, and grants any eligible virtual-coin reward through the idempotent ledger.

## Engagement endpoints (v0.9)

All engagement endpoints require a bearer user token.

- `GET /missions` — active missions plus the current period's progress/claim state.
- `POST /missions/:missionId/claim` — idempotent ledger-backed claim.
- `GET /achievements` — achievement definitions with unlock/claim state.
- `POST /achievements/:achievementId/claim` — idempotent ledger-backed claim.
- `GET /leaderboards/:code` — validated Pulse Grid best-score leaderboard plus the current user's rank.

Leaderboard scores are generated from validated game completion only; there is no client score-submit endpoint.

## Analytics (v0.9)

`POST /analytics/events` accepts a maximum of 50 authenticated events. `eventId` is deduplicated per user. Analytics failure must not block play/login flows.

Named admin JWT roles `analyst`, `operator`, `admin`, or `super_admin` can use `GET /admin/analytics/events?days=7`.

## Notifications (v0.9)

- `GET /notifications` — in-app inbox and unread count.
- `POST /notifications/:id/read` — mark one item read.
- `POST /notifications/devices` — register an encrypted provider token.
- `POST /notifications/devices/unregister` — disable a provider token.
- `POST /admin/push-campaigns/:campaignId/dispatch` — named-admin operation that fans out inbox items and optionally calls the configured external push bridge.

Scheduled campaigns are checked by the API notification scheduler once per minute. Campaign/user inbox fan-out and campaign/device delivery records are unique so dispatch retries are idempotent.

## User safety reports (v0.9)

- `POST /reports` — submit a moderation report.
- `GET /reports/me` — read the current user's own report status/history.

Reports do not automatically trigger bans.
