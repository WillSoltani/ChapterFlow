#!/usr/bin/env python3
import hashlib
import json
import subprocess
from collections import Counter
from copy import deepcopy
from pathlib import Path

RUN_ROOT = Path("/Users/willsoltani/dev/chapterflow-siliconx/.chapterflow/runs/the-gift-of-fear/20260410-224733")
VALIDATED_DIR = RUN_ROOT / "validated"
STRUCTURED_DIR = RUN_ROOT / "structured"
RELEASE_PATH = RUN_ROOT / "release" / "the-gift-of-fear.modern.json"
CONTINUITY_PATH = RUN_ROOT / "continuity" / "continuity-state.json"
MANIFEST_PATH = RUN_ROOT / "manifests" / "run-manifest.json"
RUN_LOG_PATH = RUN_ROOT / "reports" / "run-log.md"

CATEGORIES = [
    "Personal Safety",
    "Psychology",
    "Violence Prevention",
    "Threat Assessment",
    "Boundaries",
]
TAGS = [
    "intuition",
    "safety",
    "boundaries",
    "violence prevention",
    "judgment",
]
BOOK_META = {
    "bookId": "the-gift-of-fear",
    "title": "The Gift of Fear",
    "author": "Gavin de Becker",
    "categories": CATEGORIES,
}
EDITION = {
    "name": "Back Bay Books English trade edition family",
    "translator": "",
    "publishedYear": 2021,
    "translationYear": None,
    "sourceText": ".chapterflow/runs/the-gift-of-fear/20260410-224733/source-freeze/book-source.md",
    "sourceProvenance": "Lawful web bundle only: bibliographic records, authorized preview metadata, official Gavin de Becker site material, and narrow secondary chapter notes. Paraphrase-first.",
}


def utc_now():
    return subprocess.check_output(["date", "-u", "+%Y-%m-%dT%H:%M:%SZ"], text=True).strip()


