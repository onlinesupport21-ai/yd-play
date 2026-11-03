package com.ydplay.masteroverlay.state;

import com.ydplay.masteroverlay.scan.AutoScanResult;

import java.util.*;

public final class StableGameStateTracker {
    private static final double MIN_CONFIDENCE = 0.75;

    private Candidate candidate;

    public Optional<StableGameState> observe(AutoScanResult scan, long timestampMs) {
        if (!acceptable(scan)) {
            candidate = null;
            return Optional.empty();
        }

        Snapshot snapshot = new Snapshot(scan.handCards(), scan.openCard(), scan.jokerRank());
        if (candidate == null || !candidate.snapshot.compatibleWith(snapshot)) {
            candidate = new Candidate(snapshot, scan.confidence(), timestampMs, 1);
            return Optional.empty();
        }

        candidate = new Candidate(
                snapshot,
                Math.min(candidate.confidence, scan.confidence()),
                timestampMs,
                candidate.samples + 1
        );
        if (candidate.samples < 2) return Optional.empty();

        return Optional.of(new StableGameState(
                scan.handCards(),
                scan.openCard(),
                scan.jokerRank(),
                candidate.confidence,
                timestampMs
        ));
    }

    public void reset() { candidate = null; }

    private static boolean acceptable(AutoScanResult scan) {
        if (scan == null || !scan.completeHand() || scan.confidence() < MIN_CONFIDENCE) return false;
        int size = scan.handCards().size();
        return size == 13 || size == 14;
    }

    private record Candidate(Snapshot snapshot, double confidence, long timestampMs, int samples) {}

    private static final class Snapshot {
        private final Map<String,Integer> handCounts;
        private final String openCard;
        private final String jokerRank;

        Snapshot(List<String> hand, String openCard, String jokerRank) {
            this.handCounts = counts(hand);
            this.openCard = normalize(openCard);
            this.jokerRank = normalize(jokerRank);
        }

        boolean compatibleWith(Snapshot other) {
            return other != null
                    && handCounts.equals(other.handCounts)
                    && Objects.equals(openCard, other.openCard)
                    && Objects.equals(jokerRank, other.jokerRank);
        }

        private static Map<String,Integer> counts(List<String> cards) {
            Map<String,Integer> out = new HashMap<>();
            if (cards != null) for (String c : cards) {
                String key = normalize(c);
                if (key != null) out.merge(key, 1, Integer::sum);
            }
            return out;
        }

        private static String normalize(String s) {
            if (s == null) return null;
            String v = s.trim().toUpperCase(Locale.ROOT);
            return v.isEmpty() ? null : v;
        }
    }
}
