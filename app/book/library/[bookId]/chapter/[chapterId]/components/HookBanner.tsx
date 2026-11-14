type HookLeadProps = {
  hook: string;
  counterintuition?: string | undefined;
};

/** The chapter's hook, set as the lead of the page: same column as the prose,
 *  a slightly larger serif, no box. It is content, not chrome, so it scrolls
 *  away with the text. The counterintuition follows at body size and is the
 *  first line of ordinary reading text. */
export function HookLead({ hook, counterintuition }: HookLeadProps) {
  return (
    <div className="cr-reading-content cr-hook-lead space-y-5">
      <p className="text-pretty text-[1.15em] leading-[1.5] text-(--cr-text-heading) sm:text-[1.2em]">
        {hook}
      </p>
      {counterintuition ? <p className="text-(--cr-text-primary)">{counterintuition}</p> : null}
    </div>
  );
}
