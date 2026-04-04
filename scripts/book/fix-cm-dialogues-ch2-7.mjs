#!/usr/bin/env node
/**
 * fix-cm-dialogues-ch2-7.mjs
 *
 * Rewrites dialogue-format scenario fields in The Charisma Myth (chapters 2-7)
 * to include at least 3 back-and-forth quoted speech exchanges using "double quotes".
 * Chapter 1 already has proper quotes and is skipped.
 * Only modifies the `scenario` object inside examples with format === "dialogue".
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const FILE = resolve(
  import.meta.dirname,
  "../../book-packages/the-charisma-myth.modern.json"
);

// ─── replacement scenarios keyed by exampleId ───────────────────────────────

const replacements = {
  // ── Chapter 2: Tariq's Thursday Conversation Shifts Direction ──────────
  "ch02-ex03": {
    gentle:
      `Tariq is on a Thursday 3:15 p.m. video call with his project lead, Sana. The fluorescent glow of his desk lamp reflects off the monitor. Sana's face is tight with frustration. "The client wants the prototype by Monday," she says, her voice clipped. Tariq leans toward his camera. "Monday is not going to work, Sana. Engineering flagged two integration issues yesterday." Silence settles over the call for three seconds. Sana uncrosses her arms. "So what are you proposing?" Tariq holds eye contact through the lens and speaks at half his usual pace. "We ship the front-end demo Monday. The integration layer ships Thursday. The client gets something to react to, and engineering gets room to solve the real problem." Sana's shoulders drop a fraction. "Walk me through the Thursday timeline," she says, her voice carrying curiosity instead of tension.`,

    direct:
      `Tariq is on a Thursday 3:15 p.m. video call. Sana's jaw is set on screen, overhead light casting a hard shadow across her brow. "The client wants the prototype by Monday," she says flatly. "Monday is off the table," Tariq replies, leaning toward his webcam. "Engineering logged two integration blockers yesterday at 4 p.m." The call goes silent. Sana's pen stops tapping on her notebook. "What do you propose?" Tariq pauses two full seconds, maintains camera eye contact, and lowers his speaking rate. "Ship the front-end demo Monday. Ship the integration layer Thursday. Client gets a tangible deliverable. Engineering gets the bandwidth they need." Sana's posture opens. "Tell me about the Thursday delivery," she says. The confrontation converted to collaboration in under thirty seconds.`,

    competitive:
      `Thursday video call, 3:15 p.m. Sana's face fills the screen, tension visible around her jaw. "The client wants the prototype by Monday," she says. Tariq leans forward, the blue glow of his second monitor reflected in his glasses. "Monday is off the table. Engineering flagged two integration blockers yesterday at four." Dead silence. Sana stops fidgeting with her pen. "Then what?" Tariq holds his gaze on the camera lens, pauses two seconds, and speaks slowly. "Front-end demo ships Monday. Integration ships Thursday. The client gets something tangible. Engineering gets room to fix what actually matters." Sana uncrosses her arms. "Walk me through Thursday," she says. The tone pivoted from adversarial to strategic in under half a minute.`
  },

  // ── Chapter 3: Omar's Thesis Defense Changes Course ────────────────────
  "ch03-ex03": {
    gentle:
      `Omar stands at the podium in a seminar room with buzzing overhead lights. Three professors sit behind a long oak table, his printed thesis in front of them. His hands tremble against the podium's wooden edge. Professor Chen tilts her head. "Can you explain why you chose this methodology?" she asks. "The quantitative framework gave me more control over the variable set," he says, words tumbling fast. Professor Adler leans forward, red pen in hand. "But your sample size is quite small for that approach." "I addressed that in the limitations section, page forty-two," Omar replies. Adler removes his reading glasses. "I read page forty-two, Omar. I am asking you to defend the choice here, not cite yourself." The flush rises in Omar's cheeks, warm and sudden. His advisor shifts in the corner chair but stays silent.`,

    direct:
      `Omar grips the podium in a windowless seminar room at 2 p.m. Three professors sit behind a table with his thesis marked in red and blue ink. The overhead lights buzz. Professor Chen opens without preamble. "Walk us through your methodology choice," she says. "The quantitative framework provided greater control over the variable set," Omar answers, words running together. Professor Adler flips to a tabbed page. "Your sample size does not support a claim this broad." "That is addressed in the limitations section. Page forty-two." Adler sets the thesis down flat. "I have read your limitations. I want to hear you defend the choice, not reference your own document." Omar's face heats up. His advisor shifts in the corner but does not intervene.`,

    competitive:
      `Omar is at the podium for his thesis defense at 2 p.m. Three professors sit behind a scratched oak table, his thesis heavily annotated in front of each. The overhead lights hum. His hands are shaking. Professor Chen fires first. "Explain your methodology choice," she says. "The quantitative approach provided greater control over the variable set," Omar says, faster than he planned. Professor Adler leans in, tapping a red-marked page. "The sample size does not support a claim this broad." "I address that in the limitations section. Page forty-two." Adler pulls off his glasses. "I have read page forty-two. I want you to defend the choice here, not cite your own paper." The flush hits Omar's face like a wave of heat. His advisor moves in the corner but says nothing.`
  },

  // ── Chapter 4: The Conversation Zara Almost Could Not Start ────────────
  "ch04-ex03": {
    gentle:
      `Zara sits on the edge of her bed at 9:15 p.m. with her phone face-down on the gray comforter. The bedroom lamp throws a warm circle on the wall. Through the thin wall, muffled television dialogue drifts from the next room. She walks to the doorway. "Hey," she says softly. He looks up from the couch. "What is going on?" "The car insurance lapsed three days ago because I forgot to pay it. The reinstatement fee is four hundred dollars." Silence. He reaches for the remote and mutes the television. "How did that happen?" he asks, his voice careful. "I do not have a better answer than I forgot. I just forgot." Her voice comes out thin and tight in her throat. "We will figure it out," he says, but his eyes stay on the dark screen a beat too long.`,

    direct:
      `Zara is on the edge of her bed at 9:15 p.m., running a self-critical loop that started at breakfast. Three-day insurance lapse. Four hundred dollar reinstatement. Her brain has converted a scheduling error into an identity verdict. The bedroom lamp makes a warm ring on the beige wall. She walks to the doorway. "Hey." Her partner looks up from the couch. "What is going on?" "I messed up. The car insurance lapsed because I forgot to pay it. Reinstatement costs four hundred dollars." He mutes the TV. The sudden quiet feels heavier than the sound did. "How did that happen?" he asks. "I forgot. That is it. I just forgot." Her voice has gone thin and defensive. His gaze drifts back to the muted screen before he responds.`,

    competitive:
      `Zara sits on the edge of her bed at 9:15 p.m. with a self-critical loop running since 7 a.m. Three-day insurance lapse. Four hundred dollar reinstatement. Her brain has escalated the error into a character indictment. The lamp throws a warm circle on the wall. She stands in the doorway. "Hey." He looks up from the leather couch. "What is going on?" "The car insurance lapsed. I forgot to pay it. Reinstatement is four hundred dollars." He reaches for the remote and kills the volume. The silence hits like a pressure change. "How did that happen?" "I forgot. I do not have a better answer." Her voice has contracted to half its normal volume, and she braces for the verdict her own brain has been delivering all day.`
  },

  // ── Chapter 5: Mateo's Three Sentences That Changed the Room Temperature ─
  "ch05-ex03": {
    gentle:
      `Mateo walks into a 9 a.m. Monday meeting that smells like burned coffee from the pot on the credenza. His project team missed a Friday client deadline, and every face around the table is tight. His manager opens with crossed arms. "Who is responsible for the Friday miss?" Mateo feels his chest constrict. He spends ten seconds silently wishing each person well. His shoulders soften. "I want to understand what happened before we figure out what comes next," he says. His manager's eyes narrow. "We need accountability, Mateo, not a therapy session." He holds her gaze, voice steady. "I hear you. I think we get better accountability when people are not bracing for blame. Can I ask two questions first?" The wall clock reads 9:03. She uncrosses her arms and nods, and something in the room releases.`,

    direct:
      `Mateo enters the 9 a.m. Monday meeting after his team missed a client deadline. Burned coffee on the credenza. Six tight faces around the oval table. His manager leans forward. "Who dropped this?" Mateo's chest tightens. He takes ten seconds to silently run a goodwill exercise for each person at the table. His jaw unclenches. "I want to understand what happened before we assign responsibility," he says. His manager fires back. "We need accountability, not group therapy." Mateo holds his measured pace. "I agree. We get more honest accountability when people are not in self-protection mode. Two questions first?" She holds his gaze for three seconds. The wall clock reads 9:03. She nods.`,

    competitive:
      `Monday 9 a.m., conference room, burned coffee on the credenza. Mateo's team missed a Friday client deadline. Six faces locked in self-protection mode. His manager opens hard. "Who dropped this?" she asks, arms crossed. Mateo feels his chest clench. He takes ten silent seconds to direct goodwill toward every person at the table. His posture softens. "I want to understand what happened before we assign blame," he says. His manager snaps back. "We need accountability, not feelings." Mateo does not flinch. "I am asking for accountability. People give you better information when they are not defending themselves. Two questions, then we figure out next steps." The wall clock reads 9:03. She uncrosses her arms and nods.`
  },

  // ── Chapter 6: Three Voices at the Science Fair Booth ──────────────────
  "ch06-ex03": {
    gentle:
      `Elio, Noor, and Suki stand behind their science fair display at 2:15 p.m., gymnasium lights casting a flat glare on their water filtration poster. Judges are due in ten minutes. Elio straightens the beakers. "I think we should each talk about the part we researched," he says. "Clean sections, no overlap." Noor shakes her head. "The judges want a story, not a data dump. Let me open with why clean water matters, then hand off to you for the technical part." Suki, who has been watching a judge two tables away, leans forward. "What if we ask the judges what they want to hear first? Then we follow their lead." Elio frowns. "That is not a plan." "It is the most flexible plan," Suki says, her voice calm. Three instincts pulling in three directions.`,

    direct:
      `Elio, Noor, and Suki are at their science fair table at 2:15 p.m., gymnasium lights buzzing, judges eight minutes away. Elio adjusts a row of test tubes. "Each person covers their section. Clean and efficient," he says. Noor counters immediately. "No one remembers data without a story. I open with the big picture, then you come in with the mechanism." Suki cuts in from the end of the table. "Or we start by asking the judges what they are most curious about and tailor in real time." Elio shakes his head. "That is improvisation, not a strategy." "It is reading the room," Suki replies. Three competing models on a table covered in beakers and printed graphs. Eight minutes to choose.`,

    competitive:
      `Elio, Noor, and Suki stand behind their science fair display at 2:15 p.m. under flat fluorescent lights. Solid data, zero agreement on delivery. Judges eight minutes out. Elio lines up the beakers. "We go section by section. Each person covers their piece. No overlap," he says. Noor folds her arms. "That is a report, not a presentation. Let me open with why anyone should care about water filtration, then hand off." Suki glances at a judge two tables down. "Why decide what to say before we know what they want to hear? Ask the judges what interests them." Elio exhales. "That is not a plan, Suki." "It is the plan that adapts," she says. Three styles competing for the same ten minutes.`
  },

  // ── Chapter 7: Remi Faces the Delegate from the Opposing Bloc ──────────
  "ch07-ex03": {
    gentle:
      `Remi stands near the coffee station at a Model United Nations conference between sessions, a paper cup of lukewarm tea in his hand. A schedule is taped to the wall behind him. A delegate from the opposing bloc approaches, her lanyard badge reading "Committee on Economic Affairs." "Your resolution surprised me," she says, setting down her coffee. "We expected something weaker." Remi pauses, makes eye contact, and lets a warm smile arrive. "Yours set a standard we had to reach," he says. Her shoulders drop a fraction. "Honestly, I was worried we had overreached with the sanctions clause," she admits. "You did not," Remi says. "The enforcement timelines made it hold together." The guarded expression leaves her face, replaced by something closer to relief.`,

    direct:
      `Remi stands near the coffee station at a Model United Nations conference at 11:40 a.m. A schedule is taped to the cinder block wall. A delegate from the opposing bloc walks up, badge reading "Committee on Economic Affairs." "Your resolution surprised me," she says. "We expected something weaker from your committee." Remi makes direct eye contact, delays his smile one beat, and says, "Yours set a standard we had to reach." Her shoulders drop. "Honestly, I was worried we had overreached," she says. "You did not," Remi replies. "The sanctions clause was the strongest thing I read all morning." She pauses, and the competitive guard in her expression dissolves. Three exchanges converted a rivalry opener into genuine information exchange.`,

    competitive:
      `Remi stands at the coffee station during a Model United Nations conference break at 11:40 a.m., a cup of black tea cooling in his hand. A delegate from the opposing bloc approaches, lanyard reading "Committee on Economic Affairs." "Your resolution surprised me," she says. "We expected something weaker from your committee." The competitive reflex is to fire back with his team's depth. Instead, Remi locks eye contact, delays the smile, and says, "Yours set a standard we had to reach." Tension leaves her shoulders. "Honestly, I was worried we had overreached," she admits. "You did not," Remi says. "The sanctions clause was the strongest thing I read all morning." She exhales, and the guarded stance drops.`
  }
};

// ─── main ───────────────────────────────────────────────────────────────────

const raw = readFileSync(FILE, "utf-8");
const data = JSON.parse(raw);

let modified = 0;

for (const chapter of data.chapters) {
  if (chapter.number < 2 || chapter.number > 7) continue;
  if (!chapter.examples) continue;

  for (const example of chapter.examples) {
    if (example.format !== "dialogue") continue;

    const rep = replacements[example.exampleId];
    if (!rep) {
      console.warn(`⚠  No replacement found for ${example.exampleId}`);
      continue;
    }

    // Validate each tone has at least 3 quoted exchanges
    for (const tone of ["gentle", "direct", "competitive"]) {
      const quotes = (rep[tone].match(/"/g) || []).length;
      if (quotes < 6) {
        // 3 exchanges = at least 6 quote marks
        console.error(
          `✗ ${example.exampleId} [${tone}]: only ${quotes / 2} quoted phrases (need ≥3)`
        );
        process.exit(1);
      }
    }

    example.scenario.gentle = rep.gentle;
    example.scenario.direct = rep.direct;
    example.scenario.competitive = rep.competitive;
    modified++;
    console.log(`✓ ${example.exampleId} (ch${chapter.number}) — scenarios replaced`);
  }
}

writeFileSync(FILE, JSON.stringify(data, null, 2) + "\n", "utf-8");
console.log(`\nDone. Modified ${modified} dialogue example(s).`);
