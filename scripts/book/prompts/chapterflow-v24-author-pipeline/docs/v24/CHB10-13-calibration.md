# CHB10–CHB13 calibration (S-tier D-lane) — 2026-07-03

Method identical to the CHB6–9 calibration: measure the checks over real corpus
poles, enforce (blocker) only where the required-pass set is zero-false-positive
with headroom, ship heuristics as permanent advisories. All numbers measured
through the same tokenizer/surface the shipped code uses (`fullReaderSurface` +
`saturationTokens` in readerBudgets.ts — the calibration is surface-pinned; see
the SURFACE NOTE in the source).

## Required-pass set (top-5 owner-scored, 84.9–85.3)

games-people-play · crucial-conversations · atomic-habits · thinking-in-bets ·
difficult-conversations. Must-fail pole: the halted `execution` bytes
(acceptance 74.7/74.2, churn HIGH ×6 reader verdicts).

## CHB10.lexical_saturation — BLOCKER at band>6 or any word >24/ch; ADVISORY at band>3

Band word = per-chapter density ≥12 AND chapter spread ≥85%.

| book | band words | hottest (density/ch) |
| --- | --- | --- |
| games-people-play | 0 | whether 8.6 |
| crucial-conversations | 0 | meaning 10.2 |
| atomic-habits | 1 | habit 17.1 |
| thinking-in-bets | 2 | evidence 20.6 |
| difficult-conversations | 2 | conversation 14.6 |
| **execution (halted)** | **10** | **review 27.3** |

Headroom: band 2 vs blocker 6 (3×); word 20.6 vs 24 (17%). Title/framework
concepts legitimately run 14–21/ch — the discriminator is the COUNT of saturated
words, not the hottest word's existence. Catalog scan (135 packages): 24 books
exceed band>3 (hence the advisory tier there), clustered on the known-templated
execution-genre regen candidates: playing-to-win 13, extreme-ownership 10,
measure-what-matters 9, the-12-week-year 9, noise 8. Only the genre-worst exceed
the blocker line. Live-fired through `checkReaderBudgets`: execution → BLOCKER
(10 band words, 1 over ceiling); all top-5 → zero CHB10 findings.

## CHB12.strawman_rate — BLOCKER at >7% book-wide

Strawman = distractor matching the tone-giveaway lexicon
(announce/slides/deck/polish/morale/optics/louder/inspir\*/motivat\*/…) while its
key does not share the family (the key-shares exception absorbs legitimate
teach-against-the-move questions — atomic-habits' anti-motivation material).

| book | rate |
| --- | --- |
| difficult-conversations | 0.5% |
| games-people-play | 1.7% |
| crucial-conversations | 2.2% |
| atomic-habits | 3.8% |
| thinking-in-bets | 4.8% |
| **execution (halted)** | **12.3%** |

Headroom: 4.8% vs 7% cap (45%); execution fails at 1.75× the cap. Catalog:
9/135 books exceed 7%. Live-fired: execution → BLOCKER; top-5 → zero findings.

## CHB11.scene_class — ADVISORY (permanent, heuristic)

Actor-opener classifier (scenario begins on a bare capitalized name). execution:
76% (41/54). But crucial-conversations measures 97% — the named-actor scene is a
HOUSE pattern across the corpus, so this can never be a blocker; it exists to
feed the churn-evidence pack and to watch the P2 dramaturgy deal work.

## CHB13.practice_verb_family — ADVISORY (permanent, heuristic)

First-imperative-verb family across practice fields, cap ceil(N/3). execution:
"open" 5/9, "spend" 6/9 (true tics). True positive on atomic-habits: "pick"
18/20 — the documented "Pick…" house tic. Subordinate/temporal clause-leads
("When…", "Within the next 24 hours…", "Once you sit down…") are skipped whole —
the first calibration pass mis-fired on "once/within/tonight" as verbs.

## Enforcement-tier rule (standing)

A blocker tier here survives only while the required-pass set is clean through
the SHIPPED code path. If any future required-pass book fires CHB10/CHB12 at
blocker level and reading the flagged text shows a false positive, demote the
tier in readerBudgets.ts and record it here — never widen a threshold silently.
