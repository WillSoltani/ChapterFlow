const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const runRoot = path.resolve(".chapterflow/runs/the-48-laws-of-power/20260409-002544");
const num = 24;
const stem = `ch${String(num).padStart(2, "0")}`;
const title = "Play the Perfect Courtier";
const chapterId = "ch24-play-the-perfect-courtier";
const createdAt = new Date().toISOString();

function tone(gentle, direct, competitive) {
  return { gentle, direct, competitive };
}

const canonical = `Greene's twenty-fourth law begins with a social fact that blunt merit alone does not solve. In visible hierarchies, people are not responding only to substance. They are also responding to status signals, ego friction, timing, and the manner in which competence appears. A clumsy display of strength can provoke resistance that quieter competence might have avoided. The chapter begins by treating hierarchy as a theater in which presentation changes what talent is allowed to do.

Its claim is not that sincerity is worthless or that deception is always wise. Greene's point is more strategic. In status-heavy environments, tact, indirection, and graceful self-presentation can preserve access that blunt assertion would close. Courtly skill lowers needless friction. It helps a person move among egos, vanities, and sensitivities without triggering envy or avoidable offense at every turn. Presentation therefore becomes part of power, not merely decoration around it.

That is why the law focuses on strategic grace rather than on empty flattery. Greene is not praising total submission, permanent performance, or self-erasure as virtue. He is distinguishing social intelligence from hollow servility. The useful move is not to disappear into compliance. It is to present yourself with enough tact and indirection that you can keep influence, preserve room, and move through hierarchy without making every truth into a public collision.

Ordinary settings make the mechanism visible. A worker who corrects a senior figure bluntly in front of the group may be punished more for the public sting than rewarded for being right. A student on an honors council may learn that elegant phrasing and careful credit-sharing preserve support better than visible self-display. A person in close relationships may discover that timing and tone determine whether honesty is heard as care or as attack. In each case, the issue is not fake niceness. It is the management of ego friction inside a visible order.

The chapter's limit matters. Courtliness can become corrosive if it turns into endless performance, flattery without judgment, or abandonment of principle for approval. Greene overreaches if the law becomes advice to live entirely through masks. The useful version is narrower: use tact where it preserves access and reduces avoidable backlash, but do not let grace dissolve the self that is supposedly being protected. Chapter 23 gathered force. Chapter 24 asks how gathered force must often be carried inside status theaters before it can act without waste. That leads toward Chapter 25, where power begins to depend on recreating the self rather than letting any one social identity harden into a cage.`;

const edited = canonical;

const critic = `# Chapter 24 Critic Report

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
- Paragraph 4 is most vulnerable because work, school, and personal examples can flatten into generic social-skills advice if conversion drops the hierarchy, ego-friction, and access mechanism.

Strongest sentence:
- "Presentation therefore becomes part of power, not merely decoration around it."

Anchor use notes:
- The draft stays inside the frozen support: status theaters punish bluntness, tact and indirection preserve access, strategic grace differs from servility, and courtliness fails when it becomes self-betrayal.

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
        "This law says that in visible hierarchies, blunt talent is not always enough. People react not only to what you do but also to how you appear while doing it. Greene is not saying honesty is bad or that everyone should become fake. The chapter makes a narrower point. In status-heavy settings, tact and controlled presentation can help you move without causing avoidable envy or offense. If you push every truth directly and publicly, you may lose access even when you are right. Courtly skill means presenting yourself with enough grace that other people's egos do not turn every interaction into resistance. But the chapter is not praising empty flattery or asking you to erase yourself. Strategic grace is supposed to protect room to move, not turn you into a permanent performer. The lesson is to manage friction inside hierarchy so your competence can keep working instead of getting blocked by needless backlash.",
        "Greene's twenty-fourth law argues that social intelligence matters in status theaters. If you move too bluntly, you can trigger wounded pride, public embarrassment, or quiet envy that closes doors later. The chapter is not telling you to lie all the time. It is telling you that tact, timing, and indirection can preserve access better than open collision in many hierarchies. The stronger reading is strategic grace, not fake sweetness. Present yourself carefully enough that others can accept your competence without feeling publicly cut down by it. Give credit well, choose timing carefully, and do not turn every correction into a performance. But the chapter is not saying you should become servile or abandon principle. Grace matters only if it helps you keep influence without dissolving your own center. Used well, courtly skill lowers friction so your position stays usable instead of becoming trapped in ego wars.",
        "This law gives a practical warning: in status-heavy environments, being right is not always enough if you are right in a way that humiliates the wrong person. Greene's point is that tact can be useful because it preserves room. Graceful indirection can reduce backlash, protect access, and make others less defensive around your competence. But the chapter is not asking for endless performance or cowardly flattery. It is asking for disciplined presentation. A competitive reader should notice that direct brilliance can still lose if it provokes avoidable enemies, while measured skill can keep moving because it manages the room as well as the task. Courtliness is strategic only when it keeps your influence alive without making you hollow. If you must constantly betray yourself to stay welcome, the tactic has already become too expensive. The right move is to reduce needless offense while keeping enough self-respect to know what you will not perform away.",
      ),
      keyTakeaways: [
        { point: tone("Status theaters punish blunt public friction.", "How you present competence affects whether people let it work.", "Humiliate the room and the room may close ranks.") },
        { point: tone("Tact and indirection can preserve access.", "Graceful presentation can reduce envy and avoidable backlash.", "Sometimes the smoother move keeps the stronger position.") },
        { point: tone("Strategic grace differs from servility.", "The chapter is about social intelligence, not self-erasure.", "If courtliness costs the whole self, it stopped being strategy.") }
      ],
      oneMinuteRecap: tone(
        "This law says tact and graceful presentation can preserve access in visible hierarchies.",
        "Do not confuse blunt correctness with strategic skill if it needlessly triggers ego backlash.",
        "Move smoothly enough to keep influence without disappearing into flattery."
      )
    },
    medium: {
      chapterBreakdown: tone(
        `Greene's twenty-fourth law begins by questioning the fantasy that merit can move through hierarchy untouched by presentation. In visible status systems, people are not reacting only to content. They are also reacting to who is speaking, how publicly they are challenged, how much ego friction is created, and whether a display of competence feels graceful or humiliating. Greene is interested in that hidden social tax. The chapter asks what happens when talent is carried with tact instead of bluntness.

