package com.ydplay.masteroverlay.engine;

import java.util.*;

public final class MasterAdvisor {
  private final PatternMemory memory;
  public MasterAdvisor(PatternMemory memory) { this.memory = memory == null ? new PatternMemory() : memory; }

  public Recommendation advise(List<Card> hand, Card openCard, String wildRank) {
    if (hand == null || (hand.size()!=13 && hand.size()!=14)) throw new IllegalArgumentException("hand must contain 13 or 14 cards");
    HandEvaluation before = RummyEngine.evaluate(hand.size()==13?hand:hand.subList(0,13), wildRank);
    if (hand.size()==14) {
      Card discard = RummyEngine.bestDiscard(hand,wildRank,memory);
      HandEvaluation after = RummyEngine.afterDiscard(hand,discard,wildRank);
      return new Recommendation("NONE",discard,before.deadwood(),after.deadwood(),after.validDeclaration(),reasonForDiscard(discard,after));
    }
    if (openCard == null) return new Recommendation("CLOSED",null,before.deadwood(),before.deadwood(),before.validDeclaration(),"Open card is unknown; draw from closed deck, then scan the 14-card hand before discarding.");
    List<Card> withOpen=new ArrayList<>(hand); withOpen.add(openCard);
    Card discard=RummyEngine.bestDiscard(withOpen,wildRank,memory);
    HandEvaluation after=RummyEngine.afterDiscard(withOpen,discard,wildRank);
    boolean openHelps = after.validDeclaration() || after.deadwood() < before.deadwood() || after.totalSequences() > before.totalSequences() || after.pureSequences() > before.pureSequences();
    if (discard.uid().equals(openCard.uid())) openHelps=false;
    if (openHelps) {
      return new Recommendation("OPEN",discard,before.deadwood(),after.deadwood(),after.validDeclaration(),"Take " + openCard.key() + "; it improves the best 13-card result from deadwood " + before.deadwood() + " to " + after.deadwood() + ". Then discard " + discard.key() + riskSuffix(discard) + (after.validDeclaration()?". Valid declaration is available.":"."));
    }
    return new Recommendation("CLOSED",null,before.deadwood(),before.deadwood(),before.validDeclaration(),"Skip " + openCard.key() + "; it does not improve the best legal hand enough. Draw closed, then analyze the resulting 14 cards.");
  }

  private String reasonForDiscard(Card d, HandEvaluation after) {
    return "Discard " + d.key() + riskSuffix(d) + "; best hand deadwood becomes " + after.deadwood() + " with " + after.pureSequences() + " pure and " + after.totalSequences() + " total sequences" + (after.validDeclaration()?". Valid declaration is available.":".");
  }
  private String riskSuffix(Card d) {
    double r=memory.risk(d.key()); return r>=0.35 ? " (opponent pattern risk " + Math.round(r*100) + "%)" : "";
  }
}
