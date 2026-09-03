/**
 * Voice card — the one input the blind section writers otherwise lack: the
 * register of the book they are writing.
 *
 * The parallel section writers (summary/example/learning/action packs) each get
 * a contract + blueprint + source packet but NO voice input, so every book
 * written by the same four voiceless contracts converges on one house register.
 * That sameness is exactly what the rubric's Tone factor (register fit to THIS
 * author's voice, not one house voice) and the churn overlay penalize. This
 * compiles a compact, paste-safe register card the section task builder drops
 * into each writer prompt (same prevention pattern as the voice bible and the
 * name plan — voice is set BEFORE authoring).
 *
 * A voice card teaches HOW to sound, never WHAT to say: it carries ONLY register
 * adjectives, sentence rhythm/length, person/POV, diction do/don'ts, and warmth
 * calibration — never a sample sentence, a named case, or any phrase a writer
 * could paste. The QUALITY-BAR prose exemplar was reverted for exactly this
 * contamination (commit ed8e02c0b), so this path drops the brief's "sounds like"
 * specimen. The "never WHAT to say" half is ENFORCED, not just asserted: the
 * brief's signatureMoves flow in via formatVoiceBible, and its voice-move sanitizer
 * (sanitizeVoiceMoves, voiceBible.ts) strips content-DEVICE mandates ("opens on a
 * famous case", "turns it into a WHY/HOW/WHAT split", "returns to <named anchors>")
 * before they can reach the `do:` line — so a device mandate can never ride the card
 * into a writer prompt (Finding F-01). Voice data flows one way (config/brief ->
 * task); it never reaches a gate.
 *
 * Source order: the per-book editor-in-chief charter (via formatVoiceBible),
 * then a register template keyed off the book's author-voice profile, then the
 * research run's OWN frozen author voice (the bibliography agent's authorVoice
 * block plus the voice cues two or more chapters agree on), then null (the task
 * builder omits the card entirely rather than pasting empty scaffolding, and
 * never gives every voiceless book one identical card).
 */

import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { formatVoiceBible, sanitizeVoiceMoves, VOICE_PLAINNESS_FLOOR_LINE } from "./voiceBible.js";

const __dirname = dirname(fileURLToPath(import.meta.url)); // .../src/lib
const PROFILES_PATH = resolve(__dirname, "../../config/author-voice-profiles.json");

/** ~120-word budget: the card is a compact register cue, not an essay. */
const WORD_BUDGET = 120;

/** Mandatory final line — the contamination guard. Keep in sync with
 *  tests/voice-card.test.ts if you ever reword it. */
export const VOICE_CARD_GUARD_LINE =
  "Match how this sounds. Never quote this card, never mention the author, never import content from other books.";

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

/** A line whose words are reserved against the budget instead of competing for it.
 *  The catalog-wide plainness floor is emitted LAST by formatVoiceBible, so under
 *  the old first-overflow-wins loop it was the first thing a long charter dropped —
 *  the one line voiceBible.ts says "every fanout prompt carries". */
function isReservedLine(line: string): boolean {
  return line.trim() === VOICE_PLAINNESS_FLOOR_LINE.trim();
}

/** Assemble content lines under the word budget (reserving room for the guard line
 *  and for any reserved line), then append the guard line. Deterministic: same
 *  lines in, same card out. The first content line is always kept so a card is
 *  never guard-only. An over-budget line is SKIPPED, not treated as a truncation
 *  point, so one long charter line cannot discard every line after it. */
function withGuard(contentLines: readonly string[]): string {
  const reserved = contentLines.filter(isReservedLine);
  const optional = contentLines.filter((line) => !isReservedLine(line));
  const kept: string[] = [];
  let total = wordCount(VOICE_CARD_GUARD_LINE) + reserved.reduce((sum, line) => sum + wordCount(line), 0);
  for (const line of optional) {
    const w = wordCount(line);
    if (kept.length > 0 && total + w > WORD_BUDGET) continue;
    kept.push(line);
    total += w;
  }
  return [...kept, ...reserved, VOICE_CARD_GUARD_LINE].join("\n");
}

/** Compact register templates keyed off the author-voice profile's `register`.
 *  Style only — no content nouns, named cases, or paste-able sample sentences.
 *  Every template's first line starts with "voice:" so callers can lift a
 *  one-line register descriptor for the learning/action register note.
 *
 *  The person and cadence fields are RENDERING instructions, not descriptions of
 *  the source author. The artifact is a third-person retelling of someone else's
 *  book — SEC7.meta_reference (src/sections/sectionGate.ts) blocks "the
 *  author"/"the book"/"this chapter" in every breakdown tier — and
 *  SEC12.summary_readability checks how long the sentences run TWICE: a per-tier
 *  reading-GRADE cap (checkReadingLevel) and a blocking Flesch reading-EASE floor on
 *  the assembled breakdown (checkBreakdownReadingEase). So a template may not instruct
 *  the source author's first person, and a `voice:` line that names a lengthening
 *  cadence must pair it with a plainness qualifier in the same line instead of
 *  asking for length and stopping. tests/voice-card.test.ts pins both: the
 *  first-person ban, and the lengthening-cadence pairing (the second is what keeps
 *  this profile set's bare "longer cadence" from coming back green). */
