package com.ydplay.masteroverlay.state;

import org.junit.Test;

import java.util.List;

import static org.junit.Assert.assertEquals;

public class KnownCardLedgerTest {
    @Test public void modelsTwoNaturalDecksAndTwoPrintedJokers() {
        KnownCardLedger ledger = new KnownCardLedger();
        assertEquals(2, ledger.remainingCount("AS"));
        assertEquals(2, ledger.remainingCount("10H"));
        assertEquals(2, ledger.remainingCount("PJ"));
        assertEquals(106, ledger.unseenTotal());
    }

    @Test public void preservesDuplicatePhysicalCardsAndVisibleHistory() {
        KnownCardLedger ledger = new KnownCardLedger();
        ledger.refreshOwnHand(List.of("6D","6D","2H","3H"));
        ledger.observeVisibleCard("8D");
        assertEquals(2, ledger.knownCount("6D"));
        assertEquals(0, ledger.remainingCount("6D"));
        assertEquals(1, ledger.knownCount("8D"));
        assertEquals(5, ledger.knownTotal());
        assertEquals(101, ledger.unseenTotal());
    }

    @Test public void refreshingOwnHandReplacesRatherThanDoubleCountsIt() {
        KnownCardLedger ledger = new KnownCardLedger();
        ledger.refreshOwnHand(List.of("2H","3H","4H"));
        ledger.observeVisibleCard("8D");
        ledger.refreshOwnHand(List.of("3H","4H","5H"));
        assertEquals(0, ledger.knownCount("2H"));
        assertEquals(1, ledger.knownCount("5H"));
        assertEquals(1, ledger.knownCount("8D"));
        assertEquals(4, ledger.knownTotal());
    }

    @Test public void resetClearsKnowledgeButRestoresFullUnseenDeck() {
        KnownCardLedger ledger = new KnownCardLedger();
        ledger.refreshOwnHand(List.of("AS","AS","PJ"));
        ledger.observeVisibleCard("KC");
        ledger.reset();
        assertEquals(0, ledger.knownTotal());
        assertEquals(106, ledger.unseenTotal());
        assertEquals(2, ledger.remainingCount("AS"));
    }
}
