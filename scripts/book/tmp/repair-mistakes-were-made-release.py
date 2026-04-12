#!/usr/bin/env python3
import copy
import hashlib
import json
import subprocess
from pathlib import Path


ROOT = Path("/Users/willsoltani/dev/chapterflow-siliconx")
RUN_ROOT = ROOT / ".chapterflow/runs/mistakes-were-made-but-not-by-me/20260410-224452"
VALIDATED_DIR = RUN_ROOT / "validated"
STRUCTURED_DIR = RUN_ROOT / "structured"
RELEASE_PATH = RUN_ROOT / "release" / "mistakes-were-made-but-not-by-me.modern.json"
BOOK_PACKAGE_PATH = ROOT / "book-packages" / "mistakes-were-made-but-not-by-me.modern.json"
CONTINUITY_PATH = RUN_ROOT / "continuity" / "continuity-state.json"

BOOK_ID = "mistakes-were-made-but-not-by-me"
RUN_ID = "20260410-224452"
BOOK_TITLE = "Mistakes Were Made (but Not by Me)"
BOOK_AUTHOR = "Carol Tavris; Elliot Aronson"
BOOK_CATEGORIES = [
    "Psychology",
    "Cognitive Science",
    "Decision Making",
    "Conflict",
    "Relationships",
]
BOOK_TAGS = [
    "self-justification",
    "cognitive dissonance",
    "motivated reasoning",
    "memory distortion",
    "prejudice",
    "conflict",
    "accountability",
    "relationships",
]
BOOK_EDITION = {
    "name": "Mistakes Were Made (but Not by Me) Third Edition: Why We Justify Foolish Beliefs, Bad Decisions, and Hurtful Acts",
    "translator": "",
    "publishedYear": 2020,
    "translationYear": None,
    "sourceText": ".chapterflow/runs/mistakes-were-made-but-not-by-me/20260410-224452/source-freeze/book-source.md",
    "sourceProvenance": "Frozen from google-books-third-edition-preview, better-world-books-publisher-toc, open-library-third-edition-record.",
}


def utc_now():
    return subprocess.check_output(["date", "-u", "+%Y-%m-%dT%H:%M:%SZ"], text=True).strip()


def load_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def load_head_json(relpath):
    payload = subprocess.check_output(["git", "show", f"HEAD:{relpath}"], cwd=ROOT, text=True)
    return json.loads(payload)


