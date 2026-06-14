import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const repo = process.cwd();
const bookId = "dare-to-lead";
const runId = "20260601-083240";
const sourceDir = resolve(repo, `.chapterflow/runs/${bookId}/${runId}/sidecars/source`);
const outDirs = [
  resolve(repo, "state/chapters"),
  resolve(repo, "scripts/book/prompts/chapterflow-v21-authored/state/chapters"),
];
for (const dir of outDirs) mkdirSync(dir, { recursive: true });

const index = JSON.parse(
  readFileSync(resolve(repo, `scripts/book/prompts/chapterflow-v21-authored/state/indexes/${bookId}.json`), "utf8"),
);

const names = [
  ["Ansel", "Beatriz", "Cleo", "Dorian", "Etta", "Finn"],
  ["Gita", "Harlan", "Iris", "Jalen", "Kira", "Lucien"],
  ["Marin", "Niko", "Opal", "Paolo", "Rhea", "Soren"],
  ["Tamsin", "Usha", "Vera", "Willem", "Xenia", "Yara"],
  ["Zadie", "Basil", "Corinne", "Devan", "Elian", "Faye"],
  ["Gwen", "Hiro", "Ines", "Jonas", "Keira", "Lior"],
  ["Marta", "Noor", "Oren", "Petra", "Quill", "Rina"],
  ["Selene", "Tariq", "Uma", "Vaughn", "Willa", "Zev"],
];

const scenes = [
  [
    "Tuesday at 8:20 a.m. in a product launch retrospective",
    "Thursday after lunch beside the support queue dashboard",
    "Monday at 4:05 p.m. in a performance calibration room",
    "Friday at 6:15 p.m. on an investor update call",
    "Wednesday morning at the design studio wall",
    "Sunday evening in a conference room after reorganization rumors",
  ],
  [
    "Monday at 9:10 a.m. before sprint planning starts",
    "Wednesday at 5:30 p.m. in the hospital staffing huddle",
    "Saturday morning at a community fundraiser table",
    "Tuesday at 2:45 p.m. inside the agency review room",
    "Thursday before lunch on the regional sales call",
    "Friday night in a school board hearing room",
  ],
  [
    "Monday at noon during an all-hands employee forum",
    "Tuesday at 7:40 a.m. on the manufacturing floor",
    "Thursday at 3:10 p.m. beside the nonprofit grant notice",
    "Wednesday morning in a medical device prototype review",
    "Friday afternoon around the crisis-planning whiteboard",
    "Sunday night in a consulting deadline postmortem",
  ],
  [
    "Monday at 6:30 a.m. in an executive medical leave planning call",
    "Thursday at 11:15 a.m. outside the HR conference room",
    "Tuesday afternoon in the school hallway after a complaint",
    "Wednesday at 4:50 p.m. near the lab safety board",
    "Friday morning inside the department Slack review",
    "Sunday evening in a law firm associate review",
  ],
  [
    "Tuesday at 10:25 a.m. in a startup pricing meeting",
    "Wednesday at 7:55 a.m. beside a regional inventory screen",
    "Friday at 3:35 p.m. in a consulting rehearsal room",
    "Monday afternoon around an architecture model",
    "Thursday at 9:00 a.m. inside a leadership workshop",
    "Saturday morning in a city traffic hearing",
  ],
  [
    "Monday at 8:45 a.m. during an executive values offsite",
    "Thursday night at a sales conference reception",
    "Tuesday at 1:30 p.m. in a research manuscript review",
    "Wednesday morning during a remote handoff review",
    "Friday at 5:20 p.m. in a professional association forum",
    "Sunday afternoon beside a finance audit checklist",
  ],
  [
    "Tuesday at 4:10 p.m. in a legal document access review",
    "Monday morning beside a marketing campaign tracker",
    "Wednesday at 2:05 p.m. in a university advising office",
    "Friday at 8:30 a.m. before a student success meeting",
    "Thursday evening in a vendor migration postmortem",
    "Saturday afternoon across a research partnership table",
  ],
  [
    "Monday at 11:50 a.m. after a procurement meeting moves",
    "Tuesday at 7:05 p.m. before an executive email reply",
    "Wednesday at 3:15 p.m. after a roadmap meeting ends",
    "Friday morning during engineering standup",
    "Thursday afternoon in a merger integration planning room",
    "Sunday evening in a middle school project debrief",
  ],
];

const domains = [
  ["product launch retrospective", "customer support escalation", "annual performance calibration", "investor update", "design critique", "reorganization communication"],
  ["software sprint planning", "hospital staffing", "community fundraiser", "agency review", "regional sales planning", "school board hearing"],
  ["employee forum", "manufacturing quality", "nonprofit grant award", "prototype review", "crisis planning", "deadline recovery"],
  ["medical leave planning", "role exit", "school hallway", "lab safety", "Slack moderation", "associate review"],
  ["pricing strategy", "retail inventory", "client rehearsal", "architecture review", "training design", "traffic meeting"],
  ["values offsite", "conference reception", "manuscript review", "remote operations", "online forum", "audit preparation"],
  ["document access", "campaign delivery", "advising office", "student success", "data migration", "research partnership"],
  ["procurement reschedule", "email conflict", "roadmap exclusion", "bug standup", "merger planning", "classroom recovery"],
];

const titles = [
  ["Arena Filter", "Queue Warning", "Calibration Seat", "Founder Boundary", "Studio Circle", "Rumor Line"],
  ["Sprint Truth", "Staffing Permission", "Fundraiser Mirror", "Client Rules", "Sales Labels", "Budget Return"],
  ["Forum Candor", "Floor Binary", "Grant Gratitude", "Prototype Striving", "Crisis Contribution", "Deadline Repair"],
  ["Rest Story", "Exit Dignity", "Hallway Presence", "Safety Language", "Slack Audit", "Review Compassion"],
  ["Pricing Paradox", "Inventory Question", "Rehearsal Skill", "Model Concern", "Workshop Friction", "Traffic Evidence"],
  ["Offsite Narrowing", "Conference Courage", "Manuscript Work", "Remote Boundary", "Forum Inclusion", "Audit Integrity"],
  ["Access Boundary", "Campaign Reliability", "Advising Vault", "Purdue Control", "Migration Amends", "Partnership Generosity"],
  ["Meeting Story", "Email Breath", "Roadmap Draft", "Standup Eruption", "Merger Evidence", "Classroom Recovery"],
];

const tops = [
  {
    hook: "Theodore Roosevelt's arena and the Square Squad turn vulnerability into a disciplined feedback practice.",
    counter: "Productive vulnerability asks for earned feedback and boundaries, not public approval or emotional dumping.",
    tryNow: "Draw a one-inch Square Squad for one current risk and remove every spectator from the decision.",
    key: "Courage begins when vulnerability stays boundaried, purposeful, and accountable to the work.",
  },
  {
    hook: "Charles's timeline feedback makes courage sound less heroic and more like one precise conversation.",
    counter: "Rumbling is not venting; it is discomfort governed by curiosity, behavior rules, and a return to the work.",
    tryNow: "Before one hard conversation, write the permission slip you need and the rule you will uphold.",
    key: "A rumble turns avoided tension into clear agreements without letting blame or appeasement run the meeting.",
  },
  {
    hook: "Costco candor, foreboding joy, and the Victim or Viking split expose armor as failed protection.",
    counter: "Dropping armor means choosing a concrete counterbehavior, not becoming endlessly unguarded.",
    tryNow: "Name one armored reflex from today and pair it with its daring replacement.",
    key: "Armored leadership hides fear behind control; daring leadership names the defense and practices the alternative.",
  },
  {
    hook: "The concussion story and the six empathic misses show why shame breaks accountability.",
    counter: "Empathy does not erase consequences; it preserves enough dignity for truth and repair.",
    tryNow: "Rewrite one feedback sentence so it names behavior without attacking worth.",
    key: "Shame attacks identity; empathy keeps people connected enough to own behavior and make repair.",
  },
  {
    hook: "Stefan Larsson's Old Navy work makes curiosity operational, not decorative.",
    counter: "Grounded confidence grows through practiced questions, not through sounding certain early.",
    tryNow: "Use one sentence starter to replace a defensive answer in a live discussion.",
    key: "Grounded confidence is practiced steadiness: ask better questions, hold tension, and keep learning.",
  },
  {
    hook: "The values list matters only after the chosen words become visible behavior.",
    counter: "Values are not alignment posters; they are tradeoff rules with slippery violations named in advance.",
    tryNow: "Pick one stated value and write the behavior that would prove it under social pressure.",
    key: "Values become real when people can see the behaviors that support or violate them.",
  },
  {
    hook: "BRAVING turns trust repair into seven inspectable behaviors instead of one vague accusation.",
    counter: "Trust is generous and boundaried; blanket suspicion and blanket forgiveness both miss the repair.",
    tryNow: "Choose one strained relationship and identify the exact BRAVING letter under pressure.",
    key: "Trust is built, broken, and repaired through specific behaviors.",
  },
  {
    hook: "The Ham Foldover, Box Breathing, and SFD work give failure a recovery path.",
    counter: "Learning to rise is not bouncing back fast; it is testing the story before it hardens.",
    tryNow: "Write one SFD from a recent hook and mark the missing data before acting on it.",
    key: "Rising means noticing emotion, testing the first story, and proving the learning through changed behavior.",
  },
];

