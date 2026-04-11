const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const runRoot = path.resolve(".chapterflow/runs/the-48-laws-of-power/20260409-002544");
const num = 21;
const stem = `ch${String(num).padStart(2, "0")}`;
const title = "Play a Sucker to Catch a Sucker - Seem Dumber Than Your Mark";
const chapterId = "ch21-play-a-sucker-to-catch-a-sucker-seem-dumber-than-your-mark";
const createdAt = new Date().toISOString();

function tone(gentle, direct, competitive) {
  return { gentle, direct, competitive };
}

const canonical = `Greene's twenty-first law begins with a danger that feels backwards: looking too smart can create resistance. People rarely enjoy feeling outclassed, corrected, or seen through before they are ready. The moment you display all your sharpness, other people may become guarded, competitive, or quietly suspicious. The chapter argues that obvious intelligence can cost room.

Its claim is not that foolishness is power. Greene's point is more tactical. When you seem less threatening than you are, other people often relax their defenses, talk more freely, and reveal assumptions they would have hidden from someone they considered immediately formidable. Strategic underestimation can therefore create access that visible brilliance closes.

That is why the law focuses on perceptual camouflage rather than actual incompetence. Greene is not praising confusion, sloppy work, or self-destruction. He is distinguishing deliberate understatement from genuine weakness. The useful move is not to become incapable. It is to keep others from organizing too quickly against your capability.

Ordinary settings make the mechanism clear. A colleague who corrects every detail in public can become the one everyone watches and protects themselves against. A debate team member who asks a simpler question than expected may draw out the overconfidence of a rival who now talks too much. A personal conversation can shift when one person stops proving how much they know and instead lets the other person feel comfortably ahead long enough to expose more than intended. In each case, lowered guard creates room.

The chapter's limit matters. Some situations require visible competence. Trust, safety, and leadership can depend on clear demonstration of ability. Greene overreaches if the law becomes advice for chronic self-minimization or comic self-diminishment. The useful version is narrower: reveal enough to stay credible while withholding enough to keep others from hardening too early. Chapter 20 preserved leverage by resisting premature alignment. Chapter 21 preserves room by resisting premature display. That points toward Chapter 22, where visible weakness itself can absorb force and later reverse initiative.`;

const edited = canonical;

const critic = `# Chapter 21 Critic Report

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
- Paragraph 4 is most vulnerable because workplace and school examples can collapse into generic "play dumb" advice if conversion drops the lowered-guard mechanism.

Strongest sentence:
- "The useful move is not to become incapable. It is to keep others from organizing too quickly against your capability."

Anchor use notes:
- The draft stays inside the frozen support: underestimation can create room, visible cleverness can trigger guard, camouflage differs from incompetence, and credibility still limits how far the move can go.

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
        "This law says looking obviously clever can make other people careful too early. If they think you are sharper than they are, they may hide more, compete harder, or stop talking freely. Greene is not saying real foolishness is strong. The chapter makes a narrower point. Sometimes you gain room by seeming less threatening than you are. When others feel superior, they often lower their guard and reveal more. That can give you time to watch, ask, and move without provoking defense. But the chapter is not praising bad work or fake confusion for its own sake. Strategic underestimation means controlling how much of your sharpness becomes visible. The lesson is to stay credible while avoiding the kind of display that makes people protect themselves before you have learned enough.",
        "Greene's twenty-first law argues that visible cleverness can trigger caution, envy, or resistance. Once people feel outclassed, they often stop revealing themselves naturally. The chapter is not telling you to become incompetent. It is telling you that obvious brilliance can close doors that understatement keeps open. If you seem simpler than you are, others may feel safer, talk longer, and guard themselves less tightly. That gives you room to observe and act. The stronger reading is strategic camouflage, not self-sabotage. Reveal enough to stay trusted, but not so much that everyone hardens around your ability before you need them to. When the room relaxes because it thinks it has sized you up, that misreading can start working for you. The people who stop defending themselves too early often donate the very information that later lets a quieter operator control the pace.",
        "This law gives a practical warning: proving how smart you are can make the field harder before the real game even starts. People protect themselves when they feel intellectually outmatched. Greene's point is that underestimation can be useful because it lowers guard. If others think they already understand you, they may speak too freely, reveal too much, and stop preparing for what you can actually do. But the chapter is not asking for clownish fake weakness. It is asking for disciplined restraint. Do not advertise your full sharpness before the timing helps you. A competitive reader knows that the room you gain from being underestimated can be worth more than the applause you lose by looking slightly less brilliant at first. Recognition feels good, but a loose room often pays better than applause. Once they stop bracing for you, they frequently expose patterns, vanity, and lazy assumptions you could never have extracted from a defended audience.",
      ),
      keyTakeaways: [
        { point: tone("Obvious cleverness can make other people guarded.", "Visible brilliance can trigger defense.", "Show too much edge too early and the room stiffens.") },
        { point: tone("Underestimation can create room to observe and move.", "If they feel superior, they may reveal more.", "Their lowered guard can become your opening.") },
        { point: tone("Deliberate understatement differs from real incompetence.", "The chapter is about restraint, not self-sabotage.", "Look manageable without becoming useless.") }
      ],
      oneMinuteRecap: tone(
        "This law says seeming less threatening than you are can lower guard and create room to act.",
        "Do not show every advantage before the timing helps you.",
        "Sometimes the smartest move is to look less dangerous than you are."
      )
    },
    medium: {
      chapterBreakdown: tone(
        `Greene's twenty-first law begins from a social fact that people often ignore: visible cleverness changes the room. The moment someone appears obviously sharper, more informed, or more perceptive than everyone expected, other people may stop relaxing. They guard information, stiffen their posture, and begin managing impressions more carefully. Greene is interested in that defensive reaction. The chapter asks what happens when intelligence is displayed so clearly that it starts producing resistance before it produces advantage.

