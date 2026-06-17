/**
 * `source-fit <book>` — a deterministic, ADVISORY research-time fit classifier. The research
 * prompt already warns that some books fight v21 pedagogy (all chapters facets of one idea, the
 * same few figures, thin sources), but that warning is prose the operator can skip. This turns it
 * into a computed signal from the source-v2 sidecars — the same decorative→real move as
 * source-verify — so a doomed/repetitive run is caught BEFORE 7 chapters are authored.
 *
 * ADVISORY, never a gate: fit is fuzzy, so this surfaces signals + raw metrics and recommends; it
 * does not block. Thresholds are calibrated so the clean reference corpus reads OK (zero false
 * RISKY) — a RISKY verdict means "look closely / re-unitize the source", not "abort". The core is
 * pure (over loaded sidecars) so it is testable on synthetic fixtures; the CLI loads the sidecars.
 */

export interface SourceFitMetrics {
  chapters: number;
  perChapterNamed: number[];
  thinChapters: number[];
  perChapterFacts: number[];
  factThinChapters: number[];
  totalRealWorldNamed: number;
  hardSpecificThinNamed: number;
  topFigures: { figure: string; chapters: number; pct: number }[];
  repeatedFrameworks: { name: string; chapters: number }[];
}

export interface SourceFitReport {
  bookId: string;
  verdict: "OK" | "WATCH" | "RISKY";
  signals: string[];
  metrics: SourceFitMetrics;
}

// Calibrated against the clean reference corpus (stillness-is-the-key, the-year-of-less,
// the-gifts-of-imperfection) — every threshold leaves those books at OK. Conservative by design:
// flag only clear outliers, so a good book is never told to abort.
// Calibration note: thinness counts ALL namedExamples, not just real-world ones — the clean
// concept books (gifts/year-of-less/stillness) teach largely through realWorld:false invented
// illustrations, so a real-world-only count flags every one of them (a false positive). Measured
// floor on the clean corpus is 2/chapter (stillness), so MIN_NAMED=2 flags only 0–1 (genuinely thin).
const MIN_NAMED = 2; // a chapter with < 2 named illustrations of any kind is genuinely thin
const MIN_FACTS = 3; // < 3 testable facts → little to quiz/teach from (clean corpus floor is 3)
const FIGURE_PCT = 0.6; // one figure carrying ≥60% of chapters → monotony / F1-collision risk
const FRAMEWORK_REPEAT = 3; // the SAME named framework recurring in ≥3 chapters → facets-of-one-idea
const THIN_FRACTION = 0.4; // ≥40% of chapters source-thin → the book itself is under-researched

// Proper-noun noise: articles + sentence fragments the research step leaves in properNouns[].
const FIGURE_STOP = new Set([
  "the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "for", "with", "his", "her",
  "their", "our", "your", "my", "this", "that", "these", "those", "it", "they",
]);

function figureTokens(sc: any): string[] {
  const raw = Array.isArray(sc?.properNouns) ? sc.properNouns : [];
  const seen = new Set<string>();
  for (const t of raw) {
    const norm = String(t ?? "").trim().toLowerCase();
    if (norm.length < 4 || FIGURE_STOP.has(norm)) continue;
    seen.add(norm);
  }
  return [...seen];
}

function realWorldNamed(sc: any): any[] {
  const ne = Array.isArray(sc?.namedExamples) ? sc.namedExamples : [];
  return ne.filter((e: any) => e?.realWorld !== false);
}

/** Pure: compute the fit metrics from a book's loaded sidecars (chapter-ordered). */
export function computeSourceFitMetrics(sidecars: any[]): SourceFitMetrics {
  const chapters = sidecars.length;
  const perChapterNamed: number[] = [];
  const perChapterFacts: number[] = [];
  const thinChapters: number[] = [];
  const factThinChapters: number[] = [];
  let totalRealWorldNamed = 0;
  let hardSpecificThinNamed = 0;
  const figureChapters = new Map<string, Set<number>>();
  const frameworkChapters = new Map<string, Set<number>>();

  sidecars.forEach((sc, i) => {
    const ch = Number(sc?.chapterNumber ?? i + 1);
    // Thinness counts ALL named illustrations (realWorld true OR false) — what the writer has to
    // dramatize from. The realWorld subset is used only for the verifiability signal below.
    const allNamed = Array.isArray(sc?.namedExamples) ? sc.namedExamples : [];
    const named = realWorldNamed(sc);
    perChapterNamed.push(allNamed.length);
    if (allNamed.length < MIN_NAMED) thinChapters.push(ch);
    totalRealWorldNamed += named.length;
    for (const e of named) {
      const hs = Array.isArray(e?.hardSpecifics) ? e.hardSpecifics : [];
      if (hs.length === 0) hardSpecificThinNamed += 1;
    }
    const facts = Array.isArray(sc?.testableFacts) ? sc.testableFacts.length : 0;
    perChapterFacts.push(facts);
    if (facts < MIN_FACTS) factThinChapters.push(ch);
    for (const fig of figureTokens(sc)) {
      if (!figureChapters.has(fig)) figureChapters.set(fig, new Set());
      figureChapters.get(fig)!.add(ch);
    }
    const frameworks = Array.isArray(sc?.frameworks) ? sc.frameworks : [];
    for (const fw of frameworks) {
      const name = String(fw?.name ?? "").trim().toLowerCase();
      if (!name) continue;
      if (!frameworkChapters.has(name)) frameworkChapters.set(name, new Set());
      frameworkChapters.get(name)!.add(ch);
    }
  });

  const topFigures = [...figureChapters.entries()]
    .map(([figure, chs]) => ({ figure, chapters: chs.size, pct: chapters > 0 ? chs.size / chapters : 0 }))
    .sort((a, b) => b.chapters - a.chapters)
    .slice(0, 5);
  const repeatedFrameworks = [...frameworkChapters.entries()]
    .map(([name, chs]) => ({ name, chapters: chs.size }))
    .filter((f) => f.chapters >= 2)
    .sort((a, b) => b.chapters - a.chapters)
    .slice(0, 5);

  return {
    chapters, perChapterNamed, thinChapters, perChapterFacts, factThinChapters,
    totalRealWorldNamed, hardSpecificThinNamed, topFigures, repeatedFrameworks,
  };
}

