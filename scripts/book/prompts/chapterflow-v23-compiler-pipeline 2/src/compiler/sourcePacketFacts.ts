import type { SourcePacketFact } from "../artifacts/artifactTypes.js";
import type { SourceClaimType } from "../types.js";

/**
 * The v23 blueprint always reserves exactly this many quiz slots
 * (chapterBlueprint.ts quizCount, currently 9). If quizCount ever changes,
 * this constant must change with it — both the source prewrite gate
 * (src/qc/sourceV2Gate.ts) and the packet gate (src/compiler/sourcePacketGate.ts,
 * SP13 via sourcePacket.ts sourceQuality.status) read this single constant so
 * they can never drift out of sync with each other or with the blueprint.
 */
export const REQUIRED_QUIZ_FACT_FLOOR = 9;

const CLAIM_TYPES: SourceClaimType[] = ["core_move", "breakdown_claim", "example", "quiz_prompt", "quiz_key_evidence", "quiz_explanation", "review_card", "implementation_guidance", "takeaway"];

const NUMBER_WORDS: Record<string, string> = {
  zero: "0", one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9", ten: "10",
  eleven: "11", twelve: "12", thirteen: "13", fourteen: "14", fifteen: "15", sixteen: "16", seventeen: "17", eighteen: "18", nineteen: "19", twenty: "20",
  thirty: "30", forty: "40", fifty: "50", sixty: "60", seventy: "70", eighty: "80", ninety: "90", hundred: "100", thousand: "1000", million: "1000000",
};

export function uniq(values: Iterable<string>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    const v = raw.trim();
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

export function extractGroundedNumbers(text: string): string[] {
  const numbers = new Set<string>();
  for (const m of text.matchAll(/\b\d+(?:[.,]\d+)?\b/g)) numbers.add(m[0].replace(/,/g, ""));
  for (const m of text.toLowerCase().matchAll(/\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million)\b/g)) {
    numbers.add(NUMBER_WORDS[m[1]] ?? m[1]);
  }
  return [...numbers].sort((a, b) => Number(a) - Number(b));
}

export function properNounTokens(text: string): string[] {
  const stop = new Set(["The", "A", "An", "If", "When", "Because", "This", "That", "Chapter", "Book"]);
  const out: string[] = [];
  for (const m of text.matchAll(/\b[A-Z][A-Za-z0-9&.'-]*(?:\s+[A-Z][A-Za-z0-9&.'-]*){0,4}\b/g)) {
    const token = m[0].trim();
    if (token.length < 3 || stop.has(token)) continue;
    out.push(token);
  }
  return uniq(out).slice(0, 80);
}

export function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizedFact(raw: any, fallbackId: string): SourcePacketFact | null {
  const id = asText(raw?.id) || fallbackId;
  const claim = asText(raw?.claim);
  if (!claim) return null;
  const mechanism = asText(raw?.becauseMechanism) || asText(raw?.mechanism) || "This fact supplies the source-grounded reason the chapter can teach the move.";
  const commonError = asText(raw?.commonError) || "The reader treats the claim as a vague slogan instead of applying the mechanism.";
  const whyWrong = asText(raw?.errorIsWhy) || asText(raw?.whyWrong) || "The mechanism, not the slogan, is what makes the lesson transfer.";
  const text = [claim, mechanism, commonError, whyWrong].join(" ");
  return {
    id,
    claim,
    mechanism,
    commonError,
    whyWrong,
    allowedClaimTypes: CLAIM_TYPES,
    groundedNumbers: extractGroundedNumbers(text),
    groundedEntities: properNounTokens(text),
    groundedPlaces: [],
    verificationRefs: [id],
    replicationStatus: raw?.replicationStatus,
  };
}

/**
 * Derives the same authoring-ready facts the source packet compiler produces,
 * so any caller that needs to know "how many usable facts will this sidecar
 * compile to" (e.g. the source prewrite gate) counts identically to
 * compileSourcePacketFromSidecar. Malformed testableFacts entries (no claim)
 * are dropped here exactly as they are at compile time — do not count
 * `testableFacts.length` as a substitute.
 */
export function compiledFactsFromSidecar(sidecar: any, chapterNumber: number): SourcePacketFact[] {
  return (Array.isArray(sidecar?.testableFacts) ? sidecar.testableFacts : [])
    .map((f: any, i: number) => normalizedFact(f, `ch${String(chapterNumber).padStart(2, "0")}.fact.${i + 1}`))
    .filter((f: SourcePacketFact | null): f is SourcePacketFact => !!f);
}
