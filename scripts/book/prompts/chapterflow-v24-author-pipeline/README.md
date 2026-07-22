# ChapterFlow v22 Optimized Autonomous

## Optimized autonomous pipeline

This package includes a v22 cost-optimized autonomous path that keeps the v21 publish gates strict while reducing token spend before final validation. Start a run with:

```bash
npm run pipeline -- <bookId> --title "Book Title" --author "Author" --policy standard
```

The `flow` command prints live phases in the terminal: preflight, research, source, generation, book-gate, promotion, and metrics. It reuses existing research/source artifacts when present and runs the researcher automatically when the chapter index is missing. It writes a stage-level cost manifest to `state/metrics/<bookId>/<runId>.cost.json`.

Policies:

- `economy`: lowest spend, adaptive examples, deterministic memorable lines, risk-gated polish.
- `standard`: default production balance, adaptive examples plus selective curator/model escalation.
- `premium`: maximum scrutiny for thin-source or flagship books.
- `publish`: strict final posture; publish law is never weakened by policy.

See `docs/v22/PIPELINE-ARCHITECTURE.md` and `agent-prompts/V22-SUBAGENT-CONTRACT.md`.


Code-first book-generation pipeline. v22 is the cost-optimized autonomous successor to the v21 authored pipeline and v13 Autonomous.

## Why v21 exists

v13 is prompt-first: a coding agent reads `MasterGenerator-v13.md` and interprets it. Critics are advisory markdown prompts; the model may or may not honor them. A programmatic audit of v13's 73 shipped books surfaced ten systemic issues — meta-reference epidemic (85% of chapter breakdowns), name-pool recurrence (Priya in 50 books), answer-position bias (53% / 38% / 9%), category template lock-in (66% of chapters use identical work→school→personal rotation), stock-phrase tics across books, scenario decay in weak books, Bloom's-level vocabulary chaos, redundant summary fields, and more.

The root cause is not missing ideas. v13 has `rules/critic-agent.md`, `rules/meta-distance-rules.md`, `rules/name-ledger-rules.md`, and a rich style library. The problem is **enforcement**: rules as prose get honored softly.

v21's defining choice: **mechanical enforcement.** Deterministic TypeScript orchestrator calling the Claude API for bounded tasks with typed schemas. Critics are runnable code that fail-closed. Cross-book state lives in a library ledger, not a prompt.

## Pipeline architecture

Per chapter, end-to-end:

```
Editor-in-chief    → BookBrief (thesis, voice charter, voice specimens)
Curriculum planner → ChapterDesignDoc (per-chapter shape, examples mix, Bloom's mix)
                     ↓
   Hook writer ── parallel ── Breakdown writer (with source-freeze grounding)
                     ↓
              Voice-pass agent (iterative, up to 3 rounds, gated by prose critic)
                     ↓
              Line-editor (risk-gated surgical polish — skipped when prose risk is low)
                     ↓
   Examples (adaptive 1–3 candidates per slot; deterministic scorer escalates ties/risk to curator)
                     ↓
   Quiz writer ── parallel ── Cards writer ── parallel ── Implementation-plan writer
                                ── parallel ── Reflection-prompts (before / after)
                     ↓
                Assembler builds ChapterV21
                     ↓
              Memorable-lines selector (deterministic first; model fallback for weak/premium/publish runs)
                     ↓
            Ship gate (every BLOCKER from FAILURE-MODES.md catalog)
            ↓ pass            ↓ fail
       Library ledger    Quarantine to _blocked/
       (atomic withLibraryState; concurrent book runs serialize correctly)
                     ↓
                Persist v21-native chapter JSON
```

Once every chapter ships, the **book gate** runs across the assembled book
(cumulative answer-position balance, within-book recurring-name uniqueness as a
BLOCKER, schema-completeness check that catches cache-skip regressions, voice
consistency). If it passes, the **categorizer** assigns 2–4 canonical categories
+ 4–8 tags from `config/categories.json`, then `promoteBook` writes the final
package to `book-packages/<bookId>.v21.json`.

**Critics are deterministic code** (not model calls). They operate identically across providers. Only writer/researcher/critic-tier-model calls flow through the provider abstraction.

## Model access: three providers

