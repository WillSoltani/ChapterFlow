# Source Discovery

## Goal

Freeze enough authorized public material to support a five-unit ChapterFlow package for `Make Time` without inventing chapter order, central mechanisms, or edition details.

## Search Path

1. Official publisher metadata for a dominant print edition.
2. Authorized preview with visible contents.
3. Official author or book-site framing.
4. Secondary sources only if the official bundle left a structural gap.

## Findings

- Penguin Random House exposed a clean official page for the hardcover edition with ISBN `9780525572428`, publication date `2018-09-25`, publisher `Crown Currency`, and page count `304`.
- Google Books preview exposed the public contents list and showed the expected progression from introduction through the four-part framework.
- The official Make Time site explicitly summarized the framework as `Highlight`, `Laser`, `Energize`, and `Reflect`, and defined the opening problem as defaults driven by the Busy Bandwagon and Infinity Pools.
- Jake Knapp's official site linked to the book and matched the same authorship and framing.

## Decision

Lock the hardcover Crown Currency edition as the run's reference edition. Package the book as five high-level ChapterFlow chapters:

1. Introduction + How Make Time Works
2. Highlight
3. Laser
4. Energize
5. Reflect

This is a packaging choice, not a claim that the printed book contains only five chapters. The public contents show many tactics nested within the framework sections, and those tactics remain in scope as source material inside the five validated ChapterFlow units.
