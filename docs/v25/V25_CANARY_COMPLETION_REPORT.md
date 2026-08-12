# V25 Pipeline — Canary Completion Report

**Branch:** `codex/v25-pipeline-completion-recovered` · **Base:** `a20d1cdab`
**Commits:** 78 · **Suite:** 2804 pass / 0 fail (48 v25 files, 0 failed)
**Period:** 2026-07-22 → 2026-07-28 · **Model under test:** Claude Sonnet 5 (author roles)

---

## 1. What this campaign was

The V25 GPT-upgrade audit landed with a verdict of **ADOPT-WITH-FIXES**: the platform
was green on paper (2776 tests, 0 failures), but its semantic-review machinery had
never executed against a live book, and five criticals were open. This campaign
closed those criticals and then drove a real book end-to-end through every stage to
find what the test suite structurally could not.

**Result: 45 findings, 45 fixed.** Five came from the audit. **Thirty-eight came from
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
| Fresh QC + answer-key judge | 🧪 **PROVEN HERMETICALLY** | Never run live. A 12-case end-to-end test now drives the real evaluator, real judge, real round-commit and real promotion in one flow; it found 2 defects while being written |
| Promotion | 🧪 **PROVEN HERMETICALLY** | Same test. **3 criticals still block a first LIVE promotion — see §8** |

The audit's headline concern — *"semantic review machinery preserved-DEAD"* — is
**resolved**. The panel is alive, and it is not a rubber stamp: it blocked a book
on safety grounds with per-seat reasoning (§4).

---

## 3. The 45 findings

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

### 3.7 Cross-pack derivability (finding 45 — the one that gated everything)

Each section pack is drafted **independently from the same source packet**, so the
learning writer saw every allowed fact rather than the subset the summary writer
actually put in front of the reader. Every pack passed its own gates; the violation
only existed *between* packs. The panel caught it on every chapter:

> *"Quiz stems and review cards name specific facts ('Dr. Thomas Bond,' 'Pennsylvania
> Assembly,' '1751') that never appear anywhere in the Fast/Deep/Full read prose,
> breaking the quiz's own derivable-from-the-prose promise."*

**11ai** fixed it on two sides: the learning writer now receives the chapter's
*actual drafted prose* (available because summary drafts first) with an explicit
derivability rule, and a conservative deterministic gate (`SEC120`) backstops it,
no-opping when prose is absent. Both sides normalise through one shared helper so
writer and gate cannot drift.

**Measured on the same book, same panel, before vs after:**

| Blocker class | Before | After |
|---|---|---|
| `structurally_invalid` (derivability) | **9** | **0** |
| `internal_contradiction` | 3 | 2 |
| `unsafe` | 0 | 1 |
| `READER.PANEL.BELOW_FLOOR` | 4 | 4 |
| **Total** | **16** | **7** |

The targeted class went to zero. Review still returns FAIL on the **score axis**
(§6), which no gate can close.

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
| ~~**F1**~~ | **SAFETY HALF RESOLVED 2026-08-04** — a scar edit can no longer be served packs drafted without it. The efficiency half is open: invalidation is book-wide, not per-implicated-pack. See §5.1 | Only affects cost, not correctness |
| **F6** | **CORRECTION (2026-08-03): no scar reached a writer prompt during this campaign.** Resolved — see §5.3 | The remediation narrative in §4 needs reading with that in mind |
| **F2** | Review `FAIL` has no repair path in `book-run` (QC `FAIL` does) | Editorial failure is terminal by design — worth a documented operator runbook |
| **F3** | Corpus policy for abstract public-domain sources | *As a Man Thinketh* is not a defect to fix; it may be a source class to decline |
| ~~**D6**~~ | **RESOLVED 2026-07-29 — chapter bar calibrated 80 → 70.** Decided on evidence from the product's own 140-book screening of the live catalogue, not on preference. See §5.2 | Reversible in one constant; `CHAPTERFLOW_CHAPTER_BAR` also overrides it per-run |
| ~~**F5**~~ | **RESOLVED — `--research-run-id` pin shipped on `book-run` / `book-autopilot`.** A content repair now adopts an exact research run: zero research model calls, every non-evicted pack reuses. See §5.1 | Operator-facing: the pin is opt-in, fails closed, and cannot be combined with `--resume-run-id` |

