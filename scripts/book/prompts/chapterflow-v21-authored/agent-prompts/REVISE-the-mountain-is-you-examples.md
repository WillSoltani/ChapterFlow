# REVISE — the-mountain-is-you — example-slate de-templating (+ 2 gate majors, 2 minor fixes)

**Verdict from QC round 1:** YELLOW (GENERATED_DRAFT). Every scored chapter (ch01, ch04, ch07) is
key-correct, accurately grounded, and coherent — but **not publishable** because the 6-scene example
slate in each chapter is built on a shared structural skeleton. This is an `example_coherence`
sub-0.6 hit (the "shared skeleton" defect). The deterministic gates CANNOT catch this — they pass GREEN.
No corruption was found (all 27 sampled quiz keys correct, prose teaches, source grounding is real).

This is a **quality pass**, not a rewrite. The teaching content, frameworks, quiz keys, and source
grounding are good. Do **not** regenerate the book.

---

## 1. Why this redo exists — the defect, with verbatim evidence

### Defect A (PRIMARY): example slates share one structural skeleton per chapter

The 6 examples in a chapter must each be a **structurally distinct** scene. Right now one sentence
template describes all six. Two skeletons are in use:

**A1 — "ticking deadline" frame (ch01, all 6 scenes).** Every scene ends with "must [act] before
[imminent deadline]":
- ch01[0] Brandon: "He must send the form **before boarding**" / "closes **before midnight**"
- ch01[1] Ming: "supervisor wants a diagnosis note **before rounds**"
- ch01[2] Ephrem: "**Before payroll locks**, he has to face the bill"
- ch01[3] Janet: "**before the meeting starts**" / "board meeting starts **in twelve minutes**"
- ch01[4] Presley: "**Before the neurologist returns**, Presley must tell..."
- ch01[5] Hazel: "Her sister expects an RSVP **by noon**"

**A2 — "source-citation artifact" frame (ch04 + ch07, all 6 scenes).** Every scene physically plants
the cited author/year on a prop in the room:
- ch04[0] "A note in her bag names Daniel Z. Lieberman, Michael E. Long, and The Molecule of More."
- ch04[1] "Brian Tracy's 2019 note about the subconscious mind... is taped inside his sketchbook."
- ch04[2] "his handout cites Adam Cole, NPR, and 2016."
- ch04[3] "The 2018 passage from The Molecule of More, with Daniel Z. Lieberman and Michael E. Long underlined..."
- ch04[4] "Brian Tracy, 2019, subconscious mind, and automatic reactions appear in the margin..."
- ch04[5] "a clipping from Adam Cole at NPR about the 2016 correction..."

**ch07 stacks BOTH A1 and A2 in all 6 scenes** (a cited artifact + "Five minutes before staff arrive" /
"Before the retrospective ends" / "By morning" / "Before the stairwell lights dim" / "Before the
elevator opens" / "by Monday"). This is the most templated slate in the book.

**Diagnostic to pass:** for each chapter, no single sentence template may describe ≥half the scenes.
Read the 6 scenes **together** and confirm they vary in structural shape — not just in name/place/object.

### Defect B (gate majors — confirmed by `book-gate`)

- **B11** — 4 of 7 chapters (Ch3, Ch4, Ch5, Ch6) open `counterintuition` with a negation-correction
  shell ("X is not Y. [correction]"). Vary the paradox-signal shape in at least 2 of these 4.
- **B13** — 4 of 7 chapters (Ch1, Ch2, Ch3, Ch6) open the `hook` with the word "The". Re-open at least
  2 of these 4 with a different first word.

### Defect C (minor, while you are in the files)

- **ch01 reviewCards[4] front is ungrammatical:** `"How does the opening frame imperfection?"` — a verb
  is missing. Fix to e.g. `"How does the opening frame treat imperfection?"` (back is fine, keep it).
- **ch07 breakdown + examples[3] misspell the Hygge author:** `"Miek Wiking"` → should be **"Meik Wiking"**.

---

## 2. Fields that CHANGE

- `examples[*].scenario` (the scene text) — **all 7 chapters.** De-template per §3.
- `counterintuition.text` — only the 2+ chapters you re-shape for B11 (from Ch3/4/5/6).
- `hook.text` — only the 2+ chapters you re-open for B13 (from Ch1/2/3/6).
- `reviewCards[4].front` — **ch01 only.**
- `breakdown.*` and `examples[3].scenario` — **ch07 only**, the `Miek`→`Meik` spelling fix.

## 3. Fields that MUST NOT change

- Any `quiz` field — **keys are verified correct; do not touch prompts, choices, correctIndex, or explanations.**
  (If a quiz references an example scene's name, keep that name stable — see §4.)
- `breakdown` teaching content (except ch07's spelling fix), `keyTakeaway`, `tryThisNow`,
  `implementationPlan`, `memorableLines`, `reviewCards` backs.
- `examples[*].title` and the **named person** in each scene (names are consistent with the quiz; keep them).
- The **source grounding** — every example must still teach the same real concept from the same real
  source. You are changing scene *structure*, not facts.

## 4. Per-field composition rule (examples)

For each chapter's 6 scenes, keep: the named person, the domain, the real concept taught, the source.
**Change the structural shape so the six scenes do not rhyme.** Concretely:

1. **Kill the mandatory deadline.** At most 1–2 of the 6 scenes may use a clock/deadline. The others must
   create stakes a different way (a realization mid-action, a pattern noticed across past attempts, a
   conversation, a physical sensation, a choice already half-made). A scene illustrating "a block protects
   a hidden need" does not need a ticking clock.
2. **Kill the in-scene citation prop.** Do **not** plant "[Author], [Year], [concept]" on a note/handout/
   clipping/margin in the room. Grounding belongs in `breakdown`/sidecar, not stapled into every scene.
   At most 1 scene may name a source naturally (e.g. a character actually reading the book). The rest
   should dramatize the *concept* without quoting its citation.
3. **Vary the opening move.** Don't start every scene with "[Name] [verbs] [object]." Mix: dialogue,
   interior thought, an action already in motion, an observation, a consequence.
4. Each scene = a real human doing something specific in a domain-appropriate setting (the per-scene
   coherence is already good — preserve it). Keep one name = one person across breakdown/examples/quiz.

## 5. Done-condition

A reviewer (or you) must confirm ALL of:
- [ ] Per chapter: `npx tsx src/cli.ts gate-chapter state/chapters/the-mountain-is-you-ch{NN}.v21-native.chapter.json`
      → `Gate verdict: PASS — 0 blockers` for all 7.
- [ ] `npx tsx src/cli.ts book-gate the-mountain-is-you` → `Book gate: PASS`, **B11 and B13 majors gone**
      (or reduced below the cap).
- [ ] Read each chapter's 6 scenes **together**: no single sentence template describes ≥half of them;
      ≤2 scenes use a deadline; ≤1 scene plants a citation prop.
- [ ] ch01 `reviewCards[4].front` is now grammatical; ch07 says "Meik Wiking".
- [ ] Quiz keys/choices/explanations are byte-identical to before (diff them) — except where a scene's
      person-name must stay matched to the quiz (it should not have changed).
- [ ] Re-run QC: the 3 attestations will go STALE on edit (content hash changes) and must be re-reviewed
      → target `PUBLISHABLE` on ch01/ch04/ch07 plus a scored middle chapter.

If after this pass the slates still rhyme, escalate: the example generator is producing slot-filled
scaffolds and needs a structural fix, not another content pass.
