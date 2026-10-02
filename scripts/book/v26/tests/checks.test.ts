import test from "node:test";
import assert from "node:assert/strict";
import type { Chapter, LessonCard, Issue } from "../src/types";
import { readerFields, runChecks, splitLesson, type CheckContext } from "../src/checks";

// ---------------------------------------------------------------- fixtures

const AUTHOR_TEXT =
  "I grew up in a house where every shilling had a job. My father used to say that a man who spends " +
  "before he counts will soon be counting nothing. I resolved early to keep a little book, and in it " +
  "I set down each fault of the day against the virtue I wanted. Order, I found, was the hardest of " +
  "them. Nothing was so hard as to keep my papers in their places. Yet the little book taught me that " +
  "a fault named is half mended. I was never perfect, but I was a better man for the trying, and happier.";

const KEY = "Name each fault in writing and you have already begun to mend it.";

const SHAPE: CheckContext["shape"] = {
  examples: 2,
  quizQuestions: 3,
  choices: 3,
  reviewCards: 3,
  memorableLines: 2,
  ifThenPlans: 2,
  fastRead: [40, 100],
  deepRead: [100, 170],
  fullRead: [150, 320],
};

const BOOK = {
  bookId: "demo-book",
  title: "Demo Book",
  author: "Ada Example",
  categories: ["self-development"],
  tags: ["habits", "memoir"],
  bookType: "memoir" as const,
};

function ctx(over: Partial<CheckContext> = {}): CheckContext {
  return { n: 1, book: BOOK, authorText: AUTHOR_TEXT, shape: SHAPE, earlierLessons: [], ...over };
}

function lessonCard(over: Partial<LessonCard> = {}): LessonCard {
  return {
    lesson: KEY,
    wrongBelief: "You have to be perfect before you can improve.",
    keyPhrase: "a fault named is half mended",
    hookQuestion: "What did the trying look like each day?",
    storyNames: ["Benjamin", "Franklin"],
    evidence: ["I resolved early to keep a little book"],
    ...over,
  };
}

function chapter(): Chapter {
  const q = (i: number, prompt: string, choices: string[], correctIndex: number, explanation: string) => ({
    questionId: `q${i}`,
    prompt,
    choices,
    correctIndex,
    explanation,
    bloomsLevel: "apply",
  });
  return {
    title: "The Little Book of Faults",
    hook:
      'He wrote, "I was never perfect, but I was a better man for the trying." What did the trying look like each day?',
    counterintuition:
      "You might think a man fixes his faults by hating them. He did the opposite. He wrote each one down, calmly, like a shopkeeper counting coins.",
    keyTakeaway: KEY,
    tryThisNow: "Write down one small fault from today, and do not explain it or argue with it. Just name it in a single plain sentence.",
    breakdown: {
      fastRead:
        'As a young man he kept a little book, and each night he wrote down the faults he had fallen into that day, without scolding himself or making any promises about tomorrow. He found that "a fault named is half mended." Order was the hardest habit for him to keep, and he was never perfect, but he said that he became a better and happier man for the trying.',
      deepRead:
        "Benjamin kept a small book with a page for each virtue he wanted, and every night he looked back over the day to mark the faults he had slipped into. He did not ask himself to be perfect, because he only asked himself to notice what had happened. The act of writing was the whole method, and it took only a few minutes.\n\n" +
        'Order gave him the most trouble. Papers drifted out of place, and the hour he had planned for work slipped away before he could use it. Still, he kept the book, and he later said that "a fault named is half mended." He also said that the trying made him happier, because the habit was small and honest.',
      fullRead:
        "Benjamin grew up in a house where every shilling had a job, and his father taught him to count his money carefully before he spent a single coin of it. That early lesson shaped the way he looked at his own days, because a day, like a purse, could be counted.\n\n" +
        "So he made a little book, and in it he set a page for each virtue he wanted. Each night he marked the faults he had fallen into, but he did not scold himself or promise to be a new man by morning. He only wrote the fault down and looked at it.\n\n" +
        'Order was the hardest of the virtues for him, since he kept losing his papers and his hours. Yet the book showed him a pattern, and a pattern is easier to fix than a mood. He learned that "a fault named is half mended." He was never perfect, but he was a better man for the trying, and happier.',
    },
    examples: [
      {
        exampleId: "ex1",
        title: "The unread inbox",
        tags: ["work"],
        scenario:
          "Mia opens her email each morning and feels a knot in her stomach, so she never looks at the number of messages. She just closes the laptop and tells herself that she will deal with it later.",
        whatToDo: "Write one line that says you avoid your inbox, and then read it back once, because naming the habit is the first step toward changing it.",
        whyItMatters: "Once the habit has a name, Mia can see it clearly and choose a small fix that she can keep.",
      },
      {
        exampleId: "ex2",
        title: "The late runner",
        tags: ["health"],
        scenario:
          "Dev skips his morning run again and calls himself lazy, but the word lazy ends the thought, so nothing changes.",
        whatToDo: "Swap the word lazy for a plain note that says he skipped the run because he stayed up much too late the night before, which is a cause he can change.",
        whyItMatters: "A plain note points to a cause that he can actually fix, which a label never does.",
      },
    ],
    quiz: {
      passingScorePercent: 70,
      questions: [
        q(
          1,
          "Sam keeps missing deadlines and feels ashamed of it. What helps most as a first step?",
          ["Promise to try harder next week", "Note which deadlines slipped", "Stop thinking about it completely"],
          1,
          "Writing the fault down is the first move.",
        ),
        q(
          2,
          "Rosa wants to stop snapping at her team during busy afternoons. What fits the idea best?",
          ["Note each time it happens", "Wait until she feels calm again", "Say sorry to everyone daily"],
          0,
          "A noted fault can be seen and then mended.",
        ),
        q(
          3,
          "Lee thinks he must be perfect before he starts a plan. What is the better view?",
          ["Start by naming one fault", "Plan everything first", "Ask others to decide for him"],
          0,
          "Naming a fault begins the mending without waiting for perfect.",
        ),
      ],
    },
    reviewCards: [
      { cardId: "rc1", front: "What did the little book record each night?", back: "The faults he had fallen into during the day.", difficulty: "easy" },
      { cardId: "rc2", front: "Why write a fault down instead of just thinking about it?", back: "Naming it plainly begins to mend it.", difficulty: "medium" },
      { cardId: "rc3", front: "What was hardest for him to keep in good order?", back: "Order in his papers and in his hours.", difficulty: "medium" },
    ],
    implementationPlan: {
      coreSkill: "Naming a fault plainly and in writing.",
      ifThenPlans: [
        { context: "When I feel ashamed of a slip", plan: "I write it down in one plain line." },
        { context: "When I want to scold myself", plan: "I name the fault and stop there." },
      ],
      twentyFourHourChallenge: "Write down three small faults tonight.",
      weeklyPractice: "Keep a nightly list and read it on Sunday.",
    },
    memorableLines: [
      { text: "Write the fault down and half the work is done." },
      { text: 'He called it "a fault named is half mended."' },
    ],
  };
}

