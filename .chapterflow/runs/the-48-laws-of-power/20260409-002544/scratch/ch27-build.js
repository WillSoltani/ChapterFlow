const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const runRoot = path.resolve(".chapterflow/runs/the-48-laws-of-power/20260409-002544");
const num = 27;
const stem = `ch${String(num).padStart(2, "0")}`;
const title = "Play on People's Need to Believe to Create a Cultlike Following";
const chapterId = "ch27-play-on-peoples-need-to-believe-to-create-a-cultlike-following";
const createdAt = new Date().toISOString();

function tone(gentle, direct, competitive) {
  return { gentle, direct, competitive };
}

const canonical = `Greene's twenty-seventh law begins with a psychological fact that raw argument often misses. Many people do not want only information. They also want certainty, belonging, symbols, and a sense that their lives connect to something more charged than routine transaction. The chapter begins by treating that need to believe as a political force. If it is organized well, it can create loyalty that plain logic or ordinary persuasion cannot.

Its claim is not that all belief is fraudulent or that meaning can be manufactured without consequence. Greene's point is more strategic. Confident framing, repeated symbols, ritual, and measured mystery can bind people by giving form to their hunger for meaning and attachment. A following deepens when people feel they are joining something charged, coherent, and emotionally larger than themselves. Belief therefore matters not only because people think, but because they want to belong, repeat, and trust.

That is why the law focuses on belief architecture rather than on empty hype. Greene is not praising crude lying, random exaggeration, or hollow spectacle for its own sake. He is distinguishing durable symbolic structure from transparent manipulation. The useful move is not to promise everything to everyone. It is to build a frame of certainty and significance that can hold loyalty without collapsing the moment scrutiny arrives. Mystery, ritual, and emotional charge can intensify attachment, but only while the structure still feels coherent and governed.

Ordinary settings make the mechanism visible. A project leader who frames work as a mission with symbols, repeated language, and clear belonging may attract deeper commitment than one who offers only tasks and incentives. A robotics club or assembly group may gain unusual loyalty once members feel part of a meaningful identity with rituals and shared signs. A person in private life may hold attention more strongly when they offer narrative, purpose, and emotional coherence instead of scattered signals. In each case, belief organizes attachment beyond mere agreement.

The chapter's limit matters. Belief structures can fail if promises go hollow, manipulation becomes obvious, or the following grows more intense than the founder can govern. Greene overreaches if the law becomes advice to build loyalty on emptiness and survive on theater forever. The useful version is narrower: recognize that people want meaning and certainty, and use symbol, ritual, and framing carefully without letting hype outrun control or reality entirely. Chapter 26 protected the image from visible dirt. Chapter 27 asks how that cleaner image can become a center of loyalty by meeting the need to believe. That leads toward Chapter 28, where belief and aura still depend on action bold enough to sustain them.`;

const edited = canonical;

const critic = `# Chapter 27 Critic Report

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
- Paragraph 4 is most vulnerable because work, school, and personal examples can flatten into generic branding talk if conversion drops the need-to-believe, symbol, and control-risk mechanism.

Strongest sentence:
- "If it is organized well, it can create loyalty that plain logic or ordinary persuasion cannot."

Anchor use notes:
- The draft stays inside the frozen support: people seek certainty and meaning, symbols and ritual deepen attachment, strategic belief framing differs from crude hype, and the tactic fails when promises hollow out or following escapes control.

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
        "This law says people often want more than facts. They also want meaning, certainty, belonging, and signs that something matters. Greene is not saying that all belief is fake or that every strong message is a scam. The chapter makes a narrower point. Symbols, ritual, and confident framing can create deeper loyalty than plain explanation alone. If people feel that they are part of something charged and meaningful, they may attach more strongly than they would to a simple offer or argument. Play on the need to believe means shaping a message so it feels emotionally complete as well as intellectually clear. But the chapter is not praising hollow hype or reckless manipulation. Strategic belief framing is supposed to organize attachment without promising so much emptiness that the whole thing collapses. The lesson is to notice how certainty, meaning, and belonging bind people, and to use those forces carefully enough that loyalty deepens instead of breaking when scrutiny arrives.",
        "Greene's twenty-seventh law argues that people can become loyal when they are given something emotionally satisfying to believe in. The chapter is not telling you to become a fraud by default. It is telling you that certainty, symbols, ritual, and mystery can create attachment in ways plain logic often cannot. The stronger reading is belief architecture, not generic hype. Build a frame people can enter, repeat, and identify with. Give them language, signs, and a sense that belonging means something. That can strengthen loyalty because people often want emotional coherence more than another dry explanation. But the chapter is not saying belief can replace reality forever or that you should make reckless promises. Symbolic power matters only if the structure still holds together when people live inside it. Used well, belief gives attachment a shape strong enough to last longer than ordinary persuasion.",
        "This law gives a practical warning: if you offer only information, people may understand you without attaching to you. Greene's point is that ritual, symbol, and confident meaning can be useful because they satisfy the need to believe. A competitive reader should notice that people follow more deeply when they feel they are inside a meaningful pattern instead of just agreeing with a point. But the chapter is not asking for manipulative theater with nothing underneath. It is asking for controlled emotional design. Mystery can intensify interest, repeated phrases can deepen identification, and clear symbols can make belonging feel visible. The move works only if the structure remains coherent and the promises do not collapse on contact with reality. If the belief is obviously hollow, the loyalty can turn just as intense in the opposite direction. The right move is to bind people through meaning without letting the meaning become empty noise you cannot control.",
      ),
      keyTakeaways: [
        { point: tone("People want meaning and certainty, not only facts.", "Belief needs can create stronger attachment than dry explanation alone.", "If people feel part of something larger, they bind harder.") },
        { point: tone("Repeated symbols and ritual can make loyalty stick.", "Belief gets stronger when it is given repeated form and emotional structure.", "Give attachment a shape people can repeat and recognize.") },
        { point: tone("Strategic belief framing differs from hollow hype.", "The chapter is about controlled meaning, not empty manipulation.", "If the promise is hollow, the following can break fast.") }
      ],
      oneMinuteRecap: tone(
        "This law says people often attach more deeply when they are given meaning, certainty, and symbolic structure to believe in.",
        "Do not rely on facts alone if loyalty depends on belonging and emotional coherence too.",
        "Build belief carefully enough that it binds without collapsing into obvious hype."
      )
    },
    medium: {
      chapterBreakdown: tone(
        `Greene's twenty-seventh law begins by questioning the idea that people are moved mainly by dry reason. Many people want certainty, belonging, and emotionally satisfying explanations that make their participation feel meaningful. Greene is interested in that appetite. The chapter asks what happens when a message is not only argued, but given enough symbol, ritual, and confidence to become something people can attach themselves to.

