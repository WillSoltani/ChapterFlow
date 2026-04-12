import fs from "node:fs";
import path from "node:path";

const runRoot = "/Users/willsoltani/dev/chapterflow-siliconx/.chapterflow/runs/make-it-stick/20260411-173340";
const writeJson = (rel, value) => fs.writeFileSync(path.join(runRoot, rel), JSON.stringify(value, null, 2) + "\n");
const wordCount = (s) => s.trim().split(/\s+/).length;

const chapter = {
  chapterId: "ch04",
  number: 4,
  title: "Embrace Difficulties",
  readingTimeMinutes: 7,
  contentVariants: {
    easy: {
      chapterBreakdown: {
        gentle: `A hard-feeling study method is not automatically better, but it is not automatically worse either. This chapter explains that some difficulties help because they make the learner retrieve, generate, recover, or repair. Smooth practice can feel safer because mistakes stay hidden and the answer remains close by. Productive difficulty feels rougher because the learner has to do more of the work. A delayed recall attempt, a generated answer, or a corrected mistake can strengthen learning more than a calm errorless pass. The important boundary is that difficulty must have a job. If the challenge helps memory rebuild or repair, it can be desirable. If it only creates overload or confusion, it is not teaching. The chapter's message is not “suffer more.” It is “ask what the difficulty is making learning do.”`,
        direct: `Some difficulties improve learning because they force retrieval, generation, or correction after an error. This chapter draws that line carefully. Smooth, errorless practice can make a session look strong while hiding how little reconstruction is happening. Harder-feeling practice can help because the learner must recover the idea, produce an answer before seeing it, or fix a miss and try again. That pressure can build stronger memory. The chapter is not praising pain or humiliation. It is defining desirable difficulty as challenge with a learning mechanism. When the difficulty produces reconstruction and repair, it can help. When it strips away too much support and leaves the learner flailing, it stops teaching.`,
        competitive: `Difficulty is not a trophy. This chapter makes that clear while still defending the right kind of hard practice. A smooth session can keep mistakes offstage and make learning look stronger than it is. A rougher session can help because memory has to retrieve, generate, or recover instead of waiting for the answer to appear. Even a miss can help if it gets corrected and run again. That does not make pain noble. It makes mechanism the test. Challenge earns its place only when it forces useful reconstruction and still leaves enough support to repair what fails. If the learner is just drowning, the difficulty has stopped being desirable and started becoming waste.`
      },
      keyTakeaways: [
        { point: { gentle: "Some hard-feeling methods help because they force useful work.", direct: "Difficulty helps when it triggers retrieval, generation, or repair.", competitive: "Hard only counts when it makes learning rebuild." } },
        { point: { gentle: "Smooth practice can hide weak learning.", direct: "Errorless ease can flatter the session and weaken the future.", competitive: "Calm practice can keep the weakness offstage." } },
        { point: { gentle: "Difficulty needs support to stay desirable.", direct: "Challenge without repair can become waste.", competitive: "Pressure without a path back is not training." } }
      ],
      oneMinuteRecap: {
        gentle: { retrieve: "What makes a difficulty desirable in this chapter?", connect: "Why can a hard-feeling method still help learning?", preview: "What problem remains even when learners use better and harder methods?" },
        direct: { retrieve: "What boundary separates productive difficulty from overload here?", connect: "How can errors help when correction follows?", preview: "Why does the next chapter turn toward illusions of knowing?" },
        competitive: { retrieve: "What test does hard practice have to pass to earn its place?", connect: "Why can a rougher session build more than a smoother one?", preview: "If the method is better now, what self-deception risk still survives?" }
      }
    },
    medium: {
      chapterBreakdown: {
        gentle: `By this point in the book, learners may be ready to make a new mistake. They have heard that retrieval can feel harder than rereading and that mixed practice can feel messier than blocked drills. It becomes tempting to think difficulty itself is the answer. This chapter interrupts that drift. Some difficulties help learning because they force useful work such as retrieval, generation, delayed recovery, or correction after errors. Other difficulties simply waste effort. The chapter asks for a more serious test than “Did this feel hard?”

Smooth, errorless practice can be persuasive because it keeps visible mistakes low. The learner follows the model, waits for the answer, or moves with plenty of guidance. The session can look controlled and efficient. But some of that control comes from reducing the amount of reconstruction required. When the learner has to generate an answer before seeing it, retrieve after a delay, or repair a miss and try again, the session often feels less flattering. That roughness can be useful because the learner is doing the work durable learning needs.

This is why the chapter treats errors carefully instead of treating them as either disasters or virtues. A wrong answer during low-stakes practice can reveal exactly where repair is needed. If feedback follows and the learner tries again, the error can become part of stronger learning. Another perfectly guided pass might have hidden the same weakness. But the chapter refuses to romanticize mistakes. An error without correction or another attempt can leave confusion in place.

That leads to the idea of desirable difficulty. Challenge earns the name only when it preserves a mechanism for learning and enough support for repair. Retrieval, generation, delayed review, and corrected errors can all fit that rule. Overload does not. If the learner loses the path back to the idea, the difficulty stops strengthening learning and starts wasting effort.

This boundary matters because the chapter is not defending pain, humiliation, or pressure as moral goods. It is defending challenge with a purpose. The hard-feeling method helps not because it hurts, but because it forces reconstruction and still leaves a route to correction.

So the practical rule is tighter than simple toughness. Keep the challenge that makes memory recover or generate. Keep the correction that turns a miss into repair. Drop the overload that removes too much support. That prepares the next chapter's problem. Even disciplined, harder methods can leave learners badly calibrated about what they actually know. Chapter 5 turns toward those illusions of knowing.`,
        direct: `The chapter's job is to define the difference between useful challenge and wasted struggle. Earlier chapters already established that effective learning can feel less smooth than people expect. This chapter makes the rule more precise. Difficulty helps when it creates a mechanism such as retrieval, generation, delayed recovery, or repair after an error. Difficulty fails when it strips away so much support that the learner is no longer rebuilding knowledge and is only enduring confusion.

This distinction matters because errorless ease can make practice look stronger than it is. A learner who follows a model closely, waits for the answer to appear, or stays fully guided can move through a session with low visible failure. But that low-failure session may also require less reconstruction. Harder-feeling practice often asks more of memory. The learner has to generate before seeing, retrieve after some forgetting, or repair a miss and try again. Those conditions can feel worse while producing stronger retention.

The chapter therefore treats errors as potential repair signals rather than as automatic proof of failure. A low-stakes miss can reveal where the memory is weak and where correction should be focused. If the miss is explained and followed by another attempt, learning can deepen. But the chapter rejects a lazy celebration of error. Mistakes do not help by themselves. Without feedback and another pass, they can leave confusion untouched.

The phrase desirable difficulty therefore does real filtering work. It keeps the focus on mechanism. Retrieval, generation, spacing, and corrected errors can make challenge useful. Overload, unsupported frustration, and pressure without repair do not qualify.

This is not an argument for toughness culture. The method is not better because it feels punishing. It is better when it makes the learner do useful reconstruction and still preserves a route to repair. That is the boundary that keeps the chapter honest.

Once that boundary is visible, the next danger becomes clearer. A learner can now use better methods and still misjudge their own state of knowledge. That is why the next chapter turns from desirable difficulty to the illusions of knowing that can survive even inside disciplined practice.`,
        competitive: `The book has now given the learner two hard-feeling moves that work: retrieval and mixed practice. That creates a dangerous temptation. People start thinking hard equals good. This chapter crushes that shortcut. Some difficulties help because they force memory to retrieve, generate, recover, or repair. Some difficulties are just waste dressed up as discipline.

Smooth, errorless practice can make a learner look stronger because it keeps the ugly parts hidden. The model stays visible. The answer arrives before the learner has to produce it. The miss never has to show up in public. That calm can be expensive. The session feels controlled partly because reconstruction has been reduced. Harder practice can help because it removes some of that protection and makes memory do more of the work.

This is why the chapter handles errors with discipline. A wrong answer in low-stakes practice can be useful because it reveals the weak seam. If the learner gets feedback and runs the answer again, the struggle can strengthen the memory. But the miss is not magic. If it leads nowhere, it leaves confusion sitting where learning should have thickened.

That is the whole point of desirable difficulty. The chapter is not praising pain. It is filtering difficulty by mechanism. If the challenge forces useful reconstruction and preserves enough support for repair, it can help. If it strips away the path back to the idea, the method has stopped teaching and started posturing.

This is why the chapter rejects both fake softness and fake toughness. Errorless calm can hide weak learning. Empty pressure can waste effort. The right question is harder than either posture: what is this difficulty making the learner do, and can the learner still repair the miss?

That sharper standard prepares the next chapter. Once challenge is filtered correctly, learners still face another problem. They can work harder and better and still fool themselves about what they know. Chapter 5 turns to that quieter danger: illusions of knowing that survive inside disciplined practice.`
      },
      keyTakeaways: [
        {
          point: { gentle: "Difficulty helps when it forces useful learning work.", direct: "Challenge matters when it triggers retrieval, generation, or repair.", competitive: "Hard only earns respect when it makes learning rebuild." },
          moreDetails: { gentle: "The chapter does not treat difficulty as a mood or a badge. It treats it as valuable only when it produces reconstruction or recovery that strengthens later access.", direct: "The test is mechanism: challenge helps when it creates the cognitive work smooth practice avoided.", competitive: "If the hard part is not making memory do real work, then the toughness is fake." }
        },
        {
          point: { gentle: "Errorless ease can hide weak learning.", direct: "A calm, guided session can overstate how much the learner can do alone.", competitive: "A tidy session can keep the weakness offstage." },
          moreDetails: { gentle: "Guidance and low visible failure can make a practice round look efficient while reducing the amount of reconstruction the learner has to carry.", direct: "Smoothness is not free evidence of learning because the answer may still be too close to the learner the whole time.", competitive: "The session can look strong partly because it never let the weakness show up where it could be fixed." }
        },
        {
          point: { gentle: "Errors can help when they lead to correction and another attempt.", direct: "A miss becomes useful through feedback and repair.", competitive: "The miss matters when it gets turned into reinforcement." },
          moreDetails: { gentle: "A wrong answer can point directly to the place where the learner needs another pass, but only if the correction is integrated instead of ignored.", direct: "The chapter values low-stakes errors as repair signals, not as virtues in themselves.", competitive: "The error is not the achievement. What matters is catching it, patching it, and making memory face the answer again." }
        },
        {
          point: { gentle: "Support separates desirable difficulty from overload.", direct: "Challenge stops helping when the learner loses the path to repair.", competitive: "If the route back disappears, the pressure has gone bad." },
          moreDetails: { gentle: "Useful challenge leaves enough structure that the learner can understand the correction and rebuild the answer instead of only enduring confusion.", direct: "This is the chapter's real boundary: productive struggle still preserves a way to recover, while overload strips that path away.", competitive: "Difficulty without a repair path is not rigorous. It is just abandonment." }
        },
        {
          point: { gentle: "Difficulty is a mechanism question, not a toughness identity.", direct: "The chapter filters challenge by what it teaches, not by how punishing it feels.", competitive: "Pain is not the metric. Mechanism is." },
          moreDetails: { gentle: "This keeps the chapter from collapsing into grit talk; the method is better only when it creates stronger reconstruction and later access.", direct: "The learner is asked to judge challenge by its effect on memory and repair, not by its ability to produce strain.", competitive: "If the only thing the method proves is that it hurt, it proved the wrong thing." }
        }
      ],
      activationPrompt: {
        gentle: "Choose one practice routine that feels very smooth and ask what useful work it might be avoiding.",
        direct: "Take one study or training session and redesign part of it so the learner has to retrieve, generate, or repair with support.", 
        competitive: "Find one calm routine that keeps weakness hidden and make it do real reconstruction tomorrow."
      },
      selfCheckPrompt: {
        gentle: "Can you explain what makes a difficulty desirable instead of merely hard?", 
        direct: "Why does the chapter insist on support and repair rather than treating all struggle as equal?",
        competitive: "If hard is not enough, what does a difficulty have to prove to stay in the game?"
      },
      oneMinuteRecap: {
        retrieve: { gentle: "What turns a difficulty into a desirable one here?", direct: "What boundary separates productive challenge from overload?", competitive: "What standard does hard practice have to satisfy here?" },
        connect: { gentle: "How can a wrong answer still help learning?", direct: "Why can rougher practice build more than smoother guidance?", competitive: "Why can the honest stumble teach more than the tidy pass?" },
        preview: { gentle: "What problem remains even when the learner is using better methods?", direct: "Why does the next chapter shift from difficulty to calibration and illusions of knowing?", competitive: "If the method is stronger now, what self-deception risk still survives?" }
      }
    },
    hard: {
      chapterBreakdown: {
        gentle: `A learner can accept every lesson from the earlier chapters and still take the wrong conclusion from them. Retrieval can help. Mixed practice can help. Then the learner starts to believe that difficulty itself is a trustworthy compass. This chapter steps in to stop that slide. Some difficulties are desirable because they force retrieval, generation, delayed recovery, or correction after errors. Others are simply waste. The real question is not whether the session felt hard. It is whether the difficulty preserved a mechanism that can strengthen learning.

Smooth, errorless practice can be deeply persuasive because it keeps performance tidy. The learner follows the model, moves with full guidance, or waits for the correct answer before producing anything. That can make the round look efficient and clean. But some of that cleanliness comes from reducing the need for reconstruction. When the learner has to generate before seeing, retrieve after forgetting, or repair a miss and try again, the round often feels rougher because more of the cognitive load is finally in the learner's hands.

This is why the chapter treats errors with more nuance than either common extreme allows. A wrong answer in low-stakes practice is not automatic proof that the method failed. It may reveal the exact place where stronger learning can begin. If correction follows and the learner retrieves again, the miss can become part of a stronger memory. Another perfectly guided round might have kept the same weak seam hidden. But the chapter is equally firm that mistakes are not sacred. An error without feedback, explanation, or a second attempt can leave the learner stranded in confusion.

That tension is what desirable difficulty is meant to hold. Useful challenge forces the learner to do work that durable learning requires: retrieve, generate, discriminate, recover, repair. It also preserves enough support that the learner can understand the correction and integrate it. Once the support disappears too completely, the challenge stops being desirable. The learner is no longer rebuilding knowledge. They are only enduring overload.

This boundary matters because the chapter can easily be misheard as a defense of harsh teaching or punitive self-discipline. It is not. Pain is not the mechanism. Humiliation is not the mechanism. Pressure earns its place only when it reveals the gap, guides the repair, and strengthens the next attempt.

The deeper lesson is that ease and difficulty are both weak signals by themselves. Easy practice can hide weak learning. Hard practice can hide bad design. The learner therefore needs a more serious test than feeling. What specific work is the method making memory do? Is there enough structure to repair what fails? Will the challenge leave the learner with stronger later access, or only with fatigue and noise?

That is what makes this chapter a boundary chapter for the whole book. It filters the earlier insights so they cannot be turned into slogans. Retrieval is not good because it feels hard. Interleaving is not good because it feels messy. They are useful when they create the right kind of struggle. Chapter 4 names that filter and keeps it strict.

Once the filter is in place, another danger comes into focus. Learners can use better, harder, more honest methods and still misjudge their own understanding. That is where the next chapter takes over. It moves from desirable difficulty to the quieter but equally costly illusions of knowing that can survive even inside disciplined practice.`,
        direct: `Earlier chapters already showed that effective learning can feel less smooth than intuition expects. Chapter 4 turns that insight into a boundary. It prevents the crude conclusion that hard automatically means good. Some difficulties help because they force reconstruction, generation, delayed recovery, or repair. Other difficulties only create strain without strengthening learning.

That distinction matters because smooth practice can mislead in one direction and punishing practice can mislead in another. A fully guided session with very low visible error can look efficient because much of the answer is still being supplied. A rougher session can help because the learner has to produce more independently. But a rougher session is not valuable by default. It becomes useful only when it preserves a learning mechanism and enough support for repair.

This is why the chapter treats errors as repair signals rather than as either disasters or virtues. A wrong answer in low-stakes practice can reveal exactly where the learner needs help. If feedback follows and the answer is attempted again, the miss can deepen learning. But if the learner is left with error and no route to correction, the process turns into confusion rather than improvement.

The phrase desirable difficulty does real filtering work here. It excludes overload. It excludes unsupported frustration. It excludes pain pursued as if pain itself taught. What remains are challenges that force useful work while preserving a path back to the answer.

That is the chapter's sharpest claim. The learner should not ask only whether the method felt easy or hard. The learner should ask what the method demanded and whether the demand was attached to repair. Retrieval, generation, delayed recall, and corrected error can all qualify. Abandonment does not.

This makes the chapter central to the book's discipline. It keeps earlier insights from collapsing into slogans about toughness. A method is stronger when it creates reconstruction that the learner can survive, understand, and integrate. It is weaker when it produces either empty comfort or empty strain.

With that boundary in place, the next chapter can focus on a different threat. Even when the learner chooses better methods, they can still misread what they actually know. Chapter 5 turns toward that calibration problem and the illusions of knowing that make weak learning feel complete.`,
        competitive: `Earlier chapters handed the learner two hard-feeling tools that work. That creates a lazy temptation: hard must be good. Chapter 4 kills that shortcut. Some difficulties help because they force memory to retrieve, generate, recover, or repair. Some difficulties are just damage with a heroic story wrapped around them.

Smooth practice can fake strength by keeping the answer too close. The learner follows the guide, avoids public mistakes, and leaves feeling efficient. Punishing practice can fake strength by making the learner suffer and then call the suffering proof. The chapter rejects both scams. The method has to be judged by what it makes learning do.

That is why errors are handled with precision. A miss during low-stakes practice can be valuable because it exposes the weak seam. If the learner gets feedback, patches the answer, and retrieves again, the round can build stronger memory than a tidy pass that never showed the weakness. But the chapter refuses the opposite fantasy too. A miss without repair is not noble. It is just an exposed wound left untreated.

This is the real meaning of desirable difficulty. The challenge has to force useful reconstruction and preserve a path back to the answer. Once the path disappears, the pressure stops being rigorous and starts being careless. Overload does not become educational just because it feels intense.

That boundary keeps the book serious. It blocks the fake softness of comfort-based learning, and it blocks the fake toughness of pressure with no repair. What matters is mechanism: what kind of work did memory do, what got corrected, and what came back stronger on the next attempt?

So this chapter is not selling pain. It is building a filter. Hard is not enough. Honest is not enough. Even struggle has to justify itself by producing stronger recall, better generation, or cleaner repair. If it cannot do that, it has failed the chapter's test.

That filter matters because the learner can now use better tools and still lie to themselves. The next chapter takes up that quieter failure. After desirable difficulty is defined, the book has to show how illusions of knowing keep surviving inside even disciplined practice.`
      },
      keyTakeaways: [
        {
          point: { gentle: "Difficulty helps only when it forces useful learning work.", direct: "Challenge earns its value through mechanism, not mood.", competitive: "Hard is worthless unless it makes memory rebuild something real." },
          moreDetails: { gentle: "The chapter asks whether the method produces retrieval, generation, recovery, or repair rather than whether it simply feels demanding.", direct: "This is what keeps desirable difficulty from collapsing into a style preference for punishing practice.", competitive: "If the hard part is not producing better reconstruction, the toughness is theater." }
        },
        {
          point: { gentle: "Smooth practice and punishing practice can both mislead.", direct: "Low-friction comfort and high-strain overload are both weak teachers when mechanism is missing.", competitive: "Comfort can fake strength, and pain can fake seriousness." },
          moreDetails: { gentle: "A calm session may hide weakness by keeping the answer too close, while a harsh session may hide bad design by calling strain a virtue.", direct: "The chapter rejects both false signals and judges the method by what later learning work it creates.", competitive: "One scam flatters you. The other bruises you. Neither proves the method is sound." }
        },
        {
          point: { gentle: "Errors become useful through correction and another attempt.", direct: "A miss matters when it becomes repair material.", competitive: "The miss earns value only when it gets patched and faced again." },
          moreDetails: { gentle: "The error shows where learning is weak, but it helps only if the learner gets the explanation and another chance to retrieve or generate.", direct: "The chapter values the repaired second attempt, not the wrong answer in isolation.", competitive: "The raw miss is not impressive. The rebuilt answer is." }
        },
        {
          point: { gentle: "Support marks the edge between desirable difficulty and overload.", direct: "Challenge stops helping when the learner loses the path back to the answer.", competitive: "Once repair becomes impossible, the pressure has gone bad." },
          moreDetails: { gentle: "Useful difficulty leaves enough structure for the learner to understand the correction and integrate it into a stronger memory.", direct: "Overload strips away that route and replaces reconstruction with flailing.", competitive: "If the learner cannot find their way back, the method has crossed from training into waste." }
        },
        {
          point: { gentle: "Difficulty is a filter, not an identity badge.", direct: "The chapter keeps challenge honest by asking what it teaches and what it repairs.", competitive: "Pain is not the metric. Repairable reconstruction is." },
          moreDetails: { gentle: "This filter keeps the book's earlier lessons from turning into slogans about grit or suffering.", direct: "A hard-feeling method belongs only when it creates useful work and preserves a route to correction.", competitive: "If the method cannot explain what it rebuilt and how the learner repaired it, it failed the test." }
        }
      ],
      activationPrompt: {
        gentle: "Pick one practice routine that feels hard and ask whether it actually includes retrieval, generation, or repair.",
        direct: "Take one rough-feeling study or training method and audit whether the challenge is attached to a real learning mechanism.", 
        competitive: "Choose one method you respect because it feels tough and make it prove what it is actually rebuilding."
      },
      selfCheckPrompts: [
        { gentle: "Can you explain what desirable difficulty keeps and what it rejects?", direct: "Why does the chapter insist that support and repair must stay inside the challenge?", competitive: "If pain is not enough, what does a difficulty have to prove to stay in the system?" },
        { gentle: "Can you describe when an error becomes useful and when it becomes waste?", direct: "What has to happen after a miss for the struggle to strengthen learning?", competitive: "When does the miss turn into reinforcement, and when is it just damage left sitting there?" }
      ],
      predictionPrompt: {
        gentle: "If challenge is now filtered more carefully, what new problem about self-judgment should the next chapter solve?", 
        direct: "Why does the book need a chapter on illusions of knowing after defining desirable difficulty?", 
        competitive: "If the method is stronger now, what lie can the learner still tell themselves next?"
      }
    }
  },
  examples: [
    {
      exampleId: "ch04-ex01",
      title: "Nina Chooses a Harder Short-Answer Review",
      category: "school",
      format: "decision_point",
      endingType: "broader_principle",
      contexts: ["history review", "short-answer recall", "correction pass"],
      scenario: {
        gentle: "Nina can reread the history notes one more time or close the notebook and answer short questions from memory before checking what she missed.",
        direct: "Nina has to choose between another smooth pass through the notes and a rougher round that makes her generate answers before she can see them.",
        competitive: "Nina can protect the session's calm or make memory fight for the answer and expose what still needs repair."
      },
      whatToDo: {
        gentle: "Have Nina generate the short answers first, then correct the misses and run one answer again.",
        direct: "Use a low-stakes generation-and-repair round instead of another purely guided pass.",
        competitive: "Force the answer, patch the miss, and make the rebuilt version show up again."
      },
      whyItMatters: {
        gentle: "The rougher round can build stronger memory because Nina has to retrieve and repair.",
        direct: "Generation with correction creates useful difficulty instead of another comforting exposure.",
        competitive: "The harder rep earns its place because it rebuilds the answer instead of only displaying it."
      }
    },
    {
      exampleId: "ch04-ex02",
      title: "Devin Learns Calm Training Was Too Guided",
      category: "work",
      format: "postmortem",
      endingType: "self_directed_question",
      contexts: ["new-hire training", "guided walkthrough", "weak retention"],
      scenario: {
        gentle: "Devin designed a calm onboarding flow with almost no visible mistakes during practice. A week later, workers forgot key steps once the guidance disappeared.",
        direct: "Devin's postmortem reveals that the training looked strong partly because the answer stayed too close to the learners the whole time.",
        competitive: "Devin bought a clean room by hiding the hard part. The weakness surfaced the moment the guidance stepped away."
      },
      whatToDo: {
        gentle: "Add low-stakes recall and correction rounds so learners must generate the steps instead of only follow them.",
        direct: "Replace some guided smoothness with supported retrieval and repair.", 
        competitive: "Take away enough support to force memory to work, but keep enough to patch the miss."
      },
      whyItMatters: {
        gentle: "Visible difficulty can help when it reveals and repairs weakness early.",
        direct: "Devin needs desirable difficulty, not calm repetition or unsupported pressure.",
        competitive: "If the hard part never appears in training, it will appear on the job at a worse time."
      }
    },
    {
      exampleId: "ch04-ex03",
      title: "Leah and Omar Argue About Wrong Answers During Practice",
      category: "personal",
      format: "dialogue",
      endingType: "surprising_implication",
      contexts: ["language flashcards", "wrong answers", "repair round"],
      scenario: {
        gentle: "Leah thinks getting a flashcard wrong proves the practice round is going badly. Omar asks whether the wrong answer might be useful if it leads to correction and another try.",
        direct: "Leah treats every miss as a sign she should go back to easier review. Omar points out that the miss may be the first honest signal that repair is needed.", 
        competitive: "Leah calls the miss failure. Omar calls it the exposed seam that easier review kept hidden."
      },
      whatToDo: {
        gentle: "Have Leah correct the answer, explain it once, and retrieve it again later instead of fleeing back to comfort.",
        direct: "Turn the miss into a repair-and-repeat cycle rather than treating it as a verdict.",
        competitive: "Do not glorify the miss or hide from it. Patch it and make memory face it again."
      },
      whyItMatters: {
        gentle: "The error becomes useful only when it leads to stronger reconstruction.", 
        direct: "This shows the chapter's boundary: mistakes help through repair, not by themselves.", 
        competitive: "The miss is raw material. The rebuilt answer is the payoff."
      }
    },
    {
      exampleId: "ch04-ex04",
      title: "Priya Compares Smooth Review With Delayed Retrieval",
      category: "school",
      format: "predict_reveal",
      endingType: "cross_domain",
      contexts: ["delayed review", "weekend gap", "retrieval check"],
      scenario: {
        gentle: "Priya expects the smoother review session to help more than a delayed retrieval round after the weekend gap. The later check shows the rougher recovery round taught more.",
        direct: "Priya predicts that calm immediate review will beat delayed recall. The later retention test favors the method that made her recover after some forgetting.", 
        competitive: "Priya trusts the easy session. The delayed retrieval round wins because memory had to come back from farther away."
      },
      whatToDo: {
        gentle: "Use the later result to recalibrate what useful challenge feels like.",
        direct: "Treat the stronger delayed retention as evidence for desirable difficulty rather than for smoothness.", 
        competitive: "Let later access decide which strain was worth it."
      },
      whyItMatters: {
        gentle: "Some hard-feeling methods help because they force recovery after delay.",
        direct: "The chapter's rule shows up when a rougher practice design produces stronger later access.", 
        competitive: "The session that feels worse can still be doing the real work."
      }
    },
    {
      exampleId: "ch04-ex05",
      title: "Elena Adds Challenge Without Creating Fog",
      category: "work",
      format: "dilemma",
      endingType: "common_trap",
      contexts: ["sales coaching", "support level", "repair path"],
      scenario: {
        gentle: "Elena knows her team needs harder reps, but she worries that removing too much guidance will turn challenge into discouragement.",
        direct: "Elena has to raise the difficulty of practice while keeping a visible path for correction and another attempt.", 
        competitive: "Elena wants pressure that teaches, not pressure that abandons."
      },
      whatToDo: {
        gentle: "Keep the challenge low-stakes and add immediate correction so each miss still has a path back.",
        direct: "Increase retrieval or generation demands without stripping away feedback and repair.", 
        competitive: "Raise the pressure only where the team can still patch the miss and run it again."
      },
      whyItMatters: {
        gentle: "Support is what keeps difficulty desirable instead of wasteful.",
        direct: "The chapter's boundary is visible here: challenge helps when repair stays possible.", 
        competitive: "Once the route back disappears, the rigor has gone bad."
      }
    },
    {
      exampleId: "ch04-ex06",
      title: "Victor Stops Using Comfort As the Only Score",
      category: "personal",
      format: "before_after",
      endingType: "perspective_reframe",
      contexts: ["study routine", "generated answers", "repair"],
      scenario: {
        gentle: "Victor used to judge study by how calm the session felt. Now he looks for whether the challenge made him generate, retrieve, and repair successfully.", 
        direct: "Victor shifts from comfort-based review to a routine that values supported reconstruction.", 
        competitive: "Victor stops paying himself for calm and starts paying attention to what the strain rebuilt."
      },
      whatToDo: {
        gentle: "Keep asking what the difficulty is making learning do, not merely how it feels.", 
        direct: "Judge challenge by mechanism and repair rather than by toughness theater.", 
        competitive: "Make every hard rep explain what it rebuilt and how the miss got patched."
      },
      whyItMatters: {
        gentle: "The new scorecard protects Victor from worshipping either comfort or pain.", 
        direct: "This is the chapter's core filter: useful difficulty has a job and a repair path.", 
        competitive: "If the hard rep cannot name the rebuild, it did not earn the strain."
      }
    }
  ],
  implementationPlan: {
    coreSkill: {
      gentle: "The core skill is judging difficulty by whether it creates reconstruction and repair rather than by whether it simply feels hard.",
      direct: "Core skill: keep challenge attached to mechanism, feedback, and another attempt.",
      competitive: "Core skill: make every hard rep prove what it rebuilt and how it got repaired."
    },
    ifThenPlans: [
      {
        context: "school",
        plan: {
          gentle: "If review feels very smooth, then I will ask whether I am generating or retrieving enough on my own.",
          direct: "If a practice round hides mistakes too well, then I will add supported recall or generation.", 
          competitive: "If the session stays too tidy, I make memory do some honest work."
        }
      },
      {
        context: "work",
        plan: {
          gentle: "If training includes challenge, then I will keep correction and another attempt built in.",
          direct: "If I raise difficulty, then I will protect the repair path rather than stripping away all support.", 
          competitive: "If I increase the pressure, I keep the patch route visible."
        }
      },
      {
        context: "personal",
        plan: {
          gentle: "If I miss during practice, then I will use the miss as repair information instead of as a verdict.", 
          direct: "If difficulty exposes a gap, then I will correct it and retrieve or generate again.", 
          competitive: "If the rep breaks, I patch it and run it again instead of calling the pain progress."
        }
      }
    ],
    twentyFourHourChallenge: {
      gentle: "Within 24 hours, turn one very smooth practice routine into a supported retrieve-or-generate round.",
      direct: "In the next day, add one desirable difficulty to a routine and make sure repair is built in.", 
      competitive: "Today, make one calm routine prove it can rebuild memory under pressure with a path back."
    },
    weeklyPractice: {
      gentle: "For one week, notice one hard-feeling study moment each day and ask whether it was desirable or merely frustrating.", 
      direct: "Track one challenge per day this week and note whether it created retrieval, generation, or repair.", 
      competitive: "For seven days, filter every hard rep: rebuild or waste?"
    }
  },
  reviewCards: [
    {
      cardId: "ch04-rc01",
      front: {
        gentle: "What makes a difficulty desirable in this chapter?",
        direct: "What boundary separates useful challenge from waste here?",
        competitive: "What test does hard practice have to pass?"
      },
      back: {
        gentle: "It must create useful learning work and still leave a path for repair.",
        direct: "A desirable difficulty forces reconstruction, retrieval, or repair without collapsing into overload.",
        competitive: "It earns its place only when the strain rebuilds something and the learner can still patch the miss."
      },
      difficulty: "easy"
    },
    {
      cardId: "ch04-rc02",
      front: {
        gentle: "Why can smooth, errorless practice mislead?",
        direct: "What can a very calm guided session hide?", 
        competitive: "How can a tidy session fake strength?"
      },
      back: {
        gentle: "It can hide how little reconstruction the learner is doing alone.",
        direct: "It can keep the answer close enough that weak learning never gets exposed for repair.",
        competitive: "It can keep the weakness offstage and call the calm mastery."
      },
      difficulty: "easy"
    },
    {
      cardId: "ch04-rc03",
      front: {
        gentle: "When can an error help learning?", 
        direct: "What has to happen after a miss for it to become useful?", 
        competitive: "When does the miss stop being damage and start becoming reinforcement?"
      },
      back: {
        gentle: "When correction follows and the learner tries again.",
        direct: "A miss helps when it becomes repair material rather than a final verdict.",
        competitive: "Patch it, rerun it, and the miss starts paying for itself."
      },
      difficulty: "medium"
    },
    {
      cardId: "ch04-rc04",
      front: {
        gentle: "Why does the chapter reject pain as the goal?", 
        direct: "Why is mechanism more important than toughness here?", 
        competitive: "Why is suffering the wrong metric?"
      },
      back: {
        gentle: "Because difficulty matters only when it creates useful reconstruction or repair.",
        direct: "The method is stronger for what it teaches, not for how punishing it feels.", 
        competitive: "If the hard rep cannot name the rebuild, the strain proved the wrong thing."
      },
      difficulty: "medium"
    },
    {
      cardId: "ch04-rc05",
      front: {
        gentle: "What turns challenge into overload?", 
        direct: "When does a hard method stop teaching?", 
        competitive: "How do you know the pressure has gone bad?"
      },
      back: {
        gentle: "When the learner loses the support needed to repair and understand the miss.", 
        direct: "Difficulty turns into overload when reconstruction gives way to confusion without a route back.", 
        competitive: "When the patch route disappears, the rigor has collapsed into waste."
      },
      difficulty: "hard"
    }
  ],
  keyTakeawayCard: {
    gentle: "A hard-feeling method helps only when it creates useful reconstruction and still leaves a path for repair. This chapter asks you to stop judging challenge by pain alone and start judging it by what it teaches.",
    direct: "The chapter defines desirable difficulty as challenge with a mechanism. Retrieval, generation, and corrected errors can help learning; overload and unsupported frustration cannot.", 
    competitive: "Hard is not the point. Rebuild is the point. If the strain does not strengthen recall, generation, or repair, it failed the chapter's test."
  }
};

