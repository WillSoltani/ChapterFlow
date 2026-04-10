import type { Metadata } from "next";
import {
  CHAPTERFLOW_NAME,
  CHAPTERFLOW_TAGLINE,
  getChapterFlowAppUrl,
} from "@/app/_lib/chapterflow-brand";
import { BookQueryProvider } from "./providers";
import { TokenExpiryGuard } from "@/components/auth/TokenExpiryGuard";

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
    <BookQueryProvider>
      {children}
      <TokenExpiryGuard />
      {/* Color blind simulation SVG filters */}
      <svg aria-hidden="true" className="absolute h-0 w-0 overflow-hidden">
        <defs>
          <filter id="cf-protanopia">
            <feColorMatrix type="matrix" values="0.567,0.433,0,0,0 0.558,0.442,0,0,0 0,0.242,0.758,0,0 0,0,0,1,0" />
          </filter>
          <filter id="cf-deuteranopia">
            <feColorMatrix type="matrix" values="0.625,0.375,0,0,0 0.7,0.3,0,0,0 0,0.3,0.7,0,0 0,0,0,1,0" />
          </filter>
          <filter id="cf-tritanopia">
            <feColorMatrix type="matrix" values="0.95,0.05,0,0,0 0,0.433,0.567,0,0 0,0.475,0.525,0,0 0,0,0,1,0" />
          </filter>
        </defs>
      </svg>
    </BookQueryProvider>
  );
}
