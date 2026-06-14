# Generate a Book — fresh-session Codex prompt (ChapterFlow v21)

Paste this whole file into a FRESH session. It drives a book from nothing to
"ready to QC" by reading one status command and doing exactly what it says, in a
loop. You never have to remember the step order.

When the operator says: **`Generate the book <book>`** (a title or a bookId) — do this.

## 0. Setup (once)
```bash
cd scripts/book/prompts/chapterflow-v21-authored
# Recommended: stamp this authoring session so a later FRESH QC session can prove
# it didn't grade its own work.
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
`book-status`. Loop until `phase: ready to publish`.

What each phase means and what `next:` will point you at:
- **research-bibliography / research-chapter / chapter-index / write-chapter / derive-artifacts**
  → `next-task <bookId>` drives these; read the playbook it names (STEP-1-RESEARCH.md,
  STEP-2-WRITE-CHAPTERS.md), produce the JSON, save to the printed path.
- **generating** → keep writing chapters via `next-task`.
- **gating** → a chapter or the book gate has blockers; `next:` points at the exact
  `gate-chapter` / `book-gate` command. Fix the named fields and re-run.
- **qc** → all chapters are gate-clean; hand off to the QC + publish session
  (paste QC-AND-PUBLISH-CODEX-SESSION.md into a NEW session — QC must be independent).
- **ready to publish** → QC passed; the QC session runs `publish`.

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
before authoring, not in repair.

## Rules
- Always let `book-status`'s `next:` line decide the next step — don't guess the order.
- One chapter author = one reserved-name row. Never reuse a name across CHAPTERS of the same book; names MAY repeat across different books — that's fine.
- Do not QC or publish in THIS session — QC must run in a separate fresh session
  (the author never grades its own work). Stop at `phase: qc` and hand off.
- No editing chapters to dodge a gate; fix the real field and re-run the gate.