const sequences = [
  [2, 0, 1, 2, 0, 1, 0, 2, 1],
  [0, 2, 1, 1, 0, 2, 2, 1, 0],
  [1, 0, 2, 0, 2, 1, 2, 0, 1],
  [2, 1, 0, 1, 2, 0, 0, 1, 2],
  [0, 1, 2, 2, 1, 0, 1, 2, 0],
  [1, 2, 0, 0, 2, 1, 2, 0, 1],
  [2, 0, 1, 2, 1, 0, 1, 0, 2],
  [0, 2, 1, 0, 1, 2, 2, 1, 0],
];

const quiz = [
  [
    ["A product lead is stung by harsh online comments after a launch misses its mark.", "Filter serious feedback through the small circle that has earned access.", "Let the whole comment thread steer the release plan.", "Ignore every criticism because spectators cannot help.", "The Square Squad limits whose feedback carries weight; the other choices either surrender to the crowd or dismiss useful earned critique."],
    ["A support manager hears a quiet warning from a new teammate about a broken escalation script.", "Treat the warning as a bid for trust and ask what evidence the teammate is seeing.", "Praise the warning publicly and move on without changing the script.", "Tell the teammate trust is not strong enough for direct criticism yet.", "Gottman-style trust grows through small bids and reliable responses; the other answers turn the bid into theater or avoidance."],
    ["A director is weighing promotion feedback from someone who has never managed similar work.", "Give more weight to arena feedback from people taking comparable risks.", "Let the loudest critic define the promotion standard.", "Delay the decision until every observer approves.", "The arena frame separates participants from spectators; the wrong choices outsource judgment to volume or impossible consensus."],
    ["A founder must update investors after a missed forecast.", "Name uncertainty, state the plan, and keep responsibility with the founder.", "List every private fear so the board can soothe the founder.", "Hide the miss and speak only about optimism.", "Productive vulnerability is boundaried truth in service of the work; the distractors become dumping or image management."],
    ["A creative director wants feedback before protecting a brave design choice.", "Ask the Square Squad for specific critique before deciding.", "Poll the entire studio until the choice feels popular.", "Reject all comments so the design feels independent.", "The Square Squad keeps courage selective; broad approval seeking and blanket dismissal both miss the tool."],
    ["A manager believes trust must be perfect before the team can admit risk.", "Build trust and vulnerability together through small honest exchanges.", "Wait until trust is complete before naming uncertainty.", "Create trust with one dramatic disclosure.", "Brown's trust pattern is iterative; the wrong answers treat trust as either a prerequisite or a single event."],
    ["A team asks how much vulnerability belongs in a reorganization meeting.", "Share what clarifies the work, the boundary, and the next decision.", "Say every fear out loud so people know the leader is human.", "Avoid emotional truth because work meetings should stay neutral.", "Boundaries make exposure useful; the alternatives flood the room or hide the reality."],
    ["A designer asks whose critique should affect a risky proposal.", "Choose critics who have earned a seat through care, competence, and comparable risk.", "Let seniority decide the list automatically.", "Keep changing the proposal until no one objects.", "Earned access protects the work; hierarchy alone and universal approval both distort feedback."],
    ["A leader says disclosure itself is courage.", "Disclosure matters only when it serves clarity, connection, and responsibility.", "Courage means talking longer about fear than about the work.", "The bravest leader refuses to acknowledge exposure.", "The correct answer preserves purpose and boundaries; the other choices confuse vulnerability with either flooding or denial."],
  ],
  [
    ["An engineering manager sees that the sprint plan depends on promises nobody can keep.", "Cut the commitment to what the team can honestly deliver.", "Ask people to work the weekend before naming the pattern.", "Keep the date because optimism protects morale.", "Charles's feedback shows clarity is kinder than pleasing; the other options continue overpromising."],
    ["Nurses stop naming exhaustion because loyalty is being measured by silence.", "Open with permission slips so people can say what they need.", "Begin with a toughness lecture before the staffing facts are named.", "Wait for staff to confess burnout without any prompt.", "Permission slips lower the barrier to honest conversation; toughness lectures and passive waiting keep strain hidden."],
    ["A volunteer chair notices the same overcommitment pattern at home and in fundraiser planning.", "Treat the repeated evidence as a behavior pattern to own.", "Blame the committee for poor organization.", "Keep home and work separate so the feedback feels less personal.", "The family mirror makes the pattern harder to dismiss; the distractors avoid ownership."],
    ["An account director hears eye-rolling during a tense client review.", "Set rules for no contempt, no interruptions, and an explicit return after any time-out.", "Let everyone vent until the charge is gone.", "End the review because conflict means the client is unreasonable.", "A rumble needs behavioral boundaries; venting and flight do not protect the work."],
    ["A sales VP labels one person the optimist and another the realist.", "Invite each person to bring data, hope, and concern without role labels.", "Keep the labels because they make meetings efficient.", "Ask the realist to stop making the room uncomfortable.", "Fixed roles narrow contribution; the right move gives people back their full range."],
    ["Charles gives feedback about unrealistic timelines and the leader feels exposed.", "Ask for the impact, name the pattern, and agree on a different planning behavior.", "Soften the feedback until the sting disappears.", "Collect private complaints and avoid the timeline issue.", "Clear feedback can hurt and still be useful; softening or hiding it prevents repair."],
    ["A board chair calls time-out during a public budget fight.", "State when the group will return and what decision remains open.", "Use the pause to avoid the vote indefinitely.", "Treat the time-out as proof accountability can wait.", "Regulation is accountable only with a return plan; the wrong choices use time-out as escape."],
    ["A regional planning team admits the deadline scares them.", "Treat the fear as information while keeping the work visible.", "Tell people feelings are not operational data.", "Move the emotional material to private journals.", "Rumbling welcomes feelings as data, not as the whole agenda or as forbidden material."],
    ["A leader says emotional facts distract from performance.", "The Air Force example shows named strain can improve operational effectiveness.", "The family mirror proves personal patterns should stay private.", "Charles's feedback proves kindness means delaying directness.", "The military case links naming fatigue to performance; the other readings invert Brown's point."],
  ],
  [
    ["A retail VP faces employee questions and does not know every answer.", "Answer plainly, including what is still unknown.", "Polish the answer until uncertainty disappears.", "Redirect the question to protect executive image.", "The Costco example values workable truth; the other choices protect image."],
    ["A plant supervisor hears Victim or Viking language after a quality defect.", "Reject the binary and set boundaries without domination.", "Choose the Viking side so accountability has force.", "Let the victim stance continue because people are afraid.", "The binary itself is armor; the correct answer keeps strength without crushing people."],
    ["A nonprofit wins a grant and the executive director immediately rehearses disaster.", "Pause for gratitude before starting risk planning.", "Skip celebration so the team stays vigilant.", "Treat joy as proof that loss is coming.", "Foreboding joy is answered by gratitude; vigilance without gratitude erases contribution."],
    ["A research lead is polishing away clinician concerns before a prototype review.", "Invite the concern and practice healthy striving.", "Remove the concern to maintain confidence.", "Delay the review until the prototype looks flawless.", "Healthy striving learns from friction; the distractors serve perfectionism."],
    ["A communications director uses sarcasm during crisis planning.", "Turn the sarcastic remark into one concrete contribution.", "Reward the cynicism because it sounds intelligent.", "Use humor to end the discussion before people worry.", "Cynicism can masquerade as intelligence; contribution is the daring substitute."],
    ["A consulting partner praises a team for heroic weekend work after a missed deadline.", "Study the planning failure instead of treating exhaustion as devotion.", "Celebrate the weekend because it proves commitment.", "Ask the team to repeat the effort next cycle.", "Brown names exhaustion-as-status as armor; the right answer repairs the system."],
    ["A team calls domination accountability.", "Name the power-over pattern and choose the daring counterpart.", "Accept domination when the quality issue is serious.", "Frame fear as weakness so the team moves faster.", "Accountability does not require power-over behavior; the alternatives intensify armor."],
    ["A CEO wants to protect image during an all-hands question session.", "Give people truth they can work with instead of fog.", "Offer a confident story even if facts are missing.", "Avoid the question because candor may reduce respect.", "The Costco-style answer trades image management for usable candor; invented confidence and avoidance both protect appearance at the team's expense."],
    ["A leader wants to drop armor by sharing every private anxiety.", "Replace each defense with a specific daring behavior.", "Remove every boundary and become emotionally unguarded.", "Keep armor whenever exposure feels risky.", "The target is behavioral substitution, not emotional flooding or permanent self-protection."],
  ],
  [
    ["A chief of staff notices a leader treating medical rest like moral failure.", "Name the shame story and plan real recovery support.", "Praise the leader for pushing through the injury.", "Keep the leave vague so nobody sees weakness.", "The concussion story exposes shame around legitimate limits; the wrong choices feed that story."],
    ["An HR director must end a role after repeated misconduct.", "Hold the consequence while preserving agency and respect.", "Use the meeting to make an example for everyone.", "Avoid clarity so the person does not feel pain.", "Dignity in termination keeps accountability and humanity together; spectacle and vagueness fail both."],
    ["A principal hears a colleague respond to pain with shock and hollow reassurance.", "Stay present, reflect feeling, and avoid centering the helper.", "Offer quick reassurance so the pain disappears.", "React dramatically to prove the complaint matters.", "The empathic misses center the helper; real empathy stays with the person in pain."],
    ["A lab supervisor responds after a near miss is reported late.", "Use guilt language about the action and protect future reporting.", "Say the late report proves the person is careless.", "Hide the incident so nobody feels embarrassed.", "Guilt can support repair; shame language teaches people to conceal mistakes."],
    ["A team lead reviews a Slack thread where mockery has become normal.", "Identify gossip and public humiliation as shame signals.", "Let the thread continue because mockery creates speed.", "Ask the target to develop thicker skin.", "Shame cultures grow through humiliation; the right move names the pattern."],
    ["A manager drafts feedback after a mistake.", "Say what behavior hurt the process and what repair is required.", "Say the person is not someone the team can trust.", "Tell everyone competent people avoid that error.", "Behavioral feedback creates repair; calling the person untrustworthy or incompetent attacks identity and teaches shame."],
    ["A partner feels unusually harsh toward an associate who made a visible error.", "Check the partner's own shame before delivering feedback.", "Lean into harshness because standards are high.", "Delay the review until the associate apologizes first.", "Self-compassion matters because unworked shame leaks into judgment; harshness and delay both dodge the partner's responsibility for clean feedback."],
    ["A termination meeting needs both consequence and care.", "Plan the exit so the person is not reduced to the failure.", "Soften the consequence until nobody learns from it.", "Turn the moment into a warning for the whole team.", "Brown's distinction keeps dignity with accountability; the wrong choices choose only one side."],
    ["A manager says empathy means lowering the bar.", "Empathy protects dignity so accountability can work.", "Empathy removes consequences when someone feels ashamed.", "Empathy is useful only after behavior has changed.", "The correct answer keeps standards intact; the distractors confuse empathy with excuse-making or delay."],
  ],
  [
    ["A founder team is forcing pricing into either optimism or caution.", "Hold both truths long enough to choose a wiser launch test.", "Pick optimism so the team feels brave.", "Pick caution so no one can criticize the launch.", "Grounded confidence can hold paradox; the wrong choices collapse complexity."],
    ["A district manager sees polished reports hiding inventory facts.", "Ask what the reports are missing and listen for local detail.", "Tell stores to simplify the story for headquarters.", "Use the polished deck because confidence matters most.", "Curiosity surfaces operational data; polish without inquiry protects appearances."],
    ["A new engagement lead has not practiced the first sentence of a hard client meeting.", "Rehearse sentence starters before the live tension arrives.", "Trust instinct because rehearsal sounds scripted.", "Cancel the meeting until confidence feels natural.", "Leadership skill needs practice before pressure; the wrong answers romanticize instinct or avoidance."],
    ["An architect hears a structural concern and wants to answer with swagger.", "Ask a real question that can reveal missing data.", "Answer quickly so authority stays visible.", "Dismiss the concern until proof is perfect.", "Curiosity is vulnerable because it admits incomplete data; swagger shuts learning down."],
    ["A learning director sees that popular training collapses during conflict.", "Add desirable difficulty so the skill transfers under stress.", "Keep the workshop comfortable because people like it.", "Replace practice with more inspirational stories.", "Brown's practice analogy favors friction and repetition; comfort alone does not build skill."],
    ["A city planning director faces resident evidence that complicates the traffic plan.", "Ask what evidence has not been heard, then decide the next test.", "Ask every resident for a new preference before deciding.", "Declare the plan final so debate stops.", "Curiosity does not postpone action forever; it gathers better data for a clearer next step."],
    ["A CEO says grounded confidence means sounding certain before facts are ready.", "Grounded confidence comes from practiced skill, not swagger.", "Sounding certain is the fastest path to trust.", "Confidence appears only after all ambiguity is gone.", "The correct answer separates earned steadiness from performance; sounding certain too early is swagger, while waiting for zero ambiguity makes leadership impossible."],
    ["Frontline data contradicts the official inventory story.", "Treat contradiction as useful data instead of an image threat.", "Defend the official story until the review ends.", "Punish the frontline report because it creates confusion.", "Old Navy-style curiosity uses contradiction to improve operations; defending the deck or punishing the report protects image over learning."],
    ["A team treats curiosity as niceness.", "Curiosity is operational because it surfaces useful information sooner.", "Curiosity is mainly a nicer tone for hard news.", "Curiosity works only when the leader already knows the answer.", "The Stefan Larsson example connects inquiry with performance, not politeness alone."],
  ],
  [
    ["A division president wants to keep twelve official values.", "Narrow to the few values that can govern tradeoffs.", "Keep all twelve so nobody feels excluded.", "Rotate values monthly to avoid hard choices.", "The values list forces commitment; keeping every word or rotating them avoids the hierarchy needed for hard tradeoffs."],
    ["A regional manager hears a discriminatory joke at a conference reception.", "State the boundary and refuse the joke even if approval drops.", "Stay quiet because the event is informal.", "Laugh politely and address inclusion later.", "Courage becomes visible when behavior costs comfort; silence and polite laughter make the stated value disappear in the moment it matters."],
    ["A research team uses Be Brave and Serve the Work during manuscript conflict.", "Ask which behavior serves the work and which one protects ego.", "Use Be Brave as permission to attack the weakest draft.", "Take Good Care by avoiding disagreement.", "Values need behavioral definitions; the wrong choices distort bravery or care."],
    ["A remote team assumes positive intent while missed handoffs keep hurting clients.", "Assume good intent while naming the agreement that was missed.", "Keep generosity vague so nobody feels blamed.", "Stop trusting the team after the third miss.", "Generosity needs evidence and boundaries; vague kindness avoids the miss, while blanket distrust throws away useful intent."],
    ["A moderator sees hateful comments in a professional association forum.", "Remove the comments because inclusion is behavioral, not decorative.", "Leave them up to prove openness to all views.", "Move the thread where fewer members will see it.", "A stated inclusion value becomes real through conduct; leaving hate visible or hiding it quietly fails the behavior test."],
    ["A controller prepares the team for audit pressure.", "Name likely shortcuts and the value each would violate.", "Wait until the audit starts before discussing pressure.", "Tell people integrity matters and skip behavioral detail.", "Slippery behaviors need names before pressure arrives; waiting or using slogans gives people no usable guardrail."],
    ["A leader separates home values from work values to avoid tradeoffs.", "Values travel across settings and should survive discomfort.", "Work values can contradict home values without consequence.", "Private values count only when they are publicly admired.", "Brown rejects divided values because identity travels; contradiction and public admiration both make values conditional."],
    ["During feedback, a manager says values are obvious because posters list them.", "Translate each value into observable actions and slippery behaviors.", "Trust the posters because everyone knows the words.", "Ask employees to memorize the value list before feedback.", "A value is real only when it changes conduct; posters and memorization preserve words without proving behavior."],
    ["A team chooses Take Good Care but has not defined the behavior.", "Define how Be Brave, Serve the Work, and Take Good Care behave in meetings.", "Let each person interpret Take Good Care privately.", "Use the value as praise after good outcomes only.", "Shared values need shared behavioral definitions; private interpretation and after-the-fact praise cannot guide conflict."],
  ],
  [
    ["A project attorney discovers vague access rules around confidential files.", "Name the boundary problem and set access rules before sharing.", "Trust everyone broadly because the project is urgent.", "Let the attorney decide privately who can see files.", "BRAVING begins with boundaries; the wrong choices avoid explicit limits."],
    ["A creative operations lead keeps making approval-seeking promises.", "Reliability is the issue because promises exceed real capacity.", "Vault is the issue because campaign files are confidential.", "Generosity is the issue because the lead means well.", "The pattern is follow-through, not intent or secrecy; confidentiality and good motives do not fix repeated overcommitment."],
    ["A coordinator hears gossip in a university advising office.", "Decline the gossip because the vault protects absent people.", "Listen quietly because the story creates quick trust.", "Share a smaller secret so the exchange feels equal.", "Gossip creates counterfeit closeness while teaching that confidentiality is unsafe."],
    ["A Purdue program director notices control rising whenever self-trust drops.", "Ask where low self-trust is becoming control of colleagues.", "Tighten approvals so the director feels less exposed.", "Call the team uncommitted until they improve.", "Brent Ladd's example links control of others to self-trust gaps; tighter approvals and blame protect the director, not the work."],
    ["A vendor migration failed after repeated warning signs.", "Own the mistake, apologize, make amends, and change the process.", "Send a polished apology and move to the next milestone.", "Explain that vendors often fail during migrations.", "Accountability requires ownership plus changed behavior; polish and excuses leave the broken process untouched."],
    ["A research partnership misunderstanding has thin evidence.", "Choose the kindest reading the facts can honestly support.", "Forgive everything so the partnership feels generous.", "Assume bad intent until the other lab proves otherwise.", "Generosity is bounded by available facts; blanket forgiveness ignores limits, while suspicion outruns evidence."],
    ["A lab director wants to repair trust by asking, 'Do you trust me or not?'", "Use BRAVING to locate the specific behavior under strain.", "Ask for global reassurance before discussing facts.", "Drop the concern because trust is either present or absent.", "The inventory makes trust smaller and repairable; reassurance and all-or-nothing thinking keep the broken behavior vague."],
    ["Motivation is high on a campaign team, but delivery keeps slipping.", "Discuss realistic commitments and follow-through instead of motivation.", "Praise effort so reliability feels less harsh.", "Move the deadline again to preserve enthusiasm.", "Reliability is about repeated kept commitments; praise and deadline movement may feel kind while preserving the trust break."],
    ["A leader judges colleagues who ask for help.", "Nonjudgment may be weak if help-seeking feels unsafe.", "Vault is broken because people are asking questions.", "Generosity means the leader should ignore the pattern.", "Nonjudgment creates room to need help without humiliation; vault and generosity are distractors because the issue is judgment around need."],
  ],
  [
    ["A director tells herself a rescheduled procurement meeting proves she is being dismissed.", "Mark the story as a draft and ask what data is missing.", "Treat the slight as proof that respect is gone.", "Make a larger demand before the next meeting.", "The SFD label makes the first story testable; treating it as proof or escalating demands lets an unchecked story drive behavior."],
    ["A COO feels heat in her chest before replying to an email.", "Use Box Breathing before choosing words.", "Send the reply while the emotion is honest.", "Forward the email to allies for validation.", "Regulation creates space for curiosity; instant sending and ally-seeking may spread the reaction before it is understood."],
    ["A design lead was left off a roadmap invite and has a polished exclusion story.", "Share the SFD as provisional and invite missing information.", "Announce the exclusion story so the team feels the impact.", "Withdraw from roadmap work until someone apologizes.", "Rumbling with the story asks for data before action; announcing or withdrawing treats the draft as settled truth."],
    ["A tech lead erupts during standup after weeks of saved-up frustration.", "Name the offloaded hurt and repair with the person affected.", "Defend the eruption because the frustration was real.", "Move the bug discussion to private chat and continue.", "Offloading hurt explains the pattern but does not excuse the harm; defending or bypassing the eruption skips repair."],
    ["A merger lead is certain the other team is hiding information, but data is thin.", "Test the confident story before acting on it.", "Trust the story because it feels sincere.", "Wait for the other team to confess first.", "Confabulation can feel true, so rising tests it; sincerity and passive waiting both leave the story unchecked."],
    ["A teacher team wants a failed project to teach recovery.", "Teach students to reckon, test the story, and practice repair.", "Identify who caused the failure and move on quickly.", "Turn the lesson positive before feelings slow the class.", "The revolution is changed behavior; blame and forced cheer both skip the learning process."],
    ["A manager wants recovery to mean bouncing back fast.", "Rising is deliberate recovery work, not speed or decoration.", "Bouncing back fast proves the fall was handled.", "A positive lesson is enough when people are busy.", "Brown's process is slower and more disciplined than positivity; speed and a neat lesson can hide unexamined pain."],
    ["A teammate says the first story is honest because it feels sincere.", "A felt story can still need data before it guides behavior.", "Honest emotion makes the first explanation reliable.", "Sincerity means reality-checking is unnecessary.", "Emotion may be real while the interpretation remains incomplete; honesty and sincerity do not remove the need to check facts."],
    ["A team avoids risk because falls feel like identity threats.", "Build a shared recovery practice so risk does not require avoidance.", "Reduce the amount of risk so people stop falling.", "Protect the team from feedback that might hook them.", "Rising gives courage a recovery path; avoiding all falls shrinks the work."],
  ],
];