def canonical_sha(obj):
    payload = json.dumps(obj, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def load_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def save_json(path, payload):
    Path(path).write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def lines(*items):
    return "\n".join(items)


EXAMPLE_PATCHES = {
    "ch01": {
        "ch01-ex02-priya-pickup": {
            "scenario": {
                "gentle": lines(
                    'Priya: "No, thank you. My aunt is picking me up."',
                    'Mr. Larkin: "It is cold. You can wait in my car."',
                    'Priya: "No. I am staying by the school door."',
                    'Mr. Larkin: "I know the office staff. They will not mind."',
                    'Priya: "I am going back inside now."',
                    'Ms. Chen: "Priya, come stand with me by the office window."',
                ),
                "direct": lines(
                    'Priya: "No. I am waiting here."',
                    'Mr. Larkin: "Sit in my car until your ride gets here."',
                    'Priya: "No. I said I am staying here."',
                    'Mr. Larkin: "I am only trying to help you out."',
                    'Priya: "I am going to the office."',
                    'Ms. Chen: "Priya, come over here with staff."',
                ),
                "competitive": lines(
                    'Priya: "No. I am not getting in your car."',
                    'Mr. Larkin: "You are making this harder than it needs to be."',
                    'Priya: "My answer is still no."',
                    'Mr. Larkin: "I am just offering a warm seat."',
                    'Priya: "I am moving toward school staff now."',
                    'Ms. Chen: "Sir, step back from the pickup line."',
                ),
            },
            "whatToDo": {
                "gentle": "Repeat the refusal once, move toward school staff, and let location end the exchange.",
                "direct": "Stop arguing the refusal. Change position, go to adults with authority nearby, and close the interaction there.",
                "competitive": "Leave the curb, go to staff, and stop giving persistence any more room to work.",
            },
            "whyItMatters": {
                "gentle": "The move that changes the scene is not another explanation. It is getting Priya back beside people who control the space.",
                "direct": "The ignored no is enough information. The safest answer is spatial, not conversational.",
                "competitive": "She gets safer the moment the conversation loses access to her location.",
            },
        }
    },
    "ch02": {
        "ch02-ex02-serena-hallway": {
            "scenario": {
                "gentle": lines(
                    'Serena: "Good night."',
                    'Derek: "Which unit are you in again?"',
                    'Serena: "I am heading inside."',
                    'Derek: "Are you usually home this late?"',
                    'Serena: "I am done talking for tonight."',
                    'Derek: "I was only being friendly."',
                ),
                "direct": lines(
                    'Serena: "I am going in."',
                    'Derek: "What floor are you on?"',
                    'Serena: "I am not answering that."',
                    'Derek: "You do not have to be so tense."',
                    'Serena: "You kept stepping closer while asking for access details."',
                    'Derek: "I was just making conversation."',
                ),
                "competitive": lines(
                    'Serena: "That is close enough."',
                    'Derek: "Why are you acting like I am a problem?"',
                    'Serena: "Because you keep narrowing the questions and the distance."',
                    'Derek: "I only asked where you live."',
                    'Serena: "That is exactly why I am ending this."',
                    'Derek: "Fine."',
                ),
            },
            "whatToDo": {
                "gentle": "End the exchange, go inside, and lock the door without apologizing for the cue.",
                "direct": "Act on the named pattern: access questions plus closing distance. End contact and secure the boundary.",
                "competitive": "Once the cue has a shape, leave. Do not stay and defend why it bothered you.",
            },
            "whyItMatters": {
                "gentle": "Serena becomes clearer once the feeling is tied to specific behavior instead of treated like a personality flaw.",
                "direct": "Naming the cue keeps the response proportionate and removes the need to litigate her own discomfort.",
                "competitive": "The read stops wobbling once it has something real to point at.",
            },
        }
    },
    "ch03": {
        "ch03-ex02-marcus-meeting": {
            "scenario": {
                "gentle": lines(
                    'Marcus: "Use the client portal and we can review it there."',
                    'Evan: "Could you email me the raw file this one time?"',
                    'Marcus: "No. We have covered that in the last three meetings."',
                    'Evan: "This request is different because the deadline moved."',
                    'Marcus: "The wording changed. The access request did not."',
                    'Evan: "I hear you."',
                ),
                "direct": lines(
                    'Marcus: "The answer is still portal only."',
                    'Evan: "Then give me temporary direct access."',
                    'Marcus: "No. You asked that Monday, again Wednesday, and again now."',
                    'Evan: "I am just trying to solve the problem fast."',
                    'Marcus: "The recurrence is the problem I am reading."',
                    'Evan: "All right."',
                ),
                "competitive": lines(
                    'Marcus: "We are not reopening direct access."',
                    'Evan: "You keep acting like I am asking for something unusual."',
                    'Marcus: "I am acting like this is the fourth version of the same move."',
                    'Evan: "I changed the reason."',
                    'Marcus: "Not the target."',
                    'Evan: "Understood."',
                ),
            },
            "whatToDo": {
                "gentle": "Name the repetition out loud, restate the rule, and tighten the process around the recurring request.",
                "direct": "Respond to the pattern, not the latest wording. Document the recurrence and close the lane it keeps testing.",
                "competitive": "Call the move by its sequence and shut down the access path it keeps circling.",
            },
            "whyItMatters": {
                "gentle": "A repeated access push deserves a pattern-level response, not four separate courtesy reads.",
                "direct": "The fourth version of the same ask is not a fresh misunderstanding.",
                "competitive": "Once Marcus reads the recurrence, polite variation stops getting cover.",
            },
        }
    },
    "ch04": {
        "ch04-ex02-maya-reception": {
            "scenario": {
                "gentle": lines(
                    'Maya: "Please wait here while I print your badge."',
                    'Visitor: "If I step around the desk, I can save you time."',
                    'Maya: "No. Guests stay in front of the desk."',
                    'Visitor: "I know the floor already. It is no trouble."',
                    'Maya: "Then waiting here will be easy."',
                    'Visitor: "Fine."',
                ),
                "direct": lines(
                    'Maya: "Stay on your side of the desk."',
                    'Visitor: "I am only trying to help the line move."',
                    'Maya: "You have asked three times to bypass the process."',
                    'Visitor: "Because your process is slow."',
                    'Maya: "The speed issue does not change the boundary."',
                    'Visitor: "Go ahead then."',
                ),
                "competitive": lines(
                    'Maya: "Do not step past the desk."',
                    'Visitor: "You are making a simple badge into a power trip."',
                    'Maya: "You keep hiding access pressure under friendly wording."',
                    'Visitor: "I smiled when I asked."',
                    'Maya: "The smile is not what I am reading."',
                    'Visitor: "Print the badge."',
                ),
            },
            "whatToDo": {
                "gentle": "Stay with the process, step back from the desk edge, and stop rewarding the repeated ask with extra softness.",
                "direct": "Respond to the access pressure, not the friendly wording. Slow the process and hold the boundary.",
                "competitive": "Read the pressure under the charm and make the process answer for it.",
            },
            "whyItMatters": {
                "gentle": "Signals often arrive in ordinary social packaging. Maya gets safer by reading beneath the wrapper.",
                "direct": "The warning changes how she times the response even while the room still sounds polite.",
                "competitive": "The pressure matters most while it still has a smile on it.",
            },
        }
    },
    "ch05": {
        "ch05-ex02-serena-neighbor": {
            "scenario": {
                "gentle": lines(
                    'Serena: "I need to get inside."',
                    'Noah: "You are usually home around now, right?"',
                    'Serena: "That is not something I discuss."',
                    'Noah: "You do not have to be formal with me. We are neighbors."',
                    'Serena: "Step back from my door."',
                    'Noah: "I was only talking."',
                ),
                "direct": lines(
                    'Serena: "Move away from the doorway."',
                    'Noah: "Why are you acting like I am a stranger?"',
                    'Serena: "Because you keep pushing for access details."',
                    'Noah: "I see you here all the time."',
                    'Serena: "Familiarity does not make this acceptable."',
                    'Noah: "All right."',
                ),
                "competitive": lines(
                    'Serena: "Do not stand in front of my apartment."',
                    'Noah: "You know me. Relax."',
                    'Serena: "I know the pattern, not just your face."',
                    'Noah: "You are overreading this."',
                    'Serena: "No. You are testing whether a known label buys you more room."',
                    'Noah: "I am leaving."',
                ),
            },
            "whatToDo": {
                "gentle": "Name the behavior, shorten the exchange, and stop letting familiarity make the pressure seem smaller.",
                "direct": "Judge the interaction by the boundary testing, not by the fact that the neighbor is known by sight.",
                "competitive": "Strip the comfort out of the label and read the move straight.",
            },
            "whyItMatters": {
                "gentle": "Familiarity can hide the same warning cues a stranger would make easier to notice.",
                "direct": "The chapter cuts category comfort by forcing the read back onto what is happening in the doorway.",
                "competitive": "A known face is not a free pass once the pressure is clear.",
            },
        }
    },
    "ch06": {
        "ch06-ex02-marcus-manager": {
            "scenario": {
                "gentle": lines(
                    'Marcus: "All after-hours access needs written approval."',
                    'Contractor: "I only need five minutes in the server room."',
                    'Marcus: "You asked Friday and Tuesday too. The answer is still no."',
                    'Contractor: "Then tell me what changed."',
                    'Marcus: "The repeated request changed the response threshold."',
                    'Contractor: "Understood."',
                ),
                "direct": lines(
                    'Marcus: "No after-hours badge use without approval."',
                    'Contractor: "You are treating me like a threat."',
                    'Marcus: "I am treating recurrence plus escalation like process data."',
                    'Contractor: "You still do not know what I would do."',
                    'Marcus: "I do not need certainty to tighten access."',
                    'Contractor: "Fine."',
                ),
                "competitive": lines(
                    'Marcus: "The building is closed to you tonight."',
                    'Contractor: "This is an overreaction."',
                    'Marcus: "It is a response to the third after-hours push with a new excuse."',
                    'Contractor: "You keep hearing the wrong thing."',
                    'Marcus: "I am hearing the same request arrive in smarter packaging."',
                    'Contractor: "Then we are done."',
                ),
            },
            "whatToDo": {
                "gentle": "Move to stricter process and documented approval instead of waiting for a clearer event.",
                "direct": "Treat recurrence and escalation as enough to tighten access rules without claiming to know the ending.",
                "competitive": "Harden the process before the pattern learns more of the building than it should.",
            },
            "whyItMatters": {
                "gentle": "The chapter supports smaller protective moves before complete proof.",
                "direct": "Protective action can be justified by patterned evidence even while uncertainty remains.",
                "competitive": "The next move can get serious long before certainty does.",
            },
        }
    },
    "ch07": {
        "ch07-ex02-marcus-conference": {
            "scenario": {
                "gentle": lines(
                    'Marcus: "Your access request is denied."',
                    'Eli: "People are going to be sorry if this keeps happening."',
                    'Marcus: "What do you mean by that?"',
                    'Eli: "I mean you are pushing people too far."',
                    'Marcus: "That line goes in the report with the grievance and the access conflict."',
                    'Eli: "Write what you want."',
                ),
                "direct": lines(
                    'Marcus: "Your badge is suspended."',
                    'Eli: "You will regret treating me like this."',
                    'Marcus: "That statement changes the response."',
                    'Eli: "Maybe you should have listened sooner."',
                    'Marcus: "We are done talking. Security will escort you out."',
                    'Eli: "Do it."',
                ),
                "competitive": lines(
                    'Marcus: "You lost access."',
                    'Eli: "Then see what happens next."',
                    'Marcus: "Now the words are doing coercive work, not just carrying anger."',
                    'Eli: "Call it whatever makes you feel safe."',
                    'Marcus: "Context decides that, not your tone."',
                    'Eli: "Then act on it."',
                ),
            },
            "whatToDo": {
                "gentle": "Treat the threat language as data inside the access conflict and tighten process instead of dismissing it as heat alone.",
                "direct": "Read the words with the grievance, lost access, and rising pressure, then shift response through structure and documentation.",
                "competitive": "Stop arguing about whether the line sounded dramatic enough and read what it was trying to buy.",
            },
            "whyItMatters": {
                "gentle": "The chapter says function and context matter more than drama alone.",
                "direct": "Threatening language changes the read when it appears inside grievance and escalating pressure.",
                "competitive": "The quote gets heavier once the room explains the job it was trying to do.",
            },
        }
    },
    "ch08": {
        "ch08-ex02-marcus-office": {
            "scenario": {
                "gentle": lines(
                    'Marcus: "I already said I am not interested."',
                    'Leah: "I thought I would ask again now that work is calmer."',
                    'Marcus: "My answer did not depend on the calendar."',
                    'Leah: "Then why are you still replying?"',
                    'Marcus: "Because we work together, not because the answer changed."',
                    'Leah: "All right."',
                ),
                "direct": lines(
                    'Marcus: "Stop waiting in the lobby for me."',
                    'Leah: "I am only trying one more time."',
                    'Marcus: "It stopped being one more time after the refusal was clear."',
                    'Leah: "You are making this harsher than it is."',
                    'Marcus: "Repeated approach after no changes what it is."',
                    'Leah: "Understood."',
                ),
                "competitive": lines(
                    'Marcus: "No. Again."',
                    'Leah: "I figured persistence might matter."',
                    'Marcus: "What matters is that you keep treating the refusal like a draft."',
                    'Leah: "I am just giving it another chance."',
                    'Marcus: "You are giving no another test."',
                    'Leah: "Message received."',
                ),
            },
            "whatToDo": {
                "gentle": "Treat the repeated approach as a boundary pattern and stop rewarding it with more discussion.",
                "direct": "Move from explanation to clearer refusal and changed access instead of handling each return like a fresh question.",
                "competitive": "Stop letting every repeat masquerade as a new conversation.",
            },
            "whyItMatters": {
                "gentle": "The chapter says refusal changes the meaning of repetition.",
                "direct": "Repeated approach after no reveals how the person handles boundaries, not how sincere the person feels.",
                "competitive": "The pattern tells you more than the excuse attached to it does.",
            },
        }
    },
    "ch09": {
        "ch09-ex02-elena-hr": {
            "scenario": {
                "gentle": lines(
                    'Elena: "He left HR a complaint at 6:10 and waited by reception at 6:30."',
                    'Rina: "I only saw the voicemail, so I logged it as an after-hours message."',
                    'Noah: "Security logged the waiting, but we never tied it to HR."',
                    'Elena: "That is the problem. It is one sequence spread across three desks."',
                    'Rina: "Then we need one owner for the whole pattern."',
                    'Noah: "Agreed."',
                ),
                "direct": lines(
                    'Elena: "The data is not missing. It is fragmented."',
                    'Rina: "HR has the complaint email."',
                    'Noah: "Security has the lobby footage."',
                    'Elena: "Reception has the repeated waiting."',
                    'Rina: "So the process hid the sequence."',
                    'Noah: "Let us rebuild it in one timeline."',
                ),
                "competitive": lines(
                    'Elena: "We keep routing the warning instead of reading it."',
                    'Rina: "Each desk handled its own piece."',
                    'Noah: "That made every piece look routine."',
                    'Elena: "Routine is the disguise once the pattern gets split."',
                    'Rina: "Then the next move is joint review, not more routing."',
                    'Noah: "Done."',
                ),
            },
            "whatToDo": {
                "gentle": "Connect the repeated signals before the workplace waits for one bigger event.",
                "direct": "Use process to assemble the sequence instead of letting separate departments keep the pattern invisible.",
                "competitive": "Make the system read the room instead of calming itself with routing.",
            },
            "whyItMatters": {
                "gentle": "The chapter says distributed responsibility can delay a harder read.",
                "direct": "Repeated signals deserve earlier institutional judgment when they keep aligning across channels.",
                "competitive": "The warning gets cover when every desk keeps only its own fragment.",
            },
        },
        "ch09-ex04-jonah-dilemma": {
            "title": "Jonah Decides Not to Wait for One Bigger Event at the Condo Office",
            "category": "personal",
            "contexts": [
                "condo office",
                "repeated fee complaint",
                "presence pattern",
            ],
            "scenario": {
                "gentle": "Jonah keeps telling himself he needs one clearer incident, even though the same condo owner has repeated fee complaints, repeated visits to the front desk, and a sharper tone every week.",
                "direct": "The dilemma is whether the building needs a spectacle or whether the sequence already justifies a harder read.",
                "competitive": "Jonah is waiting for a headline while the lobby keeps collecting smaller ones.",
            },
            "whatToDo": {
                "gentle": "Treat the repeated grievance and repeated presence together and tighten the response before one dramatic scene arrives.",
                "direct": "Use the existing sequence of grievance, repeated visits, and escalation to justify a firmer community response now.",
                "competitive": "Stop demanding a bigger scene when the pattern has already voted enough times.",
            },
            "whyItMatters": {
                "gentle": "Repeated signals deserve weight before one decisive incident arrives.",
                "direct": "Waiting for spectacle often just means letting routine language hide escalation longer.",
                "competitive": "The pattern can already be loud before it turns into one undeniable episode.",
            },
        },
    },
    "ch10": {
        "ch10-ex02-serena-friend": {
            "title": "Serena Hears a Coworker Soften the Pattern",
            "category": "work",
            "contexts": [
                "break room conversation",
                "location questions",
                "relationship history",
            ],
            "scenario": {
                "gentle": lines(
                    'Serena: "After every argument he checks where I am and who I am with."',
                    'Jules: "Maybe he is just scared of losing the relationship."',
                    'Serena: "He does it again after every apology."',
                    'Jules: "I know. I just keep thinking about how stressed he sounds."',
                    'Serena: "The stress story is not changing the control."',
                    'Jules: "That is fair."',
                ),
                "direct": lines(
                    'Serena: "He tracks my location after conflict and waits outside."',
                    'Jules: "But the relationship has been rough for both of you."',
                    'Serena: "That history is not the same thing as permission."',
                    'Jules: "I was trying not to overcall it."',
                    'Serena: "Then start with the monitoring, not the romance story."',
                    'Jules: "Understood."',
                ),
                "competitive": lines(
                    'Serena: "He apologizes and then starts checking where I am again."',
                    'Jules: "I keep hearing the heartbreak before the control."',
                    'Serena: "That is the distortion."',
                    'Jules: "You mean I am reading the story first?"',
                    'Serena: "Yes. The pattern keeps returning whether the story sounds humane or not."',
                    'Jules: "Then I need to read it differently."',
                ),
            },
            "whatToDo": {
                "gentle": "Bring the conversation back to the repeated control and what keeps returning after repair.",
                "direct": "Shift from story-first comfort to behavior-first reading by naming recurrence, monitoring, and escalation directly.",
                "competitive": "Make the repeated control do the explaining before the relationship story takes over the room.",
            },
            "whyItMatters": {
                "gentle": "The chapter says outsiders can still underread danger when closeness supplies a softer story.",
                "direct": "Sympathy fails when it privileges narrative complexity over recurring control.",
                "competitive": "A humane explanation can still be a weak read if it keeps shrinking the pattern.",
            },
        }
    },
    "ch11": {
        "ch11-ex01-serena-dialogue": {
            "category": "work",
            "contexts": [
                "after-work messages",
                "gentle rejection",
                "continued hope claim",
            ],
            "scenario": {
                "gentle": lines(
                    'Serena: "I do not want to keep dating. I am ending this."',
                    'Nate: "I can wait. I know work has been a lot for you."',
                    'Serena: "This is not a pause."',
                    'Nate: "I am only asking for dinner next week."',
                    'Serena: "Stop contacting me about dating."',
                    'Nate: "I am trying to be patient."',
                ),
                "direct": lines(
                    'Serena: "No more dates. That is final."',
                    'Nate: "You do not have to decide tonight."',
                    'Serena: "I already decided."',
                    'Nate: "Then let me prove I can do this right."',
                    'Serena: "You are rewriting a refusal into more access."',
                    'Nate: "I am not giving up that easily."',
                ),
                "competitive": lines(
                    'Serena: "I said no."',
                    'Nate: "I heard maybe later."',
                    'Serena: "That is not what I said."',
                    'Nate: "I am calling it patience."',
                    'Serena: "Call it what you want. It is continued pursuit after refusal."',
                    'Nate: "You are being harsh."',
                ),
            },
            "whatToDo": {
                "gentle": "Read the repeated contact as the key signal instead of debating whether the original wording sounded gentle enough.",
                "direct": "Name the messages as continued pursuit after refusal and respond from that pattern.",
                "competitive": "Stop relitigating the tone of the letdown. The sequence is the issue now.",
            },
            "whyItMatters": {
                "gentle": "Repeated contact after no matters more than the romance story wrapped around it.",
                "direct": "Soft wording can be exploited, but the clearest evidence is still the sequence of renewed contact after refusal.",
                "competitive": "The problem is not whether the no sounded kind. It is that he keeps reopening it.",
            },
        },
        "ch11-ex06-priya-postmortem": {
            "title": "Priya Sees How Managers Waited Too Long for an Explicit Threat",
            "category": "work",
            "contexts": [
                "manager review",
                "continued contact",
                "late threat threshold",
            ],
            "scenario": {
                "gentle": "In a workplace review, Priya notices that managers treated the repeated messages, repeated lobby waiting, and repeated attempts to restart contact as awkward romance until everyone finally reacted only after the language turned openly alarming.",
                "direct": "The postmortem shows that the threshold for concern was set too late because the team waited for an explicit threat instead of reading the repeated pursuit.",
                "competitive": "They kept downgrading the chase until the language finally arrived loud enough to scare the room.",
            },
            "whatToDo": {
                "gentle": "Rebuild the read around the earlier persistence pattern instead of around the moment the tone finally changed.",
                "direct": "Treat repeated contact and repeated access attempts as meaningful evidence before explicit threat language appears.",
                "competitive": "Count the returns early instead of waiting for one sentence to do all the proof work.",
            },
            "whyItMatters": {
                "gentle": "Waiting for a clear threat can hide a serious boundary problem that was already visible in the repeated contact.",
                "direct": "A stronger read asks what kept returning long before the language became impossible to ignore.",
                "competitive": "The team did not need a bigger line. It needed a cleaner read of the pursuit already underway.",
            },
        },
    },
    "ch12": {
        "ch12-ex02-omar-dilemma": {
            "category": "work",
        },
        "ch12-ex03-talia-beforeafter": {
            "category": "work",
        },
        "ch12-ex06-serena-dialogue": {
            "scenario": {
                "gentle": lines(
                    'Serena: "He drew the same attack scene again and asked where the spare keys are kept."',
                    'Aunt May: "He is upset, not dangerous."',
                    'Serena: "He also followed Priya to the corner twice this week."',
                    'Uncle Rob: "If we call it serious, we will only shame him."',
                    'Serena: "Naming the pattern is not prophecy. It is how we stop pretending these are separate incidents."',
                    'Aunt May: "Then we need to talk about access and supervision now."',
                ),
                "direct": lines(
                    'Serena: "The drawings, the access questions, and the repeated following are lining up."',
                    'Uncle Rob: "You are making every warning sign sound final."',
                    'Serena: "No. I am saying repeated signals deserve a different read than one bad day."',
                    'Aunt May: "I kept hoping it was just a phase."',
                    'Serena: "Hope is not a response plan."',
                    'Uncle Rob: "Then let us build one."',
                ),
                "competitive": lines(
                    'Serena: "The room keeps softening a pattern that keeps returning."',
                    'Aunt May: "Because we do not want to label him forever."',
                    'Serena: "Reading recurrence is not sentencing the future."',
                    'Uncle Rob: "So what are you asking us to do?"',
                    'Serena: "Treat fixation, access, and intensifying behavior as one problem instead of six excuses."',
                    'Aunt May: "That is clearer."',
                ),
            },
            "whatToDo": {
                "gentle": "Bring the conversation back to recurrence, fixation, available access, and what has intensified over time.",
                "direct": "Separate compassion from interpretation by naming the repeated signals without turning the child into a prophecy.",
                "competitive": "Keep the room on the behavior, the access, and the escalation instead of letting reassurance reset the read.",
            },
            "whyItMatters": {
                "gentle": "Adults can collaborate in denial unless someone recenters the read on the pattern itself.",
                "direct": "Compassion is still necessary, but it cannot replace a behavior-first account of what keeps recurring.",
                "competitive": "Comfort spreads fast in a family conversation. Evidence has to be spoken just as clearly.",
            },
        }
    },
    "ch13": {
        "ch13-ex02-priya-dialogue": {
            "scenario": {
                "gentle": lines(
                    'Priya: "He was at the poster wall again during lunch, filming the office door."',
                    'Luis: "He is just performing for attention."',
                    'Priya: "He also waited by the side entrance yesterday."',
                    'Luis: "If he were serious, he would not be this loud."',
                    'Priya: "Loud does not cancel the repeated approach."',
                    'Luis: "I had not put those together."',
                ),
                "direct": lines(
                    'Priya: "The grievance speech is traveling with repeated loitering and another access try."',
                    'Luis: "I thought the performance style made it less serious."',
                    'Priya: "That style may be part of how the sequence keeps moving."',
                    'Luis: "So the theater is not a contradiction?"',
                    'Priya: "Not if it keeps accompanying proximity and return."',
                    'Luis: "That changes the read."',
                ),
                "competitive": lines(
                    'Priya: "The room keeps calling it theater while the pattern keeps rehearsing access."',
                    'Luis: "Because the loudness makes it look unserious."',
                    'Priya: "Unserious style is still style. The recurrence is the mechanism."',
                    'Luis: "So what should we count?"',
                    'Priya: "The filming, the loitering, and the repeated effort to get closer."',
                    'Luis: "That is harder to dismiss."',
                ),
            },
            "whatToDo": {
                "gentle": "Bring the discussion back to repetition, proximity, and what keeps returning rather than to whether the style feels embarrassing.",
                "direct": "Shift from spectacle talk to behavior-first reading by naming recurring approach behavior and grievance signaling together.",
                "competitive": "Keep the room on the repeated access behavior instead of letting the performance style decide the meaning.",
            },
            "whyItMatters": {
                "gentle": "Performance style can make observers underread repeated approach behavior.",
                "direct": "A louder style does not cancel what repeated loitering, contact pressure, or grievance are doing inside the sequence.",
                "competitive": "The show can distract people from the access pattern it is helping carry.",
            },
        }
        ,
        "ch13-ex06-ben-decision": {
            "category": "personal",
        }
    },
    "ch14": {
        "ch14-ex06-maya-dialogue": {
            "scenario": {
                "gentle": lines(
                    'Maya: "We do not know exactly what will happen, but the bridge closure means we need another route."',
                    'Tom: "If we start planning now, we are panicking."',
                    'Maya: "Packing chargers and agreeing on a meeting point is not panic."',
                    'Tom: "Then why do anything if the warning may be nothing?"',
                    'Maya: "Because the downside is high enough to justify simple preparation."',
                    'Tom: "That sounds more practical."',
                ),
                "direct": lines(
                    'Maya: "The evidence is thin, not irrelevant."',
                    'Tom: "I do not want this house turning into fear theater."',
                    'Maya: "A backup route and a check-in plan are design choices, not theater."',
                    'Tom: "So you are not claiming certainty?"',
                    'Maya: "No. I am matching the plan to the consequence."',
                    'Tom: "That is different."',
                ),
                "competitive": lines(
                    'Maya: "The room keeps pretending the options are panic or drift."',
                    'Tom: "Those do feel like the two live options."',
                    'Maya: "No. The third option is sober preparation."',
                    'Tom: "Even when the forecast is weak?"',
                    'Maya: "Especially then, if the downside is severe."',
                    'Tom: "Fine. Let us plan."',
                ),
            },
            "whatToDo": {
                "gentle": "Introduce practical steps that fit the downside without pretending the evidence is clean.",
                "direct": "Separate measured preparation from emotional escalation by naming margins, backups, and response paths that actually reduce risk.",
                "competitive": "Give the room a plan so uncertainty stops getting mistaken for a reason to do nothing.",
            },
            "whyItMatters": {
                "gentle": "Thin signal changes the kind of judgment required; it does not eliminate judgment.",
                "direct": "Measured planning can live between overconfidence and fear performance when consequence is high and certainty is weak.",
                "competitive": "The stronger move is sober design, not louder emotion or empty calm.",
            },
        }
    },
    "ch15": {
        "ch15-ex01-maya-dialogue": {
            "category": "work",
            "contexts": [
                "office elevator",
                "body tension",
                "present cue",
            ],
            "scenario": {
                "gentle": lines(
                    'Maya: "I am getting off here."',
                    'Darren: "What floor do you work on again?"',
                    'Maya: "I am not answering that."',
                    'Darren: "You are acting like I did something wrong."',
                    'Maya: "You stepped closer after I moved away. I am leaving now."',
                    'Security Officer: "Ma’am, come this way."',
                ),
                "direct": lines(
                    'Maya: "Stop crowding the door."',
                    'Darren: "I only asked a question."',
                    'Maya: "And then you closed distance after I ended the conversation."',
                    'Darren: "You are turning this into anxiety."',
                    'Maya: "No. I am naming the cue my body is reacting to."',
                    'Security Officer: "I have her from here."',
                ),
                "competitive": lines(
                    'Maya: "I am getting off now."',
                    'Darren: "You are really going to do this over nothing?"',
                    'Maya: "It is not nothing. It is the blocked angle, the extra step, and the access questions."',
                    'Darren: "That sounds dramatic."',
                    'Maya: "It sounds specific. That is why I am acting on it."',
                    'Security Officer: "Sir, hold the elevator."',
                ),
            },
            "whatToDo": {
                "gentle": "Ask what present cue the fear is attached to instead of collapsing it into generic anxiety.",
                "direct": "Separate evidence-bound alarm from vague worry by naming the actual behavior or pattern the fear is tracking.",
                "competitive": "Let the feeling point to the cue, then act on the cue instead of arguing with the feeling.",
            },
            "whyItMatters": {
                "gentle": "Fear becomes useful when it stays tied to something real in the environment.",
                "direct": "Useful fear supports judgment because it remains anchored to present signal instead of drifting into imagined scenes.",
                "competitive": "The alarm helps when it can point to the room instead of apologizing for itself.",
            },
        }
    },
}


def patch_ch12_content(chapter):
    chapter["contentVariants"]["medium"]["keyTakeaways"][3]["moreDetails"]["competitive"] = (
        "If the same warning keeps returning, the room no longer gets to treat each round like a brand-new exception."
    )
    chapter["contentVariants"]["hard"]["keyTakeaways"][3]["point"]["competitive"] = (
        "A phase explanation loses force when the warning keeps returning in the same shape."
    )


def patch_ch14_content(chapter):
    chapter["contentVariants"]["hard"]["keyTakeaways"][0]["moreDetails"]["direct"] = (
        "Severe downside can keep planning pressure on the team even when the forecast stays thin."
    )
    chapter["contentVariants"]["medium"]["keyTakeaways"][2]["moreDetails"]["competitive"] = (
        "False confidence can arrive loud or quiet and still leave the room underdesigned."
    )


def strip_chapter_book(chapter):
    return {key: value for key, value in chapter.items() if key != "book"}


def chapter_range_text(number):
    return f"Chapter {number} review package only"


def normalized_wrapped_book(chapter_range):
    return {
        "bookId": BOOK_META["bookId"],
        "title": BOOK_META["title"],
        "author": BOOK_META["author"],
        "categories": CATEGORIES,
        "tags": TAGS,
        "edition": deepcopy(EDITION),
        "variantFamily": "EMH",
        "chapterRange": chapter_range,
    }


def update_reading_metrics(code, chapter):
    metrics_path = RUN_ROOT / "sidecars" / f"{code}.reading-metrics.json"
    if not metrics_path.exists():
        return
    metrics = load_json(metrics_path)
    counts = Counter(example.get("category") for example in chapter.get("examples", []))
    metrics["examples"]["categoryDistribution"] = {
        key: counts[key]
        for key in ("personal", "school", "work")
        if counts.get(key)
    }
    metrics["computedAt"] = "2026-04-11"
    save_json(metrics_path, metrics)


def main():
    timestamp = utc_now()
    chapter_payloads = {}

    for chapter_path in sorted(STRUCTURED_DIR.glob("ch*.chapter.json")):
        chapter = load_json(chapter_path)
        code = chapter_path.stem.replace(".chapter", "")
        chapter["book"] = {
            "bookId": BOOK_META["bookId"],
            "title": BOOK_META["title"],
            "author": BOOK_META["author"],
            "categories": CATEGORIES,
        }

        patches = EXAMPLE_PATCHES.get(code, {})
        if patches:
            for example in chapter.get("examples", []):
                patch = patches.get(example.get("exampleId"))
                if not patch:
                    continue
                for key, value in patch.items():
                    example[key] = deepcopy(value)

        if code == "ch12":
            patch_ch12_content(chapter)
        if code == "ch14":
            patch_ch14_content(chapter)

        save_json(chapter_path, chapter)

    for chapter_path in sorted(VALIDATED_DIR.glob("ch*.chapter.json")):
        chapter = load_json(chapter_path)
        code = chapter_path.stem.replace(".chapter", "")
        chapter["book"] = {
            "bookId": BOOK_META["bookId"],
            "title": BOOK_META["title"],
            "author": BOOK_META["author"],
            "categories": CATEGORIES,
        }

        patches = EXAMPLE_PATCHES.get(code, {})
        if patches:
            for example in chapter.get("examples", []):
                patch = patches.get(example.get("exampleId"))
                if not patch:
                    continue
                for key, value in patch.items():
                    example[key] = deepcopy(value)

        if code == "ch12":
            patch_ch12_content(chapter)
        if code == "ch14":
            patch_ch14_content(chapter)

        save_json(chapter_path, chapter)
        chapter_payloads[code] = chapter
        update_reading_metrics(code, chapter)

    manifest = load_json(MANIFEST_PATH)
    manifest["bookRequest"]["title"] = BOOK_META["title"]
    manifest["bookRequest"]["author"] = BOOK_META["author"]
    manifest["book"] = {
        "bookId": BOOK_META["bookId"],
        "title": BOOK_META["title"],
        "author": BOOK_META["author"],
        "categories": CATEGORIES,
        "tags": TAGS,
        "edition": deepcopy(EDITION),
        "variantFamily": "EMH",
        "chapterRange": "Chapters 1-15 full release",
    }
    save_json(MANIFEST_PATH, manifest)

    for review_path in sorted(VALIDATED_DIR.glob("ch*.review-package.json")):
        review = load_json(review_path)
        code = review_path.stem.replace(".review-package", "")
        chapter = chapter_payloads[code]
        review["createdAt"] = timestamp
        review["book"] = normalized_wrapped_book(chapter_range_text(chapter["number"]))
        review["chapters"] = [strip_chapter_book(chapter)]
        save_json(review_path, review)

    release = load_json(RELEASE_PATH)
    release["createdAt"] = timestamp
    release["book"] = normalized_wrapped_book("Chapters 1-15 full release")
    release["chapters"] = [strip_chapter_book(chapter_payloads[code]) for code in sorted(chapter_payloads.keys())]
    save_json(RELEASE_PATH, release)

    continuity = load_json(CONTINUITY_PATH)
    continuity["approvedChapterHashes"] = {
        code: canonical_sha(chapter_payloads[code]) for code in sorted(chapter_payloads.keys())
    }
    save_json(CONTINUITY_PATH, continuity)

    with RUN_LOG_PATH.open("a", encoding="utf-8") as handle:
        handle.write(
            f"- {timestamp} Gift of Fear package repair pass completed. "
            "Metadata normalized, review/release wrappers deduplicated, dialogue examples rewritten as actual exchanges, "
            "continuity hashes resealed from validated chapters.\n"
        )


if __name__ == "__main__":
    main()
