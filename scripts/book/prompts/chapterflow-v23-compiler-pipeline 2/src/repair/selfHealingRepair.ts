/**
 * v22 self-healing repair prompt writer.
 *
 * Any deterministic or orchestration failure should leave behind two durable
 * artifacts:
 *   - a markdown prompt that can be handed to a repair agent verbatim
 *   - a JSON sidecar with the same machine-readable evidence
 *
 * This module deliberately does not fix content itself. It makes the next safe
 * repair action explicit, scoped, and reproducible.
 */

import { createHash } from "crypto";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_STATE_ROOT = resolve(__dirname, "../../state");

export type SelfHealingStage =
  | "preflight"
  | "research"
  | "source"
  | "chapter-generation"
  | "ship-gate"
  | "boundary-validation"
  | "book-gate"
  | "promotion"
  | "qc"
  | "unknown";

export type SelfHealingSeverity = "advisory" | "major" | "blocker" | "infra";

export type SelfHealingChapterRef = {
  chapterId?: string;
  chapterNumber?: number;
  chapterTitle?: string;
};

export type SelfHealingFinding = {
  id?: string;
  severity?: string;
  unit?: string;
  path?: string;
  chapterNumber?: number;
  message: string;
  evidence?: string;
  expectedFix?: string;
};

export type SelfHealingRepairPromptInput = {
  bookId: string;
  title?: string;
  author?: string;
  runId?: string;
  stage: SelfHealingStage;
  severity?: SelfHealingSeverity;
  chapter?: SelfHealingChapterRef;
  summary: string;
  error?: unknown;
  findings?: SelfHealingFinding[];
  artifacts?: string[];
  recommendedFixes?: string[];
  validationCommands?: string[];
  nextCommand?: string;
  stateRoot?: string;
  createdAt?: string;
};

export type SelfHealingRepairPromptResult = {
  promptPath: string;
  reportPath: string;
  runId: string;
  stage: SelfHealingStage;
  command: string;
};

export type RepairPromptError = Error & { repairPromptPath?: string; repairReportPath?: string };

export function errorWithRepairPrompt(message: string, result: SelfHealingRepairPromptResult): RepairPromptError {
  const e = new Error(`${message}\nRepair prompt: ${result.promptPath}`) as RepairPromptError;
  e.repairPromptPath = result.promptPath;
  e.repairReportPath = result.reportPath;
  return e;
}

export function repairPromptPathFromError(err: unknown): string | undefined {
  const path = (err as Partial<RepairPromptError> | undefined)?.repairPromptPath;
  return typeof path === "string" && path.trim() ? path : undefined;
}

export function writeSelfHealingRepairPrompt(input: SelfHealingRepairPromptInput): SelfHealingRepairPromptResult {
  const stateRoot = input.stateRoot ?? DEFAULT_STATE_ROOT;
  const runId = safeSlug(input.runId ?? process.env.CHAPTERFLOW_RUN_ID ?? "manual");
  const createdAt = input.createdAt ?? new Date().toISOString();
  const stage = input.stage;
  const identity = compactHash({ stage, bookId: input.bookId, chapter: input.chapter, summary: input.summary, createdAt }).slice(0, 8);
  const basename = `${safeSlug(stage)}.${timestampForPath(createdAt)}.${identity}`;
  const dir = resolve(stateRoot, "repairs", input.bookId, runId);
  mkdirSync(dir, { recursive: true });
  const promptPath = resolve(dir, `${basename}.repair.md`);
  const reportPath = resolve(dir, `${basename}.repair.json`);
  const validationCommands = input.validationCommands?.length ? input.validationCommands : defaultValidationCommands(input);
  const recommendedFixes = input.recommendedFixes?.length ? input.recommendedFixes : defaultRecommendedFixes(input);
  const nextCommand = input.nextCommand ?? validationCommands[0] ?? `npx tsx src/cli.ts diagnose ${input.bookId}`;

  const report = {
    schemaVersion: "chapterflow-self-healing-repair-v1",
    createdAt,
    bookId: input.bookId,
    title: input.title,
    author: input.author,
    runId,
    stage,
    severity: input.severity ?? defaultSeverity(stage),
    chapter: input.chapter,
    summary: input.summary,
    error: normalizeError(input.error),
    findings: input.findings ?? [],
    artifacts: input.artifacts ?? [],
    recommendedFixes,
    validationCommands,
    nextCommand,
    promptPath,
    reportPath,
  };

  writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n", "utf8");
  writeFileSync(promptPath, renderSelfHealingPrompt(report), "utf8");
  return { promptPath, reportPath, runId, stage, command: nextCommand };
}

