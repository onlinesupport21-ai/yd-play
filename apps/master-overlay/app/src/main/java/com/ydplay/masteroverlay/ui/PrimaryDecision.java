package com.ydplay.masteroverlay.ui;

public record PrimaryDecision(
        Action action,
        String headline,
        String targetCard,
        String reason,
        String details,
        Severity severity
) {
    public enum Action { PICK_OPEN, DRAW_CLOSED, DISCARD, UNCERTAIN }
    public enum Severity { GO, CAUTION, STOP }
}
