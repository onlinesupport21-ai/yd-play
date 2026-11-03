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
     * Non-maximum suppression over vertical-edge candidates. Overlapped cards on this skin are
     * separated by roughly 4% of screen width; artwork/noise peaks usually occur within 3% of a
     * real left edge. A genuine left edge must also have a mostly-white card body immediately to
     * its right, which rejects group-gap borders that were visible in the user's screenshot.
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
