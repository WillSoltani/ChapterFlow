import { SectionHeading } from "@/app/book/components/site/SectionHeading";
import { landingContent } from "@/app/book/components/site/content";
import { cn } from "@/app/book/components/ui/cn";

export function FeaturesSection() {
  return (
    <section
      id="features"
      className="relative mx-auto max-w-7xl px-4 pb-18 sm:px-6 sm:pb-24 lg:px-8"
    >
      <SectionHeading
        eyebrow={landingContent.features.eyebrow}
        title={landingContent.features.title}
        body={landingContent.features.body}
      />

      <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {landingContent.features.items.map((feature) => {
          const Icon = feature.icon;

          return (
            <article
              key={feature.title}
              className={cn(
                "cf-site-panel cf-site-hover rounded-[30px] p-6",
                feature.span === "wide" && "md:col-span-2"
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-cyan-100/72">
                    {feature.eyebrow}
                  </p>
                  <h3 className="mt-4 text-2xl font-semibold tracking-tight text-slate-50">
                    {feature.title}
                  </h3>
                </div>

                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/18 bg-cyan-400/10 text-cyan-100">
                  <Icon className="h-5 w-5" />
                </span>
              </div>

              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
                {feature.description}
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                {feature.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-slate-300"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
