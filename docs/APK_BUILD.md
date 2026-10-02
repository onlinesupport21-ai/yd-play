# YD Play Android APK Build

## Fast local build

Install a stable Flutter SDK and Android SDK, then:

```bash
cd apps/mobile
./tool/build_apk.sh debug
```

For a production endpoint:

```bash
YD_API_URL=https://api.example.com/v1 \
YD_WS_URL=wss://api.example.com/ws \
./tool/build_apk.sh release
```

Without `android/key.properties`, release builds intentionally fall back to the Android debug signing key so the artifact is installable for internal testing only. **Do not publish that build.**

## Production signing

Create an upload keystore outside source control. Copy `android/key.properties.example` to `android/key.properties` and fill the real values. Never commit the keystore or passwords.

For GitHub Actions set repository secrets:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_STORE_PASSWORD`
- `ANDROID_KEY_PASSWORD`
- `ANDROID_KEY_ALIAS`

The workflow always builds an installable debug APK. It builds a signed release APK only when signing secrets exist.

## Physical Android device

`10.0.2.2` only works from the Android emulator. For a phone on the same LAN, pass your development machine's reachable IP using `--dart-define`. Production must use HTTPS/WSS.
