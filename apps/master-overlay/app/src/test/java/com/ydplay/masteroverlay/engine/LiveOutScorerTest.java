package com.ydplay.masteroverlay.engine;

import org.junit.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

public class LiveOutScorerTest {
    @Test public void openEndedPureRunHasMoreNaturalOutCopiesThanGutshot() {
        CardAvailability freshDeck = code -> 2;

        assertEquals(4, LiveOutScorer.sequenceWaitCopies(List.of("5S", "6S"), freshDeck));
        assertEquals(2, LiveOutScorer.sequenceWaitCopies(List.of("5S", "7S"), freshDeck));
    }

    @Test public void sequenceWaitCopiesRespectLiveRemainingCounts() {
        CardAvailability availability = code -> switch (code) {
            case "4S" -> 0;
            case "7S" -> 1;
            case "6S" -> 0;
            default -> 0;
        };

        assertEquals(1, LiveOutScorer.sequenceWaitCopies(List.of("5S", "6S"), availability));
        assertEquals(0, LiveOutScorer.sequenceWaitCopies(List.of("5S", "7S"), availability));
    }

    @Test public void exactDrawEnumerationCountsOnlyAvailableImprovingCopies() {
        List<Card> hand = cards(
                "2H","3H","4H",
                "7D","8D","9D",
                "5S","5H","5D",
                "10S","10H","10D",
                "6C");
        CardAvailability onlyTenClubs = code -> "10C".equals(code) ? 1 : 0;

        DecisionMetrics metrics = LiveOutScorer.analyze(hand, null, onlyTenClubs, 2);

        assertEquals(1, metrics.liveOutCopies());
        assertEquals(1, metrics.improvingCardTypes());
        assertEquals(1, metrics.declarationOutCopies());
        assertTrue(metrics.bestDeadwoodAfterDraw() < metrics.deadwood());
    }

    @Test public void deadWaitHasZeroLiveOutsWhenImprovingCardsAreExhausted() {
        List<Card> hand = cards(
                "2H","3H","4H",
                "7D","8D","9D",
                "5S","5H","5D",
                "10S","10H","10D",
                "6C");

        DecisionMetrics metrics = LiveOutScorer.analyze(hand, null, code -> 0, 6);

        assertEquals(0, metrics.liveOutCopies());
        assertEquals(0, metrics.improvingCardTypes());
        assertEquals(0, metrics.declarationOutCopies());
    }

    @Test public void validDeclarationHasZeroMeldDistanceScore() {
        List<Card> valid = cards(
                "2H","3H","4H",
                "7D","8D","9D",
                "5S","5H","5D",
                "10S","10H","10D","10C");

        DecisionMetrics metrics = LiveOutScorer.analyze(valid, null, code -> 0, 1);

        assertTrue(metrics.validDeclaration());
        assertEquals(0, metrics.meldDistanceScore());
        assertEquals(0, metrics.deadwood());
    }

    @Test public void isolatedHighDeadwoodIsPenalizedOnlyInEarlyPhaseMetric() {
        List<Card> hand = cards(
                "2H","3H","4H",
                "7D","8D","9D",
                "5S","5H","5D",
                "10S","10H","10D",
                "KC");

        DecisionMetrics early = LiveOutScorer.analyze(hand, null, code -> 0, 2);
        DecisionMetrics late = LiveOutScorer.analyze(hand, null, code -> 0, 6);

        assertEquals(10, early.earlyHighCardPenalty());
        assertEquals(0, late.earlyHighCardPenalty());
    }

    private static List<Card> cards(String... codes) {
        List<Card> out = new ArrayList<>();
        for (int i = 0; i < codes.length; i++) out.add(Card.parse(codes[i], "t-" + i));
        return out;
    }
}
