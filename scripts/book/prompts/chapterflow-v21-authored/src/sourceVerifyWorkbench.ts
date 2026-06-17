/**
 * `source-verify-workbench <book>` — a local, offline HTML form for filling the source-verify
 * record per item instead of hand-editing a long Markdown/JSON block. The page renders every
 * verifiable item (claim, detail, sidecar path) with a verdict dropdown + sourceRef + note + a
 * copy-search-query button, and a "Download source-verify-record.json" button that serializes
 * the form to the EXACT shape `source-verify-check` expects.
 *
 * This is a RENDERER over existing data: items come from `verifiableItems` (the same source as
 * the Markdown packet) and the output JSON is the same `source-verify-record-v1` record that
 * `parseSourceVerifyRecord` already reads. No new gate logic, no parser change. The generator
 * below is pure (it takes pre-derived chapters); the CLI does the sidecar I/O. The in-browser JS
 * is intentionally minimal — all data derivation stays here in TS where it is tested.
 */

import type { SourceVerifyItem } from "./critics/sourceVerify.js";

export interface WorkbenchChapter {
  chapterNumber: number;
  sidecarPath: string;
  items: SourceVerifyItem[];
}

/** Inline a value into a <script> as JSON without letting `</script>` or HTML break out. */
function jsonForScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}

