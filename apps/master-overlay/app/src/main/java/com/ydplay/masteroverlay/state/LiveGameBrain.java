package com.ydplay.masteroverlay.state;

import com.ydplay.masteroverlay.engine.Card;
import com.ydplay.masteroverlay.engine.MasterAdvisor;
import com.ydplay.masteroverlay.engine.PatternMemory;
import com.ydplay.masteroverlay.engine.Recommendation;
import com.ydplay.masteroverlay.scan.AutoScanResult;
import com.ydplay.masteroverlay.scan.CardFrameConsensus;
import com.ydplay.masteroverlay.scan.TurnPhase;
import com.ydplay.masteroverlay.ui.DecisionPresenter;
import com.ydplay.masteroverlay.ui.PrimaryDecision;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public final class LiveGameBrain {
    private static final int CONSENSUS_FRAMES = 3;
    private static final double MIN_CONSENSUS_CONFIDENCE = 0.75;

    private final PatternMemory memory = new PatternMemory();
    private final KnownCardLedger ledger = new KnownCardLedger();
    private final CardFrameConsensus frameConsensus = new CardFrameConsensus(
            CONSENSUS_FRAMES, MIN_CONSENSUS_CONFIDENCE);
    private final OpponentTracker opponentTracker = new OpponentTracker(memory);
    private final MasterAdvisor advisor = new MasterAdvisor(memory);
    private final DecisionPresenter presenter = new DecisionPresenter();

    private StableGameState previousStable;
    private TurnPhase previousPhase = TurnPhase.UNKNOWN;

    public synchronized PrimaryDecision observe(AutoScanResult scan, long timestampMs) {
        if (scan == null) return presenter.present(null, null, memory, ledger);

        Optional<AutoScanResult> promoted = frameConsensus.observe(scan);
        if (promoted.isEmpty()) return stabilizingDecision(scan);

        AutoScanResult stableScan = promoted.get();
        StableGameState current = new StableGameState(
                stableScan.handCards(),
                stableScan.openCard(),
                stableScan.jokerRank(),
                stableScan.confidence(),
                timestampMs);
        return decideFromStable(stableScan, current, timestampMs);
    }

    /** Consumes a scan already promoted by an external consensus gate. */
    public synchronized PrimaryDecision observeConsensus(AutoScanResult scan, long timestampMs) {
        if (!acceptableConsensus(scan)) return presenter.present(null, null, memory, ledger);
        StableGameState current = new StableGameState(
                scan.handCards(),
                scan.openCard(),
                scan.jokerRank(),
                scan.confidence(),
                timestampMs);
        return decideFromStable(scan, current, timestampMs);
    }

    private PrimaryDecision stabilizingDecision(AutoScanResult scan) {
        int frames = frameConsensus.stableFrames();
        String confidence = Math.round(scan.confidence() * 100) + "%";
        String reason;
        int seen = scan.handCards().size();
        boolean incomplete = !scan.completeHand() || (seen != 13 && seen != 14);
        if (incomplete) {
            reason = "Only " + seen + " cards recognized. Check Vision diagnostics; no action.";
        } else if (scan.confidence() < MIN_CONSENSUS_CONFIDENCE) {
            reason = "Card scan confidence too low for advice • " + confidence;
        } else {
            reason = "Matching table frames " + frames + "/" + CONSENSUS_FRAMES + " • " + confidence;
        }
        String headline = incomplete
                ? "HAND SCAN " + seen + "/13–14"
                : "STABILIZING " + Math.min(frames, CONSENSUS_FRAMES) + "/" + CONSENSUS_FRAMES;
        return new PrimaryDecision(
                PrimaryDecision.Action.UNCERTAIN,
                headline,
                null,
                reason,
                "No action until three consecutive card states agree.",
                PrimaryDecision.Severity.STOP);
    }

    private PrimaryDecision decideFromStable(AutoScanResult scan, StableGameState current, long timestampMs) {
        ledger.refreshOwnHand(current.handCards());
        if (current.openCard() != null) ledger.observeVisibleCard(current.openCard());

        TurnPhase phase = scan.turnPhase() == null ? TurnPhase.UNKNOWN : scan.turnPhase();
        if (phase == TurnPhase.OTHER && previousPhase == TurnPhase.OTHER && previousStable != null) {
            List<OpponentTracker.Event> events = opponentTracker.observeTransition(
                    previousStable, current, false, "table");
            for (OpponentTracker.Event event : events) ledger.observeVisibleCard(event.cardCode());
        }
        previousStable = current;
        previousPhase = phase;

        if (phase == TurnPhase.OTHER) {
            return new PrimaryDecision(
                    PrimaryDecision.Action.WATCHING,
                    "WATCHING TABLE",
                    null,
                    "Tracking visible picks/discards and opponent danger patterns.",
                    diagnostics(current),
                    PrimaryDecision.Severity.CAUTION
            );
        }
        if (!phase.isUserTurn()) return presenter.present(current, null, memory, ledger);

        try {
            List<Card> hand = parseHand(current.handCards());
            Card open = current.openCard() == null ? null : Card.parse(current.openCard(), "open-" + timestampMs);
            Recommendation recommendation = advisor.advise(hand, open, current.jokerRank());
            return presenter.present(current, recommendation, memory, ledger);
        } catch (IllegalArgumentException error) {
            return presenter.present(current, null, memory, ledger);
        }
    }

    public PatternMemory memory() { return memory; }
    public KnownCardLedger ledger() { return ledger; }
    public synchronized int consensusFrames() { return frameConsensus.stableFrames(); }

    public synchronized void resetRound() {
        previousStable = null;
        previousPhase = TurnPhase.UNKNOWN;
        frameConsensus.reset();
        ledger.reset();
    }

    private static boolean acceptableConsensus(AutoScanResult scan) {
        if (scan == null || !scan.completeHand() || scan.confidence() < MIN_CONSENSUS_CONFIDENCE) return false;
        int size = scan.handCards().size();
        return size == 13 || size == 14;
    }

    private static List<Card> parseHand(List<String> codes) {
        List<Card> hand = new ArrayList<>();
        for (int i = 0; i < codes.size(); i++) hand.add(Card.parse(codes.get(i), "live-" + i));
        return hand;
    }

    private String diagnostics(StableGameState state) {
        StringBuilder text = new StringBuilder()
                .append("Scan ").append(Math.round(state.confidence() * 100)).append('%')
                .append(" • consensus ").append(CONSENSUS_FRAMES).append('/').append(CONSENSUS_FRAMES)
                .append(" • known ").append(ledger.knownTotal())
                .append(" • unseen ").append(ledger.unseenTotal())
                .append(" • learned moves ").append(memory.observations());
        var danger = memory.topRisks(3);
        if (!danger.isEmpty()) {
            text.append("\nDanger: ");
            boolean first = true;
            for (var entry : danger.entrySet()) {
                if (!first) text.append("  ");
                first = false;
                text.append(entry.getKey()).append(' ').append(Math.round(entry.getValue() * 100)).append('%');
            }
        }
        return text.toString();
    }
}
