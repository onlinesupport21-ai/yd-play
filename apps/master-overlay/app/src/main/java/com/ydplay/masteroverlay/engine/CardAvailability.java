package com.ydplay.masteroverlay.engine;

/** Remaining physical copies of a card code in an owned sandbox/replay state. */
@FunctionalInterface
public interface CardAvailability {
    int remaining(String cardCode);
}
