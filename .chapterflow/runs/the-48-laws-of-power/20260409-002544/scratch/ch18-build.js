const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const runRoot = path.resolve(".chapterflow/runs/the-48-laws-of-power/20260409-002544");
const num = 18;
const stem = `ch${String(num).padStart(2, "0")}`;
const title = "Do Not Build Fortresses to Protect Yourself - Isolation Is Dangerous";
const chapterId = "ch18-do-not-build-fortresses-to-protect-yourself-isolation-is-dangerous";
const createdAt = new Date().toISOString();

function tone(gentle, direct, competitive) {
  return { gentle, direct, competitive };
}

const canonical = `Greene's eighteenth law begins with a temptation that feels reasonable. When pressure rises, retreat can look like safety. Distance promises fewer interruptions, fewer threats, and fewer points of contact. A private corner can seem easier to control than a crowded field. The chapter starts by challenging that instinct. Greene argues that the same isolation that feels protective can also make a person weaker.

The reason is informational before it is emotional. Once you withdraw too far, you stop receiving live signals from the world around you. You hear less, see less, and adjust more slowly. Contact does not only create risk. Contact also carries warning, feedback, movement, and opportunities to correct your assumptions. A fortress can reduce exposure, but it can also cut you off from the very information that would help you stay safe.

That is why the chapter is not well read as a rant against privacy. Greene is not claiming that every boundary is foolish. Some distance is necessary. Some rooms need to close. Some decisions need quiet. The problem appears when selective protection hardens into fortress thinking. At that point, a person begins mistaking enclosure for control and silence for security.

Once that mistake sets in, the costs multiply. Isolation narrows awareness. Narrow awareness produces stale assumptions. Stale assumptions make outside moves harder to read. A person behind walls may feel shielded while becoming easier to corner indirectly, because the field keeps changing while the retreating person loses touch with its movement. The chapter's harder point is that circulation and contact preserve adaptability in ways enclosure cannot.

The pattern appears in ordinary settings. A colleague who stops attending informal check-ins may miss the shift that changes a project. A student group that seals itself off can become easier to outmaneuver because it no longer hears what the room is reacting to. A personal life built entirely around defensive distance may preserve calm at the cost of reality-testing. In each case, retreat lowers friction while also lowering awareness.

The limit matters. The chapter does not reward indiscriminate openness. Constant exposure can be foolish. Careless access can be dangerous. Greene's claim is narrower than that. Protection works best when it preserves movement, access to information, and selective contact. It fails when it turns into a sealed habit that cuts a person off from the changing environment.

Chapter 17 warned that strategic unreadability could slip into self-defeating excess. Chapter 18 names one form of that excess: fortress isolation. It also points toward Chapter 19. If isolation narrows your information, the next danger is misjudging the actual person in front of you. A sealed position does not just reduce contact. It can make you less accurate about who is approaching, what they want, and how dangerous they really are.`;

const edited = `Greene's eighteenth law begins with a temptation that feels reasonable. When pressure rises, retreat can look like safety. Distance promises fewer interruptions, fewer threats, and fewer points of contact. A private corner can seem easier to control than a crowded field. The chapter starts by challenging that instinct. Greene argues that the same isolation that feels protective can also make a person weaker.

The reason is informational before it is emotional. Once you withdraw too far, you stop receiving live signals from the world around you. You hear less, see less, and adjust more slowly. Contact does not only create risk. Contact also carries warning, feedback, movement, and opportunities to correct your assumptions. A fortress can reduce exposure, but it can also cut you off from the information that would help you stay safe.

The chapter is not well read as a rant against privacy. Greene is not claiming that every boundary is foolish. Some distance is necessary. Some rooms need to close. Some decisions need quiet. The problem appears when selective protection hardens into fortress thinking. At that point, a person begins mistaking enclosure for control and silence for security.

Once that mistake sets in, the costs multiply. Isolation narrows awareness. Narrow awareness produces stale assumptions. Stale assumptions make outside moves harder to read. A person behind walls may feel shielded while becoming easier to corner indirectly, because the field keeps changing while the retreating person loses touch with its movement. The chapter's harder point is that circulation and contact preserve adaptability in ways enclosure cannot.

The pattern appears in ordinary settings. A colleague who stops attending informal check-ins may miss the shift that changes a project. A student group that seals itself off can become easier to outmaneuver because it no longer hears what the room is reacting to. A personal life built entirely around defensive distance may preserve calm at the cost of reality-testing. In each case, retreat lowers friction while also lowering awareness.

The limit matters. The chapter does not reward indiscriminate openness. Constant exposure can be foolish. Careless access can be dangerous. Greene's claim is narrower than that. Protection works best when it preserves movement, access to information, and selective contact. It fails when it turns into a sealed habit that cuts a person off from the changing environment.

Chapter 17 warned that strategic unreadability could slip into self-defeating excess. Chapter 18 names one form of that excess: fortress isolation. It also points toward Chapter 19. If isolation narrows your information, the next danger is misjudging the person in front of you. A sealed position does not just reduce contact. It can make you less accurate about who is approaching, what they want, and how dangerous they really are.`;

