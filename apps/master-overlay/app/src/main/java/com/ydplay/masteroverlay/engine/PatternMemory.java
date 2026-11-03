package com.ydplay.masteroverlay.engine;

import java.util.*;

public final class PatternMemory {
  public enum Action { PICK_OPEN, DISCARD }
  private final Map<String, Map<String, Double>> byOpponent = new LinkedHashMap<>();
  private int observations = 0;

  public synchronized void observe(String opponent, Action action, Card card) {
    if (opponent == null || opponent.isBlank() || card == null) return;
    decay();
    Map<String, Double> map = byOpponent.computeIfAbsent(opponent, k -> new LinkedHashMap<>());
    double sign = action == Action.PICK_OPEN ? 1.0 : -0.78;
    add(map, card.key(), sign * 0.95);
    if (!card.printedJoker()) {
      int idx = rankIndex(card.rank());
      for (int d = -2; d <= 2; d++) {
        if (d == 0) continue;
        int j = idx + d;
        if (j >= 0 && j < Card.RANKS.length) add(map, Card.RANKS[j] + card.suit(), sign * (Math.abs(d)==1 ? 0.72 : 0.38));
      }
      for (String suit : Card.SUITS) if (!suit.equals(card.suit())) add(map, card.rank()+suit, sign * 0.32);
    }
    observations++;
  }

  private void decay() {
    for (Map<String, Double> m : byOpponent.values()) {
      for (Map.Entry<String, Double> e : new ArrayList<>(m.entrySet())) {
        double v = e.getValue() * 0.965;
        if (Math.abs(v) < 0.02) m.remove(e.getKey()); else e.setValue(v);
      }
    }
  }

  private static int rankIndex(String rank) {
    for (int i=0;i<Card.RANKS.length;i++) if (Card.RANKS[i].equals(rank)) return i;
    return -1;
  }

  private static void add(Map<String, Double> map, String key, double delta) {
    map.put(key, clamp(map.getOrDefault(key, 0.0) + delta));
  }

  private static double clamp(double x) { return Math.max(0.0, Math.min(1.0, x)); }

  public synchronized double risk(String cardKey) {
    double max = 0;
    for (Map<String, Double> m : byOpponent.values()) max = Math.max(max, m.getOrDefault(cardKey, 0.0));
    return max;
  }

  public synchronized Map<String, Double> topRisks(int limit) {
    Map<String, Double> merged = new HashMap<>();
    for (Map<String, Double> m : byOpponent.values()) for (Map.Entry<String, Double> e : m.entrySet()) merged.merge(e.getKey(), e.getValue(), Math::max);
    List<Map.Entry<String, Double>> list = new ArrayList<>(merged.entrySet());
    list.sort((a,b)->Double.compare(b.getValue(), a.getValue()));
    Map<String, Double> out = new LinkedHashMap<>();
    for (int i=0;i<Math.min(limit,list.size());i++) out.put(list.get(i).getKey(), list.get(i).getValue());
    return out;
  }

  public synchronized int observations() { return observations; }
}