def save_json(path, payload):
    Path(path).write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def sha_obj(obj):
    payload = json.dumps(obj, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def words(text):
    return len(str(text).strip().split())


def lines(*parts):
    return "\n".join(parts)


def path_get(obj, path):
    cur = obj
    for key in path:
        cur = cur[key]
    return cur


def path_set(obj, path, value):
    cur = obj
    for key in path[:-1]:
        cur = cur[key]
    cur[path[-1]] = value


def append_text(chapter, depth, tone, extra):
    path = ["contentVariants", depth, "chapterBreakdown", tone]
    existing = path_get(chapter, path)
    marker = extra.strip()
    if marker in existing:
        first = existing.find(marker)
        kept = existing[: first + len(marker)]
        tail = existing[first + len(marker):].replace(marker, "")
        existing = (kept + tail).replace("\n\n\n", "\n\n").replace("  ", " ").strip()
    sep = "\n\n" if depth in {"medium", "hard"} else " "
    if marker not in existing:
        existing = existing.rstrip() + sep + marker
    path_set(chapter, path, existing)


def normalize_quiz(chapter):
    level_map = {
        "easy": ["remember", "understand", "understand"],
        "medium": ["apply", "analyze", "analyze", "apply", "evaluate"],
        "hard": ["evaluate", "create"],
    }
    seen = {"easy": 0, "medium": 0, "hard": 0}
    for q in chapter["quiz"]["questions"]:
        depth = q["depthLevel"]
        idx = seen[depth]
        q["bloomsLevel"] = level_map[depth][idx]
        seen[depth] += 1


DIALOGUES = {
    1: {
        "gentle": lines(
            'Lena: "I was only being honest."',
            'Mara: "You called me embarrassing in front of everyone."',
            'Lena: "I thought blunt was better than fake."',
            'Mara: "Blunt is not the issue. You went for the soft spot and stayed there."',
            'Lena: "I can hear that now."',
            'Mara: "Then stop defending the motive long enough to name the hit."',
        ),
        "direct": lines(
            'Lena: "I was being honest."',
            'Mara: "No. You were cutting, and you want the word honest to clean it up."',
            'Lena: "I did not mean it that way."',
            'Mara: "Impact came first. Your explanation can wait."',
            'Lena: "So I need to own the remark before I explain myself."',
            'Mara: "Yes. Otherwise you are apologizing to your own conscience, not to me."',
        ),
        "competitive": lines(
            'Lena: "I was only telling the truth."',
            'Mara: "Truth is not a shield for taking a swing."',
            'Lena: "You are making this bigger than it was."',
            'Mara: "You are making it smaller so you do not have to see what you did."',
            'Lena: "All right. I wanted the line to feel brave."',
            'Mara: "Then start with the damage, not the costume."',
        ),
    },
    2: {
        "gentle": lines(
            'Malik: "I know it is bad, but this is not the right month to stop."',
            'Sana: "You said that last month too."',
            'Malik: "Work is a mess right now."',
            'Sana: "So the stress is real, but the plan keeps moving so the habit can stay."',
            'Malik: "That sounds harsher when you say it that way."',
            'Sana: "Because the delay story is doing more work than the quit plan."',
        ),
        "direct": lines(
            'Malik: "I will quit when this project settles down."',
            'Sana: "Then the project has become the latest alibi."',
            'Malik: "I am not denying the risk."',
            'Sana: "No. You are relocating change into a future that never arrives."',
            'Malik: "So I am reducing the tension without changing the habit."',
            'Sana: "Exactly. The story is absorbing the pressure for you."',
        ),
        "competitive": lines(
            'Malik: "Now is just not the month."',
            'Sana: "That sentence keeps buying cigarettes more time."',
            'Malik: "You know work is brutal right now."',
            'Sana: "Yes, and you keep turning that fact into permission."',
            'Malik: "So the contradiction stays and the excuse gets upgraded."',
            'Sana: "That is the engine. The habit survives because the deadline story does."',
        ),
    },
    3: {
        "gentle": lines(
            'Nadia: "Look at these texts. She was sharp the whole time."',
            'Iris: "You highlighted every harsh line and skipped your own two barbed replies."',
            'Nadia: "Mine came after she started it."',
            'Iris: "Maybe. But the thread feels cleaner because you are reading it through your hurt first."',
            'Nadia: "So I am treating the worst moments as the whole exchange."',
            'Iris: "Yes. The phone is helping you keep one moral version of the fight."',
        ),
        "direct": lines(
            'Nadia: "The thread proves she was the problem."',
            'Iris: "It proves she sent ugly messages. It does not prove you are reading the whole conflict evenly."',
            'Nadia: "You think I am missing my own part."',
            'Iris: "I think you are treating the sharpest lines as if they were the entire case."',
            'Nadia: "That is exactly how it felt."',
            'Iris: "Feeling the injury clearly is not the same as reading the exchange neutrally."',
        ),
        "competitive": lines(
            'Nadia: "This thread is all the evidence I need."',
            'Iris: "Only if you keep using it like a prosecutor."',
            'Nadia: "She handed me the ammunition."',
            'Iris: "And you are only loading the lines that keep you innocent."',
            'Nadia: "So the exhibit is real and the reading is still slanted."',
            'Iris: "Exactly. The blind spot is not fake. It is selective."',
        ),
    },
    4: {
        "gentle": lines(
            'Omar: "I apologized right away."',
            'Nia: "You said, \'Fine, sorry,\' while walking out of the room."',
            'Omar: "I remember trying to lower the temperature."',
            'Nia: "I remember you sounding like I was ridiculous for being hurt."',
            'Omar: "So we are carrying different moral versions of the same minute."',
            'Nia: "Yes, and both of us trust our own archive first."',
        ),
        "direct": lines(
            'Omar: "I did apologize."',
            'Nia: "You gave the words. I do not remember the ownership."',
            'Omar: "I remember being calmer than you are describing."',
            'Nia: "I remember hearing contempt, not repair."',
            'Omar: "Then memory is defending each of us differently."',
            'Nia: "That is why this feels factual and moral at the same time."',
        ),
        "competitive": lines(
            'Omar: "I said sorry. That should count."',
            'Nia: "It would count more if your memory were not polishing it on the way back."',
            'Omar: "You are acting like I invented the whole thing."',
            'Nia: "No. I am saying your version protects you better than mine protects me."',
            'Omar: "So the fight is about the moment and the archive."',
            'Nia: "Exactly. One apology, two historians."',
        ),
    },
    5: {
        "gentle": lines(
            'Aunt Rosa: "You can tell he is grieving. That is why he needs stricter limits right now."',
            'Nadia: "Maybe, but how do we know the limit is helping rather than just sounding decisive?"',
            'Aunt Rosa: "I have good instincts about children."',
            'Nadia: "Warmth matters. I am asking what would count as evidence that the read is wrong."',
            'Aunt Rosa: "So care is not the same thing as a tested method."',
            'Nadia: "Right. The motive can be good while the interpretation still needs checking."',
        ),
        "direct": lines(
            'Aunt Rosa: "I know exactly what this child is going through."',
            'Nadia: "You may understand part of it, but certainty is not proof."',
            'Aunt Rosa: "I am only trying to help."',
            'Nadia: "I know. That is why the method matters. Helping can still overread the evidence."',
            'Aunt Rosa: "Then what should test the conclusion?"',
            'Nadia: "Something outside the feeling that the conclusion sounds compassionate."',
        ),
        "competitive": lines(
            'Aunt Rosa: "A loving adult can see what the child will not say."',
            'Nadia: "Sometimes. And sometimes love gives a guess more authority than it earned."',
            'Aunt Rosa: "You think I am making this up?"',
            'Nadia: "No. I think warm certainty can still run a closed loop."',
            'Aunt Rosa: "So the advice needs a method, not just heart."',
            'Nadia: "Exactly. Caring motive is not a free pass for weak evidence."',
        ),
    },
    6: {
        "gentle": lines(
            'Iris: "Every follow-up assumes he already did it."',
            'Jonah: "The questions are just trying to pin down details."',
            'Iris: "Listen to the wording. It keeps asking why he did it, not whether he did it."',
            'Jonah: "So the answer space is already narrowed."',
            'Iris: "Yes. The room is teaching the story before the evidence is finished."',
            'Jonah: "That makes the confession risk much easier to see."',
        ),
        "direct": lines(
            'Iris: "These questions already assume guilt."',
            'Jonah: "They sound firm, not necessarily biased."',
            'Iris: "Firm would test possibilities. This sequence keeps treating denial like a delay tactic."',
            'Jonah: "So the procedure is steering toward one answer."',
            'Iris: "Exactly. The process can contaminate what later sounds decisive."',
            'Jonah: "Which is why the confession cannot cleanly rescue the method."',
        ),
        "competitive": lines(
            'Iris: "The script is rigged."',
            'Jonah: "That is a strong claim."',
            'Iris: "Then read the verbs. Every question is pushing him toward the version they already chose."',
            'Jonah: "So the room manufactures certainty before the record deserves it."',
            'Iris: "Yes. And once the answer finally comes, they will call the pressure proof."',
            'Jonah: "That is exactly how the legal loop hardens."',
        ),
    },
    7: {
        "gentle": lines(
            'Omar: "You always start with the sharp tone."',
            'Nia: "And you always say that after I have asked three times for help."',
            'Omar: "I hear pressure. You hear abandonment."',
            'Nia: "Because we keep giving ourselves context and each other verdicts."',
            'Omar: "So the dishes are carrying a much older argument."',
            'Nia: "Yes. The sink is full, and so is the archive."',
        ),
        "direct": lines(
            'Omar: "You came in hot again."',
            'Nia: "I came in tired. You turned the tiredness into my character."',
            'Omar: "And I turn my own tone into stress."',
            'Nia: "Exactly. That is why the same scene keeps acquitting each of us."',
            'Omar: "So we are arguing the dishes and the self-story."',
            'Nia: "Which is why apology feels too small every time."',
        ),
        "competitive": lines(
            'Omar: "You always make this a trial."',
            'Nia: "Because you always walk in with a defense brief."',
            'Omar: "My reasons count. Yours turn into accusations."',
            'Nia: "That is the rig. My context disappears when you need me guilty."',
            'Omar: "And your archive makes my apology sound microscopic."',
            'Nia: "Because the case file is already louder than tonight."',
        ),
    },
    8: {
        "gentle": lines(
            'Carmen: "We keep telling the same injury story."',
            'Leah: "Because it still matters."',
            'Carmen: "It does. I am noticing that every added detail that complicates us sounds disloyal now."',
            'Leah: "So the story is becoming a test of belonging."',
            'Carmen: "Yes. The pain is real, and the gate around the memory is getting real too."',
            'Leah: "That is how grievance starts guarding the group."',
        ),
        "direct": lines(
            'Carmen: "Every time someone adds context, the room stiffens."',
            'Leah: "Because people think context dilutes the harm."',
            'Carmen: "Or because the grievance story is now doing membership work."',
            'Leah: "You mean loyalty is being measured by which version we repeat?"',
            'Carmen: "Exactly. The memory is not only remembered. It is patrolled."',
            'Leah: "And that makes repair sound suspect before it begins."',
        ),
        "competitive": lines(
            'Carmen: "This story has turned into a checkpoint."',
            'Leah: "For what?"',
            'Carmen: "For who still belongs. Add complexity and the room starts reading you as weak."',
            'Leah: "So the wound is now enforcing the script."',
            'Carmen: "Yes. The archive is doing security work."',
            'Leah: "That is how grievance graduates into identity discipline."',
        ),
    },
    9: {
        "gentle": lines(
            'Tessa: "You said, \'I am sorry you felt pushed out.\'"',
            'Rowan: "I was trying to acknowledge your feelings."',
            'Tessa: "You named my feelings and skipped your action."',
            'Rowan: "So it still sounds like I am leaving myself out of the sentence."',
            'Tessa: "Yes. Ownership has to include what you actually did."',
            'Rowan: "Then I need to say, \'I shut you out when it mattered,\' not just that the fallout was sad."',
        ),
        "direct": lines(
            'Tessa: "That apology had regret in it, but no owner."',
            'Rowan: "I thought empathy would help."',
            'Tessa: "Empathy matters after responsibility is named, not instead of it."',
            'Rowan: "So I kept the mood soft while hiding the action."',
            'Tessa: "Exactly. The sentence protected you from the verb."',
            'Rowan: "Then the repair has to start with the verb."',
        ),
        "competitive": lines(
            'Tessa: "You offered feelings, not ownership."',
            'Rowan: "I was trying not to make it worse."',
            'Tessa: "You made it safer for yourself, not clearer for me."',
            'Rowan: "Because I kept the apology near the damage and away from the deed."',
            'Tessa: "Right. The sentence had atmosphere but no culprit."',
            'Rowan: "Then I need to stop apologizing around the act and name it directly."',
        ),
    },
}


FIELD_PATCHES = {
    3: {
        ("contentVariants", "medium", "oneMinuteRecap", "retrieve", "gentle"): "What makes your own angle feel like simple reality?",
        ("contentVariants", "medium", "keyTakeaways", 0, "moreDetails", "gentle"): "Disagreement starts feeling like distortion when your own angle has already declared itself neutral.",
    },
    4: {
        ("contentVariants", "hard", "oneMinuteRecap", "connect", "competitive"): "Why can a defended memory make smooth confidence look like evidence?",
        ("contentVariants", "medium", "keyTakeaways", 0, "moreDetails", "gentle"): "The same scene can return with different emphasis because recollection is rebuilt under present pressure.",
        ("contentVariants", "hard", "keyTakeaways", 0, "moreDetails", "gentle"): "A remembered event can come back with a new moral shape when the current self needs a cleaner history.",
        ("contentVariants", "medium", "keyTakeaways", 1, "moreDetails", "direct"): "What gets protected is not just the self-image but the version of the scene that keeps that image standing.",
        ("contentVariants", "hard", "keyTakeaways", 1, "moreDetails", "direct"): "The defended layer is the interpretation of the event, which is why recollection itself starts doing moral cover work.",
        ("contentVariants", "hard", "keyTakeaways", 2, "moreDetails", "gentle"): "Apology and blame fights stall because each person is often relying on a memory already edited for innocence.",
    },
    5: {
        ("reviewCards", 1, "back", "direct"): "A closed loop mistakes interpretation for independent confirmation.",
        ("reviewCards", 2, "back", "competitive"): "Once care merges with identity, skepticism starts sounding like betrayal instead of discipline.",
        ("reviewCards", 3, "back", "direct"): "Compelling emotional depth can still be produced by a weak or contaminated method.",
        ("reviewCards", 4, "back", "competitive"): "The final account can carry the interviewer's pressure all the way into the evidence.",
        ("contentVariants", "medium", "keyTakeaways", 0, "moreDetails", "gentle"): "Scientific method matters because it can expose a confident interpretation to public correction.",
        ("contentVariants", "medium", "keyTakeaways", 1, "moreDetails", "direct"): "The frame starts grading its own homework when interpretation gets mistaken for external proof.",
        ("contentVariants", "medium", "keyTakeaways", 3, "moreDetails", "competitive"): "A suggestive clue is still only a clue until a cleaner method can test it.",
        ("contentVariants", "medium", "keyTakeaways", 4, "moreDetails", "competitive"): "By the end, the record can sound authoritative while still carrying the method's bias inside it.",
        ("contentVariants", "hard", "keyTakeaways", 0, "moreDetails", "gentle"): "Science matters because it checks confidence from outside the expert's preferred story.",
        ("contentVariants", "hard", "keyTakeaways", 2, "moreDetails", "gentle"): "A sincere clinician can feel most righteous exactly where the method is least protected from self-sealing error.",
    },
    6: {
        ("contentVariants", "medium", "oneMinuteRecap", "connect", "competitive"): "Why can a guilt-first room start generating the certainty it later celebrates?",
        ("contentVariants", "medium", "keyTakeaways", 0, "moreDetails", "gentle"): "Later details start feeling heavier or lighter depending on whether they fit the first suspect story.",
        ("contentVariants", "medium", "keyTakeaways", 1, "moreDetails", "gentle"): "Confession needs process scrutiny because the room can help manufacture the statement it later treats as clean proof.",
        ("contentVariants", "medium", "keyTakeaways", 3, "moreDetails", "gentle"): "Correction can feel hostile once officials have tied competence and duty to the original verdict.",
        ("contentVariants", "medium", "keyTakeaways", 4, "point", "competitive"): "Duty can make the machinery feel honorable while it stays rigged.",
        ("contentVariants", "hard", "keyTakeaways", 0, "moreDetails", "gentle"): "Tunnel vision widens after suspect choice because the whole case begins orbiting the same answer.",
        ("contentVariants", "hard", "keyTakeaways", 3, "moreDetails", "gentle"): "Later correction can feel psychologically hostile because it threatens the role and righteousness built around the verdict.",
        ("contentVariants", "hard", "keyTakeaways", 4, "point", "competitive"): "Duty can make defended certainty look clean even while the process is bending.",
    },
    7: {
        ("reviewCards", 0, "back", "competitive"): "I keep my context while your motives get flattened into character.",
        ("reviewCards", 3, "back", "competitive"): "An apology sentence has little force when the relationship archive is already prosecuting the speaker.",
        ("contentVariants", "medium", "keyTakeaways", 0, "moreDetails", "gentle"): "Both partners can feel sincere because each is grading the same scene through a self-favoring lens.",
        ("contentVariants", "medium", "keyTakeaways", 3, "moreDetails", "competitive"): "The relationship archive can drown a clean sentence of remorse before it has room to land.",
        ("contentVariants", "medium", "keyTakeaways", 4, "moreDetails", "competitive"): "Letting go can feel like letting go of the self-story that kept the hurt morally solid.",
        ("contentVariants", "hard", "keyTakeaways", 0, "moreDetails", "gentle"): "Two sincere memories can still keep feeding the same loop when each one protects its own innocence.",
        ("contentVariants", "hard", "keyTakeaways", 1, "moreDetails", "gentle"): "The present argument comes loaded with prior verdicts because grievance has already organized the archive.",
        ("contentVariants", "hard", "keyTakeaways", 4, "moreDetails", "competitive"): "Dropping the case can feel like dropping the identity that proved your pain mattered.",
    },
}


SUPPLEMENTS = {
    1: {
        ("easy", "direct"): "Ownership can feel larger than the act itself. Admitting the moment means revising the kind of person you were trying to remain in that scene.",
        ("easy", "competitive"): "The hidden price is that accountability can start feeling like a threat to self-preservation rather than a plain correction of the record.",
        ("medium", "direct"): "The mechanism survives because evidence now has to challenge both the facts and the person's need to remain morally recognizable to themselves.",
        ("medium", "competitive"): "That is what makes the opening sentence so useful. It shows how quickly the mind turns a live moral problem into phrasing that preserves livability and delays real repair.",
    },
    2: {
        ("easy", "direct"): "The person is not only managing evidence. They are managing the discomfort of seeing themselves act against what they already know.",
        ("easy", "competitive"): "The contradiction can make a person sound steadier just when the defense is doing the most work.",
        ("medium", "direct"): "The emotional sorting of evidence is the key point. Information starts arriving with a comfort value, not just a truth value, once the self has been invested in the choice.",
        ("medium", "competitive"): "Bad choices often get louder instead of softer after commitment. The self is no longer protecting only the act. It is protecting the chooser from the meaning of the act.",
        ("hard", "direct"): "Add sunk cost, pride, and public commitment, and the defense gets stronger still. A person may double down not because the position improved, but because retreat now threatens competence, judgment, and self-respect all at once.",
        ("hard", "competitive"): "Contradiction can harden belief instead of humbling it. The evidence does not enter an empty room. It enters a room full of prior investment, public face, and a self-story that does not want to be rewritten under pressure.",
    },
    3: {
        ("easy", "gentle"): "Sincere people can leave the same exchange with opposite verdicts about who was fair for that reason. The defended viewpoint arrives before curiosity does.",
        ("easy", "direct"): "Once that happens, the person is not only defending one conclusion. They are defending the right to call their own reading common sense.",
        ("easy", "competitive"): "The blind spot lasts because it keeps recoding your angle as reality and their angle as a symptom.",
        ("medium", "gentle"): "The chapter matters beyond one argument because the same pattern shapes hiring, discipline, belonging, and prejudice. A person can feel principled while still letting their own favored lens decide what counts as the facts.",
        ("medium", "direct"): "Naive realism is morally serious rather than merely interesting. It can shape punishment, trust, and belonging while the actor still experiences themselves as balanced and fair.",
        ("medium", "competitive"): "The consequence is bigger than one quarrel. Once your lens starts grading who counts as reasonable, the same structure can justify exclusion, stereotype defense, and moral contempt without ever sounding openly vicious.",
        ("hard", "gentle"): "That durability is the real problem. The distortion survives because it can borrow the felt innocence of simple perception.",
        ("hard", "direct"): "That structure also helps explain why institutions and groups can reproduce the same problem. Once a viewpoint is treated as plain reality, procedures, standards, and punishments can inherit the bias while still presenting themselves as neutral. The lens becomes harder to notice precisely because it has become official.",
        ("hard", "competitive"): "Blind spots scale easily from one person to a whole culture. The defended viewpoint can become a defended norm, and once that happens, anyone who challenges the norm starts looking biased by definition. The fight over facts becomes a fight over who gets to own the word realistic.",
    },
    4: {
        ("easy", "gentle"): "It also explains why later conversation can feel so frustrating. Each person is not only defending an event but the self who has been living with that event ever since.",
        ("easy", "direct"): "That is why new records, witnesses, or messages do not automatically settle the dispute. The evidence has to fight a memory already shaped for livability.",
        ("easy", "competitive"): "Once the edit works, the recollection stops feeling edited. It feels like the clean version that should have been obvious all along.",
        ("medium", "gentle"): "The mechanism matters because repair depends on what each person thinks happened. If the remembered scene already protects innocence, then apology, blame, and learning all start from a bent surface rather than from neutral recall.",
        ("medium", "direct"): "That also explains why records matter so much in contested situations. They do not magically solve the problem, but they can interrupt a recollection that has already been cleaned up for present identity needs.",
        ("medium", "competitive"): "Once memory starts doing defense work, the past becomes a strategic asset. The person is not only carrying a recollection forward. They are carrying a usable case for why they were justified then and remain justified now.",
        ("hard", "gentle"): "That is why simple appeals to honesty often fail. The issue is not merely willingness. The issue is that the memory under review has already been rebuilt into a form the self can emotionally inhabit.",
        ("hard", "direct"): "The stakes rise in any domain that treats confident recollection as high-quality evidence. Once memory is doing identity work, certainty can sound authoritative while the underlying reconstruction is still slanted toward innocence or away from shame.",
        ("hard", "competitive"): "That is what makes defended memory so dangerous in families, therapy rooms, and institutions. The cleaner the recollection sounds, the easier it is to mistake polish for proof and moral coherence for historical accuracy. The archive can feel orderly precisely because the censor did good work.",
    },
    5: {
        ("easy", "gentle"): "A caring voice can therefore become part of the problem when it discourages anyone from asking how the conclusion was actually tested.",
        ("easy", "direct"): "The discipline here is to separate interpretive confidence from evidence that could survive outside the interpretive frame that produced it.",
        ("easy", "competitive"): "The real danger is that kindness can make a weak method feel morally untouchable.",
        ("medium", "gentle"): "That is why the chapter feels less like an attack on care than a defense of disciplined care. A method earns trust by giving itself chances to fail, not by sounding warm while it keeps confirming itself.",
        ("medium", "direct"): "That is the operational distinction between humane intention and trustworthy judgment. One can be sincere and still produce a record that mainly reflects the interviewer's preferred theory.",
        ("medium", "competitive"): "The deeper risk is reputational and moral at once. Once a professional identity is built on rescue, any disconfirming evidence can start sounding like disloyalty to the vulnerable rather than a necessary correction of method.",
        ("hard", "gentle"): "The chapter's moral discipline is therefore sharper than a generic call for caution. It asks whether the method can survive contact with disconfirming evidence once the expert's caring identity has already become part of the explanation.",
        ("hard", "direct"): "That matters because closed loops do not only misclassify evidence. They can produce fresh harm while describing themselves as advanced understanding. Once the method stops risking failure, even compassion can become an accelerant for bad inference.",
        ("hard", "competitive"): "By that point the loop is doing two jobs at once: it preserves the conclusion and it preserves the expert's righteousness. That double protection is why contaminated evidence can keep sounding persuasive long after the method should have been put on trial.",
    },
    6: {
        ("easy", "gentle"): "The deeper issue is that legal process can turn invested interpretation into something that sounds like plain fact.",
        ("easy", "direct"): "The chapter's warning is not anti-law. It is anti-certainty that outruns the safeguards needed to keep role, pressure, and evidence from collapsing into one story.",
        ("easy", "competitive"): "Once the verdict has a badge and a file behind it, the system can mistake its own investment for truth.",
        ("medium", "gentle"): "That is why wrongful conviction is not only a matter of one bad clue. It is often a sequence in which early certainty changes the meaning of everything that follows, including what later looks like proof.",
        ("medium", "direct"): "The institutional version of self-justification matters because the consequences are not private embarrassment. They are lost years, damaged credibility, and a process that can keep defending harm as duty.",
        ("medium", "competitive"): "The danger is not just bias in one mind. It is a whole process that starts rewarding the people who keep the original story clean and punishing the ones who complicate it.",
        ("hard", "gentle"): "The consequence is that legal review can become most rigid exactly when humility is most needed. The system has to admit not only that a fact was missed, but that status, duty, and institutional face may have helped miss it.",
        ("hard", "direct"): "That is why procedural safeguards matter so much. They are not niceties added to a truth-finding machine. They are barriers against a truth-finding machine quietly turning into a defended identity machine with coercive power.",
        ("hard", "competitive"): "At that point the institution is no longer just weighing evidence. It is protecting the dignity of its own verdict. That is what makes reversal feel like self-harm and what makes a clean correction so hard to win.",
    },
    7: {
        ("easy", "gentle"): "The pattern is dangerous because it lets both people feel sincere while the bond keeps collecting evidence against itself.",
        ("easy", "direct"): "Once that archive grows, even small frictions start arriving with a backlog of moral meaning already attached to them.",
        ("easy", "competitive"): "The relationship starts choking on stored verdicts long before either person notices the case file replacing the partnership.",
        ("medium", "gentle"): "That is what makes marital self-justification so corrosive. The partner is no longer being met as a person in the current scene. The partner is being processed through an archive that already says what kind of person they are.",
        ("medium", "direct"): "The harder lesson is that real hurt can still be used in a way that keeps understanding out of reach. Pain stays true, but the archive turns that pain into ongoing prosecution instead of shared diagnosis.",
        ("medium", "competitive"): "Once grievance starts feeling like dignity, any move toward empathy can look like surrender. That is why the loop can keep winning even when both partners are exhausted by it.",
        ("hard", "gentle"): "The bond weakens because each new conflict is forced to serve two jobs at once: express present pain and defend a larger story about who has been decent all along. That double load makes curiosity feel risky.",
        ("hard", "direct"): "That is also why improvement can be hard to trust once grievance has hardened. Even real change may arrive too late to get a fair read because the archive has already taught each partner what the other person's actions are supposed to mean.",
        ("hard", "competitive"): "That is the machine at full speed. Every conflict revalidates the old verdict, every apology is measured against the whole record, and every softening move risks looking like desertion from your own case. No wonder the need for acquittal starts outranking the need for repair.",
    },
}


FULL_REPLACEMENTS = {
    1: {
        ("contentVariants", "hard", "gentle", "chapterBreakdown"): (
            "The first move starts with a line almost everybody recognizes: \"Mistakes were made.\" It sounds composed, but the calmness is part of the trick. "
            "The sentence admits that something happened while quietly removing the person who made it happen. Harm stays on the page. Agency thins out.\n\n"
            "That small maneuver matters because it introduces the book's central mechanism before the theory is named. Most people need to remain at least morally livable to themselves. "
            "When behavior threatens that self-image, the pressure is immediate. One response is to face the act plainly and let it change the self-understanding that goes with it. "
            "The other response is to change the meaning of the act until the self can still feel decent enough to inhabit.\n\n"
            "That is what self-justification does. It does not only excuse a person in public. It builds a version of events that the person can privately tolerate. "
            "That is why the mechanism is more serious than ordinary spin. A liar hides what they know. A self-justifying person may keep sanding the story until it begins to feel sincere.\n\n"
            "The distinction matters because evidence has a harder job once identity is involved. Facts can expose contradiction, but contradiction alone does not defeat a story that is also preserving innocence. "
            "If the fuller truth would force someone to say, \"I was selfish,\" \"I was cruel,\" or \"I hurt someone and then protected myself,\" the mind has strong incentives to soften the landing before it gets there.\n\n"
            "A weak apology is one example. So are passive phrasing, inflated provocation, narrowed responsibility, and selective emphasis on what the other person did first. "
            "The same structure appears in ordinary life as well as public scandal: a friend centering the insult that triggered the outburst, a manager reframing a failed call as inevitable, a partner treating cruelty as honesty that simply had to be spoken.\n\n"
            "The cost is moral as well as practical. A mechanism built to reduce shame can also preserve harm. It keeps apology thin, learning slow, and repair partial. "
            "In the short run it protects a usable self-image. In the longer run it makes ownership feel like self-destruction.\n\n"
            "That is why the chapter begins here. Before any formal model arrives, the reader needs to feel the trap: the first barrier to truth is often not missing information but the need to remain tolerable to oneself."
        ),
        ("contentVariants", "hard", "direct", "chapterBreakdown"): (
            "The opening move uses a passive sentence that does more work than it appears to do: \"Mistakes were made.\" Its usefulness is analytical. "
            "The line keeps the consequence and strips out the agent. That is not just weak accountability language. It is the clearest opening example of self-justification, treated here as a defense of identity under pressure.\n\n"
            "The core mechanism is simple but uncomfortable. People usually need to experience themselves as decent, rational, or at least not plainly harmful. "
            "When behavior collides with that self-concept, the contradiction creates pressure. The mind can relieve the pressure in two broad ways: revise the self, or revise the story of what happened. "
            "Self-justification is the family of moves that makes revising the story easier than revising the self.\n\n"
            "Self-justification also differs from lying. A liar knows the truth and hides it from others. Self-justification can involve public distortion, but its deeper function is internal. "
            "It produces an explanation the person can accept without feeling morally ruined. Once the explanation feels acceptable, it stops functioning as obvious cover and starts functioning as perceived reality.\n\n"
            "The distinction changes how resistance to correction works. If a person is merely concealing facts, more facts may corner them. If the person's version is also preserving innocence, evidence has to fight a second battle. "
            "It is not only competing with error. It is threatening the structure that lets the person stay bearable to themselves. Ownership feels expensive once self-image is involved.\n\n"
            "A hidden escalation path also appears. Soft wording opens room for moral distance. That distance makes self-serving interpretation easier, and repeated interpretation eventually reshapes memory in the self's favor. "
            "The person does not just defend the act in one moment. They begin building a whole environment in which the act seems smaller, more forced, or more understandable than it was.\n\n"
            "This is the boundary where ordinary defensiveness becomes morally serious. Self-protection is human. But when the protective story starts preserving avoidable harm, weak apologies, or refusal to repair, the mechanism has crossed from comfort into damage. "
            "The person may still sound sincere. Sincerity is not the same as accuracy.\n\n"
            "The gap between public scandal and daily life also collapses. The same structure appears when a boss reframes a failed call as inevitable, when a friend centers the provocation instead of the injury, or when a partner turns a cruel remark into courage. "
            "Different scale, same move: preserve the self by redesigning the meaning of the act.\n\n"
            "A real unresolved question remains. If people are not usually cold villains and not usually clean truth-tellers either, what force stabilizes the defensive version once contradiction appears? "
            "What is clear already is the hard edge: the first obstacle to correction is often not lack of evidence but the cost of letting evidence rewrite the self. That is what makes the mechanism ordinary and dangerous at the same time."
        ),
    },
    2: {
        ("contentVariants", "hard", "gentle", "chapterBreakdown"): (
            "The opening move begins with a simple contradiction that refuses to stay simple: a person knows smoking is dangerous and continues anyway. "
            "The point is not just hypocrisy. The point is the tension created when belief, behavior, and self-image no longer fit together cleanly. Cognitive dissonance is the name for that tension.\n\n"
            "The mechanism matters because tension does not sit still. People want it reduced. The cleanest solution would be to change the behavior or admit plainly what the behavior means. "
            "But those moves can injure identity. So the mind often takes a cheaper route and changes the interpretation instead. The warning becomes exaggerated, the exception becomes central, the future promise becomes comforting, and the behavior gets to stay where it is.\n\n"
            "Dissonance is the engine behind self-justification for that reason. Self-justification is not floating moral weakness. It is a pressure response. Once contradiction appears, the mind starts protecting a workable version of the self. "
            "Relief arrives when the story becomes easier to inhabit, even if the facts themselves have not improved.\n\n"
            "The smoker example shows the mechanism in a familiar form, but the material becomes more revealing once commitment grows heavier. Leon Festinger's failed-prophecy group expected the world to end. It did not. "
            "On the surface, the belief should have collapsed under the weight of its own failure. Instead, failure was reinterpreted in a way that preserved the group's commitment. The lesson is not that the group was uniquely irrational. "
            "It is that contradiction alone does not guarantee surrender when surrender would be too costly to the self.\n\n"
            "That matters because it shows a hidden structure inside dissonance reduction. Contradiction does not always weaken a position. Sometimes it raises the psychological cost of retreat so sharply that a stronger explanation becomes more attractive than a clean admission of error. "
            "A person may sound more certain not because the evidence improved, but because the alternative has become too humiliating to accept.\n\n"
            "This is the same structure that appears after ordinary decisions. Before commitment, competing possibilities can coexist. After commitment, contradiction threatens not only the choice but the chooser. "
            "A shaky purchase, a bad plan, a public stance, a strained relationship: once the self has been invested, evidence starts carrying emotional weight as well as informational weight.\n\n"
            "Confirmation bias then becomes more than lazy thinking. It becomes part of dissonance reduction. Supportive evidence lowers pressure. Contradictory evidence raises it. "
            "The mind therefore treats the two kinds of information unevenly for a reason. One calms the contradiction. The other sharpens it.\n\n"
            "The hardest edge is that certainty can now become ambiguous. It might reflect real clarity. It might also reflect a mind under pressure to defend a threatened self-story. "
            "Confident commitment is not self-validating evidence.\n\n"
            "The unresolved question stays alive here. When contradiction hurts, what gets edited first: the facts, the meaning of the facts, or the moral cost of admitting them? "
            "The chapter does not need to settle that sequence perfectly to show the danger. It only needs to show that once identity enters the room, truth is no longer being evaluated on neutral ground."
        ),
    },
}


TOPUPS = {
    1: {
        ("easy", "gentle"): " for the speaker's conscience.",
        ("hard", "gentle"): "Another reason the mechanism is durable is that it can borrow the language of maturity and honesty. People tell themselves they are being realistic, brave, or unsentimental when they are actually protecting a narrower version of themselves from a harder moral reckoning. The story sounds adult while it keeps the damaging act partially untouched.",
        ("hard", "direct"): "The defense also scales quickly. Once a person has stabilized one softened version of the event, later memory and later explanation begin protecting the same version automatically.",
    },
    2: {
        ("easy", "gentle"): " and call the compromise reasonable.",
        ("medium", "direct"): "The chooser is always inside the equation.",
        ("medium", "competitive"): "That is why defended commitment can sound like conviction even when it is really a pain-management strategy built around the self.",
        ("hard", "direct"): "The defense is doing psychological bookkeeping as much as factual interpretation.",
        ("hard", "competitive"): "Public investment raises the price of honesty and makes the retrofit story feel like the cheaper option.",
    },
    3: {
        ("easy", "gentle"): " The chapter's warning is that innocence can cling to a selective lens for a long time if the lens keeps calling itself fairness.",
        ("easy", "direct"): "The real danger is that social judgment then gets built on a defended perspective while the person still feels lucid and impartial. That is how a biased reading starts acting like a moral entitlement.",
        ("easy", "competitive"): "Once the lens gets mistaken for the world itself, correction starts looking like insult. The person is not simply guarding a conclusion. They are guarding the status of their own eyesight.",
        ("medium", "gentle"): "That is what gives the mechanism social force. A person can keep a flattering self-image while handing out suspicion, distance, or exclusion and still feel that the judgment was simply responsible. The chapter is really about how innocence and distortion can cooperate.",
        ("medium", "direct"): "The mechanism also explains why standards can be weaponized without feeling corrupt. A person uses rules, fairness language, and common sense as if those things were neutral, while the underlying lens has already been bent toward protecting a preferred story about the self and the other side.",
        ("medium", "competitive"): "Once that structure is in place, the person stops arguing only about the issue and starts defending the moral status of their own perception. The fight then becomes harder to soften because backing off would feel like admitting that your so-called realism was loaded from the start.",
        ("hard", "direct"): "That is why the chapter belongs to more than interpersonal conflict. A defended viewpoint can seep into standards of merit, suspicion, professionalism, and fairness while still feeling like the obvious read of the evidence. Once the lens becomes procedural, the people using it can sound even cleaner while doing more damage.",
        ("hard", "competitive"): "That is also why the blind spot becomes politically useful. If your own perspective gets to count as reality, then the other side begins every disagreement under suspicion. The defended lens becomes a sorting device for who seems rational, decent, and worth hearing in the first place.",
    },
    4: {
        ("easy", "gentle"): " now.",
        ("easy", "direct"): "The cleaner the recollection feels, the easier it is to mistake coherence for accuracy. A defended memory can sound steady precisely because it has been revised into a form the present self can carry without too much shame.",
        ("easy", "competitive"): "That is why old fights rarely stay old. The memory comes back sharpened around innocence, and the person speaks from the sharpened version as if it were the untouched original. The past returns already argued for.",
        ("medium", "gentle"): "That also explains why people can keep feeling newly hurt by an old event. The memory is not a frozen file. It is a current reconstruction that can keep redistributing blame and self-protection each time it is retold. The past stays active because the moral sorting keeps being refreshed in the present.",
        ("medium", "direct"): "A defended recollection can therefore become part of a person's operating identity. The scene is remembered not just as history but as evidence for what kind of person they were, what kind of person the other was, and why any later challenge now feels unfair. Memory becomes active moral support.",
        ("medium", "competitive"): "That is why memory fights get so stubborn. Each side is not only protecting facts. Each side is protecting the version of the scene that lets the self stay legitimate. The archive becomes a weapon, a shield, and a verdict all at once.",
        ("hard", "gentle"): "That pressure is what makes memory morally consequential instead of merely unreliable. The reconstructed scene can govern apology, trust, and blame for years because the person is still living inside the edited version. The past keeps shaping the present because the present keeps needing a certain kind of past.",
        ("hard", "direct"): "That is also why institutional dependence on memory has to be treated carefully. If confidence, detail, and emotional steadiness are all filtered through identity needs, then the strongest witness in the room may still be carrying a defended reconstruction rather than a neutral record. Reliability has to be earned, not inferred from force of recollection.",
        ("hard", "competitive"): "Once that happens, memory becomes a prestige surface. The person who sounds smooth, vivid, and morally centered may simply be the person whose inner editor did the best cleanup job. The danger is not just that facts are missed. It is that defended memory starts looking like high-grade evidence precisely when it should be cross-examined hardest.",
    },
    5: {
        ("easy", "gentle"): " Method has to earn the trust that warmth alone attracts.",
        ("easy", "direct"): "Once that distinction is missed, the helper starts mistaking a moving story for a tested one. The client or witness becomes a mirror for the theory instead of an independent source that could revise it.",
        ("easy", "competitive"): "That is how a soft tone can end up defending a hard methodological error. The helper sounds humane while the process keeps selecting evidence that flatters the frame.",
        ("medium", "gentle"): "The chapter's deeper discipline is that genuine care should make a method more accountable, not less. If helping someone matters, then the helper should want a process that can be corrected in public rather than one that keeps rewarding certainty simply because certainty feels morally serious.",
        ("medium", "direct"): "That is why the chapter keeps returning to external checks. A practitioner's confidence may reflect experience, but unless the method can survive disconfirmation, the final record may still be mostly a polished extension of the practitioner's starting assumptions. Reliability requires friction against the preferred interpretation.",
        ("medium", "competitive"): "The ugly possibility is that a helper can keep sounding nobler while the method gets worse. Once the frame starts feeding itself, every emotionally convincing moment becomes another brick in a wall that keeps disconfirming evidence outside the room.",
        ("hard", "gentle"): "The chapter therefore treats disciplined method as a moral demand, not merely a technical preference. Without it, professional care can drift into a style of certainty that protects the expert's identity, shapes the record in advance, and then calls the shaped record proof. Harm survives because the loop keeps sounding benevolent.",
        ("hard", "direct"): "That is also why public challenge matters. Once the theory, the interviewer, and the resulting evidence all reinforce one another, private sincerity is no protection. The loop has to meet a standard that can tell the expert no, because self-trust alone is exactly what the loop has already learned to exploit.",
        ("hard", "competitive"): "In the end the chapter is asking who gets to overrule a righteous interpreter. If the answer is nobody, then the method has become a self-sealing machine that can generate conviction, contaminate evidence, and still narrate the whole process as brave care.",
    },
    6: {
        ("easy", "direct"): "The system can then sound principled while it is really defending the status costs of being wrong.",
        ("easy", "competitive"): "That is why a legal record can become more confident as it becomes less corrigible. The institution keeps hearing its own investment as evidence and treats reversal like moral collapse instead of ordinary correction.",
        ("medium", "gentle"): "The chapter's deeper warning is that procedure can quietly inherit the psychology of the people running it. An early suspect choice does not sit harmlessly in the background. It changes the emotional meaning of later facts, of later denials, and even of the room's own pressure tactics. The process starts preferring the story that justifies itself fastest.",
        ("medium", "direct"): "Once that process hardens, public duty can become part of the distortion. Officials do not have to be cynical for the loop to work. They only have to bind competence, safety, and professional worth to the verdict already reached. After that, the institution begins treating contradiction as something to absorb or dismiss, not something to learn from.",
        ("medium", "competitive"): "That is how law turns a human bias into a machine. One early guess gets official weight, official weight bends the interview and the case file, and the bent file then comes back as proof that the original guess deserved the weight. The system starts manufacturing the certainty it later celebrates.",
        ("hard", "gentle"): "The damage is cumulative because every stage can inherit the earlier narrowing. The suspect choice shapes the interview, the interview shapes the confession, the confession shapes the verdict, and the verdict shapes the institution's appetite for correction. By the time innocence evidence arrives, it is no longer facing one mistake. It is facing a whole defended chain.",
        ("hard", "direct"): "That is what gives the chapter its institutional edge. The issue is not merely that some investigators become attached to a theory. The issue is that attachment can be organized into process, role, and public story until the machinery itself starts preferring consistency over truth. A system with that preference can keep sounding lawful while it resists the very evidence meant to correct it.",
        ("hard", "competitive"): "Once the whole chain is invested, innocence evidence has to fight uphill against rank, reputation, and the emotional reward of staying aligned with the original verdict. That is why post-conviction correction can feel less like review than like a mutiny against the institution's own self-respect.",
    },
    7: {
        ("easy", "gentle"): " together.",
        ("easy", "direct"): "The relationship then stops treating conflict as a shared problem to solve. It starts using conflict as evidence for a standing moral case about who has to keep carrying the burden of explanation and who gets to feel cleaner by default.",
        ("easy", "competitive"): "That is when love starts losing ground to bookkeeping. The bond is no longer being measured by repair but by which side can leave the room feeling less guilty and more justified than the other.",
        ("medium", "gentle"): "The mechanism is severe because intimacy gives every small event a place to live. A harsh tone, a missed task, a late return, or a defensive shrug can all be filed under the same running story about who cares less, who attacks first, and who always has to chase repair. The archive becomes relational gravity.",
        ("medium", "direct"): "That is why a couple can feel trapped by patterns even when both people can still describe specific incidents accurately. The incidents no longer arrive alone. They arrive preloaded with prior blame, prior verdicts, and prior proof that the other person is the more dangerous moral actor in the relationship.",
        ("medium", "competitive"): "The structure is punishing because every fresh incident gets drafted into an old prosecution. Instead of opening room for diagnosis, conflict keeps enlarging the archive that tells each partner why backing down would be unjust, humiliating, or equivalent to surrendering the truth about the marriage.",
        ("hard", "gentle"): "The chapter's difficulty is that it refuses cheap symmetry while still showing how both partners can contribute to the loop. Real hurt is not erased, yet the hurt can still be stored in a way that keeps investigation, empathy, and proportion from doing their work. The grievance record protects dignity and quietly starves repair.",
        ("hard", "direct"): "That is why marriage conflict can become a defended moral ecosystem. Each person's recollection, explanation, and current anger feed the same identity need: remain the more understandable one. Once that identity need becomes central, even useful feedback can feel like a push to accept a degrading role in the relationship story.",
        ("hard", "competitive"): "By then the fight is barely about the dishes or the text or the tone. It is about whether either partner can afford to drop the flattering case that has been carrying their innocence. The archive promises moral protection, so every move toward repair has to compete with the private thrill of acquittal.",
    },
}


FINAL_TOPUPS = {
    1: {
        ("hard", "gentle"): "It also works because the defensive version is rarely pure invention. It is usually a narrowed, rearranged, morally softened account that lets the person keep one foot near the truth while staying farther away from the full charge of what they did.",
    },
    2: {
        ("medium", "competitive"): "That is why commitment can sound wiser just when the self is working hardest to stay unembarrassed.",
        ("hard", "competitive"): "The more the chooser is exposed, the more attractive the retrofit story becomes.",
    },
    3: {
        ("easy", "competitive"): "That is what makes the trap feel fair from inside.",
        ("medium", "direct"): "The result is a worldview that can keep calling itself objective while it quietly hands moral advantage to the self and moral defect to the rival. That is why the chapter matters anywhere judgment, blame, and belonging are being distributed.",
        ("medium", "competitive"): "Once that move becomes routine, prejudice can keep its polite face while still operating as defended distortion.",
        ("hard", "direct"): "That is also why correction often arrives too late. By the time someone is asked to rethink, the defended viewpoint may already be embedded in memory, procedure, and group loyalty. The person is not simply being asked to change a judgment. They are being asked to distrust the very lens that helped them feel competent, fair, and realistic in the first place.",
        ("hard", "competitive"): "Once that happens, the challenge does not sound like evidence. It sounds like an assault on the right to name reality.",
    },
    4: {
        ("easy", "gentle"): " again.",
        ("easy", "competitive"): "That makes old injury sound freshly argued every time it is recalled.",
        ("medium", "gentle"): "That is why couples and families can keep relitigating an event they think they have already discussed. They are not returning to the same scene. They are returning to new versions of the scene that have been adjusted to protect dignity, continuity, and blame.",
        ("medium", "direct"): "That is why any honest correction has to reach beyond memory confidence and into the incentives shaping the recollection itself.",
        ("medium", "competitive"): "The past keeps coming back armed because identity keeps loading it before it arrives.",
        ("hard", "gentle"): "That makes the threshold for correction painfully high.",
        ("hard", "direct"): "That is why memory should be treated as evidence under pressure rather than as evidence above pressure. Once present identity is doing the sorting, the historian inside the self is no longer neutral, even when the speaker sounds settled, articulate, and sincere.",
        ("hard", "competitive"): "That is why defended recollection can dominate a room even when it should be under suspicion.",
    },
    5: {
        ("easy", "gentle"): " That boundary is what keeps concern from becoming its own evidence.",
        ("easy", "competitive"): "Once that happens, the helping posture starts hiding the methodological flaw instead of correcting it.",
        ("medium", "direct"): "That is why professional humility has to be procedural, not merely personal. The method needs structures that can resist the pull of a favored interpretation even when the interpreter feels wise, experienced, and benevolent.",
        ("medium", "competitive"): "The closed loop survives because it can turn compassion, urgency, and confidence into reasons not to slow down.",
        ("hard", "direct"): "That is why bad method can feel strongest in rooms full of noble language. The rhetoric of protection and care gives the loop a moral halo, which makes it even easier for contaminated evidence to sound like deep insight instead of frame-driven error.",
        ("hard", "competitive"): "Once righteousness joins the loop, correction starts sounding like betrayal of the mission itself.",
    },
    6: {
        ("easy", "direct"): "The role can become another witness for the verdict.",
        ("easy", "competitive"): "That is why the verdict can keep borrowing authority from the institution long after the evidence should have been reopened.",
        ("medium", "gentle"): "Once that narrowing starts, later facts do not arrive as simple information. They arrive as support or threat to the chosen theory.",
        ("medium", "direct"): "A system built that way can confuse persistence with integrity and reversal with collapse, which is exactly why wrongful outcomes can survive so long.",
        ("medium", "competitive"): "By then the process is carrying more than one story. It is carrying the suspect story and the institution's story about its own competence.",
        ("hard", "gentle"): "That is what makes later review so psychologically charged.",
        ("hard", "direct"): "That is why defended certainty becomes an institutional problem rather than a private flaw. The office, the badge, the public narrative, and the case file can all start speaking in one voice, and that voice is rarely eager to admit it was built around a premature conclusion.",
        ("hard", "competitive"): "That is why innocence review can feel like treason against the machinery that produced the sentence.",
    },
    7: {
        ("easy", "competitive"): "The relationship starts acting like an archive before it can act like a partnership again.",
        ("medium", "gentle"): "Repair therefore requires more than one good sentence. It requires loosening the archive that keeps translating the partner's behavior into proof of a standing character verdict.",
        ("medium", "direct"): "That is why apology, empathy, and future planning all struggle once the conflict has been moralized this heavily. The conversation keeps getting dragged back toward who deserves acquittal instead of what would actually reduce harm between the two people.",
        ("medium", "competitive"): "The archive keeps winning because it promises moral safety at exactly the moment repair asks for vulnerability.",
        ("hard", "gentle"): "That is why even real tenderness can feel unstable once grievance has become part of the moral architecture of the bond.",
        ("hard", "direct"): "A relationship caught in that pattern can still produce accurate complaints, but it will keep misusing them until the complaints stop serving only truth and start serving protected innocence. Once that happens, every useful point is recruited into a larger prosecutorial story.",
        ("hard", "competitive"): "Once acquittal becomes the prize, even honest pain gets drafted into strategy and the bond keeps losing ground.",
    },
}


FINAL2_TOPUPS = {
    1: {
        ("hard", "gentle"): " fully.",
    },
    2: {
        ("hard", "competitive"): " Pride keeps feeding it.",
    },
    3: {
        ("easy", "competitive"): " It feels earned.",
        ("medium", "competitive"): "That posture keeps the conflict morally hot.",
        ("hard", "direct"): "That is why the chapter presses on the conditions of correction. Any honest revision now has to loosen not just one conclusion but the privileged status of the viewpoint that produced it. Until that happens, new evidence keeps entering a room already organized against it.",
        ("hard", "competitive"): "That is why these conflicts feel so self-proving. Every clash gets folded back into the same accusation because the defended norm has already decided who sounds factual and who sounds warped before the next sentence is even heard.",
    },
    4: {
        ("easy", "competitive"): "The memory returns pre-edited for the next round.",
        ("medium", "direct"): "That is why defended memory can keep outranking correction. The person is not merely attached to a detail. They are attached to the moral arrangement that the detail helps keep in place.",
        ("medium", "competitive"): "That is why the archive keeps getting strategic value. The cleaner it sounds, the more power it has to settle blame before the new conversation has even started.",
        ("hard", "direct"): "That is why the chapter matters outside family conflict. Any system that rewards certainty, detail, and a stable story can end up rewarding the very reconstruction that identity most prefers. Once that happens, the record looks more authoritative as it becomes less independent from the self doing the remembering.",
        ("hard", "competitive"): "That is why defended memory scales so easily. The person who owns the cleanest story also appears to own the strongest proof, even when the smoothness of the story is exactly what should make everyone slow down and test it harder.",
    },
    5: {
        ("easy", "competitive"): "Method has to break the spell.",
        ("medium", "competitive"): "The room starts protecting the frame because the frame now protects the rescuer.",
        ("hard", "direct"): "That is why the chapter keeps its focus on method instead of motive. A person can be deeply moved, sincerely protective, and ethically serious while still using a process that manufactures the very evidence it later treats as discovery. The method has to answer to something firmer than the helper's self-trust.",
        ("hard", "competitive"): "That is why the loop is so hard to interrupt. The more honorable the expert feels, the easier it is for contamination, suggestion, and weak testing to hide behind the glow of moral seriousness.",
    },
    6: {
        ("easy", "direct"): "That makes reversal harder later.",
        ("easy", "competitive"): "The role keeps the answer warm.",
        ("medium", "direct"): "That is why institutional error resists humility. The case is no longer only about the suspect. It is also about whether the people running the process can bear what correction would imply about their own prior certainty.",
        ("medium", "competitive"): "Every reopening threatens the institution's self-story.",
        ("hard", "gentle"): "The whole sequence becomes harder to unwind.",
        ("hard", "direct"): "That is why legal review becomes so difficult after public commitment. To reopen honestly, the institution has to admit that its own structures may have helped create the certainty they later defended. That is a much harder confession than admitting one bad clue was overweighted.",
        ("hard", "competitive"): "That is why defended law can feel so morally confident while still being structurally trapped.",
    },
    7: {
        ("medium", "direct"): "That is why even a fair criticism can arrive in the wrong emotional economy. The archive has already decided what the other partner's behavior means, so the present exchange gets forced into old roles before it can become something more accurate or more useful.",
        ("medium", "competitive"): "The archive keeps treating vulnerability like a strategic risk.",
        ("hard", "gentle"): "That is what keeps the loop fed.",
        ("hard", "direct"): "That is why sustained repair feels so unnatural inside the loop. Each partner has to risk giving up a story that has been protecting dignity, explaining suffering, and organizing blame for a long time. No wonder accusation feels easier to trust than change.",
        ("hard", "competitive"): "That is why the bond keeps losing. The archive keeps offering identity, vindication, and a ready-made enemy, while repair keeps asking both people to tolerate uncertainty, soften self-protection, and give up some of the moral payoff of being right.",
    },
}


def apply_full_replacements(chapter_num, chapter):
    for path, value in FULL_REPLACEMENTS.get(chapter_num, {}).items():
        depth, tone = path[1], path[2]
        chapter["contentVariants"][depth]["chapterBreakdown"][tone] = value


def apply_field_patches(chapter_num, chapter):
    for path, value in FIELD_PATCHES.get(chapter_num, {}).items():
        path_set(chapter, list(path), value)


def apply_supplements(chapter_num, chapter):
    for (depth, tone), extra in SUPPLEMENTS.get(chapter_num, {}).items():
        append_text(chapter, depth, tone, extra)


def fix_inline_text(chapter_num, chapter):
    cv = chapter["contentVariants"]
    if chapter_num == 2:
        cv["hard"]["chapterBreakdown"]["gentle"] = cv["hard"]["chapterBreakdown"]["gentle"].replace(
            "The point is not just hypocrisy. The point is the tension created when belief, behavior, and self-image no longer fit together cleanly.",
            "The issue is not just hypocrisy. The deeper problem is the tension created when belief, behavior, and self-image no longer fit together cleanly.",
        )
        cv["medium"]["chapterBreakdown"]["direct"] = cv["medium"]["chapterBreakdown"]["direct"].replace(
            "The point is not that the group was uniquely irrational. The point is that contradiction alone does not guarantee surrender when surrender would be too costly to the self.",
            "The lesson is not that the group was uniquely irrational. The deeper point is that contradiction alone does not guarantee surrender when surrender would be too costly to the self.",
        )
        cv["hard"]["chapterBreakdown"]["direct"] = cv["hard"]["chapterBreakdown"]["direct"].replace(
            "Dissonance functions as the engine behind self-justification. Self-justification is the story layer built to make contradiction easier to live with.",
            "Dissonance functions as the engine behind self-justification. The repair story built around that tension is meant to make contradiction easier to live with.",
        )
        cv["hard"]["chapterBreakdown"]["direct"] = cv["hard"]["chapterBreakdown"]["direct"].replace(
            "The mechanism matters beyond smoking or failed prophecies.",
            "The mechanism matters well beyond smoking or failed prophecies.",
        )
    if chapter_num == 3:
        cv["easy"]["chapterBreakdown"]["gentle"] = cv["easy"]["chapterBreakdown"]["gentle"].replace(
            "That is why sincere people can leave the same exchange with opposite verdicts about who was fair.",
            "Sincere people can leave the same exchange with opposite verdicts about who was fair for that reason.",
        )
        cv["medium"]["chapterBreakdown"]["competitive"] = cv["medium"]["chapterBreakdown"]["competitive"].replace(
            "That is why the bias blind spot is so sturdy.",
            "For that reason the bias blind spot is so sturdy.",
        )
    if chapter_num == 4:
        cv["easy"]["chapterBreakdown"]["direct"] = cv["easy"]["chapterBreakdown"]["direct"].replace(
            "That is why new records, witnesses, or messages do not automatically settle the dispute.",
            "New records, witnesses, or messages do not automatically settle the dispute for that reason.",
        )
        cv["easy"]["chapterBreakdown"]["competitive"] = cv["easy"]["chapterBreakdown"]["competitive"].replace(
            "That is why old fights rarely stay old.",
            "Old fights rarely stay old for that reason.",
        )
        cv["medium"]["chapterBreakdown"]["gentle"] = cv["medium"]["chapterBreakdown"]["gentle"].replace(
            "That is why memory can become a self-justifying historian.",
            "For that reason memory can become a self-justifying historian.",
        )
        cv["medium"]["chapterBreakdown"]["competitive"] = cv["medium"]["chapterBreakdown"]["competitive"].replace(
            "That is why memory fights get so stubborn.",
            "Memory fights get so stubborn for that reason.",
        )
        cv["medium"]["chapterBreakdown"]["direct"] = cv["medium"]["chapterBreakdown"]["direct"].replace(
            "That is why any honest correction has to reach beyond memory confidence and into the incentives shaping the recollection itself.",
            "Any honest correction therefore has to reach beyond memory confidence and into the incentives shaping the recollection itself.",
        )
        cv["hard"]["chapterBreakdown"]["gentle"] = cv["hard"]["chapterBreakdown"]["gentle"].replace(
            "That is why confidence becomes so ambiguous.",
            "Confidence therefore becomes ambiguous.",
        )
        cv["hard"]["chapterBreakdown"]["gentle"] = cv["hard"]["chapterBreakdown"]["gentle"].replace(
            "That is why simple appeals to honesty often fail.",
            "For that reason simple appeals to honesty often fail.",
        )
        cv["hard"]["chapterBreakdown"]["competitive"] = cv["hard"]["chapterBreakdown"]["competitive"].replace(
            "That is why close relationships become memory battlegrounds.",
            "Close relationships become memory battlegrounds for that reason.",
        )
        cv["hard"]["chapterBreakdown"]["competitive"] = cv["hard"]["chapterBreakdown"]["competitive"].replace(
            "That is why the next move into professional judgment is so important.",
            "The next move into professional judgment is important for the same reason.",
        )
        cv["hard"]["chapterBreakdown"]["competitive"] = cv["hard"]["chapterBreakdown"]["competitive"].replace(
            "That is why the final chapter has to be about owning up.",
            "For that reason the final chapter has to be about owning up.",
        )
    if chapter_num == 5:
        cv["easy"]["oneMinuteRecap"]["gentle"] = "Care and certainty are not enough here. The chapter shows how closed-loop judgment can feel compassionate while still refusing the kind of testing that would expose error."
        cv["medium"]["chapterBreakdown"]["gentle"] = cv["medium"]["chapterBreakdown"]["gentle"].replace(
            "That is why this chapter insists that good motives and emotional conviction are not enough.",
            "For that reason this chapter insists that good motives and emotional conviction are not enough.",
        )
        cv["medium"]["chapterBreakdown"]["gentle"] = cv["medium"]["chapterBreakdown"]["gentle"].replace(
            "That is why the chapter feels less like an attack on care than a defense of disciplined care.",
            "The chapter feels less like an attack on care than a defense of disciplined care for that reason.",
        )
        cv["hard"]["chapterBreakdown"]["gentle"] = cv["hard"]["chapterBreakdown"]["gentle"].replace(
            "That is why the closed loop of clinical judgment is so dangerous.",
            "For that reason the closed loop of clinical judgment is so dangerous.",
        )
        cv["hard"]["chapterBreakdown"]["direct"] = cv["hard"]["chapterBreakdown"]["direct"].replace(
            "This chapter argues that reliable judgment depends on disconfirming method, not just good motive.",
            "Reliable judgment depends on disconfirming method, not just good motive.",
        )
        cv["medium"]["chapterBreakdown"]["direct"] = cv["medium"]["chapterBreakdown"]["direct"].replace(
            "The observation becomes emotionally persuasive before it becomes methodologically strong.",
            "The reading becomes emotionally persuasive before it becomes methodologically strong.",
        )
    if chapter_num == 6:
        cv["easy"]["chapterBreakdown"]["gentle"] = cv["easy"]["chapterBreakdown"]["gentle"].replace(
            "This chapter shows what happens when self-justification enters law.",
            "Law becomes dangerous when self-justification enters the case.",
        )
        cv["medium"]["chapterBreakdown"]["gentle"] = cv["medium"]["chapterBreakdown"]["gentle"].replace(
            "That is why wrongful conviction is not only a matter of one bad clue.",
            "Wrongful conviction is not only a matter of one bad clue for that reason.",
        )
        cv["medium"]["chapterBreakdown"]["competitive"] = cv["medium"]["chapterBreakdown"]["competitive"].replace(
            "That is why reversal gets so hard.",
            "For that reason reversal gets so hard.",
        )
        cv["hard"]["chapterBreakdown"]["direct"] = cv["hard"]["chapterBreakdown"]["direct"].replace(
            "That is why procedural safeguards matter so much.",
            "Procedural safeguards matter so much for that reason.",
        )
        cv["hard"]["chapterBreakdown"]["competitive"] = cv["hard"]["chapterBreakdown"]["competitive"].replace(
            "That is what makes post-conviction defense so fierce.",
            "Post-conviction defense is so fierce for that reason.",
        )
        cv["hard"]["chapterBreakdown"]["competitive"] = cv["hard"]["chapterBreakdown"]["competitive"].replace(
            "That is why innocence review can feel like treason against the machinery that produced the sentence.",
            "Innocence review can feel like treason against the machinery that produced the sentence for that reason.",
        )
    if chapter_num == 7:
        cv["easy"]["chapterBreakdown"]["gentle"] = cv["easy"]["chapterBreakdown"]["gentle"].replace(
            "This chapter shows how ordinary relationship conflict becomes harder to repair",
            "Ordinary relationship conflict becomes harder to repair",
        )
        cv["medium"]["chapterBreakdown"]["gentle"] = cv["medium"]["chapterBreakdown"]["gentle"].replace(
            "That is why the chapter focuses on asymmetric explanation.",
            "The chapter therefore focuses on asymmetric explanation.",
        )
        cv["hard"]["chapterBreakdown"]["competitive"] = cv["hard"]["chapterBreakdown"]["competitive"].replace(
            "That is why the fight stops being about dishes, tone, lateness, or money.",
            "Soon the fight stops being about dishes, tone, lateness, or money.",
        )
        cv["medium"]["chapterBreakdown"]["competitive"] = cv["medium"]["chapterBreakdown"]["competitive"].replace(
            "That is why the loop can keep winning even when both partners are exhausted by it.",
            "The loop can keep winning even when both partners are exhausted by it for that reason.",
        )
        cv["medium"]["chapterBreakdown"]["direct"] = cv["medium"]["chapterBreakdown"]["direct"].replace(
            "That is why apology, empathy, and future planning all struggle once the conflict has been moralized this heavily.",
            "Apology, empathy, and future planning all struggle once the conflict has been moralized this heavily for that reason.",
        )
        cv["hard"]["chapterBreakdown"]["gentle"] = cv["hard"]["chapterBreakdown"]["gentle"].replace(
            "That is why even real tenderness can feel unstable once grievance has become part of the moral architecture of the bond.",
            "Even real tenderness can feel unstable once grievance has become part of the moral architecture of the bond for that reason.",
        )
        cv["hard"]["chapterBreakdown"]["direct"] = cv["hard"]["chapterBreakdown"]["direct"].replace(
            "That is why sustained repair feels so unnatural inside the loop.",
            "Sustained repair feels so unnatural inside the loop for that reason.",
        )


def patch_dialogue(chapter_num, chapter):
    scenario = DIALOGUES[chapter_num]
    for example in chapter["examples"]:
        if example["format"] == "dialogue":
            example["scenario"] = copy.deepcopy(scenario)
            break


def repair_chapter(chapter_num, chapter):
    patch_dialogue(chapter_num, chapter)
    normalize_quiz(chapter)
    apply_full_replacements(chapter_num, chapter)
    apply_field_patches(chapter_num, chapter)
    fix_inline_text(chapter_num, chapter)
    apply_supplements(chapter_num, chapter)
    for (depth, tone), extra in TOPUPS.get(chapter_num, {}).items():
        append_text(chapter, depth, tone, extra)
    for (depth, tone), extra in FINAL_TOPUPS.get(chapter_num, {}).items():
        append_text(chapter, depth, tone, extra)
    for (depth, tone), extra in FINAL2_TOPUPS.get(chapter_num, {}).items():
        append_text(chapter, depth, tone, extra)


def review_package(chapter, created_at):
    num = chapter["number"]
    return {
        "schemaVersion": "1.1.0",
        "packageId": f"{BOOK_ID}-{RUN_ID}-ch{num:02d}",
        "createdAt": created_at,
        "contentOwner": "ChapterFlow",
        "book": {
            "bookId": BOOK_ID,
            "title": BOOK_TITLE,
            "author": BOOK_AUTHOR,
            "categories": BOOK_CATEGORIES,
            "tags": BOOK_TAGS,
            "edition": BOOK_EDITION,
            "variantFamily": "EMH",
            "chapterRange": f"Chapter {num} review package only",
        },
        "chapters": [chapter],
    }


def release_package(chapters, created_at):
    return {
        "schemaVersion": "1.1.0",
        "packageId": f"{BOOK_ID}-{RUN_ID}-release",
        "createdAt": created_at,
        "contentOwner": "ChapterFlow",
        "book": {
            "bookId": BOOK_ID,
            "title": BOOK_TITLE,
            "author": BOOK_AUTHOR,
            "categories": BOOK_CATEGORIES,
            "tags": BOOK_TAGS,
            "edition": BOOK_EDITION,
            "variantFamily": "EMH",
            "chapterRange": "1-9",
        },
        "chapters": chapters,
    }


def reseal(chapters):
    continuity = load_head_json(".chapterflow/runs/mistakes-were-made-but-not-by-me/20260410-224452/continuity/continuity-state.json")
    approved = continuity.setdefault("approvedChapterHashes", {})
    for chapter in chapters:
        approved[f"ch{chapter['number']:02d}"] = sha_obj(chapter)
    save_json(CONTINUITY_PATH, continuity)


def main():
    created_at = utc_now()
    chapters = []
    for chapter_num in range(1, 10):
        rel = f".chapterflow/runs/mistakes-were-made-but-not-by-me/20260410-224452/validated/ch{chapter_num:02d}.chapter.json"
        path = VALIDATED_DIR / f"ch{chapter_num:02d}.chapter.json"
        chapter = load_head_json(rel)
        repair_chapter(chapter_num, chapter)
        save_json(path, chapter)
        save_json(STRUCTURED_DIR / f"ch{chapter_num:02d}.chapter.json", chapter)
        save_json(VALIDATED_DIR / f"ch{chapter_num:02d}.review-package.json", review_package(chapter, created_at))
        chapters.append(chapter)

    chapters.sort(key=lambda item: item["number"])
    release = release_package(chapters, created_at)
    save_json(RELEASE_PATH, release)
    save_json(BOOK_PACKAGE_PATH, release)
    reseal(chapters)

    for chapter in chapters:
        for depth in ("easy", "medium", "hard"):
            tone_counts = {
                tone: words(chapter["contentVariants"][depth]["chapterBreakdown"][tone])
                for tone in ("gentle", "direct", "competitive")
            }
            print(f"ch{chapter['number']:02d} {depth}: {tone_counts}")


if __name__ == "__main__":
    main()
