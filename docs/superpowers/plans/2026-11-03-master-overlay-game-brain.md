# Master Overlay Game Brain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the existing Android Master Bot Overlay into a stable, low-noise recommendation system with automatic visible-state tracking, opponent danger memory, known-card counting, and one-line action UI.

**Architecture:** Keep the current on-device Gold Rummy scanner as the vision source. Add a stabilization layer before decisions, then derive visible events and card-count knowledge, feed those into PatternMemory/MasterAdvisor, and present only a single actionable recommendation when confidence is sufficient.

**Tech Stack:** Java 17, Android SDK 35, ML Kit text recognition 16.0.1, JUnit 4.13.2, existing MediaProjection overlay architecture.

**Spec:** `docs/superpowers/specs/2026-11-03-master-overlay-game-brain.md`

## Global Constraints
- Recommendation-only; no auto-clicking.
- On-device analysis; no cloud OCR requirement.
- Uncertain state must produce `SCAN UNCERTAIN — DON'T ACT`.
- Preserve manual Analyze fallback.
- Preserve current Gold Rummy calibrated scanner behavior.

## Review Focus
- Two noisy scans must not promote a false stable hand.
- Duplicate physical cards must keep multiplicity in the 106-card ledger.
- Open-card changes must not be interpreted as opponent actions during the user's own draw/discard transition.
- Joker/open-card missing states must suppress advice.
- Background scan loop must stop when overlay service stops.

---

### Task 1: Stable Scan State

**Files:**
- Create: `apps/master-overlay/app/src/main/java/com/ydplay/masteroverlay/state/StableGameStateTracker.java`
- Create: `apps/master-overlay/app/src/main/java/com/ydplay/masteroverlay/state/StableGameState.java`
- Test: `apps/master-overlay/app/src/test/java/com/ydplay/masteroverlay/state/StableGameStateTrackerTest.java`

**Interfaces:**
- Consumes: `AutoScanResult`
- Produces: `Optional<StableGameState> observe(AutoScanResult scan, long timestampMs)`

- [ ] Write failing tests for two-sample promotion, disagreement reset, duplicate-card preservation, and low-confidence rejection.
- [ ] Run `gradle :app:testDebugUnitTest` and verify RED.
- [ ] Implement minimal tracker/state records.
- [ ] Run tests and verify GREEN.
- [ ] Commit.

### Task 2: Known Card Ledger

**Files:**
- Create: `apps/master-overlay/app/src/main/java/com/ydplay/masteroverlay/state/KnownCardLedger.java`
- Test: `apps/master-overlay/app/src/test/java/com/ydplay/masteroverlay/state/KnownCardLedgerTest.java`

**Interfaces:**
- Consumes: `StableGameState`, visible discard/open events
- Produces: `knownCount(String cardCode)`, `remainingCount(String cardCode)`, `knownTotal()`, `unseenTotal()`

- [ ] Write failing tests for two-deck multiplicities, two printed jokers, duplicate physical cards, and reset.
- [ ] Run tests and verify RED.
- [ ] Implement ledger with 106-card counts.
- [ ] Run tests and verify GREEN.
- [ ] Commit.

### Task 3: Opponent Visible-Event Tracker

**Files:**
- Create: `apps/master-overlay/app/src/main/java/com/ydplay/masteroverlay/state/OpponentTracker.java`
- Test: `apps/master-overlay/app/src/test/java/com/ydplay/masteroverlay/state/OpponentTrackerTest.java`

**Interfaces:**
- Consumes: consecutive `StableGameState` values + active-seat label when known
- Produces: visible `PICK_OPEN`/`DISCARD` observations and calls `PatternMemory.observe(...)`

- [ ] Write failing tests for open-card consumed, new discard appearing, self-turn suppression, and ambiguous transition ignored.
- [ ] Run tests and verify RED.
- [ ] Implement minimal transition logic.
- [ ] Run tests and verify GREEN.
- [ ] Commit.

### Task 4: Decision Presentation

**Files:**
- Create: `apps/master-overlay/app/src/main/java/com/ydplay/masteroverlay/ui/PrimaryDecision.java`
- Create: `apps/master-overlay/app/src/main/java/com/ydplay/masteroverlay/ui/DecisionPresenter.java`
- Test: `apps/master-overlay/app/src/test/java/com/ydplay/masteroverlay/ui/DecisionPresenterTest.java`

**Interfaces:**
- Consumes: stable state, `Recommendation`, confidence, PatternMemory risk, ledger totals
- Produces: headline, target card, reason, detail text, severity

- [ ] Write failing tests for PICK OPEN, DRAW CLOSED, DISCARD, and SCAN UNCERTAIN.
- [ ] Run tests and verify RED.
- [ ] Implement presenter.
- [ ] Run tests and verify GREEN.
- [ ] Commit.

### Task 5: Overlay Live Loop + Simplified UI

**Files:**
- Modify: `apps/master-overlay/app/src/main/java/com/ydplay/masteroverlay/OverlayService.java`
- Modify: `apps/master-overlay/app/src/main/java/com/ydplay/masteroverlay/scan/ScreenOcrScanner.java` only if integration requires diagnostics exposure
- Test: existing unit suites + compile/build gate

**Interfaces:**
- Consumes all prior task outputs.
- Produces one-line live action card and expandable Why? details.

- [ ] Add low-frequency scan loop with explicit enable/disable and no overlapping scans.
- [ ] Wire stabilized state into ledger/opponent tracker/advisor.
- [ ] Replace default developer panel emphasis with primary action card; retain manual fields under Details/Manual.
- [ ] Ensure uncertain state never calls `MasterAdvisor` automatically.
- [ ] Run full unit tests and Android compile.
- [ ] Commit.

### Task 6: Version, CI, APK Verification

**Files:**
- Modify: `apps/master-overlay/app/build.gradle`
- Modify: `.github/workflows/master-overlay-apk.yml` to include `master-overlay-game-brain`

**Interfaces:**
- Produces signed debug APK artifact and checksum.

- [ ] Bump version to `1.3.0-beta4` / versionCode 5.
- [ ] Run CI unit tests, assembleDebug, `apksigner verify`, checksum, artifact upload.
- [ ] Download artifact and confirm checksum matches.
- [ ] Deliver APK without claiming physical-device behavior not yet observed.
