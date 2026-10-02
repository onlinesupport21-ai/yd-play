# v0.7 Android Release Checklist

- [ ] `flutter pub get` succeeds.
- [ ] `flutter analyze` has no errors.
- [ ] `flutter test` passes.
- [ ] Debug APK installs on Android 8+ test device.
- [ ] Login/register works against staging.
- [ ] Wallet balance is server-derived.
- [ ] Pulse Grid completes and refreshes wallet reward.
- [ ] Signal Clash tested on two physical devices.
- [ ] Reconnect resumes `lastInputSeq` and active round.
- [ ] Offline startup preserves stored session.
- [ ] Onboarding appears once and explains virtual coin limitations.
- [ ] Haptic/sound preferences persist.
- [ ] Production uses HTTPS/WSS.
- [ ] Release is signed with private upload keystore, not debug key.
- [ ] No keystore/password/secrets committed.
- [ ] Accessibility font scaling and TalkBack labels checked.
- [ ] Security/abuse tests and store-policy review complete before public launch.
