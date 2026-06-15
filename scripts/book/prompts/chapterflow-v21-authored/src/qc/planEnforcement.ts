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
  const exemplarPlan = readJson(resolve(CANONICAL_STATE, "exemplar-plans", `${bookId}.exemplar-plan.json`));

  for (const ch of chapters) {
    const shapeAllocation = shapePlan?.allocation?.[String(ch.number)] ?? shapePlan?.allocation?.[ch.number];
    const exemplarAllocation = exemplarPlan?.allocation?.[String(ch.number)] ?? exemplarPlan?.allocation?.[ch.number];
    const examples = (ch.examples ?? []) as any[];
    // Scene SHAPES are still a hard pre-authoring deal on the `fanout` path (the card
    // says "example[i] MUST use shape i"), so SP2 verifies obedience when a shape plan
    // exists. VENUES are NOT: the venue plan is a fallback palette for variety, not a
    // mandate — the named source case is the stage and the author stamps the real
    // setting (which legitimately differs from the dealt slot). So there is no
    // venue-obedience check; staging variety is guarded by BP27 (book-gate) + the bar
    // rubric. SP1's "no allocation" gates are also dropped: the next-task GENERATE flow
    // never deals shapes, and SP3 (within-chapter shape reuse) carries the real signal.

    const seenFormats = new Map<string, number>();
    examples.forEach((ex: any, i: number) => {
      const ps = ex?.planSpec;
      if (!ps || !ps.domain || !ps.audience || !ps.stakes || !ps.format || !ps.requiredBeat) {
        findings.push({ checkId: "SP1.shape_plan_missing", severity: "blocker", chapterNumber: ch.number, message: `example[${i}] is missing required planSpec fields (domain, audience, stakes, format, requiredBeat).` });
        return;
      }
      // SP3 — no chapter may reuse a scene shape across its own examples. A real
      // quality check, independent of any pre-dealt plan; always enforced.
      const prior = seenFormats.get(ps.format);
      if (prior !== undefined) {
        findings.push({ checkId: "SP3.shape_slot_reused", severity: "blocker", chapterNumber: ch.number, message: `example[${i}] reuses shape "${ps.format}" already used by example[${prior}].`, evidence: ps.format });
      } else {
        seenFormats.set(ps.format, i);
      }
      // SP2 — only when shapes were dealt up front (fanout): verify the author obeyed the deal.
      if (Array.isArray(shapeAllocation) && shapeAllocation.length > 0 && shapeAllocation[i] !== ps.format) {
        findings.push({ checkId: "SP2.shape_plan_mismatch", severity: "blocker", chapterNumber: ch.number, message: `example[${i}].planSpec.format is "${ps.format}", expected "${shapeAllocation[i]}".`, evidence: ps.format });
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

