import { getChapterFlowSiteUrl } from "@/app/_lib/chapterflow-brand";

// ── Share Card URL builder & share helper ────────────────────────────────────
// Single source of truth for constructing OG-image URLs and performing shares.

export type ShareCardParams =
  | {
      type: "chapter";
      bookTitle: string;
      author?: string;
      chapter: string;
      takeaway: string;
      userName?: string;
      ref?: string;
    }
  | {
      type: "badge";
      badgeName: string;
      userName?: string;
      ref?: string;
    }
  | {
      type: "streak";
      streakDays: number;
      userName?: string;
      ref?: string;
    }
  | {
      type: "book";
      bookTitle: string;
      author?: string;
      userName?: string;
      ref?: string;
    };

/** Build the absolute URL for the share-card OG image endpoint. */
export function buildShareCardUrl(params: ShareCardParams): string {
  const base = getChapterFlowSiteUrl();
  const url = new URL("/api/book/share/card", base);

  url.searchParams.set("type", params.type);

  if ("bookTitle" in params && params.bookTitle) {
    url.searchParams.set("bookTitle", params.bookTitle);
  }
  if ("author" in params && params.author) {
    url.searchParams.set("author", params.author);
  }
  if ("chapter" in params && params.chapter) {
    url.searchParams.set("chapter", params.chapter);
  }
  if ("takeaway" in params && params.takeaway) {
    url.searchParams.set("takeaway", params.takeaway);
  }
  if ("badgeName" in params && params.badgeName) {
    url.searchParams.set("badgeName", params.badgeName);
  }
  if ("streakDays" in params) {
    url.searchParams.set("streakDays", String(params.streakDays));
  }
  if (params.userName) {
    url.searchParams.set("userName", params.userName);
  }
  if (params.ref) {
    url.searchParams.set("ref", params.ref);
  }

  return url.toString();
}

/** Build plain-text share message for a given card type. */
export function buildShareText(params: ShareCardParams): string {
  switch (params.type) {
    case "chapter":
      return `I just finished Chapter ${params.chapter} of "${params.bookTitle}" on ChapterFlow! 📖`;
    case "badge":
      return `I just earned the "${params.badgeName}" badge on ChapterFlow! 🏆`;
    case "streak":
      return `${params.streakDays}-day reading streak on ChapterFlow! 🔥`;
    case "book":
      return `I just finished "${params.bookTitle}" on ChapterFlow! 📚`;
  }
}

/** Share via Web Share API with clipboard fallback. */
export async function performShare(opts: {
  title: string;
  text: string;
  url: string;
  tracking?: {
    cardType: "chapter" | "badge" | "streak" | "book";
    bookId?: string;
    chapterNumber?: number;
    badgeId?: string;
    referralCode?: string;
  };
}): Promise<"shared" | "copied" | "unsupported"> {
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ title: opts.title, text: opts.text, url: opts.url });
      if (opts.tracking) {
        // Web Share API doesn't reveal the chosen destination
        void trackShareEvent({ ...opts.tracking, destination: "clipboard" });
      }
      return "shared";
    } catch {
      // User cancelled or share failed — fall through to clipboard
    }
  }

  if (typeof navigator !== "undefined" && navigator.clipboard) {
    await navigator.clipboard.writeText(`${opts.text}\n${opts.url}`);
    if (opts.tracking) {
      void trackShareEvent({ ...opts.tracking, destination: "clipboard" });
    }
    return "copied";
  }

  return "unsupported";
}

function trackShareEvent(data: {
  cardType: string;
  destination: string;
  bookId?: string;
  chapterNumber?: number;
  badgeId?: string;
  referralCode?: string;
}): void {
  fetch("/api/book/me/share-events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }).catch(() => {
    // Fire-and-forget — don't block the UI on tracking failures
  });
}