These are the **paid, mass-production** paths. The **default operating model needs
no funded API** — generation and QC run as `codex exec` sessions on a Codex/Max
**subscription** (see [Autopilot](#autopilot--the-codex-control-plane-no-api-metering)
below). v21 supports three providers behind a single interface. Switch by env var.

### 1. Anthropic Code CLI (default — runs on Max subscription, free at usage)

```bash
sudo npm install -g @anthropic-ai/claude-code
claude /login
# default; no env needed
npx tsx scripts/book/prompts/chapterflow-v22-optimized-autonomous/src/cli.ts ping
```

### 2. Anthropic API (mass production, paid)

```bash
export CHAPTERFLOW_PROVIDER=anthropic-api
export ANTHROPIC_API_KEY=sk-ant-...
# Per-tier model overrides (these are the recommended defaults):
export CHAPTERFLOW_WRITER_MODEL=claude-sonnet-4-6
export CHAPTERFLOW_RESEARCHER_MODEL=claude-sonnet-4-6
export CHAPTERFLOW_CRITIC_MODEL=claude-haiku-4-5-20251001
```

### 3. OpenAI API (mass production, paid)

```bash
export CHAPTERFLOW_PROVIDER=openai-api
export OPENAI_API_KEY=sk-...
export CHAPTERFLOW_WRITER_MODEL=gpt-5.5     # or gpt-4o
export CHAPTERFLOW_RESEARCHER_MODEL=gpt-4o-mini
export CHAPTERFLOW_CRITIC_MODEL=gpt-4o-mini
```

**Critic agents are deterministic code** — they don't call any model — so they
behave identically regardless of provider. Only writer/researcher calls vary.

Provider adapters are lazy-loaded only after a provider is selected. Deterministic
commands such as `book-status`, `doctor`, and gates do not require the optional
`openai` or `@anthropic-ai/sdk` packages at import time. The router owns provider
attempt counts and the single JSON repair attempt; adapters make one raw call with
SDK retries disabled, honor per-call timeouts, return bounded raw evidence, and
include usage/latency metadata for validation.

### V4 model routing (`ModelProcessRoute` — codex / claude CLI)

The V4 application layer does **not** use the legacy provider router above. Every
model call goes through the `ModelGateway`, which spawns a subscription CLI via a
`ModelProcessRoute`. Two routes exist, selected per pipeline role by
[`config/model-routing.json`](config/model-routing.json) (validated fail-closed;
a `gpt-5.5` model outside the codex fallback + the D1 owner-override sentinel
trips the NO-GPT-5.5 gate):

- **`codex`** (`src/runtime/codexRoute.ts`, id `codex-chatgpt-subscription-v1`) —
  `codex exec` on a Codex/Max subscription. Model + reasoning effort are config
  parameters.
- **`claude-cli`** (`src/runtime/claudeRoute.ts`, id `claude-subscription-v1`) —
  Claude Sonnet 5 via the `claude` headless CLI (`-p --output-format json`) on a
  `~/.claude` subscription. Effort tiers (`medium`/`high`/`xhigh`) map to the
  `MAX_THINKING_TOKENS` budget the route contributes through the gateway's guarded
  env merge; the JSON envelope is unwrapped to the inner-JSON contract the gateway
  validates. The route requires the `claude` CLI installed and `claude /login`
  completed; the executionPolicy strips provider API keys but preserves `HOME`, so
  the CLI runs on subscription auth.

Both routes deliver the prompt on **stdin** (never argv) and run under the
executionPolicy sandbox (env-strip, workdir policy). The active default is set in
`config/model-routing.json`; `npm run doctor` reports the resolved `v4-route`.

## Package and CI contract

The v22 optimized artifact is a standalone npm package. The root
`package-lock.json` is the single dependency lockfile; do not add a second
lockfile under this directory.

From a clean checkout:

```bash
npm ci --include=optional
npm run pipeline:typecheck
npm run pipeline:test
npm run pipeline:doctor
npm run pipeline:build
```

For automation, `npx tsx src/cli.ts doctor --json` emits the same findings,
summary counts, and planned exit code as structured JSON.

The package pins Node `>=20.20.0 <21`, npm `10.8.2`, exact pipeline tool
versions, and declares `openai` plus `@anthropic-ai/sdk` as optional provider
dependencies. The default test script sets `CHAPTERFLOW_NO_API_CODEX_QC=1` and
uses synthetic fixtures, so it must not require production `state/` artifacts,
global model CLIs, API keys, or private `.chapterflow/runs` data.

## Autopilot — the Codex control plane (no API metering)

The three providers above are the paid path. The **default** needs no funded API:
generation and QC run as `codex exec` sessions on a Codex/Max **subscription**,
driven by a deterministic conductor — the pipeline emits prompts and spawns agentic
sessions, it does **not** make billed API calls on its own.

`book-autopilot <bookId>` runs a book end-to-end — research → write → gate →
QC(+bounded repair) → ready-to-publish — by looping the `bookStatus` phase machine
and spawning one fresh `codex exec` session per unit of work (research, per-chapter
authoring, QC review, repair). DECISIONS stay in code (phase sequencing, the ≤3
repair loop, gate reading, publish gating); agents only do the work. Publishing is
human-gated by default (`--auto-publish` opts in).

```bash
# preview the spawn plan + session-count estimate, take no action:
npx tsx src/cli.ts book-autopilot <bookId> --plan
# real run (subscription; halts at "ready to publish"):
npx tsx src/cli.ts book-autopilot <bookId>
```

Invariants the conductor enforces **in code** (not prose):
- **No API metering** — every model call is a `codex exec` session, never a billed provider.
- **Strict env, fail-closed** — `CHAPTERFLOW_NO_API_CODEX_QC` / `_REQUIRE_SOURCE_VERIFY` / `_ENFORCE_SESSION_INDEPENDENCE` are force-set on every subprocess (canonical list in `src/lib/strictEnv.ts`), so finalize's author≠reviewer collision check and the source-verify gate can't silently no-op when the shell didn't export them.
- **Reviewer integrity** — reviewers run in a read-only sandbox behind a submission broker (they emit their submission JSON; the conductor records it under the reviewer's own session id), with a chapter-content hash fence as a backstop that voids a round if a chapter changes. Session ids are attributable local workflow evidence, not cryptographic proof of different humans; fresh no-API certification requires them and blocks legacy/unknown provenance.
- **QC state integrity** — submit, collect, verify-repair, finalize, and ledger status writes serialize through an owned round transaction. Malformed `repair-ledger.jsonl` lines fail closed; use `qc-ledger-repair <bookId> --round <roundId> --confirm` to quarantine corrupt raw lines and rewrite only valid events.
- **One QC engine** — `qc-auto` (human-driven) and the conductor share a single round-driver (`src/qc/auto/driver.ts`); the conductor adds `--incremental` repair rounds, `--tiebreak`, and full-book `qc-status` verification.
- **Typed halts** — every stop carries a category (`infra` / `content` / `governance` / `progress` / `integrity`) + durable per-agent logs under `state/autopilot-logs/<bookId>/`.

See **G6** (qc-converge) and **G7** (book-autopilot) in `FAILURE-MODES.md`.

## Mass-production cost projection

v21 baseline per-chapter usage was dominated by fixed example overgeneration and mandatory polish:
- Examples: fixed 6 slots × 3 candidates, plus curator.
- Voice/line editing: at least one voice pass plus mandatory line-editor.
- Support artifacts: separate quiz, cards, implementation, takeaway, and optional highlights.

v22 changes the default production path:
- Examples: adaptive 1–3 candidates per slot; curator only for ties/risk unless `premium` or `publish` policy is selected.
- Prose polish: first voice pass remains; extra voice passes and the line editor are risk-gated by deterministic prose checks.
- Memorable lines: deterministic selector first; model fallback only when weak or under premium/publish policy.
- Cost telemetry: every provider call is reported by stage in `state/metrics/<bookId>/<runId>.cost.json`.

Expected savings depend on source quality and pass rate. The first calibration target is a lower average example candidate count, fewer curator calls, and fewer line-editor calls while preserving the same final ship/book/promotion gates.

**Throughput:** API/subscription calls still run in parallel where possible. `flow` prints phase progress live and writes the cost manifest after generation.

## Critics, ship gate, and failure-mode catalog

Every chapter passes through [`runShipGate`](src/critics/finalGate.ts) before
persisting. Blockers fail-close. See [FAILURE-MODES.md](FAILURE-MODES.md) for
the full catalog of v13 issues and how v21 enforces against them.

## Repo layout

```
chapterflow-v22-optimized-autonomous/
├── README.md                   (this file)
├── src/
│   ├── types.ts                typed contracts between agents
│   ├── claudeClient.ts         provider-router wrapper used by agents
│   ├── cli.ts                  entry: flow, generate, critic, repair, ledger
│   ├── critics/                runnable binary checks
│   │   ├── narrative.ts
│   │   ├── register.ts
│   │   ├── pedagogy.ts
│   │   ├── schema.ts
│   │   └── runAllCritics.ts
│   ├── agents/                 Claude-backed writers (Phase 2+)
│   ├── curator/                example selector (Phase 3)
│   ├── librarian/              cross-book state (Phase 4)
│   └── state/                  library-state access layer
├── config/
│   ├── critic-rubric.json      declarative rubric + thresholds
│   ├── banned-phrases.json     phrases with usage budgets
│   └── meta-patterns.json      meta-reference regex patterns
├── state/                      runtime: library-state.sqlite (gitignored)
├── reports/                    runtime: scoreboards, per-book summaries
└── prompts/                    versioned system prompts per agent
```

## Build phases

- **Phase 0 — Foundation.** Types, Claude client, CLI skeleton, declarative critic config.
- **Phase 1 — Critic.** Run against v13's 73 books. Produces scoreboard. Immediate Tier-1 value.
- **Phase 2 — One chapter end-to-end.** *Thinking, Fast and Slow* Ch 5, all v21 agents in series.
- **Phase 3 — Full book + over-generation.** 20-candidate example pool, curator selects 6.
- **Phase 4 — Librarian.** Name ledger, phrase budget, answer-position balancer.
- **Phase 5 — Backfill.** Green/Yellow/Red tiering of existing 73 books.

## Usage

### Inline-operator mode (no API or subscription quota)

Every model call replaced by the Claude session running this CLI: read the playbook, produce the artifact, save to the printed path, run the validator. The deterministic critics + ship gate + book gate enforce S-tier quality.

```bash
CLI=scripts/book/prompts/chapterflow-v22-optimized-autonomous/src/cli.ts

# 1. Ask the helper what to produce next; loop until "all done"
npx tsx $CLI next-task atomic-habits

# Stages the helper drives you through, in order:
#   research-bibliography  → produce .chapterflow/runs/<id>/<run>/source-freeze/toc.json
#   research-chapter × N   → produce sidecars/source/chNN.source.json (+ .txt)
#   chapter-index          → produce state/indexes/<id>.json
#   write-chapter × N      → produce state/chapters/<id>-chNN.v21-native.chapter.json
#                            then validate: npx tsx $CLI gate-chapter <path>
#   derive-artifacts       → npx tsx $CLI derive-artifacts <id>
#   finalize               → npx tsx $CLI generate-book <id> --title X --author Y \
#                              --no-categorizer --categories A,B --tags x,y,z

# 2. Source-coherence check (after writing bibliography + all chapter sources)
npx tsx $CLI check-source atomic-habits

# 3. Per-chapter ship-gate (after writing each ChapterV21 JSON)
npx tsx $CLI gate-chapter scripts/.../state/chapters/atomic-habits-ch01.v21-native.chapter.json

# 4. Final assembly + book gate + promote (after every chapter ship-gates clean)
npx tsx $CLI generate-book atomic-habits --title "Atomic Habits" --author "James Clear" \
  --no-categorizer --categories "Productivity,Habits" --tags "habits,systems,compounding,identity"
```

`generate-book` resumes only from content-addressed cache manifests. A chapter
file that exists without a matching `.cache-manifest.json`, whose output hash
changed, whose declared input hashes changed, or whose current deterministic
gates fail is reported as stale instead of being ingested. Use `--force` only
when `CHAPTERFLOW_ALLOW_MODEL_GEN=1` is intentionally set; it bypasses reuse
but the newly generated chapter still runs the full boundary validation before
being written and added to the library ledger.

Playbooks for the model-driven steps:
- [prompts/PLAYBOOK-OPERATOR-RESEARCH.md](prompts/PLAYBOOK-OPERATOR-RESEARCH.md)
- [prompts/PLAYBOOK-OPERATOR-CHAPTER.md](prompts/PLAYBOOK-OPERATOR-CHAPTER.md)
- [prompts/PLAYBOOK-OPERATOR-FINALIZE.md](prompts/PLAYBOOK-OPERATOR-FINALIZE.md)

State persists between sessions — pause anywhere, resume by running `next-task` again. Smoke-tested end-to-end on The War of Art Ch 1; package shipped at [book-packages/war-of-art-smoke.v21.json](../../../../book-packages/war-of-art-smoke.v21.json).

### Subprocess mode (counts against Max subscription)

```bash
# Audit existing books
npx tsx $CLI critic book-packages/atomic-habits.modern.json
npx tsx $CLI critic --all

# Run the model-driven pipeline end-to-end via claude -p subprocess calls
npx tsx $CLI research "Atomic Habits" "James Clear"
npx tsx $CLI generate "Atomic Habits" "James Clear"

# Library ledger
npx tsx $CLI ledger status
```

## Relationship to v13

v21 reuses what's valuable from v13:
- `rules/meta-distance-rules.md`, `rules/name-ledger-rules.md` — informative, now enforced as code
- `style/gold-examples.md`, `style/gold-prose.md`, `style/gold-quiz.md` — few-shot material for writers
- source-freeze bundles — input to researcher

v21 replaces:
- advisory critics → runnable code critics
- per-book repair scripts → systemic reviser + librarian
- fixed slot counts → curriculum-planner-driven shapes
