/**
 * architectureMonoculture — book-level STRUCTURAL-SKELETON sameness (2026-07-05).
 *
 * The surface-variety dealer (briefRotation v4) and the surface-sameness critics
 * (BP26–BP31, AS4) vary the DRESSING — opener words, venue names, quiz phrasing,
 * clock stamps — and a book can pass every one of them while every chapter still
 * runs the SAME delivery SKELETON. start-with-why (2026-07-05) did exactly that:
 * 14/14 chapters were individually PASS, yet the book-acceptance panel unanimously
 * rejected it "churn HIGH — every chapter leans on the same architecture of named
 * anchors, second settings, proxy characters, return points, and identical practice
 * shells." Those are SKELETON axes the lexical critics cannot see (the wording
 * differs; the STRUCTURE repeats).
 *
 * This critic makes that skeleton monoculture DETERMINISTICALLY VISIBLE before the
 * (expensive, semantic) book-acceptance panel runs, and names the offending
 * chapters so the book-sameness repair lane can route surgically. It measures a
 * handful of high-signal, low-FP axes and aggregates:
 *
 *   ARCH1  practice-shell template clone — implementationPlan.weeklyPractice
 *          shares a word-set skeleton across ≥ cluster-min chapters (the
 *          "Each Friday, if one X, then <verb>" / fill-in-the-blank say-aloud shell).
 *   ARCH2  keyTakeaway compound-template clone — the same on keyTakeaway.
 *   ARCH3  return-point / order-reversal motif ubiquity — a "proof must come back /
 *          reverse the order" memorable line in ≥ ubiquity-frac of chapters.
 *   ARCH4  lead-anchor over-reuse — one marquee proper-noun anchors the OPENING of
 *          more than anchor-cap chapters (e.g. Apple leading 7/14).
 *   ARCH0  aggregate — ≥ axes-warn axes fire → the book reads as one mold (major,
 *          surfaced); ≥ axes-block axes fire → severe monoculture (blocker when the
 *          operator opts structural sameness into the hard gate).
 *
 * Thematic consistency (the book's actual thesis vocabulary — WHY/belief/trust) is
 * NOT penalised: the axes key on the delivery MACHINERY (practice shell, reversal
 * device, lead-anchor identity), not on the argument. Necessary source terms and
 * required app structure repeat freely without tripping anything here.
 *
 * DETERMINISTIC + config-driven (config/rubric-thresholds.json → architectureMonoculture).
 */

import type { ChapterV21 } from "../types.js";
import type { BookGateFinding } from "./bookGate.js";
import { extractNamesFromText } from "../librarian/libraryState.js";

export type ArchitectureMonocultureThresholds = {
  /** Fraction of chapters sharing the practice-shell scaffold marker → ARCH1. */
  practiceShellFrac: number;
  /** Fraction whose keyTakeaway is a compound "X, then Y[, then Z]" sequence → ARCH2. */
  takeawayCompoundFrac: number;
  /** Fraction carrying the return/receipt device motif → ARCH3. */
  reversalUbiquityFrac: number;
  /** A single lead anchor opening MORE than this many chapters fires ARCH4. */
  anchorCap: number;
  /** Number of axes that must fire for the aggregate WARN (major). */
  axesWarn: number;
  /** Number of axes for the aggregate SEVERE. */
  axesBlock: number;
};

export const DEFAULT_ARCHITECTURE_MONOCULTURE_THRESHOLDS: ArchitectureMonocultureThresholds = {
  practiceShellFrac: 0.7,
  takeawayCompoundFrac: 0.7,
  // A specific narrative DEVICE (not thesis vocabulary) recurring in ≥60% of
  // chapters is over-reliance — lower than the structural-marker axes because a
  // device is more optional than a takeaway/practice section.
  reversalUbiquityFrac: 0.6,
  anchorCap: 3,
  axesWarn: 2,
  axesBlock: 4,
};

