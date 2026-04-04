#!/usr/bin/env node
/**
 * fix-dialogues-ch1-12.mjs
 *
 * Rewrites every `format: "dialogue"` example in chapters 1-12 of
 * friends-and-influence.modern.json so that the `scenario` field
 * (all three tones: gentle, direct, competitive) contains at least
 * three back-and-forth quoted-speech exchanges using "double quotes".
 *
 * Rules applied:
 *  - Same characters, setting, and lesson as the original
 *  - 80-150 words per scenario
 *  - 3+ concrete details (names, times, objects, locations)
 *  - 1 sensory/emotional detail
 *  - No em dashes or double hyphens
 *  - No banned phrases (delve, crucial, landscape, realm, furthermore, moreover)
 *  - Tones differ in framing/vocabulary but describe the same scene
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const jsonPath = resolve(
  __dirname,
  "../../book-packages/friends-and-influence.modern.json"
);

const data = JSON.parse(readFileSync(jsonPath, "utf8"));

// ── Replacement map keyed by exampleId ──────────────────────────────
const replacements = {
  // ─── Ch 1: Leona, Jonah, and the Uncapped Beakers ──────────────
  "ch01-ex03": {
    gentle:
      `At 2:15 p.m. the vinegar smell hits before Leona even looks up. Three glass beakers sit uncapped on the bench, and the teacher grades quietly near the sink. A faucet drips somewhere behind them. Leona glances at the checklist taped to the wall and says, "Hey Jonah, which step comes after the pour?" Jonah frowns at his notebook. "I did all of them." Leona taps line four on the laminated sheet. "This one says cap immediately. Want to double-check?" Jonah reads the line, and his shoulders drop. "The caps. I skipped that completely." "No worries. Fix the third beaker and I will get these two," Leona says, already reaching for the nearest lid. "We still have ten minutes before Ms. Padilla collects the trays."`,

    direct:
      `At 2:15 p.m. Leona catches the problem: three glass beakers sitting uncapped on the bench, vinegar sharp in the air, the teacher grading near the sink. A faucet drips behind them. She points at the laminated checklist on the wall. "Jonah, which step follows the pour?" He barely looks up. "I hit every step." "Check line four on the list," Leona says. Jonah scans the sheet and stops. "The caps. I skipped that." "Fix the third beaker. I will handle the other two," Leona tells him, pulling the nearest lid off the tray. "Ms. Padilla collects in ten minutes. We can still close this out clean." He nods and reaches for the cap without argument.`,

    competitive:
      `At 2:15 p.m. Leona spots the risk: three uncapped beakers on the bench, vinegar biting the air, and the teacher grading near the sink with a clear view of everything. The lab clock is running. She taps the laminated checklist on the wall. "Jonah, what does step four say?" He glances sideways. "I followed every step." "Read line four out loud," Leona says, keeping her voice level. Jonah reads it and goes still. "The caps. I missed that." "Fix the third beaker. I will seal these two," she says, already reaching for the nearest lid. "Ms. Padilla collects trays in ten minutes. If we move now the experiment stays clean." He grabs the cap without another word.`
  },

  // ─── Ch 2: Tariq's Group Project Fallout ────────────────────────
  "ch02-ex02": {
    gentle:
      `Tariq sits on the edge of his dorm bed at 9:40 p.m., phone warm in his hand, three paragraphs of blame glowing in the group chat draft. The B-minus still stings. He reads the message one more time and something stops him. He deletes the draft and calls Jalen instead. "Hey, your intro slides were solid. The market-size graphic saved us during Q&A," Tariq says. Jalen pauses. "Thanks. I thought nobody noticed that." "I did. Listen, the professor flagged delivery, not content. What if we schedule a full rehearsal 24 hours before the next one?" "That is fair," Jalen says. "I can set up the conference room Tuesday." Tariq exhales, feeling the knot in his chest loosen. The fix sounds nothing like the blame draft.`,

    direct:
      `Tariq stares at his phone at 9:40 p.m., three paragraphs of blame loaded in the group chat draft. The B-minus feedback is clear: strong content, weak delivery. He rereads the message and notices zero acknowledgment of anyone else's work. He deletes it and calls Jalen. "Your market-size graphic during Q&A was the strongest visual in the deck," Tariq says. Jalen is quiet for a second. "Seriously? I figured nobody registered that." "I did. The professor hit delivery, not content. I want to propose a mandatory rehearsal 24 hours before the next presentation." "Makes sense," Jalen says. "I will book the conference room Tuesday." Tariq ends the call and types a shorter message to the group: one specific compliment for each member, then the rehearsal proposal.`,

    competitive:
      `At 9:40 p.m. Tariq is holding a loaded weapon: three paragraphs of blame ready to fire into the group chat. The B-minus burns, but he reads the draft again and catches a gap. Not one line credits anyone else's work. Sending it wins the argument and kills the team. He deletes the draft and calls Jalen. "Your market-size graphic carried the Q&A section. Best visual in the deck," Tariq says. Jalen goes quiet. "I did not think anyone noticed that." "I noticed. The professor flagged delivery, not content. I want a mandatory rehearsal 24 hours before every presentation going forward." "Fair enough," Jalen replies. "I will lock the conference room for Tuesday." Tariq hangs up and rewrites the group message, one compliment per member and one shared standard.`
  },

  // ─── Ch 3: Priya's Group Project Postmortem ─────────────────────
  "ch03-ex02-priya-group-project": {
    gentle:
      `Priya sits in her quiet dorm room, the grade notification glowing on her phone. Two members missed Thursday's deadline and the project shipped late. Her original message had read: "I need everyone to finish their part by Thursday." One person replied. The rest said nothing. She calls Dev, the one member who responded. "I keep thinking about that message I sent," Priya says, pulling her blanket tighter. "What felt off about it?" Dev pauses. "Honestly? It sounded like your deadline, not ours." "What if I had said something like, if we finish by Thursday nobody has to work over the weekend?" "That would have landed differently," Dev says. "People protect their free time." Priya stares at the notification again, turning his words over slowly.`,

    direct:
      `Priya stares at the grade notification in her dorm room. Two members missed Thursday's deadline. Her original message: "I need everyone to finish their part by Thursday." One reply. Then silence. She calls Dev, the one member who responded. "What went wrong with that message?" she asks. Dev does not hesitate. "It framed the deadline as your problem. Nobody else felt ownership." "What should I have written?" "Something like, if we lock in drafts by Thursday, nobody works the weekend and we get a buffer day for edits." Priya writes the phrase down on the notebook beside her phone. "So the same deadline, but tied to their benefit." "Exactly," Dev says. "People respond to what protects their own time, not what solves your anxiety."`,

    competitive:
      `Priya sits in her dorm room running the post-game analysis. The grade notification glows on her phone. Two members blew through Thursday's deadline. Her original message, "I need everyone to finish their part by Thursday," pulled exactly one reply. She calls Dev, the only responder. "Where did the message fail?" she asks. Dev is direct. "It sold your deadline. Nobody else bought in." "Give me the rewrite." "If we lock in drafts by Thursday, nobody works the weekend and we have a buffer day for edits," Dev says. "Same deadline. Different framing." Priya writes the phrase in her notebook. "So I lead with their payoff, not my stress." "That is the difference between a message people act on and one they ignore," Dev replies. Priya saves the note for next semester.`
  },

  // ─── Ch 4: Farah's Client Follow-Up Backfire ───────────────────
  "ch04-ex02": {
    gentle:
      `Farah stares at the decline email in the quiet of her office, afternoon light cutting across her desk. Six months of work, gone. The client's parting words sit on the screen: "You had good ideas, but I never felt like you knew what we actually needed." She scrolls through her sent folder. Every email is about her agency's services, her team's awards, her wins. She picks up the phone and calls her colleague Marcus. "I just lost the Henderson account," Farah says. Marcus lets out a breath. "What happened?" "They said I never asked about their goals. Not once in six months." "That tracks," Marcus says gently. "Your emails read like press releases. When did you last ask them a question?" Farah is quiet for a long moment, feeling the weight of the answer.`,

    direct:
      `Farah reads the decline email in her office, afternoon light slicing across the desk. The client's exit feedback: "You had good ideas, but I never felt like you knew what we actually needed." She opens her sent folder. Every email pitches her agency's services, her team's awards, her wins. Zero questions about the client's business. She calls Marcus. "I lost the Henderson account," Farah says. "The feedback was that I never asked about their goals." "Pull up your last ten emails to them," Marcus says. She scrolls. "All outbound. All about us." "There is your answer. You ran a broadcast for six months and called it a relationship." "What do I do differently?" "One real question per month, about their business, no pitch attached," Marcus says. "Start with the next client today."`,

    competitive:
      `Farah stares at the decline email, afternoon light cutting across her desk. Six months evaporated. The exit feedback is blunt: "You had good ideas, but I never felt like you knew what we actually needed." She pulls up her sent folder and the evidence is undeniable: every email pitches her agency's services, awards, and wins. She calls Marcus. "I lost Henderson," Farah says. "They said I never once asked about their goals." "That is not surprising," Marcus replies. "Your emails read like billboards. When did you last ask them a single question about their business?" Farah scrolls through six months of sent messages. "Never." "One genuine question per month, no pitch attached," Marcus says. "That is the fix. Start with your next client call today." She writes it down before the call ends.`
  },

  // ─── Ch 5: Lina's Feedback Session Postmortem ──────────────────
  "ch05-ex02-lina-feedback-session": {
    gentle:
      `Lina sits across from her manager Diane five days after the feedback session with Bennett, the conference room still carrying the faint hum of the air vent overhead. Bennett has barely spoken to her since. "The feedback was balanced," Lina says. "I had specific praise, specific growth areas. Why did he shut down?" Diane leans back. "Walk me through the first thirty seconds." "I sat down, opened my notes, and started with the first bullet point." "Did you look at him?" Lina pauses. "I was reading my notes." "That is where you lost him," Diane says. "Before you said a word, your body told him this was a verdict, not a conversation." Lina feels a flush of recognition. "So the content did not matter because the opening already set the tone." "Exactly," Diane says quietly. "Start with the face, not the file."`,

    direct:
      `Five days after the feedback session, Lina sits across from her manager Diane in the conference room, the air vent humming overhead. Bennett has gone near-silent since the meeting. "The feedback was accurate and balanced," Lina says. "Why did it land so badly?" "Describe the first thirty seconds," Diane says. "I sat down, opened my notes, went to the first bullet point." "Eye contact?" "I was reading my file." Diane nods. "Bennett decided the meeting was hostile before you delivered a single word. No smile, no warmth, no signal you were glad to be there. He spent the rest of the session bracing for bad news." "So the opening overrode the content," Lina says. "Every time. Start with the face, not the file," Diane tells her. Lina closes her notebook slowly.`,

    competitive:
      `Five days after the session, Lina sits across from her manager Diane in the conference room, the air vent humming above them. Bennett has been near-silent since. "The feedback was solid. Balanced praise, specific growth areas. What went wrong?" Lina asks. "Tell me the first thirty seconds," Diane says. "I sat down, opened my notes, started reading bullet points." "No eye contact, no greeting, no warmth." "No," Lina admits. "That is where you lost control of the session," Diane says. "Bennett read your face before he heard your words. Cold open equals hostile meeting in his brain. He stopped processing after that." "So perfect content with a cold opening is still a failure." "Every time," Diane replies. "The face sets the frame. The file fills it." Lina makes a note and underlines it twice.`
  },

  // ─── Ch 6: Tobin's Client Call Postmortem ──────────────────────
  "ch06-ex02-tobin-client-call-postmortem": {
    gentle:
      `Tobin sits in the quiet of his cubicle staring at the renewal decline on his screen, fluorescent light buzzing softly overhead. His manager Claire pulls up a chair beside him. "Walk me through your last five calls with this client," she says. Tobin opens his notes. "I opened each one the same way. Hey, how is it going?" "Did you ever use her name?" Claire asks. Tobin scrolls through three months of entries. The warmth drains from his face. "Not once. I forgot it after the first meeting. I have been calling her buddy." "For three months," Claire says gently. "Three months of calls where she never heard her own name." Tobin stares at the notes. "She noticed before I did." "They always do," Claire replies. "A name is the smallest thing that tells someone they are known."`,

    direct:
      `Tobin stares at the renewal decline on his screen, fluorescent light buzzing in his cubicle. His manager Claire sits down beside him. "Pull up your call notes and find the breakdown," she says. Tobin scrolls through three months of entries. "Every call opened with hey, how is it going." "Did you ever use her name?" "No. I forgot it after the first meeting. I have been calling her buddy." Claire nods. "Three months of calls. Zero personal recognition. You treated a client like a stranger for an entire quarter and expected a renewal." "The product was solid," Tobin says. "The product was not the problem," Claire tells him. "She left because she never felt known. People renew where they feel recognized. They leave where they feel interchangeable."`,

    competitive:
      `Tobin stares at the renewal decline glowing on his screen, fluorescent light buzzing overhead in the empty cubicle row. His manager Claire sits down. "Pull up your call notes. Find the failure point," she says. Tobin scrolls through three months. "Every call opened with hey, how is it going. Generic greeting." "Did you use her name even once?" Tobin goes quiet. "I forgot it after the first meeting. I have been saying buddy for three months." "Three months of calls where your client never heard her own name," Claire says. "That is the gap. Your product was fine. Your recognition was nonexistent." "I thought the work spoke for itself," Tobin says. "The work keeps them satisfied. The name keeps them loyal," Claire replies. "She left because she felt like a ticket number, not a person."`
  },

  // ─── Ch 7: Ivy Reviews Her Interview Mistake ──────────────────
  "ch07-ex02-ivy-interview-postmortem": {
    gentle:
      `Ivy sits at her kitchen table that evening, the rejection still echoing in her mind like a struck bell. Her roommate Petra sets a cup of tea down beside her laptop. "The recruiter said I was impressive but did not seem interested in the team or the work," Ivy says. Petra sits across from her. "Did you ask them any questions?" "I prepared twelve answers. I rehearsed transitions. I practiced pacing." "But did you ask them a question about their team?" Petra repeats. Ivy is quiet. "Not one." "That is the gap," Petra says. "You gave a performance. They wanted a conversation. Something like, what is the biggest challenge your team faces right now?" Ivy wraps her hands around the warm mug. "I prepared so hard to be impressive that I forgot to be curious."`,

    direct:
      `Ivy sits at her kitchen table reviewing the loss. The recruiter's feedback: "Impressive but did not seem interested in the team or the work." Her roommate Petra sets down a cup of tea and sits across from her. "How many questions did you ask the interviewer?" Ivy opens her prep notes. "Zero. I had twelve polished answers and zero questions." "There is your diagnosis," Petra says. "You delivered a monologue. They needed a dialogue." "What should I have asked?" "Start with something like, what is the biggest challenge your team faces right now? That signals genuine interest in thirty seconds." Ivy writes it down on the back of her prep sheet. "I spent three weeks preparing to be impressive and forgot to be interested." "Exactly," Petra says. "Fix that and the next one goes differently."`,

    competitive:
      `Ivy sits at her kitchen table dissecting the loss. The recruiter's feedback exposed the gap: "Impressive but did not seem interested in the team or the work." Her roommate Petra sets a cup of tea beside her laptop. "How many questions did you ask the interviewer?" Ivy checks her prep notes. "None. I had twelve rehearsed answers and zero questions." "That is the failure," Petra says. "You ran a one-direction presentation. Interviews are scored on engagement, not performance." "What is the fix?" "One strong question early. Something like, what is the biggest challenge your team faces right now? That flips the dynamic and signals investment." Ivy writes it on her prep sheet. "I optimized for impression and left curiosity out entirely." "Curiosity is the part they remember," Petra replies. "Polish fades. Interest sticks."`
  },

  // ─── Ch 8: Sofia's Client Meeting Preparation ─────────────────
  "ch08-ex01-sofia-client-meeting": {
    gentle:
      `Sofia has thirty quiet minutes before the video call. Sunlight filters through the blinds onto her desk, warming the edge of her coffee mug. Two browser tabs sit open: her pitch deck and the architecture firm's portfolio. She calls her colleague Marco. "Should I rehearse my slides or dig into their recent work?" she asks. "Close the slides. You already know them," Marco says. "Find one project on their site they seem proud of." Sofia clicks to the portfolio tab. "They have a net-zero community center in Portland. Won a regional design award last month." "Open with a question about that building," Marco tells her. "Ask what problem they solved that no one expected." "Instead of starting with my deck?" "The deck can wait ten minutes. The chance to show you studied their work cannot," Marco says. Sofia bookmarks the page and closes her slides.`,

    direct:
      `Thirty minutes before the video call, Sofia stares at two browser tabs: her pitch deck and the architecture firm's portfolio site. Sunlight cuts through the blinds across her desk. She calls Marco. "Rehearse slides or research the client?" she asks. "Research. You know the slides," Marco says. "Find one project on their site they are clearly proud of and open with a question about it." Sofia scrolls the portfolio. "They have a net-zero community center in Portland. Won a regional design award." "Ask what unexpected problem they solved on that project. That shows you did your homework before the first slide." "So I delay the deck?" "Ten minutes. The deck will still be there. The chance to show genuine interest in their work is a first-impression window that closes fast," Marco says. Sofia bookmarks the project page and closes the slides tab.`,

    competitive:
      `Thirty minutes before the call, Sofia is looking at two browser tabs: her pitch deck and the architecture firm's portfolio. Sunlight slices across her desk. She calls Marco. "Slides or client research?" "Research. Every other vendor will open with a pitch. You open with proof you studied their work," Marco says. Sofia scrolls the portfolio. "They have a net-zero community center in Portland. Regional design award last month." "Lead with a question about that building. Ask what problem surprised them during the build." "That gives me an edge over anyone who opens with a deck?" "It gives you the only edge that matters on a first call," Marco replies. "Interest. The deck buys you ten minutes of attention. A question about their best project buys you the whole meeting." Sofia bookmarks the page, closes her slides, and writes the opening question on a sticky note.`
  },

  // ─── Ch 9: Jada and Soren at the Tutoring Center ──────────────
  "ch09-ex03": {
    gentle:
      `At 4:10 p.m. in a tutoring center that smells like dry-erase markers, Soren arrives carrying two weeks of frustration. Rain trails quietly down the window behind Jada. She notices the tension in his shoulders and decides to start somewhere unexpected. "Before we open any problems, I want to share something," Jada says. "Your word problem setups from last week were genuinely strong. Problem six was cleaner than how I would have framed it." Soren stares at her. "Seriously? I feel like I am failing at everything." "The algebra after the setup is where things break down. But the setup itself is solid, and that is actually the harder skill." His grip on the pencil loosens. "Nobody has ever said that to me." "Then they were looking at the wrong part of your work," Jada says. "The foundation is there. Let us build on it together."`,

    direct:
      `At 4:10 p.m. in a tutoring center that smells like dry-erase markers, Soren arrives after two weeks of failed calculus attempts. Rain runs down the window behind Jada. She reads his body language and changes her opening. "Hold on. Before we do any math, I want to tell you something," Jada says. "Your word problem setups from last week were strong. Problem six was cleaner than how I would have framed it." Soren blinks. "Are you serious? I feel like I am failing at all of it." "You are failing at the algebra after the setup. The setup itself is solid. That is the harder skill, and you already have it." He sets his backpack down slowly. "Nobody has told me that." "Then they were looking at the wrong part of your work," Jada replies. "Let us fix the algebra. The foundation is already there."`,

    competitive:
      `At 4:10 p.m. in a tutoring center that smells like dry-erase markers, Soren arrives demoralized after two weeks of failed calculus. Rain runs down the window behind Jada. She reads his body language instantly and changes her opening move. "Hold on. Before we touch any math, listen," Jada says. "Your word problem setups from last week were strong. Problem six was cleaner than how I would have framed it." Soren looks up. "Are you serious? I feel like I am failing at all of it." "You are failing at the algebra after the setup. The setup itself is solid. That is the harder skill, and you have already locked it down." His shoulders drop an inch. "Nobody has told me that." "Then they were diagnosing the wrong problem," Jada says. "Let us fix the algebra. The foundation is already in place."`
  },

  // ─── Ch 10: Rory and Mayaan at the Team Lunch ─────────────────
  "ch10-ex03": {
    gentle:
      `Rory and Mayaan hold different views on remote work, and the disagreement surfaces over a team lunch. Glasses clink softly around them. Rory has data. Mayaan has lived experience. The argument is forming when Rory sets his fork down. "Walk me through what you have been seeing with office productivity," he says. Mayaan leans forward. "Response times are faster. I get answers in two minutes instead of waiting for a Slack reply." "That makes sense. What about deep focus work? Better in the office or at home?" "Home, probably. The office is distracting for that kind of thing." Rory nods slowly. "So quick collaboration is better in office, and deep work is better at home. Is there a version that gives us both?" Mayaan pauses. "Hybrid, maybe. Certain days for meetings, the rest remote. I had not framed it like that before."`,

    direct:
      `Rory and Mayaan disagree about remote work at a team lunch. Glasses clink around them. Rory has data. Mayaan has experience. The argument is about to start when Rory shifts approach. "Walk me through what you have been seeing with office productivity," he says. Mayaan answers without hesitating. "Response times are faster. I get answers in two minutes instead of waiting for a Slack reply." "That makes sense. What about deep focus work? Better in office or at home?" "Home, probably. The office is distracting." Rory sets down his water glass. "So quick collaboration is better in office, deep work is better at home. Is there a version that gives us both?" Mayaan stops mid-bite. "Hybrid, maybe. Certain days for meetings, the rest remote. I had not framed it like that before." The argument never started because Rory replaced it with questions.`,

    competitive:
      `Rory and Mayaan are on opposite sides of the remote work debate at a team lunch. Glasses clink around them. Rory has data. Mayaan has experience. The argument is about to ignite when Rory shifts tactics. "Walk me through what you have been seeing with office productivity," he says. Mayaan fires back. "Response times are faster. I get answers in two minutes instead of waiting for Slack." "That checks out. What about deep focus work? Better in office or at home?" "Home, probably. The office is distracting." Rory leans in. "So quick collaboration is better in office, deep work is better at home. Is there a version that captures both?" Mayaan pauses, fork halfway to her plate. "Hybrid, maybe. Certain days for meetings, the rest remote. I had not framed it like that before." Rory gained more ground with five questions than he would have won with fifty arguments.`
  },

  // ─── Ch 11: Emmett and Alina Debate the History Assignment ────
  "ch11-ex03": {
    gentle:
      `At 2:30 in the library, afternoon sun filtering through dusty air, Emmett and Alina are working through a history assignment. Alina suggests the French Revolution started because of foreign wars. Emmett's notes point to internal economic collapse. He pauses and decides to explore rather than correct. "I had a different take," Emmett says, turning his notebook toward her. "My notes point to the fiscal crisis. Want to check the textbook together?" Alina crosses her arms lightly. "The wars were a big part of it though." "They were, absolutely. I think the assignment wants us to rank the causes. Page 214 might help us figure that out." Alina flips to the page and reads silently. "Okay, fiscal crisis is listed as primary. The wars are secondary." "Your war point would work well in the second paragraph," Emmett says. "Want to put it there?" Alina uncaps her pen. "Sure, that fits."`,

    direct:
      `At 2:30 in the library, sun cutting through dusty air, Emmett and Alina are working on a history assignment. Alina says the French Revolution started because of foreign wars. Emmett knows the textbook points to internal economic collapse. He chooses investigation over correction. "I had a different take. My notes point to the fiscal crisis," Emmett says. "Want to check the textbook?" Alina holds her ground. "The wars were a big part of it though." "They were. I think the assignment wants us to rank the causes. Page 214 might settle it." Alina opens the book and scans the passage. "Okay, fiscal crisis is listed as primary. The wars are secondary." "Your war point works in the second paragraph," Emmett tells her. "Want to put it there?" "Sure, that fits," Alina says, and starts writing.`,

    competitive:
      `At 2:30 in the library, sun cutting through dusty air, Emmett and Alina are on a history assignment. Alina states the French Revolution started because of foreign wars. Emmett knows the textbook says internal economic collapse. He has the facts to shut down her point but chooses a smarter play. "I had a different take," he says. "My notes point to the fiscal crisis. Want to check the textbook?" Alina does not budge. "The wars were a big part of it though." "They were. I think the assignment wants us to rank the causes. Page 214 should settle it." Alina flips the page and reads. "Okay, fiscal crisis is listed as primary. The wars are secondary." "Your war point works in the second paragraph. Want to put it there?" Emmett says. "Sure, that fits," Alina replies, already writing. She corrected herself without anyone telling her she was wrong.`
  },

  // ─── Ch 12: Naomi and Rhea at the Coffee Shop ─────────────────
  "ch12-ex03": {
    gentle:
      `Saturday morning at a coffee shop that smells like fresh espresso. Naomi wraps both hands around her warm mug and takes a breath. She still has the book Rhea lent her three months ago, the one Rhea needs for a Monday class. "I still have your book," Naomi says. "I forgot, and you have asked me twice already. I am sorry." Rhea sets her cup down. "It has been three months, Naomi." "I know. There is no good excuse. I should have set a reminder after the first time you asked." Rhea looks at the table. "I was annoyed, but I did not want to keep bringing it up." "You should not have to," Naomi says. "I will bring it to your place tonight." Rhea meets her eyes. "Tonight works. Thank you for just saying it honestly instead of turning it into a whole thing."`,

    direct:
      `Saturday morning at a coffee shop that smells like fresh espresso. Naomi looks across the table and decides to go first. She still has the book Rhea lent her three months ago, and Rhea needs it for a Monday class. "I still have your book. I forgot, and you have asked me twice already," Naomi says. Rhea's jaw tightens. "Three months, Naomi." "I know. No excuse. I should have set a reminder." "I was annoyed but I did not want to keep nagging," Rhea says. "You should not have to. I will bring it to your place tonight. I am sorry you had to bring it up again." Rhea exhales. "Tonight is fine. Thank you for just saying it instead of making a whole thing out of it." The admission took twenty seconds. The resentment it released had been building for twelve weeks.`,

    competitive:
      `Saturday morning at a coffee shop that smells like fresh espresso. Naomi decides to move first. She still has the book Rhea lent her three months ago, and Rhea needs it for a Monday class. "I still have your book. I forgot, and you have asked me twice. That is on me," Naomi says. Rhea sets her cup down hard. "Three months, Naomi." "I know. No excuse. I should have set a reminder." "I was annoyed but I did not want to keep nagging." "You should not have to," Naomi replies. "I will bring it to your place tonight." Rhea studies her for a second. "Tonight is fine. Thank you for not making a whole production out of it." Twenty seconds of honesty defused twelve weeks of silent resentment. The cost of admitting fault was one sentence. The cost of avoiding it was the friendship.`
  },
};

// ── Validate all replacements ───────────────────────────────────────
const BANNED = /\b(delve|crucial|landscape|realm|furthermore|moreover)\b/i;
const EM_DASH = /\u2014|--/;

let errors = 0;

for (const [exId, tones] of Object.entries(replacements)) {
  for (const tone of ["gentle", "direct", "competitive"]) {
    const text = tones[tone];
    if (!text) {
      console.error(`MISSING ${tone} for ${exId}`);
      errors++;
      continue;
    }

    // Word count
    const words = text.split(/\s+/).length;
    if (words < 80 || words > 150) {
      console.error(
        `WORD COUNT ${tone} for ${exId}: ${words} (must be 80-150)`
      );
      errors++;
    }

    // Banned phrases
    const banned = text.match(BANNED);
    if (banned) {
      console.error(`BANNED PHRASE in ${tone} for ${exId}: "${banned[0]}"`);
      errors++;
    }

    // Em dashes
    if (EM_DASH.test(text)) {
      console.error(`EM DASH / DOUBLE HYPHEN in ${tone} for ${exId}`);
      errors++;
    }

    // Count quoted exchanges (double-quoted speech)
    const quotes = text.match(/"[^"]+"/g) || [];
    if (quotes.length < 3) {
      console.error(
        `TOO FEW QUOTES in ${tone} for ${exId}: found ${quotes.length}`
      );
      errors++;
    }
  }
}

if (errors > 0) {
  console.error(`\n${errors} validation error(s). Aborting.`);
  process.exit(1);
}

// ── Apply replacements ──────────────────────────────────────────────
let applied = 0;

for (const ch of data.chapters) {
  if (ch.number < 1 || ch.number > 12) continue;
  for (const ex of ch.examples || []) {
    if (ex.format !== "dialogue") continue;
    const rep = replacements[ex.exampleId];
    if (!rep) {
      console.warn(`No replacement for ${ex.exampleId} (ch${ch.number})`);
      continue;
    }
    ex.scenario.gentle = rep.gentle;
    ex.scenario.direct = rep.direct;
    ex.scenario.competitive = rep.competitive;
    applied++;
    console.log(`  ✓ ${ex.exampleId}`);
  }
}

console.log(`\nApplied ${applied} replacements.`);

writeFileSync(jsonPath, JSON.stringify(data, null, 2) + "\n", "utf8");
console.log("Wrote", jsonPath);
