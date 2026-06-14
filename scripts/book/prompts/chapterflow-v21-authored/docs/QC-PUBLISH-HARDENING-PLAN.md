# Plan — Make v21 QC + publish flawless and one-prompt-operable

Goal (from owner): make the pipeline as close to flawless as a no-API design allows, and make
**QC + publish/finalize runnable by pasting ONE prompt into a fresh session.**

## Design principles
1. **The fresh session IS the trust boundary.** Don't fake cryptographic independence; make the
   operating model (QC in a session separate from authoring) the *enforced, recorded* contract.
2. **One verb, idempotent, self-navigating.** The session runs one command; it detects state and
   always prints the exact next command. No schema/hash/token archaeology.
3. **Loud failures, evidence-backed passes.** A pass leaves a trace; a fail is actionable; nothing
   silently downgrades to "looks fine".
4. **Additive & non-breaking.** Existing books (the-book-of-boundaries) and tests keep working;
   new strictness is back-compatible (warn-when-absent, enforce-when-present).
5. **Don't reinvent the strong parts.** `promoteBook` is already a robust multi-gate — lean on it.

## Workstream A — Correctness bug fixes (the "flawless" floor)
- **A1** Wire `shadowGuard()` into `runQcAuto` / `runQcOrchestrate` / `runQcDiagnose` so a
  dual-state-dir divergence can't silently pass QC. (cli.ts)
- **A2** Freshness integrity (cli.ts / orchestrator):
  - `checkRoundFreshness`: stop failing open. Missing `chapterContentHashes` ⇒ `fresh:false`
    (`reason: round predates freshness tracking`), and a selected chapter missing from the hash map
    ⇒ stale, not fresh.
  - Remove the `writeRoundHashesIfMissing` *current-content* backfill in finalize (it blesses
    already-edited content as the baseline). Hashes are recorded at round creation only.
  - `qc-orchestrate --finalize` honors freshness like `qc-auto` (refuse to attest a stale round).
- **A3** `isSemanticFinding`: recognize sweep families + axis names + manual_keyjudge/confirm via
  `repairClass` AND `globalTheme`, regardless of sourceRole — so finalizer/major copies of semantic
  findings can't be staled by a cosmetic edit. (orchestrator/index.ts)
- **A4** `loadBookChapters`: per-file try/catch; throw an error naming the offending chapter file
  instead of a path-less `SyntaxError`. (manualKeyJudge.ts)
- **A5** Major-disposition integrity: require waiver `--reviewer` to pass `isApprovedReviewer`;
  refuse to waive a blocker-severity finding (waivers are for majors only).
- **A6** `qc-auto` partial-run honesty: a `--chapters` subset reports "selected chapters PASS
  (subset — book not fully verified)", never the bare book-level "PASS"; always points to `publish`.

## Workstream B — Trust-model hardening (no API needed)
- **B1** Enforce approved-reviewer on submissions: `validateBar`/`validateConfirm` require `reviewer`
  to pass `isApprovedReviewer` (today only the legacy batch path checks). Closes "writer
  self-certifies under any string" on the orchestrator path.
- **B2** Author/reviewer provenance (additive, the biggest integrity win, enables the fresh-session
  guarantee):
  - Stamp `provenance.authorSessionId` onto chapters at generation/assembly, from
    `CHAPTERFLOW_SESSION_ID` (fallback: derived id). Excluded from the content hash (v2 exclude-list)
    so it never stales an attestation.
  - QC records the reviewer session id; `checkQcAttestation` (promote) refuses when
    `reviewerSessionId === authorSessionId`. Provenance absent (legacy books) ⇒ warn, don't block.
  - If this proves too invasive to land safely with tests, scope down to "record reviewer session id
    + warn on match" and document hard-enforcement as the immediate follow-up.

## Workstream C — One-prompt operability (the headline)
- **C1** `qc-review-packet <book> --round <id>` (and auto-emitted when a round has no submissions):
  per chapter, write a self-contained reviewer packet = reader-facing chapter content + the
  publishable-bar rubric (AXIS_RUBRIC) + sweep families + **pre-filled submission skeletons**
  (bar/confirm/sweep/keyA/keyB) with bookId/roundId/chapterId/contentHash/schemaVersion/role filled
  and the exact submit command. Reviewer only reads + fills scores/decisions/quotes + submits.
- **C2** `publish <book>` convenience = no-API QC precheck (`qc-status` all fresh-PUBLISHABLE) →
  `promote-book` with title/author auto-resolved from the manual brief / existing package, else a
  precise prompt. One verb to ship.
- **C3** Canonical session prompts (the deliverable):
  - `agent-prompts/QC-AND-PUBLISH-CODEX-SESSION.md` — paste into a fresh session; runs the loop end
    to end (packet → review → submit → finalize → interpret → publish on PASS), with the "you are the
    independent reviewer; you did not author this" framing.
  - `QC-AUTO-CODEX-SESSION.md` kept as the short pointer/alias.
- **C4** Every `qc-auto` terminal state prints the single exact next command.

## Workstream D — Hygiene
- **D1** `git add` the untracked `finalizerFindings.ts` + `diagnose.ts` (else origin CI fails
  TS2307). Add a scoped `.gitignore` for ephemeral QC run dirs only if they are meant to be
  ephemeral (verify first).
- **D2** Tests for the dangerous paths: freshness fail-open→closed, isSemanticFinding semantic
  preservation, approved-reviewer enforcement, partial-run labeling, shadowGuard wiring.

## Explicitly DEFERRED (honesty about "flawless")
- A funded model semantic judge — the real fix for self-reported corruption axes / factual_accuracy.
  The no-API substitute stays honor-bound; B1/B2 raise its cost + auditability, not its guarantee.
- Cross-book variety / name-exclusion gate (catalog sameness, 809 reused names) — generation-side.
- Per-book voice enforcement.

## Sequencing & verification
Branch off main → A (typecheck+tests) → B1+B2 (typecheck+tests) → C (smoke on the-book-of-boundaries)
→ D → full `npm test` + typecheck → commit. Never promote/publish a book as part of this work.
