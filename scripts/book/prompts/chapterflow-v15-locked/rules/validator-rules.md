# Validator Rules

## First step
When validating a package JSON on disk, run:
`node scripts/book/validate-book.mjs <package-path>`

Use that script for mechanical findings, then run the checks below.

## Mechanical checks
- valid JSON
- required fields
- tone objects present
- depth-specific field presence
- word counts
- example schema
- quiz schema
- correctIndex validity
- format rotation
- ending-type rotation
- category distribution
- implementationPlan shape
- reviewCards shape
- keyTakeawayCard shape

## Contamination checks
Flag for patch/repair if any appear in reader-facing content:
- keep the prose narrow and concrete
- keep this question alive
- threshold question
- reading calibration
- unsupported zones
- used lazily, the point turns into
- raw source spill that was not approved as a quote

## Prose checks
Flag for repair if:
- breakdown feels generic
- moreDetails are filler or restatement
- hard repeats medium
- tone variants are adjective swaps
- scenario lesson convergence occurs
- implementation plan could belong to any chapter
- quiz uses unsupported facts
- repeated skeletons dominate
- first sentence is thesis-first
- closing drift into short dead declarations
- meta-distance is high in learning surfaces
- easy reads like compressed medium
- hard loses the threshold question

## Chapter-gate hard fails
- empty quiz.questions
- scenario plain strings
- identical tone variants
- critic score below threshold
- lint FAIL count > 0

## Output
Write:
- pass / warn / fail by category
- exact location
- exact reason
- issue type: mechanical / contamination / prose / pedagogy / release-integrity
- recommended fix

If only local issues exist:
- patch locally

If prose issues remain:
- write a focused repair report
