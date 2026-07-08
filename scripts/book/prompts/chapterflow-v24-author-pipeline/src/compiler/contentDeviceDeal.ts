/**
 * contentDeviceDeal — the CONTENT-MACHINERY diversity deal (v24, 2026-07-06).
 *
 * The architecture-family deal (briefRotation) varies a chapter's OPENING. But the
 * book-acceptance panel rejected start-with-why for repeated BODY machinery that
 * pervades every chapter's examples/quiz/cards regardless of opening:
 *   - a return-proof / receipt "proof must come back" device (measured 13/14 = 93%)
 *   - an invented proxy-cast standing in for the lesson             (13/14 = 93%)
 *   - a second-setting "it travels" case, a hard-detail-boundary "keep it home"
 *     warning, a named-company anchor lead, a WHY/HOW/WHAT three-part split.
 * Those devices are MANDATED to every chapter by chapter-invariant constants
 * (AUTHOR_HOUSE_RULES rules 6 & 7) and, for manual-brief books, never countered by a
 * per-chapter VARIETY deal (that section renders only when a machine brief exists).
 *
 * This module deals each chapter a rotating BAN set so no single body device
 * saturates the book: each device is banned in ~half the chapters (present in ≤~57%),
 * the ban-triples are distinct across a 6-chapter cycle, and the deal renders as an
 * ALWAYS-ON writer instruction (independent of the machine brief) so manual-brief
 * books get the variety too. The same catalog powers the contentMachinery critic
 * (detection) and the content-deal-sameness repair directive — one source of truth.
 *
 * DETERMINISTIC: bans are a pure function of (chapterNumber, totalChapters). No
 * clock, no RNG — reproducible, testable, and stable across a regen lineage.
 */

import type { ChapterV21 } from "../types.js";

export const CONTENT_DEVICE_DEAL_SCHEMA_VERSION = "content-device-deal-v1" as const;

export type ContentDeviceId =
  | "named-anchor-lead"
  | "proxy-cast"
  | "second-setting"
  | "return-proof"
  | "hard-detail-boundary"
  | "three-part-split"
  | "practice-shell";

/** Fixed order — the deal rotation and coverage math depend on this being length 7
 *  (the {i,i+1,i+3} mod 7 planar difference set below; see dealContentDeviceBans).
 *
 *  NOT (yet) in the catalog — reader-named devices we evaluated and declined (F-07):
 *    - if-then-shell ("When X, do Y" practice framing): the pipeline DEALS
 *      `if-then-trigger` IN as a *desirable* practice shape (PRACTICE_SHAPES,
 *      briefRotation.ts) up to a two-thirds (~66%) budget — which EXCEEDS this
 *      module's 60% ubiquity cap, so a book could legally deal it above the content
 *      cap. Banning it as a device would contradict the shape deal, and a single
 *      if-then sentence is legitimate. Left uncovered until the two systems' caps are
 *      reconciled (out of scope here). The recurring-CALENDAR shell — orthogonal to
 *      if-then and the actual saturator on-book — IS covered by `practice-shell`.
 *    - limit-paragraph ("honest limits / when-NOT-to" closer): already rotated for
 *      machine-brief books via LIMITS_PLACEMENTS; a precise per-chapter detector that
 *      separates the *device* from any chapter legitimately noting a limitation is not
 *      achievable by regex without false positives.
 *    - quiz-distractor-logic: requires semantic key-vs-distractor analysis, not a
 *      structural regex. */
export const CONTENT_DEVICE_IDS: ContentDeviceId[] = [
  "named-anchor-lead",
  "proxy-cast",
  "second-setting",
  "return-proof",
  "hard-detail-boundary",
  "three-part-split",
  "practice-shell",
];

export type ContentDevice = {
  id: ContentDeviceId;
  /** Human label for critic messages + repair directives. */
  label: string;
  /** What the writer is told NOT to do when this device is banned for a chapter. */
  banInstruction: string;
  /** Terse imperative form of the ban — used by the compact writer-card render (the
   *  full banInstruction rides the repair directive, which is not card-length-bound). */
  banShort: string;
  /** What the writer MAY reach for instead (the positive alternative). */
  altHint: string;
  /** Detect whether a finished chapter USES this device (critic + repair). Keyed on
   *  STRUCTURAL markers across the full reader surface, robust to lexical variation. */
  detect: (ctx: ChapterDeviceContext) => boolean;
};

