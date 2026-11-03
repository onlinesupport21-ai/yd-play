# Master Overlay Auto Scan v1.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a conservative one-tap OCR Auto Scan path that converts a fresh screen capture into hand/open/Joker inputs and runs the existing MasterAdvisor only when the detected hand is complete.

**Architecture:** Keep OCR and Android code thin around pure-Java parsing/classification units. CaptureService supplies a fresh snapshot; bundled ML Kit text recognition returns positioned text elements; pure-Java code normalizes card tokens and classifies them by normalized screen region; OverlayService applies only high-confidence results and preserves manual fallback.

**Tech Stack:** Java 17, Android SDK 35, MediaProjection, ML Kit bundled text recognition `com.google.mlkit:text-recognition:16.0.1`, JUnit 4.13.2.

**Spec:** `docs/superpowers/specs/2026-11-03-master-overlay-autoscan.md`

## Global Constraints
- Keep `master-overlay-build` unchanged; work only on `master-overlay-autoscan`.
- minSdk 26, targetSdk 35, compileSdk 35.
- No touch injection, auto-clicking, stealth, or hidden play.
- Manual mode must remain usable after every task.
- Low-confidence OCR must never fabricate a 13-card state.

## Review Focus
- OCR text with Unicode suits and split rank/suit tokens.
- Duplicate card codes from multi-deck Rummy.
- Landscape versus portrait zone classification.
- Snapshot freshness so stale images are not scanned.
- Incomplete hand scans must not auto-run MasterAdvisor.

---

### Task 1: OCR card token parser

**Files:**
- Modify: `apps/master-overlay/app/build.gradle`
- Create: `apps/master-overlay/app/src/test/java/com/ydplay/masteroverlay/scan/CardTokenParserTest.java`
- Create: `apps/master-overlay/app/src/main/java/com/ydplay/masteroverlay/scan/CardTokenParser.java`

**Interfaces:**
- Produces: `List<String> CardTokenParser.extractCardCodes(String rawText)` and `String CardTokenParser.normalizeCardToken(String raw)`.

- [ ] Add JUnit test dependency and CI unit-test step.
- [ ] Write failing tests for `AS`, `A♠`, `10H`, `Q D`, printed Joker aliases, duplicates, and junk rejection.
- [ ] Run unit tests and confirm failure because `CardTokenParser` is missing.
- [ ] Implement the minimal parser.
- [ ] Run the parser tests and full unit-test suite; confirm green.

### Task 2: Screen-region classifier

**Files:**
- Create: `apps/master-overlay/app/src/test/java/com/ydplay/masteroverlay/scan/ScreenRegionClassifierTest.java`
- Create: `apps/master-overlay/app/src/main/java/com/ydplay/masteroverlay/scan/OcrHit.java`
- Create: `apps/master-overlay/app/src/main/java/com/ydplay/masteroverlay/scan/AutoScanResult.java`
- Create: `apps/master-overlay/app/src/main/java/com/ydplay/masteroverlay/scan/ScreenRegionClassifier.java`

**Interfaces:**
- Consumes: normalized card codes from Task 1.
- Produces: `AutoScanResult ScreenRegionClassifier.classify(int width, int height, List<OcrHit> hits)`.

- [ ] Write failing portrait and landscape tests that place 13 hand cards in the bottom zone, one open card near center, and one Joker candidate above the hand.
- [ ] Verify tests fail because classifier types are missing.
- [ ] Implement conservative normalized zones and confidence rules.
- [ ] Add tests proving 12-card scans are `completeHand=false` and duplicate cards are preserved.
- [ ] Run full unit-test suite; confirm green.

### Task 3: Android OCR adapter and fresh snapshot contract

**Files:**
- Modify: `apps/master-overlay/app/build.gradle`
- Modify: `apps/master-overlay/app/src/main/java/com/ydplay/masteroverlay/CaptureService.java`
- Create: `apps/master-overlay/app/src/main/java/com/ydplay/masteroverlay/scan/ScreenOcrScanner.java`

**Interfaces:**
- Consumes: fresh `master_snapshot.png`, Task 1 parser, Task 2 classifier.
- Produces: async `scan(File image, Callback callback)` returning `AutoScanResult`.
- CaptureService produces `long getLatestSnapshotEpochMs()` and `File getLatestSnapshotFile(Context)`.

- [ ] Add bundled ML Kit text recognition dependency and AndroidX setting.
- [ ] Expose snapshot freshness timestamp only after a PNG write completes.
- [ ] Implement ScreenOcrScanner to run on-device OCR, convert positioned elements to `OcrHit`, and call the pure classifier.
- [ ] Compile debug APK to verify Android/ML Kit integration.

### Task 4: Overlay Auto Scan UX

**Files:**
- Modify: `apps/master-overlay/app/src/main/java/com/ydplay/masteroverlay/OverlayService.java`
- Modify: `apps/master-overlay/app/src/main/java/com/ydplay/masteroverlay/MainActivity.java`

**Interfaces:**
- Consumes: CaptureService freshness contract and ScreenOcrScanner result.
- Produces: one-tap `Auto Scan (beta)` user flow.

- [ ] Add Auto Scan button and scan-status text.
- [ ] Request a new snapshot, wait for freshness with bounded retries, then OCR it.
- [ ] If `completeHand=true`, fill the hand input; fill open/Joker only when detected.
- [ ] Auto-run `analyze()` only when hand is complete and Joker rank is valid; otherwise show exactly what was detected and keep manual correction available.
- [ ] Keep Snapshot/manual Analyze/opponent PatternMemory controls unchanged.

### Task 5: Verification and APK artifact

**Files:**
- Modify: `.github/workflows/master-overlay-apk.yml`

**Interfaces:**
- Produces: CI artifact containing a signature-verified debug APK and SHA-256 checksum.

- [ ] Point workflow trigger at `master-overlay-autoscan` and run `:app:testDebugUnitTest` before `assembleDebug`.
- [ ] Run `apksigner verify --verbose --print-certs`.
- [ ] Generate SHA-256 and upload artifact.
- [ ] Confirm every CI step is green before calling v1.1 build-ready.
