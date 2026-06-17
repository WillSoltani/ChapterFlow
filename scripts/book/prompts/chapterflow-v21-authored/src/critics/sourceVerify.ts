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

export type SourceVerifyItem = {
  chapterNumber: number;
  kind: "named_example" | "testable_fact";
  id: string;
  claim: string;
  detail: string;
};

/** Pull the verifiable, real-world assertions out of one chapter's sidecar. */
export function verifiableItems(sc: any): SourceVerifyItem[] {
  const chapterNumber = Number(sc?.chapterNumber ?? sc?.number ?? 0);
  const items: SourceVerifyItem[] = [];
  for (const ex of sc?.namedExamples ?? []) {
    // Only real-world named cases need a reality check; a clearly fictional
    // illustration (realWorld === false) is the writer's to invent, not research's.
    if (ex?.realWorld === false) continue;
    const hard = Array.isArray(ex?.hardSpecifics) ? ex.hardSpecifics : [];
    items.push({
      chapterNumber,
      kind: "named_example",
      id: String(ex?.id ?? ex?.label ?? "named-example"),
      claim: String(ex?.label ?? ex?.summary ?? "").trim(),
      detail: `hardSpecifics: ${hard.length ? hard.join(" · ") : "(none — a named case with no concrete specifics cannot be verified)"}`,
    });
  }
  for (const f of sc?.testableFacts ?? []) {
    items.push({
      chapterNumber,
      kind: "testable_fact",
      id: String(f?.id ?? "fact"),
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
