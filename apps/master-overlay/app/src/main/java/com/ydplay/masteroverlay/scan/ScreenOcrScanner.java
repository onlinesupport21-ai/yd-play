package com.ydplay.masteroverlay.scan;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Rect;

import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

import java.io.File;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.atomic.AtomicBoolean;

public final class ScreenOcrScanner implements AutoCloseable {
    public interface Callback {
        void onSuccess(AutoScanResult result);
        void onError(String message);
    }

    private final TextRecognizer recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
    private final AtomicBoolean closed = new AtomicBoolean(false);

    public void scan(File imageFile, Callback callback) {
        if (callback == null) return;
        if (closed.get()) { callback.onError("OCR scanner is closed"); return; }
        if (imageFile == null || !imageFile.isFile()) { callback.onError("Fresh screenshot is not available"); return; }

        Bitmap bitmap = BitmapFactory.decodeFile(imageFile.getAbsolutePath());
        if (bitmap == null) { callback.onError("Could not read the screenshot"); return; }

        int width = bitmap.getWidth();
        int height = bitmap.getHeight();
        InputImage image = InputImage.fromBitmap(bitmap, 0);
        recognizer.process(image)
                .addOnSuccessListener(text -> scanCalibratedOrFallback(bitmap, width, height, text, callback))
                .addOnFailureListener(error -> {
                    bitmap.recycle();
                    String message = error.getMessage();
                    callback.onError("OCR failed" + (message == null || message.isBlank() ? "" : ": " + message));
                });
    }

    private void scanCalibratedOrFallback(Bitmap bitmap, int width, int height, Text fullText, Callback callback) {
        try {
            String screenText = fullText == null ? null : fullText.getText();
            TurnPhase turnPhase = TurnPhaseClassifier.fromScreenText(screenText);
            int bannerExpected = GoldRummyHandGeometry.expectedHandCount(screenText);
            int probeCount = GoldRummyScanPolicy.geometryProbeCount(bannerExpected, turnPhase);
            GoldRummyBitmapVision.HandLayout layout = GoldRummyBitmapVision.detectHand(bitmap, probeCount);

            boolean calibrated = layout.cardTop() >= 0
                    && GoldRummyScanPolicy.acceptLayout(bannerExpected, probeCount, layout.starts().size());
            if (!calibrated) {
                AutoScanResult rawFallback = ScreenRegionClassifier.classify(width, height, toHits(fullText));
                AutoScanResult fallback = new AutoScanResult(
                        rawFallback.handCards(), rawFallback.openCard(), rawFallback.jokerRank(),
                        rawFallback.completeHand(), Math.min(0.69, rawFallback.confidence()),
                        rawFallback.allDetectedCards(), turnPhase);
                bitmap.recycle();
                callback.onSuccess(fallback);
                return;
            }

            final int finalBannerExpected = bannerExpected;
            final TurnPhase finalTurnPhase = turnPhase;
            GoldRummyBitmapVision.OcrStrip strip = GoldRummyBitmapVision.buildOcrStrip(bitmap, layout);
            recognizer.process(InputImage.fromBitmap(strip.bitmap(), 0))
                    .addOnSuccessListener(slotText -> {
                        try {
                            callback.onSuccess(buildCalibratedResult(
                                    bitmap, fullText, slotText, layout, strip,
                                    finalBannerExpected, finalTurnPhase));
                        } catch (Exception e) {
                            callback.onError("Card-slot parse error: " + e.getClass().getSimpleName());
                        } finally {
                            strip.bitmap().recycle();
                            bitmap.recycle();
                        }
                    })
                    .addOnFailureListener(error -> {
                        strip.bitmap().recycle();
                        bitmap.recycle();
                        String message = error.getMessage();
                        callback.onError("Card-slot OCR failed" + (message == null || message.isBlank() ? "" : ": " + message));
                    });
        } catch (Exception e) {
            bitmap.recycle();
            callback.onError("Calibrated scan error: " + e.getClass().getSimpleName());
        }
    }

