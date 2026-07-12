# Owner ratification + corrections directive — received 2026-07-11

Recorded VERBATIM below. This message is the B1 ratification instrument, the B2
archive supply, the §16 correction directive (route invariant + repair-demand),
and the conditional execution authorization. It supersedes nothing; all prior
restrictions remain in force as restated in its final section.

Recipient action record:
- B1 ratification applied: `stage-q/layer-n-corpus.ratified.v1.json`
  (sha256 `fd9b3d8719d4b593093a4e15ed60f633e27d5133ca0ec63b04e2dc0cb42ba98e`,
  corpusId `s16-stage-q-layer-n-ratified-v1`, 43/43 human-ratified labels,
  `validateQualCorpus` = []). Pending-corpus sha at flip time:
  `8d1c3f8ea20c88aa0a9d1f7e6da6e140eebe571d48ccd1506e0baa87d5a73243`.
- SEED-* conditional ratification: sealed record `stage-q/seed-fixtures.sealed.json`
  (sha256 `4f74837cb0ead4114047d9e0b1c379af70891b2935beb66df1f0e08881a7634f`)
  carries the exact content, labels, provenance, hashes, and the six-condition
  check results. The fixtures are owner-approved compatibility fixtures — NOT an
  independent second-human rating; `independentHumanRater: false` preserved.
- Transform script: `b1-ratify-corpus.mts` (this directory).

---

## Owner message (verbatim)

/Users/radinsoltani/Downloads/V24_CF_J_PIPELINE_AND_REPORTS_2026-07-10.zip. Accepted with the following mandatory clarifications and corrections before any live model call.

1. ChatGPT-subscription execution is the only authorized model route

By “ChatGPT exec,” I mean the mechanism used by the original v24 pipeline:

codex exec

authenticated through my ChatGPT subscription using ChatGPT OAuth.

Every model-bearing operation must use the centralized ChapterFlow Codex execution broker and ultimately spawn:

binary: codex
subcommand: exec
authentication: ChatGPT subscription OAuth

This applies to every:

Stage-Q qualification read;
authoring call;
review call;
judge-panel call;
diagnostic call;
analysis call;
repair or regeneration call;
confirmatory bakeoff call;
infrastructure replay;
specialist or adjudication-support agent call.

The following are prohibited:

OpenAI Platform API-key authentication;
OPENAI_API_KEY;
CODEX_API_KEY;
custom OpenAI API base URLs;
direct OpenAI SDK model calls;
direct HTTP calls to OpenAI model endpoints;
providers/openai-api.ts;
any Anthropic or other metered model provider;
API fallback after a ChatGPT-plan capacity failure;
silent authentication-mode switching;
public-API-equivalent cost estimation.

If ChatGPT authentication is missing, expired, rejected, or resolves to API-key authentication, fail closed before the model receives the prompt.

A Max-plan capacity or rate-limit event must remain a distinct recorded outcome. It may receive only the already sealed bounded infrastructure replay. It must never cause a fallback to an API provider.

Before live execution, prove this invariant across the entire §16 call graph, not merely files under the migration module:

enumerate every model-bearing call site;
show that each reaches the centralized codex exec broker;
show that no API-provider branch is reachable;
show the effective executable, arguments, authentication type, model, effort, sandbox, and environment policy;
record the following on every live attempt:
executionRoute: codex_exec_chatgpt_subscription
authMode: chatgpt
apiKeyPresent: false
apiFallbackAllowed: false

Never place OAuth tokens or the contents of auth.json in reports, manifests, seals, logs, or committed files. Temporary isolated auth.json copies must use restrictive permissions, remain outside the repository, and be deleted when their execution environment is destroyed.

2. B1 owner ratification

I ratify the following sealed experiment-design decisions:

the selected diagnostic books, chapters, and strata;
the mixed qualified-judge panel;
the frozen deterministic random seeds;
serial execution with maxParallel = 1;
seeded block interleaving;
the single-book diagnostic Stage A;
the dual-layer Stage-Q structure;
the owner-supplied 64-case instrument as the primary Stage-Q gate;
the pause for completed C3 adjudication before unblinding;
the finite call schedule and bounded retry policy.

I conditionally ratify the three SEED-* Layer-N entries as owner-approved compatibility fixtures, subject to all of these conditions:

Their exact content, expected labels, provenance, and hashes are included in the sealed manifest.
They do not replace, dilute, modify, or reduce the 64-case owner-supplied primary qualification gate.
They are not represented as an independent second-human rating.
They cannot independently qualify a judge that fails the owner-supplied primary gate.
They cannot introduce a new substantive ground-truth rule inconsistent with C1 or C4.
They cannot be used to hide missing qualification coverage.

