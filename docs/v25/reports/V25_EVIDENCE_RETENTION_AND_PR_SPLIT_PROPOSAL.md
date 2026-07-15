# V25 Evidence Retention and PR Split Proposal

Date: 2026-07-15 (V25 recovery). Status: PROPOSAL ONLY — nothing has been moved, deleted, or relocated. Any action below on immutable raw evidence requires explicit owner approval and hash-verified preservation FIRST.

## 1. The problem, measured (baseline `50b4d8b7` vs merge-base `b8815ca02` with main)

- FACT — PR #401 totals: **6,664 files, +1,422,281 / −1,450 lines**; zero changes under `app/`, `components/`, `lib/`, `infra/`.
- FACT — Classification (files / inserted lines):
  | Family | Files | Lines | On-disk | Class |
  |---|---:|---:|---:|---|
  | `state/migration-experiments/<run-dirs>` raw evidence | 5,025 | 336,150 | ~145 MB | raw immutable evidence |
  | — of which `s16-…-v3-envelope-final` | 3,728 | 212,390 | 130 MB | raw immutable evidence (single commit `09b53ef8`) |
  | `state/migration-experiments/contracts` | 51 | 321,333 | 20 MB | immutable frozen contracts (runtime-loaded) |
  | `state/migration-experiments/_owner-inputs` | 1,082 | 72,866 | 9 MB | owner-input snapshots (registry-hashed) |
  | `docs/v25/chapterflow-140-evaluation` | 11 | 513,596 | 66 MB | owner-input snapshot (incl. a byte-identical duplicate 242 KB zip pair, sha1 `f256a254…`) |
  | pipeline `src/` | 171 | 78,842 | — | runtime code |
  | pipeline `tests/` | 133 | 43,038 | — | tests |
  | `docs/v25` reports + plans | 114 | 31,395 | — | reports (3 JSONs exceed 100 KB) |
  | `.agents/skills` | 66 | 23,659 | — | evaluator tooling (6 files seal-bound) |
  | workflows/config/misc | 12 | ~1,400 | — | runtime config |
- INFERENCE — ~92% of changed files and ~86% of inserted lines are evidence/snapshot payload that no runtime path reads. Reviewing the code change requires reading ~305 files; the PR carries 6,664.

## 2. Ownership boundary (what must stay in the code PR)

KEEP in the code PR (runtime-load-bearing or review-bearing):
- pipeline `src/`, `tests/`, `config/`, workflow yml, root `tsconfig.json`;
- `state/migration-experiments/contracts/**` (imp22/imp24/imp24f seals, bindings, corpora, thresholds, prompts — loaded at runtime by certification/qualification code; 20 MB is the honest cost of frozen protocol inputs);
- `docs/v25/reports/**` markdown + small JSON (decision/audit/result records);
- `.agents/skills/chapterflow-book-evaluator/references/**` (6 files are seal-bound gold assets).

SEPARATE from the code PR (owner approval required before any move):
1. **`s16-…-v3-envelope-final` raw evidence (130 MB, 3,728 files)** — terminal campaign transcripts (requests/receipts/attempts/exec). Runtime never reads them; the campaign report + call ledger + role registry summarize them. Proposal: land/keep them in a dedicated evidence-only PR or an `evidence/v25-imp24e-final` branch pinned by the tree hash recorded below, so the code PR references identity, not bytes.
2. **Older run dirs (v1, v2, r1, smokes, probes, pilot, gold, layer-n; ~1,300 files)** — same treatment, one evidence PR.
3. **`docs/v25/chapterflow-140-evaluation` (66 MB, 36% of ALL inserted lines)** — owner input snapshot; contains a byte-identical duplicate zip. Proposal: evidence PR + drop ONE duplicate zip copy (needs owner approval; the surviving copy's sha is recorded).
4. **`_owner-inputs` (9 MB)** — registry-hashed by `closed-registry-sync.test.ts` and `nativeReviewSeal.ts`; excluded from root compilation as of this recovery. Must move only together with a registry-path update in the same change, if ever.

## 3. Hash anchors (recorded now so any future move is provable)

- Baseline evidence tree identity: `git rev-parse 50b4d8b7^{tree}` and per-family `git ls-tree -d` object IDs pin every byte; the recovery changed **zero** retained evidence bytes (verified: `git diff --name-status 50b4d8b7..HEAD -- …/state docs/v25/reports` shows only 3 adds under `contracts/imp24f/`, 0 modifications).
- `s16-…-v3-envelope-final` tree object at baseline: run `git rev-parse 50b4d8b7:scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments/s16-forward-role-qualification-v3-envelope-final` before any relocation and record the result in the relocation PR body.
- Duplicate zip pair: sha1 `f256a2549210f8bfc6ac9003503c3d4ebfa77e2f` (both copies byte-identical).

## 4. What this recovery did and did not do

- DID: added 3 small candidate artifacts (`contracts/imp24f/`, ~98 KB total); added no raw model logs or attempt trees (zero live calls).
- DID NOT: move, delete, rewrite, or relabel any retained evidence; did not act on the duplicate zip.

## 5. Suggested sequencing (owner decision)

1. Owner reviews this proposal and approves/edits the boundary.
2. Evidence relocation (if approved) happens as its own PR(s) with tree-hash proof, BEFORE PR #401 is un-drafted, so #401 shrinks to the reviewable ~305-file code change.
3. Until then, PR #401 remains a draft; nothing merges with the boundary unresolved.
