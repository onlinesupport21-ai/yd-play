package com.ydplay.masteroverlay.scan;

import static org.junit.Assert.*;

import java.util.List;
import org.junit.Test;

public class CardTokenParserTest {
    @Test public void normalizesAsciiAndUnicodeSuits() {
        assertEquals("AS", CardTokenParser.normalizeCardToken("A♠"));
        assertEquals("10H", CardTokenParser.normalizeCardToken("10h"));
        assertEquals("QD", CardTokenParser.normalizeCardToken("Q D"));
        assertEquals("KC", CardTokenParser.normalizeCardToken(" K♣ "));
    }

    @Test public void normalizesPrintedJokerAliases() {
        assertEquals("PJ", CardTokenParser.normalizeCardToken("JOKER"));
        assertEquals("PJ", CardTokenParser.normalizeCardToken("JK"));
        assertEquals("PJ", CardTokenParser.normalizeCardToken("PJ"));
    }

    @Test public void rejectsJunk() {
        assertNull(CardTokenParser.normalizeCardToken("PLAYER"));
        assertNull(CardTokenParser.normalizeCardToken("1S"));
        assertNull(CardTokenParser.normalizeCardToken("14H"));
    }

    @Test public void extractsCardsAndPreservesDuplicates() {
        List<String> cards = CardTokenParser.extractCardCodes("A♠  10H  Q D  AS  JOKER  table  7c");
        assertEquals(List.of("AS", "10H", "QD", "AS", "PJ", "7C"), cards);
    }

    @Test public void extractsRankFromSmallCardCropOcr() {
        assertEquals("2", CardTokenParser.extractRank("2"));
        assertEquals("10", CardTokenParser.extractRank("10"));
        assertEquals("10", CardTokenParser.extractRank("I0"));
        assertEquals("J", CardTokenParser.extractRank("J\n♠"));
        assertEquals("Q", CardTokenParser.extractRank("Q"));
        assertEquals("K", CardTokenParser.extractRank("K"));
        assertEquals("PJ", CardTokenParser.extractRank("J O K E R S"));
        assertNull(CardTokenParser.extractRank("POINTS 52"));
    }
}
