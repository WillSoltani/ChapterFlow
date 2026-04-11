#!/usr/bin/env python3
import json
import hashlib
import re
from pathlib import Path

RUN_ROOT = Path(".chapterflow/runs/so-good-they-cant-ignore-you/20260410-152410")
BOOK_ID = "so-good-they-cant-ignore-you"
CREATED_AT = "2026-04-10T18:55:51Z"

DEPTH_BOUNDS = {
    "easy": (140, 175),
    "medium": (330, 420),
    "hard": (490, 600),
}

SUPPORT_MAP = {
    5: {
        "core": ("building rare and valuable skill before asking work for premium traits", "convert effort into career capital before making demands", "accumulate leverage before negotiating"),
        "ifthen": {
            "work": "if I want more autonomy or variety from my role before I can point to scarce output, then I will spend thirty focused minutes improving a skill the role actually rewards",
            "school": "if I start wishing a class felt more inspiring before I have built real mastery, then I will practice the hardest useful subskill until I can do it better than last week",
            "personal": "if I find myself envying someone else's freedom without evidence of my own leverage, then I will build one concrete capability that would make me harder to ignore",
        },
        "challenge": "trade desire for leverage by logging one scarce skill rep today",
        "weekly": "count where effort actually became a rarer and more valuable result",
        "card": ("better work gets purchased with leverage, not with wanting", "career capital is the exchange mechanism that makes better work affordable", "freedom stays expensive until you can pay for it"),
    },
    6: {
        "core": ("studying how career capitalists keep building scarce capability before cashing out", "notice the behaviors that compound leverage instead of chasing rewards early", "practice like a capitalist, not a demander"),
        "ifthen": {
            "work": "if I want a better role, then I will first identify the capability top performers in this field have built and practice that before complaining about the conditions",
            "school": "if I feel tempted to switch tracks because mastery is uncomfortable, then I will compare what capital I am building before I decide the track is the problem",
            "personal": "if I start narrating unfairness before I can name what scarce skill I am building, then I will return to the build instead of the complaint",
        },
        "challenge": "observe one person who is clearly building capital and copy one behavior that created it",
        "weekly": "review whether the week looked more like capital accumulation or early reward demanding",
        "card": ("career capitalists keep building exchangeable value before they ask for premium conditions", "the chapter contrasts capital builders with people who demand rewards they have not funded", "builders earn options while demanders stay noisy"),
    },
    7: {
        "core": ("using the craftsman mindset to ask what value you are producing", "shift attention from fit-checking toward deliberate contribution", "measure yourself by output, not by self-flattery"),
        "ifthen": {
            "work": "if I catch myself asking whether the job feels perfect, then I will replace that question with one concrete way I can become more useful this week",
            "school": "if a course feels dull, then I will identify the skill it can sharpen and practice that skill before judging the course by mood alone",
            "personal": "if I start checking whether an activity matches my identity, then I will ask what craft it lets me improve and do one rep of that craft",
        },
        "challenge": "replace one inward fit question today with a direct value-building question",
        "weekly": "audit where you practiced contribution instead of constant calling checks",
        "card": ("the craftsman mindset looks outward at value instead of inward at perfect fit", "craft-building gives meaningful work a sturdier base than identity monitoring", "build usefulness first and let meaning catch up"),
    },
    8: {
        "core": ("using career capital to buy control only when the capital is strong enough", "treat autonomy as something earned and purchased, not granted by wishful thinking", "cash leverage into control at the right time"),
        "ifthen": {
            "work": "if I want more control over my schedule, then I will first name the capital that makes my request hard to dismiss",
            "school": "if I want more freedom in how I learn, then I will show stronger performance before I ask for looser constraints",
            "personal": "if I want a self-directed project, then I will build enough trust and competence that the freedom can actually hold",
        },
        "challenge": "write down one control move you want and the career capital that would make it viable",
        "weekly": "review whether your autonomy moves are being funded by leverage or by hope",
        "card": ("control becomes real when career capital is strong enough to purchase it", "the dream-job elixir works only after leverage exists", "autonomy is bought with value, not with longing"),
    },
    9: {
        "core": ("reading resistance as a signal without confusing it for a full answer", "interpret pushback intelligently when a control move threatens existing value flows", "do not mistake resistance for automatic stop signs"),
        "ifthen": {
            "work": "if a move toward more control triggers resistance, then I will ask whether the pushback is revealing that value is actually at stake",
            "school": "if a teacher or institution resists a more independent path, then I will separate fear of conflict from evidence that the move lacks value",
            "personal": "if people around me push back on a freedom move, then I will examine what they lose before I decide the move is wrong",
        },
        "challenge": "take one resisted control move and write what value the resistance might be protecting",
        "weekly": "review one point of pushback and decide whether it signaled danger, value, or both",
        "card": ("resistance can mean a control move matters, not that it is automatically mistaken", "the first trap warns against surrendering too quickly when pushback appears", "pushback sometimes proves value is at stake"),
    },
    10: {
        "core": ("testing whether a control move has enough support to survive", "separate desire for freedom from the structure needed to hold it", "do not leap into autonomy on weak support"),
        "ifthen": {
            "work": "if I want more control, then I will test whether my leverage, timing, and runway are strong enough before I jump",
            "school": "if I want to abandon a structured path for a freer one, then I will check whether my support is real or mostly imagined",
            "personal": "if a freedom move feels emotionally right, then I will still ask what resources make it durable in practice",
        },
        "challenge": "stress-test one autonomy plan today by listing the support it would need to last",
        "weekly": "audit whether your freedom plans are becoming sturdier or merely more exciting",
        "card": ("the second trap is taking a freedom move that cannot survive its own weak support", "control still needs leverage, timing, and durability under it", "freedom fantasies collapse when the build cannot hold"),
    },
    11: {
        "core": ("holding both control traps in view at the same time", "judge autonomy through resistance and support together", "pursue control with dual judgment instead of single-track thinking"),
        "ifthen": {
            "work": "if I am considering a move toward more control, then I will ask both what the resistance means and whether the support under the move is strong enough",
            "school": "if I want more autonomy in how I learn or work, then I will test both outside pushback and internal readiness before deciding",
            "personal": "if a freedom move feels urgent, then I will slow down long enough to judge both signal and structure",
        },
        "challenge": "run one control decision through both trap questions before the day ends",
        "weekly": "review the control moves you considered and score each one for resistance signal and support strength",
        "card": ("wise control asks what resistance means and what support can actually hold", "the chapter closes Rule 3 by combining both traps into one judgment standard", "good autonomy moves survive both interpretation and reality"),
    },
    12: {
        "core": ("seeing mission as a later-stage direction that grows out of skill and control", "study how meaningful direction becomes real after leverage exists", "let mission emerge from the build, not from fantasy"),
        "ifthen": {
            "work": "if I feel pressure to announce a grand mission too early, then I will ask what skill and leverage would make that mission more credible",
            "school": "if I want my studies to feel more meaningful, then I will look for the frontier where my ability can actually point toward something larger",
            "personal": "if I feel lost about purpose, then I will focus on the work that builds capital and notice where deeper direction starts to appear",
        },
        "challenge": "identify one place where stronger skill could make a larger mission more real",
        "weekly": "track where your existing strengths are beginning to suggest a more meaningful direction",
        "card": ("mission becomes believable after skill and leverage create room for it", "Pardis Sabeti shows that meaningful direction grows out of the build", "purpose gets real when capital and frontier work meet"),
    },
    13: {
        "core": ("building enough capital before trying to live from a mission", "treat mission as something funded by leverage rather than by sincerity alone", "mission needs a base before it can matter"),
        "ifthen": {
            "work": "if I want to pivot toward a mission-driven role, then I will first ask what capital would make the pivot durable",
            "school": "if I feel drawn to a meaningful niche, then I will keep building the capability that would let me contribute there credibly",
            "personal": "if I start romanticizing mission, then I will return to the base that makes mission livable",
        },
        "challenge": "name one piece of capital your preferred mission would require and start building it today",
        "weekly": "review whether your mission talk is being backed by stronger leverage",
        "card": ("mission without capital stays private and fragile", "the chapter insists that direction needs leverage under it", "you cannot live from mission you have not yet funded"),
    },
    14: {
        "core": ("using little bets to discover and sharpen mission in practice", "replace grand purpose declarations with small experiments that reveal direction", "test the target instead of pretending you already know it"),
        "ifthen": {
            "work": "if I think I have found a mission, then I will design one small bet that exposes it to real feedback",
            "school": "if I feel pulled toward a field or problem, then I will run a small experiment before turning the pull into a full identity",
            "personal": "if a purpose claim sounds exciting but vague, then I will test it in a low-cost way that teaches me something fast",
        },
        "challenge": "place one little bet today that could sharpen a mission instead of just decorate it",
        "weekly": "review what your small bets taught you about where meaningful direction is getting clearer",
        "card": ("little bets discover mission by exposing it to reality in small pieces", "the chapter turns mission into an experimental process rather than a revelation", "run the bet before you trust the story"),
    },
    15: {
        "core": ("making a clarified mission visible enough to matter", "add reach to support and discovery so mission can create public consequence", "give a real mission signal and reach"),
        "ifthen": {
            "work": "if I have clarified a direction worth pursuing, then I will choose one channel that makes it more visible to the people it should affect",
            "school": "if a project matters to me, then I will share it where feedback and visibility can strengthen its reach",
            "personal": "if I say a mission matters, then I will stop keeping it private and give it one concrete form of public visibility",
        },
        "challenge": "take one mission-shaped idea and make it visible in a way that invites real contact",
        "weekly": "review whether your mission gained reach or stayed locked in private conviction",
        "card": ("mission needs visibility before it can create wider force", "marketing is the final move that gives direction public reach", "hidden substance stays weak until it travels"),
    },
    16: {
        "core": ("treating meaningful work as a built sequence of skill, control, and mission", "integrate the book into one model instead of chasing isolated tricks", "run the whole build instead of the shortcut"),
        "ifthen": {
            "work": "if I start waiting for a perfect answer about work, then I will return to the stage of the sequence I can build right now",
            "school": "if I feel pressure to discover my calling before I have built leverage, then I will keep investing in skill and let direction become clearer over time",
            "personal": "if I catch myself wanting passion to do the heavy lifting, then I will name the next build step in skill, control, or mission",
        },
        "challenge": "locate the weakest stage in your sequence today and do one build step there",
        "weekly": "review whether the week strengthened skill, wiser control, or mission instead of waiting for magic",
        "card": ("meaningful work gets built through sequence rather than found as a perfect answer", "the conclusion ties skill, control, and mission into one demanding model", "stop shopping for revelation and strengthen the machine"),
    },
}


