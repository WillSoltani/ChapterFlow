import { ArrowRight } from "lucide-react";
import { AUTH_LOGIN_BOOK_URL } from "@/app/_lib/chapterflow-brand";
import { FREE_OFFER_LABEL } from "@/lib/pricing";

/** The landing page's quiet closing invitation. The shared footer follows it. */
export function RecallClose() {
  return (
    <section
      data-public-sticky-cta-suppress
      aria-labelledby="recall-close-headline"
      className="relative w-full overflow-hidden px-6 py-32 sm:px-10 sm:py-40 lg:px-16 lg:py-48"
      style={{ background: "transparent" }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 -z-0 h-[28rem] w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(closest-side, var(--cf-recall-bloom), transparent 70%)",
        }}
      />

      <div className="relative mx-auto max-w-[46rem] text-center">
        <h2
          id="recall-close-headline"
          className="cf-fade-up font-(family-name:--font-display) font-bold leading-[0.95] tracking-[-0.045em] text-balance"
          style={{
            color: "var(--cf-recall-ink)",
            fontSize: "clamp(2.5rem, 5.6vw, 4.75rem)",
            animationDelay: "0ms",
          }}
        >
          Read it once. Keep it for good.
        </h2>

        <p
          className="cf-fade-up mx-auto mt-7 max-w-[40ch] text-[1.0625rem] leading-relaxed sm:text-[1.1875rem]"
          style={{ color: "var(--cf-recall-ink-soft)", animationDelay: "55ms" }}
        >
          Start with {FREE_OFFER_LABEL}, no card. From here on, what you read stays
          with you.
        </p>

        <div
          className="cf-fade-up mt-11 flex justify-center"
          style={{ animationDelay: "110ms" }}
        >
          <a
            href={AUTH_LOGIN_BOOK_URL}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-9 py-4 text-[0.9375rem] font-semibold transition-[transform,filter,box-shadow] duration-150 ease-out hover:brightness-105 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            style={{
              background: "var(--cf-recall-accent)",
              color: "var(--cf-recall-bg)",
              boxShadow: "0 14px 40px -12px var(--cf-recall-glow)",
              // @ts-expect-error -- CSS custom property for the focus ring color
              "--tw-ring-color": "var(--cf-recall-accent)",
            }}
          >
            Start your first book
            <ArrowRight size={17} strokeWidth={2.25} aria-hidden="true" />
          </a>
        </div>
      </div>
    </section>
  );
}
