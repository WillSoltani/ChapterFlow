# Evaluator tests

Run the complete offline suite from the repository root:

```bash
python3 -m unittest discover \
  -s .agents/skills/chapterflow-book-evaluator/tests \
  -p 'test_*.py' -v
```

The suite uses only Python's standard library and synthetic packages under
`fixtures/`. It must not read or score packages from the repository's real
`book-packages/` directory. Archive files and mock rater records are created in
temporary directories and removed automatically.

Future revisions must keep these checks green:

- the skill metadata still invokes for ChapterFlow package evaluation and the
  documented CLIs remain usable from the repository root;
- discovery is deterministic, ignores non-books, records malformed packages,
  detects archive/directory duplicates, and emits exactly two blind rater jobs
  per canonical scoreable book;
- archive extraction rejects traversal, symlinks, and unreasonable expansion;
- every blind record has all 36 integer ratings, all-chapter coverage, required
  locator evidence, valid arithmetic, and an isolated external-accuracy gate;
- a chapter-number inventory gap is unscoreable, a truncated saved inspection is
  rejected by independent source reinspection, and no jobs are created for it;
- primary and verification results require source-bound orchestrator dispatch
  receipts, distinct job/task/session identities, and a sealed exact-result pair
  receipt; relabeling a cloned primary result cannot establish independence;
- every active stage hard-fails chapter-sample manifests, records, reports, and
  update envelopes; no sample-only executable or contract ships with the skill;
- adjudicated records preserve primary, verification, and final values, permit
  half points only after adjudication, and record agreement/confidence data;
- aggregation refuses a lone adjudication, revalidates both blind records against
  the current source inventory, and recomputes the pair's agreement trail;
- hard gates remain separate from weighted scores and evidence-based
  adjudication is not replaced by averaging;
- the deterministic pipeline aggregates adjudicated fixture data, writes the
  required JSON/CSV audit artifacts, renders one self-contained report, and
  passes report validation;
- the HTML contains every fixture book, accessible chapter, domain, and
  subcriterion, has useful static fallback content, unique IDs and local
  anchors, and embeds data semantically identical to `report-data.json`;
- package strings cannot terminate the JSON script element or execute markup;
  runtime code uses DOM text APIs rather than `innerHTML` injection;
- scripts, styles, fonts, data, and downloads require no web access; and
- a one-book refresh requires a byte-identical mirror, invokes the independent
  complete report validator, and writes its typed baseline-hash-bound receipt
  only inside the successful output transaction. The receipt has one transaction
  id and exact root/path/hash inventories for primary plus every mirror; and
- validation rejects claims of external fact-checking or unsupported actual
  retention, behavior-change, completion, or satisfaction outcomes.

The receipt chain proves that two different orchestrator task/session identities
produced two different sealed judgment payloads; it cannot prove the live agents
did not communicate outside the controlled workflow. For a skill evaluation,
also inspect the job CSV and worker traces to confirm the raters remained blind,
each read every exact source-inventory chapter in full, one retry was used at
most, and a separate adjudicator reviewed both outputs plus source evidence.
