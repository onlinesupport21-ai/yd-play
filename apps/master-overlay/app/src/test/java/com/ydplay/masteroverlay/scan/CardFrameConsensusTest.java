package com.ydplay.masteroverlay.scan;

import org.junit.Test;

import java.util.List;
import java.util.Optional;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

public class CardFrameConsensusTest {
    private static AutoScanResult frame(List<String> hand, String open, double confidence) {
        return new AutoScanResult(hand, open, "7", true, confidence, hand, TurnPhase.USER_PICK);
    }

    @Test public void promotesOnlyAfterThreeEquivalentHighConfidenceFrames() {
        CardFrameConsensus consensus = new CardFrameConsensus(3, 0.92);
        AutoScanResult scan = frame(List.of("AS","2S","3S","4H","5H","6H","7C","8C","9C","10D","JD","QD","KD"), "9H", 0.96);

        assertTrue(consensus.observe(scan).isEmpty());
        assertTrue(consensus.observe(scan).isEmpty());
        Optional<AutoScanResult> promoted = consensus.observe(scan);

        assertTrue(promoted.isPresent());
        assertEquals(13, promoted.get().handCards().size());
        assertEquals("9H", promoted.get().openCard());
        assertEquals(3, consensus.stableFrames());
    }

    @Test public void disagreementResetsTheStableFrameStreak() {
        CardFrameConsensus consensus = new CardFrameConsensus(3, 0.92);
        AutoScanResult a = frame(List.of("AS","2S","3S","4H","5H","6H","7C","8C","9C","10D","JD","QD","KD"), "9H", 0.96);
        AutoScanResult b = frame(List.of("AS","2S","3S","4H","5H","6H","7C","8C","9C","10D","JD","QD","QH"), "9H", 0.97);

        consensus.observe(a);
        consensus.observe(a);
        assertTrue(consensus.observe(b).isEmpty());
        assertEquals(1, consensus.stableFrames());
        assertTrue(consensus.observe(b).isEmpty());
        assertTrue(consensus.observe(b).isPresent());
    }

    @Test public void lowConfidenceFrameNeverPromotesAndResetsStreak() {
        CardFrameConsensus consensus = new CardFrameConsensus(3, 0.92);
        AutoScanResult high = frame(List.of("AS","2S","3S","4H","5H","6H","7C","8C","9C","10D","JD","QD","KD"), "9H", 0.96);
        AutoScanResult low = frame(high.handCards(), "9H", 0.91);

        consensus.observe(high);
        consensus.observe(high);
        assertFalse(consensus.observe(low).isPresent());
        assertEquals(0, consensus.stableFrames());
    }

    @Test public void cardOrderDoesNotBreakConsensusWhenPhysicalHandIsSame() {
        CardFrameConsensus consensus = new CardFrameConsensus(3, 0.92);
        AutoScanResult a = frame(List.of("AS","2S","3S","4H","5H","6H","7C","8C","9C","10D","JD","QD","KD"), "9H", 0.96);
        AutoScanResult b = frame(List.of("KD","QD","JD","10D","9C","8C","7C","6H","5H","4H","3S","2S","AS"), "9H", 0.95);

        assertTrue(consensus.observe(a).isEmpty());
        assertTrue(consensus.observe(b).isEmpty());
        assertTrue(consensus.observe(a).isPresent());
    }
}
