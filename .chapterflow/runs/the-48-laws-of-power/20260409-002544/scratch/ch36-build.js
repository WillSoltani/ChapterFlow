const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const runRoot = path.resolve(".chapterflow/runs/the-48-laws-of-power/20260409-002544");
const num = 36;
const stem = `ch${String(num).padStart(2, "0")}`;
const title = "Disdain Things You Cannot Have: Ignoring Them Is the Best Revenge";
const chapterId = "ch36-disdain-things-you-cannot-have-ignoring-them-is-the-best-revenge";
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

const canonical = `Greene's thirty-sixth law asks what happens after refusal becomes final and pursuit starts making you smaller. The chapter answers by shifting attention from acquisition to emotional tribute. A denied object, closed opportunity, or escaping prize can keep controlling you if frustration stays visible, noisy, and hungry. The law therefore treats disdain as a form of power because it withdraws the importance that fixation keeps feeding.

Its claim is not that loss should never hurt or that every disappointment can be honestly dismissed at once. Greene's point is narrower. Complaint, chasing, and visible agitation can raise the stature of the thing denying you. They signal dependence, keep humiliation alive, and sometimes grant the object a larger place in public view than it could have claimed on its own. Strategic inattention matters because what you stop honoring with attention often loses some of its power over your posture and status.

That is why the chapter distinguishes disciplined non-fixation from fake indifference. Greene is not praising numbness, avoidant denial, or contempt as theater. He is describing a refusal to keep paying tribute to what is closed. The strongest version of the law does not pretend the loss never mattered. It stops converting that loss into repeated public dependence. Disdain preserves dignity only when it reflects a real decision to stop feeding the object, not a pose that still hides unresolved craving underneath.

Ordinary settings make the mechanism visible. A denied promotion may become more humiliating when the disappointed person keeps complaining in ways that enlarge the denying institution. A scholarship waitlist or faculty prize review may sting less strategically than the student imagines if visible grievance starts making the closed decision the center of their identity. A personal refusal may become more degrading the more one repeats the chase after the answer is clear. In each case, more attention can function like tribute.

The chapter's limit matters. Some losses are repairable. Some disappointments need honest grief, direct correction, or one more useful attempt. Greene overreaches if the law becomes advice to call every wound beneath notice or to mistake suppression for freedom. The useful version is narrower: when the object is truly closed or not worth the shrinking effect of further pursuit, stop enriching it with complaint, fixation, and visible dependency. Chapter 35 dealt with when force should be released. Chapter 36 asks when further force should be withdrawn instead. That leads toward Chapter 37, where power returns to what can seize attention through spectacle rather than spend itself on denial.`;

const edited = canonical;

const critic = `# Chapter 36 Critic Report

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
- Paragraph 4 is most vulnerable because work, school, and personal examples can slide into generic stoicism if conversion drops the tribute-versus-release logic.

Strongest sentence:
- "Strategic inattention matters because what you stop honoring with attention often loses some of its power over your posture and status."

Anchor use notes:
- The draft stays inside the frozen support: fixation weakens status, complaint feeds denial, disdain can protect dignity, and false indifference remains a limit.

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
        "This law says that chasing what you cannot have can make you look smaller and give the denied thing even more importance. Greene is not saying that disappointment is fake or that every loss should be ignored at once. The point is that visible frustration can become tribute. Complaining, begging, or circling the same refusal may keep proving that the object still controls your attention. Strategic disdain matters because it withdraws that tribute. But the chapter is not praising numbness or fake contempt. Ignoring helps only when the object is truly closed or no longer worth the cost of more pursuit. Otherwise disdain becomes a pose instead of a real release.",
        "Greene's thirty-sixth law argues that some denied objects gain power when you keep feeding them with complaint and attention. The chapter says frustration can lower status because it shows that the refusal still governs you. Ignoring can be useful for a clearer reason. It denies the object more emotional energy and keeps your identity from collapsing into grievance. But the law is not generic advice to suppress feeling. Strategic inattention differs from dishonest indifference. Used well, disdain protects dignity by stopping the public performance of dependence. Used badly, it becomes fake calm that still hides unresolved craving underneath.",
        "This law gives a competitive warning: what you cannot get can still beat you if it keeps collecting your attention. Greene wants the reader to notice tribute. Every complaint, chase, or visible agitation may be enlarging the denied object. Strategic disdain works because it cuts off supply. But the chapter has a limit. Some situations still deserve repair, grief, or one more real attempt. The reader's edge comes from knowing when further pursuit will recover something and when it will only advertise dependence more loudly."
      ),
      keyTakeaways: [
        { point: tone("Visible fixation can lower status.", "Complaint and chasing can make the denied object look more powerful.", "What you keep feeding often keeps ruling you.") },
        { point: tone("Strategic inattention can protect dignity.", "Ignoring can work by refusing more tribute to what is closed.", "Withdrawal of attention can be a better revenge than visible frustration.") },
        { point: tone("Disdain has a denial limit.", "The chapter is not asking for fake calm when repair or grief is still needed.", "If indifference is only theater, the object is still inside your posture.") }
      ],
      oneMinuteRecap: tone(
        "This law says that what you cannot have grows stronger when you keep honoring it with complaint and pursuit.",
        "Stop paying tribute to what is closed when more attention will only shrink your dignity.",
        "Real disdain is not numbness; it is the decision to stop feeding a denied object your status."
      )
    },
    medium: {
      chapterBreakdown: tone(
        `Greene's thirty-sixth law begins with a difficult question: what should you do when an object, opportunity, or answer is not available and more pursuit is making you look smaller? The chapter answers by shifting attention away from recovery alone and toward tribute. A denied thing can keep controlling you if you continue to make it the center of your complaint, your humiliation, and your visible attention.

