/**
 * v22 optimized autonomous pipeline.
 *
 * One terminal command:
 *   npm run pipeline -- <bookId> --title "..." --author "..." --policy standard
 *
 * The command is intentionally thin: it does not weaken any gate. It wires the
 * cost-efficient RunPolicy into the existing generation and promotion pipeline,
 * starts cost telemetry, and prints live phase progress in the terminal.
 */

import { mkdirSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

import { beginRun, defaultCostManifestPath, endRun, formatStats, writeCostManifest } from "../cost-tracker.js";
import { generateBook, loadChapterIndex } from "../generateBook.js";
import { hasChapterIndex, researchBook } from "../researcher.js";
import { doctorExitCode, formatDoctor, runDoctorChecks } from "../lifecycle/doctor.js";
import { checkSourceV2Gate } from "../qc/sourceV2Gate.js";
import { formatRunPolicy, parseRunPolicyName, runPolicy } from "../policy/runPolicy.js";
import { repairPromptPathFromError, writeSelfHealingRepairPrompt } from "../repair/selfHealingRepair.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PIPELINE_ROOT = resolve(__dirname, "../..");
const STATE_ROOT = resolve(PIPELINE_ROOT, "state");

const TTY = !!process.stdout.isTTY;
const c = (code: string, s: string) => (TTY ? `\x1b[${code}m${s}\x1b[0m` : s);
const bold = (s: string) => c("1", s);
const green = (s: string) => c("32", s);
const yellow = (s: string) => c("33", s);
const red = (s: string) => c("31", s);
const cyan = (s: string) => c("36", s);
const dim = (s: string) => c("2", s);

type Flags = Record<string, string | boolean>;

type Phase = "preflight" | "research" | "source" | "generation" | "book-gate" | "promotion" | "metrics";

export async function runOptimizedPipeline(args: string[], flags: Flags): Promise<number> {
  const bookId = args[0];
  if (!bookId) {
    console.error('Usage: pipeline <bookId> --title "..." --author "..." [--policy economy|standard|premium|publish] [--from N] [--to N] [--force] [--research|--skip-research] [--research-concurrency N] [--no-publish] [--no-model-gen] [--no-categorizer --categories A,B --tags x,y]');
    return 2;
  }
  const title = stringFlag(flags, "title");
  const author = stringFlag(flags, "author");
  if (!title || !author) {
    console.error("pipeline requires --title and --author so the run manifest and production package are deterministic.");
    return 2;
  }

  const policy = runPolicy(parseRunPolicyName(flags.policy));
  const runId = stringFlag(flags, "run-id") ?? `${bookId}.v22.${new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14)}`;
  process.env.CHAPTERFLOW_RUN_ID = process.env.CHAPTERFLOW_RUN_ID ?? runId;
  if (flags["no-model-gen"] !== true) {
    process.env.CHAPTERFLOW_ALLOW_MODEL_GEN = process.env.CHAPTERFLOW_ALLOW_MODEL_GEN ?? "1";
  }

  let currentPhase: "preflight" | "research" | "source" | "generation" | "book-gate" | "promotion" = "preflight";
  try {
  banner(bookId, title, author, runId);
  console.log(formatRunPolicy(policy));

  const hadChapterIndexAtStart = hasChapterIndex(bookId);
  currentPhase = "preflight";
  phase("preflight", hadChapterIndexAtStart ? "doctor checks" : "workspace doctor checks before research");
  const doctor = runDoctorChecks(hadChapterIndexAtStart ? bookId : undefined);
  console.log(indent(formatDoctor(doctor)));
  const fatalDoctor = doctorExitCode(doctor) === 2;
  if (fatalDoctor && flags["allow-doctor-fatal"] !== true) {
    const repair = writeSelfHealingRepairPrompt({
      bookId,
      title,
      author,
      runId,
      stage: "preflight",
      severity: "infra",
      summary: "Preflight doctor found fatal workspace/state blockers before research/generation.",
      findings: doctor.filter((f) => f.level !== "ok").map((f) => ({
        id: f.check,
        severity: f.level,
        message: f.message,
        expectedFix: "Fix this doctor invariant, then rerun the pipeline. Do not bypass unless running diagnostics only.",
      })),
      validationCommands: [`npx tsx src/cli.ts doctor ${bookId}`],
      stateRoot: STATE_ROOT,
    });
    console.error(red(`Preflight blocked. Repair prompt: ${repair.promptPath}`));
    console.error(red("Re-run with --allow-doctor-fatal only for a deliberate diagnostic run."));
    return 2;
  }

  currentPhase = "research";
  phase("research", "source acquisition and chapter index");
  const researchOk = await ensureResearchArtifacts(bookId, title, author, flags, runId);
  if (!researchOk) return 1;

  if (!hadChapterIndexAtStart || flags.research === true || flags["force-research"] === true) {
    currentPhase = "preflight";
    phase("preflight", "post-research book doctor checks");
    const postResearchDoctor = runDoctorChecks(bookId);
    console.log(indent(formatDoctor(postResearchDoctor)));
    const fatalPostResearchDoctor = doctorExitCode(postResearchDoctor) === 2;
    if (fatalPostResearchDoctor && flags["allow-doctor-fatal"] !== true) {
      const repair = writeSelfHealingRepairPrompt({
        bookId,
        title,
        author,
        runId,
        stage: "preflight",
        severity: "infra",
        summary: "Post-research doctor found fatal book/index blockers before generation.",
        findings: postResearchDoctor.filter((f) => f.level !== "ok").map((f) => ({
          id: f.check,
          severity: f.level,
          message: f.message,
          expectedFix: "Fix the book/index/source-freeze state produced by research, then rerun pipeline.",
        })),
        validationCommands: [`npx tsx src/cli.ts doctor ${bookId}`],
        stateRoot: STATE_ROOT,
      });
      console.error(red(`Post-research preflight blocked. Repair prompt: ${repair.promptPath}`));
      return 2;
    }
  }

  currentPhase = "source";
  phase("source", "source-v2 adequacy gate");
  const chapters = loadChapterIndex(bookId);
  const fromChapter = intFlag(flags, "from");
  const toChapter = intFlag(flags, "to");
  const range = chapters.filter((c) => {
    if (fromChapter !== undefined && c.chapterNumber < fromChapter) return false;
    if (toChapter !== undefined && c.chapterNumber > toChapter) return false;
    return true;
  });
  const sourceGate = checkSourceV2Gate(bookId, range.map((c) => c.chapterNumber));
  if (sourceGate.passed) {
    console.log(indent(green(`source-v2 PASS for ${range.length} chapter(s)`)));
  } else {
    const blockers = sourceGate.findings.filter((f) => f.severity === "blocker");
    const line = `${blockers.length} source blocker(s), ${sourceGate.findings.length} total finding(s)`;
    console.log(indent(blockers.length > 0 ? red(line) : yellow(line)));
    for (const finding of sourceGate.findings.slice(0, 12)) {
      console.log(indent(`${finding.severity.toUpperCase()} ${finding.checkId}: ${finding.message}`, 2));
    }
    if (blockers.length > 0 && flags["allow-source-risk"] !== true) {
      const repair = writeSelfHealingRepairPrompt({
        bookId,
        title,
        author,
        runId,
        stage: "source",
        severity: "blocker",
        summary: `Source-v2 gate blocked ${range.length} chapter(s) before generation.`,
        findings: sourceGate.findings.map((f) => ({
          id: f.checkId,
          severity: f.severity,
          chapterNumber: f.chapterNumber,
          message: f.message,
          expectedFix: "Repair the named source sidecar/TOC/index mismatch before authoring. Do not let writers invent around missing source evidence.",
        })),
        validationCommands: [`npx tsx src/cli.ts source-v2-gate ${bookId}`, `npx tsx src/cli.ts check-source ${bookId}`],
        stateRoot: STATE_ROOT,
      });
      console.error(red(`Source gate blocked before generation. Repair prompt: ${repair.promptPath}`));
      console.error(red("This is a cost save: fix source sidecars before spending writer tokens."));
      return 2;
    }
  }

  currentPhase = "generation";
  phase("generation", `authoring ${range.length} chapter(s)`);
  mkdirSync(resolve(STATE_ROOT, "metrics", bookId), { recursive: true });
  beginRun(runId);
  let result: Awaited<ReturnType<typeof generateBook>>;
  try {
    result = await generateBook({ bookId, title, author }, chapters, {
      fromChapter,
      toChapter,
      continueOnError: flags["continue-on-error"] === true,
      autoPromote: flags["no-publish"] !== true,
      noCategorizer: flags["no-categorizer"] === true,
      manualCategories: csvFlag(flags, "categories"),
      manualTags: csvFlag(flags, "tags"),
      force: flags.force === true,
      runPolicy: policy,
      logger: (msg) => logGenerationLine(msg),
    });
  } finally {
    const stats = endRun();
    const metricsPath = defaultCostManifestPath(bookId, runId, STATE_ROOT);
    writeCostManifest(stats, metricsPath);
    phase("metrics", "cost/token telemetry");
    if (stats) console.log(indent(formatStats(stats)));
    console.log(indent(`manifest: ${metricsPath}`));
  }

  if (result.failed.length > 0) {
    const repair = writeSelfHealingRepairPrompt({
      bookId,
      title,
      author,
      runId,
      stage: "chapter-generation",
      severity: "blocker",
      summary: `${result.failed.length} chapter(s) failed during pipeline generation.`,
      findings: result.failed.map((f) => ({
        id: "chapter-generation-failed",
        severity: "blocker",
        chapterNumber: f.chapter.chapterNumber,
        unit: f.chapter.chapterId,
        message: f.error,
        evidence: f.repairPromptPath,
        expectedFix: "Open the chapter-specific prompt if present, repair the named chapter, then rerun author-check, gate-chapter, and book-gate.",
      })),
      artifacts: result.failed.flatMap((f) => f.repairPromptPath ? [f.repairPromptPath] : []),
      validationCommands: [
        ...result.failed.flatMap((f) => [
          `npx tsx src/cli.ts author-check state/chapters/${f.chapter.chapterId}.v21-native.chapter.json`,
          `npx tsx src/cli.ts gate-chapter state/chapters/${f.chapter.chapterId}.v21-native.chapter.json`,
        ]),
        `npx tsx src/cli.ts book-gate ${bookId}`,
      ],
      stateRoot: STATE_ROOT,
    });
    console.error(red(`repair prompt written: ${repair.promptPath}`));
  }

  currentPhase = "book-gate";
  phase("book-gate", "deterministic whole-book quality gate");
  if (result.bookGate.passed) console.log(indent(green("book-gate PASS")));
  else {
    console.log(indent(red(`book-gate BLOCKED (${result.bookGate.findings.filter((f) => f.severity === "blocker").length} blocker(s))`)));
    const offendingChapters = [...new Set(result.bookGate.findings.flatMap((f) => f.chapters ?? []))].sort((a, b) => a - b);
    const repair = writeSelfHealingRepairPrompt({
      bookId,
      title,
      author,
      runId,
      stage: "book-gate",
      severity: "blocker",
      summary: `Book gate blocked ${bookId}: ${result.bookGate.findings.filter((f) => f.severity === "blocker").length} blocker(s), ${result.bookGate.findings.filter((f) => f.severity === "major").length} major(s).`,
      findings: result.bookGate.findings.map((f) => ({
        id: f.catalogId,
        severity: f.severity,
        chapterNumber: f.chapters?.[0],
        path: f.path,
        message: f.message,
        evidence: f.evidence,
        expectedFix: "Repair the smallest named chapter set so the book-level pattern/identity issue clears; do not edit gate code, prompt rules, or palette config.",
      })),
      artifacts: [resolve(STATE_ROOT, "books", `${bookId}.book-gate.json`)],
      validationCommands: [
        ...offendingChapters.map((n) => `npx tsx src/cli.ts gate-chapter state/chapters/${bookId}-ch${String(n).padStart(2, "0")}.v21-native.chapter.json`),
        `npx tsx src/cli.ts book-gate ${bookId}`,
        `npx tsx src/cli.ts qc-converge ${bookId}`,
      ],
      stateRoot: STATE_ROOT,
    });
    console.error(red(`repair prompt written: ${repair.promptPath}`));
  }

  currentPhase = "promotion";
  phase("promotion", flags["no-publish"] === true ? "skipped by --no-publish" : "strict final promotion attempted by generateBook");
  if (result.promotion) {
    console.log(indent(result.promotion.promoted ? green("promotion PASS") : red("promotion BLOCKED")));
    if (!result.promotion.promoted) {
      const repair = writeSelfHealingRepairPrompt({
        bookId,
        title,
        author,
        runId,
        stage: "promotion",
        severity: "blocker",
        summary: result.promotion.reason,
        artifacts: [result.promotion.reportPath],
        findings: [{
          id: "promotion-blocked",
          severity: "blocker",
          message: result.promotion.reason,
          evidence: result.promotion.reportPath,
          expectedFix: "Open the promotion report, repair the first nonzero blocking gate category, rerun qc-converge, then rerun promote-book. Do not forge QC/source/generation-debt state.",
        }],
        validationCommands: [
          `npx tsx src/cli.ts diagnose ${bookId}`,
          `npx tsx src/cli.ts qc-converge ${bookId}`,
          `npx tsx src/cli.ts promote-book ${bookId} --title '${title.replace(/'/g, `'\''`)}' --author '${author.replace(/'/g, `'\''`)}'`,
        ],
        stateRoot: STATE_ROOT,
      });
      console.error(red(`repair prompt written: ${repair.promptPath}`));
    }
  } else if (flags["no-publish"] === true) {
    console.log(indent(yellow("promotion skipped; run promote-book/publish after QC")));
  } else {
    console.log(indent(yellow("promotion not produced; inspect generation/book-gate/QC status above")));
  }

  if (result.failed.length > 0) return 1;
  if (!result.bookGate.passed) return 1;
  if (result.promotion && !result.promotion.promoted) return 1;
  return 0;
  } catch (err) {
    const stage = currentPhase === "generation" ? "chapter-generation" : currentPhase === "book-gate" ? "book-gate" : currentPhase;
    const inheritedRepairPrompt = repairPromptPathFromError(err);
    const repair = writeSelfHealingRepairPrompt({
      bookId,
      title,
      author,
      runId,
      stage,
      severity: currentPhase === "preflight" || currentPhase === "research" ? "infra" : "blocker",
      summary: `${currentPhase} threw an unexpected exception.`,
      error: err,
      artifacts: inheritedRepairPrompt ? [inheritedRepairPrompt] : [],
      recommendedFixes: inheritedRepairPrompt
        ? [
          "Open the inherited stage-specific repair prompt listed in Evidence artifacts first; it is closer to the actual failed chapter/gate.",
          "Use this pipeline-level prompt only to repair orchestration or state wiring around that underlying failure.",
          "Do not bypass gates. After fixing, rerun the pipeline from the failed phase or from the top-level command.",
        ]
        : [
          "Classify this as infrastructure/pipeline wiring if the stack points into `src/`; otherwise repair the named source/state artifact.",
          "Do not bypass gates. After fixing, rerun the pipeline from the failed phase or from the top-level command.",
        ],
      validationCommands: [`npx tsx src/cli.ts doctor ${bookId}`, `npm run pipeline -- ${bookId} --title '${title.replace(/'/g, `'\''`)}' --author '${author.replace(/'/g, `'\''`)}' --no-publish`],
      stateRoot: STATE_ROOT,
    });
    console.error(red(`repair prompt written: ${repair.promptPath}`));
    console.error(red(`${currentPhase} failed: ${(err as Error).message}`));
    return 1;
  }
}

async function ensureResearchArtifacts(bookId: string, title: string, author: string, flags: Flags, runId: string): Promise<boolean> {
  const forceResearch = flags.research === true || flags["force-research"] === true;
  const skipResearch = flags["skip-research"] === true;
  if (hasChapterIndex(bookId) && !forceResearch) {
    console.log(indent(green(`existing chapter index found for ${bookId}; reusing source bundle`)));
    return true;
  }
  if (skipResearch) {
    const repair = writeSelfHealingRepairPrompt({
      bookId,
      title,
      author,
      runId,
      stage: "research",
      severity: "infra",
      summary: `No chapter index found for ${bookId}, and --skip-research was set.`,
      recommendedFixes: [
        "Run research to create the canonical chapter index and source sidecars, or remove --skip-research.",
        "Do not fabricate state/indexes manually unless you also provide valid source-v2 sidecars.",
      ],
      validationCommands: [`npx tsx src/cli.ts research '${title.replace(/'/g, `'\''`)}' '${author.replace(/'/g, `'\''`)}' --book-id ${bookId}`, `npx tsx src/cli.ts source-v2-gate ${bookId}`],
      stateRoot: STATE_ROOT,
    });
    console.error(red(`No chapter index found for ${bookId}, and --skip-research was set. Repair prompt: ${repair.promptPath}`));
    return false;
  }

  const concurrency = intFlag(flags, "research-concurrency") ?? 3;
  console.log(indent(yellow(`research ${forceResearch ? "forced" : "needed"}; running researcher with concurrency ${concurrency}`)));
  const result = await researchBook(title, author, {
    bookId,
    chapterConcurrency: concurrency,
    forceRefresh: forceResearch,
    failOnCoherenceBlockers: true,
    logger: (msg) => console.log(indent(msg)),
  });
  console.log(indent(green(`research complete: runId=${result.runId}`)));
  console.log(indent(`bundle: ${result.bundlePath}`));
  console.log(indent(`index:  ${result.chapterIndexPath}`));
  if (!result.coherence.passed) {
    const repair = writeSelfHealingRepairPrompt({
      bookId,
      title,
      author,
      runId,
      stage: "research",
      severity: "blocker",
      summary: "Research coherence blocked before generation.",
      findings: (result.coherence.findings ?? []).map((f: any) => ({
        id: f.checkId ?? f.id ?? "research-coherence",
        severity: f.severity ?? "blocker",
        chapterNumber: f.chapterNumber,
        message: f.message ?? JSON.stringify(f),
        evidence: f.evidence,
        expectedFix: "Repair the research bundle/source sidecars until coherence passes; do not proceed to authoring with incoherent source evidence.",
      })),
      artifacts: [result.bundlePath, result.chapterIndexPath],
      validationCommands: [`npx tsx src/cli.ts check-source ${bookId}`, `npx tsx src/cli.ts source-v2-gate ${bookId}`],
      stateRoot: STATE_ROOT,
    });
    console.error(red(`Research coherence blocked. Repair prompt: ${repair.promptPath}`));
    return false;
  }
  return true;
}

function banner(bookId: string, title: string, author: string, runId: string): void {
  console.log(bold("\nChapterFlow v22 optimized autonomous pipeline"));
  console.log(dim(`bookId=${bookId} · title=${title} · author=${author} · runId=${runId}`));
}

function phase(phase: Phase, label: string): void {
  const icon: Record<Phase, string> = {
    preflight: "🔒",
    research: "📚",
    source: "🔬",
    generation: "✍️ ",
    "book-gate": "🚪",
    promotion: "📦",
    metrics: "📊",
  };
  console.log(`\n${icon[phase]} ${cyan(phase.toUpperCase())} ${label}`);
}

function logGenerationLine(msg: string): void {
  const cleaned = msg.replace(/^\n+/, "");
  if (!cleaned) return;
  if (/^--- Chapter /.test(cleaned)) console.log(`\n${bold(cleaned)}`);
  else if (/^===/.test(cleaned)) console.log(cyan(cleaned));
  else if (/FAILED|BLOCKED|failed/i.test(cleaned)) console.log(red(`  ${cleaned}`));
  else if (/PASS|done|reusing cached|skipped/i.test(cleaned)) console.log(green(`  ${cleaned}`));
  else console.log(`  ${cleaned}`);
}

function stringFlag(flags: Flags, name: string): string | undefined {
  const value = flags[name];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function intFlag(flags: Flags, name: string): number | undefined {
  const value = stringFlag(flags, name);
  if (!value) return undefined;
  const n = Number.parseInt(value, 10);
  if (!Number.isInteger(n) || n <= 0) throw new Error(`--${name} must be a positive integer; got ${value}`);
  return n;
}

function csvFlag(flags: Flags, name: string): string[] | undefined {
  const value = stringFlag(flags, name);
  if (!value) return undefined;
  return value.split(",").map((s) => s.trim()).filter(Boolean);
}

function indent(text: string, levels = 1): string {
  const pad = "  ".repeat(levels);
  return text.split("\n").map((line) => `${pad}${line}`).join("\n");
}
