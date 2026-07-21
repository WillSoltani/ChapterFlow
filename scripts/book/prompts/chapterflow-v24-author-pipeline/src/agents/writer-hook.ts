import type { BookBrief, ChapterDesignDoc, PriorChapterShapes, SourceAnchorForPrompt } from "../types.js";
import { legacyRouteDisabled } from "../runtime/legacyRouteInventory.js";

export type HookOutput = {
  hook: string;
  counterintuition?: string;
  sourceAnchorIds?: string[];
  counterintuitionSourceAnchorIds?: string[];
};

export type HookInput = {
  brief: BookBrief;
  plan: ChapterDesignDoc;
  priorChapterShapes?: PriorChapterShapes;
  sourceAnchors?: SourceAnchorForPrompt[];
};

/** Legacy direct writer. Compiler application port owns authoring. */
export async function runWriterHook(_input: HookInput): Promise<HookOutput> {
  throw legacyRouteDisabled("writer.runWriterHook");
}
