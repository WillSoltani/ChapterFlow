# WP-601 — `generate-book`: the one terminal command

The single documented command that generates a ChapterFlow book end-to-end through the
**v24 author-first** architecture, with truthful exit codes, resume, and validation modes.
It is pure wiring of pieces other work packages own — it re-implements none of them.

> **Scope / safety.** This command CAN spawn live codex authoring sessions on a real run.
> No test in this repo runs a live model call: `--validate-only` / `--dry-run` are
> model-free, an unsupported `--model` fails closed before any work, and the injected-deps
> test suite drives the conductor against fixtures. **A real book run is a Phase-6+
> owner-authorized action** (decision ledger L-14 / L-22 — no live calls in Phases 1–5).

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
11. **Print artifact + evidence locations** — the package path, the D7 receipt path, and the WP-503 run-ledger / summary / book-rollup paths (printed on every terminal, including halts).
12. **Meaningful exit code** — the operator contract above.

Steps 5–9 are the conductor's internals (`runAutopilot`); WP-601 owns steps 1–4 and 10–12
and wires the conductor in between. It changes **no** conductor phase logic.

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
