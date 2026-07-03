# Pipeline roles

`ROLE-DEFINITIONS.json` is the single source of truth for the v21 pipeline's
operator-driven roles (research, write, the QC reviewer roles, the orchestrators,
repair, publish). The pipeline is **no-API** — every role is a fresh GPT/Codex
session the operator drives. This registry does two things:

1. **Persona stays where it is.** Each entry's `promptPath` POINTS to the canonical
   prompt (e.g. `agent-prompts/STEP-2-WRITE-CHAPTERS.md`); nothing is duplicated here.
2. **Recommended depth per role.** `reasoningEffort` + `verbosity` + `modelHint` are
   emitted by the pipeline as a one-line `[ROLE: … · reasoning: … · verbosity: …]`
   header (on the fanout writer card and in the QC review packet). The pipeline
   *recommends*; the **operator sets** the actual GPT reasoning-effort/verbosity per
   session — high for writing/reviewing/key-derivation, minimal for the orchestrators
   and publish (they just run the CLI and read exit codes).

## Use
- `npx tsx src/cli.ts roles` — list every role with its recommended reasoning/verbosity.
- `npx tsx src/cli.ts roles <roleId>` — a role's full profile (persona prompt path + boundaries).
- The fanout card and review packet already carry the `[ROLE: …]` header; paste them verbatim
  and set your session to match.

## Adding / changing a role
Edit `ROLE-DEFINITIONS.json` only. Keep `roleId` aligned with `SUBMISSION_ROLES`
(QC roles) and the phase roles; point `promptPath` at a file that exists.
`role-definitions.test.ts` enforces completeness and that every `promptPath` resolves.
