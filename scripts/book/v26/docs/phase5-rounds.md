# Phase 5 — tuning rounds (Franklin ch01 + ch13; Bennett ch04 held out)

Each round: generate both chapters with the pipeline (`run --force`), run the BRIEF §4 blocking checks inside the run, then the calibrated eval (`eval`: blind Opus judge on 35 items, the deterministic items, and 3 no-chapter solver runs). One coherent prompt change between rounds.

| Round | Change before the round | ch01 judge | ch13 judge | No-chapter, right per run (ch01 / ch13) | Blocking after the run | Notes |
|---|---|---|---|---|---|---|
| baseline | W1 brief (story-first) | Y: 11/35 | proto: 5/35 | 5,5,5 / 4 | — | `docs/eval/baseline.json` |
| 1 | lesson-first brief (design.md) | **34/35** | **34/35** | 5,5,5 / 0,0,0 | none (both clean) | Only END-fastRead failed, in both chapters: a flat recap |
| 2 | tiers end by answering the opening question | 31/35 | **35/35** | 5,5,5 / 5,5,5 | none (both clean) | END fixed in both. ch01 sample lost PLAIN-summary, TRY, EX-ex03 and SPINE, all in fields the change did not touch (sample noise, plus the Folger digression) |
| 3 | quiz choices share one form and length | 34/35 | **35/35** | 5,5,5 / 5,5,5 | ch01: q5 second defensible choice; ch13: "a few pennies" for sixpence | Length tell gone: max/min choice-length ratio about 2.2 → 1.1, key-is-shortest 7/7 → 2/7 (ch01). The solver still guessed, so the lessons agree with common sense |

After round 3 the bar was still not met (no-chapter solver, the ch01 SPINE digression, late blocking leftovers), so design.md got **Revision 1**: three small changes. Round 4 tests it.
| 4 | Revision 1 (design.md): keep facts when simplifying; a second episode only for the same lesson; the last fix round goes after blocking issues first | **35/35** | **35/35** | 5,5,5 / 5,5,5 | ch01: q2 second defensible choice; ch13 clean | Folger digression gone. Held-out Bennett ch04 (first run): 31/35, clean. Its misses were END-fastRead and a side thread (the train-and-sovereign aside in q6, rc4 and SPINE) |

**Owner-proxy pass on round 4** (3 Opus readers × 3 chapters, each holding NOTES.md and the verdict; `~/cf-wt/v26-plan/scratch/W1c/owner-proxy-r4.json`): 9 of 9 said "accept with notes", none rejected. Three objections were evidence-backed and showed up in all three chapters, so they are brief defects rather than one-chapter slips:
1. **The key phrase was stamped about 20 times per chapter** ("check the method", "small daily fix", "inner day"), so it read like a worksheet. Cause: a brief rule told the writer to reuse it in examples, explanations, card backs and the plan. That rule is **deleted**.
2. **tryThisNow nearly repeated the 24-hour challenge**, and in ch01 assumed the reader was mid-shortcut. The brief now asks for an action any reader can do today, and a challenge that differs from it.
3. **Hard words survived in fullRead**, the tier new readers open on (R1-d = B): "mill-pond", and "sixpence" unexplained. The cold reader read only fastRead; it now reads both.

**Round 5** regenerates all three chapters with these final prompts. Bennett ch04 is still never tuned on: every change above is backed by the two Franklin chapters on their own. Then the pipeline's reader round (`fix --issues`) takes each chapter's evidence-backed, non-taste reader findings.
