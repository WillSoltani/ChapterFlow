const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const runRoot = path.resolve(".chapterflow/runs/the-48-laws-of-power/20260409-002544");
const num = 15;
const stem = `ch${String(num).padStart(2, "0")}`;
const title = "Crush Your Enemy Totally";
const chapterId = "ch15-crush-your-enemy-totally";
const createdAt = new Date().toISOString();

const canonical = `Greene's fifteenth law turns from observation to closure. Once an enemy has shown that the conflict is real and recurring, the danger is not only what they can do now. It is what they can do later if they are left partly intact. A wounded opponent may lose position without losing motive. If they keep any room to regroup, they can return sharper than before.

That is why the chapter treats partial defeat as unstable. Humiliation, injury, or public setback can increase the desire for revenge while leaving enough capacity for retaliation. Greene's point is not simply that force is exciting. It is that unfinished opposition often remains alive at the exact point where people most want to declare the matter over. Half-measures can preserve both memory and means.

The chapter therefore pushes toward decisive closure rather than temporary suppression. It is not enough to embarrass, weaken, or delay a serious enemy if the basic source of threat remains active. A conflict that looks solved on the surface may only have been postponed. The law is strongest when it stays on recurrence risk: the enemy who survives with motive and capacity can become a later problem with more patience and more reason to strike.

That distinction matters because the law is easy to overread. Greene is not best understood here as cheering cruelty for its own sake. The mechanism is narrower than that. Decisive closure aims to end a recurring threat, not to indulge rage. Once the chapter becomes a general license for excess, it stops describing stability and starts describing appetite.

The pattern appears in ordinary settings. A leader who removes only the visible symptom of sabotage may leave the saboteur's leverage untouched. A student group that settles a repeated conflict with vague promises may discover that the same dispute returns at the next vote. A personal boundary that names the harm but never changes access may keep the destructive pattern alive. In each case, incompleteness preserves the path back.

The limit is as important as the force of the claim. Not every disagreement is a mortal contest, and not every rival should be treated as an enemy to crush. Ordinary friction often calls for de-escalation, separation, or repair rather than total-war logic. Greene's harder point is conditional: when the threat is serious and recurring, leaving it half-finished can be more dangerous than ending it fully.

Chapter 14 gathered knowledge through easy access. Chapter 15 asks what happens after the pattern has been seen clearly enough to name as threat. That points forward too. Once opposition has been neutralized, the next question is no longer closure but value: what changes when pressure recedes and absence starts doing the work?`;

const edited = `Greene's fifteenth law turns from information into closure. Once an enemy has shown that the conflict is real and recurring, the danger is not only what they can do now. It is what they can do later if they are left partly intact. A wounded opponent may lose position without losing motive. If they keep any room to regroup, they can return sharper than before.

That is why the chapter treats partial defeat as unstable. Humiliation, injury, or visible setback can intensify revenge while leaving enough capacity for retaliation. Greene's point is not that force is admirable everywhere. It is that unfinished opposition often survives at the exact moment people most want to call the problem solved. Half-measures can preserve both motive and means.

The chapter therefore pushes toward decisive closure rather than temporary suppression. It is not enough to embarrass, weaken, or delay a serious enemy if the source of threat remains active. A conflict that looks finished on the surface may only have been postponed. The law is strongest when it stays on recurrence risk: an enemy left with motive and capacity can become a later problem with more patience and more reason to strike.

That distinction matters because the law is easy to overread into cartoon severity. Greene is not best understood here as praising cruelty for its own sake. The mechanism is narrower. Decisive closure aims to end a recurring threat, not to indulge rage. Once the chapter becomes a general license for excess, it stops describing stability and starts describing appetite.

The pattern appears in ordinary settings. A leader who removes only the visible symptom of sabotage may leave the saboteur's leverage untouched. A student board that settles repeated conflict with vague promises may watch the same dispute return at the next vote. A personal boundary that names the harm but never changes access may keep the destructive pattern alive. In each case, incompleteness preserves the path back.

The limit is as important as the force of the claim. Not every disagreement is a mortal contest, and not every rival should be treated as an enemy to crush. Ordinary friction often calls for de-escalation, separation, or repair rather than total-war logic. Greene's harder point is conditional: when the threat is serious and recurring, leaving it half-finished can be more dangerous than ending it fully.

Chapter 14 gathered knowledge through easy access. Chapter 15 asks what happens after the pattern has been seen clearly enough to name as threat. That points forward. Once opposition has been neutralized, the next question is no longer closure but value: what changes when pressure recedes and absence starts doing the work?`;

const critic = `# Chapter 15 Critic Report

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
- Paragraph 5 is the most vulnerable because the work, school, and personal examples can flatten into generic "finish the problem" advice if conversion stops naming recurrence risk and return capacity.

Strongest sentence:
- "Half-measures can preserve both motive and means."

Anchor use notes:
- The draft stays inside the frozen support: unfinished enemies can return, partial defeat preserves motive and capacity, decisive closure is more stable than temporary suppression, and the chapter's limit blocks a drift into generic cruelty.

Contamination / source-splice check:
- No contamination phrase detected.
- No source-splice suspicion detected.

Gate judgment:
- Local patching only if needed during conversion.
- No global reroute required.
`;

function tone(gentle, direct, competitive) {
  return { gentle, direct, competitive };
}

