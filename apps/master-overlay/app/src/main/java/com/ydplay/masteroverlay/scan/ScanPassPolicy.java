package com.ydplay.masteroverlay.scan;

/** Chooses the cheap calibrated ROI path before the expensive full-screen OCR fallback. */
public final class ScanPassPolicy {
    private ScanPassPolicy() {}

    public static boolean shouldRunFullScreenFallback(boolean calibratedLayoutAvailable) {
        return !calibratedLayoutAvailable;
    }
}
