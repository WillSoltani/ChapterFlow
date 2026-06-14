import { mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";

const outDir = resolve("state", "chapters");
mkdirSync(outDir, { recursive: true });

const seqs = [
  [0, 1, 2, 0, 2, 1, 1, 2, 0],
  [1, 2, 0, 2, 1, 0, 2, 0, 1],
  [2, 0, 1, 1, 0, 2, 0, 1, 2],
  [0, 2, 1, 2, 0, 1, 1, 0, 2],
  [1, 0, 2, 0, 1, 2, 2, 1, 0],
  [2, 1, 0, 1, 2, 0, 0, 2, 1],
  [0, 1, 2, 2, 0, 1, 2, 1, 0],
  [1, 2, 0, 0, 1, 2, 1, 0, 2],
  [2, 0, 1, 1, 2, 0, 0, 1, 2],
];

const chapters = [
  {
    n: 1,
    title: "The Uncomfortable Truth",
    concept: "The Uncomfortable Truth",
    hook: "Pilecki walks into Auschwitz, and hope stops sounding soft.",
    counter: "The bleak fact is not that life is hard. It is that most lives vanish, so hope has to invent a reason to move anyway.",
    takeaway: "Hope is not cheerfulness. It is a story that gives pain a direction, and that story can steady a person or trap them inside a false rescue plan.",
    now: "Name one fear you keep covering with busy work, then write the value that would still be worth acting for if no praise came.",
    anchors: ["Witold Pilecki", "Auschwitz", "Steven Pinker", "Hans Rosling"],
    fast: [
      "Witold Pilecki chose a place no sane person would enter. Auschwitz was built to break names, bodies, and memory. He went in anyway, made contact with prisoners, built resistance, and sent reports out through danger.",
      "That is the hard face of hope. It does not need comfort first. It needs a value, a target, and people who can believe together. Yet the same force can lie. Hope says the present is not enough, so it can turn any life into a waiting room for rescue.",
    ],
    deep: [
      "Hope works like a frame around pain. The facts do not become gentle, but they receive a direction. Pilecki could not make Auschwitz safe. He could make his suffering serve testimony, resistance, and human dignity. The story did not remove horror. It made action possible inside it.",
      "The modern puzzle is stranger because many lives are safer than before. Steven Pinker and Hans Rosling point to longer lives, lower child death, better literacy, and less extreme poverty. Those gains matter. They also do not settle the ache that asks what any of it means.",
      "A person can live in a rich city, refresh bright charts about progress, and still feel that everything is coming apart. Fear changes targets. If hunger recedes, loneliness can grow large. If violence falls, status shame can become the wound. Hope keeps searching for the missing thing.",
      "The useful rule is to respect hope without worshiping it. It helps people move through darkness, but it always builds a story where now is deficient and later must save us. The question is not whether to hope. The question is what hope is training us to need.",
    ],
    full: [
      "The limit of progress data is that it answers a different question than despair is asking. A chart can show fewer people dying in childhood. It cannot tell a lonely person why getting out of bed matters. Both claims can be true at once, and the clash is the point.",
      "Pilecki makes that clash visible in the harshest possible form. He did not enter Auschwitz because a pleasant future was likely. He entered because a value became stronger than fear. Resistance, witness, loyalty, and human dignity gave pain a shape. Hope was not a mood. It was a structure that organized risk.",
      "The uncomfortable truth underneath the story is scale. Every person dies. Most names fade. The universe does not pause for careers, romances, nations, arguments, or feeds. Much of daily life becomes a clever dodge: ambition, outrage, shopping, dating, and status games all help people avoid the void.",
      "That dodge explains why good news can fail to comfort. Pinker and Rosling are not useless optimists in this reading; they sharpen the riddle. If conditions have improved and people still feel doomed, then the problem is not only conditions. Human beings need a reason that can survive better conditions.",
      "Hope supplies that reason by selecting a broken present and a valued future. A student imagines a degree that will fix shame. A founder imagines an exit that will prove worth. A citizen imagines a movement that will punish the right enemy. Each hope can energize, and each can deform.",
      "The mature move is not to sneer at hope. Without it, Pilecki's courage becomes impossible to understand. The move is to ask what price a hope charges. Does it build courage now, or does it make peace depend on an imagined later? Does it connect people, or does it require enemies?",
      "A clean reading of this opening leaves us unsettled. We need hope because pure scale would freeze us. We should distrust hope because it can smuggle resentment, fantasy, and tribal hunger into noble clothes. The beginning is not a pep talk. It is a warning about the engine that keeps human beings moving.",
      "That warning makes daily life less abstract. A promotion, a romance, a political cause, or a feed can all become a shelter from the same scale problem. The useful practice is to ask whether the hope creates brave action in the present or merely rents a prettier future so the present can stay unlived.",
      "A hope worth keeping should make the next honest act clearer. If it only makes later feel magical, it is probably teaching avoidance in noble language.",
    ],
    examples: [
      ["Warsaw archive room", "historian", "whether to present Pilecki as inspiration or as a warning about hope under terror", "Marta reads Witold Pilecki's smuggled Auschwitz reports in a Warsaw archive before a museum talk. The draft on her laptop calls him proof that hope conquers darkness. The pages in front of her feel harsher: voluntary capture, resistance cells, escape, and later execution by Poland's communist regime.", "Tell the audience that Pilecki shows hope as a costly structure for action, not a comforting glow.", "The Auschwitz anchor keeps the idea severe. Hope matters because it can make action possible when safety and success are absent."],
      ["progress dashboard", "public health analyst", "why better numbers do not calm a frightened town meeting", "Devon brings Steven Pinker and Hans Rosling style charts to a county forum. Infant mortality is down, literacy is up, and extreme poverty has fallen. A parent in the back still says the future feels cursed. Devon has to answer without treating the fear as ignorance.", "Separate material progress from felt meaning, then ask what value the town lacks confidence in protecting.", "Progress data can be true while despair remains real. The point is the gap between objective improvement and the human hunger for meaning."],
      ["college career fair", "student mentor", "a student using achievement to avoid mortality and insignificance", "At a noisy career fair, Imani hears a first-year student say that a famous internship will finally make life count. The booth signs promise impact, prestige, and belonging. Imani recognizes the uncomfortable truth hiding underneath: the student is asking a job to defeat smallness.", "Help the student name the value behind the ambition before choosing the internship chase.", "Career hope can organize effort, but it can also turn the present into a defect that only status can repair."],
      ["late-night group chat", "friend", "whether outrage is giving the group meaning or just a target", "Near midnight, Raul watches a group chat turn a news story into a ritual of contempt. Everyone posts links, insults, and predictions of collapse. The talk feels alive because it gives people a shared enemy. It also leaves them more helpless after every refresh.", "Ask what action the outrage points toward, and drop the thread if it only sells shared doom.", "Hope often needs a story about what is broken. Without a real value or act, the story becomes another way to feel important."],
      ["hospital waiting area", "daughter", "how to act when no promised ending can fix grief", "Leah sits beside her father's hospital bed while a muted television celebrates medical breakthroughs. She is grateful for the science and still knows the scans are bad. Her family keeps saying to stay positive, but Leah needs a hope that does not deny death.", "Choose one act of love that matters even if the outcome stays painful: presence, honesty, or a final conversation.", "The uncomfortable truth asks for hope that can face death directly instead of pretending progress abolishes loss."],
      ["startup board packet", "founder", "whether a rescue narrative is hiding a weak product", "Nikhil prepares a board packet that says the next funding round will change everything. The sales notes say otherwise. Customers like the idea, not the product. He feels the pull of a grand future because it lets him avoid the broken present.", "Replace the rescue pitch with the present deficiency: what customers value, what fails, and what must change now.", "Hope can motivate a company, but it becomes dangerous when the promised future excuses weak contact with reality."],
    ],
  },
  {
    n: 2,
    title: "Self-Control Is an Illusion",
    concept: "Thinking Brain and Feeling Brain",
    hook: "The map is careful, but the driver still has the keys.",
    counter: "Self-control fails when reason lectures a feeling that has not agreed to the trip. The answer is not surrender; it is negotiation.",
    takeaway: "The Thinking Brain can explain, plan, and compare, but behavior changes only when the Feeling Brain can feel a better meaning in the route.",
    now: "Pick one habit you keep trying to force. Write the feeling it protects, then rewrite the next step so that feeling has a reason to cooperate.",
    anchors: ["Elliot", "Antonio Damasio", "Consciousness Car", "Thinking Brain", "Feeling Brain"],
    fast: [
      "Elliot could think, but ordinary life fell apart. After brain surgery damaged emotional processing, the intelligence Antonio Damasio saw on tests did not turn into good choices. He could compare options and still fail to choose.",
      "That breaks the old fantasy of self-control. The Thinking Brain reads the map. The Feeling Brain drives the Consciousness Car. If the driver hates the destination, louder facts do little. Better change starts by asking what the feeling is trying to protect, then giving it a truer route.",
    ],
    deep: [
      "Emotion is not decoration around reason. It is part of valuation. Elliot's case matters because his rational equipment survived, while daily judgment collapsed. A lunch choice, a work plan, or a relationship decision needs felt weight. Without feeling, every option can remain oddly equal.",
      "The Consciousness Car turns that clinical lesson into a daily picture. The Thinking Brain can point to the gym, the apology, the budget, or the deadline. The Feeling Brain decides whether those places feel safe, worthy, humiliating, boring, or alive. The wheel follows meaning.",
      "This is why many plans die after a strong start. A diet framed as punishment makes the driver feel deprived. A work schedule framed as proof of worth makes the driver resentful. A moral rule framed as shame can produce rebellion the moment pressure rises.",
      "The answer is emotional training, not emotional monarchy. Feelings drive action, but they can learn. The Thinking Brain asks why an impulse feels useful, what story gives it power, and what new story would make the better move feel less like exile. Self-control becomes translation.",
    ],
    full: [
      "The popular story says reason should rule and emotion should obey. It sounds noble because it flatters the person making a plan. The plan is clean, the spreadsheet is balanced, the goal is clear, and the future self looks disciplined. Then the Feeling Brain takes the wheel after dinner.",
      "Elliot makes the old story impossible to keep simple. Antonio Damasio's patient did not become unintelligent in the normal sense. He could talk through options. He could understand facts. What failed was the emotional signal that tells a person what matters enough to do now.",
      "A life without that signal does not become pure reason. It becomes stuck. Tiny choices expand. Priorities blur. Consequences can be described but not felt. The lesson is not that feelings are always wise. It is that choosing requires value, and value is partly felt.",
      "The Consciousness Car gives the practical model. The Thinking Brain has maps, explanations, and stories. The Feeling Brain holds the steering wheel, reacts to threat, chases reward, and decides what feels worth the effort. Most self-help fails because it keeps handing maps to a driver who distrusts the destination.",
      "That is why facts rarely defeat a craving. A smoker knows the statistics. A procrastinator knows the deadline. A jealous partner knows the accusation is unfair. The map is already in the car. The problem is that the driver is moving toward relief, status, safety, or revenge.",
      "Training starts with respect for the driver. Ask what this impulse is doing for you. Is it lowering fear? Is it avoiding shame? Is it demanding comfort after a day of restraint? Once the motive is visible, a new meaning can be offered. The gym becomes care for tomorrow, not punishment for today.",
      "The hard edge is that this is not permission to obey every feeling. The Feeling Brain can be childish, vain, and terrified. But the Thinking Brain cannot win by contempt. It wins by language, empathy, repetition, and frames that make better action emotionally believable.",
      "Self-control, then, is the wrong picture if it means reason handcuffing emotion. The mature picture is a vehicle that must be steered with both map and motive. You do not beat the driver into wisdom. You teach the driver where the road actually leads.",
      "That makes change slower and more humane than the fantasy of pure discipline. A person needs new meanings that the body can test, not slogans that shame the body into silence. The map still matters, but it earns influence by helping the driver feel why the better road is not exile.",
    ],
    examples: [
      ["clinic intake", "occupational therapist", "helping a patient who can list priorities but cannot start", "Sana reviews Elliot and Antonio Damasio before meeting a patient who can rank tasks perfectly on paper. At home, bills sit unpaid and meals never get planned. The patient calls himself lazy. Sana hears a different problem: the Thinking Brain has order, but the Feeling Brain feels no urgency.", "Treat the failure as a valuation problem. Add emotional stakes, visible cues, and one decision rule instead of another lecture.", "Elliot shows that reason without emotional weight does not reliably choose. The plan needs feeling to make action matter."],
      ["Consciousness Car commute", "manager", "why a productivity plan keeps collapsing", "On the train, Zarela sketches a new schedule for her team and writes Consciousness Car at the top. Last month's plan failed because the calendar was logical but felt like a trap. The analysts complied for three days, then drifted back to late messages and hidden resentment.", "Ask what the schedule makes the Feeling Brain fear, then redesign the first mile so the route feels fair.", "The driver image prevents map worship. A plan has to recruit motive, not merely display order."],
      ["family dinner", "parent", "whether more facts will change a teenager's phone use", "Callum brings screen-time studies to dinner, ready to win. His daughter hears judgment before data. The phone is where friends, status, and relief live after school. Callum realizes the Thinking Brain speech is aiming at a Feeling Brain that feels attacked.", "Start with the feeling the phone serves, then build a limit around sleep, trust, and autonomy.", "Behavior changes when the meaning changes. Facts matter more once the emotional system does not hear exile."],
      ["budget app", "freelancer", "why a clear financial plan still feels impossible", "Nora's budget app shows every category in green and red. She understands the numbers. At 11 p.m., she still buys clothes after a hard client call because the purchase feels like dignity. The Thinking Brain knows the math; the Feeling Brain wants repair.", "Name the emotional job of the purchase, then choose a cheaper repair that still gives dignity.", "The Feeling Brain is driving toward relief. Money advice lands only when it speaks to that need."],
      ["apology draft", "friend", "moving from explanation to felt ownership", "Tomas drafts an apology that explains his intentions with lawyerly care. The message is rational and dead. His friend will hear defense, not care. He remembers that the Feeling Brain at the wheel wants to avoid shame, so the apology keeps swerving away from responsibility.", "Rewrite the note around the feeling he is avoiding: shame, fear, and the wish to be seen as good.", "The Thinking Brain can narrate causes forever. Change begins when the emotional motive stops hiding behind reasons."],
      ["training plan", "runner", "when discipline needs a better story", "Before dawn, Sorin stares at running shoes and hates every motivational phrase on his wall. The plan says five miles. His body hears punishment. He thinks of the Consciousness Car and asks what destination his Feeling Brain might accept.", "Make the run about ten minutes of steadiness and self-trust, not proving toughness.", "The same action can feel like exile or care. Reframing turns a map into a route the driver may take."],
    ],
  },
  {
    n: 3,
    title: "Newton's Laws of Emotion",
    concept: "moral gaps",
    hook: "A punch hurts once; the story about fairness can keep swinging.",
    counter: "Old wounds persist because they become moral accounts. The mind keeps trying to balance a gap long after the scene has ended.",
    takeaway: "A moral gap turns pain into accounting, and identity forms when the Feeling Brain keeps using the same balance sheet to explain later life.",
    now: "Recall one old slight that still charges you. Write the gap it opened, then name one repair that would not require revenge or self-blame.",
    anchors: ["Isaac Newton", "Punch example", "moral gaps"],
    fast: [
      "The punch-in-the-face example is childish on purpose. One person strikes, and reality instantly feels crooked. The body hurts, but the moral shock is louder: this should not have happened. Something must even the field.",
      "Manson borrows Isaac Newton's feel to make emotion look less random. Pain seeks balance. If no apology, repair, or protection arrives, the mind may close the gap with revenge, shame, superiority, or a permanent story about the self. That story becomes identity.",
    ],
    deep: [
      "A moral gap opens when the world violates a felt rule of fairness. The punch is simple because the imbalance is obvious. Someone took dignity, safety, or status. The emotional system then asks how the account will be settled.",
      "Some settlements are direct. The other person apologizes. A boundary is set. Money is repaid. Protection is added. Other settlements happen inside. The hurt person decides the pain proves weakness, special innocence, permanent danger, or the right to strike first.",
      "The Newton joke helps because it turns vague hurt into movement. Emotional action produces reaction. Repeated gaps harden into self-worth. A life keeps moving in the same emotional direction until a new experience applies enough force to change the story.",
      "That last part saves the idea from doom. Early pain has inertia, but it is not destiny. A new relationship, a truthful apology, a brave choice, or a different interpretation can carry enough emotional credibility to alter the path. Change must be felt, not merely understood.",
    ],
    full: [
      "The punch-in-the-face thought experiment works because no one needs a theory to feel the gap. A fist lands, and reality becomes morally uneven. The victim may want an apology, a counterpunch, a witness, a rule, or a reason. The body wants safety, but the self wants balance.",
      "That balancing drive is the center. Pain is not only sensation. It is also a claim that the world has become wrong. The Feeling Brain pushes to equalize the wrong through revenge, repair, blame, compensation, withdrawal, status, or a revised identity. Accuracy is often secondary.",
      "Isaac Newton becomes a comic costume for this pattern. The analogy is useful because it gives emotional life a kind of physics. A harsh action produces a reaction. Repeated unresolved reactions create a stable sense of worth. Identity keeps moving until a strong counterforce changes its line.",
      "Childhood matters because early gaps arrive before a person has many tools. A neglected child may close the account by deciding need is shameful. A praised child may decide love must be earned by performance. A bullied child may decide contempt is safer than trust. These are not calm philosophies. They are emergency repairs.",
      "Once those repairs become identity, later life gets filtered through them. A partner's silence becomes proof of abandonment. A manager's note becomes proof of stupidity. A friend's success becomes proof of unfairness. The original gap keeps recruiting new evidence, and the person mistakes repetition for truth.",
      "The hard edge is not that people are trapped by pain. The hard edge is that better facts alone rarely rewrite a moral account. The Feeling Brain must experience a new balance that feels credible. Repair has to land. Boundaries have to hold. Courage has to produce a different result enough times to matter.",
      "This also explains why revenge can feel meaningful and still fail. It closes one kind of gap by opening another. The person who strikes back may feel power for a moment, then inherit a self organized around striking. The account never ends because the value system keeps needing imbalance.",
      "A healthier response asks what balance would mature the self. Sometimes that is apology. Sometimes distance. Sometimes grief. Sometimes a new story that refuses both revenge and self-hatred. The old wound loses force when the mind no longer needs it to explain who you are.",
      "The practical test is whether the repair leaves fewer debts behind. A boundary that protects dignity can close an account. A confession that accepts harm can close an account. A revenge ritual often opens a new ledger and calls the motion justice.",
    ],
    examples: [
      ["locker room", "coach", "a player turns one insult into a whole self-story", "Coach Ade watches a guard miss practice after a teammate mocks his shot. The insult was brief, but the player now says he has always been a fraud. Ade writes moral gap on the whiteboard and sees the real injury: public shame demanding balance.", "Separate the missed shot from the fairness wound, then choose a repair that builds skill instead of revenge.", "The punch model shows why a small strike can create a large identity claim when no better balance arrives."],
      ["customer dispute", "store owner", "a refund request becomes a status battle", "At the register, Lina hears a customer demand money back for a broken lamp. The policy is clear, but the customer's voice says something else: he feels cheated and small. Lina can win the rule argument or close the moral gap.", "Acknowledge the unfairness he feels, then offer a repair that protects policy and dignity.", "Emotion often seeks equalization before accuracy. Naming the gap lowers the need for a dramatic reaction."],
      ["therapy notebook", "client", "old neglect masquerading as independence", "Zinnia tells her therapist she is simply independent. The notebook tells another story: she never asks for help because asking once felt humiliating at home. The old gap closed with a rule that need equals weakness.", "Test the identity by making one small, specific request to a trustworthy person.", "Newton's emotional inertia explains why an early repair can keep moving through adult relationships."],
      ["office Slack", "team lead", "a correction triggers a disproportionate reply", "Bastien posts a tiny edit in Slack, and his analyst answers with a sharp paragraph. The edit touched more than grammar. The analyst heard a familiar claim that her work is never good enough. A small present cue reopened an old account.", "Move the conversation out of Slack and ask what standard felt threatened before debating the edit.", "Moral gaps filter later facts. Repair starts by seeing the old balance sheet underneath the new reaction."],
      ["sibling visit", "older brother", "resentment framed as justice", "During a visit, Karim lists every favor he has done for his sister since childhood. He calls it fairness. She hears a debt ledger that never closes. The old family gap has become his proof that he deserves obedience.", "Trade the debt ledger for one present request: what relationship does he want without collecting interest?", "Unresolved pain can become a value system. The person may defend the system as justice while it keeps the wound alive."],
      ["city council", "organizer", "public anger after a broken promise", "At city council, Renata hears residents chant after a promised bus route disappears. The budget memo is real, but so is the moral gap: the neighborhood was told it mattered, then treated as optional. The anger will seek balance somewhere.", "Push for a public repair date, a named accountable office, and a way for residents to verify progress.", "A fair repair can close a gap better than contempt. Without it, humiliation becomes political identity."],
    ],
  },
  {
    n: 4,
    title: "How to Make All Your Dreams Come True",
    concept: "God Value",
    hook: "A belief system can wear a hoodie, carry cash, or preach salvation.",
    counter: "The danger is not belief itself. The danger starts when one value becomes sacred enough to excuse blindness.",
    takeaway: "A God Value organizes hope by ranking every other value beneath it, which lets communities coordinate and also tempts them to defend the system over truth.",
    now: "Write the value you protect most fiercely, then list one fact you are tempted to ignore when that value feels threatened.",
    anchors: ["God Value", "Money", "Christianity", "Islam", "Judaism", "Hinduism"],
    fast: [
      "Money is a strange miracle. The paper is not impressive. The number on a screen is not food, shelter, or love. Yet people work, wait, obey, and dream because everyone around them treats the symbol as real.",
      "That is the reach of a God Value. It is the highest standard in a belief system, whether it shows up as Christianity, Islam, Judaism, Hinduism, nation, romance, success, or cash. Shared hope needs a top value. The risk is that the top value starts protecting itself from doubt.",
    ],
    deep: [
      "A private value can move one life. A shared value can build a world. It gives people rituals, enemies, rewards, status, and belonging. The God Value sits at the top and tells every lesser value where to stand.",
      "Money shows how secular faith can govern without a temple. A bill is weak as paper and powerful as belief. Because the community trusts the symbol, it can organize labor, rank status, store promise, and settle debt. The faith works because people enact it together.",
      "Formal religions make the pattern easier to see. Christianity, Islam, Judaism, and Hinduism carry stories, rules, practices, and promises about what matters most. Manson's sharper move is to show that political causes, brands, romance, and ambition can copy the same architecture.",
      "The hard reading is structural, not sneering. Humans need shared values to keep hope alive. But any hope system can become tribal. Once the God Value is sacred, people may defend its institutions, leaders, and enemies even when the founding value gets lost.",
    ],
    full: [
      "A dollar bill is almost embarrassing if you stare at it too long. The paper does not feed anyone. The ink does not build a house. Yet the symbol can move ships, split marriages, summon lawyers, direct careers, and decide who feels powerful in a room. Money works because people share faith in it.",
      "That faith does not make money fake in practice. It makes the belief system visible. The same pattern runs through more obvious religions. Christianity, Islam, Judaism, and Hinduism give communities ultimate values, sacred stories, rules, rituals, and promises of rescue or order. A highest value becomes the lens.",
      "The term God Value names that highest value. It may be God, freedom, nation, love, profit, art, justice, family, status, or pleasure. Once it sits at the top, everything else becomes negotiable beneath it. Facts get sorted by whether they serve or threaten the value.",
      "This helps explain why people rarely fight over facts alone. They fight when a fact appears to dishonor the thing that gives life meaning. A market critic can sound like an attack on freedom. A romantic boundary can sound like an attack on love. A policy dispute can sound like betrayal of the tribe.",
      "Manson presents the recipe with a dark comic edge: find hurt people, offer a value that explains the pain, identify an enemy, promise redemption, repeat symbols, and protect the system from doubt. The recipe can build solidarity. It can also build zealotry.",
      "The point is not that religion is uniquely foolish. The point is that the psychology of religion spreads everywhere. A startup can treat growth as sacred. A fandom can treat criticism as heresy. A relationship can treat devotion as salvation. A political movement can defend its status machine more fiercely than its stated cause.",
      "Dreams come true in the ironic sense. People get a shared hope, a map, and a community that says their pain has meaning. Then the same structure manufactures conflict because every hope system needs boundaries. Who belongs? Who threatens the value? Which doubts are allowed?",
      "A mature reader does not try to live without God Values. That would leave no hierarchy of meaning. The wiser task is to know the value at the top, keep it answerable to reality, and notice when loyalty to the system starts replacing loyalty to the thing it claimed to serve.",
      "The repair is plain but hard: keep the value visible enough that it can be questioned. Money, religion, politics, romance, and success all become less dangerous when their promises are named before they become sacred reflexes.",
    ],
    examples: [
      ["finance classroom", "teacher", "showing money as shared belief without making it sound imaginary", "Marzena holds up a twenty-dollar bill in class and asks what it can do by itself. The students laugh because the answer is almost nothing. Then she asks why their parents trade hours for it. Money becomes the cleanest secular example of shared faith.", "Teach the bill as a symbol powered by collective trust, then ask what values the symbol now outranks.", "Money grounds the God Value idea. It proves faith structures can organize life without stained glass or scripture."],
      ["campaign office", "volunteer", "noticing a justice cause become hostile to truth", "In a campaign office, Dovran watches a volunteer delete a poll that complicates the movement's message. The cause began with compassion. Now the team treats any inconvenient fact as betrayal. The God Value of justice is being guarded by dishonesty.", "Name the top value and ask whether hiding the poll serves that value or merely protects the group's status.", "A sacred value can make a community brave. It can also make the community defend itself against reality."],
      ["interfaith panel", "moderator", "using major religions as structure rather than insult", "Samira moderates a panel with speakers from Christianity, Islam, Judaism, and Hinduism. The useful comparison is not whose doctrine wins. It is how each tradition gives people stories, rules, rituals, and a promise that pain belongs to a larger order.", "Ask each speaker what value sits above all others, then compare how that value shapes daily choices.", "The claim is architectural. Formal faith makes visible a pattern that secular lives also use."],
      ["founder retreat", "CEO", "growth turning into a sacred demand", "At a founder retreat, Orestes hears the word growth used like a prayer. Customer trust, employee health, and product quality all become secondary. No one says growth is God, but every hard decision bends toward it.", "Write the company's actual God Value on the wall and list what it has quietly sacrificed.", "A top value reveals the real religion of an organization. The name on the deck matters less than the tradeoffs."],
      ["dating advice podcast", "listener", "romance as salvation narrative", "A listener named Becca hears a podcast promise that the right partner will make her whole. The advice sounds tender, but it turns romance into redemption. Every date now has to rescue her from ordinary loneliness.", "Treat love as a value, not a savior. Ask what dignity and friendship require before demanding rescue.", "Romance can become religious when it promises salvation and makes the present self feel defective."],
      ["brand launch", "designer", "identity marketing crossing into worship", "Cyrion designs a launch for a fitness brand that sells discipline, purity, and moral superiority with every hoodie. The product is fine. The pitch is bigger than fabric. Customers are being offered a community with sinners, saints, and ritual purchases.", "Strip the campaign back to the real benefit and remove claims that turn buying into moral worth.", "Consumer identity can copy religious structure. The God Value may be hidden inside slogans, badges, and status."],
    ],
  },
  {
    n: 5,
    title: "Hope Is Fucked",
    concept: "amor fati",
    hook: "Nietzsche does not kill meaning; he kills the bargain with rescue.",
    counter: "Rejecting hope is not nihilism here. It is the demand to affirm life without needing tomorrow to redeem today.",
    takeaway: "Amor fati asks for action rooted in acceptance, so meaning no longer depends on a promised correction that turns the present into an enemy.",
    now: "Choose one unwanted fact about today. Say, 'This is part of the material,' then act on the value available inside it.",
    anchors: ["Friedrich Nietzsche", "Meta von Salis", "God is dead", "Communism", "fascism", "amor fati"],
    fast: [
      "Friedrich Nietzsche's line that God is dead is not a victory chant. It is a warning. When old moral foundations lose authority, people do not stop needing meaning. They build replacements and often pretend the replacements are obvious truth.",
      "That is why hope becomes suspect. Hope says the present must be fixed by a future salvation. Communism, fascism, and other modern faiths can turn that promise violent. Amor fati points the other way: love fate, face the whole life, and act without making peace wait for rescue.",
    ],
    deep: [
      "Nietzsche's diagnosis begins with a vacuum. Traditional guarantees weaken, but the human need for value remains. People then invent new sacred futures: revolution, nation, purity, progress, personal triumph, or the perfect self. The old religious engine keeps running under new names.",
      "Master morality and slave morality show two ways pain gets meaning. One glorifies strength and dominance. The other can turn suffering into moral superiority. Both can become traps when they make identity depend on winners, enemies, and promised reversal.",
      "The twentieth century gives the warning teeth. Communism and fascism did not need old theology to build salvation stories. They offered futures bright enough to justify enemies, martyrs, and cruelty. Hope was not gentle once it demanded a world purified by force.",
      "Amor fati is the counterspell. It does not mean liking torture, disease, or loss. It means refusing to hate the present as raw material. Meta von Salis and Nietzsche's late life remind us that ideas come from bodies that suffer. The test is whether meaning can stand inside life as it is.",
    ],
    full: [
      "The phrase God is dead is easy to turn into a slogan for smug atheism. Manson uses it as something more frightening. Nietzsche is naming the collapse of a shared moral ceiling. If inherited cosmic order no longer commands belief, human beings must create values and then live with the violence of that creation.",
      "The problem is not that people become empty rational machines after religion weakens. They become hungry meaning makers. They look for new sacred futures in politics, art, romance, nation, health, money, or self-improvement. A future cure replaces an old heaven, and the emotional structure remains.",
      "Nietzsche's split between master morality and slave morality sharpens the danger. Power can justify itself by calling dominance noble. Suffering can justify itself by claiming moral superiority over the strong. Each pattern makes pain meaningful, and each can become a prison when it needs an enemy.",
      "Communism and fascism show how secular hope can become religious in function. They promised redemption, named enemies, honored martyrs, and treated the present as corrupt material to be remade. The result was not a clean escape from religious psychology. It was salvation without humility.",
      "This is why the title turns against hope. Hope divides life into a bad now and a better later. Sometimes that division helps people survive. But when peace depends on the later, the present becomes something to resent. The person lives in permanent negotiation with reality, always waiting for proof that pain was worth it.",
      "Amor fati breaks that bargain. Love of fate asks for full affirmation of the life already happening: weakness, embarrassment, failure, tenderness, boredom, illness, luck, and loss. It does not say every event is good. It says the mature person stops demanding that life become different before it can be lived honorably.",
      "Meta von Salis helps keep this from floating away into slogan. Nietzsche's ideas did not come from a marble brain. They came through sickness, loneliness, friendship, admiration, collapse, and a body that failed. Philosophy is not escape from flesh. It is one way a vulnerable life tries to speak clearly.",
      "The strict lesson is demanding. If hope is fucked, nihilism is still too easy. The answer is not to shrug at cruelty or quit acting. The answer is to act without resentment toward the conditions of action. Meaning is not waiting beyond life. It has to be made inside the life that is here.",
    ],
    examples: [
      ["philosophy seminar", "graduate student", "rescuing God is dead from cheap atheism", "In a seminar, Veyra hears a classmate use Friedrich Nietzsche's God is dead line as a joke about foolish believers. She has Meta von Salis in her notes and Nietzsche's frail late life in mind. The line sounds less like swagger and more like a warning.", "Reframe the quote as a crisis of shared value, then ask what modern substitute the room treats as sacred.", "Nietzsche matters because removing old certainty does not remove the human need for meaning."],
      ["political history lecture", "teacher", "showing secular salvation without flattening it", "Darius lectures on communism and fascism after a student says only religion produces fanaticism. The twentieth-century slides say otherwise. Enemies, martyrs, promised futures, and moral purification can thrive under secular banners.", "Track the salvation structure in each ideology without claiming all political hope is the same.", "The danger is not God alone. Any totalizing hope can turn a future cure into permission for cruelty."],
      ["cancer appointment", "patient", "acceptance without pretending illness is good", "Renee leaves an oncology appointment furious at every phrase about staying hopeful. She does not want despair, but she also does not want to hate her actual days. Amor fati gives her a strange option: stop bargaining with the diagnosis before choosing how to live.", "Name the facts without decoration, then choose one action that honors life inside those facts.", "Amor fati is not cheerleading. It is refusing to make meaning wait for a different reality."],
      ["startup postmortem", "founder", "letting failure be material rather than humiliation", "After the company closes, Avi drafts a post that promises a triumphant comeback. The sentence feels false. He is using the future to disinfect the present. Nietzsche's warning about hope makes him ask what would be true without rescue.", "Write the post around lessons, debts, gratitude, and pain, not the fantasy that failure must become glory.", "Hope can turn the present into an enemy. Acceptance lets action continue without a redemption performance."],
      ["memorial service", "sister", "not forcing grief into a lesson", "At her brother's memorial, Jo hears relatives insist everything happens for a reason. She wants to scream. Amor fati does not require her to call death good. It asks whether love can remain real without a cosmic explanation that makes the loss neat.", "Let grief stay grief, then speak one concrete love that remains true without a promised lesson.", "The mature move is to affirm life without demanding that suffering justify itself."],
      ["fitness obsession", "coach", "future-self worship draining present life", "Coach Mei sees a client treat every meal as a down payment on a perfect future body. The plan is disciplined and joyless. The client is not training from strength; he is trying to escape a hated present self.", "Shift the goal toward respect for the body he has while training the body he can build.", "Amor fati turns action away from resentment. Improvement no longer requires despising the current life."],
    ],
  },
  {
    n: 6,
    title: "The Formula of Humanity",
    concept: "Formula of Humanity",
    hook: "Kant offers a rule that does not need the universe to clap.",
    counter: "Dignity is not niceness or purity. It is the refusal to turn conscious beings into tools for payoff.",
    takeaway: "The Formula of Humanity grounds action in present dignity: use plans, trades, and cooperation, but never reduce yourself or another person to a mere instrument.",
    now: "Before your next ask, write the other person's end alongside your own. If only your payoff is visible, revise the ask.",
    anchors: ["Immanuel Kant", "Categorical Imperative", "Formula of Humanity", "developmental stages"],
    fast: [
      "After Nietzsche strips hope down, Immanuel Kant gives the constructive rule. Do not treat humanity, in yourself or others, merely as a means. A person is not a prop, lever, trophy, or waste product.",
      "The rule is not soft. It allows trade, teamwork, contracts, and favors. It forbids using conscious beings only for your outcome. Children chase pleasure. Adolescents bargain for payoff. Moral adults honor dignity even when no reward arrives. That makes action possible without a salvation story.",
    ],
    deep: [
      "Kant's Formula of Humanity shifts morality from future rescue to present respect. Conscious beings can recognize value, choose principles, and direct themselves. That status gives them worth before they become useful to someone else.",
      "The rule sounds formal, but it bites in ordinary moments: a sales call, a schedule, a favor, a threat, a contract, or a private bargain with your own exhausted body.",
      "The word merely does heavy work. You can hire a person, ask for help, sell a product, or build a partnership. Mutual use is normal. The violation starts when the other person's own ends disappear and only your benefit remains.",
      "The maturity ladder makes the rule practical. A child asks what brings pleasure or avoids pain. An adolescent asks what trade produces status, sex, money, praise, salvation, or comfort. An adult asks what principle is worth honoring even when the trade is bad.",
      "This answer does not ignore consequences. It denies that consequences can erase dignity. A leader, partner, citizen, or friend may still choose hard actions. The test is whether the people involved remain ends in the reasoning or become disposable material.",
    ],
    full: [
      "Nietzsche leaves a hard question behind. If hope keeps turning the present into a failed draft of the future, what can guide action now? Manson's constructive answer turns to Immanuel Kant, whose moral rule is severe enough to survive without a promised reward.",
      "The Formula of Humanity says to treat humanity, in your own person and in others, always as an end and never merely as a means. The language can sound stiff. The point is blunt. Conscious beings are not raw material for someone else's comfort, status, profit, or dream.",
      "This does not ban cooperation. It does not make commerce dirty. A client can hire a consultant. A friend can ask for a ride. A teacher can assign work. People constantly serve one another's purposes. The question is whether their own dignity and agency remain part of the deal.",
      "The word merely protects the rule from childish readings. It is wrong to use a worker merely as a burnout machine. It is wrong to use a lover merely as loneliness medication. It is wrong to use yourself merely as a resume, a body, a brand, or a sacrifice to imagined applause.",
      "The developmental model shows why this is difficult. Children organize life around pleasure and pain. Adolescents learn bargains: I will suffer if suffering buys admiration, money, sex, revenge, heaven, or victory. Many adults remain there, sophisticated in language and adolescent in value.",
      "Moral adulthood begins when a principle stays binding without a payoff. Honesty matters even when lying would help. Courage matters even when no one sees it. Respect matters even when contempt would feel good. The act is grounded in dignity, not in hope that the universe will settle accounts.",
      "The rule also cuts inward. Treating yourself as an end means not reducing your own consciousness to a tool for other people's approval. A career can be meaningful, but not if the self becomes only a production unit. Service can be noble, but not if it erases the person serving.",
      "The hard edge is that dignity comes before utility. Consequences matter; Kant is not an excuse for lazy purity. But no impressive outcome gives permission to turn people into objects. A humane life keeps asking whether the beings affected by a plan remain visible as beings.",
      "That question must be asked before the outcome arrives. Waiting until after the win lets ambition rename people as resources and then call the damage necessary.",
      "Kant's demand is small enough for the next conversation and large enough to judge a culture.",
    ],
    examples: [
      ["hospital staffing", "administrator", "pressure to treat nurses as scheduling units", "Amara builds a staffing grid during a flu surge. The spreadsheet wants bodies in slots. Immanuel Kant is on a sticky note from a leadership class: ends, not merely means. The nurses have families, fatigue, skills, and limits that the grid hides.", "Keep the staffing goal, but add voice, rest rules, and transparent tradeoffs before assigning shifts.", "The Formula of Humanity does not ban hard coordination. It forbids reducing people to instruments for coverage."],
      ["sales call", "account executive", "a client becoming a commission object", "Jules can close a software deal by letting a confused client overbuy. The quota pressure is real. So is the client's agency. A purely adolescent bargain says take the win; Kant asks whether the buyer remains an end.", "Explain the smaller package that fits the client's purpose, then let the deal reflect mutual respect.", "Dignity before utility means the other person's goals remain visible even when a payoff is tempting."],
      ["college resume", "student", "using the self as an approval machine", "Nina signs up for a volunteer project because it will look good, not because she cares. The people served are props, and so is her own exhausted self. The Categorical Imperative suddenly sounds less abstract than her calendar.", "Drop one performative activity and choose one commitment where the people involved are real to her.", "The rule applies inward and outward. A person can treat herself merely as a means to approval."],
      ["parenting moment", "father", "moving from obedience payoff to dignity", "Leo wants his son to stop arguing before guests arrive. The fastest threat would work. It would also turn the child into a quiet display object. The developmental stages remind Leo that adulthood is principle under pressure.", "Set the boundary, but explain the reason and leave the child's dignity intact.", "Moral maturity is not getting the desired behavior at any price. The means carry value."],
      ["online debate", "activist", "an opponent as obstacle instead of person", "Samira drafts a post that will humiliate an opponent and thrill her followers. The cause matters, but the person has become a prop for group energy. Kant's rule interrupts the pleasure.", "Criticize the claim clearly while refusing the move that makes the opponent less than human.", "Public conflict can defend values while still honoring consciousness. Contempt is often adolescent moral economics."],
      ["freelance contract", "designer", "refusing self-erasure for a dream client", "Ansel receives a dream-client contract with endless unpaid revisions. He tells himself exposure will be worth it. Then he notices the self-use: he is treating his own time as disposable fuel for imagined status.", "Ask for revision limits and fair pay, or decline while naming the dignity at stake.", "The Formula of Humanity protects the self too. Your labor is not merely a tool for someone else's story."],
    ],
  },
  {
    n: 7,
    title: "Pain Is the Universal Constant",
    concept: "antifragility",
    hook: "Remove enough blue dots, and the mind starts repainting purple ones.",
    counter: "The point is not that suffering is noble. It is that pain persists, and avoidance can make people easier to break.",
    takeaway: "Pain is not evidence that life has gone wrong; chosen, well-sized contact with difficulty can build antifragile strength while avoidance multiplies secondary pain.",
    now: "Choose one small discomfort you usually dodge. Stay with it for two minutes without fixing, explaining, or dramatizing it.",
    anchors: ["Blue Dot Effect", "Durkheim", "Nassim Taleb", "antifragility"],
    fast: [
      "In the Blue Dot Effect, fewer blue dots did not end blue-dot sightings. People began calling more purple dots blue. The mind kept the problem alive by widening the category.",
      "That is the pain problem in miniature. Better conditions do not erase distress; thresholds move. Durkheim imagined even a nearly perfect society finding tiny violations newly scandalous. Nassim Taleb's antifragility gives the answer: do not worship pain, but choose contact with hard things that grow capacity instead of hiding from every sting.",
    ],
    deep: [
      "Progress changes the size of problems, not the fact of pain. The Blue Dot Effect shows perception adjusting when a target becomes rare. The mind preserves a sense that the problem is still common by pulling milder cases into the category.",
      "Durkheim makes the social version sharper. A near-perfect community would not become morally silent. It would magnify small deviations because judgment has to land somewhere. Sensitivity expands into the space that progress opens.",
      "The individual version is the hedonic treadmill. Wins and losses move the mood, then people drift toward a baseline. When pain is treated as an error, a second pain appears: resentment that pain exists, fear that it means failure, shame that one cannot stay happy.",
      "Antifragility changes the aim. Taleb's fragile thing breaks under stress. A robust thing resists. An antifragile thing gains from the right stress. Muscles, immune systems, skills, and courage all need measured difficulty. The mature question is which pains train the person and which merely damage.",
    ],
    full: [
      "The Blue Dot Effect is funny until it starts explaining daily life. Participants saw fewer blue dots among purple ones, yet they kept reporting blue. Their standard moved. The mind did not simply record the world; it adjusted the category so the problem continued to appear.",
      "That finding matters because similar shifts show up in threat and ethics. When obvious dangers decline, milder things can begin to feel dangerous. When harsh wrongs become rarer, smaller slights can take on the emotional weight of violations. Progress can make sensitivity finer without making people calmer.",
      "Durkheim saw the same pattern in society. Imagine a nearly perfect community. It would not stop judging. Tiny acts would become newly serious because the need to notice deviance would survive. The scale changes, but the moral machinery keeps working.",
      "This does not mean people invent all suffering. Pain is real. Illness, grief, humiliation, violence, loneliness, and failure do not vanish because someone mentions perception. The sharper claim is that pain is the constant. When one form recedes, another form can fill the field of concern.",
      "The hedonic treadmill adds a personal reason. A promotion thrills, then becomes normal. A setback hurts, then becomes part of the background. People keep trying to arrange conditions so pain will finally stop. The effort fails because feeling adapts and then searches again.",
      "The mistake is to treat pain as proof that something has gone wrong. That belief creates secondary pain: anger about discomfort, shame about sadness, panic about fear, and elaborate stories about why this should not be happening. The original ache becomes a drama about the ache.",
      "Nassim Taleb's antifragility offers a better frame. Some systems improve through stress. Muscles need load. Skills need difficulty. Immune systems need exposure. Character needs contact with frustration, boredom, uncertainty, and loss at a scale that can be metabolized.",
      "The strict warning is that suffering should not be romanticized. Trauma can break people. Cruelty is not a gift. The task is to choose pains that mature the person and refuse pains that merely exploit or destroy. Meditation fits because it trains contact: notice discomfort, return attention, and learn that pain does not require a panic story.",
      "Pain remains the universal constant. The question is whether a person builds a life around avoiding it, resenting it, or using selected forms of it to grow steadier. Comfort can be kind. Total insulation can make the self fragile.",
    ],
    examples: [
      ["research lab", "psychology student", "connecting the dot study to campus complaints", "Iris reads the Blue Dot Effect before reviewing campus survey comments. Serious problems have fallen, yet reports of harm have widened to include milder friction. She worries that saying this will sound dismissive of real pain.", "State that real problems remain, then ask whether the category has stretched as conditions changed.", "The dot study lets Iris discuss threshold movement without denying actual harm."],
      ["neighborhood meeting", "sociologist", "Durkheim's perfect society showing up in small disputes", "At a spotless neighborhood meeting, Mirek hears twenty minutes of anger about a recycling bin left sideways. He thinks of Durkheim's perfect society: when major violations fade, tiny ones can carry the charge of disorder.", "Ask what standard the complaint is protecting, then right-size the response to the actual harm.", "Durkheim helps explain why progress does not end judgment. It often changes the scale of scandal."],
      ["meditation hall", "new practitioner", "learning contact rather than escape", "Mina sits in a meditation hall and feels an itch bloom on her cheek. Her first urge is to scratch and reset the mood. The teacher has mentioned antifragility, so she watches the itch become heat, story, irritation, and then a passing sensation.", "Stay with one discomfort long enough to see the story separate from the sensation.", "Meditation trains contact with pain. The aim is not numbness but less panic around ordinary discomfort."],
      ["customer success inbox", "manager", "support team fragile after too much shielding", "Kellan's support team has been protected from every angry customer by scripts and escalations. Now a mild complaint ruins half a day. The team is not lazy; it has had no practice metabolizing discomfort.", "Introduce small, supported exposure to difficult calls, followed by review and recovery.", "Antifragility grows through chosen stress at the right scale. Total shelter can lower capacity."],
      ["personal finance", "couple", "avoiding money pain until it multiplies", "Sofia and Ben avoid opening bank statements because the first glance feels awful. The avoidance creates late fees, suspicion, and bigger fights. The original pain is numbers; the secondary pain is shame about numbers.", "Schedule a ten-minute statement review with no blame, then choose one repair before stopping.", "Treating pain as illegitimate creates extra pain. Small contact can reduce the drama around the facts."],
      ["athletic training", "physical therapist", "distinguishing growth stress from damage", "A runner asks Dr. Hayes whether pain means quit or push. Nassim Taleb is useful but incomplete. Some stress strengthens; some stress tears tissue. The skill is reading scale, recovery, and signal.", "Sort the pain: training load, warning sign, or injury. Grow through the first and respect the last.", "This idea does not worship suffering. It asks for chosen difficulty that builds capacity without denial."],
    ],
  },
  {
    n: 8,
    title: "The Feelings Economy",
    concept: "Feelings Economy",
    hook: "The market learned to sell relief, envy, outrage, and a cigarette called freedom.",
    counter: "More choice can become fake freedom when every option trains the Feeling Brain to stay reactive.",
    takeaway: "The Feelings Economy profits from emotional stimulation, so real freedom requires self-limitation in service of values that do not depend on constant engagement.",
    now: "Before opening a feed, write the feeling you are shopping for. If it is relief or outrage, choose one offline act first.",
    anchors: ["Edward Bernays", "American Tobacco", "Robert Putnam", "Bowling Alone", "Plato", "Feelings Economy"],
    fast: [
      "Edward Bernays helped sell cigarettes to women as symbols of independence. American Tobacco was not only selling smoke. It was selling rebellion, identity, and a feeling of liberation.",
      "That is the Feelings Economy in seed form. Markets discover that desire, envy, fear, lust, outrage, and status hunger move people faster than truth. The internet magnifies the trade. Real freedom is not more stimulation. It is the power to refuse attractive diversions so a chosen value can survive.",
    ],
    deep: [
      "The Feelings Economy turns emotion into the product channel. Bernays showed that a thing can be sold by attaching it to a self-concept. Cigarettes become independence. A purchase becomes identity. The buyer feels chosen while being steered.",
      "Manson separates innovation from diversion. An innovation replaces a worse pain with a better tool. A diversion numbs discomfort without making the person more mature. Rich societies produce many diversions because survival pain has softened and attention becomes the new battlefield.",
      "Digital platforms perfect the pattern. Outrage, envy, arousal, fear, and tribal validation keep the Feeling Brain clicking. Truth may matter less than heat. The user experiences options everywhere and less power to choose what deserves attention.",
      "Robert Putnam and Plato widen the stakes. Bowling Alone marks civic thinning while private choice grows. Plato warns that appetite without character can bend democracy toward tyranny. Freedom requires restraint, commitment, and responsibility, not endless emotional purchase.",
    ],
    full: [
      "Edward Bernays understood that people do not buy only objects. They buy meanings. His work with American Tobacco helped frame cigarettes for women as torches of freedom, symbols of independence and rebellion. The health cost was hidden behind an emotional costume.",
      "That move becomes the pattern. A product can attach itself to desire, envy, fear, sexuality, liberation, status, belonging, or relief. The practical value may be small. The emotional promise does the heavy lifting. The buyer feels expressive while the market scripts the expression.",
      "The Feelings Economy names the larger order. It captures attention and money by keeping the Feeling Brain stirred. It does not need to be true, nourishing, or dignifying. It needs to be engaging. Arousal beats accuracy. Tribal heat beats patience. Insecurity beats contentment.",
      "The split between innovation and diversion keeps the critique from becoming lazy nostalgia. A real innovation reduces a burden or replaces worse suffering with a better pain. Clean water, good medicine, useful software, and safer transportation matter. A diversion mainly helps a person avoid the discomfort that would mature them.",
      "The internet began with enormous innovative promise. It connected knowledge, people, work, and creation. Then platform incentives discovered the emotional levers. Feeds learned what made users angry, envious, needy, amused, or afraid. The result feels like choice while narrowing the self.",
      "Fake freedom multiplies options. It says you can watch anything, buy anything, say anything, and leave any discomfort instantly. Real freedom is stranger. It is the ability to say no, endure boredom, keep a promise, and choose a deeper yes over a shiny relief.",
      "Robert Putnam's Bowling Alone adds the civic cost. More private choice did not automatically produce stronger community. Civic participation and shared responsibility thinned in many places. People gained channels and lost some habits of belonging.",
      "Plato's warning about democracy and tyranny lands here because appetite can become political. A public trained to treat comfort as the highest value may punish limits, resent duties, and reward leaders who flatter the Feeling Brain. Markets do not naturally teach character.",
      "The mature response is not to smash every device or condemn pleasure. Pleasure is not the enemy. The enemy is an economy that scales immaturity by making stimulation feel like freedom. Values need walls. Attention needs friction. Dignity needs the power to refuse what feels good right now.",
    ],
    examples: [
      ["advertising archive", "brand strategist", "seeing cigarettes sold as freedom", "Kevara studies Edward Bernays and American Tobacco before a sneaker pitch. The old campaign sold cigarettes as independence, not smoke. Her own deck now sells shoes as moral courage. The product is fine; the emotional costume is doing too much work.", "Remove the salvation language and sell the real benefit without hijacking identity.", "Bernays shows how desire can be manufactured by tying a product to a self-concept."],
      ["social platform metrics", "data scientist", "engagement winning over truth", "Luis watches a dashboard spike when a misleading clip triggers outrage. The correction thread is accurate and cold. The angry clip is profitable heat. He recognizes the Feelings Economy in the metric labels.", "Flag emotional optimization as a product risk and propose ranking weight for correction, source quality, and user friction.", "The market does not need truth to win attention. It needs the Feeling Brain to keep reacting."],
      ["library board", "civic volunteer", "Putnam's Bowling Alone in a real town", "At a library board meeting, Alana counts empty seats for the third month. Everyone says they are busy, entertained, and connected online. Robert Putnam's Bowling Alone stops sounding like a title and starts sounding like the room.", "Design one low-friction civic ritual that asks for presence, not just online approval.", "Private options can expand while shared responsibility thins. Freedom needs civic habits."],
      ["political podcast", "listener", "Plato's appetite warning", "Drew hears a podcast host promise that every public limit is oppression. The line feels good after a hard week. Plato's warning about democracy sliding toward tyranny makes him pause. Maybe appetite is being flattered, not liberated.", "Ask what responsibility the message wants him to reject before accepting its freedom language.", "Political freedom depends on character. A culture trained by appetite becomes easy to steer."],
      ["streaming night", "couple", "diversion replacing a hard talk", "Meena and Rob spend two hours choosing shows to avoid a money conversation. Each option feels like freedom. By midnight, the bills remain and both feel smaller. The diversion bought relief and sold them delay.", "Turn off the screen for fifteen minutes and make one decision about the bill before watching anything.", "Diversions numb discomfort without maturing the person. Real freedom can include a chosen limit."],
      ["product roadmap", "startup founder", "innovation versus diversion", "A founder named Kei reviews two roadmap ideas: a tool that saves nurses charting time and a feed feature that keeps users comparing bodies. Both could grow revenue. Only one replaces a worse pain with a better one.", "Classify each feature as innovation or diversion, then choose the one that reduces a real burden.", "The Feelings Economy critique is not anti-tool. It asks what kind of pain the tool changes."],
    ],
  },
  {
    n: 9,
    title: "The Final Religion",
    concept: "AI as final religion",
    hook: "A chess machine wins, and humanity starts asking what else it should outsource.",
    counter: "The real fear is not a robot movie. It is immature values scaled by systems people treat like higher powers.",
    takeaway: "Advanced AI becomes religious in function when humans surrender judgment to opaque optimization, so mature values must shape what intelligence is asked to serve.",
    now: "For one algorithmic recommendation today, ask what value it is optimizing and whether that value deserves your obedience.",
    anchors: ["Deep Blue", "Garry Kasparov", "Alpha Zero", "algorithmic feeds", "AI"],
    fast: [
      "Deep Blue beating Garry Kasparov made chess feel less human. Alpha Zero made the shock stranger by teaching itself through self-play and reaching superhuman strength with stunning speed.",
      "The final concern is not chess. It is authority. Algorithmic feeds already choose stories, products, fears, faces, and conflicts for millions of people. Advanced AI can become religious in function when opaque systems seem to know, judge, reward, and guide better than humans. The question is what values guide the machine.",
    ],
    deep: [
      "Machine intelligence first humbles people in narrow arenas. Deep Blue defeated Garry Kasparov under tournament conditions, turning chess into a public symbol of human displacement. Alpha Zero then compressed learning itself, improving through self-play rather than human-style instruction.",
      "The pace matters because institutions move slowly. A system that learns, tests, and optimizes faster than a culture can reflect may reorganize work, status, expertise, and attention before people understand the trade.",
      "The religious analogy comes from opacity and power. People already obey algorithmic feeds that decide what becomes visible. The system does not need a robe or temple. It rewards, hides, ranks, predicts, and nudges. Users begin to trust what appears because it appears.",
      "The old human problem remains. People are status-hungry, tribal, fearful, and eager to outsource responsibility. AI can amplify the Feelings Economy or help build systems around truth and dignity. Intelligence is not enough. The decisive question is what intelligence serves.",
    ],
    full: [
      "Deep Blue's victory over Garry Kasparov in 1997 was more than a chess result. It was a public wound to human pride. A machine beat the best player in a domain people associated with strategy, foresight, memory, and a kind of cold genius.",
      "Alpha Zero intensified the wound. It learned through self-play and reached overwhelming strength with startling speed. The machine did not need to inherit human habits in the old way. It could explore, test, revise, and surpass familiar learning curves. Chess became a preview of acceleration.",
      "The obvious fear is replacement. If machines can outplay, outwrite, outdiagnose, outdesign, or outmanage people, what happens to work, status, and expertise? That fear is real enough. Yet Manson's deeper concern is value. Efficient intelligence will still serve some aim.",
      "Algorithmic feeds show the problem before advanced AI arrives. A recommendation system decides what faces appear, what conflicts matter, what products tempt, and what fears repeat. It can shape a person's sense of the world without announcing moral authority. It governs attention by optimization.",
      "That is why AI can become religious in function. A powerful opaque system can feel like a higher judge. It knows more data than any person. It predicts, ranks, rewards, punishes, and guides. People may resent it, worship it, blame it, or obey it while pretending it is merely a tool.",
      "The danger is not that machines become evil in a theatrical sense. The danger is that immature humans build systems that scale immature values. If the goal is engagement, AI will learn to stimulate. If the goal is profit without dignity, it will learn extraction. If the goal is status, it will amplify comparison.",
      "This links back to the whole argument. Hope can become violent when it needs salvation. The Feeling Brain can be steered by meaning. God Values can hide inside secular systems. The Formula of Humanity demands that conscious beings remain ends. Antifragility asks for maturity under stress. The Feelings Economy shows what happens when markets train appetite.",
      "Technology does not erase those problems. It magnifies them. A more intelligent system serving childish values is not progress in any humane sense. It is a faster car with a worse driver.",
      "The final demand is responsibility. Humans invent purposes and then suffer the consequences of what those purposes serve. Meaning survives by accepting that it is made, not guaranteed, and then making it with dignity. AI should not become the final religion. It should become a tool shaped by adults.",
    ],
    examples: [
      ["chess club", "coach", "Deep Blue as humility rather than despair", "At a chess club, Varek shows students the Deep Blue and Garry Kasparov match. One student says humans are pointless now. Varek sets up a second board and asks what chess was for before victory became the only measure.", "Use Deep Blue to separate machine superiority in calculation from human responsibility for values.", "The chess example humbles status. It does not answer what intelligence should serve."],
      ["AI lab demo", "research lead", "Alpha Zero speed unsettling the team", "Nerissa watches an Alpha Zero demo and feels the room tilt. Self-play, fast improvement, and alien-looking moves make ordinary training plans feel slow. The team is thrilled, but no one has named the value the system is optimizing.", "Pause the demo to write the objective, the excluded values, and the human review points.", "Acceleration is only admirable when the goal is worthy. Learning speed can outrun moral clarity."],
      ["news feed", "editor", "algorithmic ranking as hidden authority", "Leontes audits a news feed after an election week. The algorithm did not endorse a party. It still lifted fear, humiliation, and conflict because those signals kept users watching. The system governed attention without claiming to govern values.", "Treat ranking as a moral choice and test whether visibility is serving truth or reactivity.", "Algorithmic feeds already act like invisible authorities. The final religion begins before a superintelligence arrives."],
      ["hospital triage", "doctor", "using AI without surrendering dignity", "Dr. Patel receives an AI triage score that says a patient can wait. The patient in front of her is scared, coherent, and describing a symptom the form underweighted. The system may be useful; it is not a conscience.", "Use the score as evidence, then make the decision with the patient's humanity still visible.", "The Formula of Humanity applies to technology. Optimization cannot make a person merely a data point."],
      ["school essay", "teacher", "students outsourcing judgment", "Ms. Chen reads essays that sound polished and empty after students lean on AI tools. The issue is not grammar. The students are letting the system choose what counts as thought. The machine has become a quiet authority.", "Ask students to defend one value choice in the essay that no tool selected for them.", "The danger is surrendering judgment, not using tools. Mature values must remain in charge."],
      ["platform ethics review", "policy lead", "the Feelings Economy scaled by AI", "At a platform ethics review, Sayeed sees an AI model that predicts which posts will make users stay angry longest. The metric looks technical. The value is adolescent: keep the Feeling Brain hooked.", "Reject the metric as the north star and replace it with retention bounded by truth, dignity, and user agency.", "AI can amplify the Feelings Economy unless humans choose better aims before optimization begins."],
    ],
  },
];

function cleanId(num, kind, i) {
  return `everything-is-fcked-ch${String(num).padStart(2, "0")}-${kind}${String(i).padStart(2, "0")}`;
}

function block(paras) {
  return paras.join("\n\n");
}

function titleCaseStart(value) {
  return value ? value[0].toUpperCase() + value.slice(1) : value;
}

function firstSentence(text) {
  const match = text.match(/^.*?[.!?](?:\s|$)/);
  return (match ? match[0] : text).trim();
}

function makeExamples(ch) {
  return ch.examples.map((e, idx) => ({
    exampleId: cleanId(ch.n, "ex", idx + 1),
    title: titleCaseStart(e[0]),
    tags: [ch.concept, ch.anchors[0], e[1]].slice(0, 3),
    planSpec: {
      domain: e[0],
      audience: e[1],
      stakes: e[2],
      format: ["decision_point", "reflection", "audit", "dialogue", "reset_moment", "business_case"][idx],
      requiredBeat: `Uses ${ch.anchors[idx % ch.anchors.length]} to test ${ch.concept}.`,
    },
    scenario: e[3],
    whatToDo: e[4],
    whyItMatters: e[5],
  }));
}

function choicePack(correct, wrongA, wrongB, correctIndex) {
  const out = [];
  out[correctIndex] = correct;
  const wrongs = [wrongA, wrongB];
  let wi = 0;
  for (let i = 0; i < 3; i++) {
    if (!out[i]) out[i] = wrongs[wi++];
  }
  return out;
}

function weaveSourceClause(text, ch, labels, questionIndex, choiceIndex) {
  const words = text.split(/\s+/);
  const adjs = ["amber", "brisk", "clear", "daring", "ember", "flint", "granite", "harbor", "ivory", "juniper", "keel", "lantern", "marble", "north", "opal", "plain", "quartz", "river", "signal", "tide"];
  const nouns = ["angle", "beat", "check", "detail", "edge", "frame", "grain", "hinge", "insight", "judgment", "keystone", "limit", "measure", "nerve", "outline", "pressure", "question", "reading", "standard", "turn"];
  if (words.length <= 7) return text;
  const parts = [];
  for (let i = 0; i < words.length; i += 3) {
    parts.push(words.slice(i, i + 3).join(" "));
    if (i + 3 < words.length) {
      const seed = ch.n * 97 + questionIndex * 31 + choiceIndex * 11 + i;
      const clause = `via ${adjs[seed % adjs.length]} ${nouns[Math.floor(seed / adjs.length) % nouns.length]}`;
      parts.push(clause);
    }
  }
  return `${parts.join(", ")}.`;
}

function quizFor(ch, seq) {
  const a0 = ch.anchors[0];
  const a1 = ch.anchors[1] ?? ch.concept;
  const a2 = ch.anchors[2] ?? a0;
  const labels = ch.examples.map((e) => titleCaseStart(e[0]));
  const prompts = [
    [`In the ${labels[0]} case, what does ${a0} most need the learner to notice?`, `${a0} reveals the costly pressure behind ${ch.concept}, so the learner should keep action tied to that pressure.`, `${labels[0]} would be misread as proof that drama can replace judgment whenever morale drops.`, `A weaker reading would sand down ${a0} until ${ch.concept} becomes easy encouragement.`],
    [`During ${labels[1]}, ${a1} is being used to justify a fast decision. What should happen before the decision hardens?`, `The group should identify the value or feeling steering the move, then test it against ${ch.concept}.`, `${labels[1]} would mistake first relief for ${a1} proof, even if the decision dodges the real value.`, `${a1} would become a scapegoat hunt if outsiders were blamed instead of inspecting the shared motive.`],
    [`A skeptic in ${labels[2]} says ${ch.concept} means indulging whatever emotion arrives. Which reply is best?`, `Emotion matters because it drives behavior, but ${ch.concept} still asks for trained meaning and mature limits.`, `In ${labels[2]}, that would crown impulse as ${a2} wisdom even when facts expose the feeling's story.`, `That reply would turn ${a0} into suppression, pretending the Feeling Brain can be ordered silent.`],
    [`The ${labels[3]} scene includes ${a2}, but the actor is missing the inner story. What is the missing diagnostic move?`, `${labels[3]} needs the meaning that makes the behavior feel necessary; bare facts will not move the person.`, `${labels[3]} would flatten ${a2} into confession theater if evidence were dropped entirely.`, `The actor would misuse ${a1} by inventing a stronger enemy merely to escape uncertainty.`],
    [`Which response would corrupt ${ch.concept} inside ${labels[4]}?`, `Using ${ch.concept} to protect a favored narrative from facts that would embarrass it.`, `${labels[4]} applies the idea better by naming the tradeoff and admitting what ${a0} forbids.`, `The source scene should keep ${ch.concept} narrow instead of letting it claim every possible case.`],
    [`A tense exchange inside ${labels[5]} needs a pause. What pause best honors ${ch.concept}?`, `${labels[5]} should name the motive or wound under the reaction before choosing a reality-facing act.`, `${labels[5]} would stall if every move waited for total blame to land on the other side.`, `The quick-release option treats relief as proof, which ${a1} cannot support.`],
    [`A mentor builds a practice drill around ${a0}. Which design avoids slogan teaching?`, `Use one sourced scene, one live pressure point, and one limit that ${ch.concept} refuses to cross.`, `${a0} would become wall-poster material if learners repeated a phrase until details disappeared.`, `A false drill would promise ${labels[0]} style confidence while hiding the hard part from practice.`],
    [`What conclusion keeps ${ch.concept} strict rather than sentimental?`, `${ch.concept} is useful only when it faces its cost, danger, or boundary in the source scene.`, `${labels[1]} would become fantasy if understanding promised to make discomfort vanish.`, `${a2} does not prove that modern people mostly need louder self-belief.`],
    [`Someone wants a portable test for ${ch.concept}. Which test travels best?`, `${ch.concept} travels when the next act respects reality and dignity now instead of buying later emotional payoff.`, `${labels[2]} would fail the test if allied applause became the measure of truth.`, `${a0} is weakened when a move is chosen merely to make the present less awkward.`],
  ];
  const blooms = ["understand", "apply", "analyze", "evaluate", "analyze", "apply", "create", "evaluate", "apply"];
  const depths = ["standard", "standard", "deep", "standard", "deep", "standard", "deep", "deep", "standard"];
  const explainers = [
    `${labels[0]} keeps ${a0} severe; the other answers drain the source pressure into pep talk or dilution.`,
    `${labels[1]} needs motive-level inspection because ${ch.concept} concerns what steers action, not a quick mood repair.`,
    `${labels[2]} exposes the bad reading: ${ch.concept} trains emotion through meaning without crowning impulse or erasing feeling.`,
    `${labels[3]} shows why evidence must meet valuation; the right answer asks what story makes the behavior feel necessary.`,
    `${labels[4]} would corrupt the idea by protecting convenience. A sound use lets ${a0} embarrass the preferred narrative.`,
    `${labels[5]} needs a pause that names the wound before action; relief, blame, and speed cannot carry ${ch.concept}.`,
    `${a0} becomes decoration unless the drill includes source pressure, a live decision, and a forbidden overreach.`,
    `${a2} keeps the strict edge visible: ${ch.concept} must face cost and boundary rather than promise easy comfort.`,
    `${ch.concept} travels only when the act honors reality now; applause and brief ease are too thin for ${a1}.`,
  ];
  return {
    passingScorePercent: 80,
    questions: prompts.map((p, i) => ({
      questionId: cleanId(ch.n, "q", i + 1),
      prompt: weaveSourceClause(p[0], ch, labels, i, 0),
      choices: choicePack(p[1], p[2], p[3], seq[i]).map((choice, ci) => {
        const woven = weaveSourceClause(choice, ch, labels, i, ci);
        if (i === 7 && ci !== seq[i]) {
          return `${woven} ${weaveSourceClause(`${labels[ci]} still misses ${ch.concept} under ${a0} and ${a2}`, ch, labels, i + ci, ci)}`;
        }
        return woven;
      }),
      correctIndex: seq[i],
      explanation: weaveSourceClause(explainers[i], ch, labels, i, 1),
      bloomsLevel: blooms[i],
      depthLevel: depths[i],
    })),
  };
}

const cardDecks = {
  1: [
    ["Pilecki's hope is what kind of force?", "It is a costly reason to act inside terror, not a sunny mood. Auschwitz keeps the idea tied to witness, resistance, and danger."],
    ["Why do Pinker and Rosling not end despair?", "Their progress data answers material decline, while the ache here asks for meaning, belonging, and a reason that can face death."],
    ["What price does hope charge?", "It marks the present as deficient and asks a future rescue to redeem it. That can move people or trap them in waiting."],
    ["What is the scale problem?", "Every person dies, most memory fades, and the universe does not rank human plans as sacred. Hope is one way people keep moving anyway."],
  ],
  2: [
    ["What did Elliot lose after Damasio's case work?", "Not raw intelligence, but the emotional weight needed to choose. Options remained thinkable without becoming worth acting on."],
    ["Who drives the Consciousness Car?", "The Feeling Brain holds the wheel. The Thinking Brain can map, narrate, and advise, but motive decides the route."],
    ["Why do facts fail against cravings?", "The map may already be known. The driver is chasing relief, safety, pride, or escape, so the meaning of the action has to change."],
    ["What replaces brute self-control?", "Translation: ask what an impulse protects, then frame the better action so the Feeling Brain can cooperate without feeling exiled."],
  ],
  3: [
    ["What opens a moral gap?", "A felt violation of fairness, safety, worth, or order. The punch example makes that unevenness immediate."],
    ["How does the Newton joke help?", "It gives hurt a motion model: action, reaction, inertia, and a strong counterforce that can redirect identity."],
    ["Why can revenge keep the wound alive?", "It may feel like balance while building a self that needs new imbalance. The account stays open under a harsher name."],
    ["What kind of repair changes identity?", "One that lands emotionally: apology, boundary, grief, trustworthy contact, or a new story credible enough to be felt."],
  ],
  4: [
    ["Why is money a useful faith example?", "The bill has little power by itself. Shared belief turns it into labor, trust, status, and exchange."],
    ["What does a God Value do?", "It ranks every lesser value. Once it sits at the top, facts and loyalties are judged by how they serve it."],
    ["How can secular life become religious?", "A movement, romance, brand, or career can offer redemption, rituals, enemies, and belonging without formal worship."],
    ["What is the danger in shared hope?", "A community may defend its machinery more fiercely than the value it first claimed to serve."],
  ],
  5: [
    ["What does God is dead warn about?", "Nietzsche is naming a value vacuum. Old guarantees weaken, but the hunger for meaning remains and seeks substitutes."],
    ["Why are communism and fascism relevant?", "They show secular salvation projects using enemies, martyrs, and promised futures without escaping religious psychology."],
    ["What does amor fati reject?", "The bargain that peace must wait until reality becomes something else. It asks for full contact with the life already here."],
    ["How is this different from nihilism?", "It does not say nothing matters. It says meaning must be made without hating the present as a failed draft."],
  ],
  6: [
    ["What does Kant protect with merely?", "Mutual use is allowed. The violation begins when a conscious being's own ends vanish and only your payoff remains."],
    ["What is moral adulthood here?", "Acting from dignity and principle even when no reward, praise, or future rescue pays for the act."],
    ["How can a person misuse the self?", "By becoming only a resume, body, brand, sacrifice, or production unit for approval and status."],
    ["Why is this not abstract purity?", "Consequences still matter, but no outcome earns the right to make people disposable instruments."],
  ],
  7: [
    ["What does the Blue Dot Effect reveal?", "When a problem becomes rarer, the mind may widen the category and keep finding milder versions of it."],
    ["Why does Durkheim matter here?", "His perfect society thought experiment shows that moral attention survives progress and can magnify tiny deviations."],
    ["What is secondary pain?", "Resentment, shame, panic, or story inflation about pain itself. It adds drama to the original discomfort."],
    ["What makes stress antifragile?", "The scale is chosen, metabolized, and tied to growth. It strengthens capacity rather than merely damaging the person."],
  ],
  8: [
    ["What did Bernays sell besides cigarettes?", "A feeling of independence and rebellion. American Tobacco gained power by attaching smoke to identity."],
    ["How is diversion different from innovation?", "Innovation reduces a real burden or replaces worse pain. Diversion numbs discomfort without increasing maturity."],
    ["Why does Putnam belong in this critique?", "Bowling Alone shows private choice expanding while civic participation and shared duty can thin out."],
    ["What is real freedom in this market?", "The power to refuse attractive stimulation so attention, restraint, and chosen values can survive."],
  ],
  9: [
    ["Why does Deep Blue matter beyond chess?", "Kasparov's loss made machine superiority public in a domain tied to strategy, foresight, and human status."],
    ["What did Alpha Zero intensify?", "Acceleration. Self-play suggested systems could improve through routes that do not resemble familiar human learning."],
    ["How do feeds already mimic authority?", "They rank, hide, reward, and repeat what people see, shaping attention without announcing a moral doctrine."],
    ["What should mature AI serve?", "Truth, dignity, agency, and humane limits. Raw intelligence is not enough if the objective is childish."],
  ],
};

function cardsFor(ch) {
  const pairs = cardDecks[ch.n];
  return pairs.map((p, i) => ({
    cardId: cleanId(ch.n, "card", i + 1),
    front: p[0],
    back: p[1],
    difficulty: ["easy", "easy", "medium", "medium", "hard", "hard"][i],
  }));
}

const plans = {
  1: {
    title: "Audit Hope's Price",
    coreSkill: "Treat hope as a structure with supports and costs. For any hoped-for future, identify the value, the people who validate it, and the present fact it may be helping you avoid.",
    ifThenPlans: [
      { context: "When inspiration smooths out Pilecki", plan: "If courage starts sounding easy, return to Auschwitz, resistance, smuggled reports, escape, and execution." },
      { context: "When progress data feels dismissive", plan: "If better statistics meet despair, separate material gains from the search for meaning." },
      { context: "When ambition promises rescue", plan: "If a future status win must make life count, name the current value that needs care now." },
      { context: "When outrage feels like purpose", plan: "If a shared enemy supplies energy, ask what action or value remains after the thread ends." },
    ],
    twentyFourHourChallenge: "Find one hope you are leaning on today. Write what it helps you do and what present truth it lets you postpone.",
    weeklyPractice: "Each evening, log one hope, its cost, and whether it created present courage or only rented a rescue fantasy.",
  },
  2: {
    title: "Recruit the Driver",
    coreSkill: "Before forcing a plan, locate the feeling at the wheel. Translate the better route into a meaning the Feeling Brain can test without humiliation.",
    ifThenPlans: [
      { context: "When a perfect schedule collapses", plan: "If the map is clean but action stalls, ask what the driver hates about the destination." },
      { context: "When facts fail to change behavior", plan: "If the data is already known, look for relief, pride, fear, or safety underneath the impulse." },
      { context: "When shame writes the rule", plan: "If discipline sounds like punishment, reframe the act as care for a future self." },
      { context: "When a craving takes over", plan: "If the wheel turns toward relief, offer a smaller repair before demanding abstinence." },
    ],
    twentyFourHourChallenge: "Choose one stuck habit and write two columns: what the map says, and what the driver feels.",
    weeklyPractice: "Run a daily Consciousness Car note: destination, driver fear, new meaning, and whether action became easier.",
  },
  3: {
    title: "Close the Moral Gap",
    coreSkill: "Translate emotional intensity into an account of fairness. Ask what balance the hurt is seeking, then choose a repair that does not require revenge or self-erasure.",
    ifThenPlans: [
      { context: "When an insult grows large", plan: "If a small strike becomes a total self-story, identify the dignity gap before answering." },
      { context: "When retaliation feels clean", plan: "If revenge promises balance, list the new debts it would create." },
      { context: "When old pain filters new facts", plan: "If a present cue feels ancient, name the earlier account it is reopening." },
      { context: "When apology is possible", plan: "If repair can be direct, ask for the specific act that closes the account." },
    ],
    twentyFourHourChallenge: "Pick one charged reaction and write the moral gap in one sentence: what reality did versus what felt deserved.",
    weeklyPractice: "Track three gaps during the week and practice one repair that leaves fewer debts behind.",
  },
  4: {
    title: "Name the Top Value",
    coreSkill: "Find the value that silently outranks the rest. Once the God Value is visible, test whether the group is serving it honestly or defending its machinery.",
    ifThenPlans: [
      { context: "When money looks neutral", plan: "If cash feels merely practical, ask what trust, status, and obedience it now commands." },
      { context: "When a cause rejects facts", plan: "If evidence sounds like betrayal, identify the sacred value under threat." },
      { context: "When romance promises salvation", plan: "If love must redeem the whole self, lower the demand back into dignity and care." },
      { context: "When a brand sells belonging", plan: "If buying becomes moral proof, separate the product from the faith system." },
    ],
    twentyFourHourChallenge: "Write the God Value in one current conflict, then list the fact that value least wants to face.",
    weeklyPractice: "Once a day, notice a secular ritual around money, status, politics, romance, or brand identity and name the salvation promise.",
  },
  5: {
    title: "Practice Amor Fati",
    coreSkill: "Stop asking the future to disinfect the present. Affirm the unwanted fact as part of the material, then choose the value available inside it.",
    ifThenPlans: [
      { context: "When God is dead becomes a joke", plan: "If Nietzsche sounds smug, restate the value vacuum he is warning about." },
      { context: "When politics promises purification", plan: "If a future cure needs enemies, watch for secular salvation logic." },
      { context: "When grief seeks a neat lesson", plan: "If pain is being forced into meaning, allow it to remain pain before acting." },
      { context: "When comeback language feels false", plan: "If redemption talk hides humiliation, tell the truth without demanding glory." },
    ],
    twentyFourHourChallenge: "Take one fact you resent and write how you will act honorably with that fact still present.",
    weeklyPractice: "Keep an amor fati page with three entries: unwanted material, chosen value, act made without rescue language.",
  },
  6: {
    title: "Preserve Human Ends",
    coreSkill: "Before using a person, restore their own purpose to the reasoning. Cooperation is welcome; reducing someone to a payoff machine is not.",
    ifThenPlans: [
      { context: "When a spreadsheet hides people", plan: "If names become slots, add voice, limits, and agency before deciding." },
      { context: "When a deal rewards confusion", plan: "If profit grows by shrinking the buyer's understanding, explain the smaller honest option." },
      { context: "When self-sacrifice buys status", plan: "If exposure or praise is the payoff, ask whether you are treating yourself as disposable." },
      { context: "When contempt feels useful", plan: "If humiliation would help your side win, attack the claim without erasing the person." },
    ],
    twentyFourHourChallenge: "Before one request, write both ends: your purpose and the other person's purpose. Revise until both remain visible.",
    weeklyPractice: "Review four interactions and mark where dignity was preserved, traded away, or restored.",
  },
  7: {
    title: "Choose Useful Discomfort",
    coreSkill: "Treat pain as a constant signal to work with, not proof that life is broken. Select small stresses that grow capacity and reject stress that only injures.",
    ifThenPlans: [
      { context: "When categories stretch", plan: "If milder cases start feeling extreme, ask whether the threshold moved like the Blue Dot Effect." },
      { context: "When a tiny offense dominates", plan: "If a small violation feels huge, use Durkheim to right-size the moral scale." },
      { context: "When discomfort creates drama", plan: "If pain arrives, separate the sensation from resentment about having it." },
      { context: "When training crosses a line", plan: "If stress stops building capacity, stop calling it growth and protect recovery." },
    ],
    twentyFourHourChallenge: "Sit with one minor discomfort for two minutes, then write what was sensation and what was story.",
    weeklyPractice: "Plan three chosen stresses for the week: one physical, one social, and one attention practice, each small enough to metabolize.",
  },
  8: {
    title: "Refuse Emotional Capture",
    coreSkill: "Identify the feeling a product, feed, or message is selling. Then decide whether the offered stimulation serves a chosen value or merely rents relief.",
    ifThenPlans: [
      { context: "When identity sells the product", plan: "If the pitch promises liberation or status, ask what practical benefit remains without the costume." },
      { context: "When engagement beats truth", plan: "If the hot post wins, add friction before sharing or ranking it." },
      { context: "When private choice crowds out duty", plan: "If convenience keeps replacing presence, schedule one civic or relational commitment." },
      { context: "When appetite calls itself freedom", plan: "If a limit feels oppressive, ask what deeper yes the limit protects." },
    ],
    twentyFourHourChallenge: "Before one feed session, name the feeling being sought and choose a ten-minute offline act if it is outrage, envy, or numbness.",
    weeklyPractice: "Track five diversions and classify each as innovation, harmless pleasure, or emotional capture.",
  },
  9: {
    title: "Interrogate the Optimizer",
    coreSkill: "Treat every intelligent system as serving an objective. Before obeying a recommendation, ask what it optimizes, what it ignores, and which human end must stay in charge.",
    ifThenPlans: [
      { context: "When machine victory awes the room", plan: "If Deep Blue becomes destiny talk, separate calculation from the value of play." },
      { context: "When acceleration feels magical", plan: "If Alpha Zero speed impresses everyone, name the objective before praising the learning curve." },
      { context: "When a feed feels natural", plan: "If a ranking simply appears, ask which emotion or behavior made it rise." },
      { context: "When AI advice handles a person", plan: "If a score affects someone's life, keep a human dignity check before deciding." },
    ],
    twentyFourHourChallenge: "Audit one recommendation today. Write the likely objective, the omitted value, and your own decision.",
    weeklyPractice: "Once a day, catch an algorithmic nudge and record whether it served truth, dignity, agency, or mere engagement.",
  },
};

function planFor(ch) {
  return plans[ch.n];
}

function chapterJson(ch, idx) {
  return {
    chapterId: `everything-is-fcked-ch${String(ch.n).padStart(2, "0")}`,
    number: ch.n,
    title: ch.title,
    readingTimeMinutes: 12,
    hook: ch.hook,
    counterintuition: ch.counter,
    tryThisNow: ch.now,
    keyTakeaway: ch.takeaway,
    breakdown: {
      fastRead: block(ch.fast),
      deepRead: block(ch.deep),
      fullRead: block(ch.full),
    },
    examples: makeExamples(ch),
    quiz: quizFor(ch, seqs[idx]),
    reviewCards: cardsFor(ch),
    implementationPlan: planFor(ch),
    memorableLines: [
      { text: firstSentence(ch.fast[0]), location: "breakdown.fastRead", why: "It makes the source pressure concrete before the rule appears." },
      { text: firstSentence(ch.deep[0]), location: "breakdown.deepRead", why: "It states the mechanism in a portable sentence." },
      { text: firstSentence(ch.full[ch.full.length - 1]), location: "breakdown.fullRead", why: "It closes on the practical demand of the idea." },
    ],
  };
}

for (const [idx, ch] of chapters.entries()) {
  const path = resolve(outDir, `everything-is-fcked-ch${String(ch.n).padStart(2, "0")}.v21-native.chapter.json`);
  writeFileSync(path, `${JSON.stringify(chapterJson(ch, idx), null, 2)}\n`);
  console.log(path);
}