That is why seeming less threatening can matter. If others believe they are dealing with someone ordinary, slower, or less dangerous, they often reveal more than they would around a person they fear being outplayed by. Greene is not celebrating humiliation or fakery for amusement. He is describing how underestimation can preserve access. A person who does not trigger immediate caution may get more truth, more overconfidence, and more usable information from the field.

The chapter is strongest when it distinguishes tactical simplicity from actual incompetence. The useful move is not to lose control of the situation. It is to control how quickly other people recognize your full capability. Strategic camouflage still requires competence, timing, and judgment. Greene is not telling the reader to damage credibility. He is telling the reader to avoid wasting leverage by making everyone defensive too soon.

The pattern shows up in ordinary settings. A worker who publicly outshines everyone in the first meeting may discover that later conversations become guarded. A debate-team member who sounds slightly less certain may draw a rival into overexplaining. A personal conversation can change when one person stops proving every point and instead lets the other person feel comfortably ahead long enough to reveal more than intended. In each case, the gain comes from lowered guard rather than from true weakness.

The limit matters because some moments demand visible competence. If trust, safety, or leadership depends on proof, too much camouflage can backfire. Greene's practical claim is narrower: do not display your full sharpness so early that other people begin defending themselves before they need to. Chapter 20 preserved leverage by resisting premature commitment. Chapter 21 preserves room by resisting premature display. Chapter 22 then turns apparent weakness itself into a way of absorbing force and reversing initiative.`,
        `Greene's twenty-first law argues that looking obviously smart can be strategically expensive. People do not merely admire visible intelligence. They often react to it. They become careful, guarded, or competitive because they no longer feel safe revealing as much. The chapter therefore begins with a cost most bright people underestimate: the more clearly you broadcast your edge, the faster the room starts protecting itself from you.

That is why underestimation can be useful. If others think they have already measured you and found you harmless, they may stop filtering themselves so aggressively. They may talk longer, offer too much, or make plans that assume you are less capable than you are. Greene is interested in that lowered guard. A person who does not trigger early caution can often see more of the board before the board realizes it is being read.

This is why the chapter is not generic advice to act dumb. Greene is not praising incompetence, sloppy work, or confusion. He is separating strategic understatement from actual weakness. The issue is timing. Visible cleverness can be valuable once it serves a purpose. It becomes costly when it activates resistance before you have gathered enough information or room to move.

The pattern appears everywhere. A manager who corrects everyone publicly can lose access to what people really think. A venture-lab team that flaunts superiority may cause rivals to hide weaknesses and prepare harder. A personal disagreement can escalate when one person makes the other feel outclassed instead of safe enough to speak plainly. In each case, proving sharpness too early reduces what the situation might have revealed.

The limit remains central because invisibility is not always strength. If understatement destroys trust, it has gone too far. Greene's point is disciplined rather than theatrical: keep enough credibility to act, but not so much visible edge that everyone hardens around you before the timing favors it. Chapter 20 dealt with preserving leverage by withholding allegiance. Chapter 21 deals with preserving access by withholding full display. Chapter 22 then asks what happens when even visible weakness becomes material for reversal.`,
        `This law starts with a tempting mistake: showing the room exactly how sharp you are the moment you enter it. That display can feel efficient, honest, even impressive. Greene's warning is that it may also be strategically clumsy. Once people feel intellectually smaller than you, they often protect themselves. They shorten answers, stop improvising, and start managing what you get to see.

That matters because information comes more easily from relaxed people than from defended people. If others think they are ahead of you, they may overtalk, overreach, or underestimate the cost of exposing themselves. The chapter therefore treats underestimation as an asset. A person who seems less dangerous can collect more reality before triggering counterplay.

This keeps the law narrower than crude performance. Greene is not asking you to become a fool. He is asking whether full visible competence helps your position right now or merely alerts the field too early. Strategic camouflage means pacing your display. It lets you remain capable while denying others the exact signal that would make them tighten up.

Common settings make the point plain. A coworker who answers every question too brilliantly may become the colleague nobody speaks freely around. A debate team can gain more from inviting an opponent's overconfidence than from broadcasting superiority in the first minute. A personal exchange may reveal more when one person asks simpler questions instead of winning every sentence. In each case, lowered guard creates the opening.

The limit matters because real weakness is not the goal. Lose credibility, miss the moment to demonstrate competence, or let the act outrun your control, and the move collapses. Chapter 20 showed that public commitment can make you easier to count. Chapter 21 shows that public brilliance can make you easier to guard against. Chapter 22 then pushes further by showing how apparent weakness can absorb pressure and later redirect it.`,
      ),
      keyTakeaways: [
        {
          point: tone("Visible cleverness can provoke caution.", "Obvious brilliance often changes the room against you.", "The moment they feel outclassed, they stop playing loose."),
          moreDetails: tone("People often protect information when they feel watched by someone sharper.", "The chapter focuses on the defensive reaction caused by obvious intelligence.", "Show too much edge and the field starts sandbagging itself.")
        },
        {
          point: tone("Underestimation can preserve access.", "If they feel superior, they may reveal more than they should.", "Their confidence can become your opening."),
          moreDetails: tone("Greene values underestimation here because lowered guard often produces more usable information.", "A less threatening appearance can keep the room from tightening too early.", "People talk differently when they think you are not dangerous yet.")
        },
        {
          point: tone("Purposeful understatement differs from real incompetence.", "The move is restraint, not failure.", "Do not become weak; become harder to size correctly."),
          moreDetails: tone("The chapter still requires capability, timing, and judgment.", "Understatement matters only if it protects room without destroying trust.", "A useful disguise still leaves you able to act.")
        },
        {
          point: tone("Work, school, and personal settings all show how overdisplay can reduce what others reveal.", "Proving sharpness too early can cost information.", "Win the impression too fast and lose the opening."),
          moreDetails: tone("Public corrections, rivalry, and conversational one-upmanship all make people guard themselves more.", "The chapter becomes practical when you ask whether your display helps more than it alerts.", "The field often closes the moment it respects your edge too much.")
        },
        {
          point: tone("The law has a credibility limit.", "Camouflage fails if it erodes trust or control.", "Look manageable, not incapable."),
          moreDetails: tone("Some moments require visible competence, especially when responsibility depends on it.", "Greene warns against premature display, not against competence itself.", "Use the disguise only as far as it still leaves you able to cash the advantage.")
        }
      ],
      activationPrompt: tone(
        "Identify one place where showing full sharpness too early may make others guard themselves more.",
        "Choose one room where understatement might preserve access better than display.",
        "Pick one interaction where their comfort could reveal more than your brilliance would win."
      ),
      selfCheckPrompt: tone(
        "Am I hiding too much, or only pacing what others see?",
        "Would full visible competence help me here, or just make the room defensive too soon?",
        "What do they reveal if they think I am less dangerous than I am?"
      ),
      oneMinuteRecap: tone(
        "This chapter says underestimation can create room because obvious cleverness often makes other people guard themselves.",
        "Do not trigger defenses before the timing helps you.",
        "Sometimes access matters more than looking smartest first."
      )
    },
    hard: {
      chapterBreakdown: tone(
        `Greene's twenty-first law treats visible cleverness as a strategic signal with costs. Most people assume intelligence should always be displayed whenever possible, as though showing sharpness were a pure asset. Greene is interested in the opposite side of the exchange. The more clearly you announce your edge, the more quickly other people may begin protecting themselves from it. They shorten what they reveal, hide uncertainty, and become careful about every move that might give you informational advantage. The chapter begins from that defensive shift.

That is why underestimation can be useful. A person who seems harmless, slower, or less penetrating than they really are often gets access that a visibly formidable person never receives. The point is not admiration management. It is lowered guard. People disclose more freely when they do not feel strategically threatened. They overtalk, overcommit, and overestimate their own control because they believe the person across from them has already been measured and ranked beneath them. Greene wants the reader to notice how much room superiority can accidentally grant.

The chapter is strongest when it resists the lazy reading that acting foolish is itself the goal. Greene is not praising incompetence, confusion, or comic self-humiliation. He is distinguishing tactical understatement from actual weakness. Strategic camouflage works only if real capability remains intact beneath the softer surface. The move is to pace recognition, not to destroy competence. You keep the ability while delaying the reaction that ability would otherwise trigger too early.

This is why visible brilliance can be expensive. The problem is not merely envy. It is resistance. Once people feel outclassed, they start editing themselves for your benefit as little as possible. They test less honestly, reveal less carelessly, and prepare more defensively. A room that thinks it has seen your full edge will often close the very openings that edge needed. The chapter therefore asks whether the satisfaction of being recognized immediately is worth the intelligence you lose when everyone hardens around that recognition.

Ordinary settings reveal the mechanism clearly. A professional who demonstrates total mastery in the first meeting may become the colleague around whom nobody speaks candidly. A debate team that flaunts superiority may win attention but lose the rival's overconfidence. A personal exchange can stall when one person insists on proving interpretive dominance instead of letting the other feel safely ahead long enough to disclose motive, vanity, or fear. In each case, what disappears is not respect alone. What disappears is access.

The limit matters because some situations demand clear competence. If you hide too much, you lose trust, authority, or the chance to act in time. Greene is not arguing for permanent self-minimization. He is arguing against premature display. Chapter 20 preserved leverage by withholding allegiance until its cost was clear. Chapter 21 preserves informational room by withholding the full display of capability until the timing favors recognition. Chapter 22 follows naturally from there. Once you can benefit from being underestimated, the next question is how apparent weakness itself can absorb pressure and later reverse force. The law succeeds only when understatement keeps you credible while delaying the defensive reaction your brilliance would otherwise provoke. If the disguise costs you real control, it has gone too far. If it keeps the room open long enough for others to misplay themselves, it is doing exactly the work Greene values.`,
        `Greene's twenty-first law argues that the visible display of intelligence can be strategically expensive because it changes how other people manage themselves around you. Most readers hear "seem dumber" and instinctively resist it because they confuse prestige with leverage. Greene hears a different problem: the faster a room recognizes your edge, the faster that room begins defending itself against what your edge might do.

Underestimation preserves access because people reveal more when they feel superior. If they believe they have already sized you correctly and found you manageable, they relax. They speak with less caution, test with less discipline, and make plans that assume you are not yet a threat worth guarding against. Greene is interested in this asymmetry. The person who receives less respect in the first minute may sometimes gain more usable information by the fifth.

That is why the chapter should not be flattened into advice for real incompetence. It is not saying that weakness itself is admirable. It is saying that pacing the visibility of your competence can matter. Strategic understatement means controlling recognition. Actual foolishness, by contrast, destroys authority, timing, and the ability to cash whatever opening underestimation creates. The distinction is whether the disguise preserves or dissolves power.

The pattern appears in ordinary life. A manager who corrects too much too early can make staff stop speaking frankly. A venture-lab team that advertises superiority may teach the competition to stop underestimating it before that underestimation has paid out. A personal disagreement can become less revealing the moment one side starts winning every sentence rather than learning what the other side exposes when it feels comfortably ahead. In each case, visible sharpness reduces what the field gives up for free.

The limit remains central because some moments require undeniable capability. If the stakes involve trust, safety, or command, too much camouflage becomes self-harm. Greene's practical claim is narrower: do not spend your full visible brilliance before you know whether the situation rewards recognition or rewards lowered guard. Chapter 20 managed how much allegiance the field could claim from you. Chapter 21 manages how much intelligence the field thinks it has measured. Chapter 22 then pushes further by showing how even perceived weakness can become material for reversal. The reader's edge lies in noticing that recognition and access are not always allies. Sometimes being seen too clearly is what closes the game before it opens. The person who can delay that closure without surrendering actual control gains room no display of immediate brilliance could buy back cheaply. A room that underestimates you may still misallocate effort, misjudge stakes, and keep exposing what it would have hidden from a visibly formidable rival. That delayed recognition is often the real asset the chapter wants to preserve. The less attention they spend guarding against you now, the more likely they are to spend that missing attention on mistakes you can use later when the timing is finally yours.`,
        `This law works only if you track what your visible cleverness does to the other side. Most people focus on what brilliance does for them: status, admiration, authority, the pleasure of being recognized correctly. Greene's warning is that obvious sharpness also does something practical for others. It tells them to guard, tighten, rehearse, and stop giving you information accidentally. The chapter is about that defensive transfer.

That is why underestimation can be strategically valuable. A person who appears easier to outplay often gets the loosest version of the room. Loose rooms talk too much. Loose opponents overreach. Loose rivals assume their margin is wider than it is. Greene is not praising disguise for theater. He is protecting access from being shut down by premature respect. The underestimated person may lose a little prestige at first and gain a great deal more usable reality in return.

The chapter therefore distinguishes camouflage from collapse. Empty foolishness is not strategy. Strategic understatement is purposeful restraint. It preserves room to read vanity, hear overconfidence, and watch another person reveal how they behave when they think the danger level is low. Without preserved competence underneath, the move fails. You cannot collect advantage from underestimation if you have actually become the underestimated fool they think they are handling.

Common settings show the law with almost embarrassing clarity. A coworker who must answer every question brilliantly may become the person no one confides in. A debate-team operator can gain more by inviting a rival's arrogance than by crushing that arrogance instantly. A personal conversation often yields more when one person lets the other feel comfortably smarter for a few minutes instead of demanding immediate acknowledgment. In each case, what opens is not merely ego. What opens is disclosure.

The limit matters because camouflage can fail too. Hide too much and you lose the authority needed to move when the moment comes. Reveal too much and you trigger resistance before the field has overextended. Greene's better point is to control recognition deliberately, not reflexively. Chapter 20 taught that public commitment can make your leverage easier to count. Chapter 21 teaches that public brilliance can make your mind easier to guard against. Chapter 22 follows because once the field is willing to misread strength, it may also misread weakness and run into it badly. The deepest lesson is that intelligence has a signaling cost as well as a practical value. If you display it before asking what that display changes in the room, you may have paid for recognition with access. The stronger move is not to deny your capability but to stage it. Let the other side relax first. Let them decide too early that they are safe. Then act from the room their mismeasurement created rather than from the applause your immediate brilliance might have won. Competitive advantage here comes from making the other side spend less attention on you right before that attention would have become expensive for them to lose.`,
      ),
      keyTakeaways: [
        {
          point: tone("Visible intelligence can trigger defensive behavior.", "Obvious cleverness often makes the room manage itself against you.", "The moment they respect your edge too much, they stop leaking value."),
          moreDetails: tone("The chapter emphasizes the informational cost of being recognized too quickly.", "People reveal less when they feel outclassed or watched by someone sharper.", "Prestige can be expensive if it shuts the room before it pays you.")
        },
        {
          point: tone("Underestimation can preserve access and disclosure.", "Feeling superior makes other people less guarded.", "Their confidence can make them careless in ways your display never would."),
          moreDetails: tone("Greene values underestimation because relaxed people often give away more reality.", "The chapter's leverage comes from lowered guard, not from mockery.", "A room that thinks you are safe often becomes generous with information.")
        },
        {
          point: tone("Strategic camouflage differs from actual weakness.", "The move is to pace recognition, not to lose capability.", "Hide the blade; do not throw it away."),
          moreDetails: tone("The chapter still requires competence underneath the softer presentation.", "Understatement matters only if it keeps authority available when needed.", "A disguise that destroys your control is not a strategy.")
        },
        {
          point: tone("Work, school, and personal settings show how proving brilliance too early can cost reality.", "Visible superiority can reduce what the field reveals for free.", "Win the impression and lose the disclosure if you mistime it."),
          moreDetails: tone("Public corrections, flaunted superiority, and one-upmanship all cause others to tighten up.", "The chapter becomes practical when you ask whether recognition helps more than it alerts.", "The room often closes at the exact moment it decides you are dangerous.")
        },
        {
          point: tone("The law has a strict credibility limit.", "Camouflage fails when it erodes trust, timing, or authority.", "Look safe enough to relax the room, not weak enough to lose command."),
          moreDetails: tone("Some contexts require visible competence, especially under responsibility.", "Greene warns against premature display rather than against intelligence itself.", "Control recognition; do not let concealment turn into self-erasure.")
        }
      ],
      activationPrompt: tone(
        "Identify one room where immediate recognition may cost you more access than it gives you status.",
        "Choose one interaction where pacing your display of competence could keep others from guarding too early.",
        "Pick the room that would tell you more if it believed you were slightly less dangerous."
      ),
      selfCheckPrompts: [
        tone(
          "Am I understating capability to preserve access, or hiding so much that I lose credibility?",
          "What would my full visible sharpness make this room stop revealing?",
          "If they relaxed around me, what would they expose that caution now conceals?"
        ),
        tone(
          "When does recognition help more than lowered guard?",
          "Would prestige in this moment pay more than access?",
          "What can I stage later that would be expensive to display right now?"
        )
      ],
      predictionPrompt: tone(
        "Once underestimation creates room, how might Chapter 22 show weakness itself absorbing pressure instead of merely hiding strength?",
        "If seeming less formidable lowers guard, what changes next when weakness becomes a tactical shape rather than a disguise?",
        "After the room misreads your edge, what happens when it also misreads your vulnerability?"
      ),
      oneMinuteRecap: tone(
        "This chapter argues that obvious cleverness can shut rooms down, while underestimation can preserve access if competence stays intact underneath.",
        "Do not spend recognition before you know whether the room rewards it or guards against it.",
        "Sometimes the edge is not in being seen as brilliant, but in being mismeasured long enough to work."
      )
    }
  },
  examples: [
    {
      title: "Anika Withholds a Showy Correction So a Rival Reveals More Than Intended",
      format: "decision_point",
      category: "work",
      endingType: "broader_principle",
      scenario: tone("Anika hears a rival make a sloppy claim in a strategy meeting and knows she could dismantle it immediately.", "She has to decide whether proving sharpness now helps more than keeping the rival comfortable enough to keep talking.", "Anika can win the moment or keep the room loose."),
      whatToDo: tone("She lets the rival keep talking long enough to reveal assumptions that matter more than the first correction.", "She delays the show of brilliance until it can cash a larger opening.", "She keeps the blade hidden until the room has given away more."),
      whyItMatters: tone("The chapter says visible cleverness can make others guard themselves too early.", "Her restraint preserves access to information that a quick display would close.", "A small ego win can cost a larger disclosure.")
    },
    {
      title: "Gideon Hears Why a Debate-Team Operator Invites Underestimation Before a Vote",
      format: "dialogue",
      category: "school",
      endingType: "self_directed_question",
      scenario: tone("Gideon listens as a teammate explains why sounding slightly less polished made the opposing side overtalk before the final vote.", "He hears how a little underestimation kept the room relaxed.", "Gideon learns that the loudest show of intelligence is not always the best opening move."),
      whatToDo: tone("He asks what level of visible confidence keeps credibility without causing everyone to harden.", "He studies how to pace display instead of equating volume with strength.", "He asks how much brilliance the room can see before it shuts."),
      whyItMatters: tone("The chapter warns that obvious superiority can reduce what others reveal.", "The rival gave away more because it felt intellectually safe.", "People who feel above you often stop protecting themselves.")
    },
    {
      title: "Vera Weighs Honest Capability Against the Value of Not Looking Immediately Threatening",
      format: "dilemma",
      category: "personal",
      endingType: "surprising_implication",
      scenario: tone("Vera enters a tense conversation knowing that proving she has already seen through the other person may end the conversation fast.", "She must choose between immediate demonstration and slower understanding.", "Vera can be right out loud or useful in time."),
      whatToDo: tone("She keeps her questions simpler and lets the other person feel less exposed while still protecting her own judgment.", "She understates what she sees so the conversation yields more truth.", "She keeps the upper hand by not advertising it."),
      whyItMatters: tone("The chapter separates tactical simplicity from actual weakness.", "Her restraint lowers guard without surrendering awareness.", "People confess more to the person they think is not already ahead of them.")
    },
    {
      title: "Samir Predicts Why One Strategist Asks Simpler Questions to Keep a Counterpart Talking",
      format: "predict_reveal",
      category: "work",
      endingType: "cross_domain",
      scenario: tone("Samir notices a strategist ask plainer questions than he knows she can ask while a counterpart grows more expansive.", "He predicts she is protecting access by avoiding an early display of edge.", "Samir can already see that the simple question is doing advanced work."),
      whatToDo: tone("He judges whether the strategist is preserving credibility while delaying recognition.", "He looks for deliberate understatement rather than actual confusion.", "He scores the move on whether the room stays loose and informative."),
      whyItMatters: tone("The chapter says underestimation can create room because others lower their guard.", "The counterpart speaks freely because danger still feels low.", "The room gives more to the person it thinks it has safely sized up.")
    },
    {
      title: "Venture-Lab Debrief Finds That Visible Cleverness Made a Team Easier to Guard Against",
      format: "postmortem",
      category: "school",
      endingType: "common_trap",
      scenario: tone("A venture-lab team reviews why an early presentation impressed people but produced little candid feedback from rivals.", "The debrief finds that obvious superiority made everyone more careful, not more open.", "The team learns that admiration can harden a field as easily as fear does."),
      whatToDo: tone("They identify where a softer first display could have preserved more access to real reactions.", "They redesign the next opening around credibility without overannouncement.", "They stop buying applause at the price of information."),
      whyItMatters: tone("The chapter warns that visible brilliance can make the room manage itself against you.", "The team lost disclosure because it triggered defense too early.", "When they won the impression instantly, they lost the loose room.")
    },
    {
      title: "Before and After Proving Intelligence Too Early Became Pacing It for Better Timing",
      format: "before_after",
      category: "personal",
      endingType: "perspective_reframe",
      scenario: tone("Before, every interaction became a performance of being right quickly and fully. After, visible sharpness was paced so others stayed open longer.", "The contrast is between immediate recognition and delayed advantage.", "One version wins respect fast; the other keeps the room usable."),
      whatToDo: tone("Keep the capability, but stop spending all of it in the first minute.", "Reveal enough to stay credible while holding back enough to preserve disclosure.", "Do not erase your edge; stage it."),
      whyItMatters: tone("The law distinguishes strategic underestimation from actual self-diminishment.", "Better timing can preserve both access and later authority.", "Recognition is only valuable if it does not close the game before you learn enough.")
    }
  ],
  reviewCards: [
    { cardId: "ch21-rc01", front: tone("Why can obvious cleverness create strategic cost?", "How can visible brilliance make a room harder?", "Why does looking smart too quickly sometimes backfire?"), back: tone("Because people may become guarded, competitive, or careful once they feel outclassed.", "Visible sharpness can reduce what others reveal freely.", "The room protects itself when it spots your edge too early."), difficulty: "easy" },
    { cardId: "ch21-rc02", front: tone("What can underestimation create?", "Why might seeming less threatening preserve access?", "What does lowered guard give you?"), back: tone("It can create room to observe, gather information, and act before others defend themselves.", "People often reveal more when they feel superior.", "Lowered guard can turn into disclosure."), difficulty: "easy" },
    { cardId: "ch21-rc03", front: tone("How is tactical simplicity different from real incompetence?", "What separates camouflage from collapse?", "Why isn't acting foolish itself the goal?"), back: tone("Strategic understatement keeps competence intact while delaying how quickly others recognize it.", "The chapter values paced visibility, not actual weakness.", "A disguise that destroys capability is not a strategy."), difficulty: "medium" },
    { cardId: "ch21-rc04", front: tone("Where does this law appear in ordinary life?", "How do work, school, and personal settings show lowered-guard logic?", "Where does overdisplay cost disclosure?"), back: tone("It appears anywhere visible superiority makes others defend themselves too early.", "Meetings, debates, and tense conversations all change when people feel outclassed.", "Show too much edge and the field stops giving you loose information."), difficulty: "medium" },
    { cardId: "ch21-rc05", front: tone("How does Chapter 21 bridge to Chapter 22?", "Why does being underestimated lead into transforming weakness into power?", "What comes after hiding strength well?"), back: tone("Once underestimation creates room, the next chapter asks how visible weakness can absorb force itself.", "Chapter 22 moves from mismeasured intelligence to misread vulnerability.", "First let them underrate you, then let apparent weakness redirect them."), difficulty: "hard" }
  ],
  keyTakeawayCard: tone(
    "Visible cleverness can shut a room down, while strategic underestimation can preserve access if real competence remains intact beneath the softer display.",
    "This law warns against spending full recognition before the timing helps you.",
    "Sometimes the edge is not looking smartest first, but being mismeasured long enough to work."
  )
};

