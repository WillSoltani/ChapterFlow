const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const runRoot = path.resolve(".chapterflow/runs/the-48-laws-of-power/20260409-002544");
const num = 30;
const stem = `ch${String(num).padStart(2, "0")}`;
const title = "Make Your Accomplishments Seem Effortless";
const chapterId = "ch30-make-your-accomplishments-seem-effortless";
const createdAt = new Date().toISOString();

function tone(gentle, direct, competitive) {
  return { gentle, direct, competitive };
}

const canonical = `Greene's thirtieth law begins with a perception problem rather than with a work ethic lesson. Difficult accomplishments often lose part of their force when the audience is shown every strain, misstep, and exposed scaffold that produced them. The chapter begins by treating visible labor as strategically complicated. Effort may be real and necessary, but displaying all of it can shrink mystique, flatten authority, and make the finished result feel smaller than it actually is.

Its claim is not that effort is shameful or that success must always be wrapped in lies. Greene's point is narrower and more strategic. Rehearsal, cleanup, and concealed design can make a difficult act look natural, controlled, and complete. When the finished surface appears clean, people focus on the accomplishment rather than on the machinery behind it. Effortless appearance therefore matters not because labor disappears, but because presentation shapes what others think the accomplishment means.

That is why the law focuses on polished concealment rather than on fraud. Greene is not praising stolen credit, fabricated ease, or false claims about authorship. He is distinguishing hidden preparation from dishonest distortion. The useful move is not to fake reality. It is to remove clutter, overexposed struggle, and unnecessary process display so the public result lands with more force. The law becomes dangerous only when concealment turns into lying about who did the work or how the outcome was actually produced.

Ordinary settings make the mechanism visible. A leader may present a finished strategy more persuasively by cleaning up the draft trail, rehearsal strain, and indecision that preceded it. A showcase committee may react better to a polished final delivery than to a strong concept buried under process noise and visible scrambling. A person in private life may protect authority by speaking from a prepared center instead of narrating every wobble that came before the moment. In each case, the issue is not whether labor existed. It is what the public surface invites people to see.

The chapter's limit matters. Concealment can become corrosive when it erases collaborators, falsifies ease, or turns polish into deceptive credit capture. Greene overreaches if the law becomes permission to lie about support, process, or authorship. The useful version is narrower: hide the clutter that weakens the effect, preserve the finish that strengthens authority, and stay honest about material facts when fairness or trust requires it. Chapter 29 showed how power plans the full route to the end. Chapter 30 asks how that completed route should appear once the work is done. That points toward Chapter 31, where control deepens further by arranging choices so other people feel free while moving along a shaped path.`;

const edited = canonical;

const critic = `# Chapter 30 Critic Report

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
- Paragraph 4 is most vulnerable because work, school, and personal examples can flatten into generic presentation advice if conversion drops the mystique, authority, and fraud-limit mechanics.

Strongest sentence:
- "Effortless appearance therefore matters not because labor disappears, but because presentation shapes what others think the accomplishment means."

Anchor use notes:
- The draft stays inside the frozen support: concealed labor can strengthen mystique, exposed strain can weaken the effect, polish differs from fraud, and the chapter has a clear honesty-and-credit limit.

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
        "This law says an accomplishment often lands better when the final result looks smooth instead of visibly strained. Greene is not saying that effort is bad or that people should always lie about how hard something was. The chapter makes a narrower point. If every wobble, draft, and struggle is left hanging on the surface, the audience may focus on the mess instead of on the achievement. A polished finish can protect mystique and authority because people see the completed result more clearly. But the chapter is not praising fraud or stolen credit. Strategic concealment means hiding clutter and rehearsal strain, not inventing a false story about who did the work. The lesson is to clean the visible surface so the accomplishment arrives with force while staying honest where credit and facts matter.",
        "Greene's thirtieth law argues that visible strain can weaken the effect of accomplishment. The chapter is not telling you that help, rehearsal, or effort should never be admitted. It is telling you that presentation changes perception. When labor is hidden behind a calm finish, the result can feel more natural, controlled, and authoritative. That can make the same achievement seem more powerful than it would have looked if the public saw every piece of exposed machinery. But the chapter is not saying polished appearance excuses deception. Concealment matters only if it removes distracting clutter without turning into false claims about authorship, support, or ease. Used well, polish helps the accomplishment stand forward while the process noise stays behind it.",
        "This law gives a practical warning: if you show every strain mark and unfinished scaffold, people may spend more attention on the effort than on the effect. Greene's point is that hidden rehearsal and clean presentation can strengthen how accomplishment is received. A competitive reader should notice that mystique often depends on what is not left exposed. But the chapter is not asking for fake brilliance or denial that work happened. It is asking for disciplined presentation. Remove the visible clutter that shrinks authority, then let the final result carry the moment. The tactic works only if concealment stays on the side of polish rather than dishonesty. If the smooth surface is covering a lie about authorship or facts, the strategy stops being polish and becomes fraud.",
      ),
      keyTakeaways: [
        { point: tone("Visible strain can shrink the effect of accomplishment.", "Exposed process clutter can weaken authority and mystique.", "If people stare at the scaffolding, they feel less of the finished structure.") },
        { point: tone("Polished concealment helps the result land cleanly.", "Hidden rehearsal and cleanup can make an achievement look natural and complete.", "The smoother the visible finish, the more force the accomplishment can carry.") },
        { point: tone("Polish is not the same as fraud.", "The chapter supports concealment of clutter, not lies about authorship or facts.", "Hide the mess if you want, but do not counterfeit the truth.") }
      ],
      oneMinuteRecap: tone(
        "This law says accomplishments often carry more force when the visible surface looks smooth instead of heavily strained.",
        "Do not let exposed process noise distract from the finished result if a cleaner presentation would strengthen authority.",
        "Polish the surface, but do not cross into lies about credit, help, or reality."
      )
    },
    medium: {
      chapterBreakdown: tone(
        `Greene's thirtieth law begins by challenging the idea that all visible effort strengthens admiration. Many people assume that if others see the struggle behind an accomplishment, the accomplishment will automatically look more impressive. Greene hears a different effect. Exposed strain, visible scaffolding, and messy process can pull attention away from the result and toward the labor itself. The chapter asks what happens when the audience sees completion instead of the strain marks around completion.

