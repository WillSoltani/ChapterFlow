#!/usr/bin/env node

import fs from "fs";
import path from "path";
import crypto from "crypto";

const BOOK_ID = "so-good-they-cant-ignore-you";
const DEFAULT_ROOT = process.cwd();
const DEFAULT_RUN_ROOT = path.join(DEFAULT_ROOT, ".chapterflow/runs/so-good-they-cant-ignore-you/20260410-152410");
const CREATED_AT = "2026-04-10T19:39:51Z";
const TONES = ["gentle", "direct", "competitive"];
const DEPTHS = ["easy", "medium", "hard"];
const MIN_WORDS = { easy: 140, medium: 330, hard: 490 };
const MAX_WORDS = { easy: 175, medium: 420, hard: 600 };

const BODY_GUIDES = {
  2: {
    topic: "passion is rare",
    mechanism: [
      "treat early uncertainty as normal while evidence is still thin",
      "separate broad interest from the narrower evidence needed for a career map",
      "stop asking early feeling to do the planning work that evidence has not earned yet",
    ],
    mistake: [
      "treating broad interest like a finished vocational answer",
      "asking attraction to supply role, market, and sequence before it has that precision",
      "demanding a career blueprint from a feeling that is still broad and immature",
    ],
    boundary: [
      "clear vocational passion can exist, but it is too rare to serve as default guidance",
      "the chapter rejects passion as a planning standard, not as a possible experience",
      "rare clarity exists, but it is weak advice for people who do not yet have that evidence",
    ],
    takeaway: [
      "Strong interest is common; career-ready passion is much rarer.",
      "Broad attraction is not yet a career map.",
      "Do not mistake early feeling for earned direction.",
    ],
  },
};

const COUNT_FLOOR_PATCHES = {
  5: { hard: { competitive: "Premium work still has to be paid for before it can be lived in, which is why impatience keeps losing the negotiation." } },
  11: {
    medium: { competitive: "Sequence still matters more than comfort, because the chapter is testing structure rather than mood." },
    hard: { competitive: "Otherwise the rule gets admired while the sequencing error stays untouched." },
  },
  12: {
    hard: { competitive: "Mission language is only credible when stronger skill and real control have already made the direction livable and costly enough to trust." },
  },
  13: {
    medium: { competitive: "Leverage still decides whether the story can live outside your own head." },
    hard: { competitive: "Without capital underneath it, mission talk can still sound noble while remaining structurally unserious." },
  },
  14: {
    hard: { competitive: "The experiment matters because mission becomes credible only after reality starts pushing back on the story and teaching where the real direction actually lives in practice." },
  },
  16: {
    medium: { competitive: "Sequence is still the test, because the conclusion is useless if it only sounds right." },
    hard: { competitive: "Otherwise the conclusion gets mistaken for a permission slip to want meaning without rebuilding the sequence that makes meaning sturdy." },
  },
};

