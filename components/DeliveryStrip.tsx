import { Card } from "@/components/ui/card";

type Item = { title: string; body: string };

export function DeliveryStrip({ items }: { items: Item[] }) {
  return (
    <div className="mx-auto mt-10 max-w-6xl px-6">
      <div className="grid gap-3 md:grid-cols-4">
        {items.map((x) => (
          <Card
            key={x.title}
            className="border-white/10 bg-white/5 p-4 backdrop-blur"
          >
            <p className="text-xs font-semibold text-slate-200">{x.title}</p>
            <p className="mt-2 text-xs leading-relaxed text-slate-300">
              {x.body}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}
