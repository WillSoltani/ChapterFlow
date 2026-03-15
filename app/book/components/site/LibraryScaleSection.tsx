import Image from "next/image";
import { SectionHeading } from "@/app/book/components/site/SectionHeading";
import { landingContent } from "@/app/book/components/site/content";

export function LibraryScaleSection() {
  return (
    <section className="relative mx-auto max-w-7xl px-4 pb-18 sm:px-6 sm:pb-24 lg:px-8">
      <div className="grid gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
        <div>
          <SectionHeading
            eyebrow={landingContent.scale.eyebrow}
            title={landingContent.scale.title}
            body={landingContent.scale.body}
          />

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <article className="cf-site-panel rounded-[30px] p-5">
              <p className="text-xs uppercase tracking-[0.22em] text-cyan-100/72">
                {landingContent.scale.statLabel}
              </p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-50">
                {landingContent.scale.statValue}
              </p>
            </article>

            <article className="cf-site-panel rounded-[30px] p-5">
              <p className="text-xs uppercase tracking-[0.22em] text-cyan-100/72">
                {landingContent.scale.companionLabel}
              </p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-50">
                {landingContent.scale.companionValue}
              </p>
            </article>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {landingContent.scale.categories.map((category) => (
              <span
                key={category}
                className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-slate-300"
              >
                {category}
              </span>
            ))}
          </div>
        </div>

        <div className="cf-site-panel-strong rounded-[34px] p-5 sm:p-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-cyan-100/72">
                Shelf preview
              </p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">
                A growing library built for serious readers.
              </h3>
            </div>
            <p className="hidden text-sm text-slate-400 sm:block">
              More titles, same guided reading system.
            </p>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {landingContent.scale.shelf.map((book) => (
              <article
                key={book.title}
                className="cf-site-hover rounded-[26px] border border-white/10 bg-white/[0.04] p-3"
              >
                <Image
                  src={book.cover}
                  alt={`${book.title} cover`}
                  width={160}
                  height={220}
                  className="h-auto w-full rounded-[18px]"
                />
                <p className="mt-3 text-sm font-medium text-slate-100">{book.title}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
