# ChapterFlow v15 Locked — MasterValidator

Use this validator in two modes:
- `chapter_gate`
- `release_gate`

The validator's job is to prevent:
- mechanical shape failures
- contamination
- tone collapse
- release drift away from validated chapters

## First rule

A mechanically valid package can still fail if it contains:
- internal instruction leakage
- raw source splice contamination
- identical tone variants
- empty quizzes
- scenario strings where tone objects are required
- later chapters that drift below the Chapter 1 and 2 calibration floor

## Chapter-gate blocking failures

Block a chapter if any are true:
- quiz is missing or `questions` is empty
- any example `scenario`, `whatToDo`, or `whyItMatters` is not a tone object
- any required tone object is missing `gentle`, `direct`, or `competitive`
- any two tone variants are identical where meaningful differentiation is required
- contamination phrases appear in reader-facing content
- hard depth loses the chapter's threshold question or boundary condition
- critic score < 10/12
- chapter-quality auto-fail fires
- lint returns FAIL > 0

## Release-gate blocking failures

Block release if any are true:
- release package differs from validated chapter artifacts
- any chapter lacks a validated artifact
- any chapter lacks a real quiz unless explicitly deferred by manifest
- any calibration chapter hash changed after lock
- artifact guard fails on any chapter
- repo package and release package disagree materially
- build fails

## Required checks

### Structural
- valid JSON
- required fields present
- depth-specific field presence
- quiz shape
- review-card shape
- scenario tone objects
- tone divergence
- reading time present
- no empty arrays for required learning surfaces

### Prose / pedagogy
- no meta-distance leakage in takeaways, prompts, quiz explanations, cards, and implementation plan
- no brief/outline/control-note leakage
- no raw source pasted into breakdowns except allowed quotes
- easy / medium / hard are grade-band appropriate
- hard depth adds real boundary condition
- moreDetails are additive
- scenarios are vivid and distinct
- quiz questions test distinct principles
- explanation openers vary
- implementation plan is chapter-specific

### Release integrity
- release package assembled only from validated chapters
- chapter order correct
- chapters sorted
- calibration chapters unchanged
- source ledger and edition lock retained

## Required tools

Run:
- `python3 PACK_ROOT/tools/chapterflow_v15_lint.py <path> <mode>`
- `python3 PACK_ROOT/tools/chapterflow_v15_artifact_guard.py RUN_ROOT`
- `python3 PACK_ROOT/tools/chapterflow_v15_release_guard.py RUN_ROOT <release-path>` when validating release
- `node scripts/book/validate-book.mjs <path>` for repo mechanical checks

## Output shape

For each chapter or package:
- PASS / WARN / FAIL by category
- exact path / field where relevant
- exact reason
- whether the issue is `mechanical`, `contamination`, `prose`, `pedagogy`, or `release-integrity`
- recommended fix

If an issue is local:
- patch locally

If an issue is global but chapter-bounded:
- reroute only that chapter through repair

If an issue is release-integrity:
- rebuild release from validated chapters only
