# SOL Judge — Source-Register Divergence Packet

**Generated from run-3 preserved evidence** (no model call). **Disputed cases: 14.**

A **disputed case** = `gpt-5.6-sol@high` raised a reserved-category *fabrication / misleading-source* mustFix on an item AND a `gpt-5.5` judge (high or xhigh) did not. These passages are presented **neutrally** — they are **not** pre-classified as illustrative examples or as defects. Each case carries a **blank owner-adjudication field**. The complete reader-facing chapter (exactly what the reviewer saw), full mutation manifests, and gold for every case are in the `.json`.

> **What the reviewer received (identical for all cases):** the phase-1 rendered chapter ONLY. **Source plan: NOT visible. Source evidence: NOT visible. External book/chapter metadata: NOT visible. Answer key (phase-1): NOT visible.** The reviewer therefore could not verify whether any named referent is a real documented case or invented — it saw only the text.

> **gpt-5.6-sol ran 20/28** before its run was halted to surface the finding; disputed cases are drawn from those processed items.

## Summary

| # | caseId | kind | sol fab units | gpt-5.5@high | gpt-5.5@xhigh | people | orgs | dates | quotes | hist? |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | CLEAN-the-willpower-instinct-ch01 | clean-pass | examples 1-6 | no fab flag | no fab flag | Y | n | Y | n | Y |
| 2 | CLEAN-the-power-of-moments-ch01 | clean-pass | example 1, example 2, example 3, example 4, full read and example 5, example 6 | no fab flag | no fab flag | Y | Y | Y | n | Y |
| 3 | CLEAN-peak-ch01 | clean-pass | Examples 1-6 | no fab flag | no fab flag | Y | n | Y | Y | n |
| 4 | CLEAN-decisive-ch01 | clean-pass | example 1, example 2, example 3, example 4, example 5, example 6 | no fab flag | no fab flag | Y | n | Y | Y | n |
| 5 | CLEAN-the-willpower-instinct-ch02 | clean-pass | Examples 1-6, example 6 | no fab flag | no fab flag | Y | n | n | Y | Y |
| 6 | CLEAN-the-power-of-moments-ch02 | clean-pass | example 1, example 2, example 3, example 4, example 5, example 6 | no fab flag | no fab flag | Y | Y | n | n | Y |
| 7 | KEYMISMATCH-the-willpower-instinct-ch01-q1 | quiz-key-mismatch | example 1, example 2, example 3, example 4, example 5, example 6 | no fab flag | no fab flag | Y | n | Y | n | Y |
| 8 | KEYMISMATCH-the-power-of-moments-ch01-q1 | quiz-key-mismatch | example 1, example 2, example 4, example 5 | no fab flag | no fab flag | Y | Y | Y | n | Y |
| 9 | KEYMISMATCH-decisive-ch01-q1 | quiz-key-mismatch | example 1, example 2, example 3, example 4, example 5, example 6 | no fab flag | no fab flag | Y | n | Y | Y | n |
| 10 | CRAFT-the-willpower-instinct-ch02 | craft-nonblocker | example 1 | no fab flag | no fab flag | Y | n | n | Y | Y |
| 11 | CRAFT-the-power-of-moments-ch02 | craft-nonblocker | example 1, example 2, example 3, example 4, example 5, example 6 | no fab flag | no fab flag | Y | Y | n | n | Y |
| 12 | hardblocker-the-power-of-moments-ch1 | reader-visible-hard-blocker | example 1, example 2, example 3, example 4, example 5, example 6 | no fab flag | no fab flag | Y | Y | Y | n | Y |
| 13 | hardblocker-peak-ch1 | reader-visible-hard-blocker | example 1 | no fab flag | no fab flag | Y | n | Y | Y | n |
| 14 | hardblocker-decisive-ch1 | reader-visible-hard-blocker | example 1, example 2, example 3, example 5, example 6 | no fab flag | no fab flag | Y | n | Y | Y | n |

## Cases

### 1. LNV2-CLEAN-the-willpower-instinct-ch01  ·  _clean-pass_

- **Clean base:** `LNV2-CLEAN-the-willpower-instinct-ch01` · base content sha `4984962de1bb` · rendered-doc sha `9fdcea43132a`
- **Source anchors:** NONE — chapters carry no structured source anchors/citations/provenance fields (top-level keys: hook, breakdown, examples, quiz, reviewCards, implementationPlan, memorableLines).
- **Source-use form:** NAMED-CHARACTER NARRATIVE SCENARIO (no hypothetical-framing markers detected; presented as narrative)
- **Entities:** named people **yes** · orgs no · dates **yes** · quotations no · historical-occurrence-implied **yes**

**Disputed passage — examples 1-6:**

> (non-example unit — see JSON)

_Visible framing:_ presented as narrative (no hypothetical-framing markers detected)

**gpt-5.6-sol@high finding** (phase-1 composite 81.7, ship84 false, pass false):
- [mustFix] _examples 1-6_ — The named characters, detailed events, and direct quotations are presented as concrete cases without being labeled hypothetical or attributed to a source. This makes invented instructional vignettes look like reported events, a FABRICATED / MISLEADING EXAMPLE defect.
- _evidence spans:_ "The loudest want is not always the deepest want."✓ · "A goal must be present to have power."✓ · "'I thought you saw it,' someone says through the screen door after dinner, and W"✓ · "For the first half of this week, use your usual all-or-nothing rule. For the sec"✓

**gpt-5.5@high finding:** **no fabrication finding** (composite 85.1, ship84 true, pass true; other mustFix units: none)

**gpt-5.5@xhigh finding:** **no fabrication finding** (composite 85.5, ship84 true, pass true; other mustFix units: none)

**Phase-2:** N/A · **Mutation:** N/A (clean-pass control; not a variant) · **Gold:** `{"expectedPass":true,"prohibitMustFix":true}`

**Call-context manifest:** promptCard `df73b345d31e` · renderedChapter `9fdcea43132a` · sourcePlanVisibility **NONE** · sourceEvidenceVisibility **NONE** · bookChapterMetadataVisibility **NONE** · phase1Schema `df73b345d31e` · phase2Schema `chapterflow-review-v1:chapterflow-review-v1`

**▢ OWNER ADJUDICATION (blank):**
```
finalClassification:   [ SOL_FALSE_POSITIVE | CLEAN_CONTROL_NOT_ACTUALLY_CLEAN | REVIEW_CONTEXT_OR_RENDERING_DEFECT | GENUINE_BOUNDARY_CASE ]
reviewerRoleDisposition: [ QUALIFIED | UNQUALIFIED | INCONCLUSIVE ]
evidence:    
rationale:   
confidence:  
```

---

### 2. LNV2-CLEAN-the-power-of-moments-ch01  ·  _clean-pass_

- **Clean base:** `LNV2-CLEAN-the-power-of-moments-ch01` · base content sha `c5d9bbf8b745` · rendered-doc sha `631e4c7e1556`
- **Source anchors:** NONE — chapters carry no structured source anchors/citations/provenance fields (top-level keys: hook, breakdown, examples, quiz, reviewCards, implementationPlan, memorableLines).
- **Source-use form:** NAMED-CHARACTER NARRATIVE SCENARIO (no hypothetical-framing markers detected; presented as narrative)
- **Entities:** named people **yes** · orgs **yes** · dates **yes** · quotations no · historical-occurrence-implied **yes**

**Disputed passage — example 1 (ex01):**

> Parent Margaret expects a plain pool afternoon at the Magic Castle Hotel in Los Angeles. The building feels modest, and the pool script seems simple: towel, chair, sun. Then she sees the red phone by the pool. A child asks for popsicles, and a server brings free popsicles on a silver tray. Margaret must decide whether this is a snack or the story of the stay.
>
> _whatToDo:_ Margaret treats the red phone as the designed peak. She does not rate the day only by fixtures; she notices how the object, request, and tray make the pool feel different.

_Visible framing:_ presented as narrative (no hypothetical-framing markers detected) · proper nouns: The Red Pool Phone, Parent Margaret, Magic Castle Hotel, Los Angeles, Margaret, She · orgs: Magic Castle Hotel

**Disputed passage — example 2 (ex02):**

> Lorne waits at YES Prep, a Houston public charter network, during its college acceptance celebration. His college choice is already settled, but the room is not treating it like paperwork. When students announce college choices before the cheering crowd, his private next step becomes visible achievement. He has to receive the pride in public, not tuck it away.
>
> _whatToDo:_ Lorne says the college choice out loud and lets peers and adults witness the work behind it. The school marks the threshold before the move becomes private errands.

_Visible framing:_ presented as narrative (no hypothetical-framing markers detected) · proper nouns: The College Choice Out, Loud
Lorne, Prep, Houston, His, Lorne, Pride · orgs: The College

**Disputed passage — example 3 (ex03):**

> A trainer compares two cold-water trials before planning a hard practice. One is a 60-second painful trial. The other is a 90-second trial with milder ending. The choice that follows is strange: the longer discomfort can be remembered as the better one to repeat. The peak-end memory pattern forces duration to give up its claim as the only judge.
>
> _whatToDo:_ Use the comparison as a design warning. When an episode has a rough middle, do not assume a shorter clock will be remembered better than a kinder ending.

_Visible framing:_ presented as narrative (no hypothetical-framing markers detected) · proper nouns: The Longer Cold Trial, One, Use

**Disputed passage — example 4 (ex04):**

> Trainer Tristan runs a basic training note for new volunteers. The old draft ends with warnings, so the room leaves flat. He thinks of the cold-water contrast: a 60-second painful trial can lose in memory to a 90-second trial with milder ending. He keeps the rules, then adds a close where each person states the first task they will own.
>
> _whatToDo:_ Tristan changes the final minutes without hiding the rules. He adds a concrete role statement and a brief thanks so the session ends with pride and connection.

_Visible framing:_ presented as narrative (no hypothetical-framing markers detected) · proper nouns: The Training Close
Trainer, Tristan, People

**Disputed passage — full read and example 5 (ex05):**

> Leah sits at her kitchen table before her first adult volunteer mentor meeting. Her page is crowded with advice. The cold-water study gives her a different test: the 90-second trial with milder ending can be remembered better than the 60-second painful trial. She crosses out most of the lecture and writes one welcome, one question, and one warm close.
>
> _whatToDo:_ Leah trims the talk and designs the last minute. She will end by naming the next meeting plainly, so the first contact closes with a clear sign of return.

