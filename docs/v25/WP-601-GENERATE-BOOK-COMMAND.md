# `generate-book` — the operator runbook

The single documented command that generates a ChapterFlow book end-to-end through the
**v24 author-first** architecture, with truthful exit codes, resume, validation modes,
stage-level progress reporting, and a durable artifact/evidence trail. It is pure wiring
of pieces other work packages own (WP-601 the command itself, WP-602 preflight, WP-503
the run ledger, WP-603 progress + artifact conventions below) — it re-implements none
of them.

> **Scope / safety.** This command CAN spawn live codex authoring sessions on a real run.
> No test in this repo runs a live model call: `--validate-only` / `--dry-run` are
> model-free, an unsupported `--model` fails closed before any work, and the injected-deps
> test suite drives the conductor against fixtures. **A REAL run (no `--validate-only` /
> `--dry-run`) is a Phase-6+ owner-authorized action (decision ledger D-3 / L-14 / L-22 —
> no live calls in Phases 1–5).** Do not run this command for real against a book you
> care about until that authorization is in hand; use `--validate-only` and `--dry-run`
> (below) to rehearse everything else first.

---

## Syntax

```
generate-book <bookId> --title "X" --author "Y"
              [--model M] [--effort E] [--config <file>]
              [--resume] [--validate-only] [--dry-run]
              [--out <dir>] [--overwrite] [--no-publish] [--d7-advisory] [--verbose]
              [--compiler | --legacy]
```