def sentence_split(text):
    return [s.strip() for s in re.split(r"(?<=[.!?])\s+", text.strip()) if s.strip()]


def word_count(text):
    return len([w for w in text.split() if w.strip()])


def uniq(seq):
    out = []
    seen = set()
    for item in seq:
        key = item.strip()
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(item)
    return out


def fit_text(current, draft, depth):
    min_words, max_words = DEPTH_BOUNDS[depth]
    target = (min_words + max_words) // 2
    current_sents = uniq(sentence_split(current))
    draft_sents = [s for s in uniq(sentence_split(draft)) if s not in current_sents]
    chosen = list(current_sents)

    if word_count(" ".join(chosen)) > max_words:
        trimmed = []
        for sent in chosen:
            candidate = " ".join(trimmed + [sent]).strip()
            if word_count(candidate) > max_words and trimmed:
                break
            trimmed.append(sent)
        chosen = trimmed

    idx = 0
    while word_count(" ".join(chosen)) < min_words and idx < len(draft_sents):
        candidate = " ".join(chosen + [draft_sents[idx]]).strip()
        if word_count(candidate) <= max_words or word_count(" ".join(chosen)) < target:
            chosen.append(draft_sents[idx])
        idx += 1

    while word_count(" ".join(chosen)) > max_words and len(chosen) > 1:
        chosen.pop()

    return " ".join(chosen).strip()


