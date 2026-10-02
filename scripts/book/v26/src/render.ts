/** Self-contained HTML reading pack for a chapter, in the app's order and form. Port of the W1 prototype
 *  renderer. Order: header, hook banner, Summary (depth tiers, try this now, lines worth keeping),
 *  Examples (first open, rest folded, then "Apply this week"), Quiz (first five open, rest folded),
 *  Practice (takeaway, implementation plan, review cards). */
import type { Chapter } from "./types";

type Depth = "fastRead" | "deepRead" | "fullRead";
const DEPTHS: Depth[] = ["fastRead", "deepRead", "fullRead"];
const DEPTH_LABEL: Record<Depth, string> = { fastRead: "Short", deepRead: "Standard", fullRead: "Full" };

const CSS = `
:root{--bg:#fbfaf7;--fg:#1d1d1f;--muted:#6e6e73;--card:#fff;--line:#e5e2dc;--accent:#8a5a14;--accent-bg:#fbf1df;
--ok:#1d7a3a;--ok-bg:#e6f4ea;--bad:#a32020;--bad-bg:#fbe9e9;--chip:#f0ede6}
@media (prefers-color-scheme:dark){:root{--bg:#141414;--fg:#ececec;--muted:#a1a1a6;--card:#1d1d1f;--line:#333;--accent:#e0a84f;
--accent-bg:#2b2112;--ok:#6fd08c;--ok-bg:#15301d;--bad:#ff8a8a;--bad-bg:#3a1717;--chip:#2a2a2a}}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--fg);font:17px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Georgia,serif}
.wrap{max-width:720px;margin:0 auto;padding:16px}
a{color:var(--accent)}h1{font-size:1.6rem;line-height:1.25;margin:.2em 0}h2{font-size:1.25rem;margin:1.6em 0 .5em}
h3{font-size:1.05rem;margin:1.2em 0 .4em}.muted{color:var(--muted);font-size:.9rem}
.version{border-top:3px solid var(--accent);margin-top:40px;padding-top:8px;scroll-margin-top:52px}
.vlabel{display:inline-block;background:var(--accent);color:var(--bg);font-weight:700;border-radius:8px;padding:2px 12px;font-size:1.1rem}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 16px;margin:12px 0}
.hook{background:var(--accent-bg);border-radius:14px;padding:14px 16px;margin:12px 0}
.hook p{margin:.3em 0}.hook .ci{color:var(--muted)}
.phase{font-size:.8rem;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:28px 0 6px;border-bottom:1px solid var(--line);padding-bottom:4px}
.depths{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0 10px}
.depths button{border:1px solid var(--line);background:var(--card);color:var(--fg);border-radius:999px;padding:5px 12px;font-size:.9rem;cursor:pointer}
.depths button.on{background:var(--fg);color:var(--bg);border-color:var(--fg)}
.tier{display:none}.tier.on{display:block}.tier p{margin:0 0 1em}
.try{border-left:4px solid var(--accent);padding:8px 12px;background:var(--card);border-radius:0 10px 10px 0;margin:12px 0}
blockquote{margin:8px 0;padding:6px 14px;border-left:3px solid var(--line);font-style:italic}
details{margin:8px 0}summary{cursor:pointer;color:var(--accent);font-weight:600}
.ex h4{margin:.2em 0 .4em;font-size:1rem}.ex .lbl{font-weight:600}.tags{font-size:.75rem;color:var(--muted)}
.q{margin:14px 0}.q .stem{font-weight:600;margin-bottom:6px}
.q button.ch{display:block;width:100%;text-align:left;margin:5px 0;padding:9px 12px;border-radius:10px;border:1px solid var(--line);
background:var(--card);color:var(--fg);font:inherit;font-size:.95rem;cursor:pointer}
.q button.ch.right{background:var(--ok-bg);border-color:var(--ok)}.q button.ch.wrong{background:var(--bad-bg);border-color:var(--bad)}
.q .expl{display:none;font-size:.92rem;color:var(--muted);margin-top:6px}.q.done .expl{display:block}
.rc summary{color:var(--fg);font-weight:500}.rc div{padding:6px 0 0 12px;color:var(--muted)}
.nav{position:sticky;top:0;background:var(--bg);border-bottom:1px solid var(--line);padding:8px 0;z-index:5;display:flex;gap:10px;flex-wrap:wrap;font-size:.9rem}
.box{background:var(--accent-bg);border-radius:14px;padding:12px 16px;margin:16px 0}
table{border-collapse:collapse;width:100%;font-size:.9rem}td,th{border:1px solid var(--line);padding:6px;vertical-align:top;text-align:left}
pre{white-space:pre-wrap;font-size:.85rem;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px;overflow-x:auto}
code{font-size:.85em}
`;

