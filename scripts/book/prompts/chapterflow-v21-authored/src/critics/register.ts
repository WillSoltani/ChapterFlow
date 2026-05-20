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

// B1-ext — abstract meta-frame: "the idea" / "this idea" / "this move" used as
// the SUBJECT of an essay verb. Catches the subtler meta-shell Zero to One
// shipped 130+ times with ("the idea argues", "this move targets", "the idea's
// demand"). Hardcoded here because the failure was caught by manual reading
// after the JSON-config patterns missed every instance; keeping them in code
// makes the gate hard to bypass by accident. Real uses ("her idea was bold",
// "an idea worth pursuing") don't match because the leading determiner is
// restricted to "the" or "this" and the trailing token must be a verb that
// treats the idea as essay-agent.
const EXTRA_META_PATTERNS: Array<{ id: string; re: RegExp; severity: PatternDef["severity"] }> = [
  // 2026-05-14 — narrowed the abstract-idea-verb pattern. The earlier form
  // `(?:this|the) idea\s+(is|argues|…|on)` false-fired on legitimate scene
  // narration ("the idea worked", "the idea hit", "the idea grew") because
  // a wide list of essay verbs allowed any verb right after "idea". The
  // narrowed form requires an essay-verb within 5 tokens of the noun, so
  // "The idea worked when…" doesn't fire (verb is "worked", which isn't
  // an essay verb) but "The idea wants the reader to change" still does
  // ("wants" is an essay verb within 5 tokens). GMM Vol 1 Ch3 (5 false
  // positives with the broader regex) goes clean.
  {
    id: "abstract_idea_verb",
    re: /\b(?:this|the)\s+idea\s+(?:\w+\s+){0,3}(argues|wants|demands|forces|insists|claims|asks|denies|targets|leads|frees|on)\b/i,
    severity: "blocker",
  },
  {
    id: "abstract_idea_possessive",
    re: /\b(?:this|the)\s+idea(?:'s|s')\s+(demand|argument|claim|point)\b/i,
    severity: "blocker",
  },
  {
    id: "abstract_move_verb",
    re: /\b(?:this|the)\s+move\s+(targets|argues|wants|demands|asks|points to|is about)\b/i,
    severity: "blocker",
  },
  {
    id: "it_is_the_idea",
    re: /\bIt is (?:the|this) idea\b/i,
    severity: "blocker",
  },
];

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
      return findings; // one per unit is enough
    }
  }
  for (const { id, re, severity } of EXTRA_META_PATTERNS) {
    const m = text.match(re);
    if (m) {
      findings.push(
        finding(
          "register.no_meta_reference",
          severity,
          `abstract meta-frame "${m[0]}" (pattern ${id}) — teach the idea through scenes and people, don't make "the idea" / "this move" the essay's agent`,
          text,
        ),
      );
      break;
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