function clean(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[—–]/g, ",")
    .replace(/\brather than\b/gi, "instead of")
    .replace(/\bthis chapter\b/gi, "this skill")
    .replace(/\bthe chapter\b/gi, "the skill")
    .replace(/\bthe author\b/gi, "Brown")
    .replace(/\s+/g, " ")
    .trim();
}

function sentences(text) {
  return clean(text)
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 24)
    .map((s) => (/[.!?]$/.test(s) ? s : `${s}.`));
}

function paragraph(parts) {
  return clean(parts.filter(Boolean).join(" "));
}

const breakdownProfiles = [
  {
    fast: "Use the arena image as a feedback filter before a risky launch or review begins.",
    deep: "The machinery is not spectacle; it is the daily exchange between earned critique, small bids for trust, and disciplined boundaries.",
    deepExtra: "The leader is learning to sort signal from noise while staying honest about risk.",
    full: "Read the opening as a warning against outsourcing courage to spectators. The leader's job is to separate exposure that clarifies the work from exposure that asks the room for rescue.",
    extra: "In practice, the distinction shows up before the meeting even starts. A leader can decide who will be consulted, what criticism is relevant, and which emotional facts belong in the room. That preparation keeps honesty from becoming either a popularity contest or an anxious monologue.",
    close: "The practical endpoint is a smaller feedback circle, a cleaner boundary, and a sentence that keeps responsibility with the leader.",
  },
  {
    fast: "Treat the hard conversation as a scheduled work practice, not a personality contest.",
    deep: "The pressure point is overpromising: vague kindness passes discomfort downstream until colleagues inherit the chaos.",
    deepExtra: "The rumble gives that discomfort a table, a rule set, and a return path.",
    full: "The useful reading is practical and almost procedural. Courage means naming the timeline, the fear in the room, the rules for conduct, and the return point after a pause.",
    extra: "That procedure matters because discomfort can otherwise masquerade as tact. A missed expectation, a fixed role, or a contemptuous gesture may look small while it is happening. Once the leader names it, the group can stop decoding each other and start repairing the agreement.",
    close: "The rumble has done its job when role labels drop, expectations sharpen, and regulation gives people enough steadiness to continue.",
  },
  {
    fast: "Notice the defensive move before it gets praised as professionalism, toughness, or speed.",
    deep: "The armory works because many defenses look competent from a distance: perfectionism, cynicism, overwork, control, and power-over behavior can all pass as standards.",
    deepExtra: "The mechanism is status reversal: what once earned approval has to be recognized as protection.",
    full: "Brown asks for substitution, not self-condemnation. Once a protective habit is visible, the leader chooses the paired daring practice and tests it in behavior.",
    extra: "The point is especially sharp when a defense has been rewarded for years. A team may call overwork commitment, call sarcasm intelligence, or call domination accountability. Brown's move is to remove the prestige from the armor and give people a practiced alternative. The leader also has to make the replacement observable, since a team cannot practice gratitude, shared power, or healthy striving if those words never become meeting behavior.",
    close: "The armory audit is useful only when the named defense loses status and the team receives a braver replacement to practice.",
  },
  {
    fast: "Keep accountability attached to dignity when shame starts rewriting a mistake as identity.",
    deep: "The distinction between guilt and shame matters because behavior can be repaired while worth cannot be productively attacked.",
    deepExtra: "That distinction changes the feedbacker's job from exposing a flawed person to naming an action that can be owned.",
    full: "The hardest demand is emotional restraint from the person giving feedback. Shame often leaks from the evaluator, so the first repair may be inside the leader.",
    extra: "That is why the empathy material is not a soft detour. It teaches the leader how to stay with pain without becoming theatrical, dismissive, or punitive. Consequences can remain firm while language protects the possibility of ownership.",
    close: "The feedback lands best when the behavior is specific, the person's agency stays intact, and repair remains possible without pretending consequences vanished.",
  },
  {
    fast: "Use curiosity as an operating discipline when certainty would be more comfortable.",
    deep: "Grounded confidence is earned through practice: questions, sentence starters, paradox, and friction prepare leaders for pressure.",
    deepExtra: "The mechanism is rehearsal under tension, because unpracticed curiosity usually collapses into advice or defense.",
    full: "Brown treats inquiry as performance infrastructure. Better questions reveal data, and repeated practice helps the skill survive a tense room.",
    extra: "The most useful leader is not the one who performs certainty first. The useful leader can tolerate a complicated answer long enough to learn from it. That stance requires rehearsal, because pressure makes quick certainty feel safer than honest inquiry.",
    close: "The curious leader slows the quick answer, asks for missing evidence, and chooses the next test with more information in view.",
  },
  {
    fast: "Make values small enough to govern an actual tradeoff.",
    deep: "The values work becomes real only when words are translated into behaviors, slippery moments, and costs people can recognize before pressure arrives.",
    deepExtra: "The mechanism is specificity: a value guides action only after people can identify the conduct it demands.",
    full: "Brown rejects decorative alignment. A leader has to decide which values travel across settings and what conduct proves them when approval is at risk.",
    extra: "A long list can feel generous, but it often hides the absence of priority. The sharper practice asks which value will govern when two good things cannot both win. Once that choice is made, people need to know the behavior that proves it and the shortcut that violates it. The value also needs a cost test: if nobody risks disapproval, convenience, or status, the word may be admired without being practiced and remembered.",
    close: "The values work succeeds when the chosen word, visible conduct, and refused shortcut are all plain enough to guide a tense tradeoff.",
  },
  {
    fast: "Move trust from a vague feeling to a specific behavior that can be repaired.",
    deep: "Brown uses BRAVING to break a global accusation into inspectable parts: boundaries, reliability, vault, integrity, nonjudgment, and generosity each ask for different evidence.",
    deepExtra: "The inventory makes the conversation smaller without making it softer.",
    full: "The inventory is most useful when trust feels too large to discuss. It lets a leader locate the break without turning the whole relationship into a verdict.",
    extra: "The repair changes depending on the letter. A confidentiality problem needs a vault correction; a missed promise needs reliability work; a harsh assumption needs generosity with limits. Naming the part prevents a damaged relationship from becoming one blurred accusation. It also keeps self-trust in view, because leaders who cannot rely on themselves often compensate by controlling other people. The inventory is equally helpful when the leader is the one asking for trust; instead of demanding belief, the leader can show the boundary, kept commitment, protected confidence, or amends that would make belief reasonable.",
    close: "The trust conversation becomes repairable when the strained letter, missed behavior, and observable next repair are all named.",
  },
  {
    fast: "Slow the first story before emotion turns it into marching orders.",
    deep: "Brown presents rising strong as a sequence: notice the hook, regulate the body, test the story, and prove the lesson through changed behavior.",
    deepExtra: "The sequence protects the team from acting on a confident interpretation before the facts arrive.",
    full: "Brown gives failure a recovery path that is neither speed nor forced optimism. The first draft may reveal real emotion, but it still needs data.",
    extra: "This matters because the first story often feels complete precisely when it is least checked. A leader who pauses can separate body sensation, interpretation, missing facts, and repair. The recovery becomes visible only when the next behavior changes.",
    close: "The rising practice marks the story as provisional, checks the missing facts, and repairs whatever the first reaction damaged.",
  },
];

