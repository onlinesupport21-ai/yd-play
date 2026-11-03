package com.ydplay.masteroverlay.engine;

import java.util.*;

public final class RummyEngine {
  private RummyEngine() {}
  private enum Kind { PURE, IMPURE, SET }
  private record Meld(int mask, Kind kind, int size) {}
  private record State(int deadwood, int unmelded, int pure, int impure, int seq, int sets, int melded, int deadwoodMask) {}

  public static HandEvaluation evaluate(List<Card> input, String wildRank) {
    if (input == null) throw new IllegalArgumentException("hand null");
    if (input.size() > 14) throw new IllegalArgumentException("hand too large");
    List<Card> hand = List.copyOf(input);
    int n = hand.size();
    List<Meld> melds = generateMelds(hand, wildRank);
    List<List<Meld>> byBit = new ArrayList<>();
    for (int i=0;i<n;i++) byBit.add(new ArrayList<>());
    for (Meld m: melds) for (int i=0;i<n;i++) if ((m.mask & (1<<i)) != 0) byBit.get(i).add(m);
    Map<Integer,State> memo = new HashMap<>();
    State s = solve((1<<n)-1, hand, wildRank, byBit, memo);
    List<Card> dead = new ArrayList<>();
    for (int i=0;i<n;i++) if ((s.deadwoodMask & (1<<i)) != 0) dead.add(hand.get(i));
    boolean valid = s.unmelded == 0 && s.pure >= 1 && s.seq >= 2;
    return new HandEvaluation(s.deadwood,s.unmelded,s.pure,s.impure,s.seq,s.sets,s.melded,valid,List.copyOf(dead));
  }

  private static State solve(int mask, List<Card> hand, String wildRank, List<List<Meld>> byBit, Map<Integer,State> memo) {
    if (mask == 0) return new State(0,0,0,0,0,0,0,0);
    State cached = memo.get(mask); if (cached != null) return cached;
    int i = Integer.numberOfTrailingZeros(mask);
    int without = mask & ~(1<<i);
    State sub = solve(without, hand, wildRank, byBit, memo);
    State best = new State(sub.deadwood + points(hand.get(i), wildRank), sub.unmelded+1, sub.pure, sub.impure, sub.seq, sub.sets, sub.melded, sub.deadwoodMask | (1<<i));
    for (Meld m : byBit.get(i)) {
      if ((m.mask & mask) != m.mask) continue;
      State x = solve(mask ^ m.mask, hand, wildRank, byBit, memo);
      State p = new State(x.deadwood, x.unmelded, x.pure + (m.kind==Kind.PURE?1:0), x.impure + (m.kind==Kind.IMPURE?1:0), x.seq + (m.kind==Kind.PURE||m.kind==Kind.IMPURE?1:0), x.sets + (m.kind==Kind.SET?1:0), x.melded+m.size, x.deadwoodMask);
      if (better(p,best)) best=p;
    }
    memo.put(mask,best); return best;
  }

  private static boolean better(State a, State b) {
    if (a.deadwood != b.deadwood) return a.deadwood < b.deadwood;
    if (a.unmelded != b.unmelded) return a.unmelded < b.unmelded;
    if (a.pure != b.pure) return a.pure > b.pure;
    if (a.seq != b.seq) return a.seq > b.seq;
    if (a.sets != b.sets) return a.sets > b.sets;
    return a.melded > b.melded;
  }

  private static List<Meld> generateMelds(List<Card> hand, String wildRank) {
    int n=hand.size(); List<Meld> out=new ArrayList<>(); Set<String> seen=new HashSet<>();
    for (int mask=0; mask < (1<<n); mask++) {
      int bc=Integer.bitCount(mask); if (bc<3 || bc>13) continue;
      List<Card> subset=new ArrayList<>(); for (int i=0;i<n;i++) if ((mask&(1<<i))!=0) subset.add(hand.get(i));
      if (bc<=5 && isSet(subset,wildRank)) add(out,seen,new Meld(mask,Kind.SET,bc));
      if (isPureSequence(subset)) add(out,seen,new Meld(mask,Kind.PURE,bc));
      else if (isImpureSequence(subset,wildRank)) add(out,seen,new Meld(mask,Kind.IMPURE,bc));
    }
    return out;
  }

  private static void add(List<Meld> out, Set<String> seen, Meld m) {
    String k=m.mask+":"+m.kind; if (seen.add(k)) out.add(m);
  }

  public static int points(Card c, String wildRank) {
    if (c.printedJoker() || c.rank().equals(wildRank)) return 0;
    return switch(c.rank()) { case "A","10","J","Q","K" -> 10; default -> Integer.parseInt(c.rank()); };
  }

  public static boolean isPureSequence(List<Card> cards) {
    if (cards.size()<3) return false;
    String suit=null; Set<String> ranks=new HashSet<>();
    for (Card c: cards) {
      if (c.printedJoker()) return false;
      if (suit==null) suit=c.suit(); else if (!suit.equals(c.suit())) return false;
      if (!ranks.add(c.rank())) return false;
    }
    return matchesPattern(ranks, cards.size());
  }

