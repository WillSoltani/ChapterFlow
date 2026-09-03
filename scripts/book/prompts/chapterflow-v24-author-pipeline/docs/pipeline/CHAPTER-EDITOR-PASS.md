# The chapter editor pass — operator notes

One bounded model call per chapter, inside the compile stage, that reads the whole
chapter and edits it. It exists because nothing else in the pipeline does: four
section packs are drafted from four slices of one source packet, each writer blind
to the other three, and the packs are assembled unedited (R-079).

## Where it runs, and what it can and cannot do

After the four packs pass their own section gates and after assembly resolves the
cross-chapter collisions, and before the candidate is staged for review.

- It edits the four **section packs**, because that is the shape the gates read.
  The assembled `ChapterV21` is a pure projection of them, so editing the chapter
  and editing its packs are the same act, and only the second one can be re-gated.
  The editor is shown the chapter in reader order as read-only context.
- Every returned bundle is re-validated through the **same** `validateSectionPack`
  the draft passed, plus a deterministic **preservation guard** that refuses any
  edit which moves a quiz key, changes a choice count, re-cites an anchor, adds a
  field to a pack or drops one, or adds or drops a digit-number or a proper name
  anywhere in the chapter.
- The quiz key is bound to the **answer's words**, not to its slot: the choice at
  `correctIndex` must come back exactly as it went in, at the same index, and it
  may not be copied onto a distractor. Permuting a question's three choices while
  leaving `correctIndex` where it was would otherwise ship a wrong answer key past
  every index-shaped check, so the guard compares the text. The two **wrong**
  choices may be rewritten — the brief asks for better distractors — provided
  neither becomes the keyed answer in other words and the three choices stay three
  different answers.
- A refused edit is retried **once** with the blockers. A second refusal keeps the
  **unedited** chapter and records `SKIPPED`.
- If the edited **book** does not assemble, the chapters the blockers name are
  withdrawn and the book is re-assembled once; if that is still not enough every
  edit is withdrawn and the original assembly ships byte for byte. Withdrawn
  chapters are recorded `REVERTED`.
- It can never fail the run on a content verdict. It **does** propagate operator
  cancellation and a provider block (an exhausted quota window), exactly as the
  section-drafting loop does.

## Spend

| | calls |
| --- | --- |
| default, per chapter | **1** |
| per chapter whose edit is refused once | 2 |
| per chapter, with `CHAPTERFLOW_EDITOR_ADVISORY_PASS=1` and stored advisories | 2 (4 worst case) |
| a chapter replayed from the durable edit cache | **0** |

Role `author`, effort `high` (`config/model-routing.json`). The card carries the
writing contract, the brief, the chapter in reader order, the four packs, the
packet projection and, on a source-text run, up to 12,000 characters of the
chapter's own frozen source text.

## Turning it off

```
CHAPTERFLOW_EDITOR_PASS=0 npm run book-run -- --book-id <id> …
```

The pass is then not invoked at all and **records that it was off**: every chapter
gets `status: "DISABLED"` with the blocker line `editor disabled by
CHAPTERFLOW_EDITOR_PASS=0` in the candidate's
`compiler/chapter-edit-provenance.json`, and the release sidecar's
`provenance.editing.disabled` counts them. A book built with the editor switched
off says so; it does not look like a book nothing improved.

A candidate with **no** `compiler/chapter-edit-provenance.json` at all was compiled
by a pipeline that had no editor composed, which is a different fact.

## Inspecting an edit

The **drafted** packs and the **edited** packs are both on disk, so the diff is a
`diff`, not a reconstruction.

