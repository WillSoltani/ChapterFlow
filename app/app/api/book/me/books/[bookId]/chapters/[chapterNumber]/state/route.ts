import "server-only";

import { requireActiveBookUser } from "@/app/app/api/book/_lib/account-guard";
import {
  bookOk,
  requireBodyObject,
  withBookApiErrors,
  CHAPTER_NOTES_MAX_CHARS,
} from "@/app/app/api/book/_lib/http";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import {
  getUserChapterState,
  putUserChapterState,
} from "@/app/app/api/book/_lib/repo";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import { nowIso } from "@/app/app/api/book/_lib/keys";

export const runtime = "nodejs";

// Allowlist of known chapter-state fields (mirrors PersistedChapterState in
// useChapterState.ts). The PATCH handler used to persist the entire request
// body verbatim, letting a caller store arbitrarily large/deeply-nested objects
// and inject arbitrary keys into downstream features (notebook feed, export).
// Validate against this allowlist with per-field type/size caps before storing.
// The notes cap is the shared CHAPTER_NOTES_MAX_CHARS (http-guards-core) so the
// exported constant is the single source of truth, not a divergent local literal.
const MAX_QUIZ_ANSWERS = 200;
const MAX_EXPLANATION_ENTRIES = 200;
const MAX_BOOKMARKED_TAKEAWAYS = 200;
const MAX_KEY_LENGTH = 200;
// A single takeaway is a sentence or two; cap generously but bounded so the
// bookmark text map can't be used to store an unbounded blob per chapter.
const MAX_BOOKMARK_TEXT_LENGTH = 2_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function invalidState(message: string): never {
  throw new BookApiError(400, "invalid_state", message);
}

/**
 * Validate the incoming chapter-state object against the known-field allowlist,
 * dropping/rejecting unexpected shapes and capping per-field size so a caller
 * cannot store an unbounded or arbitrarily-keyed object under their partition.
 */
