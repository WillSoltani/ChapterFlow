# REPAIR SPEC — eliminate cross-chapter stock-phrase collisions

The 20 chapters were authored independently and a few connective phrases
converged across chapters. A gate (AS10) blocks when any 5-word span with 3+
content words appears in 3 or more chapters. Your job: reword ONLY the specific
sentences that contain the flagged phrases, so those phrases no longer appear,
while keeping the chapter coherent and every other gate satisfied.

## You edit ONE file in place
You will be given a chapter number NN and a list of TARGETS. Open:
`/Users/radinsoltani/ChapterFlow/scripts/book/prompts/chapterflow-v21-authored/scratch/authored-let-them/chNN.json`
Use the Read tool, then make minimal Edit(s) to reword the flagged sentences.
Keep it valid JSON. Do NOT touch any field not named in a target.

## GLOBAL BAN LIST — these exact phrases (and close variants) must NOT appear anywhere in your file after editing:
- "decide whether" and "decide which"   (use a DIFFERENT decision cue, see palette)
- "kitchen table"                        (use a different, scene-specific location)
- "true at the same time"                (reword the two-truths idea in fresh words)
- "and holding both"                     (reword)
- "the whole skill"                      (reword)
- "the hard edge is easy"                (reword)
- "the part you cannot force"            (reword)
If any of these already appears in a sentence you are NOT asked to edit, reword
that occurrence too (grep your file for each phrase before finishing).

## Decision-cue palette (every example scenario still needs a decision moment for
## non-reflection formats; use these instead of "decide whether", and VARY them so
## no two of your examples use the same one):
"has to choose between", "must choose between", "is about to", "is torn between",
"faces a choice", "the question is", "has a decision to make", "the real decision is",
"needs to choose", "must pick", "debates whether", "must tell", "has to say",
"is choosing between", "before she answers", "before he answers", "stops before".
Keep the surrounding words concrete and specific to this scene (not a generic stem).

## Hard constraints to preserve while editing
- No em dash anywhere.
- Each example scenario still >= 220 chars, still names a source proper noun, still
  has a concrete anchor (time/place/role/object) and (except reflection format) a
  decision cue from the palette.
- breakdown.fullRead still >= 2400 chars; do not delete content, just reword the
  flagged sentence(s). Keep the meaning.
- Do NOT change quiz, correctIndex, cards (unless a card target is given), keyTakeaway,
  tryThisNow, implementationPlan, memorableLines — UNLESS a target names them. NOTE: if
  you change breakdown text, make sure any memorableLines[].text still appears verbatim
  in the breakdown; if your reword deletes a pinned line, repoint it to another verbatim
  sentence from your breakdown.
- For two-truths rewrites: each chapter must phrase the "you can't control X but you can
  control Y" idea in ITS OWN words. Do not converge on a shared template.

## After editing, verify before finishing
- grep your file for every banned phrase above: zero hits.
- valid JSON; char floors intact; no em dash.
Return a one-line summary of what you changed.
