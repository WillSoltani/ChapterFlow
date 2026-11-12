import { test, expect } from "@playwright/test";
import sharp from "sharp";
import { promises as fs } from "node:fs";

/**
 * Ground-truth check: wheel-scroll like a human and, at every stop, compare
 * the CANVAS PIXELS to (a) the frame file the hud names and (b) the frame the
 * scroll position demands. Catches stale caches, wrong film, poster stuck,
 * blank canvas — anything the hud alone would lie about.
 *
 * The phone run (390 × 844, DPR 2) draws the band tier b900: there the
 * canvas must equal the tier's OWN frame file placed by the virtual-frame math
 * (the band rect inside the cover-fit 1080×1920 frame), with the clear colour
 * everywhere else. It does not need the legacy -p frames. The landscape
 * phone run (844 × 390, DPR 3, touch: a phone held sideways, Phase 7) draws
 * the LANDSCAPE variant: there the canvas must equal the landscape frame
 * cover-fitted by the same math.
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

  for (const run of [
    { name: "phone", viewport: { width: 390, height: 844 }, dpr: 2, mobile: false, band: true },
    // Phase 7: a phone held sideways draws the LANDSCAPE frames (short landscape).
    { name: "landscape phone", viewport: { width: 844, height: 390 }, dpr: 3, mobile: true, band: false },
  ] as const)
  test.describe(run.name, () => {
    // Reduced motion: no breath (deterministic pixels) and only the
    // chapter's stops are drawn (Phase 8, data-film-stops), so a scroll
    // position names one exact frame.
    test.use({ viewport: run.viewport, deviceScaleFactor: run.dpr, ...(run.mobile ? { isMobile: true, hasTouch: true } : {}) });

    test(run.band ? "canvas pixels equal the band tier's own frame placed in its virtual frame" : "canvas pixels equal the landscape frame placed by the canvas math", async ({ page }) => {
      test.setTimeout(180_000);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/?hud=1");
      await page.waitForFunction(() => !!(window as unknown as { __filmCaches?: unknown }).__filmCaches);
      await page.waitForTimeout(1000);
      const tl = JSON.parse(await fs.readFile("components/film/book.timeline.json", "utf8")).films as Record<string, { count: number }>;
      const names = Object.keys(tl);
      const stops = await page.$$eval("[data-film-segment]", (els) => els.map((e) => ((e as HTMLElement).dataset.filmStops ?? "").split(",").map(Number)));
      // Hero: one stop before, one INSIDE and one after its portrait ramp
      // (encode.mjs --portrait-ramp 150,200: a band tier's frames up to 200
      // carry bars inside the band box), picked by frame, not by index: the
      // stops follow the pins (Phase 8). Later films: their second and
      // second-to-last stops, away from the dissolve at frame 0.
      const RAMP: [number, number] = [150, 200];
      const hero = stops[0] ?? [];
      const heroAt = (ok: (f: number) => boolean, what: string) => {
        const j = hero.findIndex((f) => f > 0 && ok(f));
        if (j < 0) throw new Error(`the hero has no stop ${what} its ramp (stops ${hero.join(",")})`);
        return j;
      };
      const positions: Array<[number, number]> = [
        [0, heroAt((f) => f < RAMP[0], "before")],
        [0, heroAt((f) => f > RAMP[0] && f < RAMP[1], "inside")],
        [0, hero.length - 1],
      ];
      for (let i = 1; i < names.length; i++) positions.push([i, 1], [i, (stops[i]?.length ?? 2) - 2]);

      const problems: string[] = [];
      for (const [i, j] of positions) {
        const film = names[i];
        const entry = film ? tl[film] : undefined;
        const st = stops[i];
        if (!film || !entry || !st || st[j] === undefined) throw new Error(`timeline has no film ${i} / stop ${j}`);
        const frame = st[j]!;
        // Share of the chapter's pinned travel at which stop j is centred (pins.ts reducedStopScroll).
        const p = j / (st.length - 1);
        const decoy = frame >= 60 ? frame - 60 : frame + 60;
        const r = await page.evaluate(
          async ({ i, p, film, frame, decoy, band }) => {
            type Variant = { name: string; base: string; v?: string; frame?: { w: number; h: number }; band?: { x: number; y: number; w: number; h: number } };
            type Cache = { variant: Variant; has: (i: number) => boolean; lastServed: number };
            const caches = (window as unknown as { __filmCaches: Map<string, Cache> }).__filmCaches;
            const segs = [...document.querySelectorAll<HTMLElement>("[data-film-segment]")];
            const seg = segs[i];
            const stageEl = segs[0]?.querySelector("[data-film-stage]");
            if (!seg || !stageEl) throw new Error("no segment / stage");
            const stage = stageEl.getBoundingClientRect().height;
            const rect = seg.getBoundingClientRect();
            const top = rect.top + window.scrollY;
            const travel = rect.height - stage;
            window.scrollTo(0, Math.round(Math.min(top + travel - 2, Math.max(Math.ceil(top) + 2, top + p * travel))));
            const raf = () => new Promise((res) => requestAnimationFrame(res));
            const t0 = performance.now();
            let cache: Cache | undefined;
            for (;;) {
              await raf();
              cache = [...caches.entries()].find(([key]) => key.startsWith(band ? `${film}-` : `${film}@`))?.[1];
              const m = /(palace-\d\d) · f(\d{4})/.exec(document.querySelector(".film-hud")?.textContent ?? "");
              if (cache && m && m[1] === film && Number(m[2]) === frame + 1 && cache.has(frame) && cache.lastServed === frame) break;
              if (performance.now() - t0 > 20_000) return { error: `timed out waiting for ${film} f${frame + 1} (cache ${cache?.variant.name ?? "none"})` };
            }
            await raf();
            await raf();
            const variant = cache.variant;
            if (band && (!variant.frame || !variant.band)) return { error: `${variant.name} is not a band tier` };
            const canvas = document.querySelector<HTMLCanvasElement>(".film-canvas canvas");
            if (!canvas?.parentElement) throw new Error("no film canvas");
            const cw = canvas.width;
            const ch = canvas.height;
            const live = canvas.getContext("2d")!.getImageData(0, 0, cw, ch).data;
            const bg = getComputedStyle(canvas).getPropertyValue("--cf-recall-bg").trim() || "#06070A";
            const boxH = canvas.parentElement.getBoundingClientRect().height;
            const shiftY = boxH > 0 ? ((stage - boxH) / 2) * (ch / boxH) : 0;
            // The virtual frame cover-fitted to the canvas (breath 0), then the
            // band inside it; a landscape variant: its own frame cover-fitted.
            const vf = variant.frame ?? { w: 1920, h: 1080 };
            const pic = variant.band ?? { x: 0, y: 0, w: vf.w, h: vf.h };
            const scale = Math.max(cw / vf.w, ch / vf.h);
            const fx = (cw - vf.w * scale) * 0.5;
            const fy = shiftY + (ch - vf.h * scale) * 0.5;
            const dest = { x: fx + pic.x * scale, y: fy + pic.y * scale, w: pic.w * scale, h: pic.h * scale };
            const meanDiff = async (index: number) => {
              const url = `${variant.base}/f_${String(index + 1).padStart(4, "0")}.webp${variant.v ? `?v=${variant.v}` : ""}`;
              const img = await createImageBitmap(await (await fetch(url)).blob());
              const ref = document.createElement("canvas");
              ref.width = cw;
              ref.height = ch;
              const ctx = ref.getContext("2d", { alpha: false })!;
              ctx.fillStyle = bg;
              ctx.fillRect(0, 0, cw, ch);
              ctx.drawImage(img, dest.x, dest.y, dest.w, dest.h);
              const px = ctx.getImageData(0, 0, cw, ch).data;
              let sum = 0;
              for (let o = 0; o < px.length; o += 4) sum += Math.abs(px[o]! - live[o]!) + Math.abs(px[o + 1]! - live[o + 1]!) + Math.abs(px[o + 2]! - live[o + 2]!);
              return sum / ((px.length / 4) * 3);
            };
            // Outside the band the canvas is the clear colour, exactly.
            const c = document.createElement("canvas").getContext("2d")!;
            c.fillStyle = bg;
            c.fillRect(0, 0, 1, 1);
            const bgPx = c.getImageData(0, 0, 1, 1).data;
            let outside = 0;
            for (const yy of [0, Math.floor(dest.y) - 2, Math.ceil(dest.y + dest.h) + 1, ch - 1]) {
              if (yy < 0 || yy >= ch) continue;
              for (let xx = 0; xx < cw; xx++) {
                const o = (yy * cw + xx) * 4;
                if (live[o] !== bgPx[0] || live[o + 1] !== bgPx[1] || live[o + 2] !== bgPx[2]) outside++;
              }
            }
            return { variant: variant.name, exact: await meanDiff(frame), decoy: await meanDiff(decoy), outside };
          },
          { i, p, film, frame, decoy, band: run.band },
        );
        if ("error" in r) {
          problems.push(String(r.error));
          continue;
        }
        console.log(`${run.name} truth: ${r.variant} f${frame + 1}: mean |Δ| ${r.exact.toFixed(3)} vs decoy f${decoy + 1} ${r.decoy.toFixed(2)}${run.band ? `, off-band pixels ${r.outside}` : ""}`);
        const expected = run.band ? `${film}-b900` : film;
        if (r.variant !== expected) problems.push(`${film} f${frame + 1}: drew ${r.variant}, expected ${expected}`);
        if (r.exact > 0.5) problems.push(`${film} f${frame + 1}: canvas differs from the tier frame by ${r.exact.toFixed(2)}`);
        if (!(r.decoy > r.exact)) problems.push(`${film} f${frame + 1}: canvas is no closer to its frame (${r.exact.toFixed(2)}) than to f${decoy + 1} (${r.decoy.toFixed(2)})`);
        if (run.band && r.outside > 0) problems.push(`${film} f${frame + 1}: ${r.outside} pixels outside the band are not the clear colour`);
      }
      expect(problems, problems.join("\n")).toEqual([]);
    });
  });
});