const JS = `
document.addEventListener('click',function(e){
 var b=e.target.closest('.depths button');
 if(b){var v=b.closest('.summary');v.querySelectorAll('.depths button').forEach(function(x){x.classList.toggle('on',x===b)});
  v.querySelectorAll('.tier').forEach(function(t){t.classList.toggle('on',t.dataset.depth===b.dataset.depth)});return;}
 var c=e.target.closest('button.ch');
 if(c){var q=c.closest('.q');if(q.classList.contains('done'))return;q.classList.add('done');
  var k=+q.dataset.key;q.querySelectorAll('button.ch').forEach(function(x,i){if(i===k)x.classList.add('right');});
  if(+c.dataset.i!==k)c.classList.add('wrong');}
});
`;

export function esc(t: string | number | null | undefined): string {
  return (t == null ? "" : String(t))
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/** Same split the app adapter uses: prose.split(/\n\n+/), trimmed, blanks dropped. */
function paras(t: string | undefined): string[] {
  return (t ?? "").split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
}

function ptags(t: string | undefined): string {
  return paras(t).map((p) => `<p>${esc(p.replace(/\s+/g, " "))}</p>`).join("");
}

function words(t: string | undefined): number {
  return (t ?? "").split(/\s+/).filter(Boolean).length;
}

export function page(title: string, body: string): string {
  return (
    `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>${esc(title)}</title><style>${CSS}</style></head>` +
    `<body><div class="wrap">${body}</div><script>${JS}</script></body></html>`
  );
}

export interface RenderOpts {
  label?: string;
  bookLine?: string;
  defaultDepth?: Depth;
  uid?: string;
  newReaderQuestions?: number;
}

export function renderChapter(c: Chapter & { number?: number; readingTimeMinutes?: number }, opts: RenderOpts = {}): string {
  const { label = "", bookLine = "", defaultDepth = "fullRead", uid = "v", newReaderQuestions = 5 } = opts;
  const b: Partial<Chapter["breakdown"]> = c.breakdown ?? {};
  const rt = c.readingTimeMinutes || Math.max(1, Math.round(words(b.fullRead) / 230));
  const out: string[] = [`<section class="version" id="${esc(uid)}">`];
  if (label) out.push(`<span class="vlabel">${esc(label)}</span>`);
  if (bookLine) out.push(`<div class="muted" style="margin-top:6px">${esc(bookLine)}</div>`);
  out.push(`<h1>Chapter ${esc(c.number)}: ${esc(c.title)}</h1><div class="muted">${esc(rt)} min read</div>`);
  out.push(`<div class="hook"><p><b>${esc(c.hook)}</b></p><p class="ci">${esc(c.counterintuition)}</p></div>`);

  // Summary
  out.push('<div class="phase">1 · Summary</div><div class="summary">');
  out.push(
    '<div class="depths">' +
      DEPTHS.map((d) => `<button data-depth="${d}" class="${d === defaultDepth ? "on" : ""}">${DEPTH_LABEL[d]} · ${words(b[d])} words</button>`).join("") +
      "</div>",
  );
  for (const d of DEPTHS) out.push(`<div class="tier ${d === defaultDepth ? "on" : ""}" data-depth="${d}">${ptags(b[d])}</div>`);
  out.push("</div>");
  if (c.tryThisNow) out.push(`<div class="try"><div class="muted">TRY THIS NOW</div>${esc(c.tryThisNow)}</div>`);
  if (c.memorableLines?.length) {
    out.push(
      "<h3>Lines worth keeping</h3>" +
        c.memorableLines.map((m) => `<blockquote>“${esc((m.text ?? "").trim().replace(/^"+|"+$/g, ""))}”</blockquote>`).join(""),
    );
  }

  // Examples
  const exs = c.examples ?? [];
  out.push('<div class="phase">2 · Examples</div>');
  const exHtml = (e: Chapter["examples"][number]) =>
    `<div class="card ex"><h4>${esc(e.title)}</h4><div class="tags">${esc((e.tags ?? []).join(", "))}</div>` +
    `<p>${esc(e.scenario)}</p><p><span class="lbl">What to do: </span>${esc(e.whatToDo)}</p>` +
    `<p><span class="lbl">Why it matters: </span>${esc(e.whyItMatters)}</p></div>`;
  if (exs.length) {
    out.push(exHtml(exs[0]));
    if (exs.length > 1) {
      out.push(`<details><summary>Show ${exs.length - 1} more example${exs.length > 2 ? "s" : ""}</summary>${exs.slice(1).map(exHtml).join("")}</details>`);
    }
  }
  const ip: Partial<Chapter["implementationPlan"]> = c.implementationPlan ?? {};
  const plans = ip.ifThenPlans ?? [];
  if (plans.length) {
    out.push("<h3>Apply this week</h3>" + plans.map((p) => `<div class="card"><b>${esc(p.context)}</b> ${esc(p.plan)}</div>`).join(""));
  }

  // Quiz
  const qs = c.quiz?.questions ?? [];
  const nq = newReaderQuestions;
  out.push(
    `<div class="phase">3 · Quiz</div><div class="muted">A new reader answers questions 1–${Math.min(nq, qs.length)}. Tap a choice to see the answer.</div>`,
  );
  const qHtml = (i: number, q: Chapter["quiz"]["questions"][number]) => {
    const chs = (q.choices ?? []).map((x, j) => `<button class="ch" data-i="${j}">${esc(x)}</button>`).join("");
    const key = Number.isInteger(q.correctIndex) ? q.correctIndex : -1;
    return `<div class="q" data-key="${key}"><div class="stem">${i + 1}. ${esc(q.prompt)}</div>${chs}<div class="expl">${esc(q.explanation)}</div></div>`;
  };
  out.push(...qs.slice(0, nq).map((q, i) => qHtml(i, q)));
  if (qs.length > nq) {
    out.push(`<details><summary>Questions ${nq + 1}–${qs.length} (other reading modes)</summary>${qs.map((q, i) => (i >= nq ? qHtml(i, q) : "")).join("")}</details>`);
  }

  // Practice
  out.push('<div class="phase">4 · Practice</div>');
  if (c.keyTakeaway) out.push(`<div class="card"><div class="muted">THE ONE TAKEAWAY</div>${esc(c.keyTakeaway)}</div>`);
  if (Object.keys(ip).length) {
    out.push(
      '<div class="card"><div class="muted">IMPLEMENTATION PLAN</div>' +
        `<p><b>Core skill:</b> ${esc(ip.coreSkill)}</p>` +
        plans.map((p) => `<p><b>If</b> ${esc(p.context)} <b>→</b> ${esc(p.plan)}</p>`).join("") +
        `<p><b>24-hour challenge:</b> ${esc(ip.twentyFourHourChallenge)}</p>` +
        `<p><b>Weekly practice:</b> ${esc(ip.weeklyPractice)}</p></div>`,
    );
  }
  if (c.reviewCards?.length) {
    out.push(
      "<h3>Review cards</h3>" +
        c.reviewCards.map((r) => `<details class="rc"><summary>${esc(r.front)}</summary><div>${esc(r.back)}</div></details>`).join(""),
    );
  }
  out.push("</section>");
  return out.join("\n");
}
