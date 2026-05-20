#!/usr/bin/env python3
"""
Rewrite quiz prompts/choices/explanations for indistractable.v21.json Ch2-Ch30.

Goal: replace heavily templated prompts with distinct scenarios so no two
questions per chapter share a 6+ word substring. Each prompt is a
self-contained scenario with a unique protagonist and trigger. Choices are
concrete actions, not labels.

Touches only: question.prompt, question.choices, question.correctIndex,
question.explanation. Preserves questionId, bloomsLevel, depthLevel.
"""

import json
import re
import sys
from pathlib import Path

PATH = Path("book-packages/indistractable.v21.json")


# --- New questions, indexed by chapter number ---
NEW_QUIZZES: dict[int, list[dict]] = {}


NEW_QUIZZES[2] = [
    # q01 understand simple
    {
        "prompt": "At 4:15 p.m., Maya, a fundraising director, keeps sliding a difficult donor call to 'tomorrow' after last week's call ended in tension. What is the clearest first move?",
        "choices": [
            "Move the call to Monday and add a fresh focus block.",
            "Write down what she dreads about the call before rescheduling it.",
            "Promise herself she will be braver at the next attempt.",
        ],
        "correctIndex": 1,
        "explanation": "Slippage is the evidence; the discomfort under it has to be named before any new slot will hold.",
    },
    # q02 apply simple
    {
        "prompt": "Owen, a hospital pharmacist, postpones a controlled-substance count every shift it lands during a chaotic handoff. Which response fits the chapter's idea?",
        "choices": [
            "Drop the count from his daily duties to clear pressure.",
            "Name the handoff anxiety and book the count for a calmer hour.",
            "Resolve to count more quickly and move on.",
        ],
        "correctIndex": 1,
        "explanation": "The skipped count is avoided discomfort; planning when to face it makes intent louder than the urge.",
    },
    # q03 apply simple
    {
        "prompt": "A tax preparer keeps swapping a messy self-employed return for tidier W-2 work whenever the messy file opens. The author would advise what?",
        "choices": [
            "Reshuffle the day so cleaner files come first.",
            "Treat the swap as proof of avoided uncertainty and book a slot for the hard part.",
            "Switch to a faster filing template to feel productive.",
        ],
        "correctIndex": 1,
        "explanation": "Renaming uncertainty as efficiency hides the real cost; an appointed slot turns the avoidance into a plan.",
    },
    # q04 apply standard
    {
        "prompt": "After a tense email about a slipped roof inspection, a residential surveyor avoids opening the report for three afternoons. What should she test first?",
        "choices": [
            "Whether a quieter office would help her focus.",
            "Whether the report contains a number she is dreading.",
            "Whether all reports should be done in the morning.",
        ],
        "correctIndex": 1,
        "explanation": "The pattern points to a specific dread inside the file, not a workspace problem.",
    },
    # q05 apply standard
    {
        "prompt": "During quarterly close, an accounts-payable lead keeps shifting an unsigned invoice to the next folder. Which move counts as traction here?",
        "choices": [
            "Send the invoice back to the requester without comment.",
            "State what makes the signature uncomfortable and schedule the call it requires.",
            "Sort folders by color to feel less behind.",
        ],
        "correctIndex": 1,
        "explanation": "Reshuffling is more avoidance dressed up; the signature has a person attached, and that conversation needs a time.",
    },
    # q06 analyze standard
    {
        "prompt": "A grant officer says, 'My calendar is just full.' You notice she always reschedules the same donor letter. What is missing from her diagnosis?",
        "choices": [
            "She has not adopted the right calendar app.",
            "She has not asked what discomfort the donor letter holds.",
            "She has not blocked enough working hours this quarter.",
        ],
        "correctIndex": 1,
        "explanation": "'Full' is the cover story; the repeated victim says where the pain lives.",
    },
    # q07 analyze deep
    {
        "prompt": "Two colleagues review a delayed compliance memo. One proposes a tighter deadline; the other proposes naming the discomfort and putting it on the calendar. Which plan respects the chapter's logic?",
        "choices": [
            "The tighter deadline, because urgency forces action.",
            "The named discomfort, because it treats the slip as evidence and answers it.",
            "Both, applied without any diagnosis.",
        ],
        "correctIndex": 1,
        "explanation": "Without naming the pain, a tighter deadline only shortens the runway for the same avoidance.",
    },
    # q08 analyze deep
    {
        "prompt": "Sequence: a veterinary tech opens an unsigned consent form, scrolls a recipe site for nine minutes, then closes the file. Where would the chapter intervene first?",
        "choices": [
            "Block the recipe site on her clinic phone after work.",
            "Pause when the file opens and label what the form makes her feel.",
            "Reorder her shift so the file appears later.",
        ],
        "correctIndex": 1,
        "explanation": "The recipe site is the relief; the form is the trigger. Intervention belongs at the trigger.",
    },
    # q09 evaluate deep
    {
        "prompt": "Compare three responses to a habitually skipped one-on-one: a firm rule against rescheduling, a label calling it avoidance, or a booked slot with the dreaded topic written down. Which is strongest as a first step?",
        "choices": [
            "The rule, because firmness will hold the meeting.",
            "The booked slot with the dreaded topic written, because it gives the avoidance a real appointment.",
            "The label, because naming the avoidance is enough.",
        ],
        "correctIndex": 1,
        "explanation": "Rules and labels still leave the pain unplaced; a written slot ties intent to a moment that can be kept.",
    },
]


NEW_QUIZZES[3] = [
    {
        "prompt": "At a courthouse hallway, a paralegal feels her jaw tighten before a contentious filing and her hand drifts to a game icon. What is the clearest first move?",
        "choices": [
            "Delete the game before the next filing deadline.",
            "Name the tight jaw out loud before unlocking the phone.",
            "Promise to focus harder once filings calm down.",
        ],
        "correctIndex": 1,
        "explanation": "The body signal arrives before language; labeling it interrupts the urge from choosing for her.",
    },
    {
        "prompt": "Theo, a line cook, feels heat in his chest each time a ticket prints during the dinner rush, then reaches for his vape. Which response matches the chapter's core move?",
        "choices": [
            "Hide the vape in his locker tomorrow.",
            "Say 'heat in chest' under his breath and breathe once before the next ticket.",
            "Switch to mints and hope the urge fades.",
        ],
        "correctIndex": 1,
        "explanation": "Labeling the sensation pulls it out of the body and into a sentence he can act on.",
    },
    {
        "prompt": "A community college instructor feels a knot in his stomach when a student stays after class, and he reaches for his phone instead. The author would advise what?",
        "choices": [
            "Cut after-class hours so students stop lingering.",
            "Notice the stomach knot, name it, and take one breath before responding to the student.",
            "Keep his phone in his bag from now on.",
        ],
        "correctIndex": 1,
        "explanation": "Removing tools alone leaves the body signal unaddressed; the pause is where the chapter does its work.",
    },
    {
        "prompt": "During an inventory audit at midnight, a warehouse supervisor notices her hands fidgeting and a tablet game flickers in her mind. What should she test first?",
        "choices": [
            "Whether better lighting would steady her.",
            "Whether the fidget is anxiety she can name in six words.",
            "Whether audits should always be done in pairs.",
        ],
        "correctIndex": 1,
        "explanation": "The body has already spoken; a short label is the test that opens a different choice.",
    },
    {
        "prompt": "On a long radiology shift, Priya feels a hum of dread before reading a difficult scan and toggles to a news tab. Which move counts as traction?",
        "choices": [
            "Close the browser entirely for the rest of the shift.",
            "Write the body sensation in five words, exhale, then open the scan.",
            "Skip to the easier scan and circle back later.",
        ],
        "correctIndex": 1,
        "explanation": "Skipping to the easier scan is another escape route; the labeled pause is the chapter's small handle.",
    },
    {
        "prompt": "A senior reporter insists, 'I just lose focus when I write.' You watch her start typing the second a politician's tweet pings. What is missing from her diagnosis?",
        "choices": [
            "She has not chosen a quieter office.",
            "She has not named the body cue that arrives right before she opens the alert.",
            "She has not written enough drafts this week.",
        ],
        "correctIndex": 1,
        "explanation": "She is treating the alert as the cause and skipping the sensation that gives it permission.",
    },
    {
        "prompt": "Two coaches debate how to help a swimmer who picks up his phone between sets. One wants a phone ban; the other wants the swimmer to label the body feeling that arrives between sets. Which plan respects the chapter's logic?",
        "choices": [
            "The ban, because removing the phone removes the problem.",
            "The labeling, because the body signal is the lever the swimmer can actually catch.",
            "Neither, because adolescents will resist any change.",
        ],
        "correctIndex": 1,
        "explanation": "A ban does not teach the inside skill; labeling builds the swimmer's own ability to notice.",
    },
    {
        "prompt": "Sequence: a violin maker hears a critique from a client, his shoulders tense, he opens a marketplace app, and twenty minutes evaporate. Where would the chapter intervene first?",
        "choices": [
            "Disable the marketplace app on his workshop tablet.",
            "Pause at the shoulder tension and name it before any device is touched.",
            "Schedule client critiques only by email.",
        ],
        "correctIndex": 1,
        "explanation": "Removing the app misses the moment of tension that opens any escape route.",
    },
    {
        "prompt": "Compare three first responses to an urge that arrives during a quiet hour of writing: ignore it, scold yourself for it, or describe the body sensation in six words. Which is strongest as a first step?",
        "choices": [
            "Ignoring, because urges fade if left alone.",
            "Describing the body sensation in six words, because language slows the chain from urge to action.",
            "Scolding, because shame restores discipline.",
        ],
        "correctIndex": 1,
        "explanation": "Ignoring and scolding both skip the body cue; description gives the urge a name and a beat of delay.",
    },
]


NEW_QUIZZES[4] = [
    {
        "prompt": "At 9:02 a.m., Isabel redraws the same patent diagram twice and the word 'fraud' enters her mind unbidden. What is the clearest first move?",
        "choices": [
            "Power through the diagram and try again later.",
            "Write 'This frustration is information about which line is unclear,' then mark that line.",
            "Promise herself she will be a better engineer tomorrow.",
        ],
        "correctIndex": 1,
        "explanation": "Reframing the feeling as a signal converts it from an order to a piece of data.",
    },
    {
        "prompt": "A high-school teacher feels a wave of shame whenever she sees a low parent reply rate to her newsletters. Which response matches the chapter's core move?",
        "choices": [
            "Stop sending the newsletter for a month.",
            "Tell herself the shame points to a clearer subject line, then test one new line.",
            "Vent to a colleague and move on.",
        ],
        "correctIndex": 1,
        "explanation": "The story attached to the feeling is rewritten into a usable next action instead of an exit.",
    },
    {
        "prompt": "A junior dev opens a pull request review and a thought lands: 'I'm a fraud.' The author would advise what?",
        "choices": [
            "Close the review and ask a senior to handle it.",
            "Rewrite the thought as 'This is a signal I need to read the failing test more carefully,' then read it.",
            "Skip the test and approve the PR quickly.",
        ],
        "correctIndex": 1,
        "explanation": "The thought is treated as data about what to do next, not as a verdict about identity.",
    },
    {
        "prompt": "After a sharp comment in rounds, a resident feels his face flush and tells himself, 'I'm not cut out for medicine.' What should he test first?",
        "choices": [
            "Whether he should switch to research.",
            "Whether the flush is a signal he can rewrite into 'one piece of feedback to absorb today.'",
            "Whether attendings should be banned from sharp comments.",
        ],
        "correctIndex": 1,
        "explanation": "The reframe converts the feeling into a contained, actionable next move.",
    },
    {
        "prompt": "During the last hour of a long flight, a copilot feels boredom and a pull toward a movie tab on his tablet. Which move counts as traction?",
        "choices": [
            "Watch the movie since the autopilot is on.",
            "Tell himself the boredom is a cue to run the descent briefing one more time.",
            "Wait for the boredom to fade by itself.",
        ],
        "correctIndex": 1,
        "explanation": "The feeling becomes information about what attention should turn to, not a permission slip to drift.",
    },
    {
        "prompt": "A novelist insists, 'My writing brain is broken when I'm anxious.' You read her notebook and find anxiety arrives only before dialogue scenes. What is missing from her diagnosis?",
        "choices": [
            "She has not bought a better notebook.",
            "She has not asked what the anxiety is telling her about dialogue she is avoiding.",
            "She has not joined a stricter writing group.",
        ],
        "correctIndex": 1,
        "explanation": "The feeling is specific, which means it carries information she can use.",
    },
    {
        "prompt": "Two therapists discuss a client who scrolls during stressful evenings. One wants to call the scrolling a moral lapse; the other wants the client to read the feeling as a signal about what is unsaid in the marriage. Which view respects the chapter's logic?",
        "choices": [
            "The moral lapse view, because shame motivates change.",
            "The signal view, because the feeling carries usable information about the marriage.",
            "Neither, because behavior change requires medication.",
        ],
        "correctIndex": 1,
        "explanation": "Treating the feeling as a signal makes the next conversation possible.",
    },
    {
        "prompt": "Sequence: a small-business owner sees an unread tax email, feels a sinking gut, decides 'I'm bad at this,' and opens a YouTube video. Where would the chapter intervene first?",
        "choices": [
            "Block YouTube during business hours.",
            "Catch the sinking gut and rewrite the story as 'one specific question to ask the accountant.'",
            "Outsource taxes permanently.",
        ],
        "correctIndex": 1,
        "explanation": "The video is downstream; the story attached to the feeling is what opens the door.",
    },
    {
        "prompt": "Compare three responses to the thought 'I always fail at hard reading': suppress it, repeat a positive affirmation over it, or convert it into 'this signal points at one paragraph I should reread slowly.' Which is strongest?",
        "choices": [
            "Suppressing it, because the thought will pass.",
            "Converting it into a paragraph-level next action, because the feeling becomes information instead of a verdict.",
            "Affirming over it, because positive thinking outweighs the doubt.",
        ],
        "correctIndex": 1,
        "explanation": "Suppression and affirmations both bypass the data; the rewrite turns it into a small, doable move.",
    },
]