const edit = (fn: (c: Chapter) => void): Chapter => {
  const c = chapter();
  fn(c);
  return c;
};

const find = (issues: Issue[], re: RegExp, field?: string): Issue | undefined =>
  issues.find((i) => re.test(i.text) && (field === undefined || i.field === field));

const BAD_QUOTE = '"Honesty is the best policy in every shop"';

// ---------------------------------------------------------------- splitLesson

test("splitLesson: removes _lesson and returns a valid card", () => {
  const raw = { ...chapter(), _lesson: lessonCard() };
  const r = splitLesson(raw);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.lesson, lessonCard());
  assert.ok(r.chapter);
  assert.equal("_lesson" in (r.chapter as object), false);
  assert.equal(r.chapter!.title, "The Little Book of Faults");
  assert.equal("_lesson" in raw, true, "the input object is not mutated");
});

test("splitLesson: missing _lesson is an error and still returns the chapter", () => {
  const r = splitLesson(chapter());
  assert.equal(r.lesson, null);
  assert.ok(r.chapter);
  assert.match(r.errors.join(" "), /missing _lesson/);
});

test("splitLesson: invalid card fields are named in the errors", () => {
  const bad = { ...lessonCard(), keyPhrase: "", storyNames: "Ben", evidence: [1, 2] };
  const r = splitLesson({ ...chapter(), _lesson: bad });
  assert.equal(r.lesson, null);
  assert.ok(r.chapter);
  const all = r.errors.join(" | ");
  assert.match(all, /keyPhrase/);
  assert.match(all, /storyNames/);
  assert.match(all, /evidence/);
  assert.equal("_lesson" in (r.chapter as object), false);
});

test("splitLesson: a _lesson that is not an object is an error", () => {
  const r = splitLesson({ ...chapter(), _lesson: "the lesson" });
  assert.equal(r.lesson, null);
  assert.match(r.errors.join(" "), /_lesson/);
});

test("splitLesson: a non-object input gives no chapter", () => {
  for (const raw of [null, undefined, "x", 3, [1]]) {
    const r = splitLesson(raw);
    assert.equal(r.chapter, null);
    assert.equal(r.lesson, null);
    assert.ok(r.errors.length > 0);
  }
});

test("splitLesson: empty arrays are fine, extra card keys are dropped", () => {
  const r = splitLesson({ ...chapter(), _lesson: { ...lessonCard(), storyNames: [], evidence: [], extra: 1 } });
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.lesson, lessonCard({ storyNames: [], evidence: [] }));
});

// ---------------------------------------------------------------- readerFields

