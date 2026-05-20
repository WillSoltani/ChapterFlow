#!/usr/bin/env python3
"""Apply batch 1 (Laws 1-4) regenerated content to the 48 Laws v21 package.

Replaces hook, counterintuition, keyTakeaway, tryThisNow,
breakdown.{fastRead,deepRead,fullRead}, and memorableLines for chapters 1-4.
Leaves examples, quiz, reviewCards, implementationPlan untouched.
"""
import json
import sys

PATH = "book-packages/the-48-laws-of-power.v21.json"

UPDATES = [
    {
        "number": 1,
        "hook": "Adaeze finds the dosage error in the chief's pre-op note at 6:47 a.m., and the resident class is watching.",
        "counterintuition": "Outshining a superior is a thrill that costs more than it pays. The cleaner discipline is to make a win read as proof of the senior's judgment, so the room registers continuity instead of replacement.",
        "keyTakeaway": "Outshining a superior makes you visible in the wrong way. Frame your wins as proof of the senior's judgment, so credit lands where protection comes from.",
        "tryThisNow": "Before your next visible win at work, draft two versions of how you will announce it. In version A you are the hero. In version B the senior is the reason the win was possible. Send version B.",
        "fastRead": (
            "Adaeze finds the dosage error at 6:47 a.m., reading the chief's pre-op note while the scrub team gloves up. The whole resident class is watching. She could announce the catch and look brilliant for thirty seconds. Instead she slides her tablet across the steel counter. 'Dr. Okafor, your protocol caught something here that doesn't match the latest weight.' The chief reads, nods once, fixes the number, and the OR runs on time. By 8 a.m., three attending physicians have heard the story as proof Okafor's review system works. By 8:15, Adaeze has been assigned the next high-complexity case. The catch made her a better resident. The framing made her a protected one."
        ),
        "deepRead": (
            "Solene watches the same dynamic in an M&A war room at 11:30 p.m. on a Sunday. Her partner Whitcomb has spent the weekend on a deal memo with a structural flaw that will surface when opposing counsel finds it Monday morning. She has the fix. She also has the option of letting the flaw be found, then producing the fix in the meeting and looking like the only adult in the firm. She chooses the email instead. Subject line: 'Quick wrinkle in section four. Your earlier point about the carve-out flags it.' She makes the catch sound like the natural conclusion of Whitcomb's thinking. Whitcomb fixes the memo, walks into Monday looking sharp, and tells the managing partner Solene saved the deal.\n\n"
            "Nicolas Fouquet built Vaux-le-Vicomte for the young Louis XIV in 1661. The château was an act of devotion that read as comparison. Louis arrived, walked the grounds, watched the fireworks, and ate from gold plate while his own court ran on silver. Three weeks later Louis had Fouquet arrested. The charge was embezzlement. The actual offense was that a finance minister had built something the king could not match. Magnificence in the wrong hands creates a comparison the patron cannot afford to leave unresolved.\n\n"
            "A superior tolerates excellence until the room starts measuring you against them. Then the question changes from 'how useful is this person?' to 'why am I tolerating someone who makes me look smaller in my own house?' The facts can still favor you. The emotional field has already moved.\n\n"
            "There is a limit. Some superiors are secure enough not to need this care, and a paranoid one may suspect even careful deference. Use the response as data. If redirecting credit lowers friction, you are managing the room. If it raises surveillance, the hierarchy is the problem."
        ),
        "fullRead": (
            "Mateusz stands backstage at a product demo twenty minutes before the founder is due on stage, watching the staging environment fail. As the junior architect on the deploy team, Mateusz spent the weekend rebuilding the service that just collapsed. He could open the demo by walking the audience through the midnight rescue and let the founder thank him from the stage. He could also let the founder open with the customer promise that drove the build, then reveal the architecture as the delivery of that promise. The first version of the script names a hero. The second version names a system. Investors fund systems. Founders survive when the room can see them as the system's author.\n\n"
            "He chooses the second version. The demo runs clean. The founder takes questions afterward and refers to 'what Mateusz and the team built' in a way that sounds like leadership, not rescue. The next morning, Mateusz is the only junior architect invited to the post-demo strategy session. The work was excellent in either telling. The framing decided whether excellence read as continuity or insurrection.\n\n"
            "Galileo had the same instinct in 1610. When he found the moons of Jupiter through his improved telescope, he could have named them anything. He named them the Medicean Stars and dedicated the discovery to Cosimo II. The Medici did not understand celestial mechanics. They understood patronage. A man who could find new objects in the heavens and label them after the patron's family was a man who made the patron larger. Galileo received a lifetime stipend and the title of court mathematician. The science was world-changing. The career move was perfectly judged.\n\n"
            "Fouquet's error was the inverse. Vaux-le-Vicomte left no room to make Louis larger. The architecture was too good, the gardens too perfect, the dinner service too unique. There was nothing to redirect because everything pointed at Fouquet. Galileo redirected by naming. Fouquet had named the work after himself by building it.\n\n"
            "Ask one question before any visible win: who becomes bigger because this is seen? If the only answer is you, and the person above you controls access, budget, signing authority, or protection, you have created a political fact alongside the practical one. The political fact will resolve before the practical one matters.\n\n"
            "This Law inverts in one situation. A superior who is already failing and will fall regardless is a different problem. So is the superior who has stopped functioning and is dragging the work down. In those cases, deference becomes complicity, and continuity reads as cover-up. The rare condition for outshining is that the room already knows the superior is finished, the cost of waiting is higher than the cost of acting, and you have lined up the protection you will need afterward. Those conditions are rarer than ambition wants to admit. Most people who outshine a master do so before any of these are met, then misread the resulting punishment as injustice rather than predictable response.\n\n"
            "The practical test is sharper than the theory. If your evidence makes the senior feel wise for backing you, it is complement. If it makes the senior look slow, optional, or rescued, it is drifting toward substitute. Move the frame before the room hardens around that meaning. A folded chart, a reordered email subject line, a demo script that names the founder's promise first: small interventions in how the work is received. The work stays excellent. The light has to land carefully."
        ),
        "memorableLines": [
            {
                "text": "The catch made her a better resident. The framing made her a protected one.",
                "location": "breakdown.fastRead",
                "why": "Compresses the Law into a two-beat aphorism a reader can carry into any hierarchy."
            },
            {
                "text": "Magnificence in the wrong hands creates a comparison the patron cannot afford to leave unresolved.",
                "location": "breakdown.deepRead",
                "why": "Names the mechanism behind Fouquet's fall without naming Fouquet, making it portable to any superior-comparison risk."
            },
            {
                "text": "The work stays excellent. The light has to land carefully.",
                "location": "breakdown.fullRead",
                "why": "Image-anchored closer that holds both halves of the Law: do the work, manage where the credit lands."
            }
        ]
    },
    {
        "number": 2,
        "hook": "In 1502, Cesare Borgia rode into Senigallia smiling at the four condottieri who had just sworn loyalty back to him.",
        "counterintuition": "A friend works when nothing is at stake. Hand them power over you and the same loyalty has to compete with envy, with comparison, with the slow accumulation of small humiliations you never noticed inflicting. An enemy has none of that history.",
        "keyTakeaway": "Friendship cannot survive the asymmetry of power. Build operational structures with people whose loyalty is transactional, and keep your friends where the structure cannot touch them.",
        "tryThisNow": "Look at the people who hold operational authority over you, or under you. Mark the ones you call friends. For each, write the conversation you have been avoiding and put a date next to it.",
        "fastRead": (
            "Theron and Asher started the company in a Brooklyn apartment, two college friends with a working prototype and a handshake split. By year three, Theron was running the technical roadmap and Asher had become the face of sales. By year four, Asher was telling investors his cofounder 'wasn't scaling.' Theron found out at a board dinner he had not been invited to. The story repeats so often in early-stage startups that lawyers price it into the term sheet. Friendship had built the company. The same friendship made every escalation feel like betrayal instead of business. By the time Theron understood the field had changed, the field had already changed without him."
        ),
        "deepRead": (
            "Imani sits in a litigation conference room at 3 p.m. on a Wednesday, opposing counsel across the table, her client beside her. The client is suing his former partner, a man he met in business school and trusted for twelve years. The complaint runs forty-eight pages. Every page reads like a personal injury, which is the wrong genre. Imani has been translating the case from grievance to commerce. Her client keeps saying 'family.' Imani keeps writing in the margin: 'family is not a contract.' The deposition tomorrow will turn on whether her client can describe the financial damage without sounding like he is describing emotional betrayal. He cannot, yet.\n\n"
            "Cesare Borgia handled the same problem differently in December 1502. Four of his condottieri had defected, then negotiated their way back into his service. Borgia received them in Senigallia with embraces, a fine dinner, and the assurance that old loyalties were restored. By midnight, all four were strangled. Machiavelli, present as a Florentine envoy, wrote it up admiringly. The lesson was not Borgia's cruelty. It was his clarity that men who had once betrayed him would always recalculate, and no embrace at a banquet could move them off that calculation.\n\n"
            "Hired enemies, by contrast, know they are hired. They expect to be paid, scrutinized, and discharged. They do not need to be loved, and they do not feel injured when terms are enforced. They become loyal in proportion to how clearly the terms are set.\n\n"
            "The limit is real. This Law does not say avoid friends. It says do not import friendship into structures where favor, comparison, and unequal authority will eat it. Build with people who never had to translate the relationship in the first place."
        ),
        "fullRead": (
            "Selma signs the cofounder buyout in a SoHo conference room at 4 p.m. on a Tuesday, her name appearing twice on the same document because the original partnership was structured before either of them anticipated this moment. The company is a fintech she built with her best friend from graduate school. The buyout pays her best friend more than the company can comfortably afford. Selma signs anyway because the alternative is two more years of board meetings where the friend votes against every product decision in a tone that says 'I trusted you with my life and you changed.' The friendship was real. The structure made it lethal.\n\n"
            "There is a pattern. A founder hires a friend in year one to save money on a senior role. By year three, the friend is underqualified for what the company has become but cannot be moved without breaking the friendship. By year five, the friend has become a quiet veto on the company's direction because the cost of confronting them feels personal. The friendship dies anyway. The exit is just slower and more expensive.\n\n"
            "Hsiang Yü trusted his old comrades after his victories in the rebellion against the Qin around 207 BCE. He was a brilliant general and a generous one, distributing land and titles to the men who had fought beside him. Liu Pang, his rival, did the opposite. Liu Pang elevated men he had never trusted personally, men who needed his patronage to survive, men whose loyalty was a transaction rather than a memory. Within four years, Hsiang Yü's old comrades had begun their own calculations. Liu Pang's hired men held the line. Hsiang Yü ended at the river bank, abandoned by everyone he had loved, watching his army dissolve. Liu Pang founded the Han dynasty.\n\n"
            "The mechanism is not that friends are worse than strangers. It is that friends carry a history of equality, and authority breaks that equality whether anyone speaks it aloud. The friend who becomes a subordinate now experiences every direction as a small revision of who you both used to be. The friend who becomes a peer now compares every share, every credit line, every public sentence about the work. Strangers in the same roles do not have the prior version to grieve.\n\n"
            "An enemy used carefully has the opposite property. An enemy made into an ally has paid for the position in advance. They know what they were before and they know what would happen if they slipped back. Talleyrand kept his ministerial post under five regimes because he was useful to men who did not love him and could not afford to remove him. Loyalty to Talleyrand was not personal. It was transactional, and transactions can be renewed.\n\n"
            "The Law has reversals. Partnerships between friends do survive when both people maintain a hard discipline against importing the friendship into power decisions. They are rare because the discipline is rare, and they require a brutal early agreement about what happens when the partnership stops working. Most people skip that conversation. The skipped conversation becomes the lawsuit ten years later.\n\n"
            "The other reversal: there are moments when an old friend is exactly the person you need, precisely because the bond predates the power. Someone who knew you before the company can tell you the truth when no one else will. The condition is that they hold no operational authority. They are advisors, not officers. The friendship survives because it never touches the structure that would test it.\n\n"
            "Borgia in Senigallia, Liu Pang elevating outsiders, Talleyrand surviving five regimes. The common thread is not coldness. It is structural honesty about which relationships can carry power and which ones cannot. A friend who works for you will eventually resent the seating chart, no matter how kindly you arrange the chairs."
        ),
        "memorableLines": [
            {
                "text": "Friendship had built the company. The same friendship made every escalation feel like betrayal instead of business.",
                "location": "breakdown.fastRead",
                "why": "Names the structural defect of friend-built ventures without moralizing about it."
            },
            {
                "text": "Hired enemies, by contrast, know they are hired.",
                "location": "breakdown.deepRead",
                "why": "Compresses the case for transactional loyalty into a single sentence."
            },
            {
                "text": "A friend who works for you will eventually resent the seating chart, no matter how kindly you arrange the chairs.",
                "location": "breakdown.fullRead",
                "why": "Image-anchored closer that holds the inevitability of the Law without sounding cynical."
            }
        ]
    },
    {
        "number": 3,
        "hook": "At 4:14 on a Tuesday, the silence at the board table meant something Camille had been waiting six weeks to hear.",
        "counterintuition": "Honesty about your intent is a courtesy people stop deserving once they hold something you want. The form of concealment is not lying. It is letting the field interpret a sequence of innocent moves as something other than the move they are.",
        "keyTakeaway": "Concealment is not lying. It is arranging the surface so others interpret your visible moves as something other than the move you are making.",
        "tryThisNow": "Before your next negotiation or consequential meeting, write the false story you would prefer the other party to construct from your behavior. Then arrange one visible signal that supports that story.",
        "fastRead": (
            "Camille works on an M&A deal for fourteen weeks before the target company suspects she is buying it. She visits as a 'partnership exploration,' meets with three of their senior engineers about a possible licensing arrangement, attends a quarterly review as a 'strategic observer.' By the time she submits the term sheet, she has met every key person, mapped the org chart, and identified which two engineers will quit if the founder leaves. The founder accepts the offer because every door he could have closed had been left open by friendly traffic. Concealment is not deception. It is letting other people's assumptions do most of the work."
        ),
        "deepRead": (
            "Anders runs a regional bank acquisition the way Bismarck ran the prelude to war. For two years before the war with Austria in 1866, Bismarck told everyone in Berlin he wanted to avoid conflict. He told the French he wanted their neutrality. He told the Italians he wanted their alliance. He told the king he wanted to preserve the German Confederation. Every conversation moved one piece into position while leaving the other party convinced of the opposite. By the time the war began at Königgrätz in July 1866, the field had been arranged. The Austrians were diplomatically isolated. The Italians had committed. The French had been promised compensation that would never come. The war lasted seven weeks. Concealment had done the heavy work before any soldier fired.\n\n"
            "What looks like restraint from a man whose intentions are unclear is actually the active operation of his strategy. The plain disclosure of an aim is a courtesy that allows your opponents to oppose it. You do not owe that courtesy to people whose interests run against yours.\n\n"
            "Anders applies the same discipline at smaller scale. He spends four months in 'exploratory conversations' with the family-owned bank his firm intends to acquire. He learns which board members trust which advisors. He never names the acquisition. He uses the word 'partnership' until the offer letter arrives. The family signs in three days. They had grown comfortable with him.\n\n"
            "The limit is sharp. Concealment as a habit makes you untrustworthy in relationships that depend on transparency. Marriages, friendships, long collaborations all require visible intentions. Apply the Law where the relationship is structural and the counterparty's interests diverge from yours. Apply transparency where the parties survive together."
        ),
        "fullRead": (
            "At 4:14 on a Tuesday, the silence at the board table meant something Camille had been waiting six weeks to hear. The CFO had just realized that the consulting engagement Camille's firm signed in March was not a consulting engagement at all. It was an audit, conducted under the cover of strategy work, that would now form the basis of the financial restatement the board had to authorize before markets opened on Monday. Camille had not lied to anyone. Every meeting she scheduled had a label that matched its agenda. The aggregation was the deception. No one had asked, at any point in fourteen weeks, what the meetings were aggregating into.\n\n"
            "That is the form concealment takes in environments where direct lying would be detected and punished. The components are public. The arrangement is private. Catherine de Medici survived three reigns this way. As regent during the religious wars in sixteenth-century France, she was constantly suspected by everyone of supporting the opposite faction. She gave audiences to Catholic nobles and Huguenot leaders in alternating weeks. She wrote letters in three voices. She let each party believe she favored them slightly more than the other party. The truth was that she favored none of them. Her interest was the survival of the monarchy and her own children's claims to it. Every concealment served that interest, and every faction that thought they had her support was wrong in a way they could not afford to test.\n\n"
            "Beatriz runs a chief of staff role for a senator and operates the same way at smaller scale. When a hostile journalist asks whether the senator is considering a presidential run, Beatriz answers, 'The senator is focused on the work of this term.' That answer is true and useless. It tells the journalist nothing about the calendar of donor meetings Beatriz has been arranging in Iowa for four months. The journalist files a story that misses the actual arrangement because the visible signals support a different story.\n\n"
            "The mechanism: most people read intentions from the surface of behavior, and most people are wrong. They assume that if you wanted X, you would say X, or at least move toward X visibly. A practiced concealer arranges the surface to read as Y while the actual movement toward X happens through channels the reader is not watching. Talleyrand survived from the Revolution to the Restoration by appearing to support whatever regime he was nominally serving while preparing the relationships he would need under the next one. Five regimes. Each one believed he was theirs. He was no one's.\n\n"
            "This Law does not apply to people whose interests align with yours, and it corrodes relationships where mutual trust is the operating substance. A spouse, a longtime collaborator, a mentor in good faith, these are people to whom you owe legibility, because they are betting on the same outcome you are. Concealment in those relationships does not protect anything. It just makes you smaller in the only company that mattered.\n\n"
            "The smallest version of the Law is the most useful. Before any consequential meeting, ask: what will the other person assume I want from this conversation? Then ask: what would happen if I let them keep that assumption? Often the answer is that you do not need to correct them. They will arrange themselves around their own misreading, and you will arrive at what you actually wanted by way of their interpretation. The room organized itself. You only had to not interrupt it."
        ),
        "memorableLines": [
            {
                "text": "Concealment is not deception. It is letting other people's assumptions do most of the work.",
                "location": "breakdown.fastRead",
                "why": "Reframes concealment from moral failure to operational design in one sentence."
            },
            {
                "text": "Concealment had done the heavy work before any soldier fired.",
                "location": "breakdown.deepRead",
                "why": "Compresses the Bismarck case into a portable image about pre-arranged fields."
            },
            {
                "text": "The room organized itself. You only had to not interrupt it.",
                "location": "breakdown.fullRead",
                "why": "Image-anchored closer that names the smallest version of the Law: let misreading do the work."
            }
        ]
    },
    {
        "number": 4,
        "hook": "Why did Louis XIV's silences in council matter more than the speeches that followed them?",
        "counterintuition": "Words committed in front of the wrong audience commit you to defending them, then to repeating them, then to escalating them. The shorter your sentences, the more freedom you keep about what they meant.",
        "keyTakeaway": "The more you say, the more interpretations others can construct, and most of those interpretations are worse than the silence you could have offered instead.",
        "tryThisNow": "Before your next high-stakes meeting, write the three positions you are willing to defend in writing if you are quoted. In the room, do not say anything beyond those three. Let other people fill the silences.",
        "fastRead": (
            "Reza walks into the funding meeting at 9 a.m. with a slide deck he has spent three weeks pruning. Each slide has at most one sentence. The investor opens with twenty minutes of questions designed to make Reza fill silences. Reza answers each in a single line. 'Yes.' 'Our customer acquisition cost is in the deck on slide four.' 'No, that is not a problem we have.' By the end of the meeting, the investor is doing most of the talking, and Reza has not promised anything he cannot deliver. The investor leaves describing him as 'unusually disciplined.' Reza had not been disciplined in the meeting. He had been disciplined three weeks earlier, writing out everything he was not going to say."
        ),
        "deepRead": (
            "Louis XIV ran the most centralized court in seventeenth-century Europe partly through silence. When a courtier brought him a request, Louis would listen, pause, and answer, 'I shall see.' Sometimes the matter was decided that day, sometimes in three weeks, sometimes never. The four words committed him to nothing and gave the courtier nothing to argue against. A king who said little could not be quoted against himself, pinned to a position, or drawn into a faction by the precision of his preferences. The silence around him became the medium in which his power operated. Saint-Simon, who hated Louis, recorded the technique with something close to awe.\n\n"
            "Coriolanus had the opposite habit and the opposite fate. Sent to address the plebeians as a candidate for consul, he could not stop himself from saying what he thought of them. The patrician contempt poured out unfiltered. His words became the case against him. He was exiled. He had spoken enough for every faction to find evidence for what it already wanted to believe about him.\n\n"
            "The mechanism is not mystical. The more you say, the more interpretations the audience can construct, and most are worse than your silence. People who talk freely give their opponents free ammunition. People who talk briefly let listeners construct the more flattering reading. The least flattering reading is usually closer to the truth, but listeners reach for the flattering one first.\n\n"
            "The limit is real. Some conversations require length: medical informed consent, technical instruction, a child asking why a parent is angry. Being laconic with people who depend on your clarity is performative coldness, not power. The Law applies where you are measured, recorded, or repeated. Not where you are depended on for shared understanding."
        ),
        "fullRead": (
            "Yusuf sits across from a journalist who has been waiting four months for this interview. The journalist has prepared sixty questions and arrives with a digital recorder that already has the red light on. Yusuf is the CEO of a company three weeks from announcing a layoff. He cannot say so. He also cannot deny it convincingly, because the story is already half-reported. The journalist opens with a soft question about company culture. Yusuf answers in two sentences and stops. The journalist waits. Yusuf waits. The silence runs for nine seconds, which in interview time is roughly an hour. The journalist breaks first, moving to the next question. Yusuf has just learned that the most useful thing he can do in this room is refuse to be entertaining. By the end of the hour, the journalist has filled fifty of those sixty minutes with their own talking. Yusuf has not lied. He has also not given the journalist a quote that can build the story against him.\n\n"
            "The technique has a name in some negotiation manuals: the productive pause. It works for the same reason Louis XIV's 'I shall see' worked. Humans hate silence and will fill it with something less useful than what you were not saying.\n\n"
            "Henry Kissinger built his career on the same instinct in higher-stakes form. In the back-channel negotiations with China in 1971, he discovered that the Chinese delegation would interpret any extra American word as a binding commitment. So he learned to deliver narrow statements and let the interpreter's pause stand as the closing of his turn. He did not embellish. The other side, accustomed to American verbosity, sometimes mistook the brevity for hostility and tried harder to please. The arrangements he made that summer reshaped the Cold War, partly because he refused to commit America to anything he had not first decided to commit America to.\n\n"
            "Words spent are words you have to defend. A sentence offered casually becomes a position by Friday. Three months later, a colleague will quote it back as evidence of what you 'said you believed,' and you will not remember saying it. The economy of speech is not about being mysterious. It is about not signing contracts you did not intend to sign.\n\n"
            "Reza's discipline in the funding meeting was a procedure, not a personality trait. Before any meeting where he might be quoted, he writes the three positions he is willing to defend in writing if the other party records them. Anything beyond those three positions, he treats as off-limits, regardless of how friendly the conversation feels. The friendly conversation is the most dangerous one. People drop their guard. They lengthen their sentences. They add color. The color is later used to build a narrative they would never have agreed to write.\n\n"
            "This Law has reversals. A relationship where the other party depends on transparency, where brevity reads as withholding: a board, a partner, a team in crisis. In those rooms, silence breeds suspicion. A moment where you have a genuine vision and need to put it into language others can act on: speeches are not made in monosyllables. A culture where verbal warmth is the price of access, and refusing to spend it marks you as cold beyond usefulness.\n\n"
            "The remaining ninety-five percent of professional life is not those situations. It is meetings, calls, conferences, hallway conversations, and quoted remarks. In those rooms, the people who say less arrive at the end of the day with their options still open. The people who say more arrive already half-committed to positions they cannot quite remember choosing.\n\n"
            "Louis XIV signed almost nothing. His chancellor signed for him. His ministers signed for him. The king said, 'I shall see,' and the court arranged itself around the absence of his commitment. The throne held for seventy-two years."
        ),
        "memorableLines": [
            {
                "text": "He had been disciplined three weeks earlier, writing out everything he was not going to say.",
                "location": "breakdown.fastRead",
                "why": "Names that discipline of speech is preparation, not performance, in a portable image."
            },
            {
                "text": "The silence around him became the medium in which his power operated.",
                "location": "breakdown.deepRead",
                "why": "Compresses the Louis XIV case into an image about silence as operating substance."
            },
            {
                "text": "The friendly conversation is the most dangerous one.",
                "location": "breakdown.fullRead",
                "why": "Six-word warning about where talkative people lose ground without noticing."
            }
        ]
    }
]