NEW_QUIZZES[5] = [
    {
        "prompt": "At an estate sale, a young archivist faces three crates of unsorted donation bookplates and feels dread before the first lid. What is the clearest first move?",
        "choices": [
            "Skip the crates and label what is on the desk.",
            "Pick one bookplate and ask a small question about it before sorting anything else.",
            "Bring in a colleague to do half the work.",
        ],
        "correctIndex": 1,
        "explanation": "The task becomes interesting when a puzzle lives inside it; one question is enough to start.",
    },
    {
        "prompt": "Renata, a city planner, has to write a routine zoning brief and her hand keeps drifting to a news tab. Which response matches the chapter's core idea?",
        "choices": [
            "Block the news tab in her browser.",
            "Pose one zoning question she does not yet know the answer to and write toward it.",
            "Postpone the brief until Monday.",
        ],
        "correctIndex": 1,
        "explanation": "A question turns the brief from sentence-filling into search; attention follows the puzzle.",
    },
    {
        "prompt": "A first-year law associate is asked to summarize a tedious case for the partner and is bored within ten minutes. The author would advise what?",
        "choices": [
            "Use a faster summarizing template.",
            "Hunt for the one fact the partner is most likely to ask about and lead with it.",
            "Delegate the summary to a paralegal.",
        ],
        "correctIndex": 1,
        "explanation": "Finding the buried fact gives the boring task a target and a small visible win.",
    },
    {
        "prompt": "After three days of identical data entry, a research assistant catches himself opening tabs that do not belong. What should he test first?",
        "choices": [
            "Whether faster typing would help.",
            "Whether a small pattern check inside the data could give him a puzzle to chase.",
            "Whether the dataset should be smaller.",
        ],
        "correctIndex": 1,
        "explanation": "The fix lives inside the task, not outside it; a chosen puzzle resets curiosity.",
    },
    {
        "prompt": "During monthly bookkeeping, an indie bookstore owner keeps drifting to social feeds whenever the spreadsheet opens. Which move counts as traction?",
        "choices": [
            "Move bookkeeping to an evening hour.",
            "Pick one number she wants to understand this month and start tracking it inside the sheet.",
            "Skip social media for a week.",
        ],
        "correctIndex": 1,
        "explanation": "Tracking a chosen number gives the spreadsheet a small puzzle to chase.",
    },
    {
        "prompt": "A new sales rep says, 'Cold calls are too boring to focus on.' You notice she reads each script line for line and never deviates. What is missing from her diagnosis?",
        "choices": [
            "She has not been given enough leads.",
            "She has not turned each call into a small question she is testing.",
            "She has not memorized the script better.",
        ],
        "correctIndex": 1,
        "explanation": "The script becomes a script when nothing inside is being learned; a question changes the call.",
    },
    {
        "prompt": "Two managers debate how to keep a team focused during a long migration project. One wants stricter monitoring; the other wants each engineer to define a small uncertainty inside their slice to chase. Which plan respects the chapter's logic?",
        "choices": [
            "Stricter monitoring, because surveillance keeps focus.",
            "The chosen uncertainty, because a puzzle inside the task makes attention return.",
            "Both, with no thought given to the work itself.",
        ],
        "correctIndex": 1,
        "explanation": "Monitoring polices behavior from outside; a puzzle inside the slice does the work.",
    },
    {
        "prompt": "Sequence: a midwife is reviewing routine charting, her eyes glaze, she reaches for her phone, ten minutes vanish. Where would the chapter intervene first?",
        "choices": [
            "Move her phone to a different room before charting.",
            "Before the glaze, pick one charting pattern she will look for tonight.",
            "Spread charting across more nights.",
        ],
        "correctIndex": 1,
        "explanation": "A pattern to hunt gives the chart a puzzle, which is what attention needs.",
    },
    {
        "prompt": "Compare three responses to a boring grading pile: do it faster, blast music, or treat the pile as a search for the most common error and act on it. Which is strongest?",
        "choices": [
            "Doing it faster, because speed beats boredom.",
            "Treating the pile as a search, because a finding inside the task is what makes attention come back.",
            "Blasting music, because energy carries through.",
        ],
        "correctIndex": 1,
        "explanation": "Speed and music decorate the task; the search changes what the task is.",
    },
]


NEW_QUIZZES[6] = [
    {
        "prompt": "Finn, a small-town meteorologist, says, 'I'm not a desk person,' and stalls on the storm summary. What is the clearest first move?",
        "choices": [
            "Hire someone else to do the desk part.",
            "Strike the sentence and write one observable behavior he will perform in the next thirty minutes.",
            "Promise to be more disciplined next week.",
        ],
        "correctIndex": 1,
        "explanation": "The identity claim is the alibi; one observable behavior tests a different self-story.",
    },
    {
        "prompt": "A high-school student tells her tutor, 'I'm just terrible at math.' Which response matches the chapter's core move?",
        "choices": [
            "Switch the student to a different subject.",
            "Ask her to name one specific problem she will try, then watch what happens.",
            "Repeat that math is hard for everyone.",
        ],
        "correctIndex": 1,
        "explanation": "The label dissolves when a small behavior shows up to contradict it.",
    },
    {
        "prompt": "A retired carpenter says, 'I'm too old to learn this software.' The author would advise what?",
        "choices": [
            "Suggest he stick to paper plans.",
            "Pick one feature he will operate today and treat the success or failure as the only relevant data.",
            "Buy him a younger person's tablet.",
        ],
        "correctIndex": 1,
        "explanation": "Age is a story; the next observable click is the test.",
    },
    {
        "prompt": "After a meeting where he stayed silent, a new analyst tells himself, 'I'm bad at speaking up.' What should he test first?",
        "choices": [
            "Whether he should request more written meetings.",
            "Whether one prepared sentence in the next meeting changes the story.",
            "Whether his role should be reassigned.",
        ],
        "correctIndex": 1,
        "explanation": "A single observed action is what evidence looks like against a fixed identity.",
    },
    {
        "prompt": "During a long apartment search, Camille says, 'I'm a procrastinator about big calls.' Which move counts as traction?",
        "choices": [
            "Move all calls to her partner.",
            "Make exactly one ten-minute call today and let that fact rewrite the label.",
            "Wait until she 'feels ready' to call.",
        ],
        "correctIndex": 1,
        "explanation": "A proof-shaped action is small enough to do now and big enough to shift the story.",
    },
    {
        "prompt": "A founder insists, 'I'm not a numbers person.' You see her quickly correct typos in a board pitch. What is missing from her diagnosis?",
        "choices": [
            "She needs to hire a CFO immediately.",
            "She has not noticed that an action she just performed is closer to numeracy than her label admits.",
            "She should outsource the pitch entirely.",
        ],
        "correctIndex": 1,
        "explanation": "Evidence of a different self-story is already present; the label is doing work it should not.",
    },
    {
        "prompt": "Two coaches argue about a player who calls herself 'not a leader.' One wants daily affirmations; the other wants the player to take one observable captain-like action per practice. Which plan respects the chapter's logic?",
        "choices": [
            "Affirmations, because identity follows belief.",
            "The observable action, because behavior is what tests and updates the story.",
            "Both, with no observation tied to either.",
        ],
        "correctIndex": 1,
        "explanation": "Affirmations rehearse a label; behavior produces evidence the label cannot ignore.",
    },
    {
        "prompt": "Sequence: a graphic designer hears 'I need real strategy work, not pretty work,' she thinks 'I'm just a visual person,' she opens TikTok, the brief sits. Where would the chapter intervene first?",
        "choices": [
            "Block TikTok during work hours.",
            "Interrupt the thought 'I'm just a visual person' with one observable strategy sentence she will draft now.",
            "Decline the brief.",
        ],
        "correctIndex": 1,
        "explanation": "The label is upstream of the app; rewriting it through one action redirects the chain.",
    },
    {
        "prompt": "Compare three responses to the claim 'I'm not a morning person': accept it, force a 5 a.m. alarm for a month, or do one observable morning activity tomorrow and record what happens. Which is strongest?",
        "choices": [
            "Acceptance, because temperament cannot change.",
            "The single recorded behavior, because it tests the label without bargaining over identity.",
            "The 5 a.m. alarm, because grit overrides chronotype.",
        ],
        "correctIndex": 1,
        "explanation": "One observable trial is enough to update the self-story without overselling the change.",
    },
]


NEW_QUIZZES[7] = [
    {
        "prompt": "At Sunday dinner, Ramon says family time is his top value but his calendar this week has none. What is the clearest first move?",
        "choices": [
            "Promise to be more present going forward.",
            "Put a specific family block on Tuesday at 6:30 p.m. with a chosen activity and location.",
            "Reduce work hours someday soon.",
        ],
        "correctIndex": 1,
        "explanation": "A value without a calendar slot has no defense against errands; concreteness is the protection.",
    },
    {
        "prompt": "A new manager lists 'mentorship' as a top value but has held no mentee meetings in three months. Which response matches the chapter's idea?",
        "choices": [
            "Add 'mentorship' to her annual goals.",
            "Schedule a recurring thirty-minute mentee block for Thursday mornings.",
            "Read a book about being a better mentor.",
        ],
        "correctIndex": 1,
        "explanation": "Belief without a slot keeps losing to whatever else fills the day.",
    },
    {
        "prompt": "A medical resident says fitness matters to him but goes to the gym once a month. The author would advise what?",
        "choices": [
            "Buy nicer workout clothes.",
            "Place three named gym blocks on the calendar this week, including which gym and which exercise opens each one.",
            "Talk about wanting to be fitter on social media.",
        ],
        "correctIndex": 1,
        "explanation": "A protected square with details is what makes a value survive the day.",
    },
    {
        "prompt": "After moving to a new city, a designer says she values friendship but has not invited anyone over since arriving. What should she test first?",
        "choices": [
            "Whether her apartment is welcoming enough.",
            "Whether putting one specific dinner invitation on next Friday shifts the value into time.",
            "Whether she should rejoin a hobby club someday.",
        ],
        "correctIndex": 1,
        "explanation": "A scheduled invitation makes the value visible; absent that, friendship remains a sentiment.",
    },
    {
        "prompt": "During a quarterly review, a founder says he values long-term thinking but every block is short-term firefighting. Which move counts as traction?",
        "choices": [
            "Talk about a strategy retreat someday.",
            "Block two hours Friday afternoon for the named long-term question and protect it on the calendar.",
            "Hire a consultant to think for him.",
        ],
        "correctIndex": 1,
        "explanation": "A protected, specific block is the chapter's bridge from belief to behavior.",
    },
    {
        "prompt": "A school principal insists reading is a core value at home. You notice his evening calendar shows only screen-time blocks. What is missing from his diagnosis?",
        "choices": [
            "He has not bought enough books for the house.",
            "He has not put a named family-reading block on his calendar that can be kept or honestly renegotiated.",
            "He has not made a stricter rule about screens.",
        ],
        "correctIndex": 1,
        "explanation": "Belief without time is just a slogan; the calendar is where the value lives or dies.",
    },
    {
        "prompt": "Two friends compare values: one keeps an aspirational list, the other puts each value on the calendar as concrete blocks she can keep or move. Which approach respects the chapter's logic?",
        "choices": [
            "The aspirational list, because writing it down is enough.",
            "The calendar blocks, because a value has to claim time to survive the week.",
            "Neither, because values cannot really be planned.",
        ],
        "correctIndex": 1,
        "explanation": "A list is testimony; a calendar block is action that can be defended or honestly renegotiated.",
    },
    {
        "prompt": "Sequence: a teacher says creative writing matters, the school week consumes evenings, she tells herself 'no time,' and the value drifts another week. Where would the chapter intervene first?",
        "choices": [
            "Quit the teaching job.",
            "Carve a specific forty-minute writing block on Sunday morning at the kitchen table.",
            "Wait until summer to start writing again.",
        ],
        "correctIndex": 1,
        "explanation": "A named time, place, and starting action is what makes a value claim the day.",
    },
    {
        "prompt": "Compare three responses to a stated value of 'physical health': journal about it, post about it, or place three named workout blocks for the week with start time and location. Which is strongest?",
        "choices": [
            "Journaling, because reflection precedes action.",
            "The three named blocks, because a value lives in protected time, not paragraphs.",
            "Posting, because public commitment is enough.",
        ],
        "correctIndex": 1,
        "explanation": "Reflection and posting are testimony; the calendar is where the value can be kept or renegotiated.",
    },
]


NEW_QUIZZES[8] = [
    {
        "prompt": "Before Friday's board meeting, Adrienne, a city budget analyst, has finalized her one-page memo and now feels pulled to keep editing it instead of preparing the next packet. What is the clearest first move?",
        "choices": [
            "Edit the memo one more time to feel ready.",
            "Define the next packet's controllable input and start it; release the board's decision.",
            "Refresh the email inbox for committee replies.",
        ],
        "correctIndex": 1,
        "explanation": "The board decides; she controls inputs. Endless edits substitute for that handoff.",
    },
    {
        "prompt": "A novelist on submission keeps refreshing email for editor responses. Which response matches the chapter's core idea?",
        "choices": [
            "Refresh the inbox every fifteen minutes.",
            "Close the email tab and write a defined input for the next book: one new scene draft before noon.",
            "Talk to other submitters about timing.",
        ],
        "correctIndex": 1,
        "explanation": "The submission outcome is out of her hands; a written scene is the controllable input that counts as kept faith.",
    },
    {
        "prompt": "A high-school senior keeps reloading the college portal and ignoring an unfinished essay for a different application. The author would advise what?",
        "choices": [
            "Reload the portal every hour.",
            "Define the input for the next application: finish a complete first draft of the essay tonight.",
            "Call the admissions office repeatedly.",
        ],
        "correctIndex": 1,
        "explanation": "The decision is sealed; the next draft is the input still under his control.",
    },
    {
        "prompt": "After sending a job proposal, a freelancer keeps checking 'read receipts.' What should she test first?",
        "choices": [
            "Whether a different proposal tool would help.",
            "Whether writing the next proposal's input plan beats refreshing receipts.",
            "Whether she should drop the client entirely.",
        ],
        "correctIndex": 1,
        "explanation": "Outcome-watching steals attention from the next input she can still ship.",
    },
    {
        "prompt": "During the third hour of a job interview wait, a chef keeps refreshing the email tab. Which move counts as traction?",
        "choices": [
            "Refresh more strategically.",
            "Close the tab and complete a defined recipe trial in the kitchen this afternoon.",
            "Email the hiring chef one more time.",
        ],
        "correctIndex": 1,
        "explanation": "The recipe trial is an input under her control; the inbox is not.",
    },
    {
        "prompt": "A startup founder says, 'I'm focused on the funding outcome.' You see him refresh investor inboxes between every task. What is missing from his diagnosis?",
        "choices": [
            "He has not contacted more investors.",
            "He has not defined which controllable input would count as a kept block this week, independent of fundraising results.",
            "He has not refined his pitch deck enough.",
        ],
        "correctIndex": 1,
        "explanation": "He has confused outcome obsession with productivity; the input is the missing handle.",
    },
    {
        "prompt": "Two project managers argue about a stalled product launch. One wants to lobby for a faster ship date; the other wants each engineer to commit a single defined daily input. Which plan respects the chapter's logic?",
        "choices": [
            "Lobbying for the date, because urgency drives output.",
            "The defined daily input, because the ship date is downstream of inputs and not directly controllable.",
            "Both, with no agreement on the input.",
        ],
        "correctIndex": 1,
        "explanation": "The ship date is an outcome; daily inputs are the lever the team actually holds.",
    },
    {
        "prompt": "Sequence: a salesperson sends a proposal at 9 a.m., refreshes email every twenty minutes, skips lunch, and his next-call list never gets touched. Where would the chapter intervene first?",
        "choices": [
            "Turn off email entirely for the day.",
            "Define the next-call list as the morning's controllable input and complete it before any inbox check.",
            "Send a follow-up nudge each hour.",
        ],
        "correctIndex": 1,
        "explanation": "The defined input is the kept block; refresh checking is a counterfeit version of work.",
    },
    {
        "prompt": "Compare three responses to a pending grant decision: refresh the funder's portal hourly, hope, or write the next grant's controllable input and ship it by Friday. Which is strongest?",
        "choices": [
            "Refreshing, because attention to outcomes proves commitment.",
            "Writing and shipping the next input, because that is the part still in her hands.",
            "Hoping, because outcomes are out of her hands.",
        ],
        "correctIndex": 1,
        "explanation": "Hope and refresh do not move the work; an input does.",
    },
]