test("readerFields: ids follow the W1 layout", () => {
  const f = readerFields(chapter());
  for (const id of [
    "hook",
    "counterintuition",
    "keyTakeaway",
    "tryThisNow",
    "breakdown.fastRead",
    "breakdown.deepRead",
    "breakdown.fullRead",
    "examples.ex1.scenario",
    "examples.ex1.whatToDo",
    "examples.ex1.whyItMatters",
    "quiz.q1.prompt",
    "quiz.q1.choices.0",
    "quiz.q1.choices.2",
    "quiz.q1.explanation",
    "reviewCards.rc1.front",
    "reviewCards.rc1.back",
    "implementationPlan.coreSkill",
    "implementationPlan.ifThenPlans.0.context",
    "implementationPlan.ifThenPlans.0.plan",
    "implementationPlan.twentyFourHourChallenge",
    "implementationPlan.weeklyPractice",
    "memorableLines.0",
    "memorableLines.1",
  ]) {
    assert.equal(typeof f[id], "string", id);
  }
  assert.equal(f["keyTakeaway"], KEY);
  assert.equal(f["quiz.q2.choices.1"], "Wait until she feels calm again");
  assert.equal(f["memorableLines.1"], 'He called it "a fault named is half mended."');
});

// ---------------------------------------------------------------- the valid chapter

test("a valid chapter has no blocking and no reported issues", async () => {
  const r = await runChecks(chapter(), lessonCard(), ctx());
  assert.deepEqual(r.blocking, []);
  assert.deepEqual(r.reported, []);
  assert.deepEqual(r.advisory, []);
});

test("a valid chapter fills info with the numbers", async () => {
  const r = await runChecks(chapter(), lessonCard(), ctx());
  const info = r.info as any;
  for (const t of ["fastRead", "deepRead", "fullRead"]) {
    assert.equal(typeof info.tierWords[t], "number", t);
    assert.equal(typeof info.fk[t], "number", t);
    assert.equal(typeof info.quotesPerTier[t], "number", t);
  }
  assert.equal(typeof info.fkRest, "number");
  assert.deepEqual(info.keyPositions, [2, 1, 0]);
  assert.equal(info.keyUniquelyLongest, 0);
  assert.equal(info.exampleWords.length, 2);
  assert.deepEqual(info.repeatFields, []);
  assert.equal(info.quotesPerTier.fastRead, 1);
  assert.equal(info.quotesPerTier.deepRead, 1);
  assert.equal(info.quotesPerTier.fullRead, 1);
});

test("every issue from the checks is source det", async () => {
  const bad = edit((c) => {
    c.hook = `He wrote ${BAD_QUOTE} in 1999.`;
  });
  const r = await runChecks(bad, lessonCard(), ctx());
  assert.ok(r.blocking.length > 0 && r.reported.length > 0);
  for (const i of r.blocking) assert.equal(i.source, "det");
  for (const i of r.blocking) assert.equal(i.blocking, true);
  for (const i of r.reported) assert.equal(i.blocking, false);
});

// ---------------------------------------------------------------- blocking 1: shape

test("shape: a missing field is blocking and named", async () => {
  const c: any = chapter();
  delete c.hook;
  const r = await runChecks(c, lessonCard(), ctx());
  assert.ok(find(r.blocking, /hook/, "hook"), JSON.stringify(r.blocking));
});

test("shape: wrong types are blocking and named", async () => {
  const c: any = chapter();
  c.examples = "none";
  c.breakdown.deepRead = 12;
  c.quiz.questions[1].choices = "a, b, c";
  c.quiz.questions[2].correctIndex = "1";
  const r = await runChecks(c, lessonCard(), ctx());
  assert.ok(find(r.blocking, /examples/, "examples"), JSON.stringify(r.blocking));
  assert.ok(find(r.blocking, /breakdown\.deepRead/, "breakdown.deepRead"));
  assert.ok(find(r.blocking, /choices/, "quiz.questions.1.choices"));
  assert.ok(find(r.blocking, /correctIndex/, "quiz.questions.2.correctIndex"));
});

test("shape: nested fields of examples, cards, plan and lines are checked", async () => {
  const c: any = chapter();
  delete c.examples[0].whyItMatters;
  c.examples[1].tags = "work";
  delete c.reviewCards[2].back;
  c.implementationPlan.ifThenPlans[0] = { context: "x" };
  delete c.implementationPlan.weeklyPractice;
  c.memorableLines[1] = { text: 4 };
  delete c.quiz.questions[0].explanation;
  const r = await runChecks(c, lessonCard(), ctx());
  for (const field of [
    "examples.0.whyItMatters",
    "examples.1.tags",
    "reviewCards.2.back",
    "implementationPlan.ifThenPlans.0.plan",
    "implementationPlan.weeklyPractice",
    "memorableLines.1.text",
    "quiz.questions.0.explanation",
  ]) {
    assert.ok(r.blocking.some((i) => i.field === field), `${field} in ${JSON.stringify(r.blocking.map((i) => i.field))}`);
  }
});

test("shape: a _lesson left inside the chapter is blocking", async () => {
  const c: any = chapter();
  c._lesson = lessonCard();
  const r = await runChecks(c, lessonCard(), ctx());
  assert.ok(find(r.blocking, /_lesson/, "_lesson"), JSON.stringify(r.blocking));
});

test("shape: a chapter that is not an object does not throw", async () => {
  const r = await runChecks(null as unknown as Chapter, lessonCard(), ctx());
  assert.ok(r.blocking.length > 0);
});

// ---------------------------------------------------------------- blocking 2: app validator