def main():
    data = json.load(open(PATH))
    chapters_by_num = {c["number"]: c for c in data["chapters"]}

    for u in UPDATES:
        ch = chapters_by_num[u["number"]]
        ch["hook"] = u["hook"]
        ch["counterintuition"] = u["counterintuition"]
        ch["keyTakeaway"] = u["keyTakeaway"]
        ch["tryThisNow"] = u["tryThisNow"]
        ch["breakdown"]["fastRead"] = u["fastRead"]
        ch["breakdown"]["deepRead"] = u["deepRead"]
        ch["breakdown"]["fullRead"] = u["fullRead"]
        ch["memorableLines"] = u["memorableLines"]

    # Verify floors and report
    issues = []
    for u in UPDATES:
        n = u["number"]
        for tier, floor in (("fastRead", 400), ("deepRead", 1200), ("fullRead", 2800)):
            length = len(u[tier])
            if length < floor:
                issues.append(f"Ch{n} {tier}={length} UNDER floor {floor}")
            elif tier == "fastRead" and length > 700:
                issues.append(f"Ch{n} {tier}={length} OVER ceiling 700")
            elif tier == "deepRead" and length > 1800:
                issues.append(f"Ch{n} {tier}={length} OVER ceiling 1800")
            elif tier == "fullRead" and length > 3800:
                issues.append(f"Ch{n} {tier}={length} OVER ceiling 3800")
        # Hook range
        h = len(u["hook"])
        if h < 60 or h > 140:
            issues.append(f"Ch{n} hook={h} chars OUT OF RANGE 60-140")
        c = len(u["counterintuition"])
        if c < 80 or c > 280:
            issues.append(f"Ch{n} counterintuition={c} chars OUT OF RANGE 80-280")
        # Memorable lines verbatim check
        all_prose = u["fastRead"] + "\n" + u["deepRead"] + "\n" + u["fullRead"]
        for ml in u["memorableLines"]:
            if ml["text"] not in all_prose:
                issues.append(f"Ch{n} memorableLine NOT VERBATIM: '{ml['text'][:60]}...'")
        # keyTakeaway word count
        kt_words = len(u["keyTakeaway"].split())
        if kt_words > 30:
            issues.append(f"Ch{n} keyTakeaway={kt_words} words OVER 30-word limit")

    if issues:
        print("VALIDATION FAILURES:")
        for i in issues:
            print(f"  {i}")
        sys.exit(1)

    # Tier-length summary
    print("BATCH 1 TIER LENGTHS:")
    for u in UPDATES:
        print(f"  Ch{u['number']:2d}: fast={len(u['fastRead']):4d} deep={len(u['deepRead']):4d} full={len(u['fullRead']):4d}")

    with open(PATH, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print(f"\nWrote {len(UPDATES)} chapter updates to {PATH}")


if __name__ == "__main__":
    main()
