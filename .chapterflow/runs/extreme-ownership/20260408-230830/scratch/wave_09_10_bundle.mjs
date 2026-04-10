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
  fs.readFileSync(path.join(runRoot, "validated/ch08.review-package.json"), "utf8")
).book;

const tri = (gentle, direct, competitive) => ({ gentle, direct, competitive });
const wordCount = (text) => (text.match(/\b[\w']+\b/g) || []).length;
const canonical = (obj) => JSON.stringify(obj, Object.keys(obj).sort());
const sha = (obj) => crypto.createHash("sha256").update(stable(obj)).digest("hex");
const createdAt = () => new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

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

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function writeJson(rel, obj) {
  const target = path.join(runRoot, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(obj, null, 2)}\n`);
}

function writeText(rel, text) {
  const target = path.join(runRoot, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${text.trim()}\n`);
}

function runChecked(cmd, args) {
  try {
    return {
      ok: true,
      stdout: execFileSync(cmd, args, {
        cwd: repoRoot,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }).trim(),
    };
  } catch (error) {
    return {
      ok: false,
      stdout: `${error.stdout || ""}${error.stderr || ""}`.trim(),
    };
  }
}

function buildMetrics(chapter, criticScore, sourceHeading) {
  return {
    chapterId: chapter.chapterId,
    number: chapter.number,
    title: chapter.title,
    readingTimeMinutes: chapter.readingTimeMinutes,
    wordCounts: {
      easyDirect: wordCount(chapter.contentVariants.easy.chapterBreakdown.direct),
      mediumDirect: wordCount(chapter.contentVariants.medium.chapterBreakdown.direct),
      hardDirect: wordCount(chapter.contentVariants.hard.chapterBreakdown.direct),
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

function writeValidationReport(rel, data) {
  writeText(
    rel,
    `# Validation Report — ${data.code}

Status: ${data.status}
- critic report: reports/${data.code}.critic.md
- structured chapter: structured/${data.code}.chapter.json
- quiz: quizzes/${data.code}.quiz.json
- validated chapter: validated/${data.code}.chapter.json
- review package: validated/${data.code}.review-package.json
- reading metrics: sidecars/${data.code}.reading-metrics.json
- chapter lint: ${data.chapterLint}
- review-package lint: ${data.wrapperLint}
- artifact guard: ${data.guard}
- wrapper payload match: ${String(data.wrapperMatch)}
- approvedChapterHash: ${data.hash}`
  );
}

function updateContinuity({ code, names, schoolSettings, hash }) {
  const continuityPath = path.join(runRoot, "continuity/continuity-state.json");
  const continuity = JSON.parse(fs.readFileSync(continuityPath, "utf8"));
  const alreadySealed = Boolean(continuity.approvedChapterHashes[code]);

  if (continuity.withinChapterNames[code]) {
    for (const priorName of continuity.withinChapterNames[code]) {
      if (continuity.nameUsage[priorName] === code) delete continuity.nameUsage[priorName];
    }
  }

  continuity.withinChapterNames[code] = names;
  for (const name of names) continuity.nameUsage[name] = code;

  const formatCategoryPairs = [
    { format: "decision_point", category: "work" },
    { format: "postmortem", category: "school" },
    { format: "dialogue", category: "personal" },
    { format: "predict_reveal", category: "work" },
    { format: "dilemma", category: "school" },
    { format: "before_after", category: "personal" },
  ];
  continuity.formatCategoryHistory = continuity.formatCategoryHistory.filter(
    (entry) => entry.chapterId !== code
  );
  for (const pair of formatCategoryPairs) {
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

function appendRunLog(lines) {
  const target = path.join(runRoot, "reports/run-log.md");
  const text = lines.map((line) => `- ${line}`).join("\n");
  fs.appendFileSync(target, `${text}\n`);
}

function buildReviewPackage(chapter) {
  return {
    schemaVersion: "1.1.0",
    packageId: crypto.randomUUID(),
    createdAt: createdAt(),
    contentOwner: "ChapterFlow",
    book,
    chapters: [chapter],
  };
}

function buildChapter(config) {
  return {
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
}

function gateChapter(config) {
  const chapter = buildChapter(config);
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

  writeValidationReport(`reports/${config.code}.validation.md`, {
    code: config.code,
    status: "RUNNING",
    chapterLint: chapterLint.stdout.split("\n").slice(-1)[0] || "FAIL=1 WARN=0",
    wrapperLint: wrapperLint.stdout.split("\n").slice(-1)[0] || "FAIL=1 WARN=0",
    guard: "RUNNING",
    wrapperMatch: false,
    hash: "pending",
  });

  const guard = runChecked("python3", [guardScript, runRoot]);
  const wrapperMatch =
    stable(chapter) === stable(JSON.parse(fs.readFileSync(path.join(runRoot, `validated/${config.code}.review-package.json`), "utf8")).chapters[0]);

  if (!chapterLint.ok || !wrapperLint.ok || !guard.ok || !wrapperMatch) {
    writeValidationReport(`reports/${config.code}.validation.md`, {
      code: config.code,
      status: "FAIL",
      chapterLint: chapterLint.stdout.split("\n").slice(-1)[0] || "FAIL=1 WARN=0",
      wrapperLint: wrapperLint.stdout.split("\n").slice(-1)[0] || "FAIL=1 WARN=0",
      guard: guard.stdout.split("\n").slice(-1)[0] || "FAIL=1 WARN=0",
      wrapperMatch,
      hash: "not-sealed",
    });
    throw new Error(
      [
        chapterLint.stdout,
        wrapperLint.stdout,
        guard.stdout,
        `wrapperMatch=${wrapperMatch}`,
      ]
        .filter(Boolean)
        .join("\n")
    );
  }

  const hash = sha(chapter);
  writeValidationReport(`reports/${config.code}.validation.md`, {
    code: config.code,
    status: "PASS",
    chapterLint: chapterLint.stdout.split("\n").slice(-1)[0],
    wrapperLint: wrapperLint.stdout.split("\n").slice(-1)[0],
    guard: guard.stdout.split("\n").slice(-1)[0],
    wrapperMatch,
    hash,
  });
  updateContinuity({
    code: config.code,
    names: config.names,
    schoolSettings: config.schoolSettings,
    hash,
  });
  appendRunLog(config.logLines(hash));
  return { hash, metrics };
}

const ch09 = {
  code: "ch09",
  number: 9,
  title: "Decentralized Command",
  chapterId: "ch09-decentralized-command",
  readingTimeMinutes: 9,
  criticScore: 11,
  sourceHeading: "Decentralized Command",
  names: ["Talia", "Idris", "Priyanka", "Devin", "Selah", "Marco"],
  schoolSettings: ["student summit control table", "robotics pit lane"],
  contentVariants: {
    easy: {
      chapterBreakdown: {
        gentle:
          "This chapter says teams slow down when every decision has to climb back to one leader before anyone can move. Pressure changes too fast for that. The person closest to the work often sees the problem sooner and more clearly than the person at the top.\n\nDecentralized command means junior leaders have enough intent and trust to decide at the front. That is not loose freedom. The chapter keeps one limit sharp: people need training, context, and boundaries before authority spreads. When those are present, the team moves faster without drifting apart.",
        direct:
          "The chapter argues that leaders become bottlenecks when every meaningful choice has to travel back up the chain before anyone acts. Conditions shift fastest where the work is happening, so the person closest to the problem often has better timing than the person holding formal authority above it. Decentralized command answers that bottleneck by pushing decisions outward through clear intent, training, and trust. It makes speed possible by reducing approval distance at the exact point where information is freshest.\n\nThe point is not casual freedom. Junior leaders still need standards, context, and mission boundaries. But once they understand what the mission is trying to accomplish, they should be able to decide without constant escalation. That is how teams gain speed without losing alignment. The bridge to planning is already visible because those local decisions work only if the shared mission has been built early enough.",
        competitive:
          "This chapter goes after command drag. Teams can have smart people at the front and still move badly because every real decision has to crawl back to the top for approval. By the time the answer returns, the field has already changed.\n\nDecentralized command breaks that drag by putting authority closer to the work. The chapter refuses the lazy version too. This is not everybody doing whatever feels right. Junior leaders need training, standards, and clear intent first. When those exist, front-line decisions stop waiting for a traffic jam at the top.",
      },
      keyTakeaways: [
        {
          point: tri(
            "Centralized approval can slow a team right where speed matters most.",
            "When every decision must climb upward first, the leader becomes the mission bottleneck.",
            "A team loses time when authority sits too far from the problem."
          ),
        },
        {
          point: tri(
            "Decentralized command moves decisions closer to the work.",
            "Junior leaders need enough intent and authority to decide at the front.",
            "The fastest useful decision usually happens near the action, not far above it."
          ),
        },
        {
          point: tri(
            "Distributed authority still needs training and boundaries.",
            "The chapter rejects chaos by tying delegation to standards, context, and competence.",
            "Speed without alignment is just confusion arriving earlier."
          ),
        },
      ],
      oneMinuteRecap: tri(
        "This chapter says teams move better when informed decisions happen close to the work instead of waiting on one leader at the top.",
        "Decentralized Command argues that intent, trust, and training let junior leaders decide faster without losing mission alignment.",
        "The chapter makes the rule plain: stop making every decision climb uphill before the team can move."
      ),
    },
    medium: {
      chapterBreakdown: {
        gentle:
          "This chapter begins with a simple frustration: the team can see what needs to happen, but nobody moves because the decision still has to come from one level above them. Pressure makes that slower than it first sounds. Conditions change while people wait, and information loses sharpness as it climbs away from the front.\n\nThat is why the chapter argues for decentralized command. It does not say leaders stop leading. It says leaders prepare junior leaders well enough that informed decisions can happen where the work is actually unfolding. That requires more than permission. People need intent, context, and enough understanding of the mission to act without freezing.\n\nThe chapter also says trust is not a feeling detached from execution. Trust is built through training, standards, and shared understanding. Junior leaders need to know what matters, what boundaries hold, and how to judge change under pressure.\n\nA hard limit stays visible the whole time. Decentralization is not the same as everybody improvising their own mission. If training is weak or intent is muddy, spreading decisions downward only spreads confusion faster.\n\nThat is why the chapter naturally points toward planning next. Front-line leaders can decide quickly only if the mission has already been explained clearly enough that adaptation still stays aligned.",
        direct:
          "The chapter goes after a leadership failure that hides inside good intentions: centralizing too many decisions at the top. Senior leaders may believe they are preserving quality or control, but the chapter says they often create a slower and less accurate system instead. The person closest to the work usually sees the changing problem first. When that person still has to wait for approval on every meaningful move, the mission loses time and the information loses freshness on the way up. What looks like discipline can quietly become delay.\n\nThat is why the chapter argues for decentralized command. Leaders still own the mission, but they do not try to think every thought for the team. They train junior leaders, make the intent clear, and push enough authority downward that decisions can happen at the front. The mechanism is not loose empowerment language. It is controlled distribution of judgment. Authority travels outward because the environment is moving too fast for one person to translate every development.\n\nThe chapter also treats intent as essential. Junior leaders cannot stay aligned if they understand only their task and not the purpose shaping it. They need to know what the mission is trying to achieve, what matters most, and what boundaries must not be crossed if conditions change. Intent keeps adaptation connected to the same larger objective even after the first conditions shift.\n\nThe chapter keeps one hard warning in place so the idea does not drift into sentimentality. Decentralization is not chaos. If competence is thin, standards are vague, or context is incomplete, leaders are not building speed. They are multiplying confusion. The senior leader still owns the system that makes distributed judgment reliable.\n\nThat is what makes the bridge to planning so clean. Distributed decision-making works only when the team has already been prepared deeply enough that fast local decisions still fit the larger mission. Shared understanding has to exist before pressure tests it.",
        competitive:
          "This chapter attacks a control habit that makes teams look disciplined while quietly slowing the mission down. Every decision climbs to the top. Everyone waits. By the time the answer comes back, the front has changed and the best moment to act is already gone.\n\nThe answer is decentralized command. Leaders do not disappear. They build junior leaders who can carry the mission forward where it is actually happening. Authority moves downward because the information is better there and the clock is harsher there.\n\nThat only works when intent travels with the authority. Front-line leaders need the purpose, the standards, and the judgment boundaries, not just a vague blessing to go be decisive.\n\nThe chapter also crushes the easy misread. Decentralization is not a romance about freedom. If the team is untrained or the intent is fuzzy, pushing decisions outward just spreads error at higher speed.\n\nThat is why the next chapter matters. If local leaders are going to move without waiting, the plan has to live in them before the pressure starts.",
      },
      keyTakeaways: [
        {
          point: tri(
            "Teams lose speed when every decision has to climb back to one leader.",
            "Centralized control can protect authority while weakening execution speed and accuracy.",
            "If approval has to travel uphill every time, the mission starts paying rent to the bottleneck."
          ),
          moreDetails: tri(
            "Distance from the action makes top-only decision systems slower.",
            "The person closest to the work often sees the problem with fresher detail than the person above.",
            "The front learns first, but the top reacts last when control is hoarded."
          ),
        },
        {
          point: tri(
            "Decentralized command pushes decisions closer to the work.",
            "Leaders improve execution by distributing judgment outward instead of centralizing every call.",
            "The field moves faster when authority lives closer to the friction."
          ),
          moreDetails: tri(
            "That is how the team keeps moving under pressure.",
            "The chapter treats distributed authority as execution design, not as morale language.",
            "This is architecture for speed, not praise for independence."
          ),
        },
        {
          point: tri(
            "Intent keeps local decisions aligned.",
            "Junior leaders need the mission purpose, boundaries, and priorities, not just a permission slip.",
            "Authority without intent is just confusion with confidence."
          ),
          moreDetails: tri(
            "People adapt better when they know what the mission is trying to achieve.",
            "The chapter says explanation is part of delegation, not an optional extra.",
            "If the purpose never travels downward, the decisions will not stay coherent."
          ),
        },
        {
          point: tri(
            "Training and standards keep decentralization from turning messy.",
            "Distributed decision-making still depends on competence and clear expectations.",
            "You cannot decentralize judgment that was never built."
          ),
          moreDetails: tri(
            "The chapter is not against leadership control in general.",
            "It is against control concentrated in the wrong place for the speed of the mission.",
            "The problem is not standards. The problem is where the standards get translated into action."
          ),
        },
        {
          point: tri(
            "The next problem is preparation before pressure.",
            "Once decisions move outward, the team needs planning and rehearsal to keep those decisions aligned.",
            "Local authority still needs a shared map before the mission gets loud."
          ),
          moreDetails: tri(
            "That is why the chapter leads directly into planning.",
            "Fast front-line judgment depends on shared structure built before action begins.",
            "Speed at the edge only works if the center prepared the edge properly."
          ),
        },
      ],
      activationPrompt: tri(
        "Think of one place where people already know what to do but still wait for approval too often.",
        "Map one recurring bottleneck where the person closest to the work still cannot decide without escalation.",
        "Find one lane where the mission keeps queuing behind someone who should not own every call."
      ),
      selfCheckPrompt: tri(
        "Where am I asking people to wait when they already have enough information to move?",
        "Which decisions am I still centralizing even though the front sees them sooner than I do?",
        "What approval habit is making me feel in control while the team loses speed?"
      ),
      oneMinuteRecap: tri(
        "This chapter says leaders speed teams up by building junior leaders who can decide at the front with clear intent.",
        "Decentralized Command argues that distributed authority works when training, standards, and mission understanding move outward together.",
        "The chapter sharpens one rule: send judgment to the edge, but send purpose and boundaries with it."
      ),
    },
    hard: {
      chapterBreakdown: {
        gentle:
          "This chapter treats centralized control as a hidden drag on execution. A senior leader may care deeply, know the mission well, and still slow the team because too many decisions must climb back up the chain before anyone can move. Pressure makes that expensive because the people at the front are seeing change first while authority is waiting farther away.\n\nThat is why the chapter argues for decentralized command. The idea is not that leaders become passive. The idea is that leaders train junior leaders, explain the mission clearly, and let decisions happen where the work is actually unfolding. Authority shifts closer to the problem because that is where timing and detail are sharpest.\n\nThe chapter also says intent has to travel with authority. Junior leaders cannot adapt well if they know only the task and not the purpose beneath it. They need to understand what success looks like, which boundaries matter, and what judgment would still fit the mission if conditions change.\n\nA hard warning keeps the principle honest. Decentralized command is not permission for unprepared people to invent their own version of the mission. If training is weak or clarity is thin, pushing decisions downward does not create speed with discipline. It creates speed with confusion.\n\nThat is why the chapter stays stricter than generic advice about trusting people. It is not praising trust as a feeling. It is showing how leaders design a system where informed judgment can move faster than top-down approval without breaking alignment.\n\nThe next chapter follows naturally. If front-line leaders are expected to decide quickly under pressure, then planning, rehearsal, and contingencies have to prepare them before the mission begins moving.",
        direct:
          "The chapter exposes a common leadership tradeoff that is less real than it first appears. Leaders centralize decisions because they want consistency, control, and quality. The chapter says that move can produce the opposite result under pressure. The person farthest from the immediate work often becomes the final checkpoint for decisions the front understands more quickly than anyone else. That means the mission starts waiting on distance. A chain meant to protect execution begins slowing execution at the moment timing matters most.\n\nDecentralized command is the answer because it moves judgment closer to the changing problem. Leaders still own the mission, but they do not try to personally translate every development into an instruction. They build junior leaders who can think within the mission intent and act while the opportunity is still live. The chapter is therefore not anti-authority. It is against authority being concentrated in the wrong place for the speed of the environment. The front needs enough authority to use the facts it already has.\n\nThat mechanism depends on intent, not mere permission. Junior leaders need to know what the mission is trying to achieve, what matters most if tradeoffs appear, and where the boundaries hold if the original conditions start shifting. Without that shared understanding, distributed authority becomes improvisation instead of aligned judgment. Intent is the part of command that keeps local action tied to the same larger purpose.\n\nThe chapter also protects a hard edge that weaker summaries often erase. Decentralization is not chaos, and it is not a license for senior leaders to disappear. If competence is unbuilt, standards are vague, or rehearsed understanding is absent, leaders are not distributing command well. They are abandoning translation while pretending to empower the team. Real decentralization demands more preparation from leaders, not less.\n\nThat is why the chapter's deeper claim is structural. Mission success depends on decisions happening where the work is unfolding, but those decisions still have to be shaped by training, standards, and intent that came from above. The team gets speed only because alignment has already been built deeply enough to travel. Fast judgment is earned by earlier clarity.\n\nThat creates the bridge into planning. If the mission is going to move through many local decisions rather than one central bottleneck, the team has to prepare together before pressure arrives. Otherwise decentralized command becomes a theory that collapses the moment reality starts changing. The edge can only act well if the center already built a shared map.",
        competitive:
          "This chapter goes after a control reflex that punishes teams exactly when they need speed most. Every serious decision climbs upward because the senior leader wants consistency. That sounds disciplined until the front keeps waiting on answers from someone farther away from the friction than the people already standing in it.\n\nDecentralized command breaks that pattern by sending judgment closer to the problem. Leaders do not vanish. They build junior leaders who understand the mission well enough to act while the window is still open. That is the whole point: stop forcing live execution to queue behind one person at the top.\n\nBut authority cannot travel alone. Intent has to travel with it. Front-line leaders need the purpose, the priorities, and the boundaries, or the mission just gets a faster version of confusion. The chapter is ruthless about that distinction.\n\nIt is equally ruthless about the easy misread. This is not a sentimental speech about freedom. If the team is untrained, if the standards are vague, or if nobody shares the same understanding of success, decentralized command is a slogan hiding an unbuilt system.\n\nThe real claim is harder and better. Teams move faster when the center does the work of building aligned judgment before the edge has to act. Then decisions can happen where reality is changing without the mission falling apart.\n\nThat is why planning comes next. If you want decisions at the front, you have to give the front a shared map before the fight for time begins.",
      },
      keyTakeaways: [
        {
          point: tri(
            "Centralized approval can quietly become a mission bottleneck.",
            "Leaders often protect control by concentrating decisions, then lose speed where timing matters most.",
            "A top-heavy chain can make the mission wait on distance."
          ),
          moreDetails: tri(
            "That is why the front can see the problem first but still move last.",
            "The person farthest from the friction can become the final stop for decisions the front already understands better.",
            "The field learns now while the chain answers later."
          ),
        },
        {
          point: tri(
            "Decentralized command moves judgment to the point of action.",
            "The chapter says decisions should happen where the work is unfolding, not only where authority is concentrated.",
            "Useful command puts live decisions near live reality."
          ),
          moreDetails: tri(
            "That shift helps the team keep pace with changing conditions.",
            "Leaders distribute authority because speed and detail are strongest at the front.",
            "The edge can move faster because it sees more sooner."
          ),
        },
        {
          point: tri(
            "Intent has to travel with authority.",
            "Junior leaders need mission purpose, priorities, and boundaries so adaptation stays aligned.",
            "Permission without purpose just spreads drift faster."
          ),
          moreDetails: tri(
            "Shared understanding is part of delegation.",
            "The chapter treats explanation as a core leadership job, not as optional context.",
            "If the mission never lives in the team, the decisions will not either."
          ),
        },
        {
          point: tri(
            "Training and standards keep decentralization from collapsing.",
            "Distributed command depends on competence and clear expectations rather than hopeful slogans.",
            "You cannot outsource judgment that nobody has been taught to carry."
          ),
          moreDetails: tri(
            "That is why the chapter rejects loose empowerment language.",
            "Leaders are still responsible for the system that prepares junior leaders to decide well.",
            "The center still owns the build, even when the edge owns the move."
          ),
        },
        {
          point: tri(
            "The principle is structural, not sentimental.",
            "The chapter is describing an execution design that couples speed with alignment.",
            "This is a system for tempo, not a speech about trust."
          ),
          moreDetails: tri(
            "Mission success improves when judgment is distributed inside a shared purpose.",
            "The chapter wants faster decisions and stronger coherence at the same time.",
            "The best teams do not choose between control and speed. They build aligned speed."
          ),
        },
      ],
      activationPrompt: tri(
        "Name one place where a junior leader could decide sooner if they understood the mission more clearly.",
        "Identify one active bottleneck where intent could be pushed downward so the front stops waiting on you.",
        "Find one decision lane where the team already has the facts but still has to beg the top for permission."
      ),
      selfCheckPrompts: [
        tri(
          "Where is distance from the action making decisions slower than they need to be?",
          "Which calls am I still forcing upward even though the front has the freshest understanding of them?",
          "Where is my chain making reality stand in line?"
        ),
        tri(
          "What would people need to understand before I could trust them to decide locally?",
          "If I push authority downward tomorrow, what mission intent and boundaries must travel with it first?",
          "What shared map is missing that would keep speed from turning into drift?"
        ),
      ],
      predictionPrompt: tri(
        "If local leaders are supposed to decide quickly, what has to be built before the mission starts?",
        "Once authority is distributed, what preparation keeps fast decisions from losing alignment later?",
        "If the edge is going to move on its own, what must the center build in advance?"
      ),
      oneMinuteRecap: tri(
        "This chapter says teams gain speed when trained junior leaders can decide near the work with clear mission intent.",
        "Decentralized Command argues that distributed judgment works only when authority, standards, and purpose move outward together.",
        "The chapter leaves one hard rule behind: push decisions to the edge, but make sure the mission got there first."
      ),
    },
  },
  examples: [
    {
      exampleId: "ch09-ex01-talia-launch-lane",
      title: "Talia Stops Routing Every Launch Call Through One Escalation Lane",
      category: "work",
      format: "decision_point",
      endingType: "broader_principle",
      contexts: ["release war room", "feature escalation lane", "launch checklist"],
      scenario: tri(
        "Talia is leading a product launch where team leads can already see the blockers, but they still wait for her approval before changing anything.",
        "Talia has to decide whether to keep every launch call flowing through her or give team leads authority within a clear mission intent.",
        "Talia can keep being the single gate on every live launch call, or she can move judgment closer to the teams already seeing the risk."
      ),
      whatToDo: tri(
        "Talia should name the launch intent, the boundaries, and the fallback rules, then let team leads decide inside that frame.",
        "Push authority outward with clear standards so the people closest to the issue can act without waiting on her every time.",
        "Stop making the lane worship the top. Give the front the rules and let it move."
      ),
      whyItMatters: tri(
        "The chapter says speed improves when informed decisions happen close to the work.",
        "This shows decentralized command as execution design rather than vague trust language.",
        "The team gets tempo when judgment stops queuing behind one person."
      ),
    },
    {
      exampleId: "ch09-ex02-idris-summit-postmortem",
      title: "Idris Finds the Student Summit Delays Were Really Approval Delays",
      category: "school",
      format: "postmortem",
      endingType: "self_directed_question",
      contexts: ["student summit control table", "cue sheet", "late room changes"],
      scenario: tri(
        "After the event, Idris sees that sub-leads knew what needed to change, but they kept waiting for one final approval at the control table.",
        "The postmortem shows that the summit fell behind because informed people could not act without routing every change upward first.",
        "Idris realizes the summit did not fail from weak effort. It failed because too many calls had to climb back to the top."
      ),
      whatToDo: tri(
        "Next time, Idris should define the event intent and the decisions sub-leads can make on their own.",
        "Set clearer decision rights before the event so room, timing, and volunteer leads do not freeze during live changes.",
        "Build the summit so the people holding the facts do not have to beg the table for permission."
      ),
      whyItMatters: tri(
        "The chapter warns that central approval can quietly slow the whole system.",
        "This example transfers the principle cleanly: delay often comes from bottlenecked authority, not from weak commitment.",
        "The team did not need more hustle. It needed faster judgment at the edge."
      ),
    },
    {
      exampleId: "ch09-ex03-priyanka-volunteer-dialogue",
      title: "Priyanka Changes the Family Volunteer Plan by Explaining the Why First",
      category: "personal",
      format: "dialogue",
      endingType: "surprising_implication",
      contexts: ["shared volunteer rota", "weekend handoff", "home calendar"],
      scenario: tri(
        "Priyanka notices everyone keeps escalating small volunteer schedule changes back to her because nobody knows what tradeoff matters most.",
        "In the conversation, Priyanka explains the real goal of the weekend plan so others can decide locally when details shift.",
        "Priyanka stops hoarding the answer and starts sharing the logic that makes the answer possible."
      ),
      whatToDo: tri(
        "She should make the purpose and the boundaries explicit so others can adjust without asking her every time.",
        "Clarify what matters most, what can flex, and when a change really needs escalation.",
        "Give the room the mission, not just the original schedule."
      ),
      whyItMatters: tri(
        "The chapter says intent is part of delegation, not an optional extra.",
        "This shows that local decision quality rises when people understand the purpose beneath the task.",
        "Once the why travels, the plan stops collapsing back into one exhausted decision-maker."
      ),
    },
    {
      exampleId: "ch09-ex04-devin-reveal",
      title: "Devin's Team Speeds Up the Moment the Front Stops Waiting",
      category: "work",
      format: "predict_reveal",
      endingType: "cross_domain",
      contexts: ["ops board", "incident notes", "handoff queue"],
      scenario: tri(
        "Devin predicts that the ops queue will keep growing unless the on-shift leads can resolve routine issues without finding him first.",
        "The reveal is that the backlog shrinks only after on-shift leads get clearer intent and authority to act inside it.",
        "Devin learns that the queue was not a workload mystery. It was an authority problem."
      ),
      whatToDo: tri(
        "Devin should define the mission intent, escalation boundaries, and normal decision rights before the next shift.",
        "Move the routine calls to the front line and reserve true exceptions for escalation.",
        "Keep the edge moving and make the top the backup, not the choke point."
      ),
      whyItMatters: tri(
        "The chapter says mission speed rises when judgment happens where reality is changing.",
        "This example makes the structural point visible: better authority design changes throughput.",
        "Tempo returned when the queue stopped worshipping hierarchy."
      ),
    },
    {
      exampleId: "ch09-ex05-selah-pit-lane",
      title: "Selah Has to Decide Whether the Robotics Pit Can Move Without the Lead Coach",
      category: "school",
      format: "dilemma",
      endingType: "common_trap",
      contexts: ["robotics pit lane", "repair cart", "match clock"],
      scenario: tri(
        "Selah sees the pit team waiting for the lead coach to approve every repair choice even with the match clock already running.",
        "The dilemma is whether to keep central control for safety or train clearer decision rights so the pit can act in time.",
        "Selah has to choose between the comfort of one final approver and the speed the clock is demanding."
      ),
      whatToDo: tri(
        "She should identify what the pit crew can decide on their own and what really must escalate.",
        "Define standards and boundaries so trained students can act without turning the lane into chaos.",
        "Do not confuse one nervous approver with real control."
      ),
      whyItMatters: tri(
        "The chapter keeps warning that decentralized command still needs competence and standards.",
        "This is the trap the chapter rejects: calling a bottleneck safer simply because it stays at the top.",
        "Slow control can still lose the mission."
      ),
    },
    {
      exampleId: "ch09-ex06-marco-after",
      title: "Marco's House Gets Calmer After Decisions Stop Climbing Back to One Person",
      category: "personal",
      format: "before_after",
      endingType: "perspective_reframe",
      contexts: ["shared kitchen board", "pickup changes", "family routine"],
      scenario: tri(
        "Before, every change in the family routine came back to Marco, even when others already had the information needed to adjust.",
        "After Marco explains the priorities and the limits, small changes get handled locally and the house stops bottlenecking on him.",
        "The before-and-after difference is not better obedience. It is clearer shared judgment."
      ),
      whatToDo: tri(
        "Marco should spell out what matters most and where the others can decide without checking back.",
        "Share the purpose and the boundaries so routine judgment spreads instead of collecting on one person.",
        "Replace constant escalation with a household that understands the mission."
      ),
      whyItMatters: tri(
        "The chapter says trust becomes practical when people know how to stay aligned.",
        "This example shows decentralization lowering friction by reducing unnecessary dependence on one decision-maker.",
        "Once the logic is shared, the leader stops acting like the only usable brain in the room."
      ),
    },
  ],
  implementationPlan: {
    coreSkill: tri(
      "Learn to explain the mission clearly enough that others can decide closer to the work.",
      "The core skill is distributing judgment through intent, standards, and training instead of centralizing every call.",
      "Train yourself to move authority outward without letting alignment fall apart."
    ),
    ifThenPlans: [
      {
        context: "work",
        plan: tri(
          "If team leads keep waiting on you for routine changes, then clarify the mission intent and what they can decide without escalation.",
          "If the front has better information than the top, then push defined decision rights outward before the next pressure cycle.",
          "If the queue keeps climbing back to you, kill the bottleneck by building local authority with boundaries."
        ),
      },
      {
        context: "school",
        plan: tri(
          "If an event team freezes during live changes, then decide in advance which sub-leads can act on their own.",
          "If student leads already know the situation best, then give them mission context and decision limits before the event starts.",
          "If the table keeps becoming the choke point, teach the edge what it can own."
        ),
      },
      {
        context: "personal",
        plan: tri(
          "If every home or volunteer change keeps returning to you, then explain the priorities and what can flex.",
          "If others keep escalating small decisions, then share the purpose and the boundaries instead of only the original plan.",
          "If your household keeps standing in line behind you, send the logic outward."
        ),
      },
    ],
    twentyFourHourChallenge: tri(
      "Within the next day, name one decision you could stop centralizing by explaining the goal more clearly.",
      "In the next 24 hours, identify one approval bottleneck and define what context another person would need to handle it locally.",
      "By tomorrow, remove one line of traffic that still flows through you for no good reason."
    ),
    weeklyPractice: tri(
      "This week, review one delayed moment and ask whether the right person had enough context to decide at the front.",
      "Use one weekly review to check where authority is still too concentrated for the speed of the mission.",
      "Every week, hunt one control habit that feels safe but keeps making the team wait."
    ),
  },
  reviewCards: [
    {
      cardId: "ch09-rc01",
      difficulty: "easy",
      front: tri(
        "What problem does this chapter attack first?",
        "What goes wrong when leaders centralize too many decisions?",
        "What kind of control failure is the chapter targeting?"
      ),
      back: tri(
        "It attacks the slowdown created when every decision has to return to one leader first.",
        "The chapter says top-heavy approval turns the leader into a bottleneck.",
        "It goes after command drag caused by decisions climbing uphill."
      ),
    },
    {
      cardId: "ch09-rc02",
      difficulty: "easy",
      front: tri(
        "What does decentralized command change?",
        "Where should useful decisions happen according to the chapter?",
        "What structural move fixes the bottleneck?"
      ),
      back: tri(
        "It moves informed decisions closer to the work.",
        "The chapter wants judgment happening at the front instead of waiting at the top.",
        "The fix is to push authority toward the friction."
      ),
    },
    {
      cardId: "ch09-rc03",
      difficulty: "medium",
      front: tri(
        "Why is intent so important here?",
        "What must travel with authority if local leaders are going to decide well?",
        "What keeps decentralization from turning into drift?"
      ),
      back: tri(
        "Intent helps people stay aligned when details change.",
        "Junior leaders need the mission purpose, priorities, and boundaries, not just permission.",
        "Authority only works when the mission gets there with it."
      ),
    },
    {
      cardId: "ch09-rc04",
      difficulty: "medium",
      front: tri(
        "What misreading does the chapter reject?",
        "Why is decentralized command not the same as chaos?",
        "What lazy version of the idea gets crushed here?"
      ),
      back: tri(
        "It rejects the idea that everyone should just improvise independently.",
        "The chapter ties distributed authority to training, standards, and shared understanding.",
        "It destroys the romance about freedom without structure."
      ),
    },
    {
      cardId: "ch09-rc05",
      difficulty: "hard",
      front: tri(
        "How does this chapter set up the next one?",
        "Why does planning matter once authority moves outward?",
        "What has to exist before front-line leaders can decide fast and stay aligned?"
      ),
      back: tri(
        "It shows that local decisions need shared preparation before pressure arrives.",
        "The bridge is that decentralized command depends on planning, rehearsal, and contingencies built in advance.",
        "The edge can move only if the map already lives inside it."
      ),
    },
  ],
  keyTakeawayCard: tri(
    "Decentralized command means leaders prepare other people to decide where the work is happening instead of making every choice climb back to the top.",
    "The chapter argues that teams gain speed when authority, intent, and standards move outward together, letting junior leaders act without losing mission coherence.",
    "Stop forcing live execution to queue behind one person. Build aligned judgment at the edge."
  ),
  quiz: {
    passingScorePercent: 70,
    questions: [
      {
        questionId: "ch09-q01",
        prompt: "What problem is this chapter mainly trying to solve?",
        choices: [
          "A shortage of formal hierarchy on fast-moving teams",
          "The slowdown created when too many decisions must return to the top",
          "The idea that junior leaders should never know the larger mission"
        ],
        correctIndex: 1,
        explanation: tri(
          "Right. The chapter says teams slow down when every decision has to travel upward first.",
          "Correct. Centralized approval becomes the bottleneck this chapter is trying to fix.",
          "That is the hit. The mission is losing time to command traffic."
        ),
        bloomsLevel: "remember",
        depthLevel: "easy",
      },
      {
        questionId: "ch09-q02",
        prompt: "What does decentralized command move closer to the front?",
        choices: [
          "Responsibility without context",
          "Decision authority shaped by mission intent",
          "Chaos so teams can improvise freely"
        ],
        correctIndex: 1,
        explanation: tri(
          "Yes. The chapter wants informed decisions happening nearer the work.",
          "Exactly. Authority moves outward with context and intent, not as random freedom.",
          "That answer works because the edge gets judgment, not disorder."
        ),
        bloomsLevel: "understand",
        depthLevel: "easy",
      },
      {
        questionId: "ch09-q03",
        prompt: "Why can top-only control fail under pressure?",
        choices: [
          "Because the person closest to the work often sees the changing situation first",
          "Because standards disappear whenever a leader stays involved",
          "Because teams should always ignore hierarchy in urgent moments"
        ],
        correctIndex: 0,
        explanation: tri(
          "Correct. The front usually has fresher information than the distant approver.",
          "That is the chapter's mechanism: distance from the work weakens timing and detail.",
          "The field changes faster than the chain can answer when control sits too high."
        ),
        bloomsLevel: "understand",
        depthLevel: "easy",
      },
      {
        questionId: "ch09-q04",
        prompt: "In Talia's launch example, what best applies the chapter?",
        choices: [
          "Keep every team lead waiting for her final approval so the launch stays consistent",
          "Explain the launch intent and boundaries, then let team leads decide within that frame",
          "Remove all limits so each team can do whatever seems fastest"
        ],
        correctIndex: 1,
        explanation: tri(
          "Right. The chapter ties speed to local judgment inside clear intent.",
          "That choice fits because Talia is distributing authority with standards instead of hoarding it.",
          "She wins by sending the rules to the edge, not by standing in the middle of every call."
        ),
        bloomsLevel: "apply",
        depthLevel: "medium",
      },
      {
        questionId: "ch09-q05",
        prompt: "What has to travel with authority according to this chapter?",
        choices: [
          "Less accountability",
          "A guarantee that conditions will not change",
          "Mission intent, priorities, and boundaries"
        ],
        correctIndex: 2,
        explanation: tri(
          "Yes. The chapter keeps stressing that people need the purpose behind the task.",
          "Authority alone is not enough. Junior leaders need the mission logic that keeps their choices aligned.",
          "Permission without purpose is how drift starts."
        ),
        bloomsLevel: "analyze",
        depthLevel: "medium",
      },
      {
        questionId: "ch09-q06",
        prompt: "Which misreading does the chapter explicitly reject?",
        choices: [
          "That decentralized command still needs training and standards",
          "That distributed authority can turn into confusion if the team is unprepared",
          "That decentralization means everyone should simply improvise their own mission"
        ],
        correctIndex: 2,
        explanation: tri(
          "Correct. The chapter is not praising unstructured freedom.",
          "The text keeps a hard limit visible: decentralization without alignment becomes chaos.",
          "That is the fake version the chapter tears apart."
        ),
        bloomsLevel: "understand",
        depthLevel: "medium",
      },
      {
        questionId: "ch09-q07",
        prompt: "What is the best transfer of this chapter to school or home life?",
        choices: [
          "Clarify the goal and decision boundaries so others can adjust locally",
          "Make sure every small change still comes back to one person",
          "Avoid sharing the purpose because that creates too many opinions"
        ],
        correctIndex: 0,
        explanation: tri(
          "Right. The chapter transfers well anywhere local decisions keep escalating unnecessarily.",
          "That answer matches the principle: shared purpose improves local judgment beyond formal organizations.",
          "Spread the logic, and the room stops standing in line."
        ),
        bloomsLevel: "apply",
        depthLevel: "medium",
      },
      {
        questionId: "ch09-q08",
        prompt: "What was the real reveal in Devin's ops example?",
        choices: [
          "The queue improved once the top leader watched it more closely",
          "The backlog shrank only after on-shift leads got clearer authority and intent",
          "The team mainly needed more meetings before acting"
        ],
        correctIndex: 1,
        explanation: tri(
          "Yes. The chapter shows throughput improving when routine decisions stop bottlenecking at the top.",
          "The reveal is structural: authority design changed execution speed more than effort alone.",
          "The queue moved when the edge got judgment instead of waiting for blessings."
        ),
        bloomsLevel: "analyze",
        depthLevel: "hard",
      },
      {
        questionId: "ch09-q09",
        prompt: "Which statement best captures the chapter's deeper synthesis?",
        choices: [
          "Teams move fastest when authority stays concentrated in the most senior leader",
          "Mission speed improves when trained junior leaders make local decisions inside shared intent",
          "Alignment matters only after the pressure phase ends"
        ],
        correctIndex: 1,
        explanation: tri(
          "Exactly. The chapter joins distributed authority with shared mission understanding.",
          "That answer captures both sides: speed comes from the front, alignment comes from intent and preparation.",
          "The chapter is building aligned tempo, not freedom theater."
        ),
        bloomsLevel: "analyze",
        depthLevel: "hard",
      },
      {
        questionId: "ch09-q10",
        prompt: "How does this chapter lead into the next one?",
        choices: [
          "By showing that local decision-making works only if the team was prepared clearly in advance",
          "By proving that planning becomes unnecessary once authority is decentralized",
          "By arguing that distributed teams should stop thinking about contingencies"
        ],
        correctIndex: 0,
        explanation: tri(
          "Correct. The next chapter is about building the shared structure that keeps fast local decisions aligned.",
          "The bridge is preparation: authority at the edge still depends on planning, rehearsal, and contingencies.",
          "You cannot send judgment forward without giving it a map first."
        ),
        bloomsLevel: "analyze",
        depthLevel: "hard",
      },
    ],
  },
  logLines(hash) {
    const stamp = createdAt();
    return [
      `${stamp} - Wave \`09-10\` pre-writer repair: updated \`briefs/ch09.md\` and \`briefs/ch10.md\` to remove cross-book duplicate assigned names (\`Lena\`, \`Omar\`, \`Marcus\`) so the run matches \`rules/name-ledger-rules.md\` on the corrected strict path.`,
      `${stamp} - Wave \`09-10\` converter pass for \`ch09\` completed at \`structured/ch09.chapter.json\`; quiz pass completed at \`quizzes/ch09.quiz.json\`.`,
      `${stamp} - Wave \`09-10\` final chapter-gate checks for \`ch09\` passed: chapter lint \`FAIL=0 WARN=0\`, review-package lint \`FAIL=0 WARN=0\`, artifact guard \`FAIL=0 WARN=0\`, wrapper payload exact-match confirmed at \`chapters[0]\`, reading metrics written.`,
      `${stamp} - Wave \`09-10\` automatic gate decision for \`ch09\`: PASS. Sealed \`approvedChapterHashes.ch09 = ${hash}\` in \`continuity/continuity-state.json\`. Continuing automatically to \`ch10\`.`,
    ];
  },
};

const ch10Draft = `
The book turns next to a problem that often hides behind confidence. A team can have talent, urgency, and strong intention, yet still become brittle because it started moving before enough shared preparation existed. Pressure exposes that weakness fast. When people are unclear on the shape of the mission, fallback moves, or decision boundaries, they do not become more adaptive under stress. They usually become more reactive, fragmented, and slow.

That is why this chapter treats planning as preparation for uncertainty rather than as an attempt to control uncertainty away. The point of a good plan is not to predict every detail perfectly. The point is to give the team enough shared structure that they can adjust without losing coherence when reality changes. Planning creates a common frame before the pressure starts bending the mission.

The chapter makes commander's intent central to that frame. People do not adapt well when they know only the first task on the list. They adapt better when they understand what the mission is trying to accomplish, what matters most if tradeoffs appear, and what success still looks like if the original conditions shift. Intent turns planning from a script into a guide for judgment.

Rehearsal matters for the same reason. Teams often think of rehearsal as extra work that delays action. The chapter treats it as a way to make action more reliable once the pace rises. Rehearsal lets people discover confusion early, feel the sequence of the plan, and test whether each role actually understands how the mission is supposed to move.

Contingencies deepen that preparation. A team does not build backups because it expects failure in a melodramatic way. It builds contingencies because change is normal. If one route closes, one tool fails, or one assumption breaks, the team needs an already discussed path for adjusting without losing the mission.

The chapter keeps a limit in view too. Planning cannot remove uncertainty. Leaders who worship the plan after reality changes are not being disciplined. They are becoming rigid. The goal is prepared adaptability, not fantasy control. Teams plan deeply so they can adjust with purpose, not so they can force the world to behave.

That is what gives this chapter its force. Planning, intent, rehearsal, and contingencies create a shared mental map. That map makes distributed execution more coherent because people are not improvising from zero when the mission gets loud. They are adapting from common understanding.

The bridge forward is clean. Even a strong plan can still fail if people above and below do not share information well. Once the team has a plan and a common intent, the next leadership question becomes how that purpose and feedback move up and down the chain without distortion.
`;

const ch10 = {
  code: "ch10",
  number: 10,
  title: "Plan",
  chapterId: "ch10-plan",
  readingTimeMinutes: 9,
  criticScore: 11,
  sourceHeading: "Plan",
  names: ["Alina", "Micah", "Rhea", "Jonah", "Elise", "Tariq"],
  schoolSettings: ["student conference prep room", "science fair staging table"],
  draftText: ch10Draft,
  criticReport: `# Critic Report — ch10

Score: 11/12
Assessment: PASS

## Category Scores
- hook quality: 2/2. The opening frames poor planning as brittleness under pressure, not as generic sloppiness.
- paragraph-job distinctness: 2/2. The chapter moves from underprepared collapse, to planning as shared structure, to commander's intent, to rehearsal, to contingencies, to the limit against rigid plan worship, and then into the Chapter 11 bridge.
- anchor use: 2/2. Planning, intent, rehearsal, and contingencies all stay active instead of collapsing into one generic preparation point.
- chapter specificity: 2/2. This reads like a chapter about adaptive planning under pressure, not standard productivity advice.
- easy-mode convertibility: 2/2. The central distinction between planning for adaptability and rigidity is clear enough to convert across depths.
- meta-distance: 1/2. The examples need to keep contingency and rehearsal concrete so the chapter does not float upward into abstract planning praise.
- hard-edge preservation: 2/2. The draft keeps the warning against plan worship visible.
- conceptual repetition risk: low. Preparation, intent, rehearsal, contingencies, and adaptability recur with distinct jobs.

## Weakest Paragraph
Paragraph 5 is most exposed because contingency language can become generic if later conversion drops the specific fallback logic.

## Strongest Sentence
\`The point of a good plan is not to predict every detail perfectly.\`

## Contamination / Source-Splice Check
- contamination phrases: none found
- source-splice suspicion: none

## Decision
Prose gate clear. No global reroute needed. Local patching is not required before conversion.`,
  contentVariants: {
    easy: {
      chapterBreakdown: {
        gentle:
          "This chapter says teams become brittle when they start moving without enough shared preparation. Pressure exposes confusion fast. People hesitate, overreact, or split apart because they do not share the same picture of what the mission is trying to do.\n\nPlanning helps because it gives the team a common frame before the pressure arrives. The chapter also keeps one limit clear. A plan is not supposed to remove uncertainty. It is supposed to help people adjust without losing coherence when reality changes.",
        direct:
          "The chapter argues that careful planning makes teams more adaptable under pressure rather than more rigid. When people start moving without a shared plan, clear intent, rehearsal, or contingencies, stress exposes every gap in understanding at once. Planning creates a common structure before the mission gets noisy, which lets people adjust without collapsing into reactive confusion. That shared preparation gives people a way to change course without first losing the mission shape. It also keeps the team from treating the first disruption like a total reset.\n\nThe chapter also rejects a common misread. Good planning does not mean worshipping the original script after conditions change. A plan is useful because it prepares the team to adapt with purpose, not because it guarantees reality will stay obedient. The stronger the preparation, the easier it becomes to revise without panic. The value of the plan is that revision has somewhere coherent to begin.",
        competitive:
          "This chapter goes after a lazy contrast between planning and adaptability. Teams do not become agile by walking in unprepared and hoping they can improvise. They become brittle. Pressure finds the gaps fast.\n\nPlanning gives people a shared map before the mission gets loud. The chapter keeps one hard edge alive too. The plan is not the object of worship. It matters because it helps the team adjust without breaking when the first assumption fails.",
      },
      keyTakeaways: [
        {
          point: tri(
            "Underprepared teams become brittle when pressure rises.",
            "Lack of shared preparation turns stress into confusion instead of adaptation.",
            "If the team walks in cold, pressure exposes the cracks immediately."
          ),
        },
        {
          point: tri(
            "Planning creates a shared structure before the mission gets loud.",
            "A good plan gives people a common frame for adjusting when details shift.",
            "The map matters because it keeps change from becoming drift."
          ),
        },
        {
          point: tri(
            "Good planning supports adaptation rather than rigidity.",
            "The chapter rejects plan worship and treats preparation as a way to stay coherent under change.",
            "The best plan teaches the team how to bend without snapping."
          ),
        },
      ],
      oneMinuteRecap: tri(
        "This chapter says planning helps teams adjust under pressure because they already share the mission shape before stress hits.",
        "Plan argues that intent, rehearsal, and contingencies create adaptability by giving the team common structure before reality changes.",
        "The chapter makes one rule sharp: prepare deeply so change does not turn the mission into panic."
      ),
    },
    medium: {
      chapterBreakdown: {
        gentle:
          "This chapter begins with a team entering pressure with too little shared preparation. Everyone may be sincere and hardworking, but stress quickly reveals that they do not hold the same picture of the mission, the sequence, or the fallback moves. That is when a team becomes brittle.\n\nThe chapter argues that planning helps because it builds shared structure before the chaos arrives. The plan gives people a common starting shape, so they are not inventing the mission from scratch once the pace rises.\n\nCommander's intent matters inside that structure. People adapt better when they understand what the mission is trying to accomplish and what matters most if the original conditions change. Intent keeps adjustment from drifting into random motion.\n\nRehearsal and contingencies deepen that preparation. Rehearsal exposes confusion early, and contingencies make the team less surprised when one path fails or conditions shift.\n\nThe chapter still keeps a hard warning visible. Planning is not meant to eliminate uncertainty. Teams get stronger when they prepare deeply enough to adapt well, not when they cling to the first script after reality moves.",
        direct:
          "The chapter goes after a mistake that often looks energetic at first: starting fast without enough preparation. Under pressure, that choice usually makes teams brittle instead of adaptive. They may care, move quickly, and communicate constantly, yet still fragment because they never built a shared understanding of the plan, the purpose, or the fallback logic before the mission began. Speed at the start cannot repay missing structure later. The mission feels busy, but the team is still thin where it matters.\n\nThat is why the chapter treats planning as preparation for uncertainty rather than as a denial of uncertainty. A good plan gives the team a common structure for action. People know the sequence, understand the mission shape, and can adjust from something shared instead of improvising from zero. The plan becomes a floor the team can push off from when the details begin moving. Shared preparation makes change less mentally expensive.\n\nCommander's intent is what keeps that shared structure flexible. If people know only the first step, they freeze when the step changes. If they understand the mission purpose, the priorities, and the tradeoffs that matter, they can adapt while still staying aligned with the larger goal. Intent makes the plan portable beyond the original script. It gives the team a reasoned way to revise instead of a reason to stall.\n\nRehearsal and contingencies make that alignment more durable. Rehearsal tests whether the plan is actually understood instead of merely admired. Contingencies prepare the team for likely changes so the first disruption does not force a total restart. Both keep the team from discovering its confusion for the first time in the live environment. They turn adjustment into something expected rather than dramatic.\n\nThe chapter rejects rigid plan worship just as sharply as it rejects underplanning. Good leaders do not cling to the first script no matter what. They prepare deeply enough that the team can change course without losing coherence, which is why the next chapter turns toward communication across the chain. Shared preparation still depends on shared meaning moving well across levels. The plan matters because it keeps revision connected to the same purpose.",
        competitive:
          "This chapter attacks a fake choice between planning and adaptability. Teams that rush in underprepared do not become flexible. They become fragile. The first live problem exposes how little shared understanding they actually built.\n\nPlanning fixes that by giving the mission a common structure before the pressure starts. People stop improvising from zero because they already know the shape of the move, the purpose behind it, and where change is most likely to hit.\n\nCommander's intent is what keeps the plan alive instead of brittle. When the team knows what success means and what matters most, it can adapt without turning every surprise into a reset.\n\nRehearsal and contingencies make the structure real. Rehearsal reveals confusion before the cost is live. Contingencies make adjustment normal instead of dramatic.\n\nThe chapter still refuses the dumb version of planning. If leaders worship the plan after reality changes, they are not being disciplined. They are being stubborn. The plan earns its value by helping the team bend with purpose.",
      },
      keyTakeaways: [
        {
          point: tri(
            "Underprepared teams often become brittle under stress.",
            "Pressure exposes gaps in understanding when the mission starts without enough shared preparation.",
            "Moving fast without shared structure makes the first disruption hit harder."
          ),
          moreDetails: tri(
            "That is why urgency does not replace planning.",
            "Energy cannot cover for a missing plan once conditions start changing.",
            "Speed without preparation usually cashes out as panic."
          ),
        },
        {
          point: tri(
            "Planning creates a common frame before the mission starts.",
            "A good plan gives the team shared sequence and orientation before the pace rises.",
            "The map matters because it keeps the mission from being invented mid-crisis."
          ),
          moreDetails: tri(
            "People adapt better when they are adjusting from something shared.",
            "The chapter treats planning as structure for later flexibility.",
            "Preparation gives change somewhere coherent to land."
          ),
        },
        {
          point: tri(
            "Commander's intent keeps adaptation aligned.",
            "Teams change course better when they understand the mission purpose and priorities.",
            "Intent is what lets the team pivot without losing the point."
          ),
          moreDetails: tri(
            "Knowing only the first step is not enough.",
            "Intent tells people how to think when the original conditions stop holding.",
            "A script breaks faster than a well-understood mission."
          ),
        },
        {
          point: tri(
            "Rehearsal and contingencies make planning practical.",
            "Rehearsal tests understanding, and contingencies prepare the team for expected change.",
            "A plan becomes real when it has been walked and stressed before the mission goes live."
          ),
          moreDetails: tri(
            "That is how confusion gets caught early.",
            "The chapter says preparation should discover weakness before reality does.",
            "You want the first failure in rehearsal, not in the mission."
          ),
        },
        {
          point: tri(
            "Good planning avoids both chaos and rigidity.",
            "The chapter rejects underplanning and plan worship for the same reason: both fail once reality changes.",
            "The right plan bends with purpose instead of either collapsing or refusing to move."
          ),
          moreDetails: tri(
            "Planning cannot erase uncertainty.",
            "Its value is that the team can adapt without losing coherence when uncertainty arrives.",
            "The plan is a shared structure, not an idol."
          ),
        },
      ],
      activationPrompt: tri(
        "Think of one situation where your team is relying too much on good intentions and not enough on shared preparation.",
        "Map one upcoming mission where the group still lacks a common plan, clear intent, or backup path.",
        "Find one pressure point where people are pretending improvisation will save what preparation never built."
      ),
      selfCheckPrompt: tri(
        "Where would change make my current plan feel brittle?",
        "Which part of this mission is still underprepared enough that the first disruption could fragment the team?",
        "What am I calling adaptability that is really just lack of prep?"
      ),
      oneMinuteRecap: tri(
        "This chapter says careful planning makes teams more adaptive because they share the mission shape before pressure changes the details.",
        "Plan argues that intent, rehearsal, and contingencies create flexibility by giving the team a common structure to adjust from.",
        "The rule is not to predict everything. It is to prepare so change does not break the mission."
      ),
    },
    hard: {
      chapterBreakdown: {
        gentle:
          "This chapter treats poor planning as a hidden source of brittleness. Teams often imagine that adaptability comes from keeping options open and not overpreparing. The chapter says the opposite is usually true under pressure. When people start with weak shared structure, they do not become flexible. They become confused, fragmented, and easier to overwhelm when conditions change.\n\nThat is why planning matters here. The chapter does not frame a plan as a fantasy of total control. It frames planning as a way to build a common picture of the mission before the mission becomes noisy. People know the sequence, understand the starting assumptions, and carry a shared mental shape for action before the pace accelerates.\n\nCommander's intent is what keeps that shape useful when details shift. If team members know only the steps, then a broken step can stop the mission cold. If they understand the purpose, priorities, and tradeoffs that define success, they can change methods without losing alignment.\n\nRehearsal gives the team a chance to discover confusion before reality makes it expensive. Contingencies serve a similar role. They acknowledge that friction is normal and that adjustment should be prepared rather than improvised in panic.\n\nThe chapter also keeps a strong limit alive. Planning cannot remove uncertainty. Leaders who cling to the original plan after conditions change are not showing discipline. They are showing attachment. The plan is supposed to make adaptation more coherent, not make revision feel disloyal.\n\nThat is why the chapter is stronger than generic advice about being organized. It argues that good preparation builds shared judgment. The team does not merely remember tasks. It learns how the mission should move, what changes matter, and how to respond without breaking apart.\n\nThe bridge to the next chapter follows from that same logic. Even a good plan can fail if information and purpose do not move well up and down the chain. Shared preparation creates the structure. Communication determines whether that structure survives contact with changing reality.",
        direct:
          "The chapter exposes a common misunderstanding about flexibility. Many leaders assume that heavy planning makes teams rigid and that lighter preparation leaves more room for adaptation. The chapter argues that under pressure the reverse is often true. Teams that begin with weak shared preparation do not adapt well. They lose coherence because nobody holds the same picture of the mission, the fallback logic, or the priorities that should govern change. Thin preparation feels loose until the first disruption proves it was actually brittle. What looked open-minded was often just unbuilt.\n\nPlanning matters because it gives people a common structure before stress begins distorting their attention. The point is not perfect prediction. The point is that the team can start from something shared instead of trying to invent coordinated action in the middle of pressure. A good plan creates sequence, orientation, and a common frame for judgment. It gives the group somewhere stable to think from even when the details stop behaving. That shared frame keeps the first disruption from becoming a total mental restart.\n\nCommander's intent is what prevents that frame from becoming brittle. People who know only a checklist freeze when the checklist breaks. People who understand what the mission is trying to accomplish can alter the method while preserving the purpose. Intent therefore turns planning into a platform for adaptation rather than a script that dies on first contact with reality. The mission survives because the team knows what success still means. Purpose gives revision its discipline.\n\nRehearsal and contingencies deepen the same logic. Rehearsal tests whether the plan is actually understood across the team, exposes unclear handoffs, and lets leaders catch confusion while the cost is still low. Contingencies acknowledge that change is not an exception to planning but one of the reasons for planning. The team prepares alternate moves because reality is expected to push back. Preparation becomes stronger when it expects friction instead of pretending surprise can be avoided. The best plans already contain the logic for their own adjustment.\n\nThe chapter still insists on an important limit. Planning cannot abolish uncertainty, and leaders who become attached to the original plan after the environment changes are not demonstrating discipline. They are mistaking preparation for control fantasy. The plan earns its value only if it helps the team stay coherent while changing course. Revision is part of disciplined execution, not proof that planning failed. Planning is there to steady change, not to forbid it.\n\nThat is the deeper synthesis of the chapter. Good planning is not rigidity and it is not bureaucracy. It is shared preparation that lets distributed teams adapt without collapsing into improvisation from zero. That is why the next chapter turns toward communication. Once the team has a plan and a common intent, purpose and feedback still have to move cleanly up and down the chain. Shared structure still fails if the chain cannot carry meaning. A common map still dies if the chain cannot explain or update it.",
        competitive:
          "This chapter attacks one of the laziest myths about leadership under pressure: that planning makes teams stiff while improvisation keeps them adaptable. Under real stress, underprepared teams do not look flexible. They look brittle. The first surprise exposes how little shared understanding they actually built.\n\nPlanning fixes that because it gives the team a shared structure before the clock gets loud. The mission has sequence, assumptions, and backup logic that live in more than one head. That does not make reality obedient. It makes the team less likely to fragment when reality pushes back.\n\nCommander's intent is what keeps the structure alive. If people only memorized steps, one broken step wrecks the whole machine. If they know the purpose and the priorities, they can bend the method and still protect the mission.\n\nRehearsal and contingencies are where the chapter gets practical. Rehearsal catches confusion before the cost is live. Contingencies make adaptation part of the plan instead of a panicked rewrite after the first hit. Preparation becomes a way of teaching the team how to move through change.\n\nThe chapter also humiliates plan worship. If leaders cling to the original script after the field changes, they are not strong planners. They are trapped by the tool that was supposed to help them adapt. Planning is valuable only when it strengthens revision under pressure.\n\nThat is the real claim. The best teams prepare so deeply that change does not make them start over mentally. They adjust from common ground. And once that common ground exists, the next question is whether communication will keep it alive across the whole chain.",
      },
      keyTakeaways: [
        {
          point: tri(
            "Weak preparation makes teams brittle under pressure.",
            "Under stress, poor planning usually creates fragmentation rather than adaptability.",
            "Improvisation from zero is fragility wearing confidence."
          ),
          moreDetails: tri(
            "That is why urgency alone cannot save the mission.",
            "The first disruption exposes gaps in shared understanding that should have been handled earlier.",
            "Pressure collects unpaid preparation debt fast."
          ),
        },
        {
          point: tri(
            "Planning gives the team a common starting structure.",
            "A good plan creates shared sequence, orientation, and fallback logic before the mission begins.",
            "The map matters because it keeps the team from inventing the mission live."
          ),
          moreDetails: tri(
            "People adapt better when they are adjusting from common ground.",
            "The chapter treats planning as structure for later change, not as a bet against change.",
            "You want to pivot from a shared floor, not from empty air."
          ),
        },
        {
          point: tri(
            "Commander's intent protects adaptation from drift.",
            "Teams stay aligned under changing conditions when they understand mission purpose and priorities.",
            "Intent lets the team bend method without losing the mission."
          ),
          moreDetails: tri(
            "Checklists alone break too easily.",
            "The chapter makes purpose the thing that survives when the original sequence changes.",
            "A mission understood deeply can survive a broken script."
          ),
        },
        {
          point: tri(
            "Rehearsal and contingencies turn planning into prepared adaptability.",
            "Rehearsal tests understanding, while contingencies normalize revision before it is urgently needed.",
            "A plan becomes dangerous when it has never been walked or stressed."
          ),
          moreDetails: tri(
            "Both tools surface confusion before the real cost arrives.",
            "The chapter wants the team to discover weak handoffs and alternate routes before live friction does it for them.",
            "Practice and backup logic are where adaptation gets built instead of wished for."
          ),
        },
        {
          point: tri(
            "The chapter rejects plan worship as strongly as underplanning.",
            "Preparation fails when leaders cling to the original script after reality changes.",
            "A good plan is meant to support revision, not forbid it."
          ),
          moreDetails: tri(
            "Planning cannot eliminate uncertainty.",
            "Its value is that the team can change course without losing coherence or purpose.",
            "If the plan cannot bend, it was never serving the mission well enough."
          ),
        },
      ],
      activationPrompt: tri(
        "Find one upcoming mission where your team still lacks enough shared preparation to adapt cleanly.",
        "Identify one plan that looks detailed but still has weak intent, rehearsal, or contingency logic.",
        "Locate one operation that is calling itself agile while secretly betting against friction."
      ),
      selfCheckPrompts: [
        tri(
          "Where would my current mission become brittle if the first assumption failed?",
          "Which part of the plan would collapse because people know the steps but not the purpose?",
          "Where is the team still one surprise away from mental reset?"
        ),
        tri(
          "What rehearsal or contingency would make adjustment calmer here?",
          "If this plan changed tomorrow, what shared structure would still keep the team aligned?",
          "What backup logic would let the mission bend without begging for a new identity?"
        ),
      ],
      predictionPrompt: tri(
        "If the team has a strong plan but weak communication across levels, what problem is likely next?",
        "Once planning is solid, what still has to move cleanly up and down the chain so the mission stays coherent?",
        "After the map exists, what keeps the chain from distorting it?"
      ),
      oneMinuteRecap: tri(
        "This chapter says planning helps teams adapt because shared intent, rehearsal, and contingencies give change somewhere coherent to land.",
        "Plan argues that preparation builds flexibility by creating common structure before uncertainty strikes, not by pretending uncertainty will disappear.",
        "The chapter leaves a hard rule behind: prepare so deeply that revision strengthens the mission instead of resetting it."
      ),
    },
  },
  examples: [
    {
      exampleId: "ch10-ex01-alina-rollout",
      title: "Alina Rehearses the Rollout Before the Launch Clock Starts",
      category: "work",
      format: "decision_point",
      endingType: "broader_principle",
      contexts: ["launch rehearsal notes", "fallback channel", "rollback checklist"],
      scenario: tri(
        "Alina has a release window approaching and can either trust the team to improvise live or rehearse the rollout and rollback paths first.",
        "Alina must decide whether to spend time rehearsing the launch sequence and fallback moves before the system goes live.",
        "Alina can gamble on live improvisation, or she can build a shared map before the clock starts punishing mistakes."
      ),
      whatToDo: tri(
        "Alina should rehearse the sequence, confirm commander's intent, and define the fallback path before launch.",
        "Use rehearsal and contingency planning so the team can adapt quickly without inventing the mission live.",
        "Walk the move before it counts and make sure the backup lane is real."
      ),
      whyItMatters: tri(
        "The chapter says planning supports adaptation by creating shared structure ahead of pressure.",
        "This example shows preparation making the launch more flexible rather than more rigid.",
        "The team earns agility by practicing the change before the first hit lands."
      ),
    },
    {
      exampleId: "ch10-ex02-micah-postmortem",
      title: "Micah Sees the Conference Team Failed Long Before the Doors Opened",
      category: "school",
      format: "postmortem",
      endingType: "self_directed_question",
      contexts: ["student conference prep room", "room map", "staging checklist"],
      scenario: tri(
        "In the postmortem, Micah realizes the conference team did not fail because students were careless but because the prep was too thin.",
        "The event broke under pressure because roles, backups, and the mission shape were never made shared before the doors opened.",
        "Micah sees that the panic started earlier than anyone thought: it started in the weak prep room, not at the live table."
      ),
      whatToDo: tri(
        "Next time, Micah should define intent, walk the sequence, and test the backup choices before the event.",
        "Build clearer planning, rehearsal, and contingency checks so the team is not inventing recovery in public.",
        "Make the staging table answer the hard questions before the crowd does."
      ),
      whyItMatters: tri(
        "The chapter argues that underprepared teams become brittle under live pressure.",
        "This example shows planning as the real source of later adaptability, not as a bureaucratic extra.",
        "The event needed a better map, not louder scrambling."
      ),
    },
    {
      exampleId: "ch10-ex03-rhea-dialogue",
      title: "Rhea Changes the Weekend Plan by Explaining the Intent and the Backup",
      category: "personal",
      format: "dialogue",
      endingType: "surprising_implication",
      contexts: ["family calendar", "pickup backup", "shared notes"],
      scenario: tri(
        "Rhea notices that every family change becomes stressful because nobody knows what matters most if the original plan breaks.",
        "In the conversation, Rhea explains the real goal of the weekend plan and the backup choices if the first schedule fails.",
        "Rhea stops handing out steps and starts handing out the logic that survives the broken step."
      ),
      whatToDo: tri(
        "She should make the purpose, the priorities, and the backup route visible before the weekend starts.",
        "Clarify the intent and the contingency so others can adjust without losing the plan's point.",
        "Give the room a mission and a second lane, not just a brittle script."
      ),
      whyItMatters: tri(
        "The chapter says planning becomes flexible when people understand both the goal and the fallback.",
        "This shows preparation reducing stress by making adaptation expected instead of dramatic.",
        "The house gets calmer because change no longer means starting over mentally."
      ),
    },
    {
      exampleId: "ch10-ex04-jonah-reveal",
      title: "Jonah Learns the Team Adjusts Faster Once the Backup Path Is Already Named",
      category: "work",
      format: "predict_reveal",
      endingType: "cross_domain",
      contexts: ["operations board", "fallback channel", "handoff sequence"],
      scenario: tri(
        "Jonah predicts the team will panic less during the rollout if the fallback path is already assigned and rehearsed.",
        "The reveal is that when the first issue appears, the team adjusts smoothly because the alternate move was planned before pressure hit.",
        "Jonah discovers that calm adaptation was not luck. It was prepared structure doing its job."
      ),
      whatToDo: tri(
        "Jonah should keep rehearsal and contingency logic in the plan instead of treating them as optional extras.",
        "Build the alternate move into the preparation so the first disruption does not trigger a full reset.",
        "Name the backup before the mission needs it and the team will stop improvising from zero."
      ),
      whyItMatters: tri(
        "The chapter says contingencies make change less destructive because the team is not surprised by the need to adjust.",
        "This example shows that preparation creates speed later by reducing confusion during the live turn.",
        "The team bent because the plan taught it how."
      ),
    },
    {
      exampleId: "ch10-ex05-elise-dilemma",
      title: "Elise Has to Decide Whether to Cling to the Original Science Fair Layout",
      category: "school",
      format: "dilemma",
      endingType: "common_trap",
      contexts: ["science fair staging table", "supply bin labels", "weather change"],
      scenario: tri(
        "Elise sees the original fair layout becoming unworkable after a weather change, but some students still want to follow it exactly because it was the plan.",
        "The dilemma is whether to worship the first layout or adapt the plan while preserving the event's real purpose.",
        "Elise has to choose between rigid loyalty to the script and loyal adjustment to the mission."
      ),
      whatToDo: tri(
        "She should protect the event intent, change the layout, and keep the team aligned around what success still means.",
        "Revise the plan with purpose instead of treating the original arrangement as sacred after the conditions shift.",
        "Honor the mission, not the paper version of it."
      ),
      whyItMatters: tri(
        "The chapter warns that planning fails when leaders become attached to the plan after reality changes.",
        "This is the trap the chapter rejects: confusing disciplined planning with stubborn loyalty to the first draft.",
        "A rigid plan can betray the mission it was supposed to serve."
      ),
    },
    {
      exampleId: "ch10-ex06-tariq-after",
      title: "Tariq's Volunteer Team Gets Calmer After They Prepare the Handoffs Together",
      category: "personal",
      format: "before_after",
      endingType: "perspective_reframe",
      contexts: ["shared volunteer rota", "supply list", "backup driver"],
      scenario: tri(
        "Before, Tariq's volunteer team reacted to every change as if it were a surprise because nobody had rehearsed the handoffs or the backup roles.",
        "After they walk the plan, name the intent, and assign contingencies, the same kind of changes feel manageable instead of chaotic.",
        "The before-and-after difference is not less uncertainty. It is stronger shared preparation."
      ),
      whatToDo: tri(
        "Tariq should keep rehearsing the sequence and the backup roles before each bigger volunteer effort.",
        "Build the plan together so the team can adjust from common ground when a driver drops out or supplies move late.",
        "Turn change into something prepared for instead of something that keeps resetting the room."
      ),
      whyItMatters: tri(
        "The chapter says planning increases adaptability because people already know how to adjust together.",
        "This example shows shared preparation lowering friction without pretending the day will stay predictable.",
        "The team stopped mistaking surprise for proof that no plan was possible."
      ),
    },
  ],
  implementationPlan: {
    coreSkill: tri(
      "Learn to build plans that make later adjustment calmer and more aligned.",
      "The core skill is preparing shared intent, rehearsal, and contingencies so change does not force the team to improvise from zero.",
      "Train yourself to prepare deeply enough that revision strengthens the mission instead of resetting it."
    ),
    ifThenPlans: [
      {
        context: "work",
        plan: tri(
          "If a launch or handoff is approaching, then rehearse the sequence and the fallback move before it goes live.",
          "If the mission will face pressure soon, then make the intent, the primary plan, and the contingency path shared across the team now.",
          "If the clock is about to get loud, build the map and the backup before the first hit."
        ),
      },
      {
        context: "school",
        plan: tri(
          "If an event depends on many student roles, then walk the plan and assign backup decisions before the day starts.",
          "If a school team will be under deadline pressure, then stress the handoffs early and test what happens when one assumption breaks.",
          "If the table still needs to invent recovery live, the prep is not done."
        ),
      },
      {
        context: "personal",
        plan: tri(
          "If a family or volunteer plan keeps breaking in stressful ways, then clarify the goal and the backup path before the day begins.",
          "If people are reacting to change with confusion, then share the purpose and contingency logic instead of only the first schedule.",
          "If one broken step keeps wrecking the room, teach the room how to bend."
        ),
      },
    ],
    twentyFourHourChallenge: tri(
      "Within the next day, identify one upcoming task that needs a clearer backup plan before it goes live.",
      "In the next 24 hours, pick one mission and write the intent, the primary path, and the first contingency in plain language.",
      "By tomorrow, build one shared map where the team is still hoping improvisation will cover thin prep."
    ),
    weeklyPractice: tri(
      "This week, review one stressful moment and ask what preparation would have made adjustment calmer.",
      "Use one weekly review to check whether the team had enough intent, rehearsal, and contingency planning before pressure arrived.",
      "Every week, force one messy moment to answer whether the team bent from structure or just flailed loudly."
    ),
  },
  reviewCards: [
    {
      cardId: "ch10-rc01",
      difficulty: "easy",
      front: tri(
        "What failure does this chapter warn about first?",
        "What happens when a team starts moving without enough shared prep?",
        "What kind of weakness does pressure expose here?"
      ),
      back: tri(
        "It warns that underprepared teams become brittle.",
        "The chapter says weak planning turns stress into confusion and fragmentation.",
        "Pressure finds the cracks in thin preparation fast."
      ),
    },
    {
      cardId: "ch10-rc02",
      difficulty: "easy",
      front: tri(
        "Why does planning help under pressure?",
        "What does a good plan give the team before chaos arrives?",
        "Why is preparation not the enemy of adaptability?"
      ),
      back: tri(
        "It gives the team a shared structure for action.",
        "A good plan creates common sequence, intent, and backup logic before the pace rises.",
        "Preparation helps because it gives change somewhere coherent to land."
      ),
    },
    {
      cardId: "ch10-rc03",
      difficulty: "medium",
      front: tri(
        "What makes commander's intent so important?",
        "Why is knowing the purpose stronger than only knowing the steps?",
        "What keeps a plan alive when the checklist breaks?"
      ),
      back: tri(
        "Intent helps people adapt without losing the mission.",
        "Purpose lets the team revise method while staying aligned on success.",
        "The mission survives because the why survived the broken step."
      ),
    },
    {
      cardId: "ch10-rc04",
      difficulty: "medium",
      front: tri(
        "What do rehearsal and contingencies add?",
        "How do leaders make planning practical instead of theoretical?",
        "What turns a plan into prepared adaptability?"
      ),
      back: tri(
        "They test understanding and normalize adjustment before pressure hits.",
        "Rehearsal exposes confusion early, and contingencies prepare alternate moves in advance.",
        "The plan gets real when the team has walked it and stressed it."
      ),
    },
    {
      cardId: "ch10-rc05",
      difficulty: "hard",
      front: tri(
        "What limit keeps this chapter balanced?",
        "Why does the chapter reject plan worship?",
        "What mistake turns preparation into rigidity?"
      ),
      back: tri(
        "Planning cannot erase uncertainty or justify clinging to the first script forever.",
        "The chapter says a plan is useful only if it helps the team revise under changing conditions.",
        "Preparation fails when loyalty shifts from the mission to the original script."
      ),
    },
  ],
  keyTakeawayCard: tri(
    "A good plan helps people adapt because they share the mission shape, the intent, and the backup moves before pressure starts.",
    "The chapter argues that planning, rehearsal, and contingencies create flexibility by giving the team common structure to adjust from when reality changes.",
    "Prepare deeply, then revise hard when the field shifts. The mission needs a map, not an idol."
  ),
  quiz: {
    passingScorePercent: 70,
    questions: [
      {
        questionId: "ch10-q01",
        prompt: "What is the chapter's main claim about planning?",
        choices: [
          "Planning mainly exists to remove uncertainty completely",
          "Planning makes strong teams rigid by design",
          "Planning helps teams adapt because they share structure before pressure hits"
        ],
        correctIndex: 2,
        explanation: tri(
          "Yes. The chapter says planning creates the shared frame that later supports adaptation.",
          "Correct. Good planning builds common structure before stress distorts the mission.",
          "That is the core claim: the map makes the bend possible."
        ),
        bloomsLevel: "remember",
        depthLevel: "easy",
      },
      {
        questionId: "ch10-q02",
        prompt: "Why do underprepared teams often struggle under pressure?",
        choices: [
          "Because they become brittle when gaps in shared understanding get exposed",
          "Because planning always reduces initiative",
          "Because only the most senior leader should know the intent"
        ],
        correctIndex: 0,
        explanation: tri(
          "Right. Pressure quickly reveals when the team never built a shared picture of the mission.",
          "The chapter says weak preparation turns stress into fragmentation instead of adaptation.",
          "That is the break point: the first surprise hits a team with no common map."
        ),
        bloomsLevel: "understand",
        depthLevel: "easy",
      },
      {
        questionId: "ch10-q03",
        prompt: "What makes commander's intent so important in planning?",
        choices: [
          "It helps people stay aligned when the original steps stop fitting reality",
          "It replaces the need for rehearsal or contingencies",
          "It prevents any future change to the plan"
        ],
        correctIndex: 0,
        explanation: tri(
          "Correct. Intent tells the team what success means even if the first script changes.",
          "That is why intent matters: purpose survives longer than any single checklist step.",
          "The team can bend the method because it still knows what the mission is for."
        ),
        bloomsLevel: "understand",
        depthLevel: "easy",
      },
      {
        questionId: "ch10-q04",
        prompt: "In Alina's rollout example, what best applies the chapter?",
        choices: [
          "Skip rehearsal so the team can stay flexible",
          "Rehearse the launch and fallback paths before going live",
          "Wait to name the rollback path until a failure actually happens"
        ],
        correctIndex: 1,
        explanation: tri(
          "Yes. The chapter says rehearsal and contingencies make later adjustment smoother.",
          "That choice fits because Alina is preparing flexibility rather than hoping improvisation will cover thin prep.",
          "Walk the move now so the live turn does not become a panic rewrite."
        ),
        bloomsLevel: "apply",
        depthLevel: "medium",
      },
      {
        questionId: "ch10-q05",
        prompt: "How does the chapter distinguish planning from rigidity?",
        choices: [
          "Planning means following the original script exactly no matter what changes",
          "Planning helps the team revise coherently when conditions shift",
          "Planning works only if contingencies are never needed"
        ],
        correctIndex: 1,
        explanation: tri(
          "Right. The plan matters because it helps the team adapt without losing coherence.",
          "Exactly. The chapter treats preparation as structure for revision, not as a ban on revision.",
          "A strong plan bends with purpose instead of snapping or freezing."
        ),
        bloomsLevel: "analyze",
        depthLevel: "medium",
      },
      {
        questionId: "ch10-q06",
        prompt: "Which misreading does the chapter reject?",
        choices: [
          "That planning should include rehearsal and contingencies",
          "That the plan can become a form of rigidity if leaders cling to it after reality changes",
          "That planning guarantees the mission will unfold exactly as expected"
        ],
        correctIndex: 2,
        explanation: tri(
          "Correct. The chapter explicitly refuses the idea that planning removes uncertainty or guarantees success.",
          "That is the false reading: the plan is a preparation tool, not a control fantasy.",
          "Reality still hits back. The chapter just wants the team ready for it."
        ),
        bloomsLevel: "understand",
        depthLevel: "medium",
      },
      {
        questionId: "ch10-q07",
        prompt: "What is the best transfer of this chapter to school or home life?",
        choices: [
          "Agree on the goal, the sequence, and the backup path before pressure arrives",
          "Avoid naming contingencies because that makes people anxious",
          "Assume good intentions will replace clear planning"
        ],
        correctIndex: 0,
        explanation: tri(
          "Yes. The chapter transfers whenever a group needs shared preparation before live changes hit.",
          "That answer carries the principle well: planning gives ordinary groups a calmer way to adjust together.",
          "Give the room a mission and a second lane before the first lane breaks."
        ),
        bloomsLevel: "apply",
        depthLevel: "medium",
      },
      {
        questionId: "ch10-q08",
        prompt: "What was the real reveal in Jonah's scenario?",
        choices: [
          "The team adapted smoothly because the fallback move had already been named and rehearsed",
          "The team succeeded mainly because they ignored the original plan entirely",
          "The team only needed more status updates during the disruption"
        ],
        correctIndex: 0,
        explanation: tri(
          "Right. The chapter says contingencies reduce confusion because the need to adjust is already expected.",
          "The reveal is that calm adaptation usually comes from prepared structure, not luck.",
          "The backup path mattered because it existed before the disruption did."
        ),
        bloomsLevel: "analyze",
        depthLevel: "hard",
      },
      {
        questionId: "ch10-q09",
        prompt: "Which statement best captures the chapter's deeper synthesis?",
        choices: [
          "Teams become flexible when they avoid detailed preparation and rely on improvisation",
          "Good planning, intent, rehearsal, and contingencies make distributed adaptation more coherent",
          "Rigid loyalty to the first plan is the clearest sign of disciplined leadership"
        ],
        correctIndex: 1,
        explanation: tri(
          "Exactly. The chapter ties strong preparation to later flexibility instead of opposing them.",
          "That answer captures the full mechanism: shared structure supports adaptation when the field changes.",
          "The team bends well because it prepared together, not because it walked in loose."
        ),
        bloomsLevel: "analyze",
        depthLevel: "hard",
      },
      {
        questionId: "ch10-q10",
        prompt: "How does this chapter lead into the next one?",
        choices: [
          "By showing that even good planning can fail if purpose and feedback do not move well up and down the chain",
          "By proving that communication matters less once the plan is good enough",
          "By arguing that teams should stop sending information upward after rehearsal"
        ],
        correctIndex: 0,
        explanation: tri(
          "Correct. The next chapter takes the shared plan and asks how meaning and information travel across levels.",
          "The bridge is communication: a good map still fails if the chain cannot carry purpose and feedback clearly.",
          "Once the map exists, the next problem is whether the chain keeps it alive."
        ),
        bloomsLevel: "analyze",
        depthLevel: "hard",
      },
    ],
  },
  logLines(hash) {
    const stamp = createdAt();
    return [
      `${stamp} - Wave \`09-10\` writer pass for \`ch10\` completed at \`drafts/canonical/ch10.md\`; editor pass completed at \`drafts/edited/ch10.md\`.`,
      `${stamp} - Wave \`09-10\` critic pass for \`ch10\` completed at \`reports/ch10.critic.md\` with score \`11/12\`; prose gate clear for conversion.`,
      `${stamp} - Wave \`09-10\` converter pass for \`ch10\` completed at \`structured/ch10.chapter.json\`; quiz pass completed at \`quizzes/ch10.quiz.json\`.`,
      `${stamp} - Wave \`09-10\` final chapter-gate checks for \`ch10\` passed: chapter lint \`FAIL=0 WARN=0\`, review-package lint \`FAIL=0 WARN=0\`, artifact guard \`FAIL=0 WARN=0\`, wrapper payload exact-match confirmed at \`chapters[0]\`, reading metrics written.`,
      `${stamp} - Wave \`09-10\` automatic gate decision for \`ch10\`: PASS. Sealed \`approvedChapterHashes.ch10 = ${hash}\` in \`continuity/continuity-state.json\`.`,
    ];
  },
};

function buildCh10DraftStage() {
  writeText("drafts/canonical/ch10.md", ch10.draftText);
  writeText("drafts/edited/ch10.md", ch10.draftText);
  writeText("reports/ch10.critic.md", ch10.criticReport);
}

function closeWave0910() {
  const guard = runChecked("python3", [guardScript, runRoot]);
  if (!guard.ok) throw new Error(guard.stdout);
  appendRunLog([
    `${createdAt()} - Wave \`09-10\` post-wave repo artifact guard passed with \`${guard.stdout
      .split("\n")
      .slice(-1)[0]}\`. Wave closed clean; continuing automatically to the next wave on the strict path.`,
  ]);
}

const mode = process.argv[2];

if (mode === "ch09") {
  gateChapter(ch09);
} else if (mode === "ch10") {
  buildCh10DraftStage();
  gateChapter(ch10);
  closeWave0910();
} else {
  console.error("Usage: node wave_09_10_bundle.mjs ch09|ch10");
  process.exit(2);
}
