import { canonicalJsonSha256, textSha256 } from "../lib/canonicalJson.js";
import { normSlug } from "../lib/chapterPaths.js";
import type { SourceAnchorForPrompt, SourceAnchorKind, SourceClaimType } from "../types.js";
import type { NamedExampleV2, SourceSidecarV2 } from "./sidecarSchema.js";

export type SourceIntegrityFinding = {
  checkId: string;
  /** STRUCTURAL checks (schema / floors / anchor ids) are "blocker" and fail the
   *  sidecar. The REALNESS heuristics (does this look fabricated?) are "advisory":
   *  surfaced but never gating — they are a noisy text-shape guess, and the
   *  authoritative reality check is the operator source-verify record. */
  severity: "blocker" | "advisory";
  chapterNumber?: number;
  message: string;
  evidence?: string;
};

export type RejectedSourceField = {
  path: string;
  reason: string;
  raw: string;
};

export type SourceIntegrityDecision = {
  passed: boolean;
  chapterNumber?: number;
  findings: SourceIntegrityFinding[];
  sidecar: SourceSidecarV2 | null;
  anchors: SourceAnchorForPrompt[];
  semanticHash: string | null;
  rawHash: string | null;
  rejectedFields: RejectedSourceField[];
};

export type SourceIntegrityOptions = {
  chapterNumber?: number;
  chapterTitle?: string;
  rawText?: string;
};

const ABSTRACT_WORDS = new Set(
  "system systems framework frameworks principle principles mindset approach method process model models concept idea ideas factor factors force forces strategy strategies rule rules law laws practice practices habit habits skill skills value values goal goals theory lens cycle loop type level stage step phase pattern better improve improved improvement thing things person people team organization company case example outcome result realistic important useful effective success".split(" "),
);

const PLACEHOLDER_RE = /\b(?:todo|tbd|fixme|placeholder|insert|lorem|ipsum|company\s+[a-z0-9]|person\s+[a-z0-9]|example\s+[a-z0-9]|case\s+[a-z0-9]|organization\s+[a-z0-9]|metric\s+[a-z0-9]|result\s+[a-z0-9]|john\s+doe|jane\s+doe|acme)\b/i;
const CAUSAL_RE = /\b(?:because|since|so that|therefore|which means|leads to|causes|drives|so the|as a result|when|after|before)\b/i;

function finding(args: Omit<SourceIntegrityFinding, "severity"> & { severity?: "blocker" | "advisory" }): SourceIntegrityFinding {
  return { severity: "blocker", ...args };
}

/** Normalize a hard specific (and the prose it should appear in) so a digit /
 *  punctuation / whitespace variant still matches: "May 6 1954" ~ "May 6, 1954",
 *  "3:59.4" ~ prose. Used by the (advisory) supported-specifics realness signal so
 *  natural prose is not punished as fabricated. */
function normalizeSpecific(s: string): string {
  return String(s)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[,.;:!?"'’“”()\[\]]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function nonempty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function chapterPrefix(chapterNumber: number | undefined): string | null {
  return typeof chapterNumber === "number" && Number.isInteger(chapterNumber) && chapterNumber > 0
    ? `ch${String(chapterNumber).padStart(2, "0")}.`
    : null;
}

function placeholderAnchorId(id: string): boolean {
  return (
    /^(anchor|source-anchor|sourceAnchor|id|todo|tbd|fixme|placeholder)([-_:]?\d*)?$/i.test(id.trim()) ||
    /\b(todo|tbd|fixme|placeholder)\b/i.test(id)
  );
}

function words(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9']+/g) ?? [];
}

function contentWords(text: string): string[] {
  return words(text).filter((word) => word.length > 2 && !ABSTRACT_WORDS.has(word));
}

function abstractRatio(text: string): number {
  const all = words(text).filter((word) => word.length > 2);
  if (all.length === 0) return 1;
  return all.filter((word) => ABSTRACT_WORDS.has(word)).length / all.length;
}

function hasConcreteMarker(text: string): boolean {
  return (
    /\b\d[\d,.]*(?:\s?(?:%|percent|million|billion|years?|days?|tickets?|forms?|participants?))?\b/i.test(text) ||
    /\b(?:19|20)\d{2}\b/.test(text) ||
    /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,}\b/.test(text) ||
    /\b[A-Z]{2,}\b/.test(text)
  );
}

function normalizedBoilerplate(text: string): string {
  return words(text)
    .map((word) => (/^\d+$/.test(word) ? "#" : word))
    .filter((word) => word.length > 2)
    .join(" ");
}

