import { FaqAccordion } from "@/app/book/components/site/FaqAccordion";
import { SectionHeading } from "@/app/book/components/site/SectionHeading";
import { landingContent } from "@/app/book/components/site/content";

export function FaqSection() {
  return (
    <section
      id="faq"
      className="relative mx-auto max-w-7xl px-4 pb-18 sm:px-6 sm:pb-24 lg:px-8"
    >
      <div className="grid gap-8 lg:grid-cols-[0.78fr_1.22fr]">
        <SectionHeading
          eyebrow={landingContent.faq.eyebrow}
          title={landingContent.faq.title}
          body={landingContent.faq.body}
        />

        <FaqAccordion items={landingContent.faq.items} />
      </div>
    </section>
  );
}