/** Harvested, reusable view of a chapter for detection (built once per chapter). */
export type ChapterDeviceContext = {
  fullText: string;
  openerText: string;
  /** JUST the chapter's practice/action surface (tryThisNow + implementationPlan
   *  weeklyPractice/24h-challenge/if-then plans) — the practice-shell detector keys
   *  here, NOT on the whole body, so a stray "every Friday" inside a narrative
   *  example never trips the closer device. */
  practiceText: string;
  exampleTags: string[];
  proxyNames: string[];
  threePartHits: number;
};

// ── detectors ────────────────────────────────────────────────────────────────
// NARROWING NOTE (2026-07-07, Prompt 2): these detectors now GATE a repair revert
// (a still-present banned device reverts the draft), so a false positive would
// wrongly discard a genuinely-compliant chapter. The clauses below were tightened
// from the advisory-era originals to survive per-detector near-miss fixtures
// (tests/content-device-detectors.test.ts). Each change is justified inline; none
// weakens detection of a real device use (the deal/critic fixtures still pass).
const RETURN_PROOF_RX =
  // Narrowed: the bare `the receipt` / `a receipt` / `is a receipt` clauses fired on a
  // LITERAL receipt (a grocery/hardware receipt) unrelated to the return-proof device.
  // A receipt now counts only in the device's own "proof/promise → receipt → comes back"
  // context, so a literal receipt near-miss no longer trips it.
  /\bproof (?:that )?(?:comes|has to come|have to come|must come|travels|returns|goes|is due|owed)\b|\breturn[- ]?point\b|\breturn proof\b|(?:proof|promise|belief|trust|claim|result)[^.]{0,28}\breceipt\b|\breceipt\b[^.]{0,28}(?:comes? back|returns?|is (?:due|owed)|proves|of (?:the|a|your) (?:promise|claim|belief|why))|\bis a receipt (?:for|of|that)\b|proof (?:that )?travels back|proof[^.]{0,14}\bback\b|comes? back as proof|\bwhat (?:proof|result|receipt) (?:comes|returns|is due)/i;
const SECOND_SETTING_RX =
  // Narrowed: dropped bare `\bmeanwhile\b` — a generic narrative time-transition, not the
  // "it travels to a second setting" device; it FP'd on any chapter with a parallel-action beat.
  /\b(?:a |the )?second (?:case|story|setting|example|scene|company|team|city|car story)\b|makes? (?:the|it|this)[^.]{0,30}(?:harder to dismiss|travel)|keeps? (?:the|it|this) (?:idea|pattern|lesson|point)[^.]{0,20}(?:bounded|home)|\bin a (?:second|different) (?:setting|company|city)\b|proves it travels|shows it travels|\ba third\b[^.]{0,20}(?:case|edge|bound)/i;
const HARD_DETAIL_BOUNDARY_RX =
  // Narrowed: bare `stays? home` / `out of bounds` / `does not move` fired on literal
  // domestic ("the kids stay home"), sports ("out of bounds"), and mechanical ("the needle
  // doesn't move") usage. The boundary device is specifically about a DETAIL/FACT/NUMBER
  // staying with its case — every clause now anchors on that object.
  /(?:hard )?(?:detail|specific|number|fact)s?[^.]{0,24}(?:stays? home|belongs? (?:to|here|in)|does not (?:move|travel)|doesn.t (?:move|travel)|must stay)|keeps? (?:the|it|this|that)[^.]{0,24}(?:bounded|home)|keep (?:the|that) (?:hard )?(?:detail|number|fact|specific)|boundary (?:of|around) the (?:case|fact|detail|number)|beyond (?:the|its) (?:case|source)|don.t move the (?:detail|specific|number|fact)/i;
const NAMED_ANCHOR_RX =
  // Narrowed: dropped bare `\bKing\b` (matches a monarch / Stephen King / Burger King) and
  // bare `Gore` (Al Gore / literal "gore"); the real anchor W.L. Gore is kept via its
  // distinctive forms. Deduped the doubled `Ferrari`. Case-sensitive by design (proper nouns).
  /\b(Apple|Wright|Wilbur|Orville|Martin Luther King|Luther King|Sinek|Southwest|Herb Kelleher|Kelleher|Detroit|Honda|Toyota|American Airlines|Continental|Langley|TiVo|Ferrari|Volkswagen|Samsung|Microsoft|Starbucks)\b|W\.?L\.? Gore|Gore-Tex/;
