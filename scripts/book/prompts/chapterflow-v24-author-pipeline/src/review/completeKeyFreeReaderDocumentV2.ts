/**
 * IMP-24 complete key-free reader document.
 *
 * The legacy phase-1 renderer is a frozen compatibility surface and predates
 * several reader-facing ChapterV21 fields.  V2 review must not silently omit
 * those fields, so the envelope protocol owns this new renderer instead of
 * changing the bytes used by archived V1/V2 evidence.
 */

import type { ChapterV21 } from "../types.js";
import { sha256Hex } from "../contracts/contractUtil.js";
import { ensureTrailingNewline } from "../lib/atomicWrite.js";
import { isMachineryExampleTag } from "../lib/readerContent.js";

export const COMPLETE_KEY_FREE_READER_DOCUMENT_V2 = "complete-key-free-reader-document-v2" as const;

export type CompleteKeyFreeReaderSegmentV2 = {
  refId: string;
  text: string;
};

function pushSection(lines: string[], heading: string, body: string | undefined): void {
  if (!body || body.trim().length === 0) return;
  lines.push(`## ${heading}`, body, "");
}

/** Render every reader-visible ChapterV21 text surface while physically
 * excluding quiz keys, key explanations, authoring provenance, source ids,
 * planner-only example specs, and other hidden identities. */
export function renderCompleteKeyFreeReaderDocumentV2(chapter: ChapterV21): string {
  const lines: string[] = [
    `# ${chapter.title}`,
    `Reading time: ${chapter.readingTimeMinutes} minutes`,
    "",
  ];
  pushSection(lines, "Hook", chapter.hook);
  pushSection(lines, "Counterintuition", chapter.counterintuition);
  pushSection(lines, "Reflection before", chapter.reflectionBefore);
  pushSection(lines, "Fast read", chapter.breakdown.fastRead);
  pushSection(lines, "Deep read", chapter.breakdown.deepRead);
  pushSection(lines, "Full read", chapter.breakdown.fullRead);
  pushSection(lines, "Reflection after", chapter.reflectionAfter);
  pushSection(lines, "Key takeaway", chapter.keyTakeaway);
  pushSection(lines, "Try this now", chapter.tryThisNow);

  lines.push("## Examples");
  chapter.examples.forEach((example, index) => {
    const readerTags = (example.tags ?? []).filter((tag) => !isMachineryExampleTag(tag));
    lines.push(`### Example ${index + 1}: ${example.title}`);
    if (readerTags.length > 0) lines.push(`Tags: ${readerTags.join(", ")}`);
    lines.push(
      example.scenario,
      "",
      `What to do: ${example.whatToDo}`,
      "",
      `Why it matters: ${example.whyItMatters}`,
      "",
    );
  });

  lines.push("## Quiz", `Passing score: ${chapter.quiz.passingScorePercent}%`);
  chapter.quiz.questions.forEach((question, index) => {
    lines.push(`Q${index + 1}. ${question.prompt}`);
    question.choices.forEach((choice, choiceIndex) => {
      lines.push(`   ${"abc"[choiceIndex]}) ${choice}`);
    });
    lines.push("");
  });

  lines.push("## Review cards");
  chapter.reviewCards.forEach((card, index) => {
    const difficulty = card.difficulty ? ` (${card.difficulty})` : "";
    lines.push(
      `Card ${index + 1}${difficulty} — Front: ${card.front}`,
      `          Back: ${card.back}`,
      "",
    );
  });

  const plan = chapter.implementationPlan;
  lines.push("## Implementation plan", `Core skill: ${plan.coreSkill}`);
  plan.ifThenPlans.forEach((item, index) => {
    lines.push(`If-then ${index + 1}: [${item.context}] ${item.plan}`);
  });
  lines.push(
    `24-hour challenge: ${plan.twentyFourHourChallenge}`,
    `Weekly practice: ${plan.weeklyPractice}`,
    "",
  );

  if ((chapter.memorableLines?.length ?? 0) > 0) {
    lines.push("## Memorable lines");
    chapter.memorableLines!.forEach((line) => lines.push(`- ${line.text}`));
    lines.push("");
  }

  const experience = chapter.experiencePlan;
  if (experience?.failureRecovery) {
    const recovery = experience.failureRecovery;
    lines.push(
      "## Failure recovery",
      recovery.normalizingLine,
      `Cue: ${recovery.cueQuestion}`,
      "Options:",
      ...recovery.options.map((option) => `- ${option}`),
      `Repair: ${recovery.repairLine}`,
      "",
    );
  }
  if (experience?.transferPrompt) {
    lines.push(
      "## Transfer prompt",
      experience.transferPrompt.prompt,
      "Contexts:",
      ...experience.transferPrompt.contexts.map((context) => `- ${context}`),
      "",
    );
  }
  const readerPatterns = experience?.behaviorLoop?.readerPatterns ?? [];
  if (readerPatterns.length > 0) {
    lines.push(
      "## Reader patterns",
      ...readerPatterns.map((pattern) => `- ${pattern.label}`),
      "",
    );
  }

  return lines.join("\n").trimEnd();
}

export function completeKeyFreeReaderDocumentBytesV2(chapter: ChapterV21): string {
  return ensureTrailingNewline(renderCompleteKeyFreeReaderDocumentV2(chapter));
}

export function completeKeyFreeReaderDocumentSha256V2(chapter: ChapterV21): string {
  return sha256Hex(completeKeyFreeReaderDocumentBytesV2(chapter));
}

/** Split the exact document bytes at natural top-level section boundaries.
 * Joining the returned texts byte-for-byte always reconstructs the input. */
export function segmentCompleteKeyFreeReaderDocumentV2(document: string): CompleteKeyFreeReaderSegmentV2[] {
  if (!document.endsWith("\n")) {
    throw new Error("complete key-free reader document bytes must end with one retained newline");
  }
  const chunks = document.split(/(?=^## )/m).filter((chunk) => chunk.length > 0);
  if (chunks.length === 0 || chunks.join("") !== document) {
    throw new Error("complete key-free reader document could not be segmented losslessly");
  }
  return chunks.map((text, index) => ({
    refId: `RD-${String(index + 1).padStart(3, "0")}`,
    text,
  }));
}
