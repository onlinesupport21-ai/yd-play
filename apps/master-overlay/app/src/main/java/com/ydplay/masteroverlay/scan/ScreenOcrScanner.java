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
import java.util.List;
import java.util.Locale;
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
                .addOnSuccessListener(text -> {
                    try {
                        List<OcrHit> hits = toHits(text);
                        callback.onSuccess(ScreenRegionClassifier.classify(width, height, hits));
                    } catch (Exception e) {
                        callback.onError("OCR parse error: " + e.getClass().getSimpleName());
                    } finally {
                        bitmap.recycle();
                    }
                })
                .addOnFailureListener(error -> {
                    bitmap.recycle();
                    String message = error.getMessage();
                    callback.onError("OCR failed" + (message == null || message.isBlank() ? "" : ": " + message));
                });
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

                if (raw.toUpperCase(Locale.ROOT).contains("JOKER")) {
                    hits.add(new OcrHit("JOKER", box.left, box.top, box.right, box.bottom));
                }

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
