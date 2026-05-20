#!/usr/bin/env node
const fs = require('fs');
const path = 'book-packages/the-black-swan.v21.json';
const book = JSON.parse(fs.readFileSync(path, 'utf-8'));
const ch = book.chapters[13];

// =========================================================
// FIX 1 — Repair Q1 (prompt/correct mismatch)
// =========================================================
{
  const q = ch.quiz.questions[0];
  q.prompt = "Suppose a library policy team builds a late-fee schedule from one year of delays. Most books return between zero and fourteen days late, but a few books are never returned and cost the system the full replacement price. What should the director do first?";
  q.choices = [
    "Apply one average late-fee across all overdue books since the year of data captures the typical return behavior.",
    "Separate ordinary delays from non-returns and price each domain differently, since the same calculation will not serve both.",
    "Add a small surcharge to every overdue book to cover occasional non-returns, since spreading the cost across all borrowers keeps each individual fee manageable.",
  ];
  q.correctIndex = 1;
  if (q.correctAnswerIndex !== undefined) q.correctAnswerIndex = 1;
}

// =========================================================
// FIX 2 — Repair Q8 (action vs concept mismatch)
// =========================================================
{
  const q = ch.quiz.questions[7];
  // Keep prompt as-is (already action-framed)
  q.choices = [
    "Removing the superstar from the dataset and reporting the average of the remaining creators as the typical earnings number.",
    "Reporting the average alongside a note explaining that one creator skews the figure, which gives readers context without changing the math.",
    "Using the average without separating the superstar from the long tail, since one observation has rewritten the figure.",
  ];
  q.correctIndex = 2;
  if (q.correctAnswerIndex !== undefined) q.correctAnswerIndex = 2;
}

// =========================================================
// FIX 3 — Example tag corrections
// =========================================================
ch.examples[1].tags = ["media_case", "work", "Extremistan"];
ch.examples[2].tags = ["policy_case", "policy", "Extremistan"];
ch.examples[3].tags = ["business_case", "business", "Extremistan"];
ch.examples[4].tags = ["postmortem", "planned", "Extremistan"];
ch.examples[5].tags = ["before_after", "planned", "Extremistan"];

// =========================================================
// FIX 4 — Rewrite breakdown
// Memorable lines (from Fix 7) must appear verbatim in this prose.
// =========================================================
ch.breakdown.fastRead =
"A creator partnership dashboard shows the average payout per creator went up. The number looks healthy. But one creator produced 61% of signups; the average is being moved by a single person. That is the hinge of this chapter: some fields are tame enough that the average describes most cases (height in a classroom, scores on a math test), while others let one case rewrite the whole picture (creator earnings, wealth, city size, disaster losses, book sales). Before using the average, ask whether one outcome can dominate the total. If yes, the average lies until the giant is separated from the rest.";

ch.breakdown.deepRead =
"Mediocristan is the world where adding one new observation barely moves the total. Put the tallest person in the room next to thirty adults of normal height and the average shifts by maybe an inch. Put ten thousand random adults in a stadium and add LeBron James — the average still does not budge. Height is bounded. So is shoe size, gestation time, blood pressure, the time it takes to walk a kilometer. In these domains, the mean is a fair summary, the median is close to the mean, and ordinary statistics behave.\n\n" +
"Extremistan is the world where adding one new observation can rewrite the whole picture. Wealth, sales, fame, city size, disaster losses, creator earnings — these are domains where one case can be a hundred or a thousand or a million times larger than the typical case. One giant can make the average lie. Replace the average homeowner with a billionaire and the \"average wealth\" of your sample shifts wildly. Add Tokyo to a list of cities and the average population spikes.\n\n" +
"The mistake the chapter is naming is not technical. It is carrying Mediocristan intuition into Extremistan. People know height has a limit, so when they hear \"average creator earned $4,200\" they picture a roughly normal spread around that number. But if one creator earned $8M and the rest earned $200, the average is misleading. Height is bounded. Wealth is not. The tool that works for one will mislead in the other.";

