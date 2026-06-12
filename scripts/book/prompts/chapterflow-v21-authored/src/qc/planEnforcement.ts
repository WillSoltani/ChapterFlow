import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

import { ChapterV21 } from "../types.js";
import { CANONICAL_STATE } from "../lib/chapterPaths.js";
import { normalizeExemplarCandidate } from "../librarian/exemplarPlan.js";

export type PlanFinding = {
  checkId:
    | "SP1.shape_plan_missing"
    | "SP2.shape_plan_mismatch"
    | "SP3.shape_slot_reused"
    | "SP4.venue_plan_mismatch"
    | "SP5.exemplar_ownership_violation";
  severity: "blocker";
  chapterNumber: number;
  message: string;
  evidence?: string;
};

function readJson(path: string): any | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function includesNeedle(text: string, needle: string): boolean {
  const n = needle.trim();
  if (!n) return false;
  return text.toLowerCase().includes(n.toLowerCase());
}

export function checkPlanEnforcement(bookId: string, chapters: ChapterV21[]): PlanFinding[] {
  const findings: PlanFinding[] = [];
  const shapePlan = readJson(resolve(CANONICAL_STATE, "shape-plans", `${bookId}.shape-plan.json`));
  const venuePlan = readJson(resolve(CANONICAL_STATE, "venue-plans", `${bookId}.venue-plan.json`));
  const exemplarPlan = readJson(resolve(CANONICAL_STATE, "exemplar-plans", `${bookId}.exemplar-plan.json`));

  for (const ch of chapters) {
    const shapeAllocation = shapePlan?.allocation?.[String(ch.number)] ?? shapePlan?.allocation?.[ch.number];
    const venueAllocation = venuePlan?.allocation?.[String(ch.number)] ?? venuePlan?.allocation?.[ch.number];
    const exemplarAllocation = exemplarPlan?.allocation?.[String(ch.number)] ?? exemplarPlan?.allocation?.[ch.number];
    if (!Array.isArray(shapeAllocation) || shapeAllocation.length === 0) {
      findings.push({ checkId: "SP1.shape_plan_missing", severity: "blocker", chapterNumber: ch.number, message: `No shape-plan allocation for ch${ch.number}. Run shape-plan/fanout before authoring.` });
    }
    if (!Array.isArray(venueAllocation) || venueAllocation.length === 0) {
      findings.push({ checkId: "SP4.venue_plan_mismatch", severity: "blocker", chapterNumber: ch.number, message: `No venue-plan allocation for ch${ch.number}. Run venue-plan/fanout before authoring.` });
    }

    const seenFormats = new Map<string, number>();
    (ch.examples ?? []).forEach((ex: any, i: number) => {
      const ps = ex?.planSpec;
      if (!ps || !ps.domain || !ps.audience || !ps.stakes || !ps.format || !ps.requiredBeat || !ps.venue) {
        findings.push({ checkId: "SP1.shape_plan_missing", severity: "blocker", chapterNumber: ch.number, message: `example[${i}] is missing required planSpec fields (domain, audience, stakes, format, requiredBeat, venue).` });
        return;
      }
      const prior = seenFormats.get(ps.format);
      if (prior !== undefined) {
        findings.push({ checkId: "SP3.shape_slot_reused", severity: "blocker", chapterNumber: ch.number, message: `example[${i}] reuses shape "${ps.format}" already used by example[${prior}].`, evidence: ps.format });
      } else {
        seenFormats.set(ps.format, i);
      }
      if (Array.isArray(shapeAllocation) && shapeAllocation[i] !== ps.format) {
        findings.push({ checkId: "SP2.shape_plan_mismatch", severity: "blocker", chapterNumber: ch.number, message: `example[${i}].planSpec.format is "${ps.format}", expected "${shapeAllocation[i]}".`, evidence: ps.format });
      }
      if (Array.isArray(venueAllocation) && venueAllocation[i] !== ps.venue) {
        findings.push({ checkId: "SP4.venue_plan_mismatch", severity: "blocker", chapterNumber: ch.number, message: `example[${i}].planSpec.venue is "${ps.venue}", expected "${venueAllocation[i]}".`, evidence: ps.venue });
      }
      const usedText = `${ps.exemplar ?? ""} ${ex.title ?? ""} ${ex.scenario ?? ""} ${ex.whatToDo ?? ""} ${ex.whyItMatters ?? ""}`;
      for (const forbidden of exemplarAllocation?.forbidden ?? []) {
        const name = String(forbidden?.name ?? "");
        if (name && (normalizeExemplarCandidate(ps.exemplar ?? "") === normalizeExemplarCandidate(name) || includesNeedle(usedText, name))) {
          findings.push({
            checkId: "SP5.exemplar_ownership_violation",
            severity: "blocker",
            chapterNumber: ch.number,
            message: `example[${i}] uses forbidden exemplar "${name}" owned by ch${forbidden.ownerChapter}.`,
            evidence: name,
          });
        }
      }
    });
  }
  return findings;
}

export function formatPlanFindings(findings: PlanFinding[]): string {
  if (findings.length === 0) return "plan-enforcement: PASS";
  return [
    `plan-enforcement: BLOCK (${findings.length} blocker(s))`,
    ...findings.map((f) => `  [${f.checkId}] ch${String(f.chapterNumber).padStart(2, "0")}: ${f.message}`),
  ].join("\n");
}

