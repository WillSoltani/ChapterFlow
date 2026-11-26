/** Apply a fix call's output to a chapter. Port of the W1 Python harness. Never mutates the input. */
import type { Chapter } from "./types";

export interface FixEdit { field: string; find: string; replace: string }
export interface KeyChange { questionId: string; newIndex: number; keyedChoiceText: string }
export interface FixOutput { edits?: FixEdit[]; keyChanges?: KeyChange[]; declined?: { issue: number; reason: string }[] }
export interface FixError { field?: string; find?: string; keyChange?: KeyChange; error: string }

type Container = Record<string, unknown>; // arrays index fine by string key
interface Ref { parent: Container; key: string; value: unknown }

const ID_KEYS = ["exampleId", "cardId", "questionId"];
const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);
const isObj = (v: unknown): v is Container => typeof v === "object" && v !== null;

/** One path segment: array -> numeric index or element id; object -> own key, with "quiz.<id>" meaning quiz.questions[<id>]. */
function step(node: unknown, seg: string): Ref | null {
  if (Array.isArray(node)) {
    const i = /^\d+$/.test(seg)
      ? Number(seg)
      : node.findIndex((el) => isObj(el) && ID_KEYS.some((k) => el[k] === seg));
    return i >= 0 && i < node.length ? { parent: node as unknown as Container, key: String(i), value: node[i] } : null;
  }
  if (isObj(node)) {
    if (has(node, seg)) return { parent: node, key: seg, value: node[seg] };
    if (Array.isArray(node.questions)) return step(node.questions, seg);
  }
  return null;
}

/** Every string leaf at or below `ref`, in document order. */
function leavesUnder(ref: Ref, out: Ref[] = []): Ref[] {
  if (typeof ref.value === "string") out.push(ref);
  else if (isObj(ref.value)) {
    const parent = ref.value;
    for (const key of Object.keys(parent)) leavesUnder({ parent, key, value: parent[key] }, out);
  }
  return out;
}

function resolveLeaves(root: unknown, segs: string[]): Ref[] {
  let node = root;
  let ref: Ref | null = null;
  for (const seg of segs) {
    ref = step(node, seg);
    if (!ref) return [];
    node = ref.value;
  }
  return ref ? leavesUnder(ref) : [];
}

/** The field's string leaves; if it yields none, retry once on the parent path. */
function fieldLeaves(root: unknown, field: string): Ref[] {
  const segs = field.split(".");
  const leaves = resolveLeaves(root, segs);
  return leaves.length || segs.length < 2 ? leaves : resolveLeaves(root, segs.slice(0, -1));
}

export function applyFix(chapter: Chapter, fix: FixOutput): { chapter: Chapter; applied: number; errors: FixError[] } {
  const out = structuredClone(chapter);
  const errors: FixError[] = [];
  let applied = 0;

  for (const edit of fix.edits ?? []) {
    const { field, find, replace } = edit;
    if (typeof field !== "string" || typeof find !== "string" || typeof replace !== "string") {
      errors.push({ field, find, error: "edit needs string field, find and replace" });
      continue;
    }
    if (find === "") {
      errors.push({ field, find, error: "find text is empty" });
      continue;
    }
    const leaf = fieldLeaves(out, field).find((l) => (l.value as string).includes(find));
    if (!leaf) {
      errors.push({ field, find, error: "find text not present in that field" });
      continue;
    }
    // Slice rather than String.replace so "$&" etc. in the replacement stay literal.
    const text = leaf.value as string;
    const at = text.indexOf(find);
    leaf.parent[leaf.key] = text.slice(0, at) + replace + text.slice(at + find.length);
    applied++;
  }

  // Key changes run after edits so keyedChoiceText is checked against the final choice text.
  for (const kc of fix.keyChanges ?? []) {
    const q = out.quiz.questions.find((x) => x.questionId === kc.questionId);
    if (!q) {
      errors.push({ keyChange: kc, error: `question not found: ${kc.questionId}` });
    } else if (!Number.isInteger(kc.newIndex)) {
      errors.push({ keyChange: kc, error: "newIndex must be an integer" });
    } else if (kc.newIndex < 0 || kc.newIndex >= q.choices.length) {
      errors.push({ keyChange: kc, error: `newIndex out of range 0..${q.choices.length - 1}` });
    } else if (q.choices[kc.newIndex] !== kc.keyedChoiceText) {
      errors.push({ keyChange: kc, error: "keyedChoiceText does not equal choices[newIndex]" });
    } else {
      q.correctIndex = kc.newIndex;
      applied++;
    }
  }

  return { chapter: out, applied, errors };
}