_Visible framing:_ presented as narrative (no hypothetical-framing markers detected) · proper nouns: The First Mentor Close, Leah, Her, She

**Disputed passage — example 6 (ex06):**

> At a community workshop, the final form is signed and the room starts to empty. The organizer borrows from YES Prep's Houston public charter network, where a college acceptance celebration has students announce college choices. She asks each learner to stand, name the next step, and accept a cheer before the chairs are stacked.
>
> _whatToDo:_ The organizer marks the transition before people leave. She makes the achievement public, brief, and witnessed instead of hiding it in a later message.

_Visible framing:_ presented as narrative (no hypothetical-framing markers detected) · proper nouns: The Workshop Threshold
At, Prep, Houston, She

**gpt-5.6-sol@high finding** (phase-1 composite 85.1, ship84 false, pass false):
- [mustFix] _example 1_ — FABRICATED / MISLEADING EXAMPLE: Margaret, her expectations, and her supposed decision are presented inside a real hotel example without being identified as hypothetical or supported by the chapter.
- [mustFix] _example 2_ — FABRICATED / MISLEADING EXAMPLE: Lorne is presented as a participant in a real YES Prep celebration, complete with internal experience, without being identified as hypothetical or sourced.
- [mustFix] _example 3_ — FABRICATED / MISLEADING EXAMPLE: An unnamed trainer is said to compare the cold-water trials while planning practice, blending a constructed application scenario with the reported study as though it happened.
- [mustFix] _example 4_ — FABRICATED / MISLEADING EXAMPLE: Trainer Tristan and his specific volunteer-training revision are narrated as an event without a hypothetical marker.
- [mustFix] _full read and example 5_ — FABRICATED / MISLEADING EXAMPLE: Leah's named mentoring vignette and internal editing process are presented as events without being labeled illustrative; the same unsupported story is then repeated.
- [mustFix] _example 6_ — FABRICATED / MISLEADING EXAMPLE: The workshop organizer's signing-and-cheering event is narrated as an occurrence without being identified as a hypothetical application.
- _evidence spans:_ "A red phone by a pool can outshine a whole hotel stay when it gives guests a sto"✓ · "This idea fails when the basic promise is broken. A red phone cannot make an uns"✓ · "Parent Margaret expects a plain pool afternoon at the Magic Castle Hotel in Los "✓ · "Lorne waits at YES Prep, a Houston public charter network, during its college ac"✓

**gpt-5.5@high finding:** **no fabrication finding** (composite 86.7, ship84 true, pass true; other mustFix units: none)

**gpt-5.5@xhigh finding:** **no fabrication finding** (composite 87, ship84 true, pass true; other mustFix units: none)

**Phase-2:** N/A · **Mutation:** N/A (clean-pass control; not a variant) · **Gold:** `{"expectedPass":true,"prohibitMustFix":true}`

**Call-context manifest:** promptCard `df73b345d31e` · renderedChapter `631e4c7e1556` · sourcePlanVisibility **NONE** · sourceEvidenceVisibility **NONE** · bookChapterMetadataVisibility **NONE** · phase1Schema `df73b345d31e` · phase2Schema `chapterflow-review-v1:chapterflow-review-v1`

**▢ OWNER ADJUDICATION (blank):**
```
finalClassification:   [ SOL_FALSE_POSITIVE | CLEAN_CONTROL_NOT_ACTUALLY_CLEAN | REVIEW_CONTEXT_OR_RENDERING_DEFECT | GENUINE_BOUNDARY_CASE ]
reviewerRoleDisposition: [ QUALIFIED | UNQUALIFIED | INCONCLUSIVE ]
evidence:    
rationale:   
confidence:  
```

---

### 3. LNV2-CLEAN-peak-ch01  ·  _clean-pass_

- **Clean base:** `LNV2-CLEAN-peak-ch01` · base content sha `7b893b35e30e` · rendered-doc sha `84ce1b4e707d`
- **Source anchors:** NONE — chapters carry no structured source anchors/citations/provenance fields (top-level keys: hook, breakdown, examples, quiz, reviewCards, implementationPlan, memorableLines).
- **Source-use form:** NAMED-CHARACTER NARRATIVE SCENARIO (no hypothetical-framing markers detected; presented as narrative)
- **Entities:** named people **yes** · orgs no · dates **yes** · quotations **yes** · historical-occurrence-implied no

**Disputed passage — Examples 1-6:**

> (non-example unit — see JSON)

_Visible framing:_ presented as narrative (no hypothetical-framing markers detected)

**gpt-5.6-sol@high finding** (phase-1 composite 89, ship84 false, pass false):
- [mustFix] _Examples 1-6_ — Named incidents, exact times and places, direct dialogue, and precise observations are written as documentary events without a hypothetical, composite, or source label. That makes invented illustrative detail indistinguishable from reported fact.
- _evidence spans:_ "The miss is the map because it tells the next rep where to aim."✓ · "The rep has to press beyond comfort far enough to reveal the miss, but not so fa"✓ · "At 8:10 p.m. Tuesday in the Halifax indoor range, recreational archer Megan lowe"✓ · "b) Uneven cuts can become fluent unless a visible size target guides the next cu"✓

**gpt-5.5@high finding:** **no fabrication finding** (composite 89.6, ship84 true, pass true; other mustFix units: none)

**gpt-5.5@xhigh finding:** **no fabrication finding** (composite 88.2, ship84 true, pass true; other mustFix units: none)

**Phase-2:** N/A · **Mutation:** N/A (clean-pass control; not a variant) · **Gold:** `{"expectedPass":true,"prohibitMustFix":true}`

**Call-context manifest:** promptCard `df73b345d31e` · renderedChapter `84ce1b4e707d` · sourcePlanVisibility **NONE** · sourceEvidenceVisibility **NONE** · bookChapterMetadataVisibility **NONE** · phase1Schema `df73b345d31e` · phase2Schema `chapterflow-review-v1:chapterflow-review-v1`

**▢ OWNER ADJUDICATION (blank):**
```
finalClassification:   [ SOL_FALSE_POSITIVE | CLEAN_CONTROL_NOT_ACTUALLY_CLEAN | REVIEW_CONTEXT_OR_RENDERING_DEFECT | GENUINE_BOUNDARY_CASE ]
reviewerRoleDisposition: [ QUALIFIED | UNQUALIFIED | INCONCLUSIVE ]
evidence:    
rationale:   
confidence:  
```

---

### 4. LNV2-CLEAN-decisive-ch01  ·  _clean-pass_

- **Clean base:** `LNV2-CLEAN-decisive-ch01` · base content sha `69cecca544e0` · rendered-doc sha `2473df4e3470`
- **Source anchors:** NONE — chapters carry no structured source anchors/citations/provenance fields (top-level keys: hook, breakdown, examples, quiz, reviewCards, implementationPlan, memorableLines).
- **Source-use form:** MIXED (some hypothetical framing markers present)
- **Entities:** named people **yes** · orgs no · dates **yes** · quotations **yes** · historical-occurrence-implied no

**Disputed passage — example 1 (decisive-ch01-ex01):**

> The HopeLab planner stands after lunch in HopeLab's project room, one portable activity device sketch clipped beside three firm names. No one else speaks yet. His mind tries the easy sentence: pick the safest vendor and move. Then Steve Cole's broader first lap nags at him. One firm could solve comfort, another could solve play, and another could show what the team has missed.
>
> _whatToDo:_ The HopeLab planner keeps the first phase parallel. He asks each design firm for a small, comparable pass before naming a winner.

_Visible framing:_ presented as narrative (no hypothetical-framing markers detected) · proper nouns: First Lap
The, His, Then Steve Cole, One

**Disputed passage — example 2 (decisive-ch01-ex02):**

> The prototype planner marks the budget wall on Monday morning in HopeLab's planning room. The portable activity device has enough money for depth, but not for waste. She weighs a polished pitch from one firm against smaller first passes from multiple design firms. Steve Cole's lesson sits in the math: the first dollars should purchase comparison, not premature loyalty.
>
> _whatToDo:_ The prototype planner funds smaller first passes from several firms and sets one shared review standard before a final design partner is chosen.

_Visible framing:_ presented as narrative (no hypothetical-framing markers detected) · proper nouns: Budget Before Bet
The, Monday, She, Steve Cole, Planning

**Disputed passage — example 3 (decisive-ch01-ex03):**

> The Intel reviewer reaches the Intel strategy review with two bad pages in his folder. One page protects memory chips and risks missing microprocessors. The other backs microprocessors and wounds the old identity. He is torn between the old business and the new path. Andy Grove's outsider question gives him a way through: what would a new leader do without the memory-chip attachment?
>
> _whatToDo:_ The Intel reviewer writes the outsider question at the top of the review page and judges the options from that cooler vantage point.

_Visible framing:_ presented as narrative (no hypothetical-framing markers detected) · proper nouns: Intel Outsider Question
The, Intel, One, Andy Grove, The Intel, Distance

**Disputed passage — example 4 (decisive-ch01-ex04):**

> The product lead taps the evidence folder in the product office during a late review call. The decision lead asks, "Which finding would make us change our mind?" The product lead reads the top sheet again. It praises the favored launch, but every source came from friendly users. The WRAP four-step process suddenly sounds less like a slogan and more like a search with teeth.
>
> _whatToDo:_ The product lead adds a disconfirming-evidence column and sends the decision lead to find users who stopped using the product.

_Visible framing:_ presented as narrative (no hypothetical-framing markers detected) · proper nouns: Search With Teeth
The, Which, Confirmation

**Disputed passage — example 5 (decisive-ch01-ex05):**

> Yvonne pins one clean launch forecast on the board, and the room expects the WRAP four villains to be done once the number looks careful. Then she uncovers the second sheet: three plausible ranges, all built from the same data. The reveal changes the decision cue. She must choose whether to plan for one future or prepare for several.
>
> _whatToDo:_ Yvonne keeps the range sheet visible and asks what the team would do if the low, middle, or high case showed up.

_Visible framing:_ hypothetical markers: picture · proper nouns: Forecast Range Reveal
Yvonne, She, Yvonne, Overconfidence

**Disputed passage — example 6 (decisive-ch01-ex06):**

> The team lead texts from the train platform before the decision meeting: "WRAP check. Which of the four villains is loudest?" A reply comes back: "All of them?" The team lead types four short lines: narrow frame, friendly evidence, hot feeling, single forecast. The four-step process stops being a poster and becomes a map for the next hour.
>
> _whatToDo:_ The team lead asks the group to name one villain first, then pick the matching WRAP move instead of trying to be broadly careful.

