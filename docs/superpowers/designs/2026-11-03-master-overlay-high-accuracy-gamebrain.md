# Master Overlay High-Accuracy GameBrain Design

## Intent
Upgrade the existing MasterBotOverlay/GameBrain architecture without rebuilding it, improving card-read reliability, state memory, decision quality, and observability.

## Safety / product boundary
- External/live game apps: screen capture + read-only advice only. No AccessibilityService auto-tap or hidden-state extraction.
- Own controlled sandbox/demo: may consume local state / WebSocket truth and may automate actions inside the owned demo.
- No claim of 100% detection or 99% live win rate. Surface measured confidence and benchmark results.

## Architecture
1. Vision & Capture: keep MediaProjection/ImageReader; formalize four ROIs; stabilize detections with a 3-frame consensus gate before state promotion. Current calibrated bitmap geometry remains fallback until a complete 53-class corner-template/model dataset exists.
2. Memory & State: extend the 106-card ledger with explicit own/open/discard/opponent-pick transitions and per-card remaining counts. Build danger scores from visible opponent pickups.
3. GameBrain: keep the exact meld solver; add live-out enumeration, meld-distance score, early/late high-card policy, and EV tie-breaking for open-vs-closed and discard ranking.
4. Overlay: show action, discard, deadwood, live outs, confidence, danger, and measured readiness. Keep external mode advisory-only.

## Execution flow
Capture ROI frame -> detect candidate cards -> 3-frame consensus -> stable game state -> ledger/opponent update -> exact meld solver + live-outs/EV -> advisory HUD. In owned sandbox mode, the same brain can consume authoritative state instead of vision.

## Non-goals for this increment
- Shipping a fake 52-card template pack or claiming a YOLO model without a real labeled dataset.
- Automated interaction with third-party/live wagering apps.
- Guaranteed win-rate claims.
