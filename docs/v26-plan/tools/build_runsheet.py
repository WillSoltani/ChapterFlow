#!/usr/bin/env python3
"""Build docs/v26-plan/run-sheet.html from the kit files (0 model calls).

The page embeds each prompt's paste text exactly as it stands between ---PROMPT--- and ---END--- in prompts/*.md,
renders DECISIONS.md, and adds the plan overview. Re-run after editing any kit file:
    python3 docs/v26-plan/tools/build_runsheet.py && python3 docs/v26-plan/tools/build_runsheet.py --check
--check re-extracts every embedded prompt from the HTML and diffs it against the prompt files (exit 1 on any difference).
"""
import html
import json
import re
import sys
from pathlib import Path

KIT = Path(__file__).resolve().parent.parent
OUT = KIT / "run-sheet.html"

PROMPT_ORDER = [
    ("W1-prototype.md", "W1", "first"),
    ("W1b-variant.md", "W1b", "only if R1 = C"),
    ("W2-pipeline-and-book.md", "W2", "after R1 = A/B"),
    ("W2w-reader-app.md", "W2w", "with W2, only if R1-d = B/C"),
    ("W3-finish-franklin.md", "W3", "after R2 = A/B (re-run for Part B after you publish)"),
    ("W4a-second-book.md", "W4a", "after W3 Part A (you need not have published); parallel with W4b"),
    ("W4b-cleanup.md", "W4b", "after W3 Part A, parallel with W4a"),
]


def esc(s):
    return html.escape(s, quote=True)


def inline(s):
    s = esc(s)
    s = re.sub(r"`([^`]+)`", r"<code>\1</code>", s)
    s = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", s)
    s = re.sub(r"(?<![\w*])\*([^*\n]+)\*(?![\w*])", r"<em>\1</em>", s)
    return s


