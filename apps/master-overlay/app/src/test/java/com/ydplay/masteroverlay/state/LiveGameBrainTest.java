package com.ydplay.masteroverlay.state;

import com.ydplay.masteroverlay.scan.AutoScanResult;
import com.ydplay.masteroverlay.scan.TurnPhase;
import com.ydplay.masteroverlay.ui.PrimaryDecision;
import org.junit.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.Assert.*;

public class LiveGameBrainTest {
    private static final List<String> HAND13 = List.of("2H","3H","4H","6D","PJ","8D","5S","6S","5D","8S","6D","6H","JS");

    private static AutoScanResult scan(List<String> hand, String open, double confidence, TurnPhase phase) {
        return new AutoScanResult(hand, open, "Q", hand.size()==13 || hand.size()==14, confidence, hand, phase);
    }

    @Test public void refusesToAdviseUntilStateIsStable() {
        LiveGameBrain brain = new LiveGameBrain();
        PrimaryDecision first = brain.observe(scan(HAND13,"8D",0.94,TurnPhase.USER_PICK),1000);
        assertEquals(PrimaryDecision.Action.UNCERTAIN, first.action());
    }

    @Test public void givesDiscardAfterTwoStableFourteenCardSamples() {
        LiveGameBrain brain = new LiveGameBrain();
        List<String> hand14 = new ArrayList<>(HAND13);
        hand14.add("KC");
        brain.observe(scan(hand14,"8D",0.94,TurnPhase.USER_DISCARD),1000);
        PrimaryDecision second = brain.observe(scan(hand14,"8D",0.93,TurnPhase.USER_DISCARD),1200);
        assertEquals(PrimaryDecision.Action.DISCARD, second.action());
        assertNotNull(second.targetCard());
        assertEquals(14, brain.ledger().knownTotal() - 1); // own 14; open may duplicate an own code and is conservatively capped
    }

    @Test public void learnsVisibleOpponentDiscardOnlyAfterStableTransition() {
        LiveGameBrain brain = new LiveGameBrain();
        brain.observe(scan(HAND13,"8D",0.93,TurnPhase.OTHER),1000);
        PrimaryDecision waiting1 = brain.observe(scan(HAND13,"8D",0.92,TurnPhase.OTHER),1200);
        assertEquals(PrimaryDecision.Action.WATCHING, waiting1.action());
        assertEquals(0, brain.memory().observations());

        brain.observe(scan(HAND13,"10H",0.93,TurnPhase.OTHER),1400);
        PrimaryDecision waiting2 = brain.observe(scan(HAND13,"10H",0.92,TurnPhase.OTHER),1600);
        assertEquals(PrimaryDecision.Action.WATCHING, waiting2.action());
        assertEquals(1, brain.memory().observations());
        assertTrue(brain.memory().risk("10H") >= 0.0);
    }

    @Test public void unknownTurnNeverPoisonsOpponentMemoryOrAdvises() {
        LiveGameBrain brain = new LiveGameBrain();
        brain.observe(scan(HAND13,"8D",0.95,TurnPhase.UNKNOWN),1000);
        PrimaryDecision d = brain.observe(scan(HAND13,"8D",0.95,TurnPhase.UNKNOWN),1200);
        assertEquals(PrimaryDecision.Action.UNCERTAIN, d.action());
        assertEquals(0, brain.memory().observations());
    }
}
