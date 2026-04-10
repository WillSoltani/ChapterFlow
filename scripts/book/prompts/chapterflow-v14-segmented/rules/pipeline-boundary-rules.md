# Pipeline boundary rules

## Core autonomous generation pipeline
Ends when these exist and pass:
- frozen sources
- edition lock artifacts
- validated chapter artifacts
- release artifact
- final book JSON package
- required pipeline guards, lints, and validators

## Post-pipeline integration
Separate autonomous phase. Includes:
- app registration
- package exports
- library metadata wiring
- cover creation and cover mapping
- build and integration fixes
- UI-level verification

## Manual or recovery work
Not part of the happy-path pipeline:
- manual prose repair
- manual syntax rescue
- extra editorial polish after formal guards already pass

## Cleanup
Only after:
- final book JSON validated
- release guard passes
- integration complete
- build passes
- final cover in place
