package com.ydplay.masteroverlay.scan;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Rect;

import java.util.ArrayList;
import java.util.List;

/** Pixel geometry calibrated from the supplied Gold Rummy landscape screenshots. */
final class GoldRummyBitmapVision {
    record HandLayout(int cardTop, List<Integer> starts, double confidence) {}
    record OcrStrip(Bitmap bitmap, int cellWidth, int handCells, int openCell, int jokerCell) {}

    private GoldRummyBitmapVision() {}

    static HandLayout detectHand(Bitmap bitmap, int expectedCount) {
        if (bitmap == null) return new HandLayout(-1, List.of(), 0.0);
        int w = bitmap.getWidth(), h = bitmap.getHeight();
        if (w <= h || w < 800 || h < 400) return new HandLayout(-1, List.of(), 0.0);
        int[] px = new int[w * h];
        bitmap.getPixels(px, 0, w, 0, 0, w, h);

        int cardTop = detectCardTop(px, w, h);
        if (cardTop < 0) return new HandLayout(-1, List.of(), 0.0);

        int y1 = Math.min(h, cardTop + Math.max(80, (int) Math.round(h * 0.20)));
        int x0 = Math.max(1, (int) Math.round(w * 0.08));
        int x1 = Math.min(w - 2, (int) Math.round(w * 0.94));
        double[] edge = new double[w];
        for (int x = x0; x <= x1; x++) {
            long sum = 0;
            int n = 0;
            for (int y = cardTop; y < y1; y += 2) {
                sum += Math.abs(luma(px[y * w + x]) - luma(px[y * w + x - 1]));
                n++;
            }
            edge[x] = n == 0 ? 0 : sum / (double) n;
        }

        List<GoldRummyHandGeometry.Candidate> candidates = new ArrayList<>();
        int rightWidth = Math.max(24, (int) Math.round(w * 0.035));
        int whiteBottom = Math.min(h, cardTop + Math.max(70, (int) Math.round(h * 0.18)));
        for (int x = x0 + 3; x <= x1 - 3; x++) {
            double score = edge[x];
            if (score < 18.0) continue;
            boolean localMax = true;
            for (int k = x - 3; k <= x + 3; k++) {
                if (edge[k] > score) { localMax = false; break; }
            }
            if (!localMax) continue;
            double whiteRatio = neutralWhiteRatio(px, w, h, x, cardTop,
                    Math.min(w, x + rightWidth), whiteBottom, 2);
            if (whiteRatio >= 0.35) {
                candidates.add(new GoldRummyHandGeometry.Candidate(x, score, whiteRatio));
            }
        }

        List<Integer> starts = GoldRummyHandGeometry.selectStarts(w, candidates, expectedCount);
        double confidence;
        if (expectedCount > 0) confidence = Math.min(1.0, starts.size() / (double) expectedCount);
        else confidence = (starts.size() == 13 || starts.size() == 14) ? 0.82 : Math.min(0.70, starts.size() / 14.0);
        return new HandLayout(cardTop, starts, confidence);
    }

    static String classifyHandSuit(Bitmap bitmap, int startX, int cardTop) {
        int w = bitmap.getWidth(), h = bitmap.getHeight();
        int cardWidth = Math.max(80, (int) Math.round(w * 0.075));
        int cardHeight = Math.max(110, (int) Math.round(h * 0.23));
        return classifySuit(bitmap, startX, cardTop, cardWidth, cardHeight);
    }

    static String classifyOpenSuit(Bitmap bitmap) {
        int w = bitmap.getWidth(), h = bitmap.getHeight();
        int startX = (int) Math.round(w * 0.623);
        int topY = (int) Math.round(h * 0.362);
        int cardWidth = Math.max(60, (int) Math.round(w * 0.055));
        int cardHeight = Math.max(90, (int) Math.round(h * 0.162));
        return classifySuit(bitmap, startX, topY, cardWidth, cardHeight);
    }