const THREE_PART_RX =
  /\bwhy[,/ ]+how[,/ ]+(?:and )?what\b|three[- ]part (?:split|distinction|frame|structure)|separate(?:s)? (?:the )?why from|golden circle/i;
// The recurring-CALENDAR practice shell — a fixed scheduled ritual closer ("Each
// Friday…", "Every week…", "On Fridays…", a weekly review drill). This was the
// single most saturated device on the current book (~13-14/14 chapters). Keyed on
// the SHAPE (a fixed calendar cadence), NOT one book's day-of-week: any weekday,
// "each/every week|day|month|morning|shutdown", "on <weekday>s / weekends", the
// weekly/daily/nightly/monthly adverbs, and "at the end of every week/day". Event-
// or trigger-anchored practices ("before your next handoff", "when X happens",
// "…today") are deliberately EXCLUDED — they are the intended escape.
const PRACTICE_SHELL_RX =
  /\b(?:each|every)\s+(?:(?:mon|tues|wednes|thurs|fri|satur|sun)day|weekday|weekend|week|morning|evening|night|day|month|shutdown)\b|\bon\s+(?:(?:mon|tues|wednes|thurs|fri|satur|sun)days?|weekends?)\b|\b(?:weekly|daily|nightly|monthly)\b|\bat\s+the\s+end\s+of\s+(?:each|every|the)\s+(?:week|day|month)\b/i;

/** Real proper-noun names in THIS book's source — excluded from proxy detection so a
 *  real case (Kelleher, Damasio) is never mistaken for an invented proxy. Kept small
 *  and general; the critic is advisory + routing, so modest precision is acceptable. */
const REAL_NAME_RX =
  /\b(Apple|Wright|Wilbur|Orville|King|Luther|Sinek|Southwest|Kelleher|Detroit|Honda|Toyota|American|Continental|Langley|Damasio|TiVo|Ferrari|Volkswagen|Walmart|Heath|Herb|Gore|Starbucks|Microsoft|Samsung|Cupertino|Redmond|Neocortex|Brandeis)\b/;
const PROXY_STOPWORDS = new Set([
  "The", "This", "That", "Then", "When", "Here", "There", "What", "Why", "How", "Each", "Every",
  "Your", "Their", "Some", "Most", "One", "Now", "But", "And", "For", "You", "We", "It", "Its",
  "In", "On", "At", "As", "If", "So", "No", "She", "He", "They", "Trust", "Price", "Cold", "Who",
  "Pressure", "Promotion", "Belief", "Loyalty", "Proof", "Because", "After", "Before", "Once",
  "Approval", "Competition", "Comparison", "Meaning", "Purpose", "Culture", "Vision",
]);

/** Invented first-name proxies: a bare capitalized given-name (3–12 letters) acting
 *  as a clause subject with a present-tense action verb ("Colleen sorts…"), not a
 *  known real name. */
export function detectProxyNames(text: string): string[] {
  const found = new Set<string>();
  const rx =
    /(?:^|[.!?]\s+|\n|"|“)([A-Z][a-z]{2,11})\s+(reads|opens|checks|writes|walks|sits|stares|looks|notices|decides|holds|counts|asks|closes|signs|returns|waits|starts|stops|picks|sets|meets|calls|tells|shows|runs|keeps|finds|makes|tries|leaves|sorts|weighs|scans|drafts|pauses|reviews|sends|hands|marks|flags|circles)/g;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(text))) {
    const name = m[1];
    if (PROXY_STOPWORDS.has(name)) continue;
    if (REAL_NAME_RX.test(name)) continue;
    // Common-noun guard (2026-07-07, Prompt 2): a capitalized word that ALSO appears
    // LOWERCASED as a standalone word elsewhere is an ordinary noun caught at a
    // sentence start ("Approval holds…", "Competition, here…"), not an invented
    // character name — a real proxy name ("Colleen") is not written lowercased. This
    // is exclusion-only (raises precision; can never invent a proxy), and matters now
    // that proxy-cast gates a repair revert.
    if (new RegExp(`(?:^|[^A-Za-z])${name.toLowerCase()}(?![A-Za-z])`).test(text)) continue;
    found.add(name);
  }
  return [...found];
}

