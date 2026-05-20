import { runBookPatternAudit } from "../critics/bookPatternAudit.js";

function makeChapter(n: number, counterintuition: string) {
  return {
    chapterId: `test-ch${n}`,
    number: n,
    title: `Test ${n}`,
    counterintuition,
    hook: "",
    keyTakeaway: "",
    tryThisNow: "",
    breakdown: { fastRead: "", deepRead: "", fullRead: "" },
    examples: [],
    quiz: { questions: [] },
    reviewCards: [],
    implementationPlan: { coreSkill: "", ifThenPlans: [], twentyFourHourChallenge: "", weeklyPractice: "" },
    memorableLines: [],
  } as any;
}

// B11 positive: 6 of 10 chapters use negation-correction shell.
const b11Positive = [
  makeChapter(1, "The trap is not admitting how bad it was. The trap is letting fear write the next move."),
  makeChapter(2, "The mirror is not there to make you feel better. It is there to test what you avoid."),
  makeChapter(3, "Comfort is not the enemy. The enemy is the story you tell yourself about comfort."),
  makeChapter(4, "Suffering does not build character automatically. Character comes from the choice you make inside it."),
  makeChapter(5, "Excuses do not protect you. They keep you in the same room you have been trying to leave."),
  makeChapter(6, "Effort is not the metric. The metric is who you become while making the effort."),
  makeChapter(7, "Despite what runners say about pain, the body keeps a budget the mind can borrow against."),
  makeChapter(8, "What looks like grit is often a stable routine that has stopped asking your permission."),
  makeChapter(9, "The opposite of comfort is real. It is the willingness to be uncertain on purpose."),
  makeChapter(10, "Sounds like discipline, but in fact the daily work is mostly noticing the small refusals."),
];

const b11Report = runBookPatternAudit({ bookId: "test-b11", chapters: b11Positive, requirePlanArtifacts: false, checkSourceAlignment: false });
const b11Findings = b11Report.findings.filter((f) => f.code === "B11");
console.log("B11 positive test (6/10):", b11Findings.length > 0 ? "PASS" : "FAIL");
if (b11Findings.length > 0) console.log("  msg:", b11Findings[0].message);

// B11 negative: 3 of 10 → should not fire.
const b11Negative = [
  makeChapter(1, "The trap is not admitting how bad it was. The trap is letting fear write the next move."),
  makeChapter(2, "The mirror is not there to make you feel better. It is there to test what you avoid."),
  makeChapter(3, "Comfort is not the enemy. The enemy is the story you tell yourself about comfort."),
  makeChapter(4, "Despite what runners say, the body keeps a budget."),
  makeChapter(5, "Sequence sounds like a soft virtue. In fact it is the only setting that controls the morning."),
  makeChapter(6, "What looks like productivity is often visible motion the day forgets by Friday."),
  makeChapter(7, "Speed gets the credit. Counterintuitively, sequence is doing the work."),
  makeChapter(8, "Frame control feels like louder confidence. The opposite is closer to true."),
  makeChapter(9, "The real lever sits beneath the loudest task and decides what the next person owes."),
  makeChapter(10, "Routine sounds like a brake. In fact, routine is the only thing that keeps narrowing alive."),
];
const b11NegReport = runBookPatternAudit({ bookId: "test-b11-neg", chapters: b11Negative, requirePlanArtifacts: false, checkSourceAlignment: false });
const b11NegFindings = b11NegReport.findings.filter((f) => f.code === "B11");
console.log("B11 negative test (3/10):", b11NegFindings.length === 0 ? "PASS" : "FAIL");

// B12 positive: 5 of 8 use "In fact" in a small book (cap=2).
const b12Positive = [
  makeChapter(1, "Sequence sounds like a virtue. In fact it is the only setting that controls a crowded morning."),
  makeChapter(2, "Routine looks like a brake. In fact, routine keeps narrowing alive when urgency tries to choose."),
  makeChapter(3, "Charm sounds easy. In fact, charm is steadier when pressure tries to pull you out of sequence."),
  makeChapter(4, "Sellers reach for unavailability. In fact, rooms respond to specific fit when standards are real."),
  makeChapter(5, "The hookpoint sounds clever. In fact, it gains force only after setup and consequence do their work."),
  makeChapter(6, "Frame control feels confident; the opposite is closer to true."),
  makeChapter(7, "Speed gets the credit. Counterintuitively, sequence is doing the work."),
  makeChapter(8, "What looks like calm is preparation in disguise."),
];
const b12Report = runBookPatternAudit({ bookId: "test-b12", chapters: b12Positive, requirePlanArtifacts: false, checkSourceAlignment: false });
const b12Findings = b12Report.findings.filter((f) => f.code === "B12");
console.log("B12 positive test (5x 'In fact', cap 2):", b12Findings.length > 0 ? "PASS" : "FAIL");
for (const f of b12Findings) console.log("  →", f.message);
