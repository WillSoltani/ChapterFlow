# Owner preflight acceptance + confirmatory substitution directive — received 2026-07-11

Recorded VERBATIM below. This message: accepts the first preflight addendum; declines
reconstruction and backup-packet equivalence for multipliers; orders a **pre-live
confirmatory corpus substitution** (not a B2 evidence waiver) under a frozen selection
procedure; mandates the substitution record and resealing checks; sets the
"owner approved" terminology rule; and carries the execution authorization contingent
on the final concise preflight.

Applied by: `confirmatory-substitution.2026-07-11.json` (sha256
`fa9304f3a0d9fb633c20bb2af27fb724e07fa534a291171c72a4354cd97db73c`),
`radical-candor-extraction.manifest.json`, the resealed
`confirmatory-sol-2026-07`, and the terminology addendum in
`owner-ratification.received.md`.

---

## Owner message (verbatim)

Preflight accepted. The ChatGPT-authenticated codex exec route, no-API enforcement, Stage-Q controls, C4 correction, tests, and diagnostic seal are approved. No live call has occurred.

Do not reconstruct the missing Multipliers index or source-v2 sidecars, and do not treat its backup source packets as equivalent replacements.

I am choosing a pre-live confirmatory corpus substitution, not a B2 evidence waiver.

Confirmatory substitution rule

Replace multipliers using this frozen selection procedure:

The replacement must have an authoritative chapter index and complete source-v2 sidecars in the supplied v24 archive.
It must satisfy the same intended confirmatory chapter category or stratum that Multipliers was selected to represent.
It must not introduce prohibited overlap with the diagnostic corpus or another confirmatory sample.
Among eligible books, choose the one with the chapter count closest to Multipliers’ nine chapters.
Resolve any remaining tie using a stable lexicographic bookId ordering.

Evaluate radical-candor first. The supplied archive contains:

state/indexes/radical-candor.json

and nine complete source sidecars:

ch01.source.json
ch02.source.json
ch03.source.json
ch04.source.json
ch05.source.json
ch06.source.json
ch07.source.json
ch08.source.json
ch09.source.json

Use radical-candor if it satisfies the frozen stratum and non-overlap requirements.

If it is ineligible, apply the same procedure to the other complete archive candidates, including start-with-why and the-culture-code. Do not select a replacement based on convenience, anticipated model performance, or any live result.

If no available book satisfies the frozen category and non-overlap requirements, leave the confirmatory stage blocked and return the eligibility matrix. Do not weaken the corpus requirements.

Required substitution record

Create a pre-live substitution report containing:

originalBookId: multipliers
replacementBookId
reasonForOriginalIneligibility
candidateEligibilityMatrix
intendedStratum
stratumMatchEvidence
overlapCheck
originalChapterCount
replacementChapterCount
selectedChapterMapping
indexSourcePath
indexSHA256
sourceSidecarPaths
sourceSidecarSHA256s
scheduleChanges
expectedCallCountChanges
maximumCallCountChanges

Also record that:

the substitution occurred before the first live output;
no model result was available when the replacement was selected;
no threshold, endpoint, judge qualification rule, retry rule, or decision rule changed;
the same frozen inputs will be used for all four model-effort cells;
the replacement is an experiment-input correction, not a book-specific production branch.
Resealing

After selecting and extracting the replacement:

validate the index and every sidecar;
regenerate the confirmatory schedule;
recompute expected and maximum call counts;
regenerate every dependent seal and manifest;
rerun the no-model dry run;
rerun targeted contract tests and the complete suite;
verify that all model calls still route exclusively through ChatGPT-authenticated codex exec;
verify that no API provider or fallback is reachable;
verify that the diagnostic seal remains unchanged unless a shared sealed dependency technically requires resealing.

Use owner approved rather than ratified in development-facing documentation. Preserve the accurate evidence status:

ownerApprovedForDevelopmentBakeoff: true
independentHumanRater: false
Authorization

If radical-candor, or the deterministically selected fallback, satisfies the procedure above and all resealing checks pass, you are authorized to execute the already frozen §16 sequence without another general approval:

Stage Q
→ diagnostic
→ blind review and analysis
→ C3 pause
→ unblind and diagnostic decision
→ confirmatory stage when authorized by the frozen ladder

Preserve every attempt and obey the sealed call limits. The maximum call count is a hard ceiling, not a target.

This still does not authorize:

OpenAI API or any metered API usage;
API-key authentication or API fallback;
IMP-13 activation;
production routing changes;
publication, promotion, or deployment;
post-output threshold or sample changes;
unbounded retries;
hidden replacement samples;
book-specific production logic.

Before the first live call, return only the concise final preflight result:

selected replacement and eligibility rationale;
substitution-report path and hash;
new confirmatory seal hash;
updated expected and maximum call counts;
no-model dry-run result;
complete-suite result;
confirmation that the first live call has not yet occurred.

After that final preflight passes, proceed under the standing authorization.
