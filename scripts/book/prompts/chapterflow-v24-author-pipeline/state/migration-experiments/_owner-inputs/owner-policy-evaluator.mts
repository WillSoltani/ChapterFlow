/**
 * §16 OWNER-POLICY EVALUATOR — sealed extension gate (v1, frozen pre-live).
 *
 * Enforces the owner-frozen bounds the native ThresholdsV1 schema cannot
 * express, STRICTLY ADDITIVELY: a SOL profile's final recommendation is
 *   native decision (SOL BAKEOFF RESULT line)  ∧  every verdict below.
 * Nothing here relaxes any native gate; failure directions follow
 * C5_ECONOMICS/frozen-economics-bounds.json (sha ee4d0f42…) and
 * C4_THRESHOLDS/frozen-owner-thresholds.json (sha f38d839e…) from the owner
 * package (zip sha 96ff9e3d…5b273f).
 *
 * Usage (read-only over a completed experiment root; run from the PIPE dir):
 *   npx tsx state/migration-experiments/_owner-inputs/owner-policy-evaluator.mts \
 *     state/migration-experiments/<experimentId>
 *
 * Emits owner-policy-verdicts.json NEXT TO this file's output dir argument
 * only when --write is passed; default prints to stdout (decide-time artifact).
 *
 * Counting rules (frozen):
 *  - Writer invocations per sample = 1 + (outcome.replayed ? 1 : 0).
 *  - Review invocations per sample = 1 (primary) + (agreementReview ? 1 : 0);
 *    internal bounded reader retries are not separately observable in the
 *    record schema and are counted by their cap (2) ONLY in the sealed
 *    MAXIMUM envelope, never in measured ratios (conservative direction:
 *    measured ratios may undercount equally across cells; all cells share the
 *    identical instrument, so ratios remain cell-comparable).
 *  - acceptedChapter(cell) = samples with review.pass === true, deduped by
 *    (bookId, chapterNumber) — a chapter is accepted if ANY of its samples
 *    passed review (per-accepted-chapter denominators use chapters, matching
 *    C5 metric definitions).
 *  - activeWallClock per sample = outcome.durationMs (+ review durations are
 *    not in the record schema; wall-clock ratio uses author durations —
 *    identical instrument across cells; disclosed).
 *  - operationalFailure combined = samples whose providerOutcome ∈
 *    {timeout} or content_invalid with malformed/truncation marker or
 *    policy_preflight_failure, divided by attempted samples.
 *    safeguard/refusal and provider_rate_or_capacity are EXCLUDED here and
 *    reported separately (C5.operationalFailure + planCapacity).
 *  - Zero-accepted rule: a SOL cell with 0 accepted chapters FAILS C5.
 */
import { readFileSync, readdirSync, existsSync, writeFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type Rec = {
  cellId: string; bookId: string; chapterNumber: number; sampleIndex: number;
  outcome: { providerOutcome: string; replayed?: boolean; originalProviderOutcome?: string; firstWriteDeterministicPass: boolean; durationMs?: number };
  review?: { pass?: boolean; valid?: boolean } | null;
  agreementReview?: unknown | null;
};

const BOUNDS = {
  baselineCell: "55-XH",
  solHigh: { cell: "56S-H", invocationsMult: 1.15, wallClockMult: 1.3, p95Mult: 1.3 },
  solXhigh: { cell: "56S-XH", invocationsMult: 1.25, wallClockMult: 1.75, p95Mult: 2.0 },
  opFailure: { maxCombinedRate: 0.02, maxAbsIncreaseVs55XHpp: 1.0 },
  capacity: { maxUnhandledEvents: 0 },
} as const;

const root = resolve(process.argv[2] ?? "");
if (!root || !existsSync(root)) { console.error("usage: owner-policy-evaluator.mts <experiment-root> [--write]"); process.exit(2); }
const recordsDir = join(root, "records");
const recs: Rec[] = existsSync(recordsDir)
  ? readdirSync(recordsDir).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(join(recordsDir, f), "utf8")) as Rec)
  : [];
if (recs.length === 0) { console.error(`no records under ${recordsDir} — run after the review phase`); process.exit(2); }

