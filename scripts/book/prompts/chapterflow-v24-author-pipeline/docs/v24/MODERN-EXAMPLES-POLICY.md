# MODERN-EXAMPLES POLICY (contemporary-translation slot)

**Status:** Phase 1 — POLICY **APPROVED** 2026-07-08. Phase 2 NOT YET IMPLEMENTED — deferred (see Sequencing). No `src/` change has landed.
**Origin:** `docs/v24/V24_CONTENT_FEEDBACK_TRIAGE.md` Finding 6 (verdict: *partially agree — value real, risk real, policy first*), prompt CF-G.
**Branch:** `feat/anti-sameness-live-fix`.

## Owner decisions (2026-07-08 — binding for Phase 2)

1. **Coverage cap:** dealt to **≤ ¼ of chapters**, with a **hard ceiling of 4 chapters** regardless of book length. (Supersedes the ≤⅓ target discussed in Phase 1; tables below updated.)
2. **Wording:** **pure permission** ("you MAY translate to a present-day setting"), **never a nudge/invitation**.
3. **Quarantine:** **advisory-only** reporter over the EI2 + `sourceGrounding` hard backstop — **no new blocker**.
4. **Ship it:** yes, but **piloted on ONE fresh book first**, measured for transfer + monoculture before any wider rollout.

## Sequencing (do NOT start Phase 2 until triggered)

Phase 2 is sequenced **behind the CF-A…CF-F validation book**. Implementation will be triggered
**explicitly** afterwards, then **piloted on one fresh book** before wider rollout. Until that
trigger arrives, this doc is the frozen spec — no code lands.

## Problem

