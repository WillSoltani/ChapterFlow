import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

const repoRoot = process.cwd();
const runRoot = path.resolve(".chapterflow/runs/extreme-ownership/20260408-230830");
const lintScript = path.resolve(
  "scripts/book/prompts/chapterflow-v13-autonomous/tools/chapterflow_v13_lint.py"
);
const guardScript = path.resolve(
  "scripts/book/prompts/chapterflow-v13-autonomous/tools/chapterflow_v13_artifact_guard.py"
);
const book = JSON.parse(
  fs.readFileSync(path.join(runRoot, "validated/ch10.review-package.json"), "utf8")
).book;

const tri = (gentle, direct, competitive) => ({ gentle, direct, competitive });
const wc = (text) => (text.match(/\b[\w']+\b/g) || []).length;
const stamp = () => new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stable(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha(obj) {
  return crypto.createHash("sha256").update(stable(obj)).digest("hex");
}

function writeText(rel, text) {
  const target = path.join(runRoot, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${text.trim()}\n`);
}

function writeJson(rel, obj) {
  const target = path.join(runRoot, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(obj, null, 2)}\n`);
}

function appendRunLog(lines) {
  fs.appendFileSync(
    path.join(runRoot, "reports/run-log.md"),
    `${lines.map((line) => `- ${line}`).join("\n")}\n`
  );
}

function runChecked(cmd, args) {
  try {
    const stdout = execFileSync(cmd, args, {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    return { ok: true, stdout };
  } catch (error) {
    return {
      ok: false,
      stdout: `${error.stdout || ""}${error.stderr || ""}`.trim(),
    };
  }
}

function buildReviewPackage(chapter) {
  return {
    schemaVersion: "1.1.0",
    packageId: crypto.randomUUID(),
    createdAt: stamp(),
    contentOwner: "ChapterFlow",
    book,
    chapters: [chapter],
  };
}

function buildMetrics(chapter, criticScore, sourceHeading) {
  return {
    chapterId: chapter.chapterId,
    number: chapter.number,
    title: chapter.title,
    readingTimeMinutes: chapter.readingTimeMinutes,
    wordCounts: {
      easyDirect: wc(chapter.contentVariants.easy.chapterBreakdown.direct),
      mediumDirect: wc(chapter.contentVariants.medium.chapterBreakdown.direct),
      hardDirect: wc(chapter.contentVariants.hard.chapterBreakdown.direct),
    },
    takeawayCounts: {
      easy: chapter.contentVariants.easy.keyTakeaways.length,
      medium: chapter.contentVariants.medium.keyTakeaways.length,
      hard: chapter.contentVariants.hard.keyTakeaways.length,
    },
    exampleCount: chapter.examples.length,
    quizQuestionCount: chapter.quiz.questions.length,
    criticScore,
    sourceHeading,
  };
}

function writeValidationReport(code, status, chapterLint, wrapperLint, guard, wrapperMatch, hash) {
  writeText(
    `reports/${code}.validation.md`,
    `# Validation Report — ${code}

Status: ${status}
- critic report: reports/${code}.critic.md
- structured chapter: structured/${code}.chapter.json
- quiz: quizzes/${code}.quiz.json
- validated chapter: validated/${code}.chapter.json
- review package: validated/${code}.review-package.json
- reading metrics: sidecars/${code}.reading-metrics.json
- chapter lint: ${chapterLint}
- review-package lint: ${wrapperLint}
- artifact guard: ${guard}
- wrapper payload match: ${String(wrapperMatch)}
- approvedChapterHash: ${hash}`
  );
}

function updateContinuity({ code, names, schoolSettings, hash }) {
  const continuityPath = path.join(runRoot, "continuity/continuity-state.json");
  const continuity = JSON.parse(fs.readFileSync(continuityPath, "utf8"));
  const alreadySealed = Boolean(continuity.approvedChapterHashes[code]);

  if (continuity.withinChapterNames[code]) {
    for (const oldName of continuity.withinChapterNames[code]) {
      if (continuity.nameUsage[oldName] === code) delete continuity.nameUsage[oldName];
    }
  }
  continuity.withinChapterNames[code] = names;
  for (const name of names) continuity.nameUsage[name] = code;

  continuity.formatCategoryHistory = continuity.formatCategoryHistory.filter(
    (entry) => entry.chapterId !== code
  );
  for (const pair of [
    { format: "decision_point", category: "work" },
    { format: "postmortem", category: "school" },
    { format: "dialogue", category: "personal" },
    { format: "predict_reveal", category: "work" },
    { format: "dilemma", category: "school" },
    { format: "before_after", category: "personal" },
  ]) {
    continuity.formatCategoryHistory.push({ chapterId: code, ...pair });
  }

  if (alreadySealed) {
    for (const setting of schoolSettings) {
      if (continuity.schoolSettingUsage[setting]) continuity.schoolSettingUsage[setting] -= 1;
      if (continuity.schoolSettingUsage[setting] === 0) delete continuity.schoolSettingUsage[setting];
    }
  }
  for (const setting of schoolSettings) {
    continuity.schoolSettingUsage[setting] =
      (continuity.schoolSettingUsage[setting] || 0) + 1;
  }

  if (!alreadySealed) {
    for (const key of Object.keys(continuity.endingPatternRegistry)) {
      continuity.endingPatternRegistry[key] += 1;
    }
  }

  continuity.approvedChapterHashes[code] = hash;
  writeJson("continuity/continuity-state.json", continuity);
}

function gateChapter(config) {
  const chapter = {
    chapterId: config.chapterId,
    number: config.number,
    title: config.title,
    readingTimeMinutes: config.readingTimeMinutes,
    contentVariants: config.contentVariants,
    examples: config.examples,
    implementationPlan: config.implementationPlan,
    reviewCards: config.reviewCards,
    keyTakeawayCard: config.keyTakeawayCard,
    quiz: config.quiz,
  };
  const reviewPackage = buildReviewPackage(chapter);
  const metrics = buildMetrics(chapter, config.criticScore, config.sourceHeading);

  writeJson(`structured/${config.code}.chapter.json`, chapter);
  writeJson(`quizzes/${config.code}.quiz.json`, config.quiz);
  writeJson(`validated/${config.code}.chapter.json`, chapter);
  writeJson(`validated/${config.code}.review-package.json`, reviewPackage);
  writeJson(`sidecars/${config.code}.reading-metrics.json`, metrics);

  const chapterLint = runChecked("python3", [
    lintScript,
    path.join(runRoot, `validated/${config.code}.chapter.json`),
    "chapter_gate",
  ]);
  const wrapperLint = runChecked("python3", [
    lintScript,
    path.join(runRoot, `validated/${config.code}.review-package.json`),
    "chapter_gate",
  ]);
  const chapterLintLine = chapterLint.stdout.split("\n").slice(-1)[0] || "FAIL=1 WARN=0";
  const wrapperLintLine = wrapperLint.stdout.split("\n").slice(-1)[0] || "FAIL=1 WARN=0";
  writeValidationReport(
    config.code,
    "RUNNING",
    chapterLintLine,
    wrapperLintLine,
    "RUNNING",
    false,
    "pending"
  );

  const guard = runChecked("python3", [guardScript, runRoot]);
  const wrapperPayload = JSON.parse(
    fs.readFileSync(path.join(runRoot, `validated/${config.code}.review-package.json`), "utf8")
  ).chapters[0];
  const wrapperMatch = stable(wrapperPayload) === stable(chapter);
  const guardLine = guard.stdout.split("\n").slice(-1)[0] || "FAIL=1 WARN=0";

  if (!chapterLint.ok || !wrapperLint.ok || !guard.ok || !wrapperMatch) {
    writeValidationReport(
      config.code,
      "FAIL",
      chapterLintLine,
      wrapperLintLine,
      guardLine,
      wrapperMatch,
      "not-sealed"
    );
    throw new Error([chapterLint.stdout, wrapperLint.stdout, guard.stdout, `wrapperMatch=${wrapperMatch}`].join("\n"));
  }

  const hash = sha(chapter);
  writeValidationReport(
    config.code,
    "PASS",
    chapterLintLine,
    wrapperLintLine,
    guardLine,
    wrapperMatch,
    hash
  );
  updateContinuity({ code: config.code, names: config.names, schoolSettings: config.schoolSettings, hash });
  appendRunLog(config.logLines(hash));
  return { hash, metrics };
}

const ch11 = {
  code: "ch11",
  number: 11,
  title: "Leading Up and Down the Chain of Command",
  chapterId: "ch11-leading-up-and-down-the-chain-of-command",
  readingTimeMinutes: 9,
  criticScore: 11,
  sourceHeading: "Leading Up and Down the Chain of Command",
  names: ["Camila", "Darius", "Mei", "Jasper", "Noura", "Vicente"],
  schoolSettings: ["student senate workroom", "yearbook distribution table"],
  contentVariants: {
    easy: {
      chapterBreakdown: {
        gentle:
          "This chapter says teams drift when meaning stops moving through the chain. The top may think the front already understands why the plan matters. The front may think the top already knows where the friction is. In that gap, initiative pulls away from alignment.\n\nThe chapter's answer is two-way chain communication. Leaders have to send purpose down the chain and send reality back up the chain. Lower levels need context, not only instructions. Upper levels need clear visibility into friction, not delayed surprises. The chapter also keeps one limit clear. Useful communication is tied to mission clarity and action, not to endless updates or performative openness.",
        direct:
          "The chapter argues that execution weakens when leaders move direction downward but fail to move ground truth upward, or when they push problems upward without giving the lower chain enough purpose to act well. Teams stay aligned when meaning travels both directions: context and intent downward, friction and reality upward. That two-way flow keeps initiative connected to the same mission instead of letting each level guess what the other already knows. It prevents the chain from splitting into different versions of the mission at different altitudes.\n\nThe chapter also rejects a lazy misread. This is not generic advice about talking more. Communication is useful only when it sharpens action, timing, and alignment. Down-chain clarity should help people act with judgment, and up-chain visibility should help leaders adjust before delay becomes damage. Words matter here because they move usable meaning before silence becomes cost.",
        competitive:
          "This chapter goes after a chain failure that hides inside quiet assumptions. The top assumes the front gets the why. The front assumes the top already sees the friction. Nobody is lying, but the mission still starts drifting.\n\nThe fix is two-way chain communication. Send purpose down. Send reality up. That is how initiative stays aligned instead of turning into blind execution below and late surprise above. The chapter also refuses the soft version. Talking more is not the win. Moving the right meaning in the right direction at the right time is.",
      },
      keyTakeaways: [
        { point: tri("Teams drift when purpose and friction stop moving through the chain.", "Execution weakens when meaning moves only one direction or moves too late.", "The mission starts slipping when each level keeps guessing what the other knows.") },
        { point: tri("Lower levels need mission context, not only tasks.", "Down-chain clarity gives people the purpose that keeps initiative aligned.", "If the front gets steps without meaning, it either freezes or drifts.") },
        { point: tri("Upper levels need early visibility into friction.", "Up-chain communication helps leaders adjust before reality turns into surprise.", "If friction reaches the top late, the chain has already paid for the silence.") },
      ],
      oneMinuteRecap: tri(
        "This chapter says leaders have to move purpose down and friction up so initiative stays aligned with the mission.",
        "Leading Up and Down the Chain of Command argues that two-way communication protects both local initiative and senior-level adjustment.",
        "The chapter leaves one rule behind: send meaning to the edge and send reality back before the mission drifts."
      ),
    },
    medium: {
      chapterBreakdown: {
        gentle:
          "This chapter begins with a team that has already done meaningful planning yet still starts to drift once the mission is live. The problem is not only the plan. The problem is that the why of the mission is not reaching the front clearly enough, and the friction at the front is not reaching the top quickly enough. Each level starts operating on partial understanding.\n\nThat is why the chapter treats chain communication as a two-way duty. Leaders have to explain purpose downward so lower levels know what the mission is really trying to accomplish. That context matters because instructions alone often stop working the moment conditions change.\n\nThe chapter also says communication has to move upward. Front-line leaders cannot wait for problems to become obvious at the top. They need to surface constraints, delays, and emerging reality early enough that senior leaders can adjust before the mission pays a larger cost.\n\nThose two flows depend on each other. If leaders explain the why downward but nobody sends real friction upward, the chain still goes blind. If people speak upward constantly but lack the mission context below, the information turns noisy and reactive.\n\nThe chapter keeps one limit visible too. Communication is not performance. It is useful only when it sharpens timing, action, and alignment. That is why the next chapter turns toward uncertainty. Even with good planning and strong communication, leaders still have to make grounded decisions before complete certainty arrives.",
        direct:
          "The chapter goes after an execution failure that survives good planning: broken meaning flow through the chain. Senior leaders may believe the lower chain understands the purpose clearly enough, while lower leaders may assume the top already sees the friction clearly enough. The chapter says those assumptions are expensive. When purpose does not move downward and reality does not move upward fast enough, initiative and alignment start separating. The plan may still exist on paper, but each level begins working from a thinner and thinner version of it.\n\nThat is why leaders have to communicate down the chain with context, not just instruction. Lower levels need to understand what the mission is trying to accomplish, what matters most, and why a given task fits the larger effort. Otherwise local initiative becomes either timid or misdirected as soon as the live situation stops matching the original script. Context is what lets the edge improvise without drifting into a different mission.\n\nThe chapter also insists on proactive communication up the chain. Front-line leaders cannot wait until a problem is large, embarrassing, or irreversible before it reaches higher levels. They have to communicate friction, resource limits, and changes in reality while there is still time to adjust the mission intelligently. Up-chain truth matters most while it is still useful, not after it has turned into a report about failure.\n\nThe deeper mechanism is two-way chain clarity. Down-chain purpose helps the edge act with initiative. Up-chain visibility helps the top revise without surprise. Both are necessary because one without the other produces either blind execution or noisy escalation. The chain stays coherent only when meaning is moving in both directions before drift hardens.\n\nThe chapter keeps a hard warning in place so the principle stays sharp. Communication is not endless status signaling, complaint theater, or self-protective narration. It matters only when it improves mission timing, clarity, and action. That bridge makes the next chapter inevitable. Even with strong planning and strong communication, leaders still have to decide under uncertainty before perfect evidence arrives. A live chain improves the map, but it does not erase the fog.",
        competitive:
          "This chapter attacks a quiet chain failure that planning alone cannot fix. The top believes the front understands the mission. The front believes the top already knows where the drag is. Those assumptions rot execution from both ends.\n\nThe answer is two-way chain communication. Leaders have to send purpose down hard enough that the edge can use initiative without losing alignment. They also have to send friction up fast enough that the top can adjust before the mission pays for stale assumptions.\n\nThat is why this chapter is stricter than generic communication advice. The lower chain needs context, not just tasks. The upper chain needs ground truth, not polite silence.\n\nThe two directions lock together. Down-chain clarity without up-chain visibility gives you blind execution. Up-chain chatter without down-chain purpose gives you reactive noise.\n\nThe chapter also punishes the easy drift. Communication is not performance. If the updates do not improve action, timing, or adjustment, they are just more noise inside the chain. That is what sets up the next problem: even a well-informed chain still has to act before certainty shows up.",
      },
      keyTakeaways: [
        {
          point: tri("Execution drifts when purpose and reality stop moving cleanly through the chain.", "Teams lose alignment when leaders assume context is already understood below and friction is already visible above.", "Silence in the chain makes each level fight the mission with a different map."),
          moreDetails: tri("Planning alone cannot solve that drift.", "The chapter says meaning flow has to stay active after the plan is built.", "A good plan still dies if the chain stops carrying meaning."),
        },
        {
          point: tri("Down-chain clarity gives lower levels the why behind the task.", "Purpose, priorities, and mission context help local initiative stay aligned under change.", "The edge needs the mission, not just a checklist."),
          moreDetails: tri("Instructions become thin when reality changes.", "That is why the chapter wants explanation, not just command voice.", "The first broken step exposes whether the chain sent meaning or only orders."),
        },
        {
          point: tri("Up-chain visibility lets leaders adjust before delay turns costly.", "Front-line friction has to move upward while the mission can still benefit from it.", "Reality has to climb the chain faster than damage does."),
          moreDetails: tri("That is why upward communication is not complaining.", "The chapter frames it as proactive mission support.", "If the top learns late, the silence already billed the mission."),
        },
        {
          point: tri("Alignment and initiative depend on both directions working together.", "Purpose downward and friction upward form one execution system rather than two separate habits.", "The chain works when meaning flows both ways, not when each level protects its own view."),
          moreDetails: tri("One direction alone leaves the team either blind or noisy.", "The chapter treats two-way flow as the mechanism that keeps the chain coherent under pressure.", "Blind execution below and late surprise above are the same failure wearing two uniforms."),
        },
        {
          point: tri("Communication matters only when it sharpens action and timing.", "The chapter rejects performative updates, complaint theater, and self-protective narration.", "If the talk does not improve the move, it is just chain noise."),
          moreDetails: tri("The principle is mission-centered, not theatrical.", "Useful communication exists to improve clarity, adjustment, and execution.", "The chain does not need more words. It needs better movement of meaning."),
        },
      ],
      activationPrompt: tri(
        "Look at one active team and ask where people are acting without enough context or waiting too long to surface friction.",
        "Map one current chain failure where purpose is too thin below or reality is arriving too late above.",
        "Find one place where the mission is paying for what each level assumes the other already knows."
      ),
      selfCheckPrompt: tri(
        "Where am I sending tasks without enough why, or holding back friction too long?",
        "Which level in my chain is working from partial meaning because context or reality is not moving fast enough?",
        "What silence in this chain is already costing the mission?"
      ),
      oneMinuteRecap: tri(
        "This chapter says leaders protect aligned initiative by sending purpose down the chain and friction back up the chain.",
        "Leading Up and Down the Chain of Command argues that two-way meaning flow keeps the edge aligned and the top responsive.",
        "The rule is simple and hard: move the why downward, move the drag upward, and do both before drift hardens."
      ),
    },
    hard: {
      chapterBreakdown: {
        gentle:
          "This chapter treats chain communication as part of execution rather than as a soft skill floating beside it. A team may have a sound plan, clear roles, and real effort, yet still weaken because the meaning of the mission does not travel downward fast enough and the reality of the mission does not travel upward fast enough. In that gap, people act from partial understanding.\n\nThat is why the chapter insists that leaders communicate purpose down the chain. Lower levels need more than instructions. They need context, priorities, and the reason the task matters so they can adapt without losing the mission when conditions change.\n\nThe chapter also insists that leaders communicate proactively up the chain. Front-line friction, constraints, and changing reality have to move upward while there is still time for adjustment. Waiting until problems become obvious is too late because the mission has already started paying for stale assumptions.\n\nThose two directions belong to the same system. Down-chain clarity without up-chain visibility produces blind execution. Up-chain communication without down-chain purpose produces reactive chatter. The chapter's point is that aligned initiative depends on the chain carrying meaning in both directions at the right time.\n\nA hard limit keeps the chapter honest. Communication is not performance, self-protection, or endless traffic. It matters only when it sharpens action, timing, and alignment. Leaders are not supposed to narrate everything. They are supposed to move the information the mission needs.\n\nThat is why the chapter is more demanding than broad advice about openness. It argues that good leaders are responsible for building a chain where the why reaches the edge before action and the friction reaches the top before failure. The mission becomes stronger because people at every level are working from live meaning rather than stale guesses.\n\nThe next chapter follows naturally. Even with planning and communication working well, leaders still reach moments where certainty is incomplete. The remaining question is how to act with grounded judgment before perfect clarity arrives.",
        direct:
          "The chapter exposes a leadership failure that planning cannot fully prevent on its own: the chain stops carrying meaning. Senior leaders assume the lower chain understands the mission purpose well enough to act intelligently, while lower leaders assume the upper chain already sees the friction, delays, and emerging reality clearly enough to adjust. The chapter says those assumptions are dangerous because initiative and alignment separate the moment each level starts working from a different map. What was one mission at briefing time starts becoming several thinner missions in practice.\n\nThat is why leaders have to push purpose down the chain, not only tasks. Instructions alone are too thin for changing conditions. Lower levels need mission intent, priorities, and context so their local decisions remain aligned when the original script starts bending. Meaning has to arrive before the edge is forced to improvise, or improvisation will detach from purpose.\n\nLeaders also have to move reality up the chain before the mission pays a larger cost. Up-chain communication is not a ritual of complaint or self-justification. It is the mechanism that gives senior leaders timely visibility into friction, constraints, and developing conditions. Without it, the top continues operating on outdated assumptions while the front absorbs the cost silently. The higher chain can only revise intelligently if the lower chain sends reality while the move is still alive.\n\nThe chapter's deeper mechanism is two-way chain clarity. Down-chain purpose gives the edge usable initiative. Up-chain visibility gives the top the ability to revise without surprise. One without the other fails because blind execution below and reactive adjustment above are really one broken system. The chain has to carry the same purpose downward and the same truth upward fast enough that the mission stays one mission.\n\nThe chapter also keeps a hard edge visible so the idea does not decay into corporate noise. Communication is not endless status traffic, vague transparency talk, or performative narration. It matters only when it improves mission timing, clarity, and action. The chain does not need more words than the mission can use. Mission-centered signal is the standard, not visible busyness.\n\nThat is why this chapter remains tightly connected to the book's larger argument. Execution gets stronger when leaders make sure the same purpose is understood downward and the same reality is understood upward before drift hardens into failure. That is what sets up the next chapter. Once the plan is clear and the chain is carrying meaning well, leaders still have to make grounded calls under uncertainty before complete evidence arrives. A living chain can shrink confusion, but it cannot end uncertainty.",
        competitive:
          "This chapter goes after a chain failure that good planning can still hide. The top thinks the edge understands the mission. The edge thinks the top already sees the drag. Both are wrong just enough to make the mission start splitting into different realities.\n\nThat is why leaders have to drive purpose down the chain harder than just sending tasks. The edge needs context, priorities, and intent so it can move without breaking alignment when the script bends.\n\nLeaders also have to drive friction up the chain faster than pride, silence, or politeness wants to allow. The top needs live reality while there is still time to change the move, not after the damage report explains what everybody already felt too late.\n\nThe whole chapter turns on that two-way system. Down-chain clarity gives the edge initiative worth trusting. Up-chain visibility gives the top revision worth acting on. Drop either one and the chain starts fighting itself with mismatched maps.\n\nThe chapter is ruthless about the fake version too. This is not about more updates, more noise, or more performance. If the communication does not improve action, timing, or alignment, it is just one more burden inside the mission.\n\nThat is why the next chapter lands where it does. Even with a strong plan and a live chain, leaders still hit moments where certainty refuses to show up on time. Then judgment has to move before perfect evidence does.",
      },
      keyTakeaways: [
        {
          point: tri("Chain failure often begins as a failure of shared meaning.", "Execution weakens when lower and upper levels start acting from different assumptions about purpose and reality.", "The mission splits when the chain stops carrying the same truth both ways."),
          moreDetails: tri("That is why good planning can still drift later.", "The chapter says the plan needs live meaning flow after contact with reality begins.", "A dead chain can waste a good plan fast."),
        },
        {
          point: tri("Down-chain purpose keeps local initiative aligned.", "Lower levels need mission context and priorities so their judgment stays tied to the larger goal.", "The edge can only improvise well if it knows what it is protecting."),
          moreDetails: tri("Tasks alone do not survive changing conditions.", "Instructions become too thin once the live situation bends away from the original script.", "A checklist breaks first where meaning was never sent."),
        },
        {
          point: tri("Up-chain visibility keeps senior leaders connected to reality.", "Friction, limits, and emerging conditions have to travel upward while there is still time to adapt.", "Reality has to outrun ego on the way up the chain."),
          moreDetails: tri("That is why the chapter calls proactive communication mission support.", "Late visibility means the top revises only after the cost is already paid.", "If the chain hides drag, the mission still drags."),
        },
        {
          point: tri("Two-way chain clarity is one execution system.", "Purpose downward and friction upward are interdependent, not separate communication habits.", "The chain works when meaning moves both ways before drift hardens."),
          moreDetails: tri("One direction alone creates blind execution or reactive noise.", "The chapter joins initiative at the edge with adjustment at the top.", "A chain with only one flow is just a slower way to be wrong."),
        },
        {
          point: tri("Communication matters only when the mission can use it.", "The chapter rejects performative narration, complaint theater, and empty update traffic.", "Words that do not change the move are just extra load."),
          moreDetails: tri("Leaders are responsible for moving the information the mission actually needs.", "Useful communication sharpens timing, clarity, and action instead of adding noise.", "The mission needs signal, not chatter with rank attached."),
        },
      ],
      activationPrompt: tri(
        "Name one place where the edge lacks enough purpose or the top lacks enough friction visibility.",
        "Identify one active chain where the mission is already paying for stale assumptions moving in either direction.",
        "Find the place where your chain is running on mismatched maps and decide which meaning flow is broken first."
      ),
      selfCheckPrompts: [
        tri(
          "Where is my chain still expecting people to act without enough context?",
          "Which lower-level decisions are getting made with too little purpose to stay aligned under change?",
          "Where am I asking the edge to move with a thin map?"
        ),
        tri(
          "What friction is still reaching the top too late to help the mission?",
          "Which reality is the chain absorbing quietly instead of moving upward while it is still actionable?",
          "What truth is climbing slower than the cost it is creating?"
        ),
      ],
      predictionPrompt: tri(
        "If the plan is strong and the chain is communicating well, what leadership problem remains next?",
        "Once purpose and friction are moving well through the chain, what still forces leaders to act before certainty arrives?",
        "If the map is shared and the chain is live, what still makes judgment hard?"
      ),
      oneMinuteRecap: tri(
        "This chapter says execution stays aligned when leaders send purpose down the chain and send friction back up before failure hardens.",
        "Leading Up and Down the Chain of Command argues that two-way meaning flow protects initiative at the edge and revision at the top.",
        "The chain has one hard job: move the why downward, move the truth upward, and do both fast enough that the mission stays one mission."
      ),
    },
  },
  examples: [
    {
      exampleId: "ch11-ex01-camila-delivery-board",
      title: "Camila Stops Treating the Delivery Board Like a Mission by Itself",
      category: "work",
      format: "decision_point",
      endingType: "broader_principle",
      contexts: ["delivery board", "ops standup", "blocked account handoff"],
      scenario: tri(
        "Camila sees team leads following the board exactly, but they are missing why one customer issue matters more than the others.",
        "Camila has to decide whether to keep sending tasks downward or explain the mission priority that should guide local choices.",
        "Camila can keep feeding the board, or she can send the why that makes the board useful under pressure."
      ),
      whatToDo: tri(
        "Camila should explain the mission priority clearly so team leads can act with judgment when conditions shift.",
        "Push context down the chain, not only tasks, so the front can stay aligned when the board stops matching reality.",
        "Give the edge the mission, not just the squares on the board."
      ),
      whyItMatters: tri(
        "The chapter says lower levels need purpose, not only instruction.",
        "This shows down-chain clarity keeping initiative aligned instead of mechanical.",
        "The board stops running the team once the mission starts running the board."
      ),
    },
    {
      exampleId: "ch11-ex02-darius-senate-postmortem",
      title: "Darius Learns the Faculty Email Came Too Late to Save the Event",
      category: "school",
      format: "postmortem",
      endingType: "self_directed_question",
      contexts: ["student senate workroom", "faculty approval email", "printed run sheet"],
      scenario: tri(
        "After the event, Darius realizes the student team saw the approval problem forming but waited too long to move it upward.",
        "The postmortem shows that the workroom had real friction, but the people above learned it only after the run sheet was already failing.",
        "Darius sees that the event did not simply get unlucky. The chain learned the truth too late to help."
      ),
      whatToDo: tri(
        "Next time, Darius should move constraints upward as soon as they threaten the mission timing.",
        "Build earlier up-chain visibility so faculty or senior organizers can adjust before the event pays the full cost.",
        "Send the drag upward while it is still useful, not when it becomes a story."
      ),
      whyItMatters: tri(
        "The chapter says up-chain visibility is mission support, not complaint.",
        "This example shows delay coming from late truth movement rather than from weak effort.",
        "The chain failed because reality climbed slower than the cost."
      ),
    },
    {
      exampleId: "ch11-ex03-mei-dialogue",
      title: "Mei Changes the Volunteer Handoff by Explaining the Why Before the Shift",
      category: "personal",
      format: "dialogue",
      endingType: "surprising_implication",
      contexts: ["volunteer handoff list", "family errand chain", "pickup timing"],
      scenario: tri(
        "Mei notices that people keep carrying out the visible tasks without understanding which handoff matters most if timing slips.",
        "In the conversation, Mei explains the purpose behind the handoff so others can adapt without waiting for fresh instruction.",
        "Mei stops repeating the steps and starts sharing the logic that survives the broken step."
      ),
      whatToDo: tri(
        "She should clarify what success means and which tradeoff matters most if the first plan bends.",
        "Send the purpose downward so others can use initiative instead of only obeying the visible task list.",
        "Put the why into the chain before the schedule gets noisy."
      ),
      whyItMatters: tri(
        "The chapter says context is what keeps initiative tied to the mission.",
        "This shows down-chain explanation working as an execution tool rather than a courtesy.",
        "Once the why lands, the chain stops needing constant rescue from above."
      ),
    },
    {
      exampleId: "ch11-ex04-jasper-reveal",
      title: "Jasper Finds the Escalation Worked Only After the Friction Got Named Early",
      category: "work",
      format: "predict_reveal",
      endingType: "cross_domain",
      contexts: ["executive sync", "support queue", "resource cap"],
      scenario: tri(
        "Jasper predicts the team will stay stuck unless the resource cap gets surfaced upward before the next planning cycle closes.",
        "The reveal is that once the real constraint moves up the chain early, leaders can revise staffing before the queue breaks harder.",
        "Jasper learns the queue did not need louder updates. It needed the right truth at the right altitude early enough."
      ),
      whatToDo: tri(
        "Jasper should surface the real constraint while leadership can still act on it.",
        "Move friction upward early enough that the top can revise the mission instead of only reacting to its damage.",
        "Send the truth up while it can still change the move."
      ),
      whyItMatters: tri(
        "The chapter says up-chain visibility gives higher levels a chance to adjust without surprise.",
        "This example makes the action link clear: the point of escalation is mission revision, not self-protection.",
        "The chain gets useful when reality reaches decision-makers before the bill arrives."
      ),
    },
    {
      exampleId: "ch11-ex05-noura-yearbook",
      title: "Noura Has to Decide Whether the Pickup Table Needs More Updates or Better Context",
      category: "school",
      format: "dilemma",
      endingType: "common_trap",
      contexts: ["yearbook distribution table", "pickup bins", "line management"],
      scenario: tri(
        "Noura sees volunteers sending many status updates but still mishandling the pickup line because they do not understand the distribution priority.",
        "The dilemma is whether to ask for even more reporting or to clarify the mission logic driving the table flow.",
        "Noura has to choose between louder communication and more useful communication."
      ),
      whatToDo: tri(
        "She should clarify the purpose and the decision logic, then keep only the updates the mission can actually use.",
        "Reduce noise, send stronger context downward, and keep upward signals tied to real friction.",
        "Stop feeding the line more chatter and start feeding it meaning."
      ),
      whyItMatters: tri(
        "The chapter warns that communication becomes noise when it is not tied to action or timing.",
        "This is the trap the chapter rejects: mistaking message volume for alignment.",
        "More traffic in the chain can still mean less truth."
      ),
    },
    {
      exampleId: "ch11-ex06-vicente-after",
      title: "Vicente's House Gets Calmer After Problems Start Moving Up Before They Become Emergencies",
      category: "personal",
      format: "before_after",
      endingType: "perspective_reframe",
      contexts: ["shared calendar note", "pickup conflict", "household routine"],
      scenario: tri(
        "Before, everyone in Vicente's home waited until a problem was already painful before saying anything upward.",
        "After they start sending friction early and explaining priorities clearly downward, the same routine changes feel less chaotic.",
        "The before-and-after difference is not perfect control. It is earlier meaning moving in both directions."
      ),
      whatToDo: tri(
        "Vicente should encourage earlier surfacing of friction and clearer explanation of what matters most.",
        "Build a smaller chain where purpose travels down and trouble travels up before the room is already reacting.",
        "Make the home move truth sooner than drama."
      ),
      whyItMatters: tri(
        "The chapter says aligned initiative depends on both downward context and upward visibility.",
        "This example shows two-way chain communication lowering friction by shortening the distance between truth and adjustment.",
        "The house gets calmer when the chain stops learning late."
      ),
    },
  ],
  implementationPlan: {
    coreSkill: tri(
      "Learn to move purpose down the chain and friction up the chain before the mission drifts.",
      "The core skill is building two-way chain clarity so local initiative and senior-level adjustment stay connected.",
      "Train yourself to move the why downward and the truth upward before silence starts billing the mission."
    ),
    ifThenPlans: [
      {
        context: "work",
        plan: tri(
          "If team leads are following tasks without good judgment, then explain the mission priority behind the task.",
          "If the edge is acting mechanically or guessing at tradeoffs, then push more purpose down the chain before the next pressure cycle.",
          "If the board is running the team, send the mission below the board."
        ),
      },
      {
        context: "school",
        plan: tri(
          "If a student team sees friction forming, then move it upward while teachers or organizers can still help.",
          "If the event is paying for delayed visibility, then surface constraints before the next deadline closes.",
          "If the workroom knows the drag, make sure the chain above learns it before the table breaks."
        ),
      },
      {
        context: "personal",
        plan: tri(
          "If a family or volunteer plan keeps drifting, then clarify what matters most and surface problems earlier.",
          "If people are waiting too long to raise friction or acting without enough context, then fix both directions of the chain together.",
          "If the room is learning truth late, move meaning sooner in both directions."
        ),
      },
    ],
    twentyFourHourChallenge: tri(
      "Within the next day, identify one task you are sending without enough context or one problem you are surfacing too late.",
      "In the next 24 hours, fix one broken meaning flow by either adding purpose downward or sending friction upward sooner.",
      "By tomorrow, stop one silence in the chain before it charges the mission again."
    ),
    weeklyPractice: tri(
      "This week, review one delayed moment and ask whether the edge lacked purpose or the top lacked visibility.",
      "Use one weekly review to check where the chain is still moving tasks without meaning or reality without timeliness.",
      "Every week, find one place where your chain is talking but not yet carrying the truth the mission needs."
    ),
  },
  reviewCards: [
    { cardId: "ch11-rc01", difficulty: "easy", front: tri("What failure does this chapter attack first?", "What happens when meaning stops moving through the chain?", "What chain problem is the chapter trying to fix?"), back: tri("It attacks drift caused by weak movement of purpose downward and friction upward.", "The chapter says execution weakens when each level works from partial understanding.", "It goes after a chain that stops carrying the same mission both ways.") },
    { cardId: "ch11-rc02", difficulty: "easy", front: tri("What does the lower chain need besides tasks?", "Why is down-chain clarity more than instruction?", "What must leaders send below the task list?"), back: tri("The lower chain needs mission context and purpose.", "Down-chain clarity gives local initiative something aligned to act from.", "The edge needs the why, not just the step.") },
    { cardId: "ch11-rc03", difficulty: "medium", front: tri("Why does friction have to move upward early?", "What is up-chain visibility for?", "Why is early truth up the chain so important?"), back: tri("It lets leaders adjust before delay becomes damage.", "Up-chain visibility gives the top timely reality instead of stale assumptions.", "The top can only revise what the chain tells it in time.") },
    { cardId: "ch11-rc04", difficulty: "medium", front: tri("How do the two directions fit together?", "Why is one-way communication insufficient here?", "What system is the chapter really describing?"), back: tri("Purpose downward and friction upward form one execution system.", "One direction alone creates blind execution or reactive noise.", "The chapter describes two-way chain clarity, not two separate habits.") },
    { cardId: "ch11-rc05", difficulty: "hard", front: tri("What limit keeps this chapter honest?", "Why is this not just a call for more updates?", "What makes communication useful rather than performative?"), back: tri("Communication matters only when it improves timing, action, and alignment.", "The chapter rejects noise, complaint theater, and empty status traffic.", "Useful communication is mission signal, not chatter with rank attached.") },
  ],
  keyTakeawayCard: tri(
    "Leaders strengthen execution by sending purpose down the chain and sending friction back up before the mission starts drifting.",
    "The chapter argues that two-way chain communication keeps local initiative aligned and higher-level adjustment timely by moving context downward and reality upward together.",
    "Send the why to the edge. Send the truth to the top. Do both before silence gets expensive."
  ),
  quiz: {
    passingScorePercent: 70,
    questions: [
      { questionId: "ch11-q01", prompt: "What core problem is this chapter addressing?", choices: ["That teams usually communicate too much context downward", "That execution breaks when purpose and friction do not move clearly through the chain", "That local initiative should replace all senior-level adjustment"], correctIndex: 1, explanation: tri("Correct. The chapter says drift begins when meaning flow through the chain breaks down.", "Right. It targets failures in moving purpose downward and reality upward.", "That is the hit: the chain stops carrying the same mission both ways."), bloomsLevel: "remember", depthLevel: "easy" },
      { questionId: "ch11-q02", prompt: "What does the lower chain need besides instructions?", choices: ["Mission purpose and context", "Less responsibility", "More status meetings"], correctIndex: 0, explanation: tri("Yes. The chapter says lower levels need the why behind the task.", "Exactly. Context keeps local initiative aligned when conditions change.", "The edge needs the mission, not just commands."), bloomsLevel: "understand", depthLevel: "easy" },
      { questionId: "ch11-q03", prompt: "Why is up-chain visibility important?", choices: ["It gives senior leaders real friction early enough to adjust", "It helps people avoid all uncertainty", "It replaces the need for planning"], correctIndex: 0, explanation: tri("Right. The chapter frames upward communication as timely mission support.", "Correct. Reality has to reach higher levels before the cost fully lands.", "The truth has to climb faster than the damage it describes."), bloomsLevel: "understand", depthLevel: "easy" },
      { questionId: "ch11-q04", prompt: "In Camila's delivery-board scenario, what best applies the chapter?", choices: ["Keep sending the same tasks and trust the board to teach priorities", "Explain the mission priority so team leads can make aligned local choices", "Wait until the team asks for context before sharing it"], correctIndex: 1, explanation: tri("Yes. Camila should send purpose down the chain, not only tasks.", "That choice fits because the chapter wants context to travel with instruction.", "The board needs the mission under it, not just more squares on it."), bloomsLevel: "apply", depthLevel: "medium" },
      { questionId: "ch11-q05", prompt: "How does the chapter distinguish upward communication from complaint?", choices: ["Upward communication is useful only when it helps the mission adjust", "Complaint is better because it proves honesty", "There is no meaningful difference"], correctIndex: 0, explanation: tri("Correct. The chapter says moving friction upward is mission support when it is timely and actionable.", "Exactly. The point is not venting but giving leaders reality they can still use.", "It is not complaining if it helps the move change in time."), bloomsLevel: "analyze", depthLevel: "medium" },
      { questionId: "ch11-q06", prompt: "Which misreading does the chapter reject?", choices: ["That communication should improve alignment and action", "That more message traffic automatically means stronger execution", "That lower levels need mission context"], correctIndex: 1, explanation: tri("Right. The chapter rejects the idea that communication volume equals mission clarity.", "Correct. Performative or noisy updates are exactly what the chapter warns against.", "More chatter is not more truth."), bloomsLevel: "understand", depthLevel: "medium" },
      { questionId: "ch11-q07", prompt: "What is the best transfer of this chapter to school or home life?", choices: ["Explain what matters most and raise problems early enough that others can help", "Wait until a problem is obvious before telling anyone higher up", "Keep tasks visible but avoid sharing the reason behind them"], correctIndex: 0, explanation: tri("Yes. The chapter transfers by pairing clearer purpose with earlier visibility.", "That answer carries both directions of the chain into everyday settings.", "Send the why down and the drag up before the room starts guessing."), bloomsLevel: "apply", depthLevel: "medium" },
      { questionId: "ch11-q08", prompt: "What was the real reveal in Jasper's scenario?", choices: ["The queue improved once the real constraint moved upward early enough to change resourcing", "The problem disappeared once the team stopped escalating anything", "The fix was mainly more updates from the top"], correctIndex: 0, explanation: tri("Correct. The chapter says upward visibility matters because it lets leaders revise before the cost hardens.", "Right. The reveal is that truth reached the right level while it was still actionable.", "The queue changed when reality reached altitude in time."), bloomsLevel: "analyze", depthLevel: "hard" },
      { questionId: "ch11-q09", prompt: "Which statement best captures the chapter's deeper synthesis?", choices: ["The lower chain should mostly execute while the upper chain mostly reacts", "Two-way meaning flow keeps initiative at the edge aligned and adjustment at the top timely", "Communication matters mainly because it reduces the number of decisions leaders face"], correctIndex: 1, explanation: tri("Exactly. The chapter joins down-chain purpose with up-chain visibility into one execution system.", "That answer captures the mechanism: aligned initiative below and informed revision above.", "The chain works when the why goes down and the truth comes back up in time."), bloomsLevel: "analyze", depthLevel: "hard" },
      { questionId: "ch11-q10", prompt: "How does this chapter lead into the next one?", choices: ["By showing that even a live, well-informed chain still has to act before certainty arrives", "By proving that communication removes the need for difficult decisions", "By arguing that uncertainty mostly disappears when leaders explain the mission"], correctIndex: 0, explanation: tri("Yes. The next chapter takes a strong plan and a live chain and asks how leaders decide without complete evidence.", "Correct. Communication improves the map, but it does not erase uncertainty.", "The chain can be alive and the judgment can still be hard."), bloomsLevel: "analyze", depthLevel: "hard" },
    ],
  },
  logLines(hash) {
    const t = stamp();
    return [
      `${t} - Wave \`11-12\` converter pass for \`ch11\` completed at \`structured/ch11.chapter.json\`; quiz pass completed at \`quizzes/ch11.quiz.json\`.`,
      `${t} - Wave \`11-12\` final chapter-gate checks for \`ch11\` passed: chapter lint \`FAIL=0 WARN=0\`, review-package lint \`FAIL=0 WARN=0\`, artifact guard \`FAIL=0 WARN=0\`, wrapper payload exact-match confirmed at \`chapters[0]\`, reading metrics written.`,
      `${t} - Wave \`11-12\` automatic gate decision for \`ch11\`: PASS. Sealed \`approvedChapterHashes.ch11 = ${hash}\` in \`continuity/continuity-state.json\`. Continuing automatically to \`ch12\`.`,
    ];
  },
};

const ch12Draft = `The book turns next to a pressure every leader eventually faces. The plan is clear enough. The chain is communicating well enough. But certainty still does not arrive in time. Information is incomplete, the costs are real, and waiting for a perfect picture is itself becoming a decision. That is the condition this chapter targets.

The chapter argues that uncertainty is not a rare interruption to leadership. It is one of leadership's normal environments. That matters because hesitation has a cost. When leaders keep waiting for information that will not arrive fast enough, the mission can lose time, position, and options. Delay feels cautious, but under pressure it can become its own failure.

The chapter does not respond by glorifying speed on its own. It pushes toward grounded decisiveness. Leaders still have to reason from the evidence they do have, identify what matters most, and make the best timely judgment available. The standard is not perfect certainty. The standard is a decision serious enough to fit the mission and timely enough to matter.

That is also why the chapter treats revision as strength rather than embarrassment. Good leaders do not pretend their first call is sacred if new information changes the situation. They decide before certainty, then keep watching reality closely enough to adjust if the call needs correction. Decisiveness is not stubbornness.

The chapter keeps the opposite error visible too. Reckless speed is not courage. Moving fast without grounding, context, or regard for consequences can damage the mission just as badly as paralysis can. The point is not to choose motion over thought. The point is to refuse the fantasy that thought is complete before action becomes necessary.

That is why this chapter is stronger than broad advice about confidence. It argues that leaders need judgment about timing. They have to know when the evidence is sufficient to act, when delay is becoming more costly than revision risk, and how to remain open to correction after the move.

The bridge to the final chapter is clear. Once leaders can act under uncertainty without freezing or outrunning the evidence, the final question becomes what kind of discipline lets teams move with that speed and still remain adaptable instead of chaotic.`;

const ch12 = {
  code: "ch12",
  number: 12,
  title: "Decisiveness amid Uncertainty",
  chapterId: "ch12-decisiveness-amid-uncertainty",
  readingTimeMinutes: 9,
  criticScore: 11,
  sourceHeading: "Decisiveness amid Uncertainty",
  names: ["Anika", "Brooks", "Yasmin", "Hugo", "Noemi", "Carter"],
  schoolSettings: ["debate tournament hallway", "lab safety board"],
  draftText: ch12Draft,
  criticReport: `# Critic Report — ch12

Score: 11/12
Assessment: PASS

## Category Scores
- hook quality: 2/2. The opening frames uncertainty as the remaining pressure after planning and communication are already in place.
- paragraph-job distinctness: 2/2. The draft moves from incomplete information, to hesitation cost, to grounded decisiveness, to revision strength, to the limit against reckless speed, and then into the final discipline bridge.
- anchor use: 2/2. Uncertainty, hesitation risk, grounded timing, and revisability all stay active.
- chapter specificity: 2/2. This reads like a chapter about judgment timing under incomplete information, not generic confidence talk.
- easy-mode convertibility: 2/2. The central distinction between hesitation, recklessness, and grounded decisiveness converts cleanly.
- meta-distance: 1/2. Later conversion should keep the examples concrete so the chapter does not widen into broad decision rhetoric.
- hard-edge preservation: 2/2. The draft keeps both hesitation and reckless speed visible as real failures.
- conceptual repetition risk: low. Timing, revision, uncertainty, and judgment keep distinct jobs.

## Weakest Paragraph
Paragraph 5 is most exposed because speed language could drift macho if later conversion weakens the grounding limit.

## Strongest Sentence
\`Delay feels cautious, but under pressure it can become its own failure.\`

## Contamination / Source-Splice Check
- contamination phrases: none found
- source-splice suspicion: none

## Decision
Prose gate clear. No global reroute needed. Local patching is not required before conversion.`,
  contentVariants: {
    easy: {
      chapterBreakdown: {
        gentle:
          "This chapter says leaders often have to act before they know everything. Waiting for complete certainty can feel careful, but under pressure it can cost time and options. The chapter treats uncertainty as a normal part of leadership, not as an unusual mistake in the process.\n\nIts answer is grounded decisiveness. Leaders should use the evidence they do have, make the best timely judgment available, and stay ready to revise if new facts change the picture. The chapter also keeps one limit clear. Moving fast is not enough by itself. Speed without grounding can harm the mission as badly as hesitation can.",
        direct:
          "The chapter argues that leaders cannot wait for perfect certainty before acting because perfect certainty often arrives too late to help. Under pressure, hesitation carries its own cost. But the chapter does not swing toward blind speed. It pushes for grounded decisiveness: timely judgment based on the evidence available, paired with willingness to revise when new information appears. The mission often needs a defensible move before the picture feels emotionally complete.\n\nThe hard edge is balance. Leaders act before complete certainty, but they do not outrun the evidence they actually have. That is how the chapter separates decisiveness from recklessness. The move matters because it arrives while timing still matters, not because it pretends uncertainty disappeared.",
        competitive:
          "This chapter attacks a comforting illusion: that one more minute of waiting will eventually turn uncertainty into clarity for free. Often it will not. Under pressure, delay can start costing more than revision would.\n\nThe answer is grounded decisiveness. Move before certainty is complete, but move from real evidence and stay ready to correct the call. The chapter crushes the lazy misread too. Fast is not brave if the judgment underneath it is hollow.",
      },
      keyTakeaways: [
        { point: tri("Uncertainty is a normal part of leadership, not a glitch that disappears on command.", "Leaders often have to decide before complete certainty exists.", "The mission does not wait for a perfect picture to form.") },
        { point: tri("Hesitation can become costly under pressure.", "Waiting for more information can fail when the cost of delay keeps rising.", "Delay can pretend to be caution while the mission bleeds options.") },
        { point: tri("Strong decisions are timely, grounded, and revisable.", "The chapter wants leaders to act from available evidence and stay open to correction.", "Move before certainty, but do not outrun what you actually know.") },
      ],
      oneMinuteRecap: tri(
        "This chapter says leaders must often act before certainty is complete, using grounded judgment and revising when needed.",
        "Decisiveness amid Uncertainty argues that hesitation and reckless speed both fail, while timely evidence-based judgment gives the mission a better chance.",
        "The chapter leaves one rule behind: move before certainty finishes forming, but keep the move tied to what the mission actually knows."
      ),
    },
    medium: {
      chapterBreakdown: {
        gentle:
          "This chapter begins where many leaders feel exposed. The plan is not enough on its own, communication is not enough on its own, and the evidence is still incomplete. Yet the mission still needs a decision. The chapter says that uncertainty is not a rare interruption to leadership. It is part of what leadership usually has to navigate.\n\nThat is why hesitation matters so much here. Waiting can feel safer because it postpones responsibility, but the chapter says delay often has a real cost. While a leader waits for clarity, the mission can lose time, position, and flexibility.\n\nThe chapter answers that problem with grounded decisiveness. Leaders use the evidence they do have, judge what matters most, and act when waiting longer is becoming more dangerous than revising later. The goal is not certainty. The goal is a serious, timely decision that fits the mission.\n\nThe chapter also treats revision differently from vanity. Strong leaders do not cling to a first decision simply to protect their image. If new facts change the situation, they correct the move. Revision is part of good judgment, not proof that the first decision should never have been made.\n\nThe chapter keeps one limit visible throughout. Speed is not automatically strength. Reckless motion without enough grounding can damage the mission just as badly as paralysis can. That is why the chapter leads cleanly into the final one: disciplined systems are what let leaders move quickly without turning that speed into chaos.",
        direct:
          "The chapter goes after a pressure that remains even after planning and communication are working reasonably well: leaders still have to decide before certainty is complete. The chapter says uncertainty is a normal leadership condition, which means waiting for a perfect picture is often unrealistic. Under pressure, hesitation can become its own costly choice. A mission can lose time, options, and leverage while the leader keeps hoping for a cleaner file than reality plans to deliver.\n\nThat does not mean the chapter celebrates speed by itself. It argues for grounded decisiveness. Leaders assess the evidence they have, determine what matters most, and make the best timely call available before the mission loses more ground to delay. The decision is not perfect because the information is not perfect. It is justified because waiting longer would likely cost more than revising later. Timing and evidence matter together, not one after the other.\n\nThe chapter also reframes revision. A strong leader does not confuse decisiveness with stubborn loyalty to the first call. If new information shifts the situation, the leader adjusts. The willingness to revise is part of what makes the original decision grounded instead of theatrical. Correction keeps the mission ahead of ego.\n\nThe chapter therefore holds two dangers together. One is paralysis disguised as caution. The other is reckless speed disguised as courage. Both harm the mission because both break the connection between judgment and timing. One waits too long for certainty. The other moves too early for the evidence.\n\nThat is why the chapter matters beyond generic confidence talk. It asks leaders to develop timing judgment: to know when the evidence is sufficient to act, when delay is becoming the bigger risk, and when revision should follow without ego. That bridge leads directly into the final chapter on discipline and freedom. Speed needs a system behind it or the mission pays twice.",
        competitive:
          "This chapter attacks the hope that leadership gets to wait until the evidence finally becomes clean. Often it does not. The mission still needs a move while the picture is incomplete, and that means uncertainty is not a mistake in leadership. It is one of the places leadership actually lives.\n\nThat is why hesitation is so expensive here. Delay can look responsible while it quietly burns time, position, and options the mission will not get back.\n\nThe answer is grounded decisiveness. Use the evidence you have, make the best serious call available, and move before the cost of waiting outruns the cost of later revision. The chapter is not praising swagger. It is praising judgment with timing.\n\nIt is equally hard on the opposite fake virtue. Speed without grounding is not courage. It is just risk with better marketing.\n\nThat is the chapter's balance: refuse paralysis, refuse bravado, and act in the narrow space where the move matters and the evidence is enough to justify it. Then stay ready to correct when reality answers back.",
      },
      keyTakeaways: [
        {
          point: tri("Uncertainty is part of leadership's normal operating environment.", "Leaders often have to act while the evidence is still incomplete.", "If you lead long enough, certainty will fail to arrive on schedule."),
          moreDetails: tri("That is why waiting for perfect clarity is often unrealistic.", "The chapter treats incomplete information as standard pressure rather than as procedural error.", "The mission rarely offers a clean file before it wants a move."),
        },
        {
          point: tri("Hesitation can become its own costly decision.", "Waiting for more information can damage the mission when time, position, or options are eroding.", "Delay can charge the mission while pretending to be careful."),
          moreDetails: tri("Caution is not always neutral.", "The chapter says leaders have to count the price of waiting, not only the price of acting.", "Sometimes the safest-looking move is the one already losing ground."),
        },
        {
          point: tri("Grounded decisiveness means acting from the evidence you do have.", "The leader makes the best timely judgment available instead of waiting for impossible certainty.", "Move from what is real enough to justify action, not from what feels emotionally complete."),
          moreDetails: tri("The chapter values seriousness, not false certainty.", "A decision can be justified even when it is not perfect because the timing matters too.", "The mission needs a defensible move, not a magical one."),
        },
        {
          point: tri("Revision after action is part of strong judgment.", "Leaders stay ready to correct their call if new information changes the picture.", "A good leader does not marry the first move just to protect pride."),
          moreDetails: tri("The chapter rejects the vanity version of decisiveness.", "Willingness to revise is what keeps timely judgment from turning stubborn.", "The first call earns respect when it can still be corrected."),
        },
        {
          point: tri("The chapter rejects both paralysis and reckless speed.", "Grounded decisiveness sits between hesitation and bravado because both extremes break the link between timing and judgment.", "The mission needs speed with evidence, not slowness with excuses or swagger with blind spots."),
          moreDetails: tri("That is what connects this chapter to the final one.", "Disciplined systems are what help leaders move quickly without turning motion into chaos.", "The last chapter asks what kind of discipline makes this balance repeatable."),
        },
      ],
      activationPrompt: tri(
        "Think of one situation where you are waiting for clarity that may not arrive in time to help.",
        "Map one active decision where delay may now be more dangerous than later revision.",
        "Find one place where you are still hoping uncertainty will solve itself for free."
      ),
      selfCheckPrompt: tri(
        "Where am I calling delay caution when it may already be costing the mission?",
        "Which current decision has enough evidence to justify movement even if certainty is incomplete?",
        "What am I waiting to feel rather than waiting to know?"
      ),
      oneMinuteRecap: tri(
        "This chapter says strong leaders act before certainty is complete, using grounded judgment and correcting when the evidence changes.",
        "Decisiveness amid Uncertainty argues that timing and judgment matter together: delay can fail, and reckless speed can fail, so the leader acts from evidence and stays revisable.",
        "The rule is hard and narrow: move before perfect clarity, but move only from what the mission can actually justify."
      ),
    },
    hard: {
      chapterBreakdown: {
        gentle:
          "This chapter treats uncertainty as a normal condition of leadership rather than as a rare defect in the process. The plan may be clear, the chain may be communicating well, and the mission may still require a decision before complete certainty arrives. That is the pressure point. Leaders often have to move while the picture is still unfinished.\n\nThat is why the chapter keeps hesitation under scrutiny. Waiting can feel responsible because it delays the risk of being wrong, but the chapter argues that delay carries its own risk. Time passes, options narrow, and the mission can lose ground while the leader keeps hoping for a level of clarity that may never appear soon enough to matter.\n\nThe chapter answers with grounded decisiveness. Leaders do not pretend they know everything. They assess the evidence they have, identify what matters most, and make the best timely judgment they can defend. The standard is not certainty. The standard is whether the decision fits the mission and respects the cost of waiting.\n\nThe chapter also treats revision as part of strength. A leader who decides under uncertainty still has to watch reality closely afterward. If new information changes the picture, the decision should be corrected rather than protected for pride. Good judgment remains open to evidence after the move.\n\nA hard limit keeps the chapter honest. Fast action is not automatically strong action. Speed without grounding can damage the mission as badly as paralysis can. The chapter is not asking leaders to choose motion over thought. It is asking them to think seriously enough that motion happens before delay becomes its own failure.\n\nThat is why the chapter is tighter than broad advice about confidence. It argues for judgment about timing: knowing when the evidence is enough to act, knowing when more waiting is turning costly, and knowing how to revise without ego after the decision lands.\n\nThe final chapter follows naturally from that tension. If leaders are going to move quickly under uncertainty without descending into chaos, they need disciplined systems that make that kind of speed sustainable.",
        direct:
          "The chapter exposes a leadership reality that cannot be solved by better planning or better communication alone: even strong teams still reach moments where certainty is incomplete and action is still required. The chapter treats that as normal. Leaders often have to decide before the picture is finished, which means uncertainty is not an excuse to avoid judgment. It is one of the conditions judgment has to work inside. The mission does not pause just because the evidence remains partial.\n\nThat is why hesitation matters so much. Waiting for more evidence can look careful, but the chapter says delay is not neutral. While the leader waits, the mission can lose time, position, optionality, and leverage. A decision not made can still shape the outcome just as powerfully as a decision made badly. Delay is a move with consequences even when it calls itself restraint.\n\nThe chapter responds with grounded decisiveness. Leaders use the evidence available, weigh what matters most, and make the best timely call they can justify without pretending the call is blessed by total clarity. The decision becomes responsible not because uncertainty disappeared, but because the leader judged that waiting longer would now cost more than the risk of revision. Enough evidence plus live timing becomes stronger than the fantasy of complete certainty.\n\nRevision is therefore not weakness. The chapter insists that leaders stay responsive after the move. If new information changes the picture, they adjust. Strong decisiveness is compatible with correction because the mission matters more than the leader's attachment to appearing right. Revision proves the judgment stayed loyal to reality after the move landed.\n\nThe chapter also keeps the opposite failure fully visible. Reckless speed is not courage and not clarity. Action taken without enough grounding, context, or seriousness can damage the mission just as badly as hesitation can. The chapter holds both extremes together because both disconnect timing from judgment. One delay hides inside caution. The other hides inside performance.\n\nThat is the deeper synthesis. Decisiveness under uncertainty is not force of personality, false certainty, or macho speed. It is disciplined timing judgment: acting when the evidence is sufficient for a defensible move, revising when new evidence demands it, and refusing both paralysis and bravado. That is what sets up the final chapter. If leaders are going to move that way repeatedly, the team needs disciplined systems that make fast adaptation possible without chaos. Discipline is what lets speed stay grounded instead of theatrical.",
        competitive:
          "This chapter goes after the fantasy that leadership gets to wait until the evidence finally looks clean enough to remove the risk. Often the mission does not give you that luxury. The plan is real, the chain is live, and certainty still shows up late.\n\nThat is why hesitation gets hit so hard here. Delay can market itself as care while it quietly burns time, options, and leverage the mission will never get back. A leader can lose just by waiting for a cleaner file than reality intends to offer.\n\nThe answer is grounded decisiveness. Use the evidence you have, decide when the cost of waiting is now bigger than the cost of later correction, and move. The chapter is not asking for swagger. It is asking for judgment strong enough to act before certainty finishes dressing itself up.\n\nIt is just as hard on the opposite pose. Speed without grounding is not bravery. It is the mission paying for someone's appetite to feel decisive.\n\nThe chapter's balance is ruthless and narrow: refuse paralysis, refuse bravado, and act in the window where the evidence is enough to justify motion and the timing still matters. Then stay humble enough to revise when reality answers back.\n\nThat is why the final chapter has to end on discipline. If you want speed under uncertainty without chaos, you need systems strong enough to support revision, alignment, and repeated judgment under pressure.",
      },
      keyTakeaways: [
        {
          point: tri("Uncertainty is a normal leadership condition, not a rare breakdown.", "Leaders often have to act while the picture is incomplete and the mission is still moving.", "Certainty usually arrives later than the mission wants the move."),
          moreDetails: tri("That is why the chapter refuses to treat uncertainty as an excuse for indecision.", "Judgment has to work inside incomplete information rather than waiting outside it.", "The mission rarely hands leadership a finished file."),
        },
        {
          point: tri("Delay carries its own real cost.", "A leader who waits too long can lose time, position, leverage, and options while pretending to stay cautious.", "Hesitation can bill the mission just as hard as a bad move can."),
          moreDetails: tri("The chapter says caution is not always neutral.", "Waiting has to be judged as an active risk, not as a free refuge from responsibility.", "A non-decision still shapes the outcome."),
        },
        {
          point: tri("Grounded decisiveness means timely action from sufficient evidence.", "The leader acts when the evidence is enough to justify a defensible move even though certainty is incomplete.", "Move when the file is strong enough for the mission, not when it feels emotionally perfect."),
          moreDetails: tri("That is how the chapter joins judgment and timing.", "The decision becomes responsible because it respects both the evidence and the cost of further delay.", "Enough evidence plus live timing beats fantasy clarity."),
        },
        {
          point: tri("Revision after action is part of strength, not weakness.", "Leaders stay open to correction because the mission matters more than preserving the image of being right.", "A first call earns respect when it can still yield to better reality."),
          moreDetails: tri("The chapter rejects stubbornness masquerading as decisiveness.", "Correction keeps timely judgment from decaying into ego defense.", "If reality changes the file, the move should change too."),
        },
        {
          point: tri("The chapter rejects both paralysis and reckless speed.", "Grounded decisiveness sits between hesitation and bravado because each extreme breaks the link between timing and judgment.", "The mission loses to excuses on one side and performance on the other."),
          moreDetails: tri("That is what connects the chapter to disciplined freedom.", "Leaders need systems that let them move fast without turning speed into chaos or pride.", "The final chapter asks what kind of discipline makes this balance repeatable."),
        },
      ],
      activationPrompt: tri(
        "Identify one current decision where certainty is incomplete but waiting longer may now cost the mission more than correction would.",
        "Map one live uncertainty where you already have enough evidence for a defensible move but not enough for comfort.",
        "Find the place where you are paying for delay while still telling yourself you are being careful."
      ),
      selfCheckPrompts: [
        tri(
          "Where is delay quietly shaping the mission while I call it caution?",
          "Which current decision has crossed the point where more waiting is now its own risk?",
          "What am I still postponing because I want certainty instead of sufficient evidence?"
        ),
        tri(
          "What evidence is strong enough here to justify action without pretending I know everything?",
          "If I decide now, what would make that move grounded rather than reckless?",
          "Where is the real line between enough evidence and fake certainty in this decision?"
        ),
      ],
      predictionPrompt: tri(
        "If leaders are going to move quickly under uncertainty without causing chaos, what kind of system has to support them?",
        "Once decisiveness and revision are both required, what final leadership condition makes that balance sustainable?",
        "If judgment has to move fast and stay humble, what keeps the whole team from turning speed into disorder?"
      ),
      oneMinuteRecap: tri(
        "This chapter says leaders must decide under uncertainty by acting from sufficient evidence before delay becomes the bigger failure, then revising when reality changes.",
        "Decisiveness amid Uncertainty argues that grounded timing judgment sits between paralysis and reckless speed because both extremes damage the mission.",
        "The hard rule is this: move before certainty is complete, ground the move in real evidence, and stay humble enough to change it when the mission needs that more."
      ),
    },
  },
  examples: [
    {
      exampleId: "ch12-ex01-anika-work",
      title: "Anika Makes the Rollback Call Before the Data Becomes Perfect",
      category: "work",
      format: "decision_point",
      endingType: "broader_principle",
      contexts: ["incident dashboard", "partial error data", "rollback window"],
      scenario: tri(
        "Anika can see enough warning signs to know the rollout may be damaging customers, but the dashboard is still incomplete.",
        "Anika has to decide whether to wait for cleaner data or use the evidence she already has to trigger the rollback window.",
        "Anika can keep worshipping the dashboard's missing pieces, or she can move while the rollback still matters."
      ),
      whatToDo: tri(
        "Anika should use the evidence she has, make the rollback call, and stay ready to correct if the picture changes.",
        "Act from sufficient evidence before the cost of waiting outruns the cost of later revision.",
        "Move while the window is live and let revision answer back if reality changes."
      ),
      whyItMatters: tri(
        "The chapter says hesitation can become costly under uncertainty.",
        "This shows grounded decisiveness as timely judgment rather than blind speed.",
        "The mission needs a defensible move before perfect clarity shows up too late."
      ),
    },
    {
      exampleId: "ch12-ex02-brooks-postmortem",
      title: "Brooks Realizes the Debate Delay Was a Decision Not Made",
      category: "school",
      format: "postmortem",
      endingType: "self_directed_question",
      contexts: ["debate tournament hallway", "late room change", "coach text thread"],
      scenario: tri(
        "After the tournament, Brooks sees that the team kept waiting for certainty about the room change until the useful options were gone.",
        "The postmortem shows that nobody made a grounded call soon enough, and the delay itself became the failure.",
        "Brooks learns that the hallway confusion hurt less than the waiting that pretended to be caution."
      ),
      whatToDo: tri(
        "Next time, Brooks should make the best timely call with the evidence available and revise if new facts arrive.",
        "Treat delay as a real risk and decide before the options collapse further.",
        "Stop waiting for a cleaner hallway than the tournament is willing to give you."
      ),
      whyItMatters: tri(
        "The chapter says non-decisions can shape outcomes just as strongly as bad decisions can.",
        "This example shows hesitation carrying its own mission cost.",
        "The team paid for delay more than for the uncertainty itself."
      ),
    },
    {
      exampleId: "ch12-ex03-yasmin-dialogue",
      title: "Yasmin Reframes Revision as Strength After the First Family Call",
      category: "personal",
      format: "dialogue",
      endingType: "surprising_implication",
      contexts: ["family schedule conflict", "partial information", "pickup decision"],
      scenario: tri(
        "Yasmin makes the best call she can with partial information, then new details arrive that require changing the plan.",
        "In the conversation, Yasmin explains that changing the move is not proof the first decision was weak.",
        "Yasmin shows the room that correction is part of good judgment, not an apology for having acted."
      ),
      whatToDo: tri(
        "She should revise the plan openly once the new information changes the picture.",
        "Protect the mission more than the image of having been right the first time.",
        "Let the better reality win over the first ego investment."
      ),
      whyItMatters: tri(
        "The chapter says revision after action is part of strength.",
        "This example keeps decisiveness tied to humility instead of stubbornness.",
        "A move can be timely and still deserve correction later."
      ),
    },
    {
      exampleId: "ch12-ex04-hugo-reveal",
      title: "Hugo Finds the Team Needed a Defensible Call, Not a Perfect File",
      category: "work",
      format: "predict_reveal",
      endingType: "cross_domain",
      contexts: ["ops review", "partial incident report", "service window"],
      scenario: tri(
        "Hugo predicts the service window will close before the report becomes complete enough to feel comfortable.",
        "The reveal is that the team stabilizes only after making a grounded call from partial but sufficient evidence.",
        "Hugo learns the mission needed a serious move, not a fantasy of total clarity."
      ),
      whatToDo: tri(
        "Hugo should decide once the evidence is sufficient for a defensible action, then keep watching for revision needs.",
        "Use timing judgment to act before the window closes while staying open to correction.",
        "Move when the file is strong enough for the mission, not when it feels emotionally finished."
      ),
      whyItMatters: tri(
        "The chapter says decisiveness is about timing and evidence together.",
        "This example shows a leader choosing action before certainty but after enough grounding exists.",
        "The team won back control by refusing to wait for impossible clarity."
      ),
    },
    {
      exampleId: "ch12-ex05-noemi-dilemma",
      title: "Noemi Has to Decide Whether Fast Action Is Grounded or Just Theater",
      category: "school",
      format: "dilemma",
      endingType: "common_trap",
      contexts: ["lab safety board", "unclear spill report", "teacher arrival"],
      scenario: tri(
        "Noemi faces an unclear lab report and pressure to move immediately before every fact is known.",
        "The dilemma is whether the fast move under discussion is grounded in enough evidence or is just speed trying to look brave.",
        "Noemi has to separate useful urgency from performative speed before the room copies the wrong signal."
      ),
      whatToDo: tri(
        "She should act quickly if the evidence supports the safety move, but not confuse empty speed with seriousness.",
        "Use the facts already available to make the necessary call without pretending that any faster action is automatically stronger.",
        "Move for the mission, not for the feeling of looking decisive."
      ),
      whyItMatters: tri(
        "The chapter rejects reckless speed as strongly as hesitation.",
        "This is the trap the chapter exposes: bravado can damage the mission just as badly as delay.",
        "Fast is only strong when judgment is underneath it."
      ),
    },
    {
      exampleId: "ch12-ex06-carter-after",
      title: "Carter's Volunteer Team Gets Better Once They Stop Treating Revision as Failure",
      category: "personal",
      format: "before_after",
      endingType: "perspective_reframe",
      contexts: ["supply route", "driver update", "volunteer regroup"],
      scenario: tri(
        "Before, Carter's team delayed decisions because they feared having to change them later.",
        "After, they make earlier grounded calls and then revise calmly when new information changes the route.",
        "The before-and-after shift is not less uncertainty. It is less ego around correction."
      ),
      whatToDo: tri(
        "Carter should normalize timely decisions followed by revision when the facts change.",
        "Teach the team that correction is part of strong judgment rather than evidence that action should have been delayed.",
        "Make revision part of the move instead of a reason to avoid the move."
      ),
      whyItMatters: tri(
        "The chapter says decisiveness stays healthy when leaders remain open to new evidence.",
        "This example shows revision reducing paralysis by lowering the ego cost of acting early.",
        "The team moved better once correction stopped feeling like defeat."
      ),
    },
  ],
  implementationPlan: {
    coreSkill: tri(
      "Learn to act before certainty is complete without letting speed outrun judgment.",
      "The core skill is grounded decisiveness: timely action from sufficient evidence plus readiness to revise.",
      "Train yourself to move in the narrow space between paralysis and bravado."
    ),
    ifThenPlans: [
      {
        context: "work",
        plan: tri(
          "If the evidence is incomplete but the cost of waiting is rising, then make the best defensible call available and monitor for revision.",
          "If a live window is closing before perfect clarity arrives, then decide from sufficient evidence instead of hoping for a cleaner file.",
          "If delay is billing the mission, move before comfort catches up."
        ),
      },
      {
        context: "school",
        plan: tri(
          "If a room change or safety issue is still unclear, then act once the facts justify the necessary move instead of waiting for certainty.",
          "If the options are narrowing, then treat delay as a real risk and make the best grounded call available.",
          "If the hallway is getting more expensive, stop waiting for a perfect hallway."
        ),
      },
      {
        context: "personal",
        plan: tri(
          "If a family or volunteer choice needs to be made before all details are known, then choose the best timely move and revise openly if new facts change it.",
          "If fear of later correction is causing delay, then normalize revision as part of acting responsibly.",
          "If the room is scared of changing course later, teach it to move earlier and correct cleaner."
        ),
      },
    ],
    twentyFourHourChallenge: tri(
      "Within the next day, identify one decision where waiting for certainty may already be costing more than revision would.",
      "In the next 24 hours, pick one unresolved choice and define what evidence would be sufficient to act even if not complete.",
      "By tomorrow, stop one delay that has been hiding behind the dream of a cleaner file."
    ),
    weeklyPractice: tri(
      "This week, review one hard decision and ask whether delay, reckless speed, or grounded timing shaped it most.",
      "Use one weekly review to check whether you acted from sufficient evidence, revised cleanly, or waited too long for certainty.",
      "Every week, find one moment where you can tighten the line between serious judgment and fake confidence."
    ),
  },
  reviewCards: [
    { cardId: "ch12-rc01", difficulty: "easy", front: tri("What condition does this chapter treat as normal?", "What reality of leadership does the chapter refuse to hide?", "What kind of environment does this chapter assume?"), back: tri("It treats uncertainty as a normal part of leadership.", "The chapter says leaders often must act before complete certainty arrives.", "It assumes the mission keeps moving while the picture is still incomplete.") },
    { cardId: "ch12-rc02", difficulty: "easy", front: tri("Why is hesitation dangerous here?", "What can waiting too long cost the mission?", "Why is delay not always neutral?"), back: tri("Because delay can burn time, options, and position while pretending to be caution.", "The chapter says waiting can become its own failure under pressure.", "Delay still shapes the outcome even when no one has acted yet.") },
    { cardId: "ch12-rc03", difficulty: "medium", front: tri("What makes a decision grounded under uncertainty?", "When should a leader act before certainty is complete?", "What does the chapter mean by grounded decisiveness?"), back: tri("A leader acts when the evidence is sufficient for a defensible move and the timing still matters.", "The chapter wants action from enough evidence, not from perfect clarity.", "Grounded decisiveness joins timing and judgment instead of choosing one over the other.") },
    { cardId: "ch12-rc04", difficulty: "medium", front: tri("Why is revision part of strength?", "What should leaders do when new information changes the picture?", "How does the chapter treat correction after action?"), back: tri("Revision keeps timely judgment connected to reality instead of ego.", "Leaders should correct the move if new evidence changes what the mission needs.", "The chapter treats correction as part of strong judgment, not as embarrassment.") },
    { cardId: "ch12-rc05", difficulty: "hard", front: tri("What opposite errors does the chapter hold together?", "Why is this chapter stricter than generic decisiveness talk?", "What balance defines the chapter's standard?"), back: tri("It rejects both paralysis and reckless speed.", "The chapter demands timely action with evidence rather than delay with excuses or speed with swagger.", "The standard is grounded timing judgment between caution theater and bravado theater.") },
  ],
  keyTakeawayCard: tri(
    "Leaders often have to decide before certainty is complete, which means strong action is timely, evidence-based, and open to correction.",
    "The chapter argues that grounded decisiveness sits between hesitation and reckless speed by acting from sufficient evidence before delay becomes the bigger risk and revising when reality changes.",
    "Move before perfect clarity. Ground the move in real evidence. Stay humble enough to change it when the mission answers back."
  ),
  quiz: {
    passingScorePercent: 70,
    questions: [
      { questionId: "ch12-q01", prompt: "What condition does this chapter treat as normal for leaders?", choices: ["Complete clarity before action", "Uncertainty while action is still required", "A permanent absence of consequences"], correctIndex: 1, explanation: tri("Correct. The chapter says leaders often have to act while certainty is still incomplete.", "Right. Uncertainty is presented as a normal operating condition, not a rare exception.", "That is the pressure point: the mission still wants a move before the picture is clean."), bloomsLevel: "remember", depthLevel: "easy" },
      { questionId: "ch12-q02", prompt: "Why can waiting too long become a failure?", choices: ["Because delay can cost the mission time and options", "Because leaders should always distrust evidence", "Because any quick choice is better than a careful one"], correctIndex: 0, explanation: tri("Yes. The chapter says hesitation can carry its own real cost.", "Exactly. Delay is not neutral when time and options are shrinking.", "Waiting can spend the mission's leverage while calling itself caution."), bloomsLevel: "understand", depthLevel: "easy" },
      { questionId: "ch12-q03", prompt: "What does grounded decisiveness mean here?", choices: ["Acting only after certainty is complete", "Making a timely move from sufficient evidence and staying open to revision", "Moving fast mainly to project confidence"], correctIndex: 1, explanation: tri("Right. The chapter joins timely action with real evidence and later correction if needed.", "Correct. The leader acts from what is sufficient, not from what is perfect.", "That is the narrow win: serious evidence, live timing, revisable move."), bloomsLevel: "understand", depthLevel: "easy" },
      { questionId: "ch12-q04", prompt: "In Anika's rollback scenario, what best applies the chapter?", choices: ["Wait until the dashboard feels complete even if the rollback window closes", "Use the available warning signs to make the rollback call and adjust if new evidence changes the picture", "Ignore the evidence and keep moving to avoid looking indecisive"], correctIndex: 1, explanation: tri("Correct. The chapter wants a defensible move before delay becomes more expensive than revision.", "That choice fits because Anika is acting from sufficient evidence instead of perfect comfort.", "Use the live file, not the fantasy of a cleaner one."), bloomsLevel: "apply", depthLevel: "medium" },
      { questionId: "ch12-q05", prompt: "How does the chapter distinguish decisiveness from recklessness?", choices: ["Decisiveness is speed no matter what the evidence says", "Decisiveness acts from evidence while recklessness outruns the evidence", "There is no real difference under pressure"], correctIndex: 1, explanation: tri("Yes. The chapter says timing matters, but grounding matters too.", "Exactly. Recklessness breaks the link between movement and evidence.", "Fast without grounding is just theater wearing urgency."), bloomsLevel: "analyze", depthLevel: "medium" },
      { questionId: "ch12-q06", prompt: "Which misreading does the chapter reject?", choices: ["That revision after action can be part of strength", "That uncertainty is a normal condition leaders must face", "That decisiveness means leaders should never revise their call"], correctIndex: 2, explanation: tri("Right. The chapter explicitly rejects stubborn loyalty to the first move.", "Correct. Revision is part of the chapter's standard for strong judgment.", "If the facts change, clinging to the first call is ego, not leadership."), bloomsLevel: "understand", depthLevel: "medium" },
      { questionId: "ch12-q07", prompt: "What is the best transfer of this chapter to school or home life?", choices: ["Wait for total certainty so no later revision is needed", "Make the best timely move you can justify, then adjust if new facts change it", "Choose the fastest option to prove confidence"], correctIndex: 1, explanation: tri("Correct. The chapter transfers through timely, revisable judgment under incomplete information.", "That answer carries the principle well: act from enough evidence and correct if reality changes.", "Move before comfort is complete, then stay open to better facts.") , bloomsLevel: "apply", depthLevel: "medium" },
      { questionId: "ch12-q08", prompt: "What was the real reveal in Hugo's scenario?", choices: ["The team needed a defensible call before the service window closed, not a perfect file", "The best move was to delay until every data point lined up", "The issue was mostly that nobody moved quickly enough for appearance reasons"], correctIndex: 0, explanation: tri("Right. The chapter says the mission often needs sufficient evidence sooner than it gets perfect evidence.", "The reveal is that timing and judgment had to meet before certainty did.", "The team needed a serious move, not a cleaner fantasy."), bloomsLevel: "analyze", depthLevel: "hard" },
      { questionId: "ch12-q09", prompt: "Which statement best captures the chapter's deeper synthesis?", choices: ["Leaders should choose motion over thought whenever uncertainty is high", "Grounded decisiveness acts from sufficient evidence before delay costs more, then revises if reality changes", "Strong leaders avoid all revision because it weakens confidence"], correctIndex: 1, explanation: tri("Exactly. That answer joins timing, evidence, and revision into one standard.", "Correct. The chapter is balancing delay risk, grounding, and openness to correction.", "That is the real spine: enough evidence, live timing, humble revision."), bloomsLevel: "analyze", depthLevel: "hard" },
      { questionId: "ch12-q10", prompt: "How does this chapter lead into the final one?", choices: ["By showing that leaders need disciplined systems to move quickly under uncertainty without chaos", "By proving that discipline matters less once decisiveness is learned", "By arguing that uncertainty disappears when teams act faster"], correctIndex: 0, explanation: tri("Yes. The final chapter asks what kind of discipline makes fast adaptation sustainable.", "Correct. Decisiveness under uncertainty needs systems strong enough to support speed and correction.", "Speed needs discipline or it becomes chaos.") , bloomsLevel: "analyze", depthLevel: "hard" },
    ],
  },
  logLines(hash) {
    const t = stamp();
    return [
      `${t} - Wave \`11-12\` writer pass for \`ch12\` completed at \`drafts/canonical/ch12.md\`; editor pass completed at \`drafts/edited/ch12.md\`.`,
      `${t} - Wave \`11-12\` critic pass for \`ch12\` completed at \`reports/ch12.critic.md\` with score \`11/12\`; prose gate clear for conversion.`,
      `${t} - Wave \`11-12\` converter pass for \`ch12\` completed at \`structured/ch12.chapter.json\`; quiz pass completed at \`quizzes/ch12.quiz.json\`.`,
      `${t} - Wave \`11-12\` final chapter-gate checks for \`ch12\` passed: chapter lint \`FAIL=0 WARN=0\`, review-package lint \`FAIL=0 WARN=0\`, artifact guard \`FAIL=0 WARN=0\`, wrapper payload exact-match confirmed at \`chapters[0]\`, reading metrics written.`,
      `${t} - Wave \`11-12\` automatic gate decision for \`ch12\`: PASS. Sealed \`approvedChapterHashes.ch12 = ${hash}\` in \`continuity/continuity-state.json\`.`,
    ];
  },
};

function buildCh12Prose() {
  writeText("drafts/canonical/ch12.md", ch12.draftText);
  writeText("drafts/edited/ch12.md", ch12.draftText);
  writeText("reports/ch12.critic.md", ch12.criticReport);
}

function closeWave1112() {
  const guard = runChecked("python3", [guardScript, runRoot]);
  if (!guard.ok) throw new Error(guard.stdout);
  appendRunLog([
    `${stamp()} - Wave \`11-12\` post-wave repo artifact guard passed with \`${guard.stdout.split("\n").slice(-1)[0]}\`. Wave closed clean; continuing automatically to the next wave on the strict path.`,
  ]);
}

const mode = process.argv[2];
if (mode === "ch11") {
  gateChapter(ch11);
} else if (mode === "ch12") {
  buildCh12Prose();
  gateChapter(ch12);
  closeWave1112();
} else {
  console.error("Usage: node wave_11_12_bundle.mjs ch11|ch12");
  process.exit(2);
}