const exampleDetails = [
  [
    {
      setup: "Ansel has three Slack threads, two executive opinions, and a customer complaint open after the launch missed its date.",
      move: "He writes the names of the people who have earned a feedback seat, then asks those people for the specific risk they see.",
      why: "The launch plan improves because Ansel stops treating volume as wisdom while still letting serious critique reach the work.",
    },
    {
      setup: "Beatriz sees a new support analyst hesitate before saying the escalation script is confusing customers.",
      move: "She thanks the analyst privately, asks for two calls that show the pattern, and changes the script review agenda.",
      why: "The analyst learns that a small bid for trust receives attention, which makes future warnings more likely to surface early.",
    },
    {
      setup: "Cleo is about to weigh promotion feedback from someone who has never managed the kind of work being judged.",
      move: "She separates arena feedback from spectator commentary and documents why one source gets more weight than another.",
      why: "The calibration stays fairer because Cleo uses earned perspective instead of seniority, noise, or popularity.",
    },
    {
      setup: "Dorian has to tell investors that a forecast is wrong while the company still needs confidence in the next quarter.",
      move: "He states the miss, names what is unknown, and assigns himself the next decision instead of asking the board to soothe him.",
      why: "The update becomes steadier because Dorian shares exposure in service of clarity, not as a request for caretaking.",
    },
    {
      setup: "Etta's design team is split between useful critique and comments from people protecting personal taste.",
      move: "She asks her chosen reviewers for one risk, one strength, and one question before she protects the design choice.",
      why: "The studio sees that brave work can invite feedback without letting every preference rewrite the proposal.",
    },
    {
      setup: "Finn knows reorganization rumors are spreading and wants to be honest without flooding the room with anxiety.",
      move: "He shares the confirmed facts, the boundary on what cannot be promised, and the next time employees will hear from him.",
      why: "People get usable truth because Finn makes uncertainty visible while keeping responsibility for the communication.",
    },
  ],
  [
    {
      setup: "Gita opens sprint planning and sees that the date depends on work nobody has estimated honestly.",
      move: "She cuts the commitment, names the optimism pattern, and asks the team what must be true for the new date to hold.",
      why: "The sprint becomes kinder because Gita removes the hidden transfer of stress that vague planning would create.",
    },
    {
      setup: "Harlan hears nurses describe exhaustion in hallway whispers but not in the official staffing huddle.",
      move: "He starts with permission slips, then asks each shift lead to name one risk the schedule is hiding.",
      why: "The hospital team can manage strain because Harlan turns private fatigue into operational information.",
    },
    {
      setup: "Iris notices that fundraiser volunteers are repeating the same last-minute scramble she creates at home.",
      move: "She owns the pattern aloud and changes the sign-up sheet so deadlines and backup owners are visible.",
      why: "The committee gets relief because Iris treats repeated evidence as a behavior to change rather than a complaint to explain away.",
    },
    {
      setup: "Jalen hears contemptuous sighs during a tense agency review and can feel the room sliding toward performance.",
      move: "He pauses the review, restates the no-contempt rule, and gives the group ten minutes before returning to the decision.",
      why: "The client discussion stays useful because Jalen regulates the room without abandoning accountability.",
    },
    {
      setup: "Kira's sales call has turned one teammate into the optimist and another into the person expected to object.",
      move: "She asks both people to bring hope, risk, and evidence, then removes the labels from the next agenda.",
      why: "The region gets fuller thinking because Kira refuses to let fixed roles shrink what people are allowed to contribute.",
    },
    {
      setup: "Lucien faces a school board hearing where budget fear is making every question sound like an accusation.",
      move: "He names the fear, separates facts from interpretations, and states which decision remains open after public comment.",
      why: "The hearing keeps moving because Lucien treats emotion as data while still protecting the work of deciding.",
    },
  ],
  [
    {
      setup: "Marin takes questions at an employee forum and feels the pull to polish away every unknown.",
      move: "She answers with the facts she has, the facts she lacks, and the date for the next update.",
      why: "Employees gain workable truth because Marin chooses candor over image protection.",
    },
    {
      setup: "Niko hears a quality defect described as proof that the floor needs a tougher hand.",
      move: "He rejects the Victim-or-Viking split and sets a boundary for the next inspection without domination.",
      why: "The floor keeps standards without teaching people that fear is the only path to accountability.",
    },
    {
      setup: "Opal wins a grant and immediately starts rehearsing all the ways the award could disappear.",
      move: "She has the team write one gratitude note before risk planning begins.",
      why: "The nonprofit can prepare without erasing the joy and effort that made the award possible.",
    },
    {
      setup: "Paolo is tempted to remove clinician objections from a prototype review so the device appears ready.",
      move: "He keeps the objections in the deck and asks which one would teach the team fastest.",
      why: "The prototype gets stronger because Paolo chooses healthy striving over perception management.",
    },
    {
      setup: "Rhea uses sarcasm around the crisis board and people laugh instead of naming what they can do.",
      move: "She converts the sharpest comment into a concrete contribution and assigns the first owner.",
      why: "The room stops rewarding distance and starts using the intelligence underneath the cynicism.",
    },
    {
      setup: "Soren's consulting team is being praised for weekend heroics after a preventable deadline collapse.",
      move: "He studies the planning failure and removes the status reward from exhaustion.",
      why: "The next deadline has a better chance because Soren treats overwork as a signal, not a badge.",
    },
  ],
  [
    {
      setup: "Tamsin hears an executive call medical rest a personal failure after a concussion.",
      move: "She names the shame story and builds a recovery plan with coverage, dates, and communication limits.",
      why: "The leave plan protects both health and work because Tamsin refuses to treat legitimate limits as weak character.",
    },
    {
      setup: "Usha must end a role after misconduct and senses the team wants a public example.",
      move: "She holds the consequence in a private meeting that explains agency, next steps, and dignity.",
      why: "Accountability lands more cleanly because Usha does not turn the person's worth into a lesson for spectators.",
    },
    {
      setup: "Vera watches a colleague respond to a student's pain with dramatic shock and fast reassurance.",
      move: "She stays with the student, reflects the feeling, and avoids centering the helper's discomfort.",
      why: "The hallway gets calmer because Vera practices presence instead of trying to make the pain disappear.",
    },
    {
      setup: "Willem receives a late lab safety report and wants to say the researcher is careless.",
      move: "He names the reporting behavior, explains the required repair, and protects the channel for future near misses.",
      why: "The lab becomes safer because Willem uses guilt language about action instead of shame language about identity.",
    },
    {
      setup: "Xenia reviews a Slack thread where jokes about one employee have become normal.",
      move: "She identifies the humiliation pattern, removes the thread, and resets the team's conduct rule.",
      why: "The group learns that speed and humor do not justify a shame culture.",
    },
    {
      setup: "Yara sees a law firm partner become harsher than usual after an associate's visible error.",
      move: "She asks the partner to check what the mistake touched in his own shame before feedback is delivered.",
      why: "The associate receives clearer standards because Yara keeps unworked shame from leaking into judgment.",
    },
  ],
  [
    {
      setup: "Zadie has a pricing team split between a bold launch and a cautious delay.",
      move: "She asks each side to state the truth in the other position before choosing a test.",
      why: "The startup gets a wiser experiment because Zadie holds paradox longer than the room wants to.",
    },
    {
      setup: "Basil sees inventory reports that look polished while store managers keep describing missing stock.",
      move: "He asks what the deck is not showing and brings two local managers into the review.",
      why: "The retail plan improves because Basil treats contradiction as data, not embarrassment.",
    },
    {
      setup: "Corinne is about to lead a client rehearsal without practicing the opening sentence.",
      move: "She rehearses three sentence starters and chooses the one that can survive tension.",
      why: "The meeting starts better because Corinne builds skill before pressure, instead of trusting adrenaline.",
    },
    {
      setup: "Devan hears a structural concern and wants to answer fast so authority stays visible.",
      move: "He asks which assumption would fail first and what evidence would settle it.",
      why: "The architecture review gets safer because Devan lets inquiry reveal missing information.",
    },
    {
      setup: "Elian's leadership workshop is popular but the skill disappears when conflict begins.",
      move: "He adds role-play friction, repetition, and feedback rounds before declaring the training finished.",
      why: "Participants gain transfer because Elian chooses practice difficulty over inspirational comfort.",
    },
    {
      setup: "Faye faces resident traffic evidence that complicates the city plan.",
      move: "She asks what has not been heard, then defines the next test rather than reopening every preference.",
      why: "The planning room stays both curious and decisive because Faye uses questions to improve action.",
    },
  ],
  [
    {
      setup: "Gwen wants all twelve official values to stay on the offsite wall.",
      move: "She narrows the list to the few values that can settle a hard tradeoff.",
      why: "The division gains guidance because Gwen chooses commitment over inclusive decoration.",
    },
    {
      setup: "Hiro hears a discriminatory joke at a conference reception and knows silence would be easier.",
      move: "He states the boundary in the moment and leaves the approval cost where it belongs.",
      why: "The value becomes visible because Hiro lets behavior, not private agreement, carry the proof.",
    },
    {
      setup: "Ines watches manuscript feedback turn Be Brave into permission to attack.",
      move: "She asks which comment serves the work and which comment is protecting ego.",
      why: "The research team keeps courage connected to care because Ines defines the value in conduct.",
    },
    {
      setup: "Jonas's remote team assumes good intent while missed handoffs keep hurting clients.",
      move: "He keeps generosity in place and names the agreement, owner, and due time that were missed.",
      why: "The handoff improves because Jonas refuses to let a generous story erase reliability.",
    },
    {
      setup: "Keira moderates a professional forum where hateful comments are being defended as openness.",
      move: "She removes the comments and explains the inclusion behavior the forum will enforce.",
      why: "Members see that inclusion is a standard of conduct, not a word on the page.",
    },
    {
      setup: "Lior prepares for an audit and knows pressure will tempt people into small shortcuts.",
      move: "He names the likely shortcuts before the audit starts and ties each one to the value it would violate.",
      why: "The finance team has a usable guardrail because Lior names slippery behavior before stress makes it attractive.",
    },
  ],
  [
    {
      setup: "Marta finds confidential legal documents moving through vague access rules.",
      move: "She states who may see which files, what requires approval, and how exceptions will be logged.",
      why: "The project protects trust because Marta turns a boundary concern into explicit operating rules.",
    },
    {
      setup: "Noor keeps promising campaign approvals faster than the team can deliver.",
      move: "She recalculates capacity and replaces approval-seeking promises with commitments the team can keep.",
      why: "The campaign gets more reliable because Noor addresses follow-through rather than defending good intent.",
    },
    {
      setup: "Oren hears advising-office gossip offered as a shortcut to closeness.",
      move: "He declines the story and redirects the conversation to the student's documented need.",
      why: "Confidentiality becomes safer because Oren refuses counterfeit trust built on absent people.",
    },
    {
      setup: "Petra notices her Purdue-style program controls increasing whenever she doubts her own judgment.",
      move: "She asks where low self-trust is becoming extra approval layers for colleagues.",
      why: "The team gets breathing room because Petra locates the control pattern before blaming commitment.",
    },
    {
      setup: "Quill's vendor migration failed after several warnings were minimized.",
      move: "He owns the miss, apologizes, makes amends, and changes the review checkpoint.",
      why: "The client can judge repair because Quill pairs apology with altered process.",
    },
    {
      setup: "Rina's research partner missed a deadline and the evidence about intent is thin.",
      move: "She chooses the kindest reading the facts can support while setting a new delivery boundary.",
      why: "The partnership stays generous without becoming naive because Rina keeps facts and limits together.",
    },
  ],
  [
    {
      setup: "Selene tells herself a moved procurement meeting proves the sponsor is dismissing her.",
      move: "She labels that explanation as a first draft and asks which data points are missing.",
      why: "The next conversation gets cleaner because Selene tests the story before making it policy.",
    },
    {
      setup: "Tariq feels heat in his chest before replying to an executive email.",
      move: "He uses Box Breathing, waits for his body to settle, and then writes the reply.",
      why: "The email improves because Tariq creates enough space to choose language instead of exporting the spike.",
    },
    {
      setup: "Uma was left off a roadmap invite and has already built a polished exclusion story.",
      move: "She shares the SFD as provisional and asks what happened before assigning motive.",
      why: "The product discussion stays repairable because Uma does not confuse a vivid story with verified data.",
    },
    {
      setup: "Vaughn erupts in standup after weeks of stored frustration about a recurring bug.",
      move: "He names the offloaded hurt, apologizes to the person hit by it, and returns to the bug facts.",
      why: "The engineering team can address the defect because Vaughn repairs the harm instead of defending the blast.",
    },
    {
      setup: "Willa is convinced the merger partner is hiding information, but her evidence is thin.",
      move: "She separates observation from interpretation and asks for the missing documents directly.",
      why: "The integration stays grounded because Willa does not let certainty outrun evidence.",
    },
    {
      setup: "Zev's class project failed and the teaching team wants to rush toward a cheerful lesson.",
      move: "He helps students reckon with the disappointment, test their story, and choose one repair.",
      why: "Students learn recovery because Zev treats the revolution as changed behavior, not forced positivity.",
    },
  ],
];

