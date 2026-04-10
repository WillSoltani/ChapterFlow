# Source Discovery Rules

Use the web to discover, verify, and freeze the source bundle.

## Required outputs
- edition lock
- source ledger
- source freeze bundle
- heading index
- chapter sidecars

## Selection rules
- prefer full text when legally and practically available
- prefer the translation / edition that is most standard for the target book family when multiple public-domain versions exist
- if a source is partial, mark it as partial
- do not imply full-text confidence when only secondary coverage exists

## Chapter sidecars
For each chapter, write a sidecar that contains:
- heading / chapter title
- source excerpt block
- coverage note
- named entities / terms
- allowed quote lines if any

Sidecars support the brief.
They are not reader-facing content.

## Allowed question to user
Ask once only if:
- edition ambiguity materially changes chapter boundaries or meaning
- and the choice cannot be resolved safely

Otherwise auto-resolve and continue.