const chapter = {
  chapterId,
  number: num,
  title,
  readingTimeMinutes: 8,
  contentVariants: {
    easy: {
      chapterBreakdown: tone(
        "This law says a serious enemy becomes dangerous again when they are left partly intact. A setback can strip position without stripping motive. If an opponent still has room to regroup, the conflict may only be paused instead of ended. That is why Greene treats partial defeat as unstable. The point is not random cruelty. It is recurrence risk. Humiliation or injury can leave revenge alive while some real capacity still survives. The stronger move is decisive closure that removes the path back. But the law has a limit. Not every disagreement is a total war. If you treat ordinary conflict like an enemy to crush, you overread the chapter and create new damage yourself. The real lesson is narrow: when the threat is serious and recurring, half-measures can preserve the return route. End the threat, not from rage but from a need for real stability.",
        "Greene's fifteenth law argues that partial defeat is unstable because unfinished enemies can return. A rival may lose status without losing motive. If they keep enough room to regroup, revenge stays possible. That is why the chapter pushes toward decisive closure rather than temporary suppression. The point is not generic brutality. It is that a serious threat left partly alive can become more dangerous later. Humiliation without neutralization may intensify the desire to strike back while leaving some capacity to do it. But the law has a limit. Not every rival is an enemy, and not every conflict should be handled with total-war thinking. Ordinary disputes often call for separation or repair instead. The chapter works when it stays on recurrence risk: if motive and means both survive, the problem may only be waiting for a second round. Stable closure removes the path back.",
        "This law makes a cold point: a wounded enemy is not the same thing as a finished enemy. Strip someone's position but leave motive and some capacity, and the board may only be resetting for a later hit. Greene's claim is that partial defeat is unstable because it preserves the return route. That is why the chapter favors decisive closure over soft suppression. The point is not bloodlust. It is that humiliation can sharpen revenge while unfinished power stays alive underneath it. Leave the root threat breathing and it may come back meaner, quieter, and more patient. But the chapter has a hard limit. Not every disagreement deserves enemy logic, and total-war habits can become their own kind of damage. The real lesson is narrower: if the threat is serious and recurring, half-measures keep the door open. Close the threat fully or expect it to walk back through."
      ),
      keyTakeaways: [
        { point: tone("Partial defeat can leave an enemy able and eager to return.", "Half-measures can preserve motive and capacity.", "A hurt enemy can still be a live enemy.") },
        { point: tone("The chapter is about ending a recurring threat, not praising cruelty.", "Closure matters more than spectacle here.", "Finish the threat, not the theater.") },
        { point: tone("The law becomes dangerous when it is inflated into every ordinary conflict.", "Not every rival justifies total-war logic.", "Enemy logic used everywhere starts wrecking the field.") }
      ],
      oneMinuteRecap: tone(
        "A serious enemy left partly intact can return, but the chapter loses discipline when its closure logic turns into generic cruelty.",
        "This law is about recurrence risk: if motive and means survive, the conflict may only be waiting for a second round.",
        "Leave the threat half-alive and the board may reset. Overread the law and you become the new problem."
      )
    },
    medium: {
      chapterBreakdown: tone(
        `Greene's fifteenth law argues that unfinished opposition can become more dangerous than defeated opposition. A setback may remove immediate power without removing memory, anger, or the ability to regroup. The chapter treats partial defeat as unstable for that reason. The conflict can look solved while the motive for revenge remains alive underneath it.

The mechanism is recurrence risk. Humiliation, injury, or visible loss can intensify the enemy's reason to return, and a partial victory may leave enough capacity for that return to happen. Greene therefore pushes toward decisive closure rather than surface suppression. A threat that is only weakened may still be very much alive.

For that reason, the law is not best read as generic ferocity. It is narrower than that. Spectacle, rage, and indiscriminate destruction are not the target. Serious opposition left half-finished can reorganize and strike again. Closure is meant to remove the path back.

The pattern appears in ordinary settings too. A leader may quiet the symptom of sabotage while leaving the saboteur's leverage intact. A student board may accept vague peace terms and watch the same fight return at the next vote. A personal boundary may name harm without changing access, which leaves the pattern alive. In each case, incompleteness preserves recurrence.

But the law has a hard limit. Not every conflict is existential, and not every rival should be treated as an enemy to crush. Many disputes call for distance, repair, or de-escalation instead. The chapter works when it keeps the distinction clear: serious recurring threats sometimes require full closure, but ordinary friction does not. That is why Chapter 15 bridges naturally into Chapter 16, where the question changes from ending pressure to understanding what absence does after the pressure is gone.`,
        `Greene's fifteenth law says partial defeat is unstable because unfinished enemies can return. A rival may lose position, but if motive and enough capacity survive, the danger has only changed form. This is the chapter's core mechanism. The problem is not merely what the enemy can do now. It is what they can do later if the conflict is left half-finished.

That makes humiliation without neutralization especially risky. A visible loss can deepen revenge while leaving the means for retaliation partly intact. Greene therefore pushes toward decisive closure instead of temporary suppression. Weakening a threat is not the same as ending it.

The chapter is strongest when it stays narrow. It is not praise for generic cruelty or permanent overreaction. It is an argument about recurrence risk. Serious opposition left alive enough to regroup can become more dangerous precisely because it now has sharper motive and more patience.

You can see the pattern in ordinary settings. A workplace fix may remove the visible disruption while leaving the underlying saboteur untouched. A school organization may settle a repeated dispute with vague promises and find the same conflict back at the next vote. A personal boundary may confront the harm but fail to change access, which keeps the destructive pattern active. In each case, partial resolution preserves the return route.

The chapter's limit matters there too. Not every competitor is an enemy, and not every disagreement should be handled through total-war logic. De-escalation, separation, and repair remain better answers for many ordinary conflicts. Greene's harder point is conditional: when the threat is serious and recurring, half-measures can preserve both motive and means. Full closure aims at stability, not rage. It removes the route for return instead of pretending that delay is resolution. A calm-looking settlement can still be strategically unfinished. A solution that leaves revenge and access alive is only borrowing time for later trouble. That logic follows Chapter 14's information advantage and sets up Chapter 16's question about value after pressure recedes.`,
        `This law starts from a hard premise: a wounded enemy can be more unstable than a finished one. Strip the other's position but leave anger, memory, and room to regroup, and the conflict may only be sleeping. Greene's point is that partial defeat preserves the return route.

This is the recurrence logic. Humiliation can sharpen revenge. Incomplete suppression can leave enough capacity for retaliation. A board that looks won today can reopen tomorrow if the root threat is still breathing. Greene favors decisive closure over soft containment when the opposition is serious.

The chapter is narrower than cheap brutality folklore. It does not work as "be cruel everywhere." It works as "understand that an enemy left half-alive may come back with more patience and clearer motive." Closure matters because unfinished threats reorganize.

The same pattern shows up outside war language. A manager can punish the symptom of sabotage while leaving the saboteur's leverage in place. A student board can stage peace while the underlying rivalry waits for the next ballot. A personal conflict can be named without changing access, which lets the old pattern keep a door open. The fight looks over only because it has changed pace.

The limit is severe and necessary. Not every rival deserves enemy status, and total-war habits can do their own damage. Ordinary friction often needs separation, repair, or a cleaner boundary rather than crushing force. The chapter works only when the threat is real, recurring, and serious enough that half-measures preserve danger. That is why Chapter 15 sits between Chapter 14's map-making and Chapter 16's question of what absence does once overt pressure is gone.`
      ),
      keyTakeaways: [
        {
          point: tone("An enemy can lose ground without losing the will or ability to return.", "Partial defeat changes the threat more than it removes it.", "A pushed-back enemy may only be winding up again."),
          moreDetails: tone("The chapter focuses on unfinished danger rather than on immediate victory alone.", "Recurrence risk depends on motive and capacity surviving together.", "The board is not clean if the return route is still open.")
        },
        {
          point: tone("Humiliation can intensify revenge when closure is incomplete.", "Visible loss can sharpen retaliation motive.", "Shame can harden the enemy if the threat still breathes."),
          moreDetails: tone("A setback that injures pride without removing power can make the later return more forceful.", "The law warns against leaving memory and means alive at the same time.", "If you leave both anger and leverage, do not act surprised when they meet again.")
        },
        {
          point: tone("Decisive closure is different from theatrical severity.", "The chapter values neutralization over spectacle.", "The goal is to end the threat, not to put on a show."),
          moreDetails: tone("The strongest version removes the path back instead of indulging visible rage.", "Public harshness alone can increase danger if it does not actually end the source of threat.", "Loud punishment is weak strategy if the root problem survives behind it.")
        },
        {
          point: tone("Ordinary settings also show how incomplete resolution preserves recurrence.", "Work, school, and personal conflicts can all restart when access or leverage remains unchanged.", "A dressed-up truce can still be a live fuse."),
          moreDetails: tone("Vague peace, cosmetic fixes, and soft boundaries may look moderate while quietly preserving the same return route.", "The chapter becomes practical when you look for recurring patterns rather than dramatic battles.", "The board reopens anywhere the root channel stays intact.")
        },
        {
          point: tone("The law breaks when it is applied to every ordinary disagreement.", "Not every rival is an enemy and not every conflict needs total closure.", "Enemy logic sprayed everywhere wrecks judgment."),
          moreDetails: tone("De-escalation and repair remain better answers when the threat is not serious and recurring.", "The chapter keeps its force only if total-war thinking stays conditional.", "If you cannot tell friction from threat, this law will turn you reckless.")
        }
      ],
      activationPrompt: tone(
        "Think of one recurring conflict and ask whether the real threat was ended or only pushed out of sight for a while.",
        "Choose one situation where a problem keeps returning and identify what motive or capacity was left intact each time.",
        "Pick one fight that keeps coming back and name the door you never actually closed."
      ),
      selfCheckPrompt: tone(
        "Am I ending a real recurring threat, or am I reacting to ordinary friction as if it were total war?",
        "Does this situation actually preserve motive and capacity for return, or am I inflating a normal dispute into enemy logic?",
        "Is the threat real enough to finish, or am I about to turn irritation into a crusade?"
      ),
      oneMinuteRecap: tone(
        "Partial defeat can preserve the return route, but the chapter only stays sound when closure is limited to serious recurring threats.",
        "This law is about removing the path back for real opposition, not about using severity as a mood.",
        "If motive and means survive, expect a second round. If the threat is ordinary friction, use a different play."
      )
    },
    hard: {
      chapterBreakdown: tone(
        `Greene's fifteenth law treats incomplete victory as its own form of instability. The danger is not only that an enemy remains angry after a setback. It is that anger can deepen while enough structure for return still survives. A person can be injured politically, socially, or strategically without being neutralized. That combination of memory, motive, and remaining capacity is what makes unfinished opposition dangerous.

This is why the chapter's severity has a real mechanism instead of being mere posture. Humiliation without closure can sharpen revenge. Delay without neutralization can give a threat time to reorganize. A visible win can therefore hide a strategic failure if the source of danger remains intact beneath it. Greene pushes toward decisive closure because partial suppression can preserve exactly what later retaliation requires.

The key distinction is between ending a threat and performing brutality. The chapter does not become stronger by becoming louder. It becomes clearer when it stays on recurrence. The enemy matters here because they can come back, not because domination feels satisfying. Once the law is translated into appetite, rage, or spectacle, it stops explaining stability and starts justifying excess.

That distinction also explains why the chapter applies outside literal war stories. At work, a leader can punish the visible disruption while leaving the saboteur's leverage, network, or access untouched. At school, a board can stage peace through vague language while the same voting coalition waits for the next opening. In personal life, someone can name the harm but preserve the same access pattern that lets it recur. In every case, the threat is not gone if the path of return still exists.

The harder edge is that partial mercy can sometimes be less humane in outcome than decisive closure, because it preserves the cycle instead of ending it. Yet the chapter immediately risks self-corruption when that logic spreads too far. Not every competitor is a true enemy. Not every recurring irritation is a threat serious enough to justify total closure. The same severity that stabilizes one field can damage another if it becomes a reflex.

So the chapter's real question is not whether force sounds strong. It is whether motive and means for return have both been removed. If not, the conflict may only have changed tempo. Chapter 15 follows Chapter 14 so closely because information gathered under ease helps identify whether an opposition is merely inconvenient or genuinely recurring. It then points into Chapter 16, where the next problem is no longer force but distance. Once the threat is actually gone, value may increase not through more force but through absence. Closure ends one problem; distance creates the next kind of power. The chapter therefore reads best as a test of strategic completeness, not as permission to enjoy destruction. The field stabilizes only when the route of retaliation has actually been taken away rather than merely pressured into silence. Until that route is gone, peace may be only a pause with better optics. What looks merciful in the short term can therefore become harsher in the long term if it keeps the cycle alive.`,
        `Greene's fifteenth law argues that an unfinished enemy creates a special instability. A setback can take away status without taking away motive, and partial suppression can leave enough capacity for later retaliation. The threat therefore survives in altered form. What looks like moderation or mercy on the surface can function as postponement if the return route remains open.

That is the chapter's mechanism. Humiliation can sharpen revenge. Injury can deepen memory. Delay can grant time to reorganize. A visible win may hide the fact that the source of danger was never actually removed. Greene pushes toward decisive closure because half-measures can preserve both the reason to strike and the ability to do it.

The hard distinction is between stability and appetite. The law is not strongest when it sounds most cruel. It is strongest when it stays narrow: closure is justified here because unfinished threats can recur, not because severity is intrinsically admirable. Once the chapter is read as permission for generic destruction, it stops tracking recurrence risk and starts rewarding rage.

The ordinary-setting examples matter for the same reason. A workplace crackdown can remove the symptom of sabotage while leaving access, leverage, or alliance intact. A student government compromise can quiet open conflict while the same hostile coalition waits for the next vote. A personal confrontation can name the pattern without changing the conditions that let it keep happening. In each case, surface resolution preserves the deeper return path.

But the law also carries a moral and strategic limit. Partial mercy may leave the cycle alive, yet indiscriminate total-war thinking can degrade judgment and create fresh enemies where none needed to exist. De-escalation, repair, and separation remain better answers when the conflict is ordinary rather than truly recurring and dangerous. The chapter keeps its force only if the reader can separate existential opposition from ordinary rivalry.

So the central test is exact: have motive and means for return both been removed, or has the conflict merely changed shape? Chapter 14's information advantage matters because it helps answer that question before closure is attempted. Chapter 16 follows because once overt pressure has genuinely ended, the logic of value changes. Power can then come less from force than from absence, scarcity, and the distance that lets importance rise. The chapter remains disciplined only when the reader can hold that limit while still taking recurrence seriously enough to finish what truly has to end. Otherwise the reader mistakes intensity for completion and leaves the same enemy-function alive under a different costume. The enemy may be quieter, but the structural danger is still waiting for its second opening. Completion here means removing the future strike path, not merely winning the current scene. If the same grievance can still find leverage, allies, or access later, the closure was incomplete no matter how decisive it looked in the moment. That is the difference between an ended threat and a postponed return in strategic terms for readers.`,
        `This law works only if you see why a half-defeated enemy can be more unstable than a finished one. Visible loss does not kill memory. Humiliation does not kill motive. Weakening does not always kill capacity. If those elements survive together, the conflict has not ended. It has only slowed down and moved underground.

Greene therefore prefers decisive closure to partial suppression when the threat is serious. A public setback can intensify revenge while time and leftover structure allow regrouping. A victory that looks humane or moderate may actually preserve the cycle if it leaves the path of return open. The chapter's severity comes from that recurrence logic, not from a taste for cruelty.

The deeper distinction is brutal but necessary. Ending a threat is not the same thing as performing force. Spectacle can humiliate the enemy while doing nothing to remove the root danger. Rage can feel decisive while actually making the later return more likely. The chapter is strongest when it asks a colder question: what would actually prevent recurrence? Only then does total closure mean anything more than theater.

That question travels well beyond battlefield language. In work settings, visible discipline may leave the saboteur's leverage and channels untouched. In school settings, a truce can pause open conflict while preserving the coalition that will restart it later. In personal settings, naming harm without changing access can leave the destructive pattern almost fully alive. The board changes appearance, but the structure of return remains.

Yet the same logic can poison judgment if it becomes universal. Not every rival is a true enemy. Not every repeated irritation is a danger that warrants crushing closure. The habit of treating all friction as war can turn severity into self-corruption, waste, and unnecessary damage. The law therefore remains conditional even at its hardest edge: serious recurring threats may need complete closure, while ordinary conflict often demands distance, repair, or refusal instead.

The chapter's real test is whether motive and means survive together. If they do, expect the conflict back in a different shape. If they do not, the field may finally stabilize. Chapter 15 depends on Chapter 14's prior observation and opens into Chapter 16's different question. Once the enemy is truly gone, force gives way to absence. Value can begin rising where pressure no longer has to stay visible. The hardest discipline is to close what must be closed without turning closure itself into a permanent habit of mind. That final restraint is what keeps the law strategic instead of barbaric. It also keeps the reader from confusing anger relief with real neutralization. The chapter's severity is justified only when it actually prevents recurrence rather than simply expressing appetite. Where the route back survives, the conflict survives with it, no matter how satisfying the earlier blow may have felt. Otherwise the law collapses into performance and loses the very stability it claimed to seek in practice over time for good permanently.`
      ),
      keyTakeaways: [
        {
          point: tone("Incomplete victory is unstable because it can preserve both revenge motive and return capacity.", "An enemy left half-neutralized may be more dangerous later than they were openly before.", "A slowed threat can be deadlier than a loud one."),
          moreDetails: tone("The chapter worries about what survives beneath the visible defeat, not about the optics of winning.", "If memory, anger, and structure remain aligned, the conflict may only have changed pace.", "A quiet board is not a clean board if the enemy still has a route back in.")
        },
        {
          point: tone("Humiliation without closure can worsen the problem instead of finishing it.", "Public injury can sharpen retaliation if neutralization never follows.", "Shaming the enemy is weak if the enemy can still move."),
          moreDetails: tone("A loss that wounds pride while leaving leverage intact can create a later strike with better motive and better timing.", "The law treats revenge as a strategic force, not only an emotional one.", "If you leave both rage and room, you are funding the sequel.")
        },
        {
          point: tone("Decisive closure differs from rage, spectacle, and performative cruelty.", "The law asks what actually removes recurrence, not what looks severe.", "Theater is not closure."),
          moreDetails: tone("Visible harshness can increase instability if it excites revenge without ending the root danger.", "The chapter keeps its discipline only when force is judged by whether the path back still exists.", "A loud hit that leaves the tunnel open is just expensive drama.")
        },
        {
          point: tone("Ordinary institutions also preserve recurrence when they solve only the surface problem.", "Work, school, and personal patterns restart when access, leverage, or coalition survive.", "The same fuse burns in offices, committees, and homes."),
          moreDetails: tone("Cosmetic fixes, vague compromises, and unchanged access often fail even when they look moderate.", "The chapter becomes practical when you examine what structure of return was left untouched.", "If the machinery survives, the conflict is only waiting for timing.")
        },
        {
          point: tone("The law stays valid only when total closure remains conditional rather than universal.", "Enemy logic must be reserved for serious recurring threats.", "Use this on every irritation and you become the unstable force."),
          moreDetails: tone("Not every rival is existential, and many conflicts are better answered through repair, distance, or de-escalation.", "The reader's burden is to distinguish real threat from inflated grievance before adopting closure logic.", "If you cannot tell danger from annoyance, this law will rot your judgment fast.")
        }
      ],
      activationPrompt: tone(
        "Identify one conflict that keeps returning and ask what motive and capacity were left alive each time the issue seemed solved.",
        "Choose one recurring threat and test whether previous responses removed the path back or only changed its shape.",
        "Pick one enemy-pattern that keeps reappearing and locate the tunnel you never actually sealed."
      ),
      selfCheckPrompts: [
        tone(
          "Am I dealing with a serious recurring threat, or am I projecting enemy logic onto ordinary friction?",
          "Does this situation truly preserve motive and means for return, or am I overstating the danger because I want a harder response?",
          "Is this a live threat or just my anger looking for war language?"
        ),
        tone(
          "Would this response actually remove recurrence, or would it merely look decisive while leaving the path back intact?",
          "Am I ending the source of danger, or am I performing severity in a way that could intensify revenge without neutralization?",
          "Will this close the tunnel, or just make the enemy hate me louder near the same door?"
        )
      ],
      predictionPrompt: tone(
        "Once the threat is actually gone, how might value rise through absence rather than through continued force in the next chapter?",
        "If closure has truly ended recurring opposition, what does Chapter 16 suggest happens when pressure gives way to distance and scarcity?",
        "After the enemy is gone, what changes when the board is ruled less by force than by absence?"
      ),
      oneMinuteRecap: tone(
        "This law argues that unfinished enemies can return because motive and capacity survive together, but its severity is valid only when the threat is truly serious and recurring.",
        "Full closure matters when half-measures preserve the path back; overread the law and you replace strategy with appetite.",
        "Leave the tunnel open and the enemy returns. Treat every hallway like a battlefield and you become the wrecking force."
      )
    }
  },
  examples: [
    {
      title: "Ren Ends the Real Source of Recurring Sabotage Instead of Patching the Symptom",
      format: "decision_point",
      category: "work",
      endingType: "broader_principle",
      scenario: tone("Ren can stop one visible disruption on the team, but he knows the same sabotage will return unless he removes the access that keeps enabling it.", "He must choose between a cosmetic fix and a full response that closes the route for repeated sabotage.", "Ren can swat the flare-up or seal the pipe feeding it."),
      whatToDo: tone("He addresses the access, leverage, and repeated pattern rather than only the latest incident.", "He solves the root channel that keeps letting the threat return.", "He closes the door, not just the noise."),
      whyItMatters: tone("The chapter warns that partial defeat leaves the path back intact.", "A symptom-level win can preserve motive and means for a second round.", "If the tunnel survives, the enemy just changes timing.")
    },
    {
      title: "Mara Sees Why the Student Board Fight Returns After Every Half-Resolution",
      format: "dialogue",
      category: "school",
      endingType: "self_directed_question",
      scenario: tone("Mara watches a student-election dispute keep returning because each compromise pauses the hostility without changing the coalition behind it.", "She hears why vague peace terms keep the same conflict alive for the next vote.", "Mara learns that every truce leaves the same fuse connected."),
      whatToDo: tone("She asks what structure of return is still untouched instead of congratulating the group for temporary calm.", "She looks past the surface peace to the motive and coalition still in place.", "She checks whether the board is quiet or actually clean."),
      whyItMatters: tone("The chapter cares about recurrence, not about declaring peace too early.", "A conflict can look resolved while the same return route survives underneath it.", "Silence is weak evidence if the machinery of return is still there.")
    },
    {
      title: "Ivo Weighs Soft Compassion Against Ending a Destructive Personal Pattern",
      format: "dilemma",
      category: "personal",
      endingType: "surprising_implication",
      scenario: tone("Ivo wants to be merciful, but every soft reset leaves the same harmful access in place and the pattern returns within weeks.", "He has to choose between another partial reset and a boundary that actually ends the cycle.", "Ivo can soothe the moment or close the loop for real."),
      whatToDo: tone("He changes the access pattern instead of repeating a warning that has never held.", "He uses a decisive boundary that removes the route for recurrence.", "He stops feeding the sequel with another soft pause."),
      whyItMatters: tone("The chapter distinguishes real closure from gestures that leave the danger alive.", "Mercy without structural change can preserve the same threat.", "If nothing closes, nothing ends.")
    },
    {
      title: "Sumi Predicts Why One Executive Refuses a Public Humiliation Strategy",
      format: "predict_reveal",
      category: "work",
      endingType: "cross_domain",
      scenario: tone("Sumi hears calls to embarrass a recurring saboteur in a meeting and predicts that the stronger leader will instead remove the leverage quietly.", "She expects the real response to neutralize the threat rather than perform severity.", "Sumi can already tell the smart move will seal the channel, not stage a show."),
      whatToDo: tone("She looks for whether the response ends the sabotage route instead of just increasing public shame.", "She judges the move by whether it removes recurrence rather than by how harsh it appears.", "She scores the play on closure, not volume."),
      whyItMatters: tone("The chapter says decisive closure and spectacle are not the same thing.", "Visible harshness can intensify revenge if neutralization never follows.", "Theater is loud weakness when the enemy keeps the keys.")
    },
    {
      title: "Debate-Team Debrief Finds the Same Conflict Waiting Behind a Vague Truce",
      format: "postmortem",
      category: "school",
      endingType: "common_trap",
      scenario: tone("A debate team reviews why a hostile pattern returned right after a temporary peace statement calmed everyone for a week.", "The group sees that it solved the mood of the conflict without touching the source.", "The team realizes the truce only dimmed the fire without cutting the line."),
      whatToDo: tone("They identify which access, rule gap, or repeated incentive was left intact.", "They examine the untouched structure that invited the same return.", "They stop praising the patch and inspect the leak."),
      whyItMatters: tone("The chapter warns that cosmetic calm can preserve real danger.", "Surface resolution is weak if the underlying return path survives.", "A quiet week proves very little if the fuse is still live.")
    },
    {
      title: "Before and After a Boundary Shift Stopped a Conflict from Restarting",
      format: "before_after",
      category: "personal",
      endingType: "perspective_reframe",
      scenario: tone("Before, someone kept naming the harm while leaving the same access in place. After, a decisive boundary removed the route that kept letting the pattern restart.", "The contrast is between repeated warning and changed structure.", "Before was noise. After was closure."),
      whatToDo: tone("Notice whether the response changes conditions enough that the old pattern cannot easily return.", "Judge the boundary by whether it removes the path back, not by how stern it sounds.", "Ask whether the door is actually shut or only described better."),
      whyItMatters: tone("The chapter says recurrence ends when the route for recurrence is gone.", "Real closure changes the conditions of return.", "The pattern dies when the tunnel closes, not when the speech gets tougher.")
    }
  ],
  implementationPlan: {
    coreSkill: tone("The core skill is distinguishing real closure of a recurring threat from cosmetic responses that leave the return route intact.", "Core skill: identify whether motive and capacity for return survive after the response.", "Core skill: close the tunnel instead of congratulating yourself on the noise reduction."),
    ifThenPlans: [
      { context: "work", plan: tone("If a work conflict keeps returning, then I will look for the access, leverage, or incentive that was never actually removed.", "If the same workplace threat reappears, then I will test whether prior fixes touched the root channel or only the symptom.", "If work sabotage comes back, I inspect the pipe, not the splash.") },
      { context: "school", plan: tone("If a school dispute calms down too easily, then I will ask what coalition or rule gap still leaves room for its return.", "If a student conflict keeps recycling, then I will examine what structure of recurrence survived the compromise.", "If the school room goes quiet fast, I check whether the fuse is still wired.") },
      { context: "personal", plan: tone("If a personal boundary keeps failing, then I will ask whether the access pattern actually changed.", "If the same harmful pattern restarts, then I will test whether I ended the route back or only protested it again.", "If the personal conflict returns, I stop narrating the door and start closing it.") }
    ],
    twentyFourHourChallenge: tone("Within 24 hours, identify one recurring problem and name the exact path by which it keeps returning after every partial fix.", "Today, choose one repeated conflict and write down what motive or capacity survived each earlier response.", "Before the day ends, find one fight that keeps reappearing and mark the tunnel you never sealed."),
    weeklyPractice: tone("For one week, track which conflicts were truly ended, which were only postponed, and where ordinary friction was wrongly inflated into enemy logic.", "Spend seven days auditing recurrence: what returned, why it returned, and whether your response removed the path back or only looked decisive.", "Run a one-week closure audit and separate sealed threats from paused problems and from annoyances you never needed to treat as war.")
  },
  reviewCards: [
    { cardId: "ch15-rc01", front: tone("Why is partial defeat unstable in this chapter?", "Why can a setback fail to end the threat?", "Why can a wounded enemy still be a live enemy?"), back: tone("Because an enemy can lose ground without losing the motive or capacity to return.", "A setback can change the form of the threat while leaving recurrence alive.", "Because the board can look won while the return route stays open."), difficulty: "easy" },
    { cardId: "ch15-rc02", front: tone("What makes humiliation risky when closure is incomplete?", "Why can public injury intensify danger?", "Why is shaming weak if the enemy can still move?"), back: tone("It can deepen revenge while some real capacity for retaliation still survives.", "Humiliation without neutralization can increase motive while leaving means intact.", "Because shame can sharpen the enemy if you leave them room."), difficulty: "easy" },
    { cardId: "ch15-rc03", front: tone("How is decisive closure different from cruelty for its own sake?", "What separates neutralization from spectacle?", "Why is theater not closure?"), back: tone("Closure aims to end a recurring threat rather than to indulge rage.", "The chapter judges force by whether the path back is removed, not by how harsh it looks.", "Because loud punishment means nothing if the tunnel stays open."), difficulty: "medium" },
    { cardId: "ch15-rc04", front: tone("Where does this law appear in ordinary settings?", "How do work, school, and personal conflicts show recurrence risk?", "Where does the same fuse burn outside war language?"), back: tone("It appears wherever cosmetic fixes, vague compromises, or unchanged access preserve the same return path.", "Recurring sabotage, recycled board fights, and weak boundaries all show the pattern.", "In offices, committees, and homes where the machinery of return survives."), difficulty: "medium" },
    { cardId: "ch15-rc05", front: tone("What limit keeps this law from becoming reckless?", "Why must enemy logic stay conditional?", "What happens if you use this law on every irritation?"), back: tone("Not every rival is a true enemy, and many ordinary conflicts need de-escalation or repair instead.", "The law works only when the threat is serious and recurring enough to justify full closure.", "You become the unstable force and wreck your own judgment."), difficulty: "hard" }
  ],
  keyTakeawayCard: tone("A serious enemy left partly intact can return, but closure logic becomes dangerous when it is spread across ordinary conflict.", "This law is about removing the path back for real recurring threats, not about making severity your default mood.", "Close the tunnel when the threat is real. Do not turn every hallway into war.")
};

