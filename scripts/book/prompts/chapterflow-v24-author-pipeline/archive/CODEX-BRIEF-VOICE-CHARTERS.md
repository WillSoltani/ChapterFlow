# CODEX BRIEF — Voice-charter differentiation (catalog campaign, Phase B3)

You are differentiating the per-book voice charters so the catalog stops
sounding like "one ghostwriter wearing 26 masks" (2026-06-10 reader review).
Work in `scripts/book/prompts/chapterflow-v21-authored/`.

## The problem

Every book currently reads in the same register: contraction-free, third
person, one aphorism per paragraph — Mel Robbins sounds like van der Kolk
sounds like Rework. The charters in `state/briefs/*.manual-brief.json` all
specify near-identical voices, so the voice bible (`src/lib/voiceBible.ts`,
pinned into every fanout prompt) reproduces the monoculture instead of
breaking it.

## The task

For EVERY `state/briefs/<bookId>.manual-brief.json` (~113 files): rewrite its
`voiceCharter`, `voiceSpecimens`, and (additively) `forbiddenMoves` so the
book gets a voice that matches ITS source author — edit ONLY those fields,
preserve everything else in the file byte-for-byte. Briefs are not covered by
the QC content hash, so this stales no attestations; it governs future
authoring and refreshes only.

### Register assignment (the distribution requirement)

Pick each book's `register` from: `plainspoken | warm | clinical | blunt |
wry | analytical | literary`. Assign by reading the book's
`source-freeze/toc.json` + 2 source sidecars (resolve via
`.chapterflow/runs/<bookId>/<runId>/`; take the newest run that has them)
AND what you know of the actual author's published voice:
- van der Kolk → clinical; Mel Robbins → warm + direct address +
  contractions; Rework/Jason Fried → blunt, short; Mark Manson → wry,
  profanity-adjacent without profanity; Brené Brown → warm-confessional;
  Taleb → analytical-combative; Cialdini → analytical; etc.
- **No register may exceed 25% of the catalog.** Tally as you go; include
  the final tally in your report.

### Per-charter requirements

- `register`, `person` (allow `second` where the author talks TO the reader
  — Robbins, Ferriss, Manson), `cadence`.
- `signatureMoves`: 3+ moves SPECIFIC to this author (e.g. "opens with a
  client's verbatim words" for van der Kolk, "numbers as punchlines" for
  Ferriss) — never the generic "open with a concrete scene" that every
  current charter shares.
- `avoidMoves`: must include the relevant house tics ("The point is", "the
  question is", maxim-per-paragraph cadence, the triadic abstract-noun list)
  PLUS 2 author-specific ones.
- `voiceSpecimens`: 2–3 sentences YOU WRITE in the target voice, teaching a
  plausible idea from this book (do not quote the real book verbatim — these
  are imitations of register, not excerpts). A warm register specimen MUST
  use a contraction; a blunt one must be under 12 words.
- Do not invent biographical/source facts. Voice is the claim, not content.

## Verification (run these, paste results in your report)

1. `npx tsx -e "import('./src/lib/voiceBible.js').then(async m => { /* iterate all manual-brief bookIds, print bookId + first line of formatVoiceBible */ })"` —
   every book renders a non-null block; no two adjacent blocks identical.
2. Register tally ≤25% each; at least 5 registers used.
3. Spot-render fanout for one warm-register and one clinical-register book
   (`fanout <bookId> --from N --to N` on an unwritten chapter, or `--all` on
   ch01) and confirm the VOICE bullet reflects the new charter.
4. `npx tsx tests/run.ts` stays green; both typechecks
   (`npx tsc -p . --noEmit` in pipeline dir AND at repo root) stay at zero.

## Hard rules

- Edit ONLY the three fields named above, only in `*.manual-brief.json`.
- Do NOT touch `state/qc/`, `state/chapters/`, or run `promote-book` /
  `register-web` / `qc-attest` / anything `--run`.
- Stage explicitly: `git add state/briefs/*.manual-brief.json` and nothing
  else (the working tree carries the operator's unrelated changes in
  `src/types.ts`, `src/critics/narrative.ts`, `src/critics/quizQuality.ts`).
- Report any book whose toc/sidecars are missing (skip it, list it) rather
  than inventing a charter from the title alone.