_Visible framing:_ presented as narrative (no hypothetical-framing markers detected) · proper nouns: Four Villains Thread
The, Which, All, Naming

**gpt-5.6-sol@high finding** (phase-1 composite 87.5, ship84 false, pass false):
- [mustFix] _example 1_ — The chapter invents an after-lunch HopeLab project-room scene and an unnamed planner's thoughts around a real case without identifying the vignette as hypothetical; this is a FABRICATED / MISLEADING EXAMPLE.
- [mustFix] _example 2_ — The Monday-morning HopeLab planning-room scene, budget wall, and prototype planner are unsupported fictional specifics presented without a hypothetical marker; this is a FABRICATED / MISLEADING EXAMPLE.
- [mustFix] _example 3_ — The Intel reviewer, strategy review, and two pages in his folder are invented details attached to a real historical case without being labeled fictional; this is a FABRICATED / MISLEADING EXAMPLE.
- [mustFix] _example 4_ — The product-office scene and quoted exchange are invented but presented as a concrete event rather than an explicit hypothetical; this is a FABRICATED / MISLEADING EXAMPLE.
- [mustFix] _example 5_ — Yvonne and the forecast-board reveal are introduced as a concrete event with no source or hypothetical framing; this is a FABRICATED / MISLEADING EXAMPLE.
- [mustFix] _example 6_ — The train-platform text exchange is fabricated dialogue presented without hypothetical framing; this is a FABRICATED / MISLEADING EXAMPLE.
- _evidence spans:_ "Evidence gets crooked when the favorite answer hires the researcher."✓ · "Good process raises the odds without promising the outcome."✓ · "The Intel reviewer reaches the Intel strategy review with two bad pages in his f"✓ · "The team lead texts from the train platform before the decision meeting: "WRAP c"✓

**gpt-5.5@high finding:** **no fabrication finding** (composite 85.7, ship84 true, pass true; other mustFix units: none)

**gpt-5.5@xhigh finding:** **no fabrication finding** (composite 87.3, ship84 true, pass true; other mustFix units: none)

**Phase-2:** N/A · **Mutation:** N/A (clean-pass control; not a variant) · **Gold:** `{"expectedPass":true,"prohibitMustFix":true}`

**Call-context manifest:** promptCard `df73b345d31e` · renderedChapter `2473df4e3470` · sourcePlanVisibility **NONE** · sourceEvidenceVisibility **NONE** · bookChapterMetadataVisibility **NONE** · phase1Schema `df73b345d31e` · phase2Schema `chapterflow-review-v1:chapterflow-review-v1`

**▢ OWNER ADJUDICATION (blank):**
```
finalClassification:   [ SOL_FALSE_POSITIVE | CLEAN_CONTROL_NOT_ACTUALLY_CLEAN | REVIEW_CONTEXT_OR_RENDERING_DEFECT | GENUINE_BOUNDARY_CASE ]
reviewerRoleDisposition: [ QUALIFIED | UNQUALIFIED | INCONCLUSIVE ]
evidence:    
rationale:   
confidence:  
```

---

### 5. LNV2-CLEAN-the-willpower-instinct-ch02  ·  _clean-pass_

- **Clean base:** `LNV2-CLEAN-the-willpower-instinct-ch02` · base content sha `e87d5da1e960` · rendered-doc sha `22ff85767028`
- **Source anchors:** NONE — chapters carry no structured source anchors/citations/provenance fields (top-level keys: hook, breakdown, examples, quiz, reviewCards, implementationPlan, memorableLines).
- **Source-use form:** NAMED-CHARACTER NARRATIVE SCENARIO (no hypothetical-framing markers detected; presented as narrative)
- **Entities:** named people **yes** · orgs no · dates no · quotations **yes** · historical-occurrence-implied **yes**

**Disputed passage — Examples 1-6:**

> (non-example unit — see JSON)

_Visible framing:_ presented as narrative (no hypothetical-framing markers detected)

**Disputed passage — example 6 (ex06):**

> The pastry case is brightest at the exact point where the line slows. Marlene can smell butter and sugar through the bakery glass. I can just decide at the register, she thinks. No, that is the trap. If I wait until the cheesecake is boxed, my body will vote first. She steps out of line, loses her spot, and lets the pause-and-plan response start before the craving peaks.
>
> _whatToDo:_ Marlene pays by giving up her place in line. She buys time with the small loss, then plans lunch away from the display instead of bargaining at the glass.

_Visible framing:_ presented as narrative (no hypothetical-framing markers detected) · proper nouns: Line Lost, Purpose
The, Marlene, She, Suzanne, Segerstrom, Lise Solberg Nes

**gpt-5.6-sol@high finding** (phase-1 composite 86.3, ship84 false, pass false):
- [mustFix] _Examples 1-6_ — All six are presented as concrete named events—and several include inner thoughts or dialogue—without identifying them as hypothetical composites; this makes invented people, events, and quotations read like reported cases.
- [mustFix] _example 6_ — The example attributes stepping out of line and creating precommitment runway to Segerstrom and Nes, extending their reported HRV association into an intervention claim the chapter has not established.
- _evidence spans:_ "Panic is a poor coach. Calm gives the future a vote."✓ · "A slower body can also become a hiding place."✓ · "The visible cost buys Landon the flexible state Amelie will need when the pastry"✓ · "The object carries the attention Yi-Yuan Tang trained through return practice."✓

**gpt-5.5@high finding:** **no fabrication finding** (composite 87, ship84 true, pass true; other mustFix units: none)

**gpt-5.5@xhigh finding:** **no fabrication finding** (composite 88.2, ship84 true, pass true; other mustFix units: none)

**Phase-2:** N/A · **Mutation:** N/A (clean-pass control; not a variant) · **Gold:** `{"expectedPass":true,"prohibitMustFix":true}`

**Call-context manifest:** promptCard `df73b345d31e` · renderedChapter `22ff85767028` · sourcePlanVisibility **NONE** · sourceEvidenceVisibility **NONE** · bookChapterMetadataVisibility **NONE** · phase1Schema `df73b345d31e` · phase2Schema `chapterflow-review-v1:chapterflow-review-v1`

**▢ OWNER ADJUDICATION (blank):**
```
finalClassification:   [ SOL_FALSE_POSITIVE | CLEAN_CONTROL_NOT_ACTUALLY_CLEAN | REVIEW_CONTEXT_OR_RENDERING_DEFECT | GENUINE_BOUNDARY_CASE ]
reviewerRoleDisposition: [ QUALIFIED | UNQUALIFIED | INCONCLUSIVE ]
evidence:    
rationale:   
confidence:  
```

---

### 6. LNV2-CLEAN-the-power-of-moments-ch02  ·  _clean-pass_

- **Clean base:** `LNV2-CLEAN-the-power-of-moments-ch02` · base content sha `5963208c5e34` · rendered-doc sha `f4349dc00bfc`
- **Source anchors:** NONE — chapters carry no structured source anchors/citations/provenance fields (top-level keys: hook, breakdown, examples, quiz, reviewCards, implementationPlan, memorableLines).
- **Source-use form:** MIXED (some hypothetical framing markers present)
- **Entities:** named people **yes** · orgs **yes** · dates no · quotations no · historical-occurrence-implied **yes**

**Disputed passage — example 1 (ex01):**

> Aiden walks into John Deere, the Moline-based equipment company, for a new employee first day. His folder could turn the morning into forms. His lead has a harder choice: start with rules, or frame factory work through customer purpose. The day points toward real farm-equipment users before routine tasks crowd the room.
>
> _whatToDo:_ Aiden's lead starts with purpose, then handles the packet. The role is tied to real farm-equipment users before the forms set the tone.

_Visible framing:_ presented as narrative (no hypothetical-framing markers detected) · proper nouns: Aiden Enters, Factory
Aiden, John Deere, Moline, His, Aiden · orgs: John Deere

**Disputed passage — example 2 (ex02):**

> Before the recognition, Genevieve's Mary Kay result is only a sales total in a direct-sales company record. After pink Cadillac recognition enters the story, the milestone has a form people can see from the curb. The car does not replace the achievement. It becomes one of the public achievement symbols that lets progress be noticed, congratulated, and remembered.
>
> _whatToDo:_ Genevieve gives the milestone a public marker: the Cadillac makes a completed sales level visible instead of leaving it buried in a private count.

_Visible framing:_ presented as narrative (no hypothetical-framing markers detected) · proper nouns: Genevieve Sees, Marker
Before, Genevieve, Mary Kay, Cadillac

**Disputed passage — example 3 (ex03):**

> Manon notices the empty place where Joshie, the stuffed giraffe, should be. Her family has lost the toy, and a plain return would fix only the object. Ritz-Carlton staff photos and special treatment give the recovery a warmer form. The loss becomes part of an extended guest-service recovery, not the last word on the trip.
>
> _whatToDo:_ The staff return the toy with proof of care. Photos and playful treatment show that the emotional stake was understood.

_Visible framing:_ presented as narrative (no hypothetical-framing markers detected) · proper nouns: Manon Finds, Empty Spot
Manon, Joshie, Her, Ritz, Carlton, Photos, Recovery

**Disputed passage — example 4 (ex04):**

> Eric's coffee is cooling while a first-day plan sits open at the shop table. He has circled the busiest handoff, then catches the error. John Deere's new employee first day does not point him to the busiest step. It points to the transition, where factory and customer-purpose framing can set what the job means before forms and routine tasks take over.
>
> _whatToDo:_ Eric moves the circle from the crowded handoff to the first encounter. He designs the start before he touches routine steps.

_Visible framing:_ presented as narrative (no hypothetical-framing markers detected) · proper nouns: Eric Moves, Circle
Eric, John Deere, Eric, Workload · orgs: John Deere

**Disputed passage — example 5 (ex05):**

> Genevieve's household chore chart is clean at week's end, which is the problem. By wiping each mark away, she hides progress. She weighs a private tally, then rejects it. Mary Kay's direct-sales company makes the pink Cadillac one of its public achievement symbols. She leaves the finished marks visible until the family names the milestone.
>
> _whatToDo:_ Genevieve keeps one progress marker visible before the chart resets. The family names the completed step instead of letting it vanish.

