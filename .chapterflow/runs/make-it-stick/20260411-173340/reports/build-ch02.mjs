import fs from "node:fs";
import path from "node:path";

const runRoot = "/Users/willsoltani/dev/chapterflow-siliconx/.chapterflow/runs/make-it-stick/20260411-173340";

const chapter = {
  chapterId: "ch02",
  number: 2,
  title: "To Learn, Retrieve",
  readingTimeMinutes: 7,
  contentVariants: {
    easy: {
      chapterBreakdown: {
        gentle: `A learner often chooses another reread because it feels calmer than testing memory. The notes stay open, the answer remains visible, and confidence gets to stay warm. This chapter explains why the rougher move is often better. Trying to retrieve an idea from memory is not only a way to check learning after the fact. It is one of the things that helps make learning last. A self-quiz, a blank-page summary, or an oral explanation asks memory to produce instead of merely recognize. That effort reveals what is really available and what still needs repair. A missed recall is not automatically a failure of the method. It can be the useful signal that another reread would have hidden. The chapter's main lesson is simple: low-stakes retrieval is a learning event, not just a score.`,
        direct: `Most learners think of quizzes as tools for judging what they know. The authors narrow the point and make it stronger. Trying to recall from memory helps build later recall better than repeated exposure alone. Another reread can refresh familiarity while the answer stays in view. Retrieval removes that support and asks memory to reconstruct the idea. That reconstruction is part of what strengthens learning. Low-stakes quizzes, self-testing, flashcards, and blank-page summaries all use this mechanism. They pressure recall before the learner has fully forgotten and show what still needs repair. The chapter is not saying every failed recall is good by itself. It is saying that honest recall attempts, followed by correction, help create more durable learning than passive review alone.`,
        competitive: `Another reread feels safe because it lets the page keep helping. Retrieval feels riskier because memory has to work without a shield. The chapter takes that risk and turns it into a weapon. A recall attempt is not only a report card. It is part of how the learning gets tougher. When you quiz yourself, explain an idea out loud, or try a blank-page summary, memory has to produce instead of coasting on recognition. That pressure exposes weak spots fast. It also makes later access stronger when you repair what failed. The chapter does not worship getting things wrong for its own sake. It cares about low-stakes retrieval that reveals the gap while there is still time to fix it. The real shift is to stop treating quizzes as threats and start treating retrieval as one of the engines of learning.`
      },
      keyTakeaways: [
        { point: { gentle: "Retrieval helps build learning, not just measure it.", direct: "Recall attempts are part of the learning process.", competitive: "Quizzing can toughen memory, not just judge it." } },
        { point: { gentle: "Another reread is weaker than pulling the answer back from a closed page.", direct: "Another reread does less than a real recall attempt.", competitive: "The page is a weaker teacher than memory forced to produce." } },
        { point: { gentle: "A missed recall can be useful if it leads to repair.", direct: "Failed retrieval can expose what needs correction.", competitive: "An honest miss can do more for learning than a flattering reread." } }
      ],
      oneMinuteRecap: {
        gentle: { retrieve: "What is the chapter's main claim about retrieval?", connect: "Why can a self-quiz help learning more than another reread?", preview: "What new issue appears once retrieval is working and practice design becomes the next concern?" },
        direct: { retrieve: "How does the chapter redefine quizzes and self-testing?", connect: "Why does recall strengthen memory differently from repeated exposure?", preview: "Why would the next chapter move from retrieval itself to the way practice is arranged?" },
        competitive: { retrieve: "What false idea about quizzes does the chapter break first?", connect: "Why is reconstruction stronger than letting the page keep feeding the answer?", preview: "If retrieval works, what has to change next in the design of practice?" }
      }
    },
    medium: {
      chapterBreakdown: {
        gentle: `A learner who has just finished Chapter 1 can still slip back into the same comfortable habit. The notes remain open. Another reread feels calm. A self-quiz feels exposed because it might reveal forgetting. This chapter turns that exposed feeling into a new understanding. Retrieval is not simply a way to inspect learning after it is complete. It is one of the acts that helps learning become durable in the first place.

The contrast with repeated exposure is what gives the chapter its force. Looking at the page again can refresh familiarity and make the material feel easier to move through. A retrieval attempt asks for something different. The learner has to reconstruct the answer without the words sitting there. That reconstruction reveals what is available, what is weak, and what only looked secure while cues remained attached. The chapter argues that this effort is not just diagnostic. It changes memory by making later recovery stronger.

This is why the authors reframe quizzes, flashcards, oral explanation, and short written recall checks. In ordinary school memory, a quiz is often treated as a judgment scene that sorts success from failure. The chapter narrows the concept and makes it more practical. A low-stakes quiz can be a learning event. It pressures recall while there is still time to correct what does not come back cleanly.

That point protects the chapter from sounding punitive. Retrieval is not useful because pressure is noble. It is useful because reconstruction strengthens access and exposes repair targets. A failed recall attempt often means the method is honest, not broken. Another reread might have hidden the same weakness by leaving the answer in sight.

Still, the chapter keeps an important boundary. A miss should lead to feedback, correction, and another try. Empty frustration is not the goal. Productive retrieval depends on enough support that the learner can repair what failed instead of simply proving they were unprepared.

The chapter therefore gives the reader a concrete routine: close the notes, retrieve, check, repair, and retrieve again. It is the book's first full mechanism chapter because it does more than warn against bad habits. It gives the learner a disciplined practice that can replace them. Once retrieval is understood this way, the next problem becomes larger. Practice itself has to be arranged so memory stays flexible and usable, not just strong in one format. That opens the door to Chapter 3.`,
        direct: `Quizzes usually look like final checks or judgment scenes. This chapter reclassifies them. Retrieval is not only a way to measure whether learning happened. It is one of the ways learning is strengthened. This matters because many students and workers still keep recall at the very end instead of using it during learning. Low-stakes recall attempts help build later recall better than repeated exposure alone.

The mechanism is reconstruction. Another reread can refresh familiarity because the material stays present. Retrieval removes that support and asks memory to produce. That is why it can feel harsher. The learner finds out quickly what is available and what is not. The chapter argues that this pressure is useful because it both exposes weakness and strengthens later access when the idea is successfully brought back.

This is why the chapter treats self-testing, short quizzes, flashcards, oral explanation, and blank-page summaries as part of learning rather than as external audits. They force memory to work while correction is still possible. When recall succeeds, the memory trace becomes more durable. When recall fails, the learner gets a clear repair target instead of a vague feeling of familiarity.

The chapter is careful not to turn this into a simplistic celebration of struggle. Retrieval is not valuable because it feels hard. It is valuable because it makes memory reconstruct. If the learner misses, the next step should be feedback and another attempt. Otherwise the process can collapse into frustration rather than improvement.

That boundary matters because a common misreading is to equate retrieval with pressure-heavy testing. The chapter is arguing for low-stakes recall that strengthens learning, not for anxiety as pedagogy. Its practical sequence is tighter and more humane: retrieve, check, repair, and repeat.

This chapter stands apart from the first because it no longer speaks only in warnings. It offers a mechanism the learner can use immediately. Once that mechanism is accepted, the book can widen again. The next question is how practice should be organized so learning does not become rigid or overfit to one pattern. That is the bridge into mixing and variation.`,
        competitive: `Learners think of quizzes as scoreboards. The authors break that frame. Retrieval is not just what happens after learning so someone can judge it. Retrieval is part of how learning gets stronger.

That shift matters because another reread and a recall attempt are not doing the same work. The reread lets the page keep feeding recognition. The recall attempt removes that support and forces memory to produce. That can feel worse in the moment, which is exactly why people dodge it. They prefer the smoother method because it protects confidence. The chapter says that confidence may be the wrong thing to protect.

Retrieval wins because reconstruction is tougher and more honest than another exposure. A flashcard answer, a low-stakes quiz, a blank-page summary, or an oral explanation pressures memory to bring the idea back on its own. When the answer returns, access gets stronger. When it does not, the learner finally sees the weak seam instead of hiding it under another pass through the notes.

That is why a miss cannot be read lazily. A failed recall attempt does not automatically mean the method failed. Often it means the method told the truth. The mistake would be to stop there. Productive retrieval has to be followed by correction and another attempt. Otherwise the chapter's mechanism turns into empty frustration instead of stronger memory.

The chapter also protects itself from a bad cultural drift. It is not defending high-pressure testing or anxiety as educational virtue. Low-stakes retrieval is the point because the learner needs enough support to repair the miss rather than just accumulate shame. This is memory training, not punishment dressed up as rigor.

That makes the chapter the book's first real engine room. It replaces another round of passive confidence with a routine that can actually toughen memory: retrieve, check, repair, retrieve again. Once that routine is in place, the next question becomes strategic. If retrieval works, how should practice be organized so the learner can choose well across changing situations instead of only recalling one pattern? That is where the next chapter takes over.`
      },
      keyTakeaways: [
        {
          point: { gentle: "Retrieval is a learning event, not only a check after learning.", direct: "Recall attempts help build memory rather than merely score it.", competitive: "A quiz can train memory instead of just judging it." },
          moreDetails: { gentle: "The chapter reframes self-testing as part of the learning process because reconstructing an idea strengthens later access.", direct: "What makes retrieval powerful is that memory has to produce the answer instead of leaning on visible cues.", competitive: "Once memory has to carry the answer itself, the quiz stops being only a scoreboard and becomes a workout." }
        },
        {
          point: { gentle: "Looking again is weaker than making memory bring the answer back.", direct: "Another reread does less for durability than a real recall attempt.", competitive: "Recognition is easier than production, which is why it can mislead." },
          moreDetails: { gentle: "Looking again can refresh familiarity, but retrieval forces the learner to rebuild what they know without the page still helping.", direct: "The reread leaves support in place, while retrieval removes it and therefore gives a cleaner test and stronger practice.", competitive: "The page can make you feel ready. Memory forced to produce tells you whether you are." }
        },
        {
          point: { gentle: "Low-stakes quizzes matter when they press recall before the learner has moved on.", direct: "Quizzes are useful when they create recall and feedback instead of only anxiety.", competitive: "The right quiz catches the miss while there is still time to fix it." },
          moreDetails: { gentle: "A short recall check can strengthen memory and reveal which ideas need another pass before they harden into weak spots.", direct: "Low-stakes testing works as a learning routine because it couples retrieval with fast correction rather than turning the moment into a final verdict.", competitive: "When the quiz is a training rep instead of a punishment scene, the miss becomes material for repair." }
        },
        {
          point: { gentle: "A missed retrieval can be useful information.", direct: "Failed recall often reveals the gap another reread would hide.", competitive: "An honest miss can teach more than a flattering pass." },
          moreDetails: { gentle: "The miss matters because it shows where the memory is weak while the learner can still correct the answer and try again.", direct: "The chapter values failed recall only when it leads to feedback and another attempt, not when it ends in vague discouragement.", competitive: "The miss is not the payoff. Spotting the weak seam early enough to reinforce it is what makes the round valuable." }
        },
        {
          point: { gentle: "Retrieval needs support and follow-up to stay productive.", direct: "Recall struggle helps only when the learner can repair and repeat.", competitive: "Pressure without repair turns training into waste." },
          moreDetails: { gentle: "The chapter keeps retrieval humane by rejecting the idea that difficulty alone is enough; the learner still needs correction and another path back to the idea.", direct: "This boundary protects retrieval from collapsing into punitive testing or unsupported frustration.", competitive: "If the learner gets pressure but no repair, the method stops being rigorous and starts being careless." }
        }
      ],
      activationPrompt: {
        gentle: "Choose one topic you have been reviewing passively and replace part of the next session with a short retrieval round.",
        direct: "Take one chapter or skill you usually reread and run a retrieve-check-repair cycle instead.",
        competitive: "Pick one subject you keep reviewing the safe way and make memory do real work before the next reread."
      },
      selfCheckPrompt: {
        gentle: "Can you explain why the chapter treats retrieval as more than a score?",
        direct: "Why does recall from memory strengthen learning differently from repeated exposure?",
        competitive: "If a quiz is not just a scoreboard, what work is it doing under the hood?"
      },
      oneMinuteRecap: {
        retrieve: { gentle: "What job does retrieval do besides checking knowledge?", direct: "How are quizzes and self-testing reframed in this chapter?", competitive: "What old story about quizzes gets broken here?" },
        connect: { gentle: "Why can a recall attempt help learning more than another reread?", direct: "How does reconstruction from memory make retrieval stronger than exposure alone?", competitive: "Why is making memory produce tougher and better than letting the page keep helping?" },
        preview: { gentle: "What new question appears once retrieval is working?", direct: "Why does the next chapter need to address the way practice is arranged, not just retrieval itself?", competitive: "If retrieval is now established, what strategic weakness does practice design have to fix next?" }
      }
    },
    hard: {
      chapterBreakdown: {
        gentle: `Many learners understand that passive review can mislead and still avoid self-quizzing because it feels harsher than another reread. The notes stay open, familiarity remains available, and confidence survives. Retrieval threatens that comfort because it might reveal forgetting. The chapter turns that threat into its central claim: trying to retrieve an idea from memory is not merely a way to inspect learning after it is done. It is one of the actions that helps make learning durable.

That claim matters because repeated exposure and retrieval perform different kinds of work. Looking again at the material can refresh familiarity and make the current session feel stronger. Retrieval removes the visible answer and asks memory to reconstruct. The learner has to produce the explanation, the term, the sequence, or the connection without leaning on the page. This reconstruction is not just diagnostic. The chapter argues that it changes later access. A memory that has been brought back through effort becomes easier to bring back again.

That is why the chapter reclassifies quizzes. In ordinary educational memory, a quiz is often imagined as a judgment scene that sorts success from failure. The authors narrow the frame and make it more useful. A low-stakes quiz, self-test, flashcard round, oral explanation, or blank-page summary can all function as retrieval practice. These are not only assessments attached to learning. They are learning routines because they pressure recall while there is still time to strengthen what returns and repair what does not.

This also explains why a missed retrieval cannot be read lazily. A failure during recall often means the method is honest rather than broken. Another reread might have left the same weakness hidden under familiarity. Retrieval exposes the gap early. But the chapter is too careful to celebrate that exposure by itself. A miss becomes useful only when it leads to correction, renewed access to the right answer, and another attempt to retrieve it. Productive struggle is not empty frustration. It is effort that reveals weakness while enough support still exists to repair it.

That boundary matters because the chapter can easily be misheard as a defense of testing culture or pressure-heavy classrooms. It is not arguing that anxiety teaches. It is arguing that low-stakes retrieval strengthens memory because reconstruction is cognitively different from recognition. The useful pressure comes from making memory produce, not from turning the learner into a defendant.

The harder edge appears when the learner misses too much. Retrieval cannot become an excuse for careless instruction or unsupported practice. If the learner lacks the necessary cues, correction, or prior understanding, repeated failed recall can slide from useful difficulty into discouragement. The chapter therefore keeps one pressure point alive: when does a miss function as repair information, and when does it signal that the learner needs more support before retrieval will help?

That question keeps the chapter honest. Retrieval is powerful, but not magical. It works inside a sequence: retrieve, check, repair, retrieve again. That sequence is what turns a quiz from a score into a learning event and what prevents the method from collapsing into either punishment or empty grit.

This is why the chapter matters so much in the book's architecture. Chapter 1 broke trust in smooth study. Chapter 2 replaces that broken trust with a concrete practice the learner can use immediately. It does not promise comfort. It promises a truer signal and a stronger memory. Once retrieval is established, the next strategic problem comes into view. Practice has to be arranged so the learner can recognize, choose, and transfer across changing conditions. That is the opening Chapter 3 inherits.`,
        direct: `Smooth study can create the illusion of learning. This chapter explains what to do instead: retrieve. Its core claim is sharper than many readers expect. Retrieval is not only a way to measure whether learning has happened. It is one of the ways learning is strengthened.

The contrast with repeated exposure is what gives the chapter force. Another reread can refresh familiarity because the answer remains visible. A retrieval attempt removes that support and requires reconstruction from memory. This is why retrieval often feels harsher. The learner is no longer protected by the page. But the chapter argues that this pressure is exactly what makes the method valuable. Reconstructing an idea strengthens later access and reveals where the memory remains weak.

This is why the authors reframe quizzes and self-testing. A low-stakes quiz is not useful because it produces a score. It is useful because it pressures recall while correction is still possible. Flashcards, oral explanation, short written summaries from memory, and brief classroom quizzes all fit the same structure. They make memory produce. When the answer comes back, access is strengthened. When it does not, the learner gets a precise repair target.

That precision is what makes failed recall potentially productive. Another reread might leave the weakness hidden under familiarity. Retrieval brings the weakness into view. But the chapter refuses to romanticize the miss. A failed recall attempt helps only when it is followed by feedback, repair, and another try. Otherwise the process can slide into discouragement rather than learning.

This is also the chapter's defense against a common misreading. It is not arguing for punishment-heavy testing. Anxiety is not the mechanism. Reconstruction is the mechanism. The value lies in making memory retrieve while the learner still has enough support to correct what failed and strengthen what returned.

The hard boundary is support. Retrieval cannot be treated as universally good regardless of conditions. If the learner lacks enough prior understanding or never gets correction, repeated misses stop being informative and start becoming noise. That is why the chapter's practical routine is not simply quiz more. It is retrieve, check, repair, and repeat.

That routine makes Chapter 2 the first full engine room of the book. It gives the reader a concrete method strong enough to replace the passive habits Chapter 1 criticized. Once retrieval is accepted as a learning event, the next problem becomes strategic rather than foundational: how should practice be arranged so memory stays flexible, discriminating, and ready for transfer? That is the bridge into Chapter 3.`,
        competitive: `Quizzes look like scoreboards, and scoreboards make people defensive. The authors rip out that frame. Retrieval is not just what happens after the learning so someone can decide whether you deserve a number. Retrieval is one of the ways the learning gets stronger.

That matters because another reread and a recall attempt are playing different games. The reread keeps the answer in view and lets recognition do part of the work. The recall attempt strips that support away and makes memory produce. That feels riskier because it might expose the hole. The chapter says exposing the hole is the point. Reconstruction is tougher, more honest, and more useful than another round of passive comfort.

That is why low-stakes quizzes matter. They are not powerful because they scare the learner into trying harder. They are powerful because they force retrieval while there is still time to repair the miss. A flashcard round, a blank-page summary, an oral explanation, a quick classroom quiz: all of these can work as training reps because they make memory bring the answer back under pressure.

This is also why the chapter refuses the lazy reaction to failure. If you miss during retrieval, that does not automatically mean the method failed. Often it means the method finally told the truth. Another reread might have covered the same weak seam with a smooth feeling. Retrieval tears the cover off. But the chapter is not sentimental about struggle. The miss earns its value only if it leads to correction and another attempt. Otherwise you are collecting frustration, not building memory.

That boundary keeps the chapter from turning into a defense of testing culture. The useful pressure is cognitive, not punitive. Anxiety is not the mechanism. Reconstruction is. If the learner gets pressure without enough support, the method becomes careless. If the learner gets recall, correction, and another attempt, the method becomes powerful.

So the chapter's real sequence is brutal in the right way: retrieve, find the gap, repair it, retrieve again. That is tougher than rereading because it refuses to let confidence hide behind the page. It is also smarter than glorifying difficulty because it demands repair rather than worshipping pain.

This makes Chapter 2 the book's first real replacement move. Chapter 1 exposed the lie in smooth study. Chapter 2 hands the reader a stronger routine. Once that routine is established, the next weakness becomes obvious. Practice can still become narrow or overfitted if it repeats in one shape. That is the fight waiting in Chapter 3 when the book moves from retrieval to mixing and variation.`
      },
      keyTakeaways: [
        {
          point: { gentle: "Retrieval is part of learning, not just a measurement after learning.", direct: "Recall strengthens memory because it makes reconstruction happen.", competitive: "A quiz can build the skill it looks like it is only judging." },
          moreDetails: { gentle: "The chapter's key move is to shift retrieval from scoreboard logic into mechanism logic: bringing an idea back from memory helps make later access easier.", direct: "What matters is not the score itself but the act of reconstructing the answer without visible support.", competitive: "Once memory has to produce instead of coast, the quiz stops being a verdict and becomes a training rep." }
        },
        {
          point: { gentle: "Looking again is weaker than making memory retrieve from a closed page.", direct: "Another reread does less for durable access than retrieval does.", competitive: "Recognition feels easier because the page is still helping." },
          moreDetails: { gentle: "A learner can look at the material again and feel stronger, but retrieval reveals whether the idea can return when the cues disappear.", direct: "The difference is structural: rereading leaves support in place, while retrieval removes it and forces the learner to rebuild.", competitive: "The reread protects confidence. Retrieval tests whether confidence has any muscle behind it." }
        },
        {
          point: { gentle: "Low-stakes quizzes matter when they press recall before the learner moves on.", direct: "A useful quiz is a recall-and-feedback routine, not only a score generator.", competitive: "The best quiz catches the weakness early enough to fix it." },
          moreDetails: { gentle: "This is why self-tests, flashcards, and short recall prompts matter; they create a chance to strengthen the memory before the learner moves on.", direct: "Low-stakes testing earns its place because it links retrieval with correction instead of treating the first result as final.", competitive: "When the quiz is part of training, the miss becomes a repair order instead of a sentence." }
        },
        {
          point: { gentle: "A missed retrieval can be useful if it leads to repair.", direct: "Failed recall often exposes the gap another reread would hide.", competitive: "An honest miss can be more valuable than a flattering pass." },
          moreDetails: { gentle: "The miss matters because it gives the learner a precise place to return to, correct, and strengthen.", direct: "The chapter values failed recall only when it is followed by feedback and another retrieval attempt, not when it ends in vague discouragement.", competitive: "The miss is not the goal. Spotting the weak seam while there is still time to reinforce it is what matters." }
        },
        {
          point: { gentle: "Retrieval needs support and repetition to stay productive.", direct: "Recall struggle helps only when the learner can correct and try again.", competitive: "Pressure without repair turns retrieval into waste." },
          moreDetails: { gentle: "This boundary keeps the chapter humane: the learner still needs enough context, correction, and follow-up for the struggle to strengthen memory.", direct: "Retrieval becomes careless if repeated misses are allowed to pile up without support, because the mechanism depends on repair as well as pressure.", competitive: "If you make memory fight with no way to patch the damage, you are not being rigorous. You are being sloppy." }
        }
      ],
      activationPrompt: {
        gentle: "Pick one topic you have reviewed repeatedly and run a retrieve-check-repair-retrieve cycle on it tomorrow.",
        direct: "Take one familiar chapter or skill and replace passive review with a short low-stakes retrieval round plus correction.",
        competitive: "Choose one subject you keep protecting with rereads and make memory earn the right to keep it."
      },
      selfCheckPrompts: [
        { gentle: "Can you explain why retrieval is more than a score in this chapter?", direct: "Why does reconstruction from memory strengthen learning differently from exposure alone?", competitive: "If the quiz is not just a verdict, what hard work is it making memory do?" },
        { gentle: "Can you describe when a retrieval miss becomes useful rather than discouraging?", direct: "What support has to exist for failed recall to turn into stronger learning?", competitive: "When does a miss become repair material, and when does it become wasted frustration?" }
      ],
      predictionPrompt: {
        gentle: "If retrieval is working, what new challenge should the next chapter solve about practice design?",
        direct: "Why does the book need a chapter on mixing and variation after establishing retrieval?", 
        competitive: "If memory can now retrieve, what strategic weakness in practice still has to be fixed next?"
      }
    }
  },
  examples: [
    {
      exampleId: "ch02-ex01",
      title: "Nina Chooses a Recall Drill Before Biology Class",
      category: "school",
      format: "decision_point",
      endingType: "broader_principle",
      contexts: ["biology quiz", "closed binder", "blank-page recall"],
      scenario: {
        gentle: "Nina has ten minutes before biology class. She can reread the chapter headings one more time, or she can close the binder and write what she remembers about the cell cycle from memory.",
        direct: "Nina must decide whether to spend her last study minutes on another calm reread or on a short blank-page recall drill that might expose what she still cannot retrieve.",
        competitive: "Nina can protect her confidence with one more reread or make memory produce before class. One move feels safer. The other is the one that can actually tell the truth."
      },
      whatToDo: {
        gentle: "Have Nina close the binder, retrieve the main stages from memory, and then reopen the notes only to repair what did not return cleanly.",
        direct: "Run a short retrieve-check-repair cycle instead of treating rereading as the final act.",
        competitive: "Make memory work first, then use the binder as correction, not as a shield."
      },
      whyItMatters: {
        gentle: "The recall attempt helps Nina strengthen what she can bring back and identify what still needs work.",
        direct: "A self-quiz gives Nina a stronger learning event than another pass through visible cues.",
        competitive: "If Nina keeps protecting confidence, class will expose the gap for her."
      }
    },
    {
      exampleId: "ch02-ex02",
      title: "Victor Learns Why Training Did Not Stick",
      category: "work",
      format: "postmortem",
      endingType: "self_directed_question",
      contexts: ["warehouse onboarding", "checklist recall", "guided demonstration"],
      scenario: {
        gentle: "Victor led a smooth onboarding session for new warehouse staff. Everyone followed the checklist when it was projected on the wall, but key steps went missing once the workers had to act without the visual guide.",
        direct: "Victor's training looked successful in the room because the sequence stayed visible. The postmortem shows that the session never forced employees to retrieve the steps on their own.",
        competitive: "Victor mistook guided fluency for learning. The wall carried the sequence during training, and memory failed when the wall disappeared."
      },
      whatToDo: {
        gentle: "Add short recall checks during training so workers must retrieve the sequence without the projected list.",
        direct: "Turn parts of onboarding into low-stakes retrieval reps followed by correction.",
        competitive: "Stop grading the guided demo and make the team pull the steps from memory before the shift starts."
      },
      whyItMatters: {
        gentle: "Recall under light pressure is more likely to build durable access than another guided walk-through.",
        direct: "Training has to include retrieval if the work will later have to run without visible prompts.",
        competitive: "If memory never has to produce in practice, it will fail when the floor gets quiet."
      }
    },
    {
      exampleId: "ch02-ex03",
      title: "Leah Stops Treating Flashcard Misses as Defeat",
      category: "personal",
      format: "dialogue",
      endingType: "surprising_implication",
      contexts: ["flashcards", "living-room table", "correction round"],
      scenario: {
        gentle: "Leah groans every time she misses a flashcard because she thinks the miss proves she should have kept rereading instead. Omar asks whether the miss might be showing her something useful.",
        direct: "Leah treats every flashcard miss as evidence that self-testing is discouraging. Omar points out that the miss may be the first honest sign of what another reread would have hidden.",
        competitive: "Leah calls the miss proof that flashcards are failing. Omar calls it the first truth the study session has told all night."
      },
      whatToDo: {
        gentle: "Have Leah check the answer, repair the gap, and then retrieve it again a little later instead of quitting after the miss.",
        direct: "Use the miss as a repair target and schedule another retrieval attempt after correction.",
        competitive: "Do not worship the miss or flee from it. Patch the hole and make memory face it again."
      },
      whyItMatters: {
        gentle: "A miss becomes useful when it leads to correction and another attempt.",
        direct: "The chapter's mechanism needs retrieval plus repair, not retrieval plus shame.",
        competitive: "The score is not the point. The reinforced second retrieval is."
      }
    },
    {
      exampleId: "ch02-ex04",
      title: "Priya Compares Note Review With Quiz Slips",
      category: "school",
      format: "predict_reveal",
      endingType: "cross_domain",
      contexts: ["quiz slips", "class opener", "note review"],
      scenario: {
        gentle: "Priya expects that reviewing notes quietly at the start of class will help more than answering a short quiz slip from memory. After several weeks, the recall routine holds up better than she predicted.",
        direct: "Priya predicts that another note review will feel more productive than a short low-stakes quiz. The later recall checks show the quiz routine was doing more for retention.",
        competitive: "Priya trusts the notes because they feel smoother. The quiz slips win later because memory actually had to fight for the answer."
      },
      whatToDo: {
        gentle: "Use the delayed result to recalibrate what counts as productive review.",
        direct: "Treat the stronger later recall as evidence that low-stakes retrieval did more than another pass through the notes.",
        competitive: "Let later memory, not in-the-moment comfort, decide which routine earned the point."
      },
      whyItMatters: {
        gentle: "The chapter's claim becomes believable when later access improves, not when the first session feels easier.",
        direct: "Retrieval looks weaker in the moment because it is doing stronger work for later memory.",
        competitive: "The better method often loses the feeling contest and wins the memory contest."
      }
    },
    {
      exampleId: "ch02-ex05",
      title: "Elena Designs a Safer Retrieval Routine at Work",
      category: "work",
      format: "dilemma",
      endingType: "common_trap",
      contexts: ["sales onboarding", "call script recall", "feedback loop"],
      scenario: {
        gentle: "Elena wants her new sales hires to remember the opening call sequence. She can either keep modeling it for them or ask them to retrieve it with quick feedback after each attempt.",
        direct: "Elena faces a design choice: guided repetition keeps anxiety lower in the room, but recall with feedback may build stronger memory before live calls begin.",
        competitive: "Elena can keep spoon-feeding the script or make the reps retrieve it while there is still time to patch the misses."
      },
      whatToDo: {
        gentle: "Build short retrieval rounds with immediate correction so the team practices recall without being abandoned to confusion.",
        direct: "Use low-stakes recall plus feedback rather than endless guided repetition.",
        competitive: "Pressure the recall, patch the miss, and run it again before the real customer is listening."
      },
      whyItMatters: {
        gentle: "Support keeps retrieval productive instead of discouraging.",
        direct: "The chapter's boundary is visible here: recall helps when feedback and another attempt are built in.",
        competitive: "Pressure without repair is sloppy. Pressure with repair is training."
      }
    },
    {
      exampleId: "ch02-ex06",
      title: "Omar Replaces Passive Review With Retrieve-Repair Routines",
      category: "personal",
      format: "before_after",
      endingType: "perspective_reframe",
      contexts: ["history notes", "voice explanation", "next-day recall"],
      scenario: {
        gentle: "Omar used to review history notes until the page looked familiar. Now he closes the notebook, explains the main causes out loud, checks what he missed, and tries again the next day.",
        direct: "Omar shifts from rereading to a routine of retrieve, check, repair, and retrieve again.", 
        competitive: "Omar stops buying confidence from the page and starts making memory earn it in rounds."
      },
      whatToDo: {
        gentle: "Keep the routine simple: retrieve first, correct second, then retrieve again later.",
        direct: "Turn review into repeated low-stakes reconstruction instead of passive exposure.",
        competitive: "Move the work into memory and use the notes only to patch what broke."
      },
      whyItMatters: {
        gentle: "The routine strengthens later access better than leaving the answer visible all session.",
        direct: "This chapter's mechanism becomes practical when the learner repeats retrieval after repair.", 
        competitive: "The second retrieval is where the method starts to cash out."
      }
    }
  ],
  implementationPlan: {
    coreSkill: {
      gentle: "The core skill is using retrieval as part of learning rather than waiting until the end to test yourself.",
      direct: "Core skill: turn review into retrieve-check-repair cycles instead of passive exposure.",
      competitive: "Core skill: make memory produce, patch the miss, and make it produce again."
    },
    ifThenPlans: [
      {
        context: "school",
        plan: {
          gentle: "If I am about to reread notes again, then I will close them first and try a short recall from memory.",
          direct: "If review feels too passive, then I will insert a low-stakes retrieval check before continuing.",
          competitive: "If I reach for another reread, I make memory fight first."
        }
      },
      {
        context: "work",
        plan: {
          gentle: "If training looks smooth while the instructions stay visible, then I will add a recall step without the prompts.",
          direct: "If a team only performs well with the script in view, then I will build in retrieval plus feedback.",
          competitive: "If the room looks strong with cues on screen, I pull the cues and make recall earn the rep."
        }
      },
      {
        context: "personal",
        plan: {
          gentle: "If I miss on a flashcard or self-quiz, then I will correct it and retrieve it again later instead of quitting.",
          direct: "If retrieval exposes a gap, then I will treat the miss as repair information rather than as a verdict.",
          competitive: "If memory misses, I patch the hole and send it back in."
        }
      }
    ],
    twentyFourHourChallenge: {
      gentle: "Within 24 hours, replace one reread with a short self-quiz and correction round.",
      direct: "In the next day, run one retrieve-check-repair cycle on a topic you have been reviewing passively.",
      competitive: "Today, stop hiding behind the page and make memory produce before the session ends."
    },
    weeklyPractice: {
      gentle: "For one week, add one low-stakes retrieval round to a study or training session each day.",
      direct: "Track one retrieve-repair-retrieve routine per day this week and compare it to passive review.",
      competitive: "For seven days, train memory in rounds instead of paying for comfort with rereads."
    }
  },
  reviewCards: [
    {
      cardId: "ch02-rc01",
      front: {
        gentle: "What new role does the chapter give to retrieval?",
        direct: "How does the chapter redefine quizzes and self-testing?",
        competitive: "What false idea about quizzes gets broken here?"
      },
      back: {
        gentle: "Retrieval is part of learning, not only a later check.",
        direct: "The chapter treats recall as a learning mechanism rather than only an assessment tool.",
        competitive: "A quiz can train memory instead of just scoring it."
      },
      difficulty: "easy"
    },
    {
      cardId: "ch02-rc02",
      front: {
        gentle: "Why can retrieval help more than another reread?",
        direct: "What does retrieval force memory to do that exposure does not?",
        competitive: "Why is reconstruction tougher and better than another pass across the page?"
      },
      back: {
        gentle: "Because retrieval asks memory to reconstruct the answer.",
        direct: "It removes visible support and requires the learner to produce from memory.",
        competitive: "It makes memory carry the answer instead of letting the page keep lifting."
      },
      difficulty: "easy"
    },
    {
      cardId: "ch02-rc03",
      front: {
        gentle: "Why can a low-stakes quiz be useful for learning?",
        direct: "What makes a quiz a learning event instead of only a score?",
        competitive: "When does a quiz stop being a scoreboard and start becoming training?"
      },
      back: {
        gentle: "Because it pressures recall while there is still time to repair misses.",
        direct: "It creates retrieval plus feedback instead of only a final judgment.",
        competitive: "It catches the weak seam early enough to patch it."
      },
      difficulty: "medium"
    },
    {
      cardId: "ch02-rc04",
      front: {
        gentle: "What should happen after a failed retrieval attempt?",
        direct: "How does the chapter keep failed recall productive?",
        competitive: "What turns a miss into progress instead of frustration?"
      },
      back: {
        gentle: "Correction and another retrieval attempt should follow.",
        direct: "A miss becomes useful when it leads to feedback, repair, and repeat retrieval.",
        competitive: "Patch the hole and make memory face it again."
      },
      difficulty: "medium"
    },
    {
      cardId: "ch02-rc05",
      front: {
        gentle: "What boundary keeps retrieval from becoming punitive testing?",
        direct: "Why does the chapter insist on support and follow-up?",
        competitive: "What makes pressure useful here instead of sloppy?"
      },
      back: {
        gentle: "Retrieval must include enough support to repair what fails.",
        direct: "The method stays productive only when recall pressure is paired with correction and another try.",
        competitive: "Recall pressure only earns its keep when the learner can patch the miss and run the answer again."
      },
      difficulty: "hard"
    }
  ],
  keyTakeawayCard: {
    gentle: "Chapter 2 asks you to stop treating quizzes and self-testing as threats. Retrieval is part of how learning becomes durable because memory has to bring the answer back without the page still helping.",
    direct: "The chapter's main move is to turn retrieval from a score into a mechanism. Another reread refreshes familiarity, but low-stakes recall plus correction strengthens later access more directly.",
    competitive: "Stop using quizzes as proof that you are good or bad. Use retrieval to make memory produce, expose the weak seam, patch it, and make it produce again."
  }
};

