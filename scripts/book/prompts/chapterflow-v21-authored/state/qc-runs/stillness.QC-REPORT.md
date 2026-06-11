# Stillness-is-the-key — Full QC Report (harness:qc-run-stillness-is-the-key-2026-06-11)

Run as 4 per-chapter batches (1-9 / 10-18 / 19-26 / 27-34) + one full-book cross-batch templating sweep.
Per-batch results: `stillness.batch{1-4}.result.json`. Sweep: `stillness.fullbook-sweep.result.json`.

## Per-chapter verdicts (as attested by the batched runs)

| Ch | Batch verdict | Overall | # templating families (full-book sweep) |
|----|---------------|---------|------------------------------------------|
| 1 | REVISE | 80 | 5 |
| 2 | REVISE | 82 | 8 |
| 3 | REVISE | 90 | 4 |
| 4 | REVISE | 85 | 6 |
| 5 | REVISE | 83 | 2 |
| 6 | REVISE | 81 | 6 |
| 7 | REVISE | 89 | 3 |
| 8 | REVISE | 86 | 5 |
| 9 | REVISE | 89 | 7 |
| 10 | REVISE | 89 | 8 |
| 11 | REVISE | 87 | 5 |
| 12 | REVISE | 82 | 7 |
| 13 | CORRUPTION | 79 | 7 |
| 14 | CORRUPTION | 83 | 5 |
| 15 | CORRUPTION | 76 | 6 |
| 16 | REVISE | 83 | 3 |
| 17 | REVISE | 85 | 6 |
| 18 | REVISE | 92 | 5 |
| 19 | REVISE | 92 | 4 |
| 20 | REVISE | 88 | 5 |
| 21 | REVISE | 87 | 2 |
| 22 | REVISE | 83 | 6 |
| 23 | REVISE | 82 | 3 |
| 24 | CORRUPTION | 87 | 6 |
| 25 | REVISE | 82 | 5 |
| 26 | REVISE | 86 | 7 |
| 27 | REVISE | 91 | 3 |
| 28 | REVISE | 91 | 3 |
| 29 | REVISE | 81 | 5 |
| 30 | REVISE | 90 | 5 |
| 31 | REVISE | 82 | 5 |
| 32 | REVISE | 83 | 3 |
| 33 | PUBLISHABLE | 90 | 8 |
| 34 | REVISE | 87 | 5 |

**Batch totals:** PUBLISHABLE [33] (1) · REVISE 29 · CORRUPTION [13, 14, 15, 24] (4)

> ⚠️ **ch33's PUBLISHABLE is overturned by the full-book sweep.** The batched sweep (ch27-34 only) couldn't see cross-batch reuse; the full-book sweep shows ch33 shares **8** templating families. Per the gate's own rule (sweep templating caps a chapter at REVISE), ch33 → REVISE. Net: **0 chapters are publishable book-wide as-is.**

## CORRUPTION (confirmed wrong quiz keys) — fix first, cheap & local
ch13, ch14, ch15, ch24 — each has exactly 1 adversarially-confirmed wrong `correctIndex`. Otherwise strong chapters. See per-batch result files for the question index + reasoning.

## Cross-chapter templating families (the book-level defect)

22 families. Scene-skeleton families each span 13-18 chapters; two of them are the authoring prompt's own seed examples reproduced downstream.

### [scene_skeleton] postmortem-autopsy / failed-event trace — 18 ch: [1, 2, 3, 4, 8, 9, 10, 12, 13, 15, 16, 17, 21, 24, 26, 28, 31, 33]
- **Signature:** Example opens AFTER an event that 'is already over / has already failed / failed before anyone argued'; narration says 'the trace is plain'; locates 'the one/decisive misstep'; whyItMatters moralizes about finding 'the first leak, not just the final typo.' Only the failed noun changes (launch review, sponsor dinner, fundraiser, emergency memo).
- **Fix:** Cap the 'postmortem' format at ~3 chapters across the book. For the other ~15, replace with a forward-looking or in-progress frame (the decision being made live, a near-miss caught, a success traced). Ban the recurring lexemes 'the trace is plain', 'decisive misstep', and 'first leak / final typo' from any future example; allow at most one chapter to use the postmortem-with-first-leak payoff and rewrite the rest.

