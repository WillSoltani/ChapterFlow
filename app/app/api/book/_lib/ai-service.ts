import "server-only";

const SYSTEM_PROMPT = `You are a reading coach for ChapterFlow, a guided reading app.
The user just read a real-world example from a book chapter and wrote a reflection.
Give brief, encouraging feedback (2-4 sentences) that:
1. Acknowledges what they got right or what insight they showed
2. Gently points out any aspect of the example they might have missed
3. Connects their reflection back to the chapter's core concept
Be warm but substantive. Do not repeat the scenario back to them. Do not use bullet points.`;

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
