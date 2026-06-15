// Pure helper (no server-only / no I/O) so it can be unit-tested.
//
// Returns true iff the submitted response questionIds answer EXACTLY the
// assigned attempt questions: same count, no duplicate response ids, and a
// perfect set match. The quiz submit route uses this to block the legacy
// index-only bypass — a count-only check could be satisfied with answers to
// non-assigned pool questions (whose correct indices are exposed to the client).
export function answersCoverAssignedQuestions(
  attemptQuestionIds: readonly string[],
  responseQuestionIds: readonly string[]
): boolean {
  if (responseQuestionIds.length !== attemptQuestionIds.length) return false;
  const attemptSet = new Set(attemptQuestionIds);
  const responseSet = new Set(responseQuestionIds);
  // A duplicate response id collapses the set below the count → reject.
  if (responseSet.size !== attemptSet.size) return false;
  for (const id of attemptSet) {
    if (!responseSet.has(id)) return false;
  }
  return true;
}
