package com.ydplay.masteroverlay.scan;

import java.util.List;

public record AutoScanResult(
        List<String> handCards,
        String openCard,
        String jokerRank,
        boolean completeHand,
        double confidence,
        List<String> allDetectedCards,
        TurnPhase turnPhase
) {
    public AutoScanResult {
        handCards = List.copyOf(handCards);
        allDetectedCards = List.copyOf(allDetectedCards);
        turnPhase = turnPhase == null ? TurnPhase.UNKNOWN : turnPhase;
    }

    public AutoScanResult(
            List<String> handCards,
            String openCard,
            String jokerRank,
            boolean completeHand,
            double confidence,
            List<String> allDetectedCards
    ) {
        this(handCards, openCard, jokerRank, completeHand, confidence, allDetectedCards, TurnPhase.UNKNOWN);
    }
}