function pct(n: number): number { return Math.round(n * 10000) / 100; }
function p95(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil(0.95 * s.length) - 1)];
}
type CellAgg = {
  attempted: number; writerInvocations: number; reviewInvocations: number;
  acceptedChapters: Set<string>; chapters: Set<string>;
  durations: number[]; wallClockTotal: number;
  opFailures: number; capacityEvents: number; safeguard: number;
};
const cells = new Map<string, CellAgg>();
for (const r of recs) {
  const c = cells.get(r.cellId) ?? { attempted: 0, writerInvocations: 0, reviewInvocations: 0, acceptedChapters: new Set(), chapters: new Set(), durations: [], wallClockTotal: 0, opFailures: 0, capacityEvents: 0, safeguard: 0 };
  c.attempted++;
  c.writerInvocations += 1 + (r.outcome.replayed ? 1 : 0);
  c.reviewInvocations += (r.review ? 1 : 0) + (r.agreementReview ? 1 : 0);
  const key = `${r.bookId}::ch${String(r.chapterNumber).padStart(2, "0")}`;
  c.chapters.add(key);
  if (r.review && (r.review as { pass?: boolean }).pass === true) c.acceptedChapters.add(key);
  if (typeof r.outcome.durationMs === "number") { c.durations.push(r.outcome.durationMs); c.wallClockTotal += r.outcome.durationMs; }
  const po = r.outcome.providerOutcome;
  const opFail = po === "timeout" || po === "policy_preflight_failure" || po === "content_invalid";
  const cap = po === "provider_rate_or_capacity" || r.outcome.originalProviderOutcome === "provider_rate_or_capacity";
  if (po === "provider_safeguard_or_refusal") c.safeguard++;
  else if (cap) c.capacityEvents++;
  else if (opFail) c.opFailures++;
  cells.set(r.cellId, c);
}
type CellStats = { invPerAccepted: number | null; wallPerAcceptedMs: number | null; p95Ms: number | null; opFailRate: number; capacityEvents: number; accepted: number; attempted: number };
const stats = new Map<string, CellStats>();
for (const [cid, c] of cells) {
  const acc = c.acceptedChapters.size;
  stats.set(cid, {
    invPerAccepted: acc > 0 ? (c.writerInvocations + c.reviewInvocations) / acc : null,
    wallPerAcceptedMs: acc > 0 ? c.wallClockTotal / acc : null,
    p95Ms: p95(c.durations),
    opFailRate: c.attempted > 0 ? c.opFailures / c.attempted : 0,
    capacityEvents: c.capacityEvents,
    accepted: acc, attempted: c.attempted,
  });
}
const base = stats.get(BOUNDS.baselineCell);
const verdicts: Array<{ id: string; cell: string; pass: boolean | null; detail: string }> = [];
function ratioVerdict(id: string, cell: string, num: number | null, den: number | null | undefined, maxMult: number, what: string): void {
  if (num === null || den === null || den === undefined || den === 0) {
    verdicts.push({ id, cell, pass: num === null ? false : null, detail: num === null ? `${what}: cell has zero accepted chapters or no telemetry — C5 zero-accepted/missing-telemetry rule ⇒ FAIL/INCONCLUSIVE` : `${what}: baseline telemetry missing ⇒ INCONCLUSIVE` });
    return;
  }
  const mult = num / den;
  verdicts.push({ id, cell, pass: mult <= maxMult, detail: `${what}: ${mult.toFixed(3)}× vs 55-XH (bound ≤${maxMult}×)` });
}
for (const solKey of ["solHigh", "solXhigh"] as const) {
  const b = BOUNDS[solKey]; const s = stats.get(b.cell);
  if (!s) { verdicts.push({ id: `${solKey}.present`, cell: b.cell, pass: null, detail: "cell absent from records" }); continue; }
  if (s.accepted === 0) verdicts.push({ id: `${solKey}.zeroAccepted`, cell: b.cell, pass: false, detail: "zero accepted chapters — cannot qualify through C5" });
  ratioVerdict(`${solKey}.invocationsPerAccepted`, b.cell, s.invPerAccepted, base?.invPerAccepted, b.invocationsMult, "model invocations / accepted chapter");
  ratioVerdict(`${solKey}.wallClockPerAccepted`, b.cell, s.wallPerAcceptedMs, base?.wallPerAcceptedMs, b.wallClockMult, "active wall-clock / accepted chapter");
  ratioVerdict(`${solKey}.p95Latency`, b.cell, s.p95Ms, base?.p95Ms, b.p95Mult, "p95 invocation latency");
  const opPass = s.opFailRate <= BOUNDS.opFailure.maxCombinedRate && (base ? (s.opFailRate - base.opFailRate) * 100 <= BOUNDS.opFailure.maxAbsIncreaseVs55XHpp : true);
  verdicts.push({ id: `${solKey}.operationalFailure`, cell: b.cell, pass: opPass, detail: `combined op-failure ${pct(s.opFailRate)}% (bound ≤2%, ≤ +1.0pp vs 55-XH ${base ? pct(base.opFailRate) + "%" : "n/a"})` });
}
const capTotal = [...cells.values()].reduce((a, c) => a + c.capacityEvents, 0);
const capByCell = Object.fromEntries([...stats].map(([k, v]) => [k, v.capacityEvents]));
const capSpread = Math.max(...Object.values(capByCell)) - Math.min(...Object.values(capByCell));
verdicts.push({ id: "fairness.capacityExposure", cell: "*", pass: capSpread === 0 ? true : null, detail: `capacity events by cell ${JSON.stringify(capByCell)} — nonzero spread ⇒ operational comparison INCONCLUSIVE unless balanced (C5.quotaOrRateLimitHandling)` });

