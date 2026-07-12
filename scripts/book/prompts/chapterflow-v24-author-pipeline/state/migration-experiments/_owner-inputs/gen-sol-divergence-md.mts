/** READ-ONLY: render SOL_JUDGE_SOURCE_REGISTER_DIVERGENCE_PACKET.md from the .json
 *  (no model call, no implementation change). Complete rendered chapters live in
 *  the JSON; this MD is the human-readable adjudication companion. */
import { readFileSync, writeFileSync } from "node:fs";
const OI = "state/migration-experiments/_owner-inputs";
const p = JSON.parse(readFileSync(`${OI}/stage-q/SOL_JUDGE_SOURCE_REGISTER_DIVERGENCE_PACKET.json`, "utf8"));

const L: string[] = [];
L.push("# SOL Judge — Source-Register Divergence Packet");
L.push("");
L.push(`**Generated from run-3 preserved evidence** (no model call). **Disputed cases: ${p.disputedCaseCount}.**`);
L.push("");
L.push("A **disputed case** = `gpt-5.6-sol@high` raised a reserved-category *fabrication / misleading-source* mustFix on an item AND a `gpt-5.5` judge (high or xhigh) did not. These passages are presented **neutrally** — they are **not** pre-classified as illustrative examples or as defects. Each case carries a **blank owner-adjudication field**. The complete reader-facing chapter (exactly what the reviewer saw), full mutation manifests, and gold for every case are in the `.json`.");
L.push("");
L.push(`> **What the reviewer received (identical for all cases):** the phase-1 rendered chapter ONLY. **Source plan: NOT visible. Source evidence: NOT visible. External book/chapter metadata: NOT visible. Answer key (phase-1): NOT visible.** The reviewer therefore could not verify whether any named referent is a real documented case or invented — it saw only the text.`);
L.push("");
L.push(`> **gpt-5.6-sol ran 20/28** before its run was halted to surface the finding; disputed cases are drawn from those processed items.`);
L.push("");
L.push("## Summary");
L.push("");
L.push("| # | caseId | kind | sol fab units | gpt-5.5@high | gpt-5.5@xhigh | people | orgs | dates | quotes | hist? |");
L.push("|---|---|---|---|---|---|---|---|---|---|---|");
p.disputedCases.forEach((c: any, i: number) => {
  const hi = c.findings["gpt-5.5@high"]; const xh = c.findings["gpt-5.5@xhigh"];
  const hiTxt = !hi.processed ? "n/p" : hi.fabricationMustFix.length ? "FAB too" : "no fab flag";
  const xhTxt = !xh.processed ? "n/p" : xh.fabricationMustFix.length ? "FAB too" : "no fab flag";
  const e = c.entitySummary;
  L.push(`| ${i + 1} | ${c.caseId.replace("LNV2-", "")} | ${c.kind} | ${c.disputedPassages.map((x: any) => x.unit).join(", ")} | ${hiTxt} | ${xhTxt} | ${e.namedPeoplePresent ? "Y" : "n"} | ${e.namedOrganizationsPresent ? "Y" : "n"} | ${e.datesPresent ? "Y" : "n"} | ${e.quotationsPresent ? "Y" : "n"} | ${e.historicalOccurrenceImplied ? "Y" : "n"} |`);
});
L.push("");
L.push("## Cases");
L.push("");
p.disputedCases.forEach((c: any, i: number) => {
  L.push(`### ${i + 1}. ${c.caseId}  ·  _${c.kind}_`);
  L.push("");
  L.push(`- **Clean base:** \`${c.cleanBaseIdentifier}\` · base content sha \`${(c.cleanBaseChapterContentSha256 || "").slice(0, 12)}\` · rendered-doc sha \`${c.completeReaderFacingChapterSha256.slice(0, 12)}\``);
  L.push(`- **Source anchors:** ${c.sourceUse.sourceAnchorIds}`);
  L.push(`- **Source-use form:** ${c.sourceUse.sourceUseForm}`);
  const e = c.entitySummary;
  L.push(`- **Entities:** named people ${e.namedPeoplePresent ? "**yes**" : "no"} · orgs ${e.namedOrganizationsPresent ? "**yes**" : "no"} · dates ${e.datesPresent ? "**yes**" : "no"} · quotations ${e.quotationsPresent ? "**yes**" : "no"} · historical-occurrence-implied ${e.historicalOccurrenceImplied ? "**yes**" : "no"}`);
  L.push("");
  c.disputedPassages.forEach((dp: any) => {
    L.push(`**Disputed passage — ${dp.unit}${dp.exampleId ? ` (${dp.exampleId})` : ""}:**`);
    L.push("");
    L.push("> " + String(dp.disputedPassage || "(non-example unit — see JSON)").replace(/\n/g, " ").slice(0, 700));
    if (dp.whatToDo) L.push(">");
    if (dp.whatToDo) L.push("> _whatToDo:_ " + String(dp.whatToDo).replace(/\n/g, " ").slice(0, 400));
    L.push("");
    const fram = dp.visibleFramingLanguage;
    L.push(`_Visible framing:_ ${fram.presentsAsNarrative ? "presented as narrative (no hypothetical-framing markers detected)" : "hypothetical markers: " + fram.hypotheticalFramingMarkers.join(", ")}` + (dp.entities.properNounsDetected?.length ? ` · proper nouns: ${dp.entities.properNounsDetected.slice(0, 8).join(", ")}` : "") + (dp.entities.namedOrganizationsDetected?.length ? ` · orgs: ${dp.entities.namedOrganizationsDetected.join(", ")}` : ""));
    L.push("");
  });
  const sol = c.findings["gpt-5.6-sol@high"];
  L.push(`**gpt-5.6-sol@high finding** (phase-1 composite ${sol.composite}, ship84 ${sol.ship84}, pass ${sol.pass}):`);
  sol.fabricationMustFix.forEach((f: any) => L.push(`- [mustFix] _${f.unit}_ — ${f.problem}`));
  if (c.solEvidenceSpans.length) { L.push(`- _evidence spans:_ ${c.solEvidenceSpans.map((q: any) => `"${String(q.quote).slice(0, 80)}"${q.verified ? "✓" : "✗"}`).join(" · ")}`); }
  L.push("");
  const hi = c.findings["gpt-5.5@high"]; const xh = c.findings["gpt-5.5@xhigh"];
  L.push(`**gpt-5.5@high finding:** ${!hi.processed ? "not processed" : hi.fabricationMustFix.length ? "ALSO flagged fabrication: " + hi.fabricationMustFix.map((f: any) => f.unit).join(",") : `**no fabrication finding** (composite ${hi.composite}, ship84 ${hi.ship84}, pass ${hi.pass}; other mustFix units: ${hi.allMustFixUnits.join(",") || "none"})`}`);
  L.push("");
  L.push(`**gpt-5.5@xhigh finding:** ${!xh.processed ? "not processed" : xh.fabricationMustFix.length ? "ALSO flagged fabrication: " + xh.fabricationMustFix.map((f: any) => f.unit).join(",") : `**no fabrication finding** (composite ${xh.composite}, ship84 ${xh.ship84}, pass ${xh.pass}; other mustFix units: ${xh.allMustFixUnits.join(",") || "none"})`}`);
  L.push("");
  L.push(`**Phase-2:** ${c.phase2 === "N/A (not a phase-2 quiz item)" ? "N/A" : "see JSON (quiz adjudication captured)"} · **Mutation:** ${typeof c.mutationManifest === "string" ? c.mutationManifest : "variant — manifest in JSON"} · **Gold:** \`${JSON.stringify(c.goldExpectation)}\``);
  L.push("");
  L.push("**Call-context manifest:** promptCard `" + c.callContextManifest.promptCardSha256.slice(0, 12) + "` · renderedChapter `" + c.callContextManifest.renderedChapterSha256.slice(0, 12) + "` · sourcePlanVisibility **NONE** · sourceEvidenceVisibility **NONE** · bookChapterMetadataVisibility **NONE** · phase1Schema `" + c.callContextManifest.phase1SchemaHash.slice(0, 12) + "` · phase2Schema `" + c.callContextManifest.phase2SchemaHash + "`");
  L.push("");
  L.push("**▢ OWNER ADJUDICATION (blank):**");
  L.push("```");
  L.push("finalClassification:   [ SOL_FALSE_POSITIVE | CLEAN_CONTROL_NOT_ACTUALLY_CLEAN | REVIEW_CONTEXT_OR_RENDERING_DEFECT | GENUINE_BOUNDARY_CASE ]");
  L.push("reviewerRoleDisposition: [ QUALIFIED | UNQUALIFIED | INCONCLUSIVE ]");
  L.push("evidence:    ");
  L.push("rationale:   ");
  L.push("confidence:  ");
  L.push("```");
  L.push("");
  L.push("---");
  L.push("");
});
writeFileSync(`${OI}/stage-q/SOL_JUDGE_SOURCE_REGISTER_DIVERGENCE_PACKET.md`, L.join("\n") + "\n");
console.log(`WROTE SOL_JUDGE_SOURCE_REGISTER_DIVERGENCE_PACKET.md (${p.disputedCaseCount} cases, ${L.length} lines)`);
