/**
 * WS-4 — source REALITY verification (sidecar-vs-reality).
 *
 * check-source/SC10 validate that a sidecar is STRUCTURALLY grounded (≥9 testable
 * facts, ≥2 real named entities, causal mechanisms). They CANNOT tell a real named
 * case from a plausible-but-invented one: a thin or script-generated sidecar whose
 * figures and numbers were never checked against a source passes clean. That is the
 * digital-minimalism failure — the sidecars validated 0/0/0, then a writer invented a
 * real person's scene + direct quote because the underlying research was never
 * verified, and only a downstream factual-accuracy CORRUPTION caught it (and only
 * because the invention went BEYOND the sidecar; a chapter faithfully reproducing a
 * wrong sidecar fact would have shipped).
 *
 * The pipeline is no-API, so the CLI cannot do the web check itself. This module EMITS
 * an operator-side verification packet: every named case and testable fact, each with a
 * claim-by-claim + entity-existence + URL-liveness checklist (the RAGAS-faithfulness /
 * Wayback-liveness methods, operator-driven), plus a JSON record skeleton to fill. A
 * web-enabled reviewer confirms each item against a REAL source before the book is
 * written FROM it. Source-against-reality is checked here; output-against-source stays
 * the job of the factual-accuracy axis downstream.
 */

import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const PIPELINE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/** Canonical location of a book's FILLED verification record/packet. `source-verify`
 *  emits here and `source-verify-check` / the publish gate read here, so emit↔check
 *  agree by construction. */
export function sourceVerifyRecordPath(bookId: string): string {
  return resolve(PIPELINE_DIR, ".chapterflow", `source-verify-${bookId}.md`);
}

export type SourceVerifyItem = {
  chapterNumber: number;
  kind: "named_example" | "testable_fact";
  id: string;
  claim: string;
  detail: string;
};

export type SourceVerifyFinding = {
  checkId: "SV1" | "SV2" | "SV3" | "SV4" | "SV5";
  severity: "blocker" | "advisory";
  chapterNumber?: number;
  message: string;
};

export type SourceVerifyRecord = {
  schemaVersion?: string;
  bookId?: string;
  chapters?: Array<{ chapterNumber: number; items?: Array<{ id: string; kind?: string; verdict?: string; sourceRef?: string; note?: string }> }>;
};

/** Pull the verifiable, real-world assertions out of one chapter's sidecar. */
export function verifiableItems(sc: any): SourceVerifyItem[] {
  const chapterNumber = Number(sc?.chapterNumber ?? sc?.number ?? 0);
  const items: SourceVerifyItem[] = [];
  const namedExamples = Array.isArray(sc?.namedExamples) ? sc.namedExamples : [];
  for (let i = 0; i < namedExamples.length; i++) {
    const ex = namedExamples[i];
    // Only real-world named cases need a reality check; a clearly fictional
    // illustration (realWorld === false) is the writer's to invent, not research's.
    if (ex?.realWorld === false) continue;
    const hard = Array.isArray(ex?.hardSpecifics) ? ex.hardSpecifics : [];
    items.push({
      chapterNumber,
      kind: "named_example",
      // Unique-by-construction id so two id-less, label-less named examples can't collapse
      // to one record entry (which would let SV1 coverage / SV2/SV3 checks skip one).
      id: String(ex?.id ?? ex?.label ?? `named-example.${chapterNumber}.${i}`),
      claim: String(ex?.label ?? ex?.summary ?? "").trim(),
      detail: `hardSpecifics: ${hard.length ? hard.join(" · ") : "(none — a named case with no concrete specifics cannot be verified)"}`,
    });
  }
  const testableFacts = Array.isArray(sc?.testableFacts) ? sc.testableFacts : [];
  for (let i = 0; i < testableFacts.length; i++) {
    const f = testableFacts[i];
    items.push({
      chapterNumber,
      kind: "testable_fact",
      // Unique-by-construction id (matching the named-example fallback) so two id-less
      // facts can't collapse to one record entry and slip SV1 coverage / SV2/SV3 checks.
      // sourceV2Gate requires fact ids today, but this function must not depend on that.
      id: String(f?.id ?? `fact.${chapterNumber}.${i}`),
      claim: String(f?.claim ?? "").trim(),
      detail: `derivedFrom: ${f?.derivedFrom ? String(f.derivedFrom) : "(none — fact has no provenance pointer)"}`,
    });
  }
  return items;
}

