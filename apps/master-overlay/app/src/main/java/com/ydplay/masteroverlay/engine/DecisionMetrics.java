package com.ydplay.masteroverlay.engine;

/** Measured/derived metrics for owned sandbox and replay analysis. */
public record DecisionMetrics(
        int deadwood,
        int unmeldedCount,
        int pureSequences,
        int totalSequences,
        boolean validDeclaration,
        int meldDistanceScore,
        int liveOutCopies,
        int improvingCardTypes,
        int declarationOutCopies,
        int bestDeadwoodAfterDraw,
        int earlyHighCardPenalty,
        double weightedDeadwoodImprovement
) {}
