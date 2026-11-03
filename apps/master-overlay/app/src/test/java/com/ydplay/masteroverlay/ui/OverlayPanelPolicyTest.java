package com.ydplay.masteroverlay.ui;

import org.junit.Test;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

public class OverlayPanelPolicyTest {
    @Test public void minimizeControlLivesInHeaderSoExpandedSectionsCannotPushItOffScreen() {
        assertEquals(OverlayPanelPolicy.MinimizePlacement.HEADER, OverlayPanelPolicy.minimizePlacement());
        assertTrue(OverlayPanelPolicy.headerMinimizeAlwaysVisible(true, true));
        assertTrue(OverlayPanelPolicy.headerMinimizeAlwaysVisible(false, true));
        assertTrue(OverlayPanelPolicy.headerMinimizeAlwaysVisible(true, false));
    }
}
