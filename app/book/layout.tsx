import type { Metadata } from "next";
import {
  CHAPTERFLOW_NAME,
  CHAPTERFLOW_TAGLINE,
  getChapterFlowAppUrl,
} from "@/app/_lib/chapterflow-brand";
import { BookProviders } from "./providers";
import { TokenExpiryGuard } from "@/components/auth/TokenExpiryGuard";
import { MotionProvider } from "@/components/MotionProvider";

export const metadata: Metadata = {
  title: {
    default: CHAPTERFLOW_NAME,
    template: `%s | ${CHAPTERFLOW_NAME}`,
  },
  description: CHAPTERFLOW_TAGLINE,
  metadataBase: new URL(getChapterFlowAppUrl()),
  openGraph: {
    title: CHAPTERFLOW_NAME,
    description: CHAPTERFLOW_TAGLINE,
    url: getChapterFlowAppUrl(),
    siteName: CHAPTERFLOW_NAME,
    type: "website",
  },
};

export default function BookLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MotionProvider featureMode="compatible">
      <BookProviders>
        {children}
        <TokenExpiryGuard />
        {/* Color-blind simulation SVG filters moved to the root layout
            (app/layout.tsx) so every route gets them, not just /book. */}
      </BookProviders>
    </MotionProvider>
  );
}
