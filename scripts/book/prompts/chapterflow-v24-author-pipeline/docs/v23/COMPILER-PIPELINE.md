# ChapterFlow v23 Compiler Pipeline

The v23 path keeps the final `ChapterV21` JSON schema unchanged and inserts a typed artifact compiler before chapter assembly.

Lifecycle:

```text
research → source packets → blueprints → section artifacts → validation → assembly → evidence gate → risk score → formal QC → publish
```

The main efficiency change is that broad pre-QC variety/readiness loops are no longer the default for compiler-mode `book-run`. Variety is reserved in deterministic blueprints; factual readiness is enforced by source packets and evidence maps; medium-reasoning Codex sessions write narrow section artifacts.

`book-run` defaults to compiler mode. The old whole-chapter writer path remains available with:

```bash
npm run cli -- book-run <bookId> --legacy-whole-chapter-writer
```

Recommended first run:

```bash
npm run cli -- book-run <bookId> --max-parallel 8 --no-publish
```