### 5.3 F6 — CORRECTION: the scar channel was never wired to production

Recorded 2026-08-03, after the campaign. **No book-scar reached a writer prompt at
any point during this campaign**, so §4's account of the *As a Man Thinketh*
remediation — verdict translated into a scar, packs evicted, book recompiled
"under constraint" — is not supported. The recompile happened; the constraint did
not reach the writer. Whatever changed between those two verdicts, it was not the
scar.

Three independent faults, each sufficient on its own:

1. **No caller.** `loadBookScars` had zero production callers. The sole production
   writer of `inputs/compiler-section-task-context.json` hardcoded `bookScars: null`.
   The compiler already validated and rendered the field — only the data was absent.
2. **Wrong channel.** `phrases`, `frames` and `notes` all render under
   *"KNOWN OVER-USED MATERIAL … each item may appear in at most one teaching unit
   book-wide; paraphrase the mechanism everywhere else."* Every safety verdict from
   the Allen panel was filed in `notes`, and its banned absolutist wordings
   (`"no exceptions"`, `"always traces back to"`) in `phrases` — so had the wiring
   existed, the block would have granted each banned phrase one permitted use and
   asked the model to paraphrase the rest.
3. **Unreachable filename.** The Franklin file was `autobiography-of-benjamin-franklin.json`
   while the pipeline derives `the-autobiography-of-benjamin-franklin`. A missing
   scar file is a legitimate no-op for most books, so this produced no signal at all.

All three are fixed. `prohibitions` is a new channel rendering before the over-use
block as absolute rules with no quota; the seeder now loads the book's scars; the
Franklin file is renamed and a near-miss filename fails loud. The Allen safety
verdicts and the Franklin fact pins were moved into `prohibitions`, and the two
blockers from §6 were added there.

**This is why F5 mattered more than it looked.** The pin exists to make the
scar → evict → fresh-run loop cheap. With scars inert, that loop had nothing to
apply, and F5 would have been optimising a no-op.

Making scars live forced F1's safety half in the same change. `buildSectionTaskMarkdown`
— the only thing that renders a scar — sits inside the `!reusedFromCache` guard, and
`cachedSectionPackIsReusable` re-runs the section gate, which by design never sees
scars. So without a scar digest in the cache identity, adding a panel-blocker rule and
running the repair loop would have hit cache on every pack, built no prompt, applied
nothing, and reported green: a silent safety bypass on precisely the path the rule was
written for. `SectionPackCacheKey.scarsDigest` closes it — compared in `identityMatches`
rather than baked into `entryFileName`, so books with no scar file keep every cached
entry and a pre-field entry reads as `null`, which is what it was drafted under.

### 5.2 D6 resolved — the chapter bar is 70, calibrated to the shipped catalogue

The 140-book content-design screening of the **live** catalogue
(`docs/v25/chapterflow-140-evaluation`, rubric v2.0, 140 books / 1,903 chapters)
bands shipped books like this:

| Band | n | Range |
|---|---|---|
| Reference-standard | 1 | 90.1 |
| Strong | 88 | 80.0 – 89.7 |
| **Valuable but uneven** | **46** | **70.0 – 79.9** ← ships today |
| Substantial redesign | 3 | 64.1 – 69.0 |
| Gate failure | 2 | 48.1 – 58.1 |

**70.0 is ChapterFlow's own boundary between "valuable, ships" and "needs
substantial redesign."** A bar of 80 required every chapter to reach the *top*
band — a level only 64% of whole books reach, and fewer chapters do, since
chapter scores disperse around the book mean (a median-81 book carries chapters
in the 70s). Held at 80, the panel rejected **100% of candidates**, including
chapters better than a quarter of the live catalogue, and blocked QC and
promotion outright. A gate that never passes carries no signal.

At 70 the gate discriminates instead: on the Franklin canary it admits
72.3 / 73.2 / 77.4 and still fails 66.3, which genuinely sits in the redesign band.