ch.breakdown.fullRead =
"The contrast Taleb draws between Mediocristan and Extremistan is not a fanciful labeling — it is a jurisdiction test for statistical intuition. The test runs on every domain the analyst encounters: heights, weights, test scores, response times, manufacturing tolerances on one side; wealth, market returns, book sales, creator earnings, city populations, disaster losses, internet traffic patterns on the other.\n\n" +
"In Mediocristan, no single observation can take command of the total. Imagine measuring the weight of every person on a flight. The heaviest passenger adds a measurable amount to the total, but cannot dominate it. The flight's average weight is a useful planning number for the airline. Now imagine measuring the net worth of every person on the same flight. If one passenger is a tech founder who just exited, the \"average net worth\" of the flight may be tens of millions of dollars, even though every other passenger is middle-class. The number is arithmetic-true and operationally false. The airline cannot use it to plan anything about typical passengers.\n\n" +
"This is why the chapter insists on classification before calculation. The team building the late-fee schedule, the partnership manager celebrating a 18% wealth jump, the city planner forecasting service demand from population averages — each is using a tool whose reliability depends on which domain they are in. The bell curve, the mean, the standard deviation, the t-test, the linear regression: all of these were designed for Mediocristan. They behave reasonably when no single case can swamp the sample. Push them into Extremistan and they produce confident numbers built from outliers that the model is not aware of.\n\n" +
"The practical move is small and consistent. Before you calculate, ask if one case can rewrite the total. If yes, separate the giant from the long tail. Report the figure for each. Use the mean only when you have already shown that no single observation can dominate it. This is not statistical sophistication — it is the equivalent of checking the units before adding numbers together. Once it becomes habit, the catastrophic averages that mislead boards, planners, and dashboards stop being plausible.";

// =========================================================
// FIX 5 — Concrete-distractor rewrites
// =========================================================
// Q2 d[2]
ch.quiz.questions[1].choices[2] =
  "Variance is higher in Extremistan, and the distinguishing feature is the spread of values rather than the dominance of a single case.";
// Q3 d[0]
ch.quiz.questions[2].choices[0] =
  "The domain decides which statistical software to use, since some tools are calibrated for bounded data and others for skewed data.";
// Q4 d[1]
ch.quiz.questions[3].choices[1] =
  "Treat the sales field as approximately normal because the long tail of unsuccessful titles balances out the bestseller's contribution.";
// Q7 d[0] and d[2]
ch.quiz.questions[6].choices[0] =
  "The planner used outdated census data, so the fix is refreshing the dataset before applying the same averaging method.";
ch.quiz.questions[6].choices[2] =
  "The planner used the arithmetic mean instead of the median, so switching to the median will resolve the issue without changing the model.";
// Q9 d[1]
ch.quiz.questions[8].choices[1] =
  "Treat event releases and long-tail titles as one category because both contribute revenue to the same monthly forecast.";

// Sanity: ensure none of those distractor indices is the correctIndex
[[1,2],[2,0],[3,1],[6,0],[6,2],[8,1]].forEach(([qi,di]) => {
  if (ch.quiz.questions[qi].correctIndex === di) {
    throw new Error(`Fix5 wrote over correct answer at Ch14 Q${qi+1} d[${di}]`);
  }
});

// =========================================================
// FIX 6 — Rewrite review cards
// =========================================================
const cards = ch.reviewCards;
cards[0].front = "In a domain where one observation can dominate the total, which summary statistic is more honest: mean or median?";
cards[0].back  = "The median, because it is not pulled by the single dominant observation. When wealth is reported as 'average member rose 18%' driven by one founder's exit, the median member's wealth may not have moved at all. The median answers the question the average is being asked to answer.";

cards[1].front = "What single number reveals whether a domain is concentrated?";
cards[1].back  = "The share of the total contributed by the top 1% (or top 10) of observations. If the top 1% of creators produce 60% of signups, or the top 10 books produce 70% of sales, the domain is concentrated and the average misleads.";

cards[2].front = "What does a bounded domain look like in practice?";
cards[2].back  = "A bounded domain has a hard upper limit no observation can exceed. Human height tops out around eight feet. A class test maxes at 100. A delivery time has a physical floor and ceiling. In these domains, you can add any new observation and the total will not shift drastically.";

cards[3].front = "What does one-case domination look like in practice?";
cards[3].back  = "One observation contributes more than the rest combined. Tokyo has a larger population than the bottom 90 cities in a regional dataset. One bestseller earns more than the next thousand titles. One disaster year produces more loss than the prior decade. When you remove that case, the picture changes entirely.";

cards[4].front = "What should you do before using the average of any dataset?";
cards[4].back  = "Ask whether removing the single largest observation would change the average by more than a few percent. If yes, the dataset is concentrated and the average is being driven by that case. Separate the giant from the long tail and report each before using either number.";

// =========================================================
// FIX 7 — Replace memorable lines
// =========================================================
ch.memorableLines[0].text = "One giant can make the average lie.";
ch.memorableLines[1].text = "Height is bounded. Wealth is not. The tool that works for one will mislead in the other.";
ch.memorableLines[2].text = "Before you calculate, ask if one case can rewrite the total.";

// =========================================================
// SAVE
// =========================================================
fs.writeFileSync(path, JSON.stringify(book, null, 2) + '\n');
console.log('Saved.');
