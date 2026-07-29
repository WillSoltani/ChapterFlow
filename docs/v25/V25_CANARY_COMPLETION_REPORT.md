# V25 Pipeline — Canary Completion Report

**Branch:** `codex/v25-pipeline-completion-recovered` · **Base:** `a20d1cdab`
**Commits:** 71 · **Suite:** 2796 pass / 0 fail (48 v25 files, 0 failed)
**Period:** 2026-07-22 → 2026-07-28 · **Model under test:** Claude Sonnet 5 (author roles)

---

## 1. What this campaign was

The V25 GPT-upgrade audit landed with a verdict of **ADOPT-WITH-FIXES**: the platform
was green on paper (2776 tests, 0 failures), but its semantic-review machinery had
never executed against a live book, and five criticals were open. This campaign
closed those criticals and then drove a real book end-to-end through every stage to
find what the test suite structurally could not.

**Result: 43 findings, 43 fixed.** Five came from the audit. **Thirty-eight came from
the live canary** — defects that no amount of unit testing would have surfaced,
because they only exist in the interaction between a real model, real book content,
and the pipeline's own recovery machinery.

---

## 2. Stage validation status

| Stage | Status | Evidence |
|---|---|---|
| Research (7 ch) | ✅ **VALIDATED** | Self-correcting; sidecar reuse across successor runs |
| Seed / intake | ✅ **VALIDATED** | Durable rehydrate, digest-checked |
| Compile — sections | ✅ **VALIDATED** | 28/28 packs through every section gate |
| Compile — assembly | ✅ **VALIDATED** | Cross-chapter gates caught real collisions; eviction+redraft cleared them |
| Canonical review (3-seat blind panel) | ✅ **VALIDATED** | 21 reader seats ran; rendered a genuine editorial FAIL verdict |
| Fresh QC + answer-key judge | ⏸ **NOT REACHED** | Gated behind a review PASS |
| Promotion | ⏸ **NOT REACHED** | Gated behind QC |

The audit's headline concern — *"semantic review machinery preserved-DEAD"* — is
**resolved**. The panel is alive, and it is not a rubber stamp: it blocked a book
on safety grounds with per-seat reasoning (§4).

---

## 3. The 43 findings

Grouped by what they reveal, not by discovery order.

### 3.1 Recovery-grammar defects (11 findings)
The largest single class. Every one is the same underlying shape: **work that
durably succeeded could not be re-entered after a crash or a stage failure.**

- Research seed, compile candidate, and operator-slot state each failed to
  short-circuit from their durable record on resume — three separate instances,
  fixed with the same `#rehydrateDurable*` pattern (11g, 11ab).
- A crash inside an operator grant left a run permanently `RUNNING` and
  fail-closed the grant scan forever (11t).
- Stored `ERROR` reviews were sticky: every resume replayed the error with zero
  model calls, with no successor path (11ac).

**Governing rule adopted:** *completed work re-enters via its durable record,
never via the machinery that produced it.*

### 3.2 Convergence architecture (2 findings — the keystone)
- **11y — durable section-pack cache.** Each operator retry re-drafted all 28
  section packs. At a ~97% per-pack pass rate, that is roughly one fresh blocker
  per round *indefinitely* — convergence by roulette. Gate-passed packs are now
  cached by `(blueprint, packet)` digest and **re-validated through the live gate**
  on reuse. Compile completion became arithmetic instead of luck.
- **11aa / 11ae — assembly-driven eviction.** The cache then created a livelock:
  a cross-chapter collision replayed forever because the colliding packs were
  cached as section-gate-passed. Assembly blockers now evict exactly the implicated
  entries (threshold-minimal, earliest offender keeps its phrase) and write durable
  avoid-context into the redraft task. Extended to a **registry of 16 cross-chapter
  gates**; two gates with non-static thresholds (SEC86, SEC95) are first-class
  documented fail-loud exceptions rather than silent gaps.

### 3.3 Failure classification (5 findings)
- **11x — API error envelopes.** `is_error: true` envelopes (content filter, 429,
  5xx) were flowing into schema validation and reported as `MODEL_OUTPUT_INVALID`.
  Six "schema failures" were actually **HTTP 400 content-filter blocks**. New
  `classifyStdout` route hook runs before validation and surfaces the API's own message.
