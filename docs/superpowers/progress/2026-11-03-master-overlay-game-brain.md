# SDD ledger — plan: docs/superpowers/plans/2026-11-03-master-overlay-game-brain.md

Pre-flight: Task 1 StableGameState -> Task 2 KnownCardLedger: compatible hand/open/joker snapshot interface.
Pre-flight: Task 1 StableGameState -> Task 3 OpponentTracker: compatible consecutive-state transition interface.
Pre-flight: Tasks 1-3 -> Task 4 DecisionPresenter: stable state + PatternMemory + ledger totals available.
Pre-flight: Tasks 1-4 -> Task 5 OverlayService: all interfaces are local Java objects; no new external service.
Ruling: GitHub connector execution has no local worktree helper scripts, so `master-overlay-game-brain` is the isolated workspace and this committed ledger is the recoverable progress record.
Ruling: when an exact opponent seat cannot be observed, visible opponent evidence is stored under `table`; self-turn transitions are suppressed so user actions do not poison opponent memory.
