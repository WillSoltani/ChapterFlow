// Library "Browse all" state in the URL (HOME-17). Pure so it is testable.

import { SORT_OPTIONS, type Category, type Difficulty, type SortOption } from "./libraryData";

export type StatusFilter = "all" | "in_progress" | "not_started" | "completed";
export type MoodFilter = "quick" | "deep" | "staff" | "decide";

export interface BrowseParams {
  status: StatusFilter;
  category: Category | null;
  difficulty: Difficulty | null;
  sort: SortOption;
  mood: MoodFilter | null;
  showAll: boolean;
}

export const DEFAULT_BROWSE_PARAMS: BrowseParams = {
  status: "all",
  category: null,
  difficulty: null,
  sort: "featured",
  mood: null,
  showAll: false,
};

const STATUSES: readonly StatusFilter[] = ["all", "in_progress", "not_started", "completed"];
const CATEGORIES: readonly Category[] = [
  "Psychology",
  "Productivity",
  "Strategy",
  "Leadership",
  "Communication",
  "Philosophy",
];
const DIFFICULTIES: readonly Difficulty[] = ["easy", "medium", "hard"];
const MOODS: readonly MoodFilter[] = ["quick", "deep", "staff", "decide"];
const SORTS: readonly SortOption[] = SORT_OPTIONS.map((o) => o.value);

const BROWSE_KEYS = ["status", "category", "difficulty", "sort", "mood", "all"] as const;

type ParamReader = { get(name: string): string | null };

function oneOf<T extends string>(values: readonly T[], raw: string | null): T | null {
  return raw !== null && (values as readonly string[]).includes(raw) ? (raw as T) : null;
}

export function parseBrowseParams(
  params: ParamReader,
  initialCategory?: Category | null,
): BrowseParams {
  return {
    status: oneOf(STATUSES, params.get("status")) ?? "all",
    category: oneOf(CATEGORIES, params.get("category")) ?? initialCategory ?? null,
    difficulty: oneOf(DIFFICULTIES, params.get("difficulty")),
    sort: oneOf(SORTS, params.get("sort")) ?? "featured",
    mood: oneOf(MOODS, params.get("mood")),
    showAll: params.get("all") === "1",
  };
}

/** Query string (no leading "?") for `state`, keeping every non-browse param of `base`. */
export function serializeBrowseParams(base: URLSearchParams, state: BrowseParams): string {
  const out = new URLSearchParams(base);
  for (const key of BROWSE_KEYS) out.delete(key);
  if (state.status !== "all") out.set("status", state.status);
  if (state.category) out.set("category", state.category);
  if (state.difficulty) out.set("difficulty", state.difficulty);
  if (state.sort !== "featured") out.set("sort", state.sort);
  if (state.mood) out.set("mood", state.mood);
  if (state.showAll) out.set("all", "1");
  return out.toString();
}