**This moves the soft quality threshold only.** Safety, factual contradiction,
on-page derivability, schema, source fidelity, quote integrity and key soundness
are enforced independently and still fail closed at any score — pinned by the
adjacent test asserting a keyed-wrong chapter fails at composite 85.

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
   book's writer prompts. Safety verdicts and fact pins go in **`prohibitions`**,
   never in `phrases`/`frames`/`notes`: those render under an over-use header that
   grants a quota of one and tells the writer to paraphrase the item everywhere
   else. `<bookId>` is the slug the pipeline derives from the TITLE (article
   included, e.g. `the-autobiography-of-benjamin-franklin`); a near-miss filename
   now fails loud rather than loading nothing.
4. **Evict only the offending surfaces** from `books/<id>/section-pack-cache/`
   (match on `identity.chapterId` + `identity.kind`). Correct packs keep their entries.
5. **Start a FRESH run with `--research-run-id <id>`** — never `--resume-run-id`.
   Take `<id>` from the failing run's research `COMPLETED` event
   (`researchRunId=…` in `book-run-events/<bookId>.jsonl`). Research adopts that
   exact bundle with **zero model calls**; every non-evicted pack reuses from
   cache; only the evicted surfaces re-draft, now under the scar.

> **F1 — safety half resolved 2026-08-04.** Step 4 is no longer required for
> CORRECTNESS: the section-pack cache identity now carries a `scarsDigest`, so
> editing a scar invalidates that book's cached packs and they re-draft under the
> new rule. Step 4 remains worth doing for COST, because invalidation is book-wide
> rather than per-implicated-pack — a one-line scar edit currently re-drafts every
> pack for that book.
>
> The schema-version bump this note originally warned about was avoided: the digest
> is compared in `identityMatches`, not folded into `entryFileName`, so no entry is
> orphaned by its path changing. Books with no scar file are untouched — their
> digest is `null`, which is exactly what a pre-field entry reads as.
>
> **Still open:** narrowing invalidation to the implicated `(chapterId, kind)` pairs,
> which is the part that would make a scar edit as cheap as `--research-run-id` made
> the research half.

#### F5 — RESOLVED: `--research-run-id`

**What was actually broken.** Two things, and the second was the blocker:

1. The re-minted bibliography could differ, invalidating `expectedChaptersHash`
   and therefore the durable research and all 16 cached packs. Measured on the
   Franklin repair loop: a one-line quiz fix became a full re-research and recompile.
2. **More decisively, a fresh `book-run` could not reuse research at all**, whatever
   the bibliography did. `researchCandidateApplicationPort` computed
   `forceRefresh: !resumedRun || input.forceRefresh === true`, and a fresh control
   run is never `resumedRun`, so `forceRefresh` was unconditionally `true` — which
   short-circuits both compatible-run probes *and* per-chapter durable reuse.
   **The earlier claim in step 5 that a fresh run "reuses its durable sidecars via
   the successor chain" was wrong:** the successor chain is a control-run mechanism
   requiring `--resume-run-id` **and** `--reconcile-unsettled` on a terminal-FAILED
   run. A CLI-only flag would have changed nothing.

**The fix.** `--research-run-id <id>` names an existing research run directory under
`<v25-root>/research-runs/<bookId>/`. The researcher resolves-then-adopts it before
any model call: it loads that run's own hash-verified bibliography, so the chapter
list cannot drift, and every chapter reuses its durable sidecar (each still
re-validated through the live source-v2 route validator). Coherence, the source
integrity gate and the manifest write still run in full — a pinned reuse is gated,
not blindly trusted.

**Validation is fail-closed at every stage, and there is no fallback.** The pin
never falls back to scanning for a compatible run or to creating one: a fallback
would silently charge a full re-research while the operator believed they pinned,
and would turn the pin into a research-substitution primitive. Each failure raises
a distinct code — `RESEARCH_RUN_PIN_ESCAPED` (unsafe segment, or a path/symlink
escaping the book's research root), `RESEARCH_RUN_PIN_NOT_FOUND` (with the
available run ids listed, since a typo must look like a typo),
`RESEARCH_RUN_PIN_UNREADABLE`, `RESEARCH_RUN_PIN_INVALID` (manifest `bookId`,
manifest `runId` vs the pinned id, status allowlist, input identity, the five-field
compatibility fingerprint, bibliography bytes, bibliography-vs-`expectedChaptersHash`
binding, coherence), `RESEARCH_RUN_PIN_INCOMPLETE` (missing source-freeze artifact,
or any chapter not durably reusable), and `RESEARCH_RUN_PIN_MISMATCH` on readback.
Compatibility is **never** waived: the pin selects *which* run is read, it never
relaxes *whether* that run is valid.

