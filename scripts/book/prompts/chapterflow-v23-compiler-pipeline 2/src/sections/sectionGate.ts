import { existsSync } from "fs";

import {
  SECTION_ARTIFACT_SCHEMA_VERSION,
  SECTION_KINDS,
  type ActionPackV1,
  type ChapterBlueprintV1,
  type ExamplePackV1,
  type LearningPackV1,
  type SectionKind,
  type SectionPackV1,
  type SourcePacketV1,
  type SummaryPackV1,
} from "../artifacts/artifactTypes.js";
import { blueprintPath, readJsonFile, sectionPath, sourcePacketPath, type CompilerStoreRoots } from "../artifacts/artifactStore.js";
import { resolveExpectedSourceChapters } from "../qc/sourceV2Gate.js";
import { normSlug } from "../lib/chapterPaths.js";
import { checkSentenceSanity } from "../critics/integrity.js";
import { checkReadingLevel } from "../critics/readingLevel.js";
import { loadBannedPhrases } from "../critics/shared.js";
import { checkBannedPhrases } from "../critics/register.js";
import { longestCommonRunWords, sidecarSourceText } from "../critics/authoringContract.js";
import { GLOBAL_RESERVED_SOURCE_FIGURE_NAMES, protectedSourceNames, sourceNameActorPattern } from "../compiler/sourceNames.js";
import { extractNamesFromText } from "../librarian/libraryState.js";
import { loadVenuePalette } from "../librarian/venuePlan.js";
import { memorableLineScore } from "../optimizers/memorableLines.js";
import type { SourceClaimType } from "../types.js";

export type SectionFinding = {
  checkId: string;
  severity: "blocker" | "advisory";
  chapterNumber?: number;
  section?: SectionKind;
  path?: string;
  message: string;
};

