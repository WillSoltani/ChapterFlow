# Source Discovery — Difficult Conversations

## Discovery summary
- Title supplied: *Difficult Conversations: How to Discuss What Matters Most*
- Author supplied: Douglas Stone, Bruce Patton, Sheila Heen
- Discovery date: 2026-04-06
- Discovery mode: `local_source_pack`
- Rights posture: modern trade book; paraphrase-first local source pack only

## Search and selection path
1. The run manifest already locked the book identity to the 10th Anniversary Edition metadata.
2. The local source pack under `.chapterflow/sources/difficult-conversations` provided the primary text and support notes.
3. Because the source pack was already staged in-repo, no additional edition arbitration or external discovery was needed for this repair.

## Frozen bundle contents
- `manifests/source-ledger.json`
- `manifests/edition-lock.json`
- `source-freeze/book-source.txt`
- `source-freeze/toc.json`
- `source-freeze/source-freeze-report.md`

## What was not frozen
- No new network retrieval was performed during this repair.
- No unauthorized mirror or pirate source was added.
- No alternative edition was introduced.

## Operating implications
- Reader-facing prose remains paraphrase-first.
- Chapter scope should continue to follow the staged local source pack and existing run manifest.
- Repair artifacts were backfilled from the validated run state and local source inventory only.
