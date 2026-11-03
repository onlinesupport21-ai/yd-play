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

    @Test public void incompleteScreenReadExplainsMissingCardsInsteadOfOnlyStabilizing() {
        LiveGameBrain brain = new LiveGameBrain();
        PrimaryDecision d = brain.observe(
                new AutoScanResult(List.of(),null,null,false,0.0,List.of(),TurnPhase.UNKNOWN),1000);
        assertEquals(PrimaryDecision.Action.UNCERTAIN,d.action());
        assertTrue(d.headline(),d.headline().contains("0/13"));
        assertTrue(d.reason(),d.reason().contains("card"));
        assertEquals(0,brain.consensusFrames());
    }

    @Test public void refusesToAdviseUntilThreeFrameConsensus() {
        LiveGameBrain brain = new LiveGameBrain();
        PrimaryDecision first = brain.observe(scan(HAND13,"8D",0.94,TurnPhase.USER_PICK),1000);
        PrimaryDecision second = brain.observe(scan(HAND13,"8D",0.93,TurnPhase.USER_PICK),1100);
        assertEquals(PrimaryDecision.Action.UNCERTAIN, first.action());
        assertEquals(PrimaryDecision.Action.UNCERTAIN, second.action());
        assertEquals(2, brain.consensusFrames());
    }

    @Test public void givesDiscardAfterThreeStableFourteenCardSamples() {
        LiveGameBrain brain = new LiveGameBrain();
        List<String> hand14 = new ArrayList<>(HAND13);
        hand14.add("KC");
        brain.observe(scan(hand14,"8D",0.94,TurnPhase.USER_DISCARD),1000);
        brain.observe(scan(hand14,"8D",0.93,TurnPhase.USER_DISCARD),1100);
        PrimaryDecision third = brain.observe(scan(hand14,"8D",0.92,TurnPhase.USER_DISCARD),1200);
        assertEquals(PrimaryDecision.Action.DISCARD, third.action());
        assertNotNull(third.targetCard());
        assertEquals(14, brain.ledger().knownTotal() - 1); // own 14; visible open may be the second copy of a code already held
    }

    @Test public void consensusPromotedFrameSkipsSecondStabilityGate() {
        LiveGameBrain brain = new LiveGameBrain();
        List<String> hand14 = new ArrayList<>(HAND13);
        hand14.add("KC");
        PrimaryDecision decision = brain.observeConsensus(
                scan(hand14,"8D",0.93,TurnPhase.USER_DISCARD),1200);
        assertEquals(PrimaryDecision.Action.DISCARD, decision.action());
        assertNotNull(decision.targetCard());
    }

    @Test public void learnsVisibleOpponentDiscardOnlyAfterStableTransition() {
        LiveGameBrain brain = new LiveGameBrain();
        brain.observe(scan(HAND13,"8D",0.93,TurnPhase.OTHER),1000);
        brain.observe(scan(HAND13,"8D",0.92,TurnPhase.OTHER),1100);
        PrimaryDecision waiting1 = brain.observe(scan(HAND13,"8D",0.91,TurnPhase.OTHER),1200);
        assertEquals(PrimaryDecision.Action.WATCHING, waiting1.action());
        assertEquals(0, brain.memory().observations());

        brain.observe(scan(HAND13,"10H",0.93,TurnPhase.OTHER),1300);
        brain.observe(scan(HAND13,"10H",0.92,TurnPhase.OTHER),1400);
        PrimaryDecision waiting2 = brain.observe(scan(HAND13,"10H",0.91,TurnPhase.OTHER),1500);
        assertEquals(PrimaryDecision.Action.WATCHING, waiting2.action());
        assertEquals(1, brain.memory().observations());
        assertTrue(brain.memory().risk("10H") >= 0.0);
    }

    @Test public void userDiscardToOpponentTurnBoundaryDoesNotPoisonOpponentMemory() {
        LiveGameBrain brain = new LiveGameBrain();
        List<String> hand14 = new ArrayList<>(HAND13);
        hand14.add("KC");

        brain.observe(scan(hand14,"8D",0.95,TurnPhase.USER_DISCARD),1000);
        brain.observe(scan(hand14,"8D",0.95,TurnPhase.USER_DISCARD),1100);
        brain.observe(scan(hand14,"8D",0.95,TurnPhase.USER_DISCARD),1200);
        assertEquals(0, brain.memory().observations());

        brain.observe(scan(HAND13,"KC",0.95,TurnPhase.OTHER),1300);
        brain.observe(scan(HAND13,"KC",0.95,TurnPhase.OTHER),1400);
        PrimaryDecision waiting = brain.observe(scan(HAND13,"KC",0.95,TurnPhase.OTHER),1500);
        assertEquals(PrimaryDecision.Action.WATCHING, waiting.action());
        assertEquals(0, brain.memory().observations());
    }

    @Test public void unknownTurnNeverPoisonsOpponentMemoryOrAdvises() {
        LiveGameBrain brain = new LiveGameBrain();
        brain.observe(scan(HAND13,"8D",0.95,TurnPhase.UNKNOWN),1000);
        brain.observe(scan(HAND13,"8D",0.95,TurnPhase.UNKNOWN),1100);
        PrimaryDecision d = brain.observe(scan(HAND13,"8D",0.95,TurnPhase.UNKNOWN),1200);
        assertEquals(PrimaryDecision.Action.UNCERTAIN,d.action());
        assertEquals(0, brain.memory().observations());
    }
}
