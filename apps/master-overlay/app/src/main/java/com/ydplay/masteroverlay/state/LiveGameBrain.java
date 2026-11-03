package com.ydplay.masteroverlay.state;

import com.ydplay.masteroverlay.engine.Card;
import com.ydplay.masteroverlay.engine.MasterAdvisor;
import com.ydplay.masteroverlay.engine.PatternMemory;
import com.ydplay.masteroverlay.engine.Recommendation;
import com.ydplay.masteroverlay.scan.AutoScanResult;
import com.ydplay.masteroverlay.scan.TurnPhase;
import com.ydplay.masteroverlay.ui.DecisionPresenter;
import com.ydplay.masteroverlay.ui.PrimaryDecision;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public final class LiveGameBrain {
    private final PatternMemory memory = new PatternMemory();
    private final KnownCardLedger ledger = new KnownCardLedger();
    private final StableGameStateTracker stableTracker = new StableGameStateTracker();
    private final OpponentTracker opponentTracker = new OpponentTracker(memory);
    private final MasterAdvisor advisor = new MasterAdvisor(memory);
    private final DecisionPresenter presenter = new DecisionPresenter();

    private StableGameState previousStable;

    public synchronized PrimaryDecision observe(AutoScanResult scan, long timestampMs) {
        if (scan == null) return presenter.present(null, null, memory, ledger);

        Optional<StableGameState> promoted = stableTracker.observe(scan, timestampMs);
        if (promoted.isEmpty()) return presenter.present(null, null, memory, ledger);

        StableGameState current = promoted.get();
        ledger.refreshOwnHand(current.handCards());
        if (current.openCard() != null) ledger.observeVisibleCard(current.openCard());

        TurnPhase phase = scan.turnPhase() == null ? TurnPhase.UNKNOWN : scan.turnPhase();
        if (phase == TurnPhase.OTHER && previousStable != null) {
            List<OpponentTracker.Event> events = opponentTracker.observeTransition(
                    previousStable, current, false, "table");
            for (OpponentTracker.Event event : events) ledger.observeVisibleCard(event.cardCode());
        }
        previousStable = current;

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

    public synchronized void resetRound() {
        previousStable = null;
        stableTracker.reset();
        ledger.reset();
    }

    private static List<Card> parseHand(List<String> codes) {
        List<Card> hand = new ArrayList<>();
        for (int i = 0; i < codes.size(); i++) hand.add(Card.parse(codes.get(i), "live-" + i));
        return hand;
    }

    private String diagnostics(StableGameState state) {
        StringBuilder text = new StringBuilder()
                .append("Scan ").append(Math.round(state.confidence() * 100)).append('%')
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
