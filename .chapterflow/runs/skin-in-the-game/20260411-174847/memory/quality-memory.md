# Quality Memory

- Source of truth order: brief, outline, edited draft, structure rules, quiz blueprint, validation rules.
- No chapter may skip brief -> outline -> quiz blueprint -> source sidecars -> writer -> editor -> critic -> prose decision/audit -> converter -> quiz -> validator.
- Phase gates are strict. Do not continue if the current chapter has missing, malformed, partial, or inconsistent artifacts.
- Source sidecars must be created before writing and must derive from the frozen source bundle, not memory.
- Chapter gate requires: brief, outline, quiz blueprint, canonical draft, edited draft, critic report, structured chapter, quiz, validation report, validated chapter, review package, reading metrics, and source sidecar.
- Chapter gate also requires critic score >= 10/12, no auto-fails, no contamination, no scenario string violations, no empty quiz in generate mode, and no source-sidecar mismatch.
- Prose audit auto-fails repeated sentences, repeated endings, repeated paragraph jobs, repeated template tails, generic moreDetails, generic prompt surfaces, hard/medium collapse, recap replay, review-card echo, and slogan/thesis-first openings.
- Scenario, whatToDo, and whyItMatters must be tone objects in flagship mode.
- Easy has exactly 3 takeaway points and flat oneMinuteRecap only.
- Medium uses `selfCheckPrompt` singular. Hard uses `selfCheckPrompts` array of exactly 2 tone objects.
- Review wrappers must contain schemaVersion, packageId, createdAt, contentOwner, full book object, and a chapters array of exactly one full validated chapter.
- Mechanical validator fixes are allowed only for structural issues. Prose weakness, templating, tone collapse, specificity loss, contamination, or source-splice issues must escalate to repair.
- Repair only flagged defects and preserve unaffected material.
- Release assembly must read validated chapter JSONs only, sorted by chapter number, with no regeneration during assembly.
