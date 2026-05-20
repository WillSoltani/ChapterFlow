# 48 Laws Regeneration — Per-Agent Brief

You are one of 11 parallel agents producing a complete regen of *The 48 Laws of Power* (v21). Laws 1–4 have already been written as the voice template. Your job is to produce 4 chapters in a specific Law range, hitting the Greene voice exactly, with zero shape collision against the rest of the book.

## YOUR ASSIGNMENT
(provided by the dispatching prompt — your 4 chapter numbers, 4 hook shape labels, 4 counter shape labels, 4 modern protagonist names, 4 historical figures, output file path)

## OUTPUT FORMAT — WHAT YOU SHIP

Write a single JSON file at the path provided in your assignment, in this exact schema:

```json
{
  "batch": "ch5-8",
  "agent": "agent-1",
  "updates": [
    {
      "number": 5,
      "hookShape": "H5",
      "counterShape": "C8",
      "modernProtagonist": "Adaeze",
      "historicalFigure": "Talleyrand",
      "hook": "...",
      "counterintuition": "...",
      "keyTakeaway": "...",
      "tryThisNow": "...",
      "breakdown": {
        "fastRead": "...",
        "deepRead": "...",
        "fullRead": "..."
      },
      "memorableLines": [
        {"text": "...", "location": "breakdown.fastRead", "why": "..."},
        {"text": "...", "location": "breakdown.deepRead", "why": "..."},
        {"text": "...", "location": "breakdown.fullRead", "why": "..."}
      ]
    }
    // ... 3 more chapters
  ]
}
```

Do NOT modify book-packages/the-48-laws-of-power.v21.json directly. Only write your output JSON file. A separate merger will combine all 11 batches into the package after all agents complete.

## MANDATORY READING BEFORE WRITING

1. Read [book-packages/the-laws-of-human-nature.v21.json](book-packages/the-laws-of-human-nature.v21.json) chapter 2 (Master Your Emotional Self) in full. That is the voice target. Notice: named scene actors, historical figure as character in a moment (Pericles), cool observational register, mechanism+limit, aphoristic closer.

2. Read Laws 1–4 prose in [book-packages/the-48-laws-of-power.v21.json](book-packages/the-48-laws-of-power.v21.json) — chapters 1 (Adaeze + Fouquet/Galileo + Mateusz), 2 (Theron + Borgia + Selma + Hsiang Yü/Liu Pang), 3 (Camille + Bismarck + Anders + Catherine de Medici), 4 (Reza + Louis XIV + Yusuf + Coriolanus + Kissinger). This is your direct voice template — match it.

3. Read [scripts/book/prompts/chapterflow-v21-authored/config/banned-phrases.json](scripts/book/prompts/chapterflow-v21-authored/config/banned-phrases.json) so you don't ship banned stems.

## PER-CHAPTER FIELDS (HARD RANGES)

- **hook**: 60–140 chars. Match the hook shape label given.
- **counterintuition**: 80–280 chars. Match the counter shape label given.
- **keyTakeaway**: under 30 words.
- **tryThisNow**: 1–2 sentences with a concrete action.
- **breakdown.fastRead**: 400–700 chars. ONE scene, then the Law lands.
- **breakdown.deepRead**: 1200–1800 chars. New scene (different protagonist from fastRead) + historical anchor as scene actor + mechanism + limit gesture.
- **breakdown.fullRead**: 2800–3800 chars. Another new scene + the historical anchor in a different beat + deeper mechanism + serious reversal + aphoristic closer.
- **memorableLines**: exactly 3 lines, each 30–180 chars, drawn VERBATIM from your breakdown prose. Each `location` field must match the tier where the text appears.

**FLOORS ARE HARD.** Under 400/1200/2800 = the chapter fails the scoring tool.

## HOOK SHAPE LABELS (12 SHAPES — your assignment specifies which 4 to use)

H1. Named-protagonist action: "Adaeze finds the dosage error at 6:47 a.m., and the resident class is watching."
H2. Historical figure in scene: "In 1502, Cesare Borgia rode into Senigallia smiling at the four condottieri who had just sworn loyalty back to him."
H3. Mid-action dialogue: "'Don't say a word,' the trainer whispers, and Anders watches the deal close around him."
H4. Time-anchored: "At 4:14 on a Tuesday, the silence at the board table meant something Camille had been waiting six weeks to hear."
H5. Sensory single image: "The folded infection chart on the steel counter is going to end someone's career by 9 a.m."
H6. Direct claim + twist: "The cleanest move in a closed room is often the one that looks like nothing happened."
H7. Question-led: "Why did Louis XIV's silences in council matter more than the speeches that followed them?"
H8. Counterintuitive opening: "The strongest position in a meeting is often the one that says least."
H9. Object-as-subject: "A folded chart on the chief's desk makes the resident class hold its breath." (USE SPARINGLY — book cap is 16 across 48)
H10. Place-as-subject: "In the back of the courtroom, Imani watches the witness change the case without saying a word."
H11. Aphorism-first: "A name spoken aloud turns a transaction into a relationship."
H12. Number/statistic-led: "Three weeks before the merger leaked, Camille had already moved her files."

