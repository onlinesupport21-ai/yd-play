package com.ydplay.masteroverlay.state;

import java.util.*;

public final class KnownCardLedger {
    private final Map<String,Integer> own = new HashMap<>();
    private final Map<String,Integer> visible = new HashMap<>();

    public synchronized void refreshOwnHand(List<String> cards) {
        own.clear();
        if (cards == null) return;
        for (String raw : cards) {
            String code = normalize(raw);
            int max = maxCopies(code);
            if (max == 0) continue;
            own.put(code, Math.min(max, own.getOrDefault(code, 0) + 1));
        }
    }

    /**
     * Records that at least one external physical copy of this code has been seen. Without a
     * stable physical-card identity, repeated sightings of the same code are intentionally not
     * promoted to a second copy.
     */
    public synchronized void observeVisibleCard(String raw) {
        String code = normalize(raw);
        int max = maxCopies(code);
        if (max == 0) return;
        int ownCount = own.getOrDefault(code, 0);
        int room = Math.max(0, max - ownCount);
        if (room > 0) visible.put(code, Math.max(visible.getOrDefault(code, 0), 1));
    }

    public synchronized int knownCount(String raw) {
        String code = normalize(raw);
        int max = maxCopies(code);
        if (max == 0) return 0;
        return Math.min(max, own.getOrDefault(code, 0) + visible.getOrDefault(code, 0));
    }

    public synchronized int remainingCount(String raw) {
        String code = normalize(raw);
        int max = maxCopies(code);
        return Math.max(0, max - knownCount(code));
    }

    public synchronized int knownTotal() {
        int sum = 0;
        for (String code : allCodes()) sum += knownCount(code);
        return sum;
    }

    public synchronized int unseenTotal() { return 106 - knownTotal(); }

    public synchronized void reset() {
        own.clear();
        visible.clear();
    }

    private static int maxCopies(String code) {
        if (code == null) return 0;
        if ("PJ".equals(code)) return 2;
        if (code.length() < 2) return 0;
        String suit = code.substring(code.length() - 1);
        String rank = code.substring(0, code.length() - 1);
        if (!Set.of("S","H","D","C").contains(suit)) return 0;
        if (!Set.of("A","2","3","4","5","6","7","8","9","10","J","Q","K").contains(rank)) return 0;
        return 2;
    }

    private static String normalize(String raw) {
        if (raw == null) return null;
        String s = raw.trim().toUpperCase(Locale.ROOT).replace("♠","S").replace("♥","H").replace("♦","D").replace("♣","C");
        return s.isEmpty() ? null : s;
    }

    private static List<String> allCodes() {
        List<String> out = new ArrayList<>(53);
        for (String rank : List.of("A","2","3","4","5","6","7","8","9","10","J","Q","K"))
            for (String suit : List.of("S","H","D","C")) out.add(rank + suit);
        out.add("PJ");
        return out;
    }
}
