import { SectionHeading } from "@/app/book/components/site/SectionHeading";
import { landingContent } from "@/app/book/components/site/content";

export function HowItWorksSection() {
  return (
    <section
      id="how-it-works"
      className="relative mx-auto max-w-7xl px-4 pb-18 sm:px-6 sm:pb-24 lg:px-8"
    >
      <SectionHeading
        eyebrow={landingContent.howItWorks.eyebrow}
        title={landingContent.howItWorks.title}
        body={landingContent.howItWorks.body}
      />

      <div className="relative mt-10">
        <div className="absolute left-[8.5%] right-[8.5%] top-9 hidden h-px bg-[linear-gradient(90deg,rgba(56,189,248,0.0),rgba(56,189,248,0.35),rgba(94,234,212,0.35),rgba(56,189,248,0.0))] lg:block" />

        <div className="grid gap-4 lg:grid-cols-4">
          {landingContent.howItWorks.steps.map((step) => (
            <article
              key={step.number}
              className="cf-site-panel cf-site-hover relative rounded-[30px] p-5"
            >
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-300/18 bg-[linear-gradient(135deg,rgba(56,189,248,0.16),rgba(94,234,212,0.10))] text-lg font-semibold text-cyan-50">
                {step.number}
              </span>
              <h3 className="mt-5 text-xl font-semibold text-slate-50">{step.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-300">{step.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
