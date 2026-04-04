/**
 * fix-dialogues-ch26-37.mjs
 *
 * Rewrites dialogue-format scenarios in chapters 26-37 of
 * friends-and-influence.modern.json to include at least 3
 * back-and-forth "double-quoted" speech exchanges per tone.
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = resolve(
  __dirname,
  "../../book-packages/friends-and-influence.modern.json"
);

// ── replacement map keyed by exampleId ──────────────────────────────
const replacements = {
  // ── Ch 26: Leona and Darius ───────────────────────────────────────
  "ch26-ex03": {
    gentle: `Leona waits until the floor empties. Warm desk lamp, two coffee cups, 9:14 p.m. in the open-plan office.

"The Q2 board passed on the proposal, Darius. I want you to hear the full picture."

He sets his pen down, jaw tight. "Not approved. Three months of work."

"The cost model on page twelve was praised. Timing was the issue. Q2 priorities were locked before your draft reached the table."

"Where does that leave it?"

"Narrow the scope, resubmit for Q3. I would not ask if I did not believe it had a real chance." She taps the binder. "Thursday work for a revised outline?"

He picks up his pen. "Thursday."`,

    direct: `9:14 p.m. Warm desk lamp, two coffee cups, open-plan office silent. Leona delivers it flat.

"The proposal was rejected for Q2."

Darius sets his pen down. "Rejected. Three months of modeling."

"Timing, not quality. The cost model on page twelve was praised. Q2 priorities were locked before your draft hit the table." She slides the feedback sheet across.

"What is the next move?"

"Narrow the scope, resubmit Q3. A tighter focus removes the budget objection that blocked you."

Darius reaches for his pen. "Revised outline by Thursday."`,

    competitive: `9:14 p.m. Floor empty. Warm desk lamp, two coffee cups, no audience. Leona has seconds to frame the rejection before Darius frames it himself.

"The proposal was rejected for Q2."

He sets his pen down hard. "Three months of modeling."

"Timing killed it, not quality. The cost model on page twelve won praise. Q2 priorities were locked before your draft reached the table." She pushes the feedback sheet across.

"What is the play?"

"Narrow the scope, resubmit Q3. Tighter focus removes the budget objection. I would not float it if I did not think it could win."

Darius pulls the sheet closer. "Thursday. Revised outline."`,
  },

  // ── Ch 27: Mina's Group Project ───────────────────────────────────
  "ch27-ex2": {
    gentle: `Rain taps the biology classroom window at 3:40 p.m. B-minus posted. The postmortem circles slide nine's failed diagram.

Kwame shoves his notebook shut. "Slide nine lost us the grade."

"Labels too small, colors off," Priya adds.

Mina glances at Dev, quiet at the end of the table. He was unreliable for four weeks but showed up prepared for the last three meetings and wrote the strongest section on cell transport.

"Before we keep going," Mina says, "Dev, your cell transport section is why the professor wrote 'excellent depth' on page three."

Dev looks up. "You read the comments?"

"I did. We build the next presentation around that kind of work." The rain softens against the glass.`,

    direct: `3:40 p.m. B-minus on the biology presentation. Rain hits the classroom window. Slide nine's failed diagram glows on the projector.

Kwame shuts his notebook. "Slide nine cost us the grade."

"Labels too small, colors off," Priya adds.

Mina checks the feedback sheet. Dev was unreliable early but showed up prepared for three straight meetings and wrote the cell transport section marked "excellent depth" on page three.

"Dev, your section carried the middle third," Mina says. "The professor flagged it by name."

Dev blinks. "Nobody mentioned that."

"One bad slide does not erase the strongest section in the deck." The postmortem shifts from blame to analysis.`,

    competitive: `3:40 p.m. B-minus posted. Rain on the biology classroom window. The group is building a case against Dev over slide nine's failed diagram.

Kwame slaps his notebook shut. "Slide nine killed us."

"Labels unreadable," Priya adds.

Mina spots the missed variable. Dev was unreliable early but delivered three straight prepared meetings and wrote the cell transport section marked "excellent depth" on page three.

"We are analyzing the wrong data," Mina says. "Dev, your cell transport section scored highest in the deck. Professor flagged it by name."

Dev looks up. "No one said anything."

"If we want an A next time, we build around what worked, not one bad slide."`,
  },

  // ── Ch 28: Talia's Group Project ──────────────────────────────────
  "ch28-ex2": {
    gentle: `Rain against the library window at 4:15 p.m. Talia's group circles the round table near the reserve desk. B on the presentation printout.

"Transitions were rough," Kai says. "Missing citation on slide four."

Priya sighs. "I froze on the second Q&A question."

Talia turns to page two of Professor Lin's feedback. Hugo, quiet all semester, delivered the methodology section so clearly Lin wrote: "clearest procedure explanation this semester."

"Hugo, can I read you something?" Talia slides the sheet over. "Professor Lin singled out your methodology section."

Hugo's eyes widen. "She said that?"

"Word for word. We have problems to fix, but we also have a model for fixing them sitting right here." Hugo straightens in his chair.`,

    direct: `4:15 p.m. Library, round table near the reserve desk. B on the presentation. Rain on the window. Feedback printout face-up.

"Rough transitions, missing citation on slide four," Kai lists.

"I froze on the second Q&A question," Priya says.

Nobody mentions Hugo. Talia checks page two: Professor Lin singled out Hugo's methodology section as "clearest procedure explanation this semester."

"Hugo, did you read page two?" Talia slides it across.

Hugo reads the line. "She wrote that about my section?"

"By name. We are listing failures and ignoring the one part that shows us how to fix the rest." Hugo straightens. The complaints stall.`,

    competitive: `4:15 p.m. Library, round table. B on the presentation. Rain on the window. The group is cataloging failures and missing its best asset.

Kai reads the feedback. "Rough transitions, missing citation on slide four."

"Froze on Q&A," Priya adds.

Nobody mentions Hugo. Talia has page two of Professor Lin's feedback: his methodology section rated "clearest procedure explanation this semester."

"We are overlooking our strongest data point," Talia says. "Hugo, Lin singled out your methodology section by name."

Hugo reads the sheet. "She wrote this about mine?"

"Yours. If we want an A next round, we build around Hugo's approach, not around one missing citation."`,
  },

  // ── Ch 29: Julian and Maren ───────────────────────────────────────
  "ch29-ex2": {
    gentle: `Rain blurs the parking lot lights outside the classroom window, 4:30 p.m. C-plus on the history presentation. Maren built all fourteen slides. She stares at her desk.

Julian reads Dr. Stein's feedback. "Maren, look at this. She praised the thesis and source selection. She wrote 'strong analytical lens' in the margin."

Maren does not look up. "We got a C-plus."

"The grade is about structure, not thinking. The transitions between speakers cost us, not the research."

"So the slides were organized wrong, not researched wrong?"

"Exactly. Reorganizing fourteen slides is a weekend fix, not a semester problem." The tension in Maren's shoulders loosens. Rain keeps falling.`,

    direct: `4:30 p.m. C-plus on the history presentation. Rain blurs the parking lot lights outside. Maren built all fourteen slides. She stares at her desk.

Julian reads Dr. Stein's feedback aloud. "Two problems: poor organization, rough speaker transitions. But she praised the thesis and wrote 'strong analytical lens' in the margin."

"C-plus, Julian."

"The grade reflects structure, not intellect. The research was solid. The packaging failed." He sets the sheet in front of her. "Read page two."

Maren reads. "She wrote 'well-constructed argument'?"

"Slide order and transition timing are mechanical fixes. Fourteen slides, one weekend." Maren exhales.`,

    competitive: `4:30 p.m. C-plus. Rain blurs the parking lot lights outside. Maren built all fourteen slides and is treating the grade like a total loss. Julian reads the data differently.

"Dr. Stein flagged organization and transitions. She praised the thesis and wrote 'strong analytical lens' on page two."

Maren stares at her desk. "We got a C-plus."

"The C-plus reflects packaging, not thinking. The research won. The structure lost." He slides the feedback over.

Maren reads. "She wrote 'well-constructed argument.'"

"The narrative forming around this grade is more damaging than the grade itself. Fourteen slides, one weekend reorganization." Maren straightens.`,
  },

  // ── Ch 30: Samir's Volunteer Drive ────────────────────────────────
  "ch30-ex2": {
    gentle: `Student center, Tuesday afternoon. Chairs scrape tile around Samir at a corner table. His sign-up sheet shows three names. Mass email to two hundred students for Saturday's Elm Street park cleanup. Three responses.

Dalia drops into the chair across from him. "Three names. That is rough."

"I wrote a clear email. Sent it to everyone." He pushes the sheet toward her.

Dalia reads the email on his phone. "You asked two hundred strangers for a favor. Nobody felt personally needed."

"What would you have done?"

"Talked to ten people face to face. Told each one why you specifically wanted them there." She taps the sheet. "Personal ask beats mass ask every time."

Samir writes a new header: "Personal invitations."`,

    direct: `Student center, Tuesday afternoon. Chairs scraping tile. Samir sits with a sign-up sheet showing three names. Mass email to two hundred students for Saturday's Elm Street park cleanup. 1.5% conversion.

Dalia sits down. "Three sign-ups. What happened?"

"Clear email to two hundred people. Nobody responded."

"You asked strangers for a generic favor. No personal connection, no specific role." She reads the email on his phone. "The ask was impersonal, so the response was impersonal."

"What is the fix?"

"Ten face-to-face conversations. Give each person a specific role. That shifts the psychology from obligation to identity."

Samir writes a new header on the sheet: "Personal invitations."`,

    competitive: `Student center, Tuesday afternoon. Chairs scraping tile. Sign-up sheet: three names. Mass email to two hundred students for Saturday's Elm Street park cleanup. 1.5% conversion rate.

Dalia drops into the seat. "Three out of two hundred. Walk me through it."

"Clear email, explained the need, sent it to the full list."

Dalia scans the email on his phone. "You treated two hundred people like one audience. No specific role, no personal stake. Mass ask, mass ignore."

"What converts better?"

"Ten face-to-face asks. Assign a role: 'I need you to lead the south trail section.' You shift the frame from obligation to identity."

Samir flips the sheet and writes: "Personal invitations, 10 names."`,
  },

  // ── Ch 31: Jules and Kieran ───────────────────────────────────────
  "ch31-ex2": {
    gentle: `Library, 6:20 p.m. Pages turn at nearby tables. Jules sits with Kieran's half-finished chemistry study guide section highlighted in yellow. Four meetings, four reminders, fifty percent complete.

Anika slides into the chair beside her. "You are replaying the whole semester."

"I reminded Kieran every meeting. Same sentence: 'Do not forget the study guide.' She turned it in half done the night before the exam."

"What did you actually say each time?"

"The same reminder. Four times." Jules pushes the guide across.

"So you told her what to do. Did you ever ask what was in the way?" Anika taps the blank section. "A reminder does not remove a blocker."

Jules pauses. "I never once asked why."

"That is where the next conversation starts."`,

    direct: `Library, 6:20 p.m. Pages turning at nearby tables. Jules has Kieran's chemistry study guide section highlighted in yellow. Four meetings, four reminders. Delivered at fifty percent the night before the exam.

Anika sits down. "What happened with Kieran's section?"

"Four identical reminders: 'Do not forget the study guide.' She submitted it half done. The group improvised during the test."

"Four identical inputs. What did each accomplish?"

"Nothing." Jules flips the page to show blank sections.

"A reminder signals what needs doing. It does not address why it is not happening. Did you ever ask Kieran what was blocking her?"

Jules pauses. "No. Not once."

"You repeated an input that produced no output. The failure was the feedback loop."`,

    competitive: `Library, 6:20 p.m. Pages turning nearby. Jules has the chemistry study guide open, Kieran's section highlighted yellow. Fifty percent complete. Four meetings, four identical reminders, zero change.

Anika sits down. "Run me through the numbers."

"Four meetings, same line each time: 'Do not forget the study guide.' Kieran submitted it half finished the night before the exam."

"So the reminder failed four times and you kept deploying it."

"What else was I supposed to do?"

"Change the variable. Ask what was blocking her. Break the section into smaller deliverables. Set a checkpoint before the deadline."

Jules is quiet. "I ran the same play four times expecting a different result."

"Now you are reading the data. Diagnose the blocker before repeating the ask."`,
  },

  // ── Ch 32: Luis and Sofia ─────────────────────────────────────────
  "ch32-ex03": {
    gentle: `Driving home from the Garcias' dinner party. Rain on the windshield, wipers on low. Red light on Maple Avenue.

"Fun night," Luis says, hands shifting on the wheel.

"So fun. The kayak story killed." Sofia smiles toward the window.

Luis feels the pull to edit her. "Yeah, that one was... long."

Sofia's voice drops. "You are going to give me notes again."

He watches the rain for a long moment. "I was. I had the whole thing ready. Then I thought about the table. Everyone was laughing. Everyone except me. I was the only one editing you in my head." He exhales. "That is something I need to look at in myself."

Sofia reaches across and squeezes his arm. "Thank you for catching that." The light turns green.`,

    direct: `Driving home from the Garcias' dinner. Rain on the windshield. Red light on Maple Avenue. Luis is composing feedback about Sofia's volume, her long kayak story, her laugh that startled the dog.

"Fun night," he says.

"So fun. The kayak story killed."

He grips the wheel. "That one was... long."

Sofia's voice flattens. "You are going to give me notes again."

"I was. Then I ran the room in my head. Everyone was laughing. The only person composing criticism was me. That is not a Sofia problem. That is a Luis problem."

Sofia pauses. "Thank you for catching that."

"I was treating a dinner like a performance review. The error was mine." The light turns green.`,

    competitive: `Driving home from the Garcias' dinner. Rain on the windshield. Red light on Maple Avenue. Luis is loading his post-event analysis: Sofia's volume, the kayak story, the laugh that startled the dog.

"Fun night," he says.

"So fun. The kayak story killed."

He grips the wheel. "That one was... long."

Sofia goes flat. "You are going to give me notes again."

"I was. Full debrief ready. Then I ran the numbers: everyone at the table was laughing. The only one drafting criticism was me. That is a Luis problem, and I almost made it yours again."

"Thank you for catching that."

"I was about to turn a win into a loss. The whole table enjoyed the evening and I was the outlier." Green light.`,
  },

  // ── Ch 33: Omar and Nora ──────────────────────────────────────────
  "ch33-ex3-omar-nora-dinner": {
    gentle: `Kitchen, 7:15 p.m. Garlic and olive oil in the warm air. Nora stands at the stove holding a wooden spoon, watching Omar walk in. The pasta is plated. The sauce is thin. The noodles, soft.

His instinct: mention both. He pauses at the counter instead.

"This smells incredible," he says. "When did you start adding rosemary?"

Nora's shoulders drop. "Last month. I thought you did not notice."

"I noticed. It changes the whole flavor." He picks up a plate. "Thank you for cooking. Tuesdays are long after the clinic."

Nora sets the spoon down. "You usually have notes by now."

"I usually miss the point by now." He takes a bite. "Tell me about the rosemary." She smiles.`,

    direct: `Kitchen, 7:15 p.m. Garlic and olive oil. Nora at the stove with a wooden spoon, scanning Omar's face as he walks in. Sauce thin, noodles soft. His default: note both problems. He overrides.

"You added rosemary," he says, leaning toward the pot.

Nora's posture shifts. "Last month. Not sure you noticed."

"I noticed. It changes the base." He sits with his plate. "Thank you for cooking. Tuesdays are long after the clinic."

"You usually have corrections by now."

"I usually start with what is wrong. That is the pattern I am breaking." He takes a bite. "The rosemary works. Walk me through the change."

Nora sets the spoon down. The evaluation she expected does not arrive.`,

    competitive: `Kitchen, 7:15 p.m. Garlic and olive oil. Nora at the stove with a wooden spoon, reading Omar's face. Sauce thin. Noodles soft. He has ten seconds to set the evening's tone.

Default move: note both flaws. He overrides.

"You added rosemary," he says, leaning toward the pot.

Nora narrows her eyes. "Last month. Did not think you noticed."

"I noticed. Changes the whole base." He sits. "Thank you for cooking on a Tuesday after the clinic."

"You usually have feedback by now."

"I usually lead with criticism and lose the room before the first bite. Not tonight." He takes a forkful. "The rosemary was a good call."

Nora sets the spoon down. The whole kitchen temperature shifts.`,
  },

  // ── Ch 34: Jada and Miles ─────────────────────────────────────────
  "ch34-ex2-jada-roommate": {
    gentle: `Saturday, 9:10 a.m. The vacuum hums down the hallway. Lemon cleaning solution drifts under Jada's bedroom door. Miles has cleaned the apartment every week without being asked: vacuum Saturdays, bathroom weekly, kitchen daily.

She opens the door. Miles pushes the vacuum past, headphones around his neck.

"Miles." He looks up. "You have cleaned this place every week without anyone saying a word. Bathroom, kitchen, Saturdays. I have been enjoying a clean home and never told you I noticed."

He turns off the vacuum. "I figured nobody cared."

"I cared. I just never said it." She leans on the doorframe. "Thank you. Genuinely."

He smiles, the first real one in weeks. "That means more than you think."`,

    direct: `Saturday, 9:10 a.m. Vacuum in the hallway. Lemon cleaning solution under the door. Miles handles all apartment cleaning: vacuum Saturdays, bathroom weekly, kitchen daily. Jada has never acknowledged it.

She opens the door. Miles pushes the vacuum past, headphones around his neck.

"Miles, stop for a second." He pauses. "You have cleaned every week. Bathroom, kitchen, Saturday vacuum. I have lived in your effort without once saying so."

"I assumed no one noticed."

"I noticed. The silence probably felt the same as not noticing." She holds his gaze. "Thank you. Specifically for the kitchen, every day."

"I was starting to think it did not matter."

"It mattered. The failure was my silence, not your work."`,

    competitive: `Saturday, 9:10 a.m. Vacuum in the hallway. Lemon cleaning solution under the door. Miles handles all apartment cleaning: vacuum Saturdays, bathroom weekly, kitchen daily. Jada's silence is about to cost her.

She opens the door. Miles pushes the vacuum past, jaw set, headphones around his neck.

"Miles." He looks up. "You have cleaned this apartment every week without being asked. I have received the benefit and never said a word."

"I was starting to think nobody cared."

"The work mattered. My silence sent the wrong signal." She steps into the hallway. "Thank you for the kitchen every day. That is the one I take most for granted."

"First time anyone has said that."

"And the gap is my fault. I am not letting it widen again."`,
  },

  // ── Ch 35: Mayaan and Adele ───────────────────────────────────────
  "ch35-ex2": {
    gentle: `Kitchen table, 10 p.m., apartment quiet. Adele's birthday was two days ago. Forgotten. First time in six years. Stress, too little sleep, a calendar reminder Mayaan turned off last year, trusting memory instead.

Adele walks in. "You forgot."

"I forgot." Mayaan looks up. "I turned off the alert because I thought I did not need it. That was the first mistake."

"Two days, Mayaan."

"I know. Your silence told me everything." She traces the wood grain. "Year one, surprise dinners. Year four, calendar alerts. Year six, I trusted memory and it failed."

Adele sits slowly. "What are you going to do about it?"

"Rebuild the system. And stop assuming caring is the same as showing it."`,

    direct: `Kitchen table, 10 p.m. Adele's birthday: two days ago. Forgotten. First time in six years. Root cause: stress, sleep deprivation, calendar reminder disabled twelve months ago.

Adele appears in the doorway. "You forgot my birthday."

"I forgot. I disabled the alert last year. Thought my memory was enough." Mayaan sets her phone down.

"Two days. You did not realize for two days."

"Your silence told me before I checked the date." She lays it out. "Year one, surprise dinners. Year four, alerts. Year six, missed. The trend is clear."

"So what changes?"

"Alert goes back on tonight. But the deeper failure: I confused caring about someone with demonstrating it. Those are different actions."

"I need follow-through, not diagnosis."`,

    competitive: `Kitchen table, 10 p.m. Adele's birthday missed. First time in six years. Cause: stress, sleep deprivation, calendar alert disabled last year. Two days of silence from Adele was the scoreboard.

Adele stands in the doorway. "You forgot."

"I forgot. Turned off the alert, trusted memory, it failed." Mayaan looks up.

"Two full days, Mayaan."

"Your silence told me the score before I checked the date." She traces the decline aloud. "Year one, surprise dinners. Year four, alerts. Year six, missed birthday."

"Now what?"

"Alert goes back on tonight. But the bigger failure: caring Adele cannot see is the same as not caring at all. I am not letting the gap between intention and evidence grow."

"Show me. Do not tell me."`,
  },

  // ── Ch 36: Avery and Marta ────────────────────────────────────────
  "ch36-ex5": {
    gentle: `Glass study room, 4 p.m. Tired faces reflected in the door. Marta shot down three ideas in twenty minutes without offering alternatives. After the meeting, Avery catches her by the water fountain.

"Marta, can I talk to you for a minute?"

"If this is about the meeting, I was being honest."

"Your instincts about what will not work have been right most of the time." Avery keeps her voice warm. "But today you said 'that will not work' three times. Each time, the group lost energy. Nobody offered another idea after the third."

"I did not realize it was that many."

"What if you paired each no with one alternative? Even a rough one." Avery pauses. "Your pattern recognition is valuable. The delivery needs adjusting."

Marta uncrosses her arms. "I can try that Thursday."`,

    direct: `Glass study room, 4 p.m. Marta dismissed three capstone proposals in twenty minutes. No alternatives offered. Group output dropped to zero. Avery pulls her aside by the water fountain.

"Marta, I have specific feedback."

"Go ahead."

"Three rejections in twenty minutes. Each time, you identified a real problem. Zero alternatives. After the third, nobody pitched again."

"I was being direct."

"Accurate, yes. But accuracy without alternatives kills participation. People stop contributing when every idea gets rejected with no path forward."

"What do you want me to do?"

"Pair each rejection with one alternative. 'That will not work because X, but what about Y?' Keeps the group producing." Avery holds eye contact. "Your pattern recognition is the best here. The delivery needs work."`,

    competitive: `Glass study room, 4 p.m. Marta killed three capstone proposals in twenty minutes. No alternatives. Participation dropped to zero. Avery catches her by the water fountain.

"Marta, I have data from today's session."

"I was being honest."

"Every objection was valid. But three rejections, zero alternatives. After the third no, the group stopped pitching. You shut down your own pipeline."

Marta's arms loosen. "I did not see it that way."

"Your pattern recognition is the sharpest in the group. But an asset that only flags problems without generating options is a net negative on output."

"What is the fix?"

"Pair every rejection with one alternative. You keep credibility and the group keeps producing. Right now you are winning the argument and losing the project."`,
  },

  // ── Ch 37: Rhea and Naomi ─────────────────────────────────────────
  "ch37-ex03": {
    gentle: `Break room, 2:45 p.m. Coffee machine clicking. Rhea and Naomi sit by the window after a workshop where three participants independently raised questions about physical intimacy.

Rhea wraps both hands around her mug. "Three participants. One workshop. They are asking for content we do not offer."

Naomi stirs her coffee. "I know. I have been thinking about it since the second one asked."

"We keep stepping around this because David thinks it is too sensitive. But participants are already bringing it up."

Naomi sets the spoon down. "You are right. I have been avoiding the conversation. That is on me."

"What if we frame it as a credibility gap? David listens when credibility is on the line."

"Pull the participant feedback. I will get us on his calendar Thursday."`,

    direct: `Break room, 2:45 p.m. Coffee machine clicking. Rhea and Naomi after a workshop where three participants independently asked about physical intimacy.

"Three participants, one workshop. They are asking for content we do not provide," Rhea says.

"I know." Naomi stares at her coffee.

"We keep avoiding this because David considers it too sensitive. The gap is visible to the audience now."

"I have been dodging the conversation with David. That is my failure."

"Frame it as a credibility gap, not a content addition. David responds to credibility arguments. Participants asking questions we cannot answer is a credibility problem."

"That reframe works. Pull today's feedback. Direct quotes." Naomi pushes her cup aside. "I will get us on David's calendar Thursday."`,

    competitive: `Break room, 2:45 p.m. Coffee machine clicking. Three participants independently raised intimacy questions during today's workshop. The program gap is now visible to the audience.

"Three participants, one workshop. They are asking for content we do not have," Rhea says.

Naomi sets down her mug. "I know."

"David considers it too sensitive. But the participants are not waiting for us. If we do not address this, someone else will."

"You are right. I have been dodging the conversation. That ends now."

"Frame it as a credibility gap, not content addition. David treats credibility threats as reasons to act."

"Pull today's feedback. Exact quotes, not paraphrases. I will get us on David's calendar Thursday morning."

"Thursday morning. Brief ready by Wednesday night." The play is set.`,
  },
};

// ── Main ────────────────────────────────────────────────────────────
const raw = readFileSync(FILE, "utf8");
const data = JSON.parse(raw);

let updated = 0;

for (let i = 25; i < 37; i++) {
  const ch = data.chapters[i];
  if (!ch.examples) continue;
  for (const ex of ch.examples) {
    if (ex.format !== "dialogue") continue;
    const repl = replacements[ex.exampleId];
    if (!repl) {
      console.warn(`  WARN: no replacement for ${ex.exampleId} (ch${ch.number})`);
      continue;
    }
    ex.scenario.gentle = repl.gentle;
    ex.scenario.direct = repl.direct;
    ex.scenario.competitive = repl.competitive;
    updated++;
    console.log(`  Updated ${ex.exampleId} (ch${ch.number})`);
  }
}

writeFileSync(FILE, JSON.stringify(data, null, 2) + "\n", "utf8");
console.log(`\nDone. Updated ${updated} dialogue examples.`);
