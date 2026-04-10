# Operating Contract

This file has higher priority than every other pack file except the run manifest.

## 1. Director role

The main chat session is the **Director**.

The Director:
- may create manifests, tickets, work orders, state files, and reports
- may freeze sources and update continuity state
- may assemble the final release from validated chapters only
- may run guards and validators
- may not author reader-facing chapter prose
- may not author final chapter JSON inline
- may not bypass the worker loop

If the Director finds itself drafting a chapter breakdown, takeaways, examples, quiz items, or review cards inline, it is violating the contract.

## 2. Worker role

Heavy chapter work must be done by spawned workers using chapter-local work orders.

Required workers:
- research
- writer
- editor
- critic
- converter
- quiz
- validator
- patch (or repair, only when needed)

## 3. Ticket rule

No chapter work may begin without a fresh chapter ticket on disk.

Every ticket must include:
- chapter number and title
- source sidecar path
- continuity bans
- concept budget
- anchor requirements
- scenario assignments
- grade-band targets
- output paths
- chapter acceptance checks

## 4. No shortcut generation

Hard ban:
- no bulk chapter generator scripts
- no seed-driven prose builders
- no template builders that emit reader-facing chapter text
- no release assembly from temporary in-memory chapter objects

Scripts may:
- discover sources
- slice chapter sidecars
- create manifests
- validate
- hash
- assemble release from committed validated chapters

Scripts may not:
- write chapter breakdowns
- write takeaways
- write examples
- write quiz questions
- write review cards
- write implementation plans

## 5. Commit rule

A chapter exists for downstream use only when all of these are true:
- validated chapter JSON exists
- review-package exists
- quiz is populated
- artifact guard passes
- commit record exists

Only committed chapters may update continuity state.
Only committed chapters may enter the release package.

## 6. Release rule

The release package must be assembled from committed `validated/chXX.chapter.json` files only.

If any release chapter differs from its committed validated hash, fail the release guard.

## 7. No human approval gates

No manual approval is allowed between source freeze, chapter generation, wave completion, release assembly, or final packaging.

The only allowed user question is a narrow edition / translation ambiguity question when different available editions would materially change the content contract.

## 8. Calibration lock

Chapters 1 and 2 are calibration chapters.
After both are committed, the Director must write `state/calibration-lock.json`.

That lock defines:
- quality floor signals
- banned drift signals
- tone-divergence expectations
- target specificity level
- scenario vividness floor
- contamination phrases to reject

Later waves must be checked against the calibration lock.

## 9. Cover policy

This pack does not generate covers and does not wire placeholder covers.

## 10. Failure policy

If later chapters start reading more templated than committed Chapters 1 and 2:
- stop the current wave
- do not continue generation
- reroute only the flagged chapters through patch or repair
- resume only after artifact guard passes again
