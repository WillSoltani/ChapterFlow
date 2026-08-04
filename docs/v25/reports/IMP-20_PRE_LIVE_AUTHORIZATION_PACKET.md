# IMP-20 — Pre-Live Authorization Packet (§16 Split-Lane Reviewer Recovery)

- **Prepared by:** IMP-20 (report wave). **Status: PREPARED, NOT AUTHORIZED.**
- **Baseline:** HEAD `23c4ede4efe88722a658130ad536a2fcf34ef51d`, branch `feat/v25-pipeline`.
- **Live model calls made by this package: 0. API calls: 0.** Everything below is a *proposal* that requires the product owner's explicit approval before a single billed call.

This packet states exactly what the owner must approve before ANY live model call runs, the call math and stop conditions, and the two owner inputs still outstanding. Nothing here is self-authorizing: the recovery experiment `s16-reviewer-recovery-v1` is prepared but **not sealed** (`seal-prep.json`, not a seal), and it cannot be sealed until the gate below is cleared.

---

## 1. What is being requested

Authorization to run, in strict order and only after the two owner inputs (§4) land:

1. **Role qualification** — qualify the candidate judge profiles per REVIEWER ROLE (reader-experience, source-integrity, quiz-integrity) against the role-specific held-out corpora, using the split-lane instrument. Fail-closed: a role qualifies only if it clears every frozen threshold at an adequately powered denominator.
2. **Recovery pilot** — only if role qualification produces a ready role set (`assertRoleSetReady` passes), run the small blinded pilot to observe the split-lane conductor end-to-end on identical inputs.

No authoring migration decision, no production activation, and no book publishing is requested. Those are IMP-13's package and require their own separate authorization.

---

## 2. Call math (hard-bounded)

| Phase | Proposed calls | Source of truth |
|---|---|---|
| Role qualification | **440** | `RECOVERY_PROPOSED_QUALIFICATION_CALLS` |
| Pilot | **72** | `RECOVERY_PROPOSED_PILOT_CALLS` (16 candidate cells → 72 planned spawns) |
| **Proposed total** | **512** | 440 + 72 |
| **Hard ceiling** | **640** | `RECOVERY_PROPOSED_HARD_CEILING` (128-call headroom) |

`440 + 72 = 512 ≤ 640` (verified). `spec.json` binds `callCeiling: 640`. The 440/72 split lives as code constants and is re-derived here; the owner is asked to approve the ceiling and the split together.

For context (from the frozen §16 closure ledger, NOT part of this request): the halted campaign consumed **711** ledgered calls (**811** including the earlier Layer-N v1 run) against a `2096` sealed hard-max; `diagnosticCalls:0`, `confirmatoryCalls:0`. This recovery is a fresh, smaller, hard-bounded effort against a NEW experiment identity — it does not resume, reopen, or draw down the old sealed budget.

---

## 3. Stop conditions (encoded as preflight predicates)

The pilot dry-run (`runRecoveryPilotDryRun`, zero model calls) already encodes these as fail-closed predicates; a live run must halt on any of them:

- a role-instrument defect is detected (terminate the id, fix offline, start a NEW id — no in-campaign v3/v4 treadmill);
- missing source evidence for a required unit (→ INCONCLUSIVE, never a guessed PASS);
- differential/model-chosen judge assignment (assignment must stay a pure function of the spec);
- a stale bound hash (chapter/reader-doc/plan/packet/sidecar/schema);
- a new ambiguous gold label introduced mid-campaign;
- unbounded or hidden retry;
- any API/non-subscription route;
- an unadjudicated material disagreement.

Gold governance is frozen: calibration vs. holdout separated per role; holdout gold immutable once a live qualification begins; `independentHumanRater:false` recorded honestly; a model-generated audit is never independent-human evidence; source-clean status is never inferred from an overall score.

---

## 4. Owner inputs still outstanding (BOTH required before any live call)

1. **H2 — evidence-complete source gold.** The source-integrity corpus builder **fails closed** pending owner-supplied, held-out, evidence-complete source units: each is `chapter + exact plan unit + packet + sidecar + anchors + expected origin/form/claim-strength + allowed/forbidden detail types + gold chapter & source spans + provenance hashes`, excluding the sealed candidate books (`start-with-why`, `radical-candor`). Until these land, `contracts/{source}-corpus.v1.json` and its provenance manifest do not exist and the source role cannot qualify (R-3).
2. **The 14 sol source-register cases + panel design.** The 14 `gpt-5.6-sol@high` source-register divergence cases from Layer-N v2 remain **UNADJUDICATED (owner gate)** — never labeled true/false anywhere in the closure or the retrospective. The owner must adjudicate them (are the books' named illustrative examples legitimately grounded, or reserved-category fabrications?) and decide the panel design that follows (R-4). This directly determines whether `gpt-5.6-sol` can serve as a source-integrity judge.

Neither input can be manufactured by the pipeline; both are genuine owner decisions.

---

## 5. Explicit disclosures (read before approving)

- **No judge decision has been made.** The Layer-N v2 campaign is ARCHIVED as INCONCLUSIVE due to a review-instrument mismatch; it produced no reviewer-qualification and no authoring-migration decision. `gpt-5.5@high` qualified only under the *old* monolithic instrument; that does not carry over to the split-lane roles.
- **No authoring decision has been made.** This package is reviewer-side only. No inference about which model should *author* books has been drawn, and none is requested here. `authoringMigrationDecisionProduced:false`.
- **No production activation.** `imp13Dormant:true`, `productionActivation:false`, `separateAuthorizationRequired:true`. Approving this packet does not wire the split-lane reviewer into production authoring, does not publish any book, and does not change any canonical book (`canonicalBooksChanged:0`).
- **No Anthropic/Claude model anywhere in pipeline routing.** Runtime judge and candidate profiles are GPT-via-ChatGPT-codex only (`gpt-5.5`, `gpt-5.6-sol`). Opus/Claude/Anthropic appear **nowhere** in the pipeline's model routing — the router choke fails closed on any `anthropic-api`/`openai-api` provider, and the ChatGPT-subscription auth-mode invariant is enforced (`assertChatgptSubscriptionAuth` / `validateRouteResult`). The candidate profiles in `spec.json` are `gpt-5.5@{high,xhigh}` and `gpt-5.6-sol@{high,xhigh}`.
- **The old campaign cannot silently resume.** `CLOSED_EXPERIMENT_IDS` + `assertNotClosed` fail-close resume at the three src/ chokes. One residual (R-2b): the Stage-Q Layer-O raw-spawn `.mts` drivers are immutable evidence with no gate-able src/ chokepoint; they cannot resume a sealed budget and are covered by the owner directive "no further Stage-Q authorized" — but a future Stage-Q-style qualification must route through a gate-able src/ entry.

---

## 6. Approval checklist

Before any live call, the owner confirms:

- [ ] H2 evidence-complete source gold delivered; the source corpus builds (no fail-closed).
- [ ] The 14 sol source-register cases adjudicated; panel design (including whether `gpt-5.6-sol` serves as a source judge) decided.
- [ ] The 440 / 72 / 640 call math and hard ceiling approved.
- [ ] The stop conditions in §3 acknowledged as fail-closed halts.
- [ ] Understood: this authorizes role qualification → pilot ONLY — no authoring decision, no production activation, no publishing, no Anthropic/Claude routing.

Upon all boxes: seal `s16-reviewer-recovery-v1` (role qualification first), then — only on a ready role set — the pilot. Until then, the experiment stays at `seal-prep.json` and no billed call is made.
