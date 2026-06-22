# FIELD-PURPOSE-CONTRACTS — what each ChapterV21 field is FOR

This is the per-field specification referenced by [STEP-2-WRITE-CHAPTERS.md](STEP-2-WRITE-CHAPTERS.md).
Each contract gives a field's **JOB** (what it must do for the reader), a **WRITE**
recipe, a **REJECT** list (each entry names a defect as a *job violation* and why
it fails the reader — not a pattern to dodge), and a **POSITIVE / NEGATIVE** pair.

How to use it: as you compose each field, read its contract and write to the JOB.
Then run `author-check <chapter.json>` — it reports, per finding, the JOB a field
violated (it is the deterministic enforcement of these contracts, calibrated to
zero false-positives on the clean corpus). Fix the *writing*, never the surface.

The defects below are real, drawn from a multi-book QC pass. They are listed so
you recognize the failure shape — but the rule is always the positive JOB. A field
written from its source moment (see the Bind Block in STEP-2) does its job by
construction; a field with nothing real to say falls back on the skeletons below.

---

## Part 1 — Chapter framing & support fields

**Voice (R2.6):** the TEACHING fields speak to the reader as **you** (`counterintuition`, `keyTakeaway`, `tryThisNow`, `whyItMatters`, the breakdown tiers' lesson). The SCENE fields stay third person about a named person (`scenario`, `whatToDo`) — never rewrite a scenario into "you". Named person in the scene; "you" in the lesson.

### `examples[i].scenario`

**JOB:** Put a named person in one real moment from a single named source case, facing a concrete tradeoff they must decide *right now* — the scene the concept lives inside, never the concept itself walking around.

**WRITE:**
1. Open with a named person doing something concrete in a specific place; a timestamp is welcome *inside* the scene ("At 7:15 p.m. in a Houston auditorium, Aisha holds a note card that reads…").
2. Anchor it to one named source case so the stakes are real, not generic.
3. State the live tradeoff as a fork the person must take now ("must tell the room whether the problem is entitled kids — or a scarcity culture").
4. Keep the concept *off-stage*: it is what the choice illustrates, not a prop anyone handles.
5. Vary the scene SHAPE across the chapter's six examples and FIT the staging to the topic. Span venue kinds (domestic, relational, civic, occupational, commercial, recreational) — a personal/relational subject belongs at a kitchen table, on a phone call, or in a text thread, not at a workplace prop. A venue can be a relationship channel, not only a physical place.
6. The **named source case is the stage, not a prop.** The case in your sidecar (and the planSpec.requiredBeat) is the scene's binding setting; the dealt venue is fallback-only. If the dealt venue can't host the real case, *discard the venue* and stage the case in its own setting. Never relocate the scene to the dealt venue and demote the real case to notes "glowing on a phone," and never invent a spectator who reads the case off a screen — the person in the source case is the actor.
7. **Open on the recognizable frustration, not a withheld reveal** (stay third person — this is the SCENE). Lead with the pain the reader knows, in the named person's hands; don't bury it in a literary slow-burn. "Brett's junk drawer won't close, and the one receipt he needs is somewhere in the pile" lands; "The self-checkout receipt was already in Brett's junk drawer before he knew why it bothered him" hides the point in a reveal. The first clause should make the reader think *that's me*.

**REJECT:**
- A concept label made the actor or object — "Cleo lifts a productive vulnerability folder," "Aisha studies scarcity." Ideas can't be held or studied; this fails the reader because it gives them a label to memorize instead of a moment to inhabit (pairs with AC1).
- A fixed concept-label HEADER reused every chapter — "Aisha, 8:40 a.m. at the rink: Scarcity." The repeated stamp reads as a slot-fill, signals nothing happened, and trains the reader to skim past every scene identically.
- No decision — a static description or a restated source summary. With no fork to resolve, the reader has nothing to test the concept against.
- Detached from any named case — a hypothetical "someone, somewhere." Ungrounded stakes feel invented, so the lesson doesn't transfer.
- An invented precise number in the scene — a count or statistic not in the sidecar's `groundedNumbers`/`sourceFacts`. Specific quantities read as sourced; an ungrounded one is a factual_accuracy finding. Use a grounded figure or state it qualitatively.
- The SAME scene skeleton across most examples — every scenario opening "<Name> <tactile-verb>s at/beside a <occupational prop>" (a microphone stand, a mat bay, a service window). Different venues wearing one identical shape still read as templated, and on a personal topic the workplace staging is incongruous; QC caps example_coherence at YELLOW for it (staging uniformity).
- The scene staged at an arbitrary dealt venue while the real source case is demoted to a prop — case notes/a report "glowing on a phone," an invented onlooker reading about it off a screen. This buries the case the reader is supposed to inhabit; the named case must BE the scene (deterministic blocker SL3).
- The same demotion in PHYSICAL form — the source named, then parked as set-dressing: a book that "sits open" on a desk, a study "in her bag for later," a phrase "in the margin," a citation "beside her name," **or an academic source rendered as a classroom prop — "the 1974 Science slide," "reads the wording from the 1979 Econometrica notes," "slides the 2003 worksheet across the table."** The case becomes inert decoration instead of the engine of the scene's action. Cite the FINDING so it drives the person's action ("the 2008 PNAS work *puts* the cortex in the switching story" is fine — an abstract verb, not a handled object). The model bar/confirm read flags this (example_coherence), and the clearest journal-as-prop form is now caught deterministically (**SL4.citation_prop**, a major): a cited venue physically attached to a slide / handout / read-from notes. The named case must drive what the person DOES.
- PUBLICATION metadata in the prose. The reader cares about the FINDING, not the artifact: never write the edition, publisher, or ISBN into reader text — "Donald Norman's 2013 **revised edition from Basic Books**", "the **third edition**", "the **hardcover**". Say "Donald Norman's design idea is simple: good objects show you how to use them"; the edition/publisher live in the source layer, not the sentence (deterministic major **SL5.publication_detail**).
- The planSpec.domain or an internal format tag written into the prose. A Title-Case paste of the domain ("Peyton's Teacher Setting Terms For grade-update calls") or a format id ("coach_talk", "inner_monologue") is planning scaffolding, never reader text (deterministic blockers SL1/SL2).
- The STUDY, journal, or year named INSIDE the scene. "Maya enacts the 1978 Journal of Abnormal Psychology pattern," "Norman is the field voice for the 1978 JPSP study," "the 1993 study about 14°C water" — these footnote the scene instead of dramatizing it. The scenario shows the PHENOMENON in a real person's hands; the citation (author / journal / year) lives in deepRead/fullRead, never in the scene. Anchor the scenario in the source CASE — its people and situation — not its bibliographic reference. (A named researcher can be the ACTOR of their own story; what's banned is tagging the scene with the journal/year as if footnoting it. The source-grounding gate SC9 wants the CASE, not the citation.)

