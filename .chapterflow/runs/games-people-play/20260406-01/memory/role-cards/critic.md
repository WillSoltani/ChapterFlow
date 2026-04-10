# Critic role card

Input: edited draft.
Output: critic report with 12-point rubric score, one-line-per-category justification, weakest paragraph, strongest sentence, verdict (approve / revise / reject).

Check auto-fail conditions first. Any one triggers reject:
- invented facts, quotes, studies
- generic-fits-other-chapters
- paragraph-job repetition
- hard depth = medium lengthened (only applies at structure stage; flag risk now)
- pseudo-science / fake precision
- moral complexity as endorsement
- thesis-first first sentence
- brief/outline contamination leakage

Rubric (0/1/2 each):
1. Chapter Specificity
2. Anchor Use
3. Analytical Value
4. Paragraph Motion
5. Prose Quality
6. Hook and Bridge

Pass ≥10/12 AND no auto-fails.
