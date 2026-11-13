// A browser-level stand-in for the book data API, for the signed-in harness.
//
// The dev server used by CI has no database, so every /app/api/book/ read would
// fail and the signed-in pages could only show their error states. This
// installs a Playwright route on a browser context that answers those requests
// from e2e/support/fixtures.ts instead, as a signed-in reader with onboarding
// complete. Nothing is mocked on the server.
//
// Rule: an endpoint the plane does not know answers 404 `not_found` and is
// recorded in `unknown`, so a page that starts calling a new endpoint is visible
// in the test output instead of silently getting an empty answer.
import type { BrowserContext } from "@playwright/test";
import { buildFixtures, CATALOG, at, personaProgress, type Fixtures, type Persona } from "./fixtures";

const BOOK_API = /\/app\/api\/book\//;
const API_PREFIX = /^\/app\/api\/book\//;

type Answer = { status: number; body: unknown };

const NOT_FOUND: Answer = { status: 404, body: { error: { code: "not_found", message: "Not mocked in the harness." } } };

export class MockDataPlane {
  readonly persona: Persona;
  readonly fx: Fixtures;
  /** Request keys ("GET me/streak") that got a 2xx answer, with counts. */
  readonly answered = new Map<string, number>();
  /** Request keys with no fixture, with counts. */
  readonly unknown = new Map<string, number>();
  /** Full URLs of the requests that got the not_found answer (for console-message matching). */
  readonly unknownUrls = new Set<string>();

  constructor(persona: Persona) {
    this.persona = persona;
    this.fx = buildFixtures(persona);
  }

  get answeredOkCount(): number {
    let n = 0;
    for (const c of this.answered.values()) n += c;
    return n;
  }

  private bookState(bookId: string): unknown {
    const p = personaProgress(this.persona).find((x) => x.bookId === bookId);
    const id = (n: number) => `${bookId}-ch${String(n).padStart(2, "0")}`;
    if (!p) {
      return {
        stateStatus: "not_started",
        state: {
          userId: this.fx.sub,
          bookId,
          currentChapterId: id(1),
          completedChapterIds: [],
          unlockedChapterIds: [id(1)],
          chapterScores: {},
          chapterCompletedAt: {},
          lastReadChapterId: id(1),
          lastOpenedAt: "1970-01-01T00:00:00.000Z",
          createdAt: at(0),
          updatedAt: at(0),
        },
        applicationStates: {},
      };
    }
    return {
      stateStatus: "started",
      state: {
        userId: this.fx.sub,
        bookId,
        currentChapterId: id(p.current),
        completedChapterIds: p.completed.map(id),
        unlockedChapterIds: Array.from({ length: p.unlocked }, (_, i) => id(i + 1)),
        chapterScores: Object.fromEntries(Object.entries(p.scores).map(([n, s]) => [id(Number(n)), s])),
        chapterCompletedAt: {},
        lastReadChapterId: id(p.current),
        lastOpenedAt: p.last,
        createdAt: at(60 * 86_400_000),
        updatedAt: p.last,
      },
      applicationStates: {},
    };
  }