/** The recurring-cadence PRACTICE SHELL: "Each/Every {Friday|week|Monday|shutdown}…"
 *  — the desk-drill scaffold the panel named ("identical practice shells"). Keys on
 *  the SHELL marker, not the (dealer-varied) middle words. */
const PRACTICE_SHELL_RX = /\b(each|every)\s+(friday|week|monday|shutdown|morning|day)\b/i;

/** A compound sequenced takeaway: an imperative chain with ≥2 sequence joints
 *  ("do X, then Y, then Z"). The compound-template close the panel named. */
function isCompoundSequence(text: string): boolean {
  const thens = (text.match(/\bthen\b/gi) ?? []).length;
  const commas = (text.match(/,/g) ?? []).length;
  return thens >= 1 && (thens + commas) >= 2;
}

/** The return-point / receipt / order-reversal delivery DEVICE — the book's
 *  signature "proof must travel back / a receipt returns / reverse the order"
 *  motif. Keyed on the DEVICE phrasing, not the thesis words (belief/why/trust),
 *  so thematic consistency is never mistaken for churn. */
const REVERSAL_MOTIF_RX = /\b(return (?:path|trip|point|pass)|comes? back|come back|came back|coming back|kept coming back|bring[a-z]* back|brought back|a receipt|is a receipt|the receipt|proof (?:is )?owed|where proof|reverse the order|order (?:flips|reverses|reversal)|flip the order|send (?:it|the \w+) home|stays? home|come home)\b/i;

function chapterFraction(n: number, frac: number): number {
  return Math.max(2, Math.ceil(n * frac));
}

/** The chapter's OPENING surface — where the lead anchor is established. */
function openingSurface(ch: ChapterV21): string {
  return `${ch.hook ?? ""} ${ch.breakdown?.fastRead ?? ""}`.slice(0, 400);
}

