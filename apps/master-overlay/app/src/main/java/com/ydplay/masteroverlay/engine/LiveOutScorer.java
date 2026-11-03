package com.ydplay.masteroverlay.engine;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/** Offline probability/outs analysis for owned sandbox and replay states. */
public final class LiveOutScorer {
    private LiveOutScorer() {}

    public static DecisionMetrics analyze(
            List<Card> hand,
            String wildRank,
            CardAvailability availability,
            int turnNumber
    ) {
        if (hand == null) throw new IllegalArgumentException("hand null");
        if (availability == null) throw new IllegalArgumentException("availability null");

        HandEvaluation base = RummyEngine.evaluate(hand, wildRank);
        if (base.validDeclaration()) {
            return new DecisionMetrics(
                    base.deadwood(), base.unmeldedCount(), base.pureSequences(), base.totalSequences(), true,
                    0, 0, 0, 0, base.deadwood(), earlyHighCardPenalty(base, wildRank, turnNumber), 0.0);
        }

        int liveOutCopies = 0;
        int improvingTypes = 0;
        int declarationOutCopies = 0;
        int bestDeadwoodAfterDraw = base.deadwood();
        double weightedImprovementSum = 0.0;
        int weightedCopies = 0;

        for (String code : allCodes()) {
            int copies = Math.max(0, availability.remaining(code));
            if (copies == 0) continue;

            Card draw;
            try {
                draw = Card.parse(code, "out-" + code);
            } catch (IllegalArgumentException ignored) {
                continue;
            }

            List<Card> fourteen = new ArrayList<>(hand);
            fourteen.add(draw);
            HandEvaluation bestAfterDraw = bestThirteenAfterOneDiscard(fourteen, wildRank);

            boolean improves = better(bestAfterDraw, base);
            if (!improves) continue;

            improvingTypes++;
            liveOutCopies += copies;
            if (bestAfterDraw.validDeclaration()) declarationOutCopies += copies;
            bestDeadwoodAfterDraw = Math.min(bestDeadwoodAfterDraw, bestAfterDraw.deadwood());
            weightedImprovementSum += Math.max(0, base.deadwood() - bestAfterDraw.deadwood()) * copies;
            weightedCopies += copies;
        }

        int pureMissing = base.pureSequences() >= 1 ? 0 : 1;
        int secondSequenceMissing = base.totalSequences() >= 2 ? 0 : 1;
        int meldDistance = base.unmeldedCount() + pureMissing * 3 + secondSequenceMissing * 2;

        return new DecisionMetrics(
                base.deadwood(),
                base.unmeldedCount(),
                base.pureSequences(),
                base.totalSequences(),
                false,
                meldDistance,
                liveOutCopies,
                improvingTypes,
                declarationOutCopies,
                bestDeadwoodAfterDraw,
                earlyHighCardPenalty(base, wildRank, turnNumber),
                weightedCopies == 0 ? 0.0 : weightedImprovementSum / weightedCopies);
    }

    public static int sequenceWaitCopies(List<String> partial, CardAvailability availability) {
        if (partial == null || partial.size() != 2 || availability == null) return 0;
        Card a;
        Card b;
        try {
            a = Card.parse(partial.get(0), "wait-a");
            b = Card.parse(partial.get(1), "wait-b");
        } catch (IllegalArgumentException error) {
            return 0;
        }
        if (a.printedJoker() || b.printedJoker() || !a.suit().equals(b.suit())) return 0;

        Set<String> completionCodes = new HashSet<>();
        for (String rank : Card.RANKS) {
            String code = rank + a.suit();
            if (code.equals(a.key()) || code.equals(b.key())) continue;
            try {
                Card c = Card.parse(code, "wait-c");
                if (RummyEngine.isPureSequence(List.of(a, b, c))) completionCodes.add(code);
            } catch (IllegalArgumentException ignored) {
            }
        }
        int copies = 0;
        for (String code : completionCodes) copies += Math.max(0, availability.remaining(code));
        return copies;
    }

    private static HandEvaluation bestThirteenAfterOneDiscard(List<Card> fourteen, String wildRank) {
        if (fourteen.size() != 14) return RummyEngine.evaluate(fourteen, wildRank);
        HandEvaluation best = null;
        for (int i = 0; i < fourteen.size(); i++) {
            List<Card> thirteen = new ArrayList<>(fourteen);
            thirteen.remove(i);
            HandEvaluation candidate = RummyEngine.evaluate(thirteen, wildRank);
            if (best == null || better(candidate, best)) best = candidate;
        }
        return best;
    }

    private static boolean better(HandEvaluation a, HandEvaluation b) {
        if (a.validDeclaration() != b.validDeclaration()) return a.validDeclaration();
        if (a.deadwood() != b.deadwood()) return a.deadwood() < b.deadwood();
        if (a.unmeldedCount() != b.unmeldedCount()) return a.unmeldedCount() < b.unmeldedCount();
        if (a.pureSequences() != b.pureSequences()) return a.pureSequences() > b.pureSequences();
        if (a.totalSequences() != b.totalSequences()) return a.totalSequences() > b.totalSequences();
        if (a.sets() != b.sets()) return a.sets() > b.sets();
        return a.meldedCount() > b.meldedCount();
    }

    private static int earlyHighCardPenalty(HandEvaluation evaluation, String wildRank, int turnNumber) {
        if (turnNumber > 4) return 0;
        int penalty = 0;
        for (Card card : evaluation.deadwoodCards()) {
            if (card.printedJoker() || card.rank().equals(wildRank)) continue;
            if (card.rank().equals("A") || card.rank().equals("K") || card.rank().equals("Q") || card.rank().equals("J")) {
                penalty += 10;
            }
        }
        return penalty;
    }

    private static List<String> allCodes() {
        List<String> out = new ArrayList<>(53);
        for (String rank : Card.RANKS) for (String suit : Card.SUITS) out.add(rank + suit);
        out.add("PJ");
        return out;
    }
}
