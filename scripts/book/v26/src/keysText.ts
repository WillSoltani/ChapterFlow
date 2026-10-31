/** The chapter's `keys` (the author's advice in blunt words, knowledge mode) as prompt text. Kept import-free so every module can use it. */
import type { PipelineCtx } from "./pipeline";

export function keysFor(ctx: PipelineCtx, n: number): string {
  return ctx.config.chapters?.find((c) => c.number === n)?.keys ?? "";
}

/** The KEYS block for a prompt: empty when the chapter has no keys (text mode, or not drafted yet). */
export function keysBlock(ctx: PipelineCtx, n: number): string {
  const keys = keysFor(ctx, n);
  if (!keys) return "";
  return `WHAT THE AUTHOR ADVISES IN THIS CHAPTER, in blunt plain words (the lesson may be gentler; the account of his advice may not):\n${keys}`;
}
