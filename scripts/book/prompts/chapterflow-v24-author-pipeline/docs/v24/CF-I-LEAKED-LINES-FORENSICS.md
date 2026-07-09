# CF-I-1 S6 — leaked cross-book lines forensics (REPORT ONLY)

**Campaign:** CF-I-1 (2026-07-09) · **Scope:** detection/planning only — per owner decision 5,
NO banned-phrases entry or instruction rewrite is implemented in this campaign. This document
classifies each line's ORIGIN and proposes (does not apply) a fix class for the owner + CF-I-2.

## Method

For each line I grepped, EXCLUDING `state/` and tests: `src/**` (all instruction strings —
`briefRotation.ts`, `fullReadSkeletonPlan.ts`, `contentDeviceDeal.ts`, repair cards,
`readerBudgets.ts`), `prompts/**` + `prompts/archive/**` (agent system prompts, legacy
migration/voice-charter prompts), `agent-prompts/**` (writer/QC/repair cards, CRAFT-READ-RUBRIC),
`config/**`, and `book-packages/*.v21.json` (to confirm the shipped spread). Classes:

- **PROMPT-MINT** — the phrase (or a near-verbatim stem) is literally in an instruction/card the
  writer reads, so the pipeline authored it.
- **WRITER-DEFAULT** — no instruction contains it; it is the model's house-voice rendering of a
  REQUIREMENT (e.g. "close on the honest limit"), reached for independently across books.
- **OLD-PACKAGE-RESIDUE** — present in many pre-v24 shipped packages; predates the current
  prompt set, so it is baked into the catalog rather than freshly minted.

(These overlap: a widespread WRITER-DEFAULT is also OLD-PACKAGE-RESIDUE once it is in the
catalog. The primary class names the ACTIONABLE origin.)

## Findings table

| # | Line | Books | Verbatim in any prompt/config? | Adjacent instruction stem | Origin class | Proposed fix class (NOT applied) |
|---|------|-------|-------------------------------|---------------------------|--------------|-----------------------------------|
| 1 | "the limit is just as important" | 12 | **No** | the honest-limits closer requirement (`briefRotation.ts` `LIMITS_PLACEMENTS`/`LIMITS_INSTRUCTION`, `contentDeviceDeal.ts` limit-paragraph device) requires a "when-NOT-to / honest limit" close; `fullReadSkeletonPlan.ts` `the_overcorrection` even warns 'Avoid the bare "limit/limits" transition' | **WRITER-DEFAULT** (also OLD-PACKAGE-RESIDUE — 12 books, spans pre-v24) | **banned-phrases entry** (future-facing; published books untouched) — the requirement is legitimate, only the stock rendering repeats. Optionally reinforce `LIMITS_INSTRUCTION` to vary the closer wording (CF-I-2 text). |
| 2 | "the overcorrection is easy to miss" | 3 | **No** (both halves ARE seeded) | `fullReadSkeletonPlan.ts` `the_overcorrection` directive ("THE OVERCORRECTION … the failure mode of the virtue itself") + `briefRotation.ts` `QUIZ_FAILURE_MODES` "over-correction" **fused with** `prompts/researcher-chapter.system.md` hardEdge "the subtle thing that's easy to miss" | **PROMPT-ADJACENT WRITER-DEFAULT** (the writer welds two instruction stems) | **instruction rewrite** (CF-I-2) — the `the_overcorrection` directive should say NOT to narrate the overcorrection as "easy to miss"; keep the boundary requirement, de-mint the stock phrasing. |
| 3 | "the ending is evidence, not a time machine" | 2 | **No** (zero hits anywhere) | none — no "time machine" / "ending is evidence" stem in any surface | **WRITER-DEFAULT** (pure model coinage, a vivid metaphor) | **no action** — 2 books is below the cross-book-tell threshold (≥3 ch / ≥2 books) and a legal deliberate-callback count; MONITOR via `crossBookSignatureAudit`; add a banned-phrases entry only if it reaches ≥3. |
| 4 | "that is part of its value" | 2 | **No** | none | **WRITER-DEFAULT** (generic filler) | **no action** — too generic to ban (high false-positive risk on ordinary English) AND under threshold. Not a distinctive minted line; leave to the semantic panel. |

## Notes & recommendations for the owner (decision 5)

- **Only #1 and #2 have an actionable pipeline lever.** #1's fix is a config/banned-phrases entry
  (or a CF-I-2 `LIMITS_INSTRUCTION` wording nudge); #2's is a CF-I-2 rewrite of the
  `fullReadSkeletonPlan.ts` `the_overcorrection` directive. Both are TEXT-only, gate-neutral, and
  future-facing — they cannot touch the 12/3 already-shipped books (constraint: published books
  untouched).
- **#3 and #4 are model house-voice with no instruction to rewrite** and both sit at 2 books —
  under the `crossBookSignatureAudit` tell threshold. Banning #4 ("that is part of its value")
  would risk false positives on ordinary prose. Recommend: no action, keep them on the
  `crossBookSignatureAudit` watchlist; revisit if either crosses ≥3 chapters across ≥2 books.
- **Consistency with CF-I-2's de-minting:** #1 and #2 are the SAME class of defect this campaign's
  detectors target one layer down — an instruction's vocabulary rendered verbatim by the writer.
  If the owner greenlights the banned-phrases additions, they should be added ALONGSIDE the
  CF-I-2 instruction de-minting so the ban and the source-instruction wording stay reconciled
  (the same drift risk `machineryPhrases.ts` was created to prevent for the beat vocabulary).
- **No banned-phrases.json edit was made** (constraint: that is a CF-I-2/owner decision informed
  by this forensics).