const planDetails = [
  {
    core: "Build the practice around one exposed decision: choose the critics who have earned access, state the boundary on disclosure, and respond to one small bid for trust.",
    ifs: [
      "If outside commentary starts steering the launch, move the decision back to the small trusted circle and ask for evidence from people taking comparable risk.",
      "If the team asks for more certainty than the facts allow, state what is known, what remains open, and who owns the next update.",
      "If disclosure begins to seek rescue, trim it to the truth that helps the work and leave caretaking out of the ask.",
    ],
    day: "Within one day, write the names that fit inside the Square Squad and remove one spectator opinion from an active decision.",
    week: "For the next week, log every feedback moment that stings; mark whether it came from earned arena experience, useful data, or distant noise.",
  },
  {
    core: "Practice one rumble with rules: name the missed expectation, invite the needed permission slips, and keep the conversation pointed at clearer work.",
    ifs: [
      "If a deadline sounds generous but unsupported, ask what must change before the promise becomes honest.",
      "If role labels appear, require each person to bring hope, concern, and evidence before a decision is made.",
      "If the room overheats, call a time-out with a return time and the unresolved question written down.",
    ],
    day: "Within one day, rewrite one vague expectation as a direct request with owner, date, and standard of done.",
    week: "Across seven days, notice where niceness is hiding resentment and schedule one bounded conversation before the pattern hardens.",
  },
  {
    core: "Audit one protective reflex and pair it with the daring behavior Brown names as its replacement.",
    ifs: [
      "If perfectionism is polishing away useful friction, ask what learning the team is avoiding.",
      "If cynicism sounds smart in the meeting, convert the complaint into one contribution or decision.",
      "If exhaustion is being praised, inspect the planning failure that made burnout look heroic.",
    ],
    day: "Within one day, name one piece of armor you used and write the counter-practice you will try in the next meeting.",
    week: "For a week, track when the team rewards control, sarcasm, or overwork; replace one reward with gratitude, boundaries, or shared power.",
  },
  {
    core: "Keep standards and dignity in the same frame: identify the behavior, avoid identity attack, and plan repair that preserves agency.",
    ifs: [
      "If feedback starts sounding like a verdict on worth, rewrite it around observable behavior and impact.",
      "If a consequence is necessary, design the meeting so the person is not turned into a public warning.",
      "If the helper wants to fix pain quickly, stay present and reflect the feeling before offering solutions.",
    ],
    day: "Within one day, revise a hard feedback sentence so it names action, impact, and repair without shame language.",
    week: "For seven days, watch for gossip, humiliation, or contempt; interrupt one pattern and replace it with a dignity-preserving standard.",
  },
  {
    core: "Use curiosity under pressure by asking for missing data, rehearsing useful sentence starters, and holding paradox long enough to learn.",
    ifs: [
      "If certainty arrives too quickly, ask what evidence would change the decision.",
      "If the first sentence of a hard meeting is unpracticed, rehearse it before the live room.",
      "If comfort is making training popular but weak, add practice friction and feedback.",
    ],
    day: "Within one day, replace one defensive answer with a real question that can reveal information you do not yet have.",
    week: "For a week, collect contradictions from frontline data, customer evidence, or colleague concerns and turn one into a better test.",
  },
  {
    core: "Choose the values that can survive pressure, then define the behaviors and slippery shortcuts attached to each one.",
    ifs: [
      "If the list is too long to guide a tradeoff, narrow it until the priority is visible.",
      "If a stated value is being violated in casual behavior, address the behavior immediately instead of saving it for a formal setting.",
      "If generosity is hiding missed agreements, keep good intent and name the broken commitment.",
    ],
    day: "Within one day, pick one value and write the meeting behavior that would prove it when approval is at risk.",
    week: "For seven days, record moments when a value costs comfort; practice one boundary that makes the value observable.",
  },
  {
    core: "Use BRAVING to locate the exact trust behavior under strain instead of asking for global reassurance.",
    ifs: [
      "If confidential information is moving loosely, write the boundary before more sharing happens.",
      "If motivation is high but delivery slips, discuss reliability and realistic commitments.",
      "If a thin story about intent appears, choose the most generous reading the facts can support and set the next limit.",
    ],
    day: "Within one day, choose one strained relationship and mark the single BRAVING letter that needs repair.",
    week: "For a week, document kept promises, boundary misses, vault leaks, and repair attempts so trust becomes discussable evidence.",
  },
  {
    core: "Practice rising by slowing the first draft story, regulating the body, checking data, and proving learning through changed behavior.",
    ifs: [
      "If a slight feels certain, label the story as a draft and ask what information is missing.",
      "If emotion spikes before a reply, regulate first and choose words after the body settles.",
      "If hurt has been offloaded onto someone else, repair the harm before debating the original issue.",
    ],
    day: "Within one day, write one SFD from a recent hook and circle the facts you do not actually have.",
    week: "For seven days, track one recurring story, test it with data, and make one repair that shows the learning changed behavior.",
  },
];

