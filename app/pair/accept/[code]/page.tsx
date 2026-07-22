import type { Metadata } from "next";
import { Link2 } from "lucide-react";
import { AppLinkInterstitial } from "@/components/applink/AppLinkInterstitial";

export const metadata: Metadata = {
  title: "Accept your invite",
  robots: { index: false, follow: false },
};

/**
 * Web fallback for the `/pair/accept/*` Universal Link (Lane S pairing codes).
 * With the iOS app installed, this path opens the app directly; without it, the
 * friend lands here. The code is carried straight through to the existing
 * web pairing flow (`/book/pair-accept`), so no one is stranded — and a manual
 * code-entry link covers the case where the deep link arrived without a code.
 */
export default async function PairAcceptFallbackPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const normalized = code.trim().toUpperCase();
  const continueHref = normalized
    ? `/book/pair-accept?code=${encodeURIComponent(normalized)}`
    : "/book/pair-accept";

  return (
    <AppLinkInterstitial
      icon={<Link2 className="h-7 w-7" />}
      eyebrow="You've been paired"
      title="Accept your ChapterFlow invite"
      description="Someone shared a pairing link with you. Continue on the web to accept it now, or open the ChapterFlow app if you have it installed."
      primaryHref={continueHref}
      primaryLabel="Continue on the web"
      secondaryHref="/book/pair-accept"
      secondaryLabel="Enter a code manually"
    >
      {normalized ? (
        <p className="mb-6 rounded-xl border border-(--cf-border) bg-(--cf-surface-muted) px-4 py-3 font-mono text-cf-body tracking-widest text-(--cf-text-1)">
          {normalized}
        </p>
      ) : null}
    </AppLinkInterstitial>
  );
}