## COUNTER SHAPE LABELS (12 SHAPES — your assignment specifies which 4 to use)

C1. Aphoristic + image: "Outshining a superior is a thrill that costs more than it pays."
C2. Conditional ("A friend works when..."): "A friend works when nothing is at stake. Hand them power over you and the same loyalty has to compete with envy..."
C3. Negation-reset (BANNED — use C8 or C9 instead. The form "X is not Y. It is Z" appeared in the failed stubs; do not resurrect it.)
C4. Order-of-events: "Words committed in front of the wrong audience commit you to defending them, then to repeating them, then to escalating them."
C5. Misnamed/redefinition: "Honesty about your intent is a courtesy people stop deserving once they hold something you want. The form of concealment is not lying. It is letting the field interpret..."
C6. Question-form: "Whose interest does your visible move serve, and which audience reads it?"
C7. Order-of-events (same as C4 — merge — count as one shape)
C8. Inversion: "What looks like a small concession is sometimes the only move that locks the larger position."
C9. Cost-accounting: "Force spent early in a negotiation rarely returns. The remaining leverage compounds against you."
C10. Mechanism-named: "Reputation works because most people read intentions from the surface of behavior, and most people are wrong."
C11. Paradox-direct: "Restraint can be aggressive when it forces the other side to construct their own losing argument."
C12. Limit-first: "Bold action fails when the field is already arranged against you. The discipline is to fix the field before you act."

**BANNED COUNTER PATTERNS (do not use, do not paraphrase):**
- "Direct force looks honest, but it can spend leverage too early. The sharper move is to handle [X] with…"
- "What feels like restraint can be the active move. The point is to use [X] so the field changes…"

## VOICE CHARTER

Read Laws 1–4 carefully. The voice has three pillars:

**Historical anchor.** Your assigned historical figure must appear as a CHARACTER IN A SCENE, not as a citation. Place them in a moment with a date, a physical detail, an outcome.
- WRONG: "Talleyrand argued that one should never outshine the master."
- RIGHT: "In 1809, Talleyrand stood beside Napoleon at the Erfurt Congress. The Tsar of Russia praised Napoleon's military genius. Talleyrand bowed and said nothing."

**Modern scene.** Use your assigned modern protagonist in a concrete contemporary situation. Specific clock time, physical object, decision-point.

**Mechanism + limit.** Greene's voice is observational and philosophical, not preachy. Each chapter explains WHY this Law works AND has a serious reversal section: when does this Law NOT apply?

**Register:**
- Cool, observational, slightly dark.
- Short to medium sentences. Occasional long sentence carries historical sweep.
- Aphorisms welcome but earned.
- NO modern pop-psych ("you got this!").
- NO consultant register ("the takeaway is").
- NO em dashes (—). Use periods or commas.
- NO meta-references: "this chapter", "the book", "Chapter N", "Greene argues".
- Every sentence starts with uppercase.

## BANNED PHRASES (in addition to the JSON config)

- "Most readers/people assume/think"
- "The paradox is that/this"
- "The mistake is" / "The trap is" / "The easy mistake is"
- "the real lever is" / "the real X is" / "the hidden X is"
- "this idea" / "the idea" as essay subject
- "Keep the clue" / "Leave the costume"
- "in three plain moves" / "point toward the chosen work"
- "on a note beside the work"
- "boundary condition" / "operating logic" / "tidy explanation" / "strips away"
- "is not decorative" / "is not magic"

## TIER ESCALATION

Three tiers, three distinct scenes minimum. NEVER restate the fastRead scene in deepRead or fullRead. Each tier opens with a new scene/protagonist/domain.

Across the 3 tiers per chapter, the chapter should contain:
- At least 1 historical figure in a SCENE (your assigned figure, and you may bring in a second if it serves the chapter).
- At least 3 named modern protagonists in scenes.
- A mechanism explanation.
- A reversal/limit section.
- An aphoristic image-anchored closer.

## NAMES TO USE

