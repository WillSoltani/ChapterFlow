/**
 * A-side (gpt-5.6-sol@xhigh) adjudication of the reader-gold dev pool.
 * Owner-ratified D3; budget recorded in the pool selection manifest:
 * 24 base calls / 48 hard (exactly one typed infrastructure replay per call,
 * never a content retry). ChatGPT-authenticated `codex exec` ONLY — the run
 * refuses to start if codex is in API-key mode. Each call carries the doc
 * INLINE with an --output-schema-enforced structured verdict, mirrored from
 * the B-side instructions for comparability. Results + ledger are retained
 * under state/migration-experiments/reader-gold-dev-pool-v1/adjudication/a-side/.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

import { REVIEW_WEIGHTS } from "../src/review/readerReview.js";

const PIPELINE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const POOL_ROOT = resolve(PIPELINE_ROOT, "state/migration-experiments/reader-gold-dev-pool-v1");
const A_SIDE_ROOT = resolve(POOL_ROOT, "adjudication/a-side");
const MODEL = "gpt-5.6-sol";
const EFFORT = "xhigh";
const BASE_CAP = 24;
const CALL_TIMEOUT_MS = 25 * 60 * 1000;
const CONCURRENCY = 3;

const sha256 = (data: string | Buffer): string => createHash("sha256").update(data).digest("hex");

const FACTORS = ["retention", "quizzes", "transfer", "practical", "summaries", "tone", "limits", "insight", "density", "beginner"] as const;

const OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["scores", "composite", "blockingFindings", "advisoryFindings", "escalationSignals",
    "structurallyWrongQuiz", "wrongQuizDetail", "acceptableControlEligible", "confidence"],
  properties: {
    scores: {
      type: "object",
      additionalProperties: false,
      required: [...FACTORS],
      properties: Object.fromEntries(FACTORS.map((f) => [f, { type: "number" }])),
    },
    composite: { type: "number" },
    blockingFindings: { type: "array", items: findingSchema() },
    advisoryFindings: { type: "array", items: findingSchema() },
    escalationSignals: { type: "array", items: findingSchema() },
    structurallyWrongQuiz: { type: "boolean" },
    wrongQuizDetail: { type: "string" },
    acceptableControlEligible: { type: "boolean" },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
  },
};

function findingSchema(): object {
  return {
    type: "object",
    additionalProperties: false,
    required: ["category", "unit", "problem", "evidence"],
    properties: {
      category: { type: "string" },
      unit: { type: "string" },
      problem: { type: "string" },
      evidence: { type: "string" },
    },
  };
}

function taskFor(document: string): string {
  const weights = (FACTORS as readonly string[]).map((f) => `${f}=${(REVIEW_WEIGHTS as Record<string, number>)[f]}`).join(", ");
  return [
    "You are an independent reader-experience adjudicator for a book-learning chapter. All evidence required for this review is included below. Do not use filesystem, shell, network, or external tools. Judge only the inline document.",
    "",
    "Score all ten factors 0-100 against reader experience quality (spread scores where quality genuinely differs): retention (memorability of the core lesson), quizzes (derivable, uniquely-keyed questions), transfer (applicability beyond the chapter, especially the implementation plan), practical (actionability of instructions), summaries (fast read/key takeaway fidelity), tone (authored, non-templated voice), limits (honest scope/limits framing), insight (depth of the core idea), density (information per unit of reading effort), beginner (accessibility to a first-time reader).",
    `Weighted composite uses these weights: ${weights}. Composite = sum(score*weight)/sum(weights), one decimal.`,
    "",
    "Decision policy: PASS = composite >= 80 AND zero blocking findings; REVISE = composite < 80; BLOCK = any blocking finding. Advisory findings and escalations are recorded but never gate.",
    "Blocking categories (reader-visible only): unsafe, internal_contradiction, structurally_invalid, schema_or_app_breaking, unusable. Advisory categories: thin_example, quiz_cue, repetition, tone, density, pacing, other_craft. Escalation categories: origin_ambiguous_to_reader, possible_real_world_claim, possible_attribution_issue. You judge ONLY reader experience, never external source truth: a claim that reads factual but is unverifiable on-page is an escalation, not a blocker.",
    "Also assess: structurallyWrongQuiz = true only if some question has no defensible answer among its lettered choices, or multiple equally defensible answers, judged from this document alone (explain in wrongQuizDetail).",
    "acceptableControlEligible = complete and readable AND composite >= 80 AND zero blocking findings AND no structurally wrong quiz AND no corruption. Advisories and escalations do NOT disqualify.",
    "Every finding needs: category, unit (section name), problem, evidence (short exact quote from the document).",
    "",
    "READER DOCUMENT (judge exactly this, top to bottom):",
    "-----",
    document,
    "-----",
  ].join("\n");
}

type LedgerCall = {
  doc: string;
  docSha256: string;
  attempt: number;
  startedAt: string;
  completedAt: string;
  exitCode: number | null;
  timedOut: boolean;
  outputSha256: string | null;
  infrastructureReplay: boolean;
  terminal: "completed" | "infra_failure";
};

function runOne(docName: string, docBytes: string, schemaPath: string, attempt: number): { call: LedgerCall; output: string | null } {
  const outPath = resolve(A_SIDE_ROOT, `${docName}.last-message.json`);
  const startedAt = new Date().toISOString();
  const result = spawnSync("codex", [
    "exec", "--skip-git-repo-check",
    "--output-last-message", outPath,
    "--output-schema", schemaPath,
    "-c", `model=${MODEL}`,
    "-c", `model_reasoning_effort=${EFFORT}`,
    taskFor(docBytes),
  ], { encoding: "utf8", timeout: CALL_TIMEOUT_MS, maxBuffer: 64 * 1024 * 1024, cwd: A_SIDE_ROOT });
  const completedAt = new Date().toISOString();
  const timedOut = result.error !== undefined && /ETIMEDOUT/.test(String(result.error));
  const produced = existsSync(outPath) ? readFileSync(outPath, "utf8").trim() : "";
  const ok = result.status === 0 && produced.length > 0;
  return {
    call: {
      doc: docName,
      docSha256: sha256(docBytes),
      attempt,
      startedAt,
      completedAt,
      exitCode: result.status,
      timedOut,
      outputSha256: ok ? sha256(produced) : null,
      infrastructureReplay: attempt > 1,
      terminal: ok ? "completed" : "infra_failure",
    },
    output: ok ? produced : null,
  };
}

function main(): void {
  const login = spawnSync("codex", ["login", "status"], { encoding: "utf8" });
  const loginStatus = `${login.stdout ?? ""}${login.stderr ?? ""}`.trim();
  if (!/chatgpt/i.test(loginStatus) || /api key/i.test(loginStatus)) {
    throw new Error(`refusing to run: codex must be in ChatGPT auth mode (no API key). Reported: ${loginStatus}`);
  }
  mkdirSync(A_SIDE_ROOT, { recursive: true });
  const manifest = JSON.parse(readFileSync(resolve(POOL_ROOT, "reader-docs-manifest.json"), "utf8")) as {
    manifestSha256: string;
    docs: Array<{ relPath: string; readerDocumentSha256: string }>;
  };
  const schemaPath = resolve(A_SIDE_ROOT, "adjudication-output.schema.json");
  writeFileSync(schemaPath, `${JSON.stringify(OUTPUT_SCHEMA, null, 2)}\n`);

  const repoRoot = resolve(PIPELINE_ROOT, "../../../..");
  const queue = manifest.docs.map((doc) => {
    const bytes = readFileSync(resolve(repoRoot, doc.relPath), "utf8");
    if (sha256(Buffer.from(bytes, "utf8")) !== doc.readerDocumentSha256) {
      throw new Error(`doc bytes drifted from the retained manifest: ${doc.relPath}`);
    }
    const docName = doc.relPath.split("/").pop() ?? doc.relPath;
    return { docName, bytes };
  });
  if (queue.length !== BASE_CAP) throw new Error(`expected ${BASE_CAP} docs, found ${queue.length}`);

  if (process.env.CHAPTERFLOW_A_SIDE_DRY === "1") {
    const sample = taskFor(queue[0].bytes);
    console.log(`[a-side] DRY: ${queue.length} docs verified against manifest ${manifest.manifestSha256.slice(0, 12)}; `
      + `sample task ${sample.length} chars; schema at ${schemaPath}; login: ${loginStatus}. Zero calls made.`);
    return;
  }

  const ledger: LedgerCall[] = [];
  const verdicts: Record<string, unknown> = {};
  let index = 0;
  const worker = (): void => {
    while (index < queue.length) {
      const mine = queue[index]; index += 1;
      // Resume safety: a retained, parseable last-message means this doc's call
      // already completed in an interrupted run — consuming it is NOT a replay;
      // re-calling it would be.
      const retainedPath = resolve(A_SIDE_ROOT, `${mine.docName}.last-message.json`);
      if (existsSync(retainedPath)) {
        try {
          const retained = readFileSync(retainedPath, "utf8").trim();
          verdicts[mine.docName] = JSON.parse(retained);
          console.log(`[a-side] ${mine.docName} — resumed from retained output (no call spent)`);
          continue;
        } catch { /* unparseable partial file → treat as absent and call */ }
      }
      console.log(`[a-side] ${mine.docName} — call ${ledger.length + 1} (base cap ${BASE_CAP})`);
      let { call, output } = runOne(mine.docName, mine.bytes, schemaPath, 1);
      ledger.push(call);
      if (output === null) {
        console.log(`[a-side] ${mine.docName} infra failure (exit=${call.exitCode} timedOut=${call.timedOut}) — one typed replay`);
        const retry = runOne(mine.docName, mine.bytes, schemaPath, 2);
        ledger.push(retry.call);
        output = retry.output;
      }
      if (output === null) throw new Error(`A-side call failed after one infrastructure replay: ${mine.docName}`);
      verdicts[mine.docName] = JSON.parse(output);
      writeFileSync(resolve(A_SIDE_ROOT, "call-ledger.partial.json"), `${JSON.stringify(ledger, null, 2)}\n`);
    }
  };
  // Sequential workers over a shared index; CONCURRENCY kept for documentation —
  // spawnSync blocks per worker, so true parallelism requires separate processes.
  void CONCURRENCY;
  worker();

  const record = {
    schema: "reader-gold-dev-adjudication-run-record-v1",
    adjudicator: "gpt-5.6-sol-a-side",
    model: MODEL,
    effort: EFFORT,
    run: 1,
    judgedDocsManifestSha256: manifest.manifestSha256,
    disposition: "AUTHORITATIVE_A_SIDE",
    policy: "reader-decision-policy-v3",
    codexLoginStatus: loginStatus,
    baseCalls: ledger.filter((c) => c.attempt === 1).length,
    replayCalls: ledger.filter((c) => c.attempt === 2).length,
    apiCalls: 0,
    verdicts,
  };
  writeFileSync(resolve(A_SIDE_ROOT, "a-side-run1.json"), `${JSON.stringify(record, null, 2)}\n`);
  writeFileSync(resolve(A_SIDE_ROOT, "call-ledger.json"), `${JSON.stringify(ledger, null, 2)}\n`);
  console.log(`[a-side] DONE base=${record.baseCalls} replays=${record.replayCalls} → a-side-run1.json`);
}

main();
