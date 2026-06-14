import "server-only";

import { requireActiveBookUser } from "@/app/app/api/book/_lib/account-guard";
import { bookErr } from "@/app/app/api/book/_lib/http";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import { getServerEnv } from "@/app/app/api/_lib/server-env";
import { getAskBookModel, getAnthropicClient, recordAiUsage } from "@/app/app/api/book/_lib/ai-config";
import { ddbDoc } from "@/app/app/api/_lib/aws";
import { GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { bookUserPk, aiQuestionCountSk, aiCachedAnswerPk, aiCachedAnswerSk } from "@/app/app/api/book/_lib/keys";
import { createHash } from "crypto";
import { getUserEntitlement } from "@/app/app/api/book/_lib/repo";
import { getBookPackageByIdForTone } from "@/app/book/data/bookPackages";

export const runtime = "nodejs";

type Params = { params: Promise<{ bookId: string }> };

export async function POST(req: Request, ctx: Params) {
  try {
    const user = await requireActiveBookUser();
    const tableName = await getBookTableName();
    const { bookId } = await ctx.params;
    const body = await req.json();

    const question = typeof body.question === "string" ? body.question.trim() : "";
    if (!question || question.length > 500) {
      return bookErr(req, 400, "invalid_question", "Question must be 1-500 characters");
    }

    // Accept prior conversation turns (max 20 to bound token usage)
    const rawHistory = Array.isArray(body.history) ? body.history : [];
    const history: Array<{ role: "user" | "assistant"; content: string }> = rawHistory
      .filter(
        (m: unknown): m is { role: string; content: string } =>
          !!m &&
          typeof m === "object" &&
          typeof (m as Record<string, unknown>).role === "string" &&
          typeof (m as Record<string, unknown>).content === "string" &&
          ((m as Record<string, unknown>).role === "user" || (m as Record<string, unknown>).role === "assistant"),
      )
      .slice(-20)
      .map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content.slice(0, 2000),
      }));

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

    // Accept optional chapterNumber for context weighting
    const chapterNumber = typeof body.chapterNumber === "number" ? body.chapterNumber : null;

    // Load chapter content from local book package (same source as the reader)
    const pkg = getBookPackageByIdForTone(bookId, "direct");
    if (!pkg) {
      return bookErr(req, 404, "book_not_found", "Book not found");
    }

    const bookTitle = pkg.book?.title ?? bookId;

    const resolveText = (val: unknown): string => {
      if (typeof val === "string") return val;
      if (val && typeof val === "object") {
        const obj = val as Record<string, unknown>;
        if (typeof obj.direct === "string") return obj.direct as string;
        if (typeof obj.gentle === "string") return obj.gentle as string;
      }
      return "";
    };

    const resolveTakeaways = (v: Record<string, unknown>): string[] => {
      const texts: string[] = [];
      if (v.keyTakeaways && Array.isArray(v.keyTakeaways)) {
        for (const t of v.keyTakeaways) {
          if (typeof t === "string") {
            texts.push(t);
          } else if (t && typeof t === "object") {
            const point = resolveText((t as Record<string, unknown>).point);
            if (point) texts.push(point);
          }
        }
      }
      return texts;
    };

    const summaries: string[] = [];
    for (const chapter of pkg.chapters.slice(0, 30)) {
      const title = chapter.title ?? `Chapter ${chapter.number}`;
      const variants = chapter.contentVariants ?? {};
      const v = variants.medium ?? variants.easy ?? Object.values(variants)[0];
      if (!v) continue;

      const isCurrent = chapterNumber != null && chapter.number === chapterNumber;

      if (isCurrent) {
        // Full content for the current chapter
        const breakdown = resolveText(v.chapterBreakdown);
        const takeaways = resolveTakeaways(v as unknown as Record<string, unknown>);
        const examples = (chapter.examples ?? [])
          .slice(0, 5)
          .map((ex) => `- ${resolveText(ex.scenario)}: ${resolveText(ex.whyItMatters)}`)
          .join("\n");
        let recap = resolveText(v.oneMinuteRecap);
        // Handle structured recap format: { retrieve, connect, preview }
        if (!recap && v.oneMinuteRecap && typeof v.oneMinuteRecap === "object") {
          const r = v.oneMinuteRecap as unknown as Record<string, unknown>;
          const parts = [resolveText(r.retrieve), resolveText(r.connect), resolveText(r.preview)].filter(Boolean);
          recap = parts.join(" ");
        }

        let block = `[CURRENT CHAPTER] Chapter ${chapter.number} — ${title}:\n${breakdown}`;
        if (takeaways.length) block += `\n\nKey takeaways:\n${takeaways.map((t) => `- ${t}`).join("\n")}`;
        if (recap) block += `\n\nOne-minute recap: ${recap}`;
        if (examples) block += `\n\nExamples:\n${examples}`;
        summaries.unshift(block);
      } else {
        // Lighter summary for other chapters
        const breakdown = resolveText(v.chapterBreakdown).slice(0, 400);
        const takeaways = resolveTakeaways(v as unknown as Record<string, unknown>).join("; ").slice(0, 300);
        summaries.push(`Chapter ${chapter.number} — ${title}: ${breakdown}. Key takeaways: ${takeaways}`);
      }
    }

    const bookContext = summaries.join("\n\n");
    if (!bookContext) {
      return bookErr(req, 404, "book_not_found", "Could not load book content");
    }

    // Cache lookup — only for standalone questions (no conversation history)
    const isStandalone = history.length === 0;
    const questionHash = isStandalone
      ? createHash("sha256").update(`${bookId}:${chapterNumber ?? "all"}:${question.toLowerCase()}`).digest("hex").slice(0, 32)
      : null;

    if (isStandalone && questionHash) {
      try {
        const cached = await ddbDoc.send(
          new GetCommand({
            TableName: tableName,
            Key: { PK: aiCachedAnswerPk(bookId), SK: aiCachedAnswerSk(questionHash) },
          }),
        );
        if (cached.Item && typeof cached.Item.answer === "string") {
          // Increment hit count in background
          ddbDoc.send(
            new UpdateCommand({
              TableName: tableName,
              Key: { PK: aiCachedAnswerPk(bookId), SK: aiCachedAnswerSk(questionHash) },
              UpdateExpression: "SET hitCount = if_not_exists(hitCount, :zero) + :one",
              ExpressionAttributeValues: { ":zero": 0, ":one": 1 },
            }),
          ).catch(() => {});

          // Stream cached answer in word-level chunks with delays for a typing feel
          const encoder = new TextEncoder();
          const words = (cached.Item.answer as string).split(/(\s+)/);
          const chunks: string[] = [];
          let buf = "";
          for (const w of words) {
            buf += w;
            if (buf.split(/\s+/).filter(Boolean).length >= 3 || w.includes("\n")) {
              chunks.push(buf);
              buf = "";
            }
          }
          if (buf) chunks.push(buf);

          const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
          const cachedStream = new ReadableStream({
            async start(controller) {
              for (const chunk of chunks) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ type: "token", text: chunk })}\n\n`),
                );
                await delay(30);
              }
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
              controller.close();
            },
          });

          return new Response(cachedStream, {
            status: 200,
            headers: {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              Connection: "keep-alive",
            },
          });
        }
      } catch (e) {
        console.warn("[ask-book] Cache lookup failed, proceeding without cache:", e);
      }
    }

    const client = await getAnthropicClient(apiKey);
    const model = await getAskBookModel();
    const encoder = new TextEncoder();

    const chapterHint = chapterNumber != null
      ? `\nThe reader is currently on Chapter ${chapterNumber}. Focus on this chapter's content. If they ask about other chapters, you may reference them briefly.`
      : "";

    // Stream Claude response — rate limit is incremented only after success
    let streamSuccess = false;
    let fullAnswer = "";

    const stream = new ReadableStream({
      async start(controller) {
        const aiStart = Date.now();
        let messageStream: ReturnType<typeof client.messages.stream> | null = null;
        try {
          messageStream = client.messages.stream({
            model,
            max_tokens: 400,
            system: `You are Raymond, a friendly and sharp reading assistant for the book "${bookTitle}". You help readers understand and apply what they're learning.

Rules:
- ONLY answer questions related to the book content provided below. If someone asks something unrelated to the book (e.g., jokes, personal questions, general knowledge, coding help), politely decline: "I'm here to help with the book! Try asking about the chapter."
- Be concise. 2-4 sentences max unless the question genuinely needs more. No fluff, no filler, no restating the question.
- Be friendly and direct. Talk like a smart friend who read the book, not a textbook.
- Cite chapter numbers naturally, like "In Chapter 3..." or "[Ch. 3]".
- If the answer isn't in the content, say so honestly in one sentence.
- End with a brief follow-up question or nudge to keep them thinking about the material.${chapterHint}

Book content:
${bookContext}`,
            messages: [...history, { role: "user", content: question }],
          });

          for await (const event of messageStream) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              fullAnswer += event.delta.text;
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: "token", text: event.delta.text })}\n\n`),
              );
            }
          }

          streamSuccess = true;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
          controller.close();
        } catch {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "error", message: "AI response failed" })}\n\n`),
          );
          controller.close();
        } finally {
          // Record AI usage/cost/latency best-effort (success, error, or disconnect).
          if (messageStream) {
            const captured = messageStream;
            void (async () => {
              try {
                const final = await captured.finalMessage();
                recordAiUsage({
                  feature: "ask_book",
                  model,
                  usage: final.usage,
                  latencyMs: Date.now() - aiStart,
                  outcome: streamSuccess ? "success" : "error",
                });
              } catch {
                recordAiUsage({
                  feature: "ask_book",
                  model,
                  latencyMs: Date.now() - aiStart,
                  outcome: streamSuccess ? "success" : "client_abort",
                });
              }
            })();
          }

          if (streamSuccess) {
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
            ).catch((e) => console.error("[ask-book] Failed to increment question count:", e));

            // Write to cache for standalone questions
            if (isStandalone && questionHash && fullAnswer) {
              const cacheTtl = Math.floor(Date.now() / 1000) + 30 * 86400; // 30 days
              await ddbDoc.send(
                new PutCommand({
                  TableName: tableName,
                  Item: {
                    PK: aiCachedAnswerPk(bookId),
                    SK: aiCachedAnswerSk(questionHash),
                    entity: "AI_CACHED_ANSWER",
                    bookId,
                    questionHash,
                    question,
                    answer: fullAnswer,
                    tone: "direct",
                    hitCount: 0,
                    ttl: cacheTtl,
                    createdAt: new Date().toISOString(),
                  },
                }),
              ).catch((e) => console.error("[ask-book] Failed to write cache:", e));
            }
          }
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
