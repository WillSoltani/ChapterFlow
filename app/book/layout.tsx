import type { Metadata } from "next";
import {
  CHAPTERFLOW_NAME,
  CHAPTERFLOW_TAGLINE,
  getChapterFlowAppUrl,
} from "@/app/_lib/chapterflow-brand";
import { BookQueryProvider } from "./providers";

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
  return <BookQueryProvider>{children}</BookQueryProvider>;
}