function renderSelfHealingPrompt(report: {
  schemaVersion: string;
  createdAt: string;
  bookId: string;
  title?: string;
  author?: string;
  runId: string;
  stage: SelfHealingStage;
  severity: SelfHealingSeverity;
  chapter?: SelfHealingChapterRef;
  summary: string;
  error?: { name?: string; message: string; stack?: string };
  findings: SelfHealingFinding[];
  artifacts: string[];
  recommendedFixes: string[];
  validationCommands: string[];
  nextCommand: string;
  promptPath: string;
  reportPath: string;
}): string {
  const L: string[] = [];
  const stageTitle = report.stage.split("-").map((s) => s[0]?.toUpperCase() + s.slice(1)).join(" ");
  L.push(`# Self-healing repair prompt — ${stageTitle}`);
  L.push("");
  L.push("You are a fresh ChapterFlow repair agent. Your job is to fix the specific failure below with the smallest safe change, then prove the fix with the validation commands.");
  L.push("");
  L.push("## Role contract");
  L.push("- Do not certify publishability. Do not run `qc-attest`, `bar-attest`, `sweep-attest`, `key-resolve`, `major-disposition`, `promote-book`, or `publish` unless a validation command explicitly says so.");
  L.push("- Do not weaken gates, critics, schemas, prompts, config, source-reality policy, or QC policy to make the failure disappear.");
  L.push("- Prefer content/source/state repair over code repair. Edit pipeline code only when this prompt clearly identifies an infrastructure defect, and then add or update a regression test.");
  L.push("- Preserve source-v2 grounding, source anchor ids, quiz keys, chapter identity, and content hashes for unrelated fields.");
  L.push("- If you cannot fix safely within the scope below, stop and report exactly what evidence is missing.");
  L.push("");
  L.push("## Failure context");
  L.push(`- bookId: \`${report.bookId}\``);
  if (report.title) L.push(`- title: ${report.title}`);
  if (report.author) L.push(`- author: ${report.author}`);
  L.push(`- runId: \`${report.runId}\``);
  L.push(`- stage: \`${report.stage}\``);
  L.push(`- severity: \`${report.severity}\``);
  L.push(`- createdAt: ${report.createdAt}`);
  if (report.chapter) {
    const ch = report.chapter;
    L.push(`- chapter: ${ch.chapterNumber ? `ch${String(ch.chapterNumber).padStart(2, "0")}` : "unknown"}${ch.chapterId ? ` / \`${ch.chapterId}\`` : ""}${ch.chapterTitle ? ` / ${ch.chapterTitle}` : ""}`);
    if (ch.chapterId) L.push(`- chapter file: \`state/chapters/${ch.chapterId}.v21-native.chapter.json\``);
  }
  L.push("");
  L.push("## Summary");
  L.push(report.summary);
  L.push("");
  if (report.error) {
    L.push("## Error");
    L.push("```text");
    L.push(`${report.error.name ? `${report.error.name}: ` : ""}${report.error.message}`.slice(0, 4000));
    L.push("```");
    L.push("");
  }
  if (report.artifacts.length > 0) {
    L.push("## Evidence artifacts");
    for (const artifact of report.artifacts) L.push(`- ${artifact}${existsSync(artifact) ? "" : " (path may be relative or not yet written)"}`);
    L.push("");
  }
  if (report.findings.length > 0) {
    L.push("## Findings to repair");
    report.findings.forEach((f, i) => {
      L.push(`### ${i + 1}. ${f.id ?? "finding"}${f.severity ? ` — ${f.severity}` : ""}`);
      if (f.chapterNumber) L.push(`- chapter: ch${String(f.chapterNumber).padStart(2, "0")}`);
      if (f.unit) L.push(`- unit: \`${f.unit}\``);
      if (f.path) L.push(`- path: \`${f.path}\``);
      L.push(`- problem: ${f.message}`);
      if (f.evidence) L.push(`- evidence: ${f.evidence}`);
      if (f.expectedFix) L.push(`- recommended fix: ${f.expectedFix}`);
      L.push("");
    });
  }
  L.push("## Recommended fix strategy");
  for (const fix of report.recommendedFixes) L.push(`- ${fix}`);
  L.push("");
  L.push("## Validation commands");
  L.push("Run these from the pipeline root after the repair:");
  L.push("```bash");
  for (const cmd of report.validationCommands) L.push(cmd);
  L.push("```");
  L.push("");
  L.push("## Required handoff");
  L.push("When done, report:");
  L.push("- files changed");
  L.push("- exact findings fixed");
  L.push("- validation command output");
  L.push("- any remaining blocker and why it could not be safely fixed");
  L.push("");
  L.push(`Machine-readable sidecar: \`${report.reportPath}\``);
  return L.join("\n") + "\n";
}

