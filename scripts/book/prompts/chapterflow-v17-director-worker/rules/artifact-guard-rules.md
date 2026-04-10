# Artifact Guard Rules

Run after every validated chapter and before every release.

Fail if any are true:
- internal instruction phrases appear in reader-facing content
- source text is pasted directly into teaching surfaces without quote support
- scenario is a plain string where a tone object is required
- quiz is empty
- two tone variants are identical or near-identical
- later chapter quality falls below calibration floor
- chapter contains obvious generator scaffolding or repeated template leads

The artifact guard protects against drift, contamination, and silent schema shortcuts.