| Flag | Meaning |
|---|---|
| `<bookId>` | Canonical lowercase slug (positional, required). |
| `--title` / `--author` | The book's declared identity (required; recorded in the run ledger). |
| `--model M` | The authoring model. Validated fail-closed through `modelPolicy.resolveRoute` (WP-504). Must be a 5.6 candidate **and** the wired production baseline (`gpt-5.6-sol`); any other value is refused (see below). |
| `--effort E` | Reasoning effort. Validated against the local effort union (`low/medium/high/xhigh`; API-only `max` is refused). |
| `--config <file>` | JSON config file. Precedence: **explicit flag > config file > policy default** (documented below). |
| `--resume` | Continue a crash-interrupted run without re-doing finished chapters (WP-103 resume-only-missing). |
| `--validate-only` | Run the deterministic preflight (WP-602) and exit. Zero authoring calls. |
| `--dry-run` | Plan the run (the conductor's plan mode). Zero model calls, zero mutations. |
| `--out <dir>` | Recorded artifact-output hint (surfaced in the startup print). |
| `--overwrite` (`--force`) | Regenerate an already-shipped book end-to-end (maps to the conductor's `regen`). |
| `--no-publish` | Halt at ready-to-publish for manual review (default is auto-publish on convergence). |
| `--d7-advisory` | Run the D7 ship gate as advisory (opt OUT of the default REQUIRE mode). |
| `--verbose` | **(WP-603)** Print a start *and* complete line for every one of the 12 lifecycle steps, with elapsed milliseconds. Default (no flag) is quiet: only the "milestone" steps (preflight, the author-pipeline run, the final artifact print) print — see [Progress reporting](#progress-reporting-wp-603) below. Either way, a failing/halted step ALWAYS prints — quiet mode only ever hides a clean `ok` step. |
| `--compiler` / `--legacy` | Opt in to the retired v23 per-chapter compiler / v22 whole-chapter path (kept reachable for WP-207's regression harness; deletion is WP-207/WP-804). Default is v24 author-first. |

---

## Exit-code table

Aligned with `tests/cli-contract.test.ts` (`0 pass / 1 blocked / 2 usage / 3 circuit-breaker`).

| Code | Name | When |
|---|---|---|
| **0** | OK | Author-first run shipped / ready / published; or a clean `--validate-only` / `--dry-run`. |
| **1** | HALT | The run halted for a generic reason (content / infra / progress / governance / integrity) that is **not** a quality-bar block or a lock refusal; or `--validate-only` surfaced a warn-level finding. |
| **2** | USAGE | Bad args, a **fatal** preflight finding, an `UNSUPPORTED_MODEL_CONFIG` selection, or a refusal to clobber a shipped package. |
| **3** | BLOCKED | The **D7 ship gate blocked on the quality bar** (`BLOCKED_QUALITY_BAR`), or a second concurrent run was **lock-refused** (the circuit-breaker class). |

The D7 quality-bar block is detected from the authoritative sidecar `promoteBook` (WP-401)
writes on a fail — `state/books/<bookId>.d7-ship-gate-halt.json` with
`halt_category === "BLOCKED_QUALITY_BAR"` — and only when it is fresh to **this** run (its
mtime is at/after the run start), so a stale record from a prior run is never misread.

---

## The 12-step lifecycle (target architecture §5)

1. **Validate prerequisites** — WP-602 deterministic preflight (`runGeneratePreflightChecks`): worktree cleanliness, base-SHA match, branch sanity, model-config support, schema fixtures, name-bank/config, D7 audit tooling. A **fatal** finding → exit 2 (no run created). Warns are advisory.
2. **Load + resolve config** — precedence: explicit flag > `--config` file > default. The command prints HOW every value resolved.
3. **Confirm the model is supported** — WP-504 `preflightOperatorModelSelection`; an unsupported model/effort throws `UnsupportedModelConfigError` and the command exits **before any work** (no silent fallback).
4. **Init / resume the run** — mint the WP-503 ledger run id (`CHAPTERFLOW_RUN_ID = generate-book-<bookId>-<ts>`); `--resume` re-enters without re-doing finished chapters (WP-103).
5. **Execute the author-first pipeline** — the conductor (`runAutopilot`, architecture `author`, WP-201) with bounded typed repairs ≤2/chapter (WP-404).
6. **Persist intermediate state per stage** — the conductor's CAS chapter commits (crash-safe, atomic).
7. **Consolidated floor → D7 ship gate** — the single deterministic floor (WP-205), then the D7 rubric-audit ship gate (WP-401) under **REQUIRE mode** (default).
8. **Produce V21-compatible output** — assemble → strip → `verifyProductionPackage` ×2 → transactional publish, D7-gated.
9. **Final validation** — the conductor's publish-preflight.
10. **Return a truthful status** — `classifyOutcomeExit` maps the outcome to 0/1/2/3.
11. **Print artifact + evidence locations** — the package path, the D7 receipt path, the
    WP-503 run-ledger / summary / book-rollup paths, the WP-603 preflight-report and
    run-report paths, and — on a non-OK exit — the exact failed step + halt reason
    (printed on every terminal, including halts; see [Artifact map](#artifact-map--where-every-output-lands) below).
12. **Meaningful exit code** — the operator contract above.

Steps 5–9 are the conductor's internals (`runAutopilot`); WP-601 owns steps 1–4 and 10–12
and wires the conductor in between. It changes **no** conductor phase logic. WP-603 does
not instrument those internals either — from this layer, steps 5–9 are ONE observable
span (see below): reporting five independent phases for work this layer never sees would
be a fabricated progress line, not a truthful one.

---

## Progress reporting (WP-603)

Every run prints a structured `[progress] [<step>/12] <icon> <title>[: <status>] (<Nms>) [— <detail>]`
line as each lifecycle step starts and completes, through the same `log`/stdout seam the
rest of the command already uses (no parallel logging framework). `<step>` mirrors the
12-step numbering above; steps 5–9 (execute the pipeline → persist state → floor/D7 gate →
produce output → final validation) are ONE bundled span labeled `5-9`, because this layer
never observes the conductor's internal sub-phases (see the honesty note above).

**Verbosity (`--verbose`):**

| Mode | What prints |
|---|---|
| quiet (default) | Only the **milestone** steps' *completion* line: **preflight** (1), the **author-pipeline run** (5-9), and the final **artifact print** (11). |
| `--verbose` | A **start** line (`…`) and a **complete** line (`✓`/`⚠`/`✗`) for **every** one of the 8 steps this layer can observe (config, model-check, preflight, clobber-check, init-run, author-pipeline, classify, artifacts). |
| always, either mode | Any step that completes **warn** (`⚠`) or **fatal** (`✗`) prints — quiet mode only ever hides a clean `ok`. A halted/blocked run never reads as silence. |

Example (quiet default, a run that stops at a fatal preflight finding):

```
generate-book — atomic-habits
  title:   Atomic Habits · author: James Clear
  ...
[progress] [1/12] ✗ validate prerequisites (doctor preflight): fatal (281ms) — 16 check(s) — 1 fatal, 2 warn
DOCTOR — 1 fatal, 2 warning(s)
  ✗ [canonical-chapter-set] ...
  preflight report: state/run-ledger/atomic-habits/generate-book-atomic-habits-<ts>.preflight-report.json
generate-book: 1 FATAL preflight finding(s) — refusing to start a run (exit 2). Fix them ... [failed step: preflight]
```

Example (`--verbose`, the same run — every step this layer reaches gets both lines):

```
[progress] [2/12] … load + resolve config
[progress] [2/12] ✓ load + resolve config: ok (1ms)
[progress] [3/12] … confirm the model is supported
[progress] [3/12] ✓ confirm the model is supported: ok (0ms) — gpt-5.6-sol@xhigh
...
[progress] [1/12] … validate prerequisites (doctor preflight)
[progress] [1/12] ✗ validate prerequisites (doctor preflight): fatal (281ms) — 16 check(s) — 1 fatal, 2 warn
```

---

## Artifact map — where every output lands

At the terminal (both success and halt), the command prints — and, for the two WP-603
additions, also **writes** — every location below. Nothing here is invented per-WP; each
row is owned by the WP named.

| Artifact | Path | Owner | Notes |
|---|---|---|---|
| V21 package | `book-packages/<bookId>.v21.json` | publish (WP-401/existing) | Present only once the book actually ships. |
| D7 receipt | `state/books/<bookId>.d7-ship-gate.json` | WP-401 | The sealed PASS receipt bound to the shipped bytes (REQUIRE mode). |
| D7 halt sidecar | `state/books/<bookId>.d7-ship-gate-halt.json` | WP-401 | Written only on a quality-bar **BLOCK**; printed only when the exit is `BLOCKED_QUALITY_BAR`. |
| Run ledger (raw) | `state/run-ledger/<bookId>/<runId>.jsonl` | WP-503 | Every codex-exec + Claude-side call this run made, one JSON line each. |
| Run ledger summary | `state/run-ledger/<bookId>/<runId>.summary.json` | WP-503 | The per-run **cost/latency rollup** — call counts by family/stage/role/model/outcome, p50/p95 latency. Currency is call-count + latency, never a dollar figure (the codex-exec route is subscription-billed, structurally unmeterable). |
| Book rollup | `state/run-ledger/<bookId>/book-rollup.json` | WP-503 | Aggregated across every run this book has ever accumulated a ledger for; O(1) in size. |
| **Preflight report** | `state/run-ledger/<bookId>/<runId>.preflight-report.json` | **WP-603** | The exact WP-602 doctor findings THIS run saw (fatal/warn/ok counts + every finding), written right after preflight runs — on `--validate-only`, a fatal block, AND a full run. Auditable after the fact without re-running preflight. |
| **Run report** | `state/run-ledger/<bookId>/<runId>.run-summary.json` | **WP-603** | ONE machine-readable JSON: final `status`/`exitCode`/`reason`/`failedStep`, the resolved model/effort/config, EVERY artifact path above, and a best-effort read-back of the run-ledger-summary's rollup counts (`ledgerRollup.available` is honestly `false`, never a fabricated zero, when that file doesn't exist — e.g. a run that never reached the conductor). Written once, at the same terminal that prints the paths above. |

All `state/run-ledger/**` and `state/books/**` paths are **durable** (NOT gitignored) —
see `CLAUDE.md`'s "Dual state dirs" trap and the WP-503 module header for why
(`logs/exec/`'s per-spawn sidecars ARE gitignored; this is the durable counterpart).

---

## Resume procedure

1. A run was interrupted (SIGKILL, host reboot, an infra halt) partway through authoring.
2. Re-invoke the **exact same command** with `--resume` added: `generate-book <bookId>
   --title "X" --author "Y" --resume` (same title/author; the conductor identifies
   already-finished chapters from durable on-disk state, not from the flags).
3. The conductor is **resume-by-construction** (WP-103): it authors only the chapters
   still missing and reuses durable acceptance for everything already done — `--resume`
   does **not** set `regen` (contrast with `--overwrite`, which re-runs the WHOLE book
   end-to-end even over a shipped package).
4. A **new** run id is minted for the resumed invocation (a fresh `state/run-ledger/`
   entry) — the resumed run's own preflight report / run report / ledger are separate
   files from the interrupted attempt's, so both remain inspectable.
5. If the book already has a shipped `book-packages/<bookId>.v21.json` and neither
   `--resume` nor `--overwrite` is given, the command **refuses to clobber it**
   (`REFUSED_CLOBBER`, exit 2) rather than silently doing nothing or silently regenerating.

---

## Validate-only / dry-run workflow

Both are **zero model calls, zero mutations** — the safe way to rehearse everything up to
(and, for `--dry-run`, including) the conductor's plan mode, with no live authoring and no
Phase-6 authorization required.

- **`--validate-only`** runs ONLY the WP-602 deterministic preflight (worktree cleanliness,
  base-SHA match, branch sanity, model-config support, schema fixtures, name-bank/config,
  D7 audit-tooling reachability) and exits on the doctor's own 0/1/2 contract (`ok → 0`,
  `warn → 1`, `fatal → 2`). It never reaches the model-config-refusal / clobber-check /
  conductor steps that a real run would. Use it first, every time, before a real run —
  and re-use it any time preflight-fatal blocks a run (fix the finding, `--validate-only`
  again to confirm, THEN retry the real command).
- **`--dry-run`** goes one step further: it routes through the **real** conductor in its
  `plan` mode (so the plan reflects actual phase logic), but plan mode takes no lock and
  writes no chapters — zero model calls, zero mutations, same as `--validate-only`. Use it
  to see what the conductor WOULD do (which chapters it considers missing, etc.) without
  spawning a single codex session.
- Recommended sequence for a brand-new book: `--validate-only` → fix any fatal finding →
  `--validate-only` again (confirm clean or warn-only) → `--dry-run` (confirm the plan
  looks right) → the real command (Phase-6+ authorized) → `--resume` if it gets
  interrupted.

---

## Failure triage — what to check for exit 1 / 2 / 3

| Exit | Class | First things to check |
|---|---|---|
| **1** HALT | A generic halt (content / infra / progress / governance / integrity) — or `--validate-only` hit a warn. | Read the printed `generate-book: HALT — <reason>` line and the `[failed step: author-pipeline (...)]` line. Open the **run report** (`<runId>.run-summary.json`) — its `reason` and `failedStep` fields carry the same values machine-readably. Cross-check the **run ledger** (`<runId>.jsonl`) for the specific call(s) that failed. |
| **2** USAGE | Bad args, a FATAL preflight finding, `UNSUPPORTED_MODEL_CONFIG`, or `REFUSED_CLOBBER`. | If the label is `PREFLIGHT_FATAL`: re-run with `--validate-only` — the printed `DOCTOR` block AND the **preflight report** (`<runId>.preflight-report.json`) name every finding, including the exact fatal check (note the model-check step, below, runs BEFORE preflight, so a bad `--model` never reaches preflight and gets no preflight report). If the label is `UNSUPPORTED_MODEL_CONFIG`, re-read the printed message: it names whether the model/effort was outright unsupported, or valid-but-not-the-wired-route (no silent re-route — fix the flag, don't assume it "mostly worked"). If `REFUSED_CLOBBER`, decide `--resume` vs `--overwrite`. |
| **3** BLOCKED | Either a **D7 quality-bar block** (`BLOCKED_QUALITY_BAR`) or a **lock refusal** (`LOCK_REFUSED`, the circuit-breaker class — a second concurrent run on the same book). | For a quality-bar block: open the **D7 halt sidecar** (`state/books/<bookId>.d7-ship-gate-halt.json`, printed as `D7 halt:` on this exact terminal) — it names the failing chapters + scores below the 85/80/3.0 bar (D-8/L-14). One re-author round runs automatically before this terminal state; a repeat block after that means the content genuinely needs a human look. For a lock refusal: another `generate-book`/`book-autopilot` process is (or recently was) running this book — check `state/autopilot-locks/` (or run `doctor` for a stale-lock report) before retrying. |

The **run report** JSON is the fastest single artifact to check for a run that reached the
conductor — that is, **exit 1** (a halt after authoring began) and **exit 3** (a D7
quality-bar block). It carries `status`, `exitCode`, `reason`, and `failedStep` together with
every other artifact path in one place, so a triage script (or a human) never has to re-derive
them from stdout. **Exit-2 USAGE-class failures** (bad args, `PREFLIGHT_FATAL`,
`REFUSED_CLOBBER`, `UNSUPPORTED_MODEL_CONFIG`, a bad `--config` load) return *before* the
conductor runs and therefore write **no** run report — for those, read the stdout reason and,
where present, the `<runId>.preflight-report.json` (written for `PREFLIGHT_FATAL`/`REFUSED_CLOBBER`;
`UNSUPPORTED_MODEL_CONFIG` fails before preflight and produces neither).

---

## `--config` file schema

```jsonc
{
  "model": "gpt-5.6-sol",       // optional; still WP-504-validated
  "effort": "xhigh",            // optional
  "out": "/path/to/out",        // optional
  "requireD7ShipGate": true,     // default true (S-tier terminal command)
  "autoPublish": true,           // default true (commit+push to main on convergence)
  "expectedBaseSha": "…",        // optional preflight base-SHA match
  "requireCleanWorktree": false, // default false (dirty tree is an advisory warn)
  "maxParallel": 6,
  "maxRepairRounds": 2
}
```

Unknown keys are ignored (forward-compatible). Every value is the *config-file* tier of the
precedence chain — an explicit CLI flag always wins, and a policy default fills the rest.

---

## Model selection: fail-closed + no silent re-route

- An **unsupported** `--model`/`--effort` (not a 5.6 candidate / not a supported effort) →
  `UNSUPPORTED_MODEL_CONFIG`, exit 2, **before any work**.
- A **supported-but-non-baseline** candidate (e.g. `gpt-5.6-terra`) is **refused**, exit 2:
  the author route is policy-owned (the writer omits per-call model/effort; WP-301) and
  per-run override beyond the provisional baseline is gated on WP-705's concrete matrix. The
  command never prints one model and runs another.
- Only the wired baseline (`gpt-5.6-sol`, provisional per D-9(b)/L-14) runs.

---

## Deprecations / aliases

- `generate-book … --compiler` / `--legacy` — the retired v23/v22 authoring paths, reachable
  for the WP-207 regression harness (physical deletion is WP-207/WP-804).
- `book-run` / `book-autopilot` — the lower-level author-first conductor entrypoints that
  `generate-book` wraps; still supported.
- `pipeline` / `flow` — the legacy v22 optimized run; **deprecated** for new work → use
  `generate-book`.

---

## Examples

```bash
# Validate the environment for a run (zero model calls):
generate-book atomic-habits --title "Atomic Habits" --author "James Clear" --validate-only

# Preview the plan (zero calls, zero mutations):
generate-book atomic-habits --title "Atomic Habits" --author "James Clear" --dry-run

# Full end-to-end run (Phase-6+ owner-authorized — spawns live authoring):
generate-book atomic-habits --title "Atomic Habits" --author "James Clear"

# Resume a crash-interrupted run (authors only the missing chapters):
generate-book atomic-habits --title "Atomic Habits" --author "James Clear" --resume
```
