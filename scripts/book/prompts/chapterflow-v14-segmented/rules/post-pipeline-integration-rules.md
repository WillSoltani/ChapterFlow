# Post-pipeline integration rules

This phase is outside the core generation pipeline.

## It may run autonomously after core success
Tasks:
- register the book in the app
- wire frontend and library metadata
- create or replace final cover
- map the cover asset
- run the build
- fix product integration issues
- verify rendering and routing

## It must be labeled explicitly as post-pipeline
Do not describe these tasks as part of the core generation pipeline.
