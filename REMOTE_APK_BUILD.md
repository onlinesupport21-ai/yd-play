# YD Play Remote APK Build

On a fresh Ubuntu/Debian host with outbound internet access:

```bash
cd apps/mobile
YD_API_URL=http://YOUR_BACKEND_IP:3000/v1 \
YD_WS_URL=ws://YOUR_BACKEND_IP:3001/ws \
./tool/provision_and_build_apk.sh debug
```

Output:

`apps/mobile/build/app/outputs/flutter-apk/app-debug.apk`

For a production-signed build, configure the keystore variables/files documented in the v0.7 release and run the script with `release`.

The script installs only development/build dependencies, Flutter stable, and Android SDK command-line components. It does not add cash-out, deposits, wagering, or real-money prize features.
