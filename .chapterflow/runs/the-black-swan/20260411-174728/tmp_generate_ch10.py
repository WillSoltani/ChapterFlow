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


CH10 = {
    "chapterId": "ch10",
    "number": 10,
    "title": "The Scandal of Prediction",
    "readingTimeMinutes": 2,
    "contentVariants": {
        "easy": {
            "chapterBreakdown": tone(
                "Taleb's scandal is not only that forecasts fail. It is that forecasts are delivered with much more confidence than their signal deserves. The offense is overprecision.",
                "This happens because confidence is socially rewarded. A crisp forecast sounds professional, while a careful admission of uncertainty sounds weak.",
                "Taleb is attacking prediction theater: uncertainty gets translated into authority language that sounds stronger than the evidence is.",
            ),
            "keyTakeaways": [
                {"point": tone("The scandal is inflated confidence.", "Prediction often overspeaks its signal.", "The forecast is louder than the evidence.")},
                {"point": tone("Institutions reward crispness.", "Confidence often outranks calibration in public settings.", "Fluency can beat honesty.")},
                {"point": tone("Prediction culture is systemic.", "Forecast theater survives because audiences and institutions reward certainty style.", "The stage loves a number more than a boundary.")},
            ],
            "oneMinuteRecap": tone(
                "What is the scandal in this chapter?",
                "Why does prediction theater persist?",
                "What gets rewarded more than calibration?",
            ),
        },
        "medium": {
            "chapterBreakdown": tone(
                block(
                    """
                    Taleb's scandal is not simply that people predict badly. It is that they predict badly while speaking as if the world had granted them more visibility than it has. The offense is inflated confidence. Error matters, but overprecision matters more because it turns uncertainty into authority theater.

                    This persists because prediction is socially rewarded when it sounds crisp. A hesitant forecast feels weak. A decisive forecast feels professional. Institutions, media, and organizations therefore keep selecting for people who can compress ambiguity into sentences that sound clean and final.

                    Calibration loses status to fluency.
                    """
                ),
                block(
                    """
                    The chapter matters because this is not merely an individual flaw. It is an incentive structure. Forecasts travel upward through boardrooms, interviews, briefings, and management culture because they create the impression that reality is being domesticated. The person who says, I do not know, rarely gets the same prestige as the person who offers a number and a date.

                    Taleb is not claiming that all foresight is worthless. He is claiming that prediction culture routinely exaggerates what is knowable. Experts borrow prestige from formality, from tidy models, and from the audience's appetite for certainty more than from real signal.

                    The forecast may therefore be respected for reasons that have little to do with genuine visibility.
                    """
                ),
                block(
                    """
                    The correction is not permanent silence. It is harsher discipline about what deserves precision, what counts as knowledge, and when ignorance is the stronger answer. Prediction should shrink when the domain is opaque, tail-driven, or model-fragile. Instead it often expands.

                    That is why Chapter 11 follows naturally. Once false grandeur has been stripped from forecasting, the better question becomes how to search, notice, and act without pretending the map is already clear.

                    Taleb is moving from prediction theater toward practical contact with uncertainty.
                    """
                ),
            ),
            "keyTakeaways": [
                {
                    "point": tone("The scandal is confidence inflation, not error alone.", "Taleb cares most about forecasts sounding more certain than their signal warrants.", "The offense is overspeaking uncertainty."),
                    "moreDetails": tone("A wrong forecast can still be honest about its limits, but a confident forecast can mislead even before reality answers it.", "Taleb is attacking the social packaging of foresight, not merely tallying hits and misses.", "Authority tone is doing part of the damage."),
                },
                {
                    "point": tone("Prediction theater is institutionally rewarded.", "Crisp forecasts earn status more easily than calibrated hesitation.", "The stage prefers certainty style."),
                    "moreDetails": tone("Organizations often promote the person who sounds decisive over the person who marks boundaries carefully.", "This creates a system where fluency can outrank epistemic discipline.", "The confident number travels farther than the honest shrug."),
                },
                {
                    "point": tone("Prestige can be borrowed from formality rather than from signal.", "Experts often gain trust from tidy models and professional tone even when knowability is weak.", "A forecast can dress itself in method and call that vision."),
                    "moreDetails": tone("Taleb is pressing on the difference between institutional respectability and actual visibility.", "The forecast may look rigorous because of its packaging rather than because the domain allowed real foresight.", "Professional form can become a prestige costume for weak signal."),
                },
                {
                    "point": tone("Prediction should contract in opaque domains.", "The murkier and more tail-driven the field, the less precision deserves to survive.", "Opacity should humble the sentence."),
                    "moreDetails": tone("Taleb wants confidence scaled to what the domain actually allows.", "In practice prediction often expands right where it should grow smaller.", "The scandal worsens when opacity and confidence rise together."),
                },
                {
                    "point": tone("Chapter 10 prepares a move toward pragmatic action.", "Once prediction loses false authority, search and noticing become more important than forecast theater.", "After oversold maps comes better navigation."),
                    "moreDetails": tone("The next chapter asks how to proceed without pretending to own foresight.", "Taleb is shifting from exposing prediction vanity to building a more practical stance.", "When confidence gets cut down, observation and search gain room."),
                },
            ],
            "activationPrompt": tone(
                "Think of one forecast you trust. How much of that trust comes from tone and form rather than real signal?",
                "Choose one expert prediction and ask what part of its authority comes from prestige packaging.",
                "Find one place where decisive language may be outranking calibration.",
            ),
            "selfCheckPrompts": [
                tone("Why is overprecision more dangerous than simple error in this chapter?", "How do institutions reward prediction theater?", "Why can a crisp forecast travel farther than an honest boundary?"),
                tone("How does prestige get borrowed from formality rather than from signal?", "Why should prediction shrink in opaque domains?", "Where do you still mistake decisiveness for visibility?"),
            ],
            "predictionPrompt": tone(
                "Once prediction theater is exposed, what stronger alternative to fake foresight might Chapter 11 offer?",
                "How do you proceed after stripping forecasts of borrowed grandeur?",
                "What does pragmatic contact with uncertainty look like after this scandal?",
            ),
            "oneMinuteRecap": {
                "retrieve": tone("What is the scandal of prediction?", "Why does prediction theater persist?", "What gets rewarded more than calibration?"),
                "connect": tone("The chapter links confidence inflation, institutional incentives, and prestige packaging into one critique of forecasting culture.", "Taleb shows that prediction is often respected for tone, formality, and audience hunger rather than for signal.", "The forecast becomes socially strong where the evidence remains epistemically weak."),
                "preview": tone("The next chapter shifts from exposing false foresight to acting without it.", "Chapter 11 asks how to search and notice instead of overselling a map.", "After forecast theater comes pragmatic scouting."),
            },
        },
        "hard": {
            "chapterBreakdown": tone(
                block(
                    """
                    Taleb's scandal is not mere predictive failure. It is predictive failure delivered with ceremonial confidence. The deeper offense is that uncertainty gets translated into social authority through tone, precision, and institutional ritual. A weakly knowable domain is made to sound legible because confidence itself is being sold as competence.

                    That is why overprecision matters so much. A forecast with false crispness does not merely risk being wrong later. It reshapes decisions, status, and attention in the present. The sentence becomes stronger than the signal.

                    Taleb is therefore attacking the social life of prediction, not just its scorecard.
                    """
                ),
                block(
                    """
                    This system survives because institutions reward the appearance of domesticated reality. Boards, media, executives, and audiences prefer the person who can convert ambiguity into a date, a number, or a directional certainty. The forecaster who marks limits carefully often loses prestige to the forecaster who speaks with theatrical confidence.

                    That is why prediction culture is not a random collection of boastful individuals. It is an ecology that selects for fluency under opacity. Experts can therefore inherit authority from professional form, tidy models, and calm tone even when the underlying signal is weak.

                    The ritual of confidence becomes a prestige technology.
                    """
                ),
                block(
                    """
                    The correction Taleb wants is not muteness but rank discipline. Precision must answer to knowability. In opaque, tail-heavy, model-fragile domains, forecasts should contract rather than expand. Instead public discourse often reverses that rule and rewards the strongest voice exactly where visibility is weakest.

                    This prepares the next move. Once forecast grandeur is cut down to size, the practical question is no longer how to sound certain. It is how to search, notice, and act under uncertainty without pretending to own the map.

                    The scandal of prediction is the prestige pipeline that Chapter 11 will refuse to inhabit.
                    """
                ),
            ),
            "keyTakeaways": [
                {
                    "point": tone("The scandal is ceremonial confidence under weak knowability.", "Prediction becomes socially powerful by sounding more certain than the domain allows.", "The sentence outranks the signal."),
                    "moreDetails": tone("Taleb is criticizing the present-tense authority of forecasting, not only its future miss rate.", "False crispness changes decisions before reality has a chance to correct it.", "The harm begins when weak visibility is dressed as competence."),
                },
                {
                    "point": tone("Prediction culture is an ecology, not just a personality problem.", "Institutions systematically reward fluency under opacity.", "The system selects for crispness in the fog."),
                    "moreDetails": tone("Boards, media, and organizations keep promoting the forecaster who sounds domesticating rather than the one who marks limits.", "This makes prediction theater durable even when accuracy is unimpressive.", "The ecology favors prestige tone over calibrated boundary work."),
                },
                {
                    "point": tone("Prestige can be manufactured through formality.", "Professional ritual, quantitative style, and polished delivery can imitate genuine signal.", "Method dress can impersonate vision."),
                    "moreDetails": tone("Taleb is exposing how forecasts borrow credibility from form rather than from contact with reality.", "A model, title, or polished cadence can make weak foresight look institutionally legitimate.", "The costume of rigor can hide epistemic thinness."),
                },
                {
                    "point": tone("Knowability should govern precision.", "The more opaque and tail-driven the domain, the less crisp the forecast deserves to be.", "Opacity should starve the sentence."),
                    "moreDetails": tone("Taleb wants confidence scaled to domain conditions rather than to audience appetite.", "Prediction culture often does the opposite by amplifying certainty where visibility is weakest.", "The scandal intensifies when precision expands in hostile domains."),
                },
                {
                    "point": tone("Chapter 11 pivots from forecast prestige to pragmatic contact with uncertainty.", "Once false foresight loses authority, search and noticing become more valuable.", "After the ceremony comes the scout."),
                    "moreDetails": tone("The next chapter does not leave the reader with silence alone.", "It redirects attention from prediction theater toward practical orientation inside uncertainty.", "When the prestige pipeline is cut, observation gains rank."),
                },
            ],
            "activationPrompt": tone(
                "Take one forecast you respect and strip away its tone, title, and formatting. What signal remains?",
                "Choose one domain where people still speak too crisply and ask what knowability would really permit.",
                "Where is ceremonial confidence outrunning reality in your world?",
            ),
            "selfCheckPrompts": [
                tone("Why is ceremonial confidence more damaging than simple forecasting error?", "How does institutional ecology keep prediction theater alive?", "Why can the sentence become stronger than the signal?"),
                tone("How does formality manufacture prestige in forecasting culture?", "Why should opacity starve precision rather than feed it?", "Where do you still trust the costume of rigor too quickly?"),
            ],
            "predictionPrompt": tone(
                "What practical stance becomes possible once prediction loses ceremonial authority?",
                "How will Chapter 11 proceed without pretending to own foresight?",
                "What replaces prestige forecasting when the scout outranks the prophet?",
            ),
            "oneMinuteRecap": {
                "retrieve": tone("What does Taleb mean by the scandal of prediction?", "Why is the social life of prediction central here?", "What should govern the size of a forecast?"),
                "connect": tone("The chapter connects overprecision, institutional reward, and prestige packaging into one criticism of modern forecasting culture.", "Taleb shows that weak visibility can still become powerful speech through ceremonial confidence.", "Prediction becomes socially large precisely where knowability may be small."),
                "preview": tone("The next chapter turns from ceremonial confidence to practical scouting under uncertainty.", "Chapter 11 asks how to move without borrowing fake map authority.", "After the prophet comes the scout."),
            },
        },
    },
    "examples": [
        {"title": "A TV Analyst Gives a Precise Market Date", "format": "media_case", "category": "finance", "endingType": "diagnose", "scenario": tone("A TV analyst announces a precise market turning point with confident language despite weak signal and deep uncertainty.", "Precision is being used as theater.", "The sentence is wearing more certainty than the market donated."), "whatToDo": tone("Strip the forecast down to what the domain genuinely allows and mark the boundary conditions.", "Ask how much of the authority comes from tone and format rather than from real visibility.", "Make the signal stand without its costume."), "whyItMatters": tone("Confidence can outrank evidence socially.", "Forecast theater moves decisions before reality gets a vote.", "The stage loves a date more than a boundary.")},
        {"title": "A Board Prefers the Exec With a Crisp Forecast", "format": "work_case", "category": "work", "endingType": "reframe", "scenario": tone("A board rewards the executive who offers a confident forecast over the one who marks uncertainty carefully.", "The institution is selecting for fluency over calibration.", "Prestige is being handed to the cleaner sentence."), "whatToDo": tone("Reward boundary marking and knowability discipline rather than crisp overreach.", "Ask what the domain permits before praising decisiveness.", "Stop promoting prophets for fog they did not clear."), "whyItMatters": tone("Prediction culture is systemic, not merely personal.", "Institutions can mass-produce overconfident speech.", "The ecology teaches people to sound certain before they learn to be careful.")},
        {"title": "A Student Trusts a Forecast Because It Looks Quantitative", "format": "school_case", "category": "school", "endingType": "diagnose", "scenario": tone("A student assumes a forecast is strong because it is presented with charts, numbers, and polished formality.", "Formality is borrowing authority for weak signal.", "The costume of rigor is doing the seeing."), "whatToDo": tone("Ask what the numbers actually know about the domain and what remains opaque.", "Separate formatting prestige from real visibility.", "Do not let the chart speak for the darkness around it."), "whyItMatters": tone("Professional style can imitate insight.", "Prediction often borrows credibility from presentation rather than from signal.", "A graph can become a social amplifier for weak foresight.")},
        {"title": "A Manager Gives Exact Timelines in a Turbulent Domain", "format": "business_case", "category": "business", "endingType": "reflect", "scenario": tone("A manager gives exact delivery timelines in a volatile environment because ambiguity sounds unprofessional.", "The forecast is expanding exactly where knowability is weak.", "Opacity is being bullied into a calendar date."), "whatToDo": tone("Shrink precision to what the domain can support and mark the real uncertainty openly.", "Let knowability govern the sentence rather than the audience's appetite for certainty.", "Starve the timeline until the domain earns it."), "whyItMatters": tone("The scandal worsens when precision rises with opacity.", "Crisp language can create fake control inside unstable systems.", "The date is stronger than the map.")},
        {"title": "A Political Pundit Converts Ambiguity Into Certainty", "format": "policy_case", "category": "policy", "endingType": "diagnose", "scenario": tone("A pundit turns a messy political environment into a confident directional call because decisive speech wins airtime.", "Prediction ecology is rewarding theater.", "Television is paying by the ounce for certainty tone."), "whatToDo": tone("Ask what visibility the domain truly offers and discount the authority granted by platform and style.", "Treat airtime confidence as a social reward signal, not as proof of foresight.", "Subtract the studio from the sentence."), "whyItMatters": tone("Public prediction often survives because confidence is marketable.", "The ecology selects for boldness where knowability is thin.", "The forecast may be socially fit and epistemically weak.")},
        {"title": "A Team Treats One Forecast as a Map", "format": "team_case", "category": "work", "endingType": "reframe", "scenario": tone("A team organizes around one confident forecast as if it were a map rather than a fragile guess.", "The forecast has borrowed too much rank.", "A sentence is trying to become terrain."), "whatToDo": tone("Demote the forecast to a provisional tool and increase attention to search, noticing, and update loops.", "Treat the plan as conditional rather than as a domesticating map.", "Give the scout more room than the prophet."), "whyItMatters": tone("Forecast authority can crowd out better adaptive behavior.", "The stronger alternative is not silence but more responsive contact with the domain.", "A brittle map can blind a moving team.")},
    ],
    "quiz": {
        "passingScorePercent": 80,
        "questions": [
            {"questionId": "q01", "prompt": "What is the scandal in Chapter 10?", "choices": ["Forecasts are always impossible.", "Forecasts are delivered with more confidence than their signal deserves.", "Experts should never speak."], "correctIndex": 1, "explanation": tone("Taleb is targeting confidence inflation.", "The offense is overprecision under uncertainty.", "The sentence is too strong for the evidence."), "bloomsLevel": "remember", "depthLevel": "simple"},
            {"questionId": "q02", "prompt": "Why does prediction theater persist?", "choices": ["Because calibration is more rewarded than fluency.", "Because institutions reward crisp confident speech.", "Because uncertainty is gone."], "correctIndex": 1, "explanation": tone("Confidence is socially marketable.", "Boards, media, and organizations often prefer decisive tone.", "The ecology pays for crispness."), "bloomsLevel": "understand", "depthLevel": "simple"},
            {"questionId": "q03", "prompt": "What outranks calibration in many prediction settings?", "choices": ["Fluency and decisiveness.", "Humility and limits.", "Silence and withdrawal."], "correctIndex": 0, "explanation": tone("That is one of Taleb's main complaints here.", "The clean sentence often travels farther than the careful boundary.", "Style beats discipline too often."), "bloomsLevel": "understand", "depthLevel": "simple"},
            {"questionId": "q04", "prompt": "A board prefers the executive with the crisp forecast over the one who marks uncertainty carefully. What does that show?", "choices": ["Healthy realism.", "Prediction culture as an incentive system.", "That the forecast is correct."], "correctIndex": 1, "explanation": tone("The chapter is systemic, not merely personal.", "Institutions can select for overconfident speech.", "The ecology is rewarding theater."), "bloomsLevel": "apply", "depthLevel": "standard"},
            {"questionId": "q05", "prompt": "Why is overprecision more damaging than simple error?", "choices": ["Because wrongness never matters.", "Because false crispness changes decisions before reality corrects it.", "Because precision is immoral."], "correctIndex": 1, "explanation": tone("The harm begins in the present, not only after the miss.", "A strong-sounding forecast can reshape action before it is falsified.", "The sentence moves people before the signal deserves that power."), "bloomsLevel": "apply", "depthLevel": "standard"},
            {"questionId": "q06", "prompt": "How can prestige be borrowed in forecasting culture?", "choices": ["Through polished formality and tidy models that imitate signal.", "Through honest ignorance only.", "Through refusing all numbers."], "correctIndex": 0, "explanation": tone("Professional form can imitate real visibility.", "Titles, charts, and tone can lend weak signal extra authority.", "The costume of rigor can do fake seeing."), "bloomsLevel": "analyze", "depthLevel": "standard"},
            {"questionId": "q07", "prompt": "What should happen to prediction in opaque, tail-heavy domains?", "choices": ["It should become more precise to compensate.", "It should contract rather than expand.", "It should dominate every decision."], "correctIndex": 1, "explanation": tone("Taleb wants knowability to govern precision.", "Opacity should humble the sentence.", "Fog should starve the forecast."), "bloomsLevel": "analyze", "depthLevel": "standard"},
            {"questionId": "q08", "prompt": "How does Chapter 10 lead into Chapter 11?", "choices": ["It shows why better search and noticing outrank false foresight.", "It proves action is impossible without prediction.", "It abandons uncertainty completely."], "correctIndex": 0, "explanation": tone("After forecast theater comes practical scouting.", "Taleb is preparing a move from false map authority to adaptive contact with the domain.", "The scout replaces the prophet."), "bloomsLevel": "evaluate", "depthLevel": "deeper"},
            {"questionId": "q09", "prompt": "Which phrase best fits the chapter?", "choices": ["The forecast is louder than the evidence.", "Every prediction is evil.", "Confidence proves visibility."], "correctIndex": 0, "explanation": tone("That is the core scandal.", "Prediction culture overspeaks its signal.", "The sentence is stronger than the sight."), "bloomsLevel": "evaluate", "depthLevel": "deeper"},
            {"questionId": "q10", "prompt": "What should govern the size of a forecast?", "choices": ["Audience appetite for certainty.", "Domain knowability and real signal.", "Professional status alone."], "correctIndex": 1, "explanation": tone("Taleb wants rank discipline between knowability and precision.", "The sentence should shrink or grow with what the domain allows.", "Signal, not theater, should size the forecast."), "bloomsLevel": "evaluate", "depthLevel": "deeper"},
        ],
    },
    "implementationPlan": {
        "coreSkill": tone("Practice separating forecast authority from real signal.", "Train yourself to discount ceremonial confidence and reward calibration.", "Stop letting crispness outrank knowability."),
        "ifThenPlans": [
            {"context": "work", "plan": tone("If a forecast sounds unusually crisp, then ask what the domain genuinely permits it to know.", "If the sentence feels strong, then separate the signal from the tone and format carrying it.", "If the prophecy glows, strip off its costume.")},
            {"context": "school", "plan": tone("If a prediction looks credible because it is quantitative, then ask what uncertainty the numbers cannot domesticate.", "If a chart feels persuasive, then inspect the knowability behind it before trusting the precision.", "If the graph looks sharp, ask what darkness it left off-screen.")},
            {"context": "personal", "plan": tone("If someone gives you a date and a confident voice, then ask whether the domain earned that precision.", "If certainty sounds professional, then check whether fluency is outranking calibration.", "If the forecast feels important, make the signal stand without the ceremony.")},
        ],
        "twentyFourHourChallenge": tone("Pick one forecast you trust and strip away the tone, title, and formatting to see what signal remains.", "Review one confident prediction and write what the domain actually allows it to know.", "Take one polished forecast and shrink it to the precision the evidence earned."),
        "weeklyPractice": tone("For one week, whenever a forecast sounds crisp, ask what part of its authority comes from style rather than signal.", "Keep a short log of where you saw confidence outrank calibration in your environment.", "Spend one week forcing knowability to size every serious prediction."),
    },
    "reviewCards": [
        {"cardId": "ch10-rc01", "front": tone("What is the scandal of prediction?", "What offense does Taleb care about most here?", "Finish the line: the forecast is..."), "back": tone("Forecasts are delivered with more confidence than their signal deserves.", "Taleb is targeting overprecision under uncertainty.", "...louder than the evidence."), "difficulty": "easy"},
        {"cardId": "ch10-rc02", "front": tone("Why does prediction theater survive?", "What does the ecology reward?", "Why does crispness travel so far?"), "back": tone("Because institutions reward confident decisive speech.", "Fluency often outranks calibration.", "The stage prefers certainty style."), "difficulty": "easy"},
        {"cardId": "ch10-rc03", "front": tone("Why is overprecision more harmful than simple error?", "What damage happens before reality answers?", "Why does false crispness matter immediately?"), "back": tone("Because it reshapes decisions in the present.", "A strong-sounding forecast moves people before it is tested.", "The sentence gets power before the signal earns it."), "difficulty": "medium"},
        {"cardId": "ch10-rc04", "front": tone("What should govern prediction size?", "How do you discipline precision after this chapter?", "What must the sentence answer to?"), "back": tone("Domain knowability and real signal.", "Prediction should contract in opaque domains and expand only when visibility justifies it.", "The sentence must answer to knowability."), "difficulty": "medium"},
        {"cardId": "ch10-rc05", "front": tone("How does Chapter 10 lead into Chapter 11?", "What replaces the prophet next?", "What stronger posture follows forecast theater?"), "back": tone("Pragmatic searching and noticing under uncertainty.", "The scout outranks the prophet once false grandeur is cut down.", "After prediction theater comes adaptive contact."), "difficulty": "hard"},
    ],
    "keyTakeawayCard": tone("The scandal is not just failed forecasting but forecasting that speaks with more certainty than reality authorized.", "Confidence often rides on prestige, formality, and audience appetite more than on genuine signal.", "When the forecast is louder than the evidence, the sentence has borrowed rank it did not earn."),
}

payload = dict(CH10)
payload["book"] = BOOK
(ROOT / "structured" / "ch10.chapter.json").write_text(json.dumps(payload, indent=2) + "\n")
(ROOT / "validated" / "ch10.chapter.json").write_text(json.dumps(payload, indent=2) + "\n")
(ROOT / "quizzes" / "ch10.quiz.json").write_text(json.dumps(CH10["quiz"], indent=2) + "\n")
