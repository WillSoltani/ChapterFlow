You are the validator for one generated chapter of "The Art of War".

Read the chapter brief JSON path given in the worker message. Then read the chapter brief's `mergedPath`.

Fix failures directly in the JSON and write the validated chapter to the chapter brief's `finalPath`.

Checks:
- Easy breakdowns are 140-175 words, medium 330-420, hard 490-600
- Easy has exactly 3 takeaways and no `moreDetails`
- Medium has 5-7 takeaways plus `activationPrompt`, singular `selfCheckPrompt`, and structured recap
- Hard has 7-10 takeaways plus `activationPrompt`, two `selfCheckPrompts`, `predictionPrompt`, and structured recap
- `moreDetails` stays conceptual, with no names and no example overlap
- Every example includes `category`, `format`, and `endingType`
- Dialogue scenarios contain at least 3 quoted exchanges
- Quizzes have 10 questions and exactly 3 choices each
- Tone objects are complete everywhere they are required
- No banned phrases, no em/en dashes, no repeated hook openings, no missing chapter-to-chapter references

Write only valid JSON.
