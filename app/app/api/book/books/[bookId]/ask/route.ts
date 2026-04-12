import "server-only";

import { requireUser } from "@/app/app/api/_lib/auth";
import { bookErr } from "@/app/app/api/book/_lib/http";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import { getServerEnv } from "@/app/app/api/_lib/server-env";
import { ddbDoc } from "@/app/app/api/_lib/aws";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { bookUserPk, aiQuestionCountSk } from "@/app/app/api/book/_lib/keys";
import { getUserEntitlement } from "@/app/app/api/book/_lib/repo";
import { getBookPackageByIdForTone } from "@/app/book/data/bookPackages";

export const runtime = "nodejs";

type Params = { params: Promise<{ bookId: string }> };

export async function POST(req: Request, ctx: Params) {
  try {
    const user = await requireUser();
    const tableName = await getBookTableName();
    const { bookId } = await ctx.params;
    const body = await req.json();

    const question = typeof body.question === "string" ? body.question.trim() : "";
    if (!question || question.length > 500) {
      return bookErr(req, 400, "invalid_question", "Question must be 1-500 characters");
    }

    // Rate limiting
    const today = new Date().toISOString().slice(0, 10);
    const pk = bookUserPk(user.sub);
    const countSk = aiQuestionCountSk(today);

    const countResult = await ddbDoc.send(
      new GetCommand({ TableName: tableName, Key: { PK: pk, SK: countSk } }),
    );
    const currentCount = (countResult.Item as { count?: number })?.count ?? 0;

    const entitlement = await getUserEntitlement(tableName, user.sub);
    const isPro = entitlement?.plan === "PRO";
    const limit = isPro ? 20 : 5;

    if (currentCount >= limit) {
      return bookErr(req, 429, "question_limit", `Daily question limit reached (${limit}/day)`);
    }

    // Get API key
    const apiKey = await getServerEnv("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return bookErr(req, 503, "ai_unavailable", "AI features are not available");
    }

    // Load chapter content from local book package (same source as the reader)
    const pkg = getBookPackageByIdForTone(bookId, "direct");
    if (!pkg) {
      return bookErr(req, 404, "book_not_found", "Book not found");
    }

    const resolveText = (val: unknown): string => {
      if (typeof val === "string") return val;
      if (val && typeof val === "object") {
        const obj = val as Record<string, unknown>;
        if (typeof obj.direct === "string") return obj.direct as string;
        if (typeof obj.gentle === "string") return obj.gentle as string;
      }
      return "";
    };

    const summaries: string[] = [];
    for (const chapter of pkg.chapters.slice(0, 20)) {
      const title = chapter.title ?? `Chapter ${chapter.number}`;
      const variants = chapter.contentVariants ?? {};
      const v = variants.medium ?? variants.easy ?? Object.values(variants)[0];
      if (!v) continue;

      const breakdown = resolveText(v.chapterBreakdown).slice(0, 300);
      const takeawayTexts: string[] = [];
      if (v.keyTakeaways && Array.isArray(v.keyTakeaways)) {
        for (const t of v.keyTakeaways) {
          if (typeof t === "string") {
            takeawayTexts.push(t);
          } else if (t && typeof t === "object") {
            const point = resolveText((t as Record<string, unknown>).point);
            if (point) takeawayTexts.push(point);
          }
        }
      }
      const takeaways = takeawayTexts.join("; ").slice(0, 200);
      summaries.push(`Chapter ${chapter.number} — ${title}: ${breakdown}. Key takeaways: ${takeaways}`);
    }

    const bookContext = summaries.join("\n\n");
    if (!bookContext) {
      return bookErr(req, 404, "book_not_found", "Could not load book content");
    }

    // Increment question count
    const ttl = Math.floor(Date.now() / 1000) + 3 * 86400;
    await ddbDoc.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { PK: pk, SK: countSk },
        UpdateExpression: "SET #count = if_not_exists(#count, :zero) + :one, updatedAt = :now, entity = :entity, #ttl = :ttl",
        ExpressionAttributeNames: { "#count": "count", "#ttl": "ttl" },
        ExpressionAttributeValues: {
          ":zero": 0,
          ":one": 1,
          ":now": new Date().toISOString(),
          ":entity": "AI_QUESTION_COUNT",
          ":ttl": ttl,
        },
      }),
    );

    // Stream Claude response
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey });
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const messageStream = client.messages.stream({
            model: "claude-sonnet-4-20250514",
            max_tokens: 600,
            system: `You are a reading assistant for the book "${bookId}". Answer ONLY from the provided book content below. Cite chapter numbers in brackets like [Ch. 3]. If the answer is not in the content, say so honestly.\n\nBook content:\n${bookContext}`,
            messages: [{ role: "user", content: question }],
          });

          for await (const event of messageStream) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: "token", text: event.delta.text })}\n\n`),
              );
            }
          }

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
          controller.close();
        } catch {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "error", message: "AI response failed" })}\n\n`),
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
    console.error("[ask-book] Error:", err);
    return bookErr(req, 500, "internal_error", "An unexpected error occurred");
  }
}