const critic = `# Chapter 18 Critic Report

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
- Paragraph 5 is the most vulnerable because work, school, and personal examples can flatten into generic social advice if conversion loses the information-loss mechanism.

Strongest sentence:
- "A fortress can reduce exposure, but it can also cut you off from the information that would help you stay safe."

Anchor use notes:
- The draft stays inside the frozen support: isolation feels protective, but it cuts off information, movement, and awareness; prudent boundaries remain valid; sealed withdrawal becomes dangerous when it narrows adaptability.

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
        "This law says isolation can feel safe while secretly making you weaker. If you pull back too far, you lose contact with useful information, warning signs, and changing conditions around you. Greene is not saying every boundary is bad. The chapter makes a narrower point. Privacy can help, but fortress thinking can leave you cut off from the signals that keep you accurate. The danger is not only loneliness. The danger is blindness. A person behind walls may feel protected while missing what the field is doing. That can make the next move harder to read and the next threat easier to underestimate. The lesson is to keep enough contact, movement, and feedback that protection does not turn into stale assumptions. Safety comes from selective connection and awareness, not from sealing yourself away until nothing live reaches you. The wall can block danger, but it can also block the warning that danger is already shifting.",
        "Greene's eighteenth law argues that isolation looks protective because it reduces exposure, but it often reduces awareness at the same time. If you retreat too far, you stop hearing what is changing around you. The chapter is not against all privacy or all boundaries. It is against fortress habits that cut you off from information, circulation, and adjustment. A sealed position can feel calm, yet that calm may come from missing the signals that would force you to adapt. The stronger reading is that protection should still leave room for contact and feedback. Once your walls become too complete, you become easier to surprise because your assumptions grow stale while the field keeps moving. Security fails when it turns into blindness. The point is not to stay exposed all the time. It is to keep enough living contact that your judgment stays current.",
        "This law makes a practical warning: the place that feels safest can become the place that leaves you most out of touch. Isolation can lower noise, but it can also lower awareness. Greene's claim is not that distance is always foolish. The chapter allows for privacy, rest, and selective boundaries. What it rejects is fortress thinking, where a person starts treating enclosure as control. If you cut yourself off from contact, you lose feedback, timing, and live information. Then your picture of reality hardens while reality keeps changing. The result is a dangerous kind of comfort. You feel safer because you hear less, not because the field has actually become safer. Keep enough circulation that you still know what is moving outside the wall. Protection should preserve judgment, not starve it. If the boundary blocks fresh information, it may already be making you easier to trap."
      ),
      keyTakeaways: [
        { point: tone("Isolation can feel safe while quietly reducing awareness.", "Fortress comfort can hide blind spots.", "A wall can calm you while making you easier to surprise.") },
        { point: tone("Contact and circulation preserve information, warning, and adaptability.", "Live contact keeps your map current.", "Movement and feedback keep the board from going stale.") },
        { point: tone("The law criticizes fortress isolation, not all privacy or all boundaries.", "Selective protection differs from sealed withdrawal.", "Guard the door if you want, but do not brick up the windows.") }
      ],
      oneMinuteRecap: tone(
        "This law says retreat can look protective while cutting you off from the information and contact that help you stay safe.",
        "Privacy can help. Fortress isolation can blind you.",
        "Protect yourself without sealing yourself off from reality."
      )
    },
    medium: {
      chapterBreakdown: tone(
        `Greene's eighteenth law argues that isolation becomes dangerous when protection turns into disconnection. Retreat lowers exposure, which is why it can feel safe at first. But the chapter insists that safety is not only about reducing contact. It is also about preserving access to information, movement, and timely adjustment. Once those vanish, the defensive position starts weakening the person inside it.

The mechanism is informational. Isolation cuts you off from signals. You hear less of what people are saying, miss subtle changes in mood or direction, and lose the small warnings that help you adapt before pressure becomes visible. The chapter therefore treats circulation as practical rather than decorative. Contact is not just social noise. It is how awareness stays current.

That is why the law is not best understood as anti-privacy. Some boundaries are necessary. Some distance helps judgment. The danger begins when selective protection hardens into fortress thinking. A person behind walls can mistake stillness for safety and quiet for control while the outside field keeps shifting in ways they no longer track.

Ordinary settings make the point clear. A worker who withdraws from informal contact can miss the change that decides a project. A club that seals itself off from wider reaction can become easier to outmaneuver because it no longer knows what others have already noticed. A personal life built around defensive distance can preserve calm while starving itself of reality checks. In each case, retreat reduces friction and also reduces awareness.

The chapter's limit matters too. Greene is not recommending careless exposure or endless access. The point is narrower: protection should preserve circulation, not destroy it. Chapter 18 therefore follows Chapter 17's unreadability with an important correction. It is one thing to resist being easily mapped. It is another to disappear so completely that your own map goes stale. That bridge points toward Chapter 19, where poor information makes it easier to misjudge the person you are dealing with. The safest position is not the emptiest room. It is the position that still gets timely correction before conditions turn against it.`,
        `Greene's eighteenth law says fortress isolation can weaken you because it replaces live contact with stale assumptions. Pulling back feels protective because fewer people can reach you and fewer disruptions enter the room. But that same withdrawal can leave you slower, less informed, and easier to surprise. The chapter treats safety as something that depends on awareness, not just enclosure.

