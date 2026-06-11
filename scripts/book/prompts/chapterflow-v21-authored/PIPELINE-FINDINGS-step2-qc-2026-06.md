# ChapterFlow v21 — Step-2 QC Findings & Pipeline-Fix Recommendations (June 2026)

Synthesis of QC across: **range, the-5-am-club, dare-to-lead, unreasonable-hospitality,
the-let-them-theory, drive, outliers**. Audience: pipeline maintainers. Goal: stop these
defects at generation time so QC stops catching them by hand.

---

## 0. The one-sentence headline

**Every broken book passed `book-gate` GREEN (0 blockers).** The deterministic gates
validate *structure, templating, and register* — they do **not** validate *meaning*.
A book can be 100% gate-clean and 100% unpublishable. That gap is the root problem;
everything below is detail.

---

## 1. The single underlying failure behavior

The writer frequently **composes fields by splicing source fragments into fixed
templates instead of writing prose.** Call it *slot-fill / Mad-Libs assembly*. It is ONE
behavior with many surface forms. When it happens, the concept becomes a token, source
sentences get pasted in verbatim (often truncated), and the result is grammatically
broken or semantically hollow — but it still passes the gate because each chapter's
filler differs enough to dodge the cross-chapter overlap thresholds.

This behavior accounts for **~90% of everything QC caught.** Fixing the gate to detect
it, and fixing the Step-2 prompt to prevent it, is the highest-leverage work.

---

## 2. Catalog of surface forms (with verbatim examples + cheap grep tells)

| # | Defect | Verbatim example (book) | Grep / detector tell |
|---|---|---|---|
| 1 | **Concept used as a noun/adjective/actor** | "empires nurse", "tactics hospital ward" (5am-club); "the taco plan note", "Taco plan keeps…" (let-them) | concept slug + role noun ("<concept> nurse/coach/founder"); concept slug as sentence subject |
| 2 | **Sentences fused / truncated mid-clause** | "…optimized for status, speed, and control. as a design signal" ; "shows the fastest path back to peace is to let other." (5am-club, let-them) | field ends lowercase-word + "."; ". <lowercase>"; "the.", "makes the.", "let other." |
| 3 | **Breakdown tier templated loop** | "Full layer returns to the X so <frag>. Full reading keeps X near <frag>. Full limit checks X against <frag>." ×7-9/ch (let-them); "X keeps <concept> tied to <def>" ×25 (dare-to-lead) | 12-word-shingle repetition ratio per tier (0.78–0.86 = corrupt); literal "layer returns to the" / "keeps <X> tied to" |
| 4 | **"<Concept> means The <concept> is…" deepRead seam** | "Motivation operating systems means A motivation operating system is…" ; "Purpose motive means The purpose motive is…" (drive, ×11) | ` means [A-Z]` in deepRead |
| 5 | **Quiz answerable by FORMAT, not meaning** | (a) only un-prefixed choice = key; distractors = key sentence + gibberish prefix "Reverse"/"Flatten"/"Prefer … over" (drive, 99/99). (b) correct answer = the one ending in the right container noun roster/memo/budget (UH, 180/180) | count un-prefixed choices/question → if exactly 1 every time, key is format-identifiable; directive-verb prefixes; answer correlates with trailing noun |
| 6 | **Generated source-summary distractors** | "TOMS Shoes would be managed through mission badges…; campaign optics would outrank contribution." (drive) | "would be managed through", "would outrank", "should be simplified into", "first, then ask later whether" |
| 7 | **Echo-template explanations (hide wrong keys)** | explanation = "<keyed-choice text>. <question text>" — restates, never justifies (dare-to-lead, 72/72) — and a genuinely WRONG key (ch01 Q1) survived behind it | explanation string ⊇ keyed choice text; explanation contains the prompt text |
| 8 | **Cards test source recall, not understanding** | front "How should the reader use this source claim: <claim>?" (drive); "Source label:" prefix in back (range, 36/36); card fronts truncated mid-word (range) | front matches "use this source claim"/"Source label:"; front lacks "?"; back ≈ verbatim source |
| 9 | **Examples are planning notes, not scenes** | "Use TOMS Shoes to apply Purpose motive…"; "Apply <X> through <Y> in a <Z> situation"; "<Name> weighs whether X during the <domain> at 3:49 p.m. <verbatim source sentence>" (drive); "Imani works the hotel desk at 7:07 morning…" (UH) | "to apply … without flattening the source lesson"; "Apply <X> through <Y> in a <Z> situation"; "<time> morning/evening"; identical fixed timestamp every chapter |
| 10 | **Writer-facing / non-reader implementation plans** | "apply <source> to a real decision"; "revisit the hard edge"; "include <source>… one place the analogy could fail" (range, drive) + long copied warning text | "as the source check/cue"; "revisit the hard edge"; "the analogy could fail" |
| 11 | **keyTakeaway broken / leaks pipeline vocab** | "Control separation matters here because asks where attention is leaking: … when attention." (missing subject + truncated, let-them); "uses a real source cue" leak (UH) | "matters here because <verb>" (no subject); "uses a real source cue" |

