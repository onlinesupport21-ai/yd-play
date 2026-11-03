package com.ydplay.masteroverlay.scan;

import org.junit.Test;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

public class GoldRummyRoiLayoutTest {
    @Test public void landscapeZonesScaleFromReferenceRatios() {
        GoldRummyRoiLayout layout = GoldRummyRoiLayout.forFrame(1536, 720);

        assertZone(layout.hand(), 123, 360, 1444, 706);
        assertZone(layout.openDeck(), 922, 216, 1091, 432);
        assertZone(layout.wildJoker(), 415, 216, 584, 432);
        assertZone(layout.opponentActivity(), 77, 22, 1459, 360);
    }

    @Test public void everyZoneIsClampedInsideFrame() {
        GoldRummyRoiLayout layout = GoldRummyRoiLayout.forFrame(320, 180);
        for (GoldRummyRoiLayout.Zone z : new GoldRummyRoiLayout.Zone[]{
                layout.hand(), layout.openDeck(), layout.wildJoker(), layout.opponentActivity()}) {
            assertTrue(z.left() >= 0);
            assertTrue(z.top() >= 0);
            assertTrue(z.right() <= 320);
            assertTrue(z.bottom() <= 180);
            assertTrue(z.right() > z.left());
            assertTrue(z.bottom() > z.top());
        }
    }

    @Test public void opponentActivityDoesNotCoverMostOfHandRow() {
        GoldRummyRoiLayout layout = GoldRummyRoiLayout.forFrame(1536, 720);
        assertTrue(layout.opponentActivity().bottom() <= layout.hand().top());
    }

    private static void assertZone(GoldRummyRoiLayout.Zone zone, int l, int t, int r, int b) {
        assertEquals(l, zone.left());
        assertEquals(t, zone.top());
        assertEquals(r, zone.right());
        assertEquals(b, zone.bottom());
    }
}