**POSITIVE:** "Aisha sits at 7:15 p.m. in a Houston school auditorium with a note card that reads, 'Why are kids so self-absorbed?' The PTA president wants a clean answer before the open mic. Aisha must tell the room whether the problem is entitled children — or a scarcity culture that makes young people fight to seem special."
**NEGATIVE:** "Aisha, 8:40 a.m. at the auditorium: Scarcity. She studies a productive-scarcity folder." (concept-label header + concept-as-object; no decision, no scene)

### `examples[i].whatToDo`

**JOB:** Name the concrete thing the protagonist actually does in that scene — the observable move, in third-person narrative tied to *this* person.

**WRITE:**
1. Continue the named protagonist's action from the scenario ("Aisha names the observed behavior, then asks what fear sits under it").
2. Make it a move you could film — a verb the person performs, not a claim about the idea.
3. Third-person scene-continuation is correct; do **not** force a second-person imperative.

**REJECT:**
- An abstract proposition or source-claim instead of an act — "It would be managed through worthiness," "The concept is that scarcity drives behavior." This fails the reader because it describes the theory again instead of showing the modeled behavior they're supposed to copy (pairs with AC4).
- A pasted breakdown/source sentence used as filler — it tells the reader nothing about what *this* protagonist did with the idea.
- A vague verb that isn't a move — "engages with the situation," "considers the dynamic." Nothing concrete to imitate.

**POSITIVE:** "Aisha names the observed behavior, then asks what fear might sit under it. She moves the room from condemnation toward worthiness, limits, and connection."
**NEGATIVE:** "This would be best understood as a scarcity dynamic that should be addressed through worthiness." (proposition, not an action)

### `examples[i].whyItMatters`

**JOB:** State why this specific move generalizes — the bridge from one scene to the reader's own situations.

**WRITE:**
1. Name what the move *protects or unlocks* beyond this scene ("keeps the diagnosis relational").
2. Point at the reader's transfer case — when they'd reach for the same move.
3. One or two sentences; it earns its place by adding a *reason*, not by restating the scene.

**REJECT:**
- A restatement of the scenario with no generalization — the reader already read the scene; repeating it gives them no reason to carry the move.
- A pasted thesis or source sentence — generic significance ("this matters because relationships matter") that would fit any chapter and so teaches nothing specific.
- Leaked pipeline vocab ("this example demonstrates the central concept") — meta-talk about the artifact, not about the reader's life.

**POSITIVE:** "The Houston frame keeps the diagnosis relational. Grandiosity can still be challenged, but shame is no longer treated as the cure for shame."
**NEGATIVE:** "This example illustrates the central concept of the chapter and shows why the topic is important." (meta, generic, zero transfer)

### `examples[i].title`

**JOB:** Name *this* scene memorably — a handle the reader could use to recall the moment.

**WRITE:**
1. Pull two-to-four words from the scene's concrete content ("Houston Question Turn").
2. Make it specific enough that it couldn't head a different example.