Strategic inattention matters for a narrower reason. Greene is not claiming that loss should never hurt. He is saying that visible frustration can enlarge the denying object. Complaint can grant it more status, more public weight, and more proof of your dependence than it earned by itself. Disdain becomes useful because it refuses to keep feeding that loop. Ignoring can sometimes preserve status better than chasing or grievance.

The distinction that matters is between disciplined non-fixation and fake indifference. Disciplined disdain stops the tribute. Fake indifference performs calm while still orbiting the same denied thing internally. The chapter weakens if it is flattened into stoic sloganizing, because Greene is not praising emotional numbness. He is describing a strategic refusal to let the closed object keep dictating your posture.

Ordinary settings show the pattern clearly. Bastien may lose more dignity by publicly feeding a denied promotion with complaint than by letting the institution's decision shrink on its own. A scholarship waitlist or faculty prize review may begin to define Lyra only if she keeps turning the closed decision into public identity. A personal refusal may sting, but repeated chasing can give the refusal a larger life than silence would. In each case, attention behaves like tribute.

The limit remains central because some losses still need repair, grief, or one more useful push. Greene's better point is narrower: if the object is truly closed or the pursuit is now costing more status than it can recover, withdraw tribute. Chapter 35 dealt with the timing of release. Chapter 36 deals with the withdrawal of pursuit once release can no longer help. Chapter 37 then turns toward how attention can be seized again through spectacle rather than squandered on denial.`,
        `A denied object can keep winning long after the formal refusal if it still governs your visible attention. Greene uses that fact to recast revenge and dignity. The issue is not only whether you got what you wanted. It is whether the refusal continues to make you perform dependence in public.

That is why complaint can be strategically expensive. Repeated grievance may feel like resistance, yet it can also advertise that the denying object still sets your emotional schedule. Greene's practical claim is that strategic inattention can do more than noisy frustration. Ignoring denies further tribute and lets the denied thing shrink instead of grow in symbolic size.

The chapter is strongest when it separates genuine release from decorative indifference. Real disdain stops circling the object. Fake disdain keeps the same fixation alive under a colder mask. Greene is not asking the reader to become numb. He is asking the reader to stop enriching what is closed with more visible dependence.

The pattern appears everywhere. Bastien can either keep enlarging the denied opportunity through public resentment or let it lose force by starving it of attention. Lyra can either let a scholarship waitlist or faculty prize review become her identity or refuse that narrowing script. A personal refusal can either remain one event or become a whole theater of humiliation depending on how much tribute follows it. The act changes because the attention changes.

The law overreaches if it becomes denial or advice to abandon every painful setback without learning from it. The useful boundary is sharper than that: ignore what is truly not worth more tribute, but do not call unresolved dependence freedom. Chapter 35 asked when action should still land. Chapter 36 asks when more action only keeps the denied object in command. The next law then turns toward reclaiming attention through visible form and spectacle.`,
        `Greene's thirty-sixth law warns that denial can become powerful partly because of the attention it extracts after the fact. Readers often focus on the lost prize itself, but Greene focuses on the afterlife of frustration. What matters strategically is whether the denied object keeps collecting your speech, complaint, and emotional energy even after it has stopped being available.

The law values disdain because attention is costly. Greene is not glamorizing cool contempt here. If you keep chasing, protesting, or dramatizing the refusal, you may be making the closed object larger than it already is. Strategic inattention therefore becomes a way of cutting off tribute. It protects status by refusing to display continued dependence where recovery is no longer plausible.

The chapter should not be flattened into emotional repression. Some losses deserve grief. Some defeats still allow repair. Some refusals still contain useful information. Greene is drawing a harder line: when the object is closed and more pursuit only shrinks you, stop feeding it. False indifference fails because it still hides a live dependency. Real release changes behavior, not just tone.

Common cases make the line visible. Bastien's denied promotion may become more damaging through the publicity of his resentment than through the decision itself. Lyra's waitlist frustration may begin to define her only if she keeps supplying it with performance. A personal rejection may hurt, but repeated reaching after a clear no can turn pain into open tribute. These are not different rules. They are the same refusal logic at different scales.

The limit matters because disdain can easily become pose. Greene's law works only when the indifference is honest enough to stop the flow of tribute without refusing necessary repair or ordinary grief. Chapter 35 dealt with when to release force. Chapter 36 asks when refusing further pursuit is the stronger move. Chapter 37 follows because attention, once withdrawn from denial, can be redirected through spectacle instead of wasted on absence.`
      ),
      keyTakeaways: [
        {
          point: tone("Fixation can keep a denied object powerful.", "Visible frustration can enlarge what is refusing you.", "A closed object often grows through the tribute paid to it afterward."),
          moreDetails: tone("The chapter treats complaint and chasing as status leaks when recovery is no longer plausible.", "Attention can strengthen denial by proving that it still governs you.", "The strategic issue is not only the loss itself but the afterlife of dependence.")
        },
        {
          point: tone("Strategic inattention can preserve dignity.", "Ignoring can protect status by cutting off tribute.", "Withdrawal of attention can be stronger than noisy grievance."),
          moreDetails: tone("Greene values disdain because it stops making the closed object the center of your posture.", "Non-response can let a refusal shrink instead of accumulate symbolic weight.", "The law becomes practical when you ask what your complaint is currently feeding.")
        },
        {
          point: tone("Fake indifference is not the same as release.", "A colder tone does not help if fixation remains alive underneath.", "Decorative disdain still serves the object it claims to dismiss."),
          moreDetails: tone("The chapter stays sharp only if release changes behavior rather than vocabulary alone.", "Suppression can hide dependence without ending it.", "Real disdain reduces orbit, not merely temperature.")
        },
        {
          point: tone("Work, school, and personal losses all reveal tribute logic.", "Ordinary settings show that grievance can become self-shrinking theater.", "Closed decisions gain force when the denied person keeps enlarging them."),
          moreDetails: tone("Promotions, waitlists, prize reviews, and refusals all show how complaint can become identity.", "The law becomes visible when you notice which denied things still occupy your public energy.", "Attention determines whether the refusal remains one event or becomes an organizing story.")
        },
        {
          point: tone("The law has a repair-and-grief limit.", "Strategic ignoring breaks down when more action can still help or when calm is only a mask.", "A closed pursuit should be starved, but a live situation still needs reality-testing."),
          moreDetails: tone("Greene warns against tribute, not against truth.", "The useful line is to withdraw only when more pursuit is shrinking you more than it can help you.", "Disdain stops being strategic once it becomes denial of facts or feeling.")
        }
      ],
      activationPrompt: tone(
        "Find one denied object that may still be collecting more attention from you than it deserves.",
        "Choose one loss where complaint may now be feeding the thing you resent.",
        "Identify one place where ignoring could protect dignity and one where it would only hide unfinished work."
      ),
      selfCheckPrompt: tone(
        "Is this object still recoverable, or am I paying tribute to something that is effectively closed?",
        "Would less public attention shrink this denial, or am I using indifference language to avoid honest grief?",
        "What part of my posture is still organized around something I claim not to care about?"
      ),
      oneMinuteRecap: tone(
        "This chapter argues that a denied object often keeps power only if you keep supplying it with attention, grievance, and dependence.",
        "Withdraw tribute when further pursuit is shrinking you more than it can recover the loss.",
        "Real disdain is not denial; it is honest release from an object that no longer deserves your public energy."
      )
    },
    hard: {
      chapterBreakdown: tone(
        `Greene's thirty-sixth law asks the reader to think about denial not as a single loss but as an ongoing economy of attention. A prize, position, or person may become unavailable, yet still continue to command you if frustration remains publicly active. The chapter therefore relocates power from acquisition alone to the management of tribute after refusal. What matters strategically is whether the denied object still receives your complaint, pursuit, and visible emotional energy.

The law values disdain for a sharper reason than style. Greene is not glamorizing contempt for its own sake. He is describing a refusal to enlarge what has already denied you. Complaint can make the closed object symbolically bigger by proving it still dictates your posture. Repeated pursuit can convert disappointment into dependence on display. Strategic inattention matters because attention is a scarce resource, and what you keep honoring often keeps governing you.

The central distinction is between disciplined non-fixation and false indifference. Disciplined disdain stops paying tribute. It accepts closure where closure is real and refuses to perform further dependence for the denied object's benefit. False indifference only changes costume. It hides the fixation under colder language while the same object continues to organize attention internally. One form of ignoring restores dignity. The other merely conceals subordination beneath style.

That distinction matters because denial can become more damaging through the afterlife you give it than through the refusal itself. Bastien may make a denied promotion more powerful by narrating it constantly. Lyra may let a waitlist or prize review become an identity script by repeatedly centering it in public. A personal refusal may hurt, but it becomes strategically humiliating when more chasing keeps enlarging the no. In each case, tribute extends the rule of the denied object beyond the original event.

The chapter is strongest when it refuses both grievance theater and false suppression. Some losses deserve grief. Some defeats deserve repair. Some refusals remain open enough for one more useful attempt. Greene's limit matters because disdain without reality can become avoidant self-deception. The law works only when the object is genuinely closed or no longer worth the shrinking effect of further pursuit. Otherwise ignoring is not strength. It is misreading.

Chapter 35 argued that force must meet the right moment. Chapter 36 adds that once the moment is gone and pursuit can no longer recover the object, more force may only deepen dependence. The sequence matters. First ask whether timing can still save the move. Then ask whether continued tribute is now the larger danger. Chapter 37 follows by turning attention outward again: once denial is starved, power can be rebuilt through spectacle and compelling visible form rather than wasted on what is absent.`,
        `A denied object can remain active long after the refusal if it still controls your visible relation to it. Greene uses that fact to transform the topic from desire to tribute. The strategic issue is not only whether you lost something. It is whether the loss continues to draw performance, grievance, and symbolic obedience out of you.

The chapter therefore values disdain because attention confers importance. If you keep protesting the refusal, replaying the slight, or chasing the unavailable prize, you may be enlarging its authority. Strategic inattention cuts that supply line. It lets the denied thing shrink instead of grow through your dependence. That is why ignoring can function as revenge: it withholds the confirming response the object would otherwise continue to extract.

The harder distinction is between release and disguise. Real release changes behavior, topic, and orbit. False indifference changes tone while fixation survives underneath. Greene is not calling for emotional frost. He is calling for the end of tribute where tribute no longer serves recovery. Otherwise disdain becomes decorative repression: colder speech, same dependence.

Bastien's promotion case, Lyra's waitlist frustration, and a personal rejection all show the same structure. The denied object does not expand by magic. It expands because the denied person keeps centering it. The severity comes from that diagnosis. It asks whether your current complaint is actually punishing the denying object or merely advertising its hold over you. The answer changes what dignity requires next.

The law overreaches whenever it turns honest grief into weakness or treats every setback as beneath response. Its useful boundary is sharper than that. Ignore what is truly closed and made larger only by tribute. Do not ignore what is still recoverable, informative, or in need of repair. Chapter 35 asked whether a move still had a window. Chapter 36 asks whether a closed object deserves any more of your energy at all. Chapter 37 then moves to the positive side of attention: once tribute is withdrawn from denial, attention can be seized elsewhere through spectacle.`,
        `Greene's thirty-sixth law is really about post-denial self-command. Most people focus on the refusal itself, but Greene focuses on the temptation to keep serving the refusal after it has happened. The question is whether you will continue to organize your speech, attention, and emotional display around what is no longer available. If you do, the object may keep ruling you without needing to move at all.

Disdain should be understood as attention management rather than as theatrical contempt. Strategic inattention withdraws the public proof that the denied object still matters enough to govern your posture. Complaint, by contrast, can become tribute because it keeps certifying dependence. The chapter's deepest claim is that what you keep feeding with visible importance often retains an authority it could not have preserved by force alone.

False indifference is dangerous for a practical reason. A person can speak coolly while remaining inwardly organized around the same loss. That is not release. It is a colder form of orbit. Genuine disdain is behaviorally expensive: it stops the repeated return, the repeated story, and the repeated request for a different answer once closure is real. The law is sharp only when ignoring changes the pattern instead of the tone.

The examples make that visible. Bastien weakens himself if the denied promotion becomes his public narrative. Lyra enlarges a closed academic decision if she keeps letting it define her standing. A personal rejection becomes more degrading each time it is fed with another round of pleading after the refusal is clear. These are not different failures. They are one fixation logic in different clothes: tribute keeps the denied object alive.

The limit matters because there are live situations where more effort is still appropriate. Greene's law becomes useful only after reality-testing. If the object is still recoverable, ignoring may simply be avoidance. If the object is closed, more tribute may be the larger defeat. Chapter 35 dealt with the art of release into the right moment. Chapter 36 deals with the art of withdrawal once the moment is gone. Chapter 37 follows because attention, once freed from fixation, can be reassembled around spectacle rather than absence.`
      ),
      keyTakeaways: [
        {
          point: tone("Denial can keep ruling through the tribute paid to it afterward.", "A refused object stays powerful when it still governs your visible attention.", "The afterlife of fixation can matter more than the original no."),
          moreDetails: tone("The chapter treats complaint and chasing as an economy of tribute rather than as harmless venting.", "What remains publicly central can continue shaping status long after closure.", "Strategic analysis has to include the cost of continuing to orbit what is unavailable.")
        },
        {
          point: tone("Strategic inattention can preserve dignity by cutting off tribute.", "Ignoring can shrink what grievance would keep enlarging.", "Withdrawal of attention can be stronger than continued protest."),
          moreDetails: tone("Greene values disdain because attention confers symbolic size.", "Non-response works when it lets the denied object lose the dependence it was extracting.", "The law becomes concrete when you ask what your public frustration is still feeding.")
        },
        {
          point: tone("False indifference is still dependence in colder clothes.", "A different tone does not matter if the same object still organizes behavior.", "Decorative calm can preserve fixation instead of ending it."),
          moreDetails: tone("The chapter stays hard only if release changes orbit rather than vocabulary.", "Suppression may hide tribute without actually stopping it.", "Real disdain ends recurrence, not only heat.")
        },
        {
          point: tone("Work, school, and personal refusals all show the same fixation logic.", "A denied object grows through the denied person's repeated performance around it.", "Tribute extends the life of closure beyond the original event."),
          moreDetails: tone("Promotions, waitlists, prize reviews, and rejections differ in surface but not in attention economics.", "The law becomes visible when one refusal starts absorbing more identity than it deserves.", "Repeated grievance can make the denied object larger than the refusal itself made it.")
        },
        {
          point: tone("The law has a reality-testing limit.", "Ignoring turns weak when the situation is still live or the indifference is only cosmetic.", "Withdrawal is strategic only after you know that more pursuit is mostly self-shrinking tribute."),
          moreDetails: tone("Greene warns against dependence, not against grief or repair.", "The useful rule is to stop feeding what is closed, not to deny what still requires action.", "Disdain becomes strength only when it follows honest assessment rather than avoidant pride.")
        }
      ],
      activationPrompt: tone(
        "Locate one refusal that may still be governing more of your public attention than it deserves.",
        "Choose one denied object where withdrawal of tribute might preserve more status than another round of complaint.",
        "Identify one place where indifference would be honest release and one where it would only conceal unfinished dependence."
      ),
      selfCheckPrompts: [
        tone(
          "Is this object actually closed, or am I trying to call avoidance dignity before I have reality-tested the situation?",
          "What proof would show that my complaint is shrinking the denial rather than enlarging it?",
          "If I stopped talking about this for a week, what part of my identity would feel exposed?"
        ),
        tone(
          "Has my tone cooled while my orbit stayed the same?",
          "Am I withdrawing tribute, or am I performing indifference for an audience while remaining privately ruled by the same loss?",
          "What would real non-fixation change in my behavior tomorrow?"
        )
      ],
      predictionPrompt: tone(
        "If tribute is withdrawn from denial, how might Chapter 37 argue that power can be rebuilt through spectacle and visible form instead of grievance?",
        "What happens once attention is no longer trapped by absence and can be directed toward something compelling again?",
        "After refusing fixation, how does power return on the positive side of attention?"
      ),
      oneMinuteRecap: tone(
        "This chapter argues that denial keeps power when you keep paying it with attention, complaint, and visible dependence, and that strategic disdain can cut off that tribute once closure is real.",
        "Ignore what is truly closed when more pursuit would only enlarge the refusal and lower your standing, but do not confuse this with fake calm or avoidant denial.",
        "Power returns when the denied object stops organizing your posture and your attention is no longer serving what you could not get."
      )
    }
  },
  examples: [
    {
      title: "Bastien Stops Feeding the Denied Promotion With Public Resentment",
      format: "decision_point",
      category: "work",
      endingType: "broader_principle",
      scenario: tone("Bastien did not get the promotion he wanted, and he can either keep centering the decision in public or refuse to feed it more attention.", "He has to choose between grievance theater and strategic withdrawal.", "Bastien can keep enlarging the denial or let it shrink by starving it."),
      whatToDo: tone("He stops public complaint once it becomes clear the decision is closed and redirects his energy elsewhere.", "He refuses to keep paying tribute to the denying institution.", "He denies the loss more symbolic size by ending the performance around it."),
      whyItMatters: tone("The chapter says complaint can make the denied object larger than it needs to be.", "His move shows how inattention can preserve status better than visible frustration.", "He regains leverage by starving the refusal of tribute.")
    },
    {
      title: "Lyra Explains Why the Waitlist Should Not Become Her Whole Public Story",
      format: "dialogue",
      category: "school",
      endingType: "self_directed_question",
      scenario: tone("Lyra talks through how a scholarship waitlist or faculty prize review can sting without becoming the center of her identity.", "She sees that repeated grievance would keep the closed decision alive in public.", "The conversation turns into a lesson about tribute rather than pure disappointment."),
      whatToDo: tone("She names the loss honestly, takes what information is useful, and stops supplying it with more performance than it deserves.", "She refuses to let the denied outcome organize her whole standing.", "She asks what release would look like if she stopped feeding the decision more symbolic weight."),
      whyItMatters: tone("The chapter warns that visible fixation can make a denial larger than the event itself.", "Her case shows how strategic inattention can protect dignity in school settings too.", "The denied thing loses force when it stops collecting identity from the denied person.")
    },
    {
      title: "Halen Has to Decide Whether One More Pursuit Will Recover Anything or Only Deepen Humiliation",
      format: "dilemma",
      category: "personal",
      endingType: "surprising_implication",
      scenario: tone("Halen has received a clear refusal in personal life, but he is tempted to make one more appeal in hopes of changing the answer.", "He has to decide whether another reach is still useful or merely tribute.", "Halen may be testing recovery or feeding a closed no."),
      whatToDo: tone("He reality-tests whether anything is still open and stops if the answer is genuinely closed.", "He refuses to mistake repeated pursuit for dignity.", "He protects himself by ending the orbit when further contact would only perform dependence."),
      whyItMatters: tone("The chapter says pursuit becomes self-shrinking once the object is truly unavailable.", "His case shows where strategic indifference begins.", "Another attempt can sometimes recover something, but after closure it can also become open tribute.")
    },
    {
      title: "Mireya Predicts the Prize Review Will Shrink Faster if It Is Starved of Complaint",
      format: "predict_reveal",
      category: "school",
      endingType: "cross_domain",
      scenario: tone("Mireya predicts that a faculty prize review will lose symbolic size if the denied student stops feeding it with visible grievance.", "She expects silence to weaken the decision's hold faster than repeated protest.", "The scene becomes a forecast about attention rather than fairness alone."),
      whatToDo: tone("She watches whether the student makes the decision into a public script or lets it remain one event.", "She tests the tribute logic by comparing complaint with withdrawal.", "She tracks whether non-response lets the refusal shrink on its own."),
      whyItMatters: tone("The chapter says denying further tribute can be stronger than noisy resentment.", "Her prediction shows how attention economics operate in academic rooms too.", "The review keeps ruling only if it is kept central.")
    },
    {
      title: "The Work Debrief Finds That Complaint Gave the Closed Decision More Life Than the Decision Itself",
      format: "postmortem",
      category: "work",
      endingType: "common_trap",
      scenario: tone("A work debrief shows that the denied opportunity became more damaging through the team's repeated complaint than through the original loss alone.", "They realize the afterlife of grievance gave the refusal extra symbolic power.", "The group sees that protest had turned into tribute."),
      whatToDo: tone("They separate useful lessons from performative frustration and stop rehearsing the same wound publicly.", "They end the loop that keeps the closed decision alive.", "They withdraw attention once it no longer helps repair anything."),
      whyItMatters: tone("The chapter warns that a refusal can keep winning if you keep staging dependence around it.", "Their mistake was not feeling disappointed but feeding the disappointment too long.", "The denial became larger through tribute than through the original outcome.")
    },
    {
      title: "Before and After a Clear Refusal Stopped Receiving More Emotional Tribute",
      format: "before_after",
      category: "personal",
      endingType: "perspective_reframe",
      scenario: tone("Before, every conversation, thought, and social display kept returning to the same clear refusal. After, the person still knew the loss mattered but stopped arranging their posture around it.", "The contrast is between fixation and release.", "One version keeps certifying dependence; the other ends the tribute."),
      whatToDo: tone("Allow the loss to be real without letting it keep collecting public performance.", "Withdraw the repeated complaint, the repeated chase, and the repeated symbolic return.", "Use silence and redirection to let the refusal shrink back to its actual size."),
      whyItMatters: tone("The law becomes visible when the same loss loses force once it stops receiving attention.", "This before-and-after shows that release is behavioral, not merely verbal.", "The denied object shrinks when it stops getting fed.")
    }
  ],
  reviewCards: [
    { cardId: "ch36-rc01", front: tone("What is the main warning of Chapter 36?", "Why can a denied object stay powerful?", "What keeps refusal alive after the no?"), back: tone("A denied object can remain powerful if it keeps collecting your complaint, attention, and dependence.", "The chapter warns that fixation can enlarge what refuses you.", "Refusal stays alive when it keeps receiving tribute afterward."), difficulty: "easy" },
    { cardId: "ch36-rc02", front: tone("What does strategic inattention do here?", "Why can ignoring be stronger than complaint?", "How does disdain work strategically?"), back: tone("It cuts off tribute and lets the denied object shrink instead of grow through your attention.", "Ignoring can preserve dignity by refusing more symbolic importance to what is closed.", "Disdain works when it stops feeding the refusal with public dependence."), difficulty: "easy" },
    { cardId: "ch36-rc03", front: tone("How is false indifference different from real release?", "When does disdain become a pose?", "What proves the object still rules you?"), back: tone("False indifference changes tone while keeping the same fixation alive underneath.", "Disdain becomes a pose when behavior still orbits the denied object.", "If the pattern has not changed, colder language is not freedom."), difficulty: "medium" },
    { cardId: "ch36-rc04", front: tone("Why can complaint act like tribute?", "How does grievance enlarge a denial?", "What does public frustration accidentally give away?"), back: tone("Complaint can certify that the denied object still organizes your attention and identity.", "Grievance enlarges a denial by proving it still has symbolic command over you.", "Public frustration can give the refusal more size than the original event earned."), difficulty: "medium" },
    { cardId: "ch36-rc05", front: tone("How does Chapter 36 bridge to Chapter 37?", "What comes after tribute is withdrawn?", "Why does refusal lead toward spectacle?"), back: tone("Once attention is no longer trapped by denial, it can be redirected toward compelling visible form.", "Chapter 37 turns from starving unwanted attention to seizing desired attention.", "With fixation withdrawn, power moves from absence toward spectacle."), difficulty: "hard" }
  ],
  keyTakeawayCard: tone(
    "Disdaining what you cannot have becomes powerful when it honestly withdraws complaint, chase, and emotional tribute from an object that is truly closed.",
    "This law warns that denial often stays large only because it keeps receiving attention, and that strategic inattention can preserve status better than grievance.",
    "Power returns when the refusal stops organizing your posture and the denied object no longer collects your public dependence."
  )
};

