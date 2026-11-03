package com.ydplay.masteroverlay.scan;

import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

/**
 * Rejects transient/blurred card reads until the same physical table state has been observed
 * for the configured number of consecutive high-confidence frames.
 */
public final class CardFrameConsensus {
    private final int requiredFrames;
    private final double minConfidence;

    private Snapshot candidate;
    private int stableFrames;
    private double streakConfidence = 1.0;

    public CardFrameConsensus(int requiredFrames, double minConfidence) {
        if (requiredFrames < 1) throw new IllegalArgumentException("requiredFrames must be >= 1");
        if (minConfidence < 0.0 || minConfidence > 1.0) throw new IllegalArgumentException("minConfidence must be 0..1");
        this.requiredFrames = requiredFrames;
        this.minConfidence = minConfidence;
    }

    public Optional<AutoScanResult> observe(AutoScanResult frame) {
        if (!acceptable(frame)) {
            reset();
            return Optional.empty();
        }

        Snapshot snapshot = Snapshot.from(frame);
        if (candidate == null || !candidate.equals(snapshot)) {
            candidate = snapshot;
            stableFrames = 1;
            streakConfidence = frame.confidence();
            return requiredFrames == 1 ? Optional.of(withConfidence(frame, streakConfidence)) : Optional.empty();
        }

        stableFrames++;
        streakConfidence = Math.min(streakConfidence, frame.confidence());
        if (stableFrames < requiredFrames) return Optional.empty();
        return Optional.of(withConfidence(frame, streakConfidence));
    }

    public int stableFrames() { return stableFrames; }

    public void reset() {
        candidate = null;
        stableFrames = 0;
        streakConfidence = 1.0;
    }

    private boolean acceptable(AutoScanResult frame) {
        if (frame == null || !frame.completeHand() || frame.confidence() < minConfidence) return false;
        int size = frame.handCards().size();
        return size == 13 || size == 14;
    }

    private static AutoScanResult withConfidence(AutoScanResult frame, double confidence) {
        return new AutoScanResult(
                frame.handCards(),
                frame.openCard(),
                frame.jokerRank(),
                frame.completeHand(),
                confidence,
                frame.allDetectedCards(),
                frame.turnPhase());
    }

    private record Snapshot(Map<String,Integer> handCounts, String openCard, String jokerRank, TurnPhase turnPhase) {
        static Snapshot from(AutoScanResult frame) {
            return new Snapshot(
                    counts(frame.handCards()),
                    normalize(frame.openCard()),
                    normalize(frame.jokerRank()),
                    frame.turnPhase() == null ? TurnPhase.UNKNOWN : frame.turnPhase());
        }

        private static Map<String,Integer> counts(List<String> cards) {
            Map<String,Integer> out = new HashMap<>();
            for (String raw : cards) {
                String code = normalize(raw);
                if (code != null) out.merge(code, 1, Integer::sum);
            }
            return Map.copyOf(out);
        }

        private static String normalize(String raw) {
            if (raw == null) return null;
            String value = raw.trim().toUpperCase(Locale.ROOT)
                    .replace("♠", "S")
                    .replace("♥", "H")
                    .replace("♦", "D")
                    .replace("♣", "C");
            return value.isEmpty() ? null : value;
        }
    }
}