NEW_QUIZZES[9] = [
    {
        "prompt": "Saturday morning is the only family stretch this week. Daniel, an electrician, says he 'will hang out with the kids.' What is the clearest first move?",
        "choices": [
            "Wait for the kids to ask for something.",
            "Block a specific model-kit hour with his son at 10 a.m., devices put away.",
            "Catch up on emails first.",
        ],
        "correctIndex": 1,
        "explanation": "Important time has to be claimed before errands eat the day; a specific activity makes it real.",
    },
    {
        "prompt": "A new mother says her sister is her closest friend but they have not spoken in six weeks. Which response matches the chapter's idea?",
        "choices": [
            "Wait until life settles down.",
            "Set a recurring thirty-minute walk-and-talk call for Sunday at 9 a.m.",
            "Send a meme every few days.",
        ],
        "correctIndex": 1,
        "explanation": "Important people need protected time, not leftover availability.",
    },
    {
        "prompt": "A grandfather wants weekly time with his grandson but every Sunday gets eaten by yardwork. The author would advise what?",
        "choices": [
            "Do yardwork together to multitask.",
            "Block 11 a.m.–noon Sunday for a named activity with the grandson before yard tasks.",
            "Hire a yard service someday.",
        ],
        "correctIndex": 1,
        "explanation": "The chosen block goes first; otherwise leftovers will keep losing.",
    },
    {
        "prompt": "After a long deployment, a returning soldier wants to reconnect with his teen daughter but their evenings have already filled with appointments. What should he test first?",
        "choices": [
            "Wait until the schedule clears.",
            "Set one weekly Tuesday-evening dinner block, just the two of them, before more appointments land.",
            "Send her daily texts instead.",
        ],
        "correctIndex": 1,
        "explanation": "A specific weekly block creates a defended slot before the calendar fills.",
    },
    {
        "prompt": "During a busy semester, a graduate student says her partner is a priority but does not know when they'll next be alone together. Which move counts as traction?",
        "choices": [
            "Hope a free evening shows up.",
            "Place a phones-down dinner block on Wednesday at 7 p.m. with a chosen restaurant.",
            "Plan a vacation in six months instead.",
        ],
        "correctIndex": 1,
        "explanation": "Connection lives in protected time; a chosen restaurant turns the block into a kept act.",
    },
    {
        "prompt": "A father insists, 'I'm always around the kids.' You notice he answers Slack throughout dinner. What is missing from his diagnosis?",
        "choices": [
            "He has not turned off notifications during work.",
            "He has not protected a phone-free dinner block as a kept commitment to the kids.",
            "He has not bought a better dining table.",
        ],
        "correctIndex": 1,
        "explanation": "Presence is a defended block, not background availability while doing other things.",
    },
    {
        "prompt": "Two siblings argue about visiting their aging mother. One says, 'I'll call when I can'; the other proposes a recurring Tuesday-evening call. Which plan respects the chapter's logic?",
        "choices": [
            "Calling when convenient, because flexibility honors the relationship.",
            "The recurring call, because important relationships need protected time before urgent fragments take over.",
            "Neither, because phone calls feel impersonal.",
        ],
        "correctIndex": 1,
        "explanation": "Recurring time is what defends the relationship from the week's drift.",
    },
    {
        "prompt": "Sequence: a startup founder cancels date night because investor emails arrive, ignores the rescheduled night, then says, 'My partner understands.' Where would the chapter intervene first?",
        "choices": [
            "Cancel investor meetings instead.",
            "Make the next date night a non-negotiable block with a planned activity and a backup if anything moves it.",
            "Apologize repeatedly.",
        ],
        "correctIndex": 1,
        "explanation": "A defended block with a planned activity is what makes 'priority' true rather than told.",
    },
    {
        "prompt": "Compare three responses to a friendship cooling because no one schedules: send sporadic memes, write a heartfelt apology, or co-block a recurring monthly hike with a chosen trailhead. Which is strongest?",
        "choices": [
            "Sporadic memes, because casual signals are enough.",
            "The recurring co-blocked hike, because the friendship now has protected time on both calendars.",
            "Heartfelt apology, because words restore closeness.",
        ],
        "correctIndex": 1,
        "explanation": "Memes and apologies do not survive the calendar; co-blocked time does.",
    },
]


NEW_QUIZZES[10] = [
    {
        "prompt": "On a Monday morning, a blood-bank coordinator faces three clinics asking when their orders will land. What is the clearest first move?",
        "choices": [
            "Answer each clinic in real time as messages arrive.",
            "Send a one-line note stating today's processing window and the urgent-only contact path.",
            "Promise faster turnaround going forward.",
        ],
        "correctIndex": 1,
        "explanation": "Visible plans replace silence; silence is what stakeholders fill with neglect or availability.",
    },
    {
        "prompt": "A staff engineer's manager says, 'You disappear during deep work and I worry things are stuck.' Which response matches the chapter's idea?",
        "choices": [
            "Stop doing deep work.",
            "Share a calendar block showing focus hours, response window, and urgent-only path.",
            "Reply to every Slack message instantly.",
        ],
        "correctIndex": 1,
        "explanation": "Making the plan visible is the cure for misread silence.",
    },
    {
        "prompt": "A pharmacist starts a four-hour audit and predicts colleagues will keep poking with non-urgent questions. The author would advise what?",
        "choices": [
            "Hide in the back without saying anything.",
            "Post a brief note at the counter: 'Audit until 12; non-urgent questions in the green box; urgent: text.'",
            "Refuse to answer questions for four hours.",
        ],
        "correctIndex": 1,
        "explanation": "Stakeholders need a route; the note makes focus legible without abandoning availability.",
    },
    {
        "prompt": "After a colleague complained that 'we never know when you're around,' a remote designer wonders what to change. What should she test first?",
        "choices": [
            "Become more available all day.",
            "Test sharing a daily three-line plan with focus block, response window, and urgent-only path.",
            "Stop responding altogether to push back.",
        ],
        "correctIndex": 1,
        "explanation": "A visible plan converts silence into expected behavior; that is the chapter's lever.",
    },
    {
        "prompt": "During a product launch week, a backend engineer wants to ship a critical migration. Which move counts as traction?",
        "choices": [
            "Stop reading Slack entirely.",
            "Tell the PM and SRE which two hours are focus, when she'll be back online, and what counts as urgent.",
            "Ship without coordinating with anyone.",
        ],
        "correctIndex": 1,
        "explanation": "Coordination through a visible plan defends focus and reassures stakeholders simultaneously.",
    },
    {
        "prompt": "A team lead complains, 'I have to micromanage Ben because he's silent for hours.' You see Ben works heads-down and produces good code. What is missing from his diagnosis?",
        "choices": [
            "Ben has not produced enough code.",
            "Ben has not made his focus plan visible to the lead so silence stops getting misread.",
            "The lead has not hired more engineers.",
        ],
        "correctIndex": 1,
        "explanation": "Visibility is the cure for misinterpreted silence; the lead can rely on a plan rather than a guess.",
    },
    {
        "prompt": "Two product managers debate how to handle interruptions on focused engineers. One wants Slack disabled during focus; the other wants engineers to post their plan with a visible response window. Which plan respects the chapter's logic?",
        "choices": [
            "Disabling Slack, because total silence guarantees focus.",
            "The visible plan with response window, because stakeholders know when to wait and when to interrupt.",
            "Neither, because focus and availability cannot coexist.",
        ],
        "correctIndex": 1,
        "explanation": "Total silence breeds misread; a posted plan creates predictable focus and reachable urgency.",
    },
    {
        "prompt": "Sequence: a customer success lead enters a focus block, three account managers ping her, she ignores them, they escalate to her boss, focus collapses. Where would the chapter intervene first?",
        "choices": [
            "Ignore the account managers more firmly.",
            "Before the block, send a one-line plan with focus window, return time, and urgent-only path.",
            "Ask the boss to forward all pings.",
        ],
        "correctIndex": 1,
        "explanation": "The escalation comes from silence; making the plan visible removes that cause.",
    },
    {
        "prompt": "Compare three responses to a manager who says, 'You're hard to reach': promise to be available, ignore the comment, or share a written daily plan with focus window, response cadence, and urgent path. Which is strongest?",
        "choices": [
            "Promising availability, because reassurance keeps the peace.",
            "Sharing a written daily plan, because visibility resets the manager's expectations to a real rhythm.",
            "Ignoring it, because the manager will adjust.",
        ],
        "correctIndex": 1,
        "explanation": "Promises evaporate; a written plan converts focus into a predictable, defensible rhythm.",
    },
]


NEW_QUIZZES[11] = [
    {
        "prompt": "A push notification lands while a contracts attorney is mid-clause. What is the clearest first move?",
        "choices": [
            "Tap the notification to clear the badge.",
            "Ask whether it serves the clause she is writing right now; answer yes, no, or real obligation.",
            "Promise to handle notifications later.",
        ],
        "correctIndex": 1,
        "explanation": "The cue earns the interruption only when it serves the chosen work, not because it appeared.",
    },
    {
        "prompt": "Emilio, a graphic designer, hears a calendar chime he set up months ago for 'industry news.' Which response matches the chapter's idea?",
        "choices": [
            "Open the news immediately.",
            "Ask whether the chime serves the current design block; if no, dismiss it and continue.",
            "Mute everything for the day.",
        ],
        "correctIndex": 1,
        "explanation": "Old cues do not get to survive on inertia; each one has to earn its interruption.",
    },
    {
        "prompt": "An emergency-room scribe gets pinged about a department-wide birthday post during a charting block. The author would advise what?",
        "choices": [
            "Reply with a quick congratulation.",
            "Ask whether the ping serves the chart due in fifteen minutes; if no, leave it for later.",
            "Disable group chat permanently.",
        ],
        "correctIndex": 1,
        "explanation": "The cue is harmless socially but does not serve the work in front of her; it can wait.",
    },
    {
        "prompt": "During a long thesis revision, a graduate student keeps getting nudges from a job-board app. What should he test first?",
        "choices": [
            "Browse the listings to feel productive.",
            "Ask whether the nudge serves tonight's revision block; if no, snooze the app.",
            "Drop the thesis to job-hunt today.",
        ],
        "correctIndex": 1,
        "explanation": "Job nudges might matter later; right now they do not serve the chosen block.",
    },
    {
        "prompt": "While reviewing a tender proposal at lunch, a procurement officer hears her dentist's appointment reminder beep. Which move counts as traction?",
        "choices": [
            "Reschedule the dentist immediately.",
            "Note the reminder, confirm the appointment is real, then return to the tender.",
            "Open the dental app and browse insurance.",
        ],
        "correctIndex": 1,
        "explanation": "A real obligation is logged, not pursued during a focus block; the cue stops there.",
    },
    {
        "prompt": "A team lead says, 'Notifications keep ruining my afternoons.' You see him swipe every banner that appears. What is missing from his diagnosis?",
        "choices": [
            "He needs a quieter chair.",
            "He has not asked each banner whether it serves his current work before swiping.",
            "He should ban notifications entirely.",
        ],
        "correctIndex": 1,
        "explanation": "The question filters cues by intent; without it, every banner gets a free pass.",
    },
    {
        "prompt": "Two engineers argue about a Slack mention during code review. One says all mentions deserve immediate response; the other asks whether the mention serves the open review. Which view respects the chapter's logic?",
        "choices": [
            "Immediate response, because mentions are inherently urgent.",
            "Asking whether the mention serves the open review, because cues only matter when they serve the chosen work.",
            "Neither; mentions should be deleted.",
        ],
        "correctIndex": 1,
        "explanation": "The question filter is what separates a real obligation from a counterfeit one.",
    },
    {
        "prompt": "Sequence: a startup CEO sits down to write the Q3 plan, a 'partner reply' pings, she opens it, it is a vendor coupon, twenty minutes drift. Where would the chapter intervene first?",
        "choices": [
            "Block all partner emails for the day.",
            "Ask, before opening, whether the ping serves the Q3 plan; if no, mark it for later.",
            "Skip writing the plan today.",
        ],
        "correctIndex": 1,
        "explanation": "The critical question stops the chain before the click commits her time.",
    },
    {
        "prompt": "Compare three filters for an alert: open it, ignore it, or ask whether it serves the current work. Which is strongest as a first step?",
        "choices": [
            "Opening it, because alerts are usually meaningful.",
            "Asking whether it serves the current work, because that question separates real obligation from drift.",
            "Ignoring it, because attention is precious.",
        ],
        "correctIndex": 1,
        "explanation": "A simple question lets the cue prove itself or step aside.",
    },
]


NEW_QUIZZES[12] = [
    {
        "prompt": "A surgical instrument tech is reprocessing a sealed tray under blue light when a hallway question arrives about supply orders. What is the clearest first move?",
        "choices": [
            "Stop and answer the supply question.",
            "Wear a 'focus' sash and point to the posted 'questions after 11 a.m.' note; stay on the tray.",
            "Promise the colleague she'll be more patient next time.",
        ],
        "correctIndex": 1,
        "explanation": "Legible focus and a clear alternate route protect the work without harming the team.",
    },
    {
        "prompt": "Sarit, a backend engineer, plans a four-hour migration but expects four interrupts. Which response matches the chapter's idea?",
        "choices": [
            "Wear headphones and ignore everyone.",
            "Post the migration window, the wait-for-later channel, and the urgent-only path in the team room.",
            "Take the laptop to a coffee shop and disappear.",
        ],
        "correctIndex": 1,
        "explanation": "Making focus and interruption rules legible lets teammates know exactly how to act.",
    },
    {
        "prompt": "A claims adjuster keeps getting pulled into casual lunch invitations during deep paperwork hours. The author would advise what?",
        "choices": [
            "Decline lunch entirely from now on.",
            "Hang a paper sign at the desk: 'paperwork until 12; lunch invites at 12:01,' and stick to it.",
            "Skip lunch and work straight through.",
        ],
        "correctIndex": 1,
        "explanation": "Visible signal plus a clear later time turns interruptions into routed traffic.",
    },
    {
        "prompt": "After several wasted afternoons, a UX researcher wants to protect long synthesis blocks. What should she test first?",
        "choices": [
            "Mute the team channel forever.",
            "Test posting a synthesis block on the team calendar with a 'route through Slack thread #synth' alternate path.",
            "Switch teams to escape interruptions.",
        ],
        "correctIndex": 1,
        "explanation": "A posted alternate path makes the rule cooperative, not exclusionary.",
    },
    {
        "prompt": "During lab automation work, a biotech engineer faces constant 'quick questions' from technicians. Which move counts as traction?",
        "choices": [
            "Lock the lab door and post no notice.",
            "Place a small whiteboard with a question-parking column and a 'urgent: tap shoulder' rule.",
            "Tell technicians to figure it out themselves.",
        ],
        "correctIndex": 1,
        "explanation": "The whiteboard makes focus and interruptibility legible at once.",
    },
    {
        "prompt": "A nurse manager complains that her ward is too interruptive. You see no posted focus rules anywhere on the unit. What is missing from her diagnosis?",
        "choices": [
            "She has not hired more nurses.",
            "She has not made focus blocks and urgency rules legible to the team.",
            "She has not enforced silence harshly enough.",
        ],
        "correctIndex": 1,
        "explanation": "Without legible rules, every interruption seems equally permitted.",
    },
    {
        "prompt": "Two software leads disagree on quiet hours. One wants a hard 'do not disturb' policy; the other wants a posted focus block plus a labeled urgent-only Slack channel. Which plan respects the chapter's logic?",
        "choices": [
            "The hard policy, because absolute rules survive.",
            "The posted focus block with an urgent-only channel, because shared focus only works when interruptibility is also defined.",
            "Neither, because focus and teamwork conflict.",
        ],
        "correctIndex": 1,
        "explanation": "Hard rules without an urgency lane leave teammates without a path; the chapter wants both visible.",
    },
    {
        "prompt": "Sequence: a city planner starts a comprehensive plan revision, a colleague stops by with parking-app questions, then a tax question, then a calendar invite ping. Where would the chapter intervene first?",
        "choices": [
            "Decline the comprehensive plan work.",
            "Before starting, post the revision block on the team door with question-parking and urgent-only rules.",
            "Stay late after hours instead.",
        ],
        "correctIndex": 1,
        "explanation": "The posted block routes future interruptions before they happen.",
    },
    {
        "prompt": "Compare three responses to a chronically interrupted designer: tell people off, hide in a coffee shop, or post the next focus block with a clearly defined alternate route. Which is strongest?",
        "choices": [
            "Telling people off, because boundaries require force.",
            "Posting the next focus block with an alternate route, because the team can now wait, reroute, or escalate correctly.",
            "Hiding in a coffee shop, because removal solves it.",
        ],
        "correctIndex": 1,
        "explanation": "Confrontation and avoidance both ignore the team's needs; legibility does both jobs.",
    },
]


