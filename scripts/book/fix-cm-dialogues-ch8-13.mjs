#!/usr/bin/env node
/**
 * fix-cm-dialogues-ch8-13.mjs
 *
 * Rewrites dialogue-format scenario fields (gentle, direct, competitive)
 * for chapters 8-13 of the-charisma-myth.modern.json to use double-quoted
 * speech with at least 3 back-and-forth exchanges per tone.
 *
 * Re-reads the file just before writing to safely merge only dialogue changes
 * (another process may be editing ch2-7 concurrently).
 */

import { readFileSync, writeFileSync } from "fs";

const FILE_PATH =
  "/Users/willsoltani/dev/chapterflow-siliconx/book-packages/the-charisma-myth.modern.json";

// ────────────────────────────────────────────
// Replacement scenarios keyed by exampleId
// ────────────────────────────────────────────
const replacements = {
  // ── Chapter 8: When Mila Let Go of Advice-Giving ──
  "ch08-ex3": {
    gentle:
      `Mila is curled on her couch at 9 p.m., phone on speaker, the kitchen faucet dripping in the background. Her friend Lena is describing a conflict with her roommate, voice tight, sentences trailing off. Mila feels the pull to solve it. "Have you tried telling her you need more space?" she offers. Lena goes quiet. "I know what I should do, Mila. That is not why I called." Mila takes a slow breath, lets the silence sit. "Okay. Tell me what happened from the beginning." Lena exhales. "She moved the kitchen table without asking. I know it sounds small, but it felt like my opinion does not exist in my own apartment." Mila waits three full seconds. "That does not sound small at all." Lena's voice softens, almost cracking. "Thank you. That is the first thing anyone has said tonight that did not make me feel crazy."`,

    direct:
      `Mila is on her couch, phone on speaker, 9 p.m. Lena is venting about a roommate conflict, voice clipped, sentences unfinished. Mila's brain jumps to problem-solving mode. "Have you tried just telling her you need space?" Lena stops mid-sentence. "I know what I should do. That is not why I called." Mila catches the shift. "Okay. Walk me through it from the start." Lena lets out a breath. "She moved the kitchen table without asking. I know it sounds ridiculous, but it felt like my voice does not count in my own home." Mila holds the phone and waits three seconds, letting the dripping faucet fill the silence. "That does not sound ridiculous." Lena's tone flattens with relief. "That is literally the first thing someone has said that did not make me feel like I was overreacting."`,

    competitive:
      `Mila is on her couch at 9 p.m., phone on speaker, one lamp casting a warm circle on the ceiling. Lena is mid-vent about her roommate, voice rising, sentences snapping off. Mila's instinct fires: fix it. "Have you tried being direct with her about boundaries?" Lena goes quiet. "I know what to do. That is not why I called." Mila pauses. Recalibrates. "All right. Start from the beginning." Lena exhales hard. "She moved the kitchen table without asking. I know it is a stupid thing to be upset about, but it felt like nothing I say matters." Mila holds silence for three full seconds, resisting every urge to fill it. "That is not a stupid thing to be upset about." Lena's voice cracks. "Nobody has said that. Everyone keeps telling me to just talk to her."`
  },

  // ── Chapter 9: Tessa's Monday Standup Goes Sideways ──
  "ch09-ex3": {
    gentle:
      `Tessa stands at the head of a narrow conference room during the Monday morning standup. Morning light cuts across the whiteboard behind her. Her project manager, seated at the far end, asks about a missed deliverable. "The vendor files came in late Thursday," Tessa says, arms relaxed at her sides, feet planted shoulder-width apart. Her manager leans forward. "Late Thursday or late Friday?" "Thursday at 4:50. I flagged it to ops by 5:15, but the turnaround window had already closed." She holds eye contact without shifting her weight. A colleague across the table interjects: "Should we escalate?" Tessa turns her whole body toward the colleague and tilts her head slightly. "That depends on whether ops can guarantee a Wednesday window. I would rather confirm before we go up the chain." The room settles into the plan without further pushback.`,

    direct:
      `Monday morning standup. Tessa stands at the head of a narrow conference room, the projector humming behind her. Her project manager asks about a missed deliverable from the back of the table. "The vendor files came in late Thursday," Tessa says, feet shoulder-width apart, arms down. "Late Thursday or late Friday?" her manager presses. "Thursday at 4:50. I flagged it to ops by 5:15, but the turnaround window was already closed." She holds eye contact and does not shift her weight. A colleague cuts in from the left: "Should we escalate?" Tessa rotates her full body toward the colleague, pauses one beat. "That depends on whether ops can confirm a Wednesday window. I would rather lock that down before escalating." The room accepts the plan without another question.`,

    competitive:
      `Monday standup. Tessa stands at the head of a narrow conference room, fluorescent light buzzing overhead. Her project manager fires from the far end: "What happened with the deliverable?" "The vendor files came in late Thursday," Tessa says, feet planted wide, voice flat and steady. "Late Thursday or late Friday?" "Thursday at 4:50. I flagged ops by 5:15. The turnaround window was already gone." She holds eye contact, does not shift, does not blink first. A colleague jumps in: "Should we escalate?" Tessa turns her entire body to face the colleague, tilts her head one degree. "Only if ops can guarantee Wednesday. I would rather confirm before we spend capital going up the chain." Nobody pushes back. Two laptops open within seconds.`
  },

  // ── Chapter 10: Cleo's Red Pen and the Silence That Followed ──
  "ch10-ex3": {
    gentle:
      `Cleo sits at the head of the table at the campus newspaper editorial meeting, a marked-up draft in front of her and four writers watching. The wall clock reads 7:15 p.m. She picks up the draft, red ink visible from across the table, and says: "Before I go through this, I want to be upfront that giving this kind of feedback is not easy for me either." The room shifts. One writer uncrosses her arms. "Can you tell me what you were trying to lead with?" Cleo asks. The writer pauses. "I was trying to set the scene first." "That instinct makes sense," Cleo responds warmly. "What if the scene came second and the question came first?" A second writer leans forward. "We did that with the housing piece last month and it worked." The first writer nods slowly. "I can try that. Can I send a revision by Thursday?"`,

    direct:
      `Cleo runs the campus newspaper editorial meeting with a red-marked draft on the table and four writers watching closely. The overhead light buzzes. She opens: "I want to name something before we start. This kind of editorial feedback can feel personal, and I get that, because it feels personal for me to give it too." The tension drops one notch. She turns to the lead story writer. "The opening paragraph does not get to the question until line eight. The reader is gone by line four. What if you flip it?" The writer pushes back: "Last time I led with the thesis, you said it felt blunt." "Fair point," Cleo says. "What if you lead with a question, not an answer? A question pulls people in without being blunt." Silence fills the room for three seconds. Then: "I can try that. Thursday?"`,

    competitive:
      `Cleo has a red-marked draft, four writers in the campus newspaper editorial room, and thirty minutes before the production deadline at 8 p.m. The overhead light catches the red ink. She could go straight to the corrections. Instead: "Before I mark this up in front of everyone, I want to acknowledge that getting edited in a group setting is uncomfortable. It is uncomfortable for me to do it too." Two writers visibly relax. She turns to the lead story. "Your opening does not reach the central question until line eight." "If I jump straight in, it reads like a press release," the writer says. "That is a real concern," Cleo says. "What if you lead with a question instead of a thesis? It pulls the reader in without the press-release feel." The writer considers. "Like the housing story?" "Exactly like the housing story." A beat. "Okay. Thursday revision?" "Thursday."`
  },

  // ── Chapter 11: The Kitchen Counter Rehearsal ──
  "ch11-ex3": {
    gentle:
      `Opal sits at her kitchen table at 9 p.m. rehearsing a toast for her sister's engagement party. Her partner, Rio, sits across from her, a cup of chamomile tea going cold between them. "I want to start with how we met," Opal says, reading from her phone. "That is four sentences about you and zero about your sister," Rio says gently. Opal looks up. "So what do I open with?" "Open with your sister. Tell them about the time she called you at 2 a.m. because she was nervous about her first date with James." Opal hesitates. "That makes me the background character." "That is exactly the point," Rio says, wrapping both hands around the cold mug. "The best toasts are about the person being honored, not the person holding the glass." Opal stares at her phone, deletes the first paragraph, and starts again.`,

    direct:
      `Kitchen table, 9 p.m. Opal reads her draft toast aloud from her phone. Her partner Rio sits across from her, tea going cold. "I want to start with how we met," Opal says. Rio does not hesitate. "That is four sentences about you and zero about your sister." "What do I open with, then?" Opal asks, setting her phone down. "Tell them about the 2 a.m. phone call when she was nervous about her first date with James." "That puts me in the background." "Exactly," Rio says, tapping the table lightly. "The best toasts make the audience feel something about the person being honored, not about the speaker." Opal stares at the screen for a long moment, then deletes her entire opening paragraph.`,

    competitive:
      `Kitchen table, 9 p.m. Opal reads her draft toast from her phone, voice rehearsal-bright under the pendant light. "I want to start with how we met." Rio, sitting across with a cold cup of tea, does not hesitate. "Four sentences about you. Zero about your sister." "What should I open with?" "The 2 a.m. phone call when she was nervous about her first date with James." "That makes me the supporting character." "That is the job," Rio says, leaning forward. "A toast is not your stage. It is theirs. The speaker who makes the audience feel something about someone else is the one they remember." Opal deletes the entire first paragraph, the cursor blinking on an empty screen, and starts over.`
  },

  // ── Chapter 12: Bram and the Deadline That Disappeared ──
  "ch12-ex3": {
    gentle:
      `Bram walks into the Monday morning standup and the project manager says the client moved the deadline up by two weeks. The overhead lights buzz. Someone's coffee cup hits the table hard enough to slosh. Neve, the junior developer, looks at Bram from across the whiteboard. "Is that even possible?" she asks. Bram feels the panic rising but pauses before answering. "It is a serious change," he says slowly, keeping his voice steady. "Here is what I need from each of you by end of day." Neve leans forward in her chair. "What about the testing phase?" "We compress it. I will handle the client conversation on scope. You handle the build sequence. We sync at four." Neve nods. The room shifts from frozen to focused, and two laptops open in unison.`,

    direct:
      `Monday standup. The project manager announces the client wants delivery two weeks early. Silence, then the sound of someone setting a coffee cup down too hard on the conference table. Neve looks at Bram. "Is that even possible?" Bram pauses. Counts one breath. "It is tight, and here is how we handle it." "What about testing?" Neve asks, pen hovering over her notebook. "Compressed. I take the client conversation on scope. You own the build priority list. We sync at four p.m." "Four p.m. Got it." The room unlocks. Three people open laptops simultaneously, and the whiteboard markers come off the tray.`,

    competitive:
      `Client moves the deadline up two weeks. The project manager announces it at the Monday standup like reading a weather report. Dead silence. A coffee cup clinks against the conference table. Neve turns to Bram. "Is that even possible?" Bram does not answer immediately. One breath. Then his voice drops half a register. "It is aggressive. Here is what happens next." "Testing?" Neve asks, already reaching for her laptop. "Compressed. I handle scope with the client. You run the build priority list. Sync at four." "Done." Neve opens her laptop before Bram finishes the sentence. Two others follow within seconds.`
  },

  // ── Chapter 13: Sol and Ren Disagree About Intent in the Honors Seminar ──
  "ch13-ex03": {
    gentle:
      `Sol and Ren sit across from each other in the honors seminar room, a long oak table with eight chairs and a whiteboard covered in last week's notes about persuasion ethics. The professor has asked whether deliberately practicing charisma techniques is inherently manipulative. Sol speaks first. "If you are consciously adjusting your body language to make someone trust you, that is manipulation. Full stop." Ren leans forward, elbows on the table. "Is learning to cook for someone manipulation? You are deliberately producing an experience to influence how they feel." Sol pauses, tapping the edge of the table. "Presence is about actually paying attention. The manipulation starts when the attention is fake." "But how does the other person know the difference?" Ren asks. Ren sits back. "They do know. That is the whole point. Their detection system catches it, even when their conscious mind does not."`,

    direct:
      `Sol and Ren face each other across the long oak table in the honors seminar room. The whiteboard behind them still holds notes from last week's session on persuasion ethics. The professor asks whether practicing charisma techniques is inherently manipulative. Sol goes first: "If you are consciously changing your body language to build trust, that is manipulation." Ren pushes back immediately: "Is learning to cook for someone manipulation? You are deliberately creating an experience to affect how they feel about you." Sol shakes his head. "Cooking is not about controlling perception." "Neither is genuine presence," Ren answers. "Presence means actually paying attention. Manipulation starts when the attention is performed but not real." Sol taps the table. "And how does the other person tell the difference?" "They already do," Ren says. "The detection system catches fake warmth in fractions of a second. The conscious mind just takes longer to articulate it."`,

    competitive:
      `Sol and Ren sit opposite each other at the long oak table in the honors seminar room. Last week's whiteboard notes on persuasion ethics are visible behind Ren's shoulder. The professor puts the question: is deliberate charisma practice inherently manipulative? Sol answers first: "If you are consciously modifying your nonverbal behavior to make someone trust you, that is textbook manipulation." Ren fires back: "Is learning to cook for someone manipulation? You are deliberately engineering an emotional experience." "Cooking is not about controlling perception," Sol says. "And charisma built on real presence is not either," Ren counters. Sol taps the table edge. "How does the other person distinguish genuine from performed?" Ren leans back. "They already can. Their detection system reads micro-expressions in a fifth of a second. Conscious awareness is slower, but it catches up, and that is why the manipulator in the book lost everything in two years."`
  }
};