**REJECT:**
- A scaffold slug — "Source Moment 3.1," "Second Angle 2," "Scene 4.2." These are generation bookkeeping; they leak the assembly line and name nothing the reader can hold (pairs with AC7).
- A bare concept label as the title — "Scarcity Culture." That names the topic, not the scene, so every example would collide.

**POSITIVE:** "Houston Question Turn"
**NEGATIVE:** "Source Moment 1.2" / "Example A: Scarcity"

### `hook`

**JOB:** A 60–120-char arresting one-liner — one concrete image or turn that makes the reader want the chapter.

**WRITE:**
1. Drop one concrete, specific picture from the chapter ("Houston hears a question about entitled kids, and the room starts talking about fear").
2. Create a small turn or gap the chapter will close.
3. Keep it under 120 chars and free of meta-framing.

**REJECT:**
- A restated thesis — the keyTakeaway in shorter words. It spoils the payoff and gives the reader no reason to read on.
- Meta-talk about the chapter ("In this chapter we explore…") — that describes the artifact instead of pulling the reader into the content.
- Abstract with no image — "Scarcity affects courage." Nothing concrete to catch on.
- A coined label used as if the reader already shares it — "your winner default," "the straight-line default." Naming a default is fine, but say it in plain words ("the habit of copying winners"), not an invented compound term the reader has not met. A genuine book term ("Type I") may appear only if it says what it means in the same line (a label you coined is not a book term).
- An invented precise number — "3 checkboxes," "eight winning quarters" — the source does not establish. A specific count in a hook reads as a sourced fact; if it is not in `groundedNumbers`, make it qualitative ("a short checklist") or use a grounded number (a verified year). The blind confirm read REVISEs an ungrounded count (factual_accuracy).

**POSITIVE:** "Houston hears a question about entitled kids, and the room starts talking about fear."
**NEGATIVE:** "This chapter explains how scarcity culture reduces courage and how to build enoughness." (restated thesis + meta)

### `counterintuition`

**JOB:** One or two sentences naming a genuine tension or surprise — something the reader's default model gets wrong.

**WRITE:**
1. State the surprising claim with its mechanism ("Self-absorption is often armor for the terror of being ordinary").
2. Show why the obvious read is backwards, naming the real driver.
3. Make the surprise *content-bearing*, not a flipped phrase.

**REJECT:**
- A "X is not Y" negation shell with no positive insight — "Courage is not confidence." A bare negation names no real tension and leaves the reader with nothing new.
- A truism dressed as a paradox — "surprisingly, hard things are hard." No genuine reversal.
- Restated thesis with "but" bolted on — fakes tension without delivering one.

**POSITIVE:** "Self-absorption is often armor for the terror of being ordinary. Scarcity culture trains people to prove specialness when what they need is worthiness."
**NEGATIVE:** "Vulnerability is not weakness — it is actually strength." (negation shell, no mechanism)

### `tryThisNow`

**JOB:** One specific 30–90-second action the reader can do this instant — directive, self-contained.

**WRITE:**
1. Give one concrete action with a clear object ("Write the first not-enough thought you had today").
2. Add the discriminating step that makes it the chapter's move ("then name whether it came from shame, comparison, or disengagement").
3. 80–220 chars; phrase as a directive, never a question.

**REJECT:**
- A question instead of an instruction — "Have you noticed your scarcity cues?" A question prompts no action and the reader closes the loop by nodding.
- A multi-day project — anything that can't finish in ~90 seconds isn't a *now* action.
- Vague exhortation — "reflect on your mindset." No concrete first move, so nobody does it.

**POSITIVE:** "Write the first not-enough thought you had today, then name whether it came from shame, comparison, or disengagement."
**NEGATIVE:** "Think about whether scarcity is affecting your life today." (vague, not a discrete action)

### `keyTakeaway`

**JOB:** The single carry-home sentence — 140–220 chars, ≤30 words, complete, in the reader's language.

**WRITE:**
1. State the one idea the reader keeps if they forget everything else.
2. Include the *how*, not just the *what* ("name shame, comparison, and disengagement, then choose worthiness").
3. End it cleanly as a full sentence within the length cap.

**REJECT:**
- Truncated mid-thought or mid-word — a cut-off carry-home line fails its one job: to be remembered whole.
- A restated hook/thesis with no actionable core — repeats the topic without telling the reader what to do.
- Leaked pipeline vocab ("the central concept of this chapter is…") — meta about the artifact, not a sentence the reader would ever say.

**POSITIVE:** "Scarcity culture shrinks courage by teaching lack first; enoughness grows when you name shame, comparison, and disengagement, then choose worthiness before proving."
**NEGATIVE:** "The key takeaway of this chapter is that scarcity culture is important and you should work on building more enoughness in your life and…" (meta, padded, runs to truncation)

### `implementationPlan.coreSkill`

**JOB:** Name the one transferable skill the chapter builds, in 2–4 sentences, as something the reader can practice.

**WRITE:**
1. Name the skill as a repeatable move ("catch the first scarcity cue before it becomes a verdict").
2. Give the discriminating step that distinguishes it from a vague habit (name shame / comparison / disengagement).
3. Tie it to the chapter's one named reader tool (e.g. a "Name the Scarcity Cue" move).