def top_up_if_short(text, draft, depth):
    min_words, _ = DEPTH_BOUNDS[depth]
    if word_count(text) >= min_words:
        return text
    current_sents = uniq(sentence_split(text))
    for sent in uniq(sentence_split(draft)):
        if sent in current_sents:
            continue
        current_sents.append(sent)
        if word_count(" ".join(current_sents)) >= min_words:
            break
    return " ".join(current_sents).strip()


def gentleize_prompt(prompt):
    stem = prompt.rstrip("?")
    return f"Without looking back, {stem[0].lower() + stem[1:]}?"


def directize_prompt(prompt):
    stem = prompt.rstrip("?")
    return f"Reconstruct the chapter's answer: {stem[0].lower() + stem[1:]}?"


def competitiveize_prompt(prompt):
    stem = prompt.rstrip("?")
    return f"Under pressure, answer this fast: {stem[0].lower() + stem[1:]}?"


def build_review_cards(chapter):
    cfg = SUPPORT_MAP[chapter["number"]]
    title = chapter["title"].lower()
    cards = [
        {
            "difficulty": "easy",
            "front": {
                "gentle": f"From memory, what central move defines {title}?",
                "direct": f"State the chapter's central mechanism in {title}.",
                "competitive": f"What is the engine of {title} when you strip the slogans away?",
            },
            "back": {
                "gentle": f"The chapter centers on {cfg['core'][0]}.",
                "direct": f"The core mechanism is to {cfg['core'][1]}.",
                "competitive": f"The chapter's engine is simple: {cfg['core'][2]}.",
            },
        },
        {
            "difficulty": "easy",
            "front": {
                "gentle": f"Which common mistake about {title} does the chapter correct?",
                "direct": "Which mistaken belief does Newport break here?",
                "competitive": f"What shortcut gets exposed in {title}?",
            },
            "back": {
                "gentle": f"The chapter warns against treating the payoff in {title} as available before the supporting build exists.",
                "direct": f"Newport is correcting a sequencing error in {title}: the result depends on earlier leverage, support, or discovery.",
                "competitive": f"It exposes the shortcut: {cfg['card'][2]}.",
            },
        },
        {
            "difficulty": "medium",
            "front": {
                "gentle": f"If this chapter showed up in your workday, what stronger first move would it ask for?",
                "direct": f"In a live work scenario, what first action does {title} demand?",
                "competitive": f"When work gets noisy, what move from {title} should go first?",
            },
            "back": {
                "gentle": f"It would ask you to {cfg['ifthen']['work']}.",
                "direct": f"The work move is to {cfg['ifthen']['work']}.",
                "competitive": f"On the job, the first move is to {cfg['ifthen']['work']}.",
            },
        },
        {
            "difficulty": "medium",
            "front": {
                "gentle": f"What does this chapter use as its practical test for progress?",
                "direct": f"How does {title} tell you whether the idea is working in practice?",
                "competitive": f"What scoreboard keeps {title} from turning into talk?",
            },
            "back": {
                "gentle": f"The chapter uses this weekly test: {cfg['weekly']}.",
                "direct": f"The practical test is straightforward: {cfg['weekly']}.",
                "competitive": f"The scoreboard is clear: {cfg['weekly']}.",
            },
        },
        {
            "difficulty": "hard",
            "front": {
                "gentle": f"What limit keeps {title} from collapsing into a slogan?",
                "direct": f"What boundary condition keeps {title} intellectually honest?",
                "competitive": f"What hard limit keeps {title} from becoming fake wisdom?",
            },
            "back": {
                "gentle": f"The limit is that the chapter still requires a real build: {cfg['challenge']}.",
                "direct": f"The boundary is that the idea must survive reality, which is why the chapter pushes you to {cfg['challenge']}.",
                "competitive": f"The hard limit is simple: if you will not {cfg['challenge']}, the slogan is empty.",
            },
        },
    ]
    for idx, card in enumerate(cards, 1):
        card["cardId"] = f"ch{chapter['number']:02d}-rc{idx:02d}"
    return cards