function makeBreakdown(src, idx) {
  const labels = src.namedExamples.map((e) => clean(e.label));
  const summaries = src.namedExamples.map((e) => clean(e.summary));
  const teaches = src.namedExamples.map((e) => clean(e.teachesWhat));
  const concept = clean(src.centralConcept.name);
  const conceptDef = clean(src.centralConcept.plainDefinition);
  const conceptWhy = clean(src.centralConcept.whyItMatters);
  const notes = sentences(src.paraphraseNotes);
  const claims = (src.keyClaims ?? []).map(clean);
  const hard = clean(src.hardEdge);
  const profile = breakdownProfiles[idx];

  const fastRead = [
    paragraph([
      profile.fast,
      clean(src.focus),
      conceptDef,
      summaries[0],
    ]),
    paragraph([
      teaches[0],
      summaries[1],
      teaches[1],
    ]),
  ].join("\n\n");

  const deepRead = [
    paragraph([
      profile.deep,
      profile.deepExtra,
      conceptWhy,
    ]),
    paragraph([
      clean(src.coreClaim),
      claims[0],
      claims[1],
    ]),
    paragraph([
      summaries[2] ?? summaries[1],
      claims[2],
    ]),
  ].join("\n\n");

  const fullParas = [
    paragraph([
      profile.full,
      hard,
      notes[0],
    ]),
    paragraph([
      notes[1],
      notes[2],
    ]),
    paragraph([
      notes[3],
      notes[4],
      claims[3],
    ]),
    paragraph([
      notes[5],
      notes[6],
      claims[4],
    ]),
    paragraph([
      notes[7],
      notes[8],
      claims[5],
    ]),
    paragraph([
      profile.extra,
    ]),
    paragraph([
      profile.close,
      notes[9],
      notes[10],
    ]),
  ].join("\n\n");

  return { fastRead, deepRead, fullRead: fullParas };
}