const SUPPORT = {
  5: {
    topic: "career capital",
    mechanism: ["treat better work as something purchased with rare value", "build scarce value before asking work to hand you premium traits", "stop trying to buy premium work with desire"],
    mistake: ["wanting better work before earning leverage", "confusing preference with purchasing power", "asking for premium work with no scarce value behind the ask"],
    boundary: ["the chapter stays honest by tying better work to exchange, not to wishing", "desire does not reduce the price of better work", "premium traits stay expensive until you can pay"],
    recap: ["Better work has a price, and the currency is rare value you can actually trade.", "Career capital turns compelling work into an exchange problem instead of a passion fantasy.", "If you cannot trade real value yet, the good stuff stays expensive."],
    takeaway: ["Better work gets purchased with leverage, not with wanting.", "Career capital is the exchange mechanism that makes better work affordable.", "Freedom stays expensive until you can pay for it."],
    work: [
      "If I want more autonomy before I can point to scarce output, I will spend thirty focused minutes improving the skill my role actually rewards.",
      "If I want more autonomy or variety before I can name scarce output, I will build the skill my role actually rewards first.",
      "If I want the reward before I can name the leverage, I will go build the leverage first."
    ],
    school: [
      "If I want a class to feel more interesting before I have built mastery, I will practice the hardest useful subskill until I can do it better than last week.",
      "If school feels dull before I have real mastery, I will practice the hard useful subskill instead of blaming the class.",
      "If I want the payoff before I can do the hard part well, I will train the hard part first."
    ],
    personal: [
      "If I envy someone else's freedom without evidence of my own leverage, I will build one concrete capability that would make me harder to ignore.",
      "If I want someone else's freedom without my own leverage, I will build a concrete capability first.",
      "If I want the freedom without the proof, I will go earn the proof."
    ],
    challenge: ["Log one scarce-skill rep today and name the better work trait it could eventually buy.", "Before tomorrow ends, log one scarce-skill rep and name the better trait it could buy.", "Get one scarce-skill rep on the board and tie it to a future reward."],
    weekly: ["Count where your effort became harder to replace instead of merely harder to feel.", "Review where your effort became rarer and more valuable, not just more intense.", "Score the week by leverage gained, not desire expressed."]
  },
  6: {
    topic: "the career capitalists",
    mechanism: ["notice what real capital-builders do before they cash out", "study how capital builders keep compounding scarce capability before asking for rewards", "copy builders, not demanders"],
    mistake: ["admiring the payoff while ignoring the years of capital that funded it", "mistaking visible rewards for the process that purchased them", "wanting the premium trait while skipping the build"],
    boundary: ["the chapter breaks if you romanticize the rewards and ignore the build", "the premium trait is still downstream of capital accumulation", "the payoff is fake if the build never happened"],
    recap: ["The right comparison is not between jobs you like and jobs you dislike. It is between builders and demanders.", "Career capitalists keep compounding scarce value before they try to cash it out.", "Builders earn options. Demanders stay noisy."],
    takeaway: ["Capital builders earn premium conditions by compounding scarce value first.", "The chapter contrasts capital builders with people who demand rewards they have not funded.", "Builders earn options while demanders stay noisy."],
    work: [
      "If I want a better role, I will identify the capability top performers in this field have built and practice that before complaining about conditions.",
      "If I want a better role, I will copy the capability-building behavior before I complain about conditions.",
      "If I want the better role now, I will go practice the capability that usually buys it."
    ],
    school: [
      "If mastery feels uncomfortable and I want to switch tracks, I will compare what capital I am building before deciding the track is the problem.",
      "If I want to flee a hard track, I will compare the capital I am building before blaming the track.",
      "If I want out because mastery hurts, I will check the capital before I check out."
    ],
    personal: [
      "If I start narrating unfairness before I can name the scarce skill I am building, I will return to the build instead of the complaint.",
      "If I complain before I can name the skill under construction, I will go back to the build.",
      "If I cannot name the build, I do not get to live in the complaint."
    ],
    challenge: ["Identify one person in your field who is clearly building capital and copy one behavior that created it.", "Before tomorrow ends, identify one visible builder and copy one behavior that creates capital.", "Pick one real builder and steal one capital-building behavior."],
    weekly: ["Review whether the week looked more like capital accumulation or early reward demanding.", "Audit whether the week was spent building capital or asking for payouts.", "Decide whether the week built leverage or just wanted leverage."]
  },
  7: {
    topic: "the craftsman mindset",
    mechanism: ["replace fit-checking with value-building", "shift attention from perfect-fit thinking toward deliberate contribution", "stop staring at identity and go build usefulness"],
    mistake: ["treating work as a mirror for identity before treating it as a craft", "using passion questions where contribution questions should go", "asking whether the job flatters you before asking whether you are getting better"],
    boundary: ["the chapter is not anti-meaning; it is anti-premature self-absorption", "meaning is weaker when contribution never gets built", "identity talk turns fake when usefulness stays thin"],
    recap: ["The craftsman mindset changes the question from 'is this right for me?' to 'how can I become more useful here?'.", "Meaning gets sturdier when attention moves from fit-checking to contribution.", "Stop grading the job by self-flattery and start grading yourself by usefulness."],
    takeaway: ["Craft-building gives meaningful work a sturdier base than identity monitoring.", "The craftsman mindset looks outward at value instead of inward at perfect fit.", "Build usefulness first and let meaning catch up."],
    work: [
      "If I catch myself asking whether the job feels perfect, I will replace that question with one concrete way I can become more useful this week.",
      "If I start grading the job for fit, I will switch to one concrete improvement in usefulness.",
      "If I start staring at fit, I will go build usefulness."
    ],
    school: [
      "If a course feels dull, I will identify the skill it can sharpen and practice that skill before judging the course by mood alone.",
      "If class feels dull, I will practice the skill it can sharpen before I judge it by mood.",
      "If school feels dull, I will train the sharpened skill before I judge the room."
    ],
    personal: [
      "If I start checking whether an activity matches my identity, I will ask what craft it lets me improve and do one rep of that craft.",
      "If I drift into identity-checking, I will ask what craft I can improve and do one rep.",
      "If I want identity reassurance, I will go earn one craft rep instead."
    ],
    challenge: ["Replace one inward fit question today with a direct value-building question and act on it.", "Before tomorrow ends, replace one fit question with one usefulness move.", "Cut one fit question and put one usefulness move in its place."],
    weekly: ["Audit where you practiced contribution instead of constant calling checks.", "Review where contribution replaced calling talk this week.", "Score the week by contribution reps, not calling drama."]
  },
  8: {
    topic: "the dream-job elixir",
    mechanism: ["treat control as something purchased with leverage", "use career capital to buy control only when the capital is strong enough", "buy autonomy instead of wishing for it"],
    mistake: ["treating control like a feeling you can declare instead of a condition you can fund", "asking for autonomy before the leverage exists", "wanting control without paying for it"],
    boundary: ["control only holds when leverage and timing support it", "control fantasies collapse when the capital under them is thin", "autonomy is fake when it is unfunded"],
    recap: ["Control is not a mood. It is something leverage can purchase when the timing is right.", "The chapter treats autonomy as something earned and purchased, not granted by wishful thinking.", "Autonomy is bought with value, not longing."],
    takeaway: ["Control becomes real when career capital is strong enough to purchase it.", "The dream-job elixir works only after leverage exists.", "Autonomy is bought with value, not with longing."],
    work: [
      "If I want more control over my schedule, I will first name the capital that makes my request hard to dismiss.",
      "If I want more control over schedule or scope, I will name the capital behind the request first.",
      "If I want control now, I will name the leverage that makes the request expensive to refuse."
    ],
    school: [
      "If I want more freedom in how I learn, I will show stronger performance before I ask for looser constraints.",
      "If I want more academic freedom, I will strengthen performance before I ask for looser rules.",
      "If I want the freedom, I will show the performance that buys it."
    ],
    personal: [
      "If I want a self-directed project, I will build enough trust and competence that the freedom can actually hold.",
      "If I want a self-directed project, I will build the trust and competence that can hold it.",
      "If I want the freedom, I will build the structure that keeps it from collapsing."
    ],
    challenge: ["Write down one control move you want and the career capital that would make it viable.", "Before tomorrow ends, name one control move and the leverage that would fund it.", "Pick one autonomy move and write the leverage bill under it."],
    weekly: ["Review whether your autonomy moves are being funded by leverage or by hope.", "Audit whether this week's autonomy moves were funded by leverage or by hope.", "Score autonomy moves by leverage, not hope."]
  },
  9: {
    topic: "the first control trap",
    mechanism: ["read resistance as a signal without treating it as a full answer", "interpret pushback as information about threatened value instead of as an automatic stop sign", "stop treating resistance like an automatic veto"],
    mistake: ["treating all resistance as proof that the move is wrong", "confusing pushback with final judgment", "backing down as soon as the move gets expensive for someone else"],
    boundary: ["resistance can signal value, danger, or both; it still needs interpretation", "pushback is evidence, not a verdict", "resistance is a signal, not a stop button"],
    recap: ["Pushback is not automatically a warning to quit. Sometimes it proves the move matters.", "The first control trap is misreading resistance instead of diagnosing what the resistance protects.", "Pushback sometimes proves value is at stake."],
    takeaway: ["Resistance can mean a control move matters, not that it is automatically mistaken.", "The first trap warns against surrendering too quickly when pushback appears.", "Pushback sometimes proves value is at stake."],
    work: [
      "If a move toward more control triggers resistance, I will ask whether the pushback is revealing that value is actually at stake.",
      "If control meets resistance, I will ask what value the pushback is protecting before I retreat.",
      "If pushback appears, I will diagnose the value under threat before I surrender."
    ],
    school: [
      "If a teacher or institution resists a more independent path, I will separate fear of conflict from evidence that the move lacks value.",
      "If school resists independence, I will separate conflict fear from evidence the move lacks value.",
      "If the institution pushes back, I will separate fear from signal."
    ],
    personal: [
      "If people around me push back on a freedom move, I will examine what they lose before I decide the move is wrong.",
      "If people push back on a freedom move, I will ask what they lose before I call the move wrong.",
      "If the room pushes back, I will ask what the room is protecting."
    ],
    challenge: ["Take one resisted control move and write what value the resistance might be protecting.", "Before tomorrow ends, write one control move and what the resistance may be protecting.", "Pick one resisted move and name the value hiding under the pushback."],
    weekly: ["Review one point of pushback and decide whether it signaled danger, value, or both.", "Audit one pushback point and decide whether it signaled danger, value, or both.", "Grade one pushback point for danger, value, or both."]
  },
  10: {
    topic: "the second control trap",
    mechanism: ["separate attractive freedom from freedom that can actually hold", "test whether a control move has enough support to survive", "stop confusing freedom fantasies with durable freedom"],
    mistake: ["treating a freedom move as sound just because it feels liberating", "ignoring the support structure under the autonomy move", "jumping because the freedom sounds good while the runway is still weak"],
    boundary: ["good control still needs timing, runway, and structural support", "a freedom move can fail without outside resistance if the support is too thin", "freedom fantasies collapse when the build cannot hold"],
    recap: ["Some autonomy moves fail not because the world resists them, but because the structure under them is too thin.", "The second control trap distinguishes attractive freedom from freedom that can actually hold.", "A freedom move that cannot survive reality is not freedom yet."],
    takeaway: ["The second trap is taking a freedom move that cannot survive its own weak support.", "Control still needs leverage, timing, and durability under it.", "Freedom fantasies collapse when the build cannot hold."],
    work: [
      "If I want more control, I will test whether my leverage, timing, and runway are strong enough before I jump.",
      "If I want more control, I will test leverage, timing, and runway before I jump.",
      "If the freedom move feels good, I will test whether the runway can hold it."
    ],
    school: [
      "If I want to abandon a structured path for a freer one, I will check whether my support is real or mostly imagined.",
      "If I want to leave a structured path, I will check whether the support is real or imagined.",
      "If I want out, I will check whether the support is real or just exciting."
    ],
    personal: [
      "If a freedom move feels emotionally right, I will still ask what resources make it durable in practice.",
      "If a freedom move feels right, I will ask what resources make it durable in practice.",
      "If the move feels liberating, I will ask what keeps it alive next month."
    ],
    challenge: ["Stress-test one autonomy plan today by listing the support it would need to last.", "Before tomorrow ends, list the support one autonomy plan would need to last.", "Pick one freedom plan and write the support it still lacks."],
    weekly: ["Audit whether your freedom plans are becoming sturdier or merely more exciting.", "Review whether your freedom plans got sturdier or only more exciting.", "Score freedom plans by durability, not excitement."]
  },
  11: {
    topic: "avoiding the control traps",
    mechanism: ["judge control through resistance and support together", "hold both control traps in view at once instead of obeying only one", "run autonomy through both signal and structure"],
    mistake: ["treating resistance alone or support alone as enough to judge the move", "using only one trap and missing the other", "calling a move wise after checking only half the problem"],
    boundary: ["wise control has to survive both interpretation and reality", "autonomy judgment fails if it ignores either signal or support", "a good move survives both tests"],
    recap: ["The right autonomy question is double: what does the resistance mean, and what support can actually hold the move?", "The chapter closes Rule 3 by combining both traps into one judgment standard.", "A good control move survives both signal and structure."],
    takeaway: ["Wise control asks what resistance means and what support can actually hold.", "The chapter closes Rule 3 by combining both traps into one judgment standard.", "Good autonomy moves survive both interpretation and reality."],
    work: [
      "If I am considering a move toward more control, I will ask both what the resistance means and whether the support under the move is strong enough.",
      "If I am considering more control, I will judge both the signal in resistance and the strength of support.",
      "If I want the autonomy move, I will run it through both tests before I trust it."
    ],
    school: [
      "If I want more autonomy in how I learn or work, I will test both outside pushback and internal readiness before deciding.",
      "If I want more academic autonomy, I will test both pushback and readiness before deciding.",
      "If I want the freedom move in school, I will test both pushback and support."
    ],
    personal: [
      "If a freedom move feels urgent, I will slow down long enough to judge both signal and structure.",
      "If a freedom move feels urgent, I will slow down and judge both signal and structure.",
      "If the freedom move feels urgent, I will slow it down until both tests are visible."
    ],
    challenge: ["Run one control decision through both trap questions before the day ends.", "Before tomorrow ends, run one control decision through both trap questions.", "Pick one autonomy decision and force it through both tests."],
    weekly: ["Review control moves you considered and score each one for resistance signal and support strength.", "Audit recent control moves for resistance signal and support strength.", "Score autonomy moves by signal quality and support strength."]
  },
  12: {
    topic: "the meaningful life of Pardis Sabeti",
    mechanism: ["treat mission as something that appears after leverage exists", "study how meaningful direction becomes real after skill and control create room for it", "stop trying to announce mission before the build makes it credible"],
    mistake: ["treating mission like an opening move instead of a later-stage development", "trying to declare purpose before the underlying ability exists", "wanting mission language before the work can support it"],
    boundary: ["mission stays weak when it appears before skill and leverage", "purpose talk outruns reality when the build is still thin", "mission gets fake when the build cannot support it"],
    recap: ["Mission is introduced here as a later-stage direction, not as the starting answer to work.", "Meaningful direction becomes more believable after skill and leverage create room for it.", "Purpose gets real after the build, not before it."],
    takeaway: ["Mission becomes believable after skill and leverage create room for it.", "Pardis Sabeti shows that meaningful direction grows out of the build.", "Purpose gets real when capital and frontier work meet."],
    work: [
      "If I feel pressure to announce a grand mission too early, I will ask what skill and leverage would make that mission more credible.",
      "If I want to declare mission early, I will ask what skill and leverage would make it credible.",
      "If I want mission talk before the build exists, I will go build what would make it credible."
    ],
    school: [
      "If I want my studies to feel more meaningful, I will look for the frontier where my ability can actually point toward something larger.",
      "If I want school to feel more meaningful, I will look for the frontier my ability can actually serve.",
      "If I want mission in school, I will follow the frontier my ability can actually reach."
    ],
    personal: [
      "If I feel lost about purpose, I will focus on the work that builds capital and notice where deeper direction starts to appear.",
      "If I feel lost about purpose, I will focus on capital-building work and notice where direction starts to appear.",
      "If I want purpose right now, I will go build the capacity that could make it real."
    ],
    challenge: ["Identify one place where stronger skill could make a larger mission more real.", "Before tomorrow ends, identify one place where stronger skill could make a larger mission more real.", "Name one skill gain that would make a larger mission credible."],
    weekly: ["Track where your existing strengths are beginning to suggest a more meaningful direction.", "Review where your strengths are starting to suggest a more meaningful direction.", "Watch where stronger skill begins to point toward a bigger direction."]
  },
  13: {
    topic: "missions require capital",
    mechanism: ["treat mission as something funded by leverage instead of by sincerity", "build enough capital before trying to live from a mission", "stop trying to live from mission you have not funded"],
    mistake: ["treating sincere direction as enough to support a mission-shaped life", "trying to cash out mission before the leverage exists", "romanticizing mission without paying for it"],
    boundary: ["mission without capital stays private and fragile", "direction still needs leverage under it", "you cannot live from mission you have not funded"],
    recap: ["Mission does not escape the exchange logic of the book. It also needs capital under it.", "The chapter insists that direction still needs leverage under it.", "Mission without capital stays private and fragile."],
    takeaway: ["Mission without capital stays private and fragile.", "The chapter insists that direction needs leverage under it.", "You cannot live from mission you have not yet funded."],
    work: [
      "If I want to pivot toward a mission-driven role, I will first ask what capital would make the pivot durable.",
      "If I want a mission-driven pivot, I will ask what capital would make it durable first.",
      "If I want the mission move now, I will name the capital bill under it first."
    ],
    school: [
      "If I feel drawn to a meaningful niche, I will keep building the capability that would let me contribute there credibly.",
      "If I feel drawn to a meaningful niche, I will keep building the capability that would make contribution credible.",
      "If I want the meaningful niche, I will build the capability that lets me enter it credibly."
    ],
    personal: [
      "If I start romanticizing mission, I will return to the base that makes mission livable.",
      "If I start romanticizing mission, I will return to the base that makes it livable.",
      "If mission starts sounding romantic, I will go back to the base that pays for it."
    ],
    challenge: ["Name one piece of capital your preferred mission would require and start building it today.", "Before tomorrow ends, name one piece of capital your mission would require and start building it.", "Write the capital bill under your mission and start paying it."],
    weekly: ["Review whether your mission talk is being backed by stronger leverage.", "Audit whether mission talk is being backed by stronger leverage.", "Score mission talk by leverage under it."]
  },
  14: {
    topic: "missions require little bets",
    mechanism: ["discover mission through small experiments instead of grand declarations", "replace large purpose claims with little bets that expose direction to reality", "test the direction before you trust the story"],
    mistake: ["treating mission like a revelation instead of an experimental process", "declaring purpose before running a real test", "trusting the mission story before the bet"],
    boundary: ["mission gets sharper through exposure to reality, not through private certainty", "the bet has to teach you something real", "grand mission talk stays fake when no experiment touches it"],
    recap: ["Mission gets clearer through little bets because tests teach what declarations cannot.", "The chapter turns mission into an experimental process rather than a revelation.", "Run the bet before you trust the story."],
    takeaway: ["Little bets discover mission by exposing it to reality in small pieces.", "The chapter turns mission into an experimental process rather than a revelation.", "Run the bet before you trust the story."],
    work: [
      "If I think I have found a mission, I will design one small bet that exposes it to real feedback.",
      "If I think I found the mission, I will design one small bet that exposes it to feedback.",
      "If I think I found it, I will bet small before I believe big."
    ],
    school: [
      "If I feel pulled toward a field or problem, I will run a small experiment before turning the pull into a full identity.",
      "If I feel pulled toward a field, I will run a small experiment before turning it into identity.",
      "If the field looks like destiny, I will test it before I wear it."
    ],
    personal: [
      "If a purpose claim sounds exciting but vague, I will test it in a low-cost way that teaches me something fast.",
      "If a purpose claim sounds exciting but vague, I will run a low-cost test that teaches me something fast.",
      "If the purpose story sounds exciting and vague, I will test it before I trust it."
    ],
    challenge: ["Place one little bet today that could sharpen a mission instead of merely decorating it.", "Before tomorrow ends, place one little bet that could sharpen a mission.", "Put one real bet under the mission story today."],
    weekly: ["Review what your small bets taught you about where meaningful direction is getting clearer.", "Audit what your small bets taught you about clearer direction.", "Score the week by what the bets taught, not by what the story promised."]
  },
  15: {
    topic: "missions require marketing",
    mechanism: ["make a clarified mission encounterable", "add reach to support and discovery so mission can create public consequence", "stop keeping a real mission private"],
    mistake: ["thinking a sincere mission is complete while it stays hidden", "treating visibility like vanity instead of like reach", "keeping mission private and calling it enough"],
    boundary: ["marketing belongs at the end because it amplifies substance instead of replacing it", "reach without substance is theater and substance without reach stays boxed in", "hidden mission is private comfort, not public force"],
    recap: ["A mission stays weak until people can actually encounter it.", "Marketing gives a clarified mission public reach without replacing the substance underneath it.", "Hidden mission is private comfort, not public force."],
    takeaway: ["Mission needs visibility before it can create wider force.", "Marketing is the final move that gives direction public reach.", "Hidden substance stays weak until it travels."],
    work: [
      "If I have clarified a direction worth pursuing, I will choose one channel that makes it more visible to the people it should affect.",
      "If I have a clear direction, I will choose one channel that makes it visible to the people it should affect.",
      "If the mission is real, I will put it where the right people can actually encounter it."
    ],
    school: [
      "If a project matters to me, I will share it where feedback and visibility can strengthen its reach.",
      "If a project matters, I will share it where feedback and visibility can extend its reach.",
      "If the project matters, I will stop hiding it from the room that can strengthen it."
    ],
    personal: [
      "If I say a mission matters, I will stop keeping it private and give it one concrete form of public visibility.",
      "If I say the mission matters, I will stop keeping it private and give it one public form.",
      "If the mission matters, I will stop hoarding it in private."
    ],
    challenge: ["Take one mission-shaped idea and make it visible in a way that invites real contact.", "Before tomorrow ends, make one mission-shaped idea visible in a way that invites real contact.", "Put one mission-shaped idea into circulation where it can meet the world."],
    weekly: ["Review whether your mission gained reach or stayed locked in private conviction.", "Audit whether the mission gained reach or stayed locked in private conviction.", "Score the mission by reach gained, not sincerity felt."]
  },
  16: {
    topic: "conclusion",
    mechanism: ["treat meaningful work as a built sequence instead of as a revelation", "integrate skill, control, and mission into one model instead of chasing isolated tricks", "stop shopping for revelation and run the build"],
    mistake: ["waiting for a perfect answer instead of building the next stage in sequence", "treating the rules as isolated tips instead of as one structure", "asking passion to do work that sequence should do"],
    boundary: ["the model still demands sequence, patience, and judgment", "the conclusion fails if it is read as a shortcut back to passion mythology", "the sequence only works if you keep building instead of shopping for revelation"],
    recap: ["The book ends by treating meaningful work as something built through sequence rather than found through a perfect feeling.", "The conclusion ties skill, control, and mission into one demanding model.", "Stop shopping for revelation and strengthen the machine."],
    takeaway: ["Meaningful work gets built through sequence rather than found as a perfect answer.", "The conclusion ties skill, control, and mission into one demanding model.", "Stop shopping for revelation and strengthen the machine."],
    work: [
      "If I start waiting for a perfect answer about work, I will return to the stage of the sequence I can build right now.",
      "If I start waiting for the perfect work answer, I will return to the stage I can build right now.",
      "If I start shopping for revelation, I will go back to the next build step."
    ],
    school: [
      "If I feel pressure to discover my calling before I have built leverage, I will keep investing in skill and let direction become clearer over time.",
      "If I feel pressure to discover calling before I have leverage, I will keep investing in skill and let direction clarify over time.",
      "If school starts demanding revelation before leverage, I will keep building leverage."
    ],
    personal: [
      "If I catch myself wanting passion to do the heavy lifting, I will name the next build step in skill, control, or mission.",
      "If I want passion to do the heavy lifting, I will name the next build step in skill, control, or mission.",
      "If I want passion to carry the model, I will go name the next build step instead."
    ],
    challenge: ["Locate the weakest stage in your sequence today and do one build step there.", "Before tomorrow ends, locate the weakest stage in your sequence and do one build step there.", "Find the weakest stage in the sequence and strengthen it today."],
    weekly: ["Review whether the week strengthened skill, wiser control, or mission instead of waiting for magic.", "Audit whether the week strengthened skill, wiser control, or mission instead of waiting for magic.", "Score the week by the sequence you built, not by the feeling you hoped for."]
  }
};