function similarity(a: string, b: string): number {
  const aw = contentWords(a);
  if (aw.length === 0) return 0;
  const bs = new Set(contentWords(b));
  return aw.filter((word) => bs.has(word)).length / aw.length;
}

function entitySignalCount(sc: Partial<SourceSidecarV2>): number {
  const signals = new Set<string>();
  const add = (text: unknown) => {
    if (!nonempty(text)) return;
    for (const match of text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b|\b[A-Z]{2,}\b|\b(?:19|20)\d{2}\b|\b\d[\d,.]*(?:\s?(?:%|percent|million|billion|years?|days?|tickets?|forms?|participants?))?\b/g) ?? []) {
      const normalized = match.toLowerCase().trim();
      if (normalized && !ABSTRACT_WORDS.has(normalized)) signals.add(normalized);
    }
  };
  add(sc.centralConcept?.name);
  add(sc.centralConcept?.plainDefinition);
  add(sc.hardEdge);
  add(sc.paraphraseNotes);
  for (const example of Array.isArray(sc.namedExamples) ? sc.namedExamples : []) {
    add((example as NamedExampleV2).label);
    add((example as NamedExampleV2).summary);
    for (const specific of Array.isArray((example as NamedExampleV2).hardSpecifics) ? (example as NamedExampleV2).hardSpecifics : []) add(String(specific));
  }
  for (const fact of Array.isArray(sc.testableFacts) ? sc.testableFacts : []) {
    add((fact as any)?.claim);
    add((fact as any)?.becauseMechanism);
  }
  return signals.size;
}

function checkId(
  id: unknown,
  path: string,
  seen: Map<string, string>,
  expectedPrefix: string | null,
  chapterNumber: number | undefined,
  findings: SourceIntegrityFinding[],
): string | null {
  if (!nonempty(id)) {
    findings.push(finding({ checkId: "SV2.anchor_id_missing", chapterNumber, message: `${path}.id is required.` }));
    return null;
  }
  const value = id.trim();
  if (placeholderAnchorId(value)) {
    findings.push(finding({ checkId: "SV2.anchor_id_placeholder", chapterNumber, message: `${path}.id "${value}" is a placeholder.`, evidence: value }));
  }
  if (expectedPrefix && !value.startsWith(expectedPrefix)) {
    findings.push(finding({ checkId: "SV2.anchor_id_wrong_chapter", chapterNumber, message: `${path}.id "${value}" must start with ${expectedPrefix}.`, evidence: value }));
  }
  const prior = seen.get(value);
  if (prior) {
    findings.push(finding({ checkId: "SV2.anchor_id_duplicate", chapterNumber, message: `${path}.id "${value}" duplicates ${prior}.`, evidence: value }));
  } else {
    seen.set(value, path);
  }
  return value;
}

function defaultClaimTypesFor(kind: SourceAnchorKind): SourceClaimType[] {
  if (kind === "named_example") return ["example", "hook", "breakdown_claim", "memorable_line"];
  if (kind === "testable_fact") {
    return [
      "book_thesis",
      "core_idea",
      "core_move",
      "hook",
      "breakdown_claim",
      "quiz_prompt",
      "quiz_explanation",
      "quiz_key_evidence",
      "review_card",
      "implementation_guidance",
      "takeaway",
      "memorable_line",
    ];
  }
  return [
    "book_thesis",
    "core_idea",
    "core_move",
    "hook",
    "breakdown_claim",
    "review_card",
    "implementation_guidance",
    "takeaway",
    "memorable_line",
  ];
}

export function buildSourceAnchorCatalog(sc: SourceSidecarV2): SourceAnchorForPrompt[] {
  const anchors: SourceAnchorForPrompt[] = [];
  if (sc.centralConcept?.id) {
    anchors.push({
      id: sc.centralConcept.id,
      kind: "concept",
      label: sc.centralConcept.name,
      text: [sc.centralConcept.plainDefinition, sc.centralConcept.whyItMatters].filter(Boolean).join(" "),
      supportsClaimTypes: defaultClaimTypesFor("concept"),
    });
  }
  for (const example of sc.namedExamples ?? []) {
    if (!example?.id) continue;
    anchors.push({
      id: example.id,
      kind: "named_example",
      label: example.label,
      text: [example.summary, example.teachesWhat].filter(Boolean).join(" "),
      hardSpecifics: (example.hardSpecifics ?? []).map(String),
      supportsClaimTypes: defaultClaimTypesFor("named_example"),
    });
  }
  for (const fact of sc.testableFacts ?? []) {
    if (!fact?.id) continue;
    anchors.push({
      id: fact.id,
      kind: "testable_fact",
      label: fact.claim,
      text: [fact.claim, fact.becauseMechanism, fact.commonError, fact.errorIsWhy].filter(Boolean).join(" "),
      supportsClaimTypes: defaultClaimTypesFor("testable_fact"),
    });
  }
  for (const framework of sc.frameworks ?? []) {
    if (!framework?.name) continue;
    const id = `ch${String(sc.chapterNumber).padStart(2, "0")}.framework.${normSlug(framework.name).replace(/-/g, ".")}`;
    anchors.push({
      id,
      kind: "framework",
      label: framework.name,
      text: (framework.members ?? []).join(", "),
      supportsClaimTypes: defaultClaimTypesFor("framework"),
    });
  }
  return anchors;
}