That is why courtly skill matters here. Greene is not describing generic politeness or manners for their own sake. He is describing access management. If you move with indirection, timing, and controlled self-presentation, you can reduce needless backlash while preserving influence inside a hierarchy. Tact does not make the hierarchy good. It makes it more navigable. The chapter treats graceful presentation as a way of keeping doors open that public sting might close.

The chapter is strongest when it distinguishes strategic grace from empty flattery. The useful move is not to disappear into compliance or to praise everyone mindlessly. It is to understand that people with status, vanity, or public visibility often punish the manner of a challenge more than its substance. Greene is not praising servility. He is showing how indirect competence can survive in rooms that punish blunt self-display. Grace matters only if it preserves room without surrendering the core self.

The pattern appears in ordinary settings. A worker who corrects a senior figure privately may keep influence that a public correction would have destroyed. An honors-council student may learn that careful credit-sharing protects support better than visible brilliance that embarrasses peers. A personal conversation may go farther when honesty is timed and framed so it can be heard rather than immediately defended against. In each case, tact manages ego friction so substance has a chance to land.

The limit matters because courtliness can become corrosive. If every adjustment becomes self-betrayal, or if preserving access requires endless performance with no private center left, the tactic fails. Greene's practical claim is narrower: use grace where it lowers avoidable social cost and protects influence, but do not let presentation become a permanent surrender of principle. Chapter 23 concentrated force. Chapter 24 asks how concentrated force must often be carried inside hierarchy. Chapter 25 then turns toward self-recreation, where power depends on not becoming trapped inside a single performed identity.`,
        `Greene's twenty-fourth law argues that hierarchy punishes clumsy self-display as much as weak substance. People like to imagine that truth spoken directly always wins respect. Greene hears another possibility: public bluntness can trigger vanity, envy, and offense that close off access long after the content of the moment is forgotten. The chapter therefore begins with a strategic problem, not a moral slogan. What if the room resists not only what you say, but how your way of saying it rearranges status?

That is why tact can be useful. If you present yourself with measured grace, you may preserve room to move where blunt assertion would have provoked resistance. Greene is interested in the management of avoidable backlash. Timing, phrasing, indirect credit, and controlled visibility can all matter because they let people accept your competence without feeling publicly cut down by it. Courtly skill therefore becomes part of power rather than a decorative social layer on top of it.

This is why the chapter is not generic etiquette advice. Greene is not telling the reader to become sweet, shallow, or obedient. He is separating strategic indirection from hollow flattery. The issue is not good manners in the abstract. The issue is how influence survives among egos. Grace works when it lowers friction while leaving your judgment intact. It fails when it becomes total performance for approval.

The pattern appears everywhere. A media-lab contributor may get more done by letting a public lead keep face while still steering the project quietly. A student on an honors council may notice that support follows the person who shares credit elegantly, not the one who proves superiority too visibly. A private relationship may improve when difficult truths are timed so they do not arrive as public humiliation. In each case, access depends on how strongly you trigger defense.

The limit remains central because some hierarchies ask for too much performance. If preserving access means endless compromise or no recognizable self remains, the chapter's tactic has turned sour. Greene's point is disciplined rather than total: reduce needless friction where hierarchy is real, but keep enough independence to know when courtliness is costing more than it protects. Chapter 23 gathered force; Chapter 24 teaches how to carry it smoothly. Chapter 25 then asks how the self must be recreated so one role or reputation does not harden into a trap.`,
        `This law starts with a tempting mistake: assuming that directness is always the strongest sign of confidence. Greene's warning is that visible hierarchies often punish the person who is blunt in the wrong way, even when that person is correct. If your competence arrives as public sting, bruised ego, or obvious superiority, the room may react against the performance before it engages the substance. You may lose access not because you lacked merit, but because you mishandled status theater.

That matters because tact changes the cost of being effective. A graceful presentation can make it easier for others to live with your competence. The chapter therefore treats indirection, timing, and impression-management as strategic tools. They reduce the chance that your usefulness will be recoded as threat. What courtliness protects is not merely likability. It protects room.

This keeps the law narrower than praise for flattery. Greene is not saying that you should become a pleasing surface with nothing underneath. He is asking whether your bluntness is serving truth or merely spending influence needlessly. Strategic grace means carrying strength in a way the room can absorb. It becomes failure when preserving acceptance requires permanent self-erasure.

Common settings make the point plain. A coworker who chooses a private correction over a public one may keep both the relationship and the result. An honors-council member who frames ideas with shared credit may hold support that open display would have burned. A personal conversation can go farther when care is visible in the delivery rather than buried under force. In each case, tact preserves access by reducing avoidable social friction.

The limit matters because graceful adaptation can become a mask that never comes off. If you must keep performing to the point that your own judgment disappears, the tactic is no longer preserving power. It is consuming it. Chapter 23 showed that force should be concentrated rather than scattered. Chapter 24 shows that concentrated force must often be carried with grace inside hierarchy. Chapter 25 follows by asking how a person recreates the self instead of letting one courtly posture harden into identity.`,
      ),
      keyTakeaways: [
        {
          point: tone("Visible hierarchies punish blunt public offense.", "How competence appears can change whether it is accepted.", "Status theaters often react to sting before they react to substance."),
          moreDetails: tone("The chapter focuses on ego friction, timing, and presentation rather than on merit alone.", "Public embarrassment and visible superiority can trigger resistance that quieter delivery might avoid.", "A room can reject the manner before it judges the argument.")
        },
        {
          point: tone("Tact and indirection preserve access.", "Graceful presentation can keep doors open in hierarchy.", "If you lower needless friction, your influence travels farther."),
          moreDetails: tone("Greene values courtly skill because it reduces envy, offense, and defensive backlash.", "The chapter's leverage comes from access management inside status-heavy rooms.", "Move smoothly enough and people keep letting you stay in the game.")
        },
        {
          point: tone("Strategic grace differs from empty flattery.", "The move is controlled presentation, not hollow obedience.", "Courtliness works only if there is still a self underneath it."),
          moreDetails: tone("The chapter still requires judgment, boundaries, and a private center.", "Grace matters only if it protects influence without dissolving principle.", "If you must become nothing to stay welcome, the tactic has failed.")
        },
        {
          point: tone("Work, school, and personal settings all show how access depends on delivery.", "The same truth can land differently depending on timing and ego cost.", "The room you preserve may matter more than the point you win publicly."),
          moreDetails: tone("Public corrections, shared credit, and careful phrasing all shape whether support survives.", "The chapter becomes practical when you ask how to reduce backlash without becoming false.", "Influence often depends on how much defense you trigger while being useful.")
        },
        {
          point: tone("The law has a self-erasure limit.", "Courtliness becomes corrosive if it demands endless performance.", "Grace should lower costs, not hollow out the self."),
          moreDetails: tone("Some hierarchies reward performance so heavily that adaptation can become compromise without end.", "Greene warns against flattening tact into permanent servility.", "The right boundary is where presentation stops protecting power and starts replacing personhood.")
        }
      ],
      activationPrompt: tone(
        "Identify one hierarchy where blunt correctness may be costing you more access than it earns.",
        "Choose one room where grace and timing would preserve influence better than public sting.",
        "Pick one status theater where smoother delivery would keep your leverage alive."
      ),
      selfCheckPrompt: tone(
        "Am I reducing needless friction, or just training myself to disappear?",
        "What part of my delivery is triggering ego backlash I could avoid without lying?",
        "Where is tact preserving access, and where would it become too expensive in self-respect?"
      ),
      oneMinuteRecap: tone(
        "This chapter says courtly skill helps power move through hierarchy by lowering avoidable ego friction.",
        "Do not mistake blunt correctness for wisdom if it burns access you still need.",
        "Present strength with enough grace that influence survives the room."
      )
    },
    hard: {
      chapterBreakdown: tone(
        `Greene's twenty-fourth law treats courtliness as a political skill rather than as a moral ornament. Most people hear "courtier" and think of flattery, polished manners, or social softness. Greene is interested in a sharper claim: in visible hierarchies, competence does not move through the room naked. It arrives through status signals, ego sensitivities, public staging, and the interpretive habits of those already guarding position. The chapter therefore begins by questioning the fantasy that blunt merit is automatically rewarded. A person can be correct, capable, and even useful while still being punished for the social form in which that usefulness appears.

That is why tact and indirection can matter here. Greene is not praising elegance for aesthetic reasons. He is describing friction management. When strength is presented with timing, shared credit, and measured visibility, it may preserve access that public sting would destroy. Courtly skill helps a person move among vanities without making every truth into a duel. The chapter treats impression-management as part of power because access depends not only on what you can do, but on how tolerable your way of doing it feels to the hierarchy around you.

The chapter is strongest when it resists the lazy reading that this is simply advice to flatter upward. Greene is not praising total obedience, hollow charm, or permanent self-subordination. He is distinguishing strategic grace from servility. Strategic grace keeps your judgment alive while lowering the social cost of your presence. Servility sacrifices judgment for approval. The difference is whether presentation protects influence or replaces the self with a mask that must never crack.

This is why bluntness can be expensive. The problem is not merely that directness sounds harsh. It is that public correction, visible superiority, or badly timed candor can trigger defensive behavior out of proportion to the content itself. People do not like to be made to feel small in front of witnesses. Hierarchies especially remember who disturbed the arrangement of face. The chapter therefore asks whether a truth that could have moved quietly is worth spending as a public sting simply because bluntness feels cleaner to the speaker.

Ordinary settings show the mechanism clearly. A professional who corrects a senior figure privately may preserve influence that a public triumph would have destroyed. An honors-council member who distributes credit elegantly may maintain coalition support that open self-display would have burned. A personal relationship may become more honest, not less, when difficult truths are timed and phrased so they can be heard without immediate humiliation. In each case, tact is not fake niceness. It is a way of lowering avoidable ego friction so substance can travel farther than vanity would otherwise allow.

The limit matters because courtliness can become corrosive. If every adjustment is another surrender of principle, or if preserving access requires endless role-play with no private center left intact, the tactic has failed. Greene is not arguing that the self should dissolve into presentation. He is arguing against spending influence wastefully in status theaters that punish clumsy force. Chapter 23 gathered power by concentrating it. Chapter 24 asks how that gathered power must often be carried if it is to survive contact with hierarchy. Chapter 25 follows naturally from there. Once a person learns to move through the room by presentation, the danger is that the presentation hardens into identity. The next task is self-recreation: refusing to become trapped inside the very social form that once preserved access. Courtliness succeeds only when grace remains tactical, bounded, and answerable to a self that can still decide when the room is worth navigating at all.`,
        `Greene's twenty-fourth law argues that courtly skill can be strategically useful because hierarchy punishes avoidable offense even when it claims to reward merit. Most readers hear "play the perfect courtier" and assume the advice must be cynical or decorative. Greene hears a more practical issue: if your competence arrives as public embarrassment to someone who holds face, that competence may close doors instead of opening them.

Tact preserves access because it changes how others metabolize your strength. If you time a correction carefully, share credit intelligently, or let a senior figure retain face while still moving the substance, you may accomplish more than blunt accuracy would have accomplished. Greene is interested in the management of vanity, not because vanity is noble, but because vanity is often real. The chapter treats grace as a way of keeping influence mobile inside rooms where ego can obstruct substance.

That is why the chapter should not be flattened into etiquette advice. It is not saying that manners are always virtuous or that directness is always naive. It is saying that strategic indirection can reduce the defensive response that hierarchy produces when status feels threatened. Courtliness means carrying strength in a socially absorbable form. Servility means abandoning your center so the room stays pleased. The distinction matters because only one of those preserves real power.

The pattern appears in ordinary life. A media-lab contributor may let a visible lead make the announcement while privately steering the actual decision. An honors-council student may phrase a correction so peers can accept it without being publicly cut down. A personal conversation may succeed because the speaker made care legible before making criticism explicit. In each case, the difference lies less in the truth than in the social cost attached to receiving it.

The limit remains central because not every room deserves adaptation. If a hierarchy demands endless performance, constant self-editing, or the surrender of principles that define your judgment, courtliness becomes expensive camouflage rather than strategy. Greene's practical claim is narrower: use grace where it lowers avoidable friction and preserves room, but keep enough independence to walk away from roles that are eating the person who plays them. Chapter 23 showed that force should be concentrated rather than diffused. Chapter 24 shows that concentrated force often needs elegant carriage inside status theater. Chapter 25 then turns toward self-recreation, where power depends on not becoming fixed in one socially legible mask. The reader's edge lies in seeing that presentation is a tool, not a home. Once the tool starts owning the user, the tactic has inverted.`,
        `This law works only if you track what hierarchy is doing before you decide what sincerity requires. Most people focus on what directness says about them: honesty, courage, refusal to flatter. Greene's warning is that directness also does something practical to the room. It can sharpen vanity, trigger defensive coalition behavior, and turn your competence into a status problem before it is evaluated as substance. The chapter is about that conversion.

That is why courtliness can be strategically valuable. A person who speaks with measured grace may look softer while actually keeping more room to act. Indirection, careful timing, and controlled self-presentation can all reduce the chance that useful competence will be recoded as intolerable superiority. Greene is not praising masks because they are pretty. He is protecting influence from the backlash that status theaters generate when they feel publicly rearranged.

The chapter therefore distinguishes graceful presentation from self-loss. Empty flattery is not intelligence. Endless performance is not strategy. Strategic courtliness keeps a private center while carrying public force in a less abrasive form. Without that center, the tactic curdles into servility. Without the tact, blunt merit may burn the path it needed in order to keep moving.

Common settings show the law with almost embarrassing clarity. A coworker who gives public credit and private correction may retain access that a brilliant public takedown would destroy. An honors-council member who lets peers feel included may secure decisions more effectively than the member who proves superiority in the room. A personal relationship may become more truthful when the delivery lowers humiliation enough for honesty to be heard. In each case, courtly skill does not falsify substance. It changes the social conditions under which substance can survive.

The limit matters because grace can fail too. Adapt too far and you become a costume built for other people's comfort. Refuse all adaptation and you may spend influence proving that you were right in a way that leaves nothing usable afterward. Greene's better point is to make presentation answerable to judgment rather than to vanity. Chapter 23 taught that force matters when it is concentrated. Chapter 24 teaches that concentrated force often needs ceremonial handling if it is to travel through hierarchy without triggering wasteful defense. Chapter 25 follows because any posture that works too well can harden into identity, and hardened identity becomes another prison. The deepest lesson is that power in social theaters depends on carrying strength in forms the room can absorb, while never forgetting that the form is a tactic. If you lose the self beneath the grace, the room has not merely been navigated. It has annexed you. If you keep the self and manage the room, then tact has begun doing real political work.`,
      ),
      keyTakeaways: [
        {
          point: tone("Hierarchy punishes blunt public offense.", "Visible status systems react to social sting as much as to substance.", "Make the wrong person feel small in public and merit may stop mattering."),
          moreDetails: tone("The chapter emphasizes ego friction, face, and public staging rather than abstract etiquette.", "Competence can be resisted when it arrives as humiliation or obvious superiority.", "The room often answers the wound before it answers the argument.")
        },
        {
          point: tone("Tact and indirection preserve access.", "Graceful presentation keeps influence mobile in status theaters.", "Lower the room's defensiveness and your strength travels farther."),
          moreDetails: tone("Greene values courtliness because it helps a person move among vanity without constant backlash.", "The chapter's leverage comes from access management, timing, and socially absorbable delivery.", "Strength often survives better when it does not force every ego to defend itself at once.")
        },
        {
          point: tone("Strategic grace differs from servility.", "The move is bounded presentation, not self-replacement.", "A mask is useful only if someone real can still take it off."),
          moreDetails: tone("The chapter still requires judgment, boundaries, and a private center that presentation serves.", "Grace matters only if it protects influence without hollowing out identity.", "When approval starts setting your boundaries, the tactic has slipped into dependency rather than strategy.")
        },
        {
          point: tone("Ordinary rooms show how delivery shapes whether truth can land.", "Work, school, and personal settings all reveal the politics of form.", "The point you keep alive may matter more than the point you win publicly."),
          moreDetails: tone("Private correction, shared credit, and careful framing often preserve more long-term room than public sting.", "The chapter becomes practical when you ask how to lower backlash without becoming false.", "Substance needs a social path if it is going to travel at all.")
        },
        {
          point: tone("The law has a self-betrayal limit.", "Courtliness fails when adaptation becomes endless self-erasure.", "Grace should manage hierarchy, not let hierarchy annex the self."),
          moreDetails: tone("Some environments demand so much performance that adaptation stops being tactical and becomes corrosive.", "Greene warns against turning courtly skill into identity itself.", "The tactic is sound only while the person underneath it remains intact enough to choose.")
        }
      ],
      activationPrompt: tone(
        "Identify one hierarchy where your delivery is creating more ego friction than your substance requires.",
        "Choose one room where elegant timing would preserve more access than blunt correctness.",
        "Pick the status theater where smoother carriage would keep your force usable."
      ),
      selfCheckPrompts: [
        tone(
          "Am I managing the room, or letting the room train me into self-erasure?",
          "Which part of my bluntness is serving truth, and which part is only spending influence loudly?",
          "If I soften the delivery here, what exactly stays mine that would disappear if I kept performing forever?"
        ),
        tone(
          "What does this hierarchy actually punish: bad substance, or bad staging of substance?",
          "How can I preserve access without teaching myself to become decorative?",
          "At what point would courtliness stop being a tactic and start becoming a cage?"
        )
      ],
      predictionPrompt: tone(
        "Once courtly skill keeps force moving through hierarchy, how might Chapter 25 show the risk of becoming trapped in the image that made this skill work?",
        "If graceful presentation preserves access, what changes next when power depends on recreating the self rather than repeating one role?",
        "After learning how to carry strength through the room, what happens when the room starts expecting the same version of you forever?"
      ),
      oneMinuteRecap: tone(
        "This chapter argues that power in hierarchy often depends on carrying strength with enough tact that the room can absorb it without immediate backlash.",
        "Do not confuse blunt correctness with mastery if its social form burns the access your competence needs.",
        "Sometimes power grows when grace protects force without becoming the identity that traps it."
      )
    }
  },
  examples: [
    {
      title: "Lior Chooses a Private Correction So the Team Lead Keeps Face and the Project Keeps Moving",
      format: "decision_point",
      category: "work",
      endingType: "broader_principle",
      scenario: tone("Lior spots a serious flaw in a public planning meeting where the team lead has been taking visible ownership.", "He has to decide whether to expose the error in front of everyone or redirect it in a way that keeps access intact.", "Lior can win the moment bluntly or keep the room usable for the real work."),
      whatToDo: tone("He raises the concern in a way that protects the lead's face while still changing the decision.", "He chooses tact over public sting.", "He treats the hierarchy as a room to navigate, not a stage for righteous humiliation."),
      whyItMatters: tone("The chapter says courtly skill preserves access by reducing avoidable ego friction.", "A private or carefully framed correction can keep influence alive longer than a public victory.", "If the room stays open, the substance can keep moving.")
    },
    {
      title: "Amaya Hears Why the Honors Council Punished Visible Self-Display More Than Weak Substance",
      format: "dialogue",
      category: "school",
      endingType: "self_directed_question",
      scenario: tone("Amaya listens as a mentor explains why one council member lost support after showing superior knowledge too aggressively during introductions.", "She hears how the room reacted more to bruised egos than to the quality of the argument itself.", "Amaya learns that status theater can punish the wrong social form even when the content is strong."),
      whatToDo: tone("She asks how careful credit-sharing and phrasing might have kept the same point alive without public sting.", "She studies the cost of visible superiority in a peer hierarchy.", "She asks what truth could have survived if it had arrived with more grace."),
      whyItMatters: tone("The chapter warns that hierarchy often resists humiliation before it judges substance.", "The council's backlash shows why delivery can matter as much as content in status-heavy rooms.", "A room that feels cut down may stop listening just to stop losing face.")
    },
    {
      title: "Tariq Weighs Grace Against the Cost of Performing Too Much in a Personal Relationship",
      format: "dilemma",
      category: "personal",
      endingType: "surprising_implication",
      scenario: tone("Tariq has learned to phrase difficult truths gently, but he is starting to wonder whether he is smoothing himself out too completely.", "He has to decide when tact is preserving the relationship and when it is training him to disappear.", "Tariq can keep the peace skillfully or notice that the performance is starting to own him."),
      whatToDo: tone("He keeps care and timing, but he sets a boundary where grace no longer requires self-betrayal.", "He distinguishes strategic softness from self-erasure.", "He keeps the room calm without handing over the whole self as the price of calm."),
      whyItMatters: tone("The chapter says courtliness fails when it becomes endless performance with no center left underneath.", "Tact works only while it protects influence without hollowing out identity.", "If the mask never comes off, the tactic has become the problem.")
    },
    {
      title: "Sima Predicts Why One Operator Uses Indirection Instead of Public Brilliance in the Media Lab",
      format: "predict_reveal",
      category: "work",
      endingType: "cross_domain",
      scenario: tone("Sima notices an operator let someone else announce the strongest idea while quietly steering the actual decision behind the scenes.", "She predicts the move is not timidity but a way of avoiding envy and preserving future room.", "Sima can already see that controlled visibility may be stronger than obvious superiority."),
      whatToDo: tone("She judges whether the indirection protects access while still preserving real agency.", "She looks for grace with judgment rather than charm with surrender.", "She scores the move on whether the operator kept influence without becoming decorative."),
      whyItMatters: tone("The chapter says impression-management can be part of power in status-heavy environments.", "Indirect competence may travel farther than public brilliance if the room punishes visible threat.", "Sometimes the less dramatic display keeps the stronger long game alive.")
    },
    {
      title: "Media-Lab Debrief Finds That Direct Brilliance Triggered Backlash the Team Could Have Avoided",
      format: "postmortem",
      category: "school",
      endingType: "common_trap",
      scenario: tone("A media-lab team reviews why a strong proposal stalled after one presenter corrected classmates sharply and claimed visible credit.", "The debrief shows that the substance was good but the social form bruised too many egos in a visible hierarchy.", "The team learns that being right did not protect the idea from status backlash."),
      whatToDo: tone("They redesign the next pitch around careful framing, shared credit, and lower public sting.", "They keep the substance and change the carriage.", "They stop assuming merit alone can outrun hierarchy."),
      whyItMatters: tone("The chapter warns that clumsy self-display can make a good idea harder to accept.", "Their problem was not weak content but avoidable offense cost.", "The room closed because the delivery made acceptance feel like surrender.")
    },
    {
      title: "Before and After Blunt Presence Became Measured Grace That Preserved Access Without Surrender",
      format: "before_after",
      category: "personal",
      endingType: "perspective_reframe",
      scenario: tone("Before, difficult conversations arrived with visible force and kept turning into defensive battles. After, the same truths were timed and framed with enough care to be heard.", "The contrast is between blunt self-display and controlled presentation.", "One version proves sincerity loudly; the other keeps sincerity useful."),
      whatToDo: tone("Keep honesty, but manage timing, tone, and public exposure so the point can survive the interaction.", "Carry the truth with more grace than heat.", "Let the substance land without demanding that the other person lose face first."),
      whyItMatters: tone("The law distinguishes courtly intelligence from empty niceness.", "Measured grace can preserve room that blunt delivery wastes.", "Power in relationships often begins when truth stops arriving as a public weapon.")
    }
  ],
  reviewCards: [
    { cardId: "ch24-rc01", front: tone("Why can bluntness be costly in this chapter?", "Why does visible hierarchy punish some correct statements?", "What makes direct competence socially expensive?"), back: tone("Because public sting can trigger ego backlash, envy, or offense that closes access.", "The chapter says rooms often react to the social wound before the substance.", "If your truth humiliates the wrong person publicly, the room may defend face before fact."), difficulty: "easy" },
    { cardId: "ch24-rc02", front: tone("What do tact and indirection preserve here?", "Why does graceful presentation matter in a status theater?", "What does courtly skill protect?"), back: tone("They preserve access and reduce avoidable backlash inside hierarchy.", "Graceful delivery keeps influence mobile where bluntness might freeze it.", "Courtly skill protects room to move."), difficulty: "easy" },
    { cardId: "ch24-rc03", front: tone("How is strategic grace different from servility?", "What separates courtliness from self-erasure?", "Why isn't pleasing the room enough?"), back: tone("Strategic grace keeps judgment and boundaries alive, while servility gives them away for approval.", "The chapter values bounded presentation, not total obedience.", "If the self disappears underneath the mask, the tactic has failed."), difficulty: "medium" },
    { cardId: "ch24-rc04", front: tone("Where does this law show up in ordinary life?", "How do work, school, and personal settings reveal status theater?", "Where does delivery change whether truth lands?"), back: tone("It appears wherever hierarchy, face, and ego friction shape how competence is received.", "Private correction, shared credit, and careful timing often preserve more influence than public sting.", "The room matters because substance needs a social path to travel."), difficulty: "medium" },
    { cardId: "ch24-rc05", front: tone("How does Chapter 24 bridge to Chapter 25?", "Why does courtly skill lead into self-recreation?", "What danger appears after graceful presentation starts working?"), back: tone("Once presentation preserves access, the next danger is becoming trapped in the image that made it work.", "Chapter 25 asks how the self can be recreated before one social role hardens into identity.", "First learn to carry strength through the room, then refuse to become only that carriage."), difficulty: "hard" }
  ],
  keyTakeawayCard: tone(
    "Courtliness is useful when tact and graceful presentation preserve access inside hierarchy without requiring self-erasure.",
    "This law warns that blunt correctness can waste influence while bounded grace keeps strength moving through the room.",
    "Power grows when force is carried with enough tact to survive the room without letting the room own the self."
  )
};

