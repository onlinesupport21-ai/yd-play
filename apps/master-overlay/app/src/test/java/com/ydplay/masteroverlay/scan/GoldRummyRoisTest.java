package com.ydplay.masteroverlay.scan;

import org.junit.Test;
import static org.junit.Assert.*;

public class GoldRummyRoisTest {
    @Test public void fourRegionsStayInsideLandscapeFrame() {
        for (int[] size : new int[][]{{1536,709},{1920,1080},{1280,720},{960,540}}) {
            for (GoldRummyRois.Zone zone : GoldRummyRois.Zone.values()) {
                GoldRummyRois.Box box = GoldRummyRois.forFrame(zone,size[0],size[1]);
                assertTrue(zone.name(), box.left() >= 0 && box.top() >= 0);
                assertTrue(zone.name(), box.right() <= size[0] && box.bottom() <= size[1]);
                assertTrue(zone.name(), box.right() > box.left() && box.bottom() > box.top());
            }
        }
    }
    @Test public void cropCoordinatesScaleWithFrameSize() {
        GoldRummyRois.Box a=GoldRummyRois.forFrame(GoldRummyRois.Zone.TURN,1536,720);
        GoldRummyRois.Box b=GoldRummyRois.forFrame(GoldRummyRois.Zone.TURN,3072,1440);
        assertEquals(2*a.left(),b.left());
        assertEquals(2*a.top(),b.top());
        assertEquals(2*a.right(),b.right());
        assertEquals(2*a.bottom(),b.bottom());
    }
    @Test public void zonesTargetGoldSkinScreenshots() {
        GoldRummyRois.Box turn=GoldRummyRois.forFrame(GoldRummyRois.Zone.TURN,1536,709);
        GoldRummyRois.Box hand=GoldRummyRois.forFrame(GoldRummyRois.Zone.HAND,1536,709);
        GoldRummyRois.Box open=GoldRummyRois.forFrame(GoldRummyRois.Zone.OPEN,1536,709);
        GoldRummyRois.Box joker=GoldRummyRois.forFrame(GoldRummyRois.Zone.JOKER,1536,709);
        assertTrue(turn.contains(800,220));
        assertTrue(hand.contains(400,460));
        assertTrue(open.contains(999,300));
        assertTrue(joker.contains(545,310));
        assertFalse(turn.contains(800,460));
        assertFalse(open.contains(545,310));
    }
    @Test(expected=IllegalArgumentException.class)
    public void portraitFramesAreNotSilentlyCalibrated() {
        GoldRummyRois.forFrame(GoldRummyRois.Zone.HAND,720,1536);
    }
}
