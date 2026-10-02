# v0.2 security controls

## Implemented

- Server-owned wallet mutations
- Balanced ledger invariant in service code
- Deferred database balance trigger
- Append-only ledger entries
- User balance cannot be negative
- Idempotent signup reward
- Password hashing with Node.js `scrypt`
- Constant-time password hash comparison
- Device proof stored only as SHA-256 hash
- Short-lived access JWTs
- Refresh token hashes stored instead of plaintext
- Refresh-session rotation
- Row lock during refresh rotation to stop concurrent replay
- Validation pipe rejects unknown request fields

## Still required before production

- Per-route and per-identity rate limits
- Email/phone ownership verification
- MFA / passkey support where appropriate
- Redis-backed abuse throttling
- Secret manager
- CSP/CSRF controls for the future admin panel
- SAST/dependency/secret scanning in CI
- Structured security logs
- Full penetration test
- Backup/restore drills

## v0.4 game-specific controls

- The full deterministic target schedule is retained server-side and not returned at session start.
- Cue release uses a short look-ahead window.
- Player inputs require strict sequence numbers and bounded gameplay timestamps.
- Repeated implausibly fast inputs, backwards timestamps, schedule mismatches and server-state mismatches are anti-cheat evidence.
- Completion performs a deterministic replay from stored inputs.
- Client-reported score never controls rewards.
- `game_reward` ledger grants are idempotent by session ID.


## v0.5 realtime/multiplayer additions

- WebSocket access tokens are sent in the first authenticated message, not URL query parameters.
- Access JWT signature, expiry, token type and live database session are all checked.
- Browser Origin allowlist is supported; native clients remain token-authenticated.
- WebSocket payloads are capped at 16 KiB and message rates are limited.
- PostgreSQL, not Redis or the client, is authoritative for game results.
- Multiplayer inputs have monotonic sequence checks and one-answer-per-round uniqueness constraints.
- Target schedules remain server-side and only the currently opened round is broadcast.
- Player room creation uses PostgreSQL advisory locks to reduce concurrent multi-room races.
- Multiplayer v0.5 intentionally grants no wallet reward until fairness/load/security testing is complete.