def make_tone_triplet(base_g, base_d, base_c):
    return {"gentle": base_g, "direct": base_d, "competitive": base_c}


def build_support(chapter):
    cfg = SUPPORT_MAP[chapter["number"]]
    chapter_title = chapter["title"].lower()
    chapter["implementationPlan"] = {
        "coreSkill": make_tone_triplet(
            f"Practice {cfg['core'][0]}.",
            f"Train yourself to {cfg['core'][1]}.",
            f"Learn to {cfg['core'][2]}.",
        ),
        "ifThenPlans": [
            {
                "context": "work",
                "plan": make_tone_triplet(
                    f"If I notice this chapter's problem showing up at work, then I will {cfg['ifthen']['work']}.",
                    f"If the {chapter_title} lesson becomes relevant in my work, then I will {cfg['ifthen']['work']}.",
                    f"If this trap or opportunity appears on the job, then I will {cfg['ifthen']['work']}.",
                ),
            },
            {
                "context": "school",
                "plan": make_tone_triplet(
                    f"If I see the same pattern in school, then I will {cfg['ifthen']['school']}.",
                    f"If the chapter's mechanism shows up in my learning, then I will {cfg['ifthen']['school']}.",
                    f"If school is where this breaks first, then I will {cfg['ifthen']['school']}.",
                ),
            },
            {
                "context": "personal",
                "plan": make_tone_triplet(
                    f"If this issue appears in my personal life, then I will {cfg['ifthen']['personal']}.",
                    f"If the chapter's pressure shows up outside work, then I will {cfg['ifthen']['personal']}.",
                    f"If this pattern leaks into the rest of my life, then I will {cfg['ifthen']['personal']}.",
                ),
            },
        ],
        "twentyFourHourChallenge": make_tone_triplet(
            f"In the next day, {cfg['challenge']}.",
            f"Within twenty-four hours, {cfg['challenge']}.",
            f"Before tomorrow ends, {cfg['challenge']}.",
        ),
        "weeklyPractice": make_tone_triplet(
            f"Each week, {cfg['weekly']}.",
            f"Weekly, {cfg['weekly']}.",
            f"Every week, {cfg['weekly']}.",
        ),
    }
    chapter["reviewCards"] = build_review_cards(chapter)
    chapter["keyTakeawayCard"] = make_tone_triplet(
        cfg["card"][0].capitalize() + ".",
        cfg["card"][1].capitalize() + ".",
        cfg["card"][2].capitalize() + ".",
    )


