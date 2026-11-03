package com.ydplay.masteroverlay.scan;

import org.junit.Test;
import java.util.*;
import static org.junit.Assert.*;

/**
 * Values sampled from the owner's 2026-11-03 landscape UI screenshots.
 * The old detector wrongly accepted artwork/whitespace boundaries as cards.
 */
public class GoldRummyTopBandTest {
    private static List<GoldRummyHandGeometry.Candidate> candidates(int[] x) {
        List<GoldRummyHandGeometry.Candidate> all = new ArrayList<>();
        for (int position : x) all.add(new GoldRummyHandGeometry.Candidate(position, 55.0, .95));
        return all;
    }
    private static double[] contrasts(int w, int[] xs, double[] values) {
        double[] top = new double[w];
        for (int i=0;i<xs.length;i++) top[xs[i]]=values[i];
        return top;
    }
    @Test public void screenshot20261103CleanPickSeparates13FromArtwork() {
        int[] positions={216,276,337,395,447,535,596,646,733,793,851,917,1051,1115,1253,1340};
        double[] delta={171.1,16.6,18.7,29.3,2.3,103.5,18.9,2.6,101.4,19.2,78.5,41.9,89.6,44.8,246.4,.4};
        List<Integer> expected=List.of(216,276,337,395,535,596,733,793,851,917,1051,1115,1253);
        assertEquals(expected, GoldRummyHandGeometry.selectStartsWithTopBand(
                1536,candidates(positions),contrasts(1536,positions,delta),0));
    }
    @Test public void screenshot20261103AlternateHandRejectsInteriorFalseEdge() {
        int[] positions={255,314,372,512,569,633,694,744,832,891,952,1090,1147,1212};
        double[] delta={174.8,21.5,80.0,116.5,72.2,13.8,20.7,2.7,110.6,37.5,35.3,115.6,29.7,61.8};
        List<Integer> expected=List.of(255,314,372,512,569,633,694,832,891,952,1090,1147,1212);
        assertEquals(expected, GoldRummyHandGeometry.selectStartsWithTopBand(
                1536,candidates(positions),contrasts(1536,positions,delta),0));
    }
    @Test public void native2340By1080CaptureKeepsThirteenCards() {
        int[] positions={330,426,518,611,817,913,1117,1213,1298,1399,1603,1700,1905,2040};
        double[] delta={104.4,31.2,28.5,27.8,75.4,37.3,52.7,33.3,46.9,50.4,62.1,46.9,133.5,0};
        List<Integer> expected=List.of(330,426,518,611,817,913,1117,1213,1298,1399,1603,1700,1905);
        assertEquals(expected, GoldRummyHandGeometry.selectStartsWithTopBand(
                2340,candidates(positions),contrasts(2340,positions,delta),0));
    }

    @Test public void blankTopBandCannotBeAcceptedAsRealCard() {
        int[] positions={400,460,520};
        double[] delta={2.0,1.0,0.0};
        assertTrue(GoldRummyHandGeometry.selectStartsWithTopBand(
                1536,candidates(positions),contrasts(1536,positions,delta),0).isEmpty());
    }
}
