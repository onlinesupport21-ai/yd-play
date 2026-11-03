package com.ydplay.masteroverlay.scan;

import org.junit.Test;

import static org.junit.Assert.assertEquals;

public class GoldRummyScanPolicyTest {
    @Test public void probesFourteenSlotsWhenTurnBannerOcrIsMissing() {
        assertEquals(14, GoldRummyScanPolicy.geometryProbeCount(0, TurnPhase.UNKNOWN));
    }

    @Test public void trustsExplicitTurnPhaseBeforeAdaptiveSlotCount() {
        assertEquals(13, GoldRummyScanPolicy.geometryProbeCount(0, TurnPhase.USER_PICK));
        assertEquals(14, GoldRummyScanPolicy.geometryProbeCount(0, TurnPhase.USER_DISCARD));
        assertEquals(13, GoldRummyScanPolicy.resolveExpectedCount(0, TurnPhase.USER_PICK, 12));
    }

    @Test public void recoversThirteenCardHandFromFourteenSlotProbe() {
        assertEquals(13, GoldRummyScanPolicy.resolveExpectedCount(0, TurnPhase.UNKNOWN, 13));
        assertEquals(14, GoldRummyScanPolicy.resolveExpectedCount(0, TurnPhase.UNKNOWN, 14));
        assertEquals(0, GoldRummyScanPolicy.resolveExpectedCount(0, TurnPhase.UNKNOWN, 4));
    }

    @Test public void bannerCountRemainsAuthoritativeWhenAvailable() {
        assertEquals(13, GoldRummyScanPolicy.geometryProbeCount(13, TurnPhase.UNKNOWN));
        assertEquals(14, GoldRummyScanPolicy.geometryProbeCount(14, TurnPhase.UNKNOWN));
        assertEquals(13, GoldRummyScanPolicy.resolveExpectedCount(13, TurnPhase.UNKNOWN, 14));
    }
}
