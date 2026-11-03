package com.ydplay.masteroverlay;

/** Pure policy used by CaptureService so stale MediaProjection surfaces can self-heal. */
public final class CaptureRecoveryPolicy {
    private static final long STALE_FRAME_MS = 1500L;

    private CaptureRecoveryPolicy() {}

    public static boolean shouldReattach(long nowMs, long lastFrameMs, boolean readerReady, boolean displayReady) {
        if (!readerReady || !displayReady) return true;
        if (lastFrameMs <= 0L) return false;
        return nowMs - lastFrameMs >= STALE_FRAME_MS;
    }
}
