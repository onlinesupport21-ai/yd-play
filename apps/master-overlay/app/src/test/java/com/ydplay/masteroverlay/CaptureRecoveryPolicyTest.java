package com.ydplay.masteroverlay;

import org.junit.Test;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

public class CaptureRecoveryPolicyTest {
    @Test public void recoversWhenCaptureResourcesAreMissing() {
        assertTrue(CaptureRecoveryPolicy.shouldReattach(10_000L, 9_900L, false, true));
        assertTrue(CaptureRecoveryPolicy.shouldReattach(10_000L, 9_900L, true, false));
    }

    @Test public void recoversWhenNoFrameHasArrivedForTooLong() {
        assertTrue(CaptureRecoveryPolicy.shouldReattach(10_000L, 7_000L, true, true));
    }

    @Test public void leavesHealthyContinuousCaptureAlone() {
        assertFalse(CaptureRecoveryPolicy.shouldReattach(10_000L, 9_400L, true, true));
    }

    @Test public void firstSnapshotCanStartWithoutPreviousFrameTimestamp() {
        assertFalse(CaptureRecoveryPolicy.shouldReattach(10_000L, 0L, true, true));
    }
}