export function semanticSourceHash(value: unknown): string {
  return canonicalJsonSha256(value);
}

export function rawSourceHash(rawText: string): string {
  return textSha256(rawText);
}

export function evaluateSourceV2Integrity(value: unknown, options: SourceIntegrityOptions = {}): SourceIntegrityDecision {
  const findings: SourceIntegrityFinding[] = [];
  const rejectedFields: RejectedSourceField[] = [];
  const rawHash = options.rawText === undefined ? null : rawSourceHash(options.rawText);
  const chapterNumberFromValue = Number((value as any)?.chapterNumber);
  const chapterNumber = Number.isInteger(options.chapterNumber)
    ? options.chapterNumber
    : Number.isInteger(chapterNumberFromValue)
      ? chapterNumberFromValue
      : undefined;
  const expectedPrefix = chapterPrefix(chapterNumber);

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    findings.push(finding({ checkId: "SV2.schema_object", chapterNumber, message: "Source sidecar must be a JSON object." }));
    return { passed: false, chapterNumber, findings, sidecar: null, anchors: [], semanticHash: null, rawHash, rejectedFields };
  }

  const sc = value as Partial<SourceSidecarV2>;
  if (sc.schemaVersion !== "source-v2") {
    findings.push(finding({ checkId: "SV2.not_source_v2", chapterNumber, message: `Sidecar is schemaVersion ${JSON.stringify(sc.schemaVersion)}; expected "source-v2".` }));
  }
  if (typeof sc.chapterNumber !== "number" || !Number.isInteger(sc.chapterNumber) || sc.chapterNumber <= 0) {
    findings.push(finding({ checkId: "SV2.chapter_number_missing", chapterNumber, message: "chapterNumber must be a positive integer." }));
  } else if (options.chapterNumber !== undefined && sc.chapterNumber !== options.chapterNumber) {
    findings.push(finding({ checkId: "SV2.chapter_number_mismatch", chapterNumber: options.chapterNumber, message: `Sidecar chapterNumber ${sc.chapterNumber} does not match expected chapter ${options.chapterNumber}.` }));
  }
  if (options.chapterTitle && nonempty(sc.chapterTitle) && sc.chapterTitle.trim() !== options.chapterTitle.trim()) {
    findings.push(finding({ checkId: "SV2.chapter_title_mismatch", chapterNumber, message: `Sidecar title ${JSON.stringify(sc.chapterTitle)} does not match canonical title ${JSON.stringify(options.chapterTitle)}.` }));
  }
  if (!nonempty(sc.chapterTitle)) {
    findings.push(finding({ checkId: "SV2.chapter_title_missing", chapterNumber, message: "chapterTitle is required." }));
  }

  const seen = new Map<string, string>();
  const knownIds = new Set<string>();

  if (!sc.centralConcept || typeof sc.centralConcept !== "object") {
    findings.push(finding({ checkId: "SV2.central_concept_missing", chapterNumber, message: "centralConcept is required." }));
  } else {
    const id = checkId(sc.centralConcept.id, "centralConcept", seen, expectedPrefix, chapterNumber, findings);
    if (id) knownIds.add(id);
    if (!nonempty(sc.centralConcept.name)) findings.push(finding({ checkId: "SV2.central_concept_missing", chapterNumber, message: "centralConcept.name is required." }));
    if (!nonempty(sc.centralConcept.plainDefinition)) findings.push(finding({ checkId: "SV2.central_concept_missing", chapterNumber, message: "centralConcept.plainDefinition is required." }));
  }

  const keyClaims = Array.isArray(sc.keyClaims) ? sc.keyClaims.filter(nonempty) : [];
  if (keyClaims.length < 1) {
    findings.push(finding({ checkId: "SV2.key_claims_missing", chapterNumber, message: "keyClaims must include at least one non-empty claim." }));
  }

  const namedExamples = Array.isArray(sc.namedExamples) ? sc.namedExamples : [];
  if (namedExamples.length < 3) {
    findings.push(finding({ checkId: "SV2.named_examples_floor", chapterNumber, message: `namedExamples has ${namedExamples.length}; need at least 3.` }));
  }
  namedExamples.forEach((example, i) => {
    const path = `namedExamples[${i}]`;
    const id = checkId((example as any)?.id, path, seen, expectedPrefix, chapterNumber, findings);
    if (id) knownIds.add(id);
    if (!nonempty((example as any)?.label)) findings.push(finding({ checkId: "SV2.named_example_missing_field", chapterNumber, message: `${path}.label is required.` }));
    if (!nonempty((example as any)?.summary)) findings.push(finding({ checkId: "SV2.named_example_missing_field", chapterNumber, message: `${path}.summary is required.` }));
    const specifics = Array.isArray((example as any)?.hardSpecifics) ? (example as any).hardSpecifics.filter(nonempty) : [];
    if (specifics.length < 2) {
      findings.push(finding({ checkId: "SV2.hard_specifics_floor", chapterNumber, message: `${path}.hardSpecifics has ${specifics.length}; need at least 2.` }));
    }
  });

  const facts = Array.isArray(sc.testableFacts) ? sc.testableFacts : [];
  if (facts.length < 9) {
    findings.push(finding({ checkId: "SV2.testable_facts_floor", chapterNumber, message: `testableFacts has ${facts.length}; need at least 9.` }));
  }
  facts.forEach((fact, i) => {
    const path = `testableFacts[${i}]`;
    const id = checkId((fact as any)?.id, path, seen, expectedPrefix, chapterNumber, findings);
    if (id) knownIds.add(id);
    for (const key of ["claim", "becauseMechanism", "commonError", "errorIsWhy"] as const) {
      if (!nonempty((fact as any)?.[key])) {
        findings.push(finding({ checkId: "SV2.testable_fact_missing_field", chapterNumber, message: `${path}.${key} is required.` }));
      }
    }
  });
  facts.forEach((fact, i) => {
    const derivedFrom = (fact as any)?.derivedFrom;
    if (derivedFrom !== undefined && nonempty(derivedFrom) && !knownIds.has(derivedFrom.trim())) {
      findings.push(finding({ checkId: "SV2.anchor_reference_unknown", chapterNumber, message: `testableFacts[${i}].derivedFrom cites unknown source anchor ${JSON.stringify(derivedFrom)}.`, evidence: derivedFrom }));
    }
  });

  findings.push(...realnessFindings(sc, chapterNumber, rejectedFields));

  // `passed` reflects BLOCKER findings only (the structural checks). The realness
  // heuristics are advisory, so a sidecar that is structurally complete but trips a
  // noisy realness signal is still usable — it is surfaced, never gated.
  const structurallyValid = !findings.some((f) => f.severity === "blocker");
  const sidecar = structurallyValid ? value as SourceSidecarV2 : null;
  return {
    passed: structurallyValid,
    chapterNumber,
    findings,
    sidecar,
    anchors: sidecar ? buildSourceAnchorCatalog(sidecar) : [],
    semanticHash: semanticSourceHash(value),
    rawHash,
    rejectedFields,
  };
}

