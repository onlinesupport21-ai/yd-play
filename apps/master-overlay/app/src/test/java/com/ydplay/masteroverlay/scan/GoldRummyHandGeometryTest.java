package com.ydplay.masteroverlay.scan;

import org.junit.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

public class GoldRummyHandGeometryTest {
    @Test public void detectsFourteenCardStartsFromObservedSkinCandidates() {
        int width = 1536;
        List<GoldRummyHandGeometry.Candidate> candidates = new ArrayList<>();
        candidates.add(new GoldRummyHandGeometry.Candidate(187,113.1,0.74));
        candidates.add(new GoldRummyHandGeometry.Candidate(248,73.5,0.74));
        candidates.add(new GoldRummyHandGeometry.Candidate(309,73.1,0.75));
        candidates.add(new GoldRummyHandGeometry.Candidate(343,24.0,0.98));
        candidates.add(new GoldRummyHandGeometry.Candidate(445,107.1,0.63));
        candidates.add(new GoldRummyHandGeometry.Candidate(506,54.3,0.79));
        candidates.add(new GoldRummyHandGeometry.Candidate(567,113.7,0.66));
        candidates.add(new GoldRummyHandGeometry.Candidate(703,79.0,0.75));
        candidates.add(new GoldRummyHandGeometry.Candidate(737,20.6,0.89));
        candidates.add(new GoldRummyHandGeometry.Candidate(765,32.3,0.62));
        candidates.add(new GoldRummyHandGeometry.Candidate(797,23.5,0.88));
        candidates.add(new GoldRummyHandGeometry.Candidate(826,32.6,0.75));
        candidates.add(new GoldRummyHandGeometry.Candidate(887,31.9,0.64));
        candidates.add(new GoldRummyHandGeometry.Candidate(919,22.6,0.85));
        candidates.add(new GoldRummyHandGeometry.Candidate(1023,140.7,0.63));
        candidates.add(new GoldRummyHandGeometry.Candidate(1084,77.0,0.63));
        candidates.add(new GoldRummyHandGeometry.Candidate(1220,105.0,0.93));
        candidates.add(new GoldRummyHandGeometry.Candidate(1249,35.2,0.78));
        candidates.add(new GoldRummyHandGeometry.Candidate(1282,65.2,0.62));
        candidates.add(new GoldRummyHandGeometry.Candidate(1314,25.2,0.88));

        assertEquals(
                List.of(187,248,309,445,506,567,703,765,826,887,1023,1084,1220,1282),
                GoldRummyHandGeometry.selectStarts(width, candidates, 14)
        );
    }

    @Test public void persistentCardBoundaryBeatsSparseArtworkEdge() {
        int[] trueLeft =  {42,45,43,44,46,42,45,43,44,45,42,44};
        int[] trueRight = {225,226,223,224,228,224,225,226,223,227,225,224};
        double[] trueWhite = {0.92,0.95,0.91,0.94,0.96,0.93,0.95,0.92,0.94,0.96,0.93,0.95};

        int[] noisyLeft =  {210,42,208,45,44,43,215,42,44,43,45,44};
        int[] noisyRight = {45,44,42,46,45,44,40,43,45,44,46,45};
        double[] noisyWhite = {0.94,0.25,0.20,0.22,0.24,0.23,0.93,0.20,0.25,0.22,0.24,0.21};

        double trueScore = GoldRummyHandGeometry.boundaryScore(trueLeft, trueRight, trueWhite);
        double noiseScore = GoldRummyHandGeometry.boundaryScore(noisyLeft, noisyRight, noisyWhite);
        assertTrue(trueScore > 80.0);
        assertTrue(trueScore > noiseScore * 2.0);
    }

    @Test public void derivesExpectedCardCountFromTurnBanner() {
        assertEquals(14, GoldRummyHandGeometry.expectedHandCount("Your turn to Discard"));
        assertEquals(13, GoldRummyHandGeometry.expectedHandCount("YOUR TURN TO PICK"));
        assertEquals(0, GoldRummyHandGeometry.expectedHandCount("Waiting for player"));
    }
}
