package com.ydplay.masteroverlay.scan;

import org.junit.Test;

import static org.junit.Assert.assertEquals;

public class GoldRummyTurnSafetyTest {
    @Test public void doesNotInventUserTurnFromHandCountWhenBannerIsMissing() {
        assertEquals(TurnPhase.UNKNOWN, GoldRummyScanPolicy.resolveTurnPhase(TurnPhase.UNKNOWN, 13));
        assertEquals(TurnPhase.UNKNOWN, GoldRummyScanPolicy.resolveTurnPhase(TurnPhase.UNKNOWN, 14));
    }

    @Test public void preservesObservedTurnPhase() {
        assertEquals(TurnPhase.USER_PICK, GoldRummyScanPolicy.resolveTurnPhase(TurnPhase.USER_PICK, 13));
        assertEquals(TurnPhase.USER_DISCARD, GoldRummyScanPolicy.resolveTurnPhase(TurnPhase.USER_DISCARD, 14));
        assertEquals(TurnPhase.OTHER, GoldRummyScanPolicy.resolveTurnPhase(TurnPhase.OTHER, 13));
    }
}
