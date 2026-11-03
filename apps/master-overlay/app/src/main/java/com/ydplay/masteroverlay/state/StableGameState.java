package com.ydplay.masteroverlay.state;

import java.util.List;

public record StableGameState(
        List<String> handCards,
        String openCard,
        String jokerRank,
        double confidence,
        long timestampMs
) {
    public StableGameState {
        handCards = List.copyOf(handCards);
    }

    public boolean isThirteenCardState() { return handCards.size() == 13; }
    public boolean isFourteenCardState() { return handCards.size() == 14; }
}