def flatten_easy_recap(recap):
    if set(recap.keys()) == {"gentle", "direct", "competitive"}:
        return recap
    return {
        "gentle": recap["connect"]["gentle"],
        "direct": recap["connect"]["direct"],
        "competitive": recap["connect"]["competitive"].replace("The point is blunt: ", "").replace("The point is ", ""),
    }


def cleanup_breakdown_text(number, depth, tone, text):
    text = text.replace("This chapter explains why better work usually has to be bought instead of merely desired.", "Better work usually has to be bought instead of merely desired.")
    text = text.replace("The chapter also introduces a structural timing problem.", "A structural timing problem enters next.")
    text = text.replace("The chapter also depends on the previous one.", "It also depends on the previous one.")
    text = text.replace("The chapter also closes Rule 4 cleanly.", "Rule 4 also closes cleanly here.")
    text = text.replace("That is why the chapter should not be read as a defense of manipulation or empty self-promotion.", "For that reason, the chapter should not be read as a defense of manipulation or empty self-promotion.")
    text = text.replace("The point is not to make control less attractive. The point is to pursue it with enough realism", "The aim is not to make control less attractive. The real demand is to pursue it with enough realism")
    text = text.replace("Career capital is the chapter where Newport stops speaking in metaphors and starts naming the currency.", "Here Newport stops speaking in metaphors and starts naming the currency.")
    text = text.replace("Career capital is the chapter that explains why better work usually has to be bought instead of merely desired.", "Better work usually has to be bought instead of merely desired.")
    text = text.replace("Mission becomes public in this chapter because Newport argues that meaningful direction is not complete when it stays private.", "Mission becomes public here because Newport argues that meaningful direction is not complete when it stays private.")
    text = text.replace("Becoming a craftsman means organizing work around deliberate improvement in rare and valuable skill.", "A craftsman organizes work around deliberate improvement in rare and valuable skill.")
    return text


def dedupe_sentences(text):
    seen = set()
    kept = []
    for sent in sentence_split(text):
        key = sent.strip()
        if key in seen:
            continue
        seen.add(key)
        kept.append(sent)
    return " ".join(kept).strip()


