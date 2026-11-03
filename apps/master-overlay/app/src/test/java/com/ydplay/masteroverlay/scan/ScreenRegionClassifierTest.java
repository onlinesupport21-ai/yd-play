package com.ydplay.masteroverlay.scan;

import static org.junit.Assert.*;

import java.util.ArrayList;
import java.util.List;
import org.junit.Test;

public class ScreenRegionClassifierTest {
    private static OcrHit hit(String text, int cx, int cy) {
        return new OcrHit(text, cx - 15, cy - 12, cx + 15, cy + 12);
    }

    private static List<OcrHit> handHits(int width, int y, int count) {
        String[] cards = {"AS","2S","3S","4H","5H","6H","7D","8D","9D","10C","JC","QC","KC","AS"};
        List<OcrHit> hits = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            int x = 40 + (i * (width - 80) / Math.max(1, count - 1));
            hits.add(hit(cards[i], x, y));
        }
        return hits;
    }

    @Test public void classifiesLandscapeHandOpenAndJoker() {
        List<OcrHit> hits = handHits(1000, 520, 13);
        hits.add(hit("5D", 500, 300));
        hits.add(hit("JOKER", 780, 100));
        hits.add(hit("7H", 850, 105));

        AutoScanResult result = ScreenRegionClassifier.classify(1000, 600, hits);

        assertTrue(result.completeHand());
        assertEquals(13, result.handCards().size());
        assertEquals("5D", result.openCard());
        assertEquals("7", result.jokerRank());
    }

    @Test public void classifiesPortraitHand() {
        List<OcrHit> hits = handHits(600, 860, 13);
        hits.add(hit("4C", 300, 480));

        AutoScanResult result = ScreenRegionClassifier.classify(600, 1000, hits);

        assertTrue(result.completeHand());
        assertEquals(13, result.handCards().size());
        assertEquals("4C", result.openCard());
    }

    @Test public void incompleteHandDoesNotBecomeComplete() {
        List<OcrHit> hits = handHits(1000, 520, 12);
        AutoScanResult result = ScreenRegionClassifier.classify(1000, 600, hits);
        assertFalse(result.completeHand());
        assertEquals(12, result.handCards().size());
    }

    @Test public void duplicateCardsArePreserved() {
        List<OcrHit> hits = handHits(1000, 520, 14);
        AutoScanResult result = ScreenRegionClassifier.classify(1000, 600, hits);
        assertTrue(result.completeHand());
        assertEquals(14, result.handCards().size());
        assertEquals("AS", result.handCards().get(0));
        assertEquals("AS", result.handCards().get(13));
    }
}
