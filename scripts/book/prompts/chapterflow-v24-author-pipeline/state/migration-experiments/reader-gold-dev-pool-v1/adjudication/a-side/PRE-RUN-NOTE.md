# A-side pre-run note (2026-07-15)

One spawn was aborted BEFORE producing any output, prior to the recorded run:
the initial launch went through a harness-limited background channel whose
10-minute cap could not cover the run; it was stopped within the first call
(~1 minute in), no last-message file existed, no output was consumed, and no
ledger entry was minted. The runner then gained resume-safety (retained
outputs consumed, never re-called) and was relaunched detached. The retained
ledger records the real campaign: 24 base calls, 0 infrastructure replays,
0 API calls. Budget: 24 base / 48 hard (pool selection manifest).