function realnessFindings(
  sc: Partial<SourceSidecarV2>,
  chapterNumber: number | undefined,
  rejectedFields: RejectedSourceField[],
): SourceIntegrityFinding[] {
  const findings: SourceIntegrityFinding[] = [];
  const facts = Array.isArray(sc.testableFacts) ? sc.testableFacts : [];
  const examples = Array.isArray(sc.namedExamples) ? sc.namedExamples : [];
  const placeholderExamples: string[] = [];
  const unsupportedExamples: string[] = [];
  const nonTestableFacts: string[] = [];

  examples.forEach((example, i) => {
    const label = String((example as any)?.label ?? "");
    const summary = String((example as any)?.summary ?? "");
    const specifics: string[] = Array.isArray((example as any)?.hardSpecifics) ? (example as any).hardSpecifics.map(String) : [];
    if (PLACEHOLDER_RE.test(label) || /^generic\s+case\b/i.test(label) || /^organization\s+\d+$/i.test(label)) {
      placeholderExamples.push(`namedExamples[${i}] ${JSON.stringify(label)}`);
      rejectedFields.push({ path: `namedExamples[${i}].label`, reason: "placeholder-looking named example", raw: label });
    }
    const specificText = specifics.join(" ");
    const concreteSpecifics = specifics.filter((specific) => hasConcreteMarker(specific) || contentWords(specific).length >= 2);
    const summaryNorm = normalizeSpecific(summary);
    const notesNorm = normalizeSpecific(String(sc.paraphraseNotes ?? ""));
    const supportedSpecifics = specifics.filter((specific) => {
      const norm = normalizeSpecific(specific);
      return norm.length > 0 && (summaryNorm.includes(norm) || notesNorm.includes(norm));
    });
    if ((example as any)?.realWorld !== false && (concreteSpecifics.length < 2 || supportedSpecifics.length < Math.min(2, specifics.length))) {
      unsupportedExamples.push(`namedExamples[${i}] ${JSON.stringify(label)}`);
      rejectedFields.push({ path: `namedExamples[${i}].hardSpecifics`, reason: "real-world example has unsupported or generic specifics", raw: specificText });
    }
  });

  facts.forEach((fact, i) => {
    const claim = String((fact as any)?.claim ?? "");
    const mechanism = String((fact as any)?.becauseMechanism ?? "");
    const commonError = String((fact as any)?.commonError ?? "");
    const claimLooksGeneric = !hasConcreteMarker(claim) && (abstractRatio(claim) >= 0.35 || contentWords(claim).length < 5);
    if (claimLooksGeneric || !CAUSAL_RE.test(mechanism) || similarity(claim, commonError) >= 0.75) {
      nonTestableFacts.push(`testableFacts[${i}]`);
      rejectedFields.push({ path: `testableFacts[${i}]`, reason: "fact is generic, non-causal, or echoes its commonError", raw: claim });
    }
  });

  const boilerplateBuckets = new Map<string, number>();
  for (const text of [
    ...facts.map((fact) => String((fact as any)?.claim ?? "")),
    ...facts.map((fact) => String((fact as any)?.becauseMechanism ?? "")),
    ...examples.map((example) => String((example as any)?.summary ?? "")),
  ]) {
    const norm = normalizedBoilerplate(text);
    if (!norm) continue;
    boilerplateBuckets.set(norm, (boilerplateBuckets.get(norm) ?? 0) + 1);
  }
  const repeated = [...boilerplateBuckets.entries()].filter(([, count]) => count >= 3);

  if (placeholderExamples.length > 0) {
    findings.push(finding({
      checkId: "SV2.realness_placeholder_example",
      severity: "advisory",
      chapterNumber,
      message: `Named examples look like placeholders rather than source evidence: ${placeholderExamples.slice(0, 3).join("; ")}.`,
      evidence: placeholderExamples[0],
    }));
  }
  if (nonTestableFacts.length > 0) {
    findings.push(finding({
      checkId: "SV2.realness_non_testable_fact",
      severity: "advisory",
      chapterNumber,
      message: `${nonTestableFacts.length} testable fact(s) are generic, non-causal, or echo their commonError.`,
      evidence: nonTestableFacts.slice(0, 3).join(", "),
    }));
  }
  if (unsupportedExamples.length > 0) {
    findings.push(finding({
      checkId: "SV2.realness_unsupported_entity",
      severity: "advisory",
      chapterNumber,
      message: `Real-world named examples lack supported concrete specifics: ${unsupportedExamples.slice(0, 3).join("; ")}.`,
      evidence: unsupportedExamples[0],
    }));
  }
  if (repeated.length > 0) {
    findings.push(finding({
      checkId: "SV2.realness_repeated_boilerplate",
      severity: "advisory",
      chapterNumber,
      message: `Source sidecar repeats boilerplate source text ${repeated.length} time(s); facts and examples must be independently specific.`,
      evidence: repeated[0][0].slice(0, 120),
    }));
  }
  if (entitySignalCount(sc) < 5 || (placeholderExamples.length > 0 && nonTestableFacts.length >= 3) || (unsupportedExamples.length >= 2 && repeated.length > 0)) {
    findings.push(finding({
      checkId: "SV2.realness_concept_only",
      severity: "advisory",
      chapterNumber,
      message: "Source sidecar does not contain enough concrete entities, dates, numbers, or verifiable specifics to ground authoring.",
    }));
  }
  if ((placeholderExamples.length > 0 ? 1 : 0) + (nonTestableFacts.length >= 3 ? 1 : 0) + (unsupportedExamples.length >= 2 ? 1 : 0) + (repeated.length > 0 ? 1 : 0) >= 2) {
    findings.push(finding({
      checkId: "SV2.realness_fabricated_sidecar",
      severity: "advisory",
      chapterNumber,
      message: "Structurally complete sidecar has multiple fabricated-source signals: placeholders, unsupported examples, non-testable facts, or boilerplate repetition.",
    }));
  }

  return findings;
}