```sh
BOOKS=<v25Root>/books/<bookId>
CAND=$BOOKS/candidates/<candidateId>/content     # the staged candidate's files

# what the editor DID to chapter 3, pack by pack:
for kind in summary-pack example-pack learning-pack action-pack; do
  # the draft, from the durable section-pack cache (envelope field .pack)
  jq -r --arg k "$kind" 'select(.chapterId|endswith("-ch03")) | select(.kind==$k) | .pack' \
    $BOOKS/section-pack-cache/*.json > /tmp/draft.$kind.json
  # the edit, from the staged candidate
  jq . "$CAND/compiler/ch03/$kind.json" > /tmp/edited.$kind.json
  diff -u /tmp/draft.$kind.json /tmp/edited.$kind.json
done
```

The editor's own cache carries the same edit beside the verdict that produced it:

```sh
jq '{outcome, blockers, attemptIds}' $BOOKS/chapter-edit-cache/*.json
```

And the per-chapter record of what happened, without any diffing:

```sh
jq '.chapters[] | {chapterNumber, status, replayed, attempts: (.attemptIds|length), blockers}' \
  "$CAND/compiler/chapter-edit-provenance.json"
```

## The advisory pass (R-166)

A canonical review that PASSES can still file WARN advisories — the shipped
Franklin revision's PASS carried 92 of them, each naming one chapter, and nothing
read any of them. With

```
CHAPTERFLOW_EDITOR_ADVISORY_PASS=1
```

set, a PASS review records its WARNs per chapter (at most 12 per chapter, each
clamped to 400 characters), and the **next compile of that book** spends one extra
editor call per chapter that has them, with the advisories rendered into the card
on top of the standing brief.

It is off by default and deliberately so: an advisory is a reader judgement no gate
enforces, and acting on one costs a model call per chapter. The advisories reach
the editor on the next compile rather than inside the run that produced them
because compile happens **before** review; re-compiling a book after its review to
consume them would pay for the whole compile twice.

A chapter whose advisories a later panel no longer files has its stored entry
cleared, so the editor is never handed a judgement the current panel has withdrawn.

That extra call is one extra **invocation**, and an invocation is bounded at
`MAX_EDITOR_ATTEMPTS` (2) like the standing one, so a chapter whose advisory edit
is refused once costs two extra calls — the `2 (4 worst case)` row in the spend
table above.

Each chapter's provenance entry records what the advisory invocation itself
decided, in `advisory.outcome`: `NOT_RUN`, `ACCEPTED`, `REFUSED` or `ERROR`.
`advisory.applied` says the advisories REACHED an editor; `outcome` says what
became of the edit they asked for. A chapter can read `status: "EDITED"` with
`advisory.outcome: "REFUSED"` — the STANDING edit shipped and the advisory edit was
refused — and `advisory.blockers` says why. A replayed verdict reports the same
outcome it was stored with; it never launders a refused advisory into an applied
one.

```sh
jq '.chapters[] | {chapterNumber, status, advisory}' \
  "$CAND/compiler/chapter-edit-provenance.json"
```

## Cache invalidation

The verdict is cached under `(assembled-chapter digest, brief digest, contract
digest, advisory digest, card digest)`. So:

- any section re-draft, or any change to the assembled chapter, re-edits;
- editing `CHAPTER_EDITOR_BRIEF` or the preservation rule re-edits **every**
  chapter of every book;
- changing the book's voice card or its scars re-edits that book;
- turning the advisory flag on, or a panel filing different advisories, re-edits;
- and anything else that changes the CARD re-edits too: the fifth field is the
  sha256 of the exact attempt-1 task card, so a change to the delivery block, the
  schema hint, the reader-view projection, the span bound or the packet projection
  invalidates every entry instead of silently serving an edit made under the old
  prompt (R-164's lesson, from the section-pack cache).

An infrastructure `ERROR` is never cached: a provider blip is not a verdict, and
the next run retries it for free.

A `REVERTED` chapter keeps its `EDITED` cache entry, because the edit did pass its
own chapter's gates — what failed was the book. A re-run therefore replays that
edit for free, re-assembles, and reverts again, deterministically and at zero model
cost, until something upstream changes.