function sanitizeChapterState(input: unknown): Record<string, unknown> {
  if (!isRecord(input)) {
    invalidState("state must be a JSON object.");
  }

  const next: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    switch (key) {
      case "activeTab":
      case "readingDepth":
      case "exampleFilter":
      case "fontScale": {
        if (typeof value !== "string" || value.length > MAX_KEY_LENGTH) {
          invalidState(`state.${key} must be a short string.`);
        }
        next[key] = value;
        break;
      }
      case "focusMode":
      case "showRecap": {
        if (typeof value !== "boolean") {
          invalidState(`state.${key} must be a boolean.`);
        }
        next[key] = value;
        break;
      }
      case "quizRetakeCount":
      case "quizFailureStreak": {
        if (typeof value !== "number" || !Number.isFinite(value)) {
          invalidState(`state.${key} must be a number.`);
        }
        next[key] = value;
        break;
      }
      case "notesUpdatedAt":
      case "quizCooldownUntil": {
        if (value !== null && typeof value !== "string") {
          invalidState(`state.${key} must be a string or null.`);
        }
        if (typeof value === "string" && value.length > MAX_KEY_LENGTH) {
          invalidState(`state.${key} is too long.`);
        }
        next[key] = value;
        break;
      }
      case "notes": {
        if (typeof value !== "string") {
          invalidState("state.notes must be a string.");
        }
        if (value.length > CHAPTER_NOTES_MAX_CHARS) {
          invalidState("state.notes is too long.");
        }
        next[key] = value;
        break;
      }
      case "quizResult": {
        if (value !== null && !isRecord(value)) {
          invalidState("state.quizResult must be an object or null.");
        }
        next[key] = value;
        break;
      }
      case "quizAnswers": {
        if (!isRecord(value)) {
          invalidState("state.quizAnswers must be an object.");
        }
        if (Object.keys(value).length > MAX_QUIZ_ANSWERS) {
          invalidState("state.quizAnswers has too many entries.");
        }
        next[key] = value;
        break;
      }
      case "explanationOpen": {
        if (!isRecord(value)) {
          invalidState("state.explanationOpen must be an object.");
        }
        if (Object.keys(value).length > MAX_EXPLANATION_ENTRIES) {
          invalidState("state.explanationOpen has too many entries.");
        }
        next[key] = value;
        break;
      }
      case "bookmarkedTakeaways": {
        if (!Array.isArray(value)) {
          invalidState("state.bookmarkedTakeaways must be an array.");
        }
        if (value.length > MAX_BOOKMARKED_TAKEAWAYS) {
          invalidState("state.bookmarkedTakeaways has too many entries.");
        }
        next[key] = value;
        break;
      }
      case "bookmarkedTakeawayTexts": {
        // index (string) -> takeaway text. Sanitize to a plain record of
        // bounded strings so the notebook/export readers get clean data and a
        // caller cannot store an unbounded or arbitrarily-nested object.
        if (!isRecord(value)) {
          invalidState("state.bookmarkedTakeawayTexts must be an object.");
        }
        const sanitizedTexts: Record<string, string> = {};
        for (const [textKey, textValue] of Object.entries(value)) {
          if (textKey.length > MAX_KEY_LENGTH) {
            invalidState("state.bookmarkedTakeawayTexts has an oversized key.");
          }
          if (typeof textValue !== "string") {
            invalidState("state.bookmarkedTakeawayTexts values must be strings.");
          }
          if (textValue.length > MAX_BOOKMARK_TEXT_LENGTH) {
            invalidState("state.bookmarkedTakeawayTexts has an oversized value.");
          }
          sanitizedTexts[textKey] = textValue;
        }
        if (Object.keys(sanitizedTexts).length > MAX_BOOKMARKED_TAKEAWAYS) {
          invalidState("state.bookmarkedTakeawayTexts has too many entries.");
        }
        next[key] = sanitizedTexts;
        break;
      }
      default:
        invalidState(`Unknown state key: ${key}`);
    }
  }

  return next;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ bookId: string; chapterNumber: string }> }
) {
  return withBookApiErrors(req, async () => {
    const user = await requireActiveBookUser();
    const { bookId, chapterNumber } = await params;
    const parsedChapterNumber = Number(chapterNumber);
    if (!bookId || !Number.isFinite(parsedChapterNumber) || parsedChapterNumber < 1) {
      throw new BookApiError(400, "invalid_chapter", "Invalid chapter number.");
    }
    const tableName = await getBookTableName();
    const state = await getUserChapterState(
      tableName,
      user.sub,
      bookId,
      Math.floor(parsedChapterNumber)
    );
    return bookOk({ state: state ?? null });
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ bookId: string; chapterNumber: string }> }
) {
  return withBookApiErrors(req, async () => {
    const user = await requireActiveBookUser();
    const { bookId, chapterNumber } = await params;
    const parsedChapterNumber = Number(chapterNumber);
    if (!bookId || !Number.isFinite(parsedChapterNumber) || parsedChapterNumber < 1) {
      throw new BookApiError(400, "invalid_chapter", "Invalid chapter number.");
    }

    let bodyRaw: unknown;
    try {
      bodyRaw = await req.json();
    } catch {
      bodyRaw = {};
    }
    const body = requireBodyObject(bodyRaw);
    // The client sends { chapterId, state }; tolerate a legacy body-as-state
    // shape but never let the separately-handled chapterId bleed into state.
    const rawStateInput =
      body.state && typeof body.state === "object" && !Array.isArray(body.state)
        ? (body.state as Record<string, unknown>)
        : Object.fromEntries(
            Object.entries(body).filter(([key]) => key !== "chapterId")
          );
    const rawState = sanitizeChapterState(rawStateInput);

    const tableName = await getBookTableName();
    const existing = await getUserChapterState(
      tableName,
      user.sub,
      bookId,
      Math.floor(parsedChapterNumber)
    );
    const now = nowIso();
    const state = {
      userId: user.sub,
      bookId,
      chapterNumber: Math.floor(parsedChapterNumber),
      chapterId:
        typeof body.chapterId === "string"
          ? body.chapterId
          : existing?.chapterId,
      state: rawState,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    await putUserChapterState(tableName, state);
    return bookOk({ state });
  });
}