export function checkArchitectureMonoculture(
  chapters: ChapterV21[],
  thresholds: ArchitectureMonocultureThresholds = DEFAULT_ARCHITECTURE_MONOCULTURE_THRESHOLDS,
): BookGateFinding[] {
  const findings: BookGateFinding[] = [];
  const N = chapters.length;
  if (N < 4) return findings; // book-level sameness is only meaningful at book scale
  const axes: Array<{ id: string; label: string; chapters: number[]; sample: string }> = [];

  // ── ARCH1 — practice-shell scaffold ubiquity ───────────────────────────────
  const practiceShell = chapters
    .filter((c) => PRACTICE_SHELL_RX.test(c.implementationPlan?.weeklyPractice ?? ""))
    .map((c) => c.number);
  if (practiceShell.length >= chapterFraction(N, thresholds.practiceShellFrac)) {
    axes.push({
      id: "ARCH1.practice_shell_monoculture",
      label: `the same recurring-cadence practice shell ("Each/Every Friday/week…") drives ${practiceShell.length}/${N} chapters`,
      chapters: practiceShell,
      sample: chapters.find((c) => c.number === practiceShell[0])?.implementationPlan?.weeklyPractice?.slice(0, 140) ?? "",
    });
  }

  // ── ARCH2 — keyTakeaway compound-sequence ubiquity ─────────────────────────
  const compoundTakeaway = chapters
    .filter((c) => isCompoundSequence(c.keyTakeaway ?? ""))
    .map((c) => c.number);
  if (compoundTakeaway.length >= chapterFraction(N, thresholds.takeawayCompoundFrac)) {
    axes.push({
      id: "ARCH2.takeaway_template_monoculture",
      label: `the same compound "do X, then Y, then Z" takeaway closes ${compoundTakeaway.length}/${N} chapters`,
      chapters: compoundTakeaway,
      sample: chapters.find((c) => c.number === compoundTakeaway[0])?.keyTakeaway?.slice(0, 140) ?? "",
    });
  }

  // ── ARCH3 — return-point / receipt / order-reversal motif ubiquity ─────────
  const reversalChapters = chapters
    .filter((c) => {
      const lines = (c.memorableLines ?? []).map((m) => m.text ?? "").join(" \n ");
      return REVERSAL_MOTIF_RX.test(lines) || REVERSAL_MOTIF_RX.test(c.keyTakeaway ?? "");
    })
    .map((c) => c.number);
  if (reversalChapters.length >= chapterFraction(N, thresholds.reversalUbiquityFrac)) {
    axes.push({
      id: "ARCH3.reversal_motif_monoculture",
      label: `the same return-point / receipt / order-reversal device recurs in ${reversalChapters.length}/${N} chapters`,
      chapters: reversalChapters,
      sample: "",
    });
  }

  // ── ARCH4 — lead-anchor over-reuse ─────────────────────────────────────────
  // Count how many chapters OPEN on each marquee proper-noun anchor; one anchor
  // leading more than anchorCap chapters is over-reliance (Apple led 7/14).
  const anchorChapters = new Map<string, Set<number>>();
  for (const c of chapters) {
    const names = new Set(extractNamesFromText(openingSurface(c)).map((n) => n.toLowerCase()));
    for (const name of names) {
      if (name.length < 3) continue;
      (anchorChapters.get(name) ?? anchorChapters.set(name, new Set()).get(name)!).add(c.number);
    }
  }
  let worstAnchor: { name: string; chapters: number[] } | null = null;
  for (const [name, chs] of anchorChapters) {
    if (chs.size > thresholds.anchorCap && (!worstAnchor || chs.size > worstAnchor.chapters.length)) {
      worstAnchor = { name, chapters: [...chs].sort((a, b) => a - b) };
    }
  }
  if (worstAnchor) {
    axes.push({
      id: "ARCH4.lead_anchor_overreuse",
      label: `"${worstAnchor.name}" leads the opening of ${worstAnchor.chapters.length} chapters (cap ${thresholds.anchorCap})`,
      chapters: worstAnchor.chapters,
      sample: worstAnchor.name,
    });
  }

  // ── ARCH0 — aggregate ──────────────────────────────────────────────────────
  // Emit each axis as a minor (routable evidence) and one aggregate finding whose
  // severity scales with how many axes fired. The aggregate is what a book-sameness
  // repair lane / the operator reads: "the book is one mold on N axes."
  for (const a of axes) {
    findings.push({
      catalogId: a.id,
      severity: "minor",
      message: `Architecture monoculture: ${a.label}. Chapters: ${a.chapters.map((n) => `ch${String(n).padStart(2, "0")}`).join(", ")}.`,
      evidence: a.sample || undefined,
      chapters: a.chapters,
    });
  }
  if (axes.length >= thresholds.axesWarn) {
    const severe = axes.length >= thresholds.axesBlock;
    // Union of the chapters implicated across axes = the diversification target set.
    const target = [...new Set(axes.flatMap((a) => a.chapters))].sort((a, b) => a - b);
    findings.push({
      catalogId: "ARCH0.architecture_monoculture",
      // major = surfaced advisory (the book-acceptance panel is the true gate); the
      // structural-sameness enforcement flag can promote it. Never a silent pass.
      severity: severe ? "major" : "major",
      message:
        `Book-level architecture monoculture: ${axes.length} skeleton axis/axes repeat across the book ` +
        `(${axes.map((a) => a.id.split(".")[0]).join(", ")}) — the chapters share one delivery mold, which the ` +
        `book-acceptance panel reads as "churn HIGH". Diversify the architecture of the most-repeated chapters ` +
        `(vary opening family, lead-anchor identity, practice shell, and the return-point device) while keeping ` +
        `the thesis and app structure. Implicated chapters: ${target.map((n) => `ch${String(n).padStart(2, "0")}`).join(", ")}.`,
      chapters: target,
    });
  }

  return findings;
}
