/** The pick page: one self-contained HTML file per chapter with five versions of each component, a Pick button on each,
 *  a notes box per component and a "Copy my picks" button that puts a short text block on the clipboard. Picks and notes
 *  also persist in the browser's localStorage so a reload keeps them. */
import { esc, page, renderChapter } from "./render";
import type { Chapter } from "./types";
import { COMPONENTS, type Component, type VariantsRun } from "./variants";

export interface PackMeta {
  bookId: string;
  title: string;
  author: string;
  /** The current tool's chapter, folded at the bottom for comparison. */
  reference?: Chapter;
}

const TITLES: Record<Component, string> = {
  summary: "Summary",
  examples: "Examples",
  quiz: "Quiz",
  cards: "Review cards",
  practice: "Practice plan",
};

const EXTRA_CSS = `
<style>
.intro{background:var(--accent-bg);border-radius:14px;padding:12px 16px;margin:12px 0}
.vcard{background:var(--card);border:2px solid var(--line);border-radius:14px;padding:12px 14px;margin:14px 0;scroll-margin-top:60px}
.vcard.picked{border-color:var(--ok);background:var(--ok-bg)}
.vhead{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:6px}
.vhead .vl{font-weight:700;font-size:1.05rem}.vhead .ap{color:var(--muted);font-size:.9rem}
button.pick{border:1px solid var(--fg);background:var(--card);color:var(--fg);border-radius:999px;padding:6px 14px;font:inherit;font-size:.9rem;cursor:pointer;white-space:nowrap}
.vcard.picked button.pick{background:var(--ok);border-color:var(--ok);color:#fff}
.field{margin:8px 0}.field .lbl{display:block;font-size:.75rem;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.flag{background:var(--bad-bg);color:var(--bad);border-radius:10px;padding:8px 12px;font-size:.9rem;margin:8px 0}
.flag b{display:block}
textarea.notes{width:100%;min-height:72px;border:1px solid var(--line);border-radius:10px;padding:10px;font:inherit;font-size:.95rem;background:var(--card);color:var(--fg);resize:vertical}
.lesson{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px 16px;margin:12px 0}
.lesson .big{font-size:1.15rem;font-weight:600;margin:4px 0 8px}
.bar{position:sticky;bottom:0;background:var(--bg);border-top:1px solid var(--line);padding:10px 0;margin-top:30px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;z-index:6}
button.copy{border:0;background:var(--fg);color:var(--bg);border-radius:10px;padding:10px 16px;font:inherit;font-weight:600;cursor:pointer}
.bar .st{color:var(--muted);font-size:.9rem}
pre.out{display:none}pre.out.on{display:block}
.toc{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0;font-size:.9rem}
.toc a{text-decoration:none;border:1px solid var(--line);border-radius:999px;padding:4px 10px}
.rc summary{color:var(--fg);font-weight:500}.rc div{padding:6px 0 0 12px;color:var(--muted)}
</style>`;

const EXTRA_JS = `
<script>
(function(){
 var KEY=document.body.dataset.pickkey||'v26-variants';
 var comps=JSON.parse(document.body.dataset.comps||'[]');
 var state={picks:{},notes:{}};
 try{var saved=localStorage.getItem(KEY);if(saved)state=JSON.parse(saved);}catch(e){}
 function save(){try{localStorage.setItem(KEY,JSON.stringify(state));}catch(e){}}
 function paint(){
  document.querySelectorAll('.vcard').forEach(function(c){c.classList.toggle('picked',state.picks[c.dataset.comp]===c.dataset.label);});
  document.querySelectorAll('textarea.notes').forEach(function(t){if(state.notes[t.dataset.comp]!==undefined&&t.value!==state.notes[t.dataset.comp])t.value=state.notes[t.dataset.comp];});
  var n=Object.keys(state.picks).length;var st=document.getElementById('st');if(st)st.textContent=n+' of '+comps.length+' picked';
 }
 document.addEventListener('click',function(e){
  var b=e.target.closest('button.pick');if(b){var c=b.closest('.vcard');
   if(state.picks[c.dataset.comp]===c.dataset.label)delete state.picks[c.dataset.comp];else state.picks[c.dataset.comp]=c.dataset.label;
   save();paint();return;}
  if(e.target.closest('button.copy')){
   var lines=['PICKS '+(document.body.dataset.book||'')+' '+(document.body.dataset.chapter||'')];
   comps.forEach(function(k){lines.push(k+': '+(state.picks[k]||'-'));});
   comps.concat(['general']).forEach(function(k){var t=(state.notes[k]||'').trim();if(t)lines.push('notes '+k+': '+t.replace(/\\s*\\n+\\s*/g,' / '));});
   var text=lines.join('\\n');var out=document.getElementById('out');out.textContent=text;out.classList.add('on');
   var st=document.getElementById('st');
   if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(text).then(function(){st.textContent='Copied. Paste it into the chat.';},function(){st.textContent='Copy the text below.';});}
   else st.textContent='Copy the text below.';
  }
 });
 document.addEventListener('input',function(e){var t=e.target;if(t.matches&&t.matches('textarea.notes')){state.notes[t.dataset.comp]=t.value;save();}});
 paint();
})();
</script>`;

