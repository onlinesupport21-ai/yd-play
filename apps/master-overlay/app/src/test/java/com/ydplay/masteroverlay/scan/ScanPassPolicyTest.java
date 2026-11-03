package com.ydplay.masteroverlay.scan;

import org.junit.Test;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

public class ScanPassPolicyTest {
    @Test public void calibratedLayoutSkipsFullScreenFallback() {
        assertFalse(ScanPassPolicy.shouldRunFullScreenFallback(true));
    }

    @Test public void failedCalibratedLayoutAllowsFullScreenFallback() {
        assertTrue(ScanPassPolicy.shouldRunFullScreenFallback(false));
    }
}