/** The operator verification packet (markdown) for a whole book's sidecars. */
export function buildSourceVerificationPacket(bookId: string, sidecars: any[]): string {
  const L: string[] = [];
  L.push(`# Source reality-verification — ${bookId}`);
  L.push("");
  L.push("You are a FRESH, web-enabled fact-checker. The sidecars below are the GROUND TRUTH the");
  L.push("book will be written FROM — every later gate trusts them, and none of them re-checks");
  L.push("whether the sidecar itself is TRUE. Verify each item AGAINST A REAL SOURCE before the");
  L.push("writer authors from it. Structural validity (check-source) is NOT enough: a plausible");
  L.push("invented figure, a misattributed quote, or a wrong number passes every downstream gate.");
  L.push("");
  L.push("For each item: confirm the named case / claim is REAL and accurately represented —");
  L.push("the figure exists, the hardSpecifics (dates, places, numbers, quotes) match a real");
  L.push("source, and the claim is genuinely supported (not the model's invention). Then record a");
  L.push("verdict per item:");
  L.push("  - VERIFIED — found in a real source you cite (title + URL/locator).");
  L.push("  - UNVERIFIABLE — you could not find a source; the writer must NOT stage it as real.");
  L.push("  - WRONG — the source contradicts the sidecar (drifted date/quote/number/attribution).");
  L.push("If you cite a URL, confirm it RESOLVES (and has a Wayback snapshot) — a non-resolving");
  L.push("URL with no archive likely never existed. Any UNVERIFIABLE/WRONG item is a research");
  L.push("defect: fix the sidecar (or cut the case) before the write handoff — do not leave it for");
  L.push("the writer to paper over.");
  L.push("");

  const byChapter = new Map<number, SourceVerifyItem[]>();
  for (const sc of sidecars) {
    for (const item of verifiableItems(sc)) {
      const arr = byChapter.get(item.chapterNumber) ?? [];
      arr.push(item);
      byChapter.set(item.chapterNumber, arr);
    }
  }
  const record: Array<{ chapterNumber: number; items: Array<{ id: string; kind: string; verdict: string; sourceRef: string; note: string }> }> = [];
  for (const chapterNumber of [...byChapter.keys()].sort((a, b) => a - b)) {
    const items = byChapter.get(chapterNumber)!;
    L.push(`## Chapter ${chapterNumber} — ${items.length} item(s) to verify`);
    for (const item of items) {
      L.push(`- [${item.kind}] \`${item.id}\` — ${item.claim || "(no claim text)"}`);
      L.push(`    ${item.detail}`);
    }
    L.push("");
    record.push({ chapterNumber, items: items.map((i) => ({ id: i.id, kind: i.kind, verdict: "FILL_ME", sourceRef: "", note: "" })) });
  }

  L.push("## Record skeleton — fill `verdict` (VERIFIED|UNVERIFIABLE|WRONG) and `sourceRef` per item");
  L.push("```json");
  L.push(JSON.stringify({ schemaVersion: "source-verify-record-v1", bookId, chapters: record }, null, 2));
  L.push("```");
  L.push("");
  L.push("When every item is VERIFIED (or its sidecar fixed and re-verified), the source is sound");
  L.push("and you may proceed to the write phase. Surface any UNVERIFIABLE/WRONG item to the operator.");
  return L.join("\n") + "\n";
}

/**
 * JSON Schema for a FILLED source-verify-record-v1 — bind as a GPT structured-output
 * `response_format` so the verifier emits a shape-valid record (no FILL_ME round-trips).
 * Lives HERE, next to parseSourceVerifyRecord/checkSourceVerifyRecord that consume it, so
 * the producer schema and the consumer checker cannot drift (a contract test asserts it).
 * Note: `verdict` excludes FILL_ME on purpose — a bound output must COMMIT a real verdict;
 * structured output guarantees shape, `source-verify-check` stays authoritative on substance.
 */
