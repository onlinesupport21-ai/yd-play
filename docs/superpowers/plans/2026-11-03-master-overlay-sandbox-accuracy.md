# Master Overlay Sandbox Accuracy Upgrade Plan

**Goal:** Improve card-recognition stability, deck-state memory, rummy hand evaluation telemetry, and reproducible benchmarking for the owned sandbox/replay environment.

**Architecture:** Extend the existing Java beta7 code without rebuilding it. Candidate detections pass through a three-frame consensus gate before state promotion. A 106-card matrix tracks remaining copies in the sandbox/replay state. The existing exact meld solver is augmented with live-out and meld-distance metrics for offline analysis and controlled demonstrations.

**Constraints:**
- Training, replay, and owned sandbox use only.
- No automated interaction with third-party apps.
- No hidden-state extraction from third-party services.
- Report measured detection accuracy and benchmark win rate; never hard-code 100% or 99% claims.

## Task 1 — Three-frame consensus
- Add `scan/CardFrameConsensus.java` and unit tests.
- Require three equivalent high-confidence frames before promotion.
- Reset streak on disagreement or confidence below 0.92.

## Task 2 — 106-card memory matrix
- Add `state/DeckMemoryMatrix.java` and unit tests.
- Initialize two copies of every natural card and two printed jokers.
- Track own-hand, seen-discard, and sandbox opponent-pick observations without allowing negative counts.

## Task 3 — Offline live-outs and meld-distance metrics
- Add `engine/LiveOutScorer.java` and tests.
- Enumerate one-card improvements through existing `RummyEngine`.
- Report deadwood, pure/total sequences, declaration state, live-outs, and meld-distance metrics.

## Task 4 — ROI contract for replay frames
- Add `scan/GoldRummyRoi.java` and tests for normalized hand/open/joker/activity zones.
- Use crop-first analysis for replay/sandbox images while retaining existing calibrated geometry as fallback.

## Task 5 — Sandbox benchmark telemetry
- Add a compact metrics object/presenter for replay/sandbox UI.
- Expose recognition confidence, stable-frame count, remaining-card counts, deadwood, and live-outs.

## Verification
- Follow TDD for every production change.
- Run full JUnit suite after each task.
- Build/sign/checksum APK only after all tests are green.