function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Pure: build the self-contained workbench HTML for a book's chapters. */
export function buildSourceVerifyWorkbench(bookId: string, chapters: WorkbenchChapter[]): string {
  const totalItems = chapters.reduce((n, c) => n + c.items.length, 0);
  const data = {
    schemaVersion: "source-verify-record-v1",
    bookId,
    chapters: chapters.map((c) => ({
      chapterNumber: c.chapterNumber,
      sidecarPath: c.sidecarPath,
      items: c.items.map((it) => ({ id: it.id, kind: it.kind, claim: it.claim, detail: it.detail })),
    })),
  };

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Source verify — ${esc(bookId)}</title>
<style>
  :root { color-scheme: light dark; }
  body { font: 15px/1.5 -apple-system, system-ui, sans-serif; margin: 0; padding: 0 0 120px; }
  header { position: sticky; top: 0; background: Canvas; border-bottom: 1px solid #8884; padding: 12px 20px; z-index: 5; }
  header h1 { font-size: 16px; margin: 0 0 6px; }
  header .meta { font-size: 13px; opacity: .7; }
  header .bar { margin-top: 10px; display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
  button { font: inherit; padding: 6px 12px; border: 1px solid #8886; border-radius: 6px; background: #8881; cursor: pointer; }
  button.primary { background: #2563eb; color: #fff; border-color: #2563eb; }
  main { padding: 20px; max-width: 980px; margin: 0 auto; }
  h2 { font-size: 14px; margin: 28px 0 4px; }
  h2 .path { font-weight: normal; opacity: .6; font-size: 12px; }
  .item { border: 1px solid #8884; border-radius: 8px; padding: 12px 14px; margin: 10px 0; }
  .item .claim { font-weight: 600; }
  .item .detail { font-size: 13px; opacity: .75; margin: 2px 0 8px; word-break: break-word; }
  .item .id { font-size: 11px; opacity: .5; }
  .badge { font-size: 11px; padding: 1px 6px; border-radius: 4px; background: #8882; margin-left: 6px; }
  .row { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin-top: 8px; }
  select, input, textarea { font: inherit; padding: 5px 8px; border: 1px solid #8886; border-radius: 6px; background: Canvas; color: CanvasText; }
  input.ref { flex: 1 1 280px; }
  textarea.note { flex: 1 1 100%; min-height: 38px; resize: vertical; }
  select.v-VERIFIED { background: #16a34a22; } select.v-WRONG { background: #dc262622; } select.v-UNVERIFIABLE { background: #d9770622; }
  .counts b { font-variant-numeric: tabular-nums; }
  .warn { color: #dc2626; }
</style>
</head>
<body>
<header>
  <h1>Source reality verification — ${esc(bookId)}</h1>
  <div class="meta">${totalItems} item(s) across ${chapters.length} chapter(s). Verify each AGAINST A REAL SOURCE — a plausible invented sidecar passes every downstream gate. Then Download and run source-verify-check.</div>
  <div class="bar">
    <button class="primary" id="download">⬇ Download source-verify-record.json</button>
    <button id="copy">⧉ Copy JSON</button>
    <span class="counts" id="counts"></span>
  </div>
</header>
<main id="root"></main>
<script>
const DATA = ${jsonForScript(data)};
const VERDICTS = ["", "VERIFIED", "UNVERIFIABLE", "WRONG"];
const state = {}; // id -> {verdict, sourceRef, note}

function el(tag, attrs, kids) {
  const n = document.createElement(tag);
  for (const k in (attrs||{})) { if (k === "class") n.className = attrs[k]; else if (k === "text") n.textContent = attrs[k]; else n.setAttribute(k, attrs[k]); }
  for (const c of (kids||[])) n.append(c);
  return n;
}

function searchQuery(it) {
  // A copy-paste-able web search to find the real source for this claim.
  const q = (it.claim || "").trim() || (it.detail || "").trim();
  return '"' + q.replace(/"/g, "") + '"';
}

function render() {
  const root = document.getElementById("root");
  for (const ch of DATA.chapters) {
    root.append(el("h2", {}, [document.createTextNode("Chapter " + ch.chapterNumber + " "), el("span", { class: "path", text: ch.sidecarPath })]));
    for (const it of ch.items) {
      state[it.id] = { verdict: "", sourceRef: "", note: "" };
      const sel = el("select");
      for (const v of VERDICTS) sel.append(el("option", { value: v, text: v || "— verdict —" }));
      sel.className = "verdict";
      sel.onchange = () => { state[it.id].verdict = sel.value; sel.className = "verdict v-" + sel.value; updateCounts(); };
      const ref = el("input", { class: "ref", placeholder: "sourceRef — title + URL/locator you verified against" });
      ref.oninput = () => { state[it.id].sourceRef = ref.value; };
      const note = el("textarea", { class: "note", placeholder: "note — what you checked (per item; a single reused note is a rubber-stamp, SV4)" });
      note.oninput = () => { state[it.id].note = note.value; };
      const cq = el("button", { text: "⧉ copy search query" });
      cq.onclick = () => navigator.clipboard && navigator.clipboard.writeText(searchQuery(it));
      root.append(el("div", { class: "item" }, [
        el("div", { class: "claim", text: it.claim || "(no claim text)" }),
        el("div", { class: "detail", text: it.detail || "" }),
        el("div", {}, [el("span", { class: "id", text: it.id }), el("span", { class: "badge", text: it.kind })]),
        el("div", { class: "row" }, [sel, cq]),
        el("div", { class: "row" }, [ref]),
        el("div", { class: "row" }, [note]),
      ]));
    }
  }
  updateCounts();
}

function buildRecord() {
  return {
    schemaVersion: "source-verify-record-v1",
    bookId: DATA.bookId,
    chapters: DATA.chapters.map(ch => ({
      chapterNumber: ch.chapterNumber,
      items: ch.items.map(it => ({ id: it.id, kind: it.kind, verdict: state[it.id].verdict, sourceRef: state[it.id].sourceRef, note: state[it.id].note })),
    })),
  };
}

function updateCounts() {
  const all = Object.values(state);
  const verified = all.filter(s => s.verdict === "VERIFIED").length;
  const open = all.filter(s => !s.verdict).length;
  const notes = new Set(all.filter(s => s.verdict === "VERIFIED").map(s => (s.note||"").trim()).filter(Boolean));
  const stamp = verified >= 5 && notes.size === 1;
  const c = document.getElementById("counts");
  c.innerHTML = "<b>" + verified + "</b>/" + all.length + " VERIFIED · <b>" + open + "</b> open"
    + (stamp ? " · <span class='warn'>one note reused across all VERIFIED — that is a rubber-stamp (SV4)</span>" : "");
}

document.getElementById("copy").onclick = () => navigator.clipboard && navigator.clipboard.writeText(JSON.stringify(buildRecord(), null, 2));
document.getElementById("download").onclick = () => {
  const blob = new Blob([JSON.stringify(buildRecord(), null, 2)], { type: "application/json" });
  const a = el("a", { href: URL.createObjectURL(blob), download: "source-verify-record.json" });
  document.body.append(a); a.click(); a.remove();
};
render();
</script>
</body>
</html>
`;
}