// ── Stage-Q dual-layer conjunction (B1 condition 4, owner ratification 2026-07-11) ──
// A judge qualifies ONLY as Layer-O pass (owner 64-case instrument, C4 bounds)
// ∧ Layer-N pass (native corpus gate, human-ratified labels). The SEED-*
// compatibility fixtures live in Layer N only and can never rescue a judge
// that failed the owner primary gate. Missing evidence on either layer is a
// FAIL here, never a skip.
{
  const oiDir = dirname(fileURLToPath(import.meta.url));
  const layerOSummaryPath = join(oiDir, "stage-q", "layer-o-results", "layer-o-summary.json");
  const layerO = existsSync(layerOSummaryPath)
    ? JSON.parse(readFileSync(layerOSummaryPath, "utf8")) as { judges: Array<{ judge: string; passes: boolean }>; panelKappaPass: boolean }
    : null;
  const specSealedPath = join(root, "spec.sealed.json");
  const panel: Array<{ model: string; effort: string }> = existsSync(specSealedPath)
    ? (JSON.parse(readFileSync(specSealedPath, "utf8")) as { judgePanel: Array<{ model: string; effort: string }> }).judgePanel
    : [];
  if (panel.length === 0) {
    verdicts.push({ id: "stageQ.panel", cell: "*", pass: false, detail: "no judgePanel readable from spec.sealed.json — cannot verify the dual-layer conjunction" });
  }
  for (const j of panel) {
    const key = `${j.model}@${j.effort}`;
    const o = layerO?.judges.find((x) => x.judge === key);
    const layerOPass = layerO !== null && o !== undefined && o.passes === true && layerO.panelKappaPass === true;
    verdicts.push({
      id: `stageQ.layerO.${key}`, cell: "*", pass: layerOPass,
      detail: layerO === null ? "layer-o-summary.json missing — owner 64-case primary gate has no evidence (fail-closed)"
        : o === undefined ? "judge absent from Layer-O summary (fail-closed)"
        : `owner-instrument pass=${o.passes}, panelKappaPass=${layerO.panelKappaPass}`,
    });
    // Mirrors bakeoff/paths.ts modelSlug exactly (lowercase → collapse → trim).
    const slug = j.model.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    const qualPath = join(root, "qualification", `${slug}-${j.effort}.qualification.json`);
    const q = existsSync(qualPath) ? JSON.parse(readFileSync(qualPath, "utf8")) as { qualified: boolean; dryRunOnly: boolean } : null;
    verdicts.push({
      id: `stageQ.layerN.${key}`, cell: "*", pass: q !== null && q.qualified === true && q.dryRunOnly === false,
      detail: q === null ? `no native qualification record at ${qualPath} (fail-closed)` : `native qualified=${q.qualified}, dryRunOnly=${q.dryRunOnly} (must be qualified on human-ratified labels)`,
    });
  }
}
const out = {
  schema: "s16-owner-policy-verdicts-v1",
  experimentRoot: root,
  boundsSource: "C4 f38d839e… + C5 ee4d0f42… (owner package 96ff9e3d…5b273f)",
  apiEconomics: "NOT_APPLICABLE — CHATGPT_MAX_SUBSCRIPTION; no cost estimation performed; tokens honest-null",
  cellStats: Object.fromEntries([...stats].map(([k, v]) => [k, { ...v, invPerAccepted: v.invPerAccepted && Math.round(v.invPerAccepted * 1000) / 1000, wallPerAcceptedMs: v.wallPerAcceptedMs && Math.round(v.wallPerAcceptedMs) }])),
  capacityEventsTotal: capTotal,
  verdicts,
  // Per-cell pass now ALSO requires every panel-wide (*) verdict: the Stage-Q
  // dual-layer conjunction and capacity fairness are blocking for both SOL
  // cells (strictly additive — never relaxes a per-cell verdict).
  ownerPolicyPass: Object.fromEntries((["56S-H", "56S-XH"] as const).map((cell) => [cell, verdicts.filter((v) => v.cell === cell || v.cell === "*").every((v) => v.pass === true)])),
  note: "Preference between qualified profiles (C4.highVsXhighPreference: default 56S-H; xhigh only on the three enumerated conditions with no safety regression and C5 pass) is applied over the native decision file at decide time; this file carries the C5 half of that conjunction.",
};
const json = JSON.stringify(out, null, 2) + "\n";
if (process.argv.includes("--write")) { writeFileSync(join(root, "owner-policy-verdicts.json"), json); console.log(`wrote ${join(root, "owner-policy-verdicts.json")}`); }
else console.log(json);
