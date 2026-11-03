package com.ydplay.masteroverlay.scan;

import org.junit.Test;

import static org.junit.Assert.assertEquals;

public class TurnPhaseClassifierTest {
    @Test public void recognizesUsersPickAndDiscardBanners() {
        assertEquals(TurnPhase.USER_PICK, TurnPhaseClassifier.fromScreenText("Your turn to Pick"));
        assertEquals(TurnPhase.USER_DISCARD, TurnPhaseClassifier.fromScreenText("YOUR TURN TO DISCARD"));
    }

    @Test public void recognizesOtherTurnWithoutPretendingToKnowPlayer() {
        assertEquals(TurnPhase.OTHER, TurnPhaseClassifier.fromScreenText("Gaurav turn"));
        assertEquals(TurnPhase.OTHER, TurnPhaseClassifier.fromScreenText("Player's Turn"));
    }

    @Test public void leavesAmbiguousScreensUnknown() {
        assertEquals(TurnPhase.UNKNOWN, TurnPhaseClassifier.fromScreenText("Points 15 Group Discard"));
        assertEquals(TurnPhase.UNKNOWN, TurnPhaseClassifier.fromScreenText(null));
    }
}
