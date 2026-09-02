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
 * then a register template keyed off the book's author-voice profile, then null
 * (the task builder omits the card entirely rather than pasting empty
 * scaffolding, and never gives every voiceless book one identical card).
 */

import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { formatVoiceBible } from "./voiceBible.js";

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

/** Assemble content lines under the word budget (reserving room for the guard
 *  line), then append the guard line. Deterministic: same lines in, same card
 *  out. The first content line is always kept so a card is never guard-only. */
function withGuard(contentLines: string[]): string {
  const kept: string[] = [];
  let total = wordCount(VOICE_CARD_GUARD_LINE);
  for (const line of contentLines) {
    const w = wordCount(line);
    if (kept.length > 0 && total + w > WORD_BUDGET) break;
    kept.push(line);
    total += w;
  }
  return [...kept, VOICE_CARD_GUARD_LINE].join("\n");
}

/** Compact register templates keyed off the author-voice profile's `register`.
 *  Style only — no content nouns, named cases, or paste-able sample sentences.
 *  Every template's first line starts with "voice:" so callers can lift a
 *  one-line register descriptor for the learning/action register note.
 *
 *  The person and cadence fields are RENDERING instructions, not descriptions of
 *  the source author. The artifact is a third-person retelling of someone else's
 *  book — SEC7.meta_reference (src/sections/sectionGate.ts:2253) blocks "the
 *  author"/"the book"/"this chapter" in every breakdown tier — and every tier must
 *  clear the SEC12 reading-ease floor, so a template may not ask for the source
 *  author's first person or for a cadence that cannot clear that floor
 *  (tests/voice-card.test.ts pins both). */
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

/** The paste-safe voice card for a book, or null when no voice signal exists. */
export function voiceCard(bookId: string): string | null {
  return cardFromBrief(bookId) ?? cardFromProfile(bookId);
}

/** The one-line register descriptor ("voice: ...") lifted from a card, for the
 *  learning/action register note. Falls back to the card's first line. */
export function voiceRegisterLine(card: string): string {
  const lines = card.split("\n").map((l) => l.trim());
  return lines.find((l) => l.startsWith("voice:")) ?? lines[0] ?? "";
}
