#validator-rules.md
You are validating one structured chapter or an assembled book package.

Policy:
- fix mechanical and structural issues directly
- do not silently rewrite major prose sections just to force a pass
- if the issue is prose quality, write a repair report instead

## First Step

If validating a package JSON on disk, run:

```bash
node scripts/book/validate-book.mjs <package-path>
```

Use that script for mechanical findings.
Then perform the human-style checks below yourself.

## Mechanical Checks

Check and fix directly where possible:

- valid JSON
- required fields present
- tone objects present where required
- depth-specific field presence
- word counts
- example schema
- quiz schema
- correctIndex validity
- format rotation
- endingType rotation
- category distribution
- dialogue quote count
- implementationPlan shape
- reviewCards shape
- keyTakeawayCard shape
- wiring and assembly references if validating the full package

## Prose Checks

Flag for repair if any are true:

- chapter breakdown feels generic enough to fit another chapter
- `moreDetails` are generic filler
- `moreDetails` contain mini-vignettes or fictional characters
- `moreDetails` overlap materially with examples
- `moreDetails` restates the parent takeaway instead of extending it with new information
- hard depth repeats medium instead of deepening it
- tone variants are adjective swaps
- examples feel templated or interchangeable
- 3 or more scenarios give the same core recommendation in whatToDo (lesson convergence)
- implementation plan could belong to any chapter
- quiz uses unsupported facts
- repeated sentence skeletons dominate the chapter
- fake depth or pseudo-science appears
- invented quotes or unsupported study details appear
- first sentence is thesis-first instead of hook-first
- closing sentences repeat shapes or fall into short `It is / This is / That is` declarations
- examples violate format/category assignments from the brief
- quiz explanations repeat opener patterns
- activation prompts are truncated, passive, or merely describe the chapter instead of prompting action
- self-check prompts are identical across tones (tone collapse)
- self-check prompts are declarative statements instead of questions
- prediction prompt reads as a preview or teaser rather than asking for a prediction
- recap retrieve sections are pre-written summaries instead of recall challenges
- "The person who" or "The player who" appears more than 3 times in competitive tone fields

## Severity Model

Mechanical failures:
- missing required field
- invalid tone object
- invalid word count
- invalid example or quiz shape

Prose failures:
- genericity
- unsupported depth
- tone collapse
- repetition
- weak scenario design
- lesson convergence across scenarios
- chapter-unspecific implementation advice
- weak hook or dead bridge
- passive or broken activation/self-check/prediction prompts
- summary-style recap retrieve sections
- moreDetails that restate rather than extend

## Output

Write:
- pass / warn / fail by category
- exact location
- exact reason
- whether it is `mechanical` or `prose`
- recommended fix

If only mechanical issues exist:
- fix them
- write the validated JSON

If prose issues exist:
- write a focused repair report
- do not try to solve everything by flattening the chapter into generic compliance prose

## v16 additions
- `examples[].scenario` as a plain string is a fail.
- empty `quiz.questions` is a fail at chapter gate by default.
- identical tone variants are a fail.
- instruction leakage into any reader-facing field is a fail.
