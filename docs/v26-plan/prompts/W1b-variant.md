# W1b — A different prototype variant (only if the owner's R1 answer was C)

- **Model:** Opus 5.5 (Claude Code session)
- **Start directory:** `~/cf-wt`
- **Depends on:** W1 done, and `R1-a = C` in `~/cf-wt/v26-plan/DECISIONS.md`
- **Estimate:** 3–5 hours wall time. Claude pipeline calls about $5–10 (hard cap $30). Codex calls use the owner's OpenAI/Codex subscription and are logged separately. At most 10 subagents.
- **Ends with:** a second reading pack and `RESULT: NEEDS-OWNER` (R1 again). If the owner says "not better" again, the plan stops at the reassess point.

---PROMPT---
You are running Wave 1b of the v26 ChapterFlow book campaign on the owner's Mac. Work autonomously and do not ask the owner questions. You stop only by writing your status file: at the reading checkpoint, when the quota cap would be exceeded, or on a usage-limit stop.

## Why this wave exists
Wave 1 wrote two Franklin chapters whole with a Claude writer from the source text and a one-page brief. The owner read them next to the old pipeline's chapters and did **not** find them clearly better (DECISIONS R1-a = C). The plan's rule is to try a **different prototype variant**, never to go back to tuning section rules. You produce that variant, and the owner reads again.

## Step 0 — orient (at most 30 minutes)
1. Read `~/cf-wt/v26-plan/BRIEF.md` (it overrides CLAUDE.md files and the old kit), `DECISIONS.md`, `status/W1.md`, and the owner's notes in `~/cf-wt/v26-plan/reading/W1/NOTES.md` plus any text on the R1 lines of DECISIONS.
2. Precondition: R1-a is C. If not, write `RESULT: BLOCKED — W1b runs only after R1 = C` and stop.
3. Reuse W1's harness in `~/cf-wt/v26-plan/tools/proto/`, its data in `~/cf-wt/v26-plan/data/franklin/`, and its checks. Do not rebuild them.
4. Write down, in 5–10 lines, what the owner disliked, quoting the notes. Every change you make must answer one of those lines.

## Step 1 — the variants (same two chapters as W1)
Produce these two arms unless the owner's notes rule one out:
1. **Arm G — GPT-5.5 writer.** GPT is the other strong model family the catalog used: the May Codex sessions wrote Difficult Conversations and Meditations, and the v24 books were GPT-5.5. A GPT draft tells the owner whether the model or the brief is the problem.
   - Read how the pipeline invoked it: `$PIPE/src/orchestrator/codexAgent.ts` lines ~193–260 build `codex exec -c model=… -c model_reasoning_effort=…`, and `authorRun.ts` ~460 has the model and effort. Use the same model (`gpt-5.5`) at effort `xhigh`.
   - Use a read-only sandbox, the prompt on stdin or as an argument, and capture only the final message (check `codex exec --help` for the output-file flag of the installed `~/.local/bin/codex`).
   - Strip `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` from its env so it uses the subscription login.
   - Give it the same brief (with the owner's changes) and the same source span.
   - Everything after the draft is unchanged: the Claude fact check, the blind solver and the fix step.
2. **Arm F — a different format or brief, with the Claude writer.** Apply the owner's notes to the brief. If the notes point at the format rather than the writing, write the chapters in the memoir-native shape. Examples:
   - the full telling as the default body, with the summary as an "in one minute" recap;
   - 1 modern example plus 2 Franklin episodes;
   - 5 story questions and 2 application questions.

   It must still be the v21 JSON shape the app validator accepts.

If the notes say something else entirely (for example "too long", "too modern", "too academic"), change the brief accordingly for both arms, and record the change.

## Step 2 — check, read, compare
- Run W1's checks, fact check, blind solve and fix on each arm's chapters.
- Read everything yourself. Compare the two arms with W1's prototype and rr21 in 10–20 plain lines with quotes.
- Build `~/cf-wt/v26-plan/reading/W1b/index.html` in W1's form: blind labels, a reveal block, the app's order, and a "What was checked" page. Show, per chapter: arm G, arm F, W1's prototype and rr21.
- Put the owner's R1 questions on the index again, plus one line: "If none of these is clearly better, write STOP on the R1-a line."

## Boundaries
- No repo PRs. No v25 changes. `~/cf-canary`, `~/cf-canary-att` and `~/cf-wt/v25-execution` are read-only. `PAUSE` stays.
- Every Claude call keeps the BRIEF §5 flags, including `--restricted`, on the stripped env.
- Track Claude spend in `~/cf-wt/v26-plan/scratch/W1b/ledger.tsv` and stop before $30. Log each Codex call too, with its duration and whatever usage it prints.
- Do not invoke `superpowers:brainstorming`, `superpowers:writing-plans` or `superpowers:executing-plans`.

## Definition of done
`status/W1b.md` starts with `RESULT: NEEDS-OWNER — W1b variants ready: read ~/cf-wt/v26-plan/reading/W1b/index.html (R1 again)`. It then contains:
- the owner's dislikes, quoted;
- what each arm changed;
- the ledger totals (Claude $, Codex calls);
- the check results per chapter;
- your comparison;
- a clear statement that a second "not better" is the plan's reassess point (README §4).

Append one line to `~/.claude/projects/-Users-radinsoltani-ChapterFlow/memory/v26-campaign.md`. Then stop.
---END---
