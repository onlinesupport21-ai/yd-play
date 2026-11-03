package com.ydplay.masteroverlay.state;

import com.ydplay.masteroverlay.scan.AutoScanResult;
import org.junit.Test;

import java.util.List;
import java.util.Optional;

import static org.junit.Assert.*;

public class StableGameStateTrackerTest {
    private static AutoScanResult scan(List<String> hand, String open, String joker, double confidence) {
        return new AutoScanResult(hand, open, joker, hand.size() == 13 || hand.size() == 14, confidence, hand);
    }

    @Test public void promotesOnlyAfterTwoCompatibleHighConfidenceSamples() {
        StableGameStateTracker tracker = new StableGameStateTracker();
        List<String> hand = List.of("2H","3H","4H","6D","PJ","8D","5S","6S","5D","8S","6D","6H","JS");
        assertTrue(tracker.observe(scan(hand,"8D","Q",0.91),1000).isEmpty());
        Optional<StableGameState> stable = tracker.observe(scan(hand,"8D","Q",0.89),1200);
        assertTrue(stable.isPresent());
        assertEquals(hand, stable.get().handCards());
        assertEquals("8D", stable.get().openCard());
        assertEquals("Q", stable.get().jokerRank());
    }

    @Test public void disagreementResetsCandidateInsteadOfPromoting() {
        StableGameStateTracker tracker = new StableGameStateTracker();
        List<String> a = List.of("2H","3H","4H","6D","PJ","8D","5S","6S","5D","8S","6D","6H","JS");
        List<String> b = List.of("2H","3H","4H","6D","PJ","8D","5S","6S","5D","8S","6D","6H","QC");
        assertTrue(tracker.observe(scan(a,"8D","Q",0.90),1000).isEmpty());
        assertTrue(tracker.observe(scan(b,"8D","Q",0.90),1200).isEmpty());
        assertTrue(tracker.observe(scan(b,"8D","Q",0.90),1400).isPresent());
    }

    @Test public void preservesDuplicatePhysicalCards() {
        StableGameStateTracker tracker = new StableGameStateTracker();
        List<String> hand = List.of("2H","3H","4H","6D","PJ","8D","5S","6S","5D","8S","6D","6H","JS");
        tracker.observe(scan(hand,"8D","Q",0.95),1000);
        StableGameState stable = tracker.observe(scan(hand,"8D","Q",0.95),1200).orElseThrow();
        assertEquals(2, stable.handCards().stream().filter("6D"::equals).count());
    }

    @Test public void rejectsLowConfidenceOrIncompleteScans() {
        StableGameStateTracker tracker = new StableGameStateTracker();
        List<String> shortHand = List.of("3S","PJ");
        assertTrue(tracker.observe(new AutoScanResult(shortHand,"10H","3",false,0.47,shortHand),1000).isEmpty());
        assertTrue(tracker.observe(new AutoScanResult(shortHand,"10H","3",false,0.99,shortHand),1200).isEmpty());
    }
}
