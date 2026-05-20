/**
 * Shared helpers for critics. Keep this file tiny — critics should each own
 * their logic. This file holds only utilities used by multiple critics.
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

import {
  BookPackage,
  Chapter,
  CriticFinding,
  MaybeToned,
  ToneKeyed,
  resolveDirect,
  UnitLocation,
} from "../types.js";

// ── Config loading ──────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_DIR = resolve(__dirname, "../../config");

let _rubric: any = null;
let _bannedPhrases: any = null;
let _metaPatterns: any = null;
let _authorVoiceProfiles: any = null;

export function loadRubric() {
  if (!_rubric) {
    _rubric = JSON.parse(readFileSync(resolve(CONFIG_DIR, "critic-rubric.json"), "utf8"));
  }
  return _rubric;
}

export function loadBannedPhrases() {
  if (!_bannedPhrases) {
    _bannedPhrases = JSON.parse(readFileSync(resolve(CONFIG_DIR, "banned-phrases.json"), "utf8"));
  }
  return _bannedPhrases;
}

export function loadMetaPatterns() {
  if (!_metaPatterns) {
    _metaPatterns = JSON.parse(readFileSync(resolve(CONFIG_DIR, "meta-patterns.json"), "utf8"));
  }
  return _metaPatterns;
}

/** Load all per-book author-voice profiles. Returns `null` if the config
 *  doesn't exist yet (older v21 deploys). Each profile is keyed by bookId. */
export function loadAuthorVoiceProfiles(): { profiles: Record<string, any> } | null {
  if (_authorVoiceProfiles !== null) return _authorVoiceProfiles;
  try {
    const raw = readFileSync(resolve(CONFIG_DIR, "author-voice-profiles.json"), "utf8");
    _authorVoiceProfiles = JSON.parse(raw);
  } catch {
    _authorVoiceProfiles = { profiles: {} };
  }
  return _authorVoiceProfiles;
}

/** Resolve the author-voice profile for one book. Returns `undefined` if
 *  there is no profile for this bookId. */
export function getAuthorVoiceProfile(bookId: string): any | undefined {
  const all = loadAuthorVoiceProfiles();
  return all?.profiles?.[bookId];
}

// ── Text extraction across MaybeToned fields ────────────────────────────────

/** Collect every string that should be evaluated from a MaybeToned value. v21
 *  emits one voice; v13 emits three. We score all three for legacy data. */
export function allTones<T extends string>(v: MaybeToned<T> | undefined): string[] {
  if (v === undefined || v === null) return [];
  if (typeof v === "string") return [v];
  const t = v as ToneKeyed<T>;
  return [t.gentle, t.direct, t.competitive].filter((s) => typeof s === "string") as string[];
}

/** For display/evidence — prefer direct tone when available. */
export function pickEvidence<T extends string>(v: MaybeToned<T> | undefined): string {
  const d = resolveDirect(v);
  if (typeof d === "string") return d;
  return "";
}

// ── Finding helpers ─────────────────────────────────────────────────────────

export function finding(
  checkId: CriticFinding["checkId"],
  severity: CriticFinding["severity"],
  message: string,
  evidence?: string,
): CriticFinding {
  return {
    checkId,
    severity,
    message,
    evidence: evidence ? truncate(evidence, 200) : undefined,
  };
}

export function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "…";
}

// ── Unit iteration ──────────────────────────────────────────────────────────

export type UnitRef = {
  location: UnitLocation;
  /** The primary text field to evaluate. Some checks read the full unit. */
  primaryText: string;
  unit: unknown;
};

export function* iterateUnits(pkg: BookPackage): Generator<UnitRef> {
  const bookId = pkg.book.bookId;
  for (const ch of pkg.chapters) {
    // breakdowns — 3 tiers
    for (const tier of ["easy", "medium", "hard"] as const) {
      const cb = ch.contentVariants?.[tier]?.chapterBreakdown;
      if (cb !== undefined) {
        yield {
          location: {
            bookId,
            chapterNumber: ch.number,
            unitType: "breakdown",
            tier,
          },
          primaryText: allTones(cb as any).join(" \n "),
          unit: cb,
        };
      }
    }
    // examples
    for (const ex of ch.examples ?? []) {
      yield {
        location: {
          bookId,
          chapterNumber: ch.number,
          unitType: "example",
          unitId: ex.exampleId,
        },
        primaryText: pickEvidence(ex.scenario),
        unit: ex,
      };
    }
    // quiz questions
    for (const q of ch.quiz?.questions ?? []) {
      yield {
        location: {
          bookId,
          chapterNumber: ch.number,
          unitType: "quiz_question",
          unitId: q.questionId,
        },
        primaryText: q.prompt,
        unit: q,
      };
    }
    // review cards
    for (const rc of ch.reviewCards ?? []) {
      yield {
        location: {
          bookId,
          chapterNumber: ch.number,
          unitType: "review_card",
          unitId: rc.cardId,
        },
        primaryText: pickEvidence(rc.front),
        unit: rc,
      };
    }
    // key takeaway card
    if (ch.keyTakeawayCard !== undefined) {
      yield {
        location: {
          bookId,
          chapterNumber: ch.number,
          unitType: "key_takeaway",
        },
        primaryText: pickEvidence(ch.keyTakeawayCard as any),
        unit: ch.keyTakeawayCard,
      };
    }
  }
}