export function sourceVerifyRecordJsonSchema(): object {
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    additionalProperties: false,
    required: ["schemaVersion", "bookId", "chapters"],
    properties: {
      schemaVersion: { const: "source-verify-record-v1" },
      bookId: { type: "string" },
      chapters: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["chapterNumber", "items"],
          properties: {
            chapterNumber: { type: "integer" },
            items: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["id", "kind", "verdict", "sourceRef", "note"],
                properties: {
                  id: { type: "string" },
                  kind: { type: "string", enum: ["named_example", "testable_fact"] },
                  verdict: { type: "string", enum: ["VERIFIED", "UNVERIFIABLE", "WRONG"] },
                  sourceRef: { type: "string" },
                  note: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
  };
}

/** Extract the `source-verify-record-v1` JSON from a FILLED packet (markdown with a
 *  fenced ```json block) or from raw JSON. The buildSourceVerificationPacket() emitter
 *  embeds exactly such a block; the operator fills its verdicts/sourceRefs in place. */
export function parseSourceVerifyRecord(text: string): { record: SourceVerifyRecord | null; error?: string } {
  const src = text ?? "";
  const trimmed = src.trim();
  if (trimmed.startsWith("{")) {
    try { return { record: JSON.parse(trimmed) as SourceVerifyRecord }; }
    catch (e) { return { record: null, error: `record JSON is invalid: ${(e as Error).message}` }; }
  }
  const blocks = [...src.matchAll(/```json\s*\n([\s\S]*?)\n```/g)].map((m) => m[1]);
  for (const b of blocks) {
    if (!b.includes("source-verify-record-v1")) continue;
    try { return { record: JSON.parse(b) as SourceVerifyRecord }; }
    catch (e) { return { record: null, error: `record JSON block is invalid: ${(e as Error).message}` }; }
  }
  return { record: null, error: "no source-verify-record-v1 JSON block found in the packet" };
}

/**
 * Gate a FILLED verification record against the verifiable items it claims to cover.
 * This is what turns the WS-4 packet from DECORATIVE into a real gate: emitting a
 * packet proves nothing; reading the filled record back and refusing to trust a
 * rubber-stamp is the gate.
 *
 * Blocks on: (SV1) incomplete coverage vs the sidecars' verifiable items; (SV2) any
 * item not VERIFIED (FILL_ME/UNVERIFIABLE/WRONG); (SV3) a VERIFIED item with no
 * sourceRef. And the two rubber-stamp SIGNATURES the digital-minimalism run produced
 * — (SV4) one identical note reused across every VERIFIED item, and (SV5) one
 * identical sourceRef across every VERIFIED item. A faithful per-item verification
 * cannot share a single note or a single source across many distinct cases/facts.
 */
export function checkSourceVerifyRecord(expectedItems: SourceVerifyItem[], record: SourceVerifyRecord | null): SourceVerifyFinding[] {
  const out: SourceVerifyFinding[] = [];
  if (!record || !Array.isArray(record.chapters)) {
    return [{ checkId: "SV1", severity: "blocker", message: "source-verify record is missing or has no chapters[] — fill the verification packet before publishing." }];
  }
  const recItems = record.chapters.flatMap((c) => (c.items ?? []).map((it) => ({ ...it, chapterNumber: c.chapterNumber })));
  const recById = new Map(recItems.map((it) => [String(it.id), it]));

  // SV1 — coverage: every verifiable item must have a record entry.
  for (const exp of expectedItems) {
    if (!recById.has(String(exp.id))) {
      out.push({ checkId: "SV1", severity: "blocker", chapterNumber: exp.chapterNumber, message: `item "${exp.id}" (ch${exp.chapterNumber}) has no verification record entry — coverage is incomplete.` });
    }
  }

  // SV2/SV3 — per-item verdict + citation.
  for (const it of recItems) {
    const verdict = String(it.verdict ?? "").trim().toUpperCase();
    if (verdict !== "VERIFIED") {
      out.push({ checkId: "SV2", severity: "blocker", chapterNumber: it.chapterNumber, message: `item "${it.id}" (ch${it.chapterNumber}) verdict is "${it.verdict || "FILL_ME"}", not VERIFIED — resolve or cut it before publishing.` });
      continue;
    }
    if (!String(it.sourceRef ?? "").trim()) {
      out.push({ checkId: "SV3", severity: "blocker", chapterNumber: it.chapterNumber, message: `item "${it.id}" (ch${it.chapterNumber}) is VERIFIED with no sourceRef — a verified claim must cite a real source.` });
    }
  }

  // SV4/SV5 — rubber-stamp signatures (only meaningful at scale).
  const verified = recItems.filter((it) => String(it.verdict ?? "").trim().toUpperCase() === "VERIFIED");
  if (verified.length >= 5) {
    const distinctNotes = new Set(verified.map((it) => String(it.note ?? "").trim()).filter(Boolean));
    const distinctRefs = new Set(verified.map((it) => String(it.sourceRef ?? "").trim()).filter(Boolean));
    // SV4 — one identical note across every item is a bulk-fill signature, but ONLY a
    // rubber-stamp when it is NOT backed by per-item distinct sources. A boilerplate note
    // over genuinely DISTINCT real sourceRefs is honest-if-terse, not a stamp; one note
    // over REUSED sources is the digital-minimalism shape (1 note, 81 items, 22 refs).
    if (distinctNotes.size === 1 && distinctRefs.size < verified.length) {
      out.push({ checkId: "SV4", severity: "blocker", message: `all ${verified.length} VERIFIED items carry ONE identical note over only ${distinctRefs.size} distinct source(s) — that is a bulk rubber-stamp, not per-item verification. Verify each item against its own source.` });
    }
    // SV5 — a single source cannot ground every distinct named case and fact.
    if (distinctRefs.size === 1) {
      out.push({ checkId: "SV5", severity: "blocker", message: `all ${verified.length} VERIFIED items cite ONE identical sourceRef — a single source cannot ground every distinct named case and fact. Cite per-item sources.` });
    }
  }

  return out;
}

// NOTE: the old `sourceVerifyGateFindings(bookId, items, { require })` lived here and was the
// env-var bypass — an ABSENT record blocked only under `require`. It has been REMOVED. Source-reality
// is now a content-driven production invariant; the single point of truth is
// `evaluateSourceRealityPolicy` in src/qc/sourceRealityPolicy.ts, which both `promote-book` and the
// `publish-after-qc` preflight consult. Do not reintroduce a require-flag gate here.
