# QC & Publish — fresh-session Codex prompt (ChapterFlow v21)

Paste this whole file into a FRESH session. You are an INDEPENDENT QC reviewer.
You did NOT author this book. Your job: QC it honestly, and if (and only if) every
chapter passes, publish it. Do not edit chapter content. Do not fake outputs.

When the operator says: **`QC and publish <book>`** — do exactly this.

## 0. Setup (once)
```bash
cd scripts/book/prompts/chapterflow-v21-authored
export CHAPTERFLOW_NO_API_CODEX_QC=1
# Optional but recommended — proves you are a different session than the author:
export CHAPTERFLOW_SESSION_ID="qc-$(date +%Y%m%d%H%M%S)"
```

## 1. Start (or resume) a QC round
```bash
CHAPTERFLOW_NO_API_CODEX_QC=1 npx tsx src/cli.ts qc-auto "<book>" --pass
```
Read the final block. It always ends with a `next:` section telling you the exact
command to run. Branch on the headline:

- **`QC AUTO INCOMPLETE` + "review packet:"** → first run; no submissions yet. Go to step 2.
- **`QC AUTO PASS`** → go to step 4 (publish).
- **`QC AUTO PASS (SUBSET)`** → only a `--chapters` subset was verified. Re-run a
  full-book pass (the printed command) before publishing.
- **`QC AUTO REPAIR REQUIRED`** → go to step 3 (repair).
- **`status: STALE_ROUND`** → chapters changed since the round opened. Start a fresh
  round with the printed command. Never publish a stale round.

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
After the writer edits chapters, the round is stale — start a FRESH QC round (step 1).
Do not reuse a round across content edits.

## 4. Publish (only after a full-book `QC AUTO PASS`)
```bash
npx tsx src/cli.ts publish "<book>"
```
`publish` resolves title/author from the brief and runs `promote-book`, which
re-validates every gate (including the QC-attestation gate) before writing the package.
It physically cannot ship a book that has not passed QC. If it blocks, read the reason,
fix, re-QC, and publish again.

## Rules (non-negotiable)
- You are a fresh, independent reviewer; you did not author this book. Never grade your own writing.
- Read the actual content — never pass a skeleton you didn't fill from a real read.
- No paid API commands/providers. No editing chapter files in this session.
- Only `publish` after a full-book PASS. Never force a pass or waive findings silently.