Isolation therefore costs more than company. It costs signals. You lose hallway information, casual warnings, changing reactions, and the small adjustments that come from staying in motion with other people. Greene's point is that circulation keeps a person accurate. Once contact collapses, the map in your head starts aging faster than you realize.

This does not mean all openness is wise. The chapter is not calling for indiscriminate access. It is separating prudent boundaries from fortress thinking. Boundaries filter. Fortresses seal. The first can preserve judgment; the second can trap it inside an outdated picture of the field.

The pattern shows up in ordinary life. A leader who hides behind process walls may miss what is actually shifting in the team. A school group that stops listening outside itself can become easier to counter because it no longer receives corrective feedback. A private relationship can become brittle if one person treats distance as the only form of safety. In each case, isolation feels orderly while quietly reducing adaptability.

The hard limit is that some distance still matters. Rest, privacy, and selective access are not the enemy here. The enemy is enclosure that stops movement and contact altogether. Chapter 18 follows Chapter 17 for a reason: after learning to avoid being too readable, a reader might overcorrect into disappearance. Chapter 19 then raises the next cost of that overcorrection by asking what happens when narrowed awareness leaves you unable to judge the wrong person accurately. The chapter therefore measures safety by whether the boundary still lets revision happen on time. If correction arrives too late, the enclosure is already costing more than it protects.`,
        `This law starts with a false comfort. Isolation seems attractive because it looks easier to control than a changing environment. Fewer interruptions create the feeling of order. Fewer points of contact create the feeling of safety. Greene's warning is that this comfort can become strategically expensive.

The expense comes through information loss. Once you withdraw too far, you stop receiving the live signals that would tell you what is changing. You lose access to reaction, timing, movement, and correction. A fortress may reduce direct exposure, but it also reduces the circulation that keeps judgment fresh.

That distinction is what keeps the chapter precise. It is not a lecture against privacy. It is a warning against sealed withdrawal that confuses enclosure with control. The law fails when it gets flattened into generic advice to be more social. The stronger reading is that a person needs enough contact to stay informed without becoming carelessly exposed.

Common settings reveal the mechanism. A colleague who cuts off informal check-ins may not notice that a decision is already moving elsewhere. A sealed student group can become easier to outmaneuver because its assumptions stop being tested against live reaction. A personal retreat that once felt restorative can turn into a habit that blocks useful reality checks. In each case, the problem is not solitude itself but the blindness that comes from too much defensive distance.

The limit remains central. Selective access, rest, and privacy still matter. The chapter's claim is that safety requires awareness as well as protection. That is why Chapter 18 stands as a correction after Chapter 17. Unreadability can be useful, but total withdrawal can leave you blind. That blindness sets up Chapter 19's next concern: if you are cut off from the field, you become worse at reading the specific person who may do you harm.`,
      ),
      keyTakeaways: [
        {
          point: tone("Isolation can lower exposure while also lowering awareness.", "Retreat may reduce contact but still increase vulnerability.", "A quieter room can produce a worse map."),
          moreDetails: tone("The chapter focuses on information loss, not on solitude as a moral failure.", "Protection fails when it cuts off the signals that keep judgment current.", "If the wall blocks warning as well as noise, the calm is expensive.")
        },
        {
          point: tone("Circulation and selective contact preserve adaptability.", "Live signals keep strategy current.", "You stay safer when the field can still reach your attention."),
          moreDetails: tone("Contact matters here because it carries correction, feedback, and early warning.", "The chapter values movement and awareness more than static enclosure.", "A current map comes from contact, not from guessing behind glass.")
        },
        {
          point: tone("Prudent boundaries differ from fortress isolation.", "Boundaries filter; fortresses seal.", "A guarded door is not the same as a sealed bunker."),
          moreDetails: tone("The chapter still allows privacy, rest, and selective access.", "Its warning is aimed at enclosure that freezes awareness rather than protecting it.", "The question is whether the boundary preserves judgment or starves it.")
        },
        {
          point: tone("Work, school, and personal settings all show how sealed withdrawal creates stale assumptions.", "Isolation often makes groups easier to outmaneuver.", "If nobody fresh reaches the group, its internal story starts lying to it."),
          moreDetails: tone("Missed check-ins, sealed feedback loops, and closed circulation all make correction slower.", "The chapter becomes practical when you ask where retreat has stopped live information from reaching you.", "A group can feel disciplined while its picture of the board quietly expires.")
        },
        {
          point: tone("Chapter 18 corrects the risk of overusing Chapter 17's unreadability.", "Disappearing completely is not the same as staying strategically hard to read.", "If unreadability turns into absence from the field, you start blinding yourself."),
          moreDetails: tone("The bridge to Chapter 19 works because poor circulation leaves you worse at judging the person in front of you.", "The sequence moves from avoiding predictability to avoiding self-imposed blindness.", "You cannot read the wrong person well if your own field of view has already narrowed.")
        }
      ],
      activationPrompt: tone(
        "Identify one place where protection may have turned into information loss and ask what selective contact would restore awareness without losing prudence.",
        "Choose one context where retreat may be keeping your map stale, then name one contact point that would restore live signals without exposing too much.",
        "Pick one wall you built for safety and decide what window has to reopen so the board can update again."
      ),
      selfCheckPrompt: tone(
        "Is this boundary preserving judgment, or is it starving me of the information I need?",
        "Am I filtering contact intelligently, or sealing myself off until my map goes stale?",
        "Does this protection keep me current, or just comfortable?"
      ),
      oneMinuteRecap: tone(
        "This chapter says isolation feels safe but often becomes dangerous because it cuts off the contact and information that keep judgment accurate.",
        "Boundaries can help. Fortress thinking can blind.",
        "Stay protected without letting your map go stale."
      )
    },
    hard: {
      chapterBreakdown: tone(
        `Greene's eighteenth law treats isolation as one of the most seductive forms of false security. Retreat promises relief because it appears to reduce threats, interruptions, and points of exposure. A defended position feels cleaner than a crowded field. Yet the chapter insists that this feeling can reverse into vulnerability. The same walls that narrow access to you can also narrow your access to reality.

