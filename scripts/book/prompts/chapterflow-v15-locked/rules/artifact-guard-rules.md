# Artifact Guard Rules

Use the calibration chapters to stop late-run drift.

## Calibration source
- Chapter 1 validated artifact
- Chapter 2 validated artifact
- calibration-memory.md
- calibration-lock.md

## Guard checks
Later chapters fail the guard if they show:
- empty quiz arrays
- scenario plain strings
- identical tone variants
- contamination phrases from briefs / seeds / internal notes
- source-splice contamination
- sharp spike in meta-distance versus the calibration chapters
- collapse of easy / medium / hard differentiation
- repetitive scaffolding phrases across many fields

If the guard fails:
- patch only the affected chapters
- rerun the guard
- do not continue to the next wave until it passes
