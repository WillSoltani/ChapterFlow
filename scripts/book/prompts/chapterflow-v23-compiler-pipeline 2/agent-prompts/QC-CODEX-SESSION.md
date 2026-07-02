# QC — fresh-session Codex prompt (ChapterFlow v21)

Paste this whole file into a FRESH session. You are an INDEPENDENT QC reviewer.
You did NOT author this book. Your job: QC it honestly until every chapter passes.
You do **not** publish — when QC passes you hand off to the finalize prompt
(`PUBLISH-AFTER-QC-CODEX-SESSION.md`) in a new session. Do not edit chapter content.
Do not fake outputs.

This is the **QC phase** — the single-session fallback for the orchestrated
`QC-ORCHESTRATE-CODEX-SESSION.md` (see `RUN-A-BOOK.md`): … → **QC** → publish.

When the operator says: **`QC <book>`** — do exactly this.

## 0. Setup (once)
```bash
cd scripts/book/prompts/chapterflow-v21-authored
# Strict production gates (set for every NEW book; carried from research/write).
export CHAPTERFLOW_NO_API_CODEX_QC=1
export CHAPTERFLOW_REQUIRE_SOURCE_VERIFY=1
export CHAPTERFLOW_ENFORCE_SESSION_INDEPENDENCE=1
# Proves you are a different session than the author (FRESH per phase — never one global id):
export CHAPTERFLOW_SESSION_ID="qc-$(date +%Y%m%d%H%M%S)"
```

## 1. Start (or resume) a QC round
```bash
CHAPTERFLOW_NO_API_CODEX_QC=1 npx tsx src/cli.ts qc-auto "<book>" --pass
```
Read the final block and branch on the headline; it always prints the exact command
to run next — labeled `next:` on a PASS, or `rerun or resume:` / `Start a fresh QC
round:` / `After repair, run:` on the other outcomes. Run that printed command.

- **`QC AUTO INCOMPLETE` + a "review packet (" line** → first run; no submissions yet. Go to step 2.
- **`QC AUTO PASS`** → done. Go to step 4 (hand off to finalize).
- **`QC AUTO PASS (SUBSET)`** → only a `--chapters` subset was verified. Re-run a
  full-book pass (the printed command) before handing off.
- **`QC AUTO REPAIR REQUIRED`** → go to step 3 (repair).
- **`status: STALE_ROUND`** → chapters changed since the round opened. Start a fresh
  round with the printed command. Never hand off a stale round.

## 2. Review every chapter, then submit (the actual QC work)
Open the **REVIEW-PACKET.md** path the run printed. It contains, for the whole book:
the chapter content + the publishable-bar rubric (in the referenced bar-pack), and,
for each QC role, the exact `qc-submit` command plus a JSON skeleton.

For each role, READ the content and fill the skeleton **honestly**:
- **sweep** — check the 4 cross-chapter templating families; `verdict` PASS only if none fire.
- **keyA / keyB** — derive each quiz answer yourself from the prompt + choices + source
  facts, BEFORE looking at any stored key. keyA and keyB are TWO independent derivations.
- **bar** (per chapter) — score each axis 0..1 from your read; any axis < 0.6 REQUIRES a
  cited hit (a verbatim quote + the defect). GREEN = weighted overall ≥ 85 AND no axis < 0.6.
- **craft** (per chapter — the CRAFT READ, F6b) — score the five craft axes 0..1:
  `summaries_depth`, `tone_register`, `transfer_design`, `idea_density`, `limits_honesty`
  (the ~64 rubric points the bar has no axis for). GREEN = weighted overall ≥ 75 AND every
  axis ≥ 0.6; the craft bar has NO corruption tier. Any axis < 0.6 REQUIRES a cited hit
  `{unitId, quote, defect, fix}`. Score `tone_register` against the book's VOICE CARD (in the
  packet). Full anchors: `agent-prompts/CRAFT-READ-RUBRIC.md`. Submit `qc-craft-read-v1` with
  the round's **craft** token. MODE `CHAPTERFLOW_CRAFT_READ`: default **shadow** (recorded +
  surfaced, NEVER changes a verdict — score honestly to calibrate the enforce floors); in
  **enforce** a below-floor chapter becomes REVISE with your hits as surgical repair directives;
  in **off** the craft read does not run. Never edit, finalize, attest, or publish.
- **confirm** (per chapter, only those listed in `confirm-candidates.json` after finalize) —
  a SECOND read; use a DIFFERENT `reviewer` id than the bar read.

Every skeleton field is a placeholder (`null` score, `FILL_ME` verdict, empty reason)
that FAILS validation until you replace it. Write each filled skeleton to a file and run
its `qc-submit` command. Use an approved reviewer id (prefix `codex-qc:`). Then resume:
```bash
CHAPTERFLOW_NO_API_CODEX_QC=1 npx tsx src/cli.ts qc-auto "<book>" --pass --round <roundId>
```

## 3. If REPAIR REQUIRED
QC found real defects. Open the printed **repair prompt** and paste it into a fresh
**Writer** session (not this one). Before a second repair loop, inspect:
```bash
npx tsx src/cli.ts qc-diagnose "<book>" --round <roundId>
```
`qc-diagnose` also surfaces any major a content-only repair can never clear (a true
false positive). Only a reviewer — never the writer — may disposition one, with the
gated `major-disposition … --status waived_false_positive` command it prints. Fix or
recalibrate first; waive only a confirmed FP.

After the writer edits chapters, the round is stale — start a FRESH QC round (step 1).
Do not reuse a round across content edits.

## 4. On a full-book `QC AUTO PASS` — hand off to finalize (do NOT publish here)
QC passing does **not** publish or push anything. Stop here and report to the operator:
- the **round id** (`round: r…` in the PASS block),
- `qc-status: PASS (all chapters fresh + PUBLISHABLE)`.

Then tell them to open a NEW session and paste `PUBLISH-AFTER-QC-CODEX-SESSION.md`
(prompt 3) with:
```text
Finalize and publish <book> from QC round <roundId>. Commit and push.
```
The PASS block already prints the exact `publish-after-qc … --dry-run` command and the
round id — copy them into the handoff.

## Rules (non-negotiable)
- You are a fresh, independent reviewer; you did not author this book. Never grade your own writing.
- Read the actual content — never pass a skeleton you didn't fill from a real read.
- No paid API commands/providers. No editing chapter files in this session.
- Never force a pass or waive findings silently. Do NOT publish or push — that is prompt 3.
