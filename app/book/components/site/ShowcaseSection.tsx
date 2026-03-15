import { InteractiveShowcase } from "@/app/book/components/site/InteractiveShowcase";
import { SectionHeading } from "@/app/book/components/site/SectionHeading";
import { landingContent } from "@/app/book/components/site/content";

export function ShowcaseSection() {
  return (
    <section
      id="showcase"
      className="relative mx-auto max-w-7xl px-4 pb-18 sm:px-6 sm:pb-24 lg:px-8"
    >
      <div className="grid gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-end">
        <SectionHeading
          eyebrow={landingContent.showcase.eyebrow}
          title={landingContent.showcase.title}
          body={landingContent.showcase.body}
        />

        <div className="grid gap-3 sm:grid-cols-3">
          {landingContent.showcase.surfacePoints.map((point) => (
            <div
              key={point}
              className="cf-site-panel rounded-[22px] px-4 py-4 text-sm leading-6 text-slate-300"
            >
              {point}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-10">
        <InteractiveShowcase />
      </div>
    </section>
  );
}
