import { ExampleOutput } from "../agents/writer-example.js";
import { ExampleSpec, SourceAnchorForPrompt } from "../types.js";
import { extractNamesFromText } from "../librarian/libraryState.js";

export type ExampleScoreContext = {
  spec: ExampleSpec;
  specIndex: number;
  usedNames: string[];
  priorExamples: ExampleOutput[];
  sourceAnchors?: SourceAnchorForPrompt[];
};

export type ExampleCandidateScore = {
  score: number;
  accept: boolean;
  needsMoreCandidates: boolean;
  needsCurator: boolean;
  findings: string[];
};

const BANNED_SCAR_PHRASES = [
  "the chapter",
  "this chapter",
  "the book",
  "the author",
  "boundary condition",
  "keeps the chapter honest",
  "strips away",
  "is not decorative",
  "is not magic",
  "operating logic",
  "diagnostic discipline",
  "durable practice",
  "That matters because",
];

const SCENE_MARKERS = [
  "desk", "counter", "screen", "phone", "email", "spreadsheet", "calendar", "meeting",
  "kitchen", "clinic", "classroom", "office", "table", "form", "notes", "message",
  "manager", "colleague", "client", "student", "nurse", "parent", "friend",
];

const DECISION_MARKERS = [
  "decide", "choice", "choose", "whether", "about to", "faces", "must", "has to", "hover", "instead",
];

const FRICTION_MARKERS = [
  "fails", "failed", "wrong", "mistake", "cost", "misses", "late", "risk", "rework", "awkward",
  "pushback", "relapse", "delay", "conflict", "partial", "stalls", "stuck", "overwhelmed",
];

export function scoreExampleCandidate(
  candidate: ExampleOutput,
  context: ExampleScoreContext,
  thresholds: { acceptScore: number; retryScore: number },
): ExampleCandidateScore {
  const findings: string[] = [];
  let score = 100;

  const title = safe(candidate.title);
  const scenario = safe(candidate.scenario);
  const whatToDo = safe(candidate.whatToDo);
  const whyItMatters = safe(candidate.whyItMatters);
  const all = `${title}\n${scenario}\n${whatToDo}\n${whyItMatters}`;
  const lower = all.toLowerCase();

  if (!title || title.length < 10) penalty("title missing or too short", 8);
  if (scenario.length < 220) penalty("scenario too short to stage a real scene", 16);
  if (scenario.length > 720) penalty("scenario too long", 8);
  if (whatToDo.length < 80) penalty("whatToDo too thin", 8);
  if (whyItMatters.length < 80) penalty("whyItMatters too thin", 8);
  if (all.includes("—")) penalty("contains em dash", 15);

  for (const phrase of BANNED_SCAR_PHRASES) {
    if (lower.includes(phrase.toLowerCase())) penalty(`banned/meta phrase: ${phrase}`, 15);
  }

  const names = extractNamesFromText(`${title}\n${scenario}`)
    .filter((n) => !/^(The|A|An|This|That|What|When|Where|Why|How|If|Then|Now)$/i.test(n));
  const uniqueNames = [...new Set(names)];
  if (uniqueNames.length === 0 && context.spec.format !== "thought_experiment") penalty("no named protagonist", 22);
  if (uniqueNames.length > 2) penalty("too many named people in one example", 10);

  const reused = uniqueNames.filter((n) => context.usedNames.includes(n));
  if (reused.length > 0) penalty(`reuses already-reserved name(s): ${reused.join(", ")}`, 18);

  if (!mentionsAny(scenario, SCENE_MARKERS)) penalty("scenario lacks concrete scene object/place/role", 16);
  if (!mentionsAny(scenario, DECISION_MARKERS) && !formatCanBeObservational(context.spec.format)) {
    penalty("scenario lacks decision or tension marker", 14);
  }

  if (!looselyHitsRequiredBeat(scenario, context.spec.requiredBeat)) penalty("requiredBeat appears under-served", 12);
  if (!looselyHitsDomain(scenario, context.spec.domain)) penalty("domain appears under-served", 10);

  const priorOpeners = context.priorExamples.map((ex) => firstWords(ex.scenario, 4));
  const opener = firstWords(scenario, 4);
  if (opener && priorOpeners.includes(opener)) penalty("repeats prior example opening skeleton", 10);

  if (context.sourceAnchors && context.sourceAnchors.length > 0) {
    const ids = candidate.sourceAnchorIds ?? (candidate.sourceAnchorId ? [candidate.sourceAnchorId] : []);
    const allowed = new Set(context.sourceAnchors.map((a) => a.id));
    if (ids.length === 0) penalty("missing sourceAnchorIds", 18);
    if (ids.some((id) => !allowed.has(id))) penalty("uses sourceAnchorId outside allowed anchors", 20);
  }

  if (context.spec.format === "postmortem" || context.spec.format === "mistake_recovery" || /cost|mistake|failed|recovery/i.test(context.spec.requiredBeat)) {
    if (!mentionsAny(scenario, FRICTION_MARKERS)) penalty("friction slot lacks visible cost/failure/recovery", 12);
  }

  // Keep score bounded and deterministic.
  score = Math.max(0, Math.min(100, score));
  return {
    score,
    accept: score >= thresholds.acceptScore,
    needsMoreCandidates: score < thresholds.retryScore,
    needsCurator: score >= thresholds.retryScore && score < thresholds.acceptScore,
    findings,
  };

  function penalty(message: string, points: number): void {
    findings.push(message);
    score -= points;
  }
}

export function chooseDeterministicExampleWinner(
  scored: Array<{ candidate: ExampleOutput; score: ExampleCandidateScore }>,
  margin: number,
): { winner: ExampleOutput | null; reason: string } {
  const sorted = scored.slice().sort((a, b) => b.score.score - a.score.score);
  const first = sorted[0];
  const second = sorted[1];
  if (!first) return { winner: null, reason: "no candidates" };
  if (!second) return { winner: first.candidate, reason: "only one candidate" };
  const gap = first.score.score - second.score.score;
  if (gap >= margin) {
    return { winner: first.candidate, reason: `deterministic score margin ${gap} >= ${margin}` };
  }
  return { winner: null, reason: `top score margin ${gap} < ${margin}` };
}

function safe(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function mentionsAny(text: string, words: string[]): boolean {
  const lower = text.toLowerCase();
  return words.some((w) => lower.includes(w));
}

function firstWords(text: string, count: number): string {
  return text
    .trim()
    .split(/\s+/)
    .slice(0, count)
    .map((w) => w.toLowerCase().replace(/[^a-z0-9']/g, ""))
    .filter(Boolean)
    .join(" ");
}

function formatCanBeObservational(format: string): boolean {
  return format === "vignette" || format === "reflection" || format === "thought_experiment" || format === "postmortem";
}

function looselyHitsRequiredBeat(scenario: string, beat: string): boolean {
  const beatWords = keywords(beat);
  if (beatWords.length === 0) return true;
  const lower = scenario.toLowerCase();
  const hits = beatWords.filter((w) => lower.includes(w)).length;
  return hits >= Math.min(2, beatWords.length);
}

function looselyHitsDomain(scenario: string, domain: string): boolean {
  const domainWords = keywords(domain);
  if (domainWords.length === 0) return true;
  const lower = scenario.toLowerCase();
  return domainWords.some((w) => lower.includes(w));
}

function keywords(text: string): string[] {
  const stop = new Set(["the", "and", "for", "with", "that", "this", "they", "their", "from", "into", "about", "when", "where", "while", "whether", "because", "before", "after"]);
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 5 && !stop.has(w))
    .slice(0, 8);
}
