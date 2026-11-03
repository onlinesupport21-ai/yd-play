package com.ydplay.masteroverlay.state;

import com.ydplay.masteroverlay.engine.PatternMemory;
import org.junit.Test;

import java.util.List;

import static org.junit.Assert.*;

public class OpponentTrackerTest {
    private static StableGameState state(String open, long t) {
        return new StableGameState(
                List.of("2H","3H","4H","6D","PJ","8D","5S","6S","5D","8S","6D","6H","JS"),
                open,
                "Q",
                0.92,
                t
        );
    }

    @Test public void recordsNewVisibleDiscardOnOpponentTransition() {
        PatternMemory memory = new PatternMemory();
        OpponentTracker tracker = new OpponentTracker(memory);
        List<OpponentTracker.Event> events = tracker.observeTransition(state("8D",1000), state("10H",1400), false, "P2");
        assertEquals(1, events.size());
        assertEquals(PatternMemory.Action.DISCARD, events.get(0).action());
        assertEquals("10H", events.get(0).cardCode());
        assertEquals(1, memory.observations());
    }

    @Test public void recordsOpenPickupOnlyWhenTopCardIsObservedConsumed() {
        PatternMemory memory = new PatternMemory();
        OpponentTracker tracker = new OpponentTracker(memory);
        List<OpponentTracker.Event> events = tracker.observeTransition(state("8D",1000), state(null,1200), false, "P3");
        assertEquals(1, events.size());
        assertEquals(PatternMemory.Action.PICK_OPEN, events.get(0).action());
        assertEquals("8D", events.get(0).cardCode());
    }

    @Test public void suppressesSelfTurnTransitions() {
        PatternMemory memory = new PatternMemory();
        OpponentTracker tracker = new OpponentTracker(memory);
        assertTrue(tracker.observeTransition(state("8D",1000), state("10H",1200), true, "P2").isEmpty());
        assertEquals(0, memory.observations());
    }

    @Test public void ignoresAmbiguousNoChange() {
        PatternMemory memory = new PatternMemory();
        OpponentTracker tracker = new OpponentTracker(memory);
        assertTrue(tracker.observeTransition(state("8D",1000), state("8D",1200), false, "P2").isEmpty());
        assertEquals(0, memory.observations());
    }
}
