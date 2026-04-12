import "server-only";

import { requireUser } from "@/app/app/api/_lib/auth";
import { bookErr } from "@/app/app/api/book/_lib/http";
import { getBookTableName, getBookContentBucket } from "@/app/app/api/book/_lib/env";
import { getServerEnv } from "@/app/app/api/_lib/server-env";
import { ddbDoc } from "@/app/app/api/_lib/aws";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { bookUserPk, aiQuestionCountSk, buildContentPrefix, padChapterNumber } from "@/app/app/api/book/_lib/keys";
import { getUserEntitlement } from "@/app/app/api/book/_lib/repo";

export const runtime = "nodejs";

const s3 = new S3Client({});

type Params = { params: Promise<{ bookId: string }> };

export async function POST(req: Request, ctx: Params) {
  try {
    const user = await requireUser();
    const tableName = await getBookTableName();
    const bucket = await getBookContentBucket();
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

    // Load chapter summaries for context
    let bookContext = "";
    try {
      const contentPrefix = buildContentPrefix(bookId, 1);
      const manifestKey = `${contentPrefix}/manifest.json`;
      const manifestObj = await s3.send(
        new GetObjectCommand({ Bucket: bucket, Key: manifestKey }),
      );
      const manifestText = await manifestObj.Body?.transformToString("utf-8");
      const manifest = manifestText ? JSON.parse(manifestText) : null;

      const chapterCount = manifest?.chapters?.length ?? 10;
      const summaries: string[] = [];

      for (let ch = 1; ch <= Math.min(chapterCount, 20); ch++) {
        try {
          const chKey = `${contentPrefix}/chapters/${padChapterNumber(ch)}.json`;
          const chObj = await s3.send(
            new GetObjectCommand({ Bucket: bucket, Key: chKey }),
          );
          const chText = await chObj.Body?.transformToString("utf-8");
          if (!chText) continue;
          const chapter = JSON.parse(chText);
          const title = chapter.title ?? `Chapter ${ch}`;
          const variants = chapter.contentVariants ?? {};
          const firstVariant = Object.values(variants)[0] as { chapterBreakdown?: { direct?: string }; keyTakeaways?: Array<{ point?: { direct?: string } }> } | undefined;
          const breakdown = firstVariant?.chapterBreakdown?.direct ?? "";
          const takeaways = (firstVariant?.keyTakeaways ?? [])
            .map((t: { point?: { direct?: string } }) => t.point?.direct ?? "")
            .filter(Boolean)
            .join("; ");
          summaries.push(`Chapter ${ch} — ${title}: ${breakdown.slice(0, 300)}. Key takeaways: ${takeaways.slice(0, 200)}`);
        } catch {
          break;
        }
      }

      bookContext = summaries.join("\n\n");
    } catch {
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