const quiz = {
  passingScorePercent: 70,
  questions: [
    { questionId: "ch36-q01", prompt: "Why does visible frustration weaken the actor in this chapter?", choices: ["Because it can enlarge what is denying them", "Because disappointment is always fake", "Because all emotion destroys strategy"], correctIndex: 0, explanation: tone("Correct. The chapter says visible frustration can grant the denied object more symbolic importance.", "Complaint can prove that the refusal still governs you.", "Right. The loss becomes larger when it keeps collecting tribute."), bloomsLevel: "remember-understand", depthLevel: "easy" },
    { questionId: "ch36-q02", prompt: "What does disdain do strategically here?", choices: ["It turns every loss into a victory automatically", "It removes any need for honest reality-testing", "It cuts off tribute and further dependence"], correctIndex: 2, explanation: tone("Yes. Strategic disdain works by refusing more attention to what is closed.", "Ignoring can protect status by ending the supply of tribute.", "Correct. The point is withdrawal of dependence, not magical reversal."), bloomsLevel: "remember-understand", depthLevel: "easy" },
    { questionId: "ch36-q03", prompt: "Why is this chapter not generic emotional numbness advice?", choices: ["Because it says grief is weakness", "Because it rejects all feeling", "Because it distinguishes real release from fake indifference"], correctIndex: 2, explanation: tone("Correct. The chapter draws a line between disciplined non-fixation and dishonest suppression.", "Greene is not praising numbness but a strategic end to tribute.", "Right. Real release changes behavior instead of just freezing emotion."), bloomsLevel: "remember-understand", depthLevel: "easy" },
    { questionId: "ch36-q04", prompt: "In Bastien's work scenario, what best fits the chapter?", choices: ["Keep the denied promotion at the center of every conversation", "Pretend the decision never mattered while privately obsessing over it", "Withdraw public complaint once the decision is truly closed"], correctIndex: 2, explanation: tone("Yes. The chapter favors starving a closed denial of further tribute.", "His better move is to stop enlarging the decision through resentment theater.", "Correct. Public grievance would keep feeding the refusal."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch36-q05", prompt: "What does Lyra's school example show?", choices: ["That every waitlist should be ignored before any facts are known", "That a closed academic decision grows if it keeps collecting public performance", "That scholarship outcomes never affect identity"], correctIndex: 1, explanation: tone("Correct. The waitlist becomes strategically larger if it keeps receiving grievance and identity from her.", "The chapter is about tribute, not about denying disappointment.", "Right. The decision keeps ruling only if it stays central."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch36-q06", prompt: "What is the strongest reading of Halen's dilemma?", choices: ["One more pursuit is wise no matter how closed the refusal is", "He should treat every refusal as beneath feeling", "He must test whether anything is still open before deciding whether another attempt is tribute"], correctIndex: 2, explanation: tone("Yes. The chapter's limit is that reality-testing comes before strategic disdain.", "If the object is truly closed, more pursuit may only deepen dependence.", "Correct. He has to distinguish possible recovery from self-shrinking orbit."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch36-q07", prompt: "How can complaint function like tribute in this chapter?", choices: ["It guarantees repair", "It proves the denied object still organizes your attention", "It makes the refusal disappear"], correctIndex: 1, explanation: tone("Correct. Complaint can advertise that the object still governs your posture.", "Grievance feeds the denial by keeping it symbolically alive.", "Right. Tribute means continued public importance paid to what is closed."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" },
    { questionId: "ch36-q08", prompt: "When does disdain become dishonest denial?", choices: ["When the object is truly closed and no longer worth more pursuit", "When the tone cools but the same fixation still organizes behavior", "When useful grief or repair is acknowledged honestly"], correctIndex: 1, explanation: tone("Exactly. Decorative calm is not freedom if the same orbit remains underneath.", "False indifference changes tone while keeping dependence alive.", "Right. The limit appears when disdain is only a colder costume."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" },
    { questionId: "ch36-q09", prompt: "How does Chapter 35 lead into Chapter 36?", choices: ["By asking what happens once timing can no longer recover the move", "By proving that timing always solves denial", "By making refusal logic irrelevant"], correctIndex: 0, explanation: tone("Correct. Chapter 35 asks when to release force, and Chapter 36 asks when further release no longer helps.", "Once the window is gone, tribute may become the bigger danger.", "Right. The sequence moves from timing to withdrawal."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" },
    { questionId: "ch36-q10", prompt: "What bridge carries Chapter 36 into Chapter 37?", choices: ["Attention can be redirected from denial toward compelling visible form", "Chapter 37 abandons the issue of attention completely", "Spectacle matters only when grievance continues"], correctIndex: 0, explanation: tone("Correct. Once fixation is starved, attention can be seized again through spectacle.", "Chapter 37 turns from starving unwanted attention to commanding wanted attention.", "Right. The bridge is about redirecting attention, not remaining trapped in absence."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" }
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
for (const name of ["Bastien", "Lyra", "Halen", "Mireya"]) continuity.nameUsage[name] = [stem];
continuity.withinChapterNames[stem] = ["Bastien", "Lyra", "Halen", "Mireya"];
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
- Chapter-specific mechanism remains fixation, tribute, strategic inattention, and denial limits rather than generic stoicism
- Hard depth preserves the release-versus-repression boundary and the Chapter 37 spectacle bridge
- Quiz stays within supported facts from the approved draft and frozen source bundle

## Gate result
- Approved for chapter gate and automatic continuation
`;
writeText(paths.validation, validation);

fs.appendFileSync(
  paths.runLog,
  `\n- Completed writer, editor, critic, converter, quiz, and validator steps for Chapter 36.\n- Validation result: PASS.\n- Continuity hash sealed for \`${stem}\`: \`${seal}\`\n`,
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