def repair_chapter(chapter, edited_text):
    for depth, variants in chapter["contentVariants"].items():
        for tone in ("gentle", "direct", "competitive"):
            variants["chapterBreakdown"][tone] = top_up_if_short(cleanup_breakdown_text(
                chapter["number"], depth, tone, fit_text(variants["chapterBreakdown"][tone], edited_text, depth)
            ), edited_text, depth)
            variants["chapterBreakdown"][tone] = dedupe_sentences(variants["chapterBreakdown"][tone])
            variants["chapterBreakdown"][tone] = top_up_if_short(variants["chapterBreakdown"][tone], edited_text, depth)

    easy = chapter["contentVariants"]["easy"]
    easy["oneMinuteRecap"] = flatten_easy_recap(easy["oneMinuteRecap"])
    easy["keyTakeaways"] = [{"point": item["point"]} for item in easy["keyTakeaways"]]

    if chapter["number"] >= 5:
        build_support(chapter)

    if chapter["number"] == 2:
        chapter["contentVariants"]["easy"]["oneMinuteRecap"]["gentle"] = "Preexisting career passion is uncommon, so using it as the starting requirement for good work creates confusion."

    if chapter["number"] == 3:
        chapter["contentVariants"]["easy"]["oneMinuteRecap"]["gentle"] = "The passion mindset can make work harder to judge because it keeps attention fixed on what the job is giving back."

    if chapter["number"] == 15:
        chapter["contentVariants"]["easy"]["chapterBreakdown"]["gentle"] = (
            "The chapter says mission needs visibility. After support and discovery, a meaningful direction still needs a way to matter beyond the person holding it. "
            "Newport's answer is marketing. That matters because private conviction does not automatically create public force. A mission can be real and still remain too hidden to shape anything beyond private understanding. "
            "Marketing is what gives the mission reach. That does not make marketing a substitute for substance. Rule 4 keeps the order clear. Capital supports mission, little bets clarify mission, and marketing helps that clearer mission travel. "
            "The conclusion is next because Rule 4 has finished its sequence. Visibility is the final condition that turns a clarified mission into work other people can actually encounter. "
            "That is why the chapter treats sharing as part of the build instead of a decorative extra. If the work never reaches people who can use it, answer it, or spread it, the mission stays mostly trapped inside the worker's own mind."
        )
        chapter["contentVariants"]["hard"]["oneMinuteRecap"]["connect"]["gentle"] = "The chapter argues that even a clarified mission stays incomplete until other people can actually encounter it."
        chapter["contentVariants"]["hard"]["oneMinuteRecap"]["preview"]["gentle"] = "The conclusion now has to gather visibility into the larger built model of meaningful work."
        chapter["contentVariants"]["easy"]["oneMinuteRecap"]["gentle"] = "Mission is not finished when only you can see it; it needs reach before it can matter widely."
        chapter["contentVariants"]["hard"]["chapterBreakdown"]["gentle"] = (
            "The chapter matters because mission would remain incomplete if it stopped at private clarity. After capital makes a mission possible and little bets help it emerge, the direction still needs public force. "
            "Newport gives that final requirement a name: marketing. Visibility is what lets a mission matter beyond the person quietly holding it. That distinction matters because sincere direction and consequential direction are not identical. "
            "A person can know what their work is for and still leave the mission too hidden to affect much beyond their own understanding. The chapter therefore treats reach as part of meaningful work rather than as a shallow add-on. "
            "The argument also depends on sequence. Marketing is not being introduced as a substitute for substance. It comes after support and discovery. A weak mission does not become strong because it is made louder. Visibility matters only when there is already something real to amplify. "
            "For that reason, the chapter should not be read as a defense of manipulation or empty self-promotion. Newport's point is narrower. If a mission is going to create impact, other people need to be able to encounter it. Attention, reach, and amplification become part of the work because hidden meaning has limited force no matter how pure it feels in private. "
            "Rule 4 closes here by completing its sequence. Capital supports the mission, little bets sharpen it, and marketing gives it range. The book can now move into its conclusion with the major pieces of meaningful work in view. "
            "At this depth, the final constraint is that private meaning never becomes shared consequence by default. Visibility is therefore not cosmetic. It is the bridge between a mission that feels true to one person and a mission that can recruit attention, feedback, and further effort from others. "
            "That is why marketing belongs at the end of Rule 4 instead of floating beside it. Support made the mission possible. Little bets made it clearer. Reach gives the clearer direction a chance to matter in public. "
            "The sequence closes when the mission stops living only in the worker's head and starts meeting the world on visible terms. "
            "Seen this way, visibility is a practical requirement, not an ego requirement. People can only collaborate with, criticize, adopt, or benefit from work they can actually find. A mission hidden from contact cannot build much momentum, which is why Newport treats reach as part of the mechanism instead of a separate branding hobby. "
            "The chapter therefore ends with a final conversion. Earlier steps made the work stronger and more coherent. Marketing makes that stronger work reachable. Once reach enters the system, the mission can stop being merely a private source of meaning and start becoming a public source of consequence. "
            "That consequence does not have to mean fame. It can mean the right colleague notices the project, the right audience adopts the idea, or the right community can now respond to the work. Newport's claim is practical all the way down: a mission starts changing more than the worker only after the worker creates paths for encounter. "
            "So the chapter closes Rule 4 with outward exposure. Meaningful work is not complete at the moment of private certainty. It is more complete when the built and clarified direction becomes visible enough for the surrounding world to answer back."
        )
        chapter["contentVariants"]["hard"]["chapterBreakdown"]["direct"] = (
            "The chapter completes Rule 4 by arguing that missions require marketing. After establishing that mission needs capital and then little bets, Newport now adds visibility as the final condition. "
            "A mission that remains private may be supported and clarified, but it will still have limited force in the wider world. That move matters because public consequence does not arise automatically from private conviction. "
            "Meaningful direction gains force when other people can encounter it, respond to it, and carry it further. Marketing is therefore being framed as amplification, not as a replacement for substance. "
            "This is why sequence is essential to the chapter's logic. Marketing comes last because it is supposed to make something real more visible. It does not rescue a weak mission or compensate for missing capital or missing clarity. "
            "The earlier build still does the heavy lifting. The chapter also guards against a common distortion. Newport is not arguing that visibility is all that matters or that audience-building can substitute for meaning. He is arguing that a mission too hidden to be encountered remains limited in what it can do. "
            "Reach matters because consequence requires contact. That completes Rule 4's structure. Support makes mission possible. Discovery makes mission sharper. Marketing lets the sharper mission travel. The final chapter can now integrate this sequence into the broader argument of the book. "
            "The deeper point is structural. Visibility is the public test that turns mission from private orientation into outward consequence. Newport places marketing after capital and little bets because amplification works only when something real has already been supported and clarified. "
            "In that order, reach does not counterfeit value; it extends value. The chapter therefore ends Rule 4 with a final conversion: mission stops being merely personal guidance and becomes work that can actually be encountered, judged, and carried forward by other people. "
            "That extra step matters because unshared direction cannot generate much beyond private motivation. Once the work becomes visible, it can attract feedback, invite alliance, and create the chance for further spread. Marketing is useful here because it makes contact possible. Contact is what lets the mission leave the private interior of the worker and start operating in a wider field. "
            "Newport's logic is disciplined all the way through. Build substance first. Clarify direction through experimentation second. Extend the clarified direction into public view third. The chapter closes by insisting that meaningful work has to be findable before it can become influential. "
            "This also explains why marketing appears so late in the sequence. By the time reach enters the picture, the worker should have something sturdy enough to survive attention. Visibility then becomes a distribution problem rather than a self-invention fantasy. The mission does not change because it is seen; it finally has a chance to do work outside the self because it is seen."
            " In plain terms, the chapter adds one final operational demand: create routes by which the work can travel, persist, and be found."
        )
        chapter["contentVariants"]["hard"]["chapterBreakdown"]["competitive"] = (
            "Newport ends Rule 4 by forcing mission out of private storage. Support gave the direction a base. Little bets gave it shape. Marketing gives it range. Without that last move, the mission can stay clear in private and still weak in public effect. "
            "That matters because private conviction does not create force on its own. The chapter is not suddenly worshiping image. It is saying that a mission too hidden to be encountered cannot push very hard on the world outside the person carrying it. Reach is how a real direction starts getting leverage in public. "
            "The safeguard is sequence. Marketing comes last because it is supposed to amplify substance, not counterfeit it. A loud mission with no base is still hollow. A refined mission with no visibility stays boxed in. The earlier work on capital and little bets is what keeps marketing from becoming shallow theater. "
            "So the chapter is strict without being manipulative. Newport is not telling the reader to fake importance. He is saying that importance needs contact. A mission has to become seeable, shareable, and encounterable if it is going to move anything beyond private conviction. "
            "That closes Rule 4 cleanly. First base, then discovery, then reach. Once that sequence is complete, the book is ready to conclude by showing how the whole approach to work fits together. "
            "The hard edge is this: a mission that never leaves private storage never builds public force. Marketing matters because it puts contact where private conviction used to sit alone. Newport keeps it last so reach cannot fake what base and discovery failed to build. "
            "First you earn substance. Then you sharpen the target. Then you make the target visible enough to hit the world. That is the close of Rule 4. The mission is no longer just yours; it has entered a public field where it can either move something or prove it was never strong enough. "
            "That final public test is why the chapter matters. Visibility exposes the mission to response instead of letting it hide inside intention. Once other people can encounter the work, they can ignore it, oppose it, join it, or carry it. All of those outcomes are more honest than private certainty with no contact. "
            "Newport ends hard here: if you want a mission to count, get it into circulation. Reach is not vanity in this frame. Reach is the condition that lets meaning stop being private sentiment and start becoming public consequence. "
            "That does not mean chase attention for its own sake. It means build channels through which real work can travel to the people who can use it, judge it, or strengthen it. Hidden mission feels pure because nobody can test it. Public mission is riskier, but it is also the only version that can gather real consequence. "
            "If you want the mission to move anything, you have to let it collide with the world, survive the collision, and keep circulating."
        )

    if chapter["number"] == 5:
        chapter["contentVariants"]["easy"]["oneMinuteRecap"]["competitive"] = "If you cannot trade real value yet, the good stuff stays expensive."
        chapter["contentVariants"]["easy"]["chapterBreakdown"]["gentle"] = (
            "Better work usually has to be bought instead of merely desired. Newport says that traits like control, creativity, mission, and autonomy have a price. "
            "The price is becoming good at something rare and useful enough that other people value it. Wanting better work is not the same as being able to trade for it. "
            "The chapter gives that tradeable value a name: career capital. Here Newport stops speaking in metaphors and starts naming the currency. "
            "If you want work with more autonomy, more creativity, more control, or more meaning, you usually do not get those traits by wanting them harder. "
            "You get them by having something rare and valuable enough to trade for them. That is the power of career capital. It turns the craftsman mindset from a good attitude into a mechanism. "
            "The chapter's real pressure is sequencing: build leverage first, then ask for the rewards leverage can purchase."
        )
        chapter["contentVariants"]["easy"]["chapterBreakdown"]["competitive"] = (
            "Career capital is the chapter where preference stops pretending to be leverage. Cool work traits cost something. The price is being hard to replace in a way other people care about. "
            "Here Newport stops speaking in metaphors and starts naming the currency. If you want work with more autonomy, more creativity, more control, or more meaning, you usually do not get those traits by wanting them harder. "
            "You get them by having something rare and valuable enough to trade for them. That is the power of career capital. It turns the craftsman mindset from a good attitude into a mechanism. Preference may be real, but preference alone does not create leverage. "
            "This matters because many people try to buy rewards with the wrong currency. They have desire, impatience, and a strong story about the life they want. What they lack is proof that the market has to take them seriously yet."
        )

    return chapter


