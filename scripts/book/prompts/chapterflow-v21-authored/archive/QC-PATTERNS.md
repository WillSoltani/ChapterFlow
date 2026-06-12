# QC Patterns — sending work back to the reviewer

The pipeline ships with a deterministic critic stack (ship gate, book gate, source-coherence, quiz quality, n-gram template detection) that already catches every defect class from the 86-book audit. The reviewer (me, in this session) adds:

- **Judgment calls the deterministic gates can't make** — voice authenticity, factual accuracy, whether a "named example" is actually from the book or invented, whether a chapter's coreMove matches the source author's argument.
- **Sanity-check on agent output** — does this read like the author, or like a generic productivity blog?
- **Cross-agent consistency** — if you split a book across multiple writer agents, did they drift in voice or duplicate examples across their assignments?

This file lists the patterns you can paste into the reviewer chat.

---

## Pattern 1 — Audit a finished package

> **QC `book-packages/<slug>.v21.json`.**

I will:
1. Run every deterministic critic over the package (ship gate per chapter, book gate, n-gram template detection, cross-chapter duplicate distractor, source-coherence against the latest research bundle if one exists).
2. Spot-check 2-3 chapters by reading them for voice authenticity and example plausibility.
3. Compare voice/cadence across chapters for drift signals.
4. Return a verdict: GREEN (ship as-is), YELLOW (ship with notes), RED (fix the listed issues before shipping).

---

## Pattern 2 — Audit a single chapter in flight

> **QC chapter `<chapterId>` — does it match the chapter's source notes and the book's voice?**

I will:
1. Read the cached chapter JSON at `state/chapters/<chapterId>.v21-native.chapter.json`.
2. Read the chapter source at `.chapterflow/runs/<bookId>/<runId>/sidecars/source/chNN.source.json`.
3. Run the ship gate.
4. Check: do the examples teach the chapter's `centralConcept`, or are they generic? Do the named examples match what the source notes claim is actually in the chapter? Does the breakdown's voice match the bibliography's `authorVoice`?
5. Return a chapter-level verdict + actionable notes.

---

## Pattern 3 — Audit research before any chapter is written

> **QC the source bundle for `<bookId>` — bibliography correct? Per-chapter sources specific enough?**

I will:
1. Run `check-source <bookId>`.
2. Read the bibliography for chapter-list accuracy against my training knowledge of the book.
3. Spot-check 2-3 chapter source JSONs for: specificity of `paraphraseNotes`, plausibility of `namedExamples`, sharpness of `hardEdge`.
4. Return a research-stage verdict.

Catching research errors here is cheaper than catching them after chapters are written.

---

## Pattern 4 — Voice consistency across multiple writer agents

> **You have agents A, B, C writing chapters 1-5, 6-10, 11-15 of `<bookId>`. QC voice drift across the three groups.**

I will:
1. Read one representative chapter from each group's output.
2. Compare cadence (avg sentence length, paragraph rhythm), register (warm / analytical / plainspoken / literary / clinical), and signature moves (does each chapter follow the bibliography's `authorVoice.signatureMoves`?).
3. Flag specific drift incidents with chapter + section + offending text.

---

## Pattern 5 — Compare two agents' work on the same chapter

> **Two agents wrote `<chapterId>` independently — A's version at `path-A.json`, B's at `path-B.json`. Pick the stronger one and tell me why.**

I will:
1. Run the ship gate on both.
2. Compare on the dimensions the gate can't measure: example specificity, hard-edge sharpness, voice authenticity, quiz distractor plausibility, memorable-line quotability.
3. Recommend one with concrete reasoning, and identify what to borrow from the loser.

---

## Pattern 6 — Diagnose a stuck agent

> **Agent on `<bookId>` says it's blocked on Ch7. Here's their last-attempt JSON: `<path>`. Help me unblock it.**

I will:
1. Run the ship gate and read the findings.
2. Identify the structural issue (often: misread of the chapter's core move, or a stale memorable-line pointer after a breakdown rewrite).
3. Tell you exactly what to instruct the agent to change.

---

## Pattern 7 — Smoke test before promotion

> **`<bookId>` is at the finalize stage. Run a full smoke before I promote.**

I will:
1. Run ship gate on every chapter.
2. Run book gate via `generate-book <bookId> --no-categorizer ...`.
3. Read the first paragraph of every chapter's `fastRead` to check for inter-chapter voice drift.
4. Confirm or block the promotion with a written go/no-go.

---

## Pattern 8 — Pre-distribute book across agents

> **I want to assign `<bookId>` to N agents. Recommend the split + which chapters each should get.**

I will:
1. Read the bibliography (if exists) or my training knowledge of the book.
2. Group chapters by topical clusters that should stay together (e.g., "The Four Laws" chapters in Atomic Habits all teach the same skeleton — same agent should do them for voice consistency).
3. Suggest a split that minimizes cross-agent dependencies.

---

## What to send me

For any pattern, I need three things:

1. **The pattern number or its prose form.**
2. **The bookId or chapter path** (so I can read the cached artifacts).
3. **(Optional) The agent's last message** if there was an issue you want diagnosed — paste it, I'll read it.

Example:

> Pattern 2 — QC chapter `atomic-habits-ch03`. Agent says voice feels off compared to Ch1 and Ch2. Their last message:
> [paste]

I'll read the cached JSONs and give you the verdict.

---

## What I won't do

- Write chapter content myself — that's the writer agents' job; I'd defeat the parallelism if I started writing here.
- Run subprocess `claude -p` or `generate` commands — same no-API constraint.
- Override the deterministic gates — if the ship gate says PASS but I see a real quality issue, I'll surface it; if it says BLOCK, the writer agent must fix it before I sign off.

---

## TL;DR for the reviewer chat

> "QC `<bookId>` / chapter `<chapterId>` / book package `<path>` — [what to look at]."

I read the on-disk state, run the critics, add the human judgment the critics can't make, and return a verdict.
