package com.ydplay.masteroverlay.scan;

/**
 * Keeps the Gold Rummy calibrated card-slot path independent from fragile full-screen banner OCR.
 * When the turn banner is missing, probe 14 physical slots and let slot recognition resolve 13/14.
 */
public final class GoldRummyScanPolicy {
    private GoldRummyScanPolicy() {}

    public static int geometryProbeCount(int bannerExpected, TurnPhase phase) {
        if (bannerExpected == 13 || bannerExpected == 14) return bannerExpected;
        if (phase == TurnPhase.USER_PICK) return 13;
        if (phase == TurnPhase.USER_DISCARD) return 14;
        return 14;
    }

    public static int resolveExpectedCount(int bannerExpected, TurnPhase phase, int recognizedSlots) {
        if (bannerExpected == 13 || bannerExpected == 14) return bannerExpected;
        if (phase == TurnPhase.USER_PICK) return 13;
        if (phase == TurnPhase.USER_DISCARD) return 14;
        if (recognizedSlots == 13 || recognizedSlots == 14) return recognizedSlots;
        return 0;
    }

    public static TurnPhase resolveTurnPhase(TurnPhase phase, int resolvedExpected) {
        if (phase != null && phase != TurnPhase.UNKNOWN) return phase;
        if (resolvedExpected == 13) return TurnPhase.USER_PICK;
        if (resolvedExpected == 14) return TurnPhase.USER_DISCARD;
        return TurnPhase.UNKNOWN;
    }
}
