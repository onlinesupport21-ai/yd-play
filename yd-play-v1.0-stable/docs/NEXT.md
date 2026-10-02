# Next Milestone After v0.9

Recommended v1.0 focus: **release candidate + real APK + staging integration**.

- Compile the Flutter Android APK on the Ubuntu machine using the existing free local APK pipeline.
- Put API/realtime behind HTTPS/WSS on a test/staging endpoint.
- Run PostgreSQL migrations `001` through `006` on staging.
- Test auth, wallet, referrals, Pulse Grid, missions/claims, rankings, inbox, reports and Signal Clash on physical Android devices.
- Choose a push provider only if push outside the app is needed; wire its token acquisition SDK and provider bridge credentials.
- Add admin MFA before production exposure.
- Run dependency, database, backup/restore, load and penetration testing.
- Keep multiplayer coin rewards disabled until fairness/latency/abuse testing is complete.