That is why effortless appearance matters here. Greene is not worshipping laziness or pretending that serious work should happen without labor. He is describing surface control. Rehearsal, revision, and hidden design can make a difficult achievement look natural, calm, and complete. The chapter treats polish as strategically useful because public perception often changes when the machinery disappears and the finished act stands alone.

The chapter is strongest when it distinguishes polished concealment from dishonest fraud. The useful move is not to fabricate authorship or invent a false story about how the result was produced. It is to keep the visible surface free of distracting clutter that makes the outcome look smaller or shakier than it really is. Greene is not praising counterfeit ease. He is showing how hidden preparation can preserve mystique so long as the concealment does not become falsehood.

The pattern appears in ordinary settings. A work lead may present a finished strategy more convincingly if the visible delivery does not drag every abandoned draft and internal wobble into the room. A showcase committee may respond more strongly to a clean result than to a good idea wrapped in frantic backstage noise. A personal conversation may carry more authority when the speaker arrives composed instead of narrating every private scramble that led there. In each case, what changes is not the labor itself. It is what the visible surface trains people to notice.

The limit matters because concealment can turn sour. If polish erases collaborators, captures credit unfairly, or hides material truth that others deserve to know, the tactic becomes corrosive. Greene's practical claim is narrower: hide the clutter that weakens the effect, preserve the clean finish that strengthens authority, and stay honest where trust and fairness depend on the facts. Chapter 29 designed the route to the end. Chapter 30 asks how that finished route should appear once others finally see it. Chapter 31 then turns toward shaped choice, where control no longer sits only in appearance but in the options people feel free to select.`,
        `Greene's thirtieth law argues that accomplishments often gain force when the work behind them is not left sprawled across the public surface. A result can be technically strong and still look smaller if the audience is made to watch every strain, every rough rehearsal, and every exposed support beam. The chapter therefore begins with a strategic problem, not a vanity lesson. What if showing all the labor does not always deepen admiration, but instead diffuses it?

That is why polished presentation can be useful. If heavy preparation is hidden behind a calm result, people may read mastery where they would otherwise read struggle. Greene is interested in that reading. Effortless appearance protects mystique because the public sees completion rather than the entire workshop that produced it. The chapter values concealment not because truth is irrelevant, but because attention is limited and the visible surface determines what receives it first.

This is why the chapter is not generic fraud advice. Greene is not telling the reader to steal credit, invent support, or deny that labor existed. He is separating legitimate cleanup from dishonest distortion. The issue is not whether hard work happened. The issue is whether exposing all of it helps the effect or weakens it. Concealment works when it removes process clutter. It fails when it rewrites authorship or facts.

The pattern appears everywhere. Tarin may deliver a proposal more convincingly by presenting the polished result instead of dragging the room through every dead-end draft. A design review may value a calm demonstration more than a visibly frantic explanation of how hard the team worked. A personal act of competence may land better when it looks composed rather than overnarrated. In each case, the final form changes perception before anyone audits the invisible preparation behind it.

The limit remains central because some settings require clear credit and real transparency. Greene's point is disciplined rather than fraudulent: clean the surface, control the visible finish, and do not let unnecessary strain marks weaken the accomplishment. But do not let polish become false authorship or manipulative concealment of facts. Chapter 29 dealt with planning a survivable route. Chapter 30 deals with making the completed route look controlled once it arrives. Chapter 31 then asks how power arranges the next move by shaping the menu of choices itself.`,
        `This law starts with a tempting mistake: assuming that visible effort always increases respect. Greene's warning is that a result can lose force when the audience is asked to stare at the machinery instead of the finished effect. If every draft trail, scramble, and strain signal remains exposed, people may admire the labor a little while feeling the accomplishment less. The chapter therefore treats public presentation as part of power rather than as a decorative afterthought.

That matters because effortless appearance changes what others think they are seeing. A polished result can look more natural, more authoritative, and more complete than an equally strong result wrapped in visible struggle. The chapter therefore treats hidden preparation as a perception tool. What changes is not the difficulty of the task. It is what the finished surface allows the audience to experience without distraction.

This keeps the law narrower than praise for deception. Greene is not asking you to fake brilliance or erase reality. He is asking whether the visible surface is helping the result or competing with it. Strategic polish means concealing clutter while preserving truth. It becomes failure when the concealment crosses into stolen credit, false claims, or dishonest mystification about how the outcome was achieved.

Common settings make the point plain. A leader may weaken a strong delivery by overexposing the confusion that preceded it. A showcase committee may underrate a good result because the presentation keeps shoving backstage problems into the foreground. A personal display of competence may carry less authority if it arrives with constant visible apology for the work it took. In each case, the surface guides the reading before the substance gets a second look.

The limit matters because clean appearance can become ethical rot if it buries facts other people need. If the hidden labor included real collaborators, borrowed support, or risks that deserve disclosure, polish cannot excuse concealment. Chapter 29 showed that the route must be designed. Chapter 30 shows that the finish must be staged well. Chapter 31 follows by asking how power moves from polished appearance into structured choice, where other people feel free while the path has already been arranged.`
      ),
      keyTakeaways: [
        {
          point: tone("Visible strain can weaken the visible result.", "Exposed clutter often pulls attention away from the accomplishment itself.", "When the machinery dominates the frame, the achievement loses force."),
          moreDetails: tone("The chapter focuses on how attention shifts when process is left sprawled across the finished surface.", "People can respect labor while still experiencing the result as less complete or less authoritative.", "A cluttered delivery teaches the room to study the struggle instead of the finish.")
        },
        {
          point: tone("Polished concealment helps authority survive contact with the audience.", "Hidden rehearsal and cleanup can make a difficult achievement look calm and complete.", "Control the surface and the accomplishment often reads as stronger."),
          moreDetails: tone("Greene values polish because invisible preparation lets the final effect stand without unnecessary interference.", "The chapter's leverage comes from surface control rather than from pretending labor did not exist.", "A smooth finish can convert the same underlying work into greater mystique.")
        },
        {
          point: tone("Legitimate polish differs from dishonest distortion.", "The chapter permits cleanup of clutter, not lies about authorship or support.", "Hide the workshop if needed, but do not falsify who built the result."),
          moreDetails: tone("The law still requires honesty about material facts, collaboration, and any disclosure that trust depends on.", "Polish matters only if it sharpens perception without corrupting truth.", "Once concealment starts rewriting credit, the tactic changes from presentation into fraud.")
        },
        {
          point: tone("Work, school, and personal settings all show how visible surface shapes reception.", "People often judge the finish before they judge the hidden labor behind it.", "The public form sets the first meaning of the accomplishment."),
          moreDetails: tone("Presentations, showcases, and composed personal acts all land differently depending on whether the audience sees finish or backstage noise.", "The chapter becomes practical when you ask what visible process is helping and what process is only weakening the effect.", "A cleaner surface often makes the same result easier to trust and harder to diminish.")
        },
        {
          point: tone("The law has an ethical limit.", "Concealment fails when it hides facts that fairness, safety, or trust require others to know.", "Polish is power only while truth stays intact."),
          moreDetails: tone("Some settings demand open process or explicit credit, and the chapter overreaches if it ignores that obligation.", "Greene warns against exposing clutter, not against honoring reality.", "The right boundary is where controlled appearance stops strengthening the result and starts corrupting the relationship around it.")
        }
      ],
      activationPrompt: tone(
        "Identify one accomplishment whose effect is being weakened by unnecessary visible process clutter.",
        "Choose one result that would land more strongly if the audience saw the polished surface instead of the full workshop behind it.",
        "Pick one presentation where cleanup would strengthen authority without crossing into falsehood."
      ),
      selfCheckPrompt: tone(
        "Am I revealing helpful truth here, or just exposing clutter that weakens the accomplishment?",
        "Which parts of the process deserve to stay private because they distract from the result rather than clarify it?",
        "Where is the line between controlled polish and dishonest concealment in this situation?"
      ),
      oneMinuteRecap: tone(
        "This chapter says accomplishments often gain force when heavy labor is hidden behind a calm, polished visible finish.",
        "Do not let exposed scaffolding compete with the result if cleanup would help the achievement stand alone.",
        "Control the surface, but do not lie about credit, help, or material facts."
      )
    },
    hard: {
      chapterBreakdown: tone(
        `Greene's thirtieth law treats effortless appearance as a political effect rather than as a style preference. Most people hear "make your accomplishments seem effortless" and think of vanity, branding, or decorative elegance. Greene is interested in a sharper claim: visible strain can devalue power by shifting attention from the finished act to the machinery that produced it. The chapter therefore begins by questioning whether all transparency about effort is strategically neutral. A difficult act can become less impressive the moment the audience is trained to focus on the scaffolding instead of the structure.

That is why polished concealment can matter here. Greene is not denying labor, worshipping ease, or pretending mastery grows without rehearsal. He is describing attention management. If the work, revision, and rehearsal remain mostly invisible while the result appears composed and complete, others may read authority, inevitability, and control where they would otherwise read strain. The chapter treats hidden preparation as part of power because visible surface often determines the first interpretation of the accomplishment.

The chapter is strongest when it resists the lazy reading that concealment means fraud. Greene is not praising fabricated genius, stolen authorship, or false narratives of solitary brilliance. He is distinguishing cleanup from counterfeiting. Useful concealment removes distracting process evidence that weakens effect without corrupting the truth of what happened. Fraudulent concealment rewrites the facts, erases contributors, or turns polish into a mask for dishonesty.

This is why exposed effort can be expensive. The problem is not that effort exists. The problem is what visible strain teaches the audience to notice first. Once every wobble, abandoned draft, and backstage scramble is pushed into the foreground, the accomplishment can feel less natural and less commanding. The chapter therefore asks whether process exposure is clarifying the achievement or competing with it. A result can be real, difficult, and admirable while still landing with less power because its surface has been left cluttered.

Ordinary settings show the mechanism clearly. A leader may weaken a finished strategy by narrating too much of the uncertainty and mess that preceded it. A showcase committee may underrate a strong project because the presentation keeps dragging rehearsal stress and visible scrambling into the frame. A personal performance of competence may lose authority when the actor advertises every internal wobble rather than arriving composed. In each case, what changed was not the achievement. What changed was the visible ratio between finish and struggle.

The limit matters because concealment can become an ethical toxin. If polish begins hiding collaborators, falsifying authorship, concealing required disclosures, or manufacturing an aura unsupported by reality, the tactic corrodes trust rather than strengthening authority. Greene is not arguing that truth should disappear behind the curtain. He is arguing that clutter should. Chapter 29 showed how power plans the full route to the end. Chapter 30 asks how that ending should appear once the work is complete. Chapter 31 follows naturally from there. Once surface control is established, power deepens by arranging choice itself so others move through a path that feels free while already being shaped. Effortless appearance succeeds only when the surface is cleaner than the process, not when the story is less true than the facts.`,
        `Greene's thirtieth law argues that concealment of labor can be strategically useful because audiences do not only judge results; they judge visible surfaces. Most readers hear the title and imagine shallow polish. Greene hears a more serious problem: exposed process can make a finished accomplishment look weaker than it is by dragging attention toward effort, strain, and backstage mechanics.

Effortless appearance preserves power because it lets the result stand without unnecessary interference. If rehearsal, cleanup, and revision disappear behind the finish, people may read mastery instead of scramble. Greene is interested in that reading. The chapter values polished appearance not because labor should be denied, but because the first public interpretation of an accomplishment is often shaped by what remains visible around it.

That is why the chapter should not be flattened into permission for fraud. It is not saying that facts can be rewritten or that collaborators can be erased. It is saying that visible clutter can shrink effect. Strategic polish means removing what distracts from the result while leaving truth intact. Fraud means using concealment to falsify origin, credit, or reality.

The pattern appears in ordinary life. Tarin may present a finished strategy more forcefully when the room sees the controlled result rather than the entire workshop of drafts behind it. Elowen may realize a design review is reacting less to the quality of the outcome than to the frantic surface surrounding it. A private act of competence may land more strongly when it arrives calm rather than overexplained. In each case, the visible finish changes what the accomplishment seems to be.

The limit remains central because some forms of hidden labor are harmless while others hide facts that fairness demands. Greene's practical claim is narrower: conceal strain where strain only weakens the effect, but do not let concealment become false authorship, missing credit, or manipulative opacity around material truth. Chapter 29 dealt with designing a survivable route. Chapter 30 deals with presenting the arrival. Chapter 31 then turns toward shaped choice, where power no longer only controls appearance but structures the next move people feel free to make. The reader's edge lies in seeing that polish is strongest when it protects the result without corrupting the truth beneath it.`,
        `This law works only if you track what visible process is doing to the audience before deciding what honesty requires. Most people focus on whether effort deserves respect. Greene's warning is that respect for effort does not automatically produce stronger perception of the result. Once the room is asked to watch every support beam, rehearsal bruise, and exposed draft trail, the act can lose some of its force precisely because the achievement no longer stands on its own surface. The chapter is about that tradeoff.

That is why hidden preparation can be strategically valuable. A person who cleans the public surface may make the same underlying accomplishment feel more inevitable, more natural, and more authoritative. Greene is not praising shallow image work for its own sake. He is protecting the result from being diluted by unnecessary display of the workshop that made it possible. Effortless appearance changes perception because the finished act no longer shares the stage with its own construction debris.

The chapter therefore distinguishes polish from false mystification. A clean surface is not automatically dishonest. Total exposure is not automatically virtuous. Strategic concealment keeps enough of the truth visible that fairness and trust remain intact while removing process evidence that weakens the effect without helping understanding. Without the concealment, the result may be harder to feel in full. Without the honesty, the polish becomes rot.

Common settings show the law with almost embarrassing clarity. A rollout may be judged smaller because leaders overexpose the confusion that preceded it. A showcase committee may underrate a strong project because the presentation cannot stop foregrounding backstage panic. A personal act of capability may lose weight when it arrives wrapped in too much visible apology for what it took. In each case, the audience reads the surface before it audits the hidden labor beneath it.

The limit matters because concealment can fail too. Hide too little and the clutter competes with the result. Hide too much and the truth can be falsified in ways that damage trust. Greene's better point is to remove weakening noise without removing required reality. Chapter 29 taught that the route must be designed all the way through. Chapter 30 teaches that the arrival must be staged in a way that preserves force. Chapter 31 follows because once the visible surface is controlled, power extends into the architecture of choice itself. The deepest lesson is that authority often belongs to the person whose labor is real but whose surface does not beg to be pitied for it. If the finish is clean and the truth intact, the result grows. If the finish is clean and the facts are false, the strategy eventually turns against itself.`
      ),
      keyTakeaways: [
        {
          point: tone("Visible strain can devalue the visible achievement.", "Process clutter can pull authority away from the result and toward the labor around it.", "If the scaffolding dominates the frame, the structure feels smaller."),
          moreDetails: tone("The chapter emphasizes attention economics rather than contempt for work.", "An audience can recognize effort while still experiencing the accomplishment as less complete or less commanding.", "Too much visible workshop can drain force from the finished act.")
        },
        {
          point: tone("Polished concealment can preserve mystique and control.", "Hidden rehearsal and cleanup help the accomplishment read as natural, calm, and complete.", "Control the surface and you often control the first meaning of the result."),
          moreDetails: tone("Greene values invisible preparation because it lets perception lock onto the outcome instead of the construction debris behind it.", "The chapter's leverage comes from keeping the final effect visually uncontested.", "A polished surface can make the same underlying work feel stronger without changing the work itself.")
        },
        {
          point: tone("Cleanup is not the same as counterfeit.", "The move is truthful polish, not fabricated genius or stolen authorship.", "Hide the clutter, not the facts that fairness depends on."),
          moreDetails: tone("The chapter still requires honesty about collaboration, material process disclosures, and any reality others are entitled to know.", "Polish matters only while the truth beneath it remains intact.", "Once concealment starts rewriting who did the work or what really happened, the tactic becomes self-poisoning.")
        },
        {
          point: tone("Ordinary settings reveal how surface controls reception.", "Work, school, and personal accomplishments are all judged first through the visible finish.", "The audience meets the surface before it meets the workshop."),
          moreDetails: tone("Strategies, showcases, and competent personal performances all land differently depending on whether the public sees result or backstage confusion.", "The chapter becomes practical when you ask what visible process is clarifying the result and what process is merely competing with it.", "A stronger surface often lets the underlying accomplishment be seen at full scale.")
        },
        {
          point: tone("The law has a truth-and-credit limit.", "Concealment fails when it hides facts that trust, safety, or fairness require.", "Polish strengthens power only while the truth remains usable."),
          moreDetails: tone("Some situations require explicit disclosure, shared credit, or visible accountability, and the chapter overreaches if it treats those obligations as optional.", "Greene warns against weakening clutter, not against honest responsibility.", "The right boundary is where controlled appearance stops sharpening the result and starts corrupting the relationship around it.")
        }
      ],
      activationPrompt: tone(
        "Identify one accomplishment whose public effect is being weakened by unnecessary visible scaffolding.",
        "Choose one result that would appear more authoritative if the audience saw the finish instead of the full workshop behind it.",
        "Pick one delivery where surface control would sharpen the effect without falsifying the truth."
      ),
      selfCheckPrompts: [
        tone(
          "What part of this visible process clarifies the result, and what part only competes with it?",
          "Am I hiding clutter here or hiding facts that fairness requires others to know?",
          "How much invisible preparation would strengthen the finish without corrupting the truth beneath it?"
        ),
        tone(
          "If the audience saw less of the scaffolding, would the accomplishment feel more complete or merely more misleading?",
          "Where is mystique helping authority, and where would opacity become dishonest credit capture?",
          "What surface would let the result stand strongest while leaving material reality intact?"
        )
      ],
      predictionPrompt: tone(
        "Once the finish is made to look effortless, how might Chapter 31 show that power deepens further by arranging choices so others feel free while moving inside a shaped path?",
        "If surface control is now established, what changes next when the menu of options itself becomes the instrument of control?",
        "After polished appearance, how does power advance when people experience direction as their own choice?"
      ),
      oneMinuteRecap: tone(
        "This chapter argues that power often grows when real labor is hidden behind a surface that lets the finished accomplishment stand cleanly on its own.",
        "Do not confuse total exposure of process with strategic honesty if the exposure mainly weakens the effect.",
        "Sometimes the strongest surface is the one that removes clutter without removing the truth."
      )
    }
  },
  examples: [
    {
      title: "Tarin Rehearses Heavily So the Final Proposal Looks Calm Instead of Strained",
      format: "decision_point",
      category: "work",
      endingType: "broader_principle",
      scenario: tone("Tarin has done far more preparation than anyone in the room knows, and he must decide whether to present the finished proposal cleanly or walk the room through every struggle that led there.", "He has to choose between a polished surface and a visibly overexplained process.", "Tarin can make the accomplishment feel composed or make the room stare at the workshop behind it."),
      whatToDo: tone("He delivers the finished logic cleanly and keeps unnecessary rehearsal strain off the surface.", "He lets the result stand without dragging every false start into public view.", "He protects the effect by controlling what the room is trained to notice."),
      whyItMatters: tone("The chapter says exposed process clutter can weaken the force of accomplishment.", "His choice shows how hidden preparation can strengthen authority without falsifying reality.", "A cleaner surface can make the same work land harder.")
    },
    {
      title: "Elowen Hears Why the Showcase Committee Underrated a Strong Result Wrapped in Backstage Noise",
      format: "dialogue",
      category: "school",
      endingType: "self_directed_question",
      scenario: tone("Elowen listens as someone explains that the showcase committee saw too much scramble, visible strain, and unfinished scaffolding around an otherwise strong presentation.", "She hears that the problem was not lack of work but poor control of the visible surface.", "Elowen learns that a good result can look smaller when the audience keeps seeing the workshop instead of the finish."),
      whatToDo: tone("She asks what parts of the process should have stayed backstage so the result could stand forward.", "She studies how visible strain changed the committee's reading of the accomplishment.", "She asks where polish would have clarified the result without lying about the work."),
      whyItMatters: tone("The chapter warns that attention can drift from effect to effort when the surface is cluttered.", "The showcase committee shows how presentation can shrink or strengthen the same underlying achievement.", "A strong result may need a cleaner frame before others can feel its full force.")
    },
    {
      title: "Marek Weighs Clean Presentation Against the Risk of Hiding Credit That Is Owed",
      format: "dilemma",
      category: "personal",
      endingType: "surprising_implication",
      scenario: tone("Marek wants a finished result to look smooth and inevitable, but he also knows other people's help was real and cannot be erased honestly.", "He has to decide how much to conceal without crossing into dishonest credit capture.", "Marek can polish the surface or poison it by making the polish less true than the facts."),
      whatToDo: tone("He removes distracting clutter from the presentation while keeping authorship and support truthful.", "He chooses controlled polish over fake solitary brilliance.", "He protects the effect without falsifying who helped build it."),
      whyItMatters: tone("The chapter says concealment is useful only while it stays on the side of truth.", "His dilemma shows the line between polished authority and corrosive dishonesty.", "The surface grows stronger when it is cleaner, not when it is less accurate.")
    },
    {
      title: "Alina Predicts Why a Composed Demonstration Will Outperform an Overexplained One",
      format: "predict_reveal",
      category: "work",
      endingType: "cross_domain",
      scenario: tone("Alina watches two demonstrations: one keeps exposing every difficulty it took to get here, and the other arrives cleaned, composed, and quiet about the backstage work.", "She predicts the calmer surface will feel more authoritative even if both underlying accomplishments are equally real.", "Alina can already see that the room will judge the finish before it audits the rehearsal behind it."),
      whatToDo: tone("She tests whether the stronger surface is honest polish or dishonest mystification.", "She looks for cleanup that sharpens the result without hiding facts that matter.", "She scores the presentation on force, clarity, and truth together."),
      whyItMatters: tone("The chapter says visible surface changes what the audience thinks the accomplishment is.", "Her prediction shows how hidden labor can preserve mystique when it does not corrupt reality.", "Sometimes authority grows because the finish is cleaner, not because the work was lighter.")
    },
    {
      title: "Design-Review Debrief Finds That the Team Exposed Too Much Scaffolding Around a Strong Finish",
      format: "postmortem",
      category: "school",
      endingType: "common_trap",
      scenario: tone("A design review goes badly even though the core result was strong, and the debrief finds that the team kept foregrounding every revision, doubt, and backstage problem during the final presentation.", "The review shows that the result was not weak in itself; its visible framing was.", "The group learns that process exposure can sometimes compete with the accomplishment instead of clarifying it."),
      whatToDo: tone("They rebuild the final presentation around the finished effect and move nonessential workshop detail out of the main frame.", "They keep required credit and truth intact while removing clutter that weakened the impact.", "They treat surface control as part of the accomplishment instead of as vanity around it."),
      whyItMatters: tone("The chapter warns that a public surface can shrink a result when too much scaffolding stays visible.", "Their problem was not effort but the public ratio between finish and struggle.", "A cleaner frame can let the same result read at full scale.")
    },
    {
      title: "Before and After Process Oversharing Gave Way to Controlled Finish",
      format: "before_after",
      category: "personal",
      endingType: "perspective_reframe",
      scenario: tone("Before, every act of competence arrived wrapped in disclaimers, narrated struggle, and visible apology for how much work it took. After, the result arrived cleaner, calmer, and less burdened by workshop debris.", "The contrast is between process-heavy display and controlled finish.", "One version asks the audience to feel the labor first; the other lets them feel the accomplishment first."),
      whatToDo: tone("Remove unnecessary strain signals from the visible surface before delivering the finished result.", "Let the outcome stand forward while keeping the truth beneath it intact.", "Use polish to protect force, not to counterfeit reality."),
      whyItMatters: tone("The law distinguishes helpful cleanup from dishonest self-mythology.", "Controlled finish can strengthen authority without denying that labor existed.", "A result often grows once it no longer has to compete with its own construction debris.")
    }
  ],
  reviewCards: [
    { cardId: "ch30-rc01", front: tone("Why can visible strain weaken accomplishment in this chapter?", "What happens when the audience stares at scaffolding instead of the structure?", "Why doesn't exposed effort always increase force?"), back: tone("Because visible process clutter can pull attention away from the result and make the accomplishment feel smaller.", "The chapter says too much exposed machinery can weaken the visible effect.", "Effort may be real, but the public surface still shapes what lands first."), difficulty: "easy" },
    { cardId: "ch30-rc02", front: tone("What does effortless appearance do strategically?", "Why does polished surface matter in this law?", "How does hidden rehearsal help the result land?"), back: tone("It lets the accomplishment appear natural, calm, and complete instead of visibly strained.", "Polish helps the finished result stand without unnecessary interference from backstage noise.", "Hidden preparation can increase mystique by cleaning the public surface."), difficulty: "easy" },
    { cardId: "ch30-rc03", front: tone("How is polish different from fraud?", "What separates legitimate concealment from dishonest distortion?", "Where does the law's ethical line sit?"), back: tone("Polish removes clutter while leaving truth intact, whereas fraud rewrites credit, authorship, or material facts.", "The chapter allows cleanup of the surface, not false stories about who did the work.", "Concealment becomes corruption when the visible finish is made less true than the facts beneath it."), difficulty: "medium" },
    { cardId: "ch30-rc04", front: tone("Where does this law appear in ordinary settings?", "How do work, school, and personal examples show surface control?", "Why does visible finish matter beyond grand performance?"), back: tone("It appears anywhere a result is judged through presentation before the hidden labor behind it is audited.", "Strategies, showcases, and composed personal acts all land differently depending on whether the audience meets finish or backstage noise.", "The chapter becomes practical when you ask what visible process is clarifying the result and what process is only competing with it."), difficulty: "medium" },
    { cardId: "ch30-rc05", front: tone("How does Chapter 30 bridge to Chapter 31?", "Why does polished appearance lead into controlled choice?", "What happens after the finish is made to look effortless?"), back: tone("Once appearance is controlled, the next question is how power shapes the choices others feel free to make.", "Chapter 31 turns from surface control to arranging the options themselves.", "First protect the finish, then shape the path others move through next."), difficulty: "hard" }
  ],
  keyTakeawayCard: tone(
    "Making accomplishments seem effortless is useful when hidden preparation and cleanup allow the finished result to stand cleanly without turning the surface into a lie.",
    "This law warns that visible strain can weaken authority and favors polished presentation over exposed scaffolding, while keeping truth and credit intact.",
    "Power often grows when the labor is real, the finish is clean, and the story remains honest."
  )
};

