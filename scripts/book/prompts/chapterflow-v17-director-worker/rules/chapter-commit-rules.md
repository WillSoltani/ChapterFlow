# Chapter Commit Rules

A chapter may be committed only when:
- validated/chXX.chapter.json exists
- validated/chXX.review-package.json exists
- quizzes/chXX.quiz.json exists and is populated
- reports/chXX.validation.md exists
- artifact guard passes

When committing:
- compute hashes for validated artifacts
- update continuity from the validated chapter only
- append to state/pipeline-state.json
- write commits/chXX.commit.json
- mark ticket status as committed
