/**
 * Register critics — enforce the voice. No meta-reference, no "Chapter N"
 * literals, no banned phrases from the signature-tic list.
 */

import { CriticFinding } from "../types.js";
import { finding, loadBannedPhrases, loadMetaPatterns, truncate } from "./shared.js";

type PatternDef = {
  id: string;
  pattern: string;
  severity: "blocker" | "major" | "minor";
  example?: string;
};

let _metaRegexes: Array<{ def: PatternDef; re: RegExp }> | null = null;
let _chapterNumberRegexes: Array<{ def: PatternDef; re: RegExp }> | null = null;

/** Convert patterns that use Python-style (?i) inline flag to JS RegExp with
 *  the `i` flag. Keeps JSON patterns portable. */
function compilePattern(raw: string): RegExp {
  const flagMatch = raw.match(/^\(\?([a-z]+)\)/);
  if (flagMatch) {
    return new RegExp(raw.slice(flagMatch[0].length), flagMatch[1]);
  }
  return new RegExp(raw);
}

function metaRegexes() {
  if (_metaRegexes) return _metaRegexes;
  const cfg = loadMetaPatterns();
  _metaRegexes = (cfg.metaReferencePatterns as PatternDef[]).map((def) => ({
    def,
    re: compilePattern(def.pattern),
  }));
  return _metaRegexes;
}

function chapterNumberRegexes() {
  if (_chapterNumberRegexes) return _chapterNumberRegexes;
  const cfg = loadMetaPatterns();
  _chapterNumberRegexes = (cfg.chapterNumberPatterns as PatternDef[]).map((def) => ({
    def,
    re: compilePattern(def.pattern),
  }));
  return _chapterNumberRegexes;
}

/** Meta-reference check. Content must teach the idea, not narrate the chapter.
 *  Tests every tone of a MaybeToned value by running against the joined text. */
export function checkNoMetaReference(text: string): CriticFinding[] {
  const findings: CriticFinding[] = [];
  for (const { def, re } of metaRegexes()) {
    const m = text.match(re);
    if (m) {
      findings.push(
        finding(
          "register.no_meta_reference",
          def.severity,
          `meta-reference "${m[0]}" (pattern ${def.id}) — teach the idea, don't narrate the chapter`,
          text,
        ),
      );
      break; // one per unit is enough
    }
  }
  return findings;
}

/** "Chapter N" literal check. */
export function checkNoChapterNumberLiteral(text: string): CriticFinding[] {
  const findings: CriticFinding[] = [];
  for (const { def, re } of chapterNumberRegexes()) {
    const m = text.match(re);
    if (m) {
      findings.push(
        finding(
          "register.no_chapter_number_literal",
          def.severity,
          `literal chapter reference "${m[0]}" — breaks reading experience`,
          text,
        ),
      );
      break;
    }
  }
  return findings;
}

// ── Em-dash check ───────────────────────────────────────────────────────────
// Em dashes are a writer-pipeline tell. Banned everywhere in v21 output.

export function checkNoEmDash(text: string): CriticFinding[] {
  if (!text.includes("\u2014")) return [];
  const sample = text.slice(Math.max(0, text.indexOf("\u2014") - 30), text.indexOf("\u2014") + 30);
  return [
    finding(
      "register.no_banned_phrase",
      "minor",
      `em dash present (use commas, periods, parens, or colons instead)`,
      sample,
    ),
  ];
}

// ── Banned-phrase check with budget tracking ────────────────────────────────

export type PhraseUsage = {
  phrase: string;
  text: string;
  category: "hardBanned" | "softBanned";
};

/** Per-unit: flag every hard-banned phrase occurrence. Soft-banned phrases
 *  are counted by the caller against per-book budgets. */
export function checkBannedPhrases(text: string): { findings: CriticFinding[]; usages: PhraseUsage[] } {
  const cfg = loadBannedPhrases();
  const findings: CriticFinding[] = [];
  const usages: PhraseUsage[] = [];
  const lower = text.toLowerCase();

  for (const entry of cfg.hardBanned ?? []) {
    const phrase = entry.phrase as string;
    if (lower.includes(phrase.toLowerCase())) {
      findings.push(
        finding(
          "register.no_banned_phrase",
          "major",
          `banned phrase "${phrase}" — ${entry.reason}`,
          text,
        ),
      );
      usages.push({ phrase, text, category: "hardBanned" });
    }
  }

  for (const entry of cfg.softBanned ?? []) {
    const phrase = entry.phrase as string;
    if (lower.includes(phrase.toLowerCase())) {
      usages.push({ phrase, text, category: "softBanned" });
    }
  }

  return { findings, usages };
}