**Two operator constraints, both deliberate:**

- **It cannot be combined with `--resume-run-id`** (rejected at the CLI, the service
  and the port). A resume rehydrates its durable seed and never calls the research
  port, so a pin there would silently do nothing — and accepting the pair would make
  the successor-recovery exception reachable with a pin present, creating a second
  acceptance path for the control-run bind. Because the pin forces a fresh run, its
  intake always presents `intakeRunId === runId`: the anti-forgery gate is
  *satisfied*, never bypassed, and the pin can never reach `#successorChainBindsRun`.
- **It fails closed on a partially reusable run.** Re-researching even one chapter
  rewrites the book-level `book-source.md`, which is hashed into *every* chapter's
  `packetDigest` — so partial reuse would miss all 4N cached packs while appearing
  to have pinned. Use `--resume-run-id --reconcile-unsettled` if partial durable
  reuse is genuinely what you want.

`--regen` still composes: it keeps only its promotion-pointer meaning (the
`BOOK_RUN_ALREADY_PROMOTED` bypass, without which the pin would be unusable on any
previously-promoted book), while the pin owns the research axis. The combination
logs `action=REGEN_SUPERSEDES_POINTER_ONLY` so it is never silent, and the research
`COMPLETED` event records `pinnedResearchRunId=…` for audit.

---

## 8. What still blocks a first live promotion

A parallel adversarial audit of the never-executed QC→promotion path (three agents,
isolated worktrees) found three criticals. None are Franklin content problems; all
would fire on the first real promotion of any book.

**C1 — v25 release writes no production-manifest sidecar.** Every v25-promoted book
is unshippable: `publish-final` has nothing to consume. Blocker #1.

**C2 — the reader panel's scale has no band anchors.** Seats are asked for 0–100
factor scores with no descriptors, and disagree by up to 13 points on the same
chapter. `AUTHOR_CHAPTER_BAR = 70` was calibrated against a *different* instrument
(the 140-book catalogue screening, rubric v2.0), so "70" on the panel's invented
scale and "70" on that rubric are not the same quantity. **This is a fair challenge
to the D6 decision in §5.2.** The structural argument there still holds — a
per-chapter floor demanding every chapter reach the top band is stricter than the
catalogue's own standard — but the specific number is not transferable between
rulers. The fix is to anchor the panel's scale to the published taxonomy, not to
re-argue the threshold.

**C3 — repair is starved of signal.** It receives *only* blocker findings; every
advisory and every per-factor score is discarded. A chapter failing purely on the
composite floor therefore reaches repair as one number naming no defect. This is
precisely the "66.5 with zero named defects" shape that stalled the live canary for
a dozen rounds — the diagnosis existed in the verdict all along and was thrown away
before repair could see it.

Also open, lower severity: the v25 release route ignores the quarantine tombstone
that `quarantine-book` promises will block promotion; `--promote-local` advances the
pointer without producing a reader package; and the release path keeps no journal, so
a crash between pointer CAS and package write is unrecoverable.

---

## 6. Honest limits

- **QC-judge and promotion are still unexercised at the time of writing.** With the
  bar calibrated to 70 the path is open — three of Franklin's four chapters clear it —
  but the run that proves it has not been executed end to end yet. Two real content
  blockers remain on that book (a twelve-versus-thirteen virtue contradiction and an
  unsafe "start unpermitted street work" instruction); both are scar-shaped fixes of
  the kind already demonstrated, not new machinery.
- **The Franklin canary reached review twice** (compile + assembly clean both times);
  its last verdict is FAIL with 7 blockers, 4 of them score-floor.
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