### [scene_skeleton] two-person contrast / 'same X, two minds' — 18 ch: [1, 4, 6, 8, 9, 12, 13, 15, 17, 19, 20, 22, 23, 24, 25, 30, 31, 33]
- **Signature:** Two named people '[receive/face/take/inherit] the same [X]'; one handles it badly (sends in heat / protects image / adds the luxury / keeps the phone in hand), one handles it well; diverging outcomes close on a 'same pressure, two minds' moral. The opening clause 'Name1 and Name2 [receive/face/inherit] the same...' is reused almost word-for-word.
- **Fix:** Cap the paired-contrast format at ~3 chapters. Ban the boilerplate opener 'Name1 and Name2 [receive/face/inherit/take] the same X.' Where a contrast is genuinely the best teaching device, vary it structurally (one person across two days; a single person's two drafts; a team vs an individual) and drop the 'two minds, same pressure' tagline.

### [scene_skeleton] records-audit / 'nothing dramatic happens, the telling detail' — 14 ch: [2, 4, 9, 11, 13, 15, 16, 18, 20, 25, 27, 29, 32, 34]
- **Signature:** Protagonist reviews/audits N weeks/months/files of records (notes, logs, clips, sheets, invoices); narration explicitly states 'Nothing dramatic happens / Nothing new happens in the room'; 'the telling detail' is one small recurring mark or blank line. This is verbatim the prompt's own first example frame.
- **Fix:** Because this matches the prompt's seed example, it propagated everywhere — remove that example from the authoring prompt or mark it as DO-NOT-REPRODUCE. Cap the audit format at ~3 chapters; ban the verbatim phrases 'reviews [N] [units]', 'Nothing dramatic happens / Nothing new happens in the room', and 'the telling detail.' For the rest, change the discovery vehicle (a conversation, a single live document, a comparison against a peer) rather than a records sweep.

### [location_stamping] kitchen-table stamp + templated TRY-NOW opener — 14 ch: [2, 5, 6, 10, 11, 14, 18, 20, 23, 24, 26, 29, 32, 34]
- **Signature:** The 'kitchen table' is the default scene venue (14 of 34 chapters) AND the venue baked into a near-verbatim templated TRY-NOW: 'Put/Make a [N]-minute [check/reset/block] on tomorrow's calendar for [8:1x a.m.] at your kitchen table, triggered by [first inbox/criticism/quiet block].'
- **Fix:** Diversify scene venues (limit 'kitchen table' to ~3 chapters) and de-template the TRY-NOW: drop the fixed 'on tomorrow's calendar at your kitchen table' formula and the 8:1x morning time band; let each chapter pick a place, time, and trigger native to its lesson. Treat the TRY-NOW opener as a banned exact phrase in the gate.

### [scene_skeleton] mistake-recovery / 'halfway through, hears themselves' — 13 ch: [1, 3, 6, 8, 10, 15, 17, 19, 22, 24, 26, 31, 33]
- **Signature:** Protagonist is 'halfway through / midway through' a task (meeting, call, slide, email, testimony) when they 'hear themselves / hear their own voice' commit an error, notice it mid-stream, and correct before finishing; whyItMatters says the value is 'the noticing.' The clause 'halfway through ... hears himself/herself' is near-verbatim.
- **Fix:** Retire the 'halfway through X, hears himself/herself' opener. Keep at most 2 mid-stream-catch examples book-wide and vary the trigger (a colleague's glance, re-reading a sent line, a transcript). Ban the verbatim frame 'halfway/midway through ... hears [pronoun]' and the 'the value is the noticing' payoff sentence from repeating.

### [scene_skeleton] routine-reset / 'the routine breaks, stops, restarts' — 13 ch: [1, 3, 5, 10, 12, 14, 17, 19, 21, 26, 28, 30, 33]
- **Signature:** A morning/bedtime/work routine 'breaks' or 'splits' on an interruption (phone ping, alert, child, delivery, executive); protagonist physically stops (shuts lid / sets phone face down / closes inbox / hand stops on the mouse) and 'restarts' from a cleaner first move — the same three-beat machine (break > stop > restart) each time.
- **Fix:** Cap the break/stop/restart reset at ~3 chapters and merge enforcement with the 'phone face down' remedy family (below). Ban the three-beat 'routine breaks ... stops ... restarts' machine and the stock gesture 'sets/puts the phone face down' from recurring. Vary the recovery action (name one fact aloud, step outside, ask a single question) and avoid always making the trigger a device ping.

### [scene_skeleton] before/after diptych / 'same object, one variable flips' — 13 ch: [2, 4, 6, 9, 11, 13, 18, 20, 22, 25, 27, 29, 34]
- **Signature:** A literal 'Before: ... After: ...' (or 'Before the change ... After the change') two-panel construction holding the SAME object/room/routine constant while one variable flips, capped by a stock line 'the X did not change' / 'the same X' / 'the facts stay the same.'
- **Fix:** Cap the explicit Before:/After: diptych at ~3 chapters. Ban the verbatim 'Before:/After:' and 'Before the change/After the change' scaffolding and the closing tag 'the X did not change / the same X / the facts stay the same.' Where contrast-over-time is needed, narrate it as a single continuous scene rather than a two-panel template.

### [scene_skeleton] decision-memo / 'Subject: ... [Figure] did ... I recommend' — 13 ch: [1, 6, 8, 10, 13, 15, 17, 22, 24, 26, 29, 31, 33]
- **Signature:** A timestamped memo (7:12 p.m./4:52 p.m./11:18 p.m. etc.) opens with a 'Subject:' line whose first sentence name-drops the chapter's historical figure, followed by a one-line recommendation/refusal, capped by a whyItMatters that begins 'A written artifact/decision/order/no/choice can...'
- **Fix:** Cap the timestamped 'Subject:' memo artifact at ~3 chapters. Ban the recurring 'A written [artifact/decision/order/no/choice] can...' payoff sentence and the 'Subject: line + figure name-drop + one-line recommendation' shape. Replace most with a different artifact (a spoken sentence held to, a checklist, a calendar entry) and stop pinning every memo to a precise p.m. timestamp.

### [scene_skeleton] planning-choice / 'N minutes before X, nothing started yet' — 13 ch: [2, 7, 9, 11, 14, 16, 18, 23, 25, 27, 30, 32, 34]
- **Signature:** Protagonist has scarce time ('forty minutes / 40 open minutes / 45 / 90 / thirty minutes') before an event (board call, supplier review, parent night); nothing has started ('Nothing begins yet' / 'No work begins yet' / 'No action has started' / 'stays on paper'); they 'budget/allocate/divide' the time into three named slots. Matches the prompt's second seed example; CH23 (slides vs walk) and CH25 (slides vs walk) are a near line-for-line collision.
- **Fix:** Remove or mark DO-NOT-REPRODUCE the planning-choice seed example in the authoring prompt (it propagated, including a duplicate slides-vs-walk in CH23 and CH25). Cap at ~3 chapters; ban the 'has N minutes before X / blank calendar / budgets the minutes / no execution yet' frame and the 'three named slots' divide. Immediately rewrite CH23 OR CH25 so the slides-vs-walk choice appears only once.

### [repeated_unit] phone-away remedy / 'put the phone in another room, facedown' — 7 ch: [4, 7, 22, 25, 28, 30, 31]
- **Signature:** The single recycled actionable tactic — put the phone in another room/hall, set it facedown, charge it outside the bedroom, set shoes by the door — reused as the marquee TRY-NOW / HOOK / ifThen / example move across at least seven chapters spanning different domains.
- **Fix:** Build a per-domain TRY-NOW tactic palette so each chapter's marquee action is distinct (e.g., breath count, one-sentence note, a single closed tab, a walk, a named object) and allow the phone-away remedy in at most 2 chapters book-wide. Coordinate with the routine-reset family so 'phone face down' is not also the recurring example gesture.

### [location_stamping] generic-room venues (conference room / break room) — 7 ch: [2, 7, 8, 10, 16, 17, 20]
- **Signature:** Structurally similar review/coaching/hot-reply beats keep landing in low-distinctiveness corporate rooms — 'conference room / conference room table' (twice with identical 'empty conference room' framing) and 'break room' — compounding the same-setting feel alongside the kitchen-table stamp.
- **Fix:** Add a setting-variety constraint across the book so example venues draw from a wide pool (clinic, kitchen, bakery, classroom, transit, outdoors, home) rather than clustering into kitchen-table/conference-room/break-room. Ban the repeated 'empty conference room' framing; assign distinct venues per chapter at plan time.

### [repeated_unit] input-discipline spaced-recall callback boilerplate — 5 ch: [3, 9, 24, 30, 33]
- **Signature:** The 'Earlier concept: Limit Your Inputs / input discipline' spaced-recall card recurs as a near-boilerplate callback in many later chapters, each re-summarizing input discipline in uniform wording.
- **Fix:** Vary which earlier concept each spaced-recall card calls back to (rotate across the full concept set) so 'Limit Your Inputs' is not the default callback, and vary the recap phrasing. Low severity but cheap: enforce callback-target diversity at plan time.

### [persona_drift] recycled first-name collision (Benjamin, Pascal) — 4 ch: [2, 26, 29, 30]
- **Signature:** A first name carries a famous source figure in one chapter and an unrelated fictional present-day protagonist in a nearby chapter: 'Benjamin' = Benjamin Franklin (CH26) vs a modern consultant (CH29); 'Pascal' = Blaise Pascal (CH2) vs a modern training supervisor (CH30).
- **Fix:** Add every historical figure's first name to the protagonist-name exclusion pool so fictional protagonists never reuse a source figure's first name. Rename the CH29 and CH30 protagonists (currently Benjamin and Pascal) to non-colliding names.

### [repeated_unit] Tiger-Woods 2009-scandal exemplar reuse — 3 ch: [9, 14, 15]
- **Signature:** The Tiger Woods / 2009 scandal / PGA Tour 'public mastery beside private disorder' case used as a full teaching unit in three chapters with the same framing — visible skill does not govern private appetite.
- **Fix:** Assign Tiger Woods to a single chapter and give CH9/CH14/CH15 distinct exemplars from a shared source registry that enforces one-figure-one-chapter. Maintain a cross-chapter case ledger so no celebrity case anchors more than one chapter.

### [repeated_unit] Dorothy-Day / Catholic-Worker exemplar reuse — 3 ch: [12, 13, 33]
- **Signature:** The Dorothy Day / Catholic Worker / New York Great Depression soup-line case recurs across three chapters, each tying 'calm/inner life must become outward service,' with the same soup line, beds, and 1933 stamping.
- **Fix:** Pin Dorothy Day / Catholic Worker to one chapter via the source registry; re-source the others. Enforce one-figure-one-chapter and flag repeated proper-noun stamping (New York, Great Depression, 1933) in the gate.

### [repeated_unit] Fred-Rogers / 1968-Pittsburgh exemplar reuse — 3 ch: [12, 19, 26]
- **Signature:** Fred Rogers / 1968 Pittsburgh / Mister Rogers' Neighborhood anchors three chapters; CH12 and CH19 repeat the same '1968 ... studio ... spoke to children ... slowly' beat almost verbatim, CH26 reuses the figure for routine (143 pounds / daily swim).
- **Fix:** Assign Fred Rogers to one chapter only; re-source CH12/CH19/CH26 from the registry. Ban repeated '1968 Pittsburgh studio / spoke to children slowly' phrasing across chapters.

### [repeated_unit] Marcus-Aurelius / Meditations framing-source reuse — 3 ch: [6, 13, 34]
- **Signature:** Marcus Aurelius / Meditations / Roman Empire / second century reused as the framing source in three non-adjacent chapters, each with the 'ruler with the empire on his back still wrote private notes' beat and 'second century' stamping.
- **Fix:** Limit Marcus Aurelius / Meditations to one anchoring chapter; allow a brief callback elsewhere only if it does not re-stamp 'Roman Empire / second century / empire on his back.' Track marquee-text usage in the source registry.

### [repeated_unit] Stoic-under-Nero/Nicopolis framing reuse — 3 ch: [4, 11, 22]
- **Signature:** The 'Stoic philosopher working under pressure in Rome near Nero / Nicopolis' unit (Seneca in CH4 and CH11, Epictetus in CH22) repeats the same beat — a Stoic stayed clear-minded amid danger/noise, therefore so can you — with CH4 and CH11 both stamping 'Rome ... Nero.'
- **Fix:** Treat 'Stoic-stayed-calm-under-Nero/Nicopolis' as one occupied slot; use Seneca-near-Nero in at most one chapter and re-source the others (different tradition or figure). Add the 'Rome ... Nero' stamp to the gate's repeated-phrase watchlist.

### [repeated_unit] Anne-Frank / Secret-Annex exemplar reuse — 2 ch: [6, 17]
- **Signature:** Anne Frank's 1942 Amsterdam diary / Secret Annex is the emotional centerpiece in two chapters (diary for private writing in CH6; chestnut tree for beauty in CH17), with the same Amsterdam / Secret Annex stamping.
- **Fix:** Assign Anne Frank to one chapter; re-source the other from the registry. One-figure-one-chapter enforcement applies even when the two uses pull different facets (diary vs chestnut tree).

### [repeated_unit] Kennedy / Cuban-Missile-Crisis exemplar reuse — 2 ch: [2, 33]
- **Signature:** The Kennedy / Cuban Missile Crisis / October 1962 case anchors both Become Present and Act Bravely with the same 'maps in the room, advisers wanted the loud strike, he slowed it' beat and identical October-1962 stamping.
- **Fix:** Pin Kennedy / October 1962 to one chapter; re-source the other. Flag the shared 'maps in the room / advisers wanted air strikes / October 1962' beat in the gate's repeated-exemplar check.

### [repeated_unit] control-distinction column exercise + 'supervise the sky' line — 2 ch: [10, 18]
- **Signature:** The Stoic 'control distinction' column-sorting exercise (mine / not mine; accept / change / ask) is the core mechanic of both Let Go and Accept a Higher Power, and both close on the same 'stop supervising the universe / whole sky' image — effectively one reused unit split across two chapters.
- **Fix:** Differentiate the two chapters: keep the column-sorting artifact in one and give the other a distinct mechanic. Ban the 'supervise the universe / whole sky' MEMORABLE line from appearing in more than one chapter.

### [persona_drift] old-threat ifThen / 'mild comment lands like shame/attack' — 2 ch: [12, 14]
- **Signature:** Adjacent chapters open their plan ifThen list with the same trigger ('a mild comment lands like shame/an attack') and the same remedy ('write the old meaning/exact sentence before you answer'); CH14's quiz-opener restates it again.
- **Fix:** Rewrite one chapter's lead ifThen trigger and remedy so the 'mild comment feels like shame/attack -> write the old meaning before you answer' branch appears once. Coordinate ifThen triggers across adjacent chapters at plan time to avoid duplicate lead branches.

## Highest-leverage fix (from synthesis)

The book is built from a small fixed set of pedagogy-slot scene machines and a tiny pool of exemplars/venues, so it reads as one template re-skinned 34 times rather than 34 distinct chapters. Nine scene-skeleton families (postmortem-autopsy, mistake-recovery 'halfway through, hears themselves', records-audit 'nothing dramatic happens / the telling detail', two-person 'same X, two minds' contrast, routine break/stop/restart, Before:/After: diptych, timestamped 'Subject:' decision-memo, and 'N minutes before X' planning-choice) each recur in 13-18 chapters with near-verbatim framing phrases and payoff lines; two of them (records-audit and planning-choice) are literally the authoring prompt's own seed examples reproduced downstream, and CH23/CH25 even duplicate the same slides-vs-walk choice almost line-for-line. On top of the structural reuse, a handful of historical exemplars (Tiger Woods, Dorothy Day, Fred Rogers, Marcus Aurelius, Seneca/Epictetus-under-Nero, Anne Frank, Kennedy/Cuban Missile Crisis) each anchor 2-3 chapters with identical date/place stamping, the marquee actionable tactic collapses to 'put the phone facedown/in another room' across seven chapters, the scene venue collapses to 'kitchen table' in 14 of 34 chapters (plus a templated 'on tomorrow's calendar at your kitchen table' TRY-NOW), and source-figure first names (Benjamin, Pascal) collide with fictional protagonists. The single highest-leverage fix is to stop the templates at the source: strip the records-audit and planning-choice seed examples out of the authoring prompt and impose a per-book quota system — each scene-skeleton format capped at ~3 chapters, each historical figure/case used in exactly one chapter, each chapter drawing a distinct TRY-NOW tactic and venue from rotating palettes, all enforced by a cross-chapter banned-phrase + one-figure-one-chapter gate so no frame, payoff line, exemplar, or venue can repeat book-wide.