const quiz = {
  passingScorePercent: 80,
  questions: [
    {
      questionId: "ch02-q01",
      prompt: "What is the chapter's main claim about retrieval?",
      choices: [
        "Retrieval is useful only after learning is finished",
        "Retrieval helps build learning, not just measure it",
        "Retrieval should replace every other study method"
      ],
      correctIndex: 1,
      explanation: {
        gentle: "The chapter's central claim is that recall from memory strengthens learning itself.",
        direct: "Chapter 2 redefines retrieval as part of the learning process rather than only a later assessment tool.",
        competitive: "The quiz is not just the scoreboard. It is part of the training."
      },
      bloomsLevel: "remember",
      depthLevel: "easy"
    },
    {
      questionId: "ch02-q02",
      prompt: "Why can a self-quiz help more than another reread?",
      choices: [
        "Because a self-quiz always feels easier than rereading",
        "Because retrieval forces reconstruction from memory",
        "Because rereading never has any use"
      ],
      correctIndex: 1,
      explanation: {
        gentle: "The chapter says retrieval helps because the learner has to bring the answer back without the page doing the work.",
        direct: "Another reread can refresh familiarity, but retrieval makes memory reconstruct the idea on its own.",
        competitive: "Reconstruction is stronger because memory has to produce instead of coast."
      },
      bloomsLevel: "understand",
      depthLevel: "easy"
    },
    {
      questionId: "ch02-q03",
      prompt: "What makes a low-stakes classroom quiz useful in this chapter?",
      choices: [
        "It creates recall while there is still time to correct mistakes",
        "It makes students anxious enough to work harder",
        "It proves which students are naturally strong learners"
      ],
      correctIndex: 0,
      explanation: {
        gentle: "The chapter values low-stakes quizzes because they pressure recall and reveal what still needs repair.",
        direct: "A useful quiz is part of learning because it links retrieval with correction instead of only producing a score.",
        competitive: "The right quiz catches the miss early enough to fix it."
      },
      bloomsLevel: "apply",
      depthLevel: "medium"
    },
    {
      questionId: "ch02-q04",
      prompt: "Why did Victor's training fail to stick?",
      choices: [
        "The trainees were given too many formal tests",
        "The training never forced workers to retrieve the steps without visible prompts",
        "The checklist was too short to remember"
      ],
      correctIndex: 1,
      explanation: {
        gentle: "The workers looked fluent while the checklist stayed visible, but recall was never trained directly.",
        direct: "Victor's session relied on guided exposure rather than low-stakes retrieval, so the memory failed once the cues disappeared.",
        competitive: "The wall carried the sequence during training, and memory was never made to earn it."
      },
      bloomsLevel: "apply",
      depthLevel: "medium"
    },
    {
      questionId: "ch02-q05",
      prompt: "Why can struggle during retrieval still help learning?",
      choices: [
        "Because all frustration is productive",
        "Because the struggle can reveal weak spots while memory is being strengthened",
        "Because the chapter wants learners to prefer failure"
      ],
      correctIndex: 1,
      explanation: {
        gentle: "The chapter treats struggle as useful only when it exposes what needs repair and strengthens what returns.",
        direct: "Effortful recall can help because reconstruction both pressures memory and reveals the gap another reread would hide.",
        competitive: "The point is not pain. The point is that an honest recall fight shows where the weak seam is."
      },
      bloomsLevel: "understand",
      depthLevel: "medium"
    },
    {
      questionId: "ch02-q06",
      prompt: "Which idea would the chapter reject?",
      choices: [
        "Retrieval can work through self-quizzing and low-stakes tests",
        "A failed recall attempt can become repair information",
        "Retrieval mainly means pressure-heavy formal exams"
      ],
      correctIndex: 2,
      explanation: {
        gentle: "The chapter does not define retrieval as punishment-heavy testing.",
        direct: "Its focus is low-stakes recall that strengthens learning, not anxiety as pedagogy.",
        competitive: "If the method depends on intimidation, you missed the mechanism."
      },
      bloomsLevel: "analyze",
      depthLevel: "hard"
    },
    {
      questionId: "ch02-q07",
      prompt: "Leah misses a flashcard answer. What response best fits the chapter?",
      choices: [
        "Stop quizzing because the miss proves retrieval is discouraging",
        "Check the answer, repair the gap, and retrieve it again later",
        "Reread the whole deck until it feels familiar again"
      ],
      correctIndex: 1,
      explanation: {
        gentle: "The chapter treats the miss as useful when it leads to correction and another recall attempt.",
        direct: "Failed retrieval becomes productive through feedback, repair, and repeated retrieval, not through surrender or endless rereading.",
        competitive: "Patch the hole and send memory back in."
      },
      bloomsLevel: "apply",
      depthLevel: "medium"
    },
    {
      questionId: "ch02-q08",
      prompt: "Why does the next chapter need to move beyond retrieval itself?",
      choices: [
        "Because retrieval is no longer useful once learned",
        "Because practice design still matters for flexibility and transfer",
        "Because quizzes are weaker than blocked repetition"
      ],
      correctIndex: 1,
      explanation: {
        gentle: "Once retrieval is accepted, the next question is how practice should be arranged so learning remains flexible.",
        direct: "Chapter 3 broadens the issue from recall alone to the design of practice through mixing and variation.",
        competitive: "Retrieval can build memory, but practice can still become narrow if the design stays lazy."
      },
      bloomsLevel: "understand",
      depthLevel: "easy"
    },
    {
      questionId: "ch02-q09",
      prompt: "Why is retrieval more than measurement in this chapter?",
      choices: [
        "Because it produces a more detailed score sheet",
        "Because reconstructing from memory changes later access",
        "Because it removes the need for feedback"
      ],
      correctIndex: 1,
      explanation: {
        gentle: "The act of bringing the answer back helps make it easier to bring back again later.",
        direct: "Retrieval is more than assessment because reconstruction from memory strengthens the learner's future access to the idea.",
        competitive: "The answer has to fight its way back, and that fight toughens the route."
      },
      bloomsLevel: "analyze",
      depthLevel: "hard"
    },
    {
      questionId: "ch02-q10",
      prompt: "What keeps retrieval from turning into empty frustration?",
      choices: [
        "Making every quiz formal and graded",
        "Pairing recall pressure with support, correction, and another attempt",
        "Avoiding all misses during practice"
      ],
      correctIndex: 1,
      explanation: {
        gentle: "The chapter says retrieval stays productive when the learner can repair what failed and try again.",
        direct: "Support and follow-up matter because recall pressure alone can become discouraging instead of strengthening.",
        competitive: "Pressure without repair is waste. Pressure plus repair is the method."
      },
      bloomsLevel: "analyze",
      depthLevel: "hard"
    }
  ]
};

