/**
 * Package 2B — the deterministic "facts preserved" guard for the editor pass.
 *
 * WHY THIS EXISTS
 * The editor is the first stage that reads a whole chapter as a chapter and
 * rewrites it (R-079). Everything else it must respect is already enforced: the
 * four section gates re-run on its output, and so do the cross-chapter assembly
 * checks. What NONE of those can see is a re-FACT — an edit that keeps every pack
 * gate-clean while moving a quiz key, dropping a date, renaming a case, or citing
 * a different anchor. The gates judge shape and craft against the blueprint and
 * the packet; they do not compare the draft with the draft it replaced.
 *
 * So this is a BEFORE/AFTER comparison, and only that. It never judges quality —
 * the gates do — and it is a pure function of two pack bundles: no clock, no
 * filesystem, no model.
 *
 * WHAT IS COMPARED
 *   EDIT.pack_shape    both bundles carry all four packs as objects with the same
 *                      schemaVersion / artifactType / chapterId.
 *   EDIT.unit_ids      the ordered ids of every addressable unit (examples, quiz
 *                      questions, review cards) and the count of the unordered ones
 *                      (ifThenPlans).
 *   EDIT.quiz_key      each question's correctIndex, bloomsLevel and depthLevel.
 *   EDIT.quiz_choice_count  each question's number of choices.
 *   EDIT.citations     every anchor / fact / case id list, per JSON path, plus the
 *                      declared `introducedEntities` and `numbersUsed` arrays.
 *   EDIT.numbers       the SET of digit-numbers across all reader-facing text.
 *   EDIT.entities      the SET of named entities across all reader-facing text.
 *
 * WHY NUMBERS ARE DIGITS ONLY
 * Number WORDS are ordinary English ("one small step", "two options", "a
 * three-line note"), and a set-equality check that folds them in would refuse a
 * rewording that happens to introduce or drop the last "three" in the chapter —
 * turning a fact guard into a no-edit rule, on a stage whose entire purpose is to
 * reword. Dates, counts and figures live in digits, which is where the released
 * book's source distortions lived too. A word-form specific is not unprotected: it
 * is a case hardSpecific, and the edited packs are re-validated through the SAME
 * SEC14 / SEC33 / SEC56 / SEC73 anchor-specifics gates that required it in the
 * first place.
 *
 * WHY AN ENTITY MUST APPEAR MID-SENTENCE
 * A capitalized token that only ever opens a sentence is a sentence opener, not a
 * name ("Open one credit account…", "Paying on time is necessary…"). Counting
 * those as entities would refuse every edit that changes a first word, which the
 * brief explicitly asks for ("sentence length varies", "no scaffold openers"). A
 * token that appears at least once mid-sentence anywhere in the chapter is treated
 * as a name everywhere it appears, so "Maya" still counts in "Maya stands at the
 * kitchen table" because the same chapter also writes "…the careful behavior Maya
 * already has".
 *
 * FAILURE DIRECTION
 * Every finding REFUSES the edit and keeps the unedited chapter. A false positive
 * therefore costs one skipped edit and nothing else; a false negative would ship a
 * changed fact. The checks are built to fail toward the first.
 */

import { SECTION_KINDS, type SectionKind } from "../artifacts/artifactTypes.js";

/** The four section packs of ONE chapter, as JSON. */
export type ChapterEditPacks = Readonly<Record<SectionKind, Record<string, unknown>>>;

export type EditGuardFinding = Readonly<{
  /** Stable machine id, rendered into the retry card and the durable provenance. */
  checkId: string;
  message: string;
}>;

/** Keys whose STRING values are identifiers, enums or citations rather than
 *  reader-facing prose. Everything not listed here is treated as prose, so a field
 *  added to a pack schema later is compared (stricter), never silently skipped. */