NEW_QUIZZES[13] = [
    {
        "prompt": "At 7:15 a.m., Gemma, a literary agent, opens her inbox and feels the pull to triage every message. What is the clearest first move?",
        "choices": [
            "Reply to whichever email looks easiest.",
            "Pick the next batched email window, move one non-urgent message into it, then close the inbox.",
            "Promise to inbox-zero by Friday.",
        ],
        "correctIndex": 1,
        "explanation": "Email becomes a batched commitment, not a constant cue; a single moved message demonstrates that rule.",
    },
    {
        "prompt": "A real-estate appraiser keeps her inbox open while writing reports. Which response matches the chapter's idea?",
        "choices": [
            "Reply to each email instantly.",
            "Close email, set a 1 p.m. batch window, and post that window to clients.",
            "Buy a second monitor for inbox watching.",
        ],
        "correctIndex": 1,
        "explanation": "A scheduled batch with a posted window converts constant cue into bounded commitment.",
    },
    {
        "prompt": "Mid-paper, a researcher gets a non-urgent 'when's a good time?' email. The author would advise what?",
        "choices": [
            "Reply right away to be polite.",
            "Park it for the 4 p.m. batch and write a one-line handling rule for that category.",
            "Forward it without context.",
        ],
        "correctIndex": 1,
        "explanation": "Building a handling rule reduces the per-email decision tax.",
    },
    {
        "prompt": "After a chaotic week of inbox checking, a marketing director wants a different rhythm. What should she test first?",
        "choices": [
            "Stop replying to all emails for a week.",
            "Test a two-batch schedule (11 a.m. and 4 p.m.) for five days and measure how many cues vanish.",
            "Switch to phone calls only.",
        ],
        "correctIndex": 1,
        "explanation": "A bounded test reveals whether the rhythm holds without overcommitting to a permanent change.",
    },
    {
        "prompt": "During a focused estimating block, an accountant feels the urge to check inbox 'just for a moment.' Which move counts as traction?",
        "choices": [
            "Check briefly.",
            "Note the urge, write 'next batch 4 p.m.' on a sticky, and stay on the estimate.",
            "Open email and respond to the easiest one.",
        ],
        "correctIndex": 1,
        "explanation": "The sticky enforces the batched commitment against the in-the-moment pull.",
    },
    {
        "prompt": "A founder complains that email destroys his afternoons. You notice his inbox stays open all day. What is missing from his diagnosis?",
        "choices": [
            "He has not configured a smarter filter.",
            "He has not converted email into a scheduled batch with handling rules.",
            "He has not delegated to an assistant yet.",
        ],
        "correctIndex": 1,
        "explanation": "The open inbox is the constant cue; the batch with rules is the lever.",
    },
    {
        "prompt": "Two managers argue about inbox policy. One advocates immediate replies; the other proposes scheduled batches with named handling rules. Which plan respects the chapter's logic?",
        "choices": [
            "Immediate replies, because responsiveness signals competence.",
            "Scheduled batches with named handling rules, because email then stops re-triggering every minute.",
            "Both, alternated arbitrarily.",
        ],
        "correctIndex": 1,
        "explanation": "Immediate replies turn email into a constant cue; batches make it a commitment.",
    },
    {
        "prompt": "Sequence: a teacher starts grading at 7 p.m., glances at email, finds a parent message, drafts a reply, abandons grading, ends the night at 10 with nothing graded. Where would the chapter intervene first?",
        "choices": [
            "Skip grading tonight.",
            "Set a 9 p.m. email batch and start grading first with the inbox closed.",
            "Reply to parents only on weekends.",
        ],
        "correctIndex": 1,
        "explanation": "Closing the inbox until the batch window protects the grading block from the email cue.",
    },
    {
        "prompt": "Compare three responses to an inbox spike: read everything immediately, mark all unread, or batch into two daily windows with one-line handling rules per category. Which is strongest?",
        "choices": [
            "Reading immediately, because urgency is the safest assumption.",
            "Batching with handling rules, because email loses its constant-cue power once it has a schedule.",
            "Marking unread, because the visible count motivates action.",
        ],
        "correctIndex": 1,
        "explanation": "Reading immediately keeps the cue alive; the batch with rules retires it.",
    },
]


NEW_QUIZZES[14] = [
    {
        "prompt": "On a busy emergency-response thread, jokes are burying a radio call sign. What is the clearest first move?",
        "choices": [
            "Mute the chat entirely.",
            "Propose two channels: 'ops' for radio-call coordination and 'lounge' for everything else.",
            "Reply with a joke to fit in.",
        ],
        "correctIndex": 1,
        "explanation": "Separating jobs and ambient banter is the chapter's first lever.",
    },
    {
        "prompt": "A product team's chat has marketing memes mixed with launch coordination. Which response matches the chapter's idea?",
        "choices": [
            "Tell people to be quieter.",
            "Split the channel: '#launch-ops' with response-speed expectations and '#team-lounge' with no urgency.",
            "Leave the chat altogether.",
        ],
        "correctIndex": 1,
        "explanation": "Two channels with named purposes and speeds reset presence pressure.",
    },
    {
        "prompt": "A nonprofit's volunteer chat pings for both 'who's bringing snacks' and 'fire near the trail.' The author would advise what?",
        "choices": [
            "Reply to fire alerts only.",
            "Add an emergency channel with a phone-call escalation rule alongside the regular chat.",
            "Disband the chat group.",
        ],
        "correctIndex": 1,
        "explanation": "Urgency needs a lane of its own; the chapter is explicit about that.",
    },
    {
        "prompt": "After a colleague complained that 'no one knows when to reply,' a small team wants to test a chat reform. What should they test first?",
        "choices": [
            "Mandate replies within five minutes.",
            "Test channel splits with named response speeds (minutes for ops, same-day for project, no expectation for lounge) for a week.",
            "Force everyone to use email only.",
        ],
        "correctIndex": 1,
        "explanation": "Named response speeds remove the ambient guesswork that drives the noise.",
    },
    {
        "prompt": "A construction supervisor finds his foreman chat overwhelmed by unrelated questions. Which move counts as traction?",
        "choices": [
            "Ignore the chat each morning.",
            "Pin a top-line rule: 'this channel = site coordination; supplies in #orders; urgent = call.'",
            "Disable notifications and hope.",
        ],
        "correctIndex": 1,
        "explanation": "The pinned rule resets ambient pressure into a defined coordination job.",
    },
    {
        "prompt": "A founder insists the team chat is fine. You see new joiners post timid 'are you there?' messages every hour. What is missing from his diagnosis?",
        "choices": [
            "The team has not hired more people.",
            "The team has not defined what each channel is for, how fast replies should be, and where urgency goes.",
            "The team should switch chat platforms.",
        ],
        "correctIndex": 1,
        "explanation": "Without those definitions, ambient pressure remains the default.",
    },
    {
        "prompt": "Two managers debate a noisy 'general' chat. One wants stricter chat etiquette posts; the other wants to split the channel into purpose-specific ones with named urgency. Which plan respects the chapter's logic?",
        "choices": [
            "Stricter etiquette posts, because reminders shape behavior.",
            "Splitting channels with named urgency, because chat's coordination value separates from its ambient noise.",
            "Both, with no clarity on either.",
        ],
        "correctIndex": 1,
        "explanation": "Etiquette posts evaporate; structure persists.",
    },
    {
        "prompt": "Sequence: an engineer opens chat for one question, sees memes, joins a thread, loses thirty minutes, and forgets the original question. Where would the chapter intervene first?",
        "choices": [
            "Quit the chat entirely.",
            "Move the memes to a separate lounge channel and keep ops focused with a clear purpose.",
            "Stop reading chat for a week.",
        ],
        "correctIndex": 1,
        "explanation": "The structural fix protects the ops channel from drift.",
    },
    {
        "prompt": "Compare three responses to chat overload: silence notifications, leave the channel, or split channels by purpose with named response speeds and an urgent-only escalation. Which is strongest?",
        "choices": [
            "Silencing notifications, because quiet is enough.",
            "Splitting channels by purpose with named speeds, because structure removes ambient pressure.",
            "Leaving, because removal solves the problem.",
        ],
        "correctIndex": 1,
        "explanation": "Silence and exit treat the symptom; structure treats the source.",
    },
]


NEW_QUIZZES[15] = [
    {
        "prompt": "Before a planning meeting on a roof leak, Dominic, a facilities chief, asks, 'What is this meeting deciding?' What is the clearest first move?",
        "choices": [
            "Show up and figure it out.",
            "Refuse to schedule the meeting until a decision, prep, and time claim are written.",
            "Reduce the meeting to fifteen minutes.",
        ],
        "correctIndex": 1,
        "explanation": "A meeting earns its cost by stating the decision and the prep up front.",
    },
    {
        "prompt": "A marketing director gets an invite titled 'campaign sync' with no agenda. Which response matches the chapter's idea?",
        "choices": [
            "Accept and prepare nothing.",
            "Reply requesting the decision, the prep, and the named owner before accepting.",
            "Decline without explanation.",
        ],
        "correctIndex": 1,
        "explanation": "The three-line requirement separates meaningful meetings from social filler.",
    },
    {
        "prompt": "After a week of useless 'check-ins,' a software engineer wants to push back. The author would advise what?",
        "choices": [
            "Stop attending all meetings.",
            "Propose that every invite must state the decision, the preparation, and the time it will consume.",
            "Convert every meeting to email.",
        ],
        "correctIndex": 1,
        "explanation": "The proposal aligns with the chapter's three-part requirement.",
    },
    {
        "prompt": "After three vague 'alignment' meetings in a row, a product lead wants a new rule. What should she test first?",
        "choices": [
            "Cap meetings at thirty minutes.",
            "Require every invite this month to include the decision, the prep, and a named owner; track outcomes.",
            "Ban all meetings on Fridays.",
        ],
        "correctIndex": 1,
        "explanation": "The decision-prep-owner triplet is the testable filter the chapter recommends.",
    },
    {
        "prompt": "During Q3 planning, a head of engineering faces three competing 'planning' invites. Which move counts as traction?",
        "choices": [
            "Attend all three.",
            "Ask each organizer for the decision, prep, and time; attend only the ones that answer.",
            "Decline all three to focus.",
        ],
        "correctIndex": 1,
        "explanation": "The question filters meetings by their cost and value rather than calendar inertia.",
    },
    {
        "prompt": "A VP complains, 'My week is just meetings.' You see his calendar has no agenda field filled in anywhere. What is missing from his diagnosis?",
        "choices": [
            "He has not hired an executive assistant.",
            "He has not required every invite to state a decision, the preparation, and the time it will consume.",
            "He has not blocked Tuesdays for himself.",
        ],
        "correctIndex": 1,
        "explanation": "Without the three-line requirement, meetings will keep filling whatever time is open.",
    },
    {
        "prompt": "Two executives debate meeting culture. One says, 'Trust people to call meetings'; the other proposes a written decision, prep, and time-claim rule. Which plan respects the chapter's logic?",
        "choices": [
            "Trust without rules, because flexibility matters most.",
            "The decision-prep-time-claim rule, because meetings must earn the shared attention they cost.",
            "Neither, because culture cannot change.",
        ],
        "correctIndex": 1,
        "explanation": "The written rule is what makes meetings prove their cost.",
    },
    {
        "prompt": "Sequence: a designer gets pulled into a 90-minute 'sync,' nothing is decided, two more 'follow-ups' are scheduled. Where would the chapter intervene first?",
        "choices": [
            "Attend all follow-ups and stay quiet.",
            "Decline the follow-ups until a decision, prep, and owner are written.",
            "Take notes harder.",
        ],
        "correctIndex": 1,
        "explanation": "Decline-until-defined is the lever; absent it, the cycle continues.",
    },
    {
        "prompt": "Compare three responses to a flood of vague meeting invites: attend them all, decline them all, or require a decision, prep, and time claim before accepting. Which is strongest?",
        "choices": [
            "Attend all, because presence is safer than absence.",
            "Require a decision, prep, and time claim, because that filter sorts useful meetings from social filler.",
            "Decline all, because meetings rarely help.",
        ],
        "correctIndex": 1,
        "explanation": "The required triplet is the chapter's structural fix.",
    },
]