function makeExamples(src, idx) {
  const labels = src.namedExamples.map((e) => clean(e.label));
  const summaries = src.namedExamples.map((e) => clean(e.summary));
  const teaches = src.namedExamples.map((e) => clean(e.teachesWhat));
  const concept = clean(src.centralConcept.name);
  const details = exampleDetails[idx];
  const exs = [];
  for (let i = 0; i < 6; i++) {
    const label = labels[i % labels.length];
    const summary = summaries[i % summaries.length];
    const teach = teaches[i % teaches.length];
    const name = names[idx][i];
    const domain = domains[idx][i];
    const detail = details[i];
    const scenario = paragraph([
      `${scenes[idx][i]}.`,
      detail.setup,
      summary,
    ]);
    const whatToDo = paragraph([
      detail.move,
      teach,
    ]);
    const whyItMatters = paragraph([
      detail.why,
    ]);
    exs.push({
      exampleId: `dare-to-lead-ch${String(idx + 1).padStart(2, "0")}-ex${String(i + 1).padStart(2, "0")}`,
      title: titles[idx][i],
      tags: [domain, concept, label],
      planSpec: {
        domain,
        audience: `${name} and leaders facing ${domain}`,
        stakes: `the team may confuse ${concept} with comfort, image, or avoidance`,
        format: i === 2 ? "audit" : i === 4 ? "before_after" : "decision_point",
        requiredBeat: `use ${label} to practice ${concept} in ${domain}`,
      },
      scenario,
      whatToDo,
      whyItMatters,
    });
  }
  return exs;
}