test("app validator: a chapter the app rejects is blocking", async () => {
  const c = edit((x) => {
    x.quiz.passingScorePercent = 500;
  });
  const r = await runChecks(c, lessonCard(), ctx());
  assert.ok(find(r.blocking, /app validator/i), JSON.stringify(r.blocking));
});

// ---------------------------------------------------------------- blocking 3: quotations

test("quotes: an invented quote in each checked field is blocking", async () => {
  const cases: Array<[string, (c: Chapter) => void]> = [
    ["hook", (c) => (c.hook = `He said ${BAD_QUOTE} once.`)],
    ["counterintuition", (c) => (c.counterintuition = `He said ${BAD_QUOTE} once.`)],
    ["keyTakeaway", (c) => (c.keyTakeaway = `Name faults ${BAD_QUOTE}`)],
    ["tryThisNow", (c) => (c.tryThisNow = `Try ${BAD_QUOTE} today.`)],
    ["breakdown.fastRead", (c) => (c.breakdown.fastRead += ` He said ${BAD_QUOTE}.`)],
    ["breakdown.deepRead", (c) => (c.breakdown.deepRead += ` He said ${BAD_QUOTE}.`)],
    ["breakdown.fullRead", (c) => (c.breakdown.fullRead += ` He said ${BAD_QUOTE}.`)],
    ["quiz.q1.explanation", (c) => (c.quiz.questions[0].explanation = `He said ${BAD_QUOTE}.`)],
    ["reviewCards.rc2.back", (c) => (c.reviewCards[1].back = `He said ${BAD_QUOTE}.`)],
    ["memorableLines.1", (c) => (c.memorableLines[1].text = `He said ${BAD_QUOTE}.`)],
  ];
  for (const [field, fn] of cases) {
    const c = edit(fn);
    // keyTakeaway is also compared with the lesson, so keep the card in step to isolate the quote rule.
    const lesson = lessonCard({ lesson: c.keyTakeaway });
    const r = await runChecks(c, lesson, ctx());
    const hit = r.blocking.find((i) => i.field === field && /quot/i.test(i.text));
    assert.ok(hit, `${field}: ${JSON.stringify(r.blocking)}`);
    assert.match(hit!.text, /Honesty is the best policy/);
  }
});

test("quotes: a real quote with an ellipsis and curly marks passes", async () => {
  const c = edit((x) => {
    x.hook = "He wrote, “I resolved early to keep a little book … against the virtue I wanted.”";
  });
  const r = await runChecks(c, lessonCard(), ctx());
  assert.deepEqual(r.blocking, []);
});

test("quotes: an editor's note is not the author's text", async () => {
  const c = edit((x) => {
    x.hook = 'A note says "The Boston edition adds a footnote here".';
  });
  // authorText has no editor notes, so the quote is not found.
  const r = await runChecks(c, lessonCard(), ctx());
  assert.ok(find(r.blocking, /quot/i, "hook"));
});

test("quotes: memorableLines[0] is not checked", async () => {
  const c = edit((x) => {
    x.memorableLines[0].text = `The lesson, ${BAD_QUOTE}.`;
  });
  const r = await runChecks(c, lessonCard(), ctx());
  assert.equal(
    r.blocking.some((i) => /quot/i.test(i.text)),
    false,
    JSON.stringify(r.blocking),
  );
});

test("quotes: an invented quote in an example, quiz prompt, card front or plan is only advisory", async () => {
  const c = edit((x) => {
    x.examples[0].scenario = `Mia hears her boss say ${BAD_QUOTE} at the meeting and nods.`;
    x.quiz.questions[0].prompt = `Sam's coach says ${BAD_QUOTE}. What helps most first?`;
    x.quiz.questions[1].choices[2] = `Say ${BAD_QUOTE} aloud`;
    x.reviewCards[0].front = `Who said ${BAD_QUOTE}?`;
    x.implementationPlan.coreSkill = `Say ${BAD_QUOTE} to yourself.`;
  });
  const r = await runChecks(c, lessonCard(), ctx());
  assert.equal(
    r.blocking.some((i) => /quot/i.test(i.text)),
    false,
    JSON.stringify(r.blocking),
  );
  const adv = r.advisory.filter((a) => /Honesty is the best policy/.test(a));
  assert.equal(adv.length, 5, JSON.stringify(r.advisory));
  assert.ok(adv.some((a) => /examples\.ex1\.scenario/.test(a)));
  assert.ok(adv.some((a) => /quiz\.q1\.prompt/.test(a)));
  assert.ok(adv.some((a) => /quiz\.q2\.choices\.2/.test(a)));
  assert.ok(adv.some((a) => /reviewCards\.rc1\.front/.test(a)));
  assert.ok(adv.some((a) => /implementationPlan\.coreSkill/.test(a)));
});

test("quotes: an invented example quote that IS in the source gives no advisory", async () => {
  const c = edit((x) => {
    x.examples[0].scenario = 'Mia reads that "a fault named is half mended" and writes it on a note.';
  });
  const r = await runChecks(c, lessonCard(), ctx());
  assert.equal(
    r.advisory.some((a) => /quot/i.test(a)),
    false,
  );
});