**REJECT:**
- A pasted source/breakdown sentence — describes the author's idea, not a skill the reader rehearses.
- A generic exhortation ("be more self-aware") — no practiced action, so it transfers nothing.
- A templated loop that restates one clause with rotating labels — repetition isn't development (pairs with AC8).

**POSITIVE:** "Practice catching the first scarcity cue before it becomes a verdict. Name whether the cue is shame, comparison, or disengagement, then choose one action that treats worthiness as already present."
**NEGATIVE:** "The core skill is to understand scarcity culture and apply its principles to become a more courageous and self-aware person." (generic, un-practiceable)

### `implementationPlan.twentyFourHourChallenge` + `weeklyPractice`

**JOB:** Two concrete, scaled reader actions — one to do today, one to sustain over a week — each using the chapter's named move.

**WRITE:**
1. **24-hour:** one bounded action with a count and a recording step ("catch three not-enough thoughts in writing; beside each, mark shame, comparison, or disengagement").
2. **Weekly:** a repeatable review that accumulates signal ("end each day reviewing one scarcity cue and one enoughness response; track which cue recurs").
3. Each must invoke the chapter's one named tool and be checkable — the reader can tell whether they did it.

**REJECT:**
- A pasted breakdown/source sentence dropped in as the challenge — that's content, not an assignment; the reader has nothing to *do*.
- Generic filler ("reflect daily," "keep practicing") — not bounded, not checkable, so it goes undone.
- Identical 24-hour and weekly actions with one word swapped — the two slots must differ in scale and cadence, or one is wasted.
- Editor/pipeline language ("the reader should be instructed to…") — address the reader, not the assembler.
- **The SAME weekly FORM as other chapters** — "for seven days, keep one X log" / "end each day reviewing one X" with only the noun swapped, book-wide. The model QC sweep reads weeklyPractice across all chapters and flags a reused shell as **repeated_unit**, capping every involved chapter at REVISE. There is **no deterministic gate** for this — it is on the writer/orchestrator. Across the book the weekly FORM must vary: a single rehearsal, a paired check-in (ask one person to flag the behavior), an environment change, a count-and-tally, a swap experiment, a teach-it, spaced reps — not all a daily log. (A daily-review log is a legitimate form for ONE chapter; it must not be the default for most.)

**POSITIVE (24h):** "For one day, catch three not-enough thoughts in writing. Beside each, mark shame, comparison, or disengagement, then write the next concrete choice."
**POSITIVE (weekly):** "Once this week, ask a person you trust to flag the moment your voice tilts toward proving; compare what they noticed with what you felt." (a paired check-in — a DIFFERENT form from any daily-log chapter)
**NEGATIVE:** "24h: Reflect on scarcity in your life. Weekly: Continue reflecting on scarcity in your life each week." (unbounded, uncheckable, duplicated; no named move)

---

## Part 2 — Breakdown, plan, memorable lines

### breakdown.fastRead

**JOB:** Give the reader the fastest true grasp of the idea: one concrete scene that opens a human door, then the rule that scene reveals — enough to act on in 30 seconds, in ~400–700 characters.

**WRITE:**
1. Open on a specific person in a specific moment that makes the abstract idea visible (a question asked, a thing done, a reaction).
2. Name the mechanism the scene exposes in plain language — what is actually happening under the surface.
3. Land the rule the reader carries away: what to notice and why it matters.

**REJECT:**
- Restating the chapter thesis three or four times with swapped synonyms. This fails the reader because rereading the same claim teaches nothing new; the tier has to deliver the idea, not echo the title.
- Opening with a definition seam ("X is the practice of…") instead of a scene. A reader needs a door, not a dictionary; the abstraction has nothing to grip until a person makes it concrete.
- Padding with a pasted source sentence to reach length. A quoted breakdown line is the author's recall, not the reader's understanding — it makes the tier longer without making it clearer.
- A scene whose actor handles the concept itself ("she opens a vulnerability folder"). Ideas are not objects; the person must do something real that the concept then explains.

**POSITIVE:** "Houston gives the idea a human door. A public audience asks why children seem so narcissistic, and the easy answer would be to scold a whole generation. The better question looks under the pose: what fear makes specialness feel like the price of love? Scarcity culture turns that fear into daily weather…"
**NEGATIVE:** "Scarcity is never feeling like enough. Scarcity culture makes you feel you are not enough. The never-enough problem is the feeling of scarcity. This chapter is about not feeling enough." — four restatements of the thesis; no scene, no mechanism, nothing the reader did not already have from the title.

---

### breakdown.deepRead

**JOB:** Deepen the fastRead into the *mechanism* — how the idea actually works step by step — and ground it in a SECOND, different scene so the reader sees the pattern recur. ~1200–1800 characters that advance past the fast tier, never repeat it.

