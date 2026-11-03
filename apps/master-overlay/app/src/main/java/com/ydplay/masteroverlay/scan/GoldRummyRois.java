package com.ydplay.masteroverlay.scan;

/**
 * Screen-space regions for the supplied 1536×709 Gold-style landscape skin.
 * Pure geometry (no Android dependency), scaled to the actual capture dimensions.
 */
public final class GoldRummyRois {
    public enum Zone { HAND, TURN, OPEN, JOKER }
    public record Box(int left, int top, int right, int bottom) {
        public int width() { return right-left; }
        public int height() { return bottom-top; }
        public boolean contains(int x,int y) {
            return x>=left && x<right && y>=top && y<bottom;
        }
    }
    private GoldRummyRois() {}

    public static Box forFrame(Zone zone,int width,int height) {
        if (zone==null || width < 800 || height < 400 || width <= height) {
            throw new IllegalArgumentException("Gold-style ROI requires landscape frame >=800x400");
        }
        // Four areas deliberately do not include status-bar decoration or the overlay bubble.
        double l,t,r,b;
        switch(zone) {
            case HAND -> { l=.10; t=.55; r=.93; b=.84; }
            case TURN -> { l=.32; t=.265; r=.73; b=.36; }
            case OPEN -> { l=.61; t=.34; r=.70; b=.55; }
            case JOKER -> { l=.30; t=.34; r=.42; b=.55; }
            default -> throw new IllegalArgumentException("Unknown region");
        }
        int x0=clamp((int)Math.round(l*width),0,width-1);
        int y0=clamp((int)Math.round(t*height),0,height-1);
        int x1=clamp((int)Math.round(r*width),x0+1,width);
        int y1=clamp((int)Math.round(b*height),y0+1,height);
        return new Box(x0,y0,x1,y1);
    }
    private static int clamp(int value,int min,int max) {
        return Math.max(min,Math.min(max,value));
    }
}