// ---------------------------------------------------------------- blocking 4: keys, walls, chatter

test("correctIndex: out of range, negative and non-integer are blocking", async () => {
  for (const bad of [3, -1, 1.5]) {
    const c = edit((x) => {
      x.quiz.questions[1].correctIndex = bad;
    });
    const r = await runChecks(c, lessonCard(), ctx());
    assert.ok(
      r.blocking.some((i) => i.field === "quiz.questions.1.correctIndex" && /correctIndex/.test(i.text)),
      `${bad}: ${JSON.stringify(r.blocking)}`,
    );
  }
});

test("walls: a tier over 180 words in one paragraph is blocking; split paragraphs are fine", async () => {
  const sentence = "He kept the little book and wrote each fault down at night. ";
  const wall = sentence.repeat(20).trim(); // 240 words
  const c = edit((x) => {
    x.breakdown.fullRead = wall;
  });
  const r = await runChecks(c, lessonCard(), ctx());
  assert.ok(find(r.blocking, /single paragraph|wall/i, "breakdown.fullRead"), JSON.stringify(r.blocking));

  const split = edit((x) => {
    x.breakdown.fullRead = sentence.repeat(10).trim() + "\n \n" + sentence.repeat(10).trim();
  });
  const r2 = await runChecks(split, lessonCard(), ctx());
  assert.equal(
    r2.blocking.some((i) => /single paragraph|wall/i.test(i.text)),
    false,
  );

  const short = edit((x) => {
    x.breakdown.fastRead = sentence.repeat(10).trim(); // 120 words, one paragraph: allowed
  });
  const r3 = await runChecks(short, lessonCard(), ctx());
  assert.equal(
    r3.blocking.some((i) => /single paragraph|wall/i.test(i.text)),
    false,
  );
});

test("chatter: meta text in any reader field is blocking", async () => {
  const lines = [
    "As an AI I cannot say.",
    "This language model wrote it.",
    "Here is the JSON you asked for.",
    "Here's the JSON now.",
    "The author writes that faults matter.",
    "Use ```json fences```.",
    "In this chapter we will look at faults.",
    "The source text says so.",
    "The source span is short.",
    "My draft needs work.",
  ];
  for (const line of lines) {
    const c = edit((x) => {
      x.examples[1].whyItMatters = line;
    });
    const r = await runChecks(c, lessonCard(), ctx());
    assert.ok(
      r.blocking.some((i) => i.field === "examples.ex2.whyItMatters" && /chatter|meta/i.test(i.text)),
      `${line}: ${JSON.stringify(r.blocking)}`,
    );
  }
});

test("chatter: ordinary words do not trip it", async () => {
  const c = edit((x) => {
    x.examples[1].whyItMatters = "The author of the plan is Dev, and the sources of his delay are plain.";
  });
  const r = await runChecks(c, lessonCard(), ctx());
  assert.equal(
    r.blocking.some((i) => /chatter|meta/i.test(i.text)),
    false,
  );
});

// ---------------------------------------------------------------- blocking 5: lesson

test("lesson: a missing card is blocking", async () => {
  const r = await runChecks(chapter(), null, ctx());
  assert.ok(find(r.blocking, /missing _lesson/), JSON.stringify(r.blocking));
});

test("lesson: keyTakeaway must equal lesson.lesson, ignoring whitespace", async () => {
  const same = await runChecks(chapter(), lessonCard({ lesson: `  ${KEY.replace(/ /g, "  ")}\n` }), ctx());
  assert.deepEqual(same.blocking, []);

  const diff = await runChecks(chapter(), lessonCard({ lesson: "Name every fault in writing." }), ctx());
  assert.ok(find(diff.blocking, /keyTakeaway/, "keyTakeaway"), JSON.stringify(diff.blocking));
});

test("lesson: keyTakeaway must be 1 to 20 words", async () => {
  const long = Array.from({ length: 21 }, (_, i) => `word${i}`).join(" ");
  const c = edit((x) => {
    x.keyTakeaway = long;
  });
  const r = await runChecks(c, lessonCard({ lesson: long }), ctx());
  assert.ok(find(r.blocking, /21 words|1.20 words|at most 20/, "keyTakeaway"), JSON.stringify(r.blocking));

  const twenty = Array.from({ length: 20 }, (_, i) => `word${i}`).join(" ");
  const ok = edit((x) => {
    x.keyTakeaway = twenty;
  });
  const r2 = await runChecks(ok, lessonCard({ lesson: twenty }), ctx());
  assert.equal(
    r2.blocking.some((i) => i.field === "keyTakeaway"),
    false,
  );
});

// ---------------------------------------------------------------- reported 6: outside facts