NEW_QUIZZES[16] = [
    {
        "prompt": "At 6:12 a.m., Alana, a charge nurse, unlocks her phone for the patient-notes app and lands on a feed instead. What is the clearest first move?",
        "choices": [
            "Disable the phone.",
            "Move the patient-notes app to where her thumb lands and bury the feed app two folders deep.",
            "Promise to be more disciplined this shift.",
        ],
        "correctIndex": 1,
        "explanation": "Placement decides what gets touched first; the redesign matters before willpower does.",
    },
    {
        "prompt": "A college freshman keeps opening TikTok every time he unlocks for a class app. Which response matches the chapter's idea?",
        "choices": [
            "Delete every social app forever.",
            "Move TikTok off the first screen and place the class app where TikTok used to live.",
            "Switch to a flip phone.",
        ],
        "correctIndex": 1,
        "explanation": "Redesign keeps useful tools reachable while removing the default path to unplanned cues.",
    },
    {
        "prompt": "A truck driver's home screen has weather, news, and three games on the first page. The author would advise what?",
        "choices": [
            "Add more games for variety.",
            "Replace the games with route tools and keep the games on a screen three swipes away.",
            "Carry a second phone for games.",
        ],
        "correctIndex": 1,
        "explanation": "The first screen is the highest leverage; games belong out of the way.",
    },
    {
        "prompt": "After noticing he loses ten minutes whenever he unlocks his phone, a paramedic wants to test a fix. What should he test first?",
        "choices": [
            "Wear a smartwatch instead.",
            "Move every distracting app off the first screen for two weeks and track time-to-distraction.",
            "Give up phones entirely.",
        ],
        "correctIndex": 1,
        "explanation": "Tracking before-and-after isolates whether placement alone moves the needle.",
    },
    {
        "prompt": "During a long flight delay, a consultant wants to read her brief on her phone. Which move counts as traction?",
        "choices": [
            "Open the news app.",
            "Move the reader to the dock and bury the feed apps into a folder labeled 'later.'",
            "Wait until the flight to read.",
        ],
        "correctIndex": 1,
        "explanation": "Putting the chosen tool in the dock makes the next intended action the easiest.",
    },
    {
        "prompt": "A teacher says, 'My phone is just too distracting.' You see TikTok, Instagram, and Reddit on her first screen. What is missing from her diagnosis?",
        "choices": [
            "She has not bought a less colorful phone.",
            "She has not redesigned the first screen so unplanned apps lose their default path.",
            "She has not joined a social media detox.",
        ],
        "correctIndex": 1,
        "explanation": "Placement decides what gets touched; redesign is the lever she has not used.",
    },
    {
        "prompt": "Two parents argue about the family phone. One wants a strict screen-time app; the other wants to redesign the home screen so the most-used distractions become three swipes away. Which plan respects the chapter's logic?",
        "choices": [
            "Strict screen-time, because limits force change.",
            "Redesigning the home screen, because the first screen decides what gets touched.",
            "Neither, because phones cannot be tamed.",
        ],
        "correctIndex": 1,
        "explanation": "Limits collide with willpower; redesign moves the decision upstream of willpower.",
    },
    {
        "prompt": "Sequence: a writer reaches for his phone to set a timer, sees a notification, opens a feed, loses twenty minutes. Where would the chapter intervene first?",
        "choices": [
            "Buy a kitchen timer instead.",
            "Move the timer to the dock and disable the feed app's badge before tomorrow.",
            "Stop writing today.",
        ],
        "correctIndex": 1,
        "explanation": "The kitchen-timer fix works too, but the chapter's lever is the phone redesign.",
    },
    {
        "prompt": "Compare three responses to phone-driven drift: rely on willpower, remove the phone, or redesign first screen, badges, and app placement so useful tools win the thumb. Which is strongest?",
        "choices": [
            "Willpower, because grit decides.",
            "Redesigning first screen, badges, and placement, because design decides before willpower gets a vote.",
            "Removing the phone, because absence solves it.",
        ],
        "correctIndex": 1,
        "explanation": "Willpower loses to design at unlock; design has to be set first.",
    },
]


NEW_QUIZZES[17] = [
    {
        "prompt": "Before her morning writing block, a screenwriter sees nine icons on her desktop and her thumb hovers near 'Twitter.' What is the clearest first move?",
        "choices": [
            "Open Twitter to clear notifications first.",
            "Close every window and place the script file alone on screen with its support note beside it.",
            "Reorganize all icons alphabetically.",
        ],
        "correctIndex": 1,
        "explanation": "The visible next action carries the work; competing paths should require deliberate effort.",
    },
    {
        "prompt": "Marcus, a lab manager, opens his laptop for a budget spreadsheet but sees twelve open tabs from yesterday. Which response matches the chapter's idea?",
        "choices": [
            "Skim every tab first.",
            "Close all tabs except the budget, dock the support spreadsheet beside it, then begin.",
            "Bookmark the tabs and read them later.",
        ],
        "correctIndex": 1,
        "explanation": "A single visible next action defeats the pull of clutter.",
    },
    {
        "prompt": "A doctoral student's desktop has icons for thesis, social, music, and three games. The author would advise what?",
        "choices": [
            "Add a tenth folder for organization.",
            "Move games and social into a 'later' folder and leave only the thesis-relevant files in plain view.",
            "Wallpaper over the icons.",
        ],
        "correctIndex": 1,
        "explanation": "Hiding competing paths makes the intended one the easiest to touch.",
    },
    {
        "prompt": "After three failed mornings of focus, an accounts manager wants a new desk setup. What should she test first?",
        "choices": [
            "Buy a new laptop.",
            "Test clearing the desktop to one file with a support window beside it for a week.",
            "Switch to paper only.",
        ],
        "correctIndex": 1,
        "explanation": "A bounded experiment tells her whether visibility alone shifts behavior.",
    },
    {
        "prompt": "During tax season, an enrolled agent's desktop is a sea of client folders. Which move counts as traction?",
        "choices": [
            "Open every folder to skim.",
            "Surface only today's named client folder with its checklist beside it; archive the rest.",
            "Color-code every icon.",
        ],
        "correctIndex": 1,
        "explanation": "The next intended action wins by being the only visible one.",
    },
    {
        "prompt": "A designer says, 'My desktop is clean, but I still drift.' You watch her open a perfectly arranged folder of distraction apps. What is missing from her diagnosis?",
        "choices": [
            "She needs a faster computer.",
            "She has not made the intended next action visible and the competing paths effortful.",
            "She has not bought a second screen.",
        ],
        "correctIndex": 1,
        "explanation": "Tidy clutter still routes attention; the chapter wants the intended action visible.",
    },
    {
        "prompt": "Two writers debate workspace setup. One says 'put everything you might need on screen'; the other says 'only the next action plus its support file.' Which plan respects the chapter's logic?",
        "choices": [
            "Putting everything on screen, because options invite ideas.",
            "Only the next action plus its support file, because the intended path has to be the obvious one.",
            "Both equally, because preference rules.",
        ],
        "correctIndex": 1,
        "explanation": "Visible options keep tempting alternates; the chapter's logic is the single visible path.",
    },
    {
        "prompt": "Sequence: an engineer opens his laptop for a bug fix, sees a Slack icon, clicks it, gets pulled into a thread, abandons the bug. Where would the chapter intervene first?",
        "choices": [
            "Quit using a laptop for bugs.",
            "Hide Slack from the dock and place the bug-tracker plus failing-test file in plain view.",
            "Disable Slack entirely.",
        ],
        "correctIndex": 1,
        "explanation": "Hiding the Slack icon and surfacing the bug context routes attention.",
    },
    {
        "prompt": "Compare three responses to desktop drift: tidy alphabetically, color-code icons, or surface only the next intended action and bury alternates. Which is strongest?",
        "choices": [
            "Tidying alphabetically, because order calms the mind.",
            "Surfacing only the next intended action, because visible options become the path.",
            "Color-coding, because color speeds recall.",
        ],
        "correctIndex": 1,
        "explanation": "Order and color decorate; surfacing-and-burying is the chapter's lever.",
    },
]


NEW_QUIZZES[18] = [
    {
        "prompt": "Uri, a city policy researcher, is about to open a long opinion piece online. What is the clearest first move?",
        "choices": [
            "Read the piece and follow whatever links interest him.",
            "Write the question the article should answer and the capture path before opening it.",
            "Bookmark the article and read it next month.",
        ],
        "correctIndex": 1,
        "explanation": "The chosen question and capture path bound the reading before links can hijack it.",
    },
    {
        "prompt": "A retiree finds himself with seventeen tabs after one article opens at breakfast. Which response matches the chapter's idea?",
        "choices": [
            "Read every tab in order.",
            "Close all tabs, choose one article, write the question and capture path, and stop at the first answer.",
            "Save the tabs for tomorrow.",
        ],
        "correctIndex": 1,
        "explanation": "Reading becomes a bounded act when the question, path, and stopping point are chosen in advance.",
    },
    {
        "prompt": "A high-school debate coach wants her students to research without spiraling. The author would advise what?",
        "choices": [
            "Forbid online reading.",
            "Have each student write a question and a one-line note destination before opening any article.",
            "Print everything in advance.",
        ],
        "correctIndex": 1,
        "explanation": "The question-and-destination rule is the chapter's bounded act.",
    },
    {
        "prompt": "After losing two afternoons to tab spirals, a copywriter wants a different approach. What should she test first?",
        "choices": [
            "Stop reading articles altogether.",
            "Test the 'question + capture file + stopping point' rule for one week and count tabs left at end.",
            "Switch to print magazines only.",
        ],
        "correctIndex": 1,
        "explanation": "The bounded test isolates whether the chapter's rule works for her flow.",
    },
    {
        "prompt": "During investor due diligence, a venture associate needs to read three competitor articles fast. Which move counts as traction?",
        "choices": [
            "Open all three with all links.",
            "For each, write the question first, capture the answer into the deal doc, and stop.",
            "Read them word for word.",
        ],
        "correctIndex": 1,
        "explanation": "The pre-written question makes the reading a search, not a wander.",
    },
    {
        "prompt": "An editor complains, 'The internet steals my mornings.' You see her start every article without a goal. What is missing from her diagnosis?",
        "choices": [
            "She has not chosen better outlets.",
            "She has not stated the question, capture path, and stopping point before opening anything.",
            "She has not blocked all websites.",
        ],
        "correctIndex": 1,
        "explanation": "Without those three, the page does the choosing.",
    },
    {
        "prompt": "Two grad students argue about reading workflow. One reads articles as encountered; the other writes the question and capture file before clicking. Which plan respects the chapter's logic?",
        "choices": [
            "Reading as encountered, because curiosity drives discovery.",
            "Writing the question and capture file first, because reading must be bounded by intent.",
            "Both, with no thought to either.",
        ],
        "correctIndex": 1,
        "explanation": "Unbounded curiosity is the cause of the tab problem; the rule is the cure.",
    },
    {
        "prompt": "Sequence: a paralegal opens one article about a precedent, then a sidebar link, then a related-case link, and forty minutes later has no notes. Where would the chapter intervene first?",
        "choices": [
            "Stop reading precedent articles.",
            "Before opening, write 'question I'm answering' and 'where the answer goes,' then read only to those.",
            "Skip the precedent entirely.",
        ],
        "correctIndex": 1,
        "explanation": "The written question and destination would have prevented the sidebar drift.",
    },
    {
        "prompt": "Compare three responses to article spirals: read everything, save for later, or pre-write the question, capture path, and stopping point. Which is strongest?",
        "choices": [
            "Reading everything, because completion gives confidence.",
            "Pre-writing the question, capture path, and stopping point, because reading then has a frame.",
            "Saving for later, because deferral solves it.",
        ],
        "correctIndex": 1,
        "explanation": "Completion and deferral both leave the structure missing; the rule is the structure.",
    },
]


NEW_QUIZZES[19] = [
    {
        "prompt": "Quinn opens Instagram intending to message one customer. What is the clearest first move?",
        "choices": [
            "Scroll the feed first to check what's trending.",
            "State the purpose, set the exit cue ('after the message is sent'), and leave when the cue happens.",
            "Browse stories before messaging.",
        ],
        "correctIndex": 1,
        "explanation": "A stated purpose and a real exit cue convert a feed visit into a chosen, bounded act.",
    },
    {
        "prompt": "A high-school senior opens TikTok 'just to relax for ten minutes.' Which response matches the chapter's idea?",
        "choices": [
            "Scroll until she stops feeling like it.",
            "Set the purpose ('relax for ten minutes'), set the exit cue (a kitchen timer), and leave when it rings.",
            "Watch one more video then quit.",
        ],
        "correctIndex": 1,
        "explanation": "The exit cue makes the chosen ten minutes the real ten minutes.",
    },
    {
        "prompt": "A graphic designer opens LinkedIn for one inquiry and finds himself in a feed an hour later. The author would advise what?",
        "choices": [
            "Quit LinkedIn forever.",
            "Before reopening, name the purpose and exit cue; leave at the cue even if more posts beckon.",
            "Browse without judgment.",
        ],
        "correctIndex": 1,
        "explanation": "The chapter wants feed use bounded by chosen rules, not banished.",
    },
    {
        "prompt": "After losing two evenings to YouTube autoplay, a teacher wants a new rule. What should she test first?",
        "choices": [
            "Cancel her YouTube account.",
            "Test the 'one chosen video, then exit at the credits' rule for a week.",
            "Hide her phone in the freezer.",
        ],
        "correctIndex": 1,
        "explanation": "An exit cue tied to the credits gives the visit a natural end.",
    },
    {
        "prompt": "During a layover, a developer wants to skim Hacker News for one topic. Which move counts as traction?",
        "choices": [
            "Scroll until boarding.",
            "Decide the one topic and set 'after I read the top thread on it' as the exit cue.",
            "Open every front-page link.",
        ],
        "correctIndex": 1,
        "explanation": "A specific exit cue protects the intended bounded visit.",
    },
    {
        "prompt": "A founder says, 'I can't stop scrolling X.' You see he opens it with no purpose stated and no exit cue. What is missing from his diagnosis?",
        "choices": [
            "He has not picked a better network.",
            "He has not entered with a stated purpose and a real exit cue.",
            "He has not joined a stricter detox.",
        ],
        "correctIndex": 1,
        "explanation": "Without a purpose and exit, the feed gets to choose how long he stays.",
    },
    {
        "prompt": "Two parents disagree about teen feed use. One wants a total ban; the other wants the teen to write a purpose and exit cue before opening any feed. Which plan respects the chapter's logic?",
        "choices": [
            "Total ban, because absence is safest.",
            "Stated purpose and exit cue, because feed use becomes a chosen visit with a boundary.",
            "Neither, because teens cannot self-regulate.",
        ],
        "correctIndex": 1,
        "explanation": "Bans collide with adolescent autonomy; the chapter's lever is bounded chosen visits.",
    },
    {
        "prompt": "Sequence: a copywriter opens Twitter for inspiration, drifts into a flame war, an hour vanishes, and the deck is unwritten. Where would the chapter intervene first?",
        "choices": [
            "Stop using Twitter for inspiration.",
            "Before opening, name 'three saved snippets' as the purpose and 'when the third is saved' as the exit.",
            "Block Twitter for the day.",
        ],
        "correctIndex": 1,
        "explanation": "Named purpose plus exit cue defends the visit against drift.",
    },
    {
        "prompt": "Compare three responses to compulsive scrolling: delete the app, scroll mindfully, or enter the feed with a stated purpose and a real exit cue. Which is strongest?",
        "choices": [
            "Deleting the app, because removal is permanent.",
            "Entering with a stated purpose and a real exit cue, because feeds then become chosen, bounded visits.",
            "Scrolling mindfully, because intention alone is enough.",
        ],
        "correctIndex": 1,
        "explanation": "Deletion and 'mindful scrolling' both lack the chapter's structural rule.",
    },
]


