package com.ydplay.masteroverlay.scan;

public enum TurnPhase {
    USER_PICK,
    USER_DISCARD,
    OTHER,
    UNKNOWN;

    public boolean isUserTurn() {
        return this == USER_PICK || this == USER_DISCARD;
    }
}
