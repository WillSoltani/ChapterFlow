/**
 * Scaffold-leak critic — catches authoring scaffolding that surfaced as literal
 * reader prose, the class the-book-of-boundaries shipped in 12/13 chapters:
 *
 *  SL1 (BLOCKER) format_tag_leak  — an internal scene-shape FORMAT id appears in
 *      reader prose (e.g. "coach_talk", "inner_monologue", "predict_reveal").
 *      Only the underscore_forms are matched — they cannot occur in natural
 *      English, so this is zero-false-positive by construction. (Single-word
 *      formats like "audit"/"scene"/"dialogue" are real words and are NOT matched.)
 *  SL2 (MAJOR)   domain_label_leak — the example's planSpec.domain (a lowercase
 *      descriptive phrase) was pasted into the scenario as a Title-Case proper-
 *      noun label, e.g. "Peyton's Teacher Setting Terms For grade-update calls".
 *  SL3 (MAJOR)   spectator_prop — the real source case is demoted to text/notes
 *      "glowing on a phone/screen" while an invented spectator watches, instead
 *      of the scene dramatizing the case directly.
 *
 * Reader-facing fields are enumerated via authoringContract.readerFields().
 */

import { readerFields } from "./authoringContract.js";
import type { ChapterV21 } from "../types.js";

export type ScaffoldLeakFinding = {
  checkId: "SL1.format_tag_leak" | "SL2.domain_label_leak" | "SL3.spectator_prop";
  severity: "blocker" | "major";
  unit: string;
  message: string;
  evidence?: string;
};

/** Scene-shape FORMAT ids that contain an underscore — these are the ones that
 *  cannot occur in natural prose, so matching them is safe. Union of
 *  config/scene-shapes.json ids + freeform format tokens observed in authored
 *  books. (Single-word formats are deliberately excluded: they're real English.) */
const UNDERSCORE_FORMAT_TAGS = [
  "before_after", "mistake_recovery", "predict_reveal", "decision_memo", "text_thread",
  "inner_monologue", "reset_moment", "planning_choice", "coach_talk", "school_case",
  "data_first", "object_first", "margin_note_revision", "receiving_aftermath",
  "dialogue_led", "business_case", "decision_point",
];
const FORMAT_TAG_RE = new RegExp(`\\b(${UNDERSCORE_FORMAT_TAGS.join("|")})\\b`, "i");

// SL3 fires only when SOURCE MATERIAL (notes/case/report/…) — not a name or an
// incoming message — is what glows on a screen. "His sister's name glows on the
// phone" (a real incoming call) is legitimate and must NOT fire; "town-hall notes
// about <the real case> glow on his phone" (the case demoted to a prop) must.
const SOURCE_PROP_NOUN = /\b(notes?|the case|case file|casefile|report|transcript|summary|dossier|record|memo|write-?up|account|brief)\b/i;
const SCREEN_GLOW_RE = /\b(glow\w*|lit up|lights? up|light\w* up)\b[^.?!]{0,40}\b(phone|screen|laptop|tablet|monitor)\b/i;

const STOP = new Set(["the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "for", "with", "at", "by", "about", "during", "after", "before", "their", "his", "her", "a's"]);

function domainContentTokens(domain: string): Set<string> {
  return new Set(
    domain
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter((t) => t.length >= 3 && !STOP.has(t)),
  );
}

export function checkScaffoldLeak(chapter: ChapterV21): ScaffoldLeakFinding[] {
  const findings: ScaffoldLeakFinding[] = [];

  // SL1 — format-tag tokens in any reader-facing field.
  for (const f of readerFields(chapter)) {
    const m = f.text.match(FORMAT_TAG_RE);
    if (m) {
      findings.push({
        checkId: "SL1.format_tag_leak",
        severity: "blocker",
        unit: f.unit,
        message: `${f.unit}.${f.field} contains the internal scene-shape format tag "${m[1]}" as literal prose. Format ids are authoring scaffolding — never write them into reader-facing text.`,
        evidence: m[1],
      });
    }
  }

  // SL2 / SL3 — per example scenario.
  (chapter.examples ?? []).forEach((ex: any, i: number) => {
    const scenario: string = typeof ex?.scenario === "string" ? ex.scenario : "";
    if (!scenario) return;

    // SL2 — Title-Case run of >=3 words that re-states the (lowercase) planSpec.domain.
    const domain: string = typeof ex?.planSpec?.domain === "string" ? ex.planSpec.domain : "";
    if (domain) {
      const domainTokens = domainContentTokens(domain);
      if (domainTokens.size >= 3) {
        const runs = scenario.match(/\b[A-Z][a-z']+(?:\s+[A-Z][a-z']+){2,}\b/g) ?? [];
        for (const run of runs) {
          const runTokens = run.toLowerCase().split(/\s+/).filter((t) => !STOP.has(t));
          const overlap = runTokens.filter((t) => domainTokens.has(t)).length;
          if (overlap >= 3) {
            findings.push({
              checkId: "SL2.domain_label_leak",
              severity: "major",
              unit: `example[${i}]`,
              message: `example[${i}] scenario pastes the planSpec.domain ("${domain}") into the prose as a Title-Case label ("${run}"). The domain is a planning note, not a proper noun — dramatize the named source case instead.`,
              evidence: run,
            });
            break;
          }
        }
      }
    }

    // SL3 — the real case demoted to source notes glowing on a screen. Require
    // BOTH a source-material noun AND a screen-glow within the SAME sentence.
    for (const sentence of scenario.split(/(?<=[.?!])\s+/)) {
      const glow = sentence.match(SCREEN_GLOW_RE);
      if (glow && SOURCE_PROP_NOUN.test(sentence)) {
        findings.push({
          checkId: "SL3.spectator_prop",
          severity: "major",
          unit: `example[${i}]`,
          message: `example[${i}] demotes the source case to notes glowing on a screen ("${glow[0]}") — an invented onlooker reading the real case off a device. Stage the named source case directly; don't make it a prop.`,
          evidence: glow[0],
        });
        break;
      }
    }
  });

  return findings;
}