**WRITE:**
1. Start from a *different* sentence than fastRead's opener — pick up where the fast tier left the reader, do not rewind.
2. Walk the mechanism: name the moving parts and how one triggers the next, so the reader can trace cause to effect.
3. Bring a second concrete scene (new person or new moment) that shows the same mechanism in a different setting.
4. Close on the discrimination the reader can now make that they could not after the fast tier.

**REJECT:**
- Opening with fastRead's first sentence verbatim or near-verbatim. This fails the reader because the deep tier exists to add a layer; reprinting the fast opener signals there is no layer to add (the E2 progression rule).
- The "<Concept> means The <concept> is…" tautology seam (pairs with AC7). It pretends to define while only circling the label back onto itself; the reader gets a loop where they were promised a mechanism.
- A single second scene that merely re-narrates the first with renamed characters. Two scenes must show *variation* so the reader learns the pattern, not one anecdote told twice.
- Leaking scaffolding ("as the source cue", "Source Moment 3.1", "revisit the hard edge"). These are notes to the author; to the reader they are noise that breaks the prose and reveals the seam (pairs with AC7).

**POSITIVE (opener, distinct from fast tier):** "Scarcity works by making attention search for lack before connection has a chance to speak. Once the mind has named a deficit, the body begins to protect: shame says hide the weak place, comparison says rank it, disengagement says stop caring before care can hurt…"
**NEGATIVE:** "Scarcity is never feeling like enough. Scarcity means The scarcity is the feeling that you are never enough, and so the never-enough feeling is scarcity…" — reuses the fast opener, then collapses into the means-seam loop; the reader learns no new mechanism.

---

### breakdown.fullRead

**JOB:** Open a THIRD angle on the idea — a complication, a limit, an edge case, or a "when this fails" — and finish the reader's understanding. ~2500–3500 characters that progress beyond both prior tiers and end on a complete sentence.

**WRITE:**
1. Introduce the angle the prior tiers could not hold: where the idea breaks down, what it costs, or how it interacts with a competing force.
2. Develop it with distinct sentences, each carrying a new claim or example — the prose builds, it does not iterate.
3. Name the boundary: when the move does *not* apply, so the reader is not over-applying a hammer — but earn it from THIS chapter's case, and vary the boundary BEAT across the book (see REJECT).
4. Close on a complete, landed thought that resolves the chapter's argument.