const NON_PROSE_KEYS: ReadonlySet<string> = new Set([
  "schemaVersion",
  "artifactType",
  "chapterId",
  "exampleId",
  "slotId",
  "cardId",
  "questionId",
  "difficulty",
  "bloomsLevel",
  "depthLevel",
  "sourceAnchorId",
  "sourceAnchorIds",
  "counterintuitionSourceAnchorIds",
  "keyTakeawaySourceAnchorIds",
  "tryThisNowSourceAnchorIds",
  "keyEvidenceAnchorIds",
  "titleSourceAnchorIds",
  "coreSkillSourceAnchorIds",
  "twentyFourHourChallengeSourceAnchorIds",
  "weeklyPracticeSourceAnchorIds",
  "sourceFactIds",
  "namedCaseIds",
  "introducedEntities",
  "numbersUsed",
]);

/** Keys carrying an id/entity LIST that must survive an edit unchanged, compared
 *  per JSON path so a citation cannot be moved between units either. */
const CITATION_KEY = /(?:AnchorId|AnchorIds|FactIds|CaseIds)$/;
const DECLARED_LIST_KEYS: ReadonlySet<string> = new Set(["introducedEntities", "numbersUsed"]);

/** A digit-number, with grouping commas allowed and an optional decimal tail. */
const DIGIT_NUMBER = /\d[\d,]*(?:\.\d+)?/g;

/** A capitalized word with a lowercase tail — the same shape critics/narrative.ts
 *  uses for a proper-noun candidate. */
const PROPER_NOUN = /\b[A-Z][a-z]{2,}\b/g;

/** An all-lowercase word, used to demote a Title Case common noun (see
 *  {@link editGuardEntities}). */
const LOWERCASE_WORD = /\b[a-z]{3,}\b/g;

function normalizeNumber(raw: string): string {
  return raw.replace(/,/g, "").replace(/\.0+$/, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** True when a key names identifiers, enums or citations rather than reader prose.
 *  The regex arm covers every `*AnchorId(s)` / `*FactIds` / `*CaseIds` field at
 *  once, so a citation field added later is non-prose by construction. */
function nonProseKey(key: string): boolean {
  return NON_PROSE_KEYS.has(key) || CITATION_KEY.test(key);
}

/**
 * Every reader-facing string in the bundle, in deterministic order.
 *
 * A non-prose KEY prunes its WHOLE subtree, not just its immediate string values.
 * `breakdown.sourceAnchorIds` is a map of tier to id list, so pruning only the
 * leaf would have let "ch01.concept.credit" through as prose under the key
 * "fastRead" — which put the anchor id's digits into the number set and its
 * fragments into the entity set.
 */
function proseStrings(packs: ChapterEditPacks): string[] {
  const out: string[] = [];
  const walk = (value: unknown): void => {
    if (typeof value === "string") {
      out.push(value);
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }
    if (!isRecord(value)) return;
    for (const key of Object.keys(value).sort()) {
      if (nonProseKey(key)) continue;
      walk(value[key]);
    }
  };
  for (const kind of SECTION_KINDS) walk(packs[kind]);
  return out;
}

/** Split a passage into sentences for the mid-sentence entity rule. Newlines end a
 *  sentence too, so a list item's first word is treated as an opener. */
function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?:;])\s+|\n+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/** The SET of digit-numbers the chapter's reader-facing text states. */
export function editGuardNumbers(packs: ChapterEditPacks): Set<string> {
  const out = new Set<string>();
  for (const text of proseStrings(packs)) {
    for (const match of text.matchAll(DIGIT_NUMBER)) out.add(normalizeNumber(match[0]));
  }
  return out;
}

/**
 * The SET of named entities the chapter's reader-facing text names.
 *
 * A capitalized token counts as a name only when BOTH hold:
 *   (a) it appears at least once away from a sentence opening somewhere in the
 *       chapter — otherwise it is a sentence opener ("Open one credit account"),
 *       and counting it would refuse every edit that changes a first word, which
 *       is exactly what the brief asks the editor to do; and
 *   (b) its lowercase form never appears as a standalone word in the chapter —
 *       otherwise it is an ordinary noun that a Title Case heading happened to
 *       capitalize ("Lower The Visible Balance" beside "the visible balance"),
 *       and counting it would refuse every retitle.
 * A real name passes both: "Gracie" is written mid-sentence and never appears as
 * "gracie".
 */