function orderChoices(items, correctIndex) {
  const [correct, wrongA, wrongB] = items;
  const choices = ["", "", ""];
  choices[correctIndex] = correct;
  const wrongs = [wrongA, wrongB];
  for (let i = 0; i < 3; i++) if (!choices[i]) choices[i] = wrongs.shift();
  return choices;
}

function makeQuiz(idx) {
  const seq = sequences[idx];
  return {
    passingScorePercent: 70,
    questions: quiz[idx].map(([prompt, correct, wrongA, wrongB, explanation], i) => ({
      questionId: `dare-to-lead-ch${String(idx + 1).padStart(2, "0")}-q${String(i + 1).padStart(2, "0")}`,
      prompt,
      choices: orderChoices([correct, wrongA, wrongB], seq[i]),
      correctIndex: seq[i],
      explanation,
      bloomsLevel: ["apply", "understand", "analyze", "apply", "evaluate", "apply", "understand", "analyze", "evaluate"][i],
      depthLevel: ["standard", "simple", "deep", "standard", "deep", "standard", "simple", "deep", "deep"][i],
    })),
  };
}

function makeCards(src, idx) {
  const labels = src.namedExamples.map((e) => clean(e.label));
  const concept = clean(src.centralConcept.name);
  return [
    {
      front: `When should ${labels[0]} influence a leader?`,
      back: clean(src.namedExamples[0].teachesWhat),
      difficulty: "easy",
    },
    {
      front: `What does ${concept} require under pressure?`,
      back: clean(src.centralConcept.plainDefinition),
      difficulty: "medium",
    },
    {
      front: `Which warning keeps ${concept} honest?`,
      back: clean(src.hardEdge),
      difficulty: "hard",
    },
    {
      front: `How does ${labels[1]} change the next conversation?`,
      back: clean(src.namedExamples[1].teachesWhat),
      difficulty: "medium",
    },
    {
      front: `What does ${labels[2] ?? labels[0]} add to the practice?`,
      back: clean(src.namedExamples[2]?.teachesWhat ?? src.namedExamples[0].teachesWhat),
      difficulty: "hard",
    },
  ].map((card, i) => ({
    cardId: `dare-to-lead-ch${String(idx + 1).padStart(2, "0")}-card${String(i + 1).padStart(2, "0")}`,
    ...card,
  }));
}

function makePlan(src, idx) {
  const labels = src.namedExamples.map((e) => clean(e.label));
  const concept = clean(src.centralConcept.name);
  const plan = planDetails[idx];
  return {
    title: `${src.chapterTitle} practice`,
    coreSkill: paragraph([
      plan.core,
      clean(src.centralConcept.whyItMatters),
    ]),
    ifThenPlans: [
      {
        context: labels[0],
        plan: paragraph([plan.ifs[0], clean(src.namedExamples[0].teachesWhat)]),
      },
      {
        context: labels[1],
        plan: paragraph([plan.ifs[1], clean(src.namedExamples[1].summary)]),
      },
      {
        context: concept,
        plan: paragraph([plan.ifs[2], clean(src.hardEdge)]),
      },
    ],
    twentyFourHourChallenge: plan.day,
    weeklyPractice: plan.week,
  };
}

function chapter(idx) {
  const src = JSON.parse(readFileSync(resolve(sourceDir, `ch${String(idx + 1).padStart(2, "0")}.source.json`), "utf8"));
  const id = index[idx].chapterId;
  const breakdown = makeBreakdown(src, idx);
  return {
    schemaVersion: "chapterflow-v21-authored",
    chapterId: id,
    number: idx + 1,
    title: clean(src.chapterTitle),
    readingTimeMinutes: 12,
    hook: tops[idx].hook,
    counterintuition: tops[idx].counter,
    tryThisNow: tops[idx].tryNow,
    keyTakeaway: tops[idx].key,
    breakdown,
    examples: makeExamples(src, idx),
    quiz: makeQuiz(idx),
    reviewCards: makeCards(src, idx),
    implementationPlan: makePlan(src, idx),
    memorableLines: [
      { text: breakdown.fastRead.split(/(?<=[.!?])\s+/)[0], location: "breakdown.fastRead", why: "Anchors the short read in the source case." },
      { text: breakdown.deepRead.split(/(?<=[.!?])\s+/)[0], location: "breakdown.deepRead", why: "Opens the mechanism tier from a distinct angle." },
      { text: breakdown.fullRead.split(/(?<=[.!?])\s+/)[0], location: "breakdown.fullRead", why: "Starts the full tier with the limit or scope." },
    ],
  };
}

for (let i = 0; i < 8; i++) {
  const ch = JSON.parse(JSON.stringify(chapter(i), (_key, value) => typeof value === "string" ? clean(value) : value));
  const file = `${ch.chapterId}.v21-native.chapter.json`;
  for (const dir of outDirs) writeFileSync(resolve(dir, file), `${JSON.stringify(ch, null, 2)}\n`);
  console.log(`wrote ${file}`);
}
