# REDO — four-thousand-weeks ch03 — fix misspelled philosopher name

**Scope:** one find/replace. Not a rewrite. The chapter is otherwise GREEN
(9/9 quiz keys correct, prose coherent, examples coherent, cards/plan/lines strong).

## The defect

The philosopher **Martin Hägglund** (Yale; author of *This Life: Secular Faith
and Spiritual Freedom*, the chapter's finitude source) is misspelled **"Haggland"**
**5 times** in ch03:
- `breakdown.fullRead` — "Haggland's Baltic coast adds a different edge…" and
  "…Martin Haggland can be there with extended family in Sweden…"
- `examples` ex2 (Glacier Afternoon) scenario — "…Martin Haggland and This Life…"
- `quiz` Q5 prompt — "…fits Haggland's point?"
- (any other occurrence — there are 5 total)

The error originates upstream: `.chapterflow/runs/four-thousand-weeks/20260605-123808/sidecars/source/ch03.source.json`
also spells it "Haggland", so the writer propagated it faithfully.

## The fix

Replace **`Haggland` → `Hägglund`** everywhere in:
1. `state/chapters/four-thousand-weeks-ch03.v21-native.chapter.json` (5 occurrences)
2. `…/sidecars/source/ch03.source.json` (fix the root so future regens are clean)

Do **not** change anything else — names, keys, prose, structure all passed QC.
Correct anglicization is "Hägglund" (umlaut) or "Hagglund"; use "Hägglund".

## Done-condition

- `grep -c Haggland` on both files returns 0; the name reads "Hägglund".
- `gate-chapter ch03` still 0 blockers; `book-gate` still PASS.
- Re-QC ch03: the prior REVISE attestation goes STALE on edit (content hash
  changes) → re-read and re-attest PUBLISHABLE. That flips qc-status to 14/14.
