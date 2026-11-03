package com.ydplay.masteroverlay.scan;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

/** Pure geometry helpers for the observed Gold Rummy landscape skin. */
public final class GoldRummyHandGeometry {
    public record Candidate(int x, double edgeScore, double whiteRightRatio) {}

    private GoldRummyHandGeometry() {}

    public static int expectedHandCount(String screenText) {
        if (screenText == null) return 0;
        String normalized = screenText.toUpperCase(Locale.ROOT).replaceAll("\\s+", " ").trim();
        if (normalized.contains("TURN TO DISCARD")) return 14;
        if (normalized.contains("TURN TO PICK")) return 13;
        return 0;
    }

    /**
     * Scores a vertical boundary across many sampled rows. A real overlapped card edge persists
     * down the card, while rank/artwork edges are sparse. rightWhiteFraction[i] is the fraction
     * of neutral-white pixels immediately to the right of the candidate in that sampled row.
     */
    public static double boundaryScore(int[] leftLuma, int[] rightLuma, double[] rightWhiteFraction) {
        if (leftLuma == null || rightLuma == null || rightWhiteFraction == null) return 0.0;
        int n = Math.min(leftLuma.length, Math.min(rightLuma.length, rightWhiteFraction.length));
        if (n == 0) return 0.0;

        int persistent = 0;
        double maskedDiff = 0.0;
        for (int i = 0; i < n; i++) {
            int diff = Math.abs(rightLuma[i] - leftLuma[i]);
            boolean whiteToRight = rightWhiteFraction[i] >= 0.60;
            if (whiteToRight) {
                maskedDiff += diff;
                if (diff >= 25) persistent++;
            }
        }
        double persistence = persistent / (double) n;
        double meanMaskedDiff = maskedDiff / n;
        return persistence * 100.0 + meanMaskedDiff * 0.25;
    }

    /**
     * Rejects false edges caused by card artwork rather than by the card's actual upper border.
     * topBandContrast[x] measures luminance discontinuity at cardTop+2..cardTop+12.
     * The threshold is based on the supplied Gold-style screenshot samples; it is NOT
     * a confidence claim about rank/suit recognition.
     */
    public static List<Integer> selectStartsWithTopBand(
            int width, List<Candidate> candidates, double[] topBandContrast, int expectedCount) {
        if (candidates == null || topBandContrast == null || topBandContrast.length < width) {
            return List.of();
        }
        List<Candidate> confirmed = new ArrayList<>();
        for (Candidate candidate : candidates) {
            if (candidate == null || candidate.x() < 0 || candidate.x() >= width) continue;
            if (Double.isFinite(topBandContrast[candidate.x()])
                    && topBandContrast[candidate.x()] >= 8.0) {
                confirmed.add(candidate);
            }
        }
        return selectStarts(width, confirmed, expectedCount);
    }

    /**
     * Non-maximum suppression over persistent boundary candidates. Overlapped cards on this skin
     * are separated by roughly 4% of screen width; artwork/noise peaks usually occur within 3% of
     * a real left edge. A genuine left edge must also have a mostly-white card body immediately to
     * its right, which rejects group-gap borders and UI artwork.
     */
    public static List<Integer> selectStarts(int width, List<Candidate> candidates, int expectedCount) {
        if (width <= 0 || candidates == null || candidates.isEmpty()) return List.of();

        int minSpacing = Math.max(24, (int) Math.round(width * 0.032));
        List<Candidate> ranked = new ArrayList<>();
        for (Candidate c : candidates) {
            if (c == null) continue;
            if (c.x() < 0 || c.x() >= width) continue;
            if (c.edgeScore() < 18.0 || c.whiteRightRatio() < 0.50) continue;
            ranked.add(c);
        }
        ranked.sort(Comparator
                .comparingDouble(Candidate::edgeScore).reversed()
                .thenComparing(Comparator.comparingDouble(Candidate::whiteRightRatio).reversed())
                .thenComparingInt(Candidate::x));

        List<Candidate> selected = new ArrayList<>();
        for (Candidate c : ranked) {
            boolean tooClose = false;
            for (Candidate kept : selected) {
                if (Math.abs(c.x() - kept.x()) < minSpacing) {
                    tooClose = true;
                    break;
                }
            }
            if (!tooClose) selected.add(c);
        }

        if (expectedCount > 0 && selected.size() > expectedCount) {
            selected.sort(Comparator
                    .comparingDouble(Candidate::edgeScore).reversed()
                    .thenComparing(Comparator.comparingDouble(Candidate::whiteRightRatio).reversed()));
            selected = new ArrayList<>(selected.subList(0, expectedCount));
        }
        selected.sort(Comparator.comparingInt(Candidate::x));

        List<Integer> starts = new ArrayList<>(selected.size());
        for (Candidate c : selected) starts.add(c.x());
        return List.copyOf(starts);
    }
}