NEW_QUIZZES[20] = [
    {
        "prompt": "At 11:40 p.m., Kara stares into the pantry and her snack plan has not been written yet. What is the clearest first move?",
        "choices": [
            "Eat what's nearest and call it a day.",
            "Earlier, while calm, write the rule the calmer self will hold: 'two squares of chocolate after dinner; pantry closed at 10.'",
            "Promise to do better tomorrow.",
        ],
        "correctIndex": 1,
        "explanation": "The precommitment has to be made by the calm self before temptation begins negotiating.",
    },
    {
        "prompt": "A new dad wants to stop late-night phone scrolling. Which response matches the chapter's idea?",
        "choices": [
            "Try harder to put the phone down at midnight.",
            "Decide now: phone in the hallway charger at 9:30 p.m., before tiredness can bargain.",
            "Buy a smaller phone.",
        ],
        "correctIndex": 1,
        "explanation": "The rule lives outside the tired moment because the tired self loses every negotiation.",
    },
    {
        "prompt": "An MBA student keeps abandoning his gym plan after lunch. The author would advise what?",
        "choices": [
            "Cancel the gym membership.",
            "While calm in the morning, lay out gym clothes by the door and set the alarm; precommit the action.",
            "Talk himself into it each afternoon.",
        ],
        "correctIndex": 1,
        "explanation": "The morning self does the work; the post-lunch self cannot be trusted to choose.",
    },
    {
        "prompt": "After three failed attempts to limit Sunday-evening drinking, a sales lead wants a new approach. What should he test first?",
        "choices": [
            "Promise to drink less from now on.",
            "Test moving the alcohol out of the house on Sunday afternoon, while still sober.",
            "Wait for willpower to grow.",
        ],
        "correctIndex": 1,
        "explanation": "The calm-self action of moving the bottle is what the chapter calls precommitment.",
    },
    {
        "prompt": "During exam season, a student wants to avoid 1 a.m. social-media spirals. Which move counts as traction?",
        "choices": [
            "Resolve to stop scrolling at midnight.",
            "At 7 p.m., enable a router-level cutoff at 11 p.m. that the tired self cannot easily disable.",
            "Open the apps to 'check briefly.'",
        ],
        "correctIndex": 1,
        "explanation": "The rule is set by the calm self in a way the tired self cannot quickly undo.",
    },
    {
        "prompt": "A coach complains he 'always caves' on late-night snacks. You see no precommitment in his routine. What is missing from his diagnosis?",
        "choices": [
            "He has not bought healthier snacks.",
            "He has not put a calm-self rule in place hours before the tired-self moment.",
            "He has not gone to bed earlier.",
        ],
        "correctIndex": 1,
        "explanation": "Without a precommitment, the tired self is asked to win an unfair fight.",
    },
    {
        "prompt": "Two friends argue about quitting late-night TV. One promises to 'be stronger'; the other unplugs the TV and stores the remote in another room. Which plan respects the chapter's logic?",
        "choices": [
            "Being stronger, because identity is enough.",
            "Unplugging and storing the remote, because the calm self sets a rule the tired self cannot easily undo.",
            "Both, applied randomly.",
        ],
        "correctIndex": 1,
        "explanation": "Promises evaporate when fatigue arrives; structure does not.",
    },
    {
        "prompt": "Sequence: a writer plans no alcohol Mondays, comes home tired, the bottle is in plain view, the plan collapses. Where would the chapter intervene first?",
        "choices": [
            "Stop planning no-alcohol Mondays.",
            "Sunday afternoon, while calm, move the bottle out of plain view and set Monday's evening tea kettle.",
            "Try harder at the door.",
        ],
        "correctIndex": 1,
        "explanation": "The Sunday-afternoon move is the precommitment; the door is too late.",
    },
    {
        "prompt": "Compare three responses to a recurring weak moment: try harder, scold yourself, or have the calm self set a rule hours before. Which is strongest?",
        "choices": [
            "Trying harder, because grit pays.",
            "Calm-self rule set hours before, because the rule is made when bargaining cannot happen.",
            "Scolding, because shame motivates.",
        ],
        "correctIndex": 1,
        "explanation": "Grit and shame both arrive at the tired moment; the precommitment arrives earlier.",
    },
]


NEW_QUIZZES[21] = [
    {
        "prompt": "Hugo, a freelance copywriter, drifts into Reddit every afternoon and wants a price pact. What is the clearest first move?",
        "choices": [
            "Pay a charity twenty dollars each Reddit visit, regardless of plan.",
            "Plan today's afternoon writing block fully, then attach a small cost only if he opens Reddit during it.",
            "Promise to use less Reddit.",
        ],
        "correctIndex": 1,
        "explanation": "The cost only fits after the desired path is clearly planned and possible.",
    },
    {
        "prompt": "A weekend runner wants to stop snoozing his Saturday alarm. Which response matches the chapter's idea?",
        "choices": [
            "Place a fifty-dollar penalty on any sleep past 7 a.m.",
            "Lay out the running clothes, route, and music tonight; then attach a small cost only if he skips.",
            "Buy a louder alarm clock and hope.",
        ],
        "correctIndex": 1,
        "explanation": "A cost without a clear, possible path is just punishment.",
    },
    {
        "prompt": "A part-time student keeps abandoning his thesis on Saturday mornings. The author would advise what?",
        "choices": [
            "Charge himself for missed mornings, with no plan.",
            "Define the morning block (file open, outline, first paragraph), then attach the cost only to skipping.",
            "Skip Saturdays from now on.",
        ],
        "correctIndex": 1,
        "explanation": "The plan comes first; the cost is downstream protection, not the lever.",
    },
    {
        "prompt": "After three failed weeks of habit-stacking, a teacher wants to add a price pact. What should she test first?",
        "choices": [
            "Add a cost to every missed habit immediately.",
            "Test that the desired path is actually planned and possible; only then attach a small cost to a specific drift.",
            "Quit the habit stack entirely.",
        ],
        "correctIndex": 1,
        "explanation": "Without the planned path, the cost has nothing fair to defend.",
    },
    {
        "prompt": "During a writing retreat, a novelist wants to avoid email. Which move counts as traction?",
        "choices": [
            "Pay her partner ten dollars per email checked, with no plan in place.",
            "Plan the morning's chapter target, then attach the small cost only to opening email before lunch.",
            "Quit checking email forever.",
        ],
        "correctIndex": 1,
        "explanation": "The chapter target is the planned path; the cost defends it.",
    },
    {
        "prompt": "A founder says, 'I'll just pay a fine if I scroll.' You see no plan for what he should do instead. What is missing from his diagnosis?",
        "choices": [
            "He has not raised the fine high enough.",
            "He has not defined the desired path that the price pact would defend.",
            "He has not switched payment apps.",
        ],
        "correctIndex": 1,
        "explanation": "Pacts without paths punish without changing anything.",
    },
    {
        "prompt": "Two friends compare habits. One wants a $100 fine for skipping the gym; the other wants the gym bag, the class booked, and the route mapped, then a $5 fine for skipping. Which plan respects the chapter's logic?",
        "choices": [
            "The $100 fine alone, because severity drives change.",
            "The bag, class, and route in place plus a small fine, because the path has to be clear and possible first.",
            "Neither, because pacts are gimmicks.",
        ],
        "correctIndex": 1,
        "explanation": "The chapter is explicit: cost only goes behind a clear path.",
    },
    {
        "prompt": "Sequence: a manager promises to stop late-night Slack, sets a $50 fine, has no replacement habit, breaks it within three days. Where would the chapter intervene first?",
        "choices": [
            "Raise the fine to $200.",
            "Define the replacement evening routine clearly, then attach the small fine only to Slack opens after 8 p.m.",
            "Drop the pact entirely.",
        ],
        "correctIndex": 1,
        "explanation": "Without a defined replacement, the pact had nothing fair to defend.",
    },
    {
        "prompt": "Compare three pacts for nightly snacking: a steep fine alone, public shame, or planned alternative (tea + book ready) plus a small fine for skipping. Which is strongest?",
        "choices": [
            "Steep fine alone, because pain motivates.",
            "Planned alternative plus a small fine, because the path is now both clear and protected.",
            "Public shame, because reputation is leverage.",
        ],
        "correctIndex": 1,
        "explanation": "Pain and shame skip the planning step; the alternative is what the pact protects.",
    },
]


NEW_QUIZZES[22] = [
    {
        "prompt": "A hiker named Mira posts one muddy bridge photo after each Saturday walk. What is the clearest first move toward an identity pact?",
        "choices": [
            "Tell friends she's 'trying to hike more.'",
            "Adopt the identity 'I'm a Saturday hiker' and let the muddy photo each week be the visible proof.",
            "Buy expensive hiking boots.",
        ],
        "correctIndex": 1,
        "explanation": "The identity becomes real when a small repeated act stands as proof.",
    },
    {
        "prompt": "A new writer wants to feel like 'a writer' rather than 'someone trying to write.' Which response matches the chapter's idea?",
        "choices": [
            "Buy a literary tote bag.",
            "Commit to 'I'm a daily writer' and produce 200 words each day as the visible proof.",
            "Tell people she's a writer at parties.",
        ],
        "correctIndex": 1,
        "explanation": "Daily 200 words is the proof the identity needs to be true.",
    },
    {
        "prompt": "A graduate student wants to stop being 'the person who can't finish.' The author would advise what?",
        "choices": [
            "Tell everyone he's done with procrastination.",
            "Adopt 'I'm someone who ships one section per week' and post the section count in the shared lab folder.",
            "Promise himself it will be different from now on.",
        ],
        "correctIndex": 1,
        "explanation": "The visible weekly count is the proof the identity has to do work in the room.",
    },
    {
        "prompt": "After joining a running group, a teacher wants to feel like a runner. What should she test first?",
        "choices": [
            "Update her Instagram bio.",
            "Adopt 'I'm a runner' and prove it by logging three 30-minute runs each week visibly to the group.",
            "Wait until she has run a marathon.",
        ],
        "correctIndex": 1,
        "explanation": "Identity follows proof; the group log makes the proof public.",
    },
    {
        "prompt": "During a sober month, a former heavy drinker wants the identity to hold. Which move counts as traction?",
        "choices": [
            "Tell people he 'might' stop drinking.",
            "Adopt 'I'm a non-drinker' and let the daily 'no' at events be the proof.",
            "Avoid all events that involve alcohol.",
        ],
        "correctIndex": 1,
        "explanation": "Repeated, visible 'no' at events is what makes the identity true.",
    },
    {
        "prompt": "A founder says, 'I'm an indistractable founder.' You see no observable focus blocks in his week. What is missing from his diagnosis?",
        "choices": [
            "He has not blocked enough founders' calls.",
            "He has not produced a visible behavior that would prove the identity to himself or his team.",
            "He has not tweeted about it.",
        ],
        "correctIndex": 1,
        "explanation": "The slogan is not the work; the visible focus block is.",
    },
    {
        "prompt": "Two parents debate a kids' phone rule. One wants a label of 'phone-free dinner family'; the other wants the label plus the daily basket-by-the-door ritual. Which plan respects the chapter's logic?",
        "choices": [
            "Just the label, because identity drives behavior.",
            "The label plus the daily ritual, because identity needs visible proof to hold.",
            "Neither, because labels are silly.",
        ],
        "correctIndex": 1,
        "explanation": "An identity with no visible behavior decays; the ritual is the proof.",
    },
    {
        "prompt": "Sequence: a designer renames himself 'someone who finishes,' but ships nothing the next two weeks. Where would the chapter intervene first?",
        "choices": [
            "Drop the new identity.",
            "Define one visible weekly shipment (a Dribbble post, a Loom demo) that the identity will produce.",
            "Try a more aspirational title.",
        ],
        "correctIndex": 1,
        "explanation": "Without the visible shipment, the identity is wallpaper.",
    },
    {
        "prompt": "Compare three identity moves: change a bio, get a tattoo, or pair a self-label with a small visible weekly behavior. Which is strongest?",
        "choices": [
            "Changing a bio, because public claims hold.",
            "Pairing a self-label with a small visible weekly behavior, because identity has to do work in the room.",
            "Getting a tattoo, because permanence forces it.",
        ],
        "correctIndex": 1,
        "explanation": "Bios and tattoos are signals; behavior is proof.",
    },
]


NEW_QUIZZES[23] = [
    {
        "prompt": "In a billing office, accuracy plummets after the manager praises speed in every standup. What is the clearest first move?",
        "choices": [
            "Tell employees to be more careful.",
            "Diagnose which norm the team is rewarded for and name the cost; propose a different reward signal.",
            "Hire more billing staff.",
        ],
        "correctIndex": 1,
        "explanation": "The norm is the lever; individual lectures do not change a culture that rewards speed.",
    },
    {
        "prompt": "A consultancy notices junior analysts are always online at 11 p.m. and burning out. Which response matches the chapter's idea?",
        "choices": [
            "Tell juniors to log off earlier.",
            "Name the norm that rewards late-night responsiveness and design a counter-norm with leadership.",
            "Add wellness perks.",
        ],
        "correctIndex": 1,
        "explanation": "Burnout is downstream of what the workplace rewards; that is what has to change.",
    },
    {
        "prompt": "A nurse manager sees nurses skipping breaks because 'busy nurses' get praised. The author would advise what?",
        "choices": [
            "Mandate breaks with no cultural change.",
            "Identify the praise pattern, name it publicly, and reward nurses who take their breaks and finish strong.",
            "Hire a wellness consultant.",
        ],
        "correctIndex": 1,
        "explanation": "Naming and redirecting praise is how the workplace stops punishing focus.",
    },
    {
        "prompt": "After three quarters of constant interruptions, an engineering director wants to diagnose root causes. What should she test first?",
        "choices": [
            "Buy noise-cancelling headphones for the team.",
            "Map which behaviors leadership praises (fast Slack reply? late hours?) and identify which one punishes focus.",
            "Move the whole team to a new floor.",
        ],
        "correctIndex": 1,
        "explanation": "The map of rewarded behaviors is the chapter's diagnostic.",
    },
    {
        "prompt": "During an annual review, a startup notices the most-promoted people are always 'on.' Which move counts as traction?",
        "choices": [
            "Change the promotion criteria silently.",
            "Name the always-on norm publicly and decide whether the company wants to keep rewarding it.",
            "Send a wellness email.",
        ],
        "correctIndex": 1,
        "explanation": "Norms change only when they are surfaced and put on the table.",
    },
    {
        "prompt": "A CEO insists his culture is 'focus-friendly.' You see his Slack history full of '?' replies at 11 p.m. praising fast responders. What is missing from his diagnosis?",
        "choices": [
            "He has not banned Slack at night.",
            "He has not noticed that his own behavior is rewarding the norm he says he opposes.",
            "He has not hired more managers.",
        ],
        "correctIndex": 1,
        "explanation": "Culture follows the boss's praise; that is the norm worth diagnosing.",
    },
    {
        "prompt": "Two directors debate a focus initiative. One wants new productivity software; the other wants to map and rename the norms leadership rewards. Which plan respects the chapter's logic?",
        "choices": [
            "Productivity software, because tools change behavior.",
            "Mapping and renaming the norms, because the workplace is shaped by what it rewards.",
            "Neither, because culture is fixed.",
        ],
        "correctIndex": 1,
        "explanation": "Tools live within norms; the chapter wants the norms themselves changed.",
    },
    {
        "prompt": "Sequence: leadership says 'protect your focus,' then publicly praises the engineer who shipped after a midnight Slack thread, then wonders why focus erodes. Where would the chapter intervene first?",
        "choices": [
            "Send a memo about focus.",
            "Change the public praise to recognize the engineer who shipped during her named focus block.",
            "Add a no-Slack-after-7 rule with no praise change.",
        ],
        "correctIndex": 1,
        "explanation": "Praise is the lever; what leadership applauds is what the culture becomes.",
    },
    {
        "prompt": "Compare three diagnostics of workplace distraction: blame employees, install monitoring, or examine which norms the company rewards or punishes. Which is strongest?",
        "choices": [
            "Blaming employees, because individuals must own focus.",
            "Examining the rewarded and punished norms, because culture is the upstream cause.",
            "Installing monitoring, because data drives change.",
        ],
        "correctIndex": 1,
        "explanation": "Individual blame and surveillance ignore the upstream norm; the chapter starts there.",
    },
]


