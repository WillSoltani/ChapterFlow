import type { Metadata } from "next";
import { Gift } from "lucide-react";
import { AppLinkInterstitial } from "@/components/applink/AppLinkInterstitial";

export const metadata: Metadata = {
  title: "You've received a gift",
  robots: { index: false, follow: false },
};

/**
 * Web fallback for the `/gift/*` Universal Link. With the iOS app installed this
 * opens the app; otherwise the recipient lands here and is handed straight to
 * the existing web gift-claim flow (`/book/gift/[code]`) with their code intact.
 */
export default async function GiftFallbackPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const normalized = code.trim();
  const continueHref = normalized
    ? `/book/gift/${encodeURIComponent(normalized)}`
    : "/book";

  return (
    <AppLinkInterstitial
      icon={<Gift className="h-7 w-7" />}
      eyebrow="You've received a gift"
      title="Someone gifted you ChapterFlow"
      description="A friend sent you a ChapterFlow gift. Continue on the web to claim it, or open the ChapterFlow app if you have it installed."
      primaryHref={continueHref}
      primaryLabel="Claim your gift"
    />
  );
}
