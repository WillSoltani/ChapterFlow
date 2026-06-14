import "server-only";

import { requireActiveBookUser } from "@/app/app/api/book/_lib/account-guard";
import { bookErr } from "@/app/app/api/book/_lib/http";
import { getBookTableName, getBookContentBucket } from "@/app/app/api/book/_lib/env";
import { getUserAccessibleChapter } from "@/app/app/api/book/_lib/content-service";
import { isBookApiError } from "@/app/app/api/book/_lib/errors";
import { AuthError } from "@/app/app/api/_lib/auth";
import { ddbDoc } from "@/app/app/api/_lib/aws";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { bookUserPk, reflectionFeedbackSk, feedbackLimitSk, nowIso } from "@/app/app/api/book/_lib/keys";
import { streamReflectionFeedback } from "@/app/app/api/book/_lib/ai-service";
import { getReflectionFeedbackModel } from "@/app/app/api/book/_lib/ai-config";
import { getServerEnv } from "@/app/app/api/_lib/server-env";

// Upper bound for the free-text prompt fields echoed into the Sonnet message.
// Mirrors the maxLength the scenarios route applies via requireString — keeps
// per-call input-token cost (and the prompt-injection surface) bounded.
const MAX_PROMPT_FIELD_LENGTH = 2500;

export const runtime = "nodejs";

type Params = { params: Promise<{ bookId: string; chapterNumber: string }> };

export async function POST(req: Request, ctx: Params) {
  try {
    const user = await requireActiveBookUser();
    const [tableName, contentBucket] = await Promise.all([
      getBookTableName(),
      getBookContentBucket(),
    ]);
    const { bookId, chapterNumber: chapterStr } = await ctx.params;
    const chapterNumber = Number(chapterStr);

    if (!bookId || !Number.isFinite(chapterNumber) || chapterNumber < 1) {
      return bookErr(req, 400, "invalid_params", "Invalid bookId or chapterNumber");
    }

    const body = await req.json();
    const exampleId = typeof body.exampleId === "string" ? body.exampleId.trim() : "";
    const reflectionText = typeof body.reflectionText === "string" ? body.reflectionText.trim() : "";
    const scenario = typeof body.scenario === "string" ? body.scenario : "";
    const whatToDo = typeof body.whatToDo === "string" ? body.whatToDo : "";
    const whyItMatters = typeof body.whyItMatters === "string" ? body.whyItMatters : "";
    const chapterTitle = typeof body.chapterTitle === "string" ? body.chapterTitle : "";

    if (!exampleId) {
      return bookErr(req, 400, "invalid_example_id", "exampleId is required");
    }
    if (reflectionText.length < 20) {
      return bookErr(req, 400, "short_reflection", "Reflection must be at least 20 characters");
    }
    if (reflectionText.length > 2000) {
      return bookErr(req, 400, "long_reflection", "Reflection must be under 2000 characters");
    }
    if (
      scenario.length > MAX_PROMPT_FIELD_LENGTH ||
      whatToDo.length > MAX_PROMPT_FIELD_LENGTH ||
      whyItMatters.length > MAX_PROMPT_FIELD_LENGTH ||
      chapterTitle.length > MAX_PROMPT_FIELD_LENGTH
    ) {
      return bookErr(
        req,
        400,
        "field_too_long",
        `Prompt fields must be under ${MAX_PROMPT_FIELD_LENGTH} characters`,
      );
    }

    // Source of truth for exampleId is the published chapter, never the client.
    // getUserAccessibleChapter also enforces that the chapter is started and
    // unlocked for this user. Without this, a caller could send a fresh random
    // exampleId on every request and bypass the per-example rate limit / cache
    // key below, getting unlimited Sonnet streams.
    const { chapter } = await getUserAccessibleChapter({
      tableName,
      contentBucket,
      userId: user.sub,
      bookId,
      chapterNumber,
    });
    const exampleExists = chapter.examples.some((ex) => ex.exampleId === exampleId);
    if (!exampleExists) {
      return bookErr(req, 400, "invalid_example_id", "exampleId not found in chapter");
    }

    const pk = bookUserPk(user.sub);
    const today = new Date().toISOString().slice(0, 10);

    // Rate limit check
    const limitSk = feedbackLimitSk(today, exampleId);
    const limitCheck = await ddbDoc.send(
      new GetCommand({ TableName: tableName, Key: { PK: pk, SK: limitSk } }),
    );
    if (limitCheck.Item) {
      return bookErr(req, 429, "rate_limited", "Feedback already requested for this example today");
    }

    // Check cache
    const feedbackSk = reflectionFeedbackSk(bookId, chapterNumber, exampleId);
    const cacheCheck = await ddbDoc.send(
      new GetCommand({ TableName: tableName, Key: { PK: pk, SK: feedbackSk } }),
    );
    const cachedText = (cacheCheck.Item as { feedbackText?: string })?.feedbackText;
    const cachedHash = (cacheCheck.Item as { reflectionHash?: string })?.reflectionHash;
    const currentHash = simpleHash(reflectionText);

    if (cachedText && cachedHash === currentHash) {
      return new Response(
        JSON.stringify({ feedbackText: cachedText, cached: true }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // Get API key
    const apiKey = await getServerEnv("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return bookErr(req, 503, "ai_unavailable", "AI feedback is not available");
    }
    const model = await getReflectionFeedbackModel();

    // Stream the response
    const encoder = new TextEncoder();
    let fullText = "";

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of streamReflectionFeedback({
            reflectionText,
            scenario,
            whatToDo,
            whyItMatters,
            chapterTitle,
            apiKey,
            model,
          })) {
            fullText += chunk;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "token", text: chunk })}\n\n`),
            );
          }

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "done", fullText, cached: false })}\n\n`,
            ),
          );
          controller.close();

          // Cache the result
          if (fullText.length > 50) {
            const now = nowIso();
            const ttl = Math.floor(Date.now() / 1000) + 90 * 86400;
            await ddbDoc.send(
              new PutCommand({
                TableName: tableName,
                Item: {
                  PK: pk,
                  SK: feedbackSk,
                  entity: "BOOK_USER_REFLECTION_FEEDBACK",
                  userId: user.sub,
                  bookId,
                  chapterNumber,
                  exampleId,
                  reflectionHash: currentHash,
                  feedbackText: fullText,
                  model,
                  createdAt: now,
                  updatedAt: now,
                  ttl,
                },
              }),
            );
          }

          // Write rate limit marker
          const limitTtl = Math.floor(Date.now() / 1000) + 2 * 86400;
          await ddbDoc.send(
            new PutCommand({
              TableName: tableName,
              Item: {
                PK: pk,
                SK: limitSk,
                entity: "FEEDBACK_RATE_LIMIT",
                createdAt: nowIso(),
                ttl: limitTtl,
              },
            }),
          );
        } catch (err) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "error", message: "AI feedback failed" })}\n\n`,
            ),
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return bookErr(req, 401, "unauthenticated", "Authentication is required.");
    }
    if (isBookApiError(err)) {
      return bookErr(req, err.status, err.code, err.message, err.details);
    }
    console.error("[feedback] Error:", err);
    return bookErr(req, 500, "internal_error", "An unexpected error occurred");
  }
}

function simpleHash(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
}
