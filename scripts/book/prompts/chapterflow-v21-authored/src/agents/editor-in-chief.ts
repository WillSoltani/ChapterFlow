/**
 * Editor-in-chief agent.
 *
 * Produces a BookBrief — the 500-word editorial document every downstream
 * agent reads. Single Opus call per book.
 */

import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { callClaude } from "../claudeClient.js";
import { getAuthorVoiceProfile } from "../critics/shared.js";
import { BookBrief } from "../types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = resolve(__dirname, "../../prompts");

export type EditorInChiefInput = {
  bookId: string;
  title: string;
  author: string;
  /** Optional source text excerpt (first chapter, preface, back cover, etc.)
   *  Helps the editor anchor claims. If omitted, the editor leans on its
   *  world knowledge, which is adequate for widely-read books. */
  sourceExcerpt?: string;
  /** Optional extra editorial guidance the caller wants reflected. */
  additionalGuidance?: string;
};

export async function runEditorInChief(input: EditorInChiefInput): Promise<BookBrief> {
  const systemPrompt = readFileSync(
    resolve(PROMPTS_DIR, "editor-in-chief.system.md"),
    "utf8",
  );

  const userPrompt = buildUserPrompt(input);

  const result = await callClaude<BookBrief>({
    tier: "writer",
    system: systemPrompt,
    user: userPrompt,
    maxTokens: 4096,
    temperature: 0.6, // editorial judgment; not wildly creative
    jsonMode: true,
    timeoutMs: 240_000,
  });

  const brief = validateBrief(result.content, input);
  return applyAuthorVoiceProfile(brief, input.bookId);
}

/** Merge per-book author-voice-profile constraints into the brief. Pulls
 *  `avoidFrames` from the profile into the brief's `voiceCharter.avoidMoves`
 *  (which the brief-sanitizer later strips for the writer's input, but which
 *  the ship gate's banned-phrase critic enforces by config). This means the
 *  brief reflects book-specific known model-voice tells regardless of what
 *  the editor LLM thought to include. */
export function applyAuthorVoiceProfile(brief: BookBrief, bookId: string): BookBrief {
  const profile = getAuthorVoiceProfile(bookId);
  if (!profile) return brief;
  const avoidFrames = Array.isArray(profile.avoidFrames) ? profile.avoidFrames : [];
  if (avoidFrames.length === 0) return brief;

  const merged = { ...brief, voiceCharter: { ...brief.voiceCharter } };
  const existing = merged.voiceCharter.avoidMoves ?? [];
  const seen = new Set(existing.map((s) => s.toLowerCase()));
  const additions = avoidFrames.filter((f: string) => !seen.has(f.toLowerCase()));
  merged.voiceCharter.avoidMoves = [...existing, ...additions];
  return merged;
}

function buildUserPrompt(input: EditorInChiefInput): string {
  const parts: string[] = [];
  parts.push(`# Book`);
  parts.push(`bookId: ${input.bookId}`);
  parts.push(`title: ${input.title}`);
  parts.push(`author: ${input.author}`);
  if (input.sourceExcerpt) {
    parts.push("");
    parts.push(`# Source excerpt`);
    parts.push(input.sourceExcerpt);
  }
  if (input.additionalGuidance) {
    parts.push("");
    parts.push(`# Additional editorial guidance`);
    parts.push(input.additionalGuidance);
  }
  parts.push("");
  parts.push(`Write the BookBrief JSON now.`);
  return parts.join("\n");
}

function validateBrief(brief: BookBrief, input: EditorInChiefInput): BookBrief {
  const problems: string[] = [];
  if (!brief || typeof brief !== "object") {
    throw new Error("editor-in-chief returned non-object");
  }
  if (brief.bookId !== input.bookId) {
    // correct it rather than reject — editor sometimes slugifies differently
    brief.bookId = input.bookId;
  }
  if (!brief.title || brief.title.toLowerCase() !== input.title.toLowerCase()) {
    brief.title = input.title;
  }
  if (!brief.author) brief.author = input.author;
  if (!brief.thesisParagraph || brief.thesisParagraph.length < 50) {
    problems.push("thesisParagraph too short");
  }
  if (!Array.isArray(brief.coreIdeas) || brief.coreIdeas.length < 3) {
    problems.push("coreIdeas must contain at least 3 items");
  }
  if (!brief.voiceCharter) {
    problems.push("voiceCharter missing");
  } else {
    if (!brief.voiceCharter.signatureMoves || brief.voiceCharter.signatureMoves.length < 2) {
      problems.push("voiceCharter.signatureMoves must contain at least 2 items");
    }
    if (!brief.voiceCharter.avoidMoves || brief.voiceCharter.avoidMoves.length < 2) {
      problems.push("voiceCharter.avoidMoves must contain at least 2 items");
    }
  }
  if (!Array.isArray(brief.forbiddenMoves) || brief.forbiddenMoves.length < 3) {
    problems.push("forbiddenMoves must contain at least 3 items");
  }
  if (problems.length > 0) {
    throw new Error(`editor-in-chief brief invalid: ${problems.join("; ")}`);
  }
  return brief;
}
