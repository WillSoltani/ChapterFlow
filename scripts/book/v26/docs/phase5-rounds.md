# Phase 5 — tuning rounds (Franklin ch01 + ch13; Bennett ch04 held out)

Each round: generate both chapters with the pipeline (`run --force`), run the BRIEF §4 blocking checks inside the run, then the calibrated eval (`eval`: blind Opus judge on 35 items, the deterministic items, and 3 no-chapter solver runs). One coherent prompt change between rounds.

| Round | Change before the round | ch01 judge | ch13 judge | No-chapter, right per run (ch01 / ch13) | Blocking after the run | Notes |
|---|---|---|---|---|---|---|
| baseline | W1 brief (story-first) | Y: 11/35 | proto: 5/35 | 5,5,5 / 4 | — | `docs/eval/baseline.json` |
| 1 | lesson-first brief (design.md) | **34/35** | **34/35** | 5,5,5 / 0,0,0 | none (both clean) | Only END-fastRead failed, in both chapters: a flat recap |
| 2 | tiers end by answering the opening question | 31/35 | **35/35** | 5,5,5 / 5,5,5 | none (both clean) | END fixed in both. ch01 sample lost PLAIN-summary, TRY, EX-ex03 and SPINE, all in fields the change did not touch (sample noise, plus the Folger digression) |
| 3 | quiz choices share one form and length | 34/35 | **35/35** | 5,5,5 / 5,5,5 | ch01: q5 second defensible choice; ch13: "a few pennies" for sixpence | Length tell gone: max/min choice-length ratio about 2.2 → 1.1, key-is-shortest 7/7 → 2/7 (ch01). The solver still guessed, so the lessons agree with common sense |

After round 3 the bar was still not met (no-chapter solver, the ch01 SPINE digression, late blocking leftovers), so design.md got **Revision 1**: three small changes. Round 4 tests it.
