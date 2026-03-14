import { Card } from "@/components/ui/card";
import type { ExperienceItem } from "@/content/experience";

type Props = {
  title: string;
  items: ExperienceItem[];
};

export function ExperienceCard({ title, items }: Props) {
  return (
    <Card className="border-white/10 bg-white/5 p-6 backdrop-blur">
      <h3 className="text-base font-semibold">{title}</h3>

      <div className="mt-5 space-y-6">
        {items.map((item) => (
          <div key={`${item.org}-${item.title}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <p className="font-medium">{item.title}</p>
                <p className="text-sm text-slate-300">
                  {item.org}
                  {item.location ? ` · ${item.location}` : ""}
                </p>
              </div>

              {item.dates ? (
                <p className="text-xs text-slate-400">{item.dates}</p>
              ) : null}
            </div>

            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-300">
              {item.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Card>
  );
}