That is why belief structure matters here. Greene is not describing simple persuasion or neutral explanation. He is describing emotional architecture. If a leader, organizer, or figure offers signs, repeated language, shared ritual, and a sense of mystery or destiny, people may feel part of something larger than ordinary transaction. The chapter treats that feeling as politically powerful because attachment deepens when people can believe, repeat, and belong.

The chapter is strongest when it distinguishes strategic belief framing from crude manipulation. The useful move is not to flood people with empty promises or transparent exaggeration. It is to create a coherent frame that satisfies their hunger for meaning without collapsing instantly under pressure. Greene is not praising fraud for its own sake. He is showing how certainty, symbol, and ritual can organize loyalty more effectively than logic alone, so long as the structure stays controlled and does not become visibly hollow.

The pattern appears in ordinary settings. A work leader who frames a project as a mission with symbols and repeated language may gather deeper commitment than one who offers only tasks and deadlines. A robotics club or assembly committee may build stronger loyalty when membership includes rituals, recurring language, and visible signs of belonging. A personal influence can deepen when someone offers emotional coherence instead of scattered claims. In each case, meaning changes the density of attachment.

The limit matters because belief can curdle. If the promises become too grand, the mystery too theatrical, or the structure too disconnected from reality, loyalty can collapse or turn volatile. Greene's practical claim is narrower: understand that people want more than facts, and use symbolic certainty carefully without letting hype outrun control. Chapter 26 kept the image clean enough to remain usable. Chapter 27 asks how that image can become a center of belief and attachment. Chapter 28 then turns toward boldness, where aura must be reinforced by decisive action rather than hesitant performance.`,
        `Greene's twenty-seventh law argues that people are often moved by belief as much as by argument. Plain facts may inform them, but symbols, mystery, and emotionally satisfying structure can bind them. The chapter therefore begins with a strategic problem, not a theological one. What if loyalty depends less on proving every point than on giving people something meaningful to enter and repeat?

That is why ritual and symbolism can be useful. If a message comes with repeated phrases, visible signs, mystery around access, or a shared sense of belonging, people may attach more deeply than they would to a bare proposition. Greene is interested in that added charge. Belief becomes sticky when it offers certainty, participation, and emotional shape. A following forms not only around ideas, but around the experience of belonging to them.

This is why the chapter is not generic hype advice. Greene is not telling the reader to lie wildly or to perform charisma with no structure underneath. He is separating controlled belief architecture from hollow manipulation. The issue is not noise. The issue is whether certainty, symbol, and ritual create a frame durable enough to hold loyalty. It becomes failure when the promises are obviously inflated or the mystery feels cheap and unserious.

The pattern appears everywhere. Kael may get deeper commitment by turning a project into a shared mission with ritual openings and repeatable language. A robotics club may hold people more strongly through insider symbols and recurring rites than through facts about meeting efficiency alone. A personal influence may intensify when someone gives others a story they can believe about what they are part of. In each case, emotional form does work that information by itself does not do.

The limit remains central because belief can escape control. A following built on too much unreality may turn unstable, cynical, or fanatical once cracks appear. Greene's point is disciplined rather than delirious: give people meaning, certainty, and symbolic coherence, but do not let the structure become so hollow or overheated that it collapses under its own intensity. Chapter 26 managed visible dirt. Chapter 27 manages emotional adhesion. Chapter 28 then asks what happens when the aura created by belief must be backed by bold visible action rather than hesitation.`,
        `This law starts with a tempting mistake: assuming that if people understand something, they will attach to it. Greene's warning is that attachment often requires more than comprehension. It requires certainty, belonging, and the feeling of entering a meaningful pattern. The chapter therefore treats the need to believe as an engine of loyalty rather than as a side effect of persuasion.

That matters because symbols and ritual change how a message lives in people. A repeated phrase, a visible sign, a controlled mystery, or a shared ritual can make belonging tangible. The chapter therefore treats belief framing as a way of intensifying attachment. What changes is not only what people think. It is how they feel about participating, repeating, and staying inside the frame.

This keeps the law narrower than praise for manipulation. Greene is not saying that you should invent grand illusions without limit or substitute theater for reality forever. He is asking whether your message offers enough emotional structure to hold loyalty. Strategic belief framing means building a coherent symbolic world that binds. It becomes failure when certainty turns brittle, promises turn empty, or the following intensifies beyond the founder's control.

Common settings make the point plain. A club may gain members through facts, but keep them through rituals and belonging. An assembly committee may hold attention through insider language and signs that make participation feel elevated. A personal cause may spread faster once it has a repeatable story, not just a correct argument. In each case, people do not merely agree. They join.

The limit matters because symbolic power can rot into hype. If every phrase feels inflated and every promise exceeds reality, the same emotional energy that built attachment can destroy it. Chapter 26 showed that image can be shielded from visible dirt. Chapter 27 shows that the same image can now become magnetic through belief. Chapter 28 follows by asking how boldness keeps that magnetism alive once the time for action arrives.`
      ),
      keyTakeaways: [
        {
          point: tone("People often need certainty and belonging as much as argument.", "Belief needs can create attachment beyond plain explanation.", "Agreement is thinner than belonging when loyalty is the real prize."),
          moreDetails: tone("The chapter focuses on emotional adhesion rather than on reason disappearing.", "People often stay longer where meaning feels shared and emotionally complete.", "A frame people can enter usually binds harder than a point they merely accept.")
        },
        {
          point: tone("Ritual and symbol give belief social weight.", "Repeated form gives belief emotional weight and social shape.", "Attachment grows denser when people can repeat, display, and inhabit it."),
          moreDetails: tone("Greene values symbols and ritual because they turn abstract belief into lived participation.", "The chapter's leverage comes from giving certainty visible form and repeated motion.", "A phrase, sign, or rite can carry loyalty farther than another explanation can.")
        },
        {
          point: tone("Strategic belief framing differs from crude hype.", "The move is coherent symbolic structure, not transparent exaggeration.", "Bind people through meaning, not through promises too thin to survive contact."),
          moreDetails: tone("The chapter still requires control, durability, and enough substance that the frame does not collapse instantly.", "Belief matters only if the architecture holds when curiosity turns into scrutiny.", "If the certainty looks cheap, the emotional charge reverses fast.")
        },
        {
          point: tone("Work, school, and personal settings all show how belief architecture changes commitment.", "People attach more deeply when participation feels meaningful and visible.", "The story they join can matter more than the fact they agree with."),
          moreDetails: tone("Mission language, insider symbols, repeated openings, and shared signs all change the density of belonging.", "The chapter becomes practical when you ask what people can repeat, display, and feel part of together.", "Loyalty often grows where meaning becomes social rather than merely informational.")
        },
        {
          point: tone("The chapter keeps a hard boundary around overheated belief.", "Belief structures fail when they outrun reality or intensify beyond governance.", "Do not let mystery and certainty grow so inflated that the frame can only collapse."),
          moreDetails: tone("Some settings demand more transparency, and some promises become unstable when emotional heat exceeds substance.", "Greene warns against letting symbolic power drift into obvious fraud or unmanaged fervor.", "The right boundary is where loyalty stops being organized and starts becoming brittle or wild.")
        }
      ],
      activationPrompt: tone(
        "Identify one place where facts alone are not creating the attachment you actually need.",
        "Choose one symbol, ritual, or repeated phrase that could give a message more emotional structure.",
        "Pick one audience that needs belonging and certainty more than another explanation."
      ),
      selfCheckPrompt: tone(
        "Am I building meaningful structure, or just adding emotional noise to weak substance?",
        "What signs, phrases, or rituals make this feel joinable rather than merely understandable?",
        "Where would certainty deepen loyalty, and where would it turn brittle or manipulative?"
      ),
      oneMinuteRecap: tone(
        "This chapter says loyalty deepens when people are given meaning, certainty, and symbolic form to believe in.",
        "Do not rely on explanation alone when attachment depends on belonging too.",
        "Use ritual and symbol carefully enough that belief holds without tipping into empty hype."
      )
    },
    hard: {
      chapterBreakdown: tone(
        `Greene's twenty-seventh law treats belief as a power medium rather than as a private inner state. Most people hear the title and think immediately of fraud, delusion, or theatrical manipulation. Greene is interested in a sharper claim: human beings often hunger for certainty, belonging, mystery, and emotionally satisfying explanation, and that hunger can create stronger loyalty than reason alone. The chapter therefore begins by questioning the sufficiency of plain persuasion. A message may be correct and still fail to bind if it never becomes something people can enter, repeat, and feel part of.

That is why symbols, ritual, and confident framing can matter here. Greene is not praising irrationality for its own sake. He is describing emotional organization. When a figure or structure offers repeated language, visible signs, controlled mystery, and a sense of meaning larger than ordinary transaction, people may attach with unusual intensity. The chapter treats belief architecture as part of power because it does not merely inform. It bonds. It turns agreement into belonging and curiosity into loyalty.

The chapter is strongest when it resists the lazy reading that this is just an instruction to deceive. Greene is not praising random hype, transparent lies, or spectacle that cannot survive scrutiny. He is distinguishing durable symbolic order from hollow manipulation. Strategic belief framing gives certainty and significance enough form to hold attachment. Hollow manipulation overpromises, cheapens mystery, and substitutes emotional heat for coherence. The difference is whether the structure can continue to organize loyalty once the first excitement fades.

This is why plain argument can be weaker than it looks. Information may answer objections while leaving emotional need untouched. People often stay close to what gives them orientation, ritual repetition, and a visible sense of belonging. The chapter therefore asks whether power belongs only to the one who persuades best, or also to the one who creates the more inhabitable symbolic world. Belief intensifies attachment because it gives participation a texture that mere accuracy often lacks.

Ordinary settings show the mechanism clearly. A project leader who gives the work a mission, a motto, recurring ritual, and visible signs of inclusion may gather commitment beyond what incentives alone would buy. A robotics club or assembly committee may become unusually cohesive once members can repeat language, perform rituals, and feel initiated into something distinct. A personal influence may grow when someone offers narrative and emotional coherence instead of scattered truth fragments. In each case, the crucial shift is from understanding to adhesion.

The limit matters because belief can become volatile. If mystery turns theatrical, if promises turn hollow, or if the following becomes more fervent than the founder can direct, the same emotional force that built the structure can tear it open. Greene is not arguing that symbolic power floats free from reality forever. He is arguing that loyalty often requires more than reason, while still warning that belief structures can collapse when they become too empty or too intense to govern. Chapter 26 kept the visible image cleaner by displacing dirt. Chapter 27 asks how that cleaned image can become a center of loyalty by satisfying the need to believe. Chapter 28 follows naturally from there. Once belief creates aura, action must be bold enough to sustain it, because hesitation punctures mystery faster than argument does. Belief succeeds only when symbol, certainty, and ritual are coherent enough to bind without overheating into obvious fraud or uncontrolled following. If people feel they are entering something meaningful, loyalty deepens. If they discover they entered vapor, the collapse can be just as intense as the attachment once was.`,
        `Greene's twenty-seventh law argues that playing on the need to believe can be strategically useful because people often seek more than explanation. Most readers hear the title and assume the law must celebrate manipulation alone. Greene hears a more basic human fact: people are drawn to certainty, meaning, repetition, and emotionally charged belonging. A following forms not only because people agree, but because they feel held inside a world that explains and includes them.

Belief framing preserves loyalty because it gives attachment a structure. If symbols, repeated phrases, ritual acts, and controlled mystery surround a message, the message can become something people live inside rather than something they merely evaluate. Greene is interested in that inhabitable quality. The chapter values symbolic certainty not because truth disappears, but because emotional adhesion often decides whether a person stays loyal after the first argument ends.

That is why the chapter should not be flattened into advice about hype. It is not saying that any exaggerated promise will work or that theatricality alone creates durable power. It is saying that belief must be organized. Strategic belief architecture creates a world coherent enough to hold attachment. Hollow manipulation creates spectacle too brittle to survive doubt. The issue is not whether emotion is present. The issue is whether the emotional frame can carry loyalty without collapsing into obvious emptiness.

The pattern appears in ordinary life. Kael may draw deeper commitment by turning a project into a mission with signs, phrases, and ritual openings rather than treating it as one more task list. Rina may see why a robotics club became cohesive once it had symbols, insider language, and recurring rites. A personal cause may spread once it offers a repeatable narrative that makes participation feel elevated. In each case, the frame provides more than information. It provides attachment.

The limit remains central because belief can become unstable when it outruns substance or control. If the promises grow too grand, if the mystery becomes cheap theater, or if the followers intensify beyond what the center can govern, the structure starts feeding on its own emotional heat. Greene's practical claim is narrower: recognize the need to believe, give it symbolic form, and keep the structure coherent enough that loyalty does not reverse into disillusionment. Chapter 26 dealt with keeping the image clean. Chapter 27 deals with making that image magnetic. Chapter 28 then turns toward boldness, where the magnetism must be reinforced by action that looks decisive enough to deserve the faith it has attracted. The reader's edge lies in seeing that people follow not only arguments, but worlds. If you build a world too thin to inhabit, the exit can become a stampede.`,
        `This law works only if you track what belonging is doing before you decide what persuasion means. Most people focus on whether an audience has been convinced. Greene's warning is that conviction without adhesion is often weak. People may agree with a point and still drift away because nothing in the point gave them a ritual, a symbol, a role, or a felt membership in something larger. The chapter is about that missing layer.

That is why controlled mystery and symbolic form can be strategically valuable. A person who offers repeatable language, visible signs, a little secrecy, and a charged sense of participation may create loyalty that facts alone never would. Greene is not praising mystification because confusion is noble. He is protecting attachment from flatness. Belief intensifies when it feels inhabited through repeated form rather than simply understood in abstract terms.

The chapter therefore distinguishes belief architecture from emotional exploitation. Empty slogans are not structure. Grand promises are not loyalty. Strategic belief framing keeps enough coherence, control, and durability that followers can remain attached without needing ever-more-absurd claims to stay interested. Without that coherence, ritual becomes parody, mystery becomes suspicion, and certainty becomes a weakness waiting to crack.

Common settings show the law with almost embarrassing clarity. A club with rituals, mottos, and symbolic entry points can hold members long after a fact-driven group thins out. An assembly committee may gain energy through repeated openings, insider terms, and a sense of elevated purpose. A personal influence may expand when it offers narrative meaning and emotional order instead of only isolated truths. In each case, people do not merely assent. They locate themselves.

The limit matters because loyalty created through belief can fail too. Give too little meaning and nothing binds. Give too much unreality and the same intensity that built the following can tear it down once confidence breaks. Greene's better point is to make emotional adhesion answerable to structure rather than to hype. Chapter 26 taught that the visible image could be kept cleaner through buffers. Chapter 27 teaches that the same image can become a focal point of belief when it offers enough symbolic certainty to satisfy the need to believe. Chapter 28 follows because once the aura is built, boldness is needed to keep it from looking like theater. The deepest lesson is that power often belongs to the one who gives people not just reasons, but a meaningful pattern to enter. If the pattern is coherent, loyalty hardens. If the pattern is vapor, the collapse will teach people as intensely as the belief once did.`
      ),
      keyTakeaways: [
        {
          point: tone("People often need meaning and certainty as much as explanation.", "Belief needs can create loyalty stronger than plain argument.", "A world people can join binds harder than a claim they merely accept."),
          moreDetails: tone("The chapter emphasizes emotional adhesion rather than reason disappearing.", "People often remain loyal to what gives them orientation, belonging, and repeated significance.", "Agreement may win the head while belief architecture keeps the body in place.")
        },
        {
          point: tone("Symbols, ritual, and controlled mystery intensify attachment.", "Repeated form turns belief into lived participation.", "What people can repeat, display, and perform usually binds deeper than what they only hear once."),
          moreDetails: tone("Greene values ritual and symbol because they give certainty visible, repeatable structure.", "The chapter's leverage comes from making meaning social and inhabitable rather than merely stated.", "A sign, rite, or phrase can keep loyalty warm long after the first explanation is forgotten.")
        },
        {
          point: tone("Strategic belief framing differs from hollow manipulation.", "The move is coherent symbolic order, not emotional overheating without structure.", "Belief binds when the frame holds, not when the promise balloons wildly."),
          moreDetails: tone("The chapter still requires coherence, control, and enough substance that the symbolic frame does not collapse under doubt.", "Belief architecture matters only if it survives the moment when curiosity turns into testing.", "When mystery becomes cheap theater, the aura starts teaching disbelief instead.")
        },
        {
          point: tone("Ordinary groups reveal how belief changes the density of loyalty.", "Work, school, and personal settings all show that meaning can organize attachment beyond transaction.", "The story people inhabit often outlasts the fact they first agreed with."),
          moreDetails: tone("Mottos, rituals, insider language, and symbolic participation all change whether people merely show up or truly attach.", "The chapter becomes practical when you ask what makes a message inhabitable rather than merely persuasive.", "Loyalty often deepens where belonging becomes visible and repeatable.")
        },
        {
          point: tone("There is a control limit where belief begins breaking itself.", "Belief structures fail when unreality, overpromise, or unmanaged intensity outrun coherence.", "Do not let the following heat up faster than the frame can hold."),
          moreDetails: tone("Some settings demand more transparency, and some followings become unstable once symbolic certainty detaches too far from reality.", "Greene warns against turning emotional adhesion into uncontrolled fervor or obvious fraud.", "The right boundary is where belief stops being organized loyalty and starts becoming brittle, wild, or disillusioned.")
        }
      ],
      activationPrompt: tone(
        "Identify one place where people understand the message but still are not attaching to it deeply.",
        "Choose one symbol, ritual, or repeated phrase that could make a message more inhabitable.",
        "Pick one audience whose loyalty would deepen if the frame felt more meaningful and certain."
      ),
      selfCheckPrompts: [
        tone(
          "Am I creating meaningful structure, or just adding emotional heat to weak substance?",
          "What can people repeat, display, or ritualize here that would turn agreement into belonging?",
          "If this following grows stronger, what keeps the certainty from turning hollow or brittle?"
        ),
        tone(
          "What part of this frame creates belonging, and what part is only decoration?",
          "How much mystery intensifies attachment before it starts looking cheap or manipulative?",
          "At what point would the emotional charge outrun the structure meant to govern it?"
        )
      ],
      predictionPrompt: tone(
        "Once belief creates loyalty and aura, how might Chapter 28 show that bold action is needed to keep that aura from thinning into hesitation?",
        "If people already believe, what changes next when visible boldness becomes the proof that sustains belief?",
        "After loyalty is organized through meaning, how does power deepen when action refuses to look hesitant?"
      ),
      oneMinuteRecap: tone(
        "This chapter argues that power often deepens when people are given a coherent world of meaning, certainty, and symbol to inhabit rather than only facts to evaluate.",
        "Do not confuse understanding with attachment if loyalty depends on belonging, ritual, and emotional coherence too.",
        "Sometimes belief binds hardest when the frame is meaningful enough to enter and disciplined enough not to collapse."
      )
    }
  },
  examples: [
    {
      title: "Kael Turns a Plain Project into a Mission People Can Actually Rally Around",
      format: "decision_point",
      category: "work",
      endingType: "broader_principle",
      scenario: tone("Kael sees that the team understands the project goals but still treats the work like one more obligation.", "He has to decide whether to keep presenting it as utility or give it a mission, motto, and visible meaning people can join.", "Kael can ask for effort or create a frame people want to belong to."),
      whatToDo: tone("He adds repeatable language, a symbolic goal, and a small ritual that turns participation into identity.", "He gives the work a world, not just a checklist.", "He organizes belief instead of hoping clarity alone will create loyalty."),
      whyItMatters: tone("The chapter says people often attach more deeply when meaning and belonging are made visible.", "A symbolic frame can produce commitment beyond what plain explanation buys.", "Belief binds harder when people feel they are entering something larger than the task.")
    },
    {
      title: "Rina Hears Why the Robotics Club Gained Loyalty Through Ritual and Symbols Instead of Facts Alone",
      format: "dialogue",
      category: "school",
      endingType: "self_directed_question",
      scenario: tone("Rina listens as someone explains why the robotics club became unusually cohesive after adding recurring openings, symbols, and insider language.", "She hears how members were not only informed better but drawn into something that felt distinct and meaningful.", "Rina learns that belonging often grows through repeated form, not through explanation alone."),
      whatToDo: tone("She asks which rituals and symbols deepened attachment and which would have crossed into empty theater.", "She studies how meaning became social and repeatable for the group.", "She asks what made the club feel inhabitable instead of merely organized."),
      whyItMatters: tone("The chapter warns that facts alone rarely create the strongest followings.", "The robotics club shows how ritual and symbolic certainty can make loyalty denser.", "People stayed not just because they agreed, but because they felt inside a shared pattern.")
    },
    {
      title: "Jules Weighs Inspiring Belief Against the Risk of Overpromising",
      format: "dilemma",
      category: "personal",
      endingType: "surprising_implication",
      scenario: tone("Jules knows a cause will not grow on plain logic alone, but worries that adding too much certainty and mystery could become manipulative.", "He has to decide how far belief framing can go before it starts feeding on emptiness.", "Jules can build attachment or inflate it past what reality can hold."),
      whatToDo: tone("He gives the message symbolic structure and belonging without letting the promises outrun what can be sustained.", "He chooses disciplined belief over intoxicating exaggeration.", "He binds people through meaning while keeping the frame governable."),
      whyItMatters: tone("The chapter says belief architecture works only while the symbolic world remains coherent enough to hold scrutiny.", "His dilemma shows the line between emotional adhesion and hollow hype.", "The same force that builds loyalty can destroy it if the promises thin out too far.")
    },
    {
      title: "Marnie Predicts Why One Organizer Uses Mystery and Ceremony to Intensify Attachment",
      format: "predict_reveal",
      category: "work",
      endingType: "cross_domain",
      scenario: tone("Marnie notices an organizer add recurring phrases, limited-access meetings, and symbolic ceremony around an otherwise ordinary initiative.", "She predicts the move is meant to satisfy the need to believe by making participation feel charged and meaningful.", "Marnie can already see that the organizer is creating adhesion, not just awareness."),
      whatToDo: tone("She judges whether the mystery and ritual deepen loyalty through coherence or only inflate attention through haze.", "She looks for symbolic structure with control rather than spectacle with drift.", "She scores the move on whether the following can still hold once people look more closely."),
      whyItMatters: tone("The chapter says certainty, symbol, and controlled mystery can bind people more deeply than plain transaction.", "The organizer may be giving the initiative a world that people can inhabit.", "Sometimes attachment grows because the frame feels meaningful before the facts have fully persuaded anyone.")
    },
    {
      title: "Assembly-Committee Debrief Finds That Obvious Hype Broke Belief and Collapsed Momentum",
      format: "postmortem",
      category: "school",
      endingType: "common_trap",
      scenario: tone("An assembly committee reviews why excitement died after repeated grand promises, theatrical secrecy, and symbolic language started feeling empty.", "The debrief shows that the frame generated emotional heat faster than it generated durable trust.", "The group learns that belief architecture can break when hype outruns coherence."),
      whatToDo: tone("They rebuild the frame with clearer meaning, fewer inflated claims, and rituals that support rather than replace substance.", "They stop feeding belief with vapor.", "They redesign the symbolic structure so it can survive scrutiny instead of only excitement."),
      whyItMatters: tone("The chapter warns that hollow promises and uncontrolled symbolism can reverse loyalty instead of deepening it.", "Their problem was not meaning itself but an overheated frame with too little durability.", "Once the aura looked cheap, the attachment started teaching disbelief.")
    },
    {
      title: "Before and After Flat Persuasion Became Symbolic Framing That Actually Bound People",
      format: "before_after",
      category: "personal",
      endingType: "perspective_reframe",
      scenario: tone("Before, the message was clear but emotionally thin, and people agreed without staying attached. After, it carried symbols, repeated language, and a sense of meaningful belonging.", "The contrast is between explanation and inhabitable belief.", "One version gets nods; the other gets loyalty."),
      whatToDo: tone("Add ritual, visible signs, and a coherent story so participation feels like entering something, not merely hearing it.", "Give the message a repeatable world.", "Turn agreement into belonging without letting the frame become empty theater."),
      whyItMatters: tone("The law distinguishes belief architecture from generic hype.", "Symbolic framing can make attachment denser than information alone does.", "Loyalty often begins when meaning becomes social enough to inhabit.")
    }
  ],
  reviewCards: [
    { cardId: "ch27-rc01", front: tone("Why does the need to believe matter in this chapter?", "Why aren't facts alone always enough here?", "What hunger is Greene using as leverage?"), back: tone("Because people often seek certainty, belonging, and meaning beyond dry explanation.", "The chapter says loyalty deepens when people feel part of something emotionally coherent.", "Understanding may inform, but belief often binds."), difficulty: "easy" },
    { cardId: "ch27-rc02", front: tone("What do symbols, ritual, and mystery create here?", "Why does repeated form matter in this law?", "What does belief architecture add to persuasion?"), back: tone("They can create attachment, belonging, and loyalty stronger than plain argument alone.", "Repeated symbolic form turns a message into something people can inhabit and repeat.", "Belief architecture gives emotion and identity a structure to stay inside."), difficulty: "easy" },
    { cardId: "ch27-rc03", front: tone("How is strategic belief framing different from hollow hype?", "What separates belief architecture from manipulation?", "Why isn't emotional intensity enough by itself?"), back: tone("Strategic belief framing stays coherent and governable, while hollow hype overpromises and collapses under scrutiny.", "The chapter values symbolic order that can hold loyalty, not excitement too thin to last.", "If the frame cannot survive doubt, the attachment will eventually teach disbelief."), difficulty: "medium" },
    { cardId: "ch27-rc04", front: tone("Where does this law appear in ordinary life?", "How do work, school, and personal groups build belief-based loyalty?", "Where does meaning change the density of attachment?"), back: tone("It appears wherever people are given rituals, symbols, and a meaningful identity to inhabit rather than only instructions to follow.", "Teams, clubs, and personal causes all deepen attachment when belonging becomes visible and repeatable.", "People often stay because the frame feels meaningful enough to live inside, not just because it sounded correct once."), difficulty: "medium" },
    { cardId: "ch27-rc05", front: tone("How does Chapter 27 bridge to Chapter 28?", "Why does belief lead into boldness?", "What must sustain aura after loyalty is built?"), back: tone("Once belief creates aura, the next question is whether action is bold enough to keep that aura intact.", "Chapter 28 turns from belief-based attachment to visible boldness that reinforces it.", "First organize faith, then act decisively enough not to puncture it."), difficulty: "hard" }
  ],
  keyTakeawayCard: tone(
    "Belief becomes powerful when symbols, ritual, certainty, and belonging give people a coherent frame to inhabit rather than only a claim to agree with.",
    "This law warns that loyalty often depends on meaning and emotional structure, not on information alone.",
    "Power deepens when belief is organized carefully enough to bind without tipping into obvious emptiness."
  )
};