chapter.quiz = quiz;

const book = {
  bookId: "make-it-stick",
  title: "Make It Stick",
  author: "Peter C. Brown, Henry L. Roediger III, Mark A. McDaniel",
  categories: [],
  tags: [],
  variantFamily: "EMH",
  edition: {
    name: "2014 Belknap Press of Harvard University Press English edition",
    translator: "",
    publishedYear: 2014,
    translationYear: null,
    sourceText: ".chapterflow/runs/make-it-stick/20260411-173340/source-freeze/book-source.md",
    sourceProvenance: "Frozen web bundle only; paraphrase-first."
  }
};

const critic = `# ch02 Critic Report

## Result
- Status: PASS with local edit notes

## Strengths
- The chapter stays anchored to retrieval as the distinct mechanism rather than drifting into generic active-learning language.
- The edited draft keeps the humane boundary between low-stakes retrieval and punitive testing.
- The hard-depth tension survives: failed recall matters only when it leads to repair.

## Local Issues Repaired Before Conversion
- Tightened the opening so it begins with the real learner hesitation around self-quizzing instead of abstract theory.
- Removed one drift toward generic anti-rereading language and replaced it with retrieval-specific mechanism language.
- Sharpened the close so Chapter 3 clearly inherits the practice-design problem rather than simply restating retrieval.

## Critic Gate Decision
- Prose clears the chapter-specific critic gate and may proceed to structured conversion.
`;

