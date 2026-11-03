package com.ydplay.masteroverlay.scan;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class CardTokenParser {
    private static final Pattern CARD_PATTERN = Pattern.compile(
            "(?<![A-Z0-9])(?:JOKER|JK|PJ|(10|[2-9AJQK])\\s*([SHDC♠♥♦♣]))(?![A-Z0-9])",
            Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);

    private CardTokenParser() {}

    public static String normalizeCardToken(String raw) {
        if (raw == null) return null;
        String s = raw.trim().toUpperCase(Locale.ROOT)
                .replace("♠", "S")
                .replace("♥", "H")
                .replace("♦", "D")
                .replace("♣", "C")
                .replaceAll("\\s+", "");
        if (s.equals("JOKER") || s.equals("JK") || s.equals("PJ")) return "PJ";
        if (!s.matches("(?:10|[2-9AJQK])[SHDC]")) return null;
        return s;
    }

    /** Parse only the rank from a tightly cropped card corner OCR result. */
    public static String extractRank(String rawText) {
        if (rawText == null || rawText.isBlank()) return null;
        String compact = rawText.toUpperCase(Locale.ROOT)
                .replace("♠", "S")
                .replace("♥", "H")
                .replace("♦", "D")
                .replace("♣", "C")
                .replaceAll("[^A-Z0-9]", "");
        if (compact.contains("JOKER") || compact.equals("JK") || compact.equals("PJ")) return "PJ";
        if (compact.equals("I0") || compact.equals("IO") || compact.equals("L0")) return "10";
        if (compact.matches("10|[2-9AJQK]")) return compact;
        if (compact.matches("(?:10|[2-9AJQK])[SHDC]")) return compact.substring(0, compact.length() - 1);
        return null;
    }

    public static List<String> extractCardCodes(String rawText) {
        List<String> out = new ArrayList<>();
        if (rawText == null || rawText.isBlank()) return out;
        Matcher matcher = CARD_PATTERN.matcher(rawText);
        while (matcher.find()) {
            String normalized = normalizeCardToken(matcher.group());
            if (normalized != null) out.add(normalized);
        }
        return out;
    }
}
