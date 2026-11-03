package com.ydplay.masteroverlay.state;

public final class LiveScanPolicy {
    private final long intervalMs;

    public LiveScanPolicy(long intervalMs) {
        if (intervalMs < 250L) throw new IllegalArgumentException("interval too small");
        this.intervalMs = intervalMs;
    }

    public static LiveScanPolicy defaultPolicy() { return new LiveScanPolicy(1800L); }

    public long intervalMs() { return intervalMs; }

    public boolean shouldStart(boolean enabled, boolean inFlight, long nowMs, long lastCompletedMs) {
        if (!enabled || inFlight) return false;
        if (lastCompletedMs <= 0L) return true;
        return nowMs - lastCompletedMs >= intervalMs;
    }
}
