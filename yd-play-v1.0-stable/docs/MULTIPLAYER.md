# Signal Clash Multiplayer Architecture

## State authority

The realtime client is presentation/input only. It cannot select targets, open/close rounds, set score, decide winner, or issue wallet rewards.

A match is persisted across four primary tables:

1. `multiplayer_rooms` — lifecycle, private/public type, seed, config and absolute schedule boundaries.
2. `multiplayer_room_players` — seats, connection state and authoritative score counters.
3. `multiplayer_rounds` — target lane and server open/close timestamps.
4. `multiplayer_inputs` — one persisted answer per user/round plus monotonic per-player sequence.

`multiplayer_results` stores the validated final outcome.

## Recovery model

Room schedule is generated before the match begins. A 150 ms scheduler checks PostgreSQL for due state transitions and unannounced rounds. If a process dies, another instance can continue from the database. Redis Pub/Sub distributes resulting events to whichever node owns each user's live socket.

## Matchmaking

Public matchmaking uses a Redis list plus membership set. A short Redis distributed lock serializes pairing. Before room creation the service re-checks active-room state under PostgreSQL advisory locks for both users, preventing concurrent public/private room creation for the same account.

## Reconnect

Connection loss marks the player disconnected but does not alter score. On a later authenticated WebSocket connection, the service finds the user's active room and sends an authoritative `room.resume` snapshot including current round only when it is already open. Future target lanes are never included in the snapshot.

## Fairness notes

v0.5 awards fixed points for correctness rather than "fastest network wins" bonuses. This deliberately avoids rewarding lower latency. Production beta should still collect regional RTT metrics and load-test scheduler delay before competitive ranking is enabled.