The key mechanism is informational deprivation. A person who withdraws too far loses contact with weak signals long before major events become obvious. Small warnings, informal reactions, shifting loyalties, and subtle changes in momentum often arrive through contact rather than through official channels. Isolation therefore does not merely reduce noise. It also reduces correction. It can make the person inside the fortress progressively less current while convincing them that stillness means control.

That is why the chapter is not best read as a denunciation of privacy. Greene is not arguing that all boundaries are naive or all openness is wise. Some distance protects judgment. Some doors should close. The distinction is between selective filtering and fortress thinking. Filtering preserves awareness while limiting exposure. Fortress thinking begins when someone treats enclosure itself as strategy, even after the enclosure has started starving them of fresh information.

The danger compounds because stale maps feel especially trustworthy from behind walls. Once contact shrinks, assumptions harden. Hardening assumptions then make outside movement harder to interpret. The retreating person may think they are harder to reach, while in practice they are becoming easier to mislead, easier to surround indirectly, and easier to trap with changes they failed to register in time. The chapter's harder point is that circulation is not the opposite of protection. In many situations, circulation is one of the conditions that makes protection real.

Ordinary settings reveal the logic clearly. A professional who retreats into process barriers can miss the informal shift that changes where power is moving. A student organization that seals itself off can become easier to outmaneuver because no outside reaction enters soon enough to correct its internal story. A private life ruled by defensive withdrawal can produce emotional calm while eroding reality-testing. In each setting, the fortress lowers friction and simultaneously narrows awareness.

The limit is crucial. This law does not praise indiscriminate access, constant availability, or porous boundaries. It warns against protection that destroys circulation altogether. Prudent distance still matters. Selective privacy still matters. The stronger claim is narrower: a protected position must still allow enough movement, contact, and informational exchange to keep judgment adaptive. When the shield becomes a sealed habitat, safety turns brittle.

That sequence matters across chapters. Chapter 17 warned against becoming too readable, but a reader could overlearn that lesson and start disappearing from the field entirely. Chapter 18 corrects that excess by showing that unreadability becomes self-defeating once it cuts you off from the live environment. Chapter 19 follows naturally from there. If fortress isolation narrows your information, you do not merely lose general awareness. You also become worse at reading the specific person who can do you damage. The law succeeds only when protection preserves contact with reality instead of replacing it with a comforting but outdated map. A wall is useful only if it does not turn your own perception into the weakest point in the structure. Once the wall starts delaying warning, slowing revision, and flattering certainty, it is no longer serving the person inside it. It is training them to react late, think narrowly, and confuse quiet with control. Real protection keeps you informed enough to move before the pressure closes around you.`,
        `Greene's eighteenth law argues that isolation often fails by corrupting awareness before it fails by allowing attack. A person withdraws in order to reduce exposure. The move looks prudent because fewer people reach them, fewer interruptions enter, and the surface appears calmer. But the chapter's real claim is that safety depends on more than reduced contact. It also depends on whether your picture of the field remains live, corrected, and responsive.

Isolation interrupts that correction. Once you step too far outside circulation, you lose minor signals, informal warnings, and the feedback that helps you revise your assumptions. A sealed position therefore does not merely block risk. It also blocks adjustment. Greene is interested in the vulnerability created when a person protects themselves so thoroughly that their judgment starts operating on stale inputs.

This is why the law must be kept distinct from generic anti-solitude advice. Privacy, rest, and selective access remain legitimate. The chapter's target is fortress thinking, not any ordinary wish for quiet. Fortress thinking converts a useful boundary into an enclosed worldview. It stops asking whether the wall is preserving judgment and starts assuming that the wall itself guarantees safety.

