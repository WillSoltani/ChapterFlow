# Generate a Book — fresh-session Codex prompt (ChapterFlow v21)

Paste this whole file into a FRESH session. It drives a book from nothing to
"ready to QC" by reading one status command and doing exactly what it says, in a
loop. You never have to remember the step order.

When the operator says: **`Generate the book <book>`** (a title or a bookId) — do this.

## 0. Setup (once)
```bash
cd scripts/book/prompts/chapterflow-v21-authored
# Recommended: tag this authoring session id; at the qc handoff (step 2) you run
# `qc-stamp-author` so a later FRESH QC session can prove it didn't grade its own work.
export CHAPTERFLOW_SESSION_ID="author-$(date +%Y%m%d%H%M%S)"
```

## 1. Preflight (catch traps before they cost a run)
```bash
npx tsx src/cli.ts doctor <bookId>
```
Fix anything FATAL before continuing (shadow state dir, chapter-number drift,
untracked-but-imported source). Warnings are fine to proceed past.

## 2. The loop — ask the book where it is, do that, repeat
```bash
npx tsx src/cli.ts book-status "<book>"
```
Read the `phase:` and the `next:` block. It prints the single exact next command
for wherever the book is. Run it, produce the artifact it asks for, then re-run
`book-status`. Loop until `phase: qc` — then STOP: this session never QCs or
publishes (see Rules). Do NOT run the `qc-auto` command book-status prints at that
point; hand off to prompt 2.

What each phase means and what `next:` will point you at:
- **research-bibliography / research-chapter / chapter-index / write-chapter**
  → `next-task <bookId>` drives these; read the playbook it names (STEP-1-RESEARCH.md,
  STEP-2-WRITE-CHAPTERS.md), produce the JSON, save to the printed path.
- **generating** → keep writing chapters via `next-task`.
- **gating** → a chapter or the book gate has blockers; `next:` points at the exact
  `gate-chapter` / `book-gate` command. Fix the named fields and re-run. (Once every
  chapter exists but the brief/per-chapter plans aren't derived yet, book-status shows
  `phase: gating` with `next: book-gate <bookId>` — running that auto-derives the
  brief+plans for you, so just follow `next:`. There is no `derive-artifacts` phase.)
- **qc** → all chapters are gate-clean. First, if you exported `CHAPTERFLOW_SESSION_ID`
  in step 0, record this authoring session so QC can prove independence:
  `npx tsx src/cli.ts qc-stamp-author <bookId>`. Then hand off to the QC session
  (paste QC-CODEX-SESSION.md into a NEW session — QC must be independent). That's
  prompt 2 of 3; see RUN-A-BOOK.md for the full generate → QC → finalize flow.
- **ready to publish** → QC passed; a separate finalize session commits/pushes/publishes
  (PUBLISH-AFTER-QC-CODEX-SESSION.md). This session never publishes.

## 3. Before writing chapters — lay down the collision guardrails (once per book)
As soon as the chapter index exists (so the chapter count is known), generate the
pre-authoring sheet that keeps parallel authors from colliding on names and stock phrases:
```bash
npx tsx src/cli.ts authoring-guardrails <bookId>
```
Then, for EVERY chapter you write, paste `state/guardrails/<bookId>.guardrails.md`
into the authoring context: use ONLY your chapter's reserved-name row, and never use
the banned phrases (house tics, salting connectives, cross-book signature tells).
Names are American/Canadian and unique WITHIN this book; they may repeat in other
books — that's fine. This is the same prevention pattern as the voice bible — set it
before authoring, not in repair. The guardrails sheet is REQUIRED, not optional —
if `state/guardrails/<bookId>.guardrails.md` does not exist, generate it before
writing any chapter.

**Author ONE chapter at a time, each from ITS OWN source notes — never batch-write
all chapters from a shared scaffold.** The deadliest failure mode here (a hard
blocker: AS5–AS11, C12) is cross-chapter templating — writing the quiz
prompts/distractors/correct-answers, review cards, and examples as ONE skeleton
with a noun swapped per chapter (e.g. every chapter's answer is "Keep the reply
short, tied to ___"). Each chapter teaches a DIFFERENT move, so its quiz answers,
cards, and examples MUST be composed from THAT chapter's specific concept/hardEdge
— not adapted from a sibling or a template. The gate compares every chapter against
its siblings; if you reuse a sentence shape across chapters it WILL block. If you
catch yourself swapping a word into a reused shape, stop and rewrite from the source.

## Rules
- Let `book-status`'s `next:` line decide the next step — don't guess the order —
  EXCEPT at `phase: qc`: do NOT run the printed `qc-auto` command here; stop and hand
  off to prompt 2 (the author never grades its own work).
- One chapter author = one reserved-name row. Never reuse a name across CHAPTERS of the same book; names MAY repeat across different books — that's fine.
- Author each chapter from its OWN source, one at a time, with the guardrails sheet pasted in. NEVER batch-write all chapters from a shared scaffold, and never make a quiz answer / card / example a skeleton with one noun swapped per chapter — that is cross-chapter templating, and AS5–AS11 will block the whole book.
- Do not QC or publish in THIS session — QC must run in a separate fresh session
  (the author never grades its own work). Stop at `phase: qc` and hand off to prompt 2.
- No editing chapters to dodge a gate; fix the real field and re-run the gate.
