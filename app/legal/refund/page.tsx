import type { Metadata } from "next";
import { PRICING } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Refund & Cancellation Policy | ChapterFlow",
  description:
    "How ChapterFlow billing, free trials, cancellation, and refunds work.",
};

export default function RefundPolicyPage() {
  return (
    <article className="prose-legal">
      <h1
        className="text-[28px] md:text-[32px] font-bold tracking-tight mb-2"
        style={{ fontFamily: "var(--font-display)", color: "var(--text-heading)" }}
      >
        Refund &amp; Cancellation Policy
      </h1>
      <p className="text-[14px] mb-10" style={{ color: "var(--text-muted)" }}>
        Effective date: June 10, 2026
      </p>

      <div className="space-y-8 text-[15px] leading-[1.75]" style={{ color: "var(--text-secondary)" }}>
        <section>
          <h2 className="text-[18px] font-semibold mb-3" style={{ color: "var(--text-heading)" }}>
            1. Free Plan
          </h2>
          <p>
            ChapterFlow is free to start. The Free plan lets you complete up to{" "}
            {PRICING.freeBookLimit} books with no payment and no credit card required.
            There is nothing to refund on the Free plan.
          </p>
        </section>

        <section>
          <h2 className="text-[18px] font-semibold mb-3" style={{ color: "var(--text-heading)" }}>
            2. Free Trial
          </h2>
          <p className="mb-3">
            New Pro subscribers start with a {PRICING.trialDays}-day free trial. A valid
            payment method is required to begin the trial, but{" "}
            <strong style={{ color: "var(--text-heading)" }}>you are not charged during the trial</strong>.
          </p>
          <p>
            If you cancel before the trial ends, you will not be charged. If you do not
            cancel, your subscription begins automatically at the end of the trial and your
            payment method is charged for the plan you selected. We send a reminder email
            before your trial ends.
          </p>
        </section>

        <section>
          <h2 className="text-[18px] font-semibold mb-3" style={{ color: "var(--text-heading)" }}>
            3. Cancellation
          </h2>
          <p className="mb-3">
            You can cancel your Pro subscription at any time from{" "}
            <strong style={{ color: "var(--text-heading)" }}>Settings → Subscription</strong>, or
            through the Stripe billing portal linked there. There are no cancellation fees and
            no lock-in.
          </p>
          <p>
            When you cancel, your Pro access continues until the end of the billing period you
            have already paid for, and it is not renewed after that. You keep access to your
            account, your reading history, and any books you completed.
          </p>
        </section>

        <section>
          <h2 className="text-[18px] font-semibold mb-3" style={{ color: "var(--text-heading)" }}>
            4. Refunds
          </h2>
          <p className="mb-3">
            Because every subscriber can try ChapterFlow Pro free for {PRICING.trialDays} days
            before paying, we generally{" "}
            <strong style={{ color: "var(--text-heading)" }}>do not provide refunds</strong> for
            subscription charges after the trial ends:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong style={{ color: "var(--text-heading)" }}>Monthly plans:</strong> Cancelling
              stops future charges. The current month is not refunded; you keep Pro access until
              the end of that month.
            </li>
            <li>
              <strong style={{ color: "var(--text-heading)" }}>Annual plans:</strong> Cancelling
              stops renewal. We do not provide pro-rated refunds for the unused portion of an
              annual term; you keep Pro access until the end of the year you paid for.
            </li>
          </ul>
          <p className="mt-3">
            We may make exceptions at our discretion — for example, a duplicate charge, a clear
            billing error, or where a refund is required by applicable consumer-protection law.
            To request a refund for one of these reasons, contact us (Section 6) within 30 days
            of the charge.
          </p>
        </section>

        <section>
          <h2 className="text-[18px] font-semibold mb-3" style={{ color: "var(--text-heading)" }}>
            5. Chargebacks
          </h2>
          <p>
            If you dispute a charge with your bank or card issuer (a &quot;chargeback&quot;), your
            Pro access ends immediately while the dispute is reviewed. If you think you were
            charged in error, please contact us first — we can usually resolve it faster than a
            chargeback.
          </p>
        </section>

        <section>
          <h2 className="text-[18px] font-semibold mb-3" style={{ color: "var(--text-heading)" }}>
            6. Contact
          </h2>
          <p>
            Questions about billing, cancellation, or a refund request? Email us at{" "}
            <a href="mailto:support@chapterflow.ca" className="underline" style={{ color: "var(--accent-teal)" }}>support@chapterflow.ca</a>.
            See also our{" "}
            <a href="/legal/terms" className="underline" style={{ color: "var(--accent-teal)" }}>Terms of Service</a>{" "}
            and{" "}
            <a href="/legal/privacy" className="underline" style={{ color: "var(--accent-teal)" }}>Privacy Policy</a>.
          </p>
        </section>
      </div>
    </article>
  );
}