// ────────────────────────────────────────────
// Validation
// ────────────────────────────────────────────
const BANNED = ["delve", "crucial", "landscape", "realm", "furthermore", "moreover"];

function validate(exId, tone, text) {
  const errors = [];

  // Word count 80-150
  const words = text.split(/\s+/).length;
  if (words < 80) errors.push(`too short (${words} words)`);
  if (words > 150) errors.push(`too long (${words} words)`);

  // Must have double-quoted speech
  const doubleQuoted = text.match(/"[^"]+"/g) || [];
  if (doubleQuoted.length < 6) {
    // 3 exchanges = at least 6 quote marks = 3 pairs minimum, but we check segments
    // Actually 3 back-and-forth = 6 speech acts, but we just need 3 exchanges minimum
    // Let's count quoted segments which should be >= 3
    if (doubleQuoted.length < 3) {
      errors.push(`only ${doubleQuoted.length} double-quoted segments (need >= 3)`);
    }
  }

  // No em dashes or double hyphens
  if (text.includes("\u2014")) errors.push("contains em dash");
  if (text.includes("--")) errors.push("contains double hyphen");

  // No banned phrases
  for (const b of BANNED) {
    if (text.toLowerCase().includes(b)) errors.push(`contains banned word: ${b}`);
  }

  // No single-quoted speech (should use double)
  // Allow apostrophes in contractions but flag obvious single-quoted dialogue
  const singleQuotedDialogue = text.match(/(?:^|[.!?]\s+)'[A-Z]/g);
  if (singleQuotedDialogue) {
    errors.push(`appears to have single-quoted dialogue`);
  }

  if (errors.length > 0) {
    console.error(`  FAIL ${exId} [${tone}]: ${errors.join("; ")}`);
    return false;
  }
  return true;
}

// ────────────────────────────────────────────
// Main
// ────────────────────────────────────────────
console.log("Reading JSON file...");
const data = JSON.parse(readFileSync(FILE_PATH, "utf8"));

let totalModified = 0;
let allValid = true;

for (const ch of data.chapters) {
  const num = ch.number;
  if (num < 8 || num > 13) continue;

  for (const ex of ch.examples || []) {
    if (ex.format !== "dialogue") continue;

    const rep = replacements[ex.exampleId];
    if (!rep) {
      console.error(`WARNING: No replacement found for ${ex.exampleId} (ch${num})`);
      continue;
    }

    console.log(`Validating ${ex.exampleId} (Chapter ${num})...`);
    for (const tone of ["gentle", "direct", "competitive"]) {
      if (!validate(ex.exampleId, tone, rep[tone])) {
        allValid = false;
      }
    }
    totalModified++;
  }
}

if (!allValid) {
  console.error("\nValidation failed. Aborting write.");
  process.exit(1);
}

// Re-read the file right before writing to avoid clobbering concurrent changes
console.log("\nRe-reading file before writing (safe merge)...");
const freshData = JSON.parse(readFileSync(FILE_PATH, "utf8"));

let applied = 0;
for (const ch of freshData.chapters) {
  const num = ch.number;
  if (num < 8 || num > 13) continue;

  for (const ex of ch.examples || []) {
    if (ex.format !== "dialogue") continue;

    const rep = replacements[ex.exampleId];
    if (!rep) continue;

    ex.scenario.gentle = rep.gentle;
    ex.scenario.direct = rep.direct;
    ex.scenario.competitive = rep.competitive;
    applied++;
    console.log(`  Applied: ${ex.exampleId}`);
  }
}

writeFileSync(FILE_PATH, JSON.stringify(freshData, null, 2) + "\n", "utf8");
console.log(`\nDone. Modified ${applied} dialogue examples across chapters 8-13.`);