function defaultRecommendedFixes(input: SelfHealingRepairPromptInput): string[] {
  const book = input.bookId;
  const ch = input.chapter;
  const chapterFile = ch?.chapterId ? `state/chapters/${ch.chapterId}.v21-native.chapter.json` : undefined;
  switch (input.stage) {
    case "preflight":
      return [
        "Fix the workspace/state invariant named by the doctor finding before spending generation tokens.",
        "If the issue is chapter identity drift, run or inspect `fix-chapter-ids` / `migrate-chapter-identity` rather than editing gates.",
        "If the issue is a shadow state directory, preserve evidence, move the stale shadow aside, then rerun doctor.",
      ];
    case "research":
      return [
        "Repair bibliography, TOC, or source sidecars; do not author chapters from thin or incoherent source evidence.",
        `Rerun source checks for ${book}; only proceed when source coherence/source-v2 gates pass.`,
      ];
    case "source":
      return [
        "Open the cited source-v2 sidecar(s) and fix missing anchors, malformed schema, TOC/index mismatch, or thin evidence.",
        "Do not let a writer invent facts to compensate for missing source evidence.",
        "After source repair, rerun source-v2-gate and check-source before generation.",
      ];
    case "ship-gate":
    case "chapter-generation":
    case "boundary-validation":
      return [
        chapterFile ? `Edit only the failing chapter content in \`${chapterFile}\`, unless the report names missing source/plans as the root cause.` : "Edit only the failing chapter content unless the report names missing source/plans as the root cause.",
        "Fix blocker-level findings first. Preserve chapterId, number, title, sourceAnchorIds, and quiz keys unless the finding explicitly targets them.",
        "Run author-check and gate-chapter for the edited chapter, then rerun book-gate to catch cross-chapter regressions.",
      ];
    case "book-gate":
      return [
        "Repair the smallest set of chapters named by the book-gate findings. Do not homogenize siblings while fixing repetition.",
        "For cross-chapter repetition, restage examples/hooks/quiz stems in distinct concrete situations instead of editing palette/config files.",
        "Run gate-chapter for changed chapters, then book-gate for the whole book.",
      ];
    case "promotion":
      return [
        "Read the promotion report and quarantine report. Fix the first blocking gate category rather than bypassing promotion.",
        "If blockers are QC freshness, run the QC repair/fresh-round workflow; do not forge attestations.",
        "If blockers are generation debt, resolve the underlying degraded stage or add only an exact-content waiver after human review.",
      ];
    case "qc":
      return [
        "Use the QC repair brief/prompt for the latest round. Repair content only; never attest your own repair.",
        "After edits, run qc-converge and then a fresh QC round.",
      ];
    default:
      return [
        "Diagnose the failure with the artifacts listed above, make the smallest safe repair, and add a regression test if this is pipeline behavior.",
      ];
  }
}

function defaultValidationCommands(input: SelfHealingRepairPromptInput): string[] {
  const book = input.bookId;
  const title = input.title ? shellQuote(input.title) : "\"<title>\"";
  const author = input.author ? shellQuote(input.author) : "\"<author>\"";
  const ch = input.chapter;
  const chapterPath = ch?.chapterId ? `state/chapters/${ch.chapterId}.v21-native.chapter.json` : undefined;
  const commands: string[] = [];
  if (input.stage === "preflight") {
    commands.push(`npx tsx src/cli.ts doctor ${book}`);
    return commands;
  }
  if (input.stage === "research") {
    commands.push(`npx tsx src/cli.ts check-source ${book}`);
    commands.push(`npx tsx src/cli.ts source-v2-gate ${book}`);
    commands.push(`npx tsx src/cli.ts research ${title} ${author} --book-id ${book} --force-refresh`);
    return commands;
  }
  if (input.stage === "source") {
    commands.push(`npx tsx src/cli.ts source-v2-gate ${book}`);
    commands.push(`npx tsx src/cli.ts check-source ${book}`);
    return commands;
  }
  if (chapterPath) {
    commands.push(`npx tsx src/cli.ts author-check ${chapterPath}`);
    commands.push(`npx tsx src/cli.ts gate-chapter ${chapterPath}`);
  }
  commands.push(`npx tsx src/cli.ts book-gate ${book}`);
  if (input.stage === "promotion") {
    commands.push(`npx tsx src/cli.ts promote-book ${book} --title ${title} --author ${author}`);
  }
  if (input.stage === "qc") {
    commands.push(`npx tsx src/cli.ts qc-converge ${book}`);
  }
  return [...new Set(commands)];
}

function defaultSeverity(stage: SelfHealingStage): SelfHealingSeverity {
  if (stage === "preflight" || stage === "research") return "infra";
  if (stage === "source" || stage === "ship-gate" || stage === "boundary-validation" || stage === "book-gate" || stage === "promotion") return "blocker";
  return "major";
}

function normalizeError(error: unknown): { name?: string; message: string; stack?: string } | undefined {
  if (!error) return undefined;
  if (error instanceof Error) return { name: error.name, message: error.message, stack: error.stack };
  if (typeof error === "string") return { message: error };
  try {
    return { message: JSON.stringify(error) };
  } catch {
    return { message: String(error) };
  }
}

function timestampForPath(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);
  return d.toISOString().replace(/[^0-9]/g, "").slice(0, 14);
}

function compactHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

function safeSlug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 96) || "unknown";
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}
