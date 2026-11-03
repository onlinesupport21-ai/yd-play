package com.ydplay.masteroverlay.state;

import com.ydplay.masteroverlay.engine.Card;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Exact 106-card availability ledger for owned sandbox/replay state where physical-card IDs are
 * available. Live screen-only code should keep using the conservative KnownCardLedger because a
 * repeated sighting there cannot prove that a second physical copy was observed.
 */
public final class DeckMemoryMatrix {
    private static final double PICKED_CARD_RISK = 0.95;
    private static final double ADJACENT_RISK = 0.72;
    private static final double TWO_AWAY_RISK = 0.38;
    private static final double SAME_RANK_RISK = 0.32;

    private final Map<String,Integer> ownCounts = new HashMap<>();
    private final Map<String,Set<String>> externalPhysicalIds = new HashMap<>();
    private final Map<String,Map<String,Double>> dangerByOpponent = new HashMap<>();

    public synchronized void observeOwnHand(List<String> cards) {
        ownCounts.clear();
        if (cards == null) return;
        for (String raw : cards) {
            String code = normalize(raw);
            if (maxCopies(code) == 0) continue;
            int next = ownCounts.getOrDefault(code, 0) + 1;
            ownCounts.put(code, Math.min(maxCopies(code), next));
        }
    }

    public synchronized void observeExternalSeen(String raw, String physicalId) {
        String code = normalize(raw);
        if (maxCopies(code) == 0) return;
        String id = normalizeId(physicalId);
        if (id == null) id = "unknown:" + code;
        externalPhysicalIds.computeIfAbsent(code, ignored -> new HashSet<>()).add(id);
    }

    public synchronized void observeOpponentPickup(String opponentId, String raw, String physicalId) {
        String code = normalize(raw);
        if (maxCopies(code) == 0) return;
        observeExternalSeen(code, physicalId);

        String opponent = opponentId == null || opponentId.isBlank() ? "table" : opponentId.trim();
        Map<String,Double> risk = dangerByOpponent.computeIfAbsent(opponent, ignored -> new HashMap<>());
        addRisk(risk, code, PICKED_CARD_RISK);

        if ("PJ".equals(code)) return;
        String suit = code.substring(code.length() - 1);
        String rank = code.substring(0, code.length() - 1);
        int rankIndex = rankIndex(rank);
        if (rankIndex >= 0) {
            addRankNeighbor(risk, rankIndex - 1, suit, ADJACENT_RISK);
            addRankNeighbor(risk, rankIndex + 1, suit, ADJACENT_RISK);
            addRankNeighbor(risk, rankIndex - 2, suit, TWO_AWAY_RISK);
            addRankNeighbor(risk, rankIndex + 2, suit, TWO_AWAY_RISK);
        }
        for (String otherSuit : Card.SUITS) {
            if (!otherSuit.equals(suit)) addRisk(risk, rank + otherSuit, SAME_RANK_RISK);
        }
    }

    public synchronized int remaining(String raw) {
        String code = normalize(raw);
        int max = maxCopies(code);
        if (max == 0) return 0;
        return Math.max(0, max - knownCount(code));
    }

    public synchronized int knownCount(String raw) {
        String code = normalize(raw);
        int max = maxCopies(code);
        if (max == 0) return 0;
        int own = Math.min(max, ownCounts.getOrDefault(code, 0));
        int externalRoom = Math.max(0, max - own);
        int external = Math.min(externalRoom, externalSeenCount(code));
        return Math.min(max, own + external);
    }

    public synchronized int externalSeenCount(String raw) {
        String code = normalize(raw);
        if (maxCopies(code) == 0) return 0;
        Set<String> ids = externalPhysicalIds.get(code);
        if (ids == null) return 0;
        return Math.min(maxCopies(code), ids.size());
    }

    public synchronized int unseenTotal() {
        int total = 0;
        for (String code : allCodes()) total += remaining(code);
        return total;
    }

    public synchronized double danger(String raw) {
        String code = normalize(raw);
        if (maxCopies(code) == 0) return 0.0;
        double max = 0.0;
        for (Map<String,Double> risk : dangerByOpponent.values()) {
            max = Math.max(max, risk.getOrDefault(code, 0.0));
        }
        return max;
    }

    public synchronized void reset() {
        ownCounts.clear();
        externalPhysicalIds.clear();
        dangerByOpponent.clear();
    }

    private static void addRankNeighbor(Map<String,Double> risk, int rankIndex, String suit, double value) {
        if (rankIndex < 0 || rankIndex >= Card.RANKS.length) return;
        addRisk(risk, Card.RANKS[rankIndex] + suit, value);
    }

    private static void addRisk(Map<String,Double> risk, String code, double value) {
        risk.put(code, Math.max(risk.getOrDefault(code, 0.0), clamp(value)));
    }

    private static double clamp(double value) {
        return Math.max(0.0, Math.min(1.0, value));
    }

    private static int rankIndex(String rank) {
        for (int i = 0; i < Card.RANKS.length; i++) if (Card.RANKS[i].equals(rank)) return i;
        return -1;
    }

    private static int maxCopies(String code) {
        if (code == null) return 0;
        if ("PJ".equals(code)) return 2;
        if (code.length() < 2) return 0;
        String suit = code.substring(code.length() - 1);
        String rank = code.substring(0, code.length() - 1);
        boolean suitOk = false;
        for (String candidate : Card.SUITS) if (candidate.equals(suit)) suitOk = true;
        boolean rankOk = false;
        for (String candidate : Card.RANKS) if (candidate.equals(rank)) rankOk = true;
        return rankOk && suitOk ? 2 : 0;
    }

    private static String normalize(String raw) {
        if (raw == null) return null;
        String value = raw.trim().toUpperCase(Locale.ROOT)
                .replace("♠", "S")
                .replace("♥", "H")
                .replace("♦", "D")
                .replace("♣", "C");
        if (value.equals("JOKER") || value.equals("JK")) value = "PJ";
        return value.isEmpty() ? null : value;
    }

    private static String normalizeId(String physicalId) {
        if (physicalId == null) return null;
        String value = physicalId.trim();
        return value.isEmpty() ? null : value;
    }

    private static List<String> allCodes() {
        List<String> out = new ArrayList<>(53);
        for (String rank : Card.RANKS) {
            for (String suit : Card.SUITS) out.add(rank + suit);
        }
        out.add("PJ");
        return out;
    }
}
