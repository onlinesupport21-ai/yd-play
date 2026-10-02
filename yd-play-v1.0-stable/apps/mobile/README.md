# YD Play Mobile v0.9

Flutter Android client for YD Play.

## Included

- onboarding + virtual-coin/no-cash messaging
- secure auth/session/device-proof storage
- offline-safe session startup
- wallet/referrals/profile
- Pulse Grid
- Signal Clash realtime matchmaking/private rooms/reconnect
- missions + achievements + claim flows
- validated Pulse Grid rankings
- in-app notification inbox
- Safety & reports + own report history
- Signal Clash opponent reporting
- light/dark/system theme
- persisted haptic and sound preferences
- Android release build/signing pipeline

## Build

```bash
./tool/build_apk.sh debug
```

Production releases require private signing configuration; see `../../docs/APK_BUILD.md`.