export type SectionGateReport = {
  bookId: string;
  passed: boolean;
  chaptersChecked: number;
  findings: SectionFinding[];
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

const STRAWMAN_DISTRACTOR_ABSOLUTE_RE = /\b(always|never|automatically|impossible|guaranteed|entirely|ever|forever|completely|wholly|absolutely|under no circumstances|in all cases)\b/i;
const SOURCE_NUMBERING_LEAK_RE = /\b(?:fact|source)\s+\d+\b|\bch\d{2}\.(?:fact|example)\.\d+\b/i;
const QUIZ_MECHANICAL_TAILS = [
  "under the stated evidence test",
  "after checking the concrete source condition",
] as const;
const BLOOMS_LEVELS = new Set(["remember", "understand", "apply", "analyze", "evaluate", "create"]);
const DEPTH_LEVELS = new Set(["simple", "standard", "deep"]);
const EXAMPLE_ID_RE = /^(?:ex\d{2}|ch\d{2}-ex\d{2}(?:-[a-z0-9][a-z0-9-]*)?)$/;
const LOWERCASE_MECHANICAL_SENTENCE_TAIL_RE = /[.!?]\s+(?:under|after checking|based on|given|using)\b/;
const LOWERCASE_SENTENCE_START_RE = /[.!?]\s+([a-z][a-z][^.!?]{10,})/g;
const TERMINAL_PUNCTUATION_RE = /[.!?"')\]\u201D\u2019\u201C\u2018]\s*$/;
const PROP_SUBJECT_TITLE_RE =
  /^(?:the\s+)?(?:[a-z][a-z-]*\s+){0,2}(?:ledger|card|blotter|slip|capture|folder|memo|worksheet|binder|note|ticket|grid|schedule|page|sheet|screen|dashboard|spreadsheet|tablet|docket|form)\s+(?:reviews?|marks?|circles?|tabs?|questions?|annotates?|tests?|sorts?|checks?|flags?|indexes?|weighs?|traces?|files?|screens?|studies?|compares?)\b/i;
const COMPASS_SCAFFOLD_RE =
  /\b(?:north|south|east|west)(?:seal|ledger|anchor|folder)\b|\b(?:north|south|east|west)\s+(?:alcove|desk|shelf|rail)\b[^.?!]{0,220}\bstays\s+closed\b/i;
const SOURCE_LABEL_ARRANGEMENT_RE =
  /^(?:compare|hold|weigh|screen|trace|mark|circle|annotate|index|file|sort|test|question|review)\b[^.;]{0,140}\b(?:beside|against|with)\b[^.;]{0,100}\b(?:settle|resolve|prove|show|check)\b/i;
const SYNTHETIC_STAYS_CLOSED_RE =
  /\bthe\s+[a-z]{3,}(?:filter|signal|docket|clause|marker|compass|engine|seal|ledger|anchor|folder)\s+stays\s+closed\b/i;
const SYNTHETIC_BESIDE_TOWARD_RE =
  /\bbeside\s+(?:a|an|the)\s+[a-z]+(?:\s+[a-z]+){0,2}\s*;\s*the\s+[a-z]+(?:\s+[a-z]+){0,3}\s+(?:records|routes|files|holds|braces|slows|separates|moves|marks|keeps)\s+the\s+page\s+toward\s+(?:a|an|the)\s+[a-z]+(?:\s+[a-z]+){0,3}/i;
const SYNTHETIC_COMPOUND_TOKEN_RE =
  /\b[a-z]{3,}(?:filter|signal|docket|clause|marker|compass|engine|seal)\b|\b[a-z]{3,}(?:riskcard|bondnote)\b/i;
const SCENE_DECISION_RE =
  /\b(decid(?:e|es|ed|ing)|choos(?:e|es|ing)|choice|whether|has to|must|risk|tradeoff|before|after|cost|mistake|default|friction|push(?:es|ed)? back|notices?|realizes?|deadline|tries|fails?|repair(?:s|ed|ing)?|changes?)\b/i;
const ACTION_CONTEXT_TRIGGER_RE = /^(before|when|after|while|as|during|once)\b/i;
const STOCK_SCENE_OPENER_RE = /^\s*[A-Z][a-z]+\s+is\s+(?:on a phone call|at the front desk)\b/i;
const GENERIC_ACTION_CONTAINER_RE =
  /\b(?:budget app|shared spreadsheet|calendar reminder|service counter|notebook margin|team chat|planning call|benefits office counter|calendar block|service desk|tradeoff memo|prospectus packet|broker statement|portfolio policy file|bond quote sheet|allocation worksheet|research queue)\b/gi;
const FINANCE_DOCUMENT_CONTAINER_RE =
  /\b(?:prospectus packet|broker statement|portfolio policy file|bond quote sheet|allocation worksheet|research queue|tradeoff memo|approval line|buy note|policy file|quote sheet)\b/i;
const DOCUMENT_SHORTCUT_REPAIR_FRAME_RE =
  /\b(?:old default|old habit|default fails?|shortcut|signed pile|starts approving|highest-yield|best-looking|repair(?:ed|s)?|recasts?|revises?|catches?)\b/i;
const SHORTCUT_DEFAULT_FAILURE_FRAME_RE =
  /\b(?:(?:old|usual|familiar|automatic)\s+(?:default|shortcut|habit|test|instinct|screen|rule)|(?:default|shortcut|habit|test|instinct|screen|rule)\s+fails?|(?:had\s+been|was|is)\s+ready\s+to\s+(?:approve|buy|accept|choose|trust|send|keep)|ready\s+to\s+(?:approve|buy|accept|choose|trust|send|keep)\s+because)\b/i;
const DECIDES_AFTER_NOT_BEFORE_RE =
  /\b[A-Z][a-z]+\s+decides?\s+after\b[^!?]{2,180}\bnot\s+before\b/i;
const PENDING_UNTIL_EVIDENCE_GATE_RE =
  /\b(?:(?:pending|unresolved|unfinished|unapproved)\s+until|(?:remain|remains|stay|stays|keep|keeps|left|leaves|changed|changes|becomes|mark|marks|park|parks)[^.?!]{0,90}\b(?:pending|unresolved|unfinished|unapproved|under\s+(?:review|study)|off\s+the\s+list)[^.?!]{0,120}\b(?:until|only\s+if|only\s+after)|(?:purchase|candidate|stock|bond|holding|trade|order|entry|answer|recommendation|decision|choice)[^.?!]{0,80}\b(?:allowed|eligible|accepted|approved|unplaced|idle|under\s+study|under\s+review|off\s+the\s+list|open)[^.?!]{0,120}\b(?:until|only\s+if|only\s+after))\b/i;
const PARTIAL_NEXT_ACTION_CLOSE_RE =
  /\b(?:(?:only\s+)?(?:a\s+)?partial\s+(?:answer|result|outcome|memo)|(?:answer|result|outcome)\s+(?:is|becomes|remains)\s+(?:only\s+)?partial|gives?\s+only\s+a\s+partial\s+(?:answer|result|outcome))\b[^.?!]{0,260}\b(?:next\s+action|next\s+review|later\s+(?:review|evidence|check)|further\s+(?:review|evidence|check)|more\s+evidence|better\s+evidence|still\s+(?:has|have)\s+to|approval\s+waits?|cannot\s+prove|until)\b/i;
const WAITING_ANSWER_SCENE_RE =
  /\b(?:while|as|with)\s+(?:[A-Z][a-z]+|another\s+person|someone|a\s+relative|the\s+group)\s+(?:waits?|asks?|press(?:es)?|wants?|expects?|needs?)\b/i;
const ACTION_PENDING_TEMPLATE_UNIT_RE =
  /\b(?:create|open|add|write|make|set\s+up|use|run)\b[\s\S]{0,180}\b(?:template|row|gate|blank|blanks|line|lines|checkpoint|checkpoints|saved|scoreboard)\b[\s\S]{0,260}\b(?:keep|leave|hold|mark|block)\b[\s\S]{0,100}\b(?:pending|unused|open|blocked|off\s+(?:the\s+)?list|unapproved)\b[\s\S]{0,180}\b(?:blank|blanks|line|lines|checkpoint|checkpoints|filled|evidence|checked|complete)\b/i;
const BROAD_PROCESS_ONE_POINT_RE =
  /\b(?:whole|entire|every|all)\b[^.?!]{0,140}\b(?:process|routine|flow|session|shift|orientation|handoff|interaction|experience|minute|minutes)\b[\s\S]{0,260}\b(?:one|single|focused|targeted|loaded)\b[^.?!]{0,120}\b(?:point|moment|intervention|change|move|handoff|gesture)\b|\b(?:one|single|focused|targeted|loaded)\b[^.?!]{0,120}\b(?:point|moment|intervention|change|move|handoff|gesture)\b[\s\S]{0,260}\b(?:whole|entire|every|all)\b[^.?!]{0,140}\b(?:process|routine|flow|session|shift|orientation|handoff|interaction|experience|minute|minutes)\b/i;
const PLEASANT_AVERAGE_PEAK_END_RE =
  /\b(?:pleasant|smooth|average|ordinary|mildly nicer|slightly warmer|basics)\b[^.?!]{0,220}\b(?:average|condition|middle|service|exchange|tone|routine|experience|trip)\b[\s\S]{0,340}\b(?:peak|high point|low point|ending|standout|salient|memorable|retell|remember|recall)\b|\b(?:peak|high point|low point|ending|standout|salient|memorable|retell|remember|recall)\b[\s\S]{0,340}\b(?:pleasant|smooth|average|ordinary|mildly nicer|slightly warmer|basics)\b[^.?!]{0,220}\b(?:average|condition|middle|service|exchange|tone|routine|experience|trip)\b/i;
const ACTION_CLASSIFY_LEVER_PRACTICE_RE =
  /\b(?:transition|milestone|pit)\b[\s\S]{0,220}\b(?:lever|elevation|insight|pride|connection|emotional route)\b[\s\S]{0,220}\b(?:attention|meaning|memory|social interpretation|shared feeling)\b/i;
const ACTION_SOCIAL_PRESSURE_PAUSE_RE =
  /\bsocial\s+pressure\b[\s\S]{0,240}\b(?:pause\s+for\s+evidence|evidence-first\s+pause|pause[^.?!]{0,50}\bevidence)\b|\b(?:pause\s+for\s+evidence|evidence-first\s+pause|pause[^.?!]{0,50}\bevidence)\b[\s\S]{0,240}\bsocial\s+pressure\b/i;
const READER_SENTENCE_SEAM_RE_LIST: RegExp[] = [
  /\b(?:or\s+creates|or\s+strengthens?|strengthens?|bends?\s+around|carry|carries)\s+(?:A|An|The|One|Truth|Purpose|Connection|Pride|Elevation|Insight)\b/,
  /\bThis\s+(?:applies|uses)\s+the\s+[^.?!]{2,90}\s+(?:is useful|matters)\s+because\b/i,
  /\bor\s+a\s+[^.?!]{1,70}\b(?:mark|drill|question|challenge|gift)\s+the\s+[a-z][^.?!]{0,80}\bdecides\b/i,
  /\bA\s+U\.S\.\s+The\b/,
  /\bThey\s+remember\s+one\s+chosen\b/i,
];
const OPENING_SHAPE_MIN_CHAPTERS = 3;
const SHORTCUT_DEFAULT_FRAME_MIN_CHAPTERS = 3;
const DECIDES_AFTER_FRAME_MIN_CHAPTERS = 3;
const PENDING_UNTIL_FRAME_MIN_CHAPTERS = 6;
const PARTIAL_NEXT_ACTION_FRAME_MIN_CHAPTERS = 5;
const WAITING_ANSWER_FRAME_MIN_CHAPTERS = 5;
const ACTION_PENDING_TEMPLATE_MIN_CHAPTERS = 5;
const BROAD_PROCESS_ONE_POINT_MIN_CHAPTERS = 5;
const PLEASANT_AVERAGE_PEAK_END_MIN_CHAPTERS = 5;
const ACTION_CLASSIFY_LEVER_MIN_CHAPTERS = 4;
const ACTION_SOCIAL_PRESSURE_PAUSE_MIN_CHAPTERS = 4;
const CROSS_FIELD_SIMILARITY_THRESHOLD = 0.75;
const SUMMARY_SHARED_NGRAM_FLOOR = 20;
const EXAMPLE_TEMPLATE_NGRAM = 5;
const COMMON_WORDS = new Set(["a", "an", "and", "are", "as", "at", "be", "because", "before", "but", "by", "for", "from", "has", "in", "into", "is", "it", "not", "of", "on", "or", "that", "the", "then", "this", "to", "when", "with"]);
const JAMMED_PROPER_NOUNS_RE = /\b(?:[A-Z][a-z]{3,}){2,}\b/g;
const CAMELCASE_BRAND_ALLOWLIST = new Set<string>([
  "PowerPoint", "SharePoint", "OpenTable", "LandRover", "FaceTime", "SoundCloud",
  "WordPress", "DoorDash", "MailChimp", "MasterCard", "QuickBooks", "TaskRabbit",
  "ClassPass", "DeepMind", "SurveyMonkey", "PostMates", "MoviePass", "NerdWallet",
  "SalesForce", "BlackBerry", "AstraZeneca",
]);
const LITERAL_NGRAM_WINDOW = 5;
const SOURCE_PASTE_WORD_FLOOR = 14;
// Mirror book-gate BP13: a five-token verbatim phrase with only two
// meaningful tokens is still a shipping blocker once it repeats across
// chapters ("stake-fit rule because a", "red phone by the pool", etc.).
const SECTION_BP13_MIN_CONTENT_TOKENS = 2;
const AS10_MIN_OTHER_CHAPTERS = 2;
const TRY_THIS_NOW_OPENER_WORDS = 5;
const TRY_THIS_NOW_OPENER_MIN_WORDS = 4;
const ACTION_CHALLENGE_OPENER_WORDS = 3;
const ACTION_CHALLENGE_OPENER_MIN_CHAPTERS = 4;
const SUMMARY_HOOK_FIRST_WORD_MIN_CHAPTERS = 5;
const SUMMARY_HOOK_FIRST_WORD_CAP = 0.5;
const NGRAM_STOPWORDS = new Set<string>([
  "the", "and", "that", "this", "with", "from", "have", "were", "will",
  "what", "when", "where", "which", "while", "their", "them", "they",
  "these", "those", "then", "than", "into", "over", "under", "about",
  "after", "before", "because", "could", "would", "should", "might",
  "still", "just", "also", "very", "more", "most", "some", "many",
  "much", "other", "another", "here", "there", "both",
]);
const SOURCE_ALIGNMENT_STOP_WORDS = new Set([
  ...COMMON_WORDS,
  "about", "again", "against", "being", "chapter", "claim", "could", "decision", "does", "enough", "every", "example",
  "helps", "make", "makes", "more", "reader", "should", "source", "still", "than", "their", "there", "these", "through",
  "what", "where", "which", "while", "without", "works", "would",
]);
const QUIZ_TAIL_GENERIC_WORDS = new Set([
  "available", "choice", "condition", "concrete", "constraints", "decision", "evidence", "pressure", "rationale", "signal", "source", "stated", "test",
]);

let _venuePatterns: Map<string, RegExp[]> | null = null;

function wordCount(value: unknown): number {
  const s = text(value);
  return s ? s.split(/\s+/).filter(Boolean).length : 0;
}

function looksLikeActionTriggerContext(value: unknown): boolean {
  const s = text(value);
  if (!s) return false;
  const words = s.split(/\s+/).filter(Boolean).length;
  return words >= 4 || (words >= 3 && ACTION_CONTEXT_TRIGGER_RE.test(s));
}

function validateAnchorIds(ids: unknown, allowed: Set<string>, findingPrefix: string): string[] {
  const arr = Array.isArray(ids) ? ids : [];
  if (arr.length === 0) return [`${findingPrefix} must cite at least one sourceAnchorId`];
  const problems: string[] = [];
  for (const id of arr) if (typeof id !== "string" || !allowed.has(id)) problems.push(`${findingPrefix} cites unsupported anchor ${JSON.stringify(id)}`);
  return problems;
}

function anchorArray(ids: unknown): string[] {
  if (Array.isArray(ids)) return ids.filter((id): id is string => typeof id === "string" && id.trim().length > 0);
  if (typeof ids === "string" && ids.trim().length > 0) return [ids];
  return [];
}

function validateAnchorClaimType(
  ids: unknown,
  anchors: Map<string, SourcePacketV1["allowedAnchors"][number]>,
  claimType: SourceClaimType,
  label: string,
): string[] {
  const problems: string[] = [];
  for (const id of anchorArray(ids)) {
    const anchor = anchors.get(id);
    if (anchor && !anchor.supportsClaimTypes?.includes(claimType)) {
      problems.push(`${label} cites ${id} (${anchor.kind}) but that anchor does not support ${claimType} claims`);
    }
  }
  return problems;
}

function validateAnchorHardSpecifics(
  ids: unknown,
  anchors: Map<string, SourcePacketV1["allowedAnchors"][number]>,
  claimType: SourceClaimType,
  value: unknown,
  label: string,
): string[] {
  const haystack = text(value).toLowerCase();
  const problems: string[] = [];
  for (const id of anchorArray(ids)) {
    const anchor = anchors.get(id);
    if (!anchor?.supportsClaimTypes?.includes(claimType)) continue;
    const specifics = anchor.hardSpecifics ?? [];
    if (specifics.length < 2) continue;
    const present = specifics.filter((specific) => specific && haystack.includes(specific.toLowerCase())).length;
    if (present < 2) {
      problems.push(`${label} cites ${id} but uses ${present}/2 required hardSpecifics verbatim; build the unit from the anchor's concrete details`);
    }
  }
  return problems;
}

function scoredMemorableSentences(value: unknown): Array<{ text: string; score: number }> {
  return text(value)
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .map((sentence) => ({ text: sentence, score: memorableLineScore(sentence) }))
    .filter((candidate) => candidate.score > 0);
}

function sourceFactIdsFromAnchors(blueprint: ChapterBlueprintV1): Set<string> {
  return new Set([...blueprint.constraints.allowedFactIds, ...blueprint.constraints.allowedCaseIds]);
}

function sourceAnchorIds(packet: SourcePacketV1): Set<string> {
  return new Set(packet.allowedAnchors.map((a) => a.id));
}

function sourceAnchorById(packet: SourcePacketV1): Map<string, SourcePacketV1["allowedAnchors"][number]> {
  return new Map(packet.allowedAnchors.map((a) => [a.id, a]));
}

function normalizePhrase(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function venuePatterns(): Map<string, RegExp[]> {
  if (_venuePatterns) return _venuePatterns;
  const aliases = new Map<string, RegExp[]>();
  const venues = [...loadVenuePalette(), "kitchen table", "conference room", "break room"];
  for (const rawVenue of venues) {
    const venue = rawVenue.trim().toLowerCase();
    if (!venue) continue;
    const variants = new Set<string>([venue, venue.replace(/^(a|an)\s+/, "")]);
    aliases.set(
      venue.replace(/^(a|an)\s+/, ""),
      Array.from(variants).map((variant) => new RegExp(`\\b${escapeRegex(variant)}\\b`, "i")),
    );
  }
  _venuePatterns = aliases;
  return aliases;
}

function sourcePhrases(packet: SourcePacketV1): string[] {
  return [
    ...packet.namedCases.flatMap((c) => [c.label, ...c.hardSpecifics]),
    ...packet.allowedEntities,
    ...packet.allowedNumbers,
  ]
    .map(normalizePhrase)
    .filter((s) => s.length >= 4);
}

function sourceMentionNames(packet: SourcePacketV1): Set<string> {
  return new Set([
    ...packet.allowedEntities.flatMap((entity) => extractNamesFromText(entity)),
    ...packet.namedCases.flatMap((c) => [c.label, c.summary, ...c.hardSpecifics].flatMap((value) => extractNamesFromText(value))),
    ...packet.facts.flatMap((f) => [f.claim, f.mechanism, f.commonError, f.whyWrong, ...f.groundedEntities].flatMap((value) => extractNamesFromText(value))),
  ]);
}

function syntheticSceneShell(value: string): boolean {
  return SYNTHETIC_STAYS_CLOSED_RE.test(value) || SYNTHETIC_BESIDE_TOWARD_RE.test(value) || SYNTHETIC_COMPOUND_TOKEN_RE.test(value);
}

function normalizedWords(value: string): string[] {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean);
}

function rootWord(value: string): string {
  return value
    .replace(/ies$/, "y")
    .replace(/(?:ing|ed|es|s)$/, "");
}

function sourceAlignmentKeywords(value: string): Set<string> {
  return new Set(normalizedWords(value)
    .map(rootWord)
    .filter((w) => w.length >= 4 && !SOURCE_ALIGNMENT_STOP_WORDS.has(w)));
}

function contentWordSet(value: string): Set<string> {
  return new Set(normalizedWords(value).filter((w) => w.length > 2 && !COMMON_WORDS.has(w)));
}

function wordSetSimilarity(a: string, b: string): number {
  const aw = contentWordSet(a);
  const bw = contentWordSet(b);
  if (!aw.size || !bw.size) return 0;
  let overlap = 0;
  for (const w of aw) if (bw.has(w)) overlap++;
  return overlap / Math.max(aw.size, bw.size);
}

function ngrams(value: string, n: number): Set<string> {
  const words = normalizedWords(value);
  const out = new Set<string>();
  for (let i = 0; i <= words.length - n; i++) out.add(words.slice(i, i + n).join(" "));
  return out;
}

function literalContentWindows(value: string): Set<string> {
  const out = new Set<string>();
  const tokens = value.split(/\s+/).filter((t) => t.length > 0);
  for (let i = 0; i + LITERAL_NGRAM_WINDOW <= tokens.length; i++) {
    const slice = tokens.slice(i, i + LITERAL_NGRAM_WINDOW);
    let contentCount = 0;
    for (const token of slice) {
      const word = token.toLowerCase().replace(/[^a-z0-9'-]/g, "");
      if (word.length < 4) continue;
      if (NGRAM_STOPWORDS.has(word)) continue;
      contentCount++;
    }
    if (contentCount >= SECTION_BP13_MIN_CONTENT_TOKENS) out.add(slice.join(" "));
  }
  return out;
}

function jammedProperNoun(value: string): string | null {
  for (const match of value.matchAll(JAMMED_PROPER_NOUNS_RE)) {
    if (CAMELCASE_BRAND_ALLOWLIST.has(match[0])) continue;
    return match[0];
  }
  return null;
}

function exampleIntraPackNgramFindings(pack: ExamplePackV1, chapterNumber: number): SectionFinding[] {
  const examples = pack.examples ?? [];
  if (examples.length < 3) return [];
  const ngramToExamples = new Map<string, Set<number>>();
  for (const [i, ex] of examples.entries()) {
    const words = text(ex.scenario).toLowerCase().replace(/\s+/g, " ").trim().split(" ").slice(1);
    for (let j = 0; j + EXAMPLE_TEMPLATE_NGRAM <= words.length; j++) {
      const gram = words.slice(j, j + EXAMPLE_TEMPLATE_NGRAM).join(" ");
      if (!/^[a-z ]+$/.test(gram) || gram.replace(/ /g, "").length < 20) continue;
      const set = ngramToExamples.get(gram) ?? new Set<number>();
      set.add(i);
      ngramToExamples.set(gram, set);
    }
  }

  const findings: SectionFinding[] = [];
  const reportedExamples = new Set<number>();
  for (const [gram, exSet] of ngramToExamples) {
    if (exSet.size < 3) continue;
    const indexes = [...exSet].sort((a, b) => a - b);
    if (indexes.every((i) => reportedExamples.has(i))) continue;
    for (const i of indexes) reportedExamples.add(i);
    findings.push({
      checkId: "SEC87.example_intra_pack_ngram",
      severity: "blocker",
      chapterNumber,
      section: "example-pack",
      path: "/examples",
      message: `examples ${indexes.map((i) => i + 1).join(", ")} share the verbatim 5-word phrase "${gram}" — rewrite as distinct scenes before assembly`,
    });
  }
  return findings;
}

function repeatedQuestionNgramFindings(pack: LearningPackV1, chapterNumber: number): SectionFinding[] {
  const byGram = new Map<string, Set<number>>();
  for (const [i, q] of (pack.quiz?.questions ?? []).entries()) {
    const haystack = `${text(q.prompt)} ${Array.isArray(q.choices) ? q.choices.map(text).join(" ") : ""} ${text(q.explanation)}`;
    for (const gram of ngrams(haystack, 8)) {
      const set = byGram.get(gram) ?? new Set<number>();
      set.add(i);
      byGram.set(gram, set);
    }
  }
  const hit = [...byGram.entries()].find(([, qs]) => qs.size >= 4);
  if (!hit) return [];
  return [{
    checkId: "SEC54.quiz_repeated_skeleton",
    severity: "blocker",
    chapterNumber,
    section: "learning-pack",
    path: "/quiz/questions",
    message: `quiz repeats an 8-word skeleton across ${hit[1].size} questions: "${hit[0]}"`,
  }];
}

function quizMechanicalTailProblem(value: string): string | null {
  const lower = value.toLowerCase();
  const exact = QUIZ_MECHANICAL_TAILS.find((tail) => lower.includes(tail));
  if (exact) return `choice contains banned generated tail "${exact}"`;
  if (LOWERCASE_MECHANICAL_SENTENCE_TAIL_RE.test(value)) {
    return "choice appends a lowercase generic evidence/source tail after a complete sentence";
  }
  return null;
}

function quizChoiceTailSignature(value: string): string | null {
  const lower = value.toLowerCase();
  const exact = QUIZ_MECHANICAL_TAILS.find((tail) => lower.includes(tail));
  if (exact) return `quiz-tail:${exact}`;
  const tokens = normalizedWords(value);
  if (tokens.length < 7) return null;
  const tail = tokens.slice(-5);
  const genericHits = tail.filter((token) => QUIZ_TAIL_GENERIC_WORDS.has(token)).length;
  if (genericHits < 2 && !["under", "after", "given", "based", "using"].includes(tail[0])) return null;
  return `quiz-tail:${tail.join(" ")}`;
}

function collectQuizChoiceTails(pack: LearningPackV1, bp: ChapterBlueprintV1): ExampleShellOccurrence[] {
  const out: ExampleShellOccurrence[] = [];
  for (const [questionIndex, q] of (pack.quiz?.questions ?? []).entries()) {
    for (const [choiceIndex, choice] of (q.choices ?? []).entries()) {
      const signature = quizChoiceTailSignature(text(choice));
      if (!signature) continue;
      out.push({
        chapterNumber: bp.chapterNumber,
        section: "learning-pack",
        path: `/quiz/questions/${questionIndex}/choices/${choiceIndex}`,
        signature,
        message: `quiz choice repeats a generic mechanical tail "${signature.replace(/^quiz-tail:/, "")}"`,
      });
    }
  }
  return out;
}

function openingShape(value: string): string | null {
  const first = text(value).split(/[.!?]/)[0] ?? "";
  if (!first) return null;
  const canonical = first
    .replace(/\b[A-Z][a-z]+\b/g, "Person")
    .replace(/\b\d+(?:\.\d+)?%?\b/g, "Number")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  const tokens = canonical.split(/\s+/).filter(Boolean);
  if (tokens.length < 9) return null;
  return tokens.slice(0, 14).join(" ");
}

type ExampleShellOccurrence = {
  chapterNumber: number;
  section: SectionKind;
  path: string;
  signature: string;
  message: string;
  reportable?: boolean;
};

type CrossFieldOccurrence = {
  chapterNumber: number;
  section: SectionKind;
  path: string;
  text: string;
};

type ExampleLiteralFieldOccurrence = CrossFieldOccurrence & {
  reportable: boolean;
};

type SummaryLiteralFieldOccurrence = CrossFieldOccurrence & {
  reportable: boolean;
};

type QuizLiteralFieldOccurrence = CrossFieldOccurrence & {
  reportable: boolean;
};

type SummaryHookFirstWordOccurrence = CrossFieldOccurrence & {
  firstWord: string;
  reportable: boolean;
};

type SoftBannedTextOccurrence = CrossFieldOccurrence & {
  reportable: boolean;
};

function sentenceList(value: string): string[] {
  return text(value)
    .match(/[^.!?]+[.!?]?/g)?.map((s) => s.trim()).filter((s) => wordCount(s) >= 6) ?? [];
}

function collectGenericActionContainers(value: string): string[] {
  return [...new Set([...text(value).matchAll(GENERIC_ACTION_CONTAINER_RE)].map((m) => normalizePhrase(m[0])).filter(Boolean))];
}

function collectExampleShells(pack: ExamplePackV1, bp: ChapterBlueprintV1, reportable = true): ExampleShellOccurrence[] {
  const out: ExampleShellOccurrence[] = [];
  for (const [i, ex] of (pack.examples ?? []).entries()) {
    const scenario = text(ex.scenario);
    if (syntheticSceneShell(scenario)) {
      out.push({
        chapterNumber: bp.chapterNumber,
        section: "example-pack",
        path: `/examples/${i}/scenario`,
        signature: "synthetic-beside-page-toward-stays-closed",
        message: `example ${i + 1} uses the synthetic beside/toward/stays-closed scene shell`,
        reportable,
      });
      continue;
    }
    const shape = openingShape(scenario);
    if (shape) {
      out.push({
        chapterNumber: bp.chapterNumber,
        section: "example-pack",
        path: `/examples/${i}/scenario`,
        signature: `opening:${shape}`,
        message: `example ${i + 1} shares an opening scene shape across generated chapters`,
        reportable,
      });
    }
  }
  return out;
}

function collectExampleActionContainers(pack: ExamplePackV1, bp: ChapterBlueprintV1, reportable = true): ExampleShellOccurrence[] {
  const out: ExampleShellOccurrence[] = [];
  for (const [i, ex] of (pack.examples ?? []).entries()) {
    const haystack = `${text(ex.scenario)} ${text(ex.whatToDo)}`;
    for (const container of collectGenericActionContainers(haystack)) {
      out.push({
        chapterNumber: bp.chapterNumber,
        section: "example-pack",
        path: `/examples/${i}/scenario`,
        signature: `container:${container}`,
        message: `example ${i + 1} reuses generic action container "${container}" across generated chapters`,
        reportable,
      });
    }
    if (FINANCE_DOCUMENT_CONTAINER_RE.test(haystack) && DOCUMENT_SHORTCUT_REPAIR_FRAME_RE.test(haystack)) {
      out.push({
        chapterNumber: bp.chapterNumber,
        section: "example-pack",
        path: `/examples/${i}/scenario`,
        signature: "scene-frame:document-shortcut-repair",
        message: `example ${i + 1} uses the repeated finance-document plus shortcut/default repair frame`,
        reportable,
      });
    }
  }
  return out;
}

function collectExampleShortcutDefaultFrames(pack: ExamplePackV1, bp: ChapterBlueprintV1, reportable = true): ExampleShellOccurrence[] {
  const out: ExampleShellOccurrence[] = [];
  for (const [i, ex] of (pack.examples ?? []).entries()) {
    const haystack = `${text(ex.scenario)} ${text(ex.whatToDo)} ${text(ex.whyItMatters)}`;
    if (!SHORTCUT_DEFAULT_FAILURE_FRAME_RE.test(haystack)) continue;
    out.push({
      chapterNumber: bp.chapterNumber,
      section: "example-pack",
      path: `/examples/${i}/scenario`,
      signature: "scene-frame:shortcut-default-failure",
      message: `example ${i + 1} uses the repeated shortcut/default-failure-to-review scene frame`,
      reportable,
    });
  }
  return out;
}

function collectExampleDecidesAfterFrames(pack: ExamplePackV1, bp: ChapterBlueprintV1, reportable = true): ExampleShellOccurrence[] {
  const out: ExampleShellOccurrence[] = [];
  for (const [i, ex] of (pack.examples ?? []).entries()) {
    const scenario = text(ex.scenario);
    if (!DECIDES_AFTER_NOT_BEFORE_RE.test(scenario)) continue;
    out.push({
      chapterNumber: bp.chapterNumber,
      section: "example-pack",
      path: `/examples/${i}/scenario`,
      signature: "scene-frame:decides-after-not-before",
      message: `example ${i + 1} reuses the formulaic "decides after X, not before" closing shell`,
      reportable,
    });
  }
  return out;
}

function collectExamplePendingUntilFrames(pack: ExamplePackV1, bp: ChapterBlueprintV1, reportable = true): ExampleShellOccurrence[] {
  const out: ExampleShellOccurrence[] = [];
  for (const [i, ex] of (pack.examples ?? []).entries()) {
    const scenario = text(ex.scenario);
    if (!PENDING_UNTIL_EVIDENCE_GATE_RE.test(scenario)) continue;
    out.push({
      chapterNumber: bp.chapterNumber,
      section: "example-pack",
      path: `/examples/${i}/scenario`,
      signature: "scene-frame:pending-until-evidence-gate",
      message: `example ${i + 1} uses the saturated pending/until/only-if evidence-gate ending`,
      reportable,
    });
  }
  return out;
}

function collectExamplePartialNextActionFrames(pack: ExamplePackV1, bp: ChapterBlueprintV1, reportable = true): ExampleShellOccurrence[] {
  const out: ExampleShellOccurrence[] = [];
  for (const [i, ex] of (pack.examples ?? []).entries()) {
    const scenario = text(ex.scenario);
    if (!PARTIAL_NEXT_ACTION_CLOSE_RE.test(scenario)) continue;
    out.push({
      chapterNumber: bp.chapterNumber,
      section: "example-pack",
      path: `/examples/${i}/scenario`,
      signature: "scene-frame:partial-answer-next-action",
      message: `example ${i + 1} uses the saturated partial-answer-then-next-action closing shell`,
      reportable,
    });
  }
  return out;
}

function collectExampleWaitingAnswerFrames(pack: ExamplePackV1, bp: ChapterBlueprintV1, reportable = true): ExampleShellOccurrence[] {
  const out: ExampleShellOccurrence[] = [];
  for (const [i, ex] of (pack.examples ?? []).entries()) {
    const scenario = text(ex.scenario);
    if (!WAITING_ANSWER_SCENE_RE.test(scenario)) continue;
    out.push({
      chapterNumber: bp.chapterNumber,
      section: "example-pack",
      path: `/examples/${i}/scenario`,
      signature: "scene-frame:waiting-answer-vignette",
      message: `example ${i + 1} uses the repeated tactile-scene plus waiting/asking interlocutor shell`,
      reportable,
    });
  }
  return out;
}

function collectExampleBroadProcessOnePointFrames(pack: ExamplePackV1, bp: ChapterBlueprintV1, reportable = true): ExampleShellOccurrence[] {
  const out: ExampleShellOccurrence[] = [];
  for (const [i, ex] of (pack.examples ?? []).entries()) {
    const haystack = `${text(ex.scenario)} ${text(ex.whatToDo)} ${text(ex.whyItMatters)}`;
    if (!BROAD_PROCESS_ONE_POINT_RE.test(haystack)) continue;
    out.push({
      chapterNumber: bp.chapterNumber,
      section: "example-pack",
      path: `/examples/${i}/scenario`,
      signature: "scene-frame:broad-process-vs-one-focused-point",
      message: `example ${i + 1} uses the broad process versus one focused point scene transaction`,
      reportable,
    });
  }
  return out;
}

function collectExamplePleasantAveragePeakEndFrames(pack: ExamplePackV1, bp: ChapterBlueprintV1, reportable = true): ExampleShellOccurrence[] {
  const out: ExampleShellOccurrence[] = [];
  for (const [i, ex] of (pack.examples ?? []).entries()) {
    const haystack = `${text(ex.scenario)} ${text(ex.whatToDo)} ${text(ex.whyItMatters)}`;
    if (!PLEASANT_AVERAGE_PEAK_END_RE.test(haystack)) continue;
    out.push({
      chapterNumber: bp.chapterNumber,
      section: "example-pack",
      path: `/examples/${i}/scenario`,
      signature: "scene-frame:pleasant-average-vs-peak-ending",
      message: `example ${i + 1} uses the pleasant average versus memorable peak/low/ending scene transaction`,
      reportable,
    });
  }
  return out;
}

function collectExampleVenueHits(pack: ExamplePackV1, bp: ChapterBlueprintV1, reportable = true): ExampleShellOccurrence[] {
  const out: ExampleShellOccurrence[] = [];
  const seen = new Set<string>();
  for (const [i, ex] of (pack.examples ?? []).entries()) {
    const haystack = `${text(ex.title)} ${text(ex.scenario)} ${text(ex.whatToDo)} ${text(ex.whyItMatters)}`;
    if (!haystack.trim()) continue;
    for (const [venue, patterns] of venuePatterns()) {
      if (seen.has(venue) || !patterns.some((pattern) => pattern.test(haystack))) continue;
      seen.add(venue);
      out.push({
        chapterNumber: bp.chapterNumber,
        section: "example-pack",
        path: `/examples/${i}/scenario`,
        signature: `venue:${venue}`,
        message: `example pack repeats venue "${venue}" already used by multiple chapters`,
        reportable,
      });
    }
  }
  return out;
}

function collectActionClassifyLeverPracticeUnits(pack: ActionPackV1, bp: ChapterBlueprintV1, reportable = true): ExampleShellOccurrence[] {
  const out: ExampleShellOccurrence[] = [];
  const fields: Array<[string, unknown]> = [
    ["/implementationPlan/coreSkill", pack.implementationPlan?.coreSkill],
    ["/implementationPlan/twentyFourHourChallenge", pack.implementationPlan?.twentyFourHourChallenge],
    ["/implementationPlan/weeklyPractice", pack.implementationPlan?.weeklyPractice],
  ];
  for (const [path, value] of fields) {
    if (!ACTION_CLASSIFY_LEVER_PRACTICE_RE.test(text(value))) continue;
    out.push({
      chapterNumber: bp.chapterNumber,
      section: "action-pack",
      path,
      signature: "action-practice:classify-opportunity-choose-lever-predict-shift",
      message: `${path} repeats the classify transition/milestone/pit, choose lever, predict shift exercise shell`,
      reportable,
    });
  }
  return out;
}

function collectActionSocialPressurePausePlans(pack: ActionPackV1, bp: ChapterBlueprintV1, reportable = true): ExampleShellOccurrence[] {
  const out: ExampleShellOccurrence[] = [];
  for (const [i, it] of (pack.implementationPlan?.ifThenPlans ?? []).entries()) {
    const haystack = `${text(it.context)} ${text(it.plan)}`;
    if (!ACTION_SOCIAL_PRESSURE_PAUSE_RE.test(haystack)) continue;
    out.push({
      chapterNumber: bp.chapterNumber,
      section: "action-pack",
      path: `/implementationPlan/ifThenPlans/${i}/plan`,
      signature: "action-ifthen:social-pressure-evidence-pause",
      message: `ifThenPlans[${i}] repeats the social-pressure-to-evidence-pause action shell`,
      reportable,
    });
  }
  return out;
}

function collectExampleLiteralFields(pack: ExamplePackV1, chapterNumber: number, reportable: boolean): ExampleLiteralFieldOccurrence[] {
  const out: ExampleLiteralFieldOccurrence[] = [];
  for (const [i, ex] of (pack.examples ?? []).entries()) {
    for (const [field, value] of [
      ["scenario", ex.scenario],
      ["whatToDo", ex.whatToDo],
      ["whyItMatters", ex.whyItMatters],
    ] as const) {
      if (!text(value)) continue;
      out.push({
        chapterNumber,
        section: "example-pack",
        path: `/examples/${i}/${field}`,
        text: text(value),
        reportable,
      });
    }
  }
  return out;
}

function collectSummaryLiteralFields(pack: SummaryPackV1, chapterNumber: number, reportable: boolean): SummaryLiteralFieldOccurrence[] {
  const out: SummaryLiteralFieldOccurrence[] = [];
  for (const tier of ["fastRead", "deepRead", "fullRead"] as const) {
    const value = text(pack.breakdown?.[tier]);
    if (!value) continue;
    out.push({ chapterNumber, section: "summary-pack", path: `/breakdown/${tier}`, text: value, reportable });
  }
  return out;
}

function collectQuizLiteralFields(pack: LearningPackV1, chapterNumber: number, reportable: boolean): QuizLiteralFieldOccurrence[] {
  const out: QuizLiteralFieldOccurrence[] = [];
  const add = (path: string, value: unknown) => {
    if (!text(value)) return;
    out.push({ chapterNumber, section: "learning-pack", path, text: text(value), reportable });
  };
  for (const [i, q] of (pack.quiz?.questions ?? []).entries()) {
    add(`/quiz/questions/${i}/prompt`, q.prompt);
    for (const [choiceIndex, choice] of (q.choices ?? []).entries()) add(`/quiz/questions/${i}/choices/${choiceIndex}`, choice);
    add(`/quiz/questions/${i}/explanation`, q.explanation);
  }
  return out;
}

function hookFirstWord(value: unknown): string {
  return text(value).split(/\s+/)[0]?.toLowerCase().replace(/[^a-z']/g, "") ?? "";
}

function collectSummaryHookFirstWords(pack: SummaryPackV1, bp: ChapterBlueprintV1, reportable: boolean): SummaryHookFirstWordOccurrence[] {
  const hook = text(pack.hook?.hook);
  const firstWord = hookFirstWord(hook);
  if (!firstWord) return [];
  return [{ chapterNumber: bp.chapterNumber, section: "summary-pack", path: "/hook/hook", text: hook, firstWord, reportable }];
}

function tryThisNowOpener(value: unknown): string {
  const words = text(value).toLowerCase().match(/[a-z']+/g) ?? [];
  return words.slice(0, TRY_THIS_NOW_OPENER_WORDS).join(" ");
}

function collectTryThisNowOpeners(pack: ActionPackV1, bp: ChapterBlueprintV1, reportable = true): ExampleShellOccurrence[] {
  const opener = tryThisNowOpener(pack.tryThisNow);
  if (opener.split(" ").filter(Boolean).length < TRY_THIS_NOW_OPENER_MIN_WORDS) return [];
  return [{
    chapterNumber: bp.chapterNumber,
    section: "action-pack",
    path: "/tryThisNow",
    signature: `tryThisNowOpener:${opener}`,
    message: `tryThisNow opener "${opener}..." repeats another chapter`,
    reportable,
  }];
}

function actionChallengeOpener(value: unknown): string {
  const words = text(value).toLowerCase().match(/[a-z']+/g) ?? [];
  return words.slice(0, ACTION_CHALLENGE_OPENER_WORDS).join(" ");
}

function collectActionChallengeOpeners(pack: ActionPackV1, bp: ChapterBlueprintV1, reportable = true): ExampleShellOccurrence[] {
  const opener = actionChallengeOpener(pack.implementationPlan?.twentyFourHourChallenge);
  if (opener.split(" ").filter(Boolean).length < ACTION_CHALLENGE_OPENER_WORDS) return [];
  return [{
    chapterNumber: bp.chapterNumber,
    section: "action-pack",
    path: "/implementationPlan/twentyFourHourChallenge",
    signature: `twentyFourHourChallengeOpener:${opener}`,
    message: `twentyFourHourChallenge opener "${opener}..." repeats across generated chapters`,
    reportable,
  }];
}

function collectActionCoreSkillClosers(pack: ActionPackV1, bp: ChapterBlueprintV1): ExampleShellOccurrence[] {
  const sentences = sentenceList(text(pack.implementationPlan?.coreSkill));
  const final = sentences[sentences.length - 1];
  if (!final) return [];
  return [{
    chapterNumber: bp.chapterNumber,
    section: "action-pack",
    path: "/implementationPlan/coreSkill",
    signature: `coreSkillCloser:${normalizePhrase(final)}`,
    message: `coreSkill repeats the closing sentence "${final.replace(/[.!?]+$/, "")}" across generated chapters`,
  }];
}

function collectActionPendingTemplateUnits(pack: ActionPackV1, bp: ChapterBlueprintV1, reportable = true): ExampleShellOccurrence[] {
  const out: ExampleShellOccurrence[] = [];
  const fields: Array<[string, unknown]> = [
    ["/tryThisNow", pack.tryThisNow],
    ["/implementationPlan/coreSkill", pack.implementationPlan?.coreSkill],
    ["/implementationPlan/twentyFourHourChallenge", pack.implementationPlan?.twentyFourHourChallenge],
    ["/implementationPlan/weeklyPractice", pack.implementationPlan?.weeklyPractice],
    ...(pack.implementationPlan?.ifThenPlans ?? []).map((it, i) => [`/implementationPlan/ifThenPlans/${i}/plan`, it.plan] as [string, unknown]),
  ];
  for (const [path, value] of fields) {
    if (!ACTION_PENDING_TEMPLATE_UNIT_RE.test(text(value))) continue;
    out.push({
      chapterNumber: bp.chapterNumber,
      section: "action-pack",
      path,
      signature: "action-unit:pending-template-blanks",
      message: `${path} repeats the blank/checkpoint template plus keep-pending action unit`,
      reportable,
    });
  }
  return out;
}

function collectSoftBannedTextFields(pack: SectionPackV1, chapterNumber: number, reportable: boolean): SoftBannedTextOccurrence[] {
  const out: SoftBannedTextOccurrence[] = [];
  const add = (section: SectionKind, path: string, value: unknown) => {
    if (!text(value)) return;
    out.push({ chapterNumber, section, path, text: text(value), reportable });
  };
  switch (pack.artifactType) {
    case "summary-pack":
      add("summary-pack", "/hook/hook", pack.hook?.hook);
      add("summary-pack", "/hook/counterintuition", pack.hook?.counterintuition);
      add("summary-pack", "/breakdown/fastRead", pack.breakdown?.fastRead);
      add("summary-pack", "/breakdown/deepRead", pack.breakdown?.deepRead);
      add("summary-pack", "/breakdown/fullRead", pack.breakdown?.fullRead);
      add("summary-pack", "/keyTakeaway", pack.keyTakeaway);
      add("summary-pack", "/tryThisNow", pack.tryThisNow);
      break;
    case "example-pack":
      for (const [i, ex] of (pack.examples ?? []).entries()) {
        add("example-pack", `/examples/${i}/title`, ex.title);
        add("example-pack", `/examples/${i}/scenario`, ex.scenario);
        add("example-pack", `/examples/${i}/whatToDo`, ex.whatToDo);
        add("example-pack", `/examples/${i}/whyItMatters`, ex.whyItMatters);
      }
      break;
    case "learning-pack":
      for (const [i, q] of (pack.quiz?.questions ?? []).entries()) {
        add("learning-pack", `/quiz/questions/${i}/prompt`, q.prompt);
        for (const [choiceIndex, choice] of (q.choices ?? []).entries()) add("learning-pack", `/quiz/questions/${i}/choices/${choiceIndex}`, choice);
        add("learning-pack", `/quiz/questions/${i}/explanation`, q.explanation);
      }
      for (const [i, card] of (pack.cards?.cards ?? []).entries()) {
        add("learning-pack", `/cards/cards/${i}/front`, card.front);
        add("learning-pack", `/cards/cards/${i}/back`, card.back);
      }
      break;
    case "action-pack":
      add("action-pack", "/tryThisNow", pack.tryThisNow);
      add("action-pack", "/implementationPlan/coreSkill", pack.implementationPlan?.coreSkill);
      add("action-pack", "/implementationPlan/twentyFourHourChallenge", pack.implementationPlan?.twentyFourHourChallenge);
      add("action-pack", "/implementationPlan/weeklyPractice", pack.implementationPlan?.weeklyPractice);
      for (const [i, it] of (pack.implementationPlan?.ifThenPlans ?? []).entries()) add("action-pack", `/implementationPlan/ifThenPlans/${i}/plan`, it.plan);
      break;
  }
  return out;
}

function loadPacketSidecar(packet: SourcePacketV1): any | null {
  const p = packet.sourceSidecarPath;
  if (typeof p !== "string" || !p || !existsSync(p)) return null;
  try {
    return readJsonFile(p);
  } catch {
    return null;
  }
}

function sourcePasteFindings(pack: SectionPackV1, bp: ChapterBlueprintV1, packet: SourcePacketV1): SectionFinding[] {
  const sidecar = loadPacketSidecar(packet);
  const src = sidecar ? sidecarSourceText(sidecar) : "";
  if (!src) return [];
  const findings: SectionFinding[] = [];
  for (const field of collectSoftBannedTextFields(pack, bp.chapterNumber, true)) {
    if (wordCount(field.text) < SOURCE_PASTE_WORD_FLOOR) continue;
    const run = longestCommonRunWords(field.text, src);
    if (run < SOURCE_PASTE_WORD_FLOOR) continue;
    findings.push({
      checkId: "SEC91.source_paste",
      severity: "blocker",
      chapterNumber: bp.chapterNumber,
      section: field.section,
      path: field.path,
      message: `${field.path} contains a ${run}-word run pasted verbatim from source notes; paraphrase source prose and source lists in this section's own voice`,
    });
  }
  return findings;
}

function hardBannedPhraseFindings(pack: SectionPackV1, bp: ChapterBlueprintV1): SectionFinding[] {
  const findings: SectionFinding[] = [];
  for (const field of collectSoftBannedTextFields(pack, bp.chapterNumber, true)) {
    for (const finding of checkBannedPhrases(field.text).findings) {
      findings.push({
        checkId: "SEC92.hard_banned_phrase",
        severity: "blocker",
        chapterNumber: bp.chapterNumber,
        section: field.section,
        path: field.path,
        message: finding.message,
      });
    }
  }
  return findings;
}

function readerPunctuationFindings(fields: SoftBannedTextOccurrence[]): SectionFinding[] {
  const findings: SectionFinding[] = [];
  for (const field of fields) {
    if (
      /^\/examples\/\d+\/(?:scenario|whatToDo|whyItMatters)$/.test(field.path) ||
      /^\/cards\/cards\/\d+\/(?:front|back)$/.test(field.path)
    ) {
      const trimmed = field.text.trim();
      if (trimmed && !TERMINAL_PUNCTUATION_RE.test(trimmed)) {
        findings.push({
          checkId: "SEC113.reader_trailing_fragment",
          severity: "blocker",
          chapterNumber: field.chapterNumber,
          section: field.section,
          path: field.path,
          message: `${field.path} ends without terminal punctuation; complete or rewrite the generated fragment before assembly`,
        });
      }
    }
    const doubled = field.text.match(/\.{2,}/);
    if (doubled) {
      findings.push({
        checkId: "SEC105.reader_doubled_period",
        severity: "blocker",
        chapterNumber: field.chapterNumber,
        section: field.section,
        path: field.path,
        message: `${field.path} contains doubled period "${doubled[0]}"; replace with a single sentence boundary`,
      });
    }
    const lower = [...field.text.matchAll(LOWERCASE_SENTENCE_START_RE)]
      .find((match) => {
        const before = field.text.slice(Math.max(0, match.index - 6), match.index + 1);
        return !/(?:\be\.g\.|\bi\.e\.)$/i.test(before);
      });
    if (lower) {
      findings.push({
        checkId: "SEC106.reader_lowercase_sentence_start",
        severity: "blocker",
        chapterNumber: field.chapterNumber,
        section: field.section,
        path: field.path,
        message: `${field.path} starts a sentence with lowercase text "${lower[1].trim().slice(0, 80)}"; capitalize or rewrite the boundary`,
      });
    }
  }
  return findings;
}

function readerSentenceSeamFindings(fields: SoftBannedTextOccurrence[]): SectionFinding[] {
  const findings: SectionFinding[] = [];
  for (const field of fields) {
    const hit = READER_SENTENCE_SEAM_RE_LIST.find((pattern) => pattern.test(field.text));
    if (!hit) continue;
    findings.push({
      checkId: "SEC110.reader_sentence_seam",
      severity: "blocker",
      chapterNumber: field.chapterNumber,
      section: field.section,
      path: field.path,
      message: `${field.path} contains a generated sentence seam (${hit.source}); split or rewrite the sentence so clauses connect grammatically`,
    });
  }
  return findings;
}

function sourceNumberingLeakFindings(fields: SoftBannedTextOccurrence[]): SectionFinding[] {
  const findings: SectionFinding[] = [];
  for (const field of fields) {
    const match = field.text.match(SOURCE_NUMBERING_LEAK_RE);
    if (!match) continue;
    findings.push({
      checkId: "SEC103.source_numbering_leak",
      severity: "blocker",
      chapterNumber: field.chapterNumber,
      section: field.section,
      path: field.path,
      message: `${field.path} exposes source-note numbering "${match[0]}"; rewrite as reader-facing evidence instead of audit labels`,
    });
  }
  return findings;
}

function readerJammedProperNounFindings(fields: SoftBannedTextOccurrence[]): SectionFinding[] {
  const findings: SectionFinding[] = [];
  for (const field of fields) {
    const jammed = jammedProperNoun(field.text);
    if (!jammed) continue;
    findings.push({
      checkId: "SEC104.reader_jammed_proper_noun",
      severity: "blocker",
      chapterNumber: field.chapterNumber,
      section: field.section,
      path: field.path,
      message: `${field.path} contains jammed proper noun "${jammed}"; separate the words or use descriptive source language`,
    });
  }
  return findings;
}

function crossChapterShellFindings(shells: ExampleShellOccurrence[]): SectionFinding[] {
  const findings: SectionFinding[] = [];
  const grouped = new Map<string, ExampleShellOccurrence[]>();
  for (const shell of shells) {
    const group = grouped.get(shell.signature) ?? [];
    group.push(shell);
    grouped.set(shell.signature, group);
  }
  for (const group of grouped.values()) {
    const chapters = new Set(group.map((g) => g.chapterNumber));
    const synthetic = group[0]?.signature === "synthetic-beside-page-toward-stays-closed";
    if (!synthetic && chapters.size < OPENING_SHAPE_MIN_CHAPTERS) continue;
    if (synthetic && chapters.size < 1) continue;
    for (const hit of group) {
      if (hit.reportable === false) continue;
      findings.push({
        checkId: synthetic ? "SEC37.example_synthetic_scene_shell" : "SEC80.example_cross_chapter_opening_shape",
        severity: "blocker",
        chapterNumber: hit.chapterNumber,
        section: hit.section,
        path: hit.path,
        message: synthetic ? hit.message : `${hit.message}; repeated in ${chapters.size} chapters`,
      });
    }
  }
  return findings;
}

function crossChapterGenericContainerFindings(containers: ExampleShellOccurrence[]): SectionFinding[] {
  const findings: SectionFinding[] = [];
  const grouped = new Map<string, ExampleShellOccurrence[]>();
  for (const container of containers) {
    const group = grouped.get(container.signature) ?? [];
    group.push(container);
    grouped.set(container.signature, group);
  }
  for (const group of grouped.values()) {
    const chapters = new Set(group.map((g) => g.chapterNumber));
    if (chapters.size < 3) continue;
    for (const hit of group) {
      if (hit.reportable === false) continue;
      findings.push({
        checkId: "SEC85.example_repeated_action_container",
        severity: "blocker",
        chapterNumber: hit.chapterNumber,
        section: hit.section,
        path: hit.path,
        message: `${hit.message}; repeated in ${chapters.size} chapters`,
      });
    }
  }
  return findings;
}

function crossChapterVenueStampingFindings(venues: ExampleShellOccurrence[]): SectionFinding[] {
  const findings: SectionFinding[] = [];
  const grouped = new Map<string, ExampleShellOccurrence[]>();
  for (const venue of venues) {
    const group = grouped.get(venue.signature) ?? [];
    group.push(venue);
    grouped.set(venue.signature, group);
  }
  for (const group of grouped.values()) {
    const chapters = new Set(group.map((g) => g.chapterNumber));
    if (chapters.size <= 2) continue;
    for (const hit of group) {
      if (hit.reportable === false) continue;
      findings.push({
        checkId: "SEC93.example_venue_stamping",
        severity: "blocker",
        chapterNumber: hit.chapterNumber,
        section: hit.section,
        path: hit.path,
        message: `${hit.message}; appears in ${chapters.size} chapters`,
      });
    }
  }
  return findings;
}

function crossChapterShortcutDefaultFrameFindings(frames: ExampleShellOccurrence[]): SectionFinding[] {
  const findings: SectionFinding[] = [];
  const grouped = new Map<string, ExampleShellOccurrence[]>();
  for (const frame of frames) {
    const group = grouped.get(frame.signature) ?? [];
    group.push(frame);
    grouped.set(frame.signature, group);
  }
  for (const group of grouped.values()) {
    const chapters = new Set(group.map((g) => g.chapterNumber));
    if (chapters.size < SHORTCUT_DEFAULT_FRAME_MIN_CHAPTERS) continue;
    for (const hit of group) {
      if (hit.reportable === false) continue;
      findings.push({
        checkId: "SEC96.example_shortcut_default_failure_saturation",
        severity: "blocker",
        chapterNumber: hit.chapterNumber,
        section: hit.section,
        path: hit.path,
        message: `${hit.message}; appears in ${chapters.size} chapters`,
      });
    }
  }
  return findings;
}

function crossChapterDecidesAfterFrameFindings(frames: ExampleShellOccurrence[]): SectionFinding[] {
  const findings: SectionFinding[] = [];
  const grouped = new Map<string, ExampleShellOccurrence[]>();
  for (const frame of frames) {
    const group = grouped.get(frame.signature) ?? [];
    group.push(frame);
    grouped.set(frame.signature, group);
  }
  for (const group of grouped.values()) {
    const chapters = new Set(group.map((g) => g.chapterNumber));
    if (chapters.size < DECIDES_AFTER_FRAME_MIN_CHAPTERS) continue;
    for (const hit of group) {
      if (hit.reportable === false) continue;
      findings.push({
        checkId: "SEC97.example_decides_after_not_before_saturation",
        severity: "blocker",
        chapterNumber: hit.chapterNumber,
        section: hit.section,
        path: hit.path,
        message: `${hit.message}; appears in ${chapters.size} chapters`,
      });
    }
  }
  return findings;
}

function crossChapterPendingUntilFrameFindings(frames: ExampleShellOccurrence[]): SectionFinding[] {
  const findings: SectionFinding[] = [];
  const grouped = new Map<string, ExampleShellOccurrence[]>();
  for (const frame of frames) {
    const group = grouped.get(frame.signature) ?? [];
    group.push(frame);
    grouped.set(frame.signature, group);
  }
  for (const group of grouped.values()) {
    const chapters = new Set(group.map((g) => g.chapterNumber));
    if (chapters.size < PENDING_UNTIL_FRAME_MIN_CHAPTERS) continue;
    for (const hit of group) {
      if (hit.reportable === false) continue;
      findings.push({
        checkId: "SEC98.example_pending_until_evidence_saturation",
        severity: "blocker",
        chapterNumber: hit.chapterNumber,
        section: hit.section,
        path: hit.path,
        message: `${hit.message}; appears in ${chapters.size} chapters`,
      });
    }
  }
  return findings;
}

function crossChapterPartialNextActionFrameFindings(frames: ExampleShellOccurrence[]): SectionFinding[] {
  const findings: SectionFinding[] = [];
  const grouped = new Map<string, ExampleShellOccurrence[]>();
  for (const frame of frames) {
    const group = grouped.get(frame.signature) ?? [];
    group.push(frame);
    grouped.set(frame.signature, group);
  }
  for (const group of grouped.values()) {
    const chapters = new Set(group.map((g) => g.chapterNumber));
    if (chapters.size < PARTIAL_NEXT_ACTION_FRAME_MIN_CHAPTERS) continue;
    for (const hit of group) {
      if (hit.reportable === false) continue;
      findings.push({
        checkId: "SEC100.example_partial_next_action_saturation",
        severity: "blocker",
        chapterNumber: hit.chapterNumber,
        section: hit.section,
        path: hit.path,
        message: `${hit.message}; appears in ${chapters.size} chapters`,
      });
    }
  }
  return findings;
}

function crossChapterWaitingAnswerFrameFindings(frames: ExampleShellOccurrence[]): SectionFinding[] {
  const findings: SectionFinding[] = [];
  const grouped = new Map<string, ExampleShellOccurrence[]>();
  for (const frame of frames) {
    const group = grouped.get(frame.signature) ?? [];
    group.push(frame);
    grouped.set(frame.signature, group);
  }
  for (const group of grouped.values()) {
    const chapters = new Set(group.map((g) => g.chapterNumber));
    if (chapters.size < WAITING_ANSWER_FRAME_MIN_CHAPTERS) continue;
    for (const hit of group) {
      if (hit.reportable === false) continue;
      findings.push({
        checkId: "SEC101.example_waiting_answer_scene_saturation",
        severity: "blocker",
        chapterNumber: hit.chapterNumber,
        section: hit.section,
        path: hit.path,
        message: `${hit.message}; appears in ${chapters.size} chapters`,
      });
    }
  }
  return findings;
}

function crossChapterBroadProcessOnePointFindings(frames: ExampleShellOccurrence[]): SectionFinding[] {
  const findings: SectionFinding[] = [];
  const grouped = new Map<string, ExampleShellOccurrence[]>();
  for (const frame of frames) {
    const group = grouped.get(frame.signature) ?? [];
    group.push(frame);
    grouped.set(frame.signature, group);
  }
  for (const group of grouped.values()) {
    const chapters = new Set(group.map((g) => g.chapterNumber));
    if (chapters.size < BROAD_PROCESS_ONE_POINT_MIN_CHAPTERS) continue;
    for (const hit of group) {
      if (hit.reportable === false) continue;
      findings.push({
        checkId: "SEC108.example_broad_process_one_point_saturation",
        severity: "blocker",
        chapterNumber: hit.chapterNumber,
        section: hit.section,
        path: hit.path,
        message: `${hit.message}; appears in ${chapters.size} chapters. Vary the sceneFrame with consequence, failed test, stakeholder conflict, measurement surprise, deletion, or boundary-case frames.`,
      });
    }
  }
  return findings;
}

function crossChapterPleasantAveragePeakEndFindings(frames: ExampleShellOccurrence[]): SectionFinding[] {
  const findings: SectionFinding[] = [];
  const grouped = new Map<string, ExampleShellOccurrence[]>();
  for (const frame of frames) {
    const group = grouped.get(frame.signature) ?? [];
    group.push(frame);
    grouped.set(frame.signature, group);
  }
  for (const group of grouped.values()) {
    const chapters = new Set(group.map((g) => g.chapterNumber));
    if (chapters.size < PLEASANT_AVERAGE_PEAK_END_MIN_CHAPTERS) continue;
    for (const hit of group) {
      if (hit.reportable === false) continue;
      findings.push({
        checkId: "SEC112.example_pleasant_average_peak_end_saturation",
        severity: "blocker",
        chapterNumber: hit.chapterNumber,
        section: hit.section,
        path: hit.path,
        message: `${hit.message}; appears in ${chapters.size} chapters. Recast with the dealt sceneFrame instead of another average-smoothing versus peak/end tradeoff.`,
      });
    }
  }
  return findings;
}

function crossChapterActionPendingTemplateFindings(units: ExampleShellOccurrence[]): SectionFinding[] {
  const findings: SectionFinding[] = [];
  const grouped = new Map<string, ExampleShellOccurrence[]>();
  for (const unit of units) {
    const group = grouped.get(unit.signature) ?? [];
    group.push(unit);
    grouped.set(unit.signature, group);
  }
  for (const group of grouped.values()) {
    const chapters = new Set(group.map((g) => g.chapterNumber));
    if (chapters.size < ACTION_PENDING_TEMPLATE_MIN_CHAPTERS) continue;
    for (const hit of group) {
      if (hit.reportable === false) continue;
      findings.push({
        checkId: "SEC102.action_pending_template_saturation",
        severity: "blocker",
        chapterNumber: hit.chapterNumber,
        section: hit.section,
        path: hit.path,
        message: `${hit.message}; appears in ${chapters.size} chapters`,
      });
    }
  }
  return findings;
}

function crossChapterActionClassifyLeverFindings(units: ExampleShellOccurrence[]): SectionFinding[] {
  const findings: SectionFinding[] = [];
  const grouped = new Map<string, ExampleShellOccurrence[]>();
  for (const unit of units) {
    const group = grouped.get(unit.signature) ?? [];
    group.push(unit);
    grouped.set(unit.signature, group);
  }
  for (const group of grouped.values()) {
    const chapters = new Set(group.map((g) => g.chapterNumber));
    if (chapters.size < ACTION_CLASSIFY_LEVER_MIN_CHAPTERS) continue;
    for (const hit of group) {
      if (hit.reportable === false) continue;
      findings.push({
        checkId: "SEC109.action_classify_lever_practice_saturation",
        severity: "blocker",
        chapterNumber: hit.chapterNumber,
        section: hit.section,
        path: hit.path,
        message: `${hit.message}; appears in ${chapters.size} chapters. Use the dealt action.practiceForm instead of another classify/choose/predict worksheet.`,
      });
    }
  }
  return findings;
}

function crossChapterActionSocialPressurePauseFindings(units: ExampleShellOccurrence[]): SectionFinding[] {
  const findings: SectionFinding[] = [];
  const grouped = new Map<string, ExampleShellOccurrence[]>();
  for (const unit of units) {
    const group = grouped.get(unit.signature) ?? [];
    group.push(unit);
    grouped.set(unit.signature, group);
  }
  for (const group of grouped.values()) {
    const chapters = new Set(group.map((g) => g.chapterNumber));
    if (chapters.size < ACTION_SOCIAL_PRESSURE_PAUSE_MIN_CHAPTERS) continue;
    for (const hit of group) {
      if (hit.reportable === false) continue;
      findings.push({
        checkId: "SEC115.action_social_pressure_pause_saturation",
        severity: "blocker",
        chapterNumber: hit.chapterNumber,
        section: hit.section,
        path: hit.path,
        message: `${hit.message}; appears in ${chapters.size} chapters. Keep at most one social-pressure evidence-pause exemplar and rewrite siblings with chapter-specific triggers/actions such as owner handoff, deletion, field test, refusal rule, measurement swap, rehearsal, or post-moment review.`,
      });
    }
  }
  return findings;
}

function crossChapterTryThisNowOpenerFindings(openers: ExampleShellOccurrence[]): SectionFinding[] {
  const findings: SectionFinding[] = [];
  const grouped = new Map<string, ExampleShellOccurrence[]>();
  for (const opener of openers) {
    const group = grouped.get(opener.signature) ?? [];
    group.push(opener);
    grouped.set(opener.signature, group);
  }
  for (const group of grouped.values()) {
    const chapters = new Set(group.map((g) => g.chapterNumber));
    if (chapters.size < 2) continue;
    for (const hit of group) {
      if (hit.reportable === false) continue;
      findings.push({
        checkId: "SEC94.action_try_this_now_opener_reuse",
        severity: "blocker",
        chapterNumber: hit.chapterNumber,
        section: hit.section,
        path: hit.path,
        message: `${hit.message}; opener appears in ${chapters.size} chapters`,
      });
    }
  }
  return findings;
}

function crossChapterActionChallengeOpenerFindings(openers: ExampleShellOccurrence[]): SectionFinding[] {
  const findings: SectionFinding[] = [];
  const grouped = new Map<string, ExampleShellOccurrence[]>();
  for (const opener of openers) {
    const group = grouped.get(opener.signature) ?? [];
    group.push(opener);
    grouped.set(opener.signature, group);
  }
  for (const group of grouped.values()) {
    const chapters = new Set(group.map((g) => g.chapterNumber));
    if (chapters.size < ACTION_CHALLENGE_OPENER_MIN_CHAPTERS) continue;
    for (const hit of group) {
      if (hit.reportable === false) continue;
      findings.push({
        checkId: "SEC114.action_challenge_opener_saturation",
        severity: "blocker",
        chapterNumber: hit.chapterNumber,
        section: hit.section,
        path: hit.path,
        message: `${hit.message}; opener appears in ${chapters.size} chapters. Vary the time box, cadence, trigger, and first verb so the 24-hour challenge follows this chapter's mechanism instead of a shared next-day shell.`,
      });
    }
  }
  return findings;
}

function crossChapterCoreSkillCloserFindings(closers: ExampleShellOccurrence[]): SectionFinding[] {
  const findings: SectionFinding[] = [];
  const grouped = new Map<string, ExampleShellOccurrence[]>();
  for (const closer of closers) {
    const group = grouped.get(closer.signature) ?? [];
    group.push(closer);
    grouped.set(closer.signature, group);
  }
  for (const group of grouped.values()) {
    const chapters = new Set(group.map((g) => g.chapterNumber));
    if (chapters.size < 3) continue;
    for (const hit of group) {
      if (hit.reportable === false) continue;
      findings.push({
        checkId: "SEC84.action_repeated_core_skill_closer",
        severity: "blocker",
        chapterNumber: hit.chapterNumber,
        section: hit.section,
        path: hit.path,
        message: `${hit.message}; repeated in ${chapters.size} chapters`,
      });
    }
  }
  return findings;
}

function crossChapterQuizChoiceTailFindings(tails: ExampleShellOccurrence[]): SectionFinding[] {
  const findings: SectionFinding[] = [];
  const grouped = new Map<string, ExampleShellOccurrence[]>();
  for (const tail of tails) {
    const group = grouped.get(tail.signature) ?? [];
    group.push(tail);
    grouped.set(tail.signature, group);
  }
  for (const group of grouped.values()) {
    const chapters = new Set(group.map((g) => g.chapterNumber));
    if (chapters.size < 3 && group.length < 5) continue;
    for (const hit of group) {
      if (hit.reportable === false) continue;
      findings.push({
        checkId: "SEC86.quiz_repeated_choice_tail",
        severity: "blocker",
        chapterNumber: hit.chapterNumber,
        section: hit.section,
        path: hit.path,
        message: `${hit.message}; repeated across ${chapters.size} chapter(s) and ${group.length} choice(s)`,
      });
    }
  }
  return findings;
}

function crossChapterExampleLiteralNgramFindings(fields: ExampleLiteralFieldOccurrence[]): SectionFinding[] {
  const findings: SectionFinding[] = [];
  const byWindow = new Map<string, ExampleLiteralFieldOccurrence[]>();
  for (const field of fields) {
    for (const window of literalContentWindows(field.text)) {
      const group = byWindow.get(window) ?? [];
      group.push(field);
      byWindow.set(window, group);
    }
  }

  for (const field of fields) {
    if (!field.reportable) continue;
    const hits: Array<{ phrase: string; chapters: number[] }> = [];
    const seen = new Set<string>();
    for (const window of literalContentWindows(field.text)) {
      if (seen.has(window)) continue;
      seen.add(window);
      const others = (byWindow.get(window) ?? []).filter((candidate) => candidate.chapterNumber !== field.chapterNumber);
      const chapters = [...new Set(others.map((candidate) => candidate.chapterNumber))].sort((a, b) => a - b);
      if (chapters.length < AS10_MIN_OTHER_CHAPTERS) continue;
      hits.push({ phrase: window, chapters });
    }
    if (!hits.length) continue;
    hits.sort((a, b) => b.chapters.length - a.chapters.length);
    const sample = hits.slice(0, 5).map((hit) => `"${hit.phrase}" (Ch${hit.chapters.join(",")})`).join("; ");
    findings.push({
      checkId: "SEC89.example_cross_chapter_literal_ngram",
      severity: "blocker",
      chapterNumber: field.chapterNumber,
      section: "example-pack",
      path: field.path,
      message: `${field.path} contains ${hits.length} verbatim 5-token phrase(s) that also appear in at least ${AS10_MIN_OTHER_CHAPTERS} other chapter(s). Top: ${sample}. Rewrite this example field from this chapter's source material.`,
    });
  }
  return findings;
}

function crossChapterSummaryLiteralNgramFindings(fields: SummaryLiteralFieldOccurrence[]): SectionFinding[] {
  const findings: SectionFinding[] = [];
  const byWindow = new Map<string, SummaryLiteralFieldOccurrence[]>();
  for (const field of fields) {
    for (const window of literalContentWindows(field.text)) {
      const group = byWindow.get(window) ?? [];
      group.push(field);
      byWindow.set(window, group);
    }
  }

  for (const field of fields) {
    if (!field.reportable) continue;
    const hits: Array<{ phrase: string; chapters: number[] }> = [];
    const seen = new Set<string>();
    for (const window of literalContentWindows(field.text)) {
      if (seen.has(window)) continue;
      seen.add(window);
      const others = (byWindow.get(window) ?? []).filter((candidate) => candidate.chapterNumber !== field.chapterNumber);
      const chapters = [...new Set(others.map((candidate) => candidate.chapterNumber))].sort((a, b) => a - b);
      if (chapters.length < AS10_MIN_OTHER_CHAPTERS) continue;
      hits.push({ phrase: window, chapters });
    }
    if (!hits.length) continue;
    hits.sort((a, b) => b.chapters.length - a.chapters.length);
    const sample = hits.slice(0, 5).map((hit) => `"${hit.phrase}" (Ch${hit.chapters.join(",")})`).join("; ");
    findings.push({
      checkId: "SEC83.summary_cross_chapter_ngram",
      severity: "blocker",
      chapterNumber: field.chapterNumber,
      section: "summary-pack",
      path: field.path,
      message: `${field.path} contains ${hits.length} verbatim 5-token phrase(s) that also appear in at least ${AS10_MIN_OTHER_CHAPTERS} other chapter(s). Top: ${sample}. Rewrite this summary tier from this chapter's source material before deterministic QC AS10.`,
    });
  }
  return findings;
}

function collectNGramFingerprints(tokens: string[], k: number): Set<string> {
  const out = new Set<string>();
  if (tokens.length < k) {
    out.add(tokens.join(" "));
    return out;
  }
  for (let i = 0; i <= tokens.length - k; i++) out.add(tokens.slice(i, i + k).join(" "));
  return out;
}

function crossChapterQuizNgramTemplateFindings(fields: QuizLiteralFieldOccurrence[]): SectionFinding[] {
  const findings: SectionFinding[] = [];
  const windows: Array<{ n: number; threshold: number }> = [
    { n: 8, threshold: 5 },
    { n: 6, threshold: 10 },
    { n: 5, threshold: 20 },
  ];
  const locked4grams = new Set<string>();
  const reported = new Set<string>();
  for (const { n, threshold } of windows) {
    const byPhrase = new Map<string, QuizLiteralFieldOccurrence[]>();
    for (const field of fields) {
      for (const phrase of ngrams(field.text, n)) {
        const group = byPhrase.get(phrase) ?? [];
        group.push(field);
        byPhrase.set(phrase, group);
      }
    }
    const offenders = [...byPhrase.entries()]
      .filter(([, group]) => group.length >= threshold)
      .sort((a, b) => b[1].length - a[1].length);
    for (const [phrase, group] of offenders) {
      const fingerprints = collectNGramFingerprints(phrase.split(" "), 4);
      if ([...fingerprints].some((fp) => locked4grams.has(fp))) continue;
      for (const fp of fingerprints) locked4grams.add(fp);
      const chapters = [...new Set(group.map((field) => field.chapterNumber))].sort((a, b) => a - b);
      const reportable = group.filter((field) => field.reportable);
      for (const field of reportable) {
        const key = `${field.chapterNumber}:${field.path}:${phrase}`;
        if (reported.has(key)) continue;
        reported.add(key);
        findings.push({
          checkId: "SEC94.quiz_cross_chapter_ngram",
          severity: "blocker",
          chapterNumber: field.chapterNumber,
          section: "learning-pack",
          path: field.path,
          message: `${field.path} repeats ${n}-word quiz phrase "${phrase}" ${group.length} times across ch${chapters.map((ch) => String(ch).padStart(2, "0")).join(", ch")}; rewrite quiz prompt/choice/explanation with chapter-specific case language before book-gate BP20`,
        });
      }
    }
  }
  return findings;
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let from = 0;
  while ((from = haystack.indexOf(needle, from)) !== -1) {
    count++;
    from += needle.length;
  }
  return count;
}

function softBannedBudgetFindings(fields: SoftBannedTextOccurrence[]): SectionFinding[] {
  const cfg = loadBannedPhrases();
  const softBanned: Array<{ phrase: string; perBookBudget: number; reason?: string }> = cfg.softBanned ?? [];
  const findings: SectionFinding[] = [];
  for (const entry of softBanned) {
    const needle = (entry.phrase ?? "").toLowerCase().trim();
    if (!needle) continue;
    const budget = Number.isFinite(entry.perBookBudget) ? entry.perBookBudget : 0;
    let total = 0;
    const contributing: Array<SoftBannedTextOccurrence & { count: number }> = [];
    for (const field of fields) {
      const count = countOccurrences(field.text.toLowerCase(), needle);
      if (!count) continue;
      total += count;
      if (field.reportable) contributing.push({ ...field, count });
    }
    if (total <= budget || contributing.length === 0) continue;
    for (const field of contributing) {
      findings.push({
        checkId: "SEC90.soft_banned_budget",
        severity: "blocker",
        chapterNumber: field.chapterNumber,
        section: field.section,
        path: field.path,
        message: `soft-banned phrase "${entry.phrase}" appears ${total} time(s) across available section artifacts (budget ${budget}); this field contributes ${field.count}. ${entry.reason ?? ""}`.trim(),
      });
    }
  }
  return findings;
}

function crossFieldSimilarityFindings(fields: CrossFieldOccurrence[], checkId: string, message: string): SectionFinding[] {
  const findings: SectionFinding[] = [];
  for (let i = 0; i < fields.length; i++) {
    for (let j = 0; j < i; j++) {
      const a = fields[i];
      const b = fields[j];
      if (a.chapterNumber === b.chapterNumber) continue;
      const score = wordSetSimilarity(a.text, b.text);
      if (score < CROSS_FIELD_SIMILARITY_THRESHOLD) continue;
      findings.push({ checkId, severity: "blocker", chapterNumber: a.chapterNumber, section: a.section, path: a.path, message: `${message}; overlaps ch${String(b.chapterNumber).padStart(2, "0")} at ${(score * 100).toFixed(0)}% word-set similarity` });
      break;
    }
  }
  return findings;
}

function quizPromptNgramReuseFindings(pack: LearningPackV1, chapterNumber: number): SectionFinding[] {
  const findings: SectionFinding[] = [];
  const byPhrase = new Map<string, number[]>();
  for (const [i, q] of (pack.quiz?.questions ?? []).entries()) {
    const words = normalizedWords(text(q.prompt));
    for (let j = 0; j <= words.length - 8; j++) {
      const phraseWords = words.slice(j, j + 8);
      const contentCount = phraseWords.filter((w) => w.length >= 4 && !NGRAM_STOPWORDS.has(w)).length;
      if (contentCount < 3) continue;
      const phrase = phraseWords.join(" ");
      byPhrase.set(phrase, [...(byPhrase.get(phrase) ?? []), i]);
    }
  }
  const reported = new Set<number>();
  for (const [phrase, indexes] of byPhrase) {
    const unique = [...new Set(indexes)].sort((a, b) => a - b);
    if (unique.length < 2) continue;
    for (const i of unique) {
      if (reported.has(i)) continue;
      reported.add(i);
      findings.push({
        checkId: "SEC107.quiz_prompt_ngram_reuse",
        severity: "blocker",
        chapterNumber,
        section: "learning-pack",
        path: `/quiz/questions/${i}/prompt`,
        message: `quiz prompts ${unique.map((n) => n + 1).join(", ")} share the 8-word phrase "${phrase}"; rewrite one prompt around a different scenario or evidence detail`,
      });
    }
  }
  return findings;
}

function summaryTierNgramFindings(fields: CrossFieldOccurrence[]): SectionFinding[] {
  const findings: SectionFinding[] = [];
  for (let i = 0; i < fields.length; i++) {
    for (let j = 0; j < i; j++) {
      const a = fields[i];
      const b = fields[j];
      if (a.chapterNumber === b.chapterNumber) continue;
      const aParagraphs = text(a.text).split(/\n{2,}/).map((p) => p.trim()).filter((p) => p.length >= 100);
      const bParagraphs = new Set(text(b.text).split(/\n{2,}/).map((p) => p.trim()).filter((p) => p.length >= 100));
      if (aParagraphs.some((p) => bParagraphs.has(p))) {
        findings.push({ checkId: "SEC82.summary_repeated_fullread_paragraph", severity: "blocker", chapterNumber: a.chapterNumber, section: "summary-pack", path: a.path, message: `${a.path} repeats a paragraph from ch${String(b.chapterNumber).padStart(2, "0")} ${b.path}` });
        break;
      }
      const an = ngrams(a.text, 5);
      const bn = ngrams(b.text, 5);
      let shared = 0;
      for (const gram of an) if (bn.has(gram)) shared++;
      if (shared >= SUMMARY_SHARED_NGRAM_FLOOR) {
        findings.push({ checkId: "SEC83.summary_cross_chapter_ngram", severity: "blocker", chapterNumber: a.chapterNumber, section: "summary-pack", path: a.path, message: `${a.path} shares ${shared} verbatim 5-word phrases with ch${String(b.chapterNumber).padStart(2, "0")} ${b.path}; rewrite chapter-specific connective prose` });
        break;
      }
    }
  }
  return findings;
}

function summaryHookFirstWordCapFindings(hooks: SummaryHookFirstWordOccurrence[]): SectionFinding[] {
  if (hooks.length < SUMMARY_HOOK_FIRST_WORD_MIN_CHAPTERS) return [];
  const grouped = new Map<string, SummaryHookFirstWordOccurrence[]>();
  for (const hook of hooks) {
    const group = grouped.get(hook.firstWord) ?? [];
    group.push(hook);
    grouped.set(hook.firstWord, group);
  }
  const threshold = Math.ceil(hooks.length * SUMMARY_HOOK_FIRST_WORD_CAP);
  const findings: SectionFinding[] = [];
  for (const [firstWord, group] of grouped) {
    if (group.length < threshold) continue;
    const chapters = group.map((g) => g.chapterNumber).sort((a, b) => a - b);
    for (const hit of group) {
      if (!hit.reportable) continue;
      findings.push({
        checkId: "SEC95.summary_hook_first_word_clustering",
        severity: "blocker",
        chapterNumber: hit.chapterNumber,
        section: "summary-pack",
        path: hit.path,
        message: `summary hook opens with "${firstWord}", which appears in ${group.length} of ${hooks.length} selected summary hooks (B13 cap ${threshold}, ${Math.round(SUMMARY_HOOK_FIRST_WORD_CAP * 100)}% of batch). Vary hook first words across the parallel batch. Chapters: ${chapters.join(", ")}.`,
      });
    }
  }
  return findings;
}

function containsSourcePhrase(value: string, phrases: string[]): boolean {
  const haystack = normalizePhrase(value);
  return phrases.some((phrase) => haystack.includes(phrase));
}

function sourceFactById(packet: SourcePacketV1): Map<string, SourcePacketV1["facts"][number]> {
  return new Map(packet.facts.map((f) => [f.id, f]));
}

function namedCaseById(packet: SourcePacketV1): Map<string, SourcePacketV1["namedCases"][number]> {
  return new Map(packet.namedCases.map((c) => [c.id, c]));
}

function caseSpecificPhrases(namedCase: SourcePacketV1["namedCases"][number], packet: SourcePacketV1): string[] {
  const frameworkWords = new Set(packet.frameworks.flatMap((framework) => framework.members.flatMap((member) => normalizedWords(member).map(rootWord))));
  const phrases: string[] = [];
  for (const specific of namedCase.hardSpecifics) {
    const terms = normalizedWords(specific)
      .map(rootWord)
      .filter((word) => word.length >= 4 && !SOURCE_ALIGNMENT_STOP_WORDS.has(word));
    if (terms.length < 2) continue;
    for (let i = 0; i < terms.length - 1; i++) {
      const pair = terms.slice(i, i + 2);
      if (pair.every((word) => frameworkWords.has(word))) continue;
      phrases.push(pair.join(" "));
    }
    if (terms.length >= 3 && !terms.every((word) => frameworkWords.has(word))) phrases.push(terms.join(" "));
  }
  return [...new Set(phrases)];
}

function factAlignmentTerms(fact: SourcePacketV1["facts"][number]): Set<string> {
  return sourceAlignmentKeywords([
    fact.claim,
    fact.mechanism,
    fact.commonError,
    fact.whyWrong,
    ...fact.groundedEntities,
    ...fact.groundedNumbers,
  ].join(" "));
}

function factWhyOverlap(whyItMatters: string, fact: SourcePacketV1["facts"][number]): string[] {
  const whyTerms = sourceAlignmentKeywords(whyItMatters);
  const factTerms = factAlignmentTerms(fact);
  return [...factTerms].filter((term) => whyTerms.has(term));
}

export function validateSummaryPack(pack: SummaryPackV1, bp: ChapterBlueprintV1, packet: SourcePacketV1): SectionFinding[] {
  const findings: SectionFinding[] = [];
  const ch = bp.chapterNumber;
  const allowed = sourceAnchorIds(packet);
  const anchors = sourceAnchorById(packet);
  const push = (checkId: string, severity: SectionFinding["severity"], message: string, path?: string) => findings.push({ checkId, severity, chapterNumber: ch, section: "summary-pack", message, path });
  if (pack.schemaVersion !== SECTION_ARTIFACT_SCHEMA_VERSION || pack.artifactType !== "summary-pack") push("SEC1.summary_schema", "blocker", "summary-pack schema/artifactType mismatch");
  if (pack.chapterId !== bp.chapterId) push("SEC2.summary_identity", "blocker", "summary-pack chapterId must match blueprint", "/chapterId");
  if (text(pack.hook?.hook).length < 40) push("SEC3.hook_length", "blocker", "hook too short", "/hook/hook");
  if (text(pack.hook?.hook).length > 180) push("SEC4.hook_length", "advisory", "hook is long; keep it punchy", "/hook/hook");
  for (const f of checkSentenceSanity(text(pack.hook?.hook), "hook")) push("SEC11.summary_sentence_sanity", "blocker", f.message, "/hook/hook");
  for (const f of checkSentenceSanity(text(pack.hook?.counterintuition), "counterintuition")) push("SEC11.summary_sentence_sanity", "blocker", f.message, "/hook/counterintuition");
  for (const p of validateAnchorIds(pack.hook?.sourceAnchorIds, allowed, "hook.sourceAnchorIds")) push("SEC5.hook_anchor", "blocker", p, "/hook/sourceAnchorIds");
  for (const p of validateAnchorClaimType(pack.hook?.sourceAnchorIds, anchors, "hook", "hook.sourceAnchorIds")) push("SEC13.summary_anchor_claim_type", "blocker", p, "/hook/sourceAnchorIds");
  for (const p of validateAnchorHardSpecifics(pack.hook?.sourceAnchorIds, anchors, "hook", pack.hook?.hook, "hook")) push("SEC14.summary_anchor_specifics", "blocker", p, "/hook/hook");
  if (text(pack.hook?.counterintuition)) {
    const counterIds = anchorArray(pack.hook?.counterintuitionSourceAnchorIds).length ? pack.hook?.counterintuitionSourceAnchorIds : pack.hook?.sourceAnchorIds;
    for (const p of validateAnchorIds(counterIds, allowed, "hook.counterintuitionSourceAnchorIds")) push("SEC5.hook_anchor", "blocker", p, "/hook/counterintuitionSourceAnchorIds");
    for (const p of validateAnchorClaimType(counterIds, anchors, "hook", "hook.counterintuitionSourceAnchorIds")) push("SEC13.summary_anchor_claim_type", "blocker", p, "/hook/counterintuitionSourceAnchorIds");
    for (const p of validateAnchorHardSpecifics(counterIds, anchors, "hook", pack.hook?.counterintuition, "counterintuition")) push("SEC14.summary_anchor_specifics", "blocker", p, "/hook/counterintuition");
  }
  const tiers = ["fastRead", "deepRead", "fullRead"] as const;
  const mins = { fastRead: 350, deepRead: 1000, fullRead: 2400 } as const;
  const memorableCandidates: Array<{ text: string; score: number; tier: typeof tiers[number]; ids: unknown }> = [];
  for (const tier of tiers) {
    const value = text(pack.breakdown?.[tier]);
    if (value.length < mins[tier]) push("SEC6.breakdown_length", "blocker", `${tier} too short (${value.length})`, `/breakdown/${tier}`);
    if (/\b(this chapter|the chapter|the author|the book)\b/i.test(value)) push("SEC7.meta_reference", "blocker", `${tier} contains meta-reference`, `/breakdown/${tier}`);
    for (const f of checkReadingLevel(value, tier)) push("SEC12.summary_readability", "blocker", f.message, `/breakdown/${tier}`);
    for (const p of validateAnchorIds(pack.breakdown?.sourceAnchorIds?.[tier], allowed, `breakdown.sourceAnchorIds.${tier}`)) push("SEC8.breakdown_anchor", "blocker", p, `/breakdown/sourceAnchorIds/${tier}`);
    for (const p of validateAnchorClaimType(pack.breakdown?.sourceAnchorIds?.[tier], anchors, "breakdown_claim", `breakdown.sourceAnchorIds.${tier}`)) push("SEC13.summary_anchor_claim_type", "blocker", p, `/breakdown/sourceAnchorIds/${tier}`);
    for (const p of validateAnchorHardSpecifics(pack.breakdown?.sourceAnchorIds?.[tier], anchors, "breakdown_claim", value, `breakdown.${tier}`)) push("SEC14.summary_anchor_specifics", "blocker", p, `/breakdown/${tier}`);
    memorableCandidates.push(...scoredMemorableSentences(value).map((candidate) => ({ ...candidate, tier, ids: pack.breakdown?.sourceAnchorIds?.[tier] })));
  }
  const usedMemorableKeys = new Set<string>();
  const selectedMemorable = memorableCandidates
    .sort((a, b) => b.score - a.score)
    .filter((candidate) => {
      const key = candidate.text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      if (usedMemorableKeys.has(key)) return false;
      usedMemorableKeys.add(key);
      return true;
    })
    .slice(0, 3);
  if (selectedMemorable.length < 3) {
    push("SEC17.summary_memorable_candidate_count", "blocker", `breakdown yields only ${selectedMemorable.length}/3 acceptable deterministic memorable-line candidates; seed standalone aphoristic sentences`, "/breakdown");
  }
  for (const candidate of selectedMemorable) {
    for (const p of validateAnchorClaimType(candidate.ids, anchors, "memorable_line", `selected memorable line in breakdown.${candidate.tier}`)) push("SEC15.summary_memorable_anchor_claim_type", "blocker", p, `/breakdown/${candidate.tier}`);
    for (const p of validateAnchorHardSpecifics(candidate.ids, anchors, "memorable_line", candidate.text, `selected memorable line "${candidate.text.replace(/[.!?]+$/, "")}"`)) push("SEC16.summary_memorable_anchor_specifics", "blocker", p, `/breakdown/${candidate.tier}`);
  }
  if (text(pack.keyTakeaway).length < 50) push("SEC9.takeaway_length", "blocker", "keyTakeaway too short", "/keyTakeaway");
  if (wordCount(pack.keyTakeaway) > 30) push("SEC18.takeaway_word_cap", "blocker", `keyTakeaway is ${wordCount(pack.keyTakeaway)} words (cap 30)`, "/keyTakeaway");
  for (const f of checkSentenceSanity(text(pack.keyTakeaway), "keyTakeaway")) push("SEC11.summary_sentence_sanity", "blocker", f.message, "/keyTakeaway");
  for (const p of validateAnchorIds(pack.keyTakeawaySourceAnchorIds, allowed, "keyTakeawaySourceAnchorIds")) push("SEC10.takeaway_anchor", "blocker", p, "/keyTakeawaySourceAnchorIds");
  for (const p of validateAnchorClaimType(pack.keyTakeawaySourceAnchorIds, anchors, "takeaway", "keyTakeawaySourceAnchorIds")) push("SEC13.summary_anchor_claim_type", "blocker", p, "/keyTakeawaySourceAnchorIds");
  for (const p of validateAnchorHardSpecifics(pack.keyTakeawaySourceAnchorIds, anchors, "takeaway", pack.keyTakeaway, "keyTakeaway")) push("SEC14.summary_anchor_specifics", "blocker", p, "/keyTakeaway");
  if (text(pack.tryThisNow)) {
    for (const p of validateAnchorIds(pack.tryThisNowSourceAnchorIds, allowed, "tryThisNowSourceAnchorIds")) push("SEC10.try_anchor", "blocker", p, "/tryThisNowSourceAnchorIds");
    for (const p of validateAnchorClaimType(pack.tryThisNowSourceAnchorIds, anchors, "implementation_guidance", "tryThisNowSourceAnchorIds")) push("SEC13.summary_anchor_claim_type", "blocker", p, "/tryThisNowSourceAnchorIds");
    for (const p of validateAnchorHardSpecifics(pack.tryThisNowSourceAnchorIds, anchors, "implementation_guidance", pack.tryThisNow, "tryThisNow")) push("SEC14.summary_anchor_specifics", "blocker", p, "/tryThisNow");
  }
  return findings;
}

export function validateExamplePack(pack: ExamplePackV1, bp: ChapterBlueprintV1, packet: SourcePacketV1): SectionFinding[] {
  const findings: SectionFinding[] = [];
  const ch = bp.chapterNumber;
  const allowed = sourceAnchorIds(packet);
  const anchors = sourceAnchorById(packet);
  const facts = sourceFactById(packet);
  const allowedFactOrCase = sourceFactIdsFromAnchors(bp);
  const phrases = sourcePhrases(packet);
  const sourceNames = protectedSourceNames(packet);
  const actorReservedNames = new Set([...sourceNames, ...GLOBAL_RESERVED_SOURCE_FIGURE_NAMES]);
  const sourceReferenceNames = sourceMentionNames(packet);
  const push = (checkId: string, severity: SectionFinding["severity"], message: string, path?: string) => findings.push({ checkId, severity, chapterNumber: ch, section: "example-pack", message, path });
  if (pack.schemaVersion !== SECTION_ARTIFACT_SCHEMA_VERSION || pack.artifactType !== "example-pack") push("SEC20.example_schema", "blocker", "example-pack schema/artifactType mismatch");
  if (pack.chapterId !== bp.chapterId) push("SEC21.example_identity", "blocker", "example-pack chapterId must match blueprint", "/chapterId");
  if (!Array.isArray(pack.examples) || pack.examples.length !== bp.sections.examples.length) push("SEC22.example_count", "blocker", `example count ${pack.examples?.length ?? 0} != blueprint ${bp.sections.examples.length}`, "/examples");
  const names = new Set<string>();
  const titleSecondWords = new Map<string, number[]>();
  for (const [i, ex] of (pack.examples ?? []).entries()) {
    const root = `/examples/${i}`;
    const expectedExId = `ex${String(i + 1).padStart(2, "0")}`;
    const expectedChapterPrefix = `ch${String(ch).padStart(2, "0")}-${expectedExId}-`;
    const actualExId = text(ex.exampleId);
    if (!EXAMPLE_ID_RE.test(actualExId) || (actualExId !== expectedExId && !actualExId.startsWith(expectedChapterPrefix))) {
      push(
        "SEC112.example_id_shape",
        "blocker",
        `example ${i + 1} exampleId must be ${expectedExId} or start with ${expectedChapterPrefix}; do not include bookId or another chapter number`,
        `${root}/exampleId`,
      );
    }
    if (text(ex.title).length < 8) push("SEC23.example_title", "blocker", `example ${i + 1} title too short`, `${root}/title`);
    const titleWords = normalizePhrase(text(ex.title)).split(/\s+/).filter(Boolean);
    if (titleWords[1]) titleSecondWords.set(titleWords[1], [...(titleSecondWords.get(titleWords[1]) ?? []), i]);
    if (text(ex.scenario).length < 180) push("SEC24.example_scenario", "blocker", `example ${i + 1} scenario too short`, `${root}/scenario`);
    if (!/\b[A-Z][a-z]+\b/.test(text(ex.scenario))) push("SEC25.example_named_actor", "blocker", `example ${i + 1} needs a named actor`, `${root}/scenario`);
    for (const [field, value] of [
      ["title", ex.title],
      ["scenario", ex.scenario],
      ["whatToDo", ex.whatToDo],
      ["whyItMatters", ex.whyItMatters],
    ] as const) {
      const jammed = jammedProperNoun(text(value));
      if (jammed) {
        push("SEC88.example_jammed_proper_noun", "blocker", `example ${i + 1} ${field} contains jammed proper noun "${jammed}"; separate the words or use descriptive source language`, `${root}/${field}`);
      }
    }
    if (STOCK_SCENE_OPENER_RE.test(text(ex.scenario))) {
      push("SEC36.example_stock_scene_opener", "blocker", `example ${i + 1} opens with a stock scene phrase that repeats across books; rewrite the opening action around this chapter's decision`, `${root}/scenario`);
    }
    if (/\b(this chapter|the chapter|the author|the book)\b/i.test(`${ex.scenario} ${ex.whatToDo} ${ex.whyItMatters}`)) push("SEC26.example_meta", "blocker", `example ${i + 1} contains meta-reference`, root);
    if (syntheticSceneShell(text(ex.scenario))) {
      push("SEC37.example_synthetic_scene_shell", "blocker", `example ${i + 1} contains synthetic prop/venue scaffolding such as coined compound tokens, beside/toward page motion, or "stays closed" closures`, `${root}/scenario`);
    }
    for (const name of actorReservedNames) {
      if (sourceNameActorPattern(name).test(text(ex.scenario))) {
        push("SEC34.example_source_figure_actor", "blocker", `example ${i + 1} uses source figure name "${name}" as a fictional actor; rename the invented person`, `${root}/scenario`);
      }
    }
    const slotAllowedNames = new Set([...(bp.sections.examples[i]?.allowedNames ?? []), ...bp.reservedVariety.allowedNames]);
    const scenarioNames = extractNamesFromText(text(ex.scenario));
    const undealtNames = [...new Set(scenarioNames.filter((name) => !slotAllowedNames.has(name) && !sourceNames.has(name) && !sourceReferenceNames.has(name)))];
    if (undealtNames.length) {
      push("SEC35.example_dealt_name", "blocker", `example ${i + 1} uses undealt protagonist/name(s): ${undealtNames.join(", ")}; use only this slot's dealt fictional names`, `${root}/scenario`);
    }
    if (PROP_SUBJECT_TITLE_RE.test(text(ex.title)) && containsSourcePhrase(text(ex.title), phrases)) {
      push("SEC30.example_source_label_prop", "blocker", `example ${i + 1} title makes a prop act on a source label; make a human decision/action carry the scene`, `${root}/title`);
    }
    if (COMPASS_SCAFFOLD_RE.test(text(ex.scenario))) {
      push("SEC30.example_source_label_prop", "blocker", `example ${i + 1} scenario contains compass/placeholder scaffold prose instead of a lived human decision`, `${root}/scenario`);
    }
    if (SOURCE_LABEL_ARRANGEMENT_RE.test(text(ex.whatToDo)) && containsSourcePhrase(text(ex.whatToDo), phrases)) {
      push("SEC30.example_source_label_prop", "blocker", `example ${i + 1} whatToDo arranges source labels instead of naming a concrete reader/protagonist action`, `${root}/whatToDo`);
    }
    if (!SCENE_DECISION_RE.test(text(ex.scenario))) {
      push("SEC31.example_decision_scene", "blocker", `example ${i + 1} scenario needs a visible decision, tradeoff, mistake, friction, or recovery`, `${root}/scenario`);
    }
    const exampleAnchorIds = Array.isArray(ex.sourceAnchorIds) ? ex.sourceAnchorIds : ex.sourceAnchorId ? [ex.sourceAnchorId] : [];
    for (const p of validateAnchorIds(exampleAnchorIds, allowed, `examples[${i}].sourceAnchorIds`)) push("SEC27.example_anchor", "blocker", p, `${root}/sourceAnchorIds`);
    for (const id of exampleAnchorIds) {
      const anchor = typeof id === "string" ? anchors.get(id) : null;
      if (anchor && !anchor.supportsClaimTypes?.includes("example")) {
        push("SEC32.example_anchor_claim_type", "blocker", `example ${i + 1} sourceAnchorId ${id} does not support example claims; use a named-example anchor and keep fact ids in sourceFactIds`, `${root}/sourceAnchorIds`);
      }
      const specifics = anchor?.hardSpecifics ?? [];
      if (anchor?.supportsClaimTypes?.includes("example") && specifics.length >= 2) {
        const combined = `${text(ex.scenario)} ${text(ex.whatToDo)} ${text(ex.whyItMatters)}`.toLowerCase();
        const present = specifics.filter((specific) => specific && combined.includes(specific.toLowerCase())).length;
        if (present < 2) {
          push("SEC33.example_anchor_specifics", "blocker", `example ${i + 1} cites ${id} but uses ${present}/2 required hardSpecifics verbatim; build the scene from at least two concrete case details`, root);
        }
      }
    }
    for (const id of [...(ex.sourceFactIds ?? []), ...(ex.namedCaseIds ?? [])]) if (!allowedFactOrCase.has(id)) push("SEC28.example_fact", "blocker", `example ${i + 1} cites unknown fact/case ${id}`, root);
    for (const id of ex.sourceFactIds ?? []) {
      const fact = facts.get(id);
      if (!fact) continue;
      const terms = factAlignmentTerms(fact);
      if (terms.size < 8) continue;
      const overlap = factWhyOverlap(text(ex.whyItMatters), fact);
      const minimum = terms.size >= 12 ? 3 : 2;
      if (overlap.length < minimum) {
        push(
          "SEC39.example_why_fact_alignment",
          "blocker",
          `example ${i + 1} whyItMatters does not explain cited source fact ${id}; include the fact's decision logic, not only a neighboring named case`,
          `${root}/whyItMatters`,
        );
      }
    }
    const firstName = text(ex.scenario).match(/\b[A-Z][a-z]+\b/)?.[0];
    if (firstName) {
      if (names.has(firstName)) push("SEC29.example_name_reuse", "advisory", `name ${firstName} reused inside chapter`, `${root}/scenario`);
      names.add(firstName);
    }
  }
  findings.push(...exampleIntraPackNgramFindings(pack, ch));
  for (const [word, indexes] of titleSecondWords.entries()) {
    if (indexes.length >= Math.max(4, Math.ceil((pack.examples?.length ?? 0) * 0.66))) {
      push("SEC38.example_title_shape_reuse", "blocker", `${indexes.length} example titles share "${word}" as the second word; vary title grammar across the six examples`, "/examples");
    }
  }
  return findings;
}

export function validateLearningPack(pack: LearningPackV1, bp: ChapterBlueprintV1, packet: SourcePacketV1): SectionFinding[] {
  const findings: SectionFinding[] = [];
  const ch = bp.chapterNumber;
  const allowed = sourceAnchorIds(packet);
  const anchors = sourceAnchorById(packet);
  const namedCases = namedCaseById(packet);
  const push = (checkId: string, severity: SectionFinding["severity"], message: string, path?: string) => findings.push({ checkId, severity, chapterNumber: ch, section: "learning-pack", message, path });
  if (pack.schemaVersion !== SECTION_ARTIFACT_SCHEMA_VERSION || pack.artifactType !== "learning-pack") push("SEC40.learning_schema", "blocker", "learning-pack schema/artifactType mismatch");
  if (pack.chapterId !== bp.chapterId) push("SEC41.learning_identity", "blocker", "learning-pack chapterId must match blueprint", "/chapterId");
  const qs = pack.quiz?.questions ?? [];
  if (qs.length !== bp.sections.quiz.length) push("SEC42.quiz_count", "blocker", `quiz count ${qs.length} != blueprint ${bp.sections.quiz.length}`, "/quiz/questions");
  for (const [i, q] of qs.entries()) {
    if (text(q.prompt).length < 35) push("SEC43.quiz_prompt", "blocker", `q${i + 1} prompt too short`, `/quiz/questions/${i}/prompt`);
    if (!Array.isArray(q.choices) || q.choices.length !== 3) push("SEC44.quiz_choices", "blocker", `q${i + 1} must have exactly 3 choices`, `/quiz/questions/${i}/choices`);
    const correctIndexOk = Number.isInteger(q.correctIndex) && q.correctIndex >= 0 && q.correctIndex <= 2;
    if (!correctIndexOk) push("SEC45.quiz_key", "blocker", `q${i + 1} correctIndex must be 0..2`, `/quiz/questions/${i}/correctIndex`);
    const wanted = bp.sections.quiz[i]?.correctIndex;
    if (Number.isInteger(wanted) && q.correctIndex !== wanted) push("SEC46.quiz_key_pattern", "blocker", `q${i + 1} correctIndex ${q.correctIndex} != blueprint ${wanted}`, `/quiz/questions/${i}/correctIndex`);
    if (!BLOOMS_LEVELS.has(text((q as any).bloomsLevel))) {
      push("SEC93.quiz_metadata", "blocker", `q${i + 1} bloomsLevel missing or invalid; use remember|understand|apply|analyze|evaluate|create`, `/quiz/questions/${i}/bloomsLevel`);
    }
    if (!DEPTH_LEVELS.has(text((q as any).depthLevel))) {
      push("SEC93.quiz_metadata", "blocker", `q${i + 1} depthLevel missing or invalid; use the blueprint depthLevel`, `/quiz/questions/${i}/depthLevel`);
    } else if (bp.sections.quiz[i]?.depthLevel && q.depthLevel !== bp.sections.quiz[i]?.depthLevel) {
      push("SEC93.quiz_metadata", "blocker", `q${i + 1} depthLevel ${q.depthLevel} != blueprint ${bp.sections.quiz[i].depthLevel}`, `/quiz/questions/${i}/depthLevel`);
    }
    const qSourceIds = anchorArray(q.sourceAnchorIds ?? (q as any).sourceAnchorId);
    const keyEvidenceIds = anchorArray(q.keyEvidenceAnchorIds).length ? q.keyEvidenceAnchorIds : qSourceIds;
    const correctChoice = correctIndexOk && Array.isArray(q.choices) ? text(q.choices[q.correctIndex]) : "";
    for (const p of validateAnchorIds(qSourceIds, allowed, `quiz.questions[${i}].sourceAnchorIds`)) push("SEC47.quiz_anchor", "blocker", p, `/quiz/questions/${i}/sourceAnchorIds`);
    for (const p of validateAnchorIds(keyEvidenceIds, allowed, `quiz.questions[${i}].keyEvidenceAnchorIds`)) push("SEC47.quiz_anchor", "blocker", p, `/quiz/questions/${i}/keyEvidenceAnchorIds`);
    for (const p of validateAnchorClaimType(qSourceIds, anchors, "quiz_prompt", `quiz.questions[${i}].sourceAnchorIds`)) push("SEC55.quiz_anchor_claim_type", "blocker", p, `/quiz/questions/${i}/sourceAnchorIds`);
    for (const p of validateAnchorClaimType(qSourceIds, anchors, "quiz_explanation", `quiz.questions[${i}].sourceAnchorIds`)) push("SEC55.quiz_anchor_claim_type", "blocker", p, `/quiz/questions/${i}/sourceAnchorIds`);
    for (const p of validateAnchorClaimType(keyEvidenceIds, anchors, "quiz_key_evidence", `quiz.questions[${i}].keyEvidenceAnchorIds`)) push("SEC55.quiz_anchor_claim_type", "blocker", p, `/quiz/questions/${i}/keyEvidenceAnchorIds`);
    for (const p of validateAnchorHardSpecifics(qSourceIds, anchors, "quiz_prompt", q.prompt, `quiz.questions[${i}].prompt`)) push("SEC56.quiz_anchor_specifics", "blocker", p, `/quiz/questions/${i}/prompt`);
    for (const p of validateAnchorHardSpecifics(qSourceIds, anchors, "quiz_explanation", q.explanation, `quiz.questions[${i}].explanation`)) push("SEC56.quiz_anchor_specifics", "blocker", p, `/quiz/questions/${i}/explanation`);
    for (const p of validateAnchorHardSpecifics(keyEvidenceIds, anchors, "quiz_key_evidence", `${text(q.prompt)} ${correctChoice} ${text(q.explanation)}`, `quiz.questions[${i}].keyEvidence`)) push("SEC56.quiz_anchor_specifics", "blocker", p, `/quiz/questions/${i}/keyEvidenceAnchorIds`);
    const citedNamedCases = new Set([...qSourceIds, ...anchorArray(keyEvidenceIds)].filter((id) => namedCases.has(id)));
    if (citedNamedCases.size > 0) {
      const haystack = normalizedWords(`${text(q.prompt)} ${correctChoice} ${text(q.explanation)}`).map(rootWord).join(" ");
      for (const namedCase of namedCases.values()) {
        if (citedNamedCases.has(namedCase.id)) continue;
        const hits = caseSpecificPhrases(namedCase, packet).filter((phrase) => haystack.includes(phrase));
        if (hits.length < 1) continue;
        push(
          "SEC111.quiz_cross_case_detail",
          "blocker",
          `q${i + 1} cites ${[...citedNamedCases].join(", ")} but also imports hard-specific phrase(s) from ${namedCase.id} (${namedCase.label}): ${hits.slice(0, 4).join(", ")}; keep quiz prompt/choices/explanation source-local or cite both cases deliberately`,
          `/quiz/questions/${i}`,
        );
      }
    }
    if (Array.isArray(q.choices) && q.choices.length === 3 && correctIndexOk) {
      const distractorLengths: number[] = [];
      for (const [choiceIndex, choice] of q.choices.entries()) {
        if (choiceIndex === q.correctIndex) continue;
        const choiceText = text(choice);
        const tailProblem = quizMechanicalTailProblem(choiceText);
        if (tailProblem) {
          push("SEC59.quiz_mechanical_tail", "blocker", `q${i + 1} distractor ${choiceIndex} ${tailProblem}; rewrite as a natural chapter-specific misconception`, `/quiz/questions/${i}/choices/${choiceIndex}`);
        }
        if (STRAWMAN_DISTRACTOR_ABSOLUTE_RE.test(choiceText)) {
          push("SEC52.quiz_strawman_distractor", "blocker", `q${i + 1} distractor ${choiceIndex} uses an absolute trigger; wrong choices must stay plausible`, `/quiz/questions/${i}/choices/${choiceIndex}`);
        }
        distractorLengths.push(wordCount(choiceText));
      }
      const avgDistractorWords = distractorLengths.reduce((sum, n) => sum + n, 0) / Math.max(1, distractorLengths.length);
      const correctWords = wordCount(q.choices[q.correctIndex]);
      if (avgDistractorWords > 0 && correctWords >= avgDistractorWords * 1.4) {
        push("SEC53.quiz_answer_length_balance", "blocker", `q${i + 1} correct answer has ${correctWords} words vs ${avgDistractorWords.toFixed(1)} average distractor words; keep it below 1.4x`, `/quiz/questions/${i}/choices/${q.correctIndex}`);
      }
      const correctChars = text(q.choices[q.correctIndex]).length;
      const distractorChars = q.choices
        .filter((_, choiceIndex) => choiceIndex !== q.correctIndex)
        .map((choice) => text(choice).length);
      const avgDistractorChars = distractorChars.reduce((sum, n) => sum + n, 0) / Math.max(1, distractorChars.length);
      if (avgDistractorChars > 0 && correctChars > avgDistractorChars * 1.5) {
        push("SEC53.quiz_answer_length_balance", "blocker", `q${i + 1} correct answer has ${correctChars} chars vs ${avgDistractorChars.toFixed(1)} average distractor chars; keep it at or below 1.5x`, `/quiz/questions/${i}/choices/${q.correctIndex}`);
      }
    }
  }
  const cards = pack.cards?.cards ?? [];
  if (cards.length !== bp.sections.cards.length) push("SEC48.card_count", "blocker", `card count ${cards.length} != blueprint ${bp.sections.cards.length}`, "/cards/cards");
  for (const [i, card] of cards.entries()) {
    if (!/\?\s*$/.test(text(card.front))) push("SEC49.card_front_question", "blocker", `card ${i + 1} front must be a retrieval question`, `/cards/cards/${i}/front`);
    if (text(card.back).length < 50) push("SEC50.card_back", "blocker", `card ${i + 1} back too short`, `/cards/cards/${i}/back`);
    const cardIds = card.sourceAnchorIds ?? (card.sourceAnchorId ? [card.sourceAnchorId] : []);
    for (const p of validateAnchorIds(cardIds, allowed, `cards[${i}].sourceAnchorIds`)) push("SEC51.card_anchor", "blocker", p, `/cards/cards/${i}/sourceAnchorIds`);
    for (const p of validateAnchorClaimType(cardIds, anchors, "review_card", `cards[${i}].sourceAnchorIds`)) push("SEC57.card_anchor_claim_type", "blocker", p, `/cards/cards/${i}/sourceAnchorIds`);
    for (const p of validateAnchorHardSpecifics(cardIds, anchors, "review_card", `${text(card.front)} ${text(card.back)}`, `cards[${i}]`)) push("SEC58.card_anchor_specifics", "blocker", p, `/cards/cards/${i}/sourceAnchorIds`);
  }
  findings.push(...repeatedQuestionNgramFindings(pack, ch));
  findings.push(...quizPromptNgramReuseFindings(pack, ch));
  return findings;
}

export function validateActionPack(pack: ActionPackV1, bp: ChapterBlueprintV1, packet: SourcePacketV1): SectionFinding[] {
  const findings: SectionFinding[] = [];
  const ch = bp.chapterNumber;
  const allowed = sourceAnchorIds(packet);
  const anchors = sourceAnchorById(packet);
  const push = (checkId: string, severity: SectionFinding["severity"], message: string, path?: string) => findings.push({ checkId, severity, chapterNumber: ch, section: "action-pack", message, path });
  if (pack.schemaVersion !== SECTION_ARTIFACT_SCHEMA_VERSION || pack.artifactType !== "action-pack") push("SEC60.action_schema", "blocker", "action-pack schema/artifactType mismatch");
  if (pack.chapterId !== bp.chapterId) push("SEC61.action_identity", "blocker", "action-pack chapterId must match blueprint", "/chapterId");
  if (text(pack.tryThisNow).length < 60) push("SEC62.try_length", "blocker", "tryThisNow too short", "/tryThisNow");
  if (/^\s*(reflect|consider|think about|say aloud|notice your)\b/i.test(text(pack.tryThisNow))) push("SEC63.try_symbolic", "blocker", "tryThisNow must be a concrete action, not reflection/symbolic theater", "/tryThisNow");
  for (const p of validateAnchorIds(pack.tryThisNowSourceAnchorIds, allowed, "tryThisNowSourceAnchorIds")) push("SEC64.try_anchor", "blocker", p, "/tryThisNowSourceAnchorIds");
  for (const p of validateAnchorClaimType(pack.tryThisNowSourceAnchorIds, anchors, "implementation_guidance", "tryThisNowSourceAnchorIds")) push("SEC73.action_anchor_claim_type", "blocker", p, "/tryThisNowSourceAnchorIds");
  for (const p of validateAnchorHardSpecifics(pack.tryThisNowSourceAnchorIds, anchors, "implementation_guidance", pack.tryThisNow, "tryThisNow")) push("SEC74.action_anchor_specifics", "blocker", p, "/tryThisNow");
  const plan = pack.implementationPlan;
  if (text(plan?.title).split(/\s+/).filter(Boolean).length < 4) push("SEC65.plan_title", "blocker", "implementation plan title too short", "/implementationPlan/title");
  if (!Array.isArray(plan?.ifThenPlans) || plan.ifThenPlans.length < 3) push("SEC66.ifthen_count", "blocker", "implementation plan needs 3+ if-then plans", "/implementationPlan/ifThenPlans");
  for (const [i, it] of (plan?.ifThenPlans ?? []).entries()) {
    if (!looksLikeActionTriggerContext(it.context)) push("SEC67.ifthen_context_trigger", "blocker", `ifThenPlans[${i}].context must be a situational trigger phrase, not a bare venue or label`, `/implementationPlan/ifThenPlans/${i}/context`);
    if (!/^\s*if\b/i.test(text(it.plan))) push("SEC67.ifthen_shape", "blocker", `ifThenPlans[${i}].plan must start with If`, `/implementationPlan/ifThenPlans/${i}/plan`);
    const ids = it.sourceAnchorIds ?? (it.sourceAnchorId ? [it.sourceAnchorId] : []);
    for (const p of validateAnchorIds(ids, allowed, `ifThenPlans[${i}].sourceAnchorIds`)) push("SEC68.ifthen_anchor", "blocker", p, `/implementationPlan/ifThenPlans/${i}/sourceAnchorIds`);
    for (const p of validateAnchorClaimType(ids, anchors, "implementation_guidance", `ifThenPlans[${i}].sourceAnchorIds`)) push("SEC73.action_anchor_claim_type", "blocker", p, `/implementationPlan/ifThenPlans/${i}/sourceAnchorIds`);
    for (const p of validateAnchorHardSpecifics(ids, anchors, "implementation_guidance", `${text(it.context)} ${text(it.plan)}`, `ifThenPlans[${i}]`)) push("SEC74.action_anchor_specifics", "blocker", p, `/implementationPlan/ifThenPlans/${i}/sourceAnchorIds`);
  }
  for (const p of validateAnchorIds(plan?.titleSourceAnchorIds, allowed, "implementationPlan.titleSourceAnchorIds")) push("SEC69.plan_anchor", "blocker", p, "/implementationPlan/titleSourceAnchorIds");
  for (const p of validateAnchorClaimType(plan?.titleSourceAnchorIds, anchors, "implementation_guidance", "implementationPlan.titleSourceAnchorIds")) push("SEC73.action_anchor_claim_type", "blocker", p, "/implementationPlan/titleSourceAnchorIds");
  for (const p of validateAnchorHardSpecifics(plan?.titleSourceAnchorIds, anchors, "implementation_guidance", plan?.title, "implementationPlan.title")) push("SEC74.action_anchor_specifics", "blocker", p, "/implementationPlan/title");
  for (const p of validateAnchorIds(plan?.coreSkillSourceAnchorIds, allowed, "implementationPlan.coreSkillSourceAnchorIds")) push("SEC70.plan_anchor", "blocker", p, "/implementationPlan/coreSkillSourceAnchorIds");
  for (const p of validateAnchorClaimType(plan?.coreSkillSourceAnchorIds, anchors, "implementation_guidance", "implementationPlan.coreSkillSourceAnchorIds")) push("SEC73.action_anchor_claim_type", "blocker", p, "/implementationPlan/coreSkillSourceAnchorIds");
  for (const p of validateAnchorHardSpecifics(plan?.coreSkillSourceAnchorIds, anchors, "implementation_guidance", plan?.coreSkill, "implementationPlan.coreSkill")) push("SEC74.action_anchor_specifics", "blocker", p, "/implementationPlan/coreSkill");
  for (const p of validateAnchorIds(plan?.twentyFourHourChallengeSourceAnchorIds, allowed, "implementationPlan.twentyFourHourChallengeSourceAnchorIds")) push("SEC71.plan_anchor", "blocker", p, "/implementationPlan/twentyFourHourChallengeSourceAnchorIds");
  for (const p of validateAnchorClaimType(plan?.twentyFourHourChallengeSourceAnchorIds, anchors, "implementation_guidance", "implementationPlan.twentyFourHourChallengeSourceAnchorIds")) push("SEC73.action_anchor_claim_type", "blocker", p, "/implementationPlan/twentyFourHourChallengeSourceAnchorIds");
  for (const p of validateAnchorHardSpecifics(plan?.twentyFourHourChallengeSourceAnchorIds, anchors, "implementation_guidance", plan?.twentyFourHourChallenge, "implementationPlan.twentyFourHourChallenge")) push("SEC74.action_anchor_specifics", "blocker", p, "/implementationPlan/twentyFourHourChallenge");
  for (const p of validateAnchorIds(plan?.weeklyPracticeSourceAnchorIds, allowed, "implementationPlan.weeklyPracticeSourceAnchorIds")) push("SEC72.plan_anchor", "blocker", p, "/implementationPlan/weeklyPracticeSourceAnchorIds");
  for (const p of validateAnchorClaimType(plan?.weeklyPracticeSourceAnchorIds, anchors, "implementation_guidance", "implementationPlan.weeklyPracticeSourceAnchorIds")) push("SEC73.action_anchor_claim_type", "blocker", p, "/implementationPlan/weeklyPracticeSourceAnchorIds");
  for (const p of validateAnchorHardSpecifics(plan?.weeklyPracticeSourceAnchorIds, anchors, "implementation_guidance", plan?.weeklyPractice, "implementationPlan.weeklyPractice")) push("SEC74.action_anchor_specifics", "blocker", p, "/implementationPlan/weeklyPractice");
  return findings;
}

export function validateSectionPack(pack: SectionPackV1, bp: ChapterBlueprintV1, packet: SourcePacketV1): SectionFinding[] {
  const findings = (() => {
    switch (pack.artifactType) {
      case "summary-pack": return validateSummaryPack(pack, bp, packet);
      case "example-pack": return validateExamplePack(pack, bp, packet);
      case "learning-pack": return validateLearningPack(pack, bp, packet);
      case "action-pack": return validateActionPack(pack, bp, packet);
      default: return [{ checkId: "SEC99.unknown", severity: "blocker" as const, chapterNumber: bp.chapterNumber, message: `unknown section artifact ${(pack as any)?.artifactType}` }];
    }
  })();
  const readerFields = collectSoftBannedTextFields(pack, bp.chapterNumber, true);
  return [
    ...findings,
    ...sourcePasteFindings(pack, bp, packet),
    ...hardBannedPhraseFindings(pack, bp),
    ...readerPunctuationFindings(readerFields),
    ...readerSentenceSeamFindings(readerFields),
    ...sourceNumberingLeakFindings(readerFields),
    ...readerJammedProperNounFindings(readerFields),
  ];
}

export type SectionGateOptions = {
  chapters?: number[];
  sections?: SectionKind[];
};

export function checkSectionGate(bookId: string, roots: CompilerStoreRoots = {}, options: SectionGateOptions = {}): SectionGateReport {
  const normalized = normSlug(bookId);
  const resolved = resolveExpectedSourceChapters(normalized, { stateRoot: roots.stateRoot });
  const expected = resolved.chapters;
  const requested = options.chapters?.length ? options.chapters : expected;
  const expectedSet = new Set(expected);
  const chapters = requested.filter((chapterNumber) => expectedSet.has(chapterNumber));
  const invalidChapters = requested.filter((chapterNumber) => !expectedSet.has(chapterNumber));
  const sections = options.sections?.length ? options.sections : [...SECTION_KINDS];
  const findings: SectionFinding[] = [...resolved.findings];
  if (!resolved.ok || resolved.chapters.length === 0) {
    findings.push({ checkId: "SEC0.no_chapters", severity: "blocker", message: `No expected source chapters found for ${normalized}.` });
  }
  const exampleShells: ExampleShellOccurrence[] = [];
  const exampleContainers: ExampleShellOccurrence[] = [];
  const exampleShortcutDefaultFrames: ExampleShellOccurrence[] = [];
  const exampleDecidesAfterFrames: ExampleShellOccurrence[] = [];
  const examplePendingUntilFrames: ExampleShellOccurrence[] = [];
  const examplePartialNextActionFrames: ExampleShellOccurrence[] = [];
  const exampleWaitingAnswerFrames: ExampleShellOccurrence[] = [];
  const exampleBroadProcessOnePointFrames: ExampleShellOccurrence[] = [];
  const examplePleasantAveragePeakEndFrames: ExampleShellOccurrence[] = [];
  const exampleVenues: ExampleShellOccurrence[] = [];
  const exampleLiteralFields: ExampleLiteralFieldOccurrence[] = [];
  const actionCoreSkillClosers: ExampleShellOccurrence[] = [];
  const actionPendingTemplateUnits: ExampleShellOccurrence[] = [];
  const actionClassifyLeverUnits: ExampleShellOccurrence[] = [];
  const actionSocialPressurePauseUnits: ExampleShellOccurrence[] = [];
  const tryThisNowOpeners: ExampleShellOccurrence[] = [];
  const actionChallengeOpeners: ExampleShellOccurrence[] = [];
  const quizChoiceTails: ExampleShellOccurrence[] = [];
  const quizLiteralFields: QuizLiteralFieldOccurrence[] = [];
  const cardFields: CrossFieldOccurrence[] = [];
  const summaryLiteralFields: SummaryLiteralFieldOccurrence[] = [];
  const summaryTierFields: CrossFieldOccurrence[] = [];
  const summaryHookFirstWords: SummaryHookFirstWordOccurrence[] = [];
  const softBannedFields: SoftBannedTextOccurrence[] = [];
  for (const chapterNumber of invalidChapters) {
    findings.push({ checkId: "SEC0.invalid_chapter", severity: "blocker", chapterNumber, message: `chapter ${chapterNumber} is not in the canonical source/index set for ${normalized}` });
  }
  for (const section of sections) {
    if (!(SECTION_KINDS as readonly string[]).includes(section)) {
      findings.push({ checkId: "SEC0.invalid_section", severity: "blocker", section, message: `unknown section ${String(section)}` });
    }
  }
  const validSections = sections.filter((section) => (SECTION_KINDS as readonly string[]).includes(section));
  for (const chapterNumber of chapters) {
    let bp: ChapterBlueprintV1;
    let packet: SourcePacketV1;
    try {
      bp = readJsonFile<ChapterBlueprintV1>(blueprintPath(normalized, chapterNumber, roots));
      packet = readJsonFile<SourcePacketV1>(sourcePacketPath(normalized, chapterNumber, roots));
    } catch (err) {
      findings.push({ checkId: "SEC0.prereq", severity: "blocker", chapterNumber, message: `missing blueprint/source packet: ${(err as Error).message}` });
      continue;
    }
    for (const kind of validSections) {
      const p = sectionPath(normalized, chapterNumber, kind, roots);
      if (!existsSync(p)) {
        findings.push({ checkId: "SEC0.missing", severity: "blocker", chapterNumber, section: kind, path: p, message: `missing ${kind} artifact` });
        continue;
      }
      try {
        const pack = readJsonFile<SectionPackV1>(p);
        findings.push(...validateSectionPack(pack, bp, packet));
        softBannedFields.push(...collectSoftBannedTextFields(pack, bp.chapterNumber, true));
        if (kind === "example-pack" && pack.artifactType === "example-pack") {
          exampleShells.push(...collectExampleShells(pack, bp));
          exampleContainers.push(...collectExampleActionContainers(pack, bp));
          exampleShortcutDefaultFrames.push(...collectExampleShortcutDefaultFrames(pack, bp));
          exampleDecidesAfterFrames.push(...collectExampleDecidesAfterFrames(pack, bp));
          examplePendingUntilFrames.push(...collectExamplePendingUntilFrames(pack, bp));
          examplePartialNextActionFrames.push(...collectExamplePartialNextActionFrames(pack, bp));
          exampleWaitingAnswerFrames.push(...collectExampleWaitingAnswerFrames(pack, bp));
          exampleBroadProcessOnePointFrames.push(...collectExampleBroadProcessOnePointFrames(pack, bp));
          examplePleasantAveragePeakEndFrames.push(...collectExamplePleasantAveragePeakEndFrames(pack, bp));
          exampleVenues.push(...collectExampleVenueHits(pack, bp));
          exampleLiteralFields.push(...collectExampleLiteralFields(pack, bp.chapterNumber, true));
        }
        if (kind === "action-pack" && pack.artifactType === "action-pack") {
          actionCoreSkillClosers.push(...collectActionCoreSkillClosers(pack, bp));
          actionPendingTemplateUnits.push(...collectActionPendingTemplateUnits(pack, bp));
          actionClassifyLeverUnits.push(...collectActionClassifyLeverPracticeUnits(pack, bp));
          actionSocialPressurePauseUnits.push(...collectActionSocialPressurePausePlans(pack, bp));
          tryThisNowOpeners.push(...collectTryThisNowOpeners(pack, bp));
          actionChallengeOpeners.push(...collectActionChallengeOpeners(pack, bp));
        }
        if (kind === "learning-pack" && pack.artifactType === "learning-pack") {
          quizChoiceTails.push(...collectQuizChoiceTails(pack, bp));
          quizLiteralFields.push(...collectQuizLiteralFields(pack, bp.chapterNumber, true));
          for (const [i, card] of (pack.cards?.cards ?? []).entries()) {
            cardFields.push({ chapterNumber, section: "learning-pack", path: `/cards/cards/${i}/front`, text: text(card.front) });
            cardFields.push({ chapterNumber, section: "learning-pack", path: `/cards/cards/${i}/back`, text: text(card.back) });
          }
        }
        if (kind === "summary-pack" && pack.artifactType === "summary-pack") {
          summaryLiteralFields.push(...collectSummaryLiteralFields(pack, bp.chapterNumber, true));
          summaryTierFields.push({ chapterNumber, section: "summary-pack", path: "/breakdown/fastRead", text: text(pack.breakdown?.fastRead) });
          summaryTierFields.push({ chapterNumber, section: "summary-pack", path: "/breakdown/deepRead", text: text(pack.breakdown?.deepRead) });
          summaryTierFields.push({ chapterNumber, section: "summary-pack", path: "/breakdown/fullRead", text: text(pack.breakdown?.fullRead) });
          summaryHookFirstWords.push(...collectSummaryHookFirstWords(pack, bp, true));
        }
      } catch (err) {
        findings.push({ checkId: "SEC0.malformed", severity: "blocker", chapterNumber, section: kind, path: p, message: `unreadable ${kind}: ${(err as Error).message}` });
      }
    }
  }
  if (validSections.includes("example-pack")) {
    const requestedSet = new Set(chapters);
    for (const chapterNumber of expected) {
      if (requestedSet.has(chapterNumber)) continue;
      const p = sectionPath(normalized, chapterNumber, "example-pack", roots);
      if (!existsSync(p)) continue;
      try {
        const pack = readJsonFile<SectionPackV1>(p);
        if (pack.artifactType === "example-pack") {
          const bp = readJsonFile<ChapterBlueprintV1>(blueprintPath(normalized, chapterNumber, roots));
          exampleShells.push(...collectExampleShells(pack, bp, false));
          exampleContainers.push(...collectExampleActionContainers(pack, bp, false));
          exampleShortcutDefaultFrames.push(...collectExampleShortcutDefaultFrames(pack, bp, false));
          exampleDecidesAfterFrames.push(...collectExampleDecidesAfterFrames(pack, bp, false));
          examplePendingUntilFrames.push(...collectExamplePendingUntilFrames(pack, bp, false));
            examplePartialNextActionFrames.push(...collectExamplePartialNextActionFrames(pack, bp, false));
            exampleWaitingAnswerFrames.push(...collectExampleWaitingAnswerFrames(pack, bp, false));
            exampleBroadProcessOnePointFrames.push(...collectExampleBroadProcessOnePointFrames(pack, bp, false));
            examplePleasantAveragePeakEndFrames.push(...collectExamplePleasantAveragePeakEndFrames(pack, bp, false));
            exampleVenues.push(...collectExampleVenueHits(pack, bp, false));
            exampleLiteralFields.push(...collectExampleLiteralFields(pack, chapterNumber, false));
          }
      } catch {
        // Context packs only shift cross-chapter phrase checks left. Their own
        // validation findings belong to the chapter's dedicated gate run.
      }
    }
  }
  {
    const requestedSet = new Set(chapters);
    for (const chapterNumber of expected) {
      if (requestedSet.has(chapterNumber)) continue;
      for (const kind of validSections) {
        const p = sectionPath(normalized, chapterNumber, kind, roots);
        if (!existsSync(p)) continue;
        try {
          const pack = readJsonFile<SectionPackV1>(p);
          softBannedFields.push(...collectSoftBannedTextFields(pack, chapterNumber, false));
          if (kind === "action-pack" && pack.artifactType === "action-pack") {
            const bp = readJsonFile<ChapterBlueprintV1>(blueprintPath(normalized, chapterNumber, roots));
            actionPendingTemplateUnits.push(...collectActionPendingTemplateUnits(pack, bp, false));
            actionClassifyLeverUnits.push(...collectActionClassifyLeverPracticeUnits(pack, bp, false));
            actionSocialPressurePauseUnits.push(...collectActionSocialPressurePausePlans(pack, bp, false));
            tryThisNowOpeners.push(...collectTryThisNowOpeners(pack, bp, false));
            actionChallengeOpeners.push(...collectActionChallengeOpeners(pack, bp, false));
          }
          if (kind === "summary-pack" && pack.artifactType === "summary-pack") {
            summaryLiteralFields.push(...collectSummaryLiteralFields(pack, chapterNumber, false));
          }
        } catch {
          // Soft-ban context is advisory input for requested artifacts. Ignore
          // malformed context here; the chapter's own section run reports it.
        }
      }
    }
  }
  if (validSections.includes("example-pack")) findings.push(...crossChapterShellFindings(exampleShells));
  if (validSections.includes("example-pack")) findings.push(...crossChapterGenericContainerFindings(exampleContainers));
  if (validSections.includes("example-pack")) findings.push(...crossChapterShortcutDefaultFrameFindings(exampleShortcutDefaultFrames));
  if (validSections.includes("example-pack")) findings.push(...crossChapterDecidesAfterFrameFindings(exampleDecidesAfterFrames));
  if (validSections.includes("example-pack")) findings.push(...crossChapterPendingUntilFrameFindings(examplePendingUntilFrames));
  if (validSections.includes("example-pack")) findings.push(...crossChapterPartialNextActionFrameFindings(examplePartialNextActionFrames));
  if (validSections.includes("example-pack")) findings.push(...crossChapterWaitingAnswerFrameFindings(exampleWaitingAnswerFrames));
  if (validSections.includes("example-pack")) findings.push(...crossChapterBroadProcessOnePointFindings(exampleBroadProcessOnePointFrames));
  if (validSections.includes("example-pack")) findings.push(...crossChapterPleasantAveragePeakEndFindings(examplePleasantAveragePeakEndFrames));
  if (validSections.includes("example-pack")) findings.push(...crossChapterVenueStampingFindings(exampleVenues));
  if (validSections.includes("example-pack")) findings.push(...crossChapterExampleLiteralNgramFindings(exampleLiteralFields));
  if (validSections.includes("action-pack")) findings.push(...crossChapterCoreSkillCloserFindings(actionCoreSkillClosers));
  if (validSections.includes("action-pack")) findings.push(...crossChapterActionPendingTemplateFindings(actionPendingTemplateUnits));
  if (validSections.includes("action-pack")) findings.push(...crossChapterActionClassifyLeverFindings(actionClassifyLeverUnits));
  if (validSections.includes("action-pack")) findings.push(...crossChapterActionSocialPressurePauseFindings(actionSocialPressurePauseUnits));
  if (validSections.includes("action-pack")) findings.push(...crossChapterTryThisNowOpenerFindings(tryThisNowOpeners));
  if (validSections.includes("action-pack")) findings.push(...crossChapterActionChallengeOpenerFindings(actionChallengeOpeners));
  if (validSections.includes("learning-pack")) findings.push(...crossChapterQuizChoiceTailFindings(quizChoiceTails));
  if (validSections.includes("learning-pack")) findings.push(...crossChapterQuizNgramTemplateFindings(quizLiteralFields));
  if (validSections.includes("learning-pack")) findings.push(...crossFieldSimilarityFindings(cardFields, "SEC81.card_cross_chapter_similarity", "review card field is too similar to a prior generated chapter"));
  if (validSections.includes("summary-pack")) findings.push(...crossChapterSummaryLiteralNgramFindings(summaryLiteralFields));
  if (validSections.includes("summary-pack")) findings.push(...summaryTierNgramFindings(summaryTierFields));
  if (validSections.includes("summary-pack")) findings.push(...summaryHookFirstWordCapFindings(summaryHookFirstWords));
  findings.push(...softBannedBudgetFindings(softBannedFields));
  return { bookId: normalized, passed: !findings.some((f) => f.severity === "blocker"), chaptersChecked: chapters.length, findings };
}

export function formatSectionGateReport(report: SectionGateReport): string {
  const blockers = report.findings.filter((f) => f.severity === "blocker").length;
  const advisories = report.findings.filter((f) => f.severity === "advisory").length;
  const lines = [`section-gate: ${report.passed ? "PASS" : "BLOCK"} (${report.chaptersChecked} chapter(s), ${blockers} blocker(s), ${advisories} advisory)`];
  for (const f of report.findings) {
    const sec = f.section ? `${f.section}: ` : "";
    lines.push(`  [${f.severity.toUpperCase()} ${f.checkId}] ${f.chapterNumber ? `ch${String(f.chapterNumber).padStart(2, "0")}: ` : ""}${sec}${f.message}${f.path ? ` (${f.path})` : ""}`);
  }
  return lines.join("\n");
}