export const REGISTER_TEMPLATES: Readonly<Record<string, readonly string[]>> = {
  "researcher-practitioner": [
    "voice: analytical, evidence-first register; second-person; medium cadence",
    "rhythm: short-to-medium sentences, one idea each; vary length so it never drones",
    "do: state a claim plainly, then ground it in a concrete case or number",
    "never: hype verbs, buzzwords, or an abstraction with nothing the reader can picture",
    "warmth: measured and respectful, lightly wry; skip cheerleading",
  ],
  "practitioner-coach": [
    "voice: warm, direct coaching register; second-person; medium cadence",
    "rhythm: brisk, mostly short sentences; an occasional pointed question",
    "do: hand the reader a move they can run today, in plain steps",
    "never: clinical distance, jargon, or motivational-poster phrasing",
    "warmth: encouraging and candid; humor stays light and human",
  ],
  "philosopher-historian": [
    "voice: reflective, literate register; third-person; unhurried cadence that still reads plainly",
    "rhythm: measured sentences that can breathe, one idea each; set a long line against a short one",
    "do: let an idea unfold, then anchor it in a concrete moment",
    "never: slang, hype, or bullet-point briskness",
    "warmth: calm, curious, humane; humor is dry and sparing",
  ],
  "social-scientist": [
    "voice: clear, curious explanatory register; third-person; medium cadence",
    "rhythm: clean declaratives; define any term of art in everyday words on first use",
    "do: report what the evidence shows, then translate it into a plain takeaway",
    "never: overclaiming, dense jargon, or dramatization",
    "warmth: neutral-friendly and precise; humor is rare and gentle",
  ],
  journalist: [
    "voice: vivid, reported register; third-person; medium cadence",
    "rhythm: varied — a short punchy line next to a longer scene sentence",
    "do: show a concrete moment, then draw the point out of it",
    "never: abstraction-first paragraphs, jargon, or editorializing",
    "warmth: engaged and observant; wit stays understated",
  ],
  // A first-person memoir RETOLD in the third person. Franklin's Autobiography is
  // the seed case: the scar file's own style note asks for varied sentence length
  // ("a run of sub-seven-word declaratives is a spice, not a default register",
  // config/book-scars/the-autobiography-of-benjamin-franklin.json) and for the
  // retelling to signal its status ("Franklin records", "as the memoir tells it")
  // rather than speak as the author.
  "plainspoken-ironist": [
    "voice: plain, concrete register with dry self-aware irony; third-person retelling; varied cadence",
    "rhythm: vary sentence length on purpose — a long, clause-linked line, then a short flat one; never a run of same-length declaratives",
    "do: name the concrete thing (the object, the sum, the errand) before naming what it proves",
    "never: grandeur, moralizing, abstraction with nothing to picture, or a modern coaching voice",
    "warmth: wry and candid about the subject's own mistakes; never sentimental, never scolding",
  ],
  memoirist: [
    "voice: intimate, reflective register; third-person but close in, the way a memoir's confidences read when retold; medium cadence",
    "rhythm: conversational sentences, the occasional fragment for effect",
    "do: stay close to what the person actually lived through, then open it toward the reader",
    "never: lecturing, jargon, or detached distance",
    "warmth: candid, warm, self-aware; humor is honest and personal",
  ],
  default: [
    "voice: clear, plainspoken register; second-person; medium cadence",
    "rhythm: short-to-medium sentences, one idea each",
    "do: make every abstract claim concrete within two sentences",
    "never: jargon, hype, or an abstraction the reader can't picture",
    "warmth: friendly and direct; say it as you would to a smart friend",
  ],
};

/** Prefer the per-book editor-in-chief charter. Drops the brief's "sounds like"
 *  specimen — a prose exemplar is a paste-able sample sentence, exactly the
 *  contamination a voice card must never carry. */
function cardFromBrief(bookId: string): string | null {
  const bible = formatVoiceBible(bookId);
  if (!bible) return null;
  // formatVoiceBible joins its lines with "\n    "; split back to individual
  // lines and drop the specimen line before assembling the card.
  const lines = bible
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("sounds like:"));
  if (lines.length === 0) return null;
  return withGuard(lines);
}

function loadProfileRegister(bookId: string): string | null {
  try {
    const raw = JSON.parse(readFileSync(PROFILES_PATH, "utf8")) as {
      profiles?: Record<string, { register?: string }>;
    };
    return raw.profiles?.[bookId]?.register ?? null;
  } catch {
    return null;
  }
}

/** Synthesize a minimal card from the book's author-voice profile register.
 *  books.json carries no genre/category field, so the per-book profile register
 *  is the only book-specific voice signal available here; a book with neither a
 *  brief nor a profile gets null rather than a shared generic card that would
 *  itself entrench a house voice. */
function cardFromProfile(bookId: string): string | null {
  const register = loadProfileRegister(bookId);
  if (!register) return null;
  const lines = REGISTER_TEMPLATES[register] ?? REGISTER_TEMPLATES.default;
  return withGuard(lines);
}

