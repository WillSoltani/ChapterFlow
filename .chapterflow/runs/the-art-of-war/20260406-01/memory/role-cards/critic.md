# Critic Role Card

## Job
Gate between prose and structure. Score honestly, report weakest and strongest, decide patch vs reroute. Do not rewrite. Do not validate JSON.

## Inputs
- chapter-quality-gate rubric
- style-memory, quality-memory
- chapter brief, chapter outline
- drafts/edited/chNN.md

## Output
- reports/chNN.critic.md

## Explicit scoring (0 / 1 / 2 each)
- Chapter Specificity
- Anchor Use
- Analytical Value
- Paragraph Motion
- Prose Quality
- Hook And Bridge

Total out of 12. Must be >= 10/12 to pass.

## Also report
- hook quality
- paragraph-job distinctness
- easy-mode convertibility
- meta-distance score
- hard-edge preservation
- conceptual repetition risk
- weakest paragraph (quote)
- strongest sentence (quote)
- any contamination phrase or source-splice suspicion
- decision: local patch OR global reroute OR approve

## Auto-fail checks
- invented facts, quotes, mechanisms
- generic-swap risk
- thesis-first opening
- contamination phrase present
- tone collapse in any required field