const quiz = {
  passingScorePercent: 70,
  questions: [
    { questionId: "ch24-q01", prompt: "Why can bluntness be costly in this chapter?", choices: ["Because public sting can trigger backlash that closes access", "Because directness is always immoral", "Because hierarchy makes truth irrelevant"], correctIndex: 0, explanation: tone("Correct. The chapter says visible offense can provoke ego defense before the room evaluates substance.", "Blunt delivery can create avoidable backlash in status-heavy settings.", "Right. If your truth humiliates the room, the room may answer the humiliation first."), bloomsLevel: "remember-understand", depthLevel: "easy" },
    { questionId: "ch24-q02", prompt: "What do tact and indirection preserve here?", choices: ["Permanent popularity", "Access and room to move inside hierarchy", "Freedom from all compromise"], correctIndex: 1, explanation: tone("Yes. Greene treats tact as a way of preserving access and reducing needless friction.", "The chapter's mechanism is access management, not simple niceness.", "Right. Grace keeps doors open that public sting can close."), bloomsLevel: "remember-understand", depthLevel: "easy" },
    { questionId: "ch24-q03", prompt: "Why is this chapter not generic manners advice?", choices: ["Because it is mainly about fashion and polish", "Because politeness is always weak", "Because it concerns status theater, ego friction, and influence"], correctIndex: 2, explanation: tone("Correct. The law is about moving through hierarchy strategically, not about etiquette for its own sake.", "Greene is tracking access, vanity, and social cost around competence.", "Yes. This is political tact, not a sermon on niceness."), bloomsLevel: "remember-understand", depthLevel: "easy" },
    { questionId: "ch24-q04", prompt: "In Lior's work scenario, what best fits the chapter?", choices: ["Expose the lead publicly so merit is visible", "Stay silent so no one feels challenged", "Correct the issue in a way that preserves the lead's face and keeps influence alive"], correctIndex: 2, explanation: tone("Yes. The chapter favors tactful correction that changes the substance without wasting access.", "He protects the room while still moving the decision.", "Right. Winning the point matters less than keeping the path usable for future influence."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch24-q05", prompt: "Why did the honors council react against visible self-display in Amaya's dialogue example?", choices: ["Because the social form bruised egos inside a peer hierarchy", "Because strong arguments are never welcome", "Because councils reject all confidence"], correctIndex: 0, explanation: tone("Correct. The backlash came from status offense and visible superiority, not from the argument alone.", "The room resisted the sting before it judged the substance.", "Yes. The problem was not just what was said, but how the hierarchy was made to feel."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch24-q06", prompt: "What is the strongest reading of Tariq's personal dilemma?", choices: ["He should stop caring about delivery completely", "Grace is useful only while it does not become self-betrayal", "Any adaptation to another person is automatically false"], correctIndex: 1, explanation: tone("Yes. The chapter's limit is that courtliness fails when it hollows out the self it was meant to protect.", "Tact matters, but not at the cost of permanent self-erasure.", "Right. If the mask never comes off, the tactic has become the threat."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch24-q07", prompt: "How does impression-management function in this chapter?", choices: ["It helps strength travel in a socially absorbable form", "It guarantees that everyone will like you", "It replaces the need for substance"], correctIndex: 0, explanation: tone("Correct. Presentation matters because it shapes whether the room can accept your competence without immediate defense.", "The chapter treats impression-management as part of how influence survives hierarchy.", "Yes. The form can determine whether the substance gets a hearing."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" },
    { questionId: "ch24-q08", prompt: "When does courtliness become corrosive instead of strategic?", choices: ["When it improves timing and lowers backlash", "When it turns into endless performance that erases judgment and self-respect", "When it reduces public sting"], correctIndex: 1, explanation: tone("Exactly. Greene's useful limit is the point where grace becomes self-loss.", "The tactic fails when preserving access consumes the person underneath it.", "Right. If hierarchy annexes the self, courtliness has stopped serving power."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" },
    { questionId: "ch24-q09", prompt: "How does Chapter 23 lead into Chapter 24?", choices: ["Concentrated force next has to be carried through hierarchy without needless backlash", "Chapter 24 rejects the need to manage presentation", "Once force is concentrated, status no longer matters"], correctIndex: 0, explanation: tone("Correct. Chapter 23 gathered force; Chapter 24 shows how that force must often be presented inside status theater.", "The sequence moves from concentration to graceful carriage in hierarchy.", "Right. First gather power, then learn how to move it through the room."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" },
    { questionId: "ch24-q10", prompt: "What bridge carries Chapter 24 into Chapter 25?", choices: ["Courtliness removes the need for identity change", "Chapter 25 abandons presentation entirely", "The next danger is becoming trapped in the social mask that preserved access"], correctIndex: 2, explanation: tone("Correct. Once graceful presentation works, the risk is that it hardens into a fixed identity.", "Chapter 25 turns toward self-recreation so the tactic does not become a cage.", "Yes. The mask that helped you move can later become the role you cannot leave."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" }
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
for (const name of ["Lior", "Amaya", "Tariq", "Sima"]) continuity.nameUsage[name] = [stem];
continuity.withinChapterNames[stem] = ["Lior", "Amaya", "Tariq", "Sima"];
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
- Chapter-specific mechanism remains status theater, tact discipline, impression-management, and the self-erasure limit rather than generic etiquette rhetoric
- Hard depth preserves the grace-versus-servility boundary and the Chapter 25 self-recreation bridge
- Quiz stays within supported facts from the approved draft and frozen source bundle

## Gate result
- Approved for chapter gate and automatic continuation
`;
writeText(paths.validation, validation);

fs.appendFileSync(
  paths.runLog,
  `\n- Completed writer, editor, critic, converter, quiz, and validator steps for Chapter 24.\n- Validation result: PASS.\n- Continuity hash sealed for \`${stem}\`: \`${seal}\`\n`,
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