const field = (label: string, text: string | undefined): string => `<div class="field"><span class="lbl">${esc(label)}</span>${esc(text ?? "")}</div>`;
const paras = (t: string): string =>
  t
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${esc(p.replace(/\s+/g, " "))}</p>`)
    .join("");
const words = (t: string): number => t.trim().split(/\s+/).filter(Boolean).length;

function card(comp: Component, label: string, approach: string, body: string): string {
  return (
    `<div class="vcard" data-comp="${comp}" data-label="${esc(label)}" id="${comp}-${esc(label)}">` +
    `<div class="vhead"><div><span class="vl">${esc(label)}</span> <span class="ap">· ${esc(approach)}</span></div><button class="pick">Pick ${esc(label)}</button></div>` +
    body +
    "</div>"
  );
}

function summaryCards(run: VariantsRun): string {
  return run.summary
    .map((v) => {
      const flags = [
        ...run.factcheck.issues.filter((i) => i.variant === v.label).map((i) => `<div class="flag"><b>Fact check · ${esc(i.kind)} in ${esc(i.field)} (${esc(i.verdict)})</b>“${esc(i.chapterText)}” — source: ${esc(i.sourceText)}${i.fix ? ` — fix: ${esc(i.fix)}` : ""}</div>`),
        ...run.factcheck.det.filter((i) => i.variant === v.label).map((i) => `<div class="flag"><b>Check</b>${esc(i.text)}</div>`),
      ].join("");
      const body =
        `<div class="hook"><p><b>${esc(v.hook)}</b></p><p class="ci">${esc(v.counterintuition)}</p></div>` +
        `<div class="field"><span class="lbl">Summary · ${words(v.summary)} words</span>${paras(v.summary)}</div>` +
        `<div class="try"><div class="muted">TRY THIS NOW</div>${esc(v.tryThisNow)}</div>` +
        `<blockquote>${esc(v.memorableLine)}</blockquote>` +
        flags;
      return card("summary", v.label, v.approach, body);
    })
    .join("");
}

function examplesCards(run: VariantsRun): string {
  return run.examples
    .map((v) =>
      card(
        "examples",
        v.label,
        v.approach,
        v.examples
          .map(
            (e) =>
              `<div class="card ex"><h4>${esc(e.title)}</h4><div class="tags">${esc((e.tags ?? []).join(", "))}</div><p>${esc(e.scenario)}</p>` +
              `<p><span class="lbl">What to do: </span>${esc(e.whatToDo)}</p><p><span class="lbl">Why it matters: </span>${esc(e.whyItMatters)}</p></div>`,
          )
          .join(""),
      ),
    )
    .join("");
}

function quizCards(run: VariantsRun): string {
  return run.quiz
    .map((v) =>
      card(
        "quiz",
        v.label,
        v.approach,
        v.questions
          .map(
            (q, i) =>
              `<div class="q" data-key="${q.correctIndex}"><div class="stem">${i + 1}. ${esc(q.prompt)}</div>` +
              q.choices.map((x, j) => `<button class="ch" data-i="${j}">${esc(x)}</button>`).join("") +
              `<div class="expl">${esc(q.explanation)}</div></div>`,
          )
          .join(""),
      ),
    )
    .join("");
}

function cardsCards(run: VariantsRun): string {
  return run.cards
    .map((v) =>
      card(
        "cards",
        v.label,
        v.approach,
        v.cards.map((c) => `<details class="rc"><summary>${esc(c.front)}</summary><div>${esc(c.back)} <span class="tags">(${esc(c.difficulty)})</span></div></details>`).join(""),
      ),
    )
    .join("");
}

function practiceCards(run: VariantsRun): string {
  return run.practice
    .map((v) =>
      card(
        "practice",
        v.label,
        v.approach,
        field("Core skill", v.coreSkill) +
          v.ifThenPlans.map((p) => `<div class="card"><b>${esc(p.context)}</b> ${esc(p.plan)}</div>`).join("") +
          field("24-hour challenge", v.twentyFourHourChallenge) +
          field("Weekly practice", v.weeklyPractice),
      ),
    )
    .join("");
}

const RENDER: Record<Component, (run: VariantsRun) => string> = {
  summary: summaryCards,
  examples: examplesCards,
  quiz: quizCards,
  cards: cardsCards,
  practice: practiceCards,
};

function lessonBlock(run: VariantsRun): string {
  const l = run.lesson;
  const others = run.lessons
    .map((c, i) => ({ c, i }))
    .filter(({ i }) => i !== run.lessonIndex)
    .map(({ c, i }) => `<div class="card"><b>${i + 1}. ${esc(c.lesson)}</b><p class="muted">Wrong belief: ${esc(c.wrongBelief)}</p><p class="muted">${esc(c.whyThisOne)}</p></div>`)
    .join("");
  return (
    `<div class="phase">The lesson (candidate ${run.lessonIndex + 1} of ${run.lessons.length})</div>` +
    `<div class="lesson"><div class="big">${esc(l.lesson)}</div>` +
    `<p><b>Wrong belief it corrects:</b> ${esc(l.wrongBelief)}</p><p><b>Key phrase:</b> ${esc(l.keyPhrase)} · <b>Hook question:</b> ${esc(l.hookQuestion)}</p>` +
    `<p class="muted">${esc(l.whyThisOne)}</p>` +
    (l.evidence ?? []).map((e) => `<blockquote>${esc(e)}</blockquote>`).join("") +
    "</div>" +
    (others ? `<details><summary>The other ${run.lessons.length - 1} candidate lessons (say "use lesson 3" to redo the page on one of them)</summary>${others}</details>` : "")
  );
}

export function renderVariantsPage(run: VariantsRun, meta: PackMeta): string {
  const n = run.chapter;
  const chapterName = `ch${String(n).padStart(2, "0")}`;
  const present = COMPONENTS.filter((c) => run[c].length > 0);
  const out: string[] = [EXTRA_CSS];
  out.push(`<div class="muted">${esc(meta.title)} by ${esc(meta.author)}</div><h1>Chapter ${n}: ${esc(run.chapterTitle)}</h1>`);
  out.push(
    `<div class="intro">Five versions of each part, labelled A to E. Each says which approach it takes. ` +
      `Pick one per part (tap <b>Pick</b>), write what is wrong or right in the notes box, then tap <b>Copy my picks</b> at the bottom and paste the text into the chat. ` +
      `Quiz choices reveal the answer when tapped.</div>`,
  );
  out.push(`<div class="toc">${present.map((c) => `<a href="#${c}">${esc(TITLES[c])}</a>`).join("")}${meta.reference ? '<a href="#reference">Current tool’s chapter</a>' : ""}</div>`);
  out.push(lessonBlock(run));
  for (const c of COMPONENTS) {
    out.push(`<div class="phase" id="${c}">${esc(TITLES[c])} · pick one</div>`);
    if (run[c].length === 0) {
      out.push(`<div class="muted">Not generated yet.</div>`);
      continue;
    }
    if (c === "summary" && run.factcheck.issues.length === 0 && run.factcheck.det.length === 0) {
      out.push(`<div class="muted">Fact check against the source: nothing flagged in any version.</div>`);
    }
    out.push(RENDER[c](run));
    out.push(`<textarea class="notes" data-comp="${c}" placeholder="Notes on the ${TITLES[c].toLowerCase()}: what works, what is wrong, what you would change"></textarea>`);
  }
  out.push('<div class="phase">General notes</div><textarea class="notes" data-comp="general" placeholder="Anything about the chapter as a whole"></textarea>');
  if (meta.reference) {
    out.push(`<details id="reference"><summary>The current tool’s chapter ${n}, for comparison</summary>`);
    out.push(renderChapter({ ...meta.reference, number: n }, { label: "Current tool", bookLine: `${meta.title} by ${meta.author}`, uid: `ref${n}` }));
    out.push("</details>");
  }
  out.push(
    `<div class="bar"><button class="copy">Copy my picks</button><span class="st" id="st"></span></div>` +
      `<pre class="out" id="out"></pre>` +
      `<div class="muted" style="margin:8px 0 40px">Spend on this page: $${run.spend.toFixed(2)} API-equivalent.</div>`,
  );
  const body = out.join("\n") + EXTRA_JS;
  const html = page(`${meta.title}: chapter ${n} variants`, body);
  // The body carries what the script needs; page() owns the <body> tag, so add the attributes after the fact.
  return html.replace(
    "<body>",
    `<body data-pickkey="${esc(`v26-variants-${meta.bookId}-${chapterName}`)}" data-book="${esc(meta.bookId)}" data-chapter="${chapterName}" data-comps='${JSON.stringify(present)}'>`,
  );
}
