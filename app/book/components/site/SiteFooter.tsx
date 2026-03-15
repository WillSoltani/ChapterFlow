import Link from "next/link";
import { ChapterFlowMark } from "@/app/book/components/ChapterFlowMark";
import { landingContent } from "@/app/book/components/site/content";

type SiteFooterProps = {
  signInHref: string;
  appHref: string;
};

export function SiteFooter({ signInHref, appHref }: SiteFooterProps) {
  return (
    <footer className="relative border-t border-white/10 bg-[#02050e]/88">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1.24fr_0.76fr_0.76fr] lg:px-8">
        <div>
          <a href="#top" className="inline-block">
            <ChapterFlowMark compact />
          </a>
          <p className="mt-4 max-w-sm text-sm leading-7 text-slate-400">
            {landingContent.footer.blurb}
          </p>
        </div>

        <div>
          <p className="text-sm font-semibold text-slate-200">Product</p>
          <div className="mt-3 space-y-2 text-sm text-slate-400">
            <a href="#features" className="block transition hover:text-slate-200">
              Features
            </a>
            <a href="#how-it-works" className="block transition hover:text-slate-200">
              How it works
            </a>
            <a href="#pricing" className="block transition hover:text-slate-200">
              Pricing
            </a>
            <a href="#faq" className="block transition hover:text-slate-200">
              FAQ
            </a>
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold text-slate-200">Access</p>
          <div className="mt-3 space-y-2 text-sm text-slate-400">
            <Link href={signInHref} className="block transition hover:text-slate-200">
              Log in
            </Link>
            <Link href={signInHref} className="block transition hover:text-slate-200">
              Start free
            </Link>
            <Link href={appHref} className="block transition hover:text-slate-200">
              Open app
            </Link>
          </div>
        </div>
      </div>

      <div className="border-t border-white/8">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-4 text-xs text-slate-500 sm:px-6 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <p>© 2026 ChapterFlow. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <span>Privacy</span>
            <span>Terms</span>
            <span>Contact</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
