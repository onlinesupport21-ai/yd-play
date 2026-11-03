package com.ydplay.masteroverlay.ui;

import com.ydplay.masteroverlay.engine.Card;
import com.ydplay.masteroverlay.engine.PatternMemory;
import com.ydplay.masteroverlay.engine.Recommendation;
import com.ydplay.masteroverlay.state.KnownCardLedger;
import com.ydplay.masteroverlay.state.StableGameState;
import org.junit.Test;

import java.util.List;

import static org.junit.Assert.*;

public class DecisionPresenterTest {
    private static final List<String> HAND13 = List.of("2H","3H","4H","6D","PJ","8D","5S","6S","5D","8S","6D","6H","JS");

    @Test public void presentsPickOpenAsPrimaryAction() {
        StableGameState state = new StableGameState(HAND13,"8D","Q",0.92,1000);
        Recommendation r = new Recommendation("OPEN", Card.parse("5D","d"),25,15,false,"take it");
        PrimaryDecision d = new DecisionPresenter().present(state,r,new PatternMemory(),new KnownCardLedger());
        assertEquals(PrimaryDecision.Action.PICK_OPEN,d.action());
        assertEquals("8D",d.targetCard());
        assertTrue(d.reason().contains("25→15"));
    }

    @Test public void presentsClosedDrawClearly() {
        StableGameState state = new StableGameState(HAND13,"10H","Q",0.92,1000);
        Recommendation r = new Recommendation("CLOSED",null,25,25,false,"skip open");
        PrimaryDecision d = new DecisionPresenter().present(state,r,new PatternMemory(),new KnownCardLedger());
        assertEquals(PrimaryDecision.Action.DRAW_CLOSED,d.action());
        assertNull(d.targetCard());
    }

    @Test public void presentsExactDiscardForFourteenCardState() {
        List<String> hand14 = new java.util.ArrayList<>(HAND13);
        hand14.add("KC");
        StableGameState state = new StableGameState(hand14,"10H","Q",0.94,1200);
        Recommendation r = new Recommendation("NONE",Card.parse("KC","d"),30,20,false,"discard king");
        PrimaryDecision d = new DecisionPresenter().present(state,r,new PatternMemory(),new KnownCardLedger());
        assertEquals(PrimaryDecision.Action.DISCARD,d.action());
        assertEquals("KC",d.targetCard());
    }

    @Test public void refusesAdviceWhenScanIsUncertain() {
        StableGameState state = new StableGameState(HAND13,"8D","Q",0.68,1000);
        Recommendation r = new Recommendation("OPEN",Card.parse("5D","d"),25,15,false,"take it");
        PrimaryDecision d = new DecisionPresenter().present(state,r,new PatternMemory(),new KnownCardLedger());
        assertEquals(PrimaryDecision.Action.UNCERTAIN,d.action());
        assertTrue(d.headline().contains("SCAN UNCERTAIN"));
    }

    @Test public void requiresOpenCardBeforeThirteenCardAdvice() {
        StableGameState state = new StableGameState(HAND13,null,"Q",0.95,1000);
        PrimaryDecision d = new DecisionPresenter().present(state,null,new PatternMemory(),new KnownCardLedger());
        assertEquals(PrimaryDecision.Action.UNCERTAIN,d.action());
    }
}
