package com.ydplay.masteroverlay.ui;

import com.ydplay.masteroverlay.engine.PatternMemory;
import com.ydplay.masteroverlay.engine.Recommendation;
import com.ydplay.masteroverlay.state.KnownCardLedger;
import com.ydplay.masteroverlay.state.StableGameState;

import java.util.*;

public final class DecisionPresenter {
    private static final double MIN_ACTION_CONFIDENCE = 0.80;

    public PrimaryDecision present(
            StableGameState state,
            Recommendation recommendation,
            PatternMemory memory,
            KnownCardLedger ledger
    ) {
        PatternMemory safeMemory = memory == null ? new PatternMemory() : memory;
        KnownCardLedger safeLedger = ledger == null ? new KnownCardLedger() : ledger;
        if (!actionable(state, recommendation)) return uncertain(state, safeLedger, safeMemory);

        if (state.isFourteenCardState()) {
            if (recommendation.discard() == null) return uncertain(state, safeLedger, safeMemory);
            String card = recommendation.discard().key();
            double risk = safeMemory.risk(card);
            return new PrimaryDecision(
                    PrimaryDecision.Action.DISCARD,
                    "DISCARD → " + card,
                    card,
                    deadwoodReason(recommendation, risk),
                    details(state, safeLedger, safeMemory),
                    risk >= 0.70 ? PrimaryDecision.Severity.CAUTION : PrimaryDecision.Severity.GO
            );
        }

        if ("OPEN".equalsIgnoreCase(recommendation.drawChoice())) {
            String card = state.openCard();
            double risk = recommendation.discard() == null ? 0 : safeMemory.risk(recommendation.discard().key());
            return new PrimaryDecision(
                    PrimaryDecision.Action.PICK_OPEN,
                    "PICK OPEN → " + card,
                    card,
                    deadwoodReason(recommendation, risk),
                    details(state, safeLedger, safeMemory),
                    PrimaryDecision.Severity.GO
            );
        }

        if ("CLOSED".equalsIgnoreCase(recommendation.drawChoice())) {
            return new PrimaryDecision(
                    PrimaryDecision.Action.DRAW_CLOSED,
                    "DRAW CLOSED",
                    null,
                    "Open " + state.openCard() + " does not improve the best legal hand enough.",
                    details(state, safeLedger, safeMemory),
                    PrimaryDecision.Severity.GO
            );
        }

        return uncertain(state, safeLedger, safeMemory);
    }

    private static boolean actionable(StableGameState state, Recommendation recommendation) {
        if (state == null || recommendation == null) return false;
        if (state.confidence() < MIN_ACTION_CONFIDENCE) return false;
        if (state.jokerRank() == null || state.jokerRank().isBlank()) return false;
        if (!state.isThirteenCardState() && !state.isFourteenCardState()) return false;
        return !state.isThirteenCardState() || (state.openCard() != null && !state.openCard().isBlank());
    }

    private static PrimaryDecision uncertain(StableGameState state, KnownCardLedger ledger, PatternMemory memory) {
        return new PrimaryDecision(
                PrimaryDecision.Action.UNCERTAIN,
                "SCAN UNCERTAIN — DON'T ACT",
                null,
                "Need a stable hand, Joker, and current open-card state before giving advice.",
                details(state, ledger, memory),
                PrimaryDecision.Severity.STOP
        );
    }

    private static String deadwoodReason(Recommendation r, double risk) {
        StringBuilder s = new StringBuilder("Deadwood ")
                .append(r.beforeDeadwood()).append('→').append(r.afterDeadwood());
        if (risk > 0.0) s.append(" • opponent risk ").append(Math.round(risk * 100)).append('%');
        if (r.validDeclaration()) s.append(" • declaration ready");
        return s.toString();
    }

    private static String details(StableGameState state, KnownCardLedger ledger, PatternMemory memory) {
        String confidence = state == null ? "0%" : Math.round(state.confidence() * 100) + "%";
        StringBuilder s = new StringBuilder("Scan ").append(confidence)
                .append(" • known ").append(ledger.knownTotal())
                .append(" • unseen ").append(ledger.unseenTotal());
        Map<String,Double> danger = memory.topRisks(3);
        if (!danger.isEmpty()) {
            s.append("\nDanger: ");
            boolean first = true;
            for (Map.Entry<String,Double> e : danger.entrySet()) {
                if (!first) s.append("  ");
                first = false;
                s.append(e.getKey()).append(' ').append(Math.round(e.getValue() * 100)).append('%');
            }
        }
        return s.toString();
    }
}
