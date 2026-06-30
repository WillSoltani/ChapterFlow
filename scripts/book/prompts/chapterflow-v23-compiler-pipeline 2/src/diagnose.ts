/**
 * `diagnose <book>` view model — one triage entry point for "why didn't this book pass?".
 * It COMPOSES the existing book-level diagnostics in a fixed order (book-status → major-status
 * → source-verify-check → qc-diagnose on the latest round); it re-implements none of them — the
 * standalone renderers stay the single source of truth (no second copy to drift). The only new
 * logic is the ordering + which sections apply, and it lives here, pure + tested. The CLI runs
 * each step's real command and resolves the latest round.
 */

export type DiagnoseKind = "book-status" | "major-status" | "source-verify-check" | "qc-diagnose";

export interface DiagnoseStep {
  kind: DiagnoseKind;
  title: string;
  /** The standalone equivalent (shown as the section header), sans the `npx tsx src/cli.ts` prefix. */
  command: string;
}

/** Pure: the ordered diagnostic plan. qc-diagnose is included only when a round exists on disk
 *  (it requires a `--round`); otherwise its absence is surfaced as a note, not a crash. */
export function diagnosePlan(
  bookId: string,
  latestRoundId: string | null,
): { steps: DiagnoseStep[]; notes: string[] } {
  const steps: DiagnoseStep[] = [
    { kind: "book-status", title: "Phase & gate status", command: `book-status "${bookId}"` },
    { kind: "major-status", title: "Outstanding majors", command: `major-status ${bookId}` },
    {
      kind: "source-verify-check",
      title: "Source reality (sidecar vs real sources)",
      command: `source-verify-check ${bookId}`,
    },
  ];
  const notes: string[] = [];
  if (latestRoundId) {
    steps.push({
      kind: "qc-diagnose",
      title: "QC evidence matrix",
      command: `qc-diagnose ${bookId} --round ${latestRoundId}`,
    });
  } else {
    notes.push(
      `No QC round on disk yet — once \`qc-auto\` has opened one, this also runs: qc-diagnose ${bookId} --round <roundId>`,
    );
  }
  return { steps, notes };
}

export function formatDiagnoseHeader(bookId: string, latestRoundId: string | null): string {
  return [
    `ChapterFlow Diagnose — ${bookId}`,
    latestRoundId ? `latest QC round: ${latestRoundId}` : "latest QC round: (none on disk)",
    "Runs the book-level diagnostics in order; each section below is the standalone command's own output.",
  ].join("\n");
}

export function formatDiagnoseStep(step: DiagnoseStep): string {
  const bar = "─".repeat(64);
  return `\n${bar}\n▸ ${step.title}   ($ npx tsx src/cli.ts ${step.command})\n${bar}`;
}

export function formatDiagnoseNotes(notes: string[]): string {
  return ["notes:", ...notes.map((n) => `  ${n}`)].join("\n");
}