export const CONTENT_DEVICE_CATALOG: Record<ContentDeviceId, ContentDevice> = {
  "named-anchor-lead": {
    id: "named-anchor-lead",
    label: "famous company/founder anchor lead",
    banInstruction:
      "do NOT open this chapter on a famous company or founder (Apple, the Wright brothers, Southwest, King, etc.); lead with a different entry entirely",
    banShort: "open on a famous company/founder",
    altHint: "the reader's own moment, a research finding, a process laid out directly, a misconception, or an ordinary situation",
    detect: (c) => NAMED_ANCHOR_RX.test(c.openerText),
  },
  "proxy-cast": {
    id: "proxy-cast",
    label: "invented proxy-character cast",
    banInstruction:
      "do NOT staff this chapter with invented first-name proxy characters (a made-up 'Colleen', 'Gregoire', 'a product lead') carrying the lesson; use the reader ('you'), a real source-attested case, or an explicitly hypothetical role instead",
    banShort: "invent first-name proxy characters to carry the lesson",
    altHint: "second-person 'you' scenarios, real named cases from the packet, or 'Imagine a team…' hypotheticals",
    detect: (c) => c.proxyNames.length >= 1,
  },
  "second-setting": {
    id: "second-setting",
    label: "\"it travels\" second-setting case",
    banInstruction:
      "do NOT add a 'a second setting proves it travels' case or a third 'edge' case that bounds it; develop ONE situation fully instead",
    banShort: "add a second 'it travels' case or third 'edge' case",
    altHint: "one case followed all the way through, or a direct conceptual unfolding",
    detect: (c) => SECOND_SETTING_RX.test(c.fullText),
  },
  "return-proof": {
    id: "return-proof",
    label: "return-proof / receipt device",
    banInstruction:
      "do NOT close on the 'proof must come back / a receipt returns / return-point' reversal drill; end on the lesson itself or a different close",
    banShort: "close on a 'proof comes back / receipt / return-point' drill",
    altHint: "a plain takeaway, a forward-looking application, or a question that lingers",
    detect: (c) => RETURN_PROOF_RX.test(c.fullText) || c.exampleTags.some((t) => /return proof|receipt|proof back/.test(t)),
  },
  "hard-detail-boundary": {
    id: "hard-detail-boundary",
    label: "hard-detail 'stays home' boundary warning",
    banInstruction:
      "do NOT repeat the 'keep the hard detail home / don't move the specific' source-boundary rhetoric; if a specific belongs to one case, simply use it there without narrating the boundary",
    banShort: "repeat 'keep the hard detail home' boundary rhetoric",
    altHint: "just teach the detail in place; trust the reader without the boundary sermon",
    detect: (c) => HARD_DETAIL_BOUNDARY_RX.test(c.fullText),
  },
  "three-part-split": {
    id: "three-part-split",
    label: "WHY/HOW/WHAT three-part split device",
    banInstruction:
      "do NOT structure this chapter as a WHY/HOW/WHAT (or any three-part) split; carry the idea in a single line of development",
    banShort: "structure as a WHY/HOW/WHAT (three-part) split",
    altHint: "one continuous thread rather than a triad",
    detect: (c) => c.threePartHits >= 1,
  },
  "practice-shell": {
    id: "practice-shell",
    label: "recurring scheduled-ritual practice shell",
    banInstruction:
      "do NOT frame this chapter's practice as a fixed recurring calendar ritual (an 'Each Friday…' / 'Every week…' / weekly-review drill); anchor the practice to a triggering moment or a one-time setup instead",
    banShort: "frame the practice as a fixed 'Each Friday / every week' calendar ritual",
    altHint: "attach the practice to a triggering moment ('the next time you catch yourself…', 'before your next handoff…'), a one-time setup, or a threshold ('when the count crosses…') — a real recurring habit is fine, just not a fixed calendar shell",
    detect: (c) => PRACTICE_SHELL_RX.test(c.practiceText),
  },
};

// ── the deal ─────────────────────────────────────────────────────────────────

/** Ban 3 of the 7 devices per chapter via the cyclic planar difference set
 *  {i, i+1, i+3} mod 7. {0,1,3} is the classic (7,3,1) planar difference set: its
 *  pairwise differences hit every nonzero residue mod 7 exactly once, so over a
 *  7-chapter cycle every device is banned in EXACTLY 3 chapters (present ≈57.1% ≤
 *  60%), the seven ban-triples are all distinct, and every pair of chapters shares a
 *  predictable, bounded overlap — so no device saturates the book and the deal itself
 *  is not a template. (Was {i,i+1,i+3} mod 6 for the 6-device catalog; extended to 7
 *  with the practice-shell device — 7 is prime so the difference-set property holds.) */