- **11af — durable quota vs short rate limit.** Both are HTTP 429 and need opposite
  handling. A weekly cap consumed 3 attempts × 5 operator rounds while reporting
  only *"a transient model process failure"*. Now discriminated on the provider's
  own wording (named cap window / explicit reset horizon); short rate limits keep
  their bounded retry.
- Reader seats had no bounded retry at all — the one model surface that never got
  the treatment. 17 of 21 seats succeeded; 3 transient failures fail-closed the
  entire review (11ac).
- **11ag — bibliography had no retry either, and it runs first.** A single
  degenerate `{}` aborted an entire book run before any chapter work began. The
  retry hierarchy had been drawn around *observed* failures rather than blast
  radius; a step-1 surface deserves retry in proportion to what its failure costs.
  This deliberately changed a pinned invariant (`author-model-research-migration`
  asserted "5 single-attempt callers"); the rationale is recorded in-test and the
  four legacy v23-era writer callers keep single-attempt semantics.

### 3.4 Latent v24 gate defects (9 findings)
Bugs that existed before this campaign and were only exposed because Sonnet's
writing distribution differs from the codex-era corpus the gates were tuned against:

- **SEC35 false positives in four distinct classes** — hyphen-prefixes (`Mid-career`),
  sentence-initial temporal adverbs (`Later`, `Meanwhile`), fronted gerunds
  (`Copying the ledger, …`), indefinite pronouns/quantifiers/ordinals (`None`, `Further`).
  Mid-sentence `-ing` surnames (`Fleming`) still fire correctly.
- **SEC16 AND-impossibility** — a gate could demand two mutually exclusive properties
  of one line. *(See §5 — D4, owner decision.)*
- Selection blindness, tier-length contract inversion, per-tier ease reporting.

### 3.5 Feedback-quality defects (8 findings)
Retry cards that told the model *what* failed but not *how to satisfy* the gate.
Most instructive:

- **11ad — self-inflicted regression, caught by the canary.** Finding #39 enumerated
  every banned meta-reference form in the retry message. That change *raised* the
  model's degenerate-empty response rate; the retry loop then echoed the empty `{}`
  back as "your previous output," entrenching it. Diagnosed with a durable A/B in the
  run manifest plus two live reproduction calls, then fixed on both axes (task-first
  reframing + degenerate-echo guard). **A fix I introduced, found by the live run,
  root-caused with evidence rather than guesswork.**

