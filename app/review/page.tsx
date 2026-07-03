import type { Metadata } from "next";
import { Star } from "lucide-react";
import { AppLinkInterstitial } from "@/components/applink/AppLinkInterstitial";

export const metadata: Metadata = {
  title: "Leave a review",
  robots: { index: false, follow: false },
};

/**
 * Web fallback for the `/review` Universal Link. In the iOS app this deep-links
 * into the in-app review prompt; on the web there is no native review surface,
 * so this branded interstitial thanks the reader and points them back into their
 * library (and will carry the App Store review link once the app ships).
 */
export default function ReviewFallbackPage() {
  return (
    <AppLinkInterstitial
      icon={<Star className="h-7 w-7" />}
      eyebrow="Thanks for reading"
      title="Rate ChapterFlow"
      description="Reviews live in the ChapterFlow iOS app. Open the app to leave a rating, or head back to your library to keep learning."
      primaryHref="/book"
      primaryLabel="Back to my library"
    />
  );
}