def md_to_html(md):
    """Minimal markdown for the kit's own files: headings, paragraphs, - lists (one level + nested), > quotes, hr."""
    out, para, lst, quote = [], [], [], []

    def flush_para():
        if para:
            out.append("<p>" + inline(" ".join(para)) + "</p>")
            para.clear()

    def flush_list():
        if lst:
            html_items, depth = [], 0
            for lvl, text in lst:
                while depth < lvl + 1:
                    html_items.append("<ul>")
                    depth += 1
                while depth > lvl + 1:
                    html_items.append("</ul>")
                    depth -= 1
                html_items.append("<li>" + inline(text) + "</li>")
            html_items.extend("</ul>" for _ in range(depth))
            out.append("".join(html_items))
            lst.clear()

    def flush_quote():
        if quote:
            out.append("<blockquote>" + inline(" ".join(quote)) + "</blockquote>")
            quote.clear()

    for raw in md.splitlines():
        line = raw.rstrip()
        m = re.match(r"^(#{1,4}) (.*)", line)
        if m:
            flush_para(); flush_list(); flush_quote()
            lvl = min(len(m.group(1)) + 1, 5)
            text = m.group(2)
            anchor = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:48]
            out.append(f'<h{lvl} id="d-{anchor}">{inline(text)}</h{lvl}>')
            continue
        if re.match(r"^---+$", line):
            flush_para(); flush_list(); flush_quote()
            out.append("<hr>")
            continue
        m = re.match(r"^(\s*)- (.*)", line)
        if m:
            flush_para(); flush_quote()
            lst.append((len(m.group(1)) // 2, m.group(2)))
            continue
        m = re.match(r"^\s*> ?(.*)", line)
        if m:
            flush_para(); flush_list()
            quote.append(m.group(1))
            continue
        if not line.strip():
            flush_para(); flush_list(); flush_quote()
            continue
        if lst and raw.startswith("  "):
            lst[-1] = (lst[-1][0], lst[-1][1] + " " + line.strip())
            continue
        para.append(line.strip())
    flush_para(); flush_list(); flush_quote()
    return "\n".join(out)


def read_prompt(path):
    text = path.read_text(encoding="utf-8")
    head, _, rest = text.partition("---PROMPT---\n")
    body, sep, _ = rest.partition("\n---END---")
    if not sep:
        raise SystemExit(f"{path.name}: missing ---PROMPT--- / ---END--- markers")
    title = head.splitlines()[0].lstrip("# ").strip()
    meta = [l[2:].strip() for l in head.splitlines() if l.startswith("- **")]
    return title, meta, body


def build():
    decisions = md_to_html((KIT / "DECISIONS.md").read_text(encoding="utf-8").split("\n", 1)[1])
    prompts_html = []
    for fname, pid, when in PROMPT_ORDER:
        title, meta, body = read_prompt(KIT / "prompts" / fname)
        meta_html = "".join(f"<li>{inline(m)}</li>" for m in meta)
        prompts_html.append(f"""
<article class="prompt" id="p-{pid}" data-id="{pid}">
  <header class="prompt-head">
    <div class="prompt-id">{pid}</div>
    <div class="prompt-title">
      <h3>{inline(title.split(' — ', 1)[-1])}</h3>
      <p class="when">Run: {esc(when)} · file <code>prompts/{esc(fname)}</code></p>
    </div>
    <label class="done"><input type="checkbox" id="done-{pid}" data-done="{pid}"> Done</label>
  </header>
  <ul class="meta">{meta_html}</ul>
  <div class="copyrow"><button type="button" class="copy" data-target="text-{pid}">Copy prompt</button><span class="copied" aria-live="polite"></span></div>
  <details>
    <summary>Show the prompt text ({len(body.split())} words)</summary>
    <pre class="prompt-text" id="text-{pid}">{esc(body)}</pre>
  </details>
</article>""")

    page = TEMPLATE.replace("{{DECISIONS}}", decisions).replace("{{PROMPTS}}", "\n".join(prompts_html))
    OUT.write_text(page, encoding="utf-8")
    print(f"wrote {OUT} ({len(page)} bytes, {len(PROMPT_ORDER)} prompts)")


def check():
    page = OUT.read_text(encoding="utf-8")
    bad = 0
    for fname, pid, _ in PROMPT_ORDER:
        _, _, body = read_prompt(KIT / "prompts" / fname)
        m = re.search(rf'<pre class="prompt-text" id="text-{re.escape(pid)}">(.*?)</pre>', page, re.S)
        embedded = html.unescape(m.group(1)) if m else None
        ok = embedded == body
        bad += 0 if ok else 1
        print(f"{'OK  ' if ok else 'DIFF'} {pid} {fname} ({len(body)} chars)")
    sys.exit(1 if bad else 0)


TEMPLATE = r"""<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Franklin v26 Run-Sheet</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Libre+Caslon+Text:ital,wght@0,400;0,700;1,400&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
:root{
  --paper:#f4f6f8; --surface:#ffffff; --surface-2:#eaeef2; --ink:#18212b; --ink-2:#4a5663; --rule:#d3dae1;
  --accent:#0b6b6b; --accent-ink:#ffffff; --accent-soft:#dcefee; --ochre:#9a6512; --ochre-soft:#f6ead3;
  --good:#1f7a3f; --warn:#9a6512; --stop:#a33a2b; --code-bg:#eef2f5;
  --serif:"Libre Caslon Text", Georgia, "Times New Roman", serif;
  --sans:"IBM Plex Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
  --mono:"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
}
@media (prefers-color-scheme: dark){
  :root:not([data-theme="light"]){
    --paper:#0f1419; --surface:#161d24; --surface-2:#1d262f; --ink:#e4e9ee; --ink-2:#a3aeb9; --rule:#2c3742;
    --accent:#45b8b1; --accent-ink:#0b1417; --accent-soft:#17312f; --ochre:#e2a94a; --ochre-soft:#33280f;
    --good:#58c27d; --warn:#e2a94a; --stop:#ec7a67; --code-bg:#1b232b; color-scheme:dark;
  }
}
:root[data-theme="dark"]{
  --paper:#0f1419; --surface:#161d24; --surface-2:#1d262f; --ink:#e4e9ee; --ink-2:#a3aeb9; --rule:#2c3742;
  --accent:#45b8b1; --accent-ink:#0b1417; --accent-soft:#17312f; --ochre:#e2a94a; --ochre-soft:#33280f;
  --good:#58c27d; --warn:#e2a94a; --stop:#ec7a67; --code-bg:#1b232b; color-scheme:dark;
}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.6 var(--sans);padding-inline:16px;padding-block:0 64px}
.wrap{max-width:900px;margin:0 auto}
h1,h2{font-family:var(--serif);font-weight:700;text-wrap:balance;letter-spacing:.005em}
h1{font-size:clamp(1.9rem,4.6vw,2.7rem);line-height:1.15;margin:.2em 0 .3em}
h2{font-size:1.6rem;line-height:1.25;margin:2.4em 0 .6em;padding-top:.6em;border-top:1px solid var(--rule)}
h3{font-size:1.1rem;margin:1.4em 0 .4em}
h4,h5{font-size:1rem;margin:1.2em 0 .3em}
p,li{max-width:68ch}
a{color:var(--accent)}
code{font-family:var(--mono);font-size:.86em;background:var(--code-bg);padding:.08em .35em;border-radius:4px;overflow-wrap:anywhere}
.eyebrow{font:500 .78rem/1.2 var(--sans);letter-spacing:.12em;text-transform:uppercase;color:var(--ink-2);margin-top:28px}
.lede{font-size:1.1rem;color:var(--ink)}
nav.toc{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0 8px}
nav.toc a{font-size:.88rem;text-decoration:none;color:var(--ink);background:var(--surface);border:1px solid var(--rule);border-radius:999px;padding:4px 12px}
nav.toc a:focus-visible,button:focus-visible,summary:focus-visible,input:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.start{background:var(--accent-soft);border:1px solid var(--accent);border-radius:10px;padding:18px 20px;margin:22px 0}
.start h2{border:0;margin:0 0 .4em;padding:0;font-size:1.3rem}
.start ol{margin:.2em 0 0;padding-left:1.2em}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin:14px 0}
.stat{background:var(--surface);border:1px solid var(--rule);border-radius:8px;padding:12px 14px}
.stat b{display:block;font:600 1.5rem/1.2 var(--sans);font-variant-numeric:tabular-nums}
.stat span{font-size:.86rem;color:var(--ink-2)}
.causes{counter-reset:c;list-style:none;padding:0;display:grid;gap:10px}
.causes li{background:var(--surface);border:1px solid var(--rule);border-radius:8px;padding:12px 14px;max-width:none}
.causes li b{display:block;margin-bottom:2px}
.causes li .ev{display:block;font-size:.88rem;color:var(--ink-2)}
.tag{display:inline-block;font:600 .7rem/1.4 var(--sans);letter-spacing:.06em;text-transform:uppercase;border-radius:4px;padding:1px 6px;margin-left:6px;vertical-align:1px}
.tag.new{background:var(--ochre-soft);color:var(--ochre)}
.tbl{overflow-x:auto;border:1px solid var(--rule);border-radius:8px;background:var(--surface);margin:12px 0}
table{border-collapse:collapse;width:100%;font-size:.9rem;min-width:640px}
th,td{text-align:left;vertical-align:top;padding:8px 10px;border-bottom:1px solid var(--rule)}
th{font-weight:600;background:var(--surface-2)}
tr:last-child td{border-bottom:0}
td.num{font-variant-numeric:tabular-nums;white-space:nowrap}
pre.mermaid{background:var(--surface);border:1px solid var(--rule);border-radius:8px;padding:12px;overflow-x:auto}
.decisions{background:var(--surface);border:1px solid var(--rule);border-radius:10px;padding:6px 20px 18px}
.decisions h2{border:0;font-size:1.25rem;margin-top:1.4em;padding:0}
.decisions h4{font-size:1.02rem;margin-top:1.6em;padding-top:.8em;border-top:1px dashed var(--rule)}
.decisions blockquote{margin:.6em 0;padding:.4em .9em;border-left:3px solid var(--ochre);background:var(--ochre-soft)}
.decisions hr{border:0;border-top:1px solid var(--rule);margin:1.4em 0}
.prompt{background:var(--surface);border:1px solid var(--rule);border-radius:10px;padding:14px 16px;margin:14px 0}
.prompt.is-done{opacity:.72}
.prompt-head{display:flex;gap:14px;align-items:flex-start}
.prompt-id{font:600 .95rem/1 var(--mono);background:var(--accent);color:var(--accent-ink);border-radius:6px;padding:8px 9px;min-width:3.4em;text-align:center}
.prompt-title{flex:1;min-width:0}
.prompt-title h3{margin:0;font-size:1.05rem}
.when{margin:.2em 0 0;font-size:.85rem;color:var(--ink-2)}
label.done{font-size:.88rem;white-space:nowrap;display:flex;gap:6px;align-items:center;cursor:pointer}
ul.meta{margin:.6em 0 .2em;padding-left:1.1em;font-size:.88rem;color:var(--ink-2)}
details summary{cursor:pointer;font-weight:500;color:var(--accent);margin-top:6px}
.copyrow{display:flex;gap:10px;align-items:center;margin:10px 0 6px}
button.copy{font:500 .9rem var(--sans);background:var(--accent);color:var(--accent-ink);border:0;border-radius:6px;padding:7px 14px;cursor:pointer}
.copied{font-size:.85rem;color:var(--good)}
pre.prompt-text{font:.8rem/1.5 var(--mono);background:var(--code-bg);border:1px solid var(--rule);border-radius:6px;padding:12px;white-space:pre-wrap;overflow-wrap:anywhere;max-height:520px;overflow:auto}
.note{font-size:.9rem;color:var(--ink-2)}
ol.flow{padding-left:1.3em;margin:.6em 0}
ol.flow li{margin:.25em 0}
details.graph{margin:10px 0}
details.graph summary{cursor:pointer;color:var(--accent);font-weight:500}
footer{margin-top:3em;font-size:.85rem;color:var(--ink-2);border-top:1px solid var(--rule);padding-top:1em}
@media (max-width:560px){.prompt-head{flex-wrap:wrap}.prompt-id{min-width:auto}}
@media (prefers-reduced-motion: reduce){*{scroll-behavior:auto!important}}
</style>

<div class="wrap">
<p class="eyebrow">ChapterFlow · book pipeline · planned 2026-09-27</p>
<h1>Finish Franklin with a writer, not a rulebook</h1>
<p class="lede">The v25 pipeline never actually wrote a chapter. Four blind section writers filled template slots from a paraphrase of the book, and more than 330 proxy checks and graders that cannot tell good books from bad decided the rest. This plan hands each chapter to one strong writer working from Franklin's own text. A second model checks every fact against that text, and you read the result. On 2026-09-27 a single exploratory call showed the core step working.</p>

<nav class="toc" aria-label="Sections">
  <a href="#start">Start here</a><a href="#probe">Today's probe</a><a href="#causes">What went wrong</a><a href="#design">New pipeline</a><a href="#waves">Waves</a><a href="#decisions">Your decisions</a><a href="#prompts">Prompts</a><a href="#files">Files</a>
</nav>

<section class="start" id="start">
  <h2>Start here</h2>
  <ol>
    <li><b>Decide now (optional):</b> only N2, which two chapters the prototype writes. The default is ch01 + ch13; do nothing to keep it. To choose ch01 + ch07, put this line at the top of the W1 prompt when you paste it: <code>Owner answers: N2 = B</code>.</li>
    <li><b>Paste <code>W1-prototype</code></b> after Tuesday's reset (Tue 09-29, 7 pm Toronto), or earlier if your usage page shows about 20% or more of the weekly limit left. Start a fresh Claude Code session in <code>~/cf-wt</code> as <code>caffeinate -dimsu claude</code> (Mac on power). New this time: sessions start in <code>~/cf-wt</code>, not <code>~/ChapterFlow</code>, so the first time you accept the folder-trust prompt and use the same permission mode as the v25 sessions. W1 copies this kit from the repo branch <code>claude/vibrant-ritchie-xaf7dm</code> to <code>~/cf-wt/v26-plan/</code> and installs the campaign memory note.</li>
    <li><b>About a day later, read</b> the reading pack it builds (about an hour), then answer R1-a, R1-b and R1-d in <code>~/cf-wt/v26-plan/DECISIONS.md</code>.</li>
  </ol>
  <p class="note"><b>Timeline</b> if Wave 1 starts at the reset on Tue 09-29 23:00Z: you read the prototype on 10-01 and the whole Franklin book about 10-03. Franklin could be in the app about <b>10-06/07</b>, and the second book (Bennett) ready about 10-09. Your reading time is about 1 h + 2–3 h, plus an optional light read of Bennett.</p>
  <p class="note"><b>Cost.</b> Model calls made by the pipeline are expected to come to about $50–100 API-equivalent for Franklin plus Bennett, with hard caps adding up to $175 (one v25 run cost $700–1,100). The Claude Code sessions themselves also use your weekly limit and are not estimated. In the heavy v25 week they used as much as the pipeline. W2 is the heavy session, so start it early in a quota week.</p>
</section>

<h2 id="probe">What today's probe showed</h2>
<p>One call with the pipeline's own CLI flags (<code>claude-opus-5</code>, effort high) was given a 3.4k-character brief and chapter I of the Autobiography. It returned a whole chapter in the app's v21 shape, and the app validator accepted it on the first try.</p>
<div class="stats">
  <div class="stat"><b>167 s · $0.45</b><span>one whole chapter (v25: ~311 calls, ~$120, ~16 h for a book's compile)</span></div>
  <div class="stat"><b>44 / 44</b><span>quotations verbatim in Franklin's text (rr21: 0 quotation marks in 20.5k summary words)</span></div>
  <div class="stat"><b>7 / 7</b><span>planted errors caught by an Opus 5 fact check ($0.27). Sonnet 5 caught 5/7. Real-error recall is measured in W1.</span></div>
  <div class="stat"><b>13.6k of 64k</b><span>output tokens used; the v25 writer at high effort hit the 64k cap thinking</span></div>
</div>
<p class="note">It also kept Franklin's "second edition" opening, which rr21 lost, and it got right two ch01 facts rr21 got wrong. Weak spots: the full telling ran to 1,432 words, and the quiz key was the longest choice in 5 of 6 questions. Files: <code>evidence/probe/</code>.</p>

<h2 id="causes">What went wrong (root causes)</h2>
<ol class="causes">
  <li><b>Nobody writes a chapter.</b><span class="ev">Four section writers per chapter fill dealt slots from a 64–80k-character card that is 63% paraphrase; in ch13 only 1,350 of 43,030 packet characters are Franklin's. The example and action writers never see the chapter text. They run at medium effort because the rulebook is too big for high effort.</span></li>
  <li><b>The rulebook replaced the goal.</b><span class="ev">More than 330 checks, and not one of the 138 section checks can tell whether a fact is true. They reject 1,902 of 1,903 catalog chapters on one rule alone. The readability floor caps Franklin at about 12 words a sentence (he writes 30). The code's own comments record about 7 "rule → tic → new rule" cascades.</span></li>
  <li><b>We steered by graders that can't tell good from bad.</b><span class="ev">Known-good books fail the rubric. Identical text drew a panel blocker on 41% of re-reads, so all 19 chapters passing at once had odds of about 1 in 25,000. Panels took 58% of the money. Catalog "quality" tracks which grader a book got more than how it was made.</span></li>
  <li><b>Accuracy had no owner until the very end.</b><span class="ev">About a third of errors came from the paraphrase and two thirds from writers forced to pair facts with cases. The editor can reword a sentence, but it cannot put in a correct name, date or number that the chapter does not already contain. The only fact check sat behind a panel pass that never came, and a footnote marker like "[7]" silently demotes its findings.</span></li>
  <li><b>The app hides the writing.</b><span class="tag new">new</span><span class="ev">A new reader sees a ~100-word summary, one example and 5 quiz questions. The full telling is locked behind "Challenge" mode, clicking "Standard" does nothing, and Settings resets the depth. Rev-6 gave a default reader 522 words of Franklin for the whole book.</span></li>
  <li><b>Every experiment cost a day and $100+.</b><span class="tag new">new</span><span class="ev">77% of busy hours went to runs later thrown away. Fixing the machine used as much quota as running it ($766 vs $826 in the heavy week). A whole chapter now costs $0.45 and 3 minutes, so your reading becomes the pace-setter.</span></li>
  <li><b>The release path had quietly broken.</b><span class="tag new">new</span><span class="ev">Any change to the pipeline's code, config or prompts expires a finished release (fingerprints), so the only released Franklin (rev-6) cannot ship today. The catalog file moved in July and the publish tools still write the old path. Both release routes demand grader passes. The app itself needs only the package.</span></li>
  <li><b>The template is a pipeline choice, not an app rule.</b><span class="ev">The app accepts any counts. The 6-examples / 9-quiz / 7-cards / 30k-character template turned memoirs into invented-character guides (Man's Search for Meaning, Meditations). No catalog book carries its author's voice.</span></li>
</ol>
<p class="note">The previous diagnosis holds on points 1, 2, 4 and 6, is refined on 3 and 5, and missed 5–7 above. The "good books were GPT whole-chapter" premise does not hold. No book met the full bar in July. Two of the top three came mostly from Claude Opus 4.7 with small prompts, and the GPT-5.5 whole-chapter books were mixed. The lever is a strong model with a small prompt and the real text, not the model family. Full evidence: <code>ANALYSIS.md</code> and <code>scan/*.md</code>.</p>

<h2 id="design">The new pipeline (v26)</h2>
<div class="tbl"><table>
<thead><tr><th>Stage</th><th>What happens</th><th>Calls / chapter</th><th>Blocks?</th></tr></thead>
<tbody>
<tr><td>Source</td><td>Frozen text + chapter map (reused for Franklin); footnote markers stripped, editor's notes labelled</td><td class="num">0</td><td>—</td></tr>
<tr><td>Brief</td><td>One page per book: reader, voice, book type → chapter shape</td><td class="num">0</td><td>—</td></tr>
<tr><td>Write</td><td>One strong writer (Opus, effort high) writes the whole chapter from its source text</td><td class="num">1</td><td>—</td></tr>
<tr><td>Check</td><td>Validator, verbatim quotes, key in range (0 calls); an Opus fact check hunting the 5 error kinds; a blind quiz solve</td><td class="num">2</td><td><b>Only facts, quiz keys, renderability</b></td></tr>
<tr><td>Fix</td><td>Targeted find/replace edits for flagged text only, then a full re-check (at most 2 rounds)</td><td class="num">0–2</td><td>—</td></tr>
<tr><td>You read</td><td>Reading pack in the app's order; your notes become targeted fixes</td><td class="num">—</td><td><b>Your yes is the gate</b></td></tr>
<tr><td>Release</td><td>Assemble the package → <code>ship --dry-run</code> (session) → the real <code>ship</code> on a branch, PR, S3 upload, deploy and <code>register:api</code> (you). <code>ship</code> calls the <code>publishFinal()</code> library with the app validator; the old <code>publish-final</code> command refuses a new Franklin package.</td><td class="num">0</td><td>—</td></tr>
</tbody></table></div>
<p class="note">About <b>$25–40</b> and <b>1–2 hours</b> of machine time per 19-chapter book. The research sidecars, section writers, 330+ checks, panel, repair loops, QC, rubric and promotion state machine are <b>bypassed</b> (frozen, not deleted until Franklin ships). The code lives in <code>scripts/book/v26/</code> and its tests run in CI.</p>

<h2 id="waves">Waves</h2>
<div class="tbl"><table>
<thead><tr><th>Wave</th><th>Sessions</th><th>Model</th><th>Wall time</th><th>Cap (pipeline / subagents)</th><th>Exit</th><th>If it fails</th></tr></thead>
<tbody>
<tr><td><b>W1</b> Prototype</td><td>W1</td><td>Opus 5.5</td><td class="num">5–8 h</td><td class="num">$25 / 12</td><td>2 chapters + reading pack → <b>you read (R1, ~1 h)</b></td><td>R1 = C → W1b (GPT-5.5 writer or another format)</td></tr>
<tr><td><b>W2</b> Build + write Franklin</td><td>W2 ∥ W2w (if R1-d = B/C)</td><td>Opus 5.5</td><td class="num">1–1.5 d</td><td class="num">$80 / 25</td><td>Tool merged with tests in CI; 19 chapters checked; <code>ship --dry-run</code> passes → <b>you read (R2, 2–3 h)</b></td><td>Chapters with open issues are listed for you</td></tr>
<tr><td><b>W3</b> Finish</td><td>W3 (Part A, then Part B)</td><td>Opus 5.5</td><td class="num">0.5 d</td><td class="num">$30 / 10</td><td>Your notes applied; <b>you run ship, S3, deploy, register (P1)</b>; then Part B runs <code>verify:live</code></td><td>R2 = C → reassess point</td></tr>
<tr><td><b>W4</b> Next book + cleanup</td><td>W4a ∥ W4b</td><td>Opus 5.5 ∥ Sonnet 5</td><td class="num">1–2 d</td><td class="num">$40 / 16</td><td>Bennett reading pack in days; v25 driver retired; CI, branches, worktrees, docs, memory</td><td>Problems become brief changes, never new rules</td></tr>
</tbody></table></div>
<ol class="flow">
  <li><b>W1</b> writes two chapters → <b>you read (R1)</b>.</li>
  <li>If R1 = C: <b>W1b</b> tries a GPT-5.5 writer and/or another format → you read again, or write STOP (reassess point).</li>
  <li>If R1 = A/B: <b>W2</b> builds the tool and writes all 19 chapters (plus <b>W2w</b> if you chose an app change) → <b>you read the book (R2)</b>.</li>
  <li>If R2 = A/B: <b>W3 Part A</b> makes it final and writes your publish commands → <b>you publish (P1)</b> → <b>W3 Part B</b> checks it is live.</li>
  <li>After W3 Part A: <b>W4a</b> (Bennett) and <b>W4b</b> (cleanup) run together.</li>
</ol>
<details class="graph"><summary>Dependency graph (mermaid)</summary>
<pre class="mermaid">
graph TD
  N[You: N2 optional] --> W1[W1 prototype: 2 chapters]
  W1 --> R1{R1: you read}
  R1 -- not better --> W1b[W1b variant] --> R1b{R1 again}
  R1b -- STOP --> STOP[Reassess: stop and replan]
  R1b -- better --> W2
  R1 -- better --> W2[W2 build + write 19 chapters]
  R1 -- R1-d = B/C --> W2w[W2w reader app]
  W2 --> R2{R2: you read the book}
  W2w --> R2
  R2 -- approve --> W3[W3 Part A: final + commands]
  R2 -- reject --> STOP
  W3 --> P[You: ship + deploy, P1]
  P --> V[W3 Part B: verify live]
  W3 --> W4a[W4a Bennett]
  W3 --> W4b[W4b cleanup]
</pre>
</details>
<p class="note"><b>Stop rules.</b> Each session stops before its cap and hands over. <b>If the weekly limit runs out,</b> the session stops. It writes <code>WAITING-FOR-RESET</code> if it still can; if the session itself shows a usage-limit message, that means the same thing. Nothing restarts on its own: after Tuesday's reset (7 pm Toronto), paste the same prompt into a fresh session, and it continues from the files already on disk. <b>Reassess point:</b> if the prototype is not clearly better after W1 and W1b, or you reject the full book, the plan stops and nobody adds rules to rescue it.</p>

<h2 id="decisions">Your decisions</h2>
<p class="note">Most have a default that a session uses when you leave the line blank. R1-a and R2 need your answer, and P1 is you saying you have published. Write answers on the <code>Owner:</code> lines in <code>~/cf-wt/v26-plan/DECISIONS.md</code> (it exists once W1 has run).</p>
<div class="decisions">
{{DECISIONS}}
</div>

<h2 id="prompts">Session prompts</h2>
<p class="note">Paste the text of one prompt into a fresh Claude Code session started in <code>~/cf-wt</code> as <code>caffeinate -dimsu claude</code>. Copy works with the prompt text collapsed. The "Done" box is saved only in this browser.</p>
{{PROMPTS}}

<h2 id="files">Files</h2>
<ul>
  <li><b>Kit on the Mac:</b> <code>~/cf-wt/v26-plan/</code>. W1 creates it from the repo: <code>git -C ~/ChapterFlow-books-v25-completion fetch origin claude/vibrant-ritchie-xaf7dm && mkdir -p ~/cf-wt/v26-plan && git -C ~/ChapterFlow-books-v25-completion archive FETCH_HEAD docs/v26-plan | tar -x -C ~/cf-wt/v26-plan --strip-components=2</code></li>
  <li><code>README.md</code> roadmap · <code>BRIEF.md</code> shared facts, traps and safety rules · <code>DECISIONS.md</code> · <code>ANALYSIS.md</code> root causes with evidence · <code>prompts/</code> · <code>status/</code> · <code>scan/</code> the ten lens reports, each adversarially verified · <code>evidence/probe/</code> today's 3 model calls · <code>memory/</code> the campaign memory note.</li>
  <li>This page is built by <code>tools/build_runsheet.py</code>, and <code>--check</code> diffs every embedded prompt against its file.</li>
</ul>
<footer>Planning session 2026-09-27 · repo <code>WillSoltani/ChapterFlow</code> at <code>22e021d84</code> · 3 model calls ($0.86) · this page supersedes the v25 run-sheet (v6).</footer>
</div>

<script>
(function(){
  function store(){ try { return window.localStorage; } catch (e) { return null; } }
  var ls = store();
  document.querySelectorAll('input[data-done]').forEach(function(box){
    var id = box.getAttribute('data-done'), card = document.getElementById('p-' + id), key = 'v26-done-' + id;
    try { if (ls && ls.getItem(key) === '1') { box.checked = true; card.classList.add('is-done'); } } catch (e) {}
    box.addEventListener('change', function(){
      card.classList.toggle('is-done', box.checked);
      try { if (ls) { if (box.checked) ls.setItem(key, '1'); else ls.removeItem(key); } } catch (e) {}
    });
  });
  document.querySelectorAll('button.copy').forEach(function(btn){
    btn.addEventListener('click', function(){
      var pre = document.getElementById(btn.getAttribute('data-target'));
      var note = btn.parentNode.querySelector('.copied');
      var text = pre.textContent;
      function selectIt(){
        var r = document.createRange(); r.selectNodeContents(pre);
        var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
        note.textContent = 'Selected: press Cmd+C to copy';
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function(){ note.textContent = 'Copied'; }, selectIt);
      } else { selectIt(); }
    });
  });
})();
</script>
"""

if __name__ == "__main__":
    if "--check" in sys.argv:
        check()
    else:
        build()
