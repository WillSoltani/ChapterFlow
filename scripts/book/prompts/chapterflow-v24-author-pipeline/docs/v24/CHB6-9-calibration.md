# CHB6–CHB9 calibration (v24 W3)

`src/critics/readerBudgets.ts` — four new book-level, cross-chapter, deterministic
reader-budget checks, backstopping the content residuals the published
`the-power-of-moments` v24 (POM) still shipped. W4's brief rotation is the
prevention lever; these are the write-time backstop.

## Enforcement rule (the standing zero-FP rule for new blockers)

A new check may be a **BLOCKER** only if it fires **zero** times against the
top-5 owner-scored packages (the quality reference — the zero-**false**-positive
corpus). Otherwise it ships **SHADOW (advisory)**: visible + committed, never
fail-closed, until the corpus itself clears. The check is validated to FIRE on
POM (design intent — POM's residuals are exactly what the NEXT book must not
ship).

Top-5 by `docs/book-score/baseline-2026-06-30.json` composite:
`games-people-play` (85.3), `crucial-conversations` (85.3), `atomic-habits`
(85.3), `thinking-in-bets` (85.2), `difficult-conversations` (84.9).

Calibration ran the **slim** repo-root `book-packages/*.v21.json` shape (plain
strings; no packets on disk → title-fallback for terms-of-art / case names).
Reproduce: `npx tsx scratch/chb-block.ts <ids…>` (kept in `scratch/`).

## Result → severity split

| check | top-5 firings | POM v24 | severity |
|-------|:--:|:--:|:--:|
| **CHB6.opener_class** | 5/5 (claim-opener corpus-wide) | — | **ADVISORY (shadow)** |
| **CHB7.scaffold_family** | **0/5** | **fires 7/12** | **BLOCKER** |
| **CHB7.phrase_spread** | **0/5** | 0 (below thr) | **BLOCKER** |
| **CHB8.shortest_band** | 5/5 | fires 51% | ADVISORY (shadow) |
| **CHB8.longest_band** | 5/5 | 0 (POM 4%) | ADVISORY (shadow) |
| **CHB8.echo_band** | 3/5 | fires 62% | ADVISORY (shadow) |
| **CHB8.case_stem_band** | 3/5 | fires 66% | ADVISORY (shadow) |
| **CHB9.option_menu** | 2/5 | fires 28% | ADVISORY (shadow) |
| **CHB9.quoted_script** | 3/5 | fires (0 ch) | ADVISORY (shadow) |

Only **CHB7** is zero-FP across the top-5, so **only CHB7 is a blocker**.
Everything else is corpus-wide (the monocultures the forensics measured are not
POM-specific — top owner-scored books carry them too), so it ships advisory.

### Per-book detail (severity:metric; `·` = clean; `a:` advisory, `B:` blocker)

```
book                     CHB6   CHB7fam CHB7phr CHB8sh CHB8lo CHB8ec CHB8st CHB9mn CHB9sc
games-people-play        a:9    ·       ·       a:10%  a:81%  a:67%  a:51%  a:16%  a:1ch
crucial-conversations    a:10   ·       ·       a:8%   a:86%  a:58%  ·      a:19%  ·
atomic-habits            a:17   ·       ·       a:3%   a:87%  ·      ·      ·      a:0ch
thinking-in-bets         a:7    ·       ·       a:13%  a:52%  ·      a:44%  ·      a:0ch
difficult-conversations  a:12   ·       ·       a:3%   a:91%  a:57%  a:40%  ·      ·
the-power-of-moments     ·      B:7/12  ·       a:51%  ·      a:62%  a:66%  a:28%  a:0ch
```

(CHB6 metric = # chapters the dominant class opens; CHB8 = % of questions;
CHB9mn = % of practice items; CHB9sc = # chapters carrying a quoted script,
firing when < 3.)

## POM v24 residual vs. the forensics (design-intent check)

The forensics (`scratchpad/aplus/content-residuals.md`) measured POM: 24h-challenge
skeleton 10/12, key-uniquely-shortest 51%, most-prose-echoed 63%, case-anchored
stems 43% (verbatim-4gram; case-**anchoring** was separately ~higher), menus 27%.
CHB6–9 reproduce these as budgets:

- **CHB7.scaffold_family = 7/12** on the `"in the next #"` family (cap
  ceil(1/3·12)=4). This is the exact churn driver the forensics named ("the
  next 24 hours" in 7 chapters). The other 3 of the 10-skeleton chapters open
  `"within # hours …"` → a *distinct* first-4-words family, so they don't add to
  this family's count; that is correct — CHB7 prices the literal stem a reader
  re-reads, and `within-` vs `in-the-next-` read as two stems. The wider
  `within # hours` family is caught on other books (see corpus scan below).
- **CHB8.shortest_band = 51%**, **echo_band = 62%**, **case_stem_band = 66%**,
  **CHB9.option_menu = 28%**, **CHB9.quoted_script = 0 chapters** — all fire,
  matching the forensics. `CHB8.longest_band` does *not* fire on POM (POM's
  overcorrection collapsed unique-longest to 4%) — which is why the band is
  symmetric: the shortest-band catches POM's inverted tell that the old
  longest-only metric missed.

## CHB7 blocker across the FULL 136-book corpus (true-positive audit)

`npx tsx scratch/chb7-corpus.ts` → CHB7 blocks **44/136** books. Spot-verified as
TRUE positives (pre-variety-fix scaffold monocultures, the same class CHB5
already prices):

- `deep-work` twentyFourHourChallenge = the IDENTICAL sentence
  `"Within the next day, choose one demanding task…"` in **9/9** chapters.
- `the-power-of-habit` = the `"In the next 24 hours,"` stem verbatim in **9/9**.
- `blue-ocean-strategy` `"within the next #"` 11/11; `what-every-body-is-saying`
  `"in the next #"` 10/10; `the-let-them-theory` `"in the next #"` 15/20; etc.

These are genuine repetition, not FPs — consistent with the CHB1–CHB5
precedent (deep-work's 18 CHB5 true positives). The zero-FP rule is
zero-FALSE-positive, and the top-5 owner-scored quality reference is clean.
Older shipped books legitimately carry the defect the check exists to price.