NEW_QUIZZES[24] = [
    {
        "prompt": "A lab needs silence for specimen reading and speed for code-card events. What is the clearest first move?",
        "choices": [
            "Pick speed and hope silence emerges.",
            "Build a routine that names focus hours, response windows, and code-card escalation paths.",
            "Hire two separate teams.",
        ],
        "correctIndex": 1,
        "explanation": "Shared routines make both promises predictable rather than competing.",
    },
    {
        "prompt": "A software team wants both deep work and customer responsiveness. Which response matches the chapter's idea?",
        "choices": [
            "Pick one and abandon the other.",
            "Define a 'focus mornings, support afternoons, urgent always answered via on-call' rhythm.",
            "Let each engineer decide alone.",
        ],
        "correctIndex": 1,
        "explanation": "A named rhythm makes focus and responsiveness coexist as predictable promises.",
    },
    {
        "prompt": "A hospital wants charting time and instant patient response. The author would advise what?",
        "choices": [
            "Cut charting time.",
            "Build a shared schedule: charting blocks at known hours, rapid response via the pager line, and quiet exceptions clearly defined.",
            "Add overtime hours.",
        ],
        "correctIndex": 1,
        "explanation": "Predictability is the chapter's lever in environments that must do both.",
    },
    {
        "prompt": "After three months of mixed signals, a small agency wants a cultural reset. What should they test first?",
        "choices": [
            "Switch to a four-day week.",
            "Test a posted routine that defines focus hours, response cadence, and recovery time for one month.",
            "Hire a culture consultant.",
        ],
        "correctIndex": 1,
        "explanation": "A bounded experiment turns culture talk into observable rhythm.",
    },
    {
        "prompt": "During a busy product launch, the engineering and customer teams collide constantly. Which move counts as traction?",
        "choices": [
            "Make engineers always available.",
            "Publish the launch-week routine: engineering focus 9–12, joint sync at 12, support after 2 with a defined escalation path.",
            "Have customer success absorb everything.",
        ],
        "correctIndex": 1,
        "explanation": "The shared routine is the indistractable workplace's core artifact.",
    },
    {
        "prompt": "A CEO complains, 'My team can't do both deep work and support.' You see no posted routine anywhere. What is missing from his diagnosis?",
        "choices": [
            "He has not paid for headphones.",
            "He has not built a shared routine that makes focused work, responsiveness, and recovery predictable.",
            "He has not hired more engineers.",
        ],
        "correctIndex": 1,
        "explanation": "The routine is the missing artifact; the diagnosis stops without it.",
    },
    {
        "prompt": "Two ops leads disagree about culture. One wants 'always on'; the other wants a posted weekly rhythm of focus, response, and recovery. Which plan respects the chapter's logic?",
        "choices": [
            "Always on, because customers demand it.",
            "Posted weekly rhythm, because a workplace earns focus and responsiveness through shared, predictable routines.",
            "Neither, because rhythms suffocate flexibility.",
        ],
        "correctIndex": 1,
        "explanation": "Always-on collapses both promises; the rhythm honors both.",
    },
    {
        "prompt": "Sequence: a clinic opens, no one knows when records are done versus when patient calls take priority, mistakes pile up, blame circulates. Where would the chapter intervene first?",
        "choices": [
            "Reduce patient calls.",
            "Post a daily routine that names records hours, call hours, and how urgent calls break in.",
            "Fire the front-desk lead.",
        ],
        "correctIndex": 1,
        "explanation": "Reducing volume is not the lever; the shared, posted routine is.",
    },
    {
        "prompt": "Compare three workplace strategies: maximize availability, mandate silence, or post a routine with focus blocks, response windows, and recovery time. Which is strongest?",
        "choices": [
            "Maximizing availability, because customers expect it.",
            "The posted routine with focus, response, and recovery, because both promises become predictable.",
            "Mandating silence, because quiet enables work.",
        ],
        "correctIndex": 1,
        "explanation": "Availability and silence are partial; the posted routine is the chapter's complete answer.",
    },
]


NEW_QUIZZES[25] = [
    {
        "prompt": "At 7:05 p.m., Willa sees her child's tablet open after a tough piano practice. What is the clearest first move?",
        "choices": [
            "Take the tablet away immediately.",
            "Ask, 'What happened in practice tonight that made the tablet feel good?'",
            "Set a stricter screen rule for tomorrow.",
        ],
        "correctIndex": 1,
        "explanation": "Curiosity about the feeling under the reach is the chapter's first move.",
    },
    {
        "prompt": "A father notices his daughter reaches for her phone every time math homework opens. Which response matches the chapter's idea?",
        "choices": [
            "Confiscate the phone during homework.",
            "Ask what about the math homework is hard or boring before any rule is set.",
            "Threaten loss of phone for the week.",
        ],
        "correctIndex": 1,
        "explanation": "Naming the underlying feeling makes the rule, if any, fit the actual cause.",
    },
    {
        "prompt": "A mother sees her son turn to YouTube after sibling fights. The author would advise what?",
        "choices": [
            "Ban YouTube indefinitely.",
            "Ask what feeling the fight left behind that YouTube is treating.",
            "Punish both kids equally.",
        ],
        "correctIndex": 1,
        "explanation": "The screen is the relief; the feeling is the trigger to be addressed.",
    },
    {
        "prompt": "After a rough school week, a parent notices her child glued to a phone every afternoon. What should she test first?",
        "choices": [
            "Take the phone for a week.",
            "Test asking each afternoon, 'What was hardest at school today?' before any rule.",
            "Lecture about screen time.",
        ],
        "correctIndex": 1,
        "explanation": "The question opens the door the rule alone cannot.",
    },
    {
        "prompt": "During a long evening, a teen retreats to a video game after a tense family dinner. Which move counts as traction?",
        "choices": [
            "Pull the game console plug.",
            "Sit beside him later and ask what the dinner made him feel.",
            "Lecture about respect at the table.",
        ],
        "correctIndex": 1,
        "explanation": "Curiosity about the feeling models the indistractable response and may dissolve the urge.",
    },
    {
        "prompt": "A parent insists, 'My kid is addicted to screens.' You see the kid reaches for screens only after a divorce-related call. What is missing from her diagnosis?",
        "choices": [
            "The kid needs more activities.",
            "She has not asked what feeling the post-call moment leaves behind.",
            "She has not chosen the right screen-time app.",
        ],
        "correctIndex": 1,
        "explanation": "The pattern points at a feeling; the diagnosis stops one step short without that.",
    },
    {
        "prompt": "Two parents debate a tablet rule. One wants strict daily limits; the other wants to ask the child what feeling the tablet is treating. Which plan respects the chapter's logic?",
        "choices": [
            "Strict limits, because limits teach discipline.",
            "Asking what feeling the tablet treats, because curiosity finds the real cue before a rule is set.",
            "Neither, because kids will do what they want.",
        ],
        "correctIndex": 1,
        "explanation": "A rule without the feeling identified often misses the real cause.",
    },
    {
        "prompt": "Sequence: a child gets home from school, drops the bag, reaches for the iPad, and won't talk. Where would the chapter intervene first?",
        "choices": [
            "Take the iPad and demand a conversation.",
            "Sit, hand him a snack, and ask gently what was loud or hard at school today.",
            "Set a 'no screens until homework' rule on the spot.",
        ],
        "correctIndex": 1,
        "explanation": "The gentle question creates space for the feeling under the reach to be named.",
    },
    {
        "prompt": "Compare three responses to a child reaching for a phone after a hard day: confiscate, scold, or ask what feeling the phone is treating. Which is strongest as a first step?",
        "choices": [
            "Confiscating, because removal stops the urge.",
            "Asking what feeling the phone is treating, because the diagnosis must precede the rule.",
            "Scolding, because shame teaches.",
        ],
        "correctIndex": 1,
        "explanation": "Removal and shame skip the trigger; the question finds it.",
    },
]


NEW_QUIZZES[26] = [
    {
        "prompt": "Saturday morning, Trevor lays a single sheet of paper between him and his ten-year-old daughter. What is the clearest first move?",
        "choices": [
            "Tell her the screen plan and homework plan for the week.",
            "Invite her to place climbing, homework, and screen time on the sheet together.",
            "Set time limits and walk away.",
        ],
        "correctIndex": 1,
        "explanation": "Co-built plans become traction; imposed schedules become conflict.",
    },
    {
        "prompt": "A father wants his son to build a useful Sunday plan. Which response matches the chapter's idea?",
        "choices": [
            "Hand the kid a printed schedule.",
            "Ask the son which two important activities and which two free-time blocks should go on Sunday first.",
            "Let the kid plan everything alone.",
        ],
        "correctIndex": 1,
        "explanation": "The child's hands on the plan make it traction, not edict.",
    },
    {
        "prompt": "A single mom wants screen time and homework to coexist. The author would advise what?",
        "choices": [
            "Decide the schedule unilaterally.",
            "Sit with the child Friday night and co-place homework, screens, and outdoor play onto Saturday's sheet.",
            "Trust that the child will figure it out.",
        ],
        "correctIndex": 1,
        "explanation": "Co-placing the blocks is the chapter's traction-builder.",
    },
    {
        "prompt": "After several blowups about Minecraft, a dad wants a better way. What should he test first?",
        "choices": [
            "Ban Minecraft entirely.",
            "Test a weekly co-built sheet with the child where Minecraft, homework, and family time all get blocks.",
            "Let Minecraft happen all weekend.",
        ],
        "correctIndex": 1,
        "explanation": "The co-built sheet defuses conflict by surfacing the choices.",
    },
    {
        "prompt": "During school holidays, a mother wants both rest and reading for her son. Which move counts as traction?",
        "choices": [
            "Mandate two hours of reading a day.",
            "Co-build a holiday sheet with reading, screen time, and chosen rest, agreed before the holiday begins.",
            "Hide all screens.",
        ],
        "correctIndex": 1,
        "explanation": "The agreed plan is what carries the holiday through normal urges.",
    },
    {
        "prompt": "A parent says, 'My kid won't follow any schedule.' You notice she always makes the schedule alone. What is missing from her diagnosis?",
        "choices": [
            "She has not punished schedule violations harshly.",
            "She has not built the schedule together with the child.",
            "She has not bought a chore chart.",
        ],
        "correctIndex": 1,
        "explanation": "Ownership comes from co-building, not from being assigned.",
    },
    {
        "prompt": "Two parents debate planning sessions. One wants to dictate the schedule; the other wants to sit with the kid each Sunday and co-place blocks. Which plan respects the chapter's logic?",
        "choices": [
            "Dictating, because parents know best.",
            "Sitting and co-placing, because the child's traction needs the child's hand.",
            "Neither, because kids are unpredictable.",
        ],
        "correctIndex": 1,
        "explanation": "The chapter is explicit that traction comes from co-building.",
    },
    {
        "prompt": "Sequence: a parent sets a strict screen rule, the child rebels, the parent doubles down, the weekend becomes a fight. Where would the chapter intervene first?",
        "choices": [
            "Triple the screen rule.",
            "Before next weekend, sit with the child and co-build a new sheet with screens, school, and play in it.",
            "Drop all rules forever.",
        ],
        "correctIndex": 1,
        "explanation": "The intervention is upstream: co-building before the fight begins.",
    },
    {
        "prompt": "Compare three planning moves with a child: impose, ignore, or co-build a sheet that names important activities and free time together. Which is strongest?",
        "choices": [
            "Imposing, because authority shapes behavior.",
            "Co-building a sheet, because shared ownership produces traction.",
            "Ignoring, because kids self-regulate.",
        ],
        "correctIndex": 1,
        "explanation": "Authority and absence both miss; the co-built sheet does the work.",
    },
]


NEW_QUIZZES[27] = [
    {
        "prompt": "After watching her gymnast lose practice time to a tablet, a parent suspects the cue, not the tablet. What is the clearest first move?",
        "choices": [
            "Take the tablet away during practice weeks.",
            "Ask her child to point to the cue that pulls her away and redesign that cue together.",
            "Punish the child for losing practice.",
        ],
        "correctIndex": 1,
        "explanation": "The chapter wants the child to learn cue-spotting alongside the parent.",
    },
    {
        "prompt": "A dad notices his son starts homework, then drifts whenever the YouTube tab is visible. Which response matches the chapter's idea?",
        "choices": [
            "Block YouTube for a month.",
            "Sit with the son, name the tab as the cue, and let him close it himself before homework opens.",
            "Stand behind him while he works.",
        ],
        "correctIndex": 1,
        "explanation": "The child learns to spot and change cues; the parent is a partner.",
    },
    {
        "prompt": "A mother sees her daughter abandon piano whenever the phone buzzes on the bench. The author would advise what?",
        "choices": [
            "Confiscate the phone during piano.",
            "Ask the daughter to identify the buzz as the cue and move the phone to another room together.",
            "Tell her to ignore the buzz.",
        ],
        "correctIndex": 1,
        "explanation": "Together-with-her is the chapter's environmental fix.",
    },
    {
        "prompt": "After a season of missed reading, a parent wants a new approach for his ten-year-old. What should he test first?",
        "choices": [
            "Take the tablet away each evening.",
            "Test asking the child to identify the cue (TV in the corner) and move it together before evening reading.",
            "Read to the child every night.",
        ],
        "correctIndex": 1,
        "explanation": "Identifying and changing the cue together teaches the skill the chapter wants.",
    },
    {
        "prompt": "During homework, a teen drifts whenever the bedroom door swings open. Which move counts as traction?",
        "choices": [
            "Lock the door from the outside.",
            "Ask the teen if a closed door would help and let him close it himself.",
            "Demand more focus.",
        ],
        "correctIndex": 1,
        "explanation": "The teen's hand on the change is what produces lasting learning.",
    },
    {
        "prompt": "A father insists, 'My kid has no self-control.' You see his daughter focuses fine when the iPad is out of view. What is missing from his diagnosis?",
        "choices": [
            "The daughter needs medication.",
            "He has not asked her to spot the iPad as a cue and remove it together.",
            "He has not yelled enough.",
        ],
        "correctIndex": 1,
        "explanation": "The diagnosis stops short of the cue work the chapter wants.",
    },
    {
        "prompt": "Two parents argue about homework setup. One wants total silence enforced; the other wants the child to identify the cue and rearrange the desk together. Which plan respects the chapter's logic?",
        "choices": [
            "Enforced silence, because adults set rules.",
            "The child identifying the cue and rearranging the desk together, because the child learns to redesign the environment.",
            "Neither, because environment cannot help focus.",
        ],
        "correctIndex": 1,
        "explanation": "The chapter is explicit about the child learning to spot and change cues.",
    },
    {
        "prompt": "Sequence: a kid plans to read, the TV is on in the next room, he wanders in, an hour vanishes, the parent shouts. Where would the chapter intervene first?",
        "choices": [
            "Punish the next time it happens.",
            "Beforehand, ask the kid to name the TV as the cue and decide together to turn it off during reading.",
            "Take away the book for failing.",
        ],
        "correctIndex": 1,
        "explanation": "The before-the-fact cue conversation is the chapter's fix.",
    },
    {
        "prompt": "Compare three ways to help a child stay on a task: police every lapse, remove all temptations unilaterally, or help her spot the cue and change the environment together. Which is strongest?",
        "choices": [
            "Policing every lapse, because vigilance pays.",
            "Helping her spot the cue and change the environment together, because the skill is what carries forward.",
            "Removing temptations unilaterally, because removal is fastest.",
        ],
        "correctIndex": 1,
        "explanation": "Policing exhausts; unilateral removal teaches nothing; together-with-her teaches the skill.",
    },
]


