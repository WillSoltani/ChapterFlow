/**
 * `runbook <bookId>` view model — a deterministic operator dashboard: given the book's
 * honest phase (from computeBookStatus), print the strict env, the exact next command, the
 * prompt to open, and live warnings. It RE-DERIVES nothing: phase comes from book-status,
 * the phase→orchestrate-prompt mapping below mirrors the table in agent-prompts/RUN-A-BOOK.md
 * (kept minimal to limit drift). The helper here is pure; the CLI adds the live warnings.
 */

export const STRICT_ENV = [
  "CHAPTERFLOW_NO_API_CODEX_QC=1",
  "CHAPTERFLOW_REQUIRE_SOURCE_VERIFY=1",
  "CHAPTERFLOW_ENFORCE_SESSION_INDEPENDENCE=1",
];

const STRICT = STRICT_ENV.join(" ");

export type RunbookPlan = { label: string; openPrompt: string; next: string };

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

/** Render the dashboard. `warnings` are computed by the CLI (live state). */
export function formatRunbook(bookId: string, phase: string, plan: RunbookPlan, warnings: string[]): string {
  const L: string[] = [];
  L.push(`ChapterFlow Runbook — ${bookId}`);
  L.push("");
  L.push(`phase: ${plan.label}  (book-status: ${phase})`);
  L.push("strict env (new books):");
  for (const e of STRICT_ENV) L.push(`  ${e}`);
  L.push("  # set CHAPTERFLOW_SESSION_ID FRESH per phase — a single exported id self-blocks (see RUN-A-BOOK.md)");
  L.push("");
  L.push("next:");
  L.push(`  ${plan.next}`);
  L.push("");
  L.push("open prompt:");
  L.push(`  ${plan.openPrompt}`);
  L.push("");
  L.push("warnings:");
  for (const w of warnings) L.push(`  ${w}`);
  return L.join("\n");
}