    private static AutoScanResult buildCalibratedResult(
            Bitmap bitmap,
            Text fullText,
            Text slotText,
            GoldRummyBitmapVision.HandLayout layout,
            GoldRummyBitmapVision.OcrStrip strip,
            int bannerExpected,
            TurnPhase turnPhase
    ) {
        int cellCount = strip.jokerCell() + 1;
        String[] raw = collectCellText(slotText, strip.cellWidth(), cellCount);
        List<String> hand = new ArrayList<>();
        List<String> all = new ArrayList<>();

        for (int i = 0; i < strip.handCells(); i++) {
            String rank = CardTokenParser.extractRank(raw[i]);
            if (rank == null) continue;
            if ("PJ".equals(rank)) {
                hand.add("PJ");
                all.add("PJ");
                continue;
            }
            String suit = GoldRummyBitmapVision.classifyHandSuit(bitmap, layout.starts().get(i), layout.cardTop());
            if (suit == null) continue;
            String code = rank + suit;
            hand.add(code);
            all.add(code);
        }

        String openCard = null;
        String openRank = CardTokenParser.extractRank(raw[strip.openCell()]);
        if ("PJ".equals(openRank)) {
            openCard = "PJ";
        } else if (openRank != null) {
            String openSuit = GoldRummyBitmapVision.classifyOpenSuit(bitmap);
            if (openSuit != null) openCard = openRank + openSuit;
        }
        if (openCard != null) all.add(openCard);

        String jokerRank = CardTokenParser.extractRank(raw[strip.jokerCell()]);
        if ("PJ".equals(jokerRank)) jokerRank = null;

        for (OcrHit hit : toHits(fullText)) all.addAll(CardTokenParser.extractCardCodes(hit.text()));
        Set<String> diagnosticUnique = new LinkedHashSet<>(all);
        List<String> diagnostics = new ArrayList<>(diagnosticUnique);

        int resolvedExpected = GoldRummyScanPolicy.resolveExpectedCount(bannerExpected, turnPhase, hand.size());
        TurnPhase resolvedTurnPhase = GoldRummyScanPolicy.resolveTurnPhase(turnPhase, resolvedExpected);
        boolean completeHand = resolvedExpected > 0 && hand.size() == resolvedExpected;
        int denominator = resolvedExpected > 0 ? resolvedExpected : Math.max(1, strip.handCells());
        double recognizedFraction = hand.size() / (double) denominator;
        double confidence = 0.60 * layout.confidence() + 0.25 * recognizedFraction;
        if (openCard != null) confidence += 0.08;
        if (jokerRank != null) confidence += 0.07;
        confidence = Math.min(1.0, confidence);
        if (!completeHand) confidence = Math.min(confidence, 0.69);
        if (openCard == null && resolvedTurnPhase == TurnPhase.USER_PICK) confidence = Math.min(confidence, 0.72);
        if (jokerRank == null) confidence = Math.min(confidence, 0.70);

        return new AutoScanResult(hand, openCard, jokerRank, completeHand, confidence, diagnostics, resolvedTurnPhase);
    }

    private static String[] collectCellText(Text text, int cellWidth, int cellCount) {
        StringBuilder[] cells = new StringBuilder[cellCount];
        for (int i = 0; i < cellCount; i++) cells[i] = new StringBuilder();
        if (text == null) return buildersToStrings(cells);

        for (Text.TextBlock block : text.getTextBlocks()) {
            for (Text.Line line : block.getLines()) {
                boolean usedElement = false;
                for (Text.Element element : line.getElements()) {
                    Rect box = element.getBoundingBox();
                    if (box == null) continue;
                    int cell = Math.max(0, Math.min(cellCount - 1, box.centerX() / cellWidth));
                    append(cells[cell], element.getText());
                    usedElement = true;
                }
                if (!usedElement) {
                    Rect box = line.getBoundingBox();
                    if (box == null) continue;
                    int cell = Math.max(0, Math.min(cellCount - 1, box.centerX() / cellWidth));
                    append(cells[cell], line.getText());
                }
            }
        }
        return buildersToStrings(cells);
    }

    private static void append(StringBuilder b, String s) {
        if (s == null || s.isBlank()) return;
        if (!b.isEmpty()) b.append(' ');
        b.append(s.trim());
    }

    private static String[] buildersToStrings(StringBuilder[] cells) {
        String[] out = new String[cells.length];
        for (int i = 0; i < cells.length; i++) out[i] = cells[i].toString();
        return out;
    }

    static List<OcrHit> toHits(Text text) {
        List<OcrHit> hits = new ArrayList<>();
        if (text == null) return hits;
        for (Text.TextBlock block : text.getTextBlocks()) {
            for (Text.Line line : block.getLines()) {
                Rect box = line.getBoundingBox();
                if (box == null) continue;
                String raw = line.getText() == null ? "" : line.getText().trim();
                if (raw.isEmpty()) continue;

                if (raw.toUpperCase(Locale.ROOT).contains("JOKER")) hits.add(new OcrHit("JOKER", box.left, box.top, box.right, box.bottom));

                List<String> codes = CardTokenParser.extractCardCodes(raw);
                if (codes.isEmpty()) continue;
                if (codes.size() == 1) {
                    hits.add(new OcrHit(codes.get(0), box.left, box.top, box.right, box.bottom));
                    continue;
                }

                double segment = Math.max(1.0, box.width() / (double) codes.size());
                for (int i = 0; i < codes.size(); i++) {
                    int left = (int) Math.round(box.left + i * segment);
                    int right = i == codes.size() - 1 ? box.right : (int) Math.round(box.left + (i + 1) * segment);
                    hits.add(new OcrHit(codes.get(i), left, box.top, right, box.bottom));
                }
            }
        }
        return hits;
    }

    @Override public void close() {
        if (closed.compareAndSet(false, true)) recognizer.close();
    }
}
