import "server-only";

import { requireActiveBookUser } from "@/app/app/api/book/_lib/account-guard";
import { bookErr } from "@/app/app/api/book/_lib/http";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import { ddbDoc } from "@/app/app/api/_lib/aws";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { bookUserPk, reflectionFeedbackSk, feedbackLimitSk, nowIso } from "@/app/app/api/book/_lib/keys";
import { streamReflectionFeedback } from "@/app/app/api/book/_lib/ai-service";
import { getReflectionFeedbackModel } from "@/app/app/api/book/_lib/ai-config";
import { getServerEnv } from "@/app/app/api/_lib/server-env";

export const runtime = "nodejs";

type Params = { params: Promise<{ bookId: string; chapterNumber: string }> };

export async function POST(req: Request, ctx: Params) {
  try {
    const user = await requireActiveBookUser();
    const tableName = await getBookTableName();
    const { bookId, chapterNumber: chapterStr } = await ctx.params;
    const chapterNumber = Number(chapterStr);

    if (!bookId || !Number.isFinite(chapterNumber) || chapterNumber < 1) {
      return bookErr(req, 400, "invalid_params", "Invalid bookId or chapterNumber");
    }

    const body = await req.json();
    const exampleId = typeof body.exampleId === "string" ? body.exampleId : "";
    const reflectionText = typeof body.reflectionText === "string" ? body.reflectionText.trim() : "";
    const scenario = typeof body.scenario === "string" ? body.scenario : "";
    const whatToDo = typeof body.whatToDo === "string" ? body.whatToDo : "";
    const whyItMatters = typeof body.whyItMatters === "string" ? body.whyItMatters : "";
    const chapterTitle = typeof body.chapterTitle === "string" ? body.chapterTitle : "";

    if (reflectionText.length < 20) {
      return bookErr(req, 400, "short_reflection", "Reflection must be at least 20 characters");
    }
    if (reflectionText.length > 2000) {
      return bookErr(req, 400, "long_reflection", "Reflection must be under 2000 characters");
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
