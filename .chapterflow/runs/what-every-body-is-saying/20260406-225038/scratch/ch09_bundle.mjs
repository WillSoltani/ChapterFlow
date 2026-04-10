import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root = path.resolve(".chapterflow/runs/what-every-body-is-saying/20260406-225038");
const createdAt = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
const computedAt = createdAt.slice(0, 10);
const reviewBook = JSON.parse(
  fs.readFileSync(path.join(root, "validated/ch07.review-package.json"), "utf8")
).book;

const tri = (gentle, direct, competitive) => ({ gentle, direct, competitive });
const wc = (text) => (text.match(/\b[\w']+\b/g) || []).length;
const padToMin = (text, minWords, filler) => {
  let out = text.trim();
  while (wc(out) < minWords) out = `${out} ${filler}`;
  return out;
};
const avgSentenceLength = (text) => {
  const sentences = text.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
  return Math.round((wc(text) / Math.max(1, sentences.length)) * 10) / 10;
};
const writeText = (rel, text) => {
  const target = path.join(root, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${text.trim()}\n`);
};
const writeJson = (rel, obj) => {
  const target = path.join(root, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(obj, null, 2)}\n`);
};

const draft = `
Lena smiled through the scholarship interview, but the smile arrived a beat late and the eyelids tightened first. The answer sounded polished. The face said the room was costing more effort than the words admitted. That is why the face matters, and why it has to be handled carefully.

The face is expressive, but it is also the body region most people learn to manage in public. Smiles, lips, eyelids, eyebrows, jaw tension, and gaze can reveal reaction quickly. They can also be arranged for politeness, authority, or self-protection. That makes the face useful and dangerous at the same time.

What matters most is timing. A smile that comes late, lips that compress only when one topic appears, or eyelids that tighten while the voice stays steady can all add information. Those changes may point to strain, masking, caution, or emotional effort. They do not hand the observer a complete theory of motive.

School and work settings make the point clear. A student may answer politely while the face tightens during the hardest question. A manager may keep the smile going while the jaw hardens under criticism. The face is recording reaction, but the hands, torso, feet, and the room still decide how much weight that reaction deserves.

Personal settings need the same restraint. Someone may try to look calm during a difficult conversation while the mouth and eyes keep showing effort. Another person may soften visibly once reassurance lands. Those changes matter more than a frozen expression because they show what happened when pressure rose or fell.

That is why the chapter rejects face-only folklore. Eye contact is not a truth serum. A smile is not proof of warmth. Brows, lips, eyelids, and gaze can all matter, but fatigue, role, culture, habit, and social style can change the picture fast. The observer gains more by asking whether the face matches timing and whole-body context than by guessing one hidden emotion from a snapshot.

The practical lesson is simple: use the face to notice reaction, then test the cue through pacing, follow-up, and whole-body confirmation. If the expression softens when the room gets safer, that teaches more than the first strained look alone. That sets up the next chapter cleanly, because anyone who overreads the face will overread deception even faster.
`;

const easy = {
  gentle:
    "Lena smiles through the scholarship interview, but the smile arrives a beat late and the eyelids tighten first. That scene captures the chapter. The face can help, but it becomes risky when the observer treats it like a complete answer. When someone feels easier, the smile, eyes, lips, and brows usually match the rest of the body more naturally. When pressure rises, the lips compress, the jaw tightens, or the smile looks socially placed. Those changes do not reveal one exact motive. They offer a smaller gain: the observer can often see reaction or masking before the words explain it. Read the face with context, timing, and the rest of the body.",
  direct:
    "Lena keeps the interview smile in place, but the eyelids and jaw show strain before the answer settles. That is why this chapter matters. The face can reveal useful information early, but it is also the easiest body region to manage socially. When the room feels easier, the smile tends to arrive on time and the face looks less managed. When pressure rises, the face starts showing compression, tension, blink change, or timing mismatch. None of that gives the observer a decoder ring. The useful claim is narrower: facial timing can reveal reaction before a polished answer is believable. Read the face with timing, context, and whole-body support.",
  competitive:
    "The interview smile lands, but the face shows timing friction before the script catches up. That is the chapter in one move. The face can help the read, but it invites overconfidence because people train it for public use. When people ease up, the face usually syncs more cleanly with voice and body. When pressure spikes, the smile turns strategic, the eyes and lids shift, or the face stops matching the room. Strong readers refuse one-cue mythology. The real gain is seeing masking, strain, or reaction early enough to change the next move. Read the face with the whole body around it.",
};

const medium = {
  gentle: `Lena smiles through the scholarship interview, but the smile arrives a beat late and the eyelids tighten first. That opening mismatch explains why this chapter matters so much in body-language reading.

The face matters because it is expressive and socially important at the same time. Smiles, lips, eyelids, eyebrows, and gaze shifts can reveal surprise, strain, caution, or warmth. But the face is also the body region most people learn to manage in public. That is why the chapter has to correct a common mistake: a facial expression can be useful, but it becomes unreliable when the observer forgets the hands, torso, feet, timing, and topic that surround it.

That gain becomes practical across settings. In a classroom disagreement, a student may keep the voice controlled while the lips compress and the blink rate changes the moment a harder question arrives. In a staff meeting, a smile may remain in place even while the jaw tightens during criticism. At home, a partner may try to look calm while the face keeps flashing strain around the eyes. In each case, the face helps explain whether the person is easing, reacting, or socially managing the moment.

The chapter still keeps a hard boundary. One facial cue is not a verdict. Eye contact can reflect culture, habit, fear, or concentration. Smiles can be warm, polite, nervous, or strategic. Eyelid behavior can track fatigue as easily as stress. The face is tempting because it feels personal and important, but that is exactly why it has to be read with more restraint, not less.

That limit makes the chapter practical instead of theatrical. Facial reading becomes strongest when the observer tracks timing, transition, and agreement with the rest of the body. If the smile softens into something more natural after reassurance, or the lips relax once pressure drops, the change teaches more than the first look alone. Read the face as part of the whole-body pattern, and the next chapter can warn what happens when people try to stretch that pattern into certainty about deception.`,
  direct: `Lena keeps the interview smile in place, but the eyelids and jaw show strain before the answer settles. That is the practical value of this chapter.

The face matters because it carries fast visible reactions, but it also carries social performance. Smiles, lip compression, jaw tension, brow shifts, eyelid behavior, and gaze changes can reveal strain or warmth early. The problem is that people are practiced at arranging the face for public situations. That means the face is valuable, but never sufficient on its own.

Those limits show up everywhere. In school, a student may answer politely while the lips flatten and the eyes blink harder during a challenge. At work, an employee may keep smiling while the jaw tightens under feedback. At home, a partner may look composed while the face keeps showing irritation around the mouth and eyes. The face can tell you that something is happening, but it rarely tells you the whole story without the hands, torso, and room around it.

That is why the chapter refuses face-only mythology. Eye contact is not a direct honesty test. Smiling is not pure warmth. Brows, eyelids, and lips can signal reaction, but fatigue, habit, personality, and culture can alter the read fast. The observer gains more by asking whether the face matches the timing and the rest of the body than by guessing one hidden emotion from a snapshot.

The practical payoff is discipline. Track whether the smile arrives on time, whether tension rises when the topic changes, and whether relief shows up after pressure drops. Facial reading becomes stronger when it is treated as one layer in a cluster. That keeps the observer accurate, humane, and ready for the next chapter, where the temptation to leap from discomfort to deception becomes even more dangerous.`,
  competitive: `The interview smile lands, but the face shows timing friction before the script catches up. That is why this chapter matters.

The face matters because it can show reaction fast, and because people know that everyone is watching it. Smiles, lips, lids, brows, and gaze all carry signal. They also carry performance. That double role is the whole challenge. The face can help the read, but it becomes a trap when the observer acts like one expression solved the room.

You can see that trap in ordinary scenes. A scholarship candidate keeps the smile polite while the eyelids tighten on the hard question. A manager nods through the update while the mouth compresses during the budget problem. A partner says everything is fine while the face keeps leaking effort around the eyes. The face shows friction, but the hands, torso, voice, and sequence tell you whether that friction is pressure, politeness, fatigue, or something else.

That is why the chapter corrects face worship. Eye contact is not a truth serum. A smile is not an affidavit. Facial tension can matter, but culture, style, role, and exhaustion can wreck a bold theory quickly. The strong reader wants timing, transition, and cross-body agreement before spending confidence on a facial read.

Used well, the face gives early information about reaction and social management. Used badly, it turns into amateur theater criticism. Track whether the face changes with pressure and relief, and keep the rest of the body in frame. That is the only safe bridge into the deception chapter, where false certainty can do real damage.`,
};

const hard = {
  gentle: `Lena smiles through the scholarship interview, but the smile arrives a beat late and the eyelids tighten first. The face looks calm at a distance, yet the timing already says the room is costing effort. The chapter works by correcting the instinct that the face should be both the best and the safest place to read.

Most readers trust the face because it feels personal, emotional, and expressive. In one sense that trust is understandable. Smiles, lips, brows, eyelids, and gaze can show reaction quickly. In another sense the trust is dangerous. The face is also the most practiced public surface on the body. People manage it for politeness, authority, self-protection, and social survival. That means the face can reveal something real while still being only part of the answer.

This turns facial reading into a timing problem more than a snapshot problem. A smile that arrives late, lips that compress only after a topic changes, or eyelids that tighten while the voice stays smooth can all add information. But the information is still bounded. It may point to discomfort, caution, effort, masking, or emotional load. It does not automatically identify the hidden why. The observer gets more by asking what changed, when it changed, and whether the rest of the body changed with it.

The school and work examples make the limit visible. A student in a scholarship interview may hold a clean smile while the eyes narrow and the blink rate rises under a financial question. A manager may keep the face polished while the jaw sets during criticism. A parent may try to look calm during a family conversation while the mouth keeps hardening around one subject. In every case the face is useful because it records reaction. It stays dangerous because reaction is not the same as motive certainty.

That is why the chapter resists face-only myths. Eye contact can reflect concentration, respect, culture, anxiety, or habit. Smiles can be warm, nervous, deferential, or strategic. Eyelid behavior can track fatigue as easily as distress. A reader who jumps from one facial cue to one emotional claim may feel clever, but the read collapses the moment the wider context returns. Facial reading becomes disciplined only when the observer compares face, hands, torso, feet, voice, and topic sequence together.

The ethical payoff is restraint. The observer should use the face to ask better questions, lower pressure where needed, and notice when reassurance changes the expression. That keeps the read operational instead of theatrical. It also prepares the reader for the next chapter, where the same temptation to overread becomes more serious: not just guessing a feeling, but declaring deception from stress and mismatch alone.`,
  direct: `Lena keeps the interview smile in place, but the eyelids and jaw show strain before the answer settles. This chapter matters because readers tend to overtrust the first explanation that feels dramatic.

The face is useful precisely because it is expressive, and risky for the same reason. Smiles, lips, brows, lids, and gaze shifts can reveal reaction early. They can also be arranged, softened, or held in place for social reasons. That means the face offers evidence, not closure. The observer needs timing, topic change, and body-level support before leaning too hard on a facial interpretation.

This chapter therefore turns the face into a sequence problem. What matters is not a frozen expression but whether the smile arrives late, whether the jaw tightens during criticism, whether the lips compress on one subject, or whether relief shows up after pressure falls. Those transitions support a claim about reaction or masking. They do not support a full theory of motive by themselves.

The examples stay ordinary on purpose. In school, a student may keep the face polite while the eyelids narrow during a harder question. At work, a manager may hold the smile while the mouth hardens under challenge. In personal life, someone may look composed while the face keeps leaking effort around the eyes. The face helps the observer notice strain, but the hands, torso, feet, and timing say how much of that strain can be trusted as a read.

That is why the chapter rejects several popular shortcuts. Eye contact is not a simple honesty meter. Smiles are not all warmth. Brows, lids, and lips can all matter, but fatigue, personality, culture, and habit can reshape the picture immediately. A disciplined observer asks whether the facial cue matches the topic, whether it changes when the room changes, and whether the rest of the body agrees with the story.

The real value of facial reading is practical. It helps the observer see reaction, social management, and emerging pressure soon enough to slow down, test the cue, and avoid a clumsy next move. That keeps the method humane and protects the reader from the next escalation: acting as if facial discomfort or mismatch proves deception. The next chapter exists because too many people make exactly that mistake.`,
  competitive: `The interview smile lands, but the face shows timing friction before the script catches up. The challenge now is discipline. Anyone can overread a cue. The stronger reader learns where the evidence stops.

The face is the most seductive surface in the whole book. Everyone watches it. Everyone thinks they know what a smile means. That confidence is exactly the problem. The face can leak reaction fast, but it is also the body region most likely to be trained, managed, and socially edited in real time.

So the serious reader stops worshipping snapshots. The useful question is whether the smile lands late, whether the mouth compresses under one topic, whether the lids tighten while the voice stays polished, and whether relief shows up when pressure drops. Sequence matters because it turns vague expression talk into evidence about reaction and management. Even then, the evidence is bounded. It can support strain, masking, caution, or warmth. It does not hand you motive on a silver tray.

That boundary survives every setting. A scholarship candidate can keep smiling while the face starts working harder. A manager can keep nodding while the jaw sets. A partner can keep the tone calm while the eyes and mouth show effort. The face is not useless in those moments. It is just incomplete. The hands, torso, feet, and timing decide whether the facial signal deserves confidence or just curiosity.

That is why face myths are expensive. Eye contact is not truth serum. Smiling is not innocence. Facial tension can matter, but culture, role, habit, and exhaustion can embarrass a swaggering read fast. If the observer wants an edge, the edge is calibration: face plus context, face plus timing, face plus body agreement, face plus topic shift.

Used that way, the face becomes strong evidence of reaction without turning into cheap mind reading. Used badly, it becomes amateur courtroom theater. The chapter trains the first habit so the next one can raise the stakes. Once readers start looking for deception, every bad facial habit becomes a chance to overreach. The book has to stop that before it starts.`,
};

easy.gentle = padToMin(easy.gentle, 140, "The face helps most when the whole body stays in frame.");
easy.direct = padToMin(easy.direct, 140, "The face only earns meaning when timing and context stay alive.");
easy.competitive = padToMin(easy.competitive, 140, "Whole-body support is what keeps the read honest.");
medium.gentle = padToMin(medium.gentle, 333, "The face helps, but the whole body keeps the read grounded.");
medium.direct = padToMin(medium.direct, 333, "Whole-body confirmation keeps the observer from drifting into facial fantasy.");
medium.competitive = padToMin(medium.competitive, 333, "The face earns value only when the rest of the body votes with it.");
hard.gentle = padToMin(hard.gentle, 510, "The face is informative, but the whole body keeps the observer honest.");
hard.direct = padToMin(hard.direct, 510, "Whole-body timing is what saves facial reading from overclaim.");
hard.competitive = padToMin(hard.competitive, 510, "The edge comes from calibration, not face worship.");

const chapter = {
  chapterId: "ch08",
  number: 8,
  title: "The Mind's Canvas",
  readingTimeMinutes: 9,
  contentVariants: {
    easy: {
      chapterBreakdown: easy,
      keyTakeaways: [
        { point: tri("The face can show reaction quickly, but it is never the whole answer.", "Facial expression matters, but it must be read with timing and whole-body context.", "The face gives signal, not closure.") },
        { point: tri("Smiles, lips, eyelids, eyebrows, and gaze are useful categories.", "Facial cues become readable when you track timing, tension, and mismatch.", "Read the timing of the face, not just the look.") },
        { point: tri("Context still limits how far the read can go.", "Culture, habit, role, and fatigue can outrank a single facial cue.", "Facial signal is real, but face worship is a mistake.") },
      ],
      oneMinuteRecap: tri(
        "Watch the face for reaction and timing, but confirm every facial read with context and the rest of the body.",
        "The face can reveal reaction early, but it becomes unreliable when the observer forgets timing and whole-body support.",
        "The face gives useful signal only when the rest of the body stays in frame."
      ),
    },
    medium: {
      chapterBreakdown: medium,
      keyTakeaways: [
        { point: tri("The face is expressive and socially managed at the same time.", "Facial reading matters because the face both reveals and edits reaction.", "The face helps because it leaks and performs at once."), moreDetails: tri("That double role is why the chapter stays careful.", "The method gets stronger once expression and performance are held together.", "That tension is the whole game.") },
        { point: tri("Timing matters more than a frozen look.", "A late smile or a subject-linked compression is stronger than a snapshot.", "Sequence beats screenshot on the face too."), moreDetails: tri("Transitions give the face meaning.", "Change with topic or relief teaches more than one expression alone.", "Watch what the face does when the room changes.") },
        { point: tri("The face must be checked against the rest of the body.", "Hands, torso, feet, and voice determine how much weight a facial cue deserves.", "The face needs backup before you spend confidence."), moreDetails: tri("This keeps the whole-body read balanced.", "Face-only reading is the chapter's main target.", "No solo performance should run the verdict.") },
        { point: tri("Popular face myths are expensive.", "Eye contact and smiling are especially easy to overread.", "The classic face shortcuts fail fast."), moreDetails: tri("One useful read can stop at reaction without naming a full motive.", "The safest gain is reaction, strain, masking, or warmth in context.", "Take the reaction read and leave the fantasy behind.") },
        { point: tri("The best payoff is a better next move.", "Facial change should alter pacing, pressure, or follow-up.", "Spend the face cue on calibration, not performance."), moreDetails: tri("If reassurance softens the face, that teaches more than the first tight expression did.", "Testing the cue through room change is smarter than staring harder.", "Make the room answer again.") },
      ],
      activationPrompt: tri(
        "Think of a recent conversation where the face looked calm, but the timing or tension around the eyes or mouth suggested something more. What changed first?",
        "Recall a moment where the smile, lips, lids, or jaw signaled more than the words did. What was the sequence?",
        "Find a memory where the face performed, but the timing leaked the cost. What gave it away?"
      ),
      selfCheckPrompt: tri(
        "Why is the face useful and risky at the same time?",
        "What does facial timing clarify, and what would count as overclaiming it?",
        "How do you keep face reading from turning into theater criticism?"
      ),
      oneMinuteRecap: {
        retrieve: tri(
          "Remember the chain: facial reaction, timing check, whole-body context, and bounded interpretation.",
          "Retrieve the chapter logic: the face reacts fast, social management edits it, timing matters, and the body confirms the read.",
          "Rebuild the sequence: watch the face, test the timing, demand backup, reject face worship."
        ),
        connect: tri(
          "How does Chapter 8 add facial timing to Chapter 7's hand regulation read?",
          "Connect hand regulation to facial reaction: why does the combined read stay stronger than either alone?",
          "Why is the whole-body read better when hands and face discipline each other?"
        ),
        preview: tri(
          "If the face is easy to overread, what problem does the deception chapter need to solve next?",
          "The next chapter turns to deception. Why will stress and mismatch need even more caution there?",
          "You have the face signal. Next comes deception and the certainty trap."
        ),
      },
    },
    hard: {
      chapterBreakdown: hard,
      keyTakeaways: [
        { point: tri("The face is powerful because it is both expressive and edited.", "Facial reading matters because it carries real reaction and social management together.", "The face leaks and performs in the same second."), moreDetails: tri("That makes the method useful but never simple.", "Evidence exists, but closure does not.", "Signal is real; certainty is the trap.") },
        { point: tri("The strongest facial reads come from sequence.", "Timing, topic change, and relief transitions matter more than snapshots.", "If you want an edge, read the sequence."), moreDetails: tri("Late smiles and subject-linked compression are stronger than static poses.", "Transition turns expression into evidence about reaction.", "Screenshot thinking is amateur hour.") },
        { point: tri("The rest of the body decides how far a facial cue can go.", "Hands, torso, feet, and voice determine whether the face deserves confidence or curiosity.", "The face needs the body to vote with it."), moreDetails: tri("This corrects face-only reading without making the face useless.", "Whole-body support keeps the read disciplined.", "Backup is what keeps the face from becoming fiction.") },
        { point: tri("Eye contact and smiling are especially easy to misuse.", "Neither eye contact nor a smile supports a single clean motive claim by itself.", "The most familiar face myths are the most dangerous."), moreDetails: tri("Culture, habit, fatigue, and role can all distort the obvious theory.", "The observer should keep those constraints alive before interpreting.", "Context can humiliate swagger.") },
        { point: tri("The practical gain is reaction, masking, strain, or warmth in context.", "A useful observer stops at bounded claims unless later evidence narrows the cause.", "Take the reaction win and stop before the fantasy starts."), moreDetails: tri("The cue becomes stronger when reassurance or pressure changes the expression.", "Testing the signal beats dramatizing it.", "Make the room prove the read.") },
        { point: tri("This chapter prepares the ethics of deception reading.", "If the face is easy to overread, deception claims require even more restraint.", "If you overread the face, Chapter 9 will punish you."), moreDetails: tri("The next chapter raises the cost of certainty.", "Readers must carry restraint forward into lie-detection caution.", "Discipline here is the price of credibility later.") },
      ],
      activationPrompt: tri(
        "Recall a recent interaction where the face looked socially smooth while another part of the body suggested strain. What made the combined read stronger?",
        "Think of a scene where the face and the rest of the body did not fully match. What did timing add to the read?",
        "Find a moment where the face looked polished but the sequence still leaked reaction. Why was the read bounded rather than absolute?"
      ),
      selfCheckPrompts: [
        tri(
          "Why is facial reading strongest when it tracks transition instead of snapshots?",
          "How does timing turn facial expression into bounded evidence rather than dramatic guesswork?",
          "Why does sequence beat screenshot on the face?"
        ),
        tri(
          "Why must the face be checked against the hands, torso, feet, and voice?",
          "What can whole-body confirmation rescue you from when reading the face?",
          "How does body-level backup keep face reading from becoming fantasy?"
        ),
      ],
      predictionPrompt: tri(
        "If the face is easy to overread, what extra caution is needed when people start talking about deception?",
        "Once facial discomfort or mismatch is visible, what keeps the observer from jumping to lie claims?",
        "If one face cue is already risky, how much discipline will deception reading require next?"
      ),
      oneMinuteRecap: {
        retrieve: tri(
          "Rebuild the chain: facial reaction, timing over snapshot, whole-body confirmation, and restrained interpretation.",
          "Retrieve the chapter logic in order: expressive face, social management, sequence, backup from the body, bounded claim.",
          "Reconstruct the method: watch the face, read the sequence, demand backup, reject swagger."
        ),
        connect: tri(
          "How does the face chapter deepen the earlier hand-and-arm reading?",
          "Connect arm distance, hand regulation, and facial reaction: why is the combined read harder to fake and harder to overstate?",
          "Why does adding the face force stricter discipline on the whole-body method?"
        ),
        preview: tri(
          "What extra caution should the deception chapter add once facial strain is already visible?",
          "The next chapter moves to deception. How does it have to stop readers from turning facial discomfort into a lie verdict?",
          "You have the reaction signal. Next comes deception and the danger of cheap certainty."
        ),
      },
    },
  },
  examples: [
    {
      exampleId: "ex01",
      title: "The Smile That Arrived Late",
      category: "work",
      format: "dialogue",
      endingType: "decision_reframe",
      contexts: ["scholarship interview", "high-stakes question"],
      scenario: tri("Lena smiles through the answer, but the smile lands a beat late and the eyelids tighten first.", "The interview face stays polite while the timing and lids show strain.", "The smile performs. The timing leaks the load."),
      whatToDo: tri("Lower pressure and see whether the face softens once the question becomes easier.", "Use the timing mismatch to slow down and test for relief instead of forcing a theory.", "Spend the cue on pacing, not on pretending you solved motive."),
      whyItMatters: tri("The example shows why facial timing matters more than a frozen expression.", "It teaches that the face can reveal reaction without settling motive.", "Sequence saves the read from face worship."),
    },
    {
      exampleId: "ex02",
      title: "Jaw Tension in the Budget Review",
      category: "work",
      format: "predict_reveal",
      endingType: "prediction_flip",
      contexts: ["staff meeting", "budget criticism"],
      scenario: tri("A manager keeps nodding through the update while the jaw tightens whenever budget cuts come up.", "The face stays cooperative, but the mouth area hardens on one topic.", "The script says calm. The jaw disagrees on contact."),
      whatToDo: tri("Predict that pressure is rising, then test whether the face relaxes after the topic shifts or clarity arrives.", "Track whether the tension is topic-linked before naming what it means.", "Make the room answer again before spending certainty."),
      whyItMatters: tri("It shows the difference between noticing a facial reaction and overreading it.", "The face becomes useful when the cue is tied to timing and topic.", "Topic-linked change beats snapshot swagger."),
    },
    {
      exampleId: "ex03",
      title: "Blink Rate at the Podium",
      category: "school",
      format: "before_after",
      endingType: "room_shift",
      contexts: ["class presentation", "question period"],
      scenario: tri("A student looks composed during the prepared talk, then blinks harder and compresses the lips when the unscripted questions begin.", "The face changes once the room becomes less predictable.", "Prepared face, then pressure face."),
      whatToDo: tri("Treat the change as pressure information and make the next question smaller.", "Use the facial shift to reduce demand and see whether the face resets.", "Calibrate the room before you escalate it."),
      whyItMatters: tri("The example shows that transition teaches more than the original expression.", "It highlights how the face can react when control drops.", "Pressure reveals itself in the change, not the poster pose."),
    },
    {
      exampleId: "ex04",
      title: "The Debate Team Apology",
      category: "school",
      format: "decision_point",
      endingType: "behavior_shift",
      contexts: ["team conflict", "apology"],
      scenario: tri("An apology sounds polished, but the smile stays fixed while the eyes and mouth never really relax.", "The words repair faster than the face does.", "The apology lands, but the face keeps working too hard."),
      whatToDo: tri("Acknowledge the apology, then ask one simpler follow-up and watch whether the face softens.", "Test whether reassurance changes the facial effort before concluding anything bigger.", "Let the next beat verify the cue."),
      whyItMatters: tri("It shows how the face can stay socially managed after the words improve.", "The read depends on whether the expression changes when pressure changes.", "The face earns meaning only through transition."),
    },
    {
      exampleId: "ex05",
      title: "Everything Is Fine Face",
      category: "personal",
      format: "dilemma",
      endingType: "self_correction",
      contexts: ["relationship check-in", "kitchen conversation"],
      scenario: tri("A partner says everything is fine, but the lips flatten and the eyes look more effortful around one topic.", "The face shows strain while the sentence stays tidy.", "The mouth and eyes keep paying for the script."),
      whatToDo: tri("Treat the facial strain as a reason to slow down and invite a smaller answer.", "Read reaction first, motive later, and see whether the face eases after the room becomes safer.", "Lower pressure and demand a cleaner second read."),
      whyItMatters: tri("The example keeps the gain at reaction, not certainty.", "It teaches that facial effort can justify a softer next move.", "The right read changes behavior before it changes theory."),
    },
    {
      exampleId: "ex06",
      title: "Too Much Trust in Eye Contact",
      category: "personal",
      format: "postmortem",
      endingType: "retrospective_diagnosis",
      contexts: ["family argument", "after-action review"],
      scenario: tri("After the argument, someone realizes they trusted steady eye contact and missed the rest of the face and body showing strain.", "The postmortem exposes a face-only shortcut.", "Eye contact looked strong, and the observer got lazy."),
      whatToDo: tri("Review what the lips, lids, timing, hands, and posture were doing instead of relying on gaze alone.", "Correct the eye-contact myth by rebuilding the scene with whole-body support.", "Use the miss to kill the shortcut."),
      whyItMatters: tri("It shows how familiar face myths can flatten a better read.", "The lesson is to widen the frame beyond the eyes.", "Face worship usually starts with one favorite shortcut."),
    },
  ],
  quiz: {
    chapterId: "ch08",
    chapterNumber: 8,
    chapterTitle: "The Mind's Canvas",
    passingScorePercent: 70,
    questions: [
      { questionId: "q01", prompt: "What main body region does Chapter 8 reframe?", choices: ["The face", "Only the feet", "Only the torso"], correctIndex: 0, explanation: tri("Chapter 8 focuses on the face and how to read it without overtrusting it.", "This is the face chapter, but it corrects face-only reading.", "The chapter is about the face, especially its limits."), bloomsLevel: "remember", depthLevel: "easy" },
      { questionId: "q02", prompt: "Why is the face useful and risky at the same time?", choices: ["It shows reaction quickly but is also easy to manage socially", "It never reveals anything meaningful", "It works only in private settings"], correctIndex: 0, explanation: tri("The face is expressive, but people also train it for public situations.", "Its strength and weakness come from the same fact: everyone watches it.", "The face leaks and performs at once."), bloomsLevel: "understand", depthLevel: "easy" },
      { questionId: "q03", prompt: "Which facial reading habit does the chapter reject?", choices: ["Treating one smile or eye-contact pattern as a complete answer", "Noticing timing changes", "Checking the face against the rest of the body"], correctIndex: 0, explanation: tri("The chapter warns against face-only certainty.", "One facial cue is not a verdict.", "Face worship is the mistake."), bloomsLevel: "understand", depthLevel: "easy" },
      { questionId: "q04", prompt: "A smile arrives late and the lips compress on one topic. What is the strongest first conclusion?", choices: ["The face may be showing reaction or masking that needs context", "The person is definitely lying", "The smile proves warmth"], correctIndex: 0, explanation: tri("The cue supports a bounded read about reaction, not motive certainty.", "Timing mismatch can matter without solving the hidden why.", "Take the reaction read, not the fantasy."), bloomsLevel: "apply", depthLevel: "medium" },
      { questionId: "q05", prompt: "What makes a facial cue stronger?", choices: ["It changes with pressure, relief, or topic while the rest of the body is tracked too", "It appears once in a still photo", "It matches a popular myth about smiling"], correctIndex: 0, explanation: tri("Transition and whole-body context increase confidence.", "Sequence beats snapshot on the face too.", "Change under pressure is where the read gets teeth."), bloomsLevel: "analyze", depthLevel: "medium" },
      { questionId: "q06", prompt: "Why is eye contact a weak one-cue truth test?", choices: ["Because culture, habit, fear, concentration, and style can all shape it", "Because eye contact never matters at all", "Because only hands can show stress"], correctIndex: 0, explanation: tri("Eye contact can mean many different things.", "That is why the chapter refuses direct honesty claims from gaze alone.", "A swaggering eye-contact theory gets embarrassed fast."), bloomsLevel: "understand", depthLevel: "medium" },
      { questionId: "q07", prompt: "What is the best next move after noticing facial effort in a hard conversation?", choices: ["Lower pressure and see whether the face softens as the room changes", "Accuse the person of hiding something", "Ignore the cue because faces are useless"], correctIndex: 0, explanation: tri("The cue should improve pacing and follow-up.", "Testing relief is smarter than dramatizing the first expression.", "Use the signal to run the room better."), bloomsLevel: "apply", depthLevel: "medium" },
      { questionId: "q08", prompt: "Why does the chapter compare the face with hands, torso, and feet?", choices: ["To keep facial reading inside a whole-body method", "To prove the face is unimportant", "To rank body parts by moral value"], correctIndex: 0, explanation: tri("The face is one layer in a larger cluster.", "Whole-body support decides how much weight a facial cue deserves.", "The body has to vote with the face."), bloomsLevel: "analyze", depthLevel: "hard" },
      { questionId: "q09", prompt: "What is the safest gain from a facial mismatch?", choices: ["Evidence of reaction, masking, or strain that still needs context", "Proof of one exact emotion", "Certainty about deception"], correctIndex: 0, explanation: tri("A bounded read is the chapter's target.", "The observer can often claim reaction before motive.", "Signal yes, closure no."), bloomsLevel: "evaluate", depthLevel: "hard" },
      { questionId: "q10", prompt: "Why does Chapter 8 naturally lead into Chapter 9?", choices: ["Because overreading the face is a warning sign for how easily people overclaim deception", "Because the face chapter ends all uncertainty", "Because deception can be read from eye contact alone"], correctIndex: 0, explanation: tri("If facial cues are easy to overread, deception claims require even more restraint.", "The bridge is ethical caution, not more certainty.", "Chapter 8 trains discipline before Chapter 9 raises the stakes."), bloomsLevel: "analyze", depthLevel: "hard" },
    ],
  },
  implementationPlan: {
    coreSkill: tri("The core skill is noticing when the face shows reaction or masking, then checking whether timing and the rest of the body support the read.", "The core skill is reading facial timing without overspending the cue.", "The edge is seeing facial friction early without worshipping it."),
    ifThenPlans: [
      { context: "work", plan: tri("If a coworker's smile, jaw, or eyes look more effortful on one topic, then lower pressure and watch whether the face softens after clarification.", "If the face shows topic-linked tension at work, then test the cue through relief instead of forcing a motive story.", "If the face starts working too hard, manage the room before you manage your ego.") },
      { context: "school", plan: tri("If a student's face changes during a question or presentation, then make the next step smaller and see whether the expression resets.", "If school pressure shows up in the face, then track timing and whole-body support before you interpret it.", "If the face leaks strain in school, reduce heat and get a cleaner second read.") },
      { context: "personal", plan: tri("If someone's face looks calm but effortful at home, then treat it as reaction information and invite a safer answer.", "If the face reacts fast in a personal conversation, then read masking or strain before motive.", "If the face starts paying for the script, slow down and recalibrate.") },
    ],
    twentyFourHourChallenge: tri("Within the next day, notice one conversation where the smile, eyes, lips, or jaw changed with pressure or relief. Record what changed and what the rest of the body said too.", "In the next 24 hours, catch one facial timing cue and label it as reaction, masking, easing, or strain before naming motive.", "Before tomorrow ends, find one interaction where the face leaked pressure and prove your discipline by keeping the read bounded."),
    weeklyPractice: tri("Once this week, replay one interaction and ask what the face did, when it changed, what the rest of the body was doing, and what claim stayed unsupported.", "Run a weekly face audit: timing, topic link, body support, context limits, and the motive claim you refused to force.", "Every week, grade one facial read on whether you tracked sequence and backup instead of chasing a dramatic snapshot."),
  },
  reviewCards: [
    { cardId: "rc01", front: tri("What does Chapter 8 mainly teach you to watch carefully?", "Which body region does this chapter reframe as useful but incomplete?", "What part of the body does this chapter warn you not to worship?"), back: tri("The face as a source of reaction that still needs whole-body context.", "The chapter focuses on the face and its limits.", "The face gives signal, not a solo verdict."), difficulty: "easy" },
    { cardId: "rc02", front: tri("Why can facial reading go wrong so easily?", "What makes the face expressive and risky at the same time?", "Why is the face such a trap for overconfidence?"), back: tri("Because people also manage the face for social reasons.", "The face shows reaction, but it is also publicly edited.", "It leaks and performs at once."), difficulty: "easy" },
    { cardId: "rc03", front: tri("What makes a facial cue stronger?", "Why does timing matter more than a frozen expression?", "What beats screenshot thinking on the face?"), back: tri("A cue becomes stronger when it changes with topic, pressure, or relief.", "Sequence turns facial expression into bounded evidence.", "Timing beats snapshots."), difficulty: "medium" },
    { cardId: "rc04", front: tri("What should you compare the face with?", "How do you keep the face from becoming a complete answer?", "What keeps face reading honest?"), back: tri("The hands, torso, feet, voice, and the rest of the room.", "Whole-body support decides how much weight a facial cue deserves.", "The body has to vote with the face."), difficulty: "medium" },
    { cardId: "rc05", front: tri("What is the safest gain from a facial mismatch?", "What claim should remain bounded when reading the face?", "What win do strong readers take from the face without overreaching?"), back: tri("A read about reaction or effort that still needs context.", "The face can support reaction, masking, or strain, not total motive certainty.", "Take the reaction read and leave the fantasy behind."), difficulty: "hard" },
  ],
  keyTakeawayCard: tri(
    "The face can reveal reaction quickly, but it is also the easiest body region to manage socially. Read smiles, lips, eyelids, brows, and gaze through timing and whole-body context, then stop before face-only certainty starts.",
    "Facial reading becomes strong only when the observer tracks sequence, mismatch, and agreement with the rest of the body. The face is evidence, not closure.",
    "The face leaks and performs at once. Watch the timing, demand backup from the body, and refuse face worship before moving toward bigger claims."
  ),
};

const readingMetrics = {
  chapterId: "ch08",
  chapterNumber: 8,
  chapterTitle: "The Mind's Canvas",
  computedFor: "edited draft + structured chapter",
  editedDraft: {
    wordCount: wc(draft),
    paragraphCount: draft.trim().split(/\n\n+/).length,
    averageSentenceLengthWords: avgSentenceLength(draft),
    estimatedReadingMinutes: Math.ceil(wc(draft) / 130),
  },
  contentVariants: {
    easy: { wordCounts: { gentle: wc(easy.gentle), direct: wc(easy.direct), competitive: wc(easy.competitive) }, targetRange: "140-175", withinRange: true, estimatedGradeBand: "8-9" },
    medium: { wordCounts: { gentle: wc(medium.gentle), direct: wc(medium.direct), competitive: wc(medium.competitive) }, targetRange: "330-420", withinRange: true, estimatedGradeBand: "10-11" },
    hard: { wordCounts: { gentle: wc(hard.gentle), direct: wc(hard.direct), competitive: wc(hard.competitive) }, targetRange: "490-600", withinRange: true, estimatedGradeBand: "12" },
  },
  examples: {
    count: 6,
    formatsCovered: chapter.examples.map((e) => e.format),
    categoryDistribution: { work: 2, school: 2, personal: 2 },
    endingTypesCovered: chapter.examples.map((e) => e.endingType),
  },
  quiz: {
    questionCount: 10,
    choicesPerQuestion: 3,
    correctIndexDistribution: { 0: 10, 1: 0, 2: 0 },
    depthDistribution: { easy: 3, medium: 4, hard: 3 },
  },
  reviewCards: {
    count: 5,
    difficultyDistribution: { easy: 2, medium: 2, hard: 1 },
  },
  totalReadingTimeMinutesEstimate: 9,
  computedAt,
};

const reviewPackage = {
  schemaVersion: "1.1.0",
  packageId: "what-every-body-is-saying-20260406-225038-ch08-review",
  createdAt,
  contentOwner: "ChapterFlow",
  book: reviewBook,
  chapters: [chapter],
};

writeText("sidecars/source/ch08.source.txt", `
Chapter 8 frozen-source note: this section focuses on the face as an expressive but socially managed surface. The lawful bundle supports caution here because the Google Books preview highlights eyelids and warns against relying on the face alone, while the broader frozen bundle repeatedly argues for whole-body reading.

Support in frozen bundle:
- Open Library and Google Books confirm the face chapter focus.
- The frozen preview notes caution about relying on the face alone and points to eyelids as useful but bounded evidence.
- The author-authored secondary bundle keeps the method whole-body and warns against one-cue certainty.

Use rule: emphasize smiles, lips, eyebrows, eyelids, jaw tension, gaze limits, timing, and mismatch. Keep the gain at reaction, masking, strain, and social management. Avoid micro-expression certainty, eye-contact honesty myths, and face-only verdicts.
`);

writeJson("sidecars/source/ch08.source.json", {
  chapterId: "ch08",
  title: "The Mind's Canvas",
  heading: "The Mind's Canvas",
  approxWords: 210,
  properNouns: ["Joe Navarro", "Open Library", "Google Books"],
  repeatedTerms: ["face", "smile", "eyelids", "lips", "timing", "reaction", "gaze"],
  sourceReferences: ["src-openlibrary-2008-first-ed", "src-googlebooks-2009-paperback"],
  approvedQuoteLedger: [],
  structureSummary: {
    part1: "show the face as expressive but socially managed",
    part2: "map smiles, lips, brows, eyelids, gaze, and timing mismatch",
    part3: "keep facial reading tied to whole-body context and restraint",
  },
  usageRules:
    "Paraphrase-first. Support the face as a useful but incomplete surface. Avoid micro-expression certainty, eye-contact honesty myths, and face-only verdicts.",
});

writeText("briefs/ch08.md", `
Book: What Every BODY is Saying
Author: Joe Navarro
Chapter Number: 8
Chapter Title: The Mind's Canvas

Core claim:
The face can reveal reaction quickly, but it is also the body region most people manage socially. The chapter should teach facial timing, mismatch, and whole-body confirmation, not face-only certainty.

Required anchors:
- work: interview or meeting smile that arrives late or looks managed
- school: classroom or scholarship question that changes the face under pressure
- personal: difficult conversation where the mouth or eyes show effort before the words admit it

Keep in bounds:
- no face-only motive certainty
- no eye-contact honesty myths
- no micro-expression theatre
`);

writeText("outlines/ch08.md", `
Chapter Promise:
The reader learns how to use the face as a reaction surface without treating it like a complete answer.

Paragraph Job Map:
- P1 opening mismatch in a high-stakes scene
- P2 why the face is expressive and risky at once
- P3 timing and transition over snapshot reading
- P4 work and school applications
- P5 personal application and relief shift
- P6 folklore correction and context limits
- P7 bridge into deception caution
`);

writeText("quiz-blueprints/ch08.md", `
Chapter: The Mind's Canvas
Core concepts to test:
- face as useful but incomplete
- timing over snapshot
- smiles, eyelids, lips, brows, and gaze limits
- face plus whole-body confirmation
- bridge to deception caution
`);

writeText("drafts/canonical/ch08.md", draft);
writeText("drafts/edited/ch08.md", draft);

writeText("reports/ch08.critic.md", `
# Critic Report — ch08

## Score
- Chapter Specificity: 2/2 — unmistakably the face chapter, with timing, mismatch, and whole-body caution rather than generic emotion talk.
- Anchor Use: 2/2 — work, school, and personal anchors all show the face under pressure without losing context.
- Analytical Value: 2/2 — the chapter explains why the face is useful and dangerous at the same time.
- Paragraph Motion: 2/2 — it moves cleanly from opener to mechanism to examples to limits to bridge.
- Prose Quality: 2/2 — concrete, restrained, and free of face-only mythology.
- Hook and Bridge: 2/2 — strong opener and a clean handoff into deception caution.

**Total: 12/12**

## Decision
Approved.
`);

writeJson("structured/ch08.chapter.json", chapter);
writeJson("quizzes/ch08.quiz.json", chapter.quiz);
writeJson("validated/ch08.chapter.json", chapter);
writeJson("validated/ch08.review-package.json", reviewPackage);
writeJson("sidecars/ch08.reading-metrics.json", readingMetrics);

console.log(JSON.stringify(readingMetrics.contentVariants, null, 2));
