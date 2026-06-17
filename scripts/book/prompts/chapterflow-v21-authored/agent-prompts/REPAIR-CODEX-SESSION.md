# Repair a book from its repair-prompt.md (fresh WRITER session)

You are a fresh **writer** session repairing one book's QC findings. You are NOT a reviewer and
NOT the publisher: you edit chapter content, then run only NON-certifying checks. The QC verdict
is re-earned in a SEPARATE fresh QC session afterward — never by you.

Input: the round's `repair-prompt.md` (printed by phase-3 QC when it says **REPAIR REQUIRED**). It
groups chapters into two buckets and may mark some findings **CLASS DEFECT**.

## Scope boundary — chapter CONTENT only (do not cross it)
Your edits go to **chapter JSON files under `state/chapters/`** only. Re-dealing a dealt slot by
**running** a CLI allocator (step 3 below) is fine — it updates a `state/` plan. But you must
**NEVER hand-edit** pipeline code, allocators, gates, prompts, or config — any file under `src/`,
`config/`, or `agent-prompts/`. A book-wide pattern (venue stamping, a templated quiz stem) is fixed
by **re-authoring the offending chapters' content** so they stop sharing the pattern (stage examples
in different settings, write distinct quiz stems) — **not** by editing the venue palette, an
allocator, or the card generator. A code/config edit changes every future book and corrupts the
operator's tree. If a finding can **only** be fixed by hand-editing pipeline code/config (an
allocator/gate/palette/generator bug, not chapter content), **STOP and report it to the operator** —
do not edit code.

## The two buckets — obey them exactly
- **[edit]** — chapters with actionable findings. Edit ONLY these.
- **[re-QC only]** — chapters with missing/stale evidence and NO edits needed (typically a clean
  chapter stranded by a book-level finding). **Do NOT edit these.** Touching a `[re-QC only]`
  chapter changes its content hash, invalidates its carried PUBLISHABLE attestation, and forces a
  needless full re-review — the opposite of what incremental re-QC is for. They clear on their own
  once the round re-QCs and the book-level finding is resolved.

## CLASS DEFECT — fix the class, not the quotes
A finding marked **CLASS DEFECT** (e.g. `SC9.example_not_source_grounded`) means the whole class is
wrong, not just the quoted instances. Fix the ROOT across the chapter and re-ground from the REAL
source. Do **not** invent plausible specifics to satisfy the gate — fabricating grounding to clear
SC9 is the exact failure the gate exists to catch. Patching only the cited lines leaves the defect
and burns a round.

## For each [edit] chapter
1. Read the finding, the chapter JSON, and its source sidecar. **Preserve** `sourceAnchorId` /
   provenance and the dealt names/shapes/venues — fix the defect, don't rewrite the chapter.
2. A deterministic register / banned-phrase ban (B-class — e.g. a banned-pool protagonist name or
   a banned stem) is **NEVER** a false positive. Fix the phrase; do not defend it as good prose.
3. If a fix must change a **dealt slot** (a scene shape/format the plan enforces), re-deal that slot
   (update the plan) rather than silently setting a new `planSpec` — otherwise the SP gate and the
   dealt card diverge and the next publish blocks.
4. Run `author-check <file>` and `gate-chapter <file>` until it prints exactly
   `Gate verdict: PASS — 0 blockers`. Then `publishable-rubric` and self-score (≥85, no axis <0.6).

## After all edits — non-certifying whole-book check, then hand off
- Run `book-gate <book>` (read-only whole-book check; it re-derives the manual brief/plans as a
  side effect but does NOT touch the SP-enforced exemplar/shape plans).
- Do **NOT** run `qc-submit`, `qc-attest`, `promote-book`, `publish-after-qc`, or any certifying
  command. You re-earn nothing — you only fix content.
- Hand off to a fresh QC session: re-run phase 3 as a fresh **`--incremental`** round
  (`qc-auto "<book>" --pass --incremental`). The repaired chapters re-review; the `[re-QC only]`
  chapters clear once the book-level finding is gone.
- Stop. Nothing ships until a clean full-book PASS in that fresh QC session.
