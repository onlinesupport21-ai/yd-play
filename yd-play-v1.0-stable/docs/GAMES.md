# Games — v0.4

## Pulse Grid

Pulse Grid is an original reflex/accuracy arcade game built for YD Play. It does not contain betting, cash prizes, loot boxes, deposits, withdrawals, or cash-equivalent rewards.

### Rules

- Duration: 45 seconds.
- Four lanes.
- The server generates a deterministic target schedule from a private per-session seed.
- The client receives only a short near-future cue window instead of the entire future schedule.
- A tap is a hit only when its lane matches an unused target and its gameplay timestamp falls inside the configured hit window.
- Consecutive hits build a combo and add a capped combo bonus.
- Misses reset the combo.
- Score and reward are always computed by the server.

### Server-authoritative flow

```text
POST /games/pulse-grid/sessions
        ↓
server creates seed + config snapshot + schedule hash
        ↓
GET /games/sessions/:id/cues?after=N
        ↓
server releases ~1.2s near-future cues
        ↓
POST /games/sessions/:id/input
        ↓
strict sequence + timing checks + deterministic replay
        ↓
server returns authoritative score/combo
        ↓
POST /games/sessions/:id/complete
        ↓
full replay validation + schedule hash verification
        ↓
validated result
        ↓
idempotent virtual-coin ledger reward
```

### Anti-cheat rules in this milestone

- Strict increasing input sequence numbers.
- Duplicate retry is accepted only when the same sequence has exactly the same gameplay timestamp and lane.
- Future-dated inputs are rejected beyond configured clock/network tolerance.
- Inputs arriving too far behind server gameplay time are rejected.
- Backwards gameplay timestamps are flagged.
- Repeated physically implausible input intervals are flagged and invalidate the result.
- Server state is recomputed from the stored replay at completion.
- Stored schedule hash must match the schedule regenerated from the private session seed.
- Client-reported score is never trusted. A mismatch is recorded, while the server score remains authoritative.
- Coin rewards are issued only through the wallet ledger with `game-reward:<sessionId>` idempotency.

### Reward policy

The v1 configuration rewards a small amount of entertainment-only virtual coins based on validated server score. Rewards are capped per game session. These coins:

- have no cash value;
- cannot be withdrawn;
- cannot be transferred between users;
- are not a stake, bet, or prize redeemable for money.

### Development client

A minimal browser client lives in `apps/pulse-grid-demo`.

```bash
cd apps/pulse-grid-demo
python3 -m http.server 5173
```

Open `http://localhost:5173`, paste a valid access token, and start a session. The client is intentionally thin: rendering and input collection happen locally, but target release, validation, score, anti-cheat decisions, and rewards remain server-controlled.

### Production hardening still required

Before a public release, add telemetry on device latency, cue delivery jitter, false-positive anti-cheat rates, and bot-like timing distributions. For stronger secret protection, store per-session seed material encrypted with a managed KMS or derive schedules from an HMAC service secret instead of retaining raw seed material indefinitely.
