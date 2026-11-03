package com.ydplay.masteroverlay.ui;

/** Small pure UI policy so minimize remains reachable regardless of expanded panel content. */
public final class OverlayPanelPolicy {
    public enum MinimizePlacement { HEADER }

    private OverlayPanelPolicy() {}

    public static MinimizePlacement minimizePlacement() { return MinimizePlacement.HEADER; }

    public static boolean headerMinimizeAlwaysVisible(boolean detailsExpanded, boolean manualExpanded) {
        return true;
    }
}