A 2026 reader of a 1983 management classic maps "breakfast-factory branches" to a
support queue or a distributed team on their own. Doing that mapping *for* them can raise
transfer. The sample audit CONFIRMED an absence: every example in HOM ch7/ch8 lives inside the
book's own settings, and the only real-world referent is an Intel-era case. Part of that is
source fidelity working as intended (Grove's breakfast factory is *his own* device).

The reviewer's suggested fix — invite SaaS-support / delivery-app / remote-team analogies —
carries exactly the failure modes this pipeline is hardened against:

1. **Invented specifics presented as fact** → EW1 (invented witness), `evidenceIntegrity`, `sourceGrounding`.
2. **Misattribution / source drift** — a modern claim laundered as if the source said it.
3. **Dating** — a named-technology reference ("an AI content pipeline") reads stale in ~3 years; the evergreen policy exists for a reason.
4. **A new monoculture** — a modern-example slot dealt to *every* chapter is just the next house template.

The existing writer card already **permits** explicitly-framed hypotheticals (rule 7 EXAMPLE
CRAFT: "the reader ('you'), a real source case, or an explicit hypothetical"; the `proxy-cast`
alt-hint: "an explicitly hypothetical role … 'Imagine a team…'"). The policy question is not
*whether hypotheticals are allowed* — they are — but whether to **actively invite them in a
present-day setting**, how often, and behind what fences.

## Decision

Introduce a bounded, deterministic, **opt-in** "contemporary-translation" slot — the inverse of
the content-device *ban* deal. It is **dealt to a MINORITY of chapters** (≤¼, hard ceiling 4) and,
when dealt, **permits** *at most one* present-day-generic hypothetical example — pure permission,
never a nudge. It is structurally incapable of becoming universal, and it never touches a quiz or
card "fact". Four rules below; each has a decision table.

---

### Rule 1 — WHEN a contemporary-translation example is allowed

| | |
|---|---|
| **Allowed** | Only in a chapter the deal opted IN. **≤ 1** contemporary-translation example in that chapter. Dealt to a **MINORITY of chapters — ≤ ¼, hard ceiling 4** regardless of book length (so it can never read as the house pattern). The deal is a pure function of `(chapterNumber, totalChapters)` — deterministic, no clock, no RNG — like `contentDeviceDeal.ts`. |
| **Forbidden** | A modern example in a chapter the deal did NOT opt in. More than one per chapter. Any design where >¼ of chapters — or more than 4 chapters — carry the slot. Making it *mandatory* in the opted-in chapter — it stays **pure permission**: the writer MAY translate, and may equally choose a source case or a `you`-scenario. |

*Note:* the content-device deal bans 3-of-7 devices per chapter (each device present ≈57% of
chapters). This slot is its inverse — a *permission*, not a ban — and its coverage cap is the
opposite bound: **minority**, not majority. Concretely, deal it to
`min(4, floor(totalChapters / 4))` chapters, spread evenly. (Exact spread is a Phase-2 detail;
the ≤¼ / ceiling-4 cap is policy.)

### Rule 2 — mandatory FRAMING (the fences)

| | Allowed | Forbidden |
|---|---|---|
| Framing | Explicitly hypothetical + present-day-generic: "Picture a support queue where…", "Imagine a distributed team that…" | A modern case narrated as something that *happened* (undated real-sounding anecdote). |
| Entities | Generic roles/settings: *a support queue, a distributed team, an on-call rotation, a delivery driver*. | **No named real companies, products, or people** (no "Slack", "DoorDash", "a Google PM"). |
| Numbers | Qualitative or clearly-hypothetical shape ("the queue doubles overnight"). | **No invented statistics** ("response time dropped 40%") — invented precision is the EW1/grounding tripwire. |
| Attribution | The *concept* traces to the source; the modern *dressing* is openly the writer's illustration. | **No source-attributed modern claim** — never imply the packet contains the modern case. |

The EXAMPLE GROUNDING clause ("the ONLY allowed factual material … Invent connective narration,
not facts") is **untouched**. A contemporary-translation example is *connective narration in a
present-day costume*, never a new fact. EW1, `misattribution`, and `sourceGrounding` stay exactly
as they are — the framing is what keeps a compliant modern example on the right side of them.

### Rule 3 — quiz / card QUARANTINE

| | |
|---|---|
| **Allowed** | A contemporary-translation example may appear in narration (hook, breakdown, an example scenario). |
| **Forbidden** | Nothing from it may become a **factual quiz answer** (keyed choice, distractor presented as fact, keyEvidence) or a review-card **"fact"** on the back of a card. Quizzes and cards test the reusable move and *source*-grounded facts only. |

**Existing enforcement surface (found):** the pipeline already grounds quiz facts —
`evidenceIntegrity.ts` **EI2** (a quiz key keyed to a testimonial is a BLOCKER) and
`sourceGrounding.ts` (quiz `prompt` / `explanation` / `keyEvidence` must reference a cited source
anchor). A quiz key derived from an *invented modern illustration* would already fail
`sourceGrounding` (it traces to no anchor). **However, there is no rule that names the
contemporary-translation slot specifically.** Per the global constraint and the roadmap:
**Phase 2 adds this quarantine as an ADVISORY check** (report-only, no new blocker), leaning on
the existing grounding gates as the hard backstop.

### Rule 4 — DATING (evergreen durability)

| | Allowed (durable) | Forbidden (stales) |
|---|---|---|
| Setting | "a support queue", "a distributed team", "an on-call rotation", "a code review", "a shared spreadsheet" | "a Slack huddle", "the ChatGPT rollout", "a Web3 launch", "the 2026 layoffs" |
| Test | Would this phrasing read the same in 2035? | Names a technology, brand, or event tied to a moment. |

Generic durable settings are the whole point: they modernize the *reader's mental model* without
buying a dated reference. A named technology is both a dating risk and (Rule 2) an
un-attributable specific.

---

## Structural guarantee

Because the slot is (a) **dealt deterministically** and (b) **capped at a minority (≤¼, ceiling 4)**,
it is structurally incapable of becoming the new "one template, different nouns" pattern the
book-acceptance panel rejected — the same property that makes `contentDeviceDeal.ts` safe, applied
in the opt-in direction. It also cannot silently expand: the ≤¼ / ceiling-4 cap is a property test
in Phase 2.

## What Phase 2 would touch (for the owner's cost estimate — NOT yet implemented)

- `contentDeviceDeal.ts` (or a sibling `contemporaryExampleDeal.ts`) — a deterministic opt-in deal, `min(4, floor(totalChapters / 4))` coverage.
- Writer card: a **dealt-only, pure-permission** instruction rendered *just for opted-in chapters* ("you MAY translate…"), carrying Rules 2–4 inline (net card delta kept small — target ≤ +400 chars, and only on the chapters that get it).
- One SELF-VERIFY item ("if you wrote a present-day illustration, it is framed hypothetical, names no real entity, invents no number, and feeds no quiz/card fact").
- An **advisory** quiz/card-quarantine reporter (no new blocker; EI2 + `sourceGrounding` remain the hard gates).
- Tests: deal determinism + minority-coverage property (≤¼, ceiling 4); card-pin (framing/quarantine render only for dealt chapters); a critic fixture pair — a properly-framed modern hypothetical passes EW1/grounding, one presented as fact trips them.

EW1, `misattribution`, `sourceGrounding`, `evidenceIntegrity`, `AUTHOR_CHAPTER_BAR`, the
lead-thread contract, and every acceptance policy remain **untouched** in Phase 2.

---

## Resolved (owner, 2026-07-08)

The Phase-1 open questions are closed:

1. **Coverage cap** → **≤ ¼ of chapters, hard ceiling 4** regardless of length.
2. **Wording** → **pure permission** ("you MAY translate…"), never an invitation.
3. **Quarantine** → **advisory-only** over the EI2 + `sourceGrounding` backstop; no new blocker.
4. **Scope** → ship, but **pilot on ONE fresh book first** and measure transfer + monoculture before wider rollout.
5. **Want it?** → yes, proceed (bounded per above).

**Phase 2 is NOT authorized to start yet** — it is sequenced behind the CF-A…CF-F validation book
and will be triggered explicitly afterwards (see Sequencing at top).