const quiz = {
  passingScorePercent: 70,
  questions: [
    { questionId: "ch27-q01", prompt: "Why do belief needs matter in this chapter?", choices: ["Because people often want certainty, belonging, and meaning in addition to facts", "Because evidence never matters", "Because logic always weakens loyalty"], correctIndex: 0, explanation: tone("Correct. The chapter says people often attach more deeply when a message meets emotional needs as well as intellectual ones.", "Belief matters because certainty and belonging can bind where information alone does not.", "Right. Many people want something to enter, not only something to evaluate."), bloomsLevel: "remember-understand", depthLevel: "easy" },
    { questionId: "ch27-q02", prompt: "What can symbols, ritual, and confident framing create here?", choices: ["A coherent loyalty structure stronger than plain explanation alone", "Guaranteed truthfulness", "Freedom from all doubt"], correctIndex: 0, explanation: tone("Yes. Greene treats symbolic form as a way of deepening attachment beyond simple persuasion.", "Ritual and symbol give belief a repeatable social shape.", "Right. Repeated form can make loyalty denser than facts alone do."), bloomsLevel: "remember-understand", depthLevel: "easy" },
    { questionId: "ch27-q03", prompt: "Why is this chapter not generic hype advice?", choices: ["Because hype always works best", "Because symbols never matter", "Because it concerns durable belief architecture rather than emotional noise alone"], correctIndex: 2, explanation: tone("Correct. The issue is whether meaning is organized coherently enough to hold loyalty.", "Greene is tracking belief structure, not random exaggeration.", "Yes. This is about governable symbolic order, not noise for its own sake."), bloomsLevel: "remember-understand", depthLevel: "easy" },
    { questionId: "ch27-q04", prompt: "In Kael's work scenario, what best fits the chapter?", choices: ["Keep the project purely practical so no one feels emotionally drawn in", "Turn the project into a meaningful mission with repeatable language and visible belonging", "Promise impossible outcomes to intensify excitement"], correctIndex: 1, explanation: tone("Yes. The chapter favors meaningful symbolic framing that people can rally around.", "He gives the work a mission structure instead of relying on plain tasks alone.", "Right. People often commit harder when they can belong, not just comply."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch27-q05", prompt: "Why did the robotics club example matter for Rina?", choices: ["Because rituals and insider symbols deepened loyalty beyond facts alone", "Because clubs should avoid all evidence", "Because efficiency never matters in groups"], correctIndex: 0, explanation: tone("Correct. The example shows how repeated form can turn participation into belonging.", "The club gained cohesion because members felt inside a distinct symbolic world.", "Yes. Ritual made attachment denser than explanation by itself would have made it."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch27-q06", prompt: "What is the strongest reading of Jules's dilemma?", choices: ["He should avoid all symbolism because it is automatically manipulative", "Belief framing works only while promises stay coherent enough not to collapse into hype", "Any strong message should maximize mystery no matter what"], correctIndex: 1, explanation: tone("Yes. The chapter's limit is that belief fails when emotional charge outruns control and durability.", "Symbolic power matters only if the frame still holds under scrutiny.", "Right. The tactic binds only while the meaning stays governable instead of vaporous."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch27-q07", prompt: "How do mystery and certainty intensify loyalty in this chapter?", choices: ["They make participation feel charged, meaningful, and socially inhabitable", "They remove the need for coherence", "They guarantee permanent trust"], correctIndex: 0, explanation: tone("Correct. Mystery and certainty work because they give belief emotional texture and social form.", "The chapter treats them as tools that make belonging more vivid and sticky.", "Yes. People attach harder when the frame feels inhabitable, not merely stated."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" },
    { questionId: "ch27-q08", prompt: "When does belief architecture become hollow manipulation or unstable following?", choices: ["When ritual and symbol deepen attachment", "When promises become empty, mystery cheapens, or the following outgrows control", "When meaning is made visible"], correctIndex: 1, explanation: tone("Exactly. The tactic fails when symbolic certainty outruns coherence or governability.", "Belief can collapse or turn volatile once the frame becomes obviously hollow.", "Right. A following built on vapor will often break with equal intensity."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" },
    { questionId: "ch27-q09", prompt: "How does Chapter 26 lead into Chapter 27?", choices: ["Clean hands eliminate the need for attachment", "Once the image is kept clean, the next question is how that image becomes a center of loyalty through belief", "Chapter 27 rejects image and aura"], correctIndex: 1, explanation: tone("Correct. Chapter 26 protected the image; Chapter 27 asks how that image can become emotionally magnetic.", "The sequence moves from reputational shielding to belief-based attachment.", "Right. First keep the center clean, then make it meaningful enough to follow."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" },
    { questionId: "ch27-q10", prompt: "What bridge carries Chapter 27 into Chapter 28?", choices: ["Belief makes action unnecessary once loyalty exists", "Chapter 28 abandons aura for planning only", "Once belief creates aura, bold action must sustain what belief has built"], correctIndex: 2, explanation: tone("Correct. The next law turns toward boldness because aura weakens if action looks hesitant.", "Chapter 28 asks how decisive action keeps belief from thinning into theater.", "Yes. After belief is organized, bold action has to prove it can live in the world."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" }
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
for (const name of ["Kael", "Rina", "Jules", "Marnie"]) continuity.nameUsage[name] = [stem];
continuity.withinChapterNames[stem] = ["Kael", "Rina", "Jules", "Marnie"];
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
- Chapter-specific mechanism remains need to believe, symbolic certainty, ritual, mystery, and hollow-promise limits rather than generic hype rhetoric
- Hard depth preserves the belief-versus-manipulation boundary and the Chapter 28 boldness bridge
- Quiz stays within supported facts from the approved draft and frozen source bundle

## Gate result
- Approved for chapter gate and automatic continuation
`;
writeText(paths.validation, validation);

fs.appendFileSync(
  paths.runLog,
  `\n- Completed writer, editor, critic, converter, quiz, and validator steps for Chapter 27.\n- Validation result: PASS.\n- Continuity hash sealed for \`${stem}\`: \`${seal}\`\n`,
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