/** The research run's own record of how the book sounds. `register`,
 *  `signatureMoves` and `avoidMoves` are the bibliography agent's authorVoice block
 *  (src/agents/researcher-bibliography.ts:46-50), validated at :261-270 and frozen
 *  into toc.json + source-freeze/book-source.md by src/researcher.ts. `sharedCues`
 *  are the chapter researcher's voiceCues (researcher-chapter.ts:52) reduced to the
 *  ones the book agrees on — see sharedVoiceCues. */
export type FrozenAuthorVoice = {
  readonly register: string;
  readonly signatureMoves?: readonly string[];
  readonly avoidMoves?: readonly string[];
  readonly sharedCues?: readonly string[];
};

/** At most this many shared chapter cues ride the card's `do:` line. The book's own
 *  signatureMoves lead it; the cues are corroboration, and an unbounded list would
 *  push the book-specific `never:` line out of the word budget. */
const MAX_SHARED_CUES = 2;

/** The voice cues TWO OR MORE chapters independently reported, in first-appearance
 *  order, compared case- and whitespace-insensitively and returned in the wording
 *  they first appeared in. A cue only one chapter saw is that chapter's texture, not
 *  the book's voice, so it never reaches a book-level card (R-032: voiceCues were a
 *  retry-blocking research output that no consumer read). Pure and deterministic. */
export function sharedVoiceCues(perChapterCues: readonly (readonly string[] | undefined)[]): string[] {
  const firstWording = new Map<string, string>();
  const chapterCount = new Map<string, number>();
  for (const cues of perChapterCues) {
    const seenInThisChapter = new Set<string>();
    for (const cue of cues ?? []) {
      if (typeof cue !== "string") continue;
      const text = cue.trim();
      if (!text) continue;
      const key = text.toLowerCase().replace(/\s+/g, " ");
      if (!firstWording.has(key)) firstWording.set(key, text);
      if (seenInThisChapter.has(key)) continue;
      seenInThisChapter.add(key);
      chapterCount.set(key, (chapterCount.get(key) ?? 0) + 1);
    }
  }
  return [...firstWording.entries()]
    .filter(([key]) => (chapterCount.get(key) ?? 0) >= 2)
    .map(([, wording]) => wording);
}

/** Synthesize a card from the run's own frozen author voice. This is the LAST
 *  resort: a freshly-researched book has no editor-in-chief charter and no curated
 *  profile, and before this it fell to null even though the run had just written
 *  down how the book sounds (R-003/R-004).
 *
 *  Two rules hold here exactly as they do on the other two paths. The signature
 *  moves and shared cues go through sanitizeVoiceMoves, so a content-DEVICE mandate
 *  the bibliography agent harvested from the source ("opens with recognizable
 *  business cases") can never reach a `do:` line; `avoidMoves` are kept verbatim,
 *  which is what the sanitizer's contract requires. And the person is stated as a
 *  RENDERING instruction — the artifact is a third-person retelling of someone
 *  else's book, and SEC7.meta_reference blocks the alternative in every tier. */
function cardFromFrozenVoice(voice: FrozenAuthorVoice | null | undefined): string | null {
  const register = typeof voice?.register === "string" ? voice.register.trim() : "";
  if (!register) return null;
  const moves = sanitizeVoiceMoves([...(voice?.signatureMoves ?? [])]).kept;
  const cues = sanitizeVoiceMoves([...(voice?.sharedCues ?? [])]).kept.slice(0, MAX_SHARED_CUES);
  const avoid = (voice?.avoidMoves ?? []).map((m) => String(m).trim()).filter(Boolean);
  const lines = [`voice: ${register} register; third-person retelling; varied cadence`];
  const doMoves = [...moves, ...cues];
  if (doMoves.length > 0) lines.push(`do: ${doMoves.join("; ")}`);
  if (avoid.length > 0) lines.push(`never: ${avoid.join("; ")}`);
  // Ordered AFTER the book-specific lines on purpose: under budget pressure the
  // generic rhythm line is the one worth losing, not the book's own moves.
  lines.push("rhythm: vary sentence length on purpose — a long, clause-linked line, then a short flat one; never a run of same-length declaratives");
  lines.push(VOICE_PLAINNESS_FLOOR_LINE);
  return withGuard(lines);
}

/** The paste-safe voice card for a book, or null when no voice signal exists.
 *  `frozenVoice` is the calling run's own authorVoice record, used only when the
 *  book has neither a charter nor a curated profile. */
export function voiceCard(bookId: string, frozenVoice?: FrozenAuthorVoice | null): string | null {
  return cardFromBrief(bookId) ?? cardFromProfile(bookId) ?? cardFromFrozenVoice(frozenVoice);
}

/** The one-line register descriptor ("voice: ...") lifted from a card, for the
 *  learning/action register note. Falls back to the card's first line. */
export function voiceRegisterLine(card: string): string {
  const lines = card.split("\n").map((l) => l.trim());
  return lines.find((l) => l.startsWith("voice:")) ?? lines[0] ?? "";
}
