# W1c Phase 0 — skills, owner verdict, root cause, Bennett source

Written 2026-10-02 by the W1c session (branch `v26/lesson-first`, base origin/main `22e021d84`).

## Skills inventory (what is installed, what this wave uses)

Session skill list, `~/.claude/skills/` (25 user skills) and plugin skills (`claude-code-skills`, `superpowers-dev`, synced design/engineering plugins) were listed. Chosen:

| Skill | How W1c uses it |
|---|---|
| `workflow-authoring` | Every substantive phase runs as one Workflow (research fan-out, design judge panel, owner-proxy adversarial pass). |
| `engineering-skills:senior-prompt-engineer` | Its rules drive Phases 2 and 5: eval set before any prompt change, a saved baseline, one change at a time, and a no-regression gate (a revision may not lose a passing item). |
| `humanizer` | Its signs-of-AI-writing list feeds the plain-words judge item and the adversarial readers' checklist. |
| `design:ux-copy` | Plain, user-facing wording for field definitions in the brief and for the reading pack's copy. |
| `engineering-skills:adversarial-reviewer` | Hostile-reviewer framing for the design judges (Phase 3) and the owner-proxy readers (Phase 5). |
| `superpowers:test-driven-development` | Phase 4: each code unit gets a failing test first. |
| `superpowers:verification-before-completion` | No "done" claim without a pasted pass line. |
| `book-score` | Not used as a target (its rubric scores the old story-era format). At most one advisory run. |

Not used: `superpowers:brainstorming`, `writing-plans`, `executing-plans` (BRIEF §7: they interview an absent owner).

## The owner's verdict, quoted against the text

ch01 X = rr21, Y = W1 prototype, Z = Q08 arm. Owner notes: `~/cf-wt/v26-plan/reading/W1/NOTES.md`.

**X (rr21)**
- "Short form is kinda vague. It doesn't teach the lesson properly." fastRead: *"His own son turned out to be a mixed student. Under George Brownell, young Franklin learned fair writing fast, but he never got the hang of arithmetic. A family plan cannot force a boy's real talent."* Three ideas, none landed.
- "The try this now is there for a purpose. A shorter summary and moral of the story doesn't belong there." tryThisNow opens *"Franklin once spotted a large heap of stones set aside for a new house, and he and his friends went at it like so many emmets…"*: a retelling.
- "Lines worth keeping … should have the moral of the story in sentence." memorableLines: *"The family story goes back further than Josiah Franklin, Benjamin's father."*
- "Examples are super long and don't reflect the lesson learned." ex01 is 165 words about a clerk's ledger (arithmetic vs handwriting), not about honest means.
- "what to do and why it matters should be directly relevant to the example". whyItMatters: *"Good handwriting and reliable arithmetic are separate skills … At Brownell's school Franklin picked up fair writing…"*: about Franklin, not the clerk.

**Y (W1 prototype)**
- "Standard could be lot more interesting. Some opener that makes the reader curious". deepRead opens *"Franklin begins in 1771, at the Bishop of St. Asaph's in Twyford, with a letter: 'Dear son'."*
- "The quizzes should test the lesson itself not what the summary is about." q1 *"Where did young Franklin and his friends get the stones for their fishing wharf?"*; q2 *"When the boys were caught, what defence did Ben offer his father?"*
- "Review cards are useless as it tests the Franklin story". rc1 *"What did young Franklin and his friends build with the stones meant for a new house?"*; rc3 *"If he could live his life again, what advantage would Franklin ask for?"*
- Liked: examples, practice, implementation plan.

**Z (Q08)**
- "How is the opening 'Franklin read almost before he could remember…' trigger curiosity". hook: *"Franklin read almost before he could remember, yet at Brownell's school in Boston, fair handwriting came easily while arithmetic never came at all."*
- "Try this now is not relevant to the lesson." *"The next time a bill's due date lands, write down what task of yours actually covers it before you pay…"*

## Root cause — confirmed

For **Y**, the brief asked for exactly what the owner rejected (`tools/proto/prompts/brief-franklin.md`):
- line 3, *"They came for Franklin: his stories, his dry humour…"*: the product is framed as the story;
- line 11, hook = *"a scene from this chapter"*: no curiosity or problem;
- line 23, q1–q5 *"Test the story and its idea"*;
- line 29, cards *"on a Franklin line or idea"*;
- and there is **no lesson field at all**: nothing names the one point every component must serve, so each component chose its own.

The writer did what it was told: the quiz and cards drill the story. The only lesson-serving parts (examples, practice) are the ones whose brief lines said "where the chapter's idea helps", and those are what the owner liked.

For **X and Z** (v25), the same missing spine shows up differently. Four blind section writers each got a dealt slot and no shared lesson, so the components drift apart: ex01 teaches arithmetic-vs-handwriting, tryThisNow teaches bill timing, and the lines are captions. The language level is high because the rulebook asked for Franklin's register in places.

**Conclusion:** the defect is the missing lesson anchor plus story-first field definitions. It is not the writer model or the fact checker. That points at a lesson step or a lesson-first brief, decided in Phase 3.

## Bennett source (for the held-out test chapter)

- Project Gutenberg eBook **#2274**, *How to Live on 24 Hours a Day*, Arnold Bennett. URL `https://www.gutenberg.org/cache/epub/2274/pg2274.txt`, fetched 2026-10-02. Raw file sha256 `9b82d3168c476d0b5238768555ebd50a3cc7bbf199927e6f065d35a650ebfa16`.
- Frozen body (between the START/END markers, CRLF→LF, trailer line removed): `~/cf-wt/v26-plan/data/bennett/source-text.txt`, 71,614 chars, sha256 `f3ee1b9b1e1be1a1eea5b2edb36a303537de0b7907bc4452756ed764a580dcf5`.
- Chapter map `data/bennett/chapter-map.json`: 12 spans split on the edition's own headings (I–XII), with titles from its table of contents. The v25 store's `chapter-index.json` used a different 13+ split and its sources are paraphrase packs, so neither was used. The two prefaces are outside every span (coverage 0.8735).
- **Held-out chapter: ch04 "The Cause of the Trouble"** (5,295 chars). It makes the book's clearest single point. The office worker treats ten-to-six as "the day" and the other sixteen hours as margin; Bennett's fix is to *"arrange a day within a day"* that begins at 6 p.m. and ends at 10 a.m. It is never used for tuning.
