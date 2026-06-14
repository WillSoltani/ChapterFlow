import type { Metadata } from "next";
import {
  LEGAL_ENTITY_NAME,
  LEGAL_CONTACT_EMAIL,
} from "@/lib/legal-entity";

export const metadata: Metadata = {
  title: "Copyright & Takedown Policy | ChapterFlow",
  description:
    "ChapterFlow's position on copyright, fair use, and how to submit an intellectual-property takedown notice.",
};

export default function CopyrightPolicyPage() {
  return (
    <article className="prose-legal">
      <h1
        className="text-[28px] md:text-[32px] font-bold tracking-tight mb-2"
        style={{ fontFamily: "var(--font-display)", color: "var(--text-heading)" }}
      >
        Copyright &amp; Takedown Policy
      </h1>
      <p className="text-[14px] mb-10" style={{ color: "var(--text-muted)" }}>
        Effective date: June 10, 2026
      </p>

      <div className="space-y-8 text-[15px] leading-[1.75]" style={{ color: "var(--text-secondary)" }}>
        <section>
          <h2 className="text-[18px] font-semibold mb-3" style={{ color: "var(--text-heading)" }}>
            1. Original, Transformative Content
          </h2>
          <p className="mb-3">
            ChapterFlow&apos;s summaries, examples, scenarios, and quizzes are{" "}
            <strong style={{ color: "var(--text-heading)" }}>original educational works</strong> created by{" "}
            {LEGAL_ENTITY_NAME}. They are works of commentary, analysis, and study built around the ideas in
            published non-fiction books — they are not the original books and do not reproduce them.
          </p>
          <p>
            We believe this transformative, educational use is consistent with fair-dealing and fair-use
            principles. We do not publish substantial verbatim excerpts of the original works, and we design our
            materials to teach and discuss ideas rather than to substitute for reading the originals.
          </p>
        </section>

        <section>
          <h2 className="text-[18px] font-semibold mb-3" style={{ color: "var(--text-heading)" }}>
            2. Not Affiliated; Trademarks
          </h2>
          <p>
            ChapterFlow is{" "}
            <strong style={{ color: "var(--text-heading)" }}>not authorized, endorsed, licensed, or sponsored</strong>{" "}
            by the authors or publishers of any book discussed on the Service. Book titles, author names, cover
            references, and other trademarks are the property of their respective owners and are used only to
            identify the works we discuss (nominative use). Any such names are used for identification and
            commentary, not to imply endorsement.
          </p>
        </section>

        <section>
          <h2 className="text-[18px] font-semibold mb-3" style={{ color: "var(--text-heading)" }}>
            3. Submitting a Takedown Notice
          </h2>
          <p className="mb-3">
            If you are a rights holder (or authorized to act for one) and believe content on ChapterFlow infringes
            your copyright or other intellectual-property rights, email{" "}
            <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="underline" style={{ color: "var(--accent-teal)" }}>{LEGAL_CONTACT_EMAIL}</a>{" "}
            with the subject line &quot;Copyright Notice&quot; and include:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Identification of the copyrighted work or right you claim is infringed.</li>
            <li>The specific location on ChapterFlow (URL or book/chapter) of the material you want removed.</li>
            <li>Your name, organization, and contact information.</li>
            <li>A statement that you have a good-faith belief the use is not authorized by the rights holder, its agent, or the law.</li>
            <li>A statement that the information in your notice is accurate and that you are the rights holder or authorized to act on their behalf.</li>
            <li>Your physical or electronic signature.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-[18px] font-semibold mb-3" style={{ color: "var(--text-heading)" }}>
            4. How We Respond
          </h2>
          <p>
            We review every complete notice promptly and, where appropriate, remove or disable access to the
            material in question. We may contact you for clarification. We also remove user-submitted content
            (such as scenario submissions) that is reported as infringing. Repeat or bad-faith submissions of
            infringing user content may result in account suspension.
          </p>
        </section>

        <section>
          <h2 className="text-[18px] font-semibold mb-3" style={{ color: "var(--text-heading)" }}>
            5. Contact
          </h2>
          <p>
            Copyright and other intellectual-property notices:{" "}
            <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="underline" style={{ color: "var(--accent-teal)" }}>{LEGAL_CONTACT_EMAIL}</a>.
            See also our{" "}
            <a href="/legal/terms" className="underline" style={{ color: "var(--accent-teal)" }}>Terms of Service</a>.
          </p>
        </section>
      </div>
    </article>
  );
}
