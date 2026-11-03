package com.ydplay.masteroverlay.engine;

public record Recommendation(
    String drawChoice,
    Card discard,
    int beforeDeadwood,
    int afterDeadwood,
    boolean validDeclaration,
    String reason
) {}
