package com.ydplay.masteroverlay.scan;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

public final class ScreenRegionClassifier {
    private static final double HAND_TOP = 0.68;

    private ScreenRegionClassifier() {}

    private record PositionedCard(String code, OcrHit hit) {}

    public static AutoScanResult classify(int width, int height, List<OcrHit> hits) {
        if (width <= 0 || height <= 0) throw new IllegalArgumentException("screen size must be positive");
        if (hits == null) hits = List.of();

        List<PositionedCard> hand = new ArrayList<>();
        List<PositionedCard> outsideHand = new ArrayList<>();
        List<String> allCards = new ArrayList<>();
        List<OcrHit> jokerLabels = new ArrayList<>();

        for (OcrHit hit : hits) {
            if (hit == null || hit.text() == null) continue;
            String rawUpper = hit.text().trim().toUpperCase(Locale.ROOT);
            boolean jokerLabel = rawUpper.contains("JOKER");
            if (jokerLabel) jokerLabels.add(hit);

            List<String> codes = CardTokenParser.extractCardCodes(hit.text());
            for (String code : codes) {
                allCards.add(code);
                if (jokerLabel && "PJ".equals(code)) continue;
                PositionedCard positioned = new PositionedCard(code, hit);
                if (hit.centerY() / height >= HAND_TOP) hand.add(positioned);
                else outsideHand.add(positioned);
            }
        }

        hand.sort(Comparator.comparingDouble((PositionedCard c) -> c.hit().centerX())
                .thenComparingDouble(c -> c.hit().centerY()));
        List<String> handCards = new ArrayList<>();
        for (PositionedCard card : hand) handCards.add(card.code());

        String jokerRank = findJokerRank(width, height, jokerLabels, outsideHand);
        String openCard = findOpenCard(width, height, outsideHand);
        boolean completeHand = handCards.size() == 13 || handCards.size() == 14;

        double confidence = Math.min(0.70, (handCards.size() / 13.0) * 0.70);
        if (completeHand) confidence = Math.max(confidence, 0.75);
        if (openCard != null) confidence += 0.15;
        if (jokerRank != null) confidence += 0.10;
        confidence = Math.min(1.0, confidence);

        return new AutoScanResult(handCards, openCard, jokerRank, completeHand, confidence, allCards);
    }

    private static String findOpenCard(int width, int height, List<PositionedCard> cards) {
        double centerX = width / 2.0;
        double centerY = height / 2.0;
        PositionedCard best = null;
        double bestDistance = Double.MAX_VALUE;
        for (PositionedCard card : cards) {
            if ("PJ".equals(card.code())) continue;
            double d = distance(card.hit().centerX(), card.hit().centerY(), centerX, centerY);
            if (d < bestDistance) {
                bestDistance = d;
                best = card;
            }
        }
        return best == null ? null : best.code();
    }

    private static String findJokerRank(int width, int height, List<OcrHit> labels, List<PositionedCard> cards) {
        if (labels.isEmpty()) return null;
        double maxDistance = Math.hypot(width, height) * 0.25;
        PositionedCard best = null;
        double bestDistance = Double.MAX_VALUE;
        for (OcrHit label : labels) {
            for (PositionedCard card : cards) {
                if ("PJ".equals(card.code())) continue;
                double d = distance(label.centerX(), label.centerY(), card.hit().centerX(), card.hit().centerY());
                if (d <= maxDistance && d < bestDistance) {
                    bestDistance = d;
                    best = card;
                }
            }
        }
        if (best == null) return null;
        String code = best.code();
        return code.substring(0, code.length() - 1);
    }

    private static double distance(double x1, double y1, double x2, double y2) {
        return Math.hypot(x1 - x2, y1 - y2);
    }
}
