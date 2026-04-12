#!/usr/bin/env python3
import json
import textwrap
from pathlib import Path


ROOT = Path(".chapterflow/runs/the-black-swan/20260411-174728")


def tone(gentle: str, direct: str, competitive: str) -> dict:
    return {"gentle": gentle, "direct": direct, "competitive": competitive}


def block(text: str) -> str:
    return textwrap.dedent(text).strip()


BOOK = {
    "bookId": "the-black-swan",
    "title": "The Black Swan",
    "author": "Nassim N. Taleb",
    "categories": ["risk", "probability", "decision-making", "epistemology"],
    "tags": ["uncertainty", "black swan", "narrative fallacy", "silent evidence", "extremistan"],
    "edition": {
        "name": "First Edition",
        "translator": "",
        "publishedYear": 2007,
        "translationYear": None,
        "sourceText": ".chapterflow/runs/the-black-swan/20260411-174728/source-freeze/book-source.md",
        "sourceProvenance": "Random House hardcover, published April 17, 2007; chapter map cross-checked against Google Books limited preview",
    },
    "variantFamily": "EMH",
    "chapterRange": "1-19",
}


CH09 = {
    "chapterId": "ch09",
    "number": 9,
    "title": "The Ludic Fallacy, or The Uncertainty of the Nerd",
    "readingTimeMinutes": 2,
    "contentVariants": {
        "easy": {
            "chapterBreakdown": tone(
                "Taleb is attacking a transfer mistake. Games have bounded rules, visible moves, and known limits. Real life often does not. Yet people keep borrowing the clarity of games and using it as if it were a faithful picture of reality.",
                "The ludic fallacy is the error of treating the world like a neat game board. Once that happens, uncertainty starts looking tamer, more countable, and more polite than it really is.",
                "Taleb is not banning models. He is warning that game-shaped clarity becomes dangerous when it is mistaken for world-shaped understanding.",
            ),
            "keyTakeaways": [
                {"point": tone("Games and reality are not the same domain.", "Bounded rule systems do not map cleanly onto messy life.", "A game board is not the world.")},
                {"point": tone("Containment can create false confidence.", "A neat frame can make uncertainty look smaller than it is.", "The model can domesticate the danger on paper only.")},
                {"point": tone("Model usefulness depends on domain fit.", "The question is what the frame excludes and assumes fixed.", "A clean tool becomes a trap when its borders are fantasy.")},
            ],
            "oneMinuteRecap": tone(
                "What is the transfer error in the ludic fallacy?",
                "Why do neat game frames create overconfidence?",
                "What should you ask before trusting a model?",
            ),
        },
        "medium": {
            "chapterBreakdown": tone(
                block(
                    """
                    Taleb's target is not play but misplaced transfer. A game has bounded rules, visible moves, known constraints, and a relatively stable environment. The real world often does not. Yet people keep borrowing the emotional clarity of games and importing it into domains where hidden variables, changing incentives, and unknown tails govern the outcome.

                    That mismatch is the ludic fallacy. Reality gets treated as if it were a casino table, a chessboard, or a classroom puzzle. Once that happens, uncertainty starts looking tamer than it is because the model carries an atmosphere of containment. The rules feel knowable. The possibilities feel enumerable.

                    The chapter is therefore about model-domain mismatch more than about mathematics itself.
                    """
                ),
                block(
                    """
                    Taleb is not arguing that games are useless. Games can teach local structure, discipline, and logic. The danger begins when their cleanliness is mistaken for a good template for domains that are open, adaptive, opaque, and vulnerable to exceptional events. A strategy that behaves well inside a toy system may fail badly outside it because the world was never obliged to honor the same boundaries.

                    This matters for expertise because analysts, risk managers, and executives often feel safer once a problem can be translated into a formal frame. But the frame may be shrinking the problem into something more elegant than reality. Precision can then distort instead of clarify.

                    The question is no longer whether the model is clever. It is whether the model belongs to the domain.
                    """
                ),
                block(
                    """
                    The correction is not to abandon models altogether. It is to rank them below the world they claim to describe. Ask what the model excludes, what rules it assumes are fixed, and what kinds of events remain outside its polite board. Without those questions, formal clarity becomes a confidence machine.

                    This is why Chapter 10 follows naturally. Once game-shaped understanding is mistaken for world-shaped understanding, prediction becomes much easier to oversell. The forecast borrows prestige from a frame that may never have earned the right to speak so crisply.

                    The ludic fallacy is the polished rehearsal room for forecast arrogance.
                    """
                ),
            ),
            "keyTakeaways": [
                {
                    "point": tone("The ludic fallacy is domain mismatch.", "The error is treating open reality like a closed game.", "A bounded frame is being overpromoted into a world model."),
                    "moreDetails": tone("Taleb is not complaining about games themselves.", "He is criticizing the transfer of game-like clarity into systems with shifting rules and hidden causes.", "The mismatch begins when containment is mistaken for truth."),
                },
                {
                    "point": tone("Bounded rules create counterfeit safety.", "Known moves and fixed constraints can make uncertainty look smaller than it is.", "A polite board can hide an impolite world."),
                    "moreDetails": tone("Games feel reassuring because they limit what can happen.", "Real domains often contain unseen rules, changing players, and tail events outside the frame.", "Confidence rises because the frame is neat, not because the world got simpler."),
                },
                {
                    "point": tone("A good model can still be misapplied.", "Usefulness depends on whether the frame belongs to the domain.", "Cleverness is not fit."),
                    "moreDetails": tone("A model can behave beautifully inside its own boundaries while being badly mismatched to reality.", "Taleb wants the reader to inspect assumptions before admiring precision.", "The right question is not elegance first but jurisdiction first."),
                },
                {
                    "point": tone("Formal clarity can become a distortion source.", "Precision can shrink a problem into something more manageable than reality allows.", "A sharp frame can become a lying comfort."),
                    "moreDetails": tone("Experts are often rewarded for turning mess into formal structure.", "That reward can hide the cost of excluding the very factors that dominate the domain.", "A tidy frame can be socially persuasive while being inferentially weak."),
                },
                {
                    "point": tone("Chapter 9 prepares the prediction scandal.", "Once models are overtrusted, forecasts become easier to sell with false confidence.", "Bad transfer feeds forecast theater."),
                    "moreDetails": tone("Chapter 10 inherits this mistake and turns it into an institutional critique.", "Game-like understanding gives prediction borrowed authority.", "The cleaner the board feels, the easier it becomes to overspeak the future."),
                },
            ],
            "activationPrompt": tone(
                "Think of one model or framework you trust. What game-like assumptions is it quietly importing?",
                "Choose one formal tool you use and ask what real-world rules it assumes are fixed.",
                "Find one place where neat structure may be shrinking the domain too aggressively.",
            ),
            "selfCheckPrompts": [
                tone("Why is the ludic fallacy a transfer error rather than an anti-math claim?", "How does bounded structure create counterfeit safety?", "Why can a clever frame still be badly mismatched to reality?"),
                tone("What does it mean to ask whether a model belongs to a domain?", "How can formal clarity distort rather than clarify?", "Where do you still let neat boards speak for messy worlds?"),
            ],
            "predictionPrompt": tone(
                "If a game-like frame is already overtrusted, what happens when someone uses it to speak confidently about the future?",
                "How does model mismatch turn into forecast theater in the next chapter?",
                "What institutional habit follows once clean frames are given too much jurisdiction?",
            ),
            "oneMinuteRecap": {
                "retrieve": tone("What is the ludic fallacy?", "Why does a bounded game frame create overconfidence?", "What is the key model question after this chapter?"),
                "connect": tone("The chapter links fixed rules, false containment, and domain mismatch into one critique of overclean modeling.", "Taleb turns neat formalism into a warning about jurisdiction and excluded uncertainty.", "A tidy board can make the world look more domesticated than it is."),
                "preview": tone("The next chapter moves from overtrusted models to overconfident forecasters.", "Chapter 10 will show what happens when clean frames are used to sell prediction.", "After the false game board comes the scandal of prediction."),
            },
        },
        "hard": {
            "chapterBreakdown": tone(
                block(
                    """
                    Taleb's ludic fallacy is a criticism of epistemic transfer. Games are bounded by visible rules, enumerable moves, and relatively stable constraints. Their uncertainty is often real, but it is uncertainty inside a container. The real world often lacks that container. Yet analysts, forecasters, and experts keep importing the psychological comfort of bounded systems into domains where hidden variables and changing rules dominate.

                    The result is a false atmosphere of legibility. Once a domain is translated into a game-like frame, the mind starts feeling that the main risks are on the board, the important moves are countable, and the exceptions are manageable. That emotional shift is often the distortion.

                    Taleb is not anti-formalism here. He is anti-false jurisdiction.
                    """
                ),
                block(
                    """
                    That is why the chapter matters for sophisticated readers as much as for amateurs. A rigorous model can still be ludic if it imposes bounded cleanliness on an open, adaptive system. A beautiful structure may therefore conceal the fact that the real domain contains hidden players, unstable incentives, regime shifts, and tail events that the game board cannot host.

                    This is also why precision can become dangerous. The more polished the frame, the easier it becomes to forget the excluded terrain. Formal sharpness borrows trust from its internal coherence even when its external fit is weak.

                    The model can win the seminar and still lose to the world.
                    """
                ),
                block(
                    """
                    The correction Taleb wants is not model abolition but rank discipline. The frame must be subordinate to the domain. Ask what assumptions create the model's tidiness, what kinds of uncertainty the model cannot metabolize, and what events remain off-board but still able to dominate reality.

                    This sets up the next scandal directly. Once a game-like frame has borrowed too much authority, prediction inherits that authority and begins speaking with a confidence the world did not authorize.

                    The ludic fallacy is therefore not merely a technical mistake. It is a prestige pipeline for overconfident foresight.
                    """
                ),
            ),
            "keyTakeaways": [
                {
                    "point": tone("The chapter attacks false jurisdiction.", "A bounded frame is given authority over an unbounded domain.", "The board starts ruling a world it cannot contain."),
                    "moreDetails": tone("Taleb wants the model ranked beneath the domain rather than above it.", "A system with fixed rules can be useful locally while still failing as a global template.", "The problem begins when containment is treated as reality."),
                },
                {
                    "point": tone("Game-like uncertainty is contained uncertainty.", "Enumerated moves and visible constraints make risk feel more domesticated than real-world uncertainty usually is.", "The board makes danger look house-trained."),
                    "moreDetails": tone("This is why neat systems create emotional overconfidence even before any forecast is issued.", "The mind starts believing that what matters is largely visible and countable.", "Real domains often reserve their worst damage for what stayed off-board."),
                },
                {
                    "point": tone("Internal rigor does not guarantee external fit.", "A coherent model can still be badly mismatched to the world it describes.", "Elegance can hide jurisdiction failure."),
                    "moreDetails": tone("Taleb is separating technical beauty from domain faithfulness.", "A model may be admirable in seminar space while remaining fragile in reality space.", "The sharper the frame, the easier its exclusions are to forget."),
                },
                {
                    "point": tone("Precision can become prestige laundering.", "Formal sharpness earns social trust even when the frame excludes decisive uncertainty.", "The cleaner the equations, the cheaper the borrowed authority can become."),
                    "moreDetails": tone("Experts often inherit credibility from polished structure.", "That credibility may rest more on visible rigor than on real contact with the domain.", "A strong-looking frame can become a social machine for underpricing excluded risk."),
                },
                {
                    "point": tone("The next chapter exposes forecast authority built on overtrusted frames.", "Prediction theater feeds on game-like understanding that was already overpromoted.", "Bad jurisdiction becomes confident foresight on the next page."),
                    "moreDetails": tone("Chapter 10 moves from the model layer to the social layer of the same problem.", "Once the board is trusted too much, the forecast gains borrowed permission to overstate itself.", "The prestige pipeline now ends in prediction culture."),
                },
            ],
            "activationPrompt": tone(
                "Name one formal frame you respect and ask what off-board events could still dominate it.",
                "Take one elegant model and inspect the assumptions that create its tidiness.",
                "Where is a neat board quietly claiming more jurisdiction than it earned?",
            ),
            "selfCheckPrompts": [
                tone("Why is the ludic fallacy about false jurisdiction rather than hostility to models?", "How does contained uncertainty differ from open-world uncertainty?", "Why can a model win intellectually while still lose to reality?"),
                tone("How does precision launder prestige in this chapter?", "Why do excluded variables disappear so easily once a frame is polished?", "Where do you still let internal rigor stand in for external fit?"),
            ],
            "predictionPrompt": tone(
                "What happens when a frame with false jurisdiction is used to speak crisply about the future?",
                "How does overtrusted modeling become prediction theater?",
                "What social scandal grows out of technical overconfidence?",
            ),
            "oneMinuteRecap": {
                "retrieve": tone("What is false jurisdiction in this chapter?", "Why is contained uncertainty misleading as a template for open domains?", "What must stay subordinate to the world?"),
                "connect": tone("The chapter connects bounded rules, prestige-bearing precision, and excluded uncertainty into one critique of overclean formalism.", "Taleb shows that domain mismatch can survive beneath beautiful rigor.", "A game board becomes dangerous when it borrows authority over off-board reality."),
                "preview": tone("The next chapter turns this overtrusted frame into overconfident prediction culture.", "Chapter 10 exposes the social scandal built on borrowed model authority.", "After false jurisdiction comes forecast theater."),
            },
        },
    },
    "examples": [
        {"title": "A Risk Team Treats Market Behavior Like a Clean Simulation", "format": "finance_case", "category": "finance", "endingType": "diagnose", "scenario": tone("A risk team grows confident because its model behaves cleanly under bounded assumptions and stable distributions.", "The team is treating an open domain like a polite game board.", "The simulation is lending containment the market never promised."), "whatToDo": tone("Ask what hidden shifts, rule changes, and off-board events the model cannot host.", "Inspect domain fit before admiring the frame's elegance.", "Make the world, not the board, decide the model's rank."), "whyItMatters": tone("A clean frame can create counterfeit safety.", "Containment on paper is not containment in reality.", "The board may be tidy while the domain stays feral.")},
        {"title": "A Manager Uses a Classroom Case Like a Full Business Map", "format": "work_case", "category": "work", "endingType": "reframe", "scenario": tone("A manager applies a neat classroom strategy model to a live organization with shifting incentives and opaque politics.", "A bounded teaching case is being overpromoted into a world model.", "The case study wants jurisdiction over a mess it cannot contain."), "whatToDo": tone("List what the live domain contains that the teaching case excluded.", "Treat the model as a local lens rather than as a sovereign map.", "Put the off-board politics back into the boardroom."), "whyItMatters": tone("Transfer error often hides inside polished frameworks.", "The model may clarify one slice while distorting the real domain overall.", "Cleverness is not jurisdiction.")},
        {"title": "A Student Overtrusts a Probability Puzzle Mindset", "format": "school_case", "category": "school", "endingType": "diagnose", "scenario": tone("A student starts treating messy social or economic systems like puzzle sets with stable rules and countable outcomes.", "Game-trained confidence is leaking into open reality.", "The puzzle board is trying to annex the world."), "whatToDo": tone("Separate problems with fixed rules from domains with hidden variables and changing constraints.", "Ask whether the system is truly bounded before using puzzle confidence inside it.", "Do not let a neat exercise become a passport to wild territory."), "whyItMatters": tone("The ludic fallacy often begins as overtransfer from clean learning environments.", "Success inside contained systems can create false authority outside them.", "Puzzle fluency is not world fluency.")},
        {"title": "A Forecasting Dashboard Mistakes Countability for Control", "format": "business_case", "category": "business", "endingType": "reflect", "scenario": tone("A forecasting dashboard tracks what is easy to count and then treats the countable field as if it were the decisive field.", "The board contains what the dashboard can host, not what reality can do.", "Metrics are turning visibility into fake jurisdiction."), "whatToDo": tone("Ask what risks and drivers remain off-dashboard but still able to dominate outcomes.", "Keep the dashboard useful without letting it define the world.", "Force off-board uncertainty back into the meeting before the numbers start swaggering."), "whyItMatters": tone("Countability can imitate control.", "A clean display can make exclusion feel like mastery.", "The screen is not the domain.")},
        {"title": "An Economist Treats a Regime Shift Like a Minor Rule Variation", "format": "policy_case", "category": "policy", "endingType": "diagnose", "scenario": tone("An economist handles a regime shift as though it were only a small move inside an otherwise stable model.", "The model assumes fixed rules where the domain has changed the game itself.", "The board stayed the same only because the board ignored the fire outside it."), "whatToDo": tone("Reassess whether the model's rules still belong to the domain after the shift.", "Treat regime change as a threat to jurisdiction, not merely as a parameter tweak.", "When the game changes, stop asking the old board for permission."), "whyItMatters": tone("The worst model failures often come from hidden rule changes.", "Open systems do not owe continuity to elegant frameworks.", "A stable board can become a fossil overnight.")},
        {"title": "A Team Loves the Fairness of a Scoring Game", "format": "team_case", "category": "work", "endingType": "reframe", "scenario": tone("A team builds incentives around a game-like scoring system and forgets that real contributors can adapt, game, and reshape the rules.", "The organization is overtrusting bounded mechanics in an adaptive human setting.", "The scorecard wants to be a law in a world full of counterplay."), "whatToDo": tone("Ask how people can change behavior in response to the scoring frame and what the frame cannot see.", "Treat the scoring game as a tool that will reshape the domain around it.", "Do not confuse clean points with clean reality."), "whyItMatters": tone("Adaptive systems do not stay politely inside the frame you assign them.", "The game board changes the players and the players change the game.", "A tidy scoring rule can trigger off-board distortions fast.")},
    ],
    "quiz": {
        "passingScorePercent": 80,
        "questions": [
            {"questionId": "q01", "prompt": "What is the ludic fallacy?", "choices": ["Disliking games.", "Treating messy reality as if it behaved like a bounded game.", "Using any formal model at all."], "correctIndex": 1, "explanation": tone("Taleb is attacking transfer error, not play.", "The issue is overapplying game-like clarity to open domains.", "A board is pretending to be the world."), "bloomsLevel": "remember", "depthLevel": "simple"},
            {"questionId": "q02", "prompt": "Why do bounded games create false comfort when overtransferred?", "choices": ["Because they eliminate all skill.", "Because fixed rules and countable moves make uncertainty look tamer than it is.", "Because games are immoral."], "correctIndex": 1, "explanation": tone("Containment feels safer than open uncertainty.", "The frame makes risk look domesticated.", "The board trains the mind to expect polite danger."), "bloomsLevel": "understand", "depthLevel": "simple"},
            {"questionId": "q03", "prompt": "What question matters most after this chapter?", "choices": ["Is the model elegant?", "Does the model belong to the domain?", "Is the math difficult?"], "correctIndex": 1, "explanation": tone("Taleb cares about jurisdiction first.", "Fit to reality matters more than polish.", "The board must answer to the world."), "bloomsLevel": "understand", "depthLevel": "simple"},
            {"questionId": "q04", "prompt": "A risk model behaves cleanly under stable assumptions, so a team treats market danger as contained. What is happening?", "choices": ["Healthy realism.", "The ludic fallacy through false containment.", "A necessary rejection of uncertainty."], "correctIndex": 1, "explanation": tone("A neat frame is overpromoting its own boundaries.", "The model contains the simulation, not necessarily the market.", "Paper safety is being mistaken for domain safety."), "bloomsLevel": "apply", "depthLevel": "standard"},
            {"questionId": "q05", "prompt": "Why can a beautiful model still fail badly?", "choices": ["Because beauty destroys logic.", "Because internal coherence does not guarantee external fit.", "Because all models are useless."], "correctIndex": 1, "explanation": tone("The model can be rigorous and still mismatched.", "Seminar success is not world success.", "Elegance can hide jurisdiction failure."), "bloomsLevel": "apply", "depthLevel": "standard"},
            {"questionId": "q06", "prompt": "What makes precision dangerous in this chapter?", "choices": ["Precision always lies.", "It can earn trust even when decisive uncertainty stays off-board.", "Precision removes all uncertainty."], "correctIndex": 1, "explanation": tone("Sharpness can launder authority.", "Formal clarity may exclude what matters most.", "The cleaner the board, the easier excluded risk disappears."), "bloomsLevel": "analyze", "depthLevel": "standard"},
            {"questionId": "q07", "prompt": "A scoring system works neatly until employees adapt around it. Which idea fits best?", "choices": ["Closed-game reliability.", "An adaptive domain is escaping a bounded frame.", "Proof that incentives do not matter."], "correctIndex": 1, "explanation": tone("The system is not as closed as the scorecard assumed.", "Players change the game in live domains.", "The board cannot freeze an adaptive world."), "bloomsLevel": "analyze", "depthLevel": "standard"},
            {"questionId": "q08", "prompt": "How does Chapter 9 prepare Chapter 10?", "choices": ["It proves forecasting is impossible in every case.", "It shows how overtrusted frames lend borrowed authority to predictions.", "It abandons expertise entirely."], "correctIndex": 1, "explanation": tone("Prediction inherits authority from the frame beneath it.", "Bad jurisdiction feeds forecast theater.", "The clean board becomes a megaphone for overconfidence."), "bloomsLevel": "evaluate", "depthLevel": "deeper"},
            {"questionId": "q09", "prompt": "Which phrase best captures Taleb here?", "choices": ["The board is the domain.", "A model must stay subordinate to the world it claims to describe.", "Games should replace reality."], "correctIndex": 1, "explanation": tone("Taleb wants rank discipline.", "The frame must answer to the domain, not reverse the hierarchy.", "The world outranks the board."), "bloomsLevel": "evaluate", "depthLevel": "deeper"},
            {"questionId": "q10", "prompt": "What is false jurisdiction?", "choices": ["When a bounded frame claims authority over an unbounded reality.", "When math is taught in school.", "When rules are written down."], "correctIndex": 0, "explanation": tone("That is the core prestige error here.", "A contained system borrows too much authority over open domains.", "The board starts ruling a world it cannot contain."), "bloomsLevel": "evaluate", "depthLevel": "deeper"},
        ],
    },
    "implementationPlan": {
        "coreSkill": tone("Practice checking whether a formal frame belongs to the domain it describes.", "Train yourself to look for off-board uncertainty and hidden rule changes.", "Stop letting neat boards outrank messy worlds."),
        "ifThenPlans": [
            {"context": "work", "plan": tone("If a model feels reassuring, then ask what decisive uncertainty remains outside it.", "If the frame looks clean, then test whether the domain is actually bounded in the same way.", "If the board feels polite, then look for off-board ferality.")},
            {"context": "school", "plan": tone("If a puzzle mindset starts leaking into live systems, then ask whether the rules are truly fixed.", "If the model seems complete, then name what hidden variables or regime shifts it cannot host.", "If the exercise was clean, do not assume the world will grade the same way.")},
            {"context": "personal", "plan": tone("If a framework gives you too much confidence, then ask what part of reality it is shrinking or excluding.", "If the frame feels elegant, then inspect its jurisdiction before trusting its comfort.", "If the model glows, ask what darkness it cannot metabolize.")},
        ],
        "twentyFourHourChallenge": tone("Pick one model you trust and write three things the real domain can do that the model cannot host cleanly.", "Review one framework you use and test whether its rules are truly fixed in the live environment.", "Take one elegant board and make the off-board risks explicit."),
        "weeklyPractice": tone("For one week, whenever a formal frame reassures you, write what hidden uncertainty remains outside it.", "Keep a short log of where bounded models were quietly claiming too much jurisdiction.", "Spend one week forcing the world to outrank the board in every major decision."),
    },
    "reviewCards": [
        {"cardId": "ch09-rc01", "front": tone("What is the ludic fallacy?", "What transfer mistake defines this chapter?", "Finish the line: a bounded game is not..."), "back": tone("It is treating messy reality like a bounded game.", "The chapter targets overtransferring clean rule systems into open domains.", "...the world."), "difficulty": "easy"},
        {"cardId": "ch09-rc02", "front": tone("Why do game boards create false confidence?", "What does containment do to felt uncertainty?", "Why does the board feel safer than the domain?"), "back": tone("Because fixed rules and countable moves make danger look tamer.", "Containment gives uncertainty a misleadingly polite shape.", "The board domesticates risk on paper."), "difficulty": "easy"},
        {"cardId": "ch09-rc03", "front": tone("What question should you ask before trusting a model?", "How do you test jurisdiction here?", "What outranks elegance in this chapter?"), "back": tone("Does the model belong to the domain?", "Check what the frame excludes and assumes fixed.", "Domain fit outranks polish."), "difficulty": "medium"},
        {"cardId": "ch09-rc04", "front": tone("Why can precision become dangerous?", "How does formal sharpness launder authority?", "What does a clean frame hide too easily?"), "back": tone("It can earn trust while excluding decisive uncertainty.", "Precision looks rigorous even when the domain fit is weak.", "Off-board risks and rule changes."), "difficulty": "medium"},
        {"cardId": "ch09-rc05", "front": tone("How does Chapter 9 lead into the scandal of prediction?", "What happens after a frame is overtrusted?", "What authority does the forecast borrow?"), "back": tone("Prediction borrows authority from an overtrusted frame.", "Bad model jurisdiction feeds forecast theater.", "The forecast borrows prestige from the false board."), "difficulty": "hard"},
    ],
    "keyTakeawayCard": tone("A neat model becomes dangerous when it is mistaken for a faithful copy of a messy domain.", "The key question is not whether the board is elegant but whether it belongs to the world it claims to describe.", "False jurisdiction turns clean formalism into cheap confidence."),
}
payload = dict(CH09)
payload["book"] = BOOK
(ROOT / "structured" / "ch09.chapter.json").write_text(json.dumps(payload, indent=2) + "\n")
(ROOT / "validated" / "ch09.chapter.json").write_text(json.dumps(payload, indent=2) + "\n")
(ROOT / "quizzes" / "ch09.quiz.json").write_text(json.dumps(CH09["quiz"], indent=2) + "\n")
