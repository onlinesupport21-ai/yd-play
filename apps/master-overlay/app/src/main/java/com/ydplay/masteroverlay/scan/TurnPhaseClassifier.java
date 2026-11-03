package com.ydplay.masteroverlay.scan;

import java.util.Locale;

public final class TurnPhaseClassifier {
    private TurnPhaseClassifier() {}

    public static TurnPhase fromScreenText(String raw) {
        if (raw == null) return TurnPhase.UNKNOWN;
        String text = raw.toUpperCase(Locale.ROOT).replaceAll("\\s+", " ").trim();
        if (text.isEmpty()) return TurnPhase.UNKNOWN;
        if (text.contains("YOUR TURN TO PICK") || text.contains("YOUR TURN PICK")) return TurnPhase.USER_PICK;
        if (text.contains("YOUR TURN TO DISCARD") || text.contains("YOUR TURN DISCARD")) return TurnPhase.USER_DISCARD;
        if (text.contains("TURN")) return TurnPhase.OTHER;
        return TurnPhase.UNKNOWN;
    }
}
