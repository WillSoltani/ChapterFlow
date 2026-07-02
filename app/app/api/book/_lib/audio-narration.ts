import "server-only";

/**
 * Audio Narration Engine — server entry point.
 *
 * The narration planning logic is pure and dependency-free; it lives in
 * `audio-narration-core.ts` (no `server-only`) so it stays unit-testable
 * (see `audio-narration-core.test.ts` and docs/ios/AUDIO-CONTRACT.md). This
 * module re-exports it behind the `server-only` guard so server call sites keep
 * importing from "@/app/app/api/book/_lib/audio-narration" unchanged.
 */
export * from "./audio-narration-core";