_Visible framing:_ hypothetical markers: picture · proper nouns: Genevieve Leaves, Marks
Genevieve, She, Mary Kay, Cadillac, Genevieve, Invisible

**Disputed passage — example 6 (ex06):**

> Manon opens a bedside notebook after her family lost stuffed giraffe Joshie and the recovery changed the day. A generic apology would have been easier to forget. Ritz-Carlton staff photos gave her family evidence of care, so her note names the concrete act inside the extended guest-service recovery, not just the word thanks.
>
> _whatToDo:_ Before sending thanks, she names the act that changed the story. The note stays concrete instead of praising service in general.

_Visible framing:_ presented as narrative (no hypothetical-framing markers detected) · proper nouns: Manon Writes, Care
Manon, Joshie, Ritz, Carlton

**gpt-5.6-sol@high finding** (phase-1 composite 83.8, ship84 false, pass false):
- [mustFix] _example 1_ — Aiden's named first day at John Deere is presented as a concrete branded event without being identified as hypothetical, making it a fabricated or misleading example.
- [mustFix] _example 2_ — Genevieve's Mary Kay sales result and Cadillac recognition are invented but narrated as an actual branded event rather than a hypothetical application.
- [mustFix] _example 3_ — The chapter inserts the invented Manon and her family into the Joshie Ritz-Carlton story without signaling fictionalization, misleading readers about who participated.
- [mustFix] _example 4_ — Eric's coffee-shop decision is an invented scene presented as concrete narrative; it should be labeled hypothetical or stripped of false documentary detail.
- [mustFix] _example 5_ — Genevieve's household chore-chart episode is an invented named event presented without a hypothetical label.
- [mustFix] _example 6_ — Manon's bedside-notebook scene extends the invented participant into another purported consequence of the branded Joshie recovery without identifying the scene as fictional.
- _evidence spans:_ "The busiest part of a process is not always the part people retell. Moment think"✓ · "If you add a ritual to every step, people stop trusting the cue."✓ · "Aiden walks into John Deere, the Moline-based equipment company, for a new emplo"✓ · "Before the recognition, Genevieve's Mary Kay result is only a sales total in a d"✓

**gpt-5.5@high finding:** **no fabrication finding** (composite 87.6, ship84 true, pass true; other mustFix units: none)

**gpt-5.5@xhigh finding:** **no fabrication finding** (composite 86.2, ship84 false, pass false; other mustFix units: none)

**Phase-2:** N/A · **Mutation:** N/A (clean-pass control; not a variant) · **Gold:** `{"expectedPass":true,"prohibitMustFix":true}`

**Call-context manifest:** promptCard `df73b345d31e` · renderedChapter `f4349dc00bfc` · sourcePlanVisibility **NONE** · sourceEvidenceVisibility **NONE** · bookChapterMetadataVisibility **NONE** · phase1Schema `df73b345d31e` · phase2Schema `chapterflow-review-v1:chapterflow-review-v1`

**▢ OWNER ADJUDICATION (blank):**
```
finalClassification:   [ SOL_FALSE_POSITIVE | CLEAN_CONTROL_NOT_ACTUALLY_CLEAN | REVIEW_CONTEXT_OR_RENDERING_DEFECT | GENUINE_BOUNDARY_CASE ]
reviewerRoleDisposition: [ QUALIFIED | UNQUALIFIED | INCONCLUSIVE ]
evidence:    
rationale:   
confidence:  
```

---

### 7. LNV2-KEYMISMATCH-the-willpower-instinct-ch01-q1  ·  _quiz-key-mismatch_

- **Clean base:** `LNV2-CLEAN-the-willpower-instinct-ch01` · base content sha `4984962de1bb` · rendered-doc sha `9fdcea43132a`
- **Source anchors:** NONE — chapters carry no structured source anchors/citations/provenance fields (top-level keys: hook, breakdown, examples, quiz, reviewCards, implementationPlan, memorableLines).
- **Source-use form:** NAMED-CHARACTER NARRATIVE SCENARIO (no hypothetical-framing markers detected; presented as narrative)
- **Entities:** named people **yes** · orgs no · dates **yes** · quotations no · historical-occurrence-implied **yes**

**Disputed passage — example 1 (the-willpower-instinct-ch01-ex01):**

> The clinic training room has a safe bet written on the whiteboard: a man who can talk after a rail accident can still steer himself. Vivian points the intake volunteers to Cavendish, Vermont, 1848, and the tamping iron in Phineas Gage's account. They expect survival to mean control. Then the exception arrives: planning and social restraint changed.
>
> _whatToDo:_ Vivian separates survival from self-command. She asks the volunteers to watch for the control layer, not just speech, charm, or a confident answer.

_Visible framing:_ presented as narrative (no hypothetical-framing markers detected) · proper nouns: The Survival Surprise
The, Vivian, Cavendish, Vermont, Phineas Gage, They, She, The Gage

**Disputed passage — example 2 (the-willpower-instinct-ch01-ex02):**

> 'I thought you saw it,' someone says through the screen door after dinner, and Warren checks the family thread from the back porch step. Meme, coupon, photo, refill notice. He types, 'Muting this for sanity.' A new line appears: 'Can anyone pick it up before closing?' This self-command problem is not just silence; it is care before the message sinks again.
>
> _whatToDo:_ Warren names the missing power before muting. He keeps the refusal, but adds one active step: answer the pickup message and set the refill where it cannot vanish.

_Visible framing:_ presented as narrative (no hypothetical-framing markers detected) · proper nouns: The Buried Refill, Warren, Meme, Muting, Can, Earl, Miller, Jonathan

**Disputed passage — example 3 (the-willpower-instinct-ch01-ex03):**

> 'Next chart, please,' the intake nurse says, and Amelia's hand is already on the label stack at the reception desk. The prefrontal job is easy until the rule meets an exception: scan card, attach form, move the line. Then a card and form do not match. Amelia stops the routine, peels the label back, and starts again with the I want first: protect the right patient.
>
> _whatToDo:_ Amelia interrupts the practiced sequence and restarts with the goal in view. She lets accuracy bias the next response instead of letting speed finish the action.

_Visible framing:_ presented as narrative (no hypothetical-framing markers detected) · proper nouns: The Label Pullback, Amelia, She, Automatic, Annual Review, Neuroscience

**Disputed passage — example 4 (the-willpower-instinct-ch01-ex04):**

> The running shoes wait under the gym bench; the vending machine across from Brooklyn hums brighter than the exit sign. After work in the locker room, the runner's thumb rests on a snack wrapper already split at one corner. The control-signal problem is plain: the snack is present, and the quieter want, feeling strong on Saturday's hill, needs a voice.
>
> _whatToDo:_ Brooklyn says the larger want in plain words before touching the wrapper again. She does not argue with the craving; she makes the run goal present too.

_Visible framing:_ presented as narrative (no hypothetical-framing markers detected) · proper nouns: Shoes Beside, Machine
The, Brooklyn, Saturday, She, Earl, Miller

**Disputed passage — example 5 (the-willpower-instinct-ch01-ex05):**

> The ride-list uncle loses signal during the family video call, and Jeanne, sitting on the back porch step with the tablet on her knee, is suddenly the relative unmuted after the therapy pickup reminder. 'I can skip the pharmacy,' a cousin says. 'That's I won't,' Jeanne answers. 'What is the I want?' A pause follows. 'granddad not waiting outside after therapy.' The self-command exception is clear: a promise is not just a task.
>
> _whatToDo:_ Jeanne keeps the call on the wanted commitment before anyone cuts a stop. She makes the family name who would pay the cost of the easy refusal.

_Visible framing:_ presented as narrative (no hypothetical-framing markers detected) · proper nouns: The Ride Call
The, Jeanne, What, She, Many, Jonathan, Cohen

**Disputed passage — example 6 (the-willpower-instinct-ch01-ex06):**

> The harsh text is already sent before Gemma sees the self-command problem clearly: 'You never handle the pharmacy pickup.' At the counter, an unread reply sits under the refill notice she missed. Her first story was character failure. She catches the mistake mid-breath, deletes the next blame line, and asks a better control question: which power failed here?
>
> _whatToDo:_ Gemma repairs the question before she repairs the schedule. She sorts the pickup into a next action, a tone to stop, and the care both people want protected.

_Visible framing:_ presented as narrative (no hypothetical-framing markers detected) · proper nouns: The Blame Text
The, Gemma, You, Her, She, Noticing, Earl, Miller

**gpt-5.6-sol@high finding** (phase-1 composite 79.9, ship84 false, pass false):
- [mustFix] _example 1_ — Vivian, the training-room event, and the volunteers' expectations are presented as a concrete occurrence without being labeled hypothetical. This is a FABRICATED / MISLEADING EXAMPLE.
- [mustFix] _example 2_ — Warren's named domestic scene and quoted dialogue are presented without any indication that they are hypothetical. This is a FABRICATED / MISLEADING EXAMPLE.
- [mustFix] _example 3_ — Amelia's named clinic incident and dialogue are presented as an occurrence without being labeled hypothetical. This is a FABRICATED / MISLEADING EXAMPLE.
- [mustFix] _example 4_ — Brooklyn's detailed locker-room scene is presented as an occurrence without being labeled hypothetical. This is a FABRICATED / MISLEADING EXAMPLE.
- [mustFix] _example 5_ — Jeanne's named family call and quoted dialogue are presented without being labeled hypothetical. This is a FABRICATED / MISLEADING EXAMPLE.
- [mustFix] _example 6_ — Gemma's named pharmacy incident and quoted text are presented without being labeled hypothetical. This is a FABRICATED / MISLEADING EXAMPLE.
- _evidence spans:_ "Willpower is the skill of making the longer want visible while the shorter want "✓ · "A goal must be present to have power."✓ · "The clinic training room has a safe bet written on the whiteboard: a man who can"✓ · "Weekly practice: For the first half of this week, use your usual all-or-nothing "✓

**gpt-5.5@high finding:** **no fabrication finding** (composite 85.4, ship84 true, pass false; other mustFix units: none)

**gpt-5.5@xhigh finding:** **no fabrication finding** (composite 83.2, ship84 false, pass false; other mustFix units: none)

**Phase-2:** see JSON (quiz adjudication captured) · **Mutation:** variant — manifest in JSON · **Gold:** `{"expectedKeyMismatchQuestions":[1]}`