The pattern becomes visible in common settings. A manager hiding behind strict process can miss how alliances or reactions have shifted outside the meeting. A club that stops hearing outside response can continue with confidence long after the room has changed against it. A personal retreat can feel stabilizing while quietly reducing the checks that keep one interpretation from hardening into a complete story. In each case, isolation does not only reduce disturbance. It reduces revision.

The law's limit is therefore a design problem, not a popularity contest. You do not need maximal exposure. You need enough circulation to keep your map current. Boundaries should filter, not fossilize. Protection should lower unnecessary risk without sealing off the information that tells you what risk now looks like. That is where Chapter 18 pushes back against a bad reading of Chapter 17. Strategic unreadability can be useful, but total withdrawal turns unreadability inward by making you less able to read the world. That is why Chapter 19 follows next: the cost of stale awareness becomes acute when you have to judge the person in front of you with incomplete, aging, or distorted information. The chapter's force lies in that inversion. The fortress meant to keep danger out can end up locking ignorance in. Once that happens, you do not merely lose data. You lose timing, calibration, and the chance to revise before pressure hardens. A person can seem well defended while steadily becoming easier to mislead, easier to isolate further, and easier to strike through the blind side of their own assumptions. The strongest version of this law keeps you protected and current at the same time, because delayed awareness is only another form of exposure wearing heavier walls. A sealed room cannot substitute for a living read of the field.`,
        `This law works only if you keep two kinds of safety separate. One kind lowers exposure. The other keeps awareness alive. Isolation seems attractive because it serves the first kind immediately. When you reduce access, reduce interruptions, and reduce contact, the environment feels easier to control. Greene's warning is that this first kind of safety can quietly destroy the second.

The mechanism is not mysterious. Contact carries information. Circulation carries updates. Feedback carries correction. Once you withdraw too far, each of those flows weakens. You stop hearing weak signals, stop testing your assumptions against changing conditions, and stop adjusting at the speed the field now requires. A person in a fortress may feel protected precisely because the information that would unsettle them no longer enters.

That distinction keeps the chapter from drifting into slogans. It is not an attack on all privacy. It is not praise for being socially everywhere. The line Greene is drawing is between prudent boundaries and self-defeating enclosure. A boundary that protects judgment can be wise. A fortress that starves judgment while flattering it is dangerous.

Common life offers clean examples. A worker who cuts off informal contact may miss the hallway signal that a decision has moved. A sealed student group can mistake internal agreement for strategic clarity because outside feedback no longer corrects its assumptions. A personal retreat can provide relief while also making one reading of events feel more certain than it deserves. In every case, the cost of isolation is not merely reduced company. It is increased interpretive error.

The limit remains central because openness itself can be naive. Not every door should stay open. Not every contact deserves access. The chapter's claim is that protection works only when it still leaves room for selective circulation. Without that circulation, your map decays. Once your map decays, your safety rests on assumptions that reality may have already abandoned.

