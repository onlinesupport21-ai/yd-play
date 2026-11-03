package com.ydplay.masteroverlay.engine;

import java.util.Locale;

public record Card(String rank, String suit, boolean printedJoker, String uid) {
  public static final String[] RANKS = {"A","2","3","4","5","6","7","8","9","10","J","Q","K"};
  public static final String[] SUITS = {"S","H","D","C"};

  public static Card parse(String raw, String uid) {
    if (raw == null) throw new IllegalArgumentException("Card is null");
    String s = raw.trim().toUpperCase(Locale.ROOT).replace("♠","S").replace("♥","H").replace("♦","D").replace("♣","C");
    if (s.equals("PJ") || s.equals("JOKER") || s.equals("JK")) return new Card("PJ", "J", true, uid);
    if (s.length() < 2) throw new IllegalArgumentException("Bad card: " + raw);
    String suit = s.substring(s.length()-1);
    String rank = s.substring(0, s.length()-1);
    boolean rankOk = false, suitOk = false;
    for (String r : RANKS) if (r.equals(rank)) rankOk = true;
    for (String t : SUITS) if (t.equals(suit)) suitOk = true;
    if (!rankOk || !suitOk) throw new IllegalArgumentException("Bad card: " + raw);
    return new Card(rank, suit, false, uid);
  }

  public String key() { return printedJoker ? "PJ" : rank + suit; }
  @Override public String toString() { return key(); }
}
