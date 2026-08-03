/**
 * WS4-009: pure fan-out core for the Notebook GET handler's three reads
 * (chapter states, commitments, highlights). No `server-only` import — the
 * three repo calls are injected as thunks so this stays testable without a
 * DynamoDB client, and the route wires the real repo fns at the call site.
 *
 * Invoking every thunk synchronously (before awaiting any of them) then
 * `Promise.all`-ing the results dispatches the three DynamoDB reads
 * concurrently instead of paying each one's full round-trip serially.
 */
export interface NotebookReads<
  TChapterStates,
  TCommitments,
  THighlights,
> {
  chapterStates: () => Promise<TChapterStates>;
  commitments: () => Promise<TCommitments>;
  highlights: () => Promise<THighlights>;
}

export interface NotebookReadResult<
  TChapterStates,
  TCommitments,
  THighlights,
> {
  chapterStates: TChapterStates;
  commitments: TCommitments;
  highlights: THighlights;
}

export async function loadNotebookReads<
  TChapterStates,
  TCommitments,
  THighlights,
>(
  reads: NotebookReads<TChapterStates, TCommitments, THighlights>,
): Promise<NotebookReadResult<TChapterStates, TCommitments, THighlights>> {
  const chapterStatesPromise = reads.chapterStates();
  const commitmentsPromise = reads.commitments();
  const highlightsPromise = reads.highlights();

  const [chapterStates, commitments, highlights] = await Promise.all([
    chapterStatesPromise,
    commitmentsPromise,
    highlightsPromise,
  ]);

  return { chapterStates, commitments, highlights };
}
