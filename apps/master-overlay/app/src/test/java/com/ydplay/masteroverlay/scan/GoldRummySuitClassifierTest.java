package com.ydplay.masteroverlay.scan;

import org.junit.Test;

import static org.junit.Assert.assertEquals;

public class GoldRummySuitClassifierTest {
    @Test public void separatesRedHeartFromDiamondByTopToMiddleWidth() {
        assertEquals("H", GoldRummySuitClassifier.fromShape(true, 1.05));
        assertEquals("H", GoldRummySuitClassifier.fromShape(true, 0.82));
        assertEquals("D", GoldRummySuitClassifier.fromShape(true, 0.48));
        assertEquals("D", GoldRummySuitClassifier.fromShape(true, 0.30));
    }

    @Test public void separatesBlackClubFromSpadeByTopToMiddleWidth() {
        assertEquals("C", GoldRummySuitClassifier.fromShape(false, 0.55));
        assertEquals("C", GoldRummySuitClassifier.fromShape(false, 0.47));
        assertEquals("S", GoldRummySuitClassifier.fromShape(false, 0.39));
        assertEquals("S", GoldRummySuitClassifier.fromShape(false, 0.25));
    }
}
