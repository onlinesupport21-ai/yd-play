# Mobile Integration — v0.6

The Flutter client lives at `apps/mobile`. It consumes the existing REST API at `/v1` and realtime WebSocket endpoint at `/ws`.

## Security model

- Access/refresh tokens are stored with `flutter_secure_storage`.
- Refresh tokens rotate server-side; the client replaces both tokens atomically after refresh.
- Device proof is a randomly generated 256-bit client installation identifier persisted securely. It is not a raw IMEI/Android ID/hardware fingerprint.
- Wallet balance is read-only from the mobile client's perspective. Rewards are created only by authoritative backend flows.
- Pulse Grid score is computed by the server.
- Signal Clash input contains only room, round, lane, and monotonically increasing sequence. The client never submits its own score.
- Production builds must use HTTPS and WSS. Debug Android allows cleartext only so the emulator can reach local development services.

## Android emulator defaults

- API: `http://10.0.2.2:3000/v1`
- Realtime: `ws://10.0.2.2:3001/ws`

Override with `--dart-define=YD_API_URL=... --dart-define=YD_WS_URL=...`.

## APK status

The repository contains Android-ready Flutter source and Gradle project files. An actual APK must be compiled with a Flutter SDK plus resolved pub dependencies. Release signing must use a private production keystore; the checked-in release config intentionally uses debug signing only as a non-production placeholder.

- Realtime room snapshots include the player's `lastInputSeq`; the mobile client resumes that sequence after reconnect instead of restarting at zero.
