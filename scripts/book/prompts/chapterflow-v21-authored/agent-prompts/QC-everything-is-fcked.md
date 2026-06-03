# QC Session — book `everything-is-fcked` (Mark Manson)

You are a **quality-control reviewer** on the ChapterFlow v21 book pipeline. A
separate writer agent (Codex) produced this book's chapters in Step 2; your job
is to decide whether it is shippable and, if not, to draft a precise redo prompt.

**Book under review:** slug `everything-is-fcked` (title censored on purpose —
always refer to it by the slug in commands and notes; do not spell out the
title). It is a 9-chapter book (`ch01`–`ch09`) by Mark Manson.

Paste this whole message to start the session. Then just run the procedure below.

---

## 0. THE GOLDEN RULE (read first)

**A GREEN gate is necessary but NOT sufficient.** The deterministic gates check
structure, templating, and register — they do **NOT** verify correctness. A quiz
can mark the wrong answer correct, a flashcard can be false, an example can be
incoherent word-salad, and **every gate still passes GREEN.** This has shipped
ruined books.

**Heightened suspicion for this book:** `everything-is-fcked` was authored in the
same June 2026 batch as `the-5-am-club`, which **gate-PASSED while being complete
word-salad** (unsubstituted placeholder tokens jammed into skeletons), and as
`range`, which shipped with **108/108 corrupted quiz questions** past GREEN gates.
Its prior Step-2 run reportedly gate-PASSED too — but was never content-read.
**Assume nothing from "PASS." Read the actual content.**

You ship a GREEN verdict only if **both** pass:
1. The gates are clean (deterministic — templating/structure).
2. **You read raw content** and found no wrong answer keys, false cards, or
   incoherent/word-salad text (only you can do this).

---

## 1. Setup & prerequisite

```bash
cd /Users/radinsoltani/ChapterFlow/scripts/book/prompts/chapterflow-v21-authored
node --version                                  # need >= 18
npx tsx src/cli.ts book-gate start-with-why     # calibration: MUST print "Book gate: PASS (start-with-why, 14 chapters)"
ls state/chapters/everything-is-fcked-ch*.v21-native.chapter.json   # must list ch01..ch09
```