test("outside facts: percents, years and research phrases in invented fields are reported", async () => {
  const c = edit((x) => {
    x.hook = "In 1999 a man began a little book."; // year
    x.counterintuition = "About 40% of people give up, and 12.5 % of them never try."; // two hits
    x.tryThisNow = "According to a friend, writing helps."; // according to
    x.examples[0].scenario = "A study of office workers shows the same.";
    x.quiz.questions[0].choices[0] = "Researchers found it works";
    x.quiz.questions[1].explanation = "Statistics suggest otherwise.";
    x.reviewCards[0].back = "Scientists agree.";
    x.implementationPlan.weeklyPractice = "Do it for 21 days, as the survey says.";
  });
  const r = await runChecks(c, lessonCard(), ctx());
  assert.deepEqual(r.blocking, []);
  const rep = r.reported.filter((i) => /outside fact/i.test(i.text));
  const at = (field: string) => rep.filter((i) => i.field === field);
  assert.equal(at("hook").length, 1);
  assert.match(at("hook")[0].text, /1999/);
  assert.equal(at("counterintuition").length, 2);
  assert.ok(at("counterintuition").some((i) => /40%/.test(i.text)));
  assert.ok(at("counterintuition").some((i) => /12\.5 %/.test(i.text)));
  assert.equal(at("tryThisNow").length, 1);
  assert.equal(at("examples.ex1.scenario").length, 1);
  assert.equal(at("quiz.q1.choices.0").length, 1);
  assert.equal(at("quiz.q2.explanation").length, 1);
  assert.equal(at("reviewCards.rc1.back").length, 1);
  assert.equal(at("implementationPlan.weeklyPractice").length, 1);
  for (const i of rep) {
    assert.equal(i.source, "det");
    assert.equal(i.blocking, false);
  }
});

test("outside facts: breakdown text and ordinary numbers are not reported", async () => {
  const c = edit((x) => {
    x.breakdown.fastRead += " In 1730 he began; 80% of nights he wrote.";
    x.examples[0].whatToDo = "Write for 10 minutes on day 3.";
    x.hook = "He was born in 1706."; // 1706 is a year => reported (control)
  });
  const r = await runChecks(c, lessonCard(), ctx());
  const fields = r.reported.filter((i) => /outside fact/i.test(i.text)).map((i) => i.field);
  assert.deepEqual(fields, ["hook"]);
});

// ---------------------------------------------------------------- reported 7: story names

test("story names: a name in a quiz prompt, choice or card is reported (whole word, case-sensitive)", async () => {
  const c = edit((x) => {
    x.quiz.questions[0].prompt = "Benjamin keeps missing deadlines. What helps most first?";
    x.quiz.questions[1].choices[1] = "Ask Franklin what to do";
    x.reviewCards[0].front = "What did Benjamin record?";
    x.reviewCards[2].back = "Order, as Franklin found.";
    // Not hits: partial word, different case, explanation (not in the rule), a name under 3 characters.
    x.quiz.questions[2].choices[2] = "Benjamins are hundred-dollar notes";
    x.quiz.questions[2].explanation = "Benjamin did it.";
    x.reviewCards[1].front = "Why did franklin write?";
  });
  const r = await runChecks(c, lessonCard({ storyNames: ["Benjamin", "Franklin", "Bo"] }), ctx());
  const hits = r.reported.filter((i) => /story name in quiz\/card/.test(i.text));
  const fields = hits.map((i) => i.field).sort();
  assert.deepEqual(fields, ["quiz.q1.prompt", "quiz.q2.choices.1", "reviewCards.rc1.front", "reviewCards.rc3.back"]);
  for (const h of hits) {
    assert.equal(h.source, "det");
    assert.equal(h.blocking, false);
  }
  assert.match(hits.find((h) => h.field === "quiz.q2.choices.1")!.text, /Franklin/);
});

test("story names: a short name (under 3 characters) is ignored", async () => {
  const c = edit((x) => {
    x.reviewCards[0].front = "What did Bo record?";
  });
  const r = await runChecks(c, lessonCard({ storyNames: ["Bo"] }), ctx());
  assert.equal(
    r.reported.some((i) => /story name/.test(i.text)),
    false,
  );
});

// ---------------------------------------------------------------- reported 8: repeats

test("repeats: more than 2 fields near-copying keyTakeaway gives one issue listing them", async () => {
  const c = edit((x) => {
    x.hook = `${KEY} That was his plan.`;
    x.counterintuition = `Remember: ${KEY.toLowerCase()}`;
    x.tryThisNow = `Today, ${KEY}`;
  });
  const r = await runChecks(c, lessonCard(), ctx());
  const rep = r.reported.filter((i) => /repeat/i.test(i.text));
  assert.equal(rep.length, 1, JSON.stringify(r.reported));
  assert.match(rep[0].text, /hook/);
  assert.match(rep[0].text, /counterintuition/);
  assert.match(rep[0].text, /tryThisNow/);
  assert.deepEqual(
    ((r.info as any).repeatFields as Array<{ field: string }>).map((x) => x.field).sort(),
    ["counterintuition", "hook", "tryThisNow"],
  );
});

test("repeats: exactly 2 fields is allowed (but is still recorded in info)", async () => {
  const c = edit((x) => {
    x.hook = `${KEY} That was his plan.`;
    x.tryThisNow = `Today, ${KEY}`;
  });
  const r = await runChecks(c, lessonCard(), ctx());
  assert.equal(
    r.reported.some((i) => /repeat/i.test(i.text)),
    false,
  );
  assert.equal(((r.info as any).repeatFields as unknown[]).length, 2);
});

