# Pipeline test suite

Zero-dependency tests for the v21 gating system, run by the same `tsx` the
pipeline itself uses. No framework, no install.

```bash
# from scripts/book/prompts/chapterflow-v21-authored/
npx tsx tests/run.ts            # everything
npx tsx tests/run.ts hash gold  # only files whose names match a term
npx tsc -p . --noEmit           # typecheck (tsx ignores types; this doesn't)
```

Exit code 0 = healthy. Both commands are CI-ready as-is.

## What the suites guard

| File | Guards |
|---|---|
| `hash-coverage.test.ts` | The QC-attestation hash covers every reader-facing `ChapterV21` field and excludes provenance — the attestation gate is only as strong as this. |
| `check-registry.test.ts` | No duplicate keys in `SEVERITY_FROM_CATALOG` (a dup silently last-wins); catalog-id namespace integrity; AS5–AS12 ids stay registered. |
| `gold-corpus.test.ts` | **Zero blocker false-positives on `daring-greatly` + `start-with-why`** — the calibration claim that previously lived in comments (and rotted once, SC9). Reads `state/chapters/` at runtime; skips loudly if absent. |
| `defect-corpus.test.ts` | Known shipped-incident classes, reproduced synthetically, must be CAUGHT: AS7 identical card backs (unreasonable-hospitality), AS5 quiz template substitution (Covey/rich-dad), F1 protagonist reuse (HWF). |
| `cli-contract.test.ts` | The exit-code contract operators script against (0/1/2), the `Gate verdict:` line, and end-to-end sibling loading on the ship path. |

## xfail policy (read before "fixing" a ▣)

`xfail()` documents a **verified, known defect**: the test asserts the
*correct* behavior and is expected to fail while the defect exists. When you
fix the defect the test reports **XPASS, which fails the suite on purpose** —
promote the `xfail()` to `test()` in the same change. This keeps every open
defect pinned to code instead of to memory.

Current xfails (all verified in the 2026-06-09 review):

- 4 × hash-coverage gaps (`passingScorePercent`, `readingTimeMinutes`,
  `examples[].tags`, `reviewCards[].difficulty`) + 1 key-order wart →
  **Phase 1:** invert `canonicalContent` to an exclude-list with deep key sort.
- AS5 dead under chapter-scoped questionIds (16 of 17 on-disk conventions) →
  **Phase 1:** positional matching + a questionId-format invariant.
- C18/C19 double-booked between `supportSectionAudit` and the narrative
  checks routed through `finalGate` → **Phase 4:** renumber to C22/C23 +
  single check-id registry.

## Fixture policy

Fixtures are **synthetic** (see `helpers.ts` — disjoint per-chapter word
banks and per-chapter sentence shapes). No copyrighted book text is committed.
Gold-corpus tests read real chapters from `state/chapters/` at runtime.

Clean fixtures must vary sentence *structure* across chapters, not just
nouns: a shared skeleton with swapped nouns is exactly the templating defect
AS5/AS7 exist to flag, and they will (correctly) flag your fixture.

CLI tests snapshot/restore `state/gate-attempts.json` so repeated runs don't
trip the stuck-blocker circuit breaker.
