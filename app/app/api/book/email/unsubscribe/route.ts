import "server-only";

import {
  getEmailComplianceConfig,
  verifyUnsubscribeToken,
  type EmailCategory,
} from "@/app/app/api/book/_lib/email-compliance";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import { getUserSettingsItem, putUserSettingsItem } from "@/app/app/api/book/_lib/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public, unauthenticated one-click unsubscribe endpoint (CASL §6 / CAN-SPAM /
 * RFC 8058). The signed token in the URL is the only credential — recipients
 * are not logged in. Exempted from auth in `middleware.ts`.
 *
 *   GET  → human-facing landing page (no mutation) with a confirm button.
 *   POST → applies the unsubscribe (email-client one-click or the confirm form).
 */

const CATEGORY_LABELS: Record<EmailCategory, string> = {
  reading_reminder: "daily reading reminders",
  streak: "streak reminders",
  weekly_digest: "the weekly digest",
  welcome_back: "return nudges",
  celebration: "achievement emails",
  all: "all ChapterFlow emails",
};

function htmlResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

function page(title: string, inner: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="noindex"/>
<title>${title} · ChapterFlow</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#f6f7f9;color:#1f2430;margin:0;padding:32px}
  .card{max-width:480px;margin:48px auto;background:#fff;border:1px solid #e6e8ec;border-radius:16px;padding:32px;box-shadow:0 6px 24px rgba(0,0,0,.05)}
  h1{font-size:20px;margin:0 0 12px}
  p{font-size:15px;line-height:1.6;color:#4b5260;margin:0 0 16px}
  .btn{display:inline-block;border:none;border-radius:10px;padding:11px 18px;font-size:14px;font-weight:600;cursor:pointer;text-decoration:none}
  .btn-primary{background:#4f46e5;color:#fff}
  .btn-secondary{background:transparent;color:#4f46e5;padding-left:0}
  .muted{color:#8b92a1;font-size:13px}
  form{margin:0}
</style></head><body><div class="card">${inner}</div></body></html>`;
}

function invalidPage(): Response {
  return htmlResponse(
    page(
      "Link expired",
      `<h1>This unsubscribe link is invalid or expired</h1>
       <p>The link may have expired. You can manage every email preference from your
       account settings instead.</p>
       <p><a class="btn btn-primary" href="/book/settings#notifications">Open settings</a></p>`,
    ),
    400,
  );
}

function applyUnsubscribe(
  settings: Record<string, unknown>,
  category: EmailCategory,
): Record<string, unknown> {
  const next = { ...settings };
  const notifications = {
    ...((next.notifications as Record<string, unknown> | undefined) ?? {}),
  };

  switch (category) {
    case "reading_reminder":
      notifications.readingReminderEnabled = false;
      break;
    case "streak":
      notifications.streakReminderEnabled = false;
      break;
    case "weekly_digest":
      notifications.weeklyDigestEnabled = false;
      break;
    case "welcome_back":
      notifications.welcomeBackEnabled = false;
      break;
    case "celebration":
      notifications.badgeCelebrationEnabled = false;
      notifications.achievementAlertsEnabled = false;
      break;
    case "all":
      notifications.channels = {
        ...((notifications.channels as Record<string, unknown> | undefined) ?? {}),
        email: false,
      };
      break;
  }

  next.notifications = notifications;
  return next;
}

async function resolve(token: string | null) {
  if (!token) return null;
  const config = await getEmailComplianceConfig();
  return verifyUnsubscribeToken(token, config.secret);
}

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  const claim = await resolve(token);
  if (!claim) return invalidPage();

  const label = CATEGORY_LABELS[claim.category];
  const allButton =
    claim.category === "all"
      ? ""
      : `<form method="post" action="?token=${encodeURIComponent(token!)}" style="margin-top:8px">
           <input type="hidden" name="scope" value="all"/>
           <button class="btn btn-secondary" type="submit">Unsubscribe from all ChapterFlow emails</button>
         </form>`;

  return htmlResponse(
    page(
      "Unsubscribe",
      `<h1>Unsubscribe from ${label}?</h1>
       <p>Confirm below and we'll stop sending you ${label}. You'll still get essential
       account emails (like receipts and password resets).</p>
       <form method="post" action="?token=${encodeURIComponent(token!)}">
         <button class="btn btn-primary" type="submit">Unsubscribe</button>
       </form>
       ${allButton}
       <p class="muted" style="margin-top:20px">Prefer to fine-tune? <a href="/book/settings#notifications">Manage all email preferences</a>.</p>`,
    ),
  );
}

export async function POST(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  const claim = await resolve(token);
  if (!claim) return invalidPage();

  // The landing page's "all" button (or any caller) can widen the scope.
  let scopeAll = false;
  try {
    const form = await req.formData();
    scopeAll = String(form.get("scope") ?? "") === "all";
  } catch {
    // One-click bodies (`List-Unsubscribe=One-Click`) or empty bodies are fine.
  }

  const category: EmailCategory = scopeAll ? "all" : claim.category;
  const tableName = await getBookTableName();
  const existing = await getUserSettingsItem(tableName, claim.userId);
  const nextSettings = applyUnsubscribe(existing?.settings ?? {}, category);

  await putUserSettingsItem(tableName, {
    userId: claim.userId,
    settings: nextSettings,
    createdAt: existing?.createdAt,
  });

  const label = CATEGORY_LABELS[category];
  return htmlResponse(
    page(
      "Unsubscribed",
      `<h1>You're unsubscribed</h1>
       <p>We've stopped sending you ${label}. It may take a little while for any
       already-queued messages to clear.</p>
       <p class="muted">Changed your mind? You can re-enable emails anytime in
       <a href="/book/settings#notifications">settings</a>.</p>`,
    ),
  );
}