**Call-context manifest:** promptCard `df73b345d31e` · renderedChapter `9fdcea43132a` · sourcePlanVisibility **NONE** · sourceEvidenceVisibility **NONE** · bookChapterMetadataVisibility **NONE** · phase1Schema `df73b345d31e` · phase2Schema `chapterflow-review-v1:chapterflow-review-v1`

**▢ OWNER ADJUDICATION (blank):**
```
finalClassification:   [ SOL_FALSE_POSITIVE | CLEAN_CONTROL_NOT_ACTUALLY_CLEAN | REVIEW_CONTEXT_OR_RENDERING_DEFECT | GENUINE_BOUNDARY_CASE ]
reviewerRoleDisposition: [ QUALIFIED | UNQUALIFIED | INCONCLUSIVE ]
evidence:    
rationale:   
confidence:  
```

---

### 8. LNV2-KEYMISMATCH-the-power-of-moments-ch01-q1  ·  _quiz-key-mismatch_

- **Clean base:** `LNV2-CLEAN-the-power-of-moments-ch01` · base content sha `c5d9bbf8b745` · rendered-doc sha `631e4c7e1556`
- **Source anchors:** NONE — chapters carry no structured source anchors/citations/provenance fields (top-level keys: hook, breakdown, examples, quiz, reviewCards, implementationPlan, memorableLines).
- **Source-use form:** NAMED-CHARACTER NARRATIVE SCENARIO (no hypothetical-framing markers detected; presented as narrative)
- **Entities:** named people **yes** · orgs **yes** · dates **yes** · quotations no · historical-occurrence-implied **yes**

**Disputed passage — example 1 (ex01):**

> Parent Margaret expects a plain pool afternoon at the Magic Castle Hotel in Los Angeles. The building feels modest, and the pool script seems simple: towel, chair, sun. Then she sees the red phone by the pool. A child asks for popsicles, and a server brings free popsicles on a silver tray. Margaret must decide whether this is a snack or the story of the stay.
>
> _whatToDo:_ Margaret treats the red phone as the designed peak. She does not rate the day only by fixtures; she notices how the object, request, and tray make the pool feel different.

_Visible framing:_ presented as narrative (no hypothetical-framing markers detected) · proper nouns: The Red Pool Phone, Parent Margaret, Magic Castle Hotel, Los Angeles, Margaret, She · orgs: Magic Castle Hotel

**Disputed passage — example 2 (ex02):**

> Lorne waits at YES Prep, a Houston public charter network, during its college acceptance celebration. His college choice is already settled, but the room is not treating it like paperwork. When students announce college choices before the cheering crowd, his private next step becomes visible achievement. He has to receive the pride in public, not tuck it away.
>
> _whatToDo:_ Lorne says the college choice out loud and lets peers and adults witness the work behind it. The school marks the threshold before the move becomes private errands.

_Visible framing:_ presented as narrative (no hypothetical-framing markers detected) · proper nouns: The College Choice Out, Loud
Lorne, Prep, Houston, His, Lorne, Pride · orgs: The College

**Disputed passage — example 4 (ex04):**

> Trainer Tristan runs a basic training note for new volunteers. The old draft ends with warnings, so the room leaves flat. He thinks of the cold-water contrast: a 60-second painful trial can lose in memory to a 90-second trial with milder ending. He keeps the rules, then adds a close where each person states the first task they will own.
>
> _whatToDo:_ Tristan changes the final minutes without hiding the rules. He adds a concrete role statement and a brief thanks so the session ends with pride and connection.

_Visible framing:_ presented as narrative (no hypothetical-framing markers detected) · proper nouns: The Training Close
Trainer, Tristan, People

**Disputed passage — example 5 (ex05):**

> Leah sits at her kitchen table before her first adult volunteer mentor meeting. Her page is crowded with advice. The cold-water study gives her a different test: the 90-second trial with milder ending can be remembered better than the 60-second painful trial. She crosses out most of the lecture and writes one welcome, one question, and one warm close.
>
> _whatToDo:_ Leah trims the talk and designs the last minute. She will end by naming the next meeting plainly, so the first contact closes with a clear sign of return.

_Visible framing:_ presented as narrative (no hypothetical-framing markers detected) · proper nouns: The First Mentor Close, Leah, Her, She

**gpt-5.6-sol@high finding** (phase-1 composite 89, ship84 false, pass false):
- [mustFix] _example 1_ — The text presents the named parent Margaret as participating in an event at a real hotel without identifying her as a hypothetical character; this is a fabricated or misleading example.
- [mustFix] _example 2_ — The text presents Lorne as a participant at the real YES Prep network without identifying the person or scene as hypothetical; this is a fabricated or misleading example.
- [mustFix] _example 4_ — The named trainer Tristan and his decision prompted by the cold-water study are narrated as events rather than clearly labeled illustration; this is a fabricated or misleading example.
- [mustFix] _example 5_ — The chapter asserts that the cold-water study changes Leah's planning, an invented causal event not established by the earlier Leah vignette or labeled hypothetical; this is a fabricated or misleading example.
- _evidence spans:_ "Memory keeps score in odd ways. It does not average each minute. It holds what r"✓ · "A red phone cannot make an unsafe pool feel fine. A ceremony cannot replace real"✓ · "Parent Margaret expects a plain pool afternoon at the Magic Castle Hotel in Los "✓ · "The cold-water study gives her a different test: the 90-second trial with milder"✓

**gpt-5.5@high finding:** **no fabrication finding** (composite 85.4, ship84 false, pass false; other mustFix units: none)

**gpt-5.5@xhigh finding:** **no fabrication finding** (composite 88.2, ship84 true, pass false; other mustFix units: none)

**Phase-2:** see JSON (quiz adjudication captured) · **Mutation:** variant — manifest in JSON · **Gold:** `{"expectedKeyMismatchQuestions":[1]}`

**Call-context manifest:** promptCard `df73b345d31e` · renderedChapter `631e4c7e1556` · sourcePlanVisibility **NONE** · sourceEvidenceVisibility **NONE** · bookChapterMetadataVisibility **NONE** · phase1Schema `df73b345d31e` · phase2Schema `chapterflow-review-v1:chapterflow-review-v1`

**▢ OWNER ADJUDICATION (blank):**
```
finalClassification:   [ SOL_FALSE_POSITIVE | CLEAN_CONTROL_NOT_ACTUALLY_CLEAN | REVIEW_CONTEXT_OR_RENDERING_DEFECT | GENUINE_BOUNDARY_CASE ]
reviewerRoleDisposition: [ QUALIFIED | UNQUALIFIED | INCONCLUSIVE ]
evidence:    
rationale:   
confidence:  
```

---

### 9. LNV2-KEYMISMATCH-decisive-ch01-q1  ·  _quiz-key-mismatch_

- **Clean base:** `LNV2-CLEAN-decisive-ch01` · base content sha `69cecca544e0` · rendered-doc sha `2473df4e3470`
- **Source anchors:** NONE — chapters carry no structured source anchors/citations/provenance fields (top-level keys: hook, breakdown, examples, quiz, reviewCards, implementationPlan, memorableLines).
- **Source-use form:** MIXED (some hypothetical framing markers present)
- **Entities:** named people **yes** · orgs no · dates **yes** · quotations **yes** · historical-occurrence-implied no

**Disputed passage — example 1 (decisive-ch01-ex01):**

> The HopeLab planner stands after lunch in HopeLab's project room, one portable activity device sketch clipped beside three firm names. No one else speaks yet. His mind tries the easy sentence: pick the safest vendor and move. Then Steve Cole's broader first lap nags at him. One firm could solve comfort, another could solve play, and another could show what the team has missed.
>
> _whatToDo:_ The HopeLab planner keeps the first phase parallel. He asks each design firm for a small, comparable pass before naming a winner.

_Visible framing:_ presented as narrative (no hypothetical-framing markers detected) · proper nouns: First Lap
The, His, Then Steve Cole, One

**Disputed passage — example 2 (decisive-ch01-ex02):**

> The prototype planner marks the budget wall on Monday morning in HopeLab's planning room. The portable activity device has enough money for depth, but not for waste. She weighs a polished pitch from one firm against smaller first passes from multiple design firms. Steve Cole's lesson sits in the math: the first dollars should purchase comparison, not premature loyalty.
>
> _whatToDo:_ The prototype planner funds smaller first passes from several firms and sets one shared review standard before a final design partner is chosen.

_Visible framing:_ presented as narrative (no hypothetical-framing markers detected) · proper nouns: Budget Before Bet
The, Monday, She, Steve Cole, Planning

**Disputed passage — example 3 (decisive-ch01-ex03):**

> The Intel reviewer reaches the Intel strategy review with two bad pages in his folder. One page protects memory chips and risks missing microprocessors. The other backs microprocessors and wounds the old identity. He is torn between the old business and the new path. Andy Grove's outsider question gives him a way through: what would a new leader do without the memory-chip attachment?
>
> _whatToDo:_ The Intel reviewer writes the outsider question at the top of the review page and judges the options from that cooler vantage point.

_Visible framing:_ presented as narrative (no hypothetical-framing markers detected) · proper nouns: Intel Outsider Question
The, Intel, One, Andy Grove, The Intel, Distance

**Disputed passage — example 4 (decisive-ch01-ex04):**

> The product lead taps the evidence folder in the product office during a late review call. The decision lead asks, "Which finding would make us change our mind?" The product lead reads the top sheet again. It praises the favored launch, but every source came from friendly users. The WRAP four-step process suddenly sounds less like a slogan and more like a search with teeth.
>
> _whatToDo:_ The product lead adds a disconfirming-evidence column and sends the decision lead to find users who stopped using the product.

_Visible framing:_ presented as narrative (no hypothetical-framing markers detected) · proper nouns: Search With Teeth
The, Which, Confirmation

**Disputed passage — example 5 (decisive-ch01-ex05):**

> Yvonne pins one clean launch forecast on the board, and the room expects the WRAP four villains to be done once the number looks careful. Then she uncovers the second sheet: three plausible ranges, all built from the same data. The reveal changes the decision cue. She must choose whether to plan for one future or prepare for several.
>
> _whatToDo:_ Yvonne keeps the range sheet visible and asks what the team would do if the low, middle, or high case showed up.

_Visible framing:_ hypothetical markers: picture · proper nouns: Forecast Range Reveal
Yvonne, She, Yvonne, Overconfidence

**Disputed passage — example 6 (decisive-ch01-ex06):**