If any SEED-* entry violates those conditions, do not flip its provenance and do not begin live judging. Return its full record for review.

3. Do not ratify the repair-demand semantic deviation

I do not ratify the reported stricter-only repair-demand deviation.

Implement the frozen C4 rule exactly:

When the GPT-5.5 xhigh baseline repair-demand rate is below 10%:
    the absolute +5 percentage-point margin is the blocking comparison;
    the relative +20% comparison is informational and cannot independently fail
    the configuration.

When the GPT-5.5 xhigh baseline repair-demand rate is at least 10%:
    both the absolute +5 percentage-point margin and the relative +20% margin
    are blocking.

This is not gate weakening. It is correction of the evaluator so it matches the owner-frozen policy.

Add tests covering at least:

baseline 5%, candidate 9%:
absolute rule passes; relative rule must not cause failure

baseline 5%, candidate 11%:
absolute rule fails

baseline 20%, candidate 23%:
absolute and relative rules pass

baseline 20%, candidate 25%:
relative rule fails even though the absolute difference is 5 points

Run targeted tests and the complete suite. Regenerate the semantic-equivalence report and reseal every artifact whose hash depends on this evaluator. No live output exists yet, so the correction must occur before the final seal.

4. B2 legacy-v24 evidence

I am supplying the authoritative archive:

V24_CF_J_PIPELINE_AND_REPORTS_2026-07-10.zip

Its SHA-256 is:

5e7ec1179d444e99f2a30d6a0c0cfd0c5cd33ead945b1c0cd8778fbf8c8149a2

Extract the missing multipliers chapter index and its nine source-v2 sidecars directly from that ZIP.

Do not reconstruct, regenerate, paraphrase, or substitute them.

Record:

ZIP hash;
internal source paths;
extracted destination paths;
per-file hashes;
confirmation that bytes match the archive;
the confirmatory seal hash after inclusion.
5. Authorization after correction

After:

the complete codex exec subscription-only call graph passes;
the SEED-* conditions pass;
the repair-demand evaluator exactly matches C4;
targeted and full tests pass;
B2 files verify against the supplied ZIP;
the semantic-equivalence report is clean;
the final seal is regenerated and verified;

you are authorized to begin the frozen §16 sequence.

Run the diagnostic first exactly as scheduled. Preserve every attempt. Pause for the required blind C3 adjudication before unblinding.

The sealed maximum of 2,372 calls is a safety ceiling, not a target. Do not add output-informed calls, bonus samples, replacement samples, judge retries, or hidden replays.

This authorization does not permit:

direct or indirect metered API usage;
API-provider fallback;
IMP-13 activation;
production routing changes;
publication;
promotion;
deployment;
gate weakening;
threshold changes after live output begins;
unbounded retries;
book-specific exceptions;
synthetic evidence being described as independent human evidence.

Before making the first live call, return a concise preflight addendum containing:

the whole-pipeline model-call inventory;
proof that every call uses ChatGPT-authenticated codex exec;
the three sealed SEED-* records and condition-check results;
the repair-demand correction commit and test evidence;
the updated semantic-equivalence verdict;
the B2 extraction manifest;
the final diagnostic and confirmatory seal hashes;
the expected and maximum call counts;
confirmation that the first live call has not yet occurred.

---

## Addendum (2026-07-11, post-substitution directive)

Owner terminology directive applied: development-facing documentation says **owner
approved** (never "ratified"); evidence status preserved everywhere as
`ownerApprovedForDevelopmentBakeoff: true` + `independentHumanRater: false`.
Superseding artifact hashes (the flip-time hashes above remain the historical record):

- Corpus renamed → `stage-q/layer-n-corpus.owner-approved.v1.json`
  (corpusId `s16-stage-q-layer-n-owner-approved-v1`, sha256
  `a127d8ce93a2473a8c0cf3a7388056e97ee7df85056aa23561db0576630b6498`,
  43/43 human-status labels as owner-approved decisions, `validateQualCorpus` = []).
- SEED fixtures re-worded → `stage-q/seed-fixtures.sealed.json` sha256
  `3a952e0ede7b2f0c99195fc60cf8a861754532e4977cb3c97ca5e4cc4e561ca7`.
- Execution policy r3 sha256
  `3ccacf93b23bd33c50c4a2b0640d4d863ab889cbba072bcabc102d8218be8ea1`.
- B2 confirmatory corpus substitution (multipliers → radical-candor) recorded in
  `confirmatory-substitution.2026-07-11.json` sha256
  `fa9304f3a0d9fb633c20bb2af27fb724e07fa534a291171c72a4354cd97db73c`;
  the owner's substitution directive is the authorization instrument for it.
