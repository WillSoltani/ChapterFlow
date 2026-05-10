# ChapterFlow v21 Authored

Code-first book-generation pipeline. Successor to v13 Autonomous.

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
              Line-editor (surgical sentence-level polish — closer / opener / mechanical transitions)
                     ↓
   Examples (over-generate 3 candidates per slot; Curator picks best of 3)
                     ↓
   Quiz writer ── parallel ── Cards writer ── parallel ── Implementation-plan writer
                                ── parallel ── Reflection-prompts (before / after)
                     ↓
                Assembler builds ChapterV21
                     ↓
              Memorable-lines marker (3 quotable lines)
                     ↓
            Ship gate (every BLOCKER from FAILURE-MODES.md catalog)
            ↓ pass            ↓ fail
       Library ledger    Quarantine to _blocked/
        (name + phrase + answer-position state)
                     ↓
                Persist v21-native chapter JSON
```

Once every chapter ships, a separate **book gate** runs across the assembled book:
cumulative answer-position balance, within-book name uniqueness, voice consistency.

**Critics are deterministic code** (not model calls). They operate identically across providers. Only writer/researcher/critic-tier-model calls flow through the provider abstraction.

## Model access: three providers

v21 supports three providers behind a single interface. Switch by env var.

### 1. Anthropic Code CLI (default — runs on Max subscription, free at usage)

```bash
sudo npm install -g @anthropic-ai/claude-code
claude /login
# default; no env needed
npx tsx scripts/book/prompts/chapterflow-v21-authored/src/cli.ts ping
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

## Mass-production cost projection

Per-chapter token usage roughly:
- Editor-in-chief: ~3K in / 3K out (one call per book, cached for chapters)
- Curriculum planner: ~5K in / 2K out
- Hook + breakdown: ~6K in / 2K out
- Voice pass × 3 iterations: ~9K in / 4K out
- Examples (6 × 3 candidates): ~30K in / 10K out
- Curator: ~12K in / 1K out (Haiku tier)
- Quiz + cards + plan + takeaway: ~20K in / 8K out
- Total per chapter: ~85K in / 30K out

**Per-chapter cost estimates (Sonnet 4.6 + Haiku critic mix):**
- Anthropic API: ~$0.45 / chapter
- OpenAI gpt-4o + gpt-4o-mini: ~$0.30 / chapter
- 38-chapter book: $11–17

**Throughput:** API calls run in parallel where possible. With 3-way chapter
parallelism a 38-chapter book takes ~3 hours wall-clock. Sequentially: ~8 hours.

## Critics, ship gate, and failure-mode catalog

Every chapter passes through [`runShipGate`](src/critics/finalGate.ts) before
persisting. Blockers fail-close. See [FAILURE-MODES.md](FAILURE-MODES.md) for
the full catalog of v13 issues and how v21 enforces against them.

## Repo layout

```
chapterflow-v21-authored/
├── README.md                   (this file)
├── src/
│   ├── types.ts                typed contracts between agents
│   ├── claudeClient.ts         SDK wrapper with prompt caching
│   ├── cli.ts                  entry: critic, generate, repair, ledger
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

## Usage (planned)

```bash
npx tsx scripts/book/prompts/chapterflow-v21-authored/src/cli.ts critic book-packages/atomic-habits.modern.json
npx tsx scripts/book/prompts/chapterflow-v21-authored/src/cli.ts critic --all
npx tsx scripts/book/prompts/chapterflow-v21-authored/src/cli.ts generate "The Prince" "Niccolò Machiavelli"
npx tsx scripts/book/prompts/chapterflow-v21-authored/src/cli.ts repair --book atomic-habits
npx tsx scripts/book/prompts/chapterflow-v21-authored/src/cli.ts ledger status
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