test("repeats: a field with under half of the 4-grams is not counted", async () => {
  // KEY has 10 four-word grams; this sentence shares 4 of them (40%).
  const partial = "Name each fault in writing and you will see a better plan.";
  const c = edit((x) => {
    x.hook = partial;
    x.counterintuition = partial;
    x.tryThisNow = partial;
  });
  const r = await runChecks(c, lessonCard(), ctx());
  assert.deepEqual((r.info as any).repeatFields, []);
  assert.equal(
    r.reported.some((i) => /repeat/i.test(i.text)),
    false,
  );
});

test("repeats: exactly half of the 4-grams counts", async () => {
  // This sentence shares 5 of the 10 four-word grams of KEY (the first 8 words), which is 50%.
  const half = "Name each fault in writing and you have a better plan.";
  const c = edit((x) => {
    x.hook = half;
    x.counterintuition = half;
    x.tryThisNow = half;
  });
  const r = await runChecks(c, lessonCard(), ctx());
  const shares = ((r.info as any).repeatFields as Array<{ share: number }>).map((x) => x.share);
  assert.deepEqual(shares, [0.5, 0.5, 0.5]);
  assert.equal(r.reported.filter((i) => /repeat/i.test(i.text)).length, 1);
});

test("repeats: curly apostrophes and punctuation do not hide a copy", async () => {
  // Every 4-gram of the key crosses an apostrophe, so the copies only match if the curly one is normalised.
  const key = "Don\u2019t wait: you\u2019re ready, so don\u2019t hide it.";
  const straight = "Don't wait: you're ready, so don't hide it.";
  const c = edit((x) => {
    x.keyTakeaway = key;
    x.hook = straight;
    x.counterintuition = straight;
    x.tryThisNow = straight;
  });
  const r = await runChecks(c, lessonCard({ lesson: key }), ctx());
  const repeatFields = (r.info as any).repeatFields as Array<{ field: string; share: number }>;
  assert.equal(repeatFields.length, 3, JSON.stringify(repeatFields));
  assert.deepEqual(
    repeatFields.map((x) => x.share),
    [1, 1, 1],
  );
  assert.equal(r.reported.filter((i) => /repeat/i.test(i.text)).length, 1, JSON.stringify(r.reported));
});

// ---------------------------------------------------------------- reported 9: memorableLines[0]

test("line 1: over 15 words is reported", async () => {
  const c = edit((x) => {
    x.memorableLines[0].text =
      "Write the fault down plainly and calmly before bed and you will find that half of the work is done.";
  });
  const r = await runChecks(c, lessonCard(), ctx());
  const hit = r.reported.find((i) => i.field === "memorableLines.0" && /15 words|words/.test(i.text));
  assert.ok(hit, JSON.stringify(r.reported));
});

test("line 1: 15 words or fewer in fresh wording is fine", async () => {
  const c = edit((x) => {
    x.memorableLines[0].text = "Write down the fault each night and the whole job gets lighter for you.";
  });
  const words = c.memorableLines[0].text.split(/\s+/).length;
  assert.ok(words <= 15, String(words));
  const r = await runChecks(c, lessonCard(), ctx());
  assert.equal(
    r.reported.some((i) => i.field === "memorableLines.0"),
    false,
  );
});

test("line 1: copying the lesson is reported as 'fresh words'", async () => {
  const c = edit((x) => {
    x.memorableLines[0].text = "Name each fault in writing and you have begun to mend it.";
  });
  const r = await runChecks(c, lessonCard(), ctx());
  assert.ok(
    r.reported.some((i) => i.field === "memorableLines.0" && /fresh words/.test(i.text) && /line 1/.test(i.text)),
    JSON.stringify(r.reported),
  );
});

// ---------------------------------------------------------------- reported 10: lesson overlap

test("lesson overlap: a near-duplicate earlier lesson is reported with source lesson", async () => {
  const r = await runChecks(
    chapter(),
    lessonCard(),
    ctx({
      earlierLessons: ["Small daily practice beats rare heroic effort.", "Name every fault in writing and you have begun to mend it."],
    }),
  );
  const dup = r.reported.filter((i) => /^DUPLICATE_LESSON/.test(i.text));
  assert.equal(dup.length, 1, JSON.stringify(r.reported));
  assert.equal(dup[0].source, "lesson");
  assert.equal(dup[0].blocking, false);
  assert.match(dup[0].text, /Name every fault/);
  assert.deepEqual(r.blocking, []);
});

test("lesson overlap: unrelated or low-overlap lessons are not reported", async () => {
  const r = await runChecks(
    chapter(),
    lessonCard(),
    ctx({ earlierLessons: ["Small daily practice beats rare heroic effort.", "Name the habit before you change it."] }),
  );
  assert.equal(
    r.reported.some((i) => /DUPLICATE_LESSON/.test(i.text)),
    false,
  );
});

