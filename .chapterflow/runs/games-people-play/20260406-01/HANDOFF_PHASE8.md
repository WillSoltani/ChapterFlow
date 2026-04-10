# Handoff Prompt — Games People Play, Phase 8 + Phase 9 (Release Gate and Build)

Copy everything below into a fresh Claude Code session. Paste it as the first message.

---

## CONTEXT

You are completing a ChapterFlow book-generation run for **Games People Play by Eric Berne**. All ten chapters have been produced, validated at 12/12, and user-approved. All ten hashes are locked in `continuity/continuity-state.json`. The run is now at the release gate.

This is an **execution task, not a planning task**. Do not switch into planning behavior. Do not give a plan unless explicitly asked. Start working immediately.

**Working directory:** `/Users/willsoltani/dev/chapterflow-siliconx`
**Run root:** `.chapterflow/runs/games-people-play/20260406-01`
**Book:** Games People Play by Eric Berne, First edition (Grove Press, 1964)
**Run profile:** `balanced_flagship`
**Output profile:** `flagship_v4_compatible`
**Pack version:** `v12-sealed`

---

## STATE OF THE RUN (read this carefully)

### All 10 chapters are complete and hash-locked

| Ch | Title | Hash (SHA-256) |
|----|-------|---------------|
| Ch1 | The Three Voices Inside You | e3f0370a785ab4c34c22f826bc793b4c288145415013f3d13d787549ca59f98a |
| Ch2 | What a Transaction Is and Why They Go Wrong | 95f5236bb50fa9c02587ebde9d916e312d1d605c323d51e69c6f45d5a87e9cd9 |
| Ch3 | Ulterior Transactions and the Anatomy of a Game | 73f56dbf93c45f42094907e5408d650a087eeae53451cfb4ba31e37f31228ba6 |
| Ch4 | Why Games Feel So Hard to Stop | 6b80fd5be5e2cf03bd05c29b214964b263310777ee142b7ce29a246d3e370cba |
| Ch5 | Life Games | 36537f1cba9eac7eb0e6c20865f622f6e32de2cbe9f1bca377b7fe2e3ef51561 |
| Ch6 | Marital Games | 9ff46ea45e5225472b88c16c691e27f8490a86ffd6e2d6e9f17d600a6ca273dc |
| Ch7 | Party and Social Games | 30487f553783a1cfa55e62c545998be52412e1eb7debbc551697e7ea72019dbc |
| Ch8 | Professional and Therapy-Room Games | 905c2e3a70278151be23028e7c11ccfa1015a3fc17888b6dba7be851e9dce926 |
| Ch9 | Games That Aren't Worth Fighting | 8c932cbbf9b59d2274c5761a6d04e3dc2fadf8d4f7c0e8253fa96d45e485637c |
| Ch10 | What Comes After Games | 19b9676429aa94580799ac25a994c8bcf693033b7ae6492fd2500c45e725b161 |

All hashes are stored in `.chapterflow/runs/games-people-play/20260406-01/continuity/continuity-state.json → approvedChapterHashes`.

### Validated files (source of truth for release assembly)
```
.chapterflow/runs/games-people-play/20260406-01/validated/ch01.chapter.json
.chapterflow/runs/games-people-play/20260406-01/validated/ch02.chapter.json
.chapterflow/runs/games-people-play/20260406-01/validated/ch03.chapter.json
.chapterflow/runs/games-people-play/20260406-01/validated/ch04.chapter.json
.chapterflow/runs/games-people-play/20260406-01/validated/ch05.chapter.json
.chapterflow/runs/games-people-play/20260406-01/validated/ch06.chapter.json
.chapterflow/runs/games-people-play/20260406-01/validated/ch07.chapter.json
.chapterflow/runs/games-people-play/20260406-01/validated/ch08.chapter.json
.chapterflow/runs/games-people-play/20260406-01/validated/ch09.chapter.json
.chapterflow/runs/games-people-play/20260406-01/validated/ch10.chapter.json
```

### Release directory
`.chapterflow/runs/games-people-play/20260406-01/release/` exists and may already contain files from a prior attempt. Do not reuse any prior files; assemble fresh from the validated/ files.

---

## YOUR TASK

### Phase 8 — Release gate

#### Step 1: Assemble the release package

Write the release file at:
`.chapterflow/runs/games-people-play/20260406-01/release/games-people-play.modern.json`

**Use Python via Bash to assemble it.** Load each `validated/chNN.chapter.json` in order ch01 through ch10 and wrap in this envelope:

```json
{
  "schemaVersion": "1.1.0",
  "packageId": "<new uuid4>",
  "createdAt": "<iso timestamp, e.g. 2026-04-09T00:00:00Z>",
  "contentOwner": "ChapterFlow",
  "book": {
    "bookId": "games-people-play",
    "title": "Games People Play",
    "author": "Eric Berne",
    "edition": "First edition (Grove Press, 1964)"
  },
  "chapters": [ /* ch01 through ch10 validated chapter objects in order */ ]
}
```

**Critical constraint:** `releaseAssembleFromValidatedOnly: true` — do not regenerate or modify any chapter content. Load directly from `validated/chNN.chapter.json` files and insert as-is into the `chapters` array.

#### Step 2: Hash integrity check

Re-compute the SHA-256 of each validated chapter file and confirm it matches the table above. Use Python:

```python
import json, hashlib

run_root = '.chapterflow/runs/games-people-play/20260406-01'
cs = json.load(open(f'{run_root}/continuity/continuity-state.json'))

for ch_id, info in cs['approvedChapterHashes'].items():
    path = f'{run_root}/validated/{ch_id}.chapter.json'
    sha = hashlib.sha256(open(path, 'rb').read()).hexdigest()
    match = sha == info['sha256']
    print(f'{ch_id}: {"OK" if match else "DRIFT DETECTED"} — {sha[:16]}...')
```

