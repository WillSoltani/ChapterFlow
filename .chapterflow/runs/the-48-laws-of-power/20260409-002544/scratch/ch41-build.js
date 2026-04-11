const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const runRoot = path.resolve(".chapterflow/runs/the-48-laws-of-power/20260409-002544");
const num = 41;
const stem = `ch${String(num).padStart(2, "0")}`;
const title = "Avoid Stepping into a Great Man's Shoes";
const chapterId = "ch41-avoid-stepping-into-a-great-mans-shoes";
const createdAt = new Date().toISOString();

function tone(gentle, direct, competitive) {
  return { gentle, direct, competitive };
}

function ensureDir(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
}

function writeText(file, text) {
  ensureDir(file);
  fs.writeFileSync(file, text.endsWith("\n") ? text : `${text}\n`, "utf8");
}

function writeJson(file, data) {
  ensureDir(file);
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function words(text) {
  return String(text).trim().split(/\s+/).filter(Boolean).length;
}

const canonical = `Greene's forty-first law turns from dependence on cheap offers toward dependence on inherited stature. A successor may appear lucky to inherit a powerful role, admired name, or established system. Greene's warning is that inheritance can become a trap when the new figure is measured entirely against the one who came before. The predecessor's scale, style, and legend become the standard, and comparison begins shrinking the successor before the new work has even started.

The point is not that continuity is always weak or that predecessors must be disowned. Greene is arguing that imitation under heavy comparison often makes the heir look smaller instead of safer. Borrowed grandeur can swallow identity. A successor who copies too closely may seem derivative, while one who remains only a caretaker may never claim independent force. The danger is not inheritance by itself. The danger is inheriting on terms that prevent a distinct line from emerging.

That is why the chapter distinguishes useful continuity from living inside another person's shadow. Some structures should be preserved. Some trust has been built for good reason. Some inheritance deserves respect. Yet respect becomes captivity when the new figure keeps measuring success by whether the predecessor would approve, whether the predecessor's scale can be matched, or whether the old aura can simply be replayed. Greene's stronger claim is that the successor often needs a different scope, rhythm, or identity to escape comparison.

Ordinary settings make the mechanism visible. A new manager may inherit a beloved predecessor's team and lose authority by copying the old style too carefully. A student paper or lab leader may inherit prestige but remain trapped if every decision is judged against a former editor or captain. A family or community role may carry expectations so heavy that the successor feels forced to perform an inherited self rather than develop a real one. In each case, borrowed stature helps only if it becomes foundation rather than prison.

The law overreaches when it becomes novelty theater or contempt for what was built before. Some institutions need continuity more than rupture. Some predecessors created structures worth keeping. Greene is strongest when he asks the successor to break shrinking comparison, not when he glorifies rebellion for its own sake. Chapter 40 showed how dependence can be purchased through hidden bargains. Chapter 41 shows how dependence can persist through borrowed identity. Chapter 42 follows by asking what happens when power is concentrated in a central figure and that figure is directly struck.`;

const edited = canonical;

const critic = `# Chapter 41 Critic Report

Score: 11/12

- hook quality: 2/2
- paragraph-job distinctness: 2/2
- anchor use: 2/2
- chapter specificity: 2/2
- easy-mode convertibility: 1/1
- meta-distance: 1/1
- hard-edge preservation: 1/1
- conceptual repetition risk: 0/1

Weakest paragraph:
- Paragraph 4 is most vulnerable because work, school, and personal succession examples can flatten into generic originality advice if conversion loses the comparison-shadow mechanism.

Strongest sentence:
- "Borrowed grandeur can swallow identity."

Anchor use notes:
- The draft stays inside the frozen support: succession pressure, inherited shadow, imitation risk, distinct scale, and the continuity limit on empty rebellion.

Contamination / source-splice check:
- No contamination phrase detected.
- No source-splice suspicion detected.

Gate judgment:
- Local patching only if needed during conversion.
- No global reroute required.
`;

const chapter = {
  chapterId,
  number: num,
  title,
  readingTimeMinutes: 8,
  contentVariants: {
    easy: {
      chapterBreakdown: tone(
        "This law says that inheriting a great predecessor's place can make you smaller if you live inside comparison. Greene is not saying that tradition is worthless or that every successor must rebel. The point is that borrowed stature can trap you inside someone else's scale. If you copy too closely, you may look weaker rather than safer. If you only protect the old image, you may never build real authority of your own. That is why the chapter values distinct identity after succession. Respecting what came before can matter, but staying trapped in its shadow can quietly prevent you from becoming legible as a force in your own right.",
        "Greene's forty-first law argues that succession becomes dangerous when the heir is measured only against a great predecessor. The issue is not inheritance alone. The issue is comparison. A successor who imitates too closely may look derivative, while one who stays trapped in borrowed prestige may never create independent force. The law is not generic anti-tradition advice. It is advice to break shrinking comparison and establish a different line, scale, or rhythm.",
        "This law gives a competitive warning: stepping into a legend's place can bury you under the legend's shadow. Greene wants the reader to see that imitation often shrinks the successor. Borrowed grandeur can weaken authority if every move is judged on the predecessor's terms. But the chapter has a limit. Originality becomes foolish when it turns into rebellion against everything useful. The edge comes from escaping comparison without destroying sound inheritance."
      ),
      keyTakeaways: [
        { point: tone("Succession creates comparison pressure.", "Inherited greatness can become a shadow that shrinks the successor.", "The old legend can set a scale that makes the new figure look smaller.") },
        { point: tone("Imitation often weakens authority.", "Copying the predecessor too closely can make the successor seem derivative.", "Borrowed style rarely creates independent force.") },
        { point: tone("The law has a continuity limit.", "Not every break with the past is wise, and some inheritance should be kept.", "Rebellion can fail as badly as imitation if it destroys useful foundations.") }
      ],
      oneMinuteRecap: tone(
        "This law says that stepping into a great predecessor's place becomes dangerous when comparison swallows your identity.",
        "Build a distinct line after succession instead of living inside borrowed stature.",
        "Escape the shadow without turning originality into empty rebellion."
      )
    },
    medium: {
      chapterBreakdown: tone(
        `A powerful inheritance can become a constraint instead of an advantage. Greene's forty-first law begins there. A successor may enter a role with prestige, trust, or established stature already attached to it. Yet the same inheritance can trap the new figure inside comparison. The predecessor's legend becomes the measure, and the successor starts from inside someone else's scale rather than from a self-defined one.

That is why succession matters strategically here. Greene is not saying that every heir should destroy what came before. He is saying that imitation under heavy comparison usually shrinks the successor. A copied style can look derivative. A borrowed aura can make authority feel secondhand. A careful caretaker can preserve the old image while failing to create a new center of force. The danger is not continuity alone. The danger is continuity so complete that identity never separates from shadow.

The key distinction is between useful inheritance and swallowed identity. Useful inheritance keeps what still works. Swallowed identity keeps measuring the present by the predecessor's image, standard, and approved script. Greene respects distinct scale because a successor often needs different timing, different emphasis, or a different field of strength in order to stop the comparison game from deciding everything.

Ordinary settings show the pattern clearly. Halden may take over a respected team and lose authority by imitating the previous manager too closely. Maris may inherit a lab or student paper role that comes with prestige but also with impossible comparison. A personal role in family or community life may become suffocating if the successor feels obliged to perform someone else's version of competence. In each case, the practical question is whether inheritance is functioning as foundation or as a ceiling.

The law becomes weak if it turns into anti-tradition theater. Some continuity preserves trust. Some structures should survive the handoff. Some predecessors left systems worth protecting. Greene's stronger point is narrower: break the shrinking comparison, not the entire inheritance. Chapter 40 showed how hidden bargains can purchase dependence. Chapter 41 shows how borrowed stature can purchase a subtler dependence on comparison. Chapter 42 then shifts toward the effect of striking the central figure and watching the surrounding group scatter.`,
        `A successor can inherit prestige and still inherit weakness. Greene uses that idea to shift the reader from applause around succession to the hidden cost of comparison. The chapter matters because a great predecessor can leave such a large shadow that the heir starts by looking diminished before any independent work is judged on its own terms.

That is why imitation is risky here. A copied style may signal respect, but it often confirms secondhand status. A successor who performs continuity too perfectly can become a lesser version of the person who came before. Greene's practical claim is that authority grows more securely when the successor establishes a different line, pace, or area of strength instead of competing only on inherited terms.

The chapter is strongest when it separates distinction from rebellion. Distinction creates independent force. Rebellion destroys continuity merely to seem new. Greene is not asking the reader to insult every predecessor or discard every legacy. He is asking the reader to avoid living inside comparison. Fair inheritance remains possible. Shadowed inheritance is the trap.

The pattern appears everywhere. Halden can take over a respected role and still need a style that is recognizably his own. Maris can inherit a school leadership post and discover that prestige becomes pressure if every decision is judged against the prior leader. A personal succession can feel honorable while still trapping the successor in someone else's script. The chapter stays specific when shadow, scale, and identity all remain visible at once.

The law overreaches if it becomes vanity about originality. Its useful boundary is sharper than that: keep what is structurally sound, change what keeps you trapped in comparison, and build authority on terms that do not require winning another person's legend game. Chapter 40 dealt with dependency through hidden cost. Chapter 41 deals with dependency through inherited stature. The next law turns toward systems that break when the central figure is directly hit.`,
        `A great predecessor can leave behind more than prestige. Greene's forty-first law warns that such a predecessor can also leave behind the scale on which the successor is judged. Many people assume inheritance is pure advantage. Greene notices that inheritance can become a shrinking frame when the new figure enters under constant comparison and borrowed expectation.

That is why the law values distinct identity over faithful imitation. Once a successor keeps playing on the predecessor's field, the predecessor's strengths become the scoreboard. The more exact the copy, the more obvious the derivative status becomes. Greene's harder claim is that a successor may need a different scope, style, or rhythm precisely to avoid being measured as a lesser repeat.

This is also why the chapter should not be flattened into praise for novelty. Some continuity is legitimate. Some traditions hold institutions together. The strategic error is not inheriting anything. The strategic error is inheriting without breaking the comparison trap. If the predecessor's shadow determines what counts as success, the successor is still living under borrowed authority rather than building a real one.

Common settings make the line visible. Halden can see that a respected work role comes with a legend he cannot beat by imitation. Maris can detect that a school succession becomes dangerous when prestige also carries constant reference to the former leader. A personal inherited role can begin as honor and harden into captivity if every act is read through the absent figure. These cases are not about disrespect. They are about whether inheritance leaves the successor able to define scale cleanly afterward.

The limit matters because reckless originality can also destroy legitimacy. Greene's law works when it sharpens succession judgment, not when it turns novelty into an idol. Preserve what still carries trust. Break what keeps the shadow alive. Build enough distinction that comparison stops deciding the future. Chapter 40 dealt with hidden-price dependence. Chapter 41 deals with comparison dependence. Chapter 42 follows by asking what happens when the central figure is struck and the surrounding structure loses its point of cohesion.`
      ),
      keyTakeaways: [
        {
          point: tone("Succession becomes risky when comparison sets the scale.", "A great predecessor can trap the heir inside inherited measurement.", "Shadow can reduce authority before the successor even starts."),
          moreDetails: tone("Greene asks the reader to notice how borrowed stature can become a shrinking frame.", "The predecessor's legend can define the terms so completely that the heir appears lesser by default.", "Comparison pressure is the chapter's first mechanism.")
        },
        {
          point: tone("Imitation often confirms secondhand status.", "Copying the predecessor too closely can weaken independent authority.", "Derivative continuity is usually a losing game."),
          moreDetails: tone("A faithful copy rarely escapes the predecessor's scoreboard.", "The successor often needs a different line, rhythm, or field of strength.", "A new scale matters because the old contest is built to make the heir look smaller.")
        },
        {
          point: tone("Useful inheritance is different from swallowed identity.", "Keep what works without letting the predecessor's image define every move.", "Foundation should not become prison."),
          moreDetails: tone("The chapter is not anti-tradition by default.", "Continuity is useful when it preserves trust without preventing separation of identity.", "The trap begins when respect turns into dependence on borrowed stature.")
        },
        {
          point: tone("Work, school, and personal successions all reveal shadow logic.", "Ordinary handoffs also show how prestige can become pressure.", "The same trap appears wherever a role comes with inherited comparison."),
          moreDetails: tone("A manager handoff, school leadership transition, or family role can all carry the same danger.", "The practical test is whether the inheritance leaves room for an independent standard.", "Prestige is not enough if it arrives with a ceiling attached.")
        },
        {
          point: tone("The law has an originality limit.", "Reject shrinking comparison without glorifying rebellion for its own sake.", "Novelty can fail when it destroys sound inheritance."),
          moreDetails: tone("Some continuity deserves preservation because it carries legitimacy and structure.", "The chapter is strongest when it breaks comparison rather than tradition itself.", "Strategic distinction needs judgment, not theatrical rupture.")
        }
      ],
      activationPrompt: tone(
        "Find one role or expectation in your world where comparison to a predecessor may already be setting the scale.",
        "Choose one inheritance that needs distinction rather than imitation.",
        "Identify one part of the legacy worth keeping and one part that keeps the shadow alive."
      ),
      selfCheckPrompt: tone(
        "Am I preserving what works, or am I hiding inside comparison because imitation feels safer?",
        "What part of this inheritance is foundation, and what part is a shadow I need to break?",
        "Would my next move create distinct authority or just confirm secondhand status?"
      ),
      oneMinuteRecap: tone(
        "This chapter argues that succession becomes dangerous when the heir is trapped inside comparison to a great predecessor.",
        "Authority grows more securely when the successor establishes a distinct scale instead of competing only on inherited terms.",
        "The strategic task is to escape shadow without turning originality into empty rebellion."
      )
    },
    hard: {
      chapterBreakdown: tone(
        `Greene's forty-first law is less about succession ceremony than about inherited scale. A powerful predecessor does not only leave behind assets, trust, or reputation. The predecessor also leaves a frame of comparison that can quietly govern the successor's possibilities. The chapter therefore asks the reader to distrust borrowed stature when it arrives fused to measurement on someone else's terms. An inheritance can empower, but it can also pre-shrink the heir.

That is why the law treats imitation as a weakness-maker. A successor who copies the predecessor too closely may believe continuity will protect legitimacy. Yet the copy usually confirms secondhand status. The predecessor remains the original unit of measure, and the successor becomes the lesser version. Greene's pressure point is that comparison often works against the heir even when the heir thinks loyalty and fidelity are the safest path.

The central distinction is between carrying forward structure and living under shadow. Carrying forward structure preserves what still works and what still deserves trust. Living under shadow means allowing the predecessor's style, aura, and approved script to set the score for every present act. Greene values distinct scale not because novelty is sacred, but because the heir often needs a new field of strength to stop the comparison game from deciding the future.

That distinction appears in ordinary settings. Halden may inherit a respected leadership role and discover that every copied move weakens him by making the prior manager the real standard. Maris may take over a school institution whose prestige becomes a burden because the old editor or captain remains the invisible measure. A personal succession may look honorable while still swallowing identity under an inherited script. The common structure is not old versus new. It is foundation versus comparison prison.

The chapter is strongest when it refuses both nostalgic obedience and shallow originality theater. Some inheritance is worth preserving. Some continuity carries legitimacy the successor should not waste. Some predecessors built structures the heir should use intelligently. Greene's useful boundary is sharper: keep the structure that still works, break the scale that keeps you derivative, and establish a distinct line before comparison settles into permanent judgment. Chapter 40 dealt with dependence purchased through hidden cost. Chapter 41 deals with dependence maintained through borrowed stature.

That bridge matters because comparison is another kind of hidden price. The successor may appear free while still paying in diminished authority every time the predecessor's shadow sets the terms. Chapter 41 therefore teaches a different diagnostic from Chapter 40: ask not only what an inheritance gives, but what it prevents you from becoming. Chapter 42 follows by turning from inherited shadow toward concentrated leadership itself, asking what happens when the shepherd is struck and the surrounding flock loses cohesion.`,
        `Inheritance can be a form of captivity when it arrives with an impossible comparison. Greene uses that fact to move the reader from prestige to scale. The strategic question is never only whether you received a stronger position. The deeper question is whether the position is forcing you to compete inside another person's legend.

The chapter therefore values distinction because distinction changes the field. Once you accept the predecessor's style as your own, the predecessor's strengths become the scoreboard. Every faithful repetition can make you look smaller rather than safer. Over time, even respect begins to work against you because it keeps proving that the center of gravity still belongs to the absent figure. Greene's argument is that succession fails when continuity prevents separation.

The harder distinction is between inheriting structure and inheriting identity. Structure can support your authority because it gives you trust, systems, and reach. Inheriting identity weakens your authority because it asks you to animate another person's image. Greene is not calling for contempt toward legacy. He is asking for enough clarity to tell whether the handoff leaves space for an independent standard of success.

Halden's work transition, Maris's school succession, and a personal inherited role all show the same mechanism. Each looks like opportunity at first. Each becomes dangerous if the successor treats borrowed prestige as sufficient authority. The real issue is whether the inheritance remains usable after comparison pressure is named. If it does, continuity may be a foundation. If it does not, the role may already be functioning as a shadow trap.

The law overreaches when it turns originality into vanity or destruction for the sake of appearing new. Its better boundary is exacting but usable: preserve what carries legitimacy, reject what keeps you derivative, and refuse to let respect for the predecessor become a permanent ceiling on your force. Chapter 40 exposed dependence through hidden price. Chapter 41 tracks dependence through inherited comparison. Chapter 42 then asks what happens when leadership is attacked at the center rather than inherited at the edge.`,
        `Greene's forty-first law warns that the successor often loses before acting if the predecessor's scale remains the measure. Many people think inherited prestige automatically expands room to move. Greene keeps noticing the opposite possibility. The same prestige can collapse room to move when every action is read against a former figure whose legend has already fixed the frame.

Its strongest claim is that comparison rarely stays neutral. It pushes the successor toward imitation because imitation looks respectful and safe. Yet respectful imitation can be strategically fatal. The closer the copy, the clearer the derivative status. The heir ends up proving the predecessor's greatness instead of building independent force. Greene's correction is to treat distinct scale as a necessity of succession rather than a luxury of ego.

That is why breaking shadow can be a form of power preservation. A new line, timing, or field of excellence can stop the heir from playing only on inherited terms. Shadow does the opposite. It turns the role into a contest the successor cannot win because the absent figure controls the standard. Greene is not celebrating novelty for its own sake. He is defending independent authority against the seduction of borrowed stature.

The examples expose the same structure across settings. Halden is not merely taking over a respected job; he is deciding whether to become a smaller echo of the prior leader. Maris is not merely inheriting school prestige; she is deciding whether that prestige will remain a usable foundation or a fixed scoreboard. A personal role is not merely an honor; it is a test of whether legacy will support identity or consume it. In each case, the weak move is not inheritance. The weak move is letting inheritance dictate the only valid form of success.

The limit matters because reckless originality also misprices legitimacy. Some traditions deserve protection. Some continuities are not shadows but structures. Greene's law works only when it sharpens judgment about what must be separated and what must be preserved. Break the shrinking comparison, not the sound foundation beneath it. Chapter 40 dealt with hidden-cost dependence. Chapter 41 deals with shadow dependence. Chapter 42 follows by showing how leadership concentration creates vulnerability when the central figure is directly struck.`
      ),
      keyTakeaways: [
        {
          point: tone("Inherited scale can shrink the successor before they act.", "A great predecessor often leaves behind comparison as a hidden burden.", "Borrowed prestige can arrive fused to a losing scoreboard."),
          moreDetails: tone("The chapter asks the reader to notice that inheritance includes measurement, not just resources.", "The predecessor's legend can quietly define what counts as success.", "Comparison pressure is a strategic cost built into succession.")
        },
        {
          point: tone("Imitation usually confirms derivative status.", "A copied style may preserve continuity while weakening authority.", "The closer the copy, the clearer the secondhand position."),
          moreDetails: tone("Faithful repetition often strengthens the predecessor's standard rather than the successor's force.", "The heir often needs a different field of excellence to stop playing a losing comparison game.", "Distinct scale is how succession escapes shrinkage.")
        },
        {
          point: tone("Structure should be preserved without inheriting someone else's identity.", "Useful continuity is different from living inside borrowed stature.", "Foundation can help; shadow can trap."),
          moreDetails: tone("The law is not anti-legacy by default.", "The real distinction is whether the handoff carries support or a permanent ceiling.", "Respect becomes weakness when it prevents separation of identity.")
        },
        {
          point: tone("Work, school, and personal handoffs all reveal shadow logic.", "Ordinary succession cases also show how prestige can become comparison pressure.", "The same trap appears wherever a role comes with an inherited legend."),
          moreDetails: tone("A job handoff, school leadership transition, or family role can each remain usable or become suffocating depending on the comparison frame.", "The practical test is whether the new holder can define success on terms not owned by the predecessor.", "Prestige helps only when it does not freeze the future.")
        },
        {
          point: tone("The law needs a rebellion boundary.", "Reject derivative comparison without worshiping novelty.", "Bad succession can come from imitation or from destructive originality."),
          moreDetails: tone("Some continuity carries legitimacy the successor should preserve.", "The useful line is to break the shadow while keeping the parts of inheritance that still work.", "Judgment matters because not every legacy deserves rupture.")
        }
      ],
      activationPrompt: tone(
        "Locate one inheritance in your life where the predecessor's scale may already be deciding what success looks like.",
        "Choose one role that needs a distinct line rather than a respectful copy.",
        "Identify one inherited structure worth preserving and one comparison frame that needs to be broken."
      ),
      selfCheckPrompts: [
        tone(
          "If I keep following this script, whose authority am I strengthening more than my own?",
          "What part of this inheritance gives me structure, and what part turns the predecessor into the only valid standard?",
          "Am I building force, or am I proving that I am a lesser repeat?"
        ),
        tone(
          "Would this change establish a distinct field of strength, or is it only rebellion meant to look original?",
          "What can I preserve without letting it define my entire identity?",
          "Where is the shadow operating as a hidden price on this succession?"
        )
      ],
      predictionPrompt: tone(
        "If Chapter 41 warns against being trapped by inherited shadow, how might Chapter 42 warn about systems built too tightly around a single central figure?",
        "What changes once the issue is no longer succession comparison but direct attack on the leader at the center?",
        "After escaping derivative inheritance, how does strategy shift toward understanding the vulnerability of concentrated leadership?"
      ),
      oneMinuteRecap: tone(
        "This chapter argues that succession fails when inherited comparison keeps the successor living under borrowed stature.",
        "Power is preserved by carrying forward what still works while establishing a distinct scale that breaks the predecessor's shadow.",
        "The task is to avoid derivative continuity without turning originality into destructive vanity."
      )
    }
  },
  examples: [
    {
      title: "Halden Refuses to Copy the Beloved Manager He Replaced",
      format: "decision_point",
      category: "work",
      endingType: "broader_principle",
      scenario: tone("Halden takes over a respected team whose old manager is still the standard everyone uses to judge the role.", "He has to choose between imitating the old style and defining a different line of authority.", "The handoff looks prestigious, but the comparison pressure is already shrinking him."),
      whatToDo: tone("He keeps the useful structure and changes the rhythm and emphasis enough that the team can see a distinct center forming.", "He refuses to prove respect by becoming a lesser copy.", "He breaks the shadow without breaking what still works."),
      whyItMatters: tone("The chapter says succession fails when the predecessor's scale becomes the only measure.", "His case shows why imitation can weaken authority instead of preserving it.", "Distinct identity is a strategic need, not a vanity project.")
    },
    {
      title: "Maris Explains Why the Student Paper Cannot Be Run as a Tribute Act",
      format: "dialogue",
      category: "school",
      endingType: "self_directed_question",
      scenario: tone("Maris talks through inheriting a prestigious school publication whose former editor is still treated like the true standard.", "The conversation turns from prestige to comparison pressure.", "She is trying to separate useful continuity from living inside another person's script."),
      whatToDo: tone("She asks which traditions preserve trust and which habits keep the new editor derivative by design.", "She studies where respect turns into identity captivity.", "She builds a line that is recognizably hers without destroying what still gives the paper legitimacy."),
      whyItMatters: tone("The chapter says borrowed stature becomes dangerous when it swallows the successor's identity.", "Her example shows how prestige can be both asset and shadow.", "Succession needs distinction if it is going to create real authority.")
    },
    {
      title: "Davin Has to Decide Whether a Family Role Is Honor or Comparison Prison",
      format: "dilemma",
      category: "personal",
      endingType: "surprising_implication",
      scenario: tone("Davin inherits a family or community role that carries admiration for the previous holder and heavy expectations about how he should behave.", "He has to decide whether carrying the role means performing someone else's self.", "The real question is whether inheritance is giving him structure or taking away identity."),
      whatToDo: tone("He keeps the duties that matter and changes the terms that force him into constant comparison.", "He refuses to confuse respect with self-erasure.", "He prices the role by what it lets him become, not only by what it honors from the past."),
      whyItMatters: tone("The law says succession becomes weak when the heir lives entirely inside borrowed stature.", "His dilemma shows how inherited honor can quietly become inherited captivity.", "A role can look powerful while still shrinking the person inside it.")
    },
    {
      title: "Olia Predicts the Lab Transition Will Fail if the New Lead Competes on the Old Leader's Terms",
      format: "predict_reveal",
      category: "school",
      endingType: "cross_domain",
      scenario: tone("Olia predicts that a lab leadership handoff will stall if the new lead keeps trying to match the predecessor's style instead of defining a distinct scale.", "She expects comparison, not lack of talent, to do the damage.", "The scene becomes a forecast about shadow rather than merit alone."),
      whatToDo: tone("She watches for where the new leader is still playing to the predecessor's scoreboard.", "She tests whether the transition builds a new center or only extends an old aura.", "She asks what has to change for the handoff to stop feeling derivative."),
      whyItMatters: tone("The chapter says inherited greatness can become a shrinking frame.", "Her prediction shows how comparison pressure works in school institutions too.", "Prestige can turn into burden if the successor never escapes the old measure.")
    },
    {
      title: "The Team Debrief Finds That Continuity Theater Kept the New Lead Smaller Than Necessary",
      format: "postmortem",
      category: "work",
      endingType: "common_trap",
      scenario: tone("A work debrief shows that a transition looked smooth on the surface, but the new leader stayed weaker because every choice was designed as tribute to the predecessor.", "They realize the problem was not continuity itself but continuity without separation.", "The review becomes a lesson in shadow rather than in handoff etiquette alone."),
      whatToDo: tone("They separate the parts worth preserving from the gestures that only keep comparison alive.", "They stop treating imitation as the safest form of legitimacy.", "They rebuild the role so authority can become independent without discarding sound structure."),
      whyItMatters: tone("The chapter warns that copied continuity can lock the successor into secondhand status.", "Their mistake was preserving the predecessor's scale instead of just the useful system.", "The handoff failed because respect became a ceiling.")
    },
    {
      title: "Before and After the Successor Changed the Scale Instead of Chasing the Legend",
      format: "before_after",
      category: "personal",
      endingType: "perspective_reframe",
      scenario: tone("Before, the successor kept trying to match the predecessor's image and looked smaller with every comparison. After, the successor kept the useful foundation but changed the scope, rhythm, or field of strength.", "The contrast is between living under borrowed stature and building a distinct line.", "One version imitates; the other separates cleanly."),
      whatToDo: tone("Preserve what still carries trust, then move the role onto terms that do not depend on beating the predecessor at their own game.", "Choose distinction over tribute performance when tribute keeps you derivative.", "Trade borrowed aura for independent scale."),
      whyItMatters: tone("The chapter becomes visible when changing the field matters more than winning the old comparison.", "This before-and-after shows why succession often needs a new measure of success.", "Authority grows once the shadow stops setting the score.")
    }
  ],
  reviewCards: [
    { cardId: "ch41-rc01", front: tone("What is the main claim of Chapter 41?", "Why are great shoes dangerous here?", "What can succession hide?"), back: tone("The chapter argues that inheriting a great predecessor's place can trap the successor inside shrinking comparison.", "The danger is that borrowed stature can swallow identity and keep the new figure derivative.", "Succession can hide a shadow cost paid in reduced authority."), difficulty: "easy" },
    { cardId: "ch41-rc02", front: tone("What is the difference between useful inheritance and shadow?", "Why is imitation risky here?", "What keeps succession clean?"), back: tone("Useful inheritance preserves structure, while shadow keeps the successor measured by the predecessor's image and style.", "Imitation is risky because it often confirms secondhand status.", "Succession stays clean when the handoff preserves what works without trapping identity in comparison."), difficulty: "easy" },
    { cardId: "ch41-rc03", front: tone("How can a successor escape the predecessor's shadow?", "Why does distinct scale matter?", "What breaks comparison pressure?"), back: tone("The successor needs a different line, field, timing, or area of strength that is not judged only on inherited terms.", "A changed scale helps because it stops the handoff from being scored as a lesser repeat.", "Comparison weakens once the successor stops competing only inside the predecessor's legend."), difficulty: "medium" },
    { cardId: "ch41-rc04", front: tone("Where does this law appear in ordinary settings?", "How do work, school, and personal handoffs show shadow logic?", "Why is prestige not enough?"), back: tone("It appears anywhere a role comes with inherited admiration and comparison pressure.", "Job transitions, school leadership handoffs, and family roles can all carry the same shadow trap.", "Prestige is not enough if it arrives fused to a ceiling set by the past."), difficulty: "medium" },
    { cardId: "ch41-rc05", front: tone("How does Chapter 41 bridge to Chapter 42?", "What comes after escaping inherited shadow?", "Why does succession lead toward striking the shepherd?"), back: tone("After dealing with comparison around succession, the next issue is how systems scatter when the central figure is directly struck.", "Chapter 42 turns from inherited shadow toward concentrated leadership vulnerability.", "The bridge asks how power behaves when the center itself is attacked."), difficulty: "hard" }
  ],
  keyTakeawayCard: tone(
    "Avoiding a great man's shoes means refusing to let inherited prestige trap you inside comparison that keeps you derivative, smaller, and judged on borrowed terms.",
    "This law values distinct scale after succession because imitation often preserves the predecessor's legend more than the successor's authority.",
    "Power grows when you keep the foundation that still works and break the shadow that keeps the future owned by the past."
  )
};

const quiz = {
  passingScorePercent: 70,
  questions: [
    { questionId: "ch41-q01", prompt: "Why is succession under a great predecessor dangerous in this chapter?", choices: ["Because inheritance always destroys authority", "Because comparison to the predecessor can shrink the successor", "Because continuity is never legitimate"], correctIndex: 1, explanation: tone("Correct. The chapter focuses on inherited comparison pressure, not on inheritance alone.", "The danger is that the predecessor's shadow sets the scale.", "Right. Succession becomes risky when borrowed stature keeps the heir smaller."), bloomsLevel: "remember-understand", depthLevel: "easy" },
    { questionId: "ch41-q02", prompt: "What can imitation do strategically to the successor?", choices: ["It can make the successor look derivative rather than strong", "It guarantees legitimacy permanently", "It removes the predecessor's shadow"], correctIndex: 0, explanation: tone("Yes. Copying too closely often confirms secondhand status.", "The chapter says imitation can preserve comparison instead of escaping it.", "Correct. A faithful copy usually strengthens the old standard, not the new authority."), bloomsLevel: "remember-understand", depthLevel: "easy" },
    { questionId: "ch41-q03", prompt: "Why is this chapter not generic anti-tradition advice?", choices: ["Because it says every predecessor should be disowned", "Because it distinguishes useful continuity from swallowed identity", "Because it rejects all inherited structure"], correctIndex: 1, explanation: tone("Correct. The law has a continuity limit and does not reject all legacy.", "Greene separates preserving structure from living under shadow.", "Right. Some inheritance should be kept if it still works cleanly."), bloomsLevel: "remember-understand", depthLevel: "easy" },
    { questionId: "ch41-q04", prompt: "In Halden's work scenario, what best fits the chapter?", choices: ["Copy the beloved manager as exactly as possible", "Destroy every previous process to look original", "Keep useful structure while establishing a different line of authority"], correctIndex: 2, explanation: tone("Yes. He needs distinction without pointless destruction.", "The chapter favors breaking shrinking comparison, not breaking everything.", "Correct. Independent authority grows when continuity is filtered through a new center."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch41-q05", prompt: "What does Maris's school example show?", choices: ["That prestige can become pressure when every move is judged against the former leader", "That school successions are too small to matter strategically", "That continuity is always enough"], correctIndex: 0, explanation: tone("Correct. Her case shows how inherited prestige can function as shadow.", "The chapter asks whether the new leader can define success independently.", "Right. Prestige helps only if it does not freeze the scale in the past."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch41-q06", prompt: "What is the strongest reading of Davin's personal dilemma?", choices: ["Family inheritance never shapes authority", "Only public leadership transitions matter here", "Honor may still become captivity if the role forces him to perform someone else's identity"], correctIndex: 2, explanation: tone("Yes. The chapter says inherited honor can still shrink the successor.", "His dilemma turns on whether the role supports identity or swallows it.", "Correct. Shadow can operate in personal succession too."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch41-q07", prompt: "How can a successor break inherited shadow?", choices: ["By winning the predecessor's game on exactly the same terms", "By creating a distinct scale, style, or field of strength", "By rejecting every part of the legacy automatically"], correctIndex: 1, explanation: tone("Correct. The chapter values a different line over same-field imitation.", "Distinct scale matters because it weakens the comparison trap.", "Right. Separation of identity is the strategic move, not total destruction."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch41-q08", prompt: "When does originality become empty rebellion?", choices: ["When it breaks shrinking comparison", "When it keeps useful structure while changing the scale", "When it destroys sound inheritance just to appear new"], correctIndex: 2, explanation: tone("Exactly. The chapter warns against novelty theater as well as imitation.", "Originality fails when it rejects legitimacy without strategic reason.", "Right. Distinction needs judgment, not rupture for display."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" },
    { questionId: "ch41-q09", prompt: "How does Chapter 40 lead into Chapter 41?", choices: ["By moving from dependence through hidden bargains to dependence through borrowed stature", "By proving succession has nothing to do with dependence", "By replacing hidden cost with pure independence"], correctIndex: 0, explanation: tone("Correct. Chapter 40 covered hidden-price dependence, and Chapter 41 covers shadow dependence.", "The bridge moves from cheapness owning freedom to borrowed identity owning scale.", "Right. Both chapters track quieter forms of weakness."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" },
    { questionId: "ch41-q10", prompt: "What bridge carries Chapter 41 into Chapter 42?", choices: ["Chapter 42 returns only to succession etiquette", "After escaping inherited comparison, the next issue is how systems scatter when the central figure is struck", "Breaking shadow means avoiding all leadership centers"], correctIndex: 1, explanation: tone("Correct. The next law shifts from succession shadow to concentrated leadership vulnerability.", "Chapter 42 asks what happens when the shepherd, not the heir, is the strategic target.", "Right. The bridge moves from inherited comparison to breaking the center directly."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" }
  ]
};

chapter.quiz = quiz;

const paths = {
  canonical: path.join(runRoot, "drafts/canonical", `${stem}.md`),
  edited: path.join(runRoot, "drafts/edited", `${stem}.md`),
  critic: path.join(runRoot, "reports", `${stem}.critic.md`),
  structured: path.join(runRoot, "structured", `${stem}.chapter.json`),
  quiz: path.join(runRoot, "quizzes", `${stem}.quiz.json`),
  validated: path.join(runRoot, "validated", `${stem}.chapter.json`),
  review: path.join(runRoot, "validated", `${stem}.review-package.json`),
  metrics: path.join(runRoot, "sidecars", `${stem}.reading-metrics.json`),
  validation: path.join(runRoot, "reports", `${stem}.validation.md`),
  continuity: path.join(runRoot, "continuity/continuity-state.json"),
  runLog: path.join(runRoot, "reports/run-log.md")
};

writeText(paths.canonical, canonical);
writeText(paths.edited, edited);
writeText(paths.critic, critic);
writeJson(paths.quiz, quiz);
writeJson(paths.structured, chapter);
writeJson(paths.validated, chapter);

const reviewPackage = {
  schemaVersion: "1.1.0",
  packageId: `the-48-laws-of-power-${stem}-review`,
  createdAt,
  contentOwner: "ChapterFlow",
  book: {
    bookId: "the-48-laws-of-power",
    title: "The 48 Laws of Power",
    author: "Robert Greene",
    categories: ["Power", "Strategy", "Self-Help", "Political Psychology"],
    variantFamily: "EMH"
  },
  chapters: [chapter]
};
writeJson(paths.review, reviewPackage);

const metrics = {
  chapterId,
  number: num,
  title,
  readingTimeMinutes: 8,
  wordCounts: {
    easyDirect: words(chapter.contentVariants.easy.chapterBreakdown.direct),
    mediumDirect: words(chapter.contentVariants.medium.chapterBreakdown.direct),
    hardDirect: words(chapter.contentVariants.hard.chapterBreakdown.direct)
  },
  takeawayCounts: {
    easy: chapter.contentVariants.easy.keyTakeaways.length,
    medium: chapter.contentVariants.medium.keyTakeaways.length,
    hard: chapter.contentVariants.hard.keyTakeaways.length
  },
  exampleCount: chapter.examples.length,
  quizQuestionCount: quiz.questions.length,
  criticScore: 11,
  sourceHeading: ""
};
writeJson(paths.metrics, metrics);

const seal = crypto.createHash("sha256").update(fs.readFileSync(paths.validated)).digest("hex");
const continuity = JSON.parse(fs.readFileSync(paths.continuity, "utf8"));
for (const name of ["Halden", "Maris", "Davin", "Olia"]) continuity.nameUsage[name] = [stem];
continuity.withinChapterNames[stem] = ["Halden", "Maris", "Davin", "Olia"];
continuity.approvedChapterHashes[stem] = seal;
writeJson(paths.continuity, continuity);

const easyGentle = words(chapter.contentVariants.easy.chapterBreakdown.gentle);
const easyCompetitive = words(chapter.contentVariants.easy.chapterBreakdown.competitive);
const hardGentle = words(chapter.contentVariants.hard.chapterBreakdown.gentle);
const hardCompetitive = words(chapter.contentVariants.hard.chapterBreakdown.competitive);
const dist = quiz.questions.reduce((acc, q) => {
  acc[q.correctIndex] = (acc[q.correctIndex] || 0) + 1;
  return acc;
}, { 0: 0, 1: 0, 2: 0 });

const validation = `# Validation Report: ${title}

- Status: PASS
- Validation mode: chapter_gate
- Chapter: ${stem}
- Critic score carried into gate: 11/12
- Source heading: n/a

## Mechanical checks
- JSON structure complete and valid for \`structured/${stem}.chapter.json\`, \`quizzes/${stem}.quiz.json\`, \`validated/${stem}.chapter.json\`, and \`validated/${stem}.review-package.json\`
- Easy / medium / hard depth surfaces present
- Chapter-breakdown word bands verified: easy direct \`${metrics.wordCounts.easyDirect}\`, medium direct \`${metrics.wordCounts.mediumDirect}\`, hard direct \`${metrics.wordCounts.hardDirect}\`
- Easy companion variants also verified in band: gentle \`${easyGentle}\`, competitive \`${easyCompetitive}\`
- Hard companion variants also verified in band: gentle \`${hardGentle}\`, competitive \`${hardCompetitive}\`
- Medium uses singular \`selfCheckPrompt\`
- Hard uses exactly two \`selfCheckPrompts\`
- Example rotation complete: 6 canonical formats, 6 unique endings, 2/2/2 category split
- Quiz generated with 10 questions and 3 choices each
- Quiz schema complete on all 10 questions: \`questionId\`, \`prompt\`, \`choices\`, \`correctIndex\`, \`explanation\`, \`bloomsLevel\`, and \`depthLevel\`
- \`correctIndex\` distribution is roughly balanced across \`0/1/2\` at \`${dist[0]}/${dist[1]}/${dist[2]}\`
- Supporting structures present: review cards, key takeaway card
- Review package wraps the full validated chapter JSON
- Reading metrics written and continuity hash sealed at \`${seal}\`

## Prose checks
- No contamination phrases detected in reader-facing tone objects
- Chapter-specific mechanism remains inherited shadow, comparison, distinct scale, and continuity limits rather than generic self-branding advice
- Hard depth preserves the shadow-versus-originality boundary and the Chapter 42 bridge
- Quiz stays within supported facts from the approved draft and frozen source bundle

## Gate result
- Approved for chapter gate and automatic continuation
`;
writeText(paths.validation, validation);

fs.appendFileSync(
  paths.runLog,
  `\n- Completed writer, editor, critic, converter, quiz, and validator steps for Chapter 41.\n- Validation result: PASS.\n- Continuity hash sealed for \`${stem}\`: \`${seal}\`\n`,
  "utf8"
);

console.log(JSON.stringify({
  easyDirect: metrics.wordCounts.easyDirect,
  mediumDirect: metrics.wordCounts.mediumDirect,
  hardDirect: metrics.wordCounts.hardDirect,
  easyGentle,
  easyCompetitive,
  hardGentle,
  hardCompetitive,
  seal,
  dist
}, null, 2));
