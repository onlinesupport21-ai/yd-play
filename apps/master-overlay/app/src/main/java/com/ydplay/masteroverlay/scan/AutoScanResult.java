package com.ydplay.masteroverlay.scan;

import java.util.List;

public record AutoScanResult(
        List<String> handCards,
        String openCard,
        String jokerRank,
        boolean completeHand,
        double confidence,
        List<String> allDetectedCards
) {
    public AutoScanResult {
        handCards = List.copyOf(handCards);
        allDetectedCards = List.copyOf(allDetectedCards);
    }
}