NEW_QUIZZES[28] = [
    {
        "prompt": "A grandfather wants to teach his grandson to make a small phone pact. What is the clearest first move?",
        "choices": [
            "Hand the grandson a printed rule and walk away.",
            "Ask him to choose one tiny pact for a repeated drift and how he'll know it worked.",
            "Take the phone away entirely.",
        ],
        "correctIndex": 1,
        "explanation": "The chapter wants the child to design, understand, and adjust her own pact.",
    },
    {
        "prompt": "An aunt notices her niece scrolls during her own birthday party. Which response matches the chapter's idea?",
        "choices": [
            "Confiscate the phone for the night.",
            "Quietly ask her niece what small pact she could try for parties and how she'd notice it working.",
            "Embarrass her in front of guests.",
        ],
        "correctIndex": 1,
        "explanation": "The child designs the pact; the adult is a guide.",
    },
    {
        "prompt": "A mother wants her son to handle his own video-game habit. The author would advise what?",
        "choices": [
            "Set strict daily caps and enforce them.",
            "Invite him to choose a small game pact, define how he'll know it's working, and review in a week.",
            "Lock the console in a cabinet.",
        ],
        "correctIndex": 1,
        "explanation": "Ownership of the pact is what makes it stick.",
    },
    {
        "prompt": "After repeated failed limits, a single dad wants his daughter to manage her own social-app use. What should he test first?",
        "choices": [
            "Buy a parental-control app.",
            "Have her choose one tiny pact (TikTok off during dinner), define a success signal, and review Friday.",
            "Take her phone for a month.",
        ],
        "correctIndex": 1,
        "explanation": "Her chosen pact teaches the skill; the parent's app does not.",
    },
    {
        "prompt": "During exam prep, a 14-year-old wants help limiting her own breaks. Which move counts as traction?",
        "choices": [
            "Dictate break length and frequency.",
            "Help her design a small break pact (10 minutes after 50), define how she'll measure it, and review with her.",
            "Let her decide nothing.",
        ],
        "correctIndex": 1,
        "explanation": "She designs, she owns, she reviews.",
    },
    {
        "prompt": "A father says, 'My kid never sticks to rules I set.' You see he has never invited the kid to make any rule himself. What is missing from his diagnosis?",
        "choices": [
            "He has not bought a sticker chart.",
            "He has not guided the child to design a small pact she understands and can adjust.",
            "He has not used punishment.",
        ],
        "correctIndex": 1,
        "explanation": "The diagnosis skips the ownership step.",
    },
    {
        "prompt": "Two parents debate handling a teen's late-night phone. One wants a hard rule; the other wants the teen to design a small pact and adjust after seeing results. Which plan respects the chapter's logic?",
        "choices": [
            "Hard rule, because authority works.",
            "Teen designing a small pact and adjusting, because ownership is what the chapter wants taught.",
            "Neither, because teens always rebel.",
        ],
        "correctIndex": 1,
        "explanation": "The rule arrives without learning; the designed pact builds the skill.",
    },
    {
        "prompt": "Sequence: a parent imposes a strict no-Snapchat rule, the teen sneaks Snapchat anyway, the relationship sours. Where would the chapter intervene first?",
        "choices": [
            "Enforce the rule harder.",
            "Sit with the teen, invite her to design a small Snapchat pact she can own and adjust.",
            "Confiscate the phone permanently.",
        ],
        "correctIndex": 1,
        "explanation": "The intervention is upstream: design with the teen, not at her.",
    },
    {
        "prompt": "Compare three teaching moves: dictate, surveil, or guide the child to design a tiny pact and review it together. Which is strongest as a first step?",
        "choices": [
            "Dictating, because parents lead.",
            "Guiding her to design a tiny pact and review together, because the skill of self-pacting is the lesson.",
            "Surveilling, because oversight teaches.",
        ],
        "correctIndex": 1,
        "explanation": "Dictation and surveillance suppress; guidance teaches the skill.",
    },
]


NEW_QUIZZES[29] = [
    {
        "prompt": "Iris hosts a sleepover and says, 'Phones in the tray first.' What is the clearest first move toward a peer norm?",
        "choices": [
            "Tell each kid individually to put the phone away.",
            "Set a shared ritual: the tray at the door, every visit, no exceptions, with one agreed phrase to invoke it.",
            "Hope the kids self-regulate.",
        ],
        "correctIndex": 1,
        "explanation": "Peer norms work when a small ritual and phrase make distraction easier to notice together.",
    },
    {
        "prompt": "A coach wants the youth soccer team to stop checking phones during practice breaks. Which response matches the chapter's idea?",
        "choices": [
            "Forbid phones at practice.",
            "Co-create a team norm: phones in the cubby during practice, agreed by the team in week one.",
            "Yell at each player who breaks the rule.",
        ],
        "correctIndex": 1,
        "explanation": "The team owns the norm together, which is what spreads it.",
    },
    {
        "prompt": "A teacher wants study groups to stop drifting into TikTok. The author would advise what?",
        "choices": [
            "Take phones at the door of every study session.",
            "Help the group co-author a one-line rule and a small phrase they can use to call out drift without blame.",
            "Disband the study groups.",
        ],
        "correctIndex": 1,
        "explanation": "The shared phrase is the chapter's blame-free social antibody.",
    },
    {
        "prompt": "After a friend group's movie night collapses into phone scrolling, the host wants to do better. What should she test first?",
        "choices": [
            "Cancel future movie nights.",
            "Test a new norm: phones in a basket at the door and an agreed 'tray time?' question if anyone reaches.",
            "Buy a louder TV.",
        ],
        "correctIndex": 1,
        "explanation": "The basket plus the friendly question is a portable peer norm.",
    },
    {
        "prompt": "During a debate-club retreat, advisors want phones off the table during prep. Which move counts as traction?",
        "choices": [
            "Confiscate phones at the door.",
            "Have the debaters write their own one-line rule and agree on the phrase they'll use if someone reaches.",
            "Use a screen-time app on each phone.",
        ],
        "correctIndex": 1,
        "explanation": "Debaters owning the rule makes it stick beyond the retreat.",
    },
    {
        "prompt": "A parent insists her teen's friends 'are bad influences.' You see no agreed group norm anywhere. What is missing from her diagnosis?",
        "choices": [
            "The teen needs different friends.",
            "The group has never written a small shared norm and phrase to call out distraction without blame.",
            "The teen needs harsher punishment.",
        ],
        "correctIndex": 1,
        "explanation": "Peer norms are the lever; the diagnosis stops short of them.",
    },
    {
        "prompt": "Two camp counselors disagree on a phone policy. One wants 'no phones, period'; the other wants the campers to co-author a small norm and phrase. Which plan respects the chapter's logic?",
        "choices": [
            "No phones at all, because rules win.",
            "The campers co-authoring a norm and phrase, because peer ownership makes distraction easier to notice and harder to spread.",
            "Neither, because camp is a free-for-all.",
        ],
        "correctIndex": 1,
        "explanation": "Co-authored norms are how social antibodies actually spread.",
    },
    {
        "prompt": "Sequence: a study session begins, one student opens Instagram, three more follow, the session collapses. Where would the chapter intervene first?",
        "choices": [
            "Ban the apps in advance.",
            "Earlier, the group writes a one-line norm and a friendly phrase to invoke when anyone opens a feed.",
            "Cancel the session.",
        ],
        "correctIndex": 1,
        "explanation": "The pre-written norm and phrase stop the chain reaction.",
    },
    {
        "prompt": "Compare three ways to spread focus among friends: rely on willpower, ban phones, or have the group write one shared line and pick a friendly phrase to call out drift. Which is strongest?",
        "choices": [
            "Willpower, because each person owns their attention.",
            "Writing one shared line and picking a friendly call-out phrase, because peer ownership is what makes distraction easier to notice and harder to spread.",
            "Banning phones, because removal solves it.",
        ],
        "correctIndex": 1,
        "explanation": "Willpower and bans both ignore the social fabric; the chapter's lever is peer norms.",
    },
]


NEW_QUIZZES[30] = [
    {
        "prompt": "At the hallway bowl, Emily slides her pager into it before her husband walks in. What is the clearest first move?",
        "choices": [
            "Keep the pager and explain quickly.",
            "Place the pager in the bowl, name the intention ('an hour of undivided time'), and open with one real question.",
            "Promise to be present 'mentally.'",
        ],
        "correctIndex": 1,
        "explanation": "Structure clears space for tenderness; an opening question is the doorway.",
    },
    {
        "prompt": "A new dad wants to give his partner full presence after the baby is asleep. Which response matches the chapter's idea?",
        "choices": [
            "Sit on the couch and scroll together.",
            "Remove phones from the room, name the next hour as 'just us,' and ask one open question to begin.",
            "Talk only about the baby.",
        ],
        "correctIndex": 1,
        "explanation": "A removed cue and a named intention create the room where attention can land.",
    },
    {
        "prompt": "A couple's date nights keep getting interrupted by work pings. The author would advise what?",
        "choices": [
            "Cancel date night until work calms down.",
            "Leave phones in the car, agree on one chosen activity, and start with a question neither has been asked.",
            "Try harder to ignore the pings.",
        ],
        "correctIndex": 1,
        "explanation": "The structure makes presence possible before willpower has to fight.",
    },
    {
        "prompt": "After a year of distracted dinners, a wife wants a new ritual. What should she test first?",
        "choices": [
            "Buy a new dinner table.",
            "Test a phone-bowl ritual at 7 p.m. and a single named conversation question per dinner for one week.",
            "Eat in silence.",
        ],
        "correctIndex": 1,
        "explanation": "A bounded ritual experiment can become the room where presence shows up.",
    },
    {
        "prompt": "During a long-distance week, a partner wants real calls, not pings. Which move counts as traction?",
        "choices": [
            "Send more emojis.",
            "Schedule a phones-off call at 9 p.m. with a single chosen topic to open it.",
            "Text constantly throughout the day.",
        ],
        "correctIndex": 1,
        "explanation": "The scheduled call with a chosen topic structures presence into a chosen window.",
    },
    {
        "prompt": "A husband says, 'We're connected; we text all day.' You see them both staring at phones whenever they're together. What is missing from his diagnosis?",
        "choices": [
            "They need better data plans.",
            "They have no structure that protects undivided time when they share the same room.",
            "They need a couples' app.",
        ],
        "correctIndex": 1,
        "explanation": "Connection-by-texting can mask the absence of presence-in-the-room.",
    },
    {
        "prompt": "Two partners debate Sunday mornings. One wants 'spontaneous' time; the other wants a phones-off coffee block with a chosen question. Which plan respects the chapter's logic?",
        "choices": [
            "Spontaneous time, because love is intuitive.",
            "Phones-off coffee with a chosen question, because structure clears space for actual presence.",
            "Neither, because mornings are too rushed.",
        ],
        "correctIndex": 1,
        "explanation": "Spontaneity collides with phones; the structure protects the first minute.",
    },
    {
        "prompt": "Sequence: a couple sits down to talk, phones buzz, both check, the conversation never finds traction, they go to bed quietly upset. Where would the chapter intervene first?",
        "choices": [
            "Skip the conversation.",
            "Before sitting, put both phones in another room and open with one undivided question.",
            "Talk through the buzzes.",
        ],
        "correctIndex": 1,
        "explanation": "Removing the cue and opening with a real question is the chapter's structural lever.",
    },
    {
        "prompt": "Compare three approaches to a fragile evening conversation: try to be more present, fight through phones, or remove the cue, name the intention, and start with one undivided question. Which is strongest?",
        "choices": [
            "Trying to be more present, because intention is enough.",
            "Removing the cue, naming the intention, and starting with one undivided question, because structure makes presence possible.",
            "Fighting through phones, because love overcomes.",
        ],
        "correctIndex": 1,
        "explanation": "Intention and grit lose to a buzzing phone; the structural opening wins.",
    },
]


# ---------- main apply + audit ----------

def normalize(s: str) -> str:
    s = s.lower()
    s = re.sub(r"[^\w\s]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def find_shared_ngrams(a: str, b: str, n: int) -> list[str]:
    a_words = a.split()
    b_words = b.split()
    a_grams = {" ".join(a_words[i : i + n]) for i in range(len(a_words) - n + 1)}
    return [
        " ".join(b_words[i : i + n])
        for i in range(len(b_words) - n + 1)
        if " ".join(b_words[i : i + n]) in a_grams
    ]


def apply_rewrites() -> None:
    with PATH.open() as f:
        data = json.load(f)

    for ch in data["chapters"]:
        num = ch["number"]
        if num not in NEW_QUIZZES:
            continue
        new = NEW_QUIZZES[num]
        questions = ch["quiz"]["questions"]
        if len(new) != len(questions):
            print(f"Ch{num}: expected {len(questions)} questions, got {len(new)} new", file=sys.stderr)
            sys.exit(1)
        for q, nq in zip(questions, new):
            q["prompt"] = nq["prompt"]
            q["choices"] = nq["choices"]
            q["correctIndex"] = nq["correctIndex"]
            q["explanation"] = nq["explanation"]

    with PATH.open("w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")


def audit() -> int:
    with PATH.open() as f:
        data = json.load(f)
    failures = 0
    for ch in data["chapters"]:
        qs = ch["quiz"]["questions"]
        prompts = [normalize(q["prompt"]) for q in qs]
        overlaps = []
        for i in range(len(prompts)):
            for j in range(i + 1, len(prompts)):
                shared = find_shared_ngrams(prompts[i], prompts[j], 6)
                if shared:
                    overlaps.append((i + 1, j + 1, shared[0]))
        if overlaps:
            failures += 1
            print(f"Ch{ch['number']}: {ch['title']}")
            for i, j, s in overlaps:
                print(f"  q{i:02d} & q{j:02d} share: '{s}'")
    if failures == 0:
        print("AUDIT PASS: no 6+ word overlaps in any chapter.")
    else:
        print(f"\nAUDIT FAIL: {failures} chapters still have overlaps.")
    return failures


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "audit"
    if cmd == "apply":
        apply_rewrites()
        print("Applied. Running audit…\n")
        audit()
    elif cmd == "audit":
        audit()
    else:
        print(f"unknown cmd: {cmd}", file=sys.stderr)
        sys.exit(2)