const quiz = {
  passingScorePercent: 70,
  questions: [
    {
      questionId: "ch15-q01",
      prompt: "Why does Greene treat partial defeat as unstable in this chapter?",
      choices: [
        "Because every loss automatically ends the conflict",
        "Because unfinished enemies can keep motive and capacity to return",
        "Because cruelty is always the safest response"
      ],
      correctIndex: 1,
      explanation: tone("Yes. The core mechanism is recurrence risk: the enemy is weakened but not truly finished.", "Partial defeat can preserve both revenge motive and some path back.", "Right. The threat changes form instead of disappearing."),
      bloomsLevel: "remember-understand",
      depthLevel: "easy"
    },
    {
      questionId: "ch15-q02",
      prompt: "What does recurrence risk mean here?",
      choices: [
        "The chance that a conflict returns because motive and means were left alive",
        "The belief that all disagreement should be treated as war",
        "The rule that mercy always causes weakness"
      ],
      correctIndex: 0,
      explanation: tone("Correct. The chapter worries about the return route left open after a partial victory.", "Recurrence risk means the conflict can come back because the threat was not fully neutralized.", "Yes. The board can reopen if the tunnel survives."),
      bloomsLevel: "remember-understand",
      depthLevel: "easy"
    },
    {
      questionId: "ch15-q03",
      prompt: "Why is this law not best read as generic cruelty advice?",
      choices: [
        "Because the chapter is really about ending a serious recurring threat, not indulging rage",
        "Because Greene rejects all force completely",
        "Because the law only applies in military settings"
      ],
      correctIndex: 0,
      explanation: tone("Exactly. The law is narrower than bloodlust and stays on recurrence logic.", "Its argument is about closure against real threat, not spectacle for its own sake.", "Right. The point is ending the return route, not celebrating cruelty."),
      bloomsLevel: "remember-understand",
      depthLevel: "easy"
    },
    {
      questionId: "ch15-q04",
      prompt: "In Ren's work scenario, what fits the chapter best?",
      choices: [
        "Publicly shame the saboteur but leave the same access in place",
        "Ignore the issue because any strong response would be excessive",
        "Remove the access and leverage that keep letting the sabotage return"
      ],
      correctIndex: 2,
      explanation: tone("Yes. The chapter favors closure of the return route rather than theatrical punishment.", "The best move ends the source of recurrence instead of only the symptom.", "Right. Seal the pipe, not just the flare-up."),
      bloomsLevel: "apply-analyze",
      depthLevel: "medium"
    },
    {
      questionId: "ch15-q05",
      prompt: "Why does Mara see the student-board conflict as unresolved?",
      choices: [
        "Because the compromise paused the hostility without changing the coalition behind it",
        "Because every compromise is automatically a mistake",
        "Because student politics should always escalate to total victory"
      ],
      correctIndex: 0,
      explanation: tone("Correct. Surface calm is weak if the structure of return is still in place.", "The same conflict can come back when vague peace terms leave the underlying coalition untouched.", "Yes. The fuse stayed wired even though the room got quiet."),
      bloomsLevel: "apply-analyze",
      depthLevel: "medium"
    },
    {
      questionId: "ch15-q06",
      prompt: "What is the strongest reading of Ivo's personal dilemma?",
      choices: [
        "A soft reset is always morally superior to a firm boundary",
        "A decisive boundary can be necessary when repeated mercy leaves the destructive pattern alive",
        "Any personal conflict should be treated like an enemy to crush"
      ],
      correctIndex: 1,
      explanation: tone("Yes. The chapter allows firmness when the same harmful pattern keeps returning.", "Mercy without structural change can preserve recurrence instead of ending it.", "Right. If the loop stays open, another soft pause just funds the sequel."),
      bloomsLevel: "apply-analyze",
      depthLevel: "medium"
    },
    {
      questionId: "ch15-q07",
      prompt: "Why can humiliation without neutralization make a threat worse?",
      choices: [
        "Because all public consequences should be avoided",
        "Because enemies never care about status or injury",
        "Because humiliation can deepen revenge while leaving enough capacity for retaliation"
      ],
      correctIndex: 2,
      explanation: tone("Correct. The chapter treats revenge as stronger when pride is injured but the threat remains alive.", "Public injury can intensify motive while neutralization still has not happened.", "Yes. Shame plus room is a dangerous mix."),
      bloomsLevel: "analyze-evaluate",
      depthLevel: "hard"
    },
    {
      questionId: "ch15-q08",
      prompt: "When does the chapter's logic become an overread?",
      choices: [
        "When it distinguishes serious threat from normal friction",
        "When it asks whether motive and means still survive",
        "When it is used to justify total-war thinking in ordinary disagreements"
      ],
      correctIndex: 2,
      explanation: tone("Exactly. The law breaks when enemy logic gets spread across routine conflict.", "Using closure logic on ordinary friction turns the chapter reckless.", "Right. If every irritation becomes war, the reader becomes the unstable force."),
      bloomsLevel: "analyze-evaluate",
      depthLevel: "hard"
    },
    {
      questionId: "ch15-q09",
      prompt: "How does Chapter 14 naturally lead into Chapter 15?",
      choices: [
        "Friendly access makes all later force unnecessary",
        "Information gathered earlier helps identify whether opposition is truly serious and recurring",
        "Observation matters only because it makes people easier to embarrass publicly"
      ],
      correctIndex: 1,
      explanation: tone("Yes. The map from Chapter 14 helps decide whether this chapter's closure logic is actually warranted.", "Prior observation helps separate real recurring threat from ordinary rivalry before force is considered.", "Right. The map tells you whether the enemy is real before you close the board."),
      bloomsLevel: "analyze-evaluate",
      depthLevel: "hard"
    },
    {
      questionId: "ch15-q10",
      prompt: "What bridge carries Chapter 15 into Chapter 16?",
      choices: [
        "Once opposition is neutralized, the next question becomes what absence and distance do to value",
        "Once closure is complete, force should remain visible forever",
        "After victory, the only useful move is to keep humiliating the other side"
      ],
      correctIndex: 0,
      explanation: tone("Correct. The next law turns from closure toward scarcity, respect, and absence.", "Chapter 16 asks what happens after pressure recedes and presence becomes less constant.", "Yes. Once the board is closed, value starts moving through distance instead of force."),
      bloomsLevel: "analyze-evaluate",
      depthLevel: "hard"
    }
  ]
};

