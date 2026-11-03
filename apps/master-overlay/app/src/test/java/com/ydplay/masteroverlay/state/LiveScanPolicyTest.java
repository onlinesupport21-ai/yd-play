package com.ydplay.masteroverlay.state;

import org.junit.Test;

import static org.junit.Assert.*;

public class LiveScanPolicyTest {
    @Test public void runsAtLowFrequencyOnlyWhenEnabledAndIdle() {
        LiveScanPolicy policy = new LiveScanPolicy(1800L);
        assertFalse(policy.shouldStart(false,false,5000,0));
        assertFalse(policy.shouldStart(true,true,5000,0));
        assertTrue(policy.shouldStart(true,false,5000,0));
        assertFalse(policy.shouldStart(true,false,6000,5000));
        assertTrue(policy.shouldStart(true,false,6800,5000));
    }

    @Test public void defaultIntervalIsNotFrameRateScanning() {
        LiveScanPolicy policy = LiveScanPolicy.defaultPolicy();
        assertTrue(policy.intervalMs() >= 1500L);
    }
}
