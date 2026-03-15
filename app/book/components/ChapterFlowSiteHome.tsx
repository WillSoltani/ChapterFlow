import {
  buildChapterFlowAppHref,
  buildChapterFlowAuthHref,
} from "@/app/_lib/chapterflow-brand";
import { ChapterFlowLandingNav } from "@/app/book/components/site/ChapterFlowLandingNav";
import { HeroSection } from "@/app/book/components/site/HeroSection";
import { ShowcaseSection } from "@/app/book/components/site/ShowcaseSection";
import { FeaturesSection } from "@/app/book/components/site/FeaturesSection";
import { HowItWorksSection } from "@/app/book/components/site/HowItWorksSection";
import { LibraryScaleSection } from "@/app/book/components/site/LibraryScaleSection";
import { PricingSection } from "@/app/book/components/site/PricingSection";
import { FaqSection } from "@/app/book/components/site/FaqSection";
import { FinalCtaSection } from "@/app/book/components/site/FinalCtaSection";
import { SiteFooter } from "@/app/book/components/site/SiteFooter";

export function ChapterFlowSiteHome() {
  const signInHref = buildChapterFlowAuthHref(
    `/auth/login?returnTo=${encodeURIComponent(buildChapterFlowAppHref("/book"))}`
  );
  const appHref = buildChapterFlowAppHref("/book");

  return (
    <main
      id="top"
      className="chapterflow-site relative min-h-screen overflow-x-hidden bg-[rgb(var(--cf-site-bg))] text-slate-100"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(960px_circle_at_12%_4%,rgba(56,189,248,0.17),transparent_44%),radial-gradient(840px_circle_at_82%_8%,rgba(20,184,166,0.14),transparent_40%),radial-gradient(760px_circle_at_50%_100%,rgba(251,191,36,0.12),transparent_34%)]" />
      <div className="cf-site-grid pointer-events-none absolute inset-0 opacity-[0.22]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),transparent)]" />

      <ChapterFlowLandingNav signInHref={signInHref} />
      <HeroSection signInHref={signInHref} />
      <ShowcaseSection />
      <FeaturesSection />
      <HowItWorksSection />
      <LibraryScaleSection />
      <PricingSection signInHref={signInHref} />
      <FaqSection />
      <FinalCtaSection signInHref={signInHref} />
      <SiteFooter signInHref={signInHref} appHref={appHref} />
    </main>
  );
}