---

## 3. The Goodhart problem: frequency/overlap critics are systematically gamed

The existing critics (AS5/6/9, AS13/BP20) are **phrase-frequency / multiset-overlap**
detectors. The writer reliably mutates to slip under them:

- **AS13/BP20** ("8-word phrase recurs ≥8× in one chapter") → evaded by **rotating one
  distinct skeleton per question slot** (9 skeletons, Q1..Q9), so no single phrase hits
  the count. (unreasonable-hospitality, drive)
- **AS9** ("example scenario ≥70% multiset overlap with prior chapter") → evaded because
  a long **unique real-source sentence** spliced into each scenario dilutes overlap below
  70%. (the-5-am-club)

**Implication:** any threshold on raw surface tokens is beatable. Detectors must first
**normalize out the chapter-specific tokens** (proper nouns, concept label, domain,
timestamps) and *then* measure skeleton overlap — the skeleton is identical once the
fillers are stripped. Also detect the *structural* pattern "one skeleton per slot,
repeated across chapters" directly.

---

## 4. Upstream root cause for the worst (word-salad) cases: missing/empty source

The fully-incoherent books had **absent or empty source on disk**:
- **the-5-am-club**: no `.chapterflow/runs/the-5-am-club/` at all.
- **dare-to-lead**: `.chapterflow/` entirely empty.
- **the-let-them-theory (round 1)**: brief had `coreIdeas: []`, `targetReader: ""`.

With no real named cases, the writer fills templates with concept labels → word-salad.
**Missing on-disk source is a reliable predictor of the worst corruption.** But it is
necessary-not-sufficient: unreasonable-hospitality, drive, and let-them-round-2 had
**real** source and still slot-filled. So fixing source removes the catastrophic tier
but not the assembly behavior.

---

## 5. The artifact / promotion hazard (separate from content)

`book-packages/<book>.v21.json` (the promoted/shipped artifact) is **a separate file
from the loose `state/chapters/*.json`.** Fixing the loose chapters does NOT update the
package. **range** shipped a corrupt package (108/108 bad quizzes, createdAt
2026-06-03T03:21:20) that stayed live in the library even after the loose chapters were
regenerated clean. Nothing checks that the promoted package matches the current chapters.

---

## 6. The quality-bar calibration finding (process, not generator)

There are **two distinct failure tiers**, and they need different bars:
- **Corruption** (word-salad, wrong keys, broken grammar) — unambiguous RED.
- **Generated-draft quality** (keys correct + prose accurate, but distractors are
  templates, cards test recall, examples are planning notes, plans are writer-facing).
  This **passes the gate AND a naive content read**, yet is not publishable. An external
  final QC scored a gate-clean, key-correct drive chapter **61/100**.

The bar must be **"a finished, publishable chapter,"** not "not-corrupt." This tier is
the easiest to wave through and the one most worth a model-backed quality critic.

---

## 7. Per-book summary

| Book | Source on disk | Defect tier | Headline defects | Outcome |
|---|---|---|---|---|
| range | present | corruption → draft | 108/324 `Label: anchor;` quiz frags + mid-word truncation; then writer-facing plans, source-label cards | Fixed (2 redos); **promoted package still stale — must re-promote** |
| the-5-am-club | **missing** | word-salad (worst) | every field, all 18 ch; concept-as-noun, fused sentences | RED → full Step-2 rewrite (re-run Step 1 first) |
| dare-to-lead | **missing** | word-salad + wrong key | fullRead loop ×25; echo-explanations hiding a real wrong key (ch01 Q1) | RED → full rewrite → **passed round 2** |
| unreasonable-hospitality | present | format-tell + boilerplate | 180/180 container-noun-answerable quizzes; 1 explanation across all 20 ch (BP1); repeated scene wording (BP2) | RED |
| the-let-them-theory | r1 empty → r2 real | word-salad (survived source fix) | broken keyTakeaway; "layer returns to the X" loops; planning-note examples; truncated quiz prompts | RED → round-2 rewrite |
| drive | present | format-tell → debt → draft | 99/99 format-identifiable keys; then templating debt; then generated distractors + recall cards + planning-note examples | Fixed via targeted redo → polish → **major cleanup → GREEN (88–92)** |
| outliers | present | (clean) | passed after examples-redo + readability polish | GREEN |