export function editGuardEntities(packs: ChapterEditPacks): Set<string> {
  const strings = proseStrings(packs);
  const midSentence = new Set<string>();
  const lowercased = new Set<string>();
  for (const text of strings) {
    for (const match of text.matchAll(LOWERCASE_WORD)) lowercased.add(match[0]);
    for (const sentence of sentences(text)) {
      let first = true;
      for (const match of sentence.matchAll(PROPER_NOUN)) {
        // `first` tracks the FIRST proper-noun match of the sentence, and it is an
        // opener only when it actually starts the sentence (index 0).
        if (!(first && match.index === 0)) midSentence.add(match[0]);
        first = false;
      }
    }
  }
  const out = new Set<string>();
  for (const token of midSentence) if (!lowercased.has(token.toLowerCase())) out.add(token);
  return out;
}

/** Every citation / declared list in the bundle, keyed by JSON path. */
function citationLists(packs: ChapterEditPacks): Map<string, string> {
  const out = new Map<string, string>();
  for (const kind of SECTION_KINDS) {
    const pack = packs[kind];
    if (!isRecord(pack)) continue;
    collectCitations(pack, kind, out);
  }
  return out;
}

function idList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item));
  if (typeof value === "string") return [value];
  return [];
}

function collectCitations(value: unknown, path: string, out: Map<string, string>): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectCitations(item, `${path}[${index}]`, out));
    return;
  }
  if (!isRecord(value)) return;
  for (const key of Object.keys(value).sort()) {
    const child = value[key];
    const childPath = `${path}.${key}`;
    if (CITATION_KEY.test(key) || DECLARED_LIST_KEYS.has(key)) {
      // `breakdown.sourceAnchorIds` is a MAP of tier to id list, not a list, so a
      // citation key whose value is a record is recorded per leaf rather than
      // collapsed to an empty entry (which would have made the three tier
      // citations invisible to this guard).
      if (isRecord(child)) {
        for (const leafKey of Object.keys(child).sort()) {
          const leaf = child[leafKey];
          out.set(`${childPath}.${leafKey}`, idList(leaf).sort().join("|"));
        }
        continue;
      }
      out.set(childPath, idList(child).sort().join("|"));
      continue;
    }
    collectCitations(child, childPath, out);
  }
}

function setDifference(left: ReadonlySet<string>, right: ReadonlySet<string>): string[] {
  return [...left].filter((item) => !right.has(item)).sort();
}

function finding(checkId: string, message: string): EditGuardFinding {
  return Object.freeze({ checkId, message });
}

function unitIds(pack: unknown, arrayKey: string, idKey: string): string[] | null {
  if (!isRecord(pack)) return null;
  const list = pack[arrayKey];
  if (!Array.isArray(list)) return null;
  return list.map((item) => (isRecord(item) && typeof item[idKey] === "string" ? (item[idKey] as string) : "<missing>"));
}

function quizQuestions(pack: unknown): Record<string, unknown>[] | null {
  if (!isRecord(pack)) return null;
  const quiz = pack.quiz;
  if (!isRecord(quiz) || !Array.isArray(quiz.questions)) return null;
  return quiz.questions.filter(isRecord);
}

function cardList(pack: unknown): Record<string, unknown>[] | null {
  if (!isRecord(pack)) return null;
  const cards = pack.cards;
  if (!isRecord(cards) || !Array.isArray(cards.cards)) return null;
  return cards.cards.filter(isRecord);
}

/**
 * Compare an edited chapter's four packs against the packs it replaced. An empty
 * array means the edit changed wording only; any finding refuses the edit.
 *
 * `after` is untrusted model output, so every read is shape-guarded and a bundle
 * this function cannot compare is REFUSED (EDIT.pack_shape) rather than passed.
 */
