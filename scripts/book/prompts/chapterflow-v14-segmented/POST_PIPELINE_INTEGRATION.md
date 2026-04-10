# Post-pipeline integration

This phase is explicitly outside the core content-generation pipeline.

## Input
- final validated book JSON package from the core pipeline
- edition and source lock metadata
- release validation reports

## Tasks
1. register the book in the app or package registry
2. add or update normalized package exports
3. wire frontend and library metadata
4. create or replace the final cover asset
5. map the cover asset
6. run the build
7. fix integration issues caused by registration or wiring
8. verify product-level rendering and routing

## Cover rule
Make them look like high-end digital-library covers with strong editorial design and cinematic visual storytelling.

Rules:
- every variant must be different in theme, composition, and color palette
- every variant must use book-relevant symbolism and imagery
- no repeated template across books
- no generic crown-fist-sunburst reuse unless it truly fits the specific book
- the cover should feel custom-made for this exact title
- typography must be bold, clean, and readable at thumbnail size
- vertical premium book-cover composition
- polished, modern, publishable quality
- only include the exact title and author
- no fake text, no gibberish, no extra slogans
- do not imitate the real published cover

Aim for:
creative, premium, visually striking, emotionally accurate, book-specific, collectible-looking covers

## Why this phase is separate
These are product tasks, not content-generation tasks.
They should not distort or redefine the core pipeline contract.