const wordCount = (s) => s.trim().split(/\s+/).length;
const canonicalWords = wordCount(fs.readFileSync(path.join(runRoot, "drafts/canonical/ch02.md"), "utf8"));
const editedWords = wordCount(fs.readFileSync(path.join(runRoot, "drafts/edited/ch02.md"), "utf8"));
const metrics = {
  chapterId: "ch02",
  canonicalDraftWords: canonicalWords,
  editedDraftWords: editedWords,
  easyBreakdownWords: Object.fromEntries(Object.entries(chapter.contentVariants.easy.chapterBreakdown).map(([k, v]) => [k, wordCount(v)])),
  mediumBreakdownWords: Object.fromEntries(Object.entries(chapter.contentVariants.medium.chapterBreakdown).map(([k, v]) => [k, wordCount(v)])),
  hardBreakdownWords: Object.fromEntries(Object.entries(chapter.contentVariants.hard.chapterBreakdown).map(([k, v]) => [k, wordCount(v)])),
  examplesCount: chapter.examples.length,
  reviewCardsCount: chapter.reviewCards.length,
  quizQuestionsCount: quiz.questions.length
};

const writeJson = (rel, value) => fs.writeFileSync(path.join(runRoot, rel), JSON.stringify(value, null, 2) + "\n");

writeJson("structured/ch02.chapter.json", chapter);
writeJson("quizzes/ch02.quiz.json", quiz);
writeJson("validated/ch02.chapter.json", chapter);
writeJson("validated/ch02.review-package.json", {
  schemaVersion: "chapterflow.v13.chapter-review-package",
  packageId: "make-it-stick-20260411-173340-ch02",
  createdAt: "2026-04-11T14:36:59-03:00",
  contentOwner: "ChapterFlow",
  book,
  chapters: [chapter]
});
writeJson("sidecars/ch02.reading-metrics.json", metrics);
fs.writeFileSync(path.join(runRoot, "reports/ch02.critic.md"), critic);

console.log(JSON.stringify(metrics, null, 2));
