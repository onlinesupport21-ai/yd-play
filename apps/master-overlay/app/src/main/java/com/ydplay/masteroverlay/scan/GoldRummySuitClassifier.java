package com.ydplay.masteroverlay.scan;

public final class GoldRummySuitClassifier {
    private GoldRummySuitClassifier() {}

    /**
     * @param red true when the isolated suit component is red, false when black
     * @param topToMiddleWidth mean foreground width in the top third divided by middle third
     */
    public static String fromShape(boolean red, double topToMiddleWidth) {
        if (Double.isNaN(topToMiddleWidth) || Double.isInfinite(topToMiddleWidth) || topToMiddleWidth < 0) {
            throw new IllegalArgumentException("shape ratio must be finite and non-negative");
        }
        if (red) return topToMiddleWidth >= 0.70 ? "H" : "D";
        return topToMiddleWidth >= 0.46 ? "C" : "S";
    }
}