> The team lead texts from the train platform before the decision meeting: "WRAP check. Which of the four villains is loudest?" A reply comes back: "All of them?" The team lead types four short lines: narrow frame, friendly evidence, hot feeling, single forecast. The four-step process stops being a poster and becomes a map for the next hour.
>
> _whatToDo:_ The team lead asks the group to name one villain first, then pick the matching WRAP move instead of trying to be broadly careful.

_Visible framing:_ presented as narrative (no hypothetical-framing markers detected) · proper nouns: Four Villains Thread
The, Which, All, Naming

**gpt-5.6-sol@high finding** (phase-1 composite 84.3, ship84 false, pass false):
- [mustFix] _example 1_ — FABRICATED / MISLEADING EXAMPLE: an unverified HopeLab planner, project-room scene, silence, and internal thoughts are presented as concrete narrative without being marked hypothetical.
- [mustFix] _example 2_ — FABRICATED / MISLEADING EXAMPLE: a prototype planner, Monday meeting, budget wall, and deliberation are invented around the HopeLab case without a hypothetical label.
- [mustFix] _example 3_ — FABRICATED / MISLEADING EXAMPLE: an Intel reviewer, strategy meeting, folder contents, and personal conflict are presented as a specific event unsupported by the chapter's factual Intel account.
- [mustFix] _example 4_ — FABRICATED / MISLEADING EXAMPLE: the late review call, evidence folder, friendly-user finding, and direct quotation are narrated as events without being identified as a constructed scenario.
- [mustFix] _example 5_ — FABRICATED / MISLEADING EXAMPLE and SOURCE-CONTRADICTORY wording: the named person and forecast-board reveal are unsupported, while "WRAP four villains" blurs the chapter's explicit distinction between four villains and four repair moves.
- [mustFix] _example 6_ — FABRICATED / MISLEADING EXAMPLE: the train-platform exchange includes invented direct quotations and an event presented without a hypothetical label.
- _evidence spans:_ "A live option set keeps a bad frame from feeling like fate."✓ · "Good process raises the odds without promising the outcome."✓ · "Yvonne pins one clean launch forecast on the board, and the room expects the WRA"✓ · "The next time a quick call pulls at you, touch your laptop lid and record the cu"✓

**gpt-5.5@high finding:** **no fabrication finding** (composite 85.8, ship84 true, pass false; other mustFix units: none)

**gpt-5.5@xhigh finding:** **no fabrication finding** (composite 89.5, ship84 true, pass false; other mustFix units: none)

**Phase-2:** see JSON (quiz adjudication captured) · **Mutation:** variant — manifest in JSON · **Gold:** `{"expectedKeyMismatchQuestions":[1]}`

**Call-context manifest:** promptCard `df73b345d31e` · renderedChapter `2473df4e3470` · sourcePlanVisibility **NONE** · sourceEvidenceVisibility **NONE** · bookChapterMetadataVisibility **NONE** · phase1Schema `df73b345d31e` · phase2Schema `chapterflow-review-v1:chapterflow-review-v1`

**▢ OWNER ADJUDICATION (blank):**
```
finalClassification:   [ SOL_FALSE_POSITIVE | CLEAN_CONTROL_NOT_ACTUALLY_CLEAN | REVIEW_CONTEXT_OR_RENDERING_DEFECT | GENUINE_BOUNDARY_CASE ]
reviewerRoleDisposition: [ QUALIFIED | UNQUALIFIED | INCONCLUSIVE ]
evidence:    
rationale:   
confidence:  
```

---

### 10. LNV2-CRAFT-the-willpower-instinct-ch02  ·  _craft-nonblocker_

- **Clean base:** `LNV2-CLEAN-the-willpower-instinct-ch02` · base content sha `e87d5da1e960` · rendered-doc sha `d7a8844ad8d2`
- **Source anchors:** NONE — chapters carry no structured source anchors/citations/provenance fields (top-level keys: hook, breakdown, examples, quiz, reviewCards, implementationPlan, memorableLines).
- **Source-use form:** NAMED-CHARACTER NARRATIVE SCENARIO (no hypothetical-framing markers detected; presented as narrative)
- **Entities:** named people **yes** · orgs no · dates no · quotations **yes** · historical-occurrence-implied **yes**

**Disputed passage — example 1 (ex01):**

> Two pulse straps, two paper plates, one slice of cheesecake. Landon leaves the lab snack table first, giving up the easy laugh with the other trainees. Amelie stays near the tray and promises she will fight harder when the craving rises. The heart rate variability lesson from Suzanne C. Segerstrom and Lise Solberg Nes is still on the board: flexible bodies get more room to pause.
>
> _whatToDo:_ Landon gives up the social snack moment before any reward arrives. He walks out with water, slows his breathing, and lets the craving cool before deciding.

_Visible framing:_ presented as narrative (no hypothetical-framing markers detected) · proper nouns: Snack Table Cost
Two, Landon, Amelie, Suzanne, Segerstrom, Lise Solberg Nes, Nes

**gpt-5.6-sol@high finding** (phase-1 composite 83.5, ship84 false, pass false):
- [mustFix] _example 1_ — The example claims that paying a visible social cost buys a flexible physiological state, but the chapter only establishes that variability is associated with self-regulation; it does not show that leaving the table produces that state. This is a misleading example.
- _evidence spans:_ "Panic is a poor coach. Calm gives the future a vote."✓ · "Pause-and-plan is not a way to avoid the hard act; it is a way to arrive at it w"✓ · "The visible cost buys Landon the flexible state Amelie will need when the pastry"✓ · "In the end, this is the kind of move worth practicing until it feels routine."✓

**gpt-5.5@high finding:** **no fabrication finding** (composite 87.4, ship84 true, pass true; other mustFix units: none)

**gpt-5.5@xhigh finding:** **no fabrication finding** (composite 88.2, ship84 true, pass true; other mustFix units: none)

**Phase-2:** N/A · **Mutation:** variant — manifest in JSON · **Gold:** `{"prohibitMustFix":true,"targetUnits":["example 2"]}`

**Call-context manifest:** promptCard `df73b345d31e` · renderedChapter `d7a8844ad8d2` · sourcePlanVisibility **NONE** · sourceEvidenceVisibility **NONE** · bookChapterMetadataVisibility **NONE** · phase1Schema `df73b345d31e` · phase2Schema `chapterflow-review-v1:chapterflow-review-v1`

**▢ OWNER ADJUDICATION (blank):**
```
finalClassification:   [ SOL_FALSE_POSITIVE | CLEAN_CONTROL_NOT_ACTUALLY_CLEAN | REVIEW_CONTEXT_OR_RENDERING_DEFECT | GENUINE_BOUNDARY_CASE ]
reviewerRoleDisposition: [ QUALIFIED | UNQUALIFIED | INCONCLUSIVE ]
evidence:    
rationale:   
confidence:  
```

---

### 11. LNV2-CRAFT-the-power-of-moments-ch02  ·  _craft-nonblocker_

- **Clean base:** `LNV2-CLEAN-the-power-of-moments-ch02` · base content sha `5963208c5e34` · rendered-doc sha `7995288f3bfb`
- **Source anchors:** NONE — chapters carry no structured source anchors/citations/provenance fields (top-level keys: hook, breakdown, examples, quiz, reviewCards, implementationPlan, memorableLines).
- **Source-use form:** MIXED (some hypothetical framing markers present)
- **Entities:** named people **yes** · orgs **yes** · dates no · quotations no · historical-occurrence-implied **yes**

**Disputed passage — example 1 (ex01):**

> Aiden walks into John Deere, the Moline-based equipment company, for a new employee first day. His folder could turn the morning into forms. His lead has a harder choice: start with rules, or frame factory work through customer purpose. The day points toward real farm-equipment users before routine tasks crowd the room.
>
> _whatToDo:_ Aiden's lead starts with purpose, then handles the packet. The role is tied to real farm-equipment users before the forms set the tone.

_Visible framing:_ presented as narrative (no hypothetical-framing markers detected) · proper nouns: Aiden Enters, Factory
Aiden, John Deere, Moline, His, Aiden · orgs: John Deere

**Disputed passage — example 2 (ex02):**

> Before the recognition, Genevieve's Mary Kay result is only a sales total in a direct-sales company record. After pink Cadillac recognition enters the story, the milestone has a form people can see from the curb. The car does not replace the achievement. It becomes one of the public achievement symbols that lets progress be noticed, congratulated, and remembered.
>
> _whatToDo:_ Genevieve gives the milestone a public marker: the Cadillac makes a completed sales level visible instead of leaving it buried in a private count.

_Visible framing:_ presented as narrative (no hypothetical-framing markers detected) · proper nouns: Genevieve Sees, Marker
Before, Genevieve, Mary Kay, Cadillac

**Disputed passage — example 3 (ex03):**

> Manon notices the empty place where Joshie, the stuffed giraffe, should be. Her family has lost the toy, and a plain return would fix only the object. Ritz-Carlton staff photos and special treatment give the recovery a warmer form. The loss becomes part of an extended guest-service recovery, not the last word on the trip.
>
> _whatToDo:_ The staff return the toy with proof of care. Photos and playful treatment show that the emotional stake was understood.

_Visible framing:_ presented as narrative (no hypothetical-framing markers detected) · proper nouns: Manon Finds, Empty Spot
Manon, Joshie, Her, Ritz, Carlton, Photos, Recovery

**Disputed passage — example 4 (ex04):**

> Eric's coffee is cooling while a first-day plan sits open at the shop table. He has circled the busiest handoff, then catches the error. John Deere's new employee first day does not point him to the busiest step. It points to the transition, where factory and customer-purpose framing can set what the job means before forms and routine tasks take over.
>
> _whatToDo:_ Eric moves the circle from the crowded handoff to the first encounter. He designs the start before he touches routine steps.

_Visible framing:_ presented as narrative (no hypothetical-framing markers detected) · proper nouns: Eric Moves, Circle
Eric, John Deere, Eric, Workload · orgs: John Deere

**Disputed passage — example 5 (ex05):**

> Genevieve's household chore chart is clean at week's end, which is the problem. By wiping each mark away, she hides progress. She weighs a private tally, then rejects it. Mary Kay's direct-sales company makes the pink Cadillac one of its public achievement symbols. She leaves the finished marks visible until the family names the milestone.
>
> _whatToDo:_ Genevieve keeps one progress marker visible before the chart resets. The family names the completed step instead of letting it vanish.

