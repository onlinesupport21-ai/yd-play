package com.ydplay.masteroverlay.scan;

import org.junit.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.Assert.assertEquals;

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

    @Test public void derivesExpectedCardCountFromTurnBanner() {
        assertEquals(14, GoldRummyHandGeometry.expectedHandCount("Your turn to Discard"));
        assertEquals(13, GoldRummyHandGeometry.expectedHandCount("YOUR TURN TO PICK"));
        assertEquals(0, GoldRummyHandGeometry.expectedHandCount("Waiting for player"));
    }
}
