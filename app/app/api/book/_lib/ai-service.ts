import "server-only";

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

export type ScenarioValidationResult = {
  decision: "auto_approve" | "auto_reject" | "queue_for_review";
  reason: string;
};

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
  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: params.apiKey });

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      system: VALIDATION_PROMPT,
      messages: [
        {
          role: "user",
          content: `Book: ${params.bookTitle}\nChapter: ${params.chapterTitle}\nScope: ${params.scope}\n\nTitle: ${params.title}\nScenario: ${params.scenario}\nWhat to do: ${params.whatToDo}\nWhy it matters: ${params.whyItMatters}`,
        },
      ],
    });

    const text =
      response.content[0]?.type === "text" ? response.content[0].text : "";
    const parsed = JSON.parse(text) as { decision?: string; reason?: string };

    if (
      parsed.decision === "auto_approve" ||
      parsed.decision === "auto_reject" ||
      parsed.decision === "queue_for_review"
    ) {
      return {
        decision: parsed.decision,
        reason: typeof parsed.reason === "string" ? parsed.reason : "No reason provided",
      };
    }

    return { decision: "queue_for_review", reason: "Unexpected AI response format" };
  } catch {
    return { decision: "queue_for_review", reason: "Validation unavailable" };
  }
}

// ── Reflection Feedback ─────────────────────────────────────────────────────

export async function* streamReflectionFeedback(params: {
  reflectionText: string;
  scenario: string;
  whatToDo: string;
  whyItMatters: string;
  chapterTitle: string;
  apiKey: string;
}): AsyncGenerator<string> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: params.apiKey });

  const stream = client.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 300,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Chapter: ${params.chapterTitle}\n\nExample scenario: ${params.scenario}\nRecommended approach: ${params.whatToDo}\nWhy it matters: ${params.whyItMatters}\n\nUser's reflection:\n${params.reflectionText}`,
      },
    ],
  });

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      yield event.delta.text;
    }
  }
}