_Visible framing:_ hypothetical markers: picture · proper nouns: Genevieve Leaves, Marks
Genevieve, She, Mary Kay, Cadillac, Genevieve, Invisible

**Disputed passage — example 6 (ex06):**

> Manon opens a bedside notebook after her family lost stuffed giraffe Joshie and the recovery changed the day. A generic apology would have been easier to forget. Ritz-Carlton staff photos gave her family evidence of care, so her note names the concrete act inside the extended guest-service recovery, not just the word thanks.
>
> _whatToDo:_ Before sending thanks, she names the act that changed the story. The note stays concrete instead of praising service in general.

_Visible framing:_ presented as narrative (no hypothetical-framing markers detected) · proper nouns: Manon Writes, Care
Manon, Joshie, Ritz, Carlton

**gpt-5.6-sol@high finding** (phase-1 composite 85.3, ship84 false, pass false):
- [mustFix] _example 1_ — Aiden and his specific John Deere first-day event appear invented but are presented as factual narrative rather than a hypothetical scenario; this is a fabricated/misleading example.
- [mustFix] _example 2_ — Genevieve's personal Mary Kay result and recognition event appear invented and are presented without any hypothetical framing; this is a fabricated/misleading example.
- [mustFix] _example 3_ — The chapter inserts Manon into the Joshie recovery as though she personally experienced the event, without establishing that identity or labeling the scene as fictional; this is a fabricated/misleading example.
- [mustFix] _example 4_ — Eric's coffee-shop planning scene is an invented event written as factual narrative rather than a labeled illustration; this is a fabricated/misleading example.
- [mustFix] _example 5_ — Genevieve's chore-chart episode is an invented household event presented as something that happened, making it a fabricated/misleading example.
- [mustFix] _example 6_ — Manon's bedside-notebook episode appears invented but is attached to the Joshie case as factual narrative; this is a fabricated/misleading example.
- _evidence spans:_ "The busy middle is not the whole story."✓ · "At a transition, frame the purpose; at a milestone, make progress visible; at a "✓ · "Eric's coffee is cooling while a first-day plan sits open at the shop table."✓ · "Aiden walks into John Deere, the Moline-based equipment company, for a new emplo"✓

**gpt-5.5@high finding:** **no fabrication finding** (composite 85.9, ship84 true, pass true; other mustFix units: none)

**gpt-5.5@xhigh finding:** **no fabrication finding** (composite 85.5, ship84 true, pass true; other mustFix units: none)

**Phase-2:** N/A · **Mutation:** variant — manifest in JSON · **Gold:** `{"prohibitMustFix":true,"targetUnits":["example 2"]}`

**Call-context manifest:** promptCard `df73b345d31e` · renderedChapter `7995288f3bfb` · sourcePlanVisibility **NONE** · sourceEvidenceVisibility **NONE** · bookChapterMetadataVisibility **NONE** · phase1Schema `df73b345d31e` · phase2Schema `chapterflow-review-v1:chapterflow-review-v1`

**▢ OWNER ADJUDICATION (blank):**
```
finalClassification:   [ SOL_FALSE_POSITIVE | CLEAN_CONTROL_NOT_ACTUALLY_CLEAN | REVIEW_CONTEXT_OR_RENDERING_DEFECT | GENUINE_BOUNDARY_CASE ]
reviewerRoleDisposition: [ QUALIFIED | UNQUALIFIED | INCONCLUSIVE ]
evidence:    
rationale:   
confidence:  
```

---

### 12. hardblocker-the-power-of-moments-ch1  ·  _reader-visible-hard-blocker_

- **Clean base:** `LNV2-CLEAN-the-power-of-moments-ch01` · base content sha `c5d9bbf8b745` · rendered-doc sha `cbc8ec485a82`
- **Source anchors:** NONE — chapters carry no structured source anchors/citations/provenance fields (top-level keys: hook, breakdown, examples, quiz, reviewCards, implementationPlan, memorableLines).
- **Source-use form:** NAMED-CHARACTER NARRATIVE SCENARIO (no hypothetical-framing markers detected; presented as narrative)
- **Entities:** named people **yes** · orgs **yes** · dates **yes** · quotations no · historical-occurrence-implied **yes**

**Disputed passage — example 1 (ex01):**

> Parent Margaret expects a plain pool afternoon at the Magic Castle Hotel in Los Angeles. The building feels modest, and the pool script seems simple: towel, chair, sun. Then she sees the red phone by the pool. A child asks for popsicles, and a server brings free popsicles on a silver tray. Margaret must decide whether this is a snack or the story of the stay.
>
> _whatToDo:_ Margaret treats the red phone as the designed peak. She does not rate the day only by fixtures; she notices how the object, request, and tray make the pool feel different.

_Visible framing:_ presented as narrative (no hypothetical-framing markers detected) · proper nouns: The Red Pool Phone, Parent Margaret, Magic Castle Hotel, Los Angeles, Margaret, She · orgs: Magic Castle Hotel

**Disputed passage — example 2 (ex02):**

> Lorne waits at YES Prep, a Houston public charter network, during its college acceptance celebration. His college choice is already settled, but the room is not treating it like paperwork. When students announce college choices before the cheering crowd, his private next step becomes visible achievement. He has to receive the pride in public, not tuck it away.
>
> _whatToDo:_ Lorne says the college choice out loud and lets peers and adults witness the work behind it. The school marks the threshold before the move becomes private errands.

_Visible framing:_ presented as narrative (no hypothetical-framing markers detected) · proper nouns: The College Choice Out, Loud
Lorne, Prep, Houston, His, Lorne, Pride · orgs: The College

**Disputed passage — example 3 (ex03):**

> A trainer compares two cold-water trials before planning a hard practice. One is a 60-second painful trial. The other is a 90-second trial with milder ending. The choice that follows is strange: the longer discomfort can be remembered as the better one to repeat. The peak-end memory pattern forces duration to give up its claim as the only judge.
>
> _whatToDo:_ Use the comparison as a design warning. When an episode has a rough middle, do not assume a shorter clock will be remembered better than a kinder ending. The real takeaway is to make every episode as short as possible, because memory simply records total duration and the final moments carry no special weight.

_Visible framing:_ presented as narrative (no hypothetical-framing markers detected) · proper nouns: The Longer Cold Trial, One, Use

**Disputed passage — example 4 (ex04):**

> Trainer Tristan runs a basic training note for new volunteers. The old draft ends with warnings, so the room leaves flat. He thinks of the cold-water contrast: a 60-second painful trial can lose in memory to a 90-second trial with milder ending. He keeps the rules, then adds a close where each person states the first task they will own.
>
> _whatToDo:_ Tristan changes the final minutes without hiding the rules. He adds a concrete role statement and a brief thanks so the session ends with pride and connection.

_Visible framing:_ presented as narrative (no hypothetical-framing markers detected) · proper nouns: The Training Close
Trainer, Tristan, People

**Disputed passage — example 5 (ex05):**

> Leah sits at her kitchen table before her first adult volunteer mentor meeting. Her page is crowded with advice. The cold-water study gives her a different test: the 90-second trial with milder ending can be remembered better than the 60-second painful trial. She crosses out most of the lecture and writes one welcome, one question, and one warm close.
>
> _whatToDo:_ Leah trims the talk and designs the last minute. She will end by naming the next meeting plainly, so the first contact closes with a clear sign of return.

_Visible framing:_ presented as narrative (no hypothetical-framing markers detected) · proper nouns: The First Mentor Close, Leah, Her, She

**Disputed passage — example 6 (ex06):**

> At a community workshop, the final form is signed and the room starts to empty. The organizer borrows from YES Prep's Houston public charter network, where a college acceptance celebration has students announce college choices. She asks each learner to stand, name the next step, and accept a cheer before the chairs are stacked.
>
> _whatToDo:_ The organizer marks the transition before people leave. She makes the achievement public, brief, and witnessed instead of hiding it in a later message.

_Visible framing:_ presented as narrative (no hypothetical-framing markers detected) · proper nouns: The Workshop Threshold
At, Prep, Houston, She

**gpt-5.6-sol@high finding** (phase-1 composite 85.6, ship84 false, pass false):
- [mustFix] _example 1_ — Margaret is presented as a specific parent having an observed experience, but the chapter provides no indication that she is real or labels her as hypothetical; this makes the example misleadingly factual.
- [mustFix] _example 2_ — Lorne is presented as a specific YES Prep student in an actual-seeming event without being identified as a hypothetical or composite, creating a fabricated/misleading example.
- [mustFix] _example 3_ — The invented trainer wrapper is presented as an actual scenario rather than being clearly labeled hypothetical.
- [mustFix] _example 4_ — Trainer Tristan and his training session are presented as a concrete occurrence without being labeled hypothetical, making the example fabricated/misleading.
- [mustFix] _example 5_ — Leah and her mentoring situation are narrated as concrete events without any disclosure that the character is hypothetical or composite.
- [mustFix] _example 6_ — The community workshop ritual is narrated as an event that occurred, although no real organizer or workshop is identified and the scenario is not labeled hypothetical.
- _evidence spans:_ "A small peak can become the story of the whole stay."✓ · "This idea fails when the basic promise is broken."✓ · "The real takeaway is to make every episode as short as possible, because memory "✓

**gpt-5.5@high finding:** **no fabrication finding** (composite 84.7, ship84 false, pass false; other mustFix units: example 3)

**gpt-5.5@xhigh finding:** **no fabrication finding** (composite 83.8, ship84 false, pass false; other mustFix units: example 3)

**Phase-2:** N/A · **Mutation:** variant — manifest in JSON · **Gold:** `{"requireMustFix":true,"targetUnits":["example 3"],"acceptedEvidenceSpans":["The real takeaway is to make every episode as short as possible, because memory simply records total duration and the final moments carry no special weight."]}`

**Call-context manifest:** promptCard `df73b345d31e` · renderedChapter `cbc8ec485a82` · sourcePlanVisibility **NONE** · sourceEvidenceVisibility **NONE** · bookChapterMetadataVisibility **NONE** · phase1Schema `df73b345d31e` · phase2Schema `chapterflow-review-v1:chapterflow-review-v1`