const quiz = {
  passingScorePercent: 80,
  questions: [
    { questionId: "ch04-q01", prompt: "What makes a difficulty desirable in this chapter?", choices: ["It feels more punishing than other methods", "It forces useful learning work and preserves a path to repair", "It guarantees a perfect first attempt"], correctIndex: 1, explanation: { gentle: "A desirable difficulty helps because it creates retrieval, generation, or repair while still leaving enough support to learn.", direct: "The chapter filters challenge by mechanism and repair, not by raw strain.", competitive: "Hard earns its place only when the rebuild is real and the patch route stays open." }, bloomsLevel: "remember", depthLevel: "easy" },
    { questionId: "ch04-q02", prompt: "Why can smooth, errorless practice be weaker than it looks?", choices: ["Because it can reduce the learner's need to reconstruct the answer", "Because calm practice always prevents memory from forming", "Because mistakes are always more valuable than correct answers"], correctIndex: 0, explanation: { gentle: "A very guided round can keep the answer too close and hide what the learner cannot yet do alone.", direct: "Smooth practice can overstate learning by lowering visible failure while also lowering reconstruction.", competitive: "The session can look strong because it never lets the weak seam show up." }, bloomsLevel: "understand", depthLevel: "easy" },
    { questionId: "ch04-q03", prompt: "Why might a generated short-answer round help Nina more than another reread?", choices: ["It makes the session feel smoother", "It forces generation and then correction where needed", "It removes the need for later review"], correctIndex: 1, explanation: { gentle: "The chapter values challenge that makes the learner produce and then repair what failed.", direct: "Generation helps here because it creates desirable difficulty instead of another guided exposure.", competitive: "The answer has to be built, not merely glanced at." }, bloomsLevel: "apply", depthLevel: "medium" },
    { questionId: "ch04-q04", prompt: "What did Devin's training postmortem show?", choices: ["The training was too difficult because workers had to retrieve too often", "Calm, guided practice kept the hard part hidden until later", "Errors should be avoided entirely during training"], correctIndex: 1, explanation: { gentle: "The session looked clean partly because the answer stayed too close to the learners.", direct: "Over-guided practice reduced reconstruction, so weak retention appeared later when guidance disappeared.", competitive: "The room stayed calm by hiding the hard part, and the job exposed it later." }, bloomsLevel: "apply", depthLevel: "medium" },
    { questionId: "ch04-q05", prompt: "When can a wrong answer still help learning?", choices: ["When it is corrected and attempted again", "Whenever it makes the learner feel bad enough to remember", "Only when it happens on a formal exam"], correctIndex: 0, explanation: { gentle: "The chapter treats errors as useful when they become repair material.", direct: "A miss helps through correction and another attempt, not through pain alone.", competitive: "The miss starts paying off when it gets patched and rerun." }, bloomsLevel: "understand", depthLevel: "medium" },
    { questionId: "ch04-q06", prompt: "Which idea would the chapter reject?", choices: ["Challenge needs a learning mechanism", "Overload is outside desirable difficulty", "Pain itself is strong evidence that learning is happening"], correctIndex: 2, explanation: { gentle: "The chapter does not treat pain as a reliable sign of learning.", direct: "Toughness theater is exactly what the chapter is trying to block.", competitive: "If all the method proved is that it hurt, it proved the wrong thing." }, bloomsLevel: "analyze", depthLevel: "hard" },
    { questionId: "ch04-q07", prompt: "What should Leah do after a flashcard miss if she wants the error to help?", choices: ["Stop the session and go back to easier review", "Correct the answer and retrieve it again later", "Ignore the miss because mistakes are healthy"], correctIndex: 1, explanation: { gentle: "The error becomes useful through correction and another attempt.", direct: "The chapter wants repair, not error worship or retreat to comfort.", competitive: "Patch the seam and make memory face it again." }, bloomsLevel: "apply", depthLevel: "medium" },
    { questionId: "ch04-q08", prompt: "Why does the next chapter follow this one?", choices: ["Because difficulty solves every calibration problem", "Because learners can still misjudge what they know even with better methods", "Because the book is abandoning difficult practice entirely"], correctIndex: 1, explanation: { gentle: "Chapter 5 addresses the self-judgment problem that can survive even when methods improve.", direct: "Desirable difficulty does not eliminate overconfidence or miscalibration, so the next chapter turns to illusions of knowing.", competitive: "Better tools do not kill self-deception by themselves." }, bloomsLevel: "understand", depthLevel: "easy" },
    { questionId: "ch04-q09", prompt: "What keeps challenge from turning into overload?", choices: ["The learner never makes a mistake", "Enough support remains for understanding, correction, and another try", "The session becomes smooth again"], correctIndex: 1, explanation: { gentle: "Support matters because the learner still needs a path back from the miss.", direct: "Difficulty stays desirable when repair remains possible; overload removes that path.", competitive: "Once the route back disappears, the pressure has gone bad." }, bloomsLevel: "analyze", depthLevel: "hard" },
    { questionId: "ch04-q10", prompt: "What is the chapter's main filter for judging hard-feeling practice?", choices: ["Whether it looks serious to other people", "Whether it creates useful reconstruction and repair", "Whether it produces more mistakes than easier methods"], correctIndex: 1, explanation: { gentle: "The chapter judges difficulty by what it teaches, not by how dramatic it feels.", direct: "Mechanism is the filter: useful challenge rebuilds memory and supports repair.", competitive: "The hard rep stays only if it can name the rebuild." }, bloomsLevel: "analyze", depthLevel: "hard" }
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
const critic = `# ch04 Critic Report

## Result
- Status: PASS with local edit notes

## Strengths
- The chapter keeps the desired boundary between productive challenge and overload explicit.
- The edited draft rejects both comfort worship and macho difficulty worship.
- The bridge into Chapter 5's calibration problem is clear.

## Local Issues Repaired Before Conversion
- Tightened the opening so it begins with the false lesson learners might draw from earlier chapters.
- Replaced one stray toughness drift with mechanism language around reconstruction and repair.
- Sharpened the overload boundary so the chapter does not romanticize unsupported failure.

## Critic Gate Decision
- Prose clears the chapter-specific critic gate and may proceed to structured conversion.
`;
const metrics = {
  chapterId: "ch04",
  canonicalDraftWords: wordCount(fs.readFileSync(path.join(runRoot, "drafts/canonical/ch04.md"), "utf8")),
  editedDraftWords: wordCount(fs.readFileSync(path.join(runRoot, "drafts/edited/ch04.md"), "utf8")),
  easyBreakdownWords: Object.fromEntries(Object.entries(chapter.contentVariants.easy.chapterBreakdown).map(([k, v]) => [k, wordCount(v)])),
  mediumBreakdownWords: Object.fromEntries(Object.entries(chapter.contentVariants.medium.chapterBreakdown).map(([k, v]) => [k, wordCount(v)])),
  hardBreakdownWords: Object.fromEntries(Object.entries(chapter.contentVariants.hard.chapterBreakdown).map(([k, v]) => [k, wordCount(v)])),
  examplesCount: chapter.examples.length,
  reviewCardsCount: chapter.reviewCards.length,
  quizQuestionsCount: quiz.questions.length
};
writeJson("structured/ch04.chapter.json", chapter);
writeJson("quizzes/ch04.quiz.json", quiz);
writeJson("validated/ch04.chapter.json", chapter);
writeJson("validated/ch04.review-package.json", { schemaVersion: "chapterflow.v13.chapter-review-package", packageId: "make-it-stick-20260411-173340-ch04", createdAt: "2026-04-11T14:36:59-03:00", contentOwner: "ChapterFlow", book, chapters: [chapter] });
writeJson("sidecars/ch04.reading-metrics.json", metrics);
fs.writeFileSync(path.join(runRoot, "reports/ch04.critic.md"), critic);
console.log(JSON.stringify(metrics, null, 2));
