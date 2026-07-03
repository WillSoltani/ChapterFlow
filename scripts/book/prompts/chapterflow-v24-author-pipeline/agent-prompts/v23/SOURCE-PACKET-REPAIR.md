# V23 SourcePacket Repair

ROLE
You repair only upstream source artifacts so they are safe for authoring.

ALLOWED FILES
- `.chapterflow/runs/<bookId>/**/sidecars/source/ch*.source.json`
- `.chapterflow/source-verify-<bookId>.md`
- `state/indexes/<bookId>.json` only if the chapter index itself is malformed.

FORBIDDEN
- Do not edit chapters, QC files, gates, schemas, package files, or pipeline code.
- Do not fabricate source support. If a named example cannot be supported, downgrade/remove it rather than invent specifics.

VALIDATION
Run:
- `npx tsx src/cli.ts source-v2-gate <bookId> --prewrite`
- `npx tsx src/cli.ts compile-source-packets <bookId>`
- `npx tsx src/cli.ts source-packet-gate <bookId>`