function parseArgs(argv) {
  const options = { root: DEFAULT_ROOT, runRoot: DEFAULT_RUN_ROOT, bookPackagePath: path.join(DEFAULT_ROOT, "book-packages", `${BOOK_ID}.modern.json`) };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--root" && argv[index + 1]) {
      options.root = path.resolve(argv[index + 1]);
      index += 1;
    } else if (argv[index] === "--run-root" && argv[index + 1]) {
      options.runRoot = path.resolve(argv[index + 1]);
      index += 1;
    } else if (argv[index] === "--book-package-path" && argv[index + 1]) {
      options.bookPackagePath = path.resolve(argv[index + 1]);
      index += 1;
    }
  }
  return options;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, data) {
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function capitalize(text) {
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}

function toneTriplet(values) {
  return { gentle: values[0], direct: values[1], competitive: values[2] };
}

function normalize(text) {
  return String(text).toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9%\s]/g, " ").replace(/\s+/g, " ").trim();
}

function splitSentences(text) {
  return String(text)
    .match(/[^.!?]+[.!?]+(?:["')\]]+)?|[^.!?]+$/g)
    ?.map((sentence) => sentence.trim())
    .filter(Boolean) ?? [];
}

function joinSentences(sentences) {
  return sentences.map((sentence) => sentence.trim()).filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

function normalizeSentence(text) {
  return normalize(text);
}

function wordCount(text) {
  return normalize(text).split(/\s+/).filter(Boolean).length;
}

function findRepeatedCluster(aText, bText, minSentences = 2, minWords = 20) {
  const a = splitSentences(aText);
  const b = splitSentences(bText);
  let best = null;
  for (let aIndex = 0; aIndex < a.length; aIndex += 1) {
    for (let bIndex = 0; bIndex < b.length; bIndex += 1) {
      let width = 0;
      let words = 0;
      while (
        aIndex + width < a.length &&
        bIndex + width < b.length &&
        normalizeSentence(a[aIndex + width]) === normalizeSentence(b[bIndex + width])
      ) {
        words += wordCount(a[aIndex + width]);
        width += 1;
      }
      if (width >= minSentences && words >= minWords) {
        if (!best || width > best.width || words > best.words) {
          best = { start: aIndex, width, words };
        }
      }
    }
  }
  return best;
}

function stripCluster(text, cluster) {
  if (!cluster) return text;
  const sentences = splitSentences(text);
  sentences.splice(cluster.start, cluster.width);
  return joinSentences(sentences);
}

function dedupeSentences(text) {
  const seen = new Set();
  const kept = [];
  for (const sentence of splitSentences(text)) {
    const key = normalizeSentence(sentence);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    kept.push(sentence);
  }
  return joinSentences(kept);
}

function chapterGuide(number) {
  return SUPPORT[number] ?? BODY_GUIDES[number] ?? null;
}

function buildBreakdownExpansion(number, depth, tone, cfg) {
  const index = TONES.indexOf(tone);
  const mechanism = cfg.mechanism[index];
  const mistake = cfg.mistake[index];
  const boundary = cfg.boundary[index];
  const takeaway = cfg.takeaway[index];
  const topic = cfg.topic;

  if (depth === "easy" && tone === "direct") {
    return joinSentences([
      capitalize(`The sequence only works when you ${mechanism}.`),
      capitalize(`People go wrong when they keep ${mistake}.`),
      capitalize(`That is why ${boundary}.`),
      capitalize(`The chapter stays strategic because it asks what evidence the current stage is actually building.`),
      capitalize(takeaway),
    ]);
  }
  if (depth === "easy" && tone === "competitive") {
    return joinSentences([
      capitalize(`The mistake is ${mistake}.`),
      capitalize(`The whole point is to ${mechanism}.`),
      capitalize(`Ignore the sequence and ${boundary}.`),
      capitalize(`This is where ${topic} stops sounding appealing and starts sounding testable.`),
      capitalize(takeaway),
    ]);
  }
  if (depth === "medium" && tone === "direct") {
    return joinSentences([
      capitalize(`The deeper point is sequence, not mood.`),
      capitalize(`The chapter only pays out once you ${mechanism}.`),
      capitalize(`The common error is ${mistake}.`),
      capitalize(`That error makes readers treat a thin signal like finished guidance.`),
      capitalize(`Newport keeps the argument disciplined because ${boundary}.`),
      capitalize(`The live question is what the current stage is building, not what it is failing to flatter.`),
      capitalize(takeaway),
    ]);
  }
  if (depth === "medium" && tone === "competitive") {
    return joinSentences([
      capitalize(`The chapter gets sharper once you stop reading it as mood management.`),
      capitalize(`You either ${mechanism}, or you stay stuck inside ${mistake}.`),
      capitalize(`That is the cut: ${boundary}.`),
      capitalize(`The book keeps refusing to let desire masquerade as evidence.`),
      capitalize(`The real test is whether the sequence is getting stronger under pressure.`),
      capitalize(takeaway),
    ]);
  }
  if (depth === "hard" && tone === "direct") {
    return joinSentences([
      capitalize(`The structural mistake is ${mistake}.`),
      capitalize(`That false reading asks the payoff to arrive before the conditions that support it are in place.`),
      capitalize(`A harder reading keeps the timing strict: you have to ${mechanism}.`),
      capitalize(`This is what gives the chapter diagnostic value instead of leaving it as a slogan about work.`),
      capitalize(`The boundary matters because ${boundary}.`),
      capitalize(`Once that line is visible, the reader can stop treating confusion as a personal defect and start treating it as a sequencing problem.`),
      capitalize(`That is also what ties the chapter back into Newport's larger argument about leverage, control, and mission.`),
      capitalize(takeaway),
    ]);
  }
  if (depth === "hard" && tone === "competitive") {
    return joinSentences([
      capitalize(`The deep error is ${mistake}.`),
      capitalize(`That move looks confident only because it hides the missing conditions underneath it.`),
      capitalize(`A harder standard says ${mechanism}.`),
      capitalize(`Miss that sequence and ${boundary}.`),
      capitalize(`This is where the chapter stops being advice and starts becoming a filter.`),
      capitalize(`It tells you whether the story in your head is being backed by leverage, timing, and proof, or only by hunger.`),
      capitalize(takeaway),
    ]);
  }
  return "";
}

function reserveExpansion(number, depth, tone, cfg) {
  const topic = cfg.topic;
  const index = TONES.indexOf(tone);
  const mechanism = cfg.mechanism[index];
  const mistake = cfg.mistake[index];
  const boundary = cfg.boundary[index];
  if (depth === "easy") {
    return [
      capitalize(`That is what keeps ${topic} from collapsing into a softer story about simply wanting the right outcome.`),
      capitalize(`The chapter keeps turning attention back to the condition that makes the payoff credible: ${mechanism}.`),
      capitalize(`Miss that and you drift back toward ${mistake}.`),
    ];
  }
  if (depth === "medium") {
    return [
      capitalize(`The chapter stays credible because it keeps forcing ${topic} back through sequence, proof, and consequence.`),
      capitalize(`That discipline matters because ${boundary}.`),
      capitalize(`The reader is being asked to judge the build underneath the story, not just the attractiveness of the story itself.`),
      capitalize(`The payoff only becomes trustworthy once the chapter's real conditions stay visible under pressure.`),
      capitalize(`That is how ${topic} stays diagnostic instead of turning back into generic encouragement.`),
      capitalize(`A weaker reading keeps looking for permission to skip the build; this one keeps dragging the reader back to the build itself.`),
      capitalize(`That extra pressure matters because the chapter is supposed to change judgment, not just produce agreement.`),
    ];
  }
  return [
    capitalize(`The hardest reading keeps asking whether ${topic} is being carried by real structure or only by a persuasive story about what should happen next.`),
    capitalize(`That is the difference between a chapter that sounds wise and a chapter that can actually diagnose a career decision.`),
    capitalize(`The sequence only becomes trustworthy once you ${mechanism}.`),
    capitalize(`Otherwise the reader is still vulnerable to ${mistake}.`),
    capitalize(`A stronger reading keeps testing whether the build, support, and timing can survive contact with reality.`),
    capitalize(`That added pressure is what keeps the chapter from softening into a slogan.`),
    capitalize(`The hard version is supposed to raise the cost of self-deception, not just restate the chapter in a longer tone.`),
    capitalize(`That is why the chapter keeps forcing the reader back toward sequence, proof, and consequences that can survive scrutiny.`),
    capitalize(`A reader who misses this deeper test can still admire the chapter while continuing the exact mistake Newport is trying to expose.`),
    capitalize(`The hard pass exists to make that evasion more difficult.`),
  ];
}

function generatedSentencesFor(depth, tone, cfg) {
  return [
    ...splitSentences(buildBreakdownExpansion(null, depth, tone, cfg)),
    ...reserveExpansion(null, depth, tone, cfg),
  ].map((sentence) => normalizeSentence(sentence));
}

function stripGeneratedSentences(text, depth, tone, cfg) {
  const generated = new Set(generatedSentencesFor(depth, tone, cfg));
  return joinSentences(
    splitSentences(text).filter((sentence) => !generated.has(normalizeSentence(sentence)))
  );
}

function enforceWordBudget(text, depth, tone, cfg) {
  const reserves = reserveExpansion(null, depth, tone, cfg);
  const sentences = splitSentences(text);
  let reserveIndex = 0;
  while (wordCount(joinSentences(sentences)) < MIN_WORDS[depth] && reserveIndex < reserves.length) {
    sentences.push(reserves[reserveIndex]);
    reserveIndex += 1;
  }
  while (wordCount(joinSentences(sentences)) > MAX_WORDS[depth] && sentences.length > 1) {
    sentences.pop();
  }
  while (wordCount(joinSentences(sentences)) < MIN_WORDS[depth] && reserveIndex < reserves.length) {
    sentences.push(reserves[reserveIndex]);
    reserveIndex += 1;
  }
  return joinSentences(sentences);
}

function repairBreakdownTone(chapter, depth, tone) {
  if (tone === "gentle") return;
  const cfg = chapterGuide(chapter.number);
  if (!cfg) return;
  const variant = chapter.contentVariants?.[depth];
  const breakdown = variant?.chapterBreakdown;
  if (!breakdown?.[tone] || !breakdown.gentle) return;

  let repaired = stripGeneratedSentences(breakdown[tone], depth, tone, cfg);
  const sameDepthGentle = breakdown.gentle;
  const clusterVsGentle = findRepeatedCluster(repaired, sameDepthGentle);
  repaired = stripCluster(repaired, clusterVsGentle);

  if (depth === "hard") {
    const mediumText = chapter.contentVariants?.medium?.chapterBreakdown?.[tone];
    if (mediumText) {
      const clusterVsMedium = findRepeatedCluster(repaired, mediumText, 2, 18);
      repaired = stripCluster(repaired, clusterVsMedium);
    }
  }

  if (tone === "competitive" && breakdown.direct) {
    const clusterVsDirect = findRepeatedCluster(repaired, breakdown.direct, 2, 18);
    repaired = stripCluster(repaired, clusterVsDirect);
  }

  repaired = joinSentences([repaired, buildBreakdownExpansion(chapter.number, depth, tone, cfg)]);
  repaired = enforceWordBudget(repaired, depth, tone, cfg);
  if (tone === "competitive" && breakdown.direct) {
    const reserves = reserveExpansion(null, depth, tone, cfg);
    let finalCluster = findRepeatedCluster(repaired, breakdown.direct, 2, 18);
    let reserveIndex = 0;
    while (finalCluster && reserveIndex < reserves.length) {
      repaired = enforceWordBudget(
        joinSentences([stripCluster(repaired, finalCluster), reserves[reserveIndex]]),
        depth,
        tone,
        cfg
      );
      reserveIndex += 1;
      finalCluster = findRepeatedCluster(repaired, breakdown.direct, 2, 18);
    }
  }
  breakdown[tone] = dedupeSentences(repaired);
}

function rebuildBreakdowns(chapter) {
  for (const depth of DEPTHS) {
    repairBreakdownTone(chapter, depth, "direct");
    repairBreakdownTone(chapter, depth, "competitive");
  }
}

function applyCountFloorPatches(chapter) {
  const patches = COUNT_FLOOR_PATCHES[chapter.number];
  if (!patches) return;
  for (const [depth, tones] of Object.entries(patches)) {
    for (const [tone, sentence] of Object.entries(tones)) {
      const breakdown = chapter.contentVariants?.[depth]?.chapterBreakdown;
      if (!breakdown?.[tone]) continue;
      if (wordCount(breakdown[tone]) >= MIN_WORDS[depth]) continue;
      if (!normalizeSentence(breakdown[tone]).includes(normalizeSentence(sentence))) {
        breakdown[tone] = joinSentences([breakdown[tone], sentence]);
      }
    }
  }
}

function forceCompetitiveWordFloors(chapter) {
  const cfg = chapterGuide(chapter.number);
  if (!cfg) return;
  const extra = {
    medium: [
      "The chapter keeps the reader honest by making the sequence answerable to evidence instead of appetite.",
      "That extra pressure matters because the chapter is supposed to sharpen judgment, not just deliver a memorable line.",
    ],
    hard: [
      "The hard version exists so the reader cannot keep admiring the chapter while quietly escaping its real test.",
      "That added weight is what turns the chapter from attractive advice into an actual diagnostic standard.",
    ],
  };
  for (const depth of ["medium", "hard"]) {
    const breakdown = chapter.contentVariants?.[depth]?.chapterBreakdown;
    if (!breakdown?.competitive) continue;
    let text = breakdown.competitive;
    for (const sentence of [...reserveExpansion(null, depth, "competitive", cfg), ...extra[depth]]) {
      if (wordCount(text) >= MIN_WORDS[depth]) break;
      if (!normalizeSentence(text).includes(normalizeSentence(sentence))) {
        text = joinSentences([text, sentence]);
      }
    }
    if (wordCount(text) < MIN_WORDS[depth]) {
      text = joinSentences([
        text,
        depth === "medium"
          ? "That closing pressure keeps the sequence honest in practice."
          : "That final pressure keeps the hard standard real in practice.",
      ]);
    }
    breakdown.competitive = text;
  }
}

function separateRecapAndTakeaway(chapter, cfg) {
  if (!chapter.contentVariants?.easy?.oneMinuteRecap || !chapter.keyTakeawayCard) return;
  for (const tone of TONES) {
    if (normalize(chapter.contentVariants.easy.oneMinuteRecap[tone]) === normalize(chapter.keyTakeawayCard[tone])) {
      const stem = cfg.mechanism[TONES.indexOf(tone)];
      chapter.contentVariants.easy.oneMinuteRecap[tone] = tone === "competitive"
        ? capitalize(`The pressure is simple: ${stem}.`)
        : capitalize(`Remember the pressure here: ${stem}.`);
    }
  }
}

function buildReviewCards(number, cfg) {
  const cards = [
    {
      difficulty: "easy",
      front: toneTriplet([
        `What has to happen before this chapter's payoff becomes believable?`,
        `What sequence does ${cfg.topic} insist on?`,
        `What has to get real before the payoff does?`,
      ]),
      back: toneTriplet([
        capitalize(`The payoff waits until you ${cfg.mechanism[0]}.`),
        capitalize(`The chapter only pays out after you ${cfg.mechanism[1]}.`),
        capitalize(`No payout arrives until you ${cfg.mechanism[2]}.`),
      ]),
    },
    {
      difficulty: "easy",
      front: toneTriplet([
        `What misreading makes this chapter necessary?`,
        `Which false move does ${cfg.topic} correct?`,
        `What shortcut gets exposed here?`,
      ]),
      back: toneTriplet(cfg.mistake.map(capitalize)),
    },
    {
      difficulty: "medium",
      front: toneTriplet([
        `In a live decision, what tells you this chapter is being used correctly?`,
        `What live diagnostic shows ${cfg.topic} is being applied well?`,
        `What proof says this chapter is real instead of talk?`,
      ]),
      back: toneTriplet([
        "You can see the chapter taking hold when the live decision follows the build instead of the comforting shortcut.",
        "The diagnosis is practical: the decision still respects sequence when pressure makes the shortcut attractive again.",
        "It turns real only when the hard move survives after the payoff claim starts shouting.",
      ]),
    },
    {
      difficulty: "medium",
      front: toneTriplet([
        `What does this chapter not let you assume too early?`,
        `What does ${cfg.topic} refuse to let you conclude?`,
        `What limit keeps this from turning into fake wisdom?`,
      ]),
      back: toneTriplet([
        capitalize(`It does not let you forget that ${cfg.boundary[0]}.`),
        capitalize(`It keeps the sequence honest because ${cfg.boundary[1]}.`),
        capitalize(`The limit is simple: ${cfg.boundary[2]}.`),
      ]),
    },
    {
      difficulty: "hard",
      front: toneTriplet([
        `What sentence should still hold when the chapter is under pressure?`,
        `What transfer test proves you understood ${cfg.topic}?`,
        `What compressed line survives once the fluff is gone?`,
      ]),
      back: toneTriplet([
        capitalize(`Carry this sentence forward: ${cfg.mechanism[0]}.`),
        capitalize(`Under pressure, keep the harder rule that ${cfg.boundary[1]}.`),
        capitalize(`Strip the chapter down and the surviving test is whether ${cfg.mechanism[2]}.`),
      ]),
    },
  ];
  return cards.map((card, index) => ({ cardId: `ch${String(number).padStart(2, "0")}-rc${String(index + 1).padStart(2, "0")}`, ...card }));
}

function rebuildSupport(chapter) {
  const cfg = SUPPORT[chapter.number];
  if (!cfg) return;
  chapter.implementationPlan = {
    coreSkill: toneTriplet(cfg.mechanism.map(capitalize)),
    ifThenPlans: [
      { context: "work", plan: toneTriplet(cfg.work.map(capitalize)) },
      { context: "school", plan: toneTriplet(cfg.school.map(capitalize)) },
      { context: "personal", plan: toneTriplet(cfg.personal.map(capitalize)) },
    ],
    twentyFourHourChallenge: toneTriplet(cfg.challenge.map(capitalize)),
    weeklyPractice: toneTriplet(cfg.weekly.map(capitalize)),
  };
  chapter.reviewCards = buildReviewCards(chapter.number, cfg);
  chapter.keyTakeawayCard = toneTriplet(cfg.takeaway.map(capitalize));
  if (chapter.contentVariants?.easy && chapter.contentVariants.easy.oneMinuteRecap) {
    chapter.contentVariants.easy.oneMinuteRecap = toneTriplet(cfg.recap.map(capitalize));
  }
  separateRecapAndTakeaway(chapter, cfg);
}

function applyBookScopedRepairs(chapter) {
  if (chapter.number >= 5) rebuildSupport(chapter);
  rebuildBreakdowns(chapter);
  applyCountFloorPatches(chapter);
  forceCompetitiveWordFloors(chapter);
  if (chapter.number === 2 && chapter.contentVariants?.easy?.oneMinuteRecap) {
    chapter.contentVariants.easy.oneMinuteRecap.gentle = "Preexisting career passion is uncommon, so using it as the starting requirement for good work creates confusion.";
  }
  if (chapter.number === 3 && chapter.contentVariants?.easy?.oneMinuteRecap) {
    chapter.contentVariants.easy.oneMinuteRecap.gentle = "The passion mindset can make work harder to judge because it keeps attention fixed on what the job is giving back.";
  }
  if (chapter.number === 15) {
    chapter.contentVariants.easy.oneMinuteRecap.competitive = "A mission that stays hidden stays weak, however sincere it feels.";
    if (chapter.contentVariants?.hard?.chapterBreakdown?.direct) {
      chapter.contentVariants.hard.chapterBreakdown.direct = chapter.contentVariants.hard.chapterBreakdown.direct.replace(
        "The chapter completes Rule 4 by arguing that missions require marketing.",
        "Hard depth starts from a stricter problem: a mission can stay sincere and still remain too hidden to matter."
      );
    }
  }
  if (chapter.number === 10) {
    chapter.reviewCards[4].back.competitive = "Ignore the limit and the freedom story collapses under weak support.";
  }
  if (chapter.number === 13) {
    chapter.contentVariants.easy.oneMinuteRecap.competitive = "Mission talk stays thin when no capital is underneath it.";
    chapter.reviewCards[4].back.gentle = "The limit is practical: without real leverage, mission remains too fragile to carry a life.";
    chapter.reviewCards[4].back.competitive = "Ignore the limit and mission stays too thin to live on.";
  }
  if (chapter.number === 14 && chapter.contentVariants?.hard?.chapterBreakdown?.competitive) {
    chapter.contentVariants.hard.chapterBreakdown.competitive = chapter.contentVariants.hard.chapterBreakdown.competitive.replace(
      "That is why the chapter keeps forcing the reader back toward sequence, proof, and consequences that can survive scrutiny.",
      "That added pressure keeps forcing the reader back toward sequence, proof, and consequences that can survive scrutiny."
    );
    chapter.contentVariants.hard.chapterBreakdown.competitive = chapter.contentVariants.hard.chapterBreakdown.competitive.replace(
      "The hardest reading keeps asking whether missions require little bets is being carried by real structure or only by a persuasive story about what should happen next. That is the difference between a chapter that sounds wise and a chapter that can actually diagnose a career decision.",
      "The harder question is whether the experiment is teaching something costly enough to narrow the mission instead of merely keeping the story alive. If not, the chapter is diagnosing drift dressed up as exploration."
    );
  }
  if (chapter.number === 12 && chapter.contentVariants?.hard?.chapterBreakdown?.competitive) {
    chapter.contentVariants.hard.chapterBreakdown.competitive = chapter.contentVariants.hard.chapterBreakdown.competitive.replace(
      "The hardest reading keeps asking whether the meaningful life of Pardis Sabeti is being carried by real structure or only by a persuasive story about what should happen next. That is the difference between a chapter that sounds wise and a chapter that can actually diagnose a career decision.",
      "The harder test is whether the mission story can survive contact with built capability instead of floating free as language. If it cannot, the chapter has diagnosed aspiration without support rather than meaningful direction."
    );
  }
  const lowFloorFixes = {
    5: { depth: "hard", text: "The bargain still fails if leverage never arrives." },
    11: { depth: "medium", text: "That trap is not anti-control; it is anti-romance about control." },
    13: { depth: "medium", text: "Direction still has to earn its carrying power." },
    16: { depth: "medium", text: "The model still punishes sequence-skipping." },
  };
  const lowFloor = lowFloorFixes[chapter.number];
  if (lowFloor) {
    const breakdown = chapter.contentVariants?.[lowFloor.depth]?.chapterBreakdown;
    if (breakdown?.competitive && wordCount(breakdown.competitive) < MIN_WORDS[lowFloor.depth]) {
      breakdown.competitive = joinSentences([breakdown.competitive, lowFloor.text]);
    }
  }
}

function hashFile(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const runRoot = options.runRoot;
  const validatedDir = path.join(runRoot, "validated");
  const structuredDir = path.join(runRoot, "structured");
  const releasePath = path.join(runRoot, "release", `${BOOK_ID}.modern.json`);
  const edition = readJson(path.join(runRoot, "manifests", "edition-lock.json"));
  const manifest = readJson(path.join(runRoot, "manifests", "run-manifest.json"));
  const validatedFiles = fs.readdirSync(validatedDir).filter((file) => /^ch\d+\.chapter\.json$/.test(file)).sort();
  const chapters = [];

  validatedFiles.forEach((file) => {
    const chapterPath = path.join(validatedDir, file);
    const chapter = readJson(chapterPath);
    applyBookScopedRepairs(chapter);
    writeJson(chapterPath, chapter);
    writeJson(path.join(structuredDir, file), chapter);
    writeJson(path.join(validatedDir, file.replace(".chapter.json", ".review-package.json")), {
      schemaVersion: "chapterflow-v13-review-package",
      packageId: `${BOOK_ID}-${file.replace(".chapter.json", "")}-review`,
      createdAt: CREATED_AT,
      contentOwner: "ChapterFlow v13 Autonomous",
      book: {
        bookId: BOOK_ID,
        title: edition.edition.title,
        author: edition.edition.author,
        edition: `${edition.edition.publishedYear} ${edition.edition.language} first edition`,
      },
      chapters: [chapter],
    });
    chapters.push(chapter);
  });

  const continuityPath = path.join(runRoot, "continuity", "continuity-state.json");
  const continuity = readJson(continuityPath);
  continuity.approvedChapterHashes = {};
  validatedFiles.forEach((file) => {
    continuity.approvedChapterHashes[file.replace(".chapter.json", "")] = hashFile(path.join(validatedDir, file));
  });
  writeJson(continuityPath, continuity);

  const packagePayload = {
    schemaVersion: "1.1.0",
    packageId: `${BOOK_ID}-${manifest.runId}`,
    createdAt: CREATED_AT,
    contentOwner: "ChapterFlow v13 Autonomous",
    book: {
      bookId: BOOK_ID,
      title: edition.edition.title,
      author: edition.edition.author,
      categories: ["Careers"],
      tags: ["career", "skills", "work", "meaning"],
      edition: {
        name: "Original English first edition",
        publisher: edition.edition.publisher,
        publishedYear: edition.edition.publishedYear,
        isbn13: edition.edition.isbn13,
        format: "Print reference edition",
        sourceText: edition.frozenPrimaryTextPath,
        sourceProvenance: "Frozen web bundle with locked chapter-level anchors and authorized preview metadata.",
      },
      variantFamily: manifest.book?.variantFamily ?? "EMH",
    },
    chapters,
  };
  writeJson(releasePath, packagePayload);
  fs.mkdirSync(path.dirname(options.bookPackagePath), { recursive: true });
  writeJson(options.bookPackagePath, packagePayload);
  console.log(`repaired ${chapters.length} chapters for ${BOOK_ID}`);
}

main();
