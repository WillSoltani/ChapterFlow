# QUARANTINED — slot-fill chapter generators. DO NOT RUN.

These `*.mjs` scripts are the **root cause (RC1)** of the v21 word-salad incidents
(range, the-5-am-club, dare-to-lead, drive, the-let-them-theory, unreasonable-
hospitality). Each one splices source fragments and the chapter's concept-label
into fixed skeletons — `write-<book>-step2.mjs`, `reauthor-*.mjs`,
`rewrite-*-authored-step2.mjs`, `repair-*.mjs`, `polish-*.mjs`.

**A script cannot author a chapter.** It rotates a `correctIndex` and fills
blanks, producing content that is grammatically shaped but semantically dead —
and that passes every *structural* gate while being unpublishable. The QC pass
(2026-06-03) traced every catastrophic book back to one of these.

## The rule

Chapters are **authored by hand**, field by field, from real source notes, per
[agent-prompts/STEP-2-WRITE-CHAPTERS.md](../../agent-prompts/STEP-2-WRITE-CHAPTERS.md)
and [agent-prompts/FIELD-PURPOSE-CONTRACTS.md](../../agent-prompts/FIELD-PURPOSE-CONTRACTS.md).
A book is **repaired** by a targeted REDO prompt that the writer agent executes
by hand — never by re-running one of these generators.

## Why they're kept (not deleted)

For forensic reference only — they document the exact slot-fill shapes the new
`author-check` and gate critics are calibrated to catch. They are not part of any
workflow.

## Enforcement

Slot-fill produces a recognizable *output* — concept-as-actor scenarios, echo
explanations, templated breakdown loops, bare-label card fronts, pasted source
runs. `author-check` (AC1–AC11) catches that output directly, regardless of how
or when the file was saved. So even if one of these generators is un-quarantined
and run, the chapter it produces will not pass `author-check`. (An mtime-based
"chapter saved ~1 min after a generator" tripwire was prototyped and dropped — it
false-fired on legitimately-batched chapters; catching the output is robust, the
timestamp is not.)
