# Master Overlay Auto Scan v1.1 Design

## Intent
Upgrade the existing separate Master Bot Overlay companion app so the user can request a one-tap screen scan while their own/demo Rummy APK is visible. The overlay should extract visible card labels from the captured screen, populate the existing hand/open/Joker inputs, and run the existing MasterAdvisor only when the scan is trustworthy.

## Goals
- Keep the existing v1 manual mode fully usable.
- Add one-tap `Auto Scan (beta)` from the floating overlay.
- Reuse the existing MediaProjection capture service; no modification of the game APK.
- Use on-device OCR so captured screenshots do not need to be uploaded.
- Support portrait and landscape generic layouts with conservative normalized zones.
- Auto-fill the 13/14-card hand when confidence is high enough.
- Detect open-card and Joker-rank candidates when visible in expected zones.
- Refuse to invent a state when OCR is incomplete; show detected values and keep manual correction available.

## Non-goals
- No hidden auto-clicking, touch injection, or anti-detection behavior.
- No guarantee of universal recognition across every third-party game skin.
- No continuous background play in this update.
- No network AI dependency.

## Constraints
- Existing `master-overlay-build` stays stable; implementation is isolated on `master-overlay-autoscan`.
- Android minSdk remains 26 and target/compileSdk remain 35.
- Existing MasterAdvisor remains the decision engine.
- Card OCR parsing must support `AS`, `A♠`, `10H`, `Q D`, and printed Joker tokens where possible.
- Low-confidence scans must not trigger advice from fabricated or partial hands.

## Approaches considered
1. Accessibility tree parsing: lightweight when the target exposes semantics, but unreliable for canvas/game rendering and requires broader accessibility privileges.
2. Hard-coded template matching: fast and offline, but tightly coupled to one card skin and impossible to calibrate accurately without a complete template pack.
3. MediaProjection + on-device OCR + conservative geometry classification: works with the capture foundation already in v1, keeps data local, and can improve later with per-game calibration. **Selected.**

## Architecture
- `CardTokenParser`: pure-Java OCR token normalization and card-code extraction.
- `ScreenRegionClassifier`: pure-Java normalized geometry rules that classify OCR hits into hand, open-card, and Joker candidate zones for portrait/landscape.
- `ScreenOcrScanner`: Android/ML Kit adapter that runs bundled on-device text recognition over the captured bitmap, converts OCR elements to pure-Java hits, and returns a structured scan result.
- `CaptureService`: exposes snapshot freshness metadata so the overlay can request and wait for a new frame.
- `OverlayService`: adds Auto Scan, fills inputs only when scan confidence is sufficient, and then invokes the existing advisor.

## Failure behavior
- Fewer than 13 or more than 14 plausible hand cards: show scan result but do not auto-analyze.
- No Joker candidate: keep the user's current Joker field untouched and require manual correction.
- OCR exception or missing snapshot: show a recoverable status message; manual mode remains available.
- Duplicate card codes are allowed because multi-deck Rummy can legitimately contain duplicates.
