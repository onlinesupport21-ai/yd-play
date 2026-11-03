package com.ydplay.masteroverlay.state;

import com.ydplay.masteroverlay.engine.Card;
import com.ydplay.masteroverlay.engine.PatternMemory;

import java.util.*;

public final class OpponentTracker {
    public record Event(String opponentId, PatternMemory.Action action, String cardCode, long timestampMs) {}

    private final PatternMemory memory;

    public OpponentTracker(PatternMemory memory) {
        this.memory = memory == null ? new PatternMemory() : memory;
    }

    public synchronized List<Event> observeTransition(
            StableGameState previous,
            StableGameState current,
            boolean selfTurn,
            String opponentId
    ) {
        if (selfTurn || previous == null || current == null) return List.of();
        String before = normalize(previous.openCard());
        String after = normalize(current.openCard());
        if (Objects.equals(before, after)) return List.of();

        String opponent = opponentId == null || opponentId.isBlank() ? "table" : opponentId.trim();
        List<Event> events = new ArrayList<>(1);

        if (before != null && after == null) {
            add(events, opponent, PatternMemory.Action.PICK_OPEN, before, current.timestampMs());
        } else if (after != null) {
            // A changed visible top card proves a new discard. It does not by itself prove whether
            // the opponent drew closed or picked the previous open card.
            add(events, opponent, PatternMemory.Action.DISCARD, after, current.timestampMs());
        }
        return List.copyOf(events);
    }

    private void add(List<Event> out, String opponent, PatternMemory.Action action, String code, long timestampMs) {
        try {
            Card card = Card.parse(code, "obs-" + timestampMs + "-" + out.size());
            memory.observe(opponent, action, card);
            out.add(new Event(opponent, action, card.key(), timestampMs));
        } catch (IllegalArgumentException ignored) {
            // Scanner uncertainty is not converted into pattern memory.
        }
    }

    private static String normalize(String raw) {
        if (raw == null) return null;
        String s = raw.trim().toUpperCase(Locale.ROOT);
        return s.isEmpty() ? null : s;
    }
}