export function dealContentDeviceBans(chapterNumber: number, totalChapters: number): ContentDeviceId[] {
  if (totalChapters < 4) return []; // book-level diversity is only meaningful at book scale
  const M = CONTENT_DEVICE_IDS.length; // 7
  const i = (chapterNumber - 1) % M;
  const idx = [i % M, (i + 1) % M, (i + 3) % M];
  return [...new Set(idx)].map((k) => CONTENT_DEVICE_IDS[k]);
}

/** The allowed (non-banned) devices for a chapter. */
export function dealContentDeviceAllows(chapterNumber: number, totalChapters: number): ContentDeviceId[] {
  const banned = new Set(dealContentDeviceBans(chapterNumber, totalChapters));
  return CONTENT_DEVICE_IDS.filter((id) => !banned.has(id));
}

/** Render the dealt content-device bans as EXPLICIT writer-card lines. Fires for
 *  manual-brief books too (unlike the machine-brief VARIETY section). */
export function contentDeviceDealLines(chapterNumber: number, totalChapters: number): string[] {
  const banned = dealContentDeviceBans(chapterNumber, totalChapters);
  if (banned.length === 0) return [];
  // Compact (card-length-bound): short ban forms on one line + a fixed prefer/escape.
  // The full banInstruction + per-device alternatives ride the content-deal repair
  // directive, which is not card-length-bound.
  const lines = [
    "CONTENT DEVICES (dealt for this chapter — non-negotiable; keeps the BOOK from reading as one template)",
    `Do NOT lean on these body devices here (they belong to other chapters): ${banned.map((id) => CONTENT_DEVICE_CATALOG[id].banShort).join("; ")}.`,
    "Prefer varied forms — the reader's own moment, a real source case, or an explicit hypothetical. If the source makes a banned device unavoidable for one fact, use it once, minimally — never as the spine. Never invent facts for variety.",
  ];
  return lines;
}

/** Build the detection context for a finished chapter (used by the critic + repair). */
export function buildChapterDeviceContext(ch: ChapterV21): ChapterDeviceContext {
  const parts: string[] = [];
  const push = (v: unknown) => { if (typeof v === "string" && v) parts.push(v); };
  push(ch.hook); push(ch.counterintuition); push(ch.tryThisNow); push(ch.keyTakeaway);
  const b = ch.breakdown ?? ({} as NonNullable<ChapterV21["breakdown"]>);
  push(b.fastRead); push(b.deepRead); push(b.fullRead);
  const exampleTags: string[] = [];
  for (const e of ch.examples ?? []) {
    push(e.title); push((e as { scenario?: string }).scenario); push((e as { whatToDo?: string }).whatToDo); push((e as { whyItMatters?: string }).whyItMatters);
    for (const t of (e as { tags?: string[] }).tags ?? []) { push(t); exampleTags.push(String(t).toLowerCase()); }
  }
  for (const c of ch.reviewCards ?? []) { push((c as { front?: string }).front); push((c as { back?: string }).back); }
  const quiz = ch.quiz as unknown;
  const qs = Array.isArray(quiz) ? quiz : ((quiz as { questions?: unknown[] })?.questions ?? []);
  for (const q of qs as Array<Record<string, unknown>>) {
    push(q.prompt ?? q.stem ?? q.question);
    for (const o of (q.choices as unknown[]) ?? (q.options as unknown[]) ?? []) push(typeof o === "string" ? o : (o as { text?: string })?.text);
    push(q.explanation);
  }
  for (const m of ch.memorableLines ?? []) push(typeof m === "string" ? m : (m as { text?: string })?.text);
  const fullText = parts.join("\n");
  const openerText = `${ch.hook ?? ""}\n${b.fastRead ?? ""}`.slice(0, 400);

  // Practice/action surface only — where the recurring-ritual closer lives. Built
  // separately from fullText so the practice-shell detector never trips on a stray
  // calendar word inside a narrative example.
  const practiceParts: string[] = [];
  const pushP = (v: unknown) => { if (typeof v === "string" && v) practiceParts.push(v); };
  pushP(ch.tryThisNow);
  const ip = (ch.implementationPlan ?? {}) as Partial<ChapterV21["implementationPlan"]>;
  pushP(ip.weeklyPractice);
  pushP(ip.twentyFourHourChallenge);
  for (const p of ip.ifThenPlans ?? []) { pushP((p as { context?: string }).context); pushP((p as { plan?: string }).plan); }

  return {
    fullText,
    openerText,
    practiceText: practiceParts.join("\n"),
    exampleTags,
    proxyNames: detectProxyNames(fullText),
    threePartHits: (fullText.match(THREE_PART_RX) ?? []).length,
  };
}

