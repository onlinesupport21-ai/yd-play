package com.ydplay.masteroverlay.scan;

/** Normalized Gold Rummy regions used to keep expensive vision/OCR off unrelated pixels. */
public final class GoldRummyRoiLayout {
    public record Zone(int left, int top, int right, int bottom) {}

    private final Zone hand;
    private final Zone openDeck;
    private final Zone wildJoker;
    private final Zone opponentActivity;

    private GoldRummyRoiLayout(Zone hand, Zone openDeck, Zone wildJoker, Zone opponentActivity) {
        this.hand = hand;
        this.openDeck = openDeck;
        this.wildJoker = wildJoker;
        this.opponentActivity = opponentActivity;
    }

    public static GoldRummyRoiLayout forFrame(int width, int height) {
        if (width <= 0 || height <= 0) throw new IllegalArgumentException("invalid frame size");
        return new GoldRummyRoiLayout(
                zone(width, height, 0.08, 0.50, 0.94, 0.98),
                zone(width, height, 0.60, 0.30, 0.71, 0.60),
                zone(width, height, 0.27, 0.30, 0.38, 0.60),
                zone(width, height, 0.05, 0.03, 0.95, 0.50));
    }

    public Zone hand() { return hand; }
    public Zone openDeck() { return openDeck; }
    public Zone wildJoker() { return wildJoker; }
    public Zone opponentActivity() { return opponentActivity; }

    private static Zone zone(int w, int h, double l, double t, double r, double b) {
        int left = clamp((int)Math.round(w * l), 0, w - 1);
        int top = clamp((int)Math.round(h * t), 0, h - 1);
        int right = clamp((int)Math.round(w * r), left + 1, w);
        int bottom = clamp((int)Math.round(h * b), top + 1, h);
        return new Zone(left, top, right, bottom);
    }

    private static int clamp(int value, int min, int max) {
        return Math.max(min, Math.min(max, value));
    }
}