export function checkEditPreservesFacts(before: ChapterEditPacks, after: ChapterEditPacks): EditGuardFinding[] {
  const findings: EditGuardFinding[] = [];

  // 1. Shape and identity. Everything below reads these packs, so a bundle that
  //    fails here is refused without attempting the rest (a partial comparison
  //    would report a missing quiz as "the key moved").
  for (const kind of SECTION_KINDS) {
    const source = before[kind];
    const edited = after[kind];
    if (!isRecord(edited)) {
      findings.push(finding("EDIT.pack_shape", `${kind} is not a JSON object`));
      continue;
    }
    if (!isRecord(source)) {
      findings.push(finding("EDIT.pack_shape", `${kind} was not present before the edit`));
      continue;
    }
    for (const key of ["schemaVersion", "artifactType", "chapterId"] as const) {
      if (edited[key] !== source[key]) {
        findings.push(finding(
          "EDIT.pack_shape",
          `${kind}.${key} changed from ${JSON.stringify(source[key])} to ${JSON.stringify(edited[key])}`,
        ));
      }
    }
  }
  if (findings.length > 0) return findings;

  // 2. Addressable units keep their ids, their order and their count.
  const sourceExamples = unitIds(before["example-pack"], "examples", "exampleId");
  const editedExamples = unitIds(after["example-pack"], "examples", "exampleId");
  if (sourceExamples === null || editedExamples === null) {
    findings.push(finding("EDIT.pack_shape", "example-pack.examples is not an array"));
  } else if (sourceExamples.join("|") !== editedExamples.join("|")) {
    findings.push(finding(
      "EDIT.unit_ids",
      `examples changed from [${sourceExamples.join(", ")}] to [${editedExamples.join(", ")}]`,
    ));
  }

  const sourceQuestions = quizQuestions(before["learning-pack"]);
  const editedQuestions = quizQuestions(after["learning-pack"]);
  const sourceCards = cardList(before["learning-pack"]);
  const editedCards = cardList(after["learning-pack"]);
  if (sourceQuestions === null || editedQuestions === null || sourceCards === null || editedCards === null) {
    findings.push(finding("EDIT.pack_shape", "learning-pack must carry quiz.questions[] and cards.cards[]"));
    return findings;
  }
  const sourceQuestionIds = sourceQuestions.map((question) => String(question.questionId));
  const editedQuestionIds = editedQuestions.map((question) => String(question.questionId));
  if (sourceQuestionIds.join("|") !== editedQuestionIds.join("|")) {
    findings.push(finding(
      "EDIT.unit_ids",
      `quiz questions changed from [${sourceQuestionIds.join(", ")}] to [${editedQuestionIds.join(", ")}]`,
    ));
  }
  const sourceCardIds = sourceCards.map((card) => String(card.cardId));
  const editedCardIds = editedCards.map((card) => String(card.cardId));
  if (sourceCardIds.join("|") !== editedCardIds.join("|")) {
    findings.push(finding(
      "EDIT.unit_ids",
      `review cards changed from [${sourceCardIds.join(", ")}] to [${editedCardIds.join(", ")}]`,
    ));
  }
  const sourcePlans = isRecord(before["action-pack"]) && isRecord(before["action-pack"].implementationPlan)
    ? (before["action-pack"].implementationPlan as Record<string, unknown>).ifThenPlans
    : undefined;
  const editedPlans = isRecord(after["action-pack"]) && isRecord(after["action-pack"].implementationPlan)
    ? (after["action-pack"].implementationPlan as Record<string, unknown>).ifThenPlans
    : undefined;
  if (!Array.isArray(sourcePlans) || !Array.isArray(editedPlans)) {
    findings.push(finding("EDIT.pack_shape", "action-pack must carry implementationPlan.ifThenPlans[]"));
  } else if (sourcePlans.length !== editedPlans.length) {
    findings.push(finding(
      "EDIT.unit_ids",
      `implementationPlan.ifThenPlans changed from ${sourcePlans.length} to ${editedPlans.length} entries`,
    ));
  }

  // 3. Quiz keys and choice counts. The key is the single field a reworded quiz
  //    can silently invert, and a dropped choice changes what the key means.
  const sourcePassing = (before["learning-pack"].quiz as Record<string, unknown>).passingScorePercent;
  const editedPassing = (after["learning-pack"].quiz as Record<string, unknown>).passingScorePercent;
  if (sourcePassing !== editedPassing) {
    findings.push(finding(
      "EDIT.quiz_key",
      `quiz.passingScorePercent changed from ${JSON.stringify(sourcePassing)} to ${JSON.stringify(editedPassing)}`,
    ));
  }
  for (let index = 0; index < Math.min(sourceQuestions.length, editedQuestions.length); index += 1) {
    const source = sourceQuestions[index];
    const edited = editedQuestions[index];
    const id = String(source.questionId);
    for (const key of ["correctIndex", "bloomsLevel", "depthLevel"] as const) {
      if (source[key] !== edited[key]) {
        findings.push(finding(
          "EDIT.quiz_key",
          `${id}.${key} changed from ${JSON.stringify(source[key])} to ${JSON.stringify(edited[key])}`,
        ));
      }
    }
    const sourceChoices = Array.isArray(source.choices) ? source.choices.length : -1;
    const editedChoices = Array.isArray(edited.choices) ? edited.choices.length : -1;
    if (sourceChoices !== editedChoices) {
      findings.push(finding(
        "EDIT.quiz_choice_count",
        `${id} changed from ${sourceChoices} choices to ${editedChoices}`,
      ));
    }
  }
  for (let index = 0; index < Math.min(sourceCards.length, editedCards.length); index += 1) {
    if (sourceCards[index].difficulty !== editedCards[index].difficulty) {
      findings.push(finding(
        "EDIT.quiz_key",
        `${String(sourceCards[index].cardId)}.difficulty changed from ${JSON.stringify(sourceCards[index].difficulty)} to ${JSON.stringify(editedCards[index].difficulty)}`,
      ));
    }
  }

  // 4. Citations, per JSON path. The editor may reword the sentence a fact is
  //    taught in; it may not re-cite it, and it may not move a citation between
  //    units (which is why this compares by path rather than as one book-wide set).
  const sourceCitations = citationLists(before);
  const editedCitations = citationLists(after);
  for (const [path, value] of sourceCitations) {
    const edited = editedCitations.get(path);
    if (edited === undefined) {
      findings.push(finding("EDIT.citations", `${path} was dropped by the edit`));
    } else if (edited !== value) {
      findings.push(finding("EDIT.citations", `${path} changed from [${value}] to [${edited}]`));
    }
  }
  for (const path of editedCitations.keys()) {
    if (!sourceCitations.has(path)) findings.push(finding("EDIT.citations", `${path} was added by the edit`));
  }

  // 5. Numbers and named entities, as SETS over the whole chapter. A set (not a
  //    multiset) is what lets the editor delete a restated sentence: the fact has
  //    to leave the chapter entirely before this fires.
  const sourceNumbers = editGuardNumbers(before);
  const editedNumbers = editGuardNumbers(after);
  const droppedNumbers = setDifference(sourceNumbers, editedNumbers);
  const addedNumbers = setDifference(editedNumbers, sourceNumbers);
  if (droppedNumbers.length > 0 || addedNumbers.length > 0) {
    findings.push(finding(
      "EDIT.numbers",
      `numbers changed: dropped [${droppedNumbers.join(", ")}], added [${addedNumbers.join(", ")}]`,
    ));
  }
  const sourceEntities = editGuardEntities(before);
  const editedEntities = editGuardEntities(after);
  const droppedEntities = setDifference(sourceEntities, editedEntities);
  const addedEntities = setDifference(editedEntities, sourceEntities);
  if (droppedEntities.length > 0 || addedEntities.length > 0) {
    findings.push(finding(
      "EDIT.entities",
      `named entities changed: dropped [${droppedEntities.join(", ")}], added [${addedEntities.join(", ")}]`,
    ));
  }
  return findings;
}
