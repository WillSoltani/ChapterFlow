# Run a book end-to-end — four prompts (ChapterFlow v21)

A book ships in **four phases**. Each phase is **one prompt pasted into one FRESH
session**. Paste them in order; each phase tells you when it's done and which prompt
comes next. You never have to remember the step order.

> **Lost? Run `npx tsx src/cli.ts runbook <book>`** — it prints the book's current phase,
> the strict env, the exact next command, the prompt to open, and live warnings (source-verify
> state + token-cleanup reminder). Run it at the start of any session to orient.

| # | Phase | Paste this file | Say to the agent | It stops at |
|---|-------|-----------------|------------------|-------------|
| 1 | Research | `RESEARCH-CODEX-SESSION.md` | `Research the book <book>` | `phase: write-chapter` — index + every source sidecar exist AND `source-verify-check <book>` prints `PASS` (each named case/fact verified against a DISTINCT real source — not structurally valid, not rubber-stamped) |
| 2 | Write | `WRITE-ORCHESTRATE-CODEX-SESSION.md` | `Write the book <book>` | `phase: qc` — every chapter gate-clean + book-gate clean AND self-scored on the 8-axis publishable bar (`publishable-rubric`); gate-clean alone does NOT predict the QC verdict |
| 3 | QC | `QC-ORCHESTRATE-CODEX-SESSION.md` | `QC <book>` | `QC AUTO PASS` — every chapter PUBLISHABLE (copy the round id) |
| 4 | Commit + push + publish | `PUBLISH-AFTER-QC-CODEX-SESSION.md` | `Finalize and publish <book> from QC round <roundId>. Commit and push.` | package written, committed, pushed |

## What each phase does
1. **Research** — produces the frozen bibliography + per-chapter source-v2 sidecars + the
   chapter index. The grounded material everything is authored FROM. Stops at the write handoff.
2. **Write** — the orchestrator deals the pre-authoring plans (names, scene shapes, venues,
   pedagogy, exemplars, rhetoric, answer-key), dispatches **≤6 writer subagents at a time**
   (one chapter each from its own source, self-gating), runs the `book-gate` barrier, and
   re-dispatches only the chapters that fail. It never QCs or publishes; stops at `phase: qc`.
3. **QC** — the orchestrator opens a round and dispatches **≤6 reviewer subagents** (sweep →
   keyA+keyB → bar/chapter → confirm/candidate). The deterministic CLI collects + decides.
   It does **not** publish. On PASS it prints the round id + the exact phase-4 command. If it
   says **REPAIR REQUIRED**, the repair goes to a fresh *writer* session (`REPAIR-CODEX-SESSION.md`)
   and you re-QC — nothing ships until a clean full-book PASS.
4. **Finalize** — confirms the round still passes, promotes the book to a package, cleans up
   one-time QC artifacts, then **commits and pushes**. This is the **only** step that writes to
   git/remote — nothing auto-publishes or auto-pushes before it.

## Single-session fallbacks (no subagents)
If your harness can't spawn subagents, the sequential single-session prompts still work:
- `GENERATE-A-BOOK-CODEX-SESSION.md` (`Generate the book <book>`) does research **and** write
  in one status-driven loop, stopping at `phase: qc`.
- `QC-CODEX-SESSION.md` (`QC <book>`) does the whole QC round in one reviewer session.
Same trust boundaries, same stop points — just no fan-out.

## The rule that ties them together
Each phase is a **fresh, independent session**: research ≠ writer ≠ reviewer ≠ publisher.
The author must not grade its own work, and the publisher acts on a finished round, not its
own grading. Within the write and QC phases, a subagent does ONE unit and never crosses roles
(a writer never QCs; a reviewer never edits or certifies its own read).

