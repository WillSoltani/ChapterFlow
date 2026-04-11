# Quality Memory

- No chapter skips brief -> outline -> quiz blueprint -> source sidecar -> writer -> editor -> critic -> prose decision -> converter -> quiz -> validator.
- No downstream invention beyond the brief and frozen source bundle.
- Auto-fail if content is generic enough to fit another chapter, repeats paragraph jobs, repeats endings, collapses hard into medium, or leaks brief/outline language.
- Prose audit checks the full chapter package, not just the breakdown.
- Scenario fields, `whatToDo`, and `whyItMatters` must be tone objects. Plain strings are hard fails.
- Easy stays lean. Do not bloat it with `moreDetails`, activation prompts, or extra support surfaces.
- Medium uses singular `selfCheckPrompt`. Hard uses array `selfCheckPrompts` with exactly two tone objects.
- Review wrapper must contain the full validated chapter JSON inside `chapters: [ ... ]`, not a partial blob.
- Quiz is required in chapter-gate mode. Empty `questions` is a fail.
- Validation may fix mechanical issues directly, but prose weaknesses require repair or reroute, not silent flattening.
- Later waves must preserve the Chapter 1-2 quality floor and stop if quality decay exceeds the manifest threshold.