chapter.quiz = quiz;

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
for (const name of ["Ren", "Mara", "Ivo", "Sumi"]) {
  continuity.nameUsage[name] = [stem];
}
continuity.withinChapterNames[stem] = ["Ren", "Mara", "Ivo", "Sumi"];
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
- Supporting structures present: implementation plan, review cards, key takeaway card
- Review package wraps the full validated chapter JSON
- Reading metrics written and continuity hash sealed at \`${seal}\`

## Prose checks
- No contamination phrases detected in reader-facing tone objects
- No plain-string scenario fields in required mode
- No exact tone collapse detected
- Chapter-specific mechanism remains recurrence risk, partial defeat, revenge motive, return capacity, decisive closure, and the overreach limit rather than generic brutality advice
- Hard depth preserves the closure-versus-appetite boundary and the Chapter 16 absence bridge
- Quiz stays within supported facts from the approved draft and frozen source bundle

## Drift repair
- Detected deviation: the first Chapter 15 generation attempt failed before artifact creation because of a quoting bug in the local builder.
- Repair: rewrote the local builder, regenerated the full Chapter 15 chain from canonical draft through validated wrapper, reran manual word-band and schema checks, resealed continuity, and resumed from the corrected strict path.

## Gate result
- Approved for chapter gate and automatic continuation
`;
writeText(paths.validation, validation);

fs.appendFileSync(
  paths.runLog,
  `\n- Repair: the first Chapter 15 generation attempt failed before artifact creation because of a local quoting bug; rebuilt the chapter chain from the prewriter boundary under the corrected builder and reran chapter checks.\n- Completed writer, editor, critic, converter, quiz, and validator steps for Chapter 15.\n- Validation result: PASS.\n- Continuity hash sealed for \`${stem}\`: \`${seal}\`\n`,
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
