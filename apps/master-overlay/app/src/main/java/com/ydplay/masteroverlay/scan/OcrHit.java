package com.ydplay.masteroverlay.scan;

public record OcrHit(String text, int left, int top, int right, int bottom) {
    public double centerX() { return (left + right) / 2.0; }
    public double centerY() { return (top + bottom) / 2.0; }
}