---

## 8. Recommendations, prioritized

### P0 — Add semantic / content-quality critics (the core gap)
The gate cannot see meaning; add a model-backed tier (a prototype exists:
`src/critics/semantic/quizKeyJudge.ts` — needs a funded key). Extend it to judge:
1. **Quiz key correctness** — derive the answer with `correctIndex` hidden; flag confident
   mismatches (catches the dare-to-lead wrong key the gate passed).
2. **Distractor quality** — are distractors realistic wrong answers, or templates / the
   key in disguise?
3. **Card learning value** — does `back` answer `front` and test understanding (not recall)?
4. **Example coherence** — real scene with a person + tradeoff + decision, or a planning note?
5. **Prose coherence** — grammatical, non-repetitive, finishes its scene.
Run as a separate tier that **fails open** (loud "DID NOT RUN", never silent pass).

### P1 — Add cheap deterministic detectors for the known tells (§2 table)
All high-precision and greppable: mid-clause truncation, concept-as-noun, breakdown-tier
shingle-repetition ratio, the ` means [A-Z]` seam, un-prefixed-choice count, echo-template
explanation (explanation ⊇ keyed choice), the §2 distractor/plan/card/example phrase
blocklist, fixed-timestamp scenarios. These would have caught most books at `gate-chapter`.

### P2 — Make detectors skeleton-aware, not frequency-based (§3)
Normalize out proper nouns / concept label / domain / timestamps, THEN measure
cross-chapter and per-slot overlap. Detect "one skeleton per question slot across
chapters" structurally. This closes the AS9 / AS13 evasion.

### P3 — Gate the source step (§4)
Block Step 2 if source sidecars are missing or empty (`coreIdeas: []`, no `namedExamples`).
`check-source` must verify **real named entities**, not mere presence — fabricated/empty
source is the upstream cause of the word-salad tier.

### P4 — Upgrade the STEP-2 generation prompt (§1)
The successful redo/cleanup prompts are effectively the spec the base prompt lacks. Bake in:
forbid concept-as-noun, forbid splicing source sentences verbatim into fields, forbid
fixed per-field templates and planning-note scenario openers; require real scenes,
realistic distractors, understanding-cards, and **one concrete named reader tool per
chapter** (the Purpose Receipt Check / Four-T Audit pattern markedly improved plans).

### P5 — Close the promotion/artifact gap (§5)
`promote-book` should re-derive from current loose chapters; add a check (hash/diff) that
the promoted package matches on-disk chapters, and a "package is stale / quarantined"
state for known-bad shipped books.

---

## 9. QC false-positive guards (so fixes don't over-correct)

Learned from outliers — do NOT flag these as defects:
- **Timestamps are fine inside coherent scenes** ("At 6:40 p.m. in the rink office, coach
  Renee studies a clipboard…"). The tell is specifically the *concept-as-label header*
  form with a *fixed identical time every chapter*, not the presence of a time.
- **A misconception-as-key is correct when the prompt asks for it** ("What is the
  simplistic reading to avoid?" rightly keys the misconception). Read the stem before
  flagging a "wrong key."
- A consistent pedagogical opener across chapters (e.g. deepRead "The mechanism is …:")
  is a convention, not templating, as long as the content differs and reads as prose.

---

## 10. What works (positive findings)

- **Targeted, QC-specific redo prompts land reliably** — with verbatim before/after
  examples and grep-based done-conditions, the generator recovered every time
  (range, dare-to-lead, drive, outliers). The generator CAN hit 88–92 publishable quality.
- A **section-by-section spec** (keep X, rewrite Y, add a named tool) outperforms "make it
  better." This is the template the base STEP-2 prompt should absorb (P4).
- **Reading beats the gate every time.** Until P0/P1 land, the mandatory human/agent
  content-read — on the thematic core chapters, against the publishable bar — is the only
  reliable backstop.