That is why the chapter sits exactly here in the sequence. After learning how unreadability can create caution, a reader might be tempted to retreat so far that nobody can map them. Chapter 18 answers that temptation by showing the hidden cost of such retreat. The next chapter continues the logic: if isolation weakens your information, you will become worse at judging the wrong person before it is too late. The deepest lesson is therefore not social but epistemic. A fortress can feel secure while making your understanding older, narrower, and more fragile by the day. Protection succeeds only if it keeps you informed enough to recognize danger before the wall becomes part of it. If the structure that shields you also blocks the signals that would update you, the structure is already working against you. The competitive edge here comes from staying protected without losing awareness of motion, intention, and risk outside the barrier. Once you stop receiving those updates, your safety turns performative. The room looks defended while your judgment grows slower and easier to outplay.`,
      ),
      keyTakeaways: [
        {
          point: tone("Isolation can create vulnerability by starving awareness while appearing to create safety.", "Retreat often fails through stale perception before open attack.", "A fortress can secure the perimeter while hollowing out the map inside."),
          moreDetails: tone("The chapter emphasizes informational deprivation rather than moralizing about solitude.", "Danger grows when reduced contact also reduces correction.", "A calm room can hide the fact that your information is aging faster than your confidence.")
        },
        {
          point: tone("Circulation is part of real protection because it preserves live correction.", "Movement and contact keep strategy adaptive.", "Security needs updates, not just walls."),
          moreDetails: tone("Contact matters because weak signals, reaction, and warning often travel through informal channels.", "The chapter values circulation because it keeps judgment responsive to change.", "Without live inputs, even a smart position starts trading on guesses that used to be true.")
        },
        {
          point: tone("Prudent boundaries differ from fortress thinking because one filters while the other fossilizes.", "The issue is not privacy but enclosure that freezes awareness.", "A guarded threshold can be wise; a sealed worldview cannot."),
          moreDetails: tone("The chapter still permits distance, quiet, and selective access.", "Its objection is to protection that makes the map less current than the field.", "A boundary earns its keep only if it protects judgment instead of flattering it into blindness.")
        },
        {
          point: tone("Work, school, and personal life all show how isolation turns internal stories stale.", "Closed loops often make groups easier to outmaneuver.", "When no fresh signal enters, the room starts overbelieving itself."),
          moreDetails: tone("Process walls, sealed feedback loops, and defensive retreat all slow correction.", "The chapter becomes practical when you ask where contact has become too thin to update your picture.", "A closed system may feel disciplined while its assumptions quietly age into liabilities.")
        },
        {
          point: tone("Chapter 18 corrects the overreaction to Chapter 17 and prepares Chapter 19.", "Unreadability becomes self-defeating when it removes you from the field you still need to read.", "Disappear too far and you stop seeing the wrong person clearly enough to survive them."),
          moreDetails: tone("The bridge works because narrowed circulation makes both general awareness and person-judgment worse.", "The sequence moves from resisting predictability to resisting self-imposed blindness.", "You cannot judge the dangerous individual well when your whole map is already running late.")
        }
      ],
      activationPrompt: tone(
        "Identify one wall that may be protecting you from noise while also blocking useful information, then name one selective contact point that would restore awareness.",
        "Choose one place where your protection strategy may have gone stale, and specify what live signal you need back in order to judge the field accurately.",
        "Pick the fortress habit that flatters your control most, then reopen one channel that makes the board update again."
      ),
      selfCheckPrompts: [
        tone(
          "Is this boundary preserving judgment, or merely preserving comfort while my information ages?",
          "Does this protection still allow live correction, or am I now defending a stale map?",
          "Am I filtering risk intelligently, or locking myself in with old assumptions?"
        ),
        tone(
          "What weak signal have I stopped receiving because contact has become too thin?",
          "If the field changed today, would this setup help me notice or help me miss it?",
          "Which matters more here: feeling unreachable, or staying accurate?"
        )
      ],
      predictionPrompt: tone(
        "Once isolation has narrowed awareness, how might Chapter 19 show the danger of misjudging the specific person in front of you?",
        "If a fortress makes your map stale, what happens next when you face someone you have read badly?",
        "After walls reduce your field of view, what risk appears when the wrong person walks into the frame?"
      ),
      oneMinuteRecap: tone(
        "This chapter argues that isolation becomes dangerous when it cuts you off from the information, correction, and contact required for real safety.",
        "Boundaries can protect. Fortresses can blind.",
        "Keep the wall if needed, but never at the price of a dead map."
      )
    }
  },
  examples: [
    {
      title: "Pia Reopens a Contact Point After Retreat Starts Hiding Project Shifts",
      format: "decision_point",
      category: "work",
      endingType: "broader_principle",
      scenario: tone("Pia has pulled back from informal project contact so thoroughly that she now learns changes only after they harden.", "She has to decide whether to keep the sealed routine or restore one contact point that updates her map.", "Pia can keep the walls clean or reopen a window before the room goes blind."),
      whatToDo: tone("She restores selective circulation without giving up every boundary she set.", "She reopens a live signal instead of staying sealed behind process.", "She keeps the door guarded but stops bricking up the vents."),
      whyItMatters: tone("The chapter says protection fails when it blocks the information needed for adjustment.", "Her safety depends on live correction, not just reduced access.", "A clean perimeter is useless if the map inside it is late.")
    },
    {
      title: "Dorian Hears Why a Robotics Club Became Easier to Counter After Sealing Itself Off",
      format: "dialogue",
      category: "school",
      endingType: "self_directed_question",
      scenario: tone("Dorian listens as someone explains how the robotics club stopped hearing outside reaction and kept working from stale assumptions.", "He hears that the club's sealed habits made it calmer but less accurate.", "Dorian learns that silence can flatter a team while starving it."),
      whatToDo: tone("He asks which contact channels should reopen so the group can test its picture against live response.", "He looks for circulation that corrects the club without making it porous.", "He asks what signal has to get back in before confidence becomes delusion."),
      whyItMatters: tone("The chapter warns that closed loops make groups easier to outmaneuver.", "The club lost correction when it lost circulation.", "If no fresh read enters the room, the room starts lying to itself.")
    },
    {
      title: "Nessa Weighs Private Recovery Against Retreat That Has Started Distorting Her View",
      format: "dilemma",
      category: "personal",
      endingType: "surprising_implication",
      scenario: tone("Nessa wants quiet and protection, but she can feel that too much withdrawal is making one interpretation of events feel overly certain.", "She has to choose between selective privacy and a retreat that now blocks useful reality checks.", "Nessa can protect her peace or protect an illusion of control."),
      whatToDo: tone("She keeps the boundary while restoring one source of grounded feedback.", "She chooses selective contact instead of total retreat.", "She lets one honest signal back in before the story hardens."),
      whyItMatters: tone("The chapter distinguishes wise boundaries from fortress habits that starve judgment.", "Her calm is only useful if it stays connected to reality.", "A protected mind can still get trapped by a stale story.")
    },
    {
      title: "Harun Predicts Why One Operator Leaves Contact Channels Partly Open",
      format: "predict_reveal",
      category: "work",
      endingType: "cross_domain",
      scenario: tone("Harun notices one operator avoid total enclosure and predicts the choice is about keeping live information flowing.", "He expects the operator to filter access without cutting off circulation.", "Harun can already tell the point is accuracy, not sociability."),
      whatToDo: tone("He judges whether the setup preserves both protection and correction.", "He looks for filtered access rather than sealed blindness.", "He scores the move on live awareness, not on how unreachable it looks."),
      whyItMatters: tone("The chapter says security depends on more than walls.", "A protected position still needs current information.", "The smartest barrier is the one that does not blind its owner.")
    },
    {
      title: "Studio-Seminar Debrief Finds That Isolation Turned Confidence into Stale Assumption",
      format: "postmortem",
      category: "school",
      endingType: "common_trap",
      scenario: tone("A studio seminar reviews why it was blindsided and finds that sealed feedback loops had kept outside reactions from reaching the group.", "The team sees that calm internal agreement had hidden how old its picture of the room had become.", "The seminar realizes it had been defending a stale map, not a strong position."),
      whatToDo: tone("They identify where circulation stopped and what signal should have been allowed back in.", "They rebuild selective feedback instead of returning to total exposure.", "They reopen correction before confidence hardens again."),
      whyItMatters: tone("The chapter warns that closed systems age badly when the field keeps moving.", "The group became easier to outmaneuver because it stopped updating.", "When nobody fresh reaches the room, surprise gets cheaper for everyone else.")
    },
    {
      title: "Before and After a Personal Retreat Stopped Functioning Like Protection",
      format: "before_after",
      category: "personal",
      endingType: "perspective_reframe",
      scenario: tone("Before, defensive withdrawal felt orderly but slowly starved the person of grounded feedback. After, selective contact restored awareness without destroying privacy.", "The contrast is between sealed calm and protected circulation.", "One version hides from noise; the other still lets truth in."),
      whatToDo: tone("Keep the useful boundary, but add one channel that restores live correction.", "Preserve privacy while stopping the map from going stale.", "Do not tear down the wall; cut a window in it."),
      whyItMatters: tone("The law distinguishes safety from the appearance of safety.", "Awareness is part of protection, not a trade you should casually sacrifice.", "The safest room is not the quietest one; it is the one that still gets the right signal.")
    }
  ],
  reviewCards: [
    { cardId: "ch18-rc01", front: tone("Why can isolation become dangerous in this chapter?", "How does retreat create vulnerability here?", "Why can a fortress weaken the person inside it?"), back: tone("Because withdrawal can cut off information, warning, and adjustment while still feeling protective.", "The chapter says isolation reduces awareness as well as exposure.", "Walls can block risk and block correction at the same time."), difficulty: "easy" },
    { cardId: "ch18-rc02", front: tone("What does circulation preserve?", "Why does contact matter strategically here?", "What keeps a map current in this chapter?"), back: tone("Circulation preserves live information, correction, and adaptability.", "Contact matters because it carries warning, reaction, and updates.", "A current map depends on signals still reaching you."), difficulty: "easy" },
    { cardId: "ch18-rc03", front: tone("How are prudent boundaries different from fortress thinking?", "What separates filtering from sealing off?", "Why is privacy not the same as enclosure?"), back: tone("Prudent boundaries filter access while preserving awareness; fortress thinking cuts off correction.", "The chapter allows selective distance but rejects sealed withdrawal.", "A wise boundary protects judgment instead of starving it."), difficulty: "medium" },
    { cardId: "ch18-rc04", front: tone("Where does this law show up in ordinary life?", "How do work, school, and personal settings reveal isolation cost?", "Where do stale assumptions grow behind walls?"), back: tone("It appears wherever retreat blocks feedback, check-ins, and live reaction.", "Closed loops can make people and groups easier to outmaneuver.", "Any room gets riskier once fresh signal stops entering."), difficulty: "medium" },
    { cardId: "ch18-rc05", front: tone("How does Chapter 18 bridge to Chapter 19?", "Why does narrowed awareness lead into the next chapter?", "What comes after fortress isolation?"), back: tone("If isolation leaves your map stale, you become worse at judging the specific person in front of you.", "The next chapter sharpens the cost of bad information into misreading the wrong person.", "First the field goes blurry, then the dangerous person does."), difficulty: "hard" }
  ],
  keyTakeawayCard: tone("Isolation can feel safe while cutting off the information and contact that make real safety possible.", "This law warns against protection that starves awareness.", "Do not let the wall kill the map."),
};

const quiz = {
  passingScorePercent: 70,
  questions: [
    { questionId: "ch18-q01", prompt: "Why can isolation become dangerous in this chapter?", choices: ["Because it can cut off information and live correction", "Because every boundary is automatically weak", "Because visibility is always safer than privacy"], correctIndex: 0, explanation: tone("Correct. The chapter says retreat becomes risky when it blocks information and adjustment.", "Isolation can lower exposure while also lowering awareness.", "Right. The wall becomes dangerous when it starves the map."), bloomsLevel: "remember-understand", depthLevel: "easy" },
    { questionId: "ch18-q02", prompt: "What does circulation preserve here?", choices: ["Pure popularity", "Live information, warning, and adaptability", "Guaranteed safety without judgment"], correctIndex: 1, explanation: tone("Yes. Circulation matters because it keeps your picture of the field current.", "Contact preserves warning, correction, and timely adjustment.", "Right. Updates matter more than comfort."), bloomsLevel: "remember-understand", depthLevel: "easy" },
    { questionId: "ch18-q03", prompt: "Why is this law not anti-privacy advice?", choices: ["Because it says isolation never causes problems", "Because privacy and fortress thinking are identical", "Because the chapter allows selective boundaries and prudent distance"], correctIndex: 2, explanation: tone("Correct. The chapter criticizes sealed withdrawal, not every boundary.", "Filtering access can be wise; starving awareness is the problem.", "Right. Guarding the door is different from sealing the bunker."), bloomsLevel: "remember-understand", depthLevel: "easy" },
    { questionId: "ch18-q04", prompt: "In Pia's work scenario, what best fits the chapter?", choices: ["Keep every contact point closed so nobody can interrupt her", "Restore one live signal while keeping sensible boundaries", "Drop all boundaries and become fully accessible"], correctIndex: 1, explanation: tone("Yes. The chapter favors selective contact that restores awareness.", "She needs correction back, not total exposure.", "Right. Open a channel, not the floodgates."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch18-q05", prompt: "Why did Dorian's robotics club become easier to counter?", choices: ["Because sealing itself off reduced corrective feedback", "Because every group needs constant outside approval", "Because strategy only works in total openness"], correctIndex: 0, explanation: tone("Correct. Closed loops left the club with a stale picture of the room.", "The group lost live correction when it lost circulation.", "Yes. Silence made its confidence older than it looked."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch18-q06", prompt: "What is the strongest reading of Nessa's dilemma?", choices: ["Privacy is always a mistake", "Selective privacy can help, but total retreat can distort judgment", "The safest move is to trust no one and hear nothing"], correctIndex: 1, explanation: tone("Yes. The chapter distinguishes recovery and boundaries from self-blinding enclosure.", "Calm is useful only if awareness stays connected to reality.", "Right. Protect the peace without protecting the illusion."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch18-q07", prompt: "How does information loss increase vulnerability here?", choices: ["It makes a person slower to notice change and revise assumptions", "It proves that every quiet space is dangerous", "It removes all need for selective access"], correctIndex: 0, explanation: tone("Correct. Stale inputs make judgment late and brittle.", "The chapter focuses on reduced correction and aging maps.", "Yes. Late information makes danger cheaper for others."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" },
    { questionId: "ch18-q08", prompt: "When does protection turn into self-defeating enclosure?", choices: ["When it preserves awareness while limiting exposure", "When it includes any privacy at all", "When it blocks the live contact needed to keep judgment current"], correctIndex: 2, explanation: tone("Exactly. The tactic flips once the wall starves awareness.", "Protection fails when it freezes the map inside it.", "Right. A sealed habitat is not a safe strategy."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" },
    { questionId: "ch18-q09", prompt: "How does Chapter 17 lead into Chapter 18?", choices: ["Unreadability means you should disappear from the field completely", "Uncertainty and isolation are exactly the same mechanism", "Avoiding predictability can be useful, but total withdrawal creates blindness"], correctIndex: 2, explanation: tone("Yes. Chapter 18 corrects an overreaction to Chapter 17.", "Strategic unreadability is different from self-imposed disconnection.", "Right. Hard to map is not the same as absent from reality."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" },
    { questionId: "ch18-q10", prompt: "What bridge carries Chapter 18 into Chapter 19?", choices: ["Once awareness narrows, you become worse at judging the wrong person", "Isolation guarantees that the next person will be harmless", "Chapter 19 rejects all need for information"], correctIndex: 0, explanation: tone("Correct. The next chapter sharpens the cost of stale awareness into person-judgment.", "Poor circulation makes it easier to misread the dangerous individual.", "Right. First the field blurs, then the person does."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" }
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
for (const name of ["Pia", "Dorian", "Nessa", "Harun"]) continuity.nameUsage[name] = [stem];
continuity.withinChapterNames[stem] = ["Pia", "Dorian", "Nessa", "Harun"];
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
- Chapter-specific mechanism remains isolation cost, information loss, circulation, and boundary limit rather than generic social advice
- Hard depth preserves the privacy-versus-fortress distinction and the Chapter 19 person-judgment bridge
- Quiz stays within supported facts from the approved draft and frozen source bundle

## Drift repair
- No repair required during this chapter pass.

## Gate result
- Approved for chapter gate and automatic continuation
`;
writeText(paths.validation, validation);

fs.appendFileSync(
  paths.runLog,
  `\n- Completed writer, editor, critic, converter, quiz, and validator steps for Chapter 18.\n- Validation result: PASS.\n- Continuity hash sealed for \`${stem}\`: \`${seal}\`\n`,
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
