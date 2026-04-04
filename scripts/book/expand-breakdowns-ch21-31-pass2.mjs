#!/usr/bin/env node

/**
 * Pass 2: Expand remaining under-target breakdowns for chapters 21-31.
 * Appends new paragraphs to existing text to reach target word counts.
 *
 * Medium targets: 330-420 words
 * Hard targets:   490-600 words
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PACKAGE_PATH = path.join(
  ROOT,
  "book-packages",
  "friends-and-influence.modern.json"
);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function wordCount(text) {
  return text.trim().split(/\s+/).length;
}

// Each entry appends text to the existing breakdown.
// { chapter, difficulty, tone, append }

const appendages = [

  // Ch21 hard.direct (457 -> need 490, deficit 33)
  {
    chapter: 21,
    difficulty: "hard",
    tone: "direct",
    append: `The Firestone observation about compensation also clarifies why financial incentives alone could not have moved these workers. A bonus would have been absorbed and forgotten. The chalk number persisted, visible every time someone walked onto the floor. Visibility is the key ingredient. A benchmark that disappears loses its motivational force within hours. A benchmark that stays visible keeps the competitive impulse alive across shifts, across days, and across the natural dips in energy that routine work produces.`,
  },

  // Ch21 hard.competitive (460 -> need 490, deficit 30)
  {
    chapter: 21,
    difficulty: "hard",
    tone: "competitive",
    append: `The visibility of the benchmark is the often-overlooked ingredient. A bonus is paid once and forgotten. A chalk number on the floor persists, staring at every worker who walks past it. That persistence keeps the competitive impulse alive through the natural energy dips of routine shifts. Remove the visibility and the motivation fades within hours. Keep it visible and the contest sustains itself without any additional management input.`,
  },

  // Ch22 hard.competitive (464 -> need 490, deficit 26)
  {
    chapter: 22,
    difficulty: "hard",
    tone: "competitive",
    append: `The compounding effect of this technique is significant over time. Each successful round of genuine praise followed by a correction that lands teaches the recipient that positive feedback from this source is trustworthy. Their guard drops faster with each interaction. The correction budget expands rather than shrinks. A leader who opens every feedback conversation with a specific, sincere positive observation builds a relationship where corrections are received as guidance rather than threats.`,
  },

  // Ch23 hard.direct (485 -> need 490, deficit 5)
  {
    chapter: 23,
    difficulty: "hard",
    tone: "direct",
    append: `Clarity paired with respect is the operating standard Carnegie sets for every indirect correction.`,
  },

  // Ch24 medium.direct (315 -> need 330, deficit 15)
  {
    chapter: 24,
    difficulty: "medium",
    tone: "direct",
    append: `The order of disclosure also matters. Leading with the other person's mistake and then mentioning your own feels like an afterthought. Leading with your own and then transitioning to the correction feels like a natural progression from shared experience to practical guidance.`,
  },

  // Ch24 medium.competitive (319 -> need 330, deficit 11)
  {
    chapter: 24,
    difficulty: "medium",
    tone: "competitive",
    append: `The sequence matters: your failure first, their correction second. Reverse the order and the self-disclosure reads as a consolation prize rather than a genuine equalizer.`,
  },

  // Ch25 medium.direct (326 -> need 330, deficit 4)
  {
    chapter: 25,
    difficulty: "medium",
    tone: "direct",
    append: `The question must be genuine, not a performance of consultation with a predetermined answer.`,
  },

  // Ch26 medium.direct (308 -> need 330, deficit 22)
  {
    chapter: 26,
    difficulty: "medium",
    tone: "direct",
    append: `A dismissed employee at a French aviation company illustrates the cost from the other direction. The man was let go with no consideration for his dignity. He left with deep resentment that produced months of negative effects on the company's reputation and its ability to recruit. GE invested five minutes of thought and kept a loyal genius. The aviation company skipped that thought entirely and paid for it across the following year.`,
  },

  // Ch26 hard.direct (484 -> need 490, deficit 6)
  {
    chapter: 26,
    difficulty: "hard",
    tone: "direct",
    append: `The investment is minutes. The return is years of preserved loyalty, institutional memory, and organizational trust.`,
  },

  // Ch26 hard.competitive (469 -> need 490, deficit 21)
  {
    chapter: 26,
    difficulty: "hard",
    tone: "competitive",
    append: `The investment required is minutes of thought. The return is years of preserved loyalty, intact institutional knowledge, and an organization where hard decisions do not produce enemies. That ratio makes face-saving the highest-return investment available to anyone who delivers difficult news.`,
  },

  // Ch27 medium.direct (306 -> need 330, deficit 24)
  {
    chapter: 27,
    difficulty: "medium",
    tone: "direct",
    append: `The failure mode is inflated praise. Telling someone they improved when they did not damages credibility and teaches the person to discount all future feedback. Carnegie requires honesty as the foundation: the improvement must be real, and the data must hold up if the person checks it against their own experience.`,
  },

  // Ch27 medium.competitive (320 -> need 330, deficit 10)
  {
    chapter: 27,
    difficulty: "medium",
    tone: "competitive",
    append: `The failure mode is inflated praise. Tell someone they improved when they did not, and you lose credibility that takes months to rebuild.`,
  },

  // Ch27 hard.direct (457 -> need 490, deficit 33)
  {
    chapter: 27,
    difficulty: "hard",
    tone: "direct",
    append: `Carnegie also addresses the timing of praise within a team setting. Public recognition of a specific gain signals to every other person on the team that measurable improvement is noticed and valued. That signal changes behavior across the group, not just in the person praised. Workers who see that effort is tracked and recognized adjust their own effort accordingly. The leader who praises one person's verifiable gain publicly is simultaneously raising the performance expectations of everyone within earshot.`,
  },

  // Ch27 hard.competitive (456 -> need 490, deficit 34)
  {
    chapter: 27,
    difficulty: "hard",
    tone: "competitive",
    append: `Public recognition of a verified gain has a secondary effect on the rest of the team. Every person who witnesses specific praise for a measurable improvement recalibrates their own effort. They learn that progress is tracked and valued. That signal alone lifts output across the group, not just in the individual praised. The leader who recognizes one person's verified improvement publicly is raising the performance benchmark for everyone within earshot.`,
  },

  // Ch28 medium.direct (314 -> need 330, deficit 16)
  {
    chapter: 28,
    difficulty: "medium",
    tone: "direct",
    append: `The technique also works in reverse as a warning. A negative label, publicly assigned, can lock a person into poor performance just as effectively as a positive label lifts them. Carnegie's caution is clear: guard what you name someone, because they will spend their energy either living up to it or living down to it.`,
  },

  // Ch28 medium.competitive (320 -> need 330, deficit 10)
  {
    chapter: 28,
    difficulty: "medium",
    tone: "competitive",
    append: `The reverse also holds as a warning: a negative label locks someone into poor performance just as powerfully as a positive one lifts them.`,
  },

  // Ch28 hard.direct (484 -> need 490, deficit 6)
  {
    chapter: 28,
    difficulty: "hard",
    tone: "direct",
    append: `The reverse also applies: a negative label, publicly assigned, can trap a person in poor performance with the same force that a positive label lifts them out of it.`,
  },

  // Ch28 hard.competitive (446 -> need 490, deficit 44)
  {
    chapter: 28,
    difficulty: "hard",
    tone: "competitive",
    append: `The reverse operates with equal force. A negative label, publicly assigned, locks a person into the behavior the label describes. Carnegie warns that people will spend their energy either living up to a positive identity or living down to a negative one. The leader who carelessly names someone as unreliable or sloppy is not just describing current performance. They are programming future performance. The label becomes a ceiling, not a diagnosis. Guard what you name people, because the name you choose becomes the standard they work to match, whether it points up or down.`,
  },

  // Ch29 medium.direct (307 -> need 330, deficit 23)
  {
    chapter: 29,
    difficulty: "medium",
    tone: "direct",
    append: `The compounding effect is worth noting. When a one-step framing proves accurate and the person succeeds, their confidence in the corrector increases. They accept the next correction more willingly because the previous one was honest. Over time, a series of accurate, reachable next-step corrections builds a trust account that makes each subsequent correction land faster and with less resistance.`,
  },

  // Ch29 medium.competitive (323 -> need 330, deficit 7)
  {
    chapter: 29,
    difficulty: "medium",
    tone: "competitive",
    append: `Honest framing that proves accurate builds a trust account. Each successful correction makes the next one land faster.`,
  },

  // Ch29 hard.direct (466 -> need 490, deficit 24)
  {
    chapter: 29,
    difficulty: "hard",
    tone: "direct",
    append: `The leader who consistently delivers honest, reachable next-step corrections builds a track record that compounds. Each correction that proves accurate makes the next one land with less resistance. The person being corrected learns that the steps are real and the assessments are trustworthy. That trust is what separates the leader who can correct repeatedly without friction from the leader who battles resistance on every piece of feedback.`,
  },

  // Ch29 hard.competitive (484 -> need 490, deficit 6)
  {
    chapter: 29,
    difficulty: "hard",
    tone: "competitive",
    append: `Each honest, successful correction builds a trust account that makes the next correction land faster and with less resistance.`,
  },

  // Ch30 medium.direct (326 -> need 330, deficit 4)
  {
    chapter: 30,
    difficulty: "medium",
    tone: "direct",
    append: `Skipping the sequence and opening cold with the request produces compliance that requires constant supervision to maintain.`,
  },

  // Ch30 medium.competitive (325 -> need 330, deficit 5)
  {
    chapter: 30,
    difficulty: "medium",
    tone: "competitive",
    append: `The person who skips the stack and leads with the ask fights unnecessary friction on every request.`,
  },

  // Ch30 hard.direct (439 -> need 490, deficit 51)
  {
    chapter: 30,
    difficulty: "hard",
    tone: "direct",
    append: `The distinction between obligation and identity is observable in everyday behavior. A person operating from obligation checks the box, confirms the task is done, and moves on. A person operating from identity invests in the quality of the result because their self-concept is attached to the outcome. They stay late not because someone told them to, but because the work reflects who they believe they are. The factory manager who framed the assignment around the employee's skills produced exactly this kind of investment. The employee was not working for the manager. The employee was working for their own professional identity. That is the shift Carnegie wants every leader to make: from being the source of motivation to being the person who connects the task to the motivation that already exists inside the other person.`,
  },

  // Ch30 hard.competitive (486 -> need 490, deficit 4)
  {
    chapter: 30,
    difficulty: "hard",
    tone: "competitive",
    append: `The person who connects the task to the internal motivation that already exists wins cooperation that renews itself without external pressure.`,
  },

  // Ch31 medium.direct (319 -> need 330, deficit 11)
  {
    chapter: 31,
    difficulty: "medium",
    tone: "direct",
    append: `The corrective is not silence. It is a single honest conversation that trusts the other person to hear the message and respond without being reminded daily that they are falling short.`,
  },

  // Ch31 hard.direct (485 -> need 490, deficit 5)
  {
    chapter: 31,
    difficulty: "hard",
    tone: "direct",
    append: `The corrective is not silence. It is a single complete conversation that respects the other person's ability to hear, process, and respond.`,
  },
];

// ─── MAIN ──────────────────────────────────────────────────────────────

function main() {
  const data = readJson(PACKAGE_PATH);
  let applied = 0;

  for (const entry of appendages) {
    const ch = data.chapters.find((c) => c.number === entry.chapter);
    if (!ch) {
      console.error(`  [SKIP] Chapter ${entry.chapter} not found`);
      continue;
    }

    const variant = ch.contentVariants[entry.difficulty];
    if (!variant || !variant.chapterBreakdown) {
      console.error(
        `  [SKIP] Ch${entry.chapter} ${entry.difficulty}.chapterBreakdown missing`
      );
      continue;
    }

    const oldText = variant.chapterBreakdown[entry.tone];
    const newText = oldText.trim() + "\n\n" + entry.append.trim();
    const oldWc = wordCount(oldText);
    const newWc = wordCount(newText);

    const minTarget = entry.difficulty === "medium" ? 330 : 490;
    const maxTarget = entry.difficulty === "medium" ? 420 : 600;

    if (newWc < minTarget) {
      console.warn(
        `  [WARN] Ch${entry.chapter} ${entry.difficulty}.${entry.tone}: ${newWc} words STILL UNDER ${minTarget}`
      );
    } else if (newWc > maxTarget) {
      console.warn(
        `  [WARN] Ch${entry.chapter} ${entry.difficulty}.${entry.tone}: ${newWc} words OVER ${maxTarget}`
      );
    }

    variant.chapterBreakdown[entry.tone] = newText;
    console.log(
      `  [OK]   Ch${entry.chapter} ${entry.difficulty}.${entry.tone}: ${oldWc} -> ${newWc} words`
    );
    applied++;
  }

  writeJson(PACKAGE_PATH, data);
  console.log(`\nDone. Applied: ${applied}`);
}

main();
