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

Current xfails: **none.** All defects documented during the 2026-06-09
review (4 hash-coverage gaps + key-order wart, the AS5 questionId dead path,
the C18/C19 catalog double-booking) were fixed in Phases 1–4 and their
xfails promoted to passing tests. New verified-but-unfixed defects go in as
new `xfail()` entries — that is the mechanism, keep using it.

Known harness blind spot: `xfail` treats ANY throw (including an environment
error like a missing file) as "the documented defect still fails". An xfail
that breaks for an unrelated reason looks healthy — prefer asserting the
specific failure inside the xfail body where practical.

## Fixture policy

Fixtures are **synthetic** (see `helpers.ts` — disjoint per-chapter word
banks and per-chapter sentence shapes). No copyrighted book text is committed.
Gold-corpus tests read real chapters from `state/chapters/` at runtime.

Clean fixtures must vary sentence *structure* across chapters, not just
nouns: a shared skeleton with swapped nouns is exactly the templating defect
AS5/AS7 exist to flag, and they will (correctly) flag your fixture.

CLI tests snapshot/restore `state/gate-attempts.json` so repeated runs don't
trip the stuck-blocker circuit breaker.