  /** The answer for one request, or null when the plane has no fixture for it. */
  private answer(method: string, rel: string, search: URLSearchParams): Answer | null {
    const ok = (body: unknown): Answer => ({ status: 200, body });
    const fx = this.fx;
    let m: RegExpMatchArray | null;

    if (method === "GET") {
      switch (rel) {
        case "me/dashboard": return ok(fx.dashboard);
        case "me/entitlements": return ok(fx.entitlements);
        case "me/settings": return ok(fx.settings);
        case "me/profile": return ok(fx.profile);
        case "me/notifications": return ok(fx.notifications);
        case "me/saved": return ok(fx.saved);
        case "me/badges": return ok(fx.badges);
        case "me/streak": return ok(fx.streak);
        case "me/flow-points": return ok(fx.flowPoints);
        case "me/tier": return ok(fx.tier);
        case "me/shop": return ok(fx.shop);
        case "me/progress": return ok(fx.progressList);
        case "me/notebook": return ok(fx.notebook);
        case "me/commitments": return ok(fx.commitments);
        case "me/pairs": return ok(fx.pairs);
        case "me/is-admin": return ok({ isAdmin: false });
        case "me/onboarding/progress": return ok(fx.onboardingProgress);
        case "events/active": return ok(fx.events);
        case "books/journeys": return ok(fx.journeys);
        case "search-index": return ok(fx.search);
        case "books": return ok({ books: CATALOG });
        case "me/reviews": {
          const mode = search.get("mode");
          return ok(mode === "all" ? fx.reviewsAll : mode === "stats" ? fx.reviewsStats : fx.reviews);
        }
      }
      if ((m = rel.match(/^me\/books\/([^/]+)\/state$/))) return ok(this.bookState(decodeURIComponent(m[1] ?? "")));
      if (/^me\/books\/[^/]+\/chapters\/\d+\/state$/.test(rel)) return ok({ state: null });
      if (/^me\/books\/[^/]+\/chapters\/\d+\/scenarios$/.test(rel)) return ok({ approvedScenarios: [], mySubmissions: [], points: 0 });
      if (/^me\/books\/[^/]+\/depth-recommendation$/.test(rel)) {
        return ok({ recommendedDepth: "medium", confidence: 0.3, reason: "Not enough data yet.", hasData: false });
      }
      return null;
    }

    // Writes a signed-in page may send on its own while loading or settling.
    if (method === "POST" && (rel === "me/analytics/track" || rel === "me/analytics/beacon")) return ok({ recorded: true });
    if (method === "POST" && rel === "me/reading-sessions") {
      return ok({ readingDay: { userId: fx.sub, dayKey: at(0).slice(0, 10), totalActiveMs: 60_000, updatedAt: at(0), lastActivityAt: at(0) }, trackedMinutesToday: 1 });
    }
    if (method === "PUT" && rel === "me/badges") return ok({ created: false });
    if (method === "POST" && rel === "books/reader-metrics") return ok({ recorded: true });
    if (method === "PATCH" && rel === "me/settings") return ok(fx.settings);
    if (method === "PATCH" && rel === "me/profile") return ok(fx.profile);
    if (method === "PATCH" && rel === "me/onboarding/progress") return ok({ success: true });
    if (method === "POST" && (rel === "me/notifications" || rel === "me/notifications/read-all")) return ok({ marked: true });
    if (method === "PATCH" && /^me\/books\/[^/]+\/(chapters\/\d+\/)?state$/.test(rel)) return ok({ state: {} });
    return null;
  }

  handle(method: string, url: URL): Answer {
    const rel = url.pathname.replace(API_PREFIX, "");
    const key = `${method} ${rel}`;
    const answer = this.answer(method, rel, url.searchParams);
    if (!answer) {
      this.unknown.set(key, (this.unknown.get(key) ?? 0) + 1);
      this.unknownUrls.add(url.href);
      return NOT_FOUND;
    }
    if (answer.status >= 200 && answer.status < 300) this.answered.set(key, (this.answered.get(key) ?? 0) + 1);
    return answer;
  }

  /** One line per unknown endpoint, for the test output. */
  describeUnknown(): string[] {
    return [...this.unknown].map(([key, n]) => `${key} x${n}`);
  }
}

/**
 * Make `context` a signed-in reader: onboarding finished, light theme in sync
 * with the settings fixture, service workers off, and the book API answered
 * from fixtures. Install the page clock (page.clock.install) separately,
 * before the first navigation.
 */
export async function installMockDataPlane(context: BrowserContext, persona: Persona): Promise<MockDataPlane> {
  const plane = new MockDataPlane(persona);
  await context.addInitScript(
    ({ synced, completedAt }: { synced: string; completedAt: string }) => {
      try {
        if (localStorage.getItem("__harness_seeded")) return;
        localStorage.setItem(
          "book-accelerator:onboarding:v5",
          JSON.stringify({ currentStep: 4, setupComplete: true, completedAt, dailyGoalMinutes: 20 }),
        );
        localStorage.setItem("book-accelerator:preferences:v2", JSON.stringify({ appearance: { theme: "light" } }));
        localStorage.setItem("book-accelerator:preferences:last-synced-at:v2", synced);
        localStorage.setItem("__harness_seeded", "1");
      } catch {
        // Storage can be unavailable; the page then renders its defaults.
      }
    },
    { synced: plane.fx.settingsUpdatedAt, completedAt: at(60 * 86_400_000) },
  );
  await context.route(BOOK_API, async (route) => {
    const request = route.request();
    const res = plane.handle(request.method(), new URL(request.url()));
    await route.fulfill({ status: res.status, contentType: "application/json", body: JSON.stringify(res.body) });
  });
  return plane;
}
