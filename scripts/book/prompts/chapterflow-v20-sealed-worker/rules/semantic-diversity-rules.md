# Semantic Diversity Rules

Run the semantic diversity checker after structured chapter JSON is produced and before the release gate.

## Three Checks

### (a) Scenario Diversity

For each chapter, all 6 examples are compared pairwise. If any pair exceeds **85% similarity**, the chapter fails.

This catches the "same story in different clothes" failure — e.g., three scenarios that all describe someone organizing their workspace.

Fix: replace redundant scenarios with genuinely different contexts (different domain, different stakes, different relationship dynamic).

### (b) Tone Substance Verification

For each tone-keyed field (`chapterBreakdown`, `keyTakeaways[].point`), the three tones are compared pairwise:
- **> 95% similarity**: cosmetic swap (adjective change only). The tone is fake. Rewrite.
- **< 55% similarity**: tones contradict each other. The core message drifted. Realign.

Fix for cosmetic: make the competitive version actually competitive (frame as advantage, use sharper language, different emphasis). Make gentle actually contemplative (sit-with-it pacing, softer entry point).

Fix for divergence: check that all three tones convey the same core mechanism or insight, just through different lenses.

### (c) Cross-Chapter Opener Uniqueness

The first sentence of `chapterBreakdown` across all chapters (per tone) is compared pairwise. If any cross-chapter pair exceeds **80% similarity**, the book fails.

This catches repetitive structural openers like "Most people think X, but Y" appearing in multiple chapters.

Fix: rewrite the opener of the later chapter to use a different structural pattern.

## Running the Checker

```bash
npx tsx scripts/book/semantic-diversity-checker.ts <book-package.json> --output-dir reports/
```

Exits with code 1 if any check fails. Include in the release gate.

## Thresholds

| Check | Threshold | Direction |
|-------|-----------|-----------|
| Scenario diversity | 0.85 | max (reject above) |
| Tone substance (cosmetic) | 0.95 | max (reject above) |
| Tone substance (divergence) | 0.55 | min (reject below) |
| Opener uniqueness | 0.80 | max (reject above) |
