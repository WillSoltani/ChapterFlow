import type { Metadata } from "next";
import {
  CHAPTERFLOW_NAME,
  CHAPTERFLOW_TAGLINE,
  getChapterFlowSiteUrl,
} from "@/app/_lib/chapterflow-brand";
import { Navbar } from "@/app/_landing/Navbar";
import { Hero } from "@/app/_landing/Hero";
import { ProductShowcase } from "@/app/_landing/ProductShowcase";
import { DepthModes } from "@/app/_landing/DepthModes";
import { Features } from "@/app/_landing/Features";
import { HowItWorks } from "@/app/_landing/HowItWorks";
import { LibrarySection } from "@/app/_landing/LibrarySection";
import { Pricing } from "@/app/_landing/Pricing";
import { FAQ } from "@/app/_landing/FAQ";
import { FinalCTA } from "@/app/_landing/FinalCTA";
import { Footer } from "@/app/_landing/Footer";

export const metadata: Metadata = {
  title: `${CHAPTERFLOW_NAME} — Read Deeper. Understand More.`,
  description: CHAPTERFLOW_TAGLINE,
  metadataBase: new URL(getChapterFlowSiteUrl()),
  openGraph: {
    title: CHAPTERFLOW_NAME,
    description: CHAPTERFLOW_TAGLINE,
    url: getChapterFlowSiteUrl(),
    siteName: CHAPTERFLOW_NAME,
    type: "website",
  },
};

export default function Home() {
  return (
    <div className="bg-[#070b18] min-h-screen overflow-x-hidden">
      <Navbar />
      <Hero />
      <ProductShowcase />
      <DepthModes />
      <Features />
      <HowItWorks />
      <LibrarySection />
      <Pricing />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  );
}
