# Release Validation Report

- Status: fail
- Release artifact: `release/the-charisma-myth.modern.json`
- Chapter count: 13

## Release checks

- source guard: pass
- `python3 scripts/book/prompts/chapterflow-v13-autonomous/tools/chapterflow_v13_release_guard.py .chapterflow/runs/the-charisma-myth/20260409-003349 .chapterflow/runs/the-charisma-myth/20260409-003349/release/the-charisma-myth.modern.json`: pass
- assembled from `validated/*.chapter.json` only: pass
- all chapters present in release: pass
- release chapters match validated chapters: pass
- continuity seals match canonical validated payloads: pass
- `python3 scripts/book/prompts/chapterflow-v13-autonomous/tools/chapterflow_v13_lint.py book-packages/the-charisma-myth.modern.json release_gate`: fail
- `node scripts/book/validate-book.mjs book-packages/the-charisma-myth.modern.json`: fail
- `npm run build`: pass

## Blocking results

- release lint blocker: `FAIL=136 WARN=0`
- repo validator blocker: `RESULT: FAIL`

## Primary blocker themes

- stricter release-gate prose audit rejects legacy chapter-package surfaces in earlier validated chapters, especially repeated reinforcement stems, thesis-first openings, and medium/hard overlap in Chapters 1-8
- repo validator contract diverges from the current validated package shape in multiple places, including:
  - `book.categories` must be non-empty
  - medium-depth prompt shape in earlier chapters
  - `implementationPlan.ifThenPlans[].context` missing in Chapters 11-13
  - example format vocabulary mismatch against the validator's canonical format set
  - release-level word-band checks on earlier validated chapters

## Result

Release assembly is correct and build-safe, but release gate is blocked by repo-level validator and release-lint failures in already validated chapter payloads. This run cannot lawfully proceed to a passing release gate without repairing those earlier validated artifacts on the strict path.
