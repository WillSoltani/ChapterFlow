# Quiz Question Quality Rules

After generating a quiz, run the quality scorer to validate question quality.

## Scoring Dimensions

### 1. Distractor Quality (weight: 40%)

Good distractors are:
- Plausible enough that a non-reader might pick them
- Clearly wrong to someone who understood the chapter
- Not synonyms of each other
- Similar in length and structure to the correct answer

Failures:
- All distractors cluster semantically (synonyms in different clothes)
- Distractors are completely unrelated to the correct answer (too easy to guess)
- Correct answer is significantly longer/shorter than distractors (length tells)

### 2. Bloom's Level Verification (weight: 35%)

Each question declares a `bloomsLevel`. The scorer infers the actual level from the prompt's structure:
- **remember-understand**: "What is...", "Which of the following is defined as..."
- **apply-analyze**: scenario-based, "How would...", named-character situations
- **evaluate-create**: "Why does...", cross-chapter synthesis, compare/contrast

Failure: declared level does not match inferred level by more than 1 tier.

### 3. Readability (weight: 25%)

Question prompts must target grade 8–10 (Flesch-Kincaid).

- Below 6: too simple, likely under-specified
- Above 14: too complex, likely run-on or jargon-heavy

## Composite Score

`composite = 0.40 × distractor + 0.35 × blooms + 0.25 × readability`

Threshold: **0.60**

## When a Question Fails

If any question scores below 0.60:
1. Identify the weakest dimension
2. Regenerate only that question, preserving the quiz's balance of `bloomsLevel` and `correctIndex` distribution
3. Re-score the regenerated question
4. Maximum 2 regeneration attempts per question before flagging for manual review

## Running the Scorer

```bash
npx tsx scripts/book/quiz-quality-scorer.ts <quiz.json> --threshold 0.60 --output-dir reports/quiz-quality/
```

The scorer exits with code 1 if any question fails, making it suitable for pipeline gating.
