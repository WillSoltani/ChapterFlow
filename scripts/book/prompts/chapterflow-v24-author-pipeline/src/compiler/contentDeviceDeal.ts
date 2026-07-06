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
  | "three-part-split";

/** Fixed order — the deal rotation and coverage math depend on this being length 6. */
export const CONTENT_DEVICE_IDS: ContentDeviceId[] = [
  "named-anchor-lead",
  "proxy-cast",
  "second-setting",
  "return-proof",
  "hard-detail-boundary",
  "three-part-split",
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
  exampleTags: string[];
  proxyNames: string[];
  threePartHits: number;
};

// ── detectors ────────────────────────────────────────────────────────────────
const RETURN_PROOF_RX =
  /\bproof (?:that )?(?:comes|has to come|have to come|must come|travels|returns|goes|is due|owed)\b|\breturn[- ]?point\b|\breturn proof\b|\bis a receipt\b|\bthe receipt\b|\ba receipt\b|proof (?:that )?travels back|proof[^.]{0,14}\bback\b|comes? back as proof|\bwhat (?:proof|result|receipt) (?:comes|returns|is due)/i;
const SECOND_SETTING_RX =
  /\b(?:a |the )?second (?:case|story|setting|example|scene|company|team|city|car story)\b|\bmeanwhile\b|makes? (?:the|it|this)[^.]{0,30}(?:harder to dismiss|travel)|keeps? (?:the|it|this) (?:idea|pattern|lesson|point)[^.]{0,20}(?:bounded|home)|\bin a (?:second|different) (?:setting|company|city)\b|proves it travels|shows it travels|\ba third\b[^.]{0,20}(?:case|edge|bound)/i;
const HARD_DETAIL_BOUNDARY_RX =
  /\bstays? home\b|\bstay home\b|keeps? (?:the|it|this)[^.]{0,20}bounded|do(?:es)? not move|don.t move|hard (?:detail|specific|number|fact)s?[^.]{0,20}(?:stay|belong|must|home)|boundary (?:of|around) the (?:case|fact|detail)|keep (?:the|that) (?:hard )?(?:detail|number|fact)|out of bounds|beyond (?:the|its) (?:case|source)/i;
const NAMED_ANCHOR_RX =
  /\b(Apple|Wright|Wilbur|Orville|Martin Luther King|Luther King|\bKing\b|Sinek|Southwest|Kelleher|Herb Kelleher|Detroit|Honda|Toyota|American Airlines|Continental|Langley|TiVo|Ferrari|Volkswagen|Samsung|Microsoft|Ferrari|Gore|Starbucks)\b/;
const THREE_PART_RX =
  /\bwhy[,/ ]+how[,/ ]+(?:and )?what\b|three[- ]part (?:split|distinction|frame|structure)|separate(?:s)? (?:the )?why from|golden circle/i;

/** Real proper-noun names in THIS book's source — excluded from proxy detection so a
 *  real case (Kelleher, Damasio) is never mistaken for an invented proxy. Kept small
 *  and general; the critic is advisory + routing, so modest precision is acceptable. */
const REAL_NAME_RX =
  /\b(Apple|Wright|Wilbur|Orville|King|Luther|Sinek|Southwest|Kelleher|Detroit|Honda|Toyota|American|Continental|Langley|Damasio|TiVo|Ferrari|Volkswagen|Walmart|Heath|Herb|Gore|Starbucks|Microsoft|Samsung)\b/;
const PROXY_STOPWORDS = new Set([
  "The", "This", "That", "Then", "When", "Here", "There", "What", "Why", "How", "Each", "Every",
  "Your", "Their", "Some", "Most", "One", "Now", "But", "And", "For", "You", "We", "It", "Its",
  "In", "On", "At", "As", "If", "So", "No", "She", "He", "They", "Trust", "Price", "Cold", "Who",
  "Pressure", "Promotion", "Belief", "Loyalty", "Proof", "Because", "After", "Before", "Once",
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
};

// ── the deal ─────────────────────────────────────────────────────────────────

/** Ban 3 of the 6 devices per chapter via a cyclic difference set {i, i+1, i+3} mod
 *  6. Over a 6-chapter cycle every device is banned in exactly 3 chapters (≈50%),
 *  the six ban-triples are all distinct, and adjacent chapters share ≤1 banned
 *  device — so no device saturates the book and the deal itself is not a template. */
export function dealContentDeviceBans(chapterNumber: number, totalChapters: number): ContentDeviceId[] {
  if (totalChapters < 4) return []; // book-level diversity is only meaningful at book scale
  const i = (chapterNumber - 1) % 6;
  const idx = [i % 6, (i + 1) % 6, (i + 3) % 6];
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
  return {
    fullText,
    openerText,
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