**REJECT:**
- **The bare "limit" hinge as the boundary, book-wide** — closing chapter after chapter on "there is a limit" / "the limit matters" / "one limit matters" with only the noun changed. The model QC sweep reads the fullRead boundary across all chapters and flags a shared hinge as **scene_skeleton**, capping every involved chapter at REVISE. There is **no deterministic gate** for this. Vary the boundary BEAT: where the move breaks (a concrete case it can't handle), what it costs (the tradeoff), when to do the opposite, who it misleads, the precondition it assumes. Do not let "limit/limits" be the default transition word.
- A clause-loop with a rotating label ("Trust shows up in the roster. Trust shows up in the memo. Trust shows up in the call…") (pairs with AC8). This fails the reader because swapping one noun per line creates the appearance of coverage while teaching one point; the reader's time buys nothing.
- Repeating the fast/deep tiers at greater length instead of opening a new angle. The three tiers must *progress* (the E2 rule); a longer restatement is not a third angle, it is the first tier padded.
- Ending mid-sentence or mid-word. A truncated final tier tells the reader the author ran out, not that the thought completed — it breaks trust at the moment understanding should close.
- Pasting source-breakdown sentences as filler to hit the character count. Length earned by quoting the author's notes is length the reader cannot use.

**POSITIVE:** "…The harder case is the leader who *performs* enoughness. They have read the language and can say the worthiness lines on cue, which makes the scarcity quieter and more durable: it now hides inside competence. This is where the move has a limit. Naming a cue only helps when the namer is willing to be wrong in front of someone…"
**NEGATIVE:** "Scarcity shows up at work. Scarcity shows up at home. Scarcity shows up in money. Scarcity shows up in time. Scarcity shows up in the body…" — one clause, a rotating noun; no third angle, no limit, no progression past the fast tier.

---

### implementationPlan.ifThenPlans[].context

**JOB:** Name the situational trigger the reader will actually be *inside* when the plan should fire — a moment, a felt state, or an observable event — so they recognize the cue in the wild.

**WRITE:**
1. Anchor to a concrete instant the reader lives through ("the day opens with…", "a meeting turns into…", "your first thought is…").
2. Make it perceivable from the inside: something the reader can notice happening to them or around them.
3. Keep it specific enough to fire reliably but general enough to recur.

**REJECT:**
- A bare source or proper-noun label as the trigger ("Twist's never-enough frame", "Chapter 3's mechanism"). This fails the reader because a citation is not a moment they can be standing in; they cannot catch a trigger that names a book section instead of their experience.
- A restated mechanism instead of a cue ("If scarcity is the search for lack…"). The context must mark *when* to act, not re-explain the idea; an explanation gives the reader no edge to detect.
- An abstract category with no felt anchor ("In situations involving comparison"). Too vague to fire; the reader needs a recognizable moment, not a topic heading.

**POSITIVE:** "If your first morning thought starts with *not enough*" · "If a meeting turns into ranking people for safety"
**NEGATIVE:** "If the never-enough frame from Twist applies" — names a source, not a moment; the reader is never standing inside a citation.

---

### implementationPlan.ifThenPlans[].plan

**JOB:** Give the If-X-then-Y *action* that uses this chapter's NAMED reader move, so the trigger resolves into one concrete thing the reader does.

**WRITE:**
1. Restate the trigger compactly as the "If…" and attach a single, doable "then…" action.
2. Route the action through the chapter's named tool (the move from the plan title) so the plan and the tool are one system.
3. Make the action small enough to do in the moment and observable enough to know it was done.

**REJECT:**
- A pasted breakdown sentence dropped in as the plan. This fails the reader because a paragraph of explanation is not an action; under pressure they need a verb, not a recap.
- Editor-facing language ("use <source> as the source check", "apply the chapter's hard edge here"). These are notes about the writing, not instructions the reader can perform; they leak the seam and give no behavior to do (pairs with AC7).
- A "then…" so generic it is not actionable ("then be more aware", "then handle it better"). Vague advice cannot be executed or checked; the reader cannot tell whether they did it.
- An action with no link to the chapter's named move. If the plan ignores the tool the chapter invented, the reader has two unconnected things to remember instead of one practiced loop.

**POSITIVE:** "If the day opens with a deficit inventory, then write the exact phrase and label the cue — shame, comparison, or disengagement — before checking your phone."
**NEGATIVE:** "If scarcity applies, then use the never-enough frame as the source check for your mood." — editor language ("as the source check"), no concrete action, no named move performed.

---

### implementationPlan.title

**JOB:** Name THIS chapter's one specific reader move in 4–7 words — the tool the reader will invoke by name. An imperative title counts as the name.

**WRITE:**
1. Coin or state the chapter's single named move (a tool name like "Purpose Receipt Check" or an imperative like "Name the Scarcity Cue").
2. Make it specific to this chapter's idea — a stranger should not be able to guess which other chapter it belongs to.
3. Keep it portable: short enough that the reader can say it to themselves and the ifThenPlans can route through it.

**REJECT:**
- A generic skill heading that fits any chapter ("Practice the Concept", "Apply the Idea"). This fails the reader because a name that names nothing specific gives them no handle to carry; the move must be *this* chapter's, not a placeholder.
- A re-description of the chapter topic instead of a move ("Understanding Scarcity Culture"). A topic is not a tool; the reader needs something they *do*, named so they can do it again.

**POSITIVE:** "Name the Scarcity Cue" (imperative move) · "Purpose Receipt Check" (named tool)
**NEGATIVE:** "Working With the Main Idea" — generic, fits every chapter, names no move the reader can invoke. (A proper-noun product name is *not* required — an imperative title like "Name the Scarcity Cue" fully satisfies the named-move requirement.)

---

### memorableLines[].text

**JOB:** Give one portable aphorism — compact, complete, and quotable — that compresses the chapter's idea into a line the reader can carry and repeat.

**WRITE:**
1. Compress the idea to its sharpest form: one clause or a tight two-clause turn.
2. Make it self-contained — true and meaningful with no surrounding context.
3. Favor contrast, reversal, or a clean assertion; aim for a line worth memorizing, roughly under 12 words.

**REJECT:**
- A 16–23-word explanation or enumeration dressed as a line. This fails the reader because an explanation is something you read once; an aphorism is something you keep. A list ("It is shame, comparison, disengagement, and the deficit inventory that…") cannot be carried.
- A restated thesis with no compression ("This chapter shows that scarcity makes you feel not enough"). A memorable line earns its keep by being sharper than the thesis, not by repeating it at the same length.
- A line that needs the chapter to make sense. If it only lands for someone who just read the section, it is not portable.

**POSITIVE:** "Courage begins when worthiness no longer waits for proof." · "Shame cannot be shamed into courage."
**NEGATIVE:** "The never-enough feeling, which includes shame and comparison and disengagement, is what makes people feel like they are not enough every day." — a 22-word explanation, not an aphorism; nothing compact to carry.

---

### named-framework completeness

**JOB:** When the source names an N-part model, the chapter reproduces ALL N members with the source's exact names — the reader gets the whole framework, correctly labeled.

**WRITE:**
1. Find the source's named model and its full member count (e.g. BRAVING = 7).
2. List every member, using the source's exact term for each.
3. Verify the count and the spellings against the source before the framework ships.

**REJECT:**
- Listing N−1 members (e.g. BRAVING's 7 given as 6). This fails the reader because a partial framework is a *broken* tool — they will try to apply it and find a hole the chapter never filled.
- Renaming a member ("Vault" rendered as "confidentiality"). The reader who later meets the real source will not recognize the renamed part as the same thing; the chapter taught them a label that does not exist.
- Reordering or merging members so the count looks right but the model is altered. A named model's structure is part of its meaning; quietly editing it hands the reader a different tool under the original name.

**POSITIVE:** BRAVING, all seven with the source's terms: Boundaries, Reliability, Accountability, Vault, Integrity, Non-judgment, Generosity.
**NEGATIVE:** "BRAVING: Boundaries, Reliability, Accountability, confidentiality, Integrity, Non-judgment" — six of seven, and "Vault" silently renamed to "confidentiality"; the reader leaves with a framework that does not match the source.
```

---

## Part 3 — Quiz & review cards

### `quiz.questions[].prompt`

**JOB:** Stage a concrete situation — a specific person mid-decision — that a thoughtful reader reasons *through* using the chapter's idea; the prompt asks which move fits the lens, so the reader must apply understanding, not match a phrase.

**WRITE:**
1. Put a named protagonist in one specific moment ("When Rowan notices his first thought is *not enough sleep*…").
2. Make the situation a real fork — the reader genuinely has to weigh options the idea distinguishes.
3. End with the application question ("which next move uses the never-enough frame well?"), not "what is the definition of…".

**REJECT:**
- **A source-recall stem** ("According to the author, what does scarcity mean?") — this tests whether the reader memorized the page, not whether they can apply the idea to a new case; the chapter's whole job was transfer, and this throws it away.
- **A prompt that names its own answer** ("Given that naming the deficit reflex works, what should Rowan do?") — the reader reasons about nothing; the stem leaked the conclusion, so the question measures reading the prompt, not understanding the chapter.
- **A generic context with no protagonist or fork** ("What is the best leadership approach?") — with no concrete situation there is nothing to reason about, and the "best" choice becomes a vibe match instead of a judgment the idea forces.

**POSITIVE:** "When Rowan notices his first thought is *not enough sleep*, which next move uses Lynne Twist's never-enough frame well?"
**NEGATIVE:** "Which of the following best describes the never-enough frame as defined in the chapter?" — recall of a definition; the reader never has to *use* the frame on a case.

---

### `quiz.questions[].choices`

**JOB:** Offer exactly three moves a thoughtful reader could actually pick; the two distractors are the chapter's *real* misreadings (the plausible-but-wrong things people genuinely do), and the answer is reachable only by understanding the idea — never by the shape, length, or last noun of a choice.

**WRITE:**
1. Write the key as the move the idea actually endorses, in the same plain register as the distractors.
2. Build each distractor from a misreading the chapter explicitly corrects (deny-the-behavior, fix-by-comparison, escalate-the-rule), phrased as something a sincere person would choose.
3. Pressure-test for format tells: equal length, parallel grammar, no junk-directive prefixes, no "right sentence + wrong container-noun" — swap wording until only *meaning* separates the key.
4. NO `Label:` / category prefix on ANY choice — every choice is a plain sentence. If you tag one choice with a `Capitalized Phrase:` label, you must remove the tag from ALL choices.

**REJECT:**
- **Uniform category labels on every choice** ("Status Proof: …" / "Private Self-Governance: …" / "Audience Craft: …") — the reader sorts the key by the labels' *valence* (the virtuous-sounding tag) without reading the chapter. This is a deterministic gate (BP31) AND the model bar's quiz_distractor_quality REVISE driver. Write every choice as a plain sentence in the same register; if any choice carries a `Capitalized: ` tag, strip it from all three.
- **A distractor that is the correct sentence wearing a junk prefix** ("Reverse/Flatten/Prefer X over…") or decided by a trailing container-noun (roster vs. memo) — the reader passes by spotting the odd word, so the item tests pattern-matching, not the idea, and a careless writer hides a wrong key behind it.
- **Source-summary distractors** ("would be managed through", "would outrank") — these are pasted breakdown phrasing, not moves a person makes; they read as "wrong because they sound like a summary," letting the reader eliminate by tone instead of by understanding.
- **The key being the only clean / only long / only specific choice** — when the answer is findable by format the chapter is never exercised; a reader who understood nothing still scores.
- **A reused keyed string across chapters** (the same key sentence chapter after chapter) — the reader learns the *answer phrase*, not the concept, so retrieval transfers to no real situation.

**POSITIVE (the three choices read as three real moves):**
- "Rowan should ignore the tiredness and repeat a gratitude line until the morning feels lighter."
- "Rowan should name the deficit reflex, then choose one grounded action before the list defines his worth." *(key)*
- "Rowan should compare his schedule with a busier parent to prove the stress is manageable."

**NEGATIVE:** key = "Name the deficit reflex, then choose one grounded action." / distractor = "Reverse the deficit reflex, then choose one grounded action." — same sentence, junk prefix; answer is found by spotting "Reverse," not by understanding.

**NEGATIVE (labels):** key = "Private Self-Governance: the note trains his conduct first." / distractors = "Status Proof: the note mattered for public image." / "Audience Craft: the note is a polished lesson to impress." — every choice is tagged and the key's tag is the only virtuous-sounding one, so the reader picks by label valence. Strip all three labels and write plain sentences.

---

### `quiz.questions[].correctIndex` + `quiz.questions[].explanation`

**JOB:** `correctIndex` points at the choice that is genuinely true under the chapter's idea; the explanation (120–300 chars) gives the *reasoning* that makes that choice right and names *why a tempting distractor is wrong* — so the explanation could not survive being attached to a wrong key.

**WRITE:**
1. Verify the keyed choice is the one the explanation will defend — read them together; if the explanation argues against the key, the key is wrong.
2. State the mechanism that makes the answer correct ("the lens does not deny the behavior; it asks what reward system makes specialness feel required").
3. Name the trap in at least one distractor and why it fails ("denial isn't the point"), so the reasoning excludes, not just asserts.

**REJECT:**
- **`correctIndex` aimed at a choice the explanation contradicts** — the single worst defect: the reader studies the explanation, internalizes the *opposite* of the keyed letter, and leaves with a corrupted understanding. The explanation is the truth; make the index agree with it.
- **An echo-template explanation** that = keyed-choice text + restated prompt with no added reasoning (pairs with AC5) — a restatement cannot reveal a mis-aimed key, so it structurally hides wrong answers; it also teaches the reader nothing about *why*, only *that*.
- **Forcing "because" / a fake connective** to look like justification — the reasoning can teach by naming or contrast ("The point is not denial; it is refusing to let the first deficit become the whole story"); a bolted-on "because" with no mechanism is still an echo.
- **Treating a misconception-keyed-correct item as an error** — when the stem asks for the wrong reading ("What is the simplistic view to avoid?"), the key *is* the misconception and the explanation must confirm that's what the stem requested; do not "fix" the index.

**POSITIVE:** key = the scarcity-lens choice; explanation = "The scarcity lens does not deny the behavior. It asks what fear and cultural reward system make specialness feel required before belonging can feel secure." (reasons; excludes the deny-and-move-on distractor).
**NEGATIVE:** explanation = "The correct answer is to ask whether routines reward specialness, which is the response that follows the scarcity culture lens." — pure restatement of choice + prompt; if the index were wrong, this sentence would not flinch.

---

### `reviewCards[].front`

**JOB:** Ask a question (30–200 chars) that makes the reader *retrieve an understanding* — pull the idea, mechanism, or distinction back from memory — not recognize a label (pairs with AC6).

**WRITE:**
1. Open with a question word or recall stem ("What question…", "How does…", "Why does…", "What are the three…").
2. Aim at the idea or its mechanism, not a proper noun or page fact.
3. Phrase it so the answer is the *concept in action*, retrievable without having the chapter open.

**REJECT:**
- **A bare label or proper-noun subject as the front** ("Scarcity culture." / "Lynne Twist") — there's nothing to retrieve; the reader just reads a heading, so the card never exercises memory and teaches nothing on review.
- **A source-recall question** ("On what page does the author define scarcity?" / "What word did the author use?") — this retrieves trivia about the book, not the understanding the reader needs to use later; the card's whole value is transfer.
- **A front so broad it has no single answer** ("What is this chapter about?") — retrieval has no target, so the reader can't self-check, and the card stops being a memory test.

**POSITIVE:** "How does scarcity culture usually begin the day?"
**NEGATIVE:** "Scarcity culture's daily start." — a bare label; the reader recognizes a topic instead of recalling the deficit-inventory mechanism.

---

### `reviewCards[].back`

**JOB:** Answer the front (80–400 chars) in the card's *own words* — a complete, self-contained explanation of the retrieved idea that confirms the reader recalled it correctly; never pasted from the breakdown, never cut off.

**WRITE:**
1. Answer the front's question directly and fully, as finished prose written *for the card*.
2. Give the mechanism or the named parts so the reader can check their recall against something concrete.
3. End on a complete sentence; if a named framework has N parts, list all N.

**REJECT:**
- **Text pasted verbatim from the breakdown or source** — the reader is re-reading the same sentence they read in the chapter, so review reinforces rote phrasing instead of understanding, and identical strings across cards make the deck a memorization-of-wording exercise.
- **A truncated or mid-word ending** ("…before the list defines his wor") — an incomplete answer can't confirm correct recall and signals the field was machine-cut, not authored; the reader can't tell if their memory matched.
- **An incomplete named enumeration** (BRAVING listed as 6 of 7; "Vault" renamed to "confidentiality") — the reader memorizes a *wrong* framework, so the card actively corrupts the thing it exists to reinforce.
- **A back that restates the front instead of answering it** ("Scarcity begins the day with a scarcity beginning.") — no information is retrieved or confirmed; the card teaches nothing on review.

**POSITIVE:** "It starts with a deficit inventory: not enough sleep, time, money, safety, beauty, status, or certainty. That first lens can steer later choices."
**NEGATIVE:** "As the source notes in fastRead, scarcity culture begins with a deficit inventory that steers later cho" — pasted from the breakdown and truncated mid-word; review reinforces wording and can't confirm recall.