  private static boolean matchesPattern(Set<String> ranks, int n) {
    for (List<String> p: patterns(n)) if (new HashSet<>(p).equals(ranks)) return true;
    return false;
  }

  public static boolean isImpureSequence(List<Card> cards, String wildRank) {
    if (cards.size()<3 || isPureSequence(cards)) return false;
    int n=cards.size();
    for (String suit: Card.SUITS) {
      for (List<String> p: patterns(n)) {
        if (assignSequence(cards, wildRank, suit, p, 0, 0, 0, 0)) return true;
      }
    }
    return false;
  }

  private static boolean assignSequence(List<Card> cards, String wildRank, String suit, List<String> pattern, int idx, int usedPosMask, int naturals, int jokerSubs) {
    if (idx==cards.size()) return naturals>=2 && jokerSubs>=1;
    Card c=cards.get(idx);
    boolean joker=c.printedJoker() || c.rank().equals(wildRank);
    if (!c.printedJoker() && c.suit().equals(suit)) {
      for (int pos=0;pos<pattern.size();pos++) if ((usedPosMask&(1<<pos))==0 && pattern.get(pos).equals(c.rank())) {
        if (assignSequence(cards,wildRank,suit,pattern,idx+1,usedPosMask|(1<<pos),naturals+1,jokerSubs)) return true;
      }
    }
    if (joker) {
      for (int pos=0;pos<pattern.size();pos++) if ((usedPosMask&(1<<pos))==0) {
        if (assignSequence(cards,wildRank,suit,pattern,idx+1,usedPosMask|(1<<pos),naturals,jokerSubs+1)) return true;
      }
    }
    return false;
  }

  public static boolean isSet(List<Card> cards, String wildRank) {
    if (cards.size()<3 || cards.size()>4) return false;
    String naturalRank=null; Set<String> suits=new HashSet<>(); int naturals=0;
    for (Card c: cards) {
      boolean joker=c.printedJoker() || c.rank().equals(wildRank);
      if (joker) continue;
      naturals++;
      if (naturalRank==null) naturalRank=c.rank(); else if (!naturalRank.equals(c.rank())) return false;
      if (!suits.add(c.suit())) return false;
    }
    return naturals>=2;
  }

  private static List<List<String>> patterns(int n) {
    List<List<String>> out=new ArrayList<>(); Set<String> seen=new HashSet<>();
    List<String> low=Arrays.asList(Card.RANKS);
    List<String> high=Arrays.asList("2","3","4","5","6","7","8","9","10","J","Q","K","A");
    for (List<String> order: List.of(low,high)) {
      for (int i=0;i+n<=order.size();i++) {
        List<String> p=new ArrayList<>(order.subList(i,i+n));
        String k=String.join("-",p); if (seen.add(k)) out.add(p);
      }
    }
    return out;
  }

  public static Card bestDiscard(List<Card> hand14, String wildRank, PatternMemory memory) {
    if (hand14.size()!=14) throw new IllegalArgumentException("need 14 cards");
    Card best=null; HandEvaluation bestEval=null; double bestRisk=Double.MAX_VALUE; int bestPoints=-1;
    for (int i=0;i<hand14.size();i++) {
      Card d=hand14.get(i); List<Card> h=new ArrayList<>(hand14); h.remove(i);
      HandEvaluation e=evaluate(h,wildRank); double risk=memory==null?0:memory.risk(d.key()); int p=points(d,wildRank);
      if (best==null || compare(e,risk,p,bestEval,bestRisk,bestPoints)<0) { best=d; bestEval=e; bestRisk=risk; bestPoints=p; }
    }
    return best;
  }

  public static HandEvaluation afterDiscard(List<Card> hand14, Card discard, String wildRank) {
    List<Card> h=new ArrayList<>(hand14); boolean removed=false;
    for (int i=0;i<h.size();i++) if (h.get(i).uid().equals(discard.uid())) { h.remove(i); removed=true; break; }
    if (!removed) throw new IllegalArgumentException("discard not in hand");
    return evaluate(h,wildRank);
  }

  private static int compare(HandEvaluation a,double ar,int ap,HandEvaluation b,double br,int bp) {
    if (a.validDeclaration()!=b.validDeclaration()) return a.validDeclaration()?-1:1;
    if (a.deadwood()!=b.deadwood()) return Integer.compare(a.deadwood(),b.deadwood());
    if (a.unmeldedCount()!=b.unmeldedCount()) return Integer.compare(a.unmeldedCount(),b.unmeldedCount());
    if (a.pureSequences()!=b.pureSequences()) return Integer.compare(b.pureSequences(),a.pureSequences());
    if (a.totalSequences()!=b.totalSequences()) return Integer.compare(b.totalSequences(),a.totalSequences());
    if (Double.compare(ar,br)!=0) return Double.compare(ar,br);
    return Integer.compare(bp,ap);
  }
}