def main():
    edition = json.loads((RUN_ROOT / "manifests" / "edition-lock.json").read_text())
    manifest = json.loads((RUN_ROOT / "manifests" / "run-manifest.json").read_text())
    validated_dir = RUN_ROOT / "validated"
    structured_dir = RUN_ROOT / "structured"
    reports_dir = RUN_ROOT / "reports"

    for path in sorted(validated_dir.glob("ch*.chapter.json")):
        code = path.stem.split(".")[0]
        number = int(code[2:])
        edited_path = RUN_ROOT / "drafts" / "edited" / f"{code}.md"
        chapter = json.loads(path.read_text())
        edited_text = edited_path.read_text().strip()
        chapter = repair_chapter(chapter, edited_text)
        text = json.dumps(chapter, indent=2, ensure_ascii=False) + "\n"
        path.write_text(text)
        (structured_dir / f"{code}.chapter.json").write_text(text)

        review = {
            "schemaVersion": "chapterflow-v13-review-package",
            "packageId": f"{BOOK_ID}-{code}-review",
            "createdAt": CREATED_AT,
            "contentOwner": "ChapterFlow v13 Autonomous",
            "book": {
                "bookId": BOOK_ID,
                "title": edition["edition"]["title"],
                "author": edition["edition"]["author"],
                "edition": f"{edition['edition']['publishedYear']} {edition['edition']['language']} first edition",
            },
            "chapters": [chapter],
        }
        (validated_dir / f"{code}.review-package.json").write_text(json.dumps(review, indent=2, ensure_ascii=False) + "\n")

    continuity_path = RUN_ROOT / "continuity" / "continuity-state.json"
    continuity = json.loads(continuity_path.read_text())
    continuity["approvedChapterHashes"] = {}
    chapters = []
    for path in sorted(validated_dir.glob("ch*.chapter.json")):
        chapters.append(json.loads(path.read_text()))
        continuity["approvedChapterHashes"][path.stem.split(".")[0]] = hashlib.sha256(path.read_bytes()).hexdigest()
    continuity_path.write_text(json.dumps(continuity, indent=2, ensure_ascii=False) + "\n")

    package = {
        "schemaVersion": "1.1.0",
        "packageId": f"{BOOK_ID}-{manifest['runId']}",
        "createdAt": CREATED_AT,
        "contentOwner": "ChapterFlow v13 Autonomous",
        "book": {
            "bookId": BOOK_ID,
            "title": edition["edition"]["title"],
            "author": edition["edition"]["author"],
            "categories": ["Careers"],
            "tags": ["career", "skills", "work", "meaning"],
            "edition": {
                "name": "Original English first edition",
                "publisher": edition["edition"]["publisher"],
                "publishedYear": edition["edition"]["publishedYear"],
                "isbn13": edition["edition"]["isbn13"],
                "format": "Print reference edition",
                "sourceText": edition["frozenPrimaryTextPath"],
                "sourceProvenance": "Frozen web bundle with authorized preview metadata, store metadata, library TOC, and locked chapter-level anchors.",
            },
            "variantFamily": manifest["book"].get("variantFamily", "EMH"),
        },
        "chapters": chapters,
    }
    release_text = json.dumps(package, indent=2, ensure_ascii=False) + "\n"
    (RUN_ROOT / "release" / f"{BOOK_ID}.modern.json").write_text(release_text)
    Path("book-packages").mkdir(exist_ok=True)
    (Path("book-packages") / f"{BOOK_ID}.modern.json").write_text(release_text)

    print("repaired", len(chapters), "chapters")


if __name__ == "__main__":
    main()
