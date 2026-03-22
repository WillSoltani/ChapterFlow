import type { Metadata } from "next";
import {
  CHAPTERFLOW_NAME,
  getChapterFlowSiteUrl,
} from "@/app/_lib/chapterflow-brand";
import { Navbar } from "@/components/sections/Navbar";
import { Hero } from "@/components/sections/Hero";
import { Problem } from "@/components/sections/Problem";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { InteractiveDemo } from "@/components/sections/InteractiveDemo";
import { Library } from "@/components/sections/Library";
import { SocialProof } from "@/components/sections/SocialProof";
import { Pricing } from "@/components/sections/Pricing";
import { FinalCTA } from "@/components/sections/FinalCTA";
import { Footer } from "@/components/sections/Footer";
import { MobileStickyBar } from "@/components/landing/MobileStickyBar";

export const metadata: Metadata = {
  title: `${CHAPTERFLOW_NAME} | Stop forgetting what you read`,
  description:
    "ChapterFlow turns every non-fiction book into a guided learning loop. Read summaries, see real-world scenarios, prove retention with quizzes, and unlock the next chapter. 95+ books, free to start.",
  metadataBase: new URL(getChapterFlowSiteUrl()),
  openGraph: {
    title: `${CHAPTERFLOW_NAME} | Stop forgetting what you read`,
    description:
      "Guided reading that turns every chapter into a 20-minute learning loop. Summaries, scenarios, quizzes, and real progress. 95+ non-fiction books.",
    url: getChapterFlowSiteUrl(),
    siteName: CHAPTERFLOW_NAME,
    type: "website",
  },
};

export default function Home() {
  return (
    <div className="relative min-h-screen">
      {/* Noise texture overlay */}
      <div className="noise-overlay pointer-events-none fixed inset-0 z-0" aria-hidden />

      {/* Background gradient mesh */}
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        aria-hidden
        style={{
          background: [
            "radial-gradient(ellipse 60vw 50vw at 30% 0%, rgba(45, 212, 191, 0.06), transparent)",
            "radial-gradient(ellipse 40vw 40vw at 80% 60%, rgba(45, 212, 191, 0.03), transparent)",
            "var(--bg-base)",
          ].join(", "),
        }}
      />

      <Navbar />

      <main>
        <Hero />
        <Problem />
        <HowItWorks />
        <InteractiveDemo />
        <Library />
        <SocialProof />
        <Pricing />
        <FinalCTA />
      </main>

      <Footer />
      <MobileStickyBar />
    </div>
  );
}