/** Which body devices a finished chapter USES (via the catalog detectors). */
export function detectChapterDevices(ch: ChapterV21): Set<ContentDeviceId> {
  const ctx = buildChapterDeviceContext(ch);
  const used = new Set<ContentDeviceId>();
  for (const id of CONTENT_DEVICE_IDS) if (CONTENT_DEVICE_CATALOG[id].detect(ctx)) used.add(id);
  return used;
}

// ── match evidence (for the repair driver's honest logging) ───────────────────

/** A short, whitespace-collapsed window around a regex hit in `text`, for logs. */
function windowAround(text: string, rx: RegExp, span = 44): string | null {
  const m = rx.exec(text);
  if (!m) return null;
  const start = Math.max(0, m.index - 8);
  const raw = text.slice(start, m.index + m[0].length + span).replace(/\s+/g, " ").trim();
  return raw.length > 88 ? `${raw.slice(0, 85)}…` : raw;
}

/** The evidence snippet for a device the chapter USES — what actually tripped the
 *  detector — so a devices-persisted revert can name the offending phrase, not just
 *  the device id. Returns null when the device is not present. */
export function chapterDeviceMatchSnippet(ctx: ChapterDeviceContext, id: ContentDeviceId): string | null {
  switch (id) {
    case "named-anchor-lead":
      return windowAround(ctx.openerText, NAMED_ANCHOR_RX);
    case "proxy-cast":
      return ctx.proxyNames.length > 0 ? `invented name(s): ${ctx.proxyNames.slice(0, 3).join(", ")}` : null;
    case "second-setting":
      return windowAround(ctx.fullText, SECOND_SETTING_RX);
    case "return-proof": {
      const rx = windowAround(ctx.fullText, RETURN_PROOF_RX);
      if (rx) return rx;
      const tag = ctx.exampleTags.find((t) => /return proof|receipt|proof back/.test(t));
      return tag ? `example tag: ${tag}` : null;
    }
    case "hard-detail-boundary":
      return windowAround(ctx.fullText, HARD_DETAIL_BOUNDARY_RX);
    case "three-part-split":
      return windowAround(ctx.fullText, THREE_PART_RX);
    case "practice-shell":
      return windowAround(ctx.practiceText, PRACTICE_SHELL_RX);
  }
}

/** Detected devices → their evidence snippet (device label when no snippet). Builds
 *  the context once. Used by the repair driver to log which devices persisted. */
export function detectChapterDeviceMatches(ch: ChapterV21): Array<{ id: ContentDeviceId; snippet: string }> {
  const ctx = buildChapterDeviceContext(ch);
  const out: Array<{ id: ContentDeviceId; snippet: string }> = [];
  for (const id of CONTENT_DEVICE_IDS) {
    if (!CONTENT_DEVICE_CATALOG[id].detect(ctx)) continue;
    out.push({ id, snippet: chapterDeviceMatchSnippet(ctx, id) ?? CONTENT_DEVICE_CATALOG[id].label });
  }
  return out;
}

export type ChapterDeviceDiff = {
  /** Banned devices STILL present on the fresh bytes (a persisted-device revert trigger). */
  persisted: ContentDeviceId[];
  /** Non-banned devices newly present vs the prior bytes (balloon-effect telemetry only). */
  substituted: ContentDeviceId[];
};

/** Pure decision for the device-verify keep/revert: given the device sets before and
 *  after a re-author and the ban list, which banned devices persisted (→ revert) and
 *  which NEW non-banned devices appeared (→ substitution telemetry, never a revert).
 *  Results are returned in the fixed catalog order for stable logs/tests. */
export function diffChapterDeviceUse(
  before: Set<ContentDeviceId>,
  after: Set<ContentDeviceId>,
  banned: Iterable<ContentDeviceId>,
): ChapterDeviceDiff {
  const banSet = new Set(banned);
  const inOrder = (pred: (id: ContentDeviceId) => boolean) => CONTENT_DEVICE_IDS.filter(pred);
  return {
    persisted: inOrder((id) => after.has(id) && banSet.has(id)),
    substituted: inOrder((id) => after.has(id) && !banSet.has(id) && !before.has(id)),
  };
}
