# Master Overlay Game Brain Spec

## Intent
Turn the existing Master Bot Overlay into a usable recommendation companion for the owner's own Rummy APK. The overlay must make the next action obvious in one glance while refusing to invent advice when scan confidence is too low.

## Goals
- Preserve the current Gold Rummy calibrated scanner and manual fallback.
- Build a stable game-state layer from repeated scans instead of reacting to one noisy frame.
- Track visible open-card changes and visible discards to feed PatternMemory automatically.
- Maintain a known-card ledger (own hand + visible open/discards) and derive unseen-card counts from the 106-card deck.
- Convert opponent observations into a danger map that influences discard tie-breaking.
- Replace developer-style output with one primary instruction: PICK OPEN <card>, DRAW CLOSED, DISCARD <card>, or SCAN UNCERTAIN.
- Keep a Why? detail panel for deadwood, sequence status, danger risk, confidence, and known/unseen counts.
- Never auto-click the game. Recommendation-only for the owner's app/test environment.

## Non-goals
- No hidden-card certainty claims from screenshots.
- No stealth automation, anti-detection behavior, or third-party real-money gameplay automation.
- No cloud OCR requirement; keep on-device analysis.

## Architecture
1. `AutoScanResult` remains the raw vision output.
2. `StableGameStateTracker` accepts scan observations and only promotes a state after two compatible high-confidence samples.
3. `KnownCardLedger` maintains card multiplicities against a 106-card deck.
4. `OpponentTracker` infers visible pickup/discard events from stable open-card transitions and updates `PatternMemory`.
5. `DecisionPresenter` transforms `MasterAdvisor` output + scan confidence + danger data into one-line action UI and structured explanation.
6. Overlay performs low-frequency scan polling only while enabled; uncertain scans never produce automatic advice.

## UI
Collapsed overlay shows a compact action card:
- `PICK OPEN → 8D`
- `DRAW CLOSED`
- `DISCARD → KC`
- `SCAN UNCERTAIN`

Secondary line shows one reason, e.g. `Deadwood 25→15 • opponent risk 18%`.
A `Why?` button expands detailed reasoning and current scanner/ledger diagnostics.

## Safety/Trust Rule
If stable hand, joker rank, or required open-card state is missing, the primary action must be `SCAN UNCERTAIN — DON'T ACT` rather than guessing.
