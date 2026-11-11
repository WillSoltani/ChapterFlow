/** The five approaches per component: the single source the variants prompts render their lists from, and the rules the
 *  book writer gets for the approaches the owner picked. Labels A to E match the pick page. */
import type { Component } from "./variants";

export interface Approach {
  label: "A" | "B" | "C" | "D" | "E";
  name: string;
  rule: string;
  /** Summary openers only: the order of the telling after this opener. The book writer's plan prints it; the pick page does not. */
  path?: string;
}

export const APPROACHES: Record<Component, Approach[]> = {
  summary: [
    { label: "A", name: "problem scene", rule: "open on a modern everyday moment where the obvious move (the wrong belief) is about to backfire. The reader feels the problem before knowing the answer.", path: "the scene; why the obvious move fails here; the author's idea; the book's evidence; how to use the idea; back to the scene with the move made; the lesson in one line." },
    { label: "B", name: "question or puzzle", rule: "open with a sharp question or a small puzzle the reader cannot yet answer. The summary answers it at the end.", path: "the question; what most people would answer and why that fails; the author's answer and its reason; the book's evidence; the question answered in one line." },
    { label: "C", name: "two people, two choices", rule: "open with two people facing the same situation and choosing differently. The difference is the lesson.", path: "two people, two choices; what happens to each; the idea that explains the difference; the book's evidence; how to do what the second person did; the lesson in one line." },
    { label: "D", name: "surprising claim first", rule: "open by stating the counterintuitive claim bluntly in the first sentence, then earn it.", path: "the claim; the book's evidence that proves it; why the opposite belief is so common; how to use it, step by step; the lesson in one line." },
    { label: "E", name: "concrete analogy", rule: "open with a physical, everyday analogy (a leaky tap, a scoreboard, a cold room) that carries the lesson, and come back to it at the end.", path: "the analogy; where it shows up in the reader's life; the author's idea; the book's evidence; back to the analogy; the lesson in one line." },
  ],
  examples: [
    { label: "A", name: "one decision moment", rule: "settings work, school, personal. Scenario 50 to 70 words that ends at the moment of choice; whatToDo up to 30 words; whyItMatters up to 25 words." },
    { label: "B", name: "short and plain", rule: "settings work, school, personal. Scenario 30 to 45 words, the way a friend would tell it; whatToDo up to 20 words; whyItMatters up to 20 words." },
    { label: "C", name: "before and after", rule: "settings work, school, personal. Scenario 50 to 70 words that shows the wrong move and its cost first; whatToDo gives the right move; whyItMatters names what changes." },
    { label: "D", name: "a short dialogue", rule: "settings work, school, personal. Scenario 50 to 75 words as a 3 or 4 line exchange where one person pushes the wrong belief and the other answers with the lesson's move, written as prose with the spoken lines in quotation marks; whatToDo and whyItMatters up to 25 words each." },
    { label: "E", name: "money, health, relationships", rule: "the same form as A (one decision moment), but the settings are money, health and relationships." },
  ],
  quiz: [
    { label: "A", name: "what do you do", rule: "every question puts the reader in a situation and asks what to do (apply)." },
    { label: "B", name: "spot the trap", rule: "every question shows someone's reasoning and asks which thought is the trap, or which belief led them wrong (analyze)." },
    { label: "C", name: "predict what happens", rule: "every question describes a choice someone made and asks what most likely happens next (understand or apply)." },
    { label: "D", name: "best reply", rule: "every question quotes something a friend or coworker says that carries the wrong belief, and asks which reply uses the lesson (apply)." },
    { label: "E", name: "one of each", rule: "one question in each of the forms A to D (what do you do; spot the trap; predict what happens; best reply), plus one \"why does this work?\" question (understand); further questions repeat the forms in that order." },
  ],
  cards: [
    { label: "A", name: "situation to move", rule: "the front is a short modern situation; the back is the move to make and why." },
    { label: "B", name: "why questions", rule: "the front asks why the lesson works, or why the wrong belief fails, in a specific case; the back answers." },
    { label: "C", name: "finish the sentence", rule: "the front is a sentence with the key part missing, such as \"When ..., the better move is ...\"; the back completes it with a reason." },
    { label: "D", name: "what went wrong", rule: "the front describes someone who followed the wrong belief and what happened; the back names the mistake and the fix." },
    { label: "E", name: "mixed", rule: "one card in each of the forms A to D (situation to move; why question; finish the sentence; what went wrong), plus one card that asks for the lesson in the reader's own words." },
  ],
  practice: [
    { label: "A", name: "two-minute actions", rule: "every action takes under two minutes and needs nothing new." },
    { label: "B", name: "specific cues", rule: "the if-then cues are clear moments from an ordinary week (a routine moment, a thought the reader catches, a remark people often hear), and the actions follow from those cues." },
    { label: "C", name: "with another person", rule: "every action involves telling, asking or showing someone else." },
    { label: "D", name: "track and count", rule: "the actions make the reader count, log or mark something, so they can see the lesson working." },
    { label: "E", name: "the shortest possible", rule: "the fewest words that still give one clear action per field." },
  ],
};

/** The list a variants prompt shows: one line per approach, A to E. */
export function approachesText(component: Component): string {
  return APPROACHES[component].map((a) => `- ${a.label}, "${a.name}": ${a.rule}`).join("\n");
}

export function approach(component: Component, label: string): Approach {
  const a = APPROACHES[component].find((x) => x.label === label);
  if (!a) throw new Error(`NO_SUCH_APPROACH: ${component} has no approach ${label}`);
  return a;
}
