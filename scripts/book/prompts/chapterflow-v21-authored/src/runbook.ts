/**
 * `runbook <bookId>` view model — a deterministic, READ-ONLY operator control panel: given the
 * book's honest phase (from computeBookStatus) plus live state (env flags, source-v2 gate,
 * source-verify record, latest QC round), print the strict env with OK/MISSING status, the exact
 * next command, the prompt to open, and any blockers. A `--json` form feeds the same model to a
 * harness. It RE-DERIVES nothing: phase comes from book-status, gate/record state from the
 * existing checks; the phase→prompt mapping below mirrors agent-prompts/RUN-A-BOOK.md (kept
 * minimal to limit drift). The helpers here are pure; the CLI gathers the live state.
 */

/** The strict env, as `NAME=1` assignments — threaded verbatim into the next command. */
export const STRICT_ENV = [
  "CHAPTERFLOW_NO_API_CODEX_QC=1",
  "CHAPTERFLOW_REQUIRE_SOURCE_VERIFY=1",
  "CHAPTERFLOW_ENFORCE_SESSION_INDEPENDENCE=1",
];

/** The same three, as bare variable names — for live presence checks. Order matches STRICT_ENV. */
export const STRICT_ENV_VARS = [
  "CHAPTERFLOW_NO_API_CODEX_QC",
  "CHAPTERFLOW_REQUIRE_SOURCE_VERIFY",
  "CHAPTERFLOW_ENFORCE_SESSION_INDEPENDENCE",
] as const;

const STRICT = STRICT_ENV.join(" ");

export type RunbookPlan = { label: string; openPrompt: string; next: string };

export type SourceV2State = "PASS" | "BLOCK" | "N/A";
export type SourceVerifyState = "ABSENT" | "PRESENT_PASS" | "PRESENT_BAD" | "UNPARSEABLE" | "N/A";

export interface RunbookStatus {
  /** Raw book-status phase (e.g. "qc", "ready to publish", "shipped"). */
  phase: string;
  /** Live presence of each strict-env var, in STRICT_ENV_VARS order. */
  env: { name: string; set: boolean }[];
  sourceV2: SourceV2State;
  sourceVerify: SourceVerifyState;
  qcRound: string | null;
  /** Real gate failures (source-verify / source-v2), surfaced as the things to fix next. */
  blockers: { kind: string; message: string }[];
  /** Non-blocking reminders (e.g. the REVIEW-PACKET token note in QC/Publish). */
  notes: string[];
}

/** Pure: each strict-env var marked set (=== "1") or not. */
export function strictEnvStatus(env: Record<string, string | undefined>): { name: string; set: boolean }[] {
  return STRICT_ENV_VARS.map((name) => ({ name, set: env[name] === "1" }));
}

/** Map the honest book-status phase → the orchestrate-flow next step. Pure. */
export function runbookPlan(phase: string, bookId: string): RunbookPlan {
  if (phase === "qc") {
    return {
      label: "QC",
      openPrompt: "agent-prompts/QC-ORCHESTRATE-CODEX-SESSION.md",
      next: `${STRICT} npx tsx src/cli.ts qc-auto "${bookId}" --pass --max-agents 6`,
    };
  }
  if (phase === "ready to publish") {
    return {
      label: "Publish",
      openPrompt: "agent-prompts/PUBLISH-AFTER-QC-CODEX-SESSION.md",
      next: `${STRICT} npx tsx src/cli.ts publish-after-qc "${bookId}" --round <PASS-roundId> --dry-run`,
    };
  }
  if (phase === "gating" || phase.startsWith("generating")) {
    return {
      label: "Write",
      openPrompt: "agent-prompts/WRITE-ORCHESTRATE-CODEX-SESSION.md",
      next: `npx tsx src/cli.ts fanout ${bookId} --write-dir state/authoring-cards/${bookId}   # then dispatch writers, then: fanout ${bookId} --barrier`,
    };
  }
  if (phase === "shipped") {
    return { label: "Shipped", openPrompt: "—", next: "(published — nothing to do)" };
  }
  // Research stages: research-bibliography / research-chapter / chapter-index / anything else.
  return {
    label: "Research",
    openPrompt: "agent-prompts/RESEARCH-CODEX-SESSION.md",
    next: `npx tsx src/cli.ts next-task ${bookId}   # produce sidecars + index, then: source-verify ${bookId} --write && source-verify-check ${bookId}`,
  };
}

const SOURCE_VERIFY_LABEL: Record<SourceVerifyState, string> = {
  ABSENT: "ABSENT (run source-verify --write)",
  PRESENT_PASS: "PRESENT, PASS",
  PRESENT_BAD: "PRESENT BUT BAD",
  UNPARSEABLE: "PRESENT BUT UNPARSEABLE",
  "N/A": "n/a (no source items yet)",
};

/** Render the control panel (text). Pure — the CLI gathers `plan` + `status`. */
export function formatRunbook(bookId: string, plan: RunbookPlan, status: RunbookStatus): string {
  const L: string[] = [];
  L.push(`ChapterFlow Runbook — ${bookId}`);
  L.push("");
  L.push(`phase: ${plan.label}  (book-status: ${status.phase})`);
  L.push("");
  L.push("strict env:");
  const width = Math.max(...status.env.map((e) => e.name.length)) + 2;
  for (const e of status.env) L.push(`  ${`${e.name}=1`.padEnd(width)} ${e.set ? "OK" : "MISSING"}`);
  L.push("  # set CHAPTERFLOW_SESSION_ID FRESH per phase — a single exported id self-blocks (see RUN-A-BOOK.md)");
  L.push("");
  L.push("status:");
  L.push(`  source-v2:      ${status.sourceV2}`);
  L.push(`  source-verify:  ${SOURCE_VERIFY_LABEL[status.sourceVerify]}`);
  L.push(`  qc round:       ${status.qcRound ?? "(none on disk)"}`);
  L.push("");
  L.push("next:");
  L.push(`  ${plan.next}`);
  L.push("");
  L.push("open prompt:");
  L.push(`  ${plan.openPrompt}`);
  L.push("");
  L.push("blockers:");
  if (status.blockers.length === 0) L.push("  none");
  else for (const b of status.blockers) L.push(`  [${b.kind}] ${b.message}`);
  if (status.notes.length > 0) {
    L.push("");
    L.push("notes:");
    for (const n of status.notes) L.push(`  ${n}`);
  }
  return L.join("\n");
}

/** The machine-readable form (`--json`) — same model, for feeding a harness / Codex / MCP. */
export function runbookJson(bookId: string, plan: RunbookPlan, status: RunbookStatus): object {
  const isSet = (name: string) => status.env.find((e) => e.name === name)?.set ?? false;
  return {
    bookId,
    phase: status.phase,
    label: plan.label,
    strictEnv: {
      noApi: isSet("CHAPTERFLOW_NO_API_CODEX_QC"),
      sourceVerifyRequired: isSet("CHAPTERFLOW_REQUIRE_SOURCE_VERIFY"),
      sessionIndependence: isSet("CHAPTERFLOW_ENFORCE_SESSION_INDEPENDENCE"),
    },
    sourceV2: status.sourceV2,
    sourceVerify: status.sourceVerify,
    qcRound: status.qcRound,
    blockers: status.blockers,
    notes: status.notes,
    next: { prompt: plan.openPrompt, command: plan.next },
  };
}
