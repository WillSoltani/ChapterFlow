# Revise psycho-cybernetics ch04 — fix the misspelled name "Alder" → "Adler"

A **one-name factual fix in ch04 only.** Nothing else changes. This is **not** a templating or
key issue — round-2 QC attested ch04's examples, keys, distractors, and the 4-picture relaxation set
as good. The single blocker is a misspelled proper name.

## The defect
The bad-at-mathematics anecdote in ch04 is the real story of the psychologist **Alfred Adler** (as
boy, judged hopeless at math, then solved a problem the class/teacher could not, which broke the
"no good at math" belief — exactly the dehypnotize-a-false-belief point of the chapter). Both the
chapter and its source sidecar spell it **"Dr. Alder"** — a corruption of **Adler**. A reader who
knows Adler sees a clear error, and "Dr. Alder" loses the identification with the famous individual
psychologist.

This originated in the **Step-1 source**, so fix BOTH files or it will regress on any re-derive.

## What you change (exactly these two files)
1. **Chapter:** `state/chapters/psycho-cybernetics-ch04.v21-native.chapter.json` — 4 occurrences
   (breakdown deepRead, example ex01, example ex01 again, quiz q09). Lines ~12, ~31, ~33, ~256.
2. **Source sidecar:** `.chapterflow/runs/psycho-cybernetics/20260605-123749/sidecars/source/ch04.source.json`
   — 4 occurrences (`namedExamples` label + summary, two `testableFacts`). Lines ~24, ~28, ~86, ~98.

## The rule
- Spell the name **Adler**, never "Alder".
- Make the **first** mention in the chapter breakdown read **"Alfred Adler"** so the reader identifies
  the psychologist; later mentions may be **"Adler"** or **"Adler's"**. (Mechanically: `Dr. Alder` →
  `Alfred Adler` at the first breakdown mention; every other `Alder` → `Adler`, preserving the
  possessive `'s`.) In the source sidecar, `"Dr. Alder and mathematics"` → `"Alfred Adler and
  mathematics"` and the rest `Adler`.
- Do **not** alter the surrounding sentences, the lesson, the quiz key/choices, or any other field.

## What you do NOT change
- ch04 `quiz.questions[].correctIndex` (all 9 verified correct) or any choice text beyond the name token.
- Every other field in ch04, and **every other chapter** (ch01–03, ch05–15 are attested PASS — do not touch them).

## Done condition
- `grep -c "Alder" state/chapters/psycho-cybernetics-ch04.v21-native.chapter.json` → **0**.
- `grep -c "Alder" .chapterflow/runs/psycho-cybernetics/20260605-123749/sidecars/source/ch04.source.json` → **0**
  (run this one from the repo root).
- First chapter mention reads "Alfred Adler"; later mentions "Adler".
- `npx tsx src/cli.ts gate-chapter state/chapters/psycho-cybernetics-ch04.v21-native.chapter.json` → 0 blockers.
- `npx tsx src/cli.ts book-gate psycho-cybernetics` → still PASS, 0 blockers.
- Editing ch04 marks its attestation **STALE** (expected). It must be **re-QC'd / re-attested** (just
  ch04) before `promote-book`. The other 14 attestations are unaffected. Do **not** run `promote-book`.

Report back: the 0/0 grep counts and the ch04 gate-chapter blocker count.