// ---------------------------------------------------------------- advisory and info

test("advisory: tier word counts outside the shape band", async () => {
  const c = edit((x) => {
    x.breakdown.fastRead = "He kept a little book. He wrote faults down.";
  });
  const r = await runChecks(c, lessonCard(), ctx());
  assert.ok(r.advisory.some((a) => /fastRead/.test(a) && /words/.test(a)), JSON.stringify(r.advisory));
  assert.equal((r.info as any).tierWords.fastRead, 9);
  assert.deepEqual(r.blocking, []);
});

test("advisory: a paragraph over 140 words", async () => {
  const sentence = "He kept the little book and wrote each fault down at night. ";
  const c = edit((x) => {
    x.breakdown.fullRead = sentence.repeat(15).trim() + "\n\n" + x.breakdown.fullRead.split("\n\n")[1]; // first paragraph is 180 words
  });
  const r = await runChecks(c, lessonCard(), ctx());
  assert.ok(r.advisory.some((a) => /breakdown\.fullRead/.test(a) && /140/.test(a)), JSON.stringify(r.advisory));
  assert.deepEqual(r.blocking, []);
});

test("advisory: FK grade outside 5.0 to 8.5 in a tier and in the rest", async () => {
  const hard =
    "Notwithstanding considerable epistemological reservations, the protagonist systematically institutionalised introspective documentation. Contemporary psychologists characteristically acknowledge this unquestionably extraordinary methodological sophistication.";
  const c = edit((x) => {
    x.breakdown.deepRead = hard;
    x.tryThisNow = hard;
    for (const e of x.examples) {
      e.scenario = hard;
      e.whatToDo = hard;
      e.whyItMatters = hard;
    }
  });
  const r = await runChecks(c, lessonCard(), ctx());
  assert.ok(r.advisory.some((a) => /FK/.test(a) && /deepRead/.test(a)), JSON.stringify(r.advisory));
  assert.ok(r.advisory.some((a) => /FK/.test(a) && /rest/.test(a)), JSON.stringify(r.advisory));
  assert.ok(((r.info as any).fk.deepRead as number) > 8.5);
  assert.ok(((r.info as any).fkRest as number) > 8.5);
});

test("advisory: key spread, uniquely longest key, long stems and long scenarios", async () => {
  const mk = (i: number) => ({
    questionId: `q${i}`,
    prompt: i === 1 ? Array.from({ length: 31 }, () => "word").join(" ") + "?" : `Question ${i}: what helps most first?`,
    choices: ["Short", "Medium one", "The longest choice here by far"],
    correctIndex: 2,
    explanation: "Because naming a fault begins to mend it.",
    bloomsLevel: "apply",
  });
  const c = edit((x) => {
    x.quiz.questions = [1, 2, 3, 4, 5, 6].map(mk);
    x.examples[0].scenario = Array.from({ length: 76 }, (_, i) => `step${i}`).join(" ") + ".";
  });
  const r = await runChecks(c, lessonCard(), ctx({ shape: { ...SHAPE, quizQuestions: 6 } }));
  assert.deepEqual((r.info as any).keyPositions, [0, 0, 6]);
  assert.equal((r.info as any).keyUniquelyLongest, 6);
  assert.deepEqual((r.info as any).exampleWords[0], 76);
  assert.ok(r.advisory.some((a) => /key position/i.test(a)), JSON.stringify(r.advisory));
  assert.ok(r.advisory.some((a) => /longest/i.test(a)));
  assert.ok(r.advisory.some((a) => /stem/i.test(a) && /q1/.test(a)));
  assert.ok(r.advisory.some((a) => /examples\.ex1/.test(a) && /75/.test(a)));
  assert.deepEqual(r.blocking, []);
});

test("advisory: counts that differ from the shape", async () => {
  const c = edit((x) => {
    x.examples.pop();
    x.reviewCards.pop();
    x.memorableLines.push({ text: 'A line: "I was never perfect, but I was a better man for the trying."' });
  });
  const r = await runChecks(c, lessonCard(), ctx());
  assert.ok(r.advisory.some((a) => /examples/.test(a) && /1/.test(a) && /2/.test(a)), JSON.stringify(r.advisory));
  assert.ok(r.advisory.some((a) => /reviewCards/.test(a)));
  assert.ok(r.advisory.some((a) => /memorableLines/.test(a)));
});

test("info: a tie for the longest choice does not count as uniquely longest", async () => {
  const c = edit((x) => {
    x.quiz.questions[0].choices = ["Write it down", "Write it down", "Try harder"];
    x.quiz.questions[0].correctIndex = 0;
  });
  const r = await runChecks(c, lessonCard(), ctx());
  assert.equal((r.info as any).keyUniquelyLongest, 0);
});

test("info: quotes are counted per tier", async () => {
  const c = edit((x) => {
    x.breakdown.fastRead +=
      ' He said "I resolved early to keep a little book" and "Order, I found, was the hardest of them."';
  });
  const r = await runChecks(c, lessonCard(), ctx());
  assert.equal((r.info as any).quotesPerTier.fastRead, 3);
});
