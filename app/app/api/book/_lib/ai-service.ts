import "server-only";

import {
  getAnthropicClient,
  getScenarioValidationModel,
  parseScenarioValidation,
  recordAiUsage,
  type ScenarioValidationResult,
} from "@/app/app/api/book/_lib/ai-config";

// Re-exported so existing importers (scenarios route) keep working unchanged.
export type { ScenarioValidationResult } from "@/app/app/api/book/_lib/ai-config";

const SYSTEM_PROMPT = `You are a reading coach for ChapterFlow, a guided reading app.
The user just read a real-world example from a book chapter and wrote a reflection.
Give brief, encouraging feedback (2-4 sentences) that:
1. Acknowledges what they got right or what insight they showed
2. Gently points out any aspect of the example they might have missed
3. Connects their reflection back to the chapter's core concept
Be warm but substantive. Do not repeat the scenario back to them. Do not use bullet points.`;

// ── Scenario Validation ─────────────────────────────────────────────────────

const VALIDATION_PROMPT = `You are a content moderator for ChapterFlow, a guided reading app.
Evaluate whether this user-submitted scenario is suitable for the community.

The scenario must be:
1. Relevant to the chapter topic (given below)
2. A realistic situation someone might actually encounter
3. Providing actionable, specific advice in the "what to do" section
4. Clearly written — not gibberish, lorem ipsum, test data, or single repeated words
5. Not offensive, hateful, sexual, or spam
6. Not a trivially obvious or generic restatement (e.g. "just do the right thing")

Respond with ONLY valid JSON (no markdown, no backticks):
{"decision": "auto_approve" | "auto_reject" | "queue_for_review", "reason": "one sentence"}

- auto_approve: clearly good quality, relevant, and helpful
- auto_reject: clearly spam, offensive, gibberish, or completely irrelevant
- queue_for_review: borderline — a human should decide`;

export async function validateScenario(params: {
  title: string;
  scenario: string;
  whatToDo: string;
  whyItMatters: string;
  scope: string;
  chapterTitle: string;
  bookTitle: string;
  apiKey: string;
}): Promise<ScenarioValidationResult> {
  const model = await getScenarioValidationModel();
  const start = Date.now();
  try {
    const client = await getAnthropicClient(params.apiKey);

    const response = await client.messages.create({
      model,
      max_tokens: 200,
      system: VALIDATION_PROMPT,
      messages: [
        {
          role: "user",
          content: `Book: ${params.bookTitle}\nChapter: ${params.chapterTitle}\nScope: ${params.scope}\n\nTitle: ${params.title}\nScenario: ${params.scenario}\nWhat to do: ${params.whatToDo}\nWhy it matters: ${params.whyItMatters}`,
        },
      ],
    });

    recordAiUsage({
      feature: "scenario_validation",
      model,
      usage: response.usage,
      latencyMs: Date.now() - start,
      outcome: "success",
    });

    const text =
      response.content[0]?.type === "text" ? response.content[0].text : "";
    return parseScenarioValidation(text, model);
  } catch (err) {
    // Request failure (network/timeout/rate-limit/4xx) — never auto-decide; queue
    // for a human and surface the failure on the cost/error dashboard. Log the real
    // cause too: this shares ANTHROPIC_API_KEY with Ask-Book, so a bad/unfunded key
    // shows up here as a silent, perpetual queue-for-review unless we record WHY.
    const status =
      err && typeof err === "object" && "status" in err
        ? (err as { status?: number }).status
        : undefined;
    console.error("[scenario-validation] Anthropic request failed:", {
      status,
      name: err instanceof Error ? err.name : typeof err,
      message: err instanceof Error ? err.message : String(err),
    });
    recordAiUsage({
      feature: "scenario_validation",
      model,
      latencyMs: Date.now() - start,
      outcome: "error",
    });
    return { decision: "queue_for_review", reason: "Validation unavailable", model };
  }
}

// ── Reflection Feedback ─────────────────────────────────────────────────────

// Hard backstop on the length of each field interpolated into the user message.
// The feedback route already rejects oversized fields (400) before calling this,
// so this never truncates legitimate traffic — it bounds input-token cost for any
// future caller that forgets to validate. Set above the route's user-facing limit.
const MAX_PROMPT_FIELD_CHARS = 4000;

function clampPromptField(value: string): string {
  return value.length > MAX_PROMPT_FIELD_CHARS
    ? value.slice(0, MAX_PROMPT_FIELD_CHARS)
    : value;
}

export async function* streamReflectionFeedback(params: {
  reflectionText: string;
  scenario: string;
  whatToDo: string;
  whyItMatters: string;
  chapterTitle: string;
  apiKey: string;
  model: string;
}): AsyncGenerator<string> {
  const { model } = params;
  const start = Date.now();
  const client = await getAnthropicClient(params.apiKey);

  const stream = client.messages.stream({
    model,
    max_tokens: 300,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Chapter: ${clampPromptField(params.chapterTitle)}\n\nExample scenario: ${clampPromptField(params.scenario)}\nRecommended approach: ${clampPromptField(params.whatToDo)}\nWhy it matters: ${clampPromptField(params.whyItMatters)}\n\nUser's reflection:\n${clampPromptField(params.reflectionText)}`,
      },
    ],
  });

  let threw = false;
  try {
    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        yield event.delta.text;
      }
    }
  } catch (err) {
    threw = true;
    // Log the real cause (shares ANTHROPIC_API_KEY with Ask-Book) and propagate the
    // status so the route can return a category-aware message instead of a dead-end.
    const status =
      err && typeof err === "object" && "status" in err
        ? (err as { status?: number }).status
        : undefined;
    console.error("[reflection-feedback] Anthropic stream failed:", {
      status,
      name: err instanceof Error ? err.name : typeof err,
      message: err instanceof Error ? err.message : String(err),
    });
    const wrapped = new Error("AI feedback failed") as Error & { status?: number };
    wrapped.status = status;
    throw wrapped;
  } finally {
    // Runs on normal completion, an upstream error, and consumer disconnect
    // (the runtime calls .return() on the suspended generator). Best-effort —
    // never let usage capture surface an error to the consumer.
    void (async () => {
      try {
        const final = await stream.finalMessage();
        recordAiUsage({
          feature: "reflection_feedback",
          model,
          usage: final.usage,
          latencyMs: Date.now() - start,
          outcome: threw ? "error" : "success",
        });
      } catch {
        recordAiUsage({
          feature: "reflection_feedback",
          model,
          latencyMs: Date.now() - start,
          outcome: threw ? "error" : "client_abort",
        });
      }
    })();
  }
}
