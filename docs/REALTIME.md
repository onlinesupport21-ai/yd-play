# YD Play Realtime Protocol — v0.5

Endpoint: `ws://localhost:3001/ws` in local development. Production must use `wss://`.

## Authentication

The first client message must arrive within the configured authentication timeout:

```json
{"type":"auth","token":"<short-lived access token>"}
```

The realtime server verifies the HS256 signature using `JWT_ACCESS_SECRET`, requires `type=access`, checks expiry, and verifies the referenced session is still active and not revoked in PostgreSQL. Tokens are **not** placed in the WebSocket URL.

Successful response:

```json
{"type":"auth.ok","ts":"...","userId":"...","instanceId":"..."}
```

If the user is already in an open/countdown/in-progress room, the server immediately emits `room.resume` with the authoritative snapshot.

## Client messages

- `ping` — refresh presence and receive `pong`.
- `queue.join` / `queue.leave` — public Signal Clash matchmaking.
- `room.create_private` — creates a 2-player private room and 6-character join code.
- `room.join_private` with `{code}` — joins a private room.
- `room.leave` — leaves/cancels as allowed by state.
- `game.input` with `{roomId, roundNo, lane, seq}` — submit exactly one answer for a round.

## Main server events

- `queue.joined`, `queue.left`
- `match.found`
- `room.created`, `room.joined`, `room.updated`, `room.resume`, `room.player_left`
- `game.started`
- `game.round` — reveals only the currently opened target, never the complete future sequence.
- `game.input_result` — private result for the submitting player.
- `game.scoreboard` — room score update.
- `game.completed` / `game.cancelled`
- `error`

## Signal Clash rules

Signal Clash is an original non-real-money 2-player reaction/accuracy mode:

- 4 lanes.
- 20 server-generated rounds.
- 1.2 seconds between round starts.
- 750 ms answer window.
- Correct answer: 100 points.
- Wrong/invalid answer: 0 points.
- One answer per player per round.
- Highest validated server score wins; equal scores tie.
- **No virtual-coin reward is issued from multiplayer in v0.5.**

The seed is stored server-side. Round target lanes and absolute open/close timestamps are persisted in PostgreSQL. This allows recovery after a realtime process restart without trusting client timing or client score.

## Multi-instance coordination

Redis is used for:

- presence TTLs,
- public matchmaking queue/set,
- a distributed matchmaking lock,
- user event fan-out,
- room event fan-out.

PostgreSQL remains authoritative for room membership, round timing, inputs, scores and final results. Round announcements are claimed through an atomic database update (`announced_at`), preventing two realtime nodes from intentionally publishing the same round as separate authoritative events.

## Security limits

- WebSocket max message size: 16 KiB.
- Per-socket message-rate cap is configurable; default 60 messages per 10 seconds.
- Browser origins can be allowlisted.
- Native clients without an Origin header still require a valid access token and live session.
- Client timestamps and client scores are not accepted for Signal Clash.
- Input sequence numbers are monotonic and idempotency-protected.
- Database uniqueness enforces one input per player per round.
