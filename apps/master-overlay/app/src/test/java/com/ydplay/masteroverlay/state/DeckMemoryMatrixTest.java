package com.ydplay.masteroverlay.state;

import org.junit.Test;

import java.util.List;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

public class DeckMemoryMatrixTest {
    @Test public void startsWithTwoCopiesOfEveryCardAndTwoPrintedJokers() {
        DeckMemoryMatrix matrix = new DeckMemoryMatrix();
        assertEquals(2, matrix.remaining("AS"));
        assertEquals(2, matrix.remaining("10D"));
        assertEquals(2, matrix.remaining("PJ"));
        assertEquals(106, matrix.unseenTotal());
    }

    @Test public void ownHandRemovesExactCurrentCopiesFromAvailability() {
        DeckMemoryMatrix matrix = new DeckMemoryMatrix();
        matrix.observeOwnHand(List.of("AS", "AS", "7H"));

        assertEquals(0, matrix.remaining("AS"));
        assertEquals(1, matrix.remaining("7H"));
        assertEquals(103, matrix.unseenTotal());
    }

    @Test public void distinctPhysicalSightingsCanExhaustBothCopiesButNeverGoNegative() {
        DeckMemoryMatrix matrix = new DeckMemoryMatrix();
        matrix.observeExternalSeen("9C", "deckA-9C");
        matrix.observeExternalSeen("9C", "deckB-9C");
        matrix.observeExternalSeen("9C", "deckC-impossible");

        assertEquals(0, matrix.remaining("9C"));
        assertEquals(2, matrix.knownCount("9C"));
    }

    @Test public void repeatedSightingOfSamePhysicalCardIsDeduplicated() {
        DeckMemoryMatrix matrix = new DeckMemoryMatrix();
        matrix.observeExternalSeen("QH", "physical-QH-1");
        matrix.observeExternalSeen("QH", "physical-QH-1");
        matrix.observeExternalSeen("QH", "physical-QH-1");

        assertEquals(1, matrix.remaining("QH"));
        assertEquals(1, matrix.externalSeenCount("QH"));
    }

    @Test public void pickupBuildsDangerAroundSequencesAndSets() {
        DeckMemoryMatrix matrix = new DeckMemoryMatrix();
        matrix.observeOpponentPickup("Bot_2", "9D", "physical-9D-1");

        assertTrue(matrix.danger("8D") >= 0.70);
        assertTrue(matrix.danger("10D") >= 0.70);
        assertTrue(matrix.danger("7D") > 0.0);
        assertTrue(matrix.danger("JD") > 0.0);
        assertTrue(matrix.danger("9S") > 0.0);
        assertEquals(1, matrix.remaining("9D"));
    }

    @Test public void resetRestoresFreshDeckAndClearsDanger() {
        DeckMemoryMatrix matrix = new DeckMemoryMatrix();
        matrix.observeOwnHand(List.of("AS"));
        matrix.observeOpponentPickup("Bot_2", "9D", "physical-9D-1");
        matrix.reset();

        assertEquals(2, matrix.remaining("AS"));
        assertEquals(2, matrix.remaining("9D"));
        assertEquals(106, matrix.unseenTotal());
        assertEquals(0.0, matrix.danger("8D"), 0.0001);
    }
}