Use the modern names assigned to you. Do NOT use any of:
- v13 pool: Priya, Omar, Maya, Marcus, Elena, Lena, Victor, Theo, Jonah, Mateo, Tessa, Owen, Mira, Malik, Nadia, Felix, Caleb, Talia, Elise, Naomi
- Already-used in Laws 1–4: Adaeze, Solene, Mateusz, Theron, Asher, Imani, Selma, Camille, Anders, Beatriz, Reza, Yusuf
- Banned mod pool from task prompt: Sarah, Jordan, Jess, Alex, Maria, Kai, Nia, Dev, Ravi, Anika, Jamal, Hannah, Liam, Aisha, Chen, Sam

You may use the names assigned to you across multiple chapters in your batch (one primary per chapter, plus 2 secondary names per chapter from any unused pool).

## HISTORICAL FIGURES TO USE

Use your assigned historical figure as the primary anchor for at least 2 of your 4 chapters. For the others, you may pull a secondary figure from this Greene corpus pool (avoid figures already used heavily in Laws 1–4: Fouquet, Galileo, Borgia, Hsiang Yü, Liu Pang, Talleyrand, Bismarck, Catherine de Medici, Louis XIV, Coriolanus, Kissinger):

Available: Joseph Duveen, P.T. Barnum, Coco Chanel, Casanova, Empress Cixi, Lyndon Johnson, Ulysses S. Grant, Marie Antoinette, Frederick the Great, Napoleon, Caesar, Sun Tzu, Pericles, Shackleton, Disraeli, Cardinal Richelieu, Niccolò Machiavelli (the writer, not the actor), Otto von Bismarck (already used; secondary OK), Mao Zedong, Margaret Thatcher, Lord Palmerston, J.P. Morgan, Andrew Carnegie, Cosimo de Medici, Lorenzo de Medici, Henry VIII, Elizabeth I, Cleopatra, Henry IV of France, Maximilien Robespierre, Otto Bismarck. Plus military figures Greene used: Hannibal, Belisarius, Genghis Khan, Subutai.

Place them in DATED SCENES with specific moments.

## WORKFLOW

1. Read the mandatory benchmark files (LoHN Ch2, Laws 1–4 prose, banned phrases JSON).
2. For each of your 4 chapters: write the planning notes (one paragraph: what's the modern scene, what's the historical scene, what's the mechanism, what's the reversal).
3. Write each chapter in full per the field schema above.
4. Self-validate before shipping: tier lengths within ranges, no banned phrases (grep), no em dashes (grep '—'), memorableLines text appears verbatim in breakdown, hook+counter unique-enough (no shared first-4-words with Laws 1–4).
5. Write your output JSON file at the path provided.

## SELF-VALIDATION SCRIPT (run before declaring done)

```bash
# tier lengths
jq -r '.updates[] | "Ch\(.number): fast=\(.breakdown.fastRead|length) deep=\(.breakdown.deepRead|length) full=\(.breakdown.fullRead|length)"' YOUR_OUTPUT.json

# banned-phrase check
text=$(jq -r '.updates[] | .counterintuition + " " + .breakdown.fastRead + " " + .breakdown.deepRead + " " + .breakdown.fullRead' YOUR_OUTPUT.json)
for p in "The paradox is" "Most readers" "Most people" "The mistake is" "The trap is" "the real lever" "boundary condition" "tidy explanation" "strips away" "is not decorative" "this idea"; do
  c=$(echo "$text" | grep -ci "$p"); [ "$c" -gt 0 ] && echo "BANNED: '$p' x$c"
done

# em-dash check
jq -r '.updates[] | .hook + " " + .counterintuition + " " + .breakdown.fastRead + " " + .breakdown.deepRead + " " + .breakdown.fullRead' YOUR_OUTPUT.json | grep -c '—'
# Expected: 0

# memorable-line verbatim
python3 -c "
import json
d = json.load(open('YOUR_OUTPUT.json'))
for u in d['updates']:
    prose = u['breakdown']['fastRead']+'\n'+u['breakdown']['deepRead']+'\n'+u['breakdown']['fullRead']
    for ml in u['memorableLines']:
        if ml['text'] not in prose:
            print(f'CH{u[\"number\"]} memline NOT VERBATIM: {ml[\"text\"][:80]}')
print('done')
"
```

If any check fails, fix and re-validate before shipping.

## REPORT BACK TO THE COORDINATOR (when done)

Send a short report (under 200 words):
- Output file path written
- Per-chapter: hook shape, counter shape, historical figure, modern protagonist, tier lengths
- Any deviations from the assignment (and why)
- Any chapters you found hardest and how you handled them