    static OcrStrip buildOcrStrip(Bitmap source, HandLayout layout) {
        int w = source.getWidth(), h = source.getHeight();
        List<Integer> starts = layout.starts();
        int handCount = starts.size();
        int openCell = handCount;
        int jokerCell = handCount + 1;
        int cells = handCount + 2;
        int cellW = 104;
        int cellH = 218;
        Bitmap strip = Bitmap.createBitmap(Math.max(cellW, cellW * cells), cellH, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(strip);
        canvas.drawColor(Color.WHITE);
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.FILTER_BITMAP_FLAG);
        Paint divider = new Paint();
        divider.setColor(Color.BLACK);

        int cardHeight = Math.max(110, (int) Math.round(h * 0.23));
        int maxCorner = Math.max(44, (int) Math.round(w * 0.050));
        for (int i = 0; i < handCount; i++) {
            int sx = starts.get(i);
            int exposed = maxCorner;
            if (i + 1 < handCount) exposed = Math.min(exposed, Math.max(42, starts.get(i + 1) - sx - 5));
            Rect src = safeRect(sx, layout.cardTop(), sx + exposed, layout.cardTop() + cardHeight, w, h);
            Rect dst = new Rect(i * cellW + 8, 6, (i + 1) * cellW - 8, cellH - 6);
            canvas.drawBitmap(source, src, dst, paint);
            if (i > 0) canvas.drawRect(i * cellW - 2, 0, i * cellW + 2, cellH, divider);
        }

        // Dedicated full-card ROIs; unlike v1.1 these cannot be confused with hand OCR near screen centre.
        Rect openSrc = safeRect((int)(w * 0.615), (int)(h * 0.34), (int)(w * 0.690), (int)(h * 0.55), w, h);
        Rect jokerSrc = safeRect((int)(w * 0.295), (int)(h * 0.34), (int)(w * 0.355), (int)(h * 0.55), w, h);
        canvas.drawBitmap(source, openSrc, new Rect(openCell * cellW + 8, 6, (openCell + 1) * cellW - 8, cellH - 6), paint);
        canvas.drawRect(openCell * cellW - 2, 0, openCell * cellW + 2, cellH, divider);
        canvas.drawBitmap(source, jokerSrc, new Rect(jokerCell * cellW + 8, 6, (jokerCell + 1) * cellW - 8, cellH - 6), paint);
        canvas.drawRect(jokerCell * cellW - 2, 0, jokerCell * cellW + 2, cellH, divider);
        return new OcrStrip(strip, cellW, handCount, openCell, jokerCell);
    }

    private static int detectCardTop(int[] px, int w, int h) {
        int x0 = (int) Math.round(w * 0.08), x1 = (int) Math.round(w * 0.94);
        int y0 = (int) Math.round(h * 0.50), y1 = (int) Math.round(h * 0.72);
        int consecutive = 0;
        int first = -1;
        for (int y = y0; y <= y1; y++) {
            int white = 0, total = 0;
            for (int x = x0; x < x1; x += 2) {
                if (isNeutralWhite(px[y * w + x])) white++;
                total++;
            }
            double ratio = total == 0 ? 0 : white / (double) total;
            if (ratio > 0.30) {
                if (consecutive == 0) first = y;
                consecutive++;
                if (consecutive >= 3) return first;
            } else {
                consecutive = 0;
                first = -1;
            }
        }
        return -1;
    }