If any hash has drifted from the locked value, **stop and investigate before proceeding**. Do not assemble the release with drifted hashes.

#### Step 3: Check for release-gate tooling

```bash
ls scripts/book/prompts/chapterflow-v12-sealed/tools/ 2>/dev/null || echo "v12 tools not present"
```

The v12-sealed pack directory does not exist in this repo. If tooling is not present, skip to the repo validator in Phase 9.

#### Step 4: Write release validation reports

Write two files:
- `.chapterflow/runs/games-people-play/20260406-01/reports/release-validation.md` — record hash check results, assembly method, chapter count, schema version, packageId
- `.chapterflow/runs/games-people-play/20260406-01/reports/release-audit.md` — record that `releaseAssembleFromValidatedOnly` was honored, that `preserveApprovedChapterHashes` was verified, that no chapter content was modified during assembly

#### Step 5: Update the run log

Append Phase 8 completion to `.chapterflow/runs/games-people-play/20260406-01/reports/run-log.md`.

---

### Phase 9 — Wire into repo and build

#### Step 1: Copy release file into book-packages

```bash
cp .chapterflow/runs/games-people-play/20260406-01/release/games-people-play.modern.json book-packages/games-people-play.modern.json
```

#### Step 2: Run the repo validator

```bash
node scripts/book/validate-book.mjs book-packages/games-people-play.modern.json
```

Require **zero errors**. Common failures and how to fix them:

- **Word counts outside bands (140–175 / 330–420 / 490–600):** Find the specific chapter and depth in the validated JSON. Fix the word count by adding or removing words from the breakdown text, being careful not to change meaning or introduce banned phrases/em dashes. Re-copy to `validated/chNN.chapter.json`, recompute its SHA-256, update `continuity-state.json`, re-assemble the release package, and re-copy.
- **Missing or wrong-shaped tone objects:** Fix in the validated chapter JSON, re-copy, re-assemble.
- **Wrong example/ending/review-card counts:** Fix in the validated chapter JSON, re-copy, re-assemble.
- **TypeScript type mismatch on a field ChapterFlow schema allows:** Flag it and ask the user before modifying anything.

#### Step 3: Run v12 lint if available

```bash
python3 scripts/book/prompts/chapterflow-v12-sealed/tools/chapterflow_v12_lint.py book-packages/games-people-play.modern.json release_gate 2>/dev/null || echo "v12 lint tool not available, continuing"
```

#### Step 4: Build

```bash
npm run build
```

All must pass. If the build fails on a field the ChapterFlow schema allows but the repo TypeScript types do not recognize, flag it and ask the user.

#### Step 5: Update the run log

Append Phase 9 completion to `reports/run-log.md`.

---

## NON-NEGOTIABLE RULES

### Content integrity rules

1. **Do not regenerate any chapter content.** The chapters are hash-locked. If you need to fix a word count, change only the specific text that is out of range. Do not rewrite surrounding prose. Do not change any structural field that was not causing the validation failure.

2. **After any modification to a validated chapter file, recompute its SHA-256 and update `continuity-state.json → approvedChapterHashes`.** The hash in continuity-state.json is the ground truth. If you modify a file and do not update the hash, the integrity chain is broken.

3. **Assemble from `validated/` only.** Never assemble from `structured/` or `drafts/`. The `validated/` files are the only source of truth for the release.

4. **`releaseAssembleFromValidatedOnly: true` is a manifest-level constraint.** Honoring it is required for the release audit report to pass.

### Process rules

5. **Use Python via Bash for all JSON assembly.** Do not attempt to build the release package through multiple Edit tool calls. Build the full dict in Python, dump with `json.dump(indent=2, ensure_ascii=False)`, verify it parses, and verify chapter count.

6. **Always use absolute paths** from the repo root `/Users/willsoltani/dev/chapterflow-siliconx`.

7. **Update the run log after each phase.** The log at `.chapterflow/runs/games-people-play/20260406-01/reports/run-log.md` is the source of truth for what has happened.

8. **If the build fails after 3 repair attempts on the same issue, stop and ask the user.** Do not keep iterating on the same fix without making progress.

### Quality escalation

9. **If the validator reports a word count failure for a specific chapter and tone:** fix the minimum number of words needed to pass (add/remove words from the start or end of a breakdown paragraph, checking that no banned phrases or em dashes are introduced). Recompute hash. Re-assemble. Re-validate. Do not re-generate.

10. **If the build fails on a TypeScript type the ChapterFlow schema allows:** do not modify the chapter content to remove the field. Flag it and ask the user to decide whether to update the TypeScript type or drop the field.

---

## FIRST CONCRETE STEPS

1. Confirm all validated files exist:
   ```bash
   ls .chapterflow/runs/games-people-play/20260406-01/validated/ch*.chapter.json
   ```
   You should see ch01 through ch10.

2. Run the hash integrity check (Python script above). All 10 must return OK.

3. Assemble the release package at `.chapterflow/runs/games-people-play/20260406-01/release/games-people-play.modern.json`. Use Python. Verify the output has 10 chapters.

4. Write `reports/release-validation.md` and `reports/release-audit.md`.

5. Update the run log.

6. Copy to `book-packages/games-people-play.modern.json`.

7. Run `node scripts/book/validate-book.mjs book-packages/games-people-play.modern.json`. Fix any failures.

8. Run `npm run build`. Fix any failures.

9. Update the run log with Phase 9 completion.

Begin now.