/** Pure: derive the advisory verdict + the human-readable risk signals. */
export function classifySourceFit(bookId: string, metrics: SourceFitMetrics): SourceFitReport {
  const { chapters } = metrics;
  const signals: string[] = [];
  let risks = 0;

  const concentrated = metrics.topFigures.filter((f) => f.pct >= FIGURE_PCT && f.chapters >= 2);
  if (concentrated.length > 0) {
    risks += 1;
    const top = concentrated.slice(0, 3).map((f) => `${f.figure} (${Math.round(f.pct * 100)}% of chapters)`).join(", ");
    signals.push(`${concentrated.length} figure(s) carry most chapters: ${top} — risks monotony / cross-chapter name reuse (F1).`);
  }
  if (chapters > 0 && metrics.thinChapters.length / chapters >= THIN_FRACTION) {
    risks += 1;
    signals.push(`${metrics.thinChapters.length}/${chapters} chapters have < ${MIN_NAMED} named illustrations (ch ${metrics.thinChapters.join(", ")}) — too thin to ground varied examples.`);
  }
  const heavyFramework = metrics.repeatedFrameworks.filter((f) => f.chapters >= FRAMEWORK_REPEAT);
  if (heavyFramework.length > 0) {
    risks += 1;
    signals.push(`framework "${heavyFramework[0].name}" recurs across ${heavyFramework[0].chapters} chapters — facets-of-one-idea; the writer will likely template a shell.`);
  }
  if (chapters > 0 && metrics.factThinChapters.length / chapters >= THIN_FRACTION) {
    risks += 1;
    signals.push(`${metrics.factThinChapters.length}/${chapters} chapters have < ${MIN_FACTS} testable facts — little distinct material to quiz/teach.`);
  }
  if (metrics.totalRealWorldNamed > 0 && metrics.hardSpecificThinNamed / metrics.totalRealWorldNamed >= 0.5) {
    risks += 1;
    signals.push(`${metrics.hardSpecificThinNamed}/${metrics.totalRealWorldNamed} real-world named cases carry NO hardSpecifics — unverifiable, likely invented.`);
  }

  const verdict: SourceFitReport["verdict"] = risks >= 2 ? "RISKY" : risks === 1 ? "WATCH" : "OK";
  return { bookId, verdict, signals, metrics };
}

export function formatSourceFit(report: SourceFitReport): string {
  const m = report.metrics;
  const L: string[] = [];
  L.push(`SOURCE FIT — ${report.bookId}: ${report.verdict}  (advisory — fit is fuzzy; never a gate)`);
  L.push(`chapters: ${m.chapters} · real-world named cases: ${m.totalRealWorldNamed} · thin chapters: ${m.thinChapters.length} · fact-thin: ${m.factThinChapters.length}`);
  if (report.signals.length > 0) {
    L.push("signals:");
    for (const s of report.signals) L.push(`  - ${s}`);
  } else {
    L.push("signals: none — the source is varied and well-unitized for v21.");
  }
  if (m.topFigures.length > 0) {
    L.push("most-repeated figures: " + m.topFigures.map((f) => `${f.figure}×${f.chapters}`).join(", "));
  }
  if (report.verdict === "RISKY") {
    L.push("recommendation: re-unitize the source (more distinct cases/figures per chapter) or choose a different book before writing.");
  } else if (report.verdict === "WATCH") {
    L.push("recommendation: proceed with eyes open — strengthen the flagged dimension during research.");
  }
  return L.join("\n");
}