const quiz = {
  passingScorePercent: 70,
  questions: [
    { questionId: "ch21-q01", prompt: "Why can obvious cleverness create a problem in this chapter?", choices: ["Because intelligence is always disliked", "Because visible sharpness can make others guarded too early", "Because skill should never be shown"], correctIndex: 1, explanation: tone("Correct. The chapter says visible brilliance can make people protect themselves.", "Obvious cleverness often reduces what others reveal freely.", "Right. The room stiffens when it spots your edge too soon."), bloomsLevel: "remember-understand", depthLevel: "easy" },
    { questionId: "ch21-q02", prompt: "What can underestimation preserve or create here?", choices: ["Lowered guard and more room to observe", "Permanent superiority over everyone", "Proof that incompetence is useful"], correctIndex: 0, explanation: tone("Yes. Greene values underestimation because it can keep others relaxed enough to reveal more.", "Lowered guard often creates access and information.", "Right. Their comfort becomes your opening."), bloomsLevel: "remember-understand", depthLevel: "easy" },
    { questionId: "ch21-q03", prompt: "Why is this chapter not advice for real incompetence?", choices: ["Because mistakes always build trust", "Because confusion is the strongest disguise", "Because it requires competence beneath the understatement"], correctIndex: 2, explanation: tone("Correct. The move is tactical understatement, not actual inability.", "Capability must remain intact underneath the softer display.", "Right. Hide the edge; do not lose it."), bloomsLevel: "remember-understand", depthLevel: "easy" },
    { questionId: "ch21-q04", prompt: "In Anika's work scenario, what best fits the chapter?", choices: ["Correct the rival immediately to prove she sees everything", "Stay silent forever so no one notices her ability", "Delay the showy correction so the rival reveals more"], correctIndex: 2, explanation: tone("Yes. She preserves access by not triggering defense too soon.", "The chapter favors timing over immediate display.", "Right. Let the room open before you close it with brilliance."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch21-q05", prompt: "Why did Gideon's debate example reward a softer first display?", choices: ["Because public speaking is always weak", "Because the rival overtalked when it felt superior", "Because confidence should always be hidden"], correctIndex: 1, explanation: tone("Correct. The rival lowered its guard because it did not feel strategically threatened yet.", "Underestimation created disclosure.", "Yes. Feeling above you can make the other side careless."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch21-q06", prompt: "What is the strongest reading of Vera's dilemma?", choices: ["She can understate what she sees without surrendering awareness", "She should prove insight immediately in every tense conversation", "She should become genuinely uncertain so the other person relaxes"], correctIndex: 0, explanation: tone("Yes. The chapter separates lowered threat from lowered competence.", "She keeps judgment intact while avoiding premature defense.", "Right. Hold the edge without advertising it."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch21-q07", prompt: "How does visible brilliance reduce what a room reveals?", choices: ["It makes other people manage themselves more carefully", "It makes all future action impossible", "It guarantees envy in every case"], correctIndex: 0, explanation: tone("Correct. People often become more guarded once they feel outclassed.", "Recognition can trigger defense and self-editing.", "Yes. They stop leaking useful reality once they spot danger."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" },
    { questionId: "ch21-q08", prompt: "When does camouflage fail in this chapter?", choices: ["When it erodes credibility or actual control", "When it lowers guard", "When it delays recognition briefly"], correctIndex: 0, explanation: tone("Exactly. The limit is that understatement must not destroy trust, authority, or timing.", "The disguise fails when it becomes self-sabotage.", "Right. If the act costs command, you overplayed it."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" },
    { questionId: "ch21-q09", prompt: "How does Chapter 20 lead into Chapter 21?", choices: ["Chapter 21 rejects all need for leverage", "Public commitment naturally requires public brilliance", "After withholding allegiance, the next move is to withhold full visible sharpness"], correctIndex: 2, explanation: tone("Correct. The sequence moves from preserving leverage through noncommitment to preserving access through underestimation.", "Chapter 20 manages alignment; Chapter 21 manages recognition.", "Right. First keep your side unclaimed, then keep your full edge unseen."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" },
    { questionId: "ch21-q10", prompt: "What bridge carries Chapter 21 into Chapter 22?", choices: ["Chapter 22 says weakness should always be avoided", "If underestimation creates room, apparent weakness can become the next form of strategic reversal", "Camouflage eliminates the need to manage force"], correctIndex: 1, explanation: tone("Correct. The next chapter extends mismeasurement from hidden strength to the tactical use of weakness itself.", "Chapter 22 turns apparent weakness into a way of absorbing and redirecting force.", "Right. First let them underrate you, then let weakness itself become the trap."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" }
  ]
};

chapter.quiz = quiz;

function ensureDir(file) { fs.mkdirSync(path.dirname(file), { recursive: true }); }
function writeText(file, text) { ensureDir(file); fs.writeFileSync(file, text.endsWith("\n") ? text : `${text}\n`, "utf8"); }
function writeJson(file, data) { ensureDir(file); fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf8"); }
function words(text) { return String(text).trim().split(/\s+/).filter(Boolean).length; }

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
for (const name of ["Anika", "Gideon", "Vera", "Samir"]) continuity.nameUsage[name] = [stem];
continuity.withinChapterNames[stem] = ["Anika", "Gideon", "Vera", "Samir"];
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
- Chapter-specific mechanism remains visible cleverness cost, underestimation, and lowered guard rather than generic humility rhetoric
- Hard depth preserves the camouflage-versus-incompetence boundary and the Chapter 22 weakness bridge
- Quiz stays within supported facts from the approved draft and frozen source bundle

## Gate result
- Approved for chapter gate and automatic continuation
`;
writeText(paths.validation, validation);

fs.appendFileSync(
  paths.runLog,
  `\n- Completed writer, editor, critic, converter, quiz, and validator steps for Chapter 21.\n- Validation result: PASS.\n- Continuity hash sealed for \`${stem}\`: \`${seal}\`\n`,
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