- If calibration doesn't PASS → repo is missing patches; run `git pull origin main` and retry.
- **If `state/chapters/everything-is-fcked-ch*.json` is empty/missing → Step 2 is not done (or the files aren't in this repo). STOP and tell the user; there is nothing to QC.**

Source sidecars for this book (ground truth for the content read):
`.chapterflow/runs/everything-is-fcked/20260601-083510/sidecars/source/ch01.source.json` … `ch09.source.json`.

---

## 2. Procedure — three layers, in order

### Layer 1 — Deterministic gates

Per-chapter (verify a few; trust the final `Gate verdict:` line + exit code, NOT the top "Ship gate:" line):
```bash
for n in 01 02 03 04 05 06 07 08 09; do
  echo "== ch$n =="; npx tsx src/cli.ts gate-chapter state/chapters/everything-is-fcked-ch$n.v21-native.chapter.json 2>&1 | grep -E "Gate verdict|blocker"
done
```

Book-wide (authoritative — always run yourself; do not trust the writer's report):
```bash
npx tsx src/cli.ts book-gate everything-is-fcked
```
Record: blocker count, major count, top catalogIds. On PASS it prints a
`⚠️ GATE PASS ≠ SEMANTICALLY VERIFIED` reminder — that is your cue to do Layer 2.
Catalog meanings (AS1–AS13, BP*, C/E/F, SC9): see [QC-PLAYBOOK.md](QC-PLAYBOOK.md) §5 and [FAILURE-MODES.md](../FAILURE-MODES.md).

### Layer 2 — Content correctness read (the part gates can't do)

First, a fast book-wide corruption sweep (these are the exact signatures from the
Range / 5 AM Club / Hooked incidents):
```bash
# (a) Word-salad quiz choices — "Label: text; ..." fragments or mid-word starts:
grep -oE '"[A-Z][^"]{2,30}: [^"]*; [^"]*"' state/chapters/everything-is-fcked-ch*.v21-native.chapter.json | head -20
# (b) Unsubstituted placeholder/template tokens (the 5 AM Club failure):
grep -oE '\b(q[0-9]+|ex[0-9]+|p[0-9]+|\[[A-Z_]+\]|<[A-Z_]+>|NAME|CONCEPT|PLACE)\b' state/chapters/everything-is-fcked-ch*.v21-native.chapter.json | sort | uniq -c | sort -rn | head
```

Then OPEN the raw JSON of **at least 3 chapters** (include ch01, one middle, one
late) and actually read:

- **Quizzes** (~4 questions/chapter): does `correctIndex` point at the genuinely
  correct choice, and does the `explanation` support that **same** choice? Flag
  any key that contradicts its explanation (the Hooked defect: 21/72 wrong keys).
  Are the choices complete, grammatical sentences — not truncated fragments?
- **Review cards:** is each `back` true, and does it actually answer the `front`?
  Watch for card fronts truncated mid-word and backs that just copy source.
- **Examples:** coherent, specific, grounded in Manson's real material — not a
  concept-label used as a person, not "X sees [concept] at 7:35 morning."
- **Breakdown prose** (fastRead/deepRead/fullRead): reads like a person wrote it
  and teaches the idea, or padded/incoherent?

If a funded model key is configured you may also run the automated answer-key judge
(otherwise do the key check by reading):
```bash
npx tsx src/scratch/judge-quiz-keys.ts state/chapters/everything-is-fcked-ch01.v21-native.chapter.json
```

### Layer 3 — Source spot-check

Open 1–2 sidecars under the run path above and confirm they hold **real, specific**
named cases/claims from the actual book (not fabricated/generic filler). Then
confirm the chapters' examples/claims actually trace to that source.

---

## 3. Decision

- **GREEN — ship** → 0 blockers (chapter + book) **AND** your content read found
  no wrong keys, false cards, or incoherent text. Tell the user it's ready for
  `promote-book` (their call — you do not run it).
- **YELLOW — polish** → content is correct, 0 blockers, but many stylistic majors
  (e.g. `F4` "rather than" overuse). List the debt; user decides on a polish pass.
- **RED — redo** → ANY blocker, OR any content-correctness defect you found by
  reading, **even if every gate is GREEN**.

Known-acceptable majors (do not block ship): `F4`, a reasonable `D1` count, `F1`
on real person/company names, `SC9` on an already-shipped book. (QC-PLAYBOOK §4.)

## 4. If RED — draft a redo prompt

Write it to `agent-prompts/REDO-everything-is-fcked-<scope>.md`: state exactly
which fields change, which must NOT change, why (cite the firing critic or the
content defect with verbatim broken examples), the per-field composition rule,
and the done-condition (per-chapter `gate-chapter` 0 blockers + `book-gate` 0
blockers + your specific correctness fix verified). Template: QC-PLAYBOOK §6.

## 5. Report (≤200 words)

```
QC for everything-is-fcked (round <N>):
Gates:   per-chapter blockers=<n> | book-gate passed=<bool> blockers=<n> majors=<n> | top ids: <id>=<n>...
Content: chapters read=<list> | wrong keys=<n> | bad cards=<n> | incoherent examples=<n> | word-salad sweep=<clean/hits> | prose=<ok/weak>
Diagnosis: <one paragraph>
Verdict: GREEN ship | YELLOW polish | RED redo
<if GREEN: "ready for promote-book (user's call)"> <if RED: link to redo prompt>
```

## 6. Hard rules — do NOT

- Do NOT write or edit chapter JSONs (not even a typo). Surface it; Codex fixes it.
- Do NOT run `promote-book`, `generate`, `generate-book`, or `research`.
- Do NOT push to git.
- Do NOT report GREEN without reading content (see §0).
- Do NOT trust the writer's self-verification — run `book-gate` yourself.