    private static String classifySuit(Bitmap bitmap, int startX, int topY, int cardWidth, int cardHeight) {
        int w = bitmap.getWidth(), h = bitmap.getHeight();
        int x0 = clamp(startX, 0, w - 1);
        int x1 = clamp(startX + (int)Math.round(cardWidth * 0.45), x0 + 1, w);
        int y0 = clamp(topY + (int)Math.round(cardHeight * 0.42), 0, h - 1);
        int y1 = clamp(topY + (int)Math.round(cardHeight * 0.90), y0 + 1, h);
        int rw = x1 - x0, rh = y1 - y0;
        int[] pixels = new int[rw * rh];
        bitmap.getPixels(pixels, 0, rw, x0, y0, rw, rh);

        int redCount = 0, blackCount = 0;
        int[] redRows = new int[rh], blackRows = new int[rh];
        for (int y = 0; y < rh; y++) {
            for (int x = 0; x < rw; x++) {
                int c = pixels[y * rw + x];
                int r = Color.red(c), g = Color.green(c), b = Color.blue(c);
                boolean red = r > 120 && r * 100 > g * 125 && r * 100 > b * 125;
                boolean black = r < 105 && g < 105 && b < 105;
                if (red) { redCount++; redRows[y]++; }
                if (black) { blackCount++; blackRows[y]++; }
            }
        }
        boolean red = redCount > blackCount;
        int[] rows = red ? redRows : blackRows;
        if (Math.max(redCount, blackCount) < 80) return null;
        double ratio = componentTopMiddleRatio(rows);
        if (Double.isNaN(ratio)) return null;
        return GoldRummySuitClassifier.fromShape(red, ratio);
    }

    private static double componentTopMiddleRatio(int[] rows) {
        int bestStart = -1, bestEnd = -1, bestArea = -1;
        int start = -1, last = -10;
        for (int y = 0; y < rows.length; y++) {
            if (rows[y] < 4) continue;
            if (start < 0 || y - last > 2) {
                if (start >= 0) {
                    int area = area(rows, start, last + 1);
                    if (area > bestArea) { bestArea = area; bestStart = start; bestEnd = last + 1; }
                }
                start = y;
            }
            last = y;
        }
        if (start >= 0) {
            int area = area(rows, start, last + 1);
            if (area > bestArea) { bestArea = area; bestStart = start; bestEnd = last + 1; }
        }
        if (bestStart < 0 || bestEnd - bestStart < 6) return Double.NaN;
        int len = bestEnd - bestStart;
        int third = Math.max(1, len / 3);
        double top = mean(rows, bestStart, Math.min(bestEnd, bestStart + third));
        double middle = mean(rows, Math.min(bestEnd, bestStart + third), Math.min(bestEnd, bestStart + 2 * third));
        return top / Math.max(1.0, middle);
    }

    private static int area(int[] rows, int a, int b) {
        int sum = 0; for (int i = a; i < b; i++) sum += rows[i]; return sum;
    }
    private static double mean(int[] rows, int a, int b) {
        if (b <= a) return 0; long sum = 0; for (int i = a; i < b; i++) sum += rows[i]; return sum / (double)(b - a);
    }
    private static double neutralWhiteRatio(int[] px, int w, int h, int x0, int y0, int x1, int y1, int step) {
        int white = 0, total = 0;
        for (int y = clamp(y0, 0, h - 1); y < clamp(y1, 1, h); y += step) {
            for (int x = clamp(x0, 0, w - 1); x < clamp(x1, 1, w); x += step) {
                if (isNeutralWhite(px[y * w + x])) white++;
                total++;
            }
        }
        return total == 0 ? 0 : white / (double) total;
    }
    private static boolean isNeutralWhite(int c) {
        int r = Color.red(c), g = Color.green(c), b = Color.blue(c);
        int max = Math.max(r, Math.max(g, b)), min = Math.min(r, Math.min(g, b));
        return (r + g + b) / 3 > 185 && max - min < 70;
    }
    private static int luma(int c) { return (77 * Color.red(c) + 150 * Color.green(c) + 29 * Color.blue(c)) >> 8; }
    private static Rect safeRect(int left, int top, int right, int bottom, int w, int h) {
        left = clamp(left, 0, w - 1); top = clamp(top, 0, h - 1); right = clamp(right, left + 1, w); bottom = clamp(bottom, top + 1, h);
        return new Rect(left, top, right, bottom);
    }
    private static int clamp(int v, int lo, int hi) { return Math.max(lo, Math.min(hi, v)); }
}
