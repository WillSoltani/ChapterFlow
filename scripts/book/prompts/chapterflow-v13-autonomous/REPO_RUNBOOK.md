# Repo Runbook

This is the authoritative operating procedure for v13 Autonomous.

## A. Pack and run roots

Static files:
- `PACK_ROOT = scripts/book/prompts/chapterflow-v13-autonomous`

Generated files:
- `RUN_ROOT = .chapterflow/runs/{bookId}/{runId}`

Frozen source bundle:
- `RUN_ROOT/source-freeze/`

Never resolve dynamic files from `PACK_ROOT`.
Never resolve static rules from `RUN_ROOT`.

## B. Single-input launch model

The only required user inputs are:
- book title
- author

The launcher handles:
- `bookId` creation
- `runId` creation
- manifest prefill
- launch prompt generation

The orchestrator handles:
- source discovery
- edition / translation lock
- source freeze
- chapter sidecars
- full autopilot continuation

## C. Edition-selection rule

The orchestrator may ask the user **one concise question** only when a materially different edition or translation affects:
- chapter order
- chapter count
- translation-dependent interpretation
- abridged vs full text

If one dominant edition exists, lock it automatically and document why in `manifests/edition-lock.json`.

## D. Source discovery and freeze

Before any chapter work:
1. discover candidate sources on the web
2. write `manifests/source-ledger.json`
3. write `manifests/edition-lock.json`
4. freeze the selected source bundle into `source-freeze/`
5. build chapter-local sidecars under `sidecars/source/`

The source ladder is:
1. public-domain full text
2. official / authorized digital text or preview
3. official table of contents / chapter listing
4. reputable secondary sources for chapter interpretation
5. chapter-specific reference material when needed

Never use pirated or obviously unauthorized source mirrors.
Never paste raw frozen source prose directly into breakdowns except through the quote ledger.

## E. No-human-gate autopilot

Chapter 1 is no longer a manual stop.

The run now uses:
- **automatic chapter gate** for Chapter 1
- **automatic chapter gate** for Chapter 2
- **baseline quality floor** established by Chapters 1 and 2
- **wave quality sentries** for later chapters

If Chapter 1 fails:
- patch locally if the issue is local
- reroute through writer/editor if the issue is global
- halt only on a true blocker

If Chapter 1 passes:
- continue directly to Chapter 2

If Chapter 2 passes:
- seal Chapters 1 and 2 hashes
- compare later waves against the established baseline

## F. Wave rules

Default wave size: 2 chapters.

Use solo waves for:
- thin chapters
- morally dense chapters
- rhetorically dense chapters
- chapters with source scarcity
- chapters that tripped critic or contamination warnings

Every active chapter must still go through:
1. source sidecar
2. brief / dossier
3. outline
4. quiz blueprint
5. writer
6. editor
7. critic
8. converter
9. quiz
10. validator
11. patch / repair if needed
12. continuity update

No later chapter may skip the prose loop just because early chapters validated cleanly.

## G. Quality sentry rule

Before starting each new wave:
1. run artifact guard
2. confirm source ledger and edition lock still exist
3. confirm sealed chapter hashes unchanged
4. compare recent critic scores against the baseline floor
5. stop and reroute if quality decays beyond `qualityDecayStopDelta`

## H. Release assembly rule

The release package must be built by loading:
- `validated/ch01.chapter.json`
- `validated/ch02.chapter.json`
- ...
- `validated/chNN.chapter.json`

and concatenating them into `release/{bookId}.modern.json`.

No release builder may call content-generation functions.
No release builder may rebuild chapter bodies.
No release builder may normalize approved prose during assembly.

## I. Stop conditions

Stop the run immediately if any of these happen:
- a repo script authors reader-facing content
- a book-specific bulk generator is proposed
- a canonical or edited draft is structured-pseudo-prose
- contamination phrases appear in reader-facing content
- source-splice detector flags reader-facing prose
- release package chapter hashes differ from validated chapters
- tone collapse exceeds threshold in later waves

## J. Final release sequence

1. all chapters validated
2. release assembled from validated chapters only
3. release guard passes
4. repo wiring
5. repo-level validation
6. build passes
7. optional human skim
