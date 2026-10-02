# Judge calibration against the owner's labels (W1c Phase 2)

Labels: 17 owner judgments from `reading/W1/NOTES.md`, all ch01: X = rr21 (7, all fail), Y = W1 prototype (6: 4 fail, 2 pass: examples, practice), Z = Q08 (4, all fail). `labels.json` maps each to an eval item.
Calibration set: X + Z (11). Held out: Y (6), scored only after the judge prompt was fixed. The ch13 versions have no owner labels and are a baseline only.

| Run | Judge prompt | X+Z (calibration) | Y (held out) |
|---|---|---|---|
| calib-v1 | `judge-v1.md` (untuned) | 11/11 | 6/6 |
| calib-v1-rep2 (identical repeat) | `judge-v1.md` | 10/11 (X TRY flipped to pass: "concrete … though it opens with a retelling") | 6/6 |
| calib-v2 | `judge.md` (TRY tightened: an action with a retelling or moral attached fails) | 11/11, X re-run 7/7 | **6/6** |

- The only tuning change came from a calibration-set disagreement (X TRY), and Y has no TRY label, so the held-out check is clean.
- Discrimination: the judge passes Y's examples (3/3) and practice, as the owner did, and fails Y's quiz (1/7) and cards (1/5). It is not a fail-everything judge. On ch13 it generalizes: the prototype's quiz is 1/7 and its cards 0/5, the same story-recall failure.
- Stability: between identical runs 7 of 125 item verdicts flipped (≈5%), mostly borderline EXFIT items in Z.
- Robustness: one v2 run on Z returned a degenerate 5-item JSON (a `"OPENER-wait"` placeholder). The runner now checks that every expected item id is present and retries once.
- No-chapter solver (Sonnet 5, q1–q5 only, no chapter): **5/5 on X, Y, Z and rr21-ch13; 4/5 on proto-ch13 and q08-ch13.** Every old quiz is guessable without reading, which confirms the quiz problem from a second direction.
- Readability (Flesch–Kincaid): X/Z summaries already sit at grade 5–8, yet the owner called their words hard. FK misses archaic vocabulary ("tallow-chandler", "freehold", "tithe son" — the judge's PLAIN evidence), so plainness is a judge item and FK is a reported band (summary 5.0–8.5; rest ≤ 8.5).
- Cost of Phase 2: see `scratch/W1c/ledger.tsv` (eval:* rows).
