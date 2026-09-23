# S00 — Owner decisions walkthrough (interactive, ~20 min)

Run on: Sonnet 5 or Opus. Mode: interactive (I am present and will answer). Depends on: nothing. Blocks: S01 (D1, D7, D10), S05 (D5), S06 (D2, D3), S11 (D4, D6, D12, D13), S12 (D14). Re-run it (or edit DECISIONS.md) after S02 to fill D4.

---PROMPT---
You are helping me, the owner of ChapterFlow, record the decisions that the v25 pipeline execution plan needs. I am here and will answer questions. Do not change any code, git state, or pipeline data in this session.

First load these skills with the Skill tool: `superpowers:verification-before-completion`.

Read, in order: `~/cf-wt/v25-execution/CONTEXT.md`, `~/cf-wt/v25-execution/DECISIONS.md`, `~/cf-wt/v25-execution/README.md`, and every file in `~/cf-wt/v25-execution/status/`. For evidence behind each decision, open only the section you need in `~/cf-wt/v25-execution/assessment/reports/` (panel-analytics.md for D2/D3, downstream-readiness.md and verify-gates-downstream.md for D4/D5/D12/D14, open-ledger.md for D7 — note its option letters are swapped relative to D7, quota-defect.md for D9/D13). If `status/S02.md` exists, use its probe numbers for D4; otherwise tell me D4 waits for S02.

Then, for each decision D1–D14 in order (skip D11, which is fixed): explain it to me in plain language in three or four short sentences (what it controls, what each option costs or risks, the evidence number that matters most), give your recommendation, and ask me to choose with the AskUserQuestion tool (recommended option first, marked "(Recommended)"). Batch at most four related decisions per question round. Do not re-litigate a decision after I answer it.

After I answer, edit `~/cf-wt/v25-execution/DECISIONS.md`: fill each `CHOICE:` line with my answer and today's UTC date, add any number I give (for D4's bar), and set `ACCEPT_RECOMMENDED_DEFAULTS:` to what I tell you (ask me once at the end: "For any decision left blank, may sessions use the recommended option?"). Re-read the file after editing and show me the final CHOICE lines verbatim.

Finally write `~/cf-wt/v25-execution/status/S00.md` (first line `RESULT: DONE`) with the date, each decision and choice, and anything I asked to change in the plan. Done means: every CHOICE line I answered is filled, the file re-read matches, and S00.md exists.
---END---
