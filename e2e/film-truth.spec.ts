import { test, expect } from "@playwright/test";
import sharp from "sharp";
import { promises as fs } from "node:fs";

/**
 * Ground-truth check: wheel-scroll like a human and, at every stop, compare
 * the CANVAS PIXELS to (a) the frame file the hud names and (b) the frame the
 * scroll position demands. Catches stale caches, wrong film, poster stuck,
 * blank canvas — anything the hud alone would lie about.
 *
 * Opt-in: RUN_AUDIT=1 (part of `npm run test:film`).
 */
test.describe("film truth", () => {
  test.skip(process.env.RUN_AUDIT !== "1", "opt-in: RUN_AUDIT=1");

  test("canvas pixels match the frame the scroll demands", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/?hud=1");
    await page.waitForTimeout(1500);
    const tl = JSON.parse(await fs.readFile("components/film/book.timeline.json", "utf8")).films as Record<string, { count: number }>;
    const names = Object.keys(tl);
    const segs = await page.$$eval("[data-film-segment]", (els) =>
      els.map((e) => { const r = e.getBoundingClientRect(); return { id: e.id, top: r.top + window.scrollY, h: r.height }; }),
    );
    const sig = async (buf: Buffer) =>
      Array.from((await sharp(buf).resize(32, 18, { fit: "fill" }).removeAlpha().raw().toBuffer({ resolveWithObject: true })).data);
    const dist = (a: number[], b: number[]) => { let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs((a[i] ?? 0) - (b[i] ?? 0)); return s / a.length; };
    // Cover-crop the frame to the viewport aspect (1440×900 = 1.6) the way the
    // canvas does, so the signatures are comparable.
    const fsig = async (film: string, f: number) =>
      sig(
        await sharp(await fs.readFile(`public/films/${film}/f_${String(f).padStart(4, "0")}.webp`))
          .resize(1440, 900, { fit: "cover", position: "centre" })
          .toBuffer(),
      );

    const problems: string[] = [];
    let ok = 0;
    const last = segs[segs.length - 1];
    if (!last) throw new Error("no film segments on the page");
    for (let y = 0; y < last.top + last.h - 900; y += 300) {
      await page.mouse.wheel(0, 300);
      await page.waitForTimeout(450);
      const st = await page.evaluate(() => ({
        sy: window.scrollY,
        hud: document.querySelector(".film-hud")?.textContent ?? "",
        png: (document.querySelector("canvas") as HTMLCanvasElement).toDataURL("image/png"),
      }));
      const m = /(palace-\d\d) · f(\d{4})/.exec(st.hud);
      if (!m) { problems.push(`y=${st.sy}: no hud`); continue; }
      // Mirrors pickActive: segment 0 scrubs over its sticky travel; every
      // later segment is active from the moment its box enters the viewport
      // bottom (top − vh), while the previous stage slides out, and scrubs
      // over travel + vh.
      let i = -1;
      for (let k = 0; k < segs.length; k++) {
        const lead = k === 0 ? 0 : 900;
        const s = segs[k];
        if (s && st.sy > s.top - lead && st.sy < s.top + s.h) i = k; // strict: at exactly top − vh the engine still holds the previous film
      }
      if (i < 0) continue;
      const seg = segs[i];
      if (!seg) continue;
      const lead = i === 0 ? 0 : 900;
      const p = Math.min(1, Math.max(0, (st.sy - seg.top + lead) / (seg.h - 900 + lead)));
      const expFilm = names[i];
      const expEntry = expFilm ? tl[expFilm] : undefined;
      const other = names[(i + 3) % names.length];
      const otherEntry = other ? tl[other] : undefined;
      if (!expFilm || !expEntry || !other || !otherEntry) { problems.push(`y=${st.sy}: timeline has no film for segment ${i}`); continue; }
      const expF = Math.round(p * (expEntry.count - 1)) + 1;
      // The canvas is cover-cropped (16:9 → viewport) with a breath zoom, so an
      // absolute distance is noisy. Instead: the canvas must be CLOSER to the
      // expected frame than to decoys — the poster, a frame 60 away, and the
      // same frame index in a different film.
      const canvas = await sig(Buffer.from(st.png.split(",")[1] ?? "", "base64"));
      const dExp = dist(canvas, await fsig(expFilm, expF));
      const decoys = [
        ["poster", await fsig(expFilm, 1)],
        ["far", await fsig(expFilm, Math.max(1, Math.min(expEntry.count, expF + (expF > 120 ? -60 : 60))))],
        ["otherfilm", await fsig(other, Math.min(expF, otherEntry.count))],
      ] as const;
      const here: string[] = [];
      if (m[1] !== expFilm || Math.abs(Number(m[2]) - expF) > 8) here.push(`HUD≠SCROLL (exp ${expFilm} f${expF})`);
      // If the canvas is already a near-match for the expected frame (within
      // the cover-crop / breath / WebP noise floor), nothing else can "win".
      if (dExp > 30) {
        for (const [label, d] of decoys) {
          const dd = dist(canvas, d);
          if (dd < dExp * 0.9) here.push(`CANVAS closer to ${label} (${dd.toFixed(0)}) than expected (${dExp.toFixed(0)})`);
        }
      }
      if (here.length) problems.push(`y=${st.sy} ${m[1]} f${m[2]}: ${here.join(" | ")}`); else ok++;
    }
    console.log(`truth: ok=${ok} issues=${problems.length}\n` + problems.join("\n"));
    expect(problems, problems.join("\n")).toEqual([]);
  });
});