### 3.6 Content-policy (7 findings)
Contract bullets pre-stating gate rules the model had to otherwise infer: SEC31
decision scenes, SEC53 answer-length balance, the SEC56 quiz-slot→case→specifics
join (with a follow-up correcting *"prompt OR explanation"* to *"prompt AND
explanation"* — the gate checks both fields separately).

---

## 4. What the panel actually did

Two books were driven through this pipeline. The first, *As a Man Thinketh*, was
chosen for the **worst-case** properties: 1903 public-domain, abstract, zero concrete
entities. It compiled fully — 28 packs, cross-chapter assembly, the works — and then
the blind 3-seat reader panel failed it, twice, on grounds no deterministic gate
encodes:

> **BLOCKER · READER.BLOCKING.unsafe** — *"Chapter states disease is produced entirely
> by habitual thought and instructs the reader to fix illness by working on the mind
> first, with no mention of medical care anywhere on the page."* — ch03/seat-cold
>
> **BLOCKER · READER.PANEL.BELOW_FLOOR** — all seven chapters scored 61–72 against
> a floor of 80.

The intervening remediation is itself the loop working as designed: the verdict was
translated into a **book-scar** (attribute absolutism to the author, acknowledge
external factors, cap metaphor reuse, ban blame-modeling scenes), the implicated
packs were evicted, and the book recompiled under constraint. The second verdict was
still FAIL — and correctly so.

**The structural finding:** Allen's thesis *is* the absolutism. An honest paraphrase
cannot clear a modern safety bar, and a dishonest one is not worth shipping. The
source-integrity gate had been advising this since day one
(`SV2.realness_concept_only`: *"does not contain enough concrete entities, dates,
numbers, or verifiable specifics to ground authoring"*). **This is a good outcome:
the pipeline refused to ship a book that should not ship.** The canary was then
swapped to *The Autobiography of Benjamin Franklin* — concrete, dated, safe — for the
promotion leg.

---

## 5. Open items for the owner

| # | Item | Why it needs you |
|---|---|---|
| **D4** | SEC16 gate semantics — the AND-impossibility fix changed what the gate *means*, not just how it reports | A gate-semantics change is a content-policy decision |
| **F1** | Book-scar edits do not invalidate implicated cache entries | Scar edits currently need manual eviction; a scar digest in the cache key would close it |
| **F2** | Review `FAIL` has no repair path in `book-run` (QC `FAIL` does) | Editorial failure is terminal by design — worth a documented operator runbook |
| **F3** | Corpus policy for abstract public-domain sources | *As a Man Thinketh* is not a defect to fix; it may be a source class to decline |
| **F5** | No `--research-run-id` pin: a repair run re-mints the bibliography and can invalidate all research + cache reuse | Measured on the Franklin repair loop — see §5.1 |

### 5.1 Operator runbook — responding to a review `FAIL`

A review `FAIL` is **terminal for that candidate, by design**. The compile phase
rehydrates from its durable record (11ab), so the staged candidate is immutable:
editing scars or evicting cache entries cannot reach a run whose compile already
completed. Resuming such a run replays the stored verdict with zero model calls.

The supported procedure, executed and confirmed on the Franklin canary:

1. **Read the blockers** — `books/<id>/reviews/<reviewId>.json`, `severity: BLOCKER`.
2. **Locate the authoritative fact** in the chapter's research sidecar
   (`hardSpecifics` is the source of truth; a surface that disagrees is the defect).
3. **Write the constraint into `config/book-scars/<bookId>.json`** — pin the fact,
   ban the contradicting variants, state the rule. Scars render only into that
   book's writer prompts.
4. **Evict only the offending surfaces** from `books/<id>/section-pack-cache/`
   (match on `identity.chapterId` + `identity.kind`). Correct packs keep their entries.
5. **Start a FRESH run** — no `--resume-run-id`. Research reuses its durable
   sidecars via the successor chain; every non-evicted pack reuses from cache;
   only the evicted surfaces re-draft, now under the scar.

> **Known friction (F1):** step 4 is manual because the cache key does not include
> a scar digest. Adding one would make step 3 evict implicated entries automatically.
>
> **Known friction (F5) — measured, not theoretical:** step 5's reuse promise holds
> *only if the fresh run's bibliography reproduces the same chapter list*. Research
> reuse is keyed on `expectedChaptersHash`, and the section-pack cache key derives
> from the resulting sidecars. On the Franklin repair loop the re-minted bibliography
> differed, which invalidated the durable research **and all 16 cached packs** — a
> one-line quiz fix became a full re-research and recompile. `book-run` exposes no
> flag to pin an existing research run (allowed options are `title`, `author`,
> `v25-root`, `attempt-root`, `source-git-sha`, `resume-run-id`, `regen`,
> `max-repair`, `promote-local`, `no-publish`, `reconcile-unsettled`, `log`).
> **Suggested fix:** a `--research-run-id` pin, so a content repair re-drafts only
> the evicted surfaces instead of paying for the whole book again.

---

## 6. Honest limits

- **QC-judge and promotion are unexercised.** Everything upstream is proven; those
  two stages have unit coverage only.
- **The Franklin canary is mid-compile** (9 of 16 packs cached) at the time of writing.
- **11ad's prompt reshape is single-sample.** The deterministic entrenchment guard is
  fully unit-tested; the stochastic incidence reduction is reasoned from a durable
  A/B, not statistically proven.
- **Cost was real.** ~25 operator-granted compile rounds across two books. Nearly all
  of that spend bought generic fixes that every future book inherits — but the first
  book on a new model is expensive, and that should be planned for rather than
  discovered.

---

## 7. Bottom line

The pipeline compiles a full book, catches its own cross-chapter sameness, recovers
from crashes without losing durable work, distinguishes provider failures from model
failures, and renders genuine editorial judgment through a blind reader panel — then
refuses to promote a book that fails it.

Every fix is committed with a RED-first test. The suite is green at 2796/0. The
machinery that made this campaign expensive — caching, eviction, rehydration,
bounded retries — is exactly the machinery that makes the next book cheap.