**▢ OWNER ADJUDICATION (blank):**
```
finalClassification:   [ SOL_FALSE_POSITIVE | CLEAN_CONTROL_NOT_ACTUALLY_CLEAN | REVIEW_CONTEXT_OR_RENDERING_DEFECT | GENUINE_BOUNDARY_CASE ]
reviewerRoleDisposition: [ QUALIFIED | UNQUALIFIED | INCONCLUSIVE ]
evidence:    
rationale:   
confidence:  
```

---

### 13. hardblocker-peak-ch1  ·  _reader-visible-hard-blocker_

- **Clean base:** `LNV2-CLEAN-peak-ch01` · base content sha `7b893b35e30e` · rendered-doc sha `2ea82744aa15`
- **Source anchors:** NONE — chapters carry no structured source anchors/citations/provenance fields (top-level keys: hook, breakdown, examples, quiz, reviewCards, implementationPlan, memorableLines).
- **Source-use form:** NAMED-CHARACTER NARRATIVE SCENARIO (no hypothetical-framing markers detected; presented as narrative)
- **Entities:** named people **yes** · orgs no · dates **yes** · quotations **yes** · historical-occurrence-implied no

**Disputed passage — example 1 (peak-ch01-ex01-megan-archery-sight):**

> At 8:10 p.m. Tuesday in the Halifax indoor range, recreational archer Megan lowers her bow at lane 6 while paper target faces hang under buzzing lights. Eight arrows have drifted left again. Her scorecard still has room for a full round, and the sight dial is cold under her thumb. She must decide before the next end whether to keep shooting for a respectable total or tape the left edge, fire five arrows only, and write the sight correction before trying again.
>
> _whatToDo:_ Stop the round. Tape the left edge, shoot a five-arrow set, adjust the sight dial, and record whether the next five arrows move toward the center. Actually, skip the taped strip and just shoot more full rounds, because a higher repetition count is what builds the skill and isolating one miss only slows you down.

_Visible framing:_ presented as narrative (no hypothetical-framing markers detected) · proper nouns: Megan Tapes, Left Edge
At, Tuesday, Halifax, Megan, Eight, Her, She

**gpt-5.6-sol@high finding** (phase-1 composite 90.3, ship84 false, pass false):
- [mustFix] _example 1_ — The What to do section first says to isolate the miss, then instructs the reader to skip isolation and repeat full rounds. This is source-contradictory and makes the example's actionable guidance misleading.
- _evidence spans:_ "The miss is the map because it tells the next rep where to aim."✓ · "A plateau is not always proof that you have reached a limit. Often it is proof t"✓ · "Actually, skip the taped strip and just shoot more full rounds, because a higher"✓

**gpt-5.5@high finding:** **no fabrication finding** (composite 85.7, ship84 false, pass false; other mustFix units: example 1)

**gpt-5.5@xhigh finding:** **no fabrication finding** (composite 85.3, ship84 false, pass false; other mustFix units: example 1)

**Phase-2:** N/A · **Mutation:** variant — manifest in JSON · **Gold:** `{"requireMustFix":true,"targetUnits":["example 1"],"acceptedEvidenceSpans":["Actually, skip the taped strip and just shoot more full rounds, because a higher repetition count is what builds the skill and isolating one miss only slows you down."]}`

**Call-context manifest:** promptCard `df73b345d31e` · renderedChapter `2ea82744aa15` · sourcePlanVisibility **NONE** · sourceEvidenceVisibility **NONE** · bookChapterMetadataVisibility **NONE** · phase1Schema `df73b345d31e` · phase2Schema `chapterflow-review-v1:chapterflow-review-v1`

**▢ OWNER ADJUDICATION (blank):**
```
finalClassification:   [ SOL_FALSE_POSITIVE | CLEAN_CONTROL_NOT_ACTUALLY_CLEAN | REVIEW_CONTEXT_OR_RENDERING_DEFECT | GENUINE_BOUNDARY_CASE ]
reviewerRoleDisposition: [ QUALIFIED | UNQUALIFIED | INCONCLUSIVE ]
evidence:    
rationale:   
confidence:  
```

---

### 14. hardblocker-decisive-ch1  ·  _reader-visible-hard-blocker_

- **Clean base:** `LNV2-CLEAN-decisive-ch01` · base content sha `69cecca544e0` · rendered-doc sha `8b8121496052`
- **Source anchors:** NONE — chapters carry no structured source anchors/citations/provenance fields (top-level keys: hook, breakdown, examples, quiz, reviewCards, implementationPlan, memorableLines).
- **Source-use form:** MIXED (some hypothetical framing markers present)
- **Entities:** named people **yes** · orgs no · dates **yes** · quotations **yes** · historical-occurrence-implied no

**Disputed passage — example 1 (decisive-ch01-ex01):**

> The HopeLab planner stands after lunch in HopeLab's project room, one portable activity device sketch clipped beside three firm names. No one else speaks yet. His mind tries the easy sentence: pick the safest vendor and move. Then Steve Cole's broader first lap nags at him. One firm could solve comfort, another could solve play, and another could show what the team has missed.
>
> _whatToDo:_ The HopeLab planner keeps the first phase parallel. He asks each design firm for a small, comparable pass before naming a winner.

_Visible framing:_ presented as narrative (no hypothetical-framing markers detected) · proper nouns: First Lap
The, His, Then Steve Cole, One

**Disputed passage — example 2 (decisive-ch01-ex02):**

> The prototype planner marks the budget wall on Monday morning in HopeLab's planning room. The portable activity device has enough money for depth, but not for waste. She weighs a polished pitch from one firm against smaller first passes from multiple design firms. Steve Cole's lesson sits in the math: the first dollars should purchase comparison, not premature loyalty.
>
> _whatToDo:_ The prototype planner funds smaller first passes from several firms and sets one shared review standard before a final design partner is chosen.

_Visible framing:_ presented as narrative (no hypothetical-framing markers detected) · proper nouns: Budget Before Bet
The, Monday, She, Steve Cole, Planning

**Disputed passage — example 3 (decisive-ch01-ex03):**

> The Intel reviewer reaches the Intel strategy review with two bad pages in his folder. One page protects memory chips and risks missing microprocessors. The other backs microprocessors and wounds the old identity. He is torn between the old business and the new path. Andy Grove's outsider question gives him a way through: what would a new leader do without the memory-chip attachment?
>
> _whatToDo:_ The Intel reviewer writes the outsider question at the top of the review page and judges the options from that cooler vantage point.

_Visible framing:_ presented as narrative (no hypothetical-framing markers detected) · proper nouns: Intel Outsider Question
The, Intel, One, Andy Grove, The Intel, Distance

**Disputed passage — example 5 (decisive-ch01-ex05):**

> Yvonne pins one clean launch forecast on the board, and the room expects the WRAP four villains to be done once the number looks careful. Then she uncovers the second sheet: three plausible ranges, all built from the same data. The reveal changes the decision cue. She must choose whether to plan for one future or prepare for several.
>
> _whatToDo:_ Yvonne keeps the range sheet visible and asks what the team would do if the low, middle, or high case showed up.

_Visible framing:_ hypothetical markers: picture · proper nouns: Forecast Range Reveal
Yvonne, She, Yvonne, Overconfidence

**Disputed passage — example 6 (decisive-ch01-ex06):**

> The team lead texts from the train platform before the decision meeting: "WRAP check. Which of the four villains is loudest?" A reply comes back: "All of them?" The team lead types four short lines: narrow frame, friendly evidence, hot feeling, single forecast. The four-step process stops being a poster and becomes a map for the next hour.
>
> _whatToDo:_ The team lead asks the group to name one villain first, then pick the matching WRAP move instead of trying to be broadly careful.

_Visible framing:_ presented as narrative (no hypothetical-framing markers detected) · proper nouns: Four Villains Thread
The, Which, All, Naming

**gpt-5.6-sol@high finding** (phase-1 composite 84.7, ship84 false, pass false):
- [mustFix] _example 1_ — The example invents a specific after-lunch HopeLab project-room scene around a real organization without marking it as hypothetical, making the reconstruction misleading. Category: FABRICATED / MISLEADING EXAMPLE.
- [mustFix] _example 2_ — The example invents a Monday-morning HopeLab planning-room event and attributes internal budget reasoning to unnamed staff without identifying it as fiction. Category: FABRICATED / MISLEADING EXAMPLE.
- [mustFix] _example 3_ — The example invents an Intel reviewer, a strategy review, and two pages of deliberation around a real historical decision without a hypothetical marker. Category: FABRICATED / MISLEADING EXAMPLE.
- [mustFix] _example 5_ — The named person, forecast-board reveal, and three-range event are presented as facts without being marked as a hypothetical scenario. Category: FABRICATED / MISLEADING EXAMPLE.
- [mustFix] _example 6_ — The train-platform exchange and quoted text messages are invented but presented as an occurring event rather than a hypothetical illustration. Category: FABRICATED / MISLEADING EXAMPLE.
- _evidence spans:_ "Evidence gets crooked when the favorite answer hires the researcher."✓ · "Good process raises the odds without promising the outcome."✓ · "On reflection, gather only the evidence that supports the plan you already favor"✓ · "The team lead texts from the train platform before the decision meeting: "WRAP c"✓

**gpt-5.5@high finding:** **no fabrication finding** (composite 84.7, ship84 false, pass false; other mustFix units: example 4)

**gpt-5.5@xhigh finding:** **no fabrication finding** (composite 84.3, ship84 false, pass false; other mustFix units: example 4)

**Phase-2:** N/A · **Mutation:** variant — manifest in JSON · **Gold:** `{"requireMustFix":true,"targetUnits":["example 4"],"acceptedEvidenceSpans":["On reflection, gather only the evidence that supports the plan you already favor, because disconfirming views just add noise and slow the decision down."]}`

**Call-context manifest:** promptCard `df73b345d31e` · renderedChapter `8b8121496052` · sourcePlanVisibility **NONE** · sourceEvidenceVisibility **NONE** · bookChapterMetadataVisibility **NONE** · phase1Schema `df73b345d31e` · phase2Schema `chapterflow-review-v1:chapterflow-review-v1`

**▢ OWNER ADJUDICATION (blank):**
```
finalClassification:   [ SOL_FALSE_POSITIVE | CLEAN_CONTROL_NOT_ACTUALLY_CLEAN | REVIEW_CONTEXT_OR_RENDERING_DEFECT | GENUINE_BOUNDARY_CASE ]
reviewerRoleDisposition: [ QUALIFIED | UNQUALIFIED | INCONCLUSIVE ]
evidence:    
rationale:   
confidence:  
```

---

