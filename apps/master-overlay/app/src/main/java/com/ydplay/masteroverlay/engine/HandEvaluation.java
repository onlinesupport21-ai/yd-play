package com.ydplay.masteroverlay.engine;

import java.util.List;

public record HandEvaluation(
    int deadwood,
    int unmeldedCount,
    int pureSequences,
    int impureSequences,
    int totalSequences,
    int sets,
    int meldedCount,
    boolean validDeclaration,
    List<Card> deadwoodCards
) {}
