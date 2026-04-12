# Source Freeze Report

Frozen at: 2026-04-11T17:47:52Z

## Bundle summary

- Official title metadata frozen from Penguin Random House.
- Bibliographic record and partial contents frozen from Google Books.
- Full chapter map frozen from a library catalog record after cross-checking the visible sequence against Google Books.
- Early-chapter interpretive notes frozen from Ted Neward's notes and a medical-history source on Archie Cochrane.

## Sufficiency judgment

This bundle is sufficient for:

- whole-book skeletoning
- chapter-by-chapter briefing
- Chapter 1 and Chapter 2 source sidecars
- paraphrase-first prose generation

This bundle is not sufficient for:

- broad exact-quote use
- unsupported anecdotal detail beyond the frozen notes
- free expansion into claims not visible in the source bundle

## Guardrails for downstream stages

- Use chapter titles and structure exactly as frozen in `toc.json`.
- Treat the official jacket copy as metadata support, not as chapter prose to be reused.
- Keep Chapter 1 anchored to the expert-vs-superforecaster contrast, the dart-throwing-chimp finding, the Bouazizi / Arab Spring limit case, and the forecast-measure-revise logic.
- Keep Chapter 2 anchored to the book's attack on overconfidence and knowledge illusion, with Archie Cochrane as the evidence-and-humility anchor.
