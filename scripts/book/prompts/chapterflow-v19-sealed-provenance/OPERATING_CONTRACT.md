# ChapterFlow v19 Sealed Provenance Contract

This pack exists to prevent the exact failure mode where the model simulates the workflow by manufacturing its outputs.

## Absolute rules

1. The Director may orchestrate but may not author reader-facing content.
2. No script may author chapter prose, examples, quiz content, review cards, implementation text, or final chapter JSON content from metadata or seeds.
3. Every committed chapter must have a verifiable provenance chain:
   - brief
   - outline
   - canonical draft
   - edited draft
   - critic report
   - structure partial
   - scenario partial
   - quiz JSON
   - assembled structured chapter
   - validation report
   - validated chapter
4. Release may be assembled from committed validated chapters only.
5. If lawful source coverage is insufficient for full-fidelity generation, stop with a true blocker. Do not improvise a weaker architecture.
6. No human approval gates in the middle of the pipeline.
7. No cover generation.

## Director drift test

Before writing any code or file batch, ask:
- Does this step author reader-facing content? If yes, stop.
- Does this step skip canonical or edited drafts? If yes, stop.
- Does this step create release chapters from metadata, seeds, or in-memory chapter objects? If yes, stop.
- Does this step mark a chapter committed without provenance receipts? If yes, stop.
