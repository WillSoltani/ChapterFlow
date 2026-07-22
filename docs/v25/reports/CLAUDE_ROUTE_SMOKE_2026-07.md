# Claude route — live smoke (Task 7 Step 5)

Date: 2026-07-22
Branch: `codex/v25-pipeline-completion-recovered`
CLI: `/opt/homebrew/bin/claude` → `2.1.197 (Claude Code)` (on PATH)
Model: `claude-sonnet-5` (alias resolves)
Auth: macOS login Keychain subscription credentials (no API key), headless.

Two real calls through the production wiring: `createModelGateway` on
`createClaudeRoute("claude-sonnet-5", "high")` with the real
`NodeProcessSupervisor`, the real `createExecutionPolicy` env-strip, and the
DEFAULT model-CLI preflight (so the generalized claude qualification ran live).
Hermetic guard (`CHAPTERFLOW_NO_API_CODEX_QC`) OFF in the parent process.

## Probe transcript (Step 1, live-confirmed)

`claude --help` (2.1.197) confirmed every flag the route emits:

- `-p, --print` — headless print mode.
- `--output-format <format>` — `"json" (single result)`, "only works with --print"; works **without** `--verbose`.
- `--model <model>` — caller/config-supplied.
- `--effort <level>` — **real per-call flag**, help enumerates `(low, medium, high, xhigh, max)`. Effort now rides in **argv** (`--effort <tier>`), replacing the earlier derived `MAX_THINKING_TOKENS` env mapping.
- `--disallowedTools, --disallowed-tools <tools...>` — both spellings accepted; route uses `--disallowedTools "*"` for READ_ONLY.
- `--permission-mode <mode>` — choices include `acceptEdits`; route uses it for WORKSPACE_WRITE (cwd is the grant, no `--add-dir`).

Envelope shape (`--output-format json`): one JSON object whose `.result` string
holds the assistant's answer. Confirmed the committed `normalizeClaudeStdout`
`.result` unwrap; additionally discovered Claude commonly wraps its JSON in a
```` ```json ```` fence, so the adapter now strips a single code fence to reach
the bare-object contract codex already emits.

## Auth finding (executionPolicy change)

With the policy's env-strip reduced to `env -i PATH=… HOME=…`, `claude -p`
returned `is_error:true`, `.result = "Not logged in · Please run /login"`, exit
1. Bisect showed the Keychain lookup resolves by login identity and needs
**`USER`** in the environment (stable across repeated runs; `HOME` alone is not
enough). `USER`/`LOGNAME`/`SHELL` were added to the V4 policy `ENV_ALLOWLIST`
(non-secret identity vars; the sibling codex `executionEnvelope.DEFAULT_ENV_ALLOWLIST`
already permits the same three). No provider key rides here — `FORBIDDEN_ENV`
is still checked after the copy.

## Call 1 — READ_ONLY JSON (through the gateway)

argv: `claude -p --output-format json --model claude-sonnet-5 --effort high --disallowedTools *`
Prompt: chapterflow-json-v1 template + one record (a factual statement).

Result: `outcome: SUCCEEDED`, `output` a valid JSON object, e.g.
`{"summary":"Pacific Ocean is Earth's largest ocean.","topic":"geography/oceanography"}`.
Proves the full gateway path: preflight → spawn → Keychain auth → envelope
unwrap → fence-strip → `json.object.v1` schema validation. (The model also
correctly flagged the record's embedded schema directive as untrusted content —
the pipeline anti-injection guard working, and it still returned a JSON object.)

## Call 2 — WORKSPACE_WRITE (route's own build() argv, direct spawn)

argv: `claude -p --output-format json --model claude-sonnet-5 --effort high --permission-mode acceptEdits`
cwd: an isolated attempt sub-root; stdin: a trusted top-level instruction to
write `smoke.txt` = `HELLO` then return `{"wrote": true}`.

Result: exit 0; `smoke.txt` written with contents `HELLO`; normalized stdout
`{"wrote": true}` parses as a JSON object. Proves `--permission-mode acceptEdits`
writes into the launch cwd with no `--add-dir`.

Note on why this call bypassed the gateway's generic json template: that
template marks every `record.text` as untrusted and (correctly) refuses tool-use
directives embedded there, so a file-write instruction cannot ride an untrusted
record — the model returned `{"status":"rejected", "wrote":false}` when the
write was asked via a record. The route's write **mechanism** is therefore
proven with the trusted top-level task, which is how the real author/write
stages convey write instructions.

## Verdict

Both assertions met: parsed JSON (Call 1, through the gateway) + written file
(Call 2, route's write argv). The claude-subscription-v1 route is live-viable on
Sonnet 5. Config flipped to the D1 Sonnet-5 defaults (Task 7 Step 6).