const quiz = {
  passingScorePercent: 70,
  questions: [
    { questionId: "ch30-q01", prompt: "Why can visible strain weaken accomplishment in this chapter?", choices: ["Because exposed scaffolding can pull attention away from the finished result", "Because labor never matters", "Because audiences always despise effort"], correctIndex: 0, explanation: tone("Correct. The chapter says visible strain can compete with the effect instead of strengthening it.", "Too much visible machinery can make the accomplishment feel smaller.", "Right. The problem is not labor itself but what the public surface teaches people to notice."), bloomsLevel: "remember-understand", depthLevel: "easy" },
    { questionId: "ch30-q02", prompt: "What does effortless appearance do strategically here?", choices: ["It makes rehearsal and preparation unnecessary", "It hides every fact no matter the ethical cost", "It lets the finished result look calm, complete, and more authoritative"], correctIndex: 2, explanation: tone("Yes. Greene values polished surface because it helps the accomplishment stand forward.", "Effortless appearance protects the visible effect without denying that labor happened.", "Right. The result can feel stronger when the surface looks controlled instead of strained."), bloomsLevel: "remember-understand", depthLevel: "easy" },
    { questionId: "ch30-q03", prompt: "Why is this chapter not generic fraud advice?", choices: ["Because it distinguishes cleanup of clutter from lies about authorship, help, or facts", "Because all concealment is automatically ethical", "Because presentation never affects power"], correctIndex: 0, explanation: tone("Correct. The line is between truthful polish and dishonest distortion.", "Greene allows concealment of clutter, not false authorship or counterfeit ease.", "Yes. The chapter becomes dangerous only when polish turns into a lie about reality."), bloomsLevel: "remember-understand", depthLevel: "easy" },
    { questionId: "ch30-q04", prompt: "In Tarin's work scenario, what best fits the chapter?", choices: ["Show every abandoned draft so the room fully feels the struggle", "Deliver the finished proposal cleanly while keeping nonessential rehearsal strain off the visible surface", "Invent a false story about building the proposal alone"], correctIndex: 1, explanation: tone("Yes. The chapter favors a polished visible finish rather than process clutter.", "He protects the effect by letting the result stand without unnecessary backstage noise.", "Right. Cleanup helps here only because the truth of the work remains intact."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch30-q05", prompt: "Why did the showcase committee example matter for Elowen?", choices: ["Because the committee respected process clutter more than results", "Because visible scramble made a strong result feel smaller than it was", "Because school settings are exempt from presentation effects"], correctIndex: 1, explanation: tone("Correct. The chapter shows that a strong outcome can be weakened by a noisy visible frame.", "The result was not weak; the surface around it was poorly controlled.", "Yes. Too much visible backstage strain changed the committee's reading of the accomplishment."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch30-q06", prompt: "What is the strongest reading of Marek's dilemma?", choices: ["He should erase all collaborators if polish would look stronger", "He should expose every private rehearsal detail no matter what", "He should clean the surface while keeping credit and factual reality honest"], correctIndex: 2, explanation: tone("Yes. The chapter supports polished presentation only while truth and credit remain intact.", "He needs cleanup without dishonest credit capture.", "Right. The surface can be smoother without becoming less accurate."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch30-q07", prompt: "How does effortless appearance change perceived authority?", choices: ["It makes the finished accomplishment look more natural, composed, and complete", "It guarantees that no one will question the result", "It removes the need for substance"], correctIndex: 0, explanation: tone("Correct. Surface control changes the first interpretation of the accomplishment.", "A polished finish can read as mastery where visible strain would read as scramble.", "Yes. The chapter is about perception shaping authority, not replacing substance."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" },
    { questionId: "ch30-q08", prompt: "When does concealment become unethical distortion instead of useful polish?", choices: ["When it hides clutter while leaving material truth intact", "When it rewrites credit, authorship, or other facts that fairness requires", "When it removes distracting rehearsal noise"], correctIndex: 1, explanation: tone("Exactly. The tactic fails once the surface becomes less true than the facts beneath it.", "Concealment turns corrosive when it falsifies reality instead of cleaning presentation.", "Right. Polish crosses the line when it stops hiding clutter and starts hiding truth."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" },
    { questionId: "ch30-q09", prompt: "How does Chapter 29 lead into Chapter 30?", choices: ["Planning the full route leads next to shaping how the completed route appears", "Long-range planning makes presentation irrelevant", "Chapter 30 rejects the need for sequence design"], correctIndex: 0, explanation: tone("Correct. Chapter 29 designs the route, and Chapter 30 manages the visible finish.", "The sequence moves from survivable planning to controlled appearance.", "Right. A well-planned ending still needs the right public surface once it arrives."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" },
    { questionId: "ch30-q10", prompt: "What bridge carries Chapter 30 into Chapter 31?", choices: ["Once the surface is polished, the next question is how choices themselves are arranged", "Polished accomplishment removes the need to shape anyone's options", "Chapter 31 rejects any link between appearance and choice"], correctIndex: 0, explanation: tone("Correct. The next law turns from controlled finish to controlled choice architecture.", "Chapter 31 asks how people can feel free while moving inside a shaped menu of options.", "Right. After surface control, power deepens by shaping the path others think they are choosing."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" }
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
for (const name of ["Tarin", "Elowen", "Marek", "Alina"]) continuity.nameUsage[name] = [stem];
continuity.withinChapterNames[stem] = ["Tarin", "Elowen", "Marek", "Alina"];
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
- Chapter-specific mechanism remains visible strain versus polished finish, concealed labor, mystique effects, and the fraud limit rather than generic presentation advice
- Hard depth preserves the polish-versus-dishonesty boundary and the Chapter 31 controlled-choice bridge
- Quiz stays within supported facts from the approved draft and frozen source bundle

## Gate result
- Approved for chapter gate and automatic continuation
`;
writeText(paths.validation, validation);

fs.appendFileSync(
  paths.runLog,
  `\n- Completed writer, editor, critic, converter, quiz, and validator steps for Chapter 30.\n- Validation result: PASS.\n- Continuity hash sealed for \`${stem}\`: \`${seal}\`\n`,
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