## Strict production environment (recommended for every new book)
Export these so a thin / unverified / self-graded book fails BEFORE it can ship:
```bash
export CHAPTERFLOW_NO_API_CODEX_QC=1               # no-API operator QC mode
export CHAPTERFLOW_REQUIRE_SOURCE_VERIFY=1         # source REALITY required (an ABSENT record blocks, not just a bad one)
export CHAPTERFLOW_ENFORCE_SESSION_INDEPENDENCE=1  # the author session cannot QC its own chapter
```
With all three: source STRUCTURE (source-v2) **and** source REALITY (`source-verify-check`) are
required, QC is role-separated, attestations must be fresh, and the publish-after-qc preflight
hard-gates. A thin or unverified source fails at the research phase, before a word is written.

**Footgun — do NOT also `export CHAPTERFLOW_SESSION_ID` once for the whole run.** That id is what
distinguishes the author session from the reviewer session, so a single exported value makes
author == reviewer and `ENFORCE_SESSION_INDEPENDENCE=1` blocks **every** chapter ("the author
cannot grade its own work"). Set it FRESH per phase instead — e.g. `CHAPTERFLOW_SESSION_ID=author-<ts>`
for the write / `qc-stamp-author` step and `CHAPTERFLOW_SESSION_ID=qc-<ts>` for the QC session.
(The block is self-diagnosing — it says "Re-QC in a fresh session.")

Under enforcement the QC phase goes further: each reviewer SUBAGENT stamps its OWN id
(`qc-keyA-<ts>` ≠ `qc-keyB-<ts>`, `qc-bar-ch03-<ts>` ≠ `qc-confirm-ch03-<ts>` ≠ each tiebreak
variant, and none == the author id). `qc-submit` records it as the submission's `reviewerSessionId`,
and finalize blocks (self-diagnosing) if two roles share a session — that is how the fan-out is
PROVEN, not just claimed. See `QC-ORCHESTRATE-CODEX-SESSION.md`.

## Reasoning effort per role (GPT)
Set each session's GPT reasoning-effort/verbosity to match the role — the pipeline emits a
`[ROLE: … · reasoning: … · verbosity: …]` header on the fanout card and review packet, and
`npx tsx src/cli.ts roles` lists them. Rule of thumb: **high** reasoning for the writer,
researcher, and every QC reviewer (bar/confirm/keyA/keyB) + repair; **minimal** for the
write/QC orchestrators and publish (they run the CLI and read exit codes, not content).
The pipeline recommends; you set the actual session control. See `roles/README.md`.

## Structured output (GPT)
For the QC reviewer roles, bind the role's JSON Schema (`npx tsx src/cli.ts qc-schema <role>`)
as the subagent's GPT `response_format` so the submission is shape-valid by construction — no
FILL_ME round-trips. The CLI still re-checks the cross-field rules at `qc-submit`.

## If something goes sideways
- Phase 2 `book-gate` barrier keeps failing the SAME book-wide blocker for 3 re-dispatch
  rounds → it's a Step-1 source problem, not authoring. Stop and fix research (phase 1).
- Phase 3 says **NEEDS_MORE_QC** → a unit's submission is missing/stale; re-spawn ONLY that
  unit against the same round, then re-finalize. Never force a pass.
- Phase 3 says **STALE_ROUND** → chapters changed after the round opened. Start a fresh round.
- Phase 3 says **REPAIR REQUIRED** → open the printed repair prompt in a fresh *writer* session
  using **`REPAIR-CODEX-SESSION.md`** (edit only `[edit]` chapters, never `[re-QC only]`; treat
  CLASS DEFECT as class-level), then re-run phase 3 as a fresh **`--incremental`** round
  (only the changed chapters are re-reviewed; already-PUBLISHABLE chapters carry forward).
- Phase 4 dry-run **blocks** → it prints the failed check + a resume command. Fix and re-run;
  it physically cannot ship a book that hasn't passed QC.

## Changing a detector or gate? Run the gold-corpus regression first (maintainers)
A new check risks false positives on good books. Before you promote one, run the regression over
the real reference chapters and confirm it stays zero where it must:
```bash
npx tsx tests/run.ts corpus calibration enforced repetition label pronoun
```
This IS the gold-corpus regression (the calibration test subset). The promotion ladder + the
"never hard-block unless clean+gold zero and ≥2 true positives" rule live in
`docs/pipeline/FAILURE-CLASS-REGISTRY.md`.
