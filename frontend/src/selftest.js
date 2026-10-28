// Dev-only end-to-end self-test (?selftest=1), extracted from main.js so the
// app entry stays UI-only. Launch with `RUSTMD_SELFTEST=1 scripts\run-dev.bat`;
// it renders every note of the examples/ vault through the REAL app (real
// webview, real Rust backend, real remote images), exports PNG + PDF for each,
// and verifies residual raw math, remote AND local (vault) images in the
// exported PNG (2D NCC), and multi-line math geometry. Artifacts +
// report.json land in C:\Users\River\AppData\Local\Temp\opencode\rustmd-selftest.
//
// main.js imports this module dynamically, guarded by import.meta.env.DEV:
// in release builds the flag compiles to false, so this module is never
// bundled into shipped binaries.

import { api } from './api.js';
import { renderPreview, setImageContext, isRmdUrl } from './preview.js';
import { exportPng, exportPdf } from './export.js';
import { bytesToDataUrl, guessImageMime } from './imgutil.js';

/// `getState` returns the live app state (dir / current note) so the
/// finally-block can restore the user's notes root and image context —
/// exactly what the inlined version did through main.js's module state.
export async function runSelfTest({ getState }) {
  const SELFTEST_EXAMPLES_DIR = 'D:/GitHub/rustmd/examples';
  const SELFTEST_OUT_DIR =
    'C:/Users/River/AppData/Local/Temp/opencode/rustmd-selftest';

  /// Text nodes outside code/pre still holding a full math delimiter pair
  /// => a formula that was never typeset.
  function residualRawMath(box) {
    const walker = document.createTreeWalker(box, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const p = node.parentElement;
        if (!p) return NodeFilter.FILTER_REJECT;
        // toUpperCase: SVG elements report lowercase tagNames — the <style>
        // inside mermaid's <svg> holds CSS whose selectors can look like
        // raw $$ / $ pairs and false-positive otherwise.
        const tag = p.tagName.toUpperCase();
        if (tag === 'CODE' || tag === 'PRE' || tag === 'SCRIPT' || tag === 'STYLE') {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const bad = [];
    while (walker.nextNode()) {
      const t = walker.currentNode.nodeValue;
      if ((t.match(/\$\$/g) || []).length >= 2) bad.push('display: ' + t.trim().slice(0, 50));
      else if (/(^|[^\\$])\$[^\n]*?[^\s$\\]\$(?!\$)/.test(t)) bad.push('inline: ' + t.trim().slice(0, 50));
    }
    return bad;
  }

  /// Count saturated (chart/photo) pixels of an exported PNG. Event-based
  /// load wait — img.decode() never settles for blob: URLs in Chromium.
  async function analyzePngPixels(bytes) {
    const url = URL.createObjectURL(new Blob([bytes], { type: 'image/png' }));
    try {
      const img = new Image();
      img.src = url;
      await new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('img load timeout')), 30000);
        img.addEventListener('load', () => { clearTimeout(t); resolve(); }, { once: true });
        img.addEventListener('error', () => { clearTimeout(t); reject(new Error('img load error')); }, { once: true });
      });
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let saturated = 0;
      let nonWhite = 0;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2];
        if (Math.max(r, g, b) - Math.min(r, g, b) > 30) saturated++;
        if (r < 245 || g < 245 || b < 245) nonWhite++;
      }
      return { w: canvas.width, h: canvas.height, saturatedPixels: saturated, nonWhitePixels: nonWhite };
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  // ---------------- Remote-image presence in the exported PNG ----------------
  // 2D normalized cross-correlation (NCC) of each reference image over the
  // export. (An earlier row-mean SAD attempt was unreliable: the COS charts
  // are grayscale and the row means of OTHER charts/tables in the document
  // partially correlate, so it picked spurious y positions and scored 26–38
  // even for exports that contained the image — while the true position
  // scores NCC ≥ 0.92 at full res.) Block NCC is far more discriminative:
  // present ≈ 0.9+, non-image regions < 0.5.
  //
  // Geometry: the export stage is always 948 CSS px wide with the article
  // (and its images) at x=44..904, so the image occupies a FIXED FRACTION
  // of the PNG width regardless of the export scale. The export is
  // downsampled to VERIFY_WORK px for speed; the reference is resampled to
  // the matching size and slid vertically (small x tolerance) to find the
  // best NCC.
  const VERIFY_WORK = 128;
  const VERIFY_PRESENT_NCC = 0.75;


  function waitImg(img, timeoutMs) {
    return new Promise((resolve, reject) => {
      if (img.complete && img.naturalWidth > 0) return resolve();
      const t = setTimeout(() => reject(new Error('image load timeout')), timeoutMs);
      img.addEventListener('load', () => { clearTimeout(t); resolve(); }, { once: true });
      img.addEventListener('error', () => { clearTimeout(t); reject(new Error('image load error')); }, { once: true });
    });
  }

  function nonWhiteOf(canvas) {
    const d = canvas.getContext('2d', { willReadFrequently: true })
      .getImageData(0, 0, canvas.width, canvas.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] < 245 || d[i + 1] < 245 || d[i + 2] < 245) n++;
    }
    return n;
  }

  async function pngToRChannel(bytes, width) {
    const url = URL.createObjectURL(new Blob([bytes], { type: 'image/png' }));
    try {
      const img = new Image();
      img.src = url;
      await new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('png load timeout')), 60000);
        img.addEventListener('load', () => { clearTimeout(t); resolve(); }, { once: true });
        img.addEventListener('error', () => { clearTimeout(t); reject(new Error('png load error')); }, { once: true });
      });
      const c = document.createElement('canvas');
      c.width = width;
      c.height = Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * width));
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, c.width, c.height);
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      const r = new Float32Array(c.width * c.height);
      for (let i = 0; i < r.length; i++) r[i] = d[i * 4];
      return { r, w: c.width, h: c.height, natW: img.naturalWidth, natH: img.naturalHeight };
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  /// Best 2D NCC of each remote image's bytes over the export. `refs`
  /// carry the raw bytes from the SAME Rust fetch path the export uses, so
  /// a "present" verdict proves the full chain: Rust fetch → data-URL swap
  /// → html2canvas raster → PNG file.
  async function verifyRemoteImagesInPng(pngBytes, refs) {
    const { r, w, h, natH } = await pngToRChannel(pngBytes, VERIFY_WORK);
    // Image left edge / width are fixed fractions of the PNG width
    // (stage 948 CSS px, image at x=44..904) — scale independent.
    const x0 = Math.round((44 * w) / 948);
    const tw = Math.max(8, Math.round((860 * w) / 948));
    const xLo = Math.max(0, x0 - 2);
    const xHi = Math.min(w - tw, x0 + 2);
    const results = [];
    for (const ref of refs) {
      let best = { ncc: -1, mad: Infinity, y: -1 };
      let dims = null;
      let error = null;
      try {
        // Data URL — the same decode path the export itself uses.
        const url = bytesToDataUrl(ref.bytes, guessImageMime(ref.bytes));
        const img = new Image();
        img.src = url;
        await waitImg(img, 30000);
        dims = img.naturalWidth + 'x' + img.naturalHeight;
        const th = Math.max(8, Math.round((img.naturalHeight / img.naturalWidth) * tw));
        const c = document.createElement('canvas');
        c.width = tw; c.height = th;
        c.getContext('2d').drawImage(img, 0, 0, tw, th);
        const rd = c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, tw, th).data;
        const refR = new Float32Array(tw * th);
        let cSum = 0, cSumsq = 0;
        for (let i = 0; i < refR.length; i++) {
          const v = rd[i * 4];
          refR[i] = v;
          cSum += v;
          cSumsq += v * v;
        }
        const n = tw * th;
        const cMean = cSum / n;
        const cVar = Math.max(1e-6, cSumsq / n - cMean * cMean);
        for (let y = 0; y + th <= h; y++) {
          for (let x = xLo; x <= xHi; x++) {
            let bSum = 0, bSumsq = 0, bRC = 0, bMad = 0;
            for (let ry = 0; ry < th; ry++) {
              const ro = (y + ry) * w + x;
              const rk = ry * tw;
              for (let rx = 0; rx < tw; rx++) {
                const v = r[ro + rx];
                const t = refR[rk + rx];
                bSum += v;
                bSumsq += v * v;
                bRC += v * t;
                bMad += v > t ? v - t : t - v;
              }
            }
            const bMean = bSum / n;
            const bVar = bSumsq / n - bMean * bMean;
            if (bVar < 1e-3) continue; // blank (white) region — NCC undefined
            const ncc = (bRC / n - bMean * cMean) / Math.sqrt(bVar * cVar);
            if (ncc > best.ncc) best = { ncc, mad: bMad / n, y };
          }
        }
      } catch (e) {
        error = String(e);
      }
      // Report the ORIGINAL https URL (not the data: URL — it is huge).
      results.push({
        url: ref.url,
        dims,
        ncc: best.ncc < 0 ? null : +best.ncc.toFixed(3),
        mad: Number.isFinite(best.mad) ? +best.mad.toFixed(2) : null,
        atY: best.y,
        // Best position in FULL-RES PNG pixels (handy for humans).
        atYPng: best.y < 0 ? null : Math.round(best.y * (natH / h)),
        present: best.ncc >= VERIFY_PRESENT_NCC,
        error,
      });
    }
    return results;
  }

  /// WebView2 pipeline probe: isolates WHICH stage drops the remote image
  /// from the export. Stages, in order:
  ///   1. bytes → typed blob → <img src=blob:>: does the webview decode it?
  ///      (Historical: the 02:31 export used this path, but Tauri returned
  ///      the bytes as a plain array-like, so the Blob contained the
  ///      STRINGIFIED byte list and decode always failed — the root cause
  ///      of the blank-image exports. With the api.js Uint8Array
  ///      normalization this stage should now succeed; recorded either way.)
  ///   2. bytes → <img src=data:>: does the webview decode a data URL?
  ///   3. bytes → <img> → drawImage → pixels: direct canvas decode.
  ///   4. stage <img src=https:>: does the webview load the remote image?
  ///   5. html2canvas over the ORIGINAL cross-origin img (useCORS path —
  ///      expected blank: no CORS headers on the COS host).
  ///   6. stage <img src=data:swap>: does html2canvas rasterize the
  ///      data-swapped image (the ACTUAL export path)?
  /// A present image at scale 1 is ~860×594 and ≈53% non-white → ~270k
  /// non-white px on the stage canvas; a blank export gives ≈0.
  async function probeExportPipeline(url) {
    const stage = document.createElement('div');
    stage.className = 'export-stage';
    const article = document.createElement('article');
    article.className = 'markdown-body';
    stage.appendChild(article);
    document.body.appendChild(stage);
    const result = { url };
    try {
      const bytes = await api.fetchImageBytes(url);
      result.fetchedBytes = bytes.length;
      // Byte type as seen by JS (Tauri used to return a plain array-like;
      // api.js now normalizes to Uint8Array).
      result.bytesType = Object.prototype.toString.call(bytes);
      result.bytesIsUint8 = bytes instanceof Uint8Array;
      const mime = guessImageMime(bytes);
      result.mime = mime;
      const blobUrl = URL.createObjectURL(new Blob([bytes], { type: mime }));
      const dataUrl = bytesToDataUrl(bytes, mime);

      // 1) blob decode (the OLD export path — expected to fail here)
      const refImg = new Image();
      refImg.src = blobUrl;
      await waitImg(refImg, 15000).catch((e) => { result.blobImgError = String(e); });
      result.blobImg = { complete: refImg.complete, dims: refImg.naturalWidth + 'x' + refImg.naturalHeight };
      URL.revokeObjectURL(blobUrl);

      // 2+3) data: URL decode + direct drawImage
      const dataImg = new Image();
      dataImg.src = dataUrl;
      await waitImg(dataImg, 15000).catch((e) => { result.dataImgError = String(e); });
      result.dataImg = { complete: dataImg.complete, dims: dataImg.naturalWidth + 'x' + dataImg.naturalHeight };
      if (dataImg.naturalWidth > 0) {
        const c = document.createElement('canvas');
        c.width = dataImg.naturalWidth; c.height = dataImg.naturalHeight;
        c.getContext('2d').drawImage(dataImg, 0, 0);
        result.drawImageNonWhite = nonWhiteOf(c);
      }

      // 4) webview load of the original https img
      const img = document.createElement('img');
      img.src = url;
      article.appendChild(img);
      await waitImg(img, 20000).catch((e) => { result.httpsImgError = String(e); });
      result.httpsImg = { complete: img.complete, dims: img.naturalWidth + 'x' + img.naturalHeight };

      // 5) html2canvas over the original cross-origin img
      const { default: html2canvas } = await import('html2canvas');
      let canvas = await html2canvas(stage, { scale: 1, backgroundColor: '#ffffff', useCORS: true, logging: false });
      result.h2cOriginalNonWhite = nonWhiteOf(canvas);

      // 6) html2canvas over the data-swapped img (the ACTUAL export path)
      img.removeAttribute('srcset');
      img.src = dataUrl;
      await waitImg(img, 20000).catch((e) => { result.swapImgError = String(e); });
      result.swapImg = { complete: img.complete, dims: img.naturalWidth + 'x' + img.naturalHeight };
      canvas = await html2canvas(stage, { scale: 1, backgroundColor: '#ffffff', useCORS: true, logging: false });
      result.h2cSwapNonWhite = nonWhiteOf(canvas);
    } catch (e) {
      result.error = String(e && e.stack || e);
    } finally {
      stage.remove();
    }
    return result;
  }

  const report = {
    startedAt: new Date().toISOString(),
    ok: false,
    entries: [],
    errors: [],
  };
  // Serve the examples vault through the `rmd` image protocol for this
  // run (local-image regression); restore the user's root afterwards.
  await api.setNotesRoot(SELFTEST_EXAMPLES_DIR);
  try {
    const notes = await api.listNotes(SELFTEST_EXAMPLES_DIR);
    for (const meta of notes) {
      const entry = { path: meta.path, remoteImagesInSource: null };
      const { body } = await api.readNote(SELFTEST_EXAMPLES_DIR, meta.path);
      entry.remoteImagesInSource = (body.match(/!\[[^\]]*\]\(\s*https?:/g) || []).length;
      // Local (vault) image refs — anything that is not a remote/data/
      // blob/file URL. These go through the `rmd` protocol; the preview
      // resolves them relative to THIS note's folder.
      const localSrcs = (body.match(/!\[[^\]]*\]\(([^)]*)\)/g) || [])
        .map((m) => m.slice(m.indexOf('(') + 1, -1).trim().split(/\s+/)[0])
        .filter((s) => s && !/^(https?:|data:|blob:|file:)/i.test(s));
      entry.localImagesInSource = localSrcs.length;
      setImageContext(SELFTEST_EXAMPLES_DIR, meta.path);

      // 1) render through the real preview pipeline
      const box = document.createElement('div');
      box.className = 'markdown-body';
      box.style.cssText = 'position:fixed;left:-100000px;top:0;width:900px;';
      document.body.appendChild(box);
      const t0 = performance.now();
      await renderPreview(body, box);
      // Remote + local imgs: renderPreview only guarantees DOM + math +
      // mermaid are done, NOT that <img> fetches settled — wait for
      // load/error before snapshotting (the old immediate check raced and
      // reported false).
      // On Windows the rmd (local) origin is `http://rmd.localhost/…`,
      // which also matches ^https?: — exclude it here so the remote
      // fetch probe doesn't try a real network fetch of a vault file.
      const remoteImgs = [...box.querySelectorAll('img')].filter((i) => {
        const src = i.getAttribute('src') || '';
        return /^https?:/.test(src) && !isRmdUrl(src);
      });
      const localImgs = [...box.querySelectorAll('img')].filter((i) =>
        isRmdUrl(i.getAttribute('src') || '')
      );
      await Promise.all(
        [...remoteImgs, ...localImgs].map(
          (i) =>
            new Promise((resolve) => {
              if (i.complete && i.naturalWidth > 0) return resolve();
              const t = setTimeout(resolve, 20000);
              i.addEventListener('load', () => { clearTimeout(t); resolve(); }, { once: true });
              i.addEventListener('error', () => { clearTimeout(t); resolve(); }, { once: true });
            })
        )
      );
      // Local images must actually decode in the preview — a broken
      // rmd URL (wrong origin form, path-escape rejection, …) would
      // otherwise only surface in the export check.
      if (localImgs.some((i) => !(i.complete && i.naturalWidth > 0))) {
        report.errors.push(`${meta.path}: local image failed to load in preview`);
      }
      // Independent probe of the backend fetch path (the same one export
      // uses per image): distinguishes export-stage blanks caused by the
      // Rust fetch vs. webview img loading vs. html2canvas rasterization.
      const remoteUrls = [...new Set(remoteImgs.map((i) => i.getAttribute('src')))];
      const remoteFetchResults = await Promise.all(
        remoteUrls.map(async (url) => {
          try {
            const bytes = await api.fetchImageBytes(url);
            return { url, ok: true, bytes };
          } catch (e) {
            return { url, ok: false, error: String(e) };
          }
        })
      );
      const remoteFetch = remoteFetchResults.map(({ url, ok, error, bytes }) =>
        bytes ? { url, ok, bytes: bytes.length } : { url, ok, error }
      );
      const remoteRefs = remoteFetchResults.filter((r) => r.ok);
      // Local refs: bytes via the SAME Rust read path the export uses
      // (read_local_image), so a "present" verdict proves the full
      // chain: rmd rewrite → read_local_image → data-URL swap →
      // html2canvas raster → PNG file.
      const localRefs = [];
      for (const src of [...new Set(localSrcs)]) {
        const dir = meta.path.includes('/')
          ? meta.path.slice(0, meta.path.lastIndexOf('/')) + '/'
          : '';
        const abs = `${SELFTEST_EXAMPLES_DIR}/${dir}${src.replace(/\\/g, '/')}`;
        try {
          localRefs.push({ url: `local:${src}`, bytes: await api.readLocalImage(abs) });
        } catch (e) {
          report.errors.push(
            `${meta.path}: local image unreadable via backend: ${src} (${e})`
          );
        }
      }
      entry.render = {
        ms: Math.round(performance.now() - t0),
        mermaidDiagrams: box.querySelectorAll('.mermaid-diagram').length,
        mermaidErrors: box.querySelectorAll('.mermaid-error').length,
        mjxTypeset: box.querySelectorAll('mjx-container').length,
        mjxErrors: box.querySelectorAll('mjx-merror').length,
        residualRawMath: residualRawMath(box),
        remoteImgsLoaded: remoteImgs.map((i) => i.complete && i.naturalWidth > 0),
        localImgsLoaded: localImgs.map((i) => i.complete && i.naturalWidth > 0),
        remoteFetch,
      };
      // Multi-line math guard (regression: DISPLAY_MATH_RE lost its global
      // flag, so only the FIRST $$…$$ block was protected from marked's
      // escaping; `\\` row separators collapsed and every matrix/align/
      // cases rendered as ONE squashed line. The batch still typeset
      // "successfully", so error counts never flagged it — only geometry
      // reveals it: a rendered 2-line environment is ≥ ~2200 SVG units
      // tall, a squashed one is ≤ ~1150.)
      const displayBlocks = body.match(/(^|\n)\s*\$\$[\s\S]*?\$\$(?=\n|$)/g) || [];
      const multirowBlocks = displayBlocks.filter((b) => b.includes('\\\\'));
      let maxVbHeight = 0;
      for (const svg of box.querySelectorAll('mjx-container svg')) {
        const vb = (svg.getAttribute('viewBox') || '').split(/\s+/);
        maxVbHeight = Math.max(maxVbHeight, parseFloat(vb[3]) || 0);
      }
      entry.render.multirowMath = {
        blocks: multirowBlocks.length,
        maxVbHeight: Math.round(maxVbHeight),
      };
      if (multirowBlocks.length && maxVbHeight < 2000) {
        report.errors.push(
          `${meta.path}: multi-line math squashed to one line ` +
            `(max mjx viewBox height ${Math.round(maxVbHeight)} < 2000)`
        );
      }
      box.remove();

      // 2) PNG export (remote images → fetch_image_bytes, local vault
      //    images → read_local_image in Rust)
      const t1 = performance.now();
      const png = await exportPng(body);
      entry.png = {
        bytes: png.data.length,
        ms: Math.round(performance.now() - t1),
        pixels: await analyzePngPixels(png.data),
      };
      if (remoteRefs.length || localRefs.length) {
        entry.png.imagePresence = await verifyRemoteImagesInPng(
          png.data,
          [...remoteRefs, ...localRefs]
        );
      }
      await api.writeBytes(`${SELFTEST_OUT_DIR}/${meta.path}.png`, png.data);

      // 3) PDF export
      const t2 = performance.now();
      const pdf = await exportPdf(body);
      entry.pdf = { bytes: pdf.data.length, ms: Math.round(performance.now() - t2) };
      await api.writeBytes(`${SELFTEST_OUT_DIR}/${meta.path}.pdf`, pdf.data);

      report.entries.push(entry);
      console.log('[selftest] done', meta.path);
    }
    // 4) WebView2 export pipeline probe — one remote URL is enough to
    //    localize which stage (blob decode / drawImage / html2canvas)
    //    drops the image from the export.
    const probeUrl = report.entries
      .flatMap((e) => e.render.remoteFetch || [])
      .filter((f) => f.ok)
      .map((f) => f.url)[0];
    if (probeUrl) {
      report.probe = await probeExportPipeline(probeUrl);
    }
    // The point of this selftest is that exports contain their remote
    // AND local (vault) images — a missing one is a failure, not just a
    // data point.
    for (const e of report.entries) {
      for (const p of e.png.imagePresence || []) {
        if (!p.present) {
          report.errors.push(
            `${e.path}: image not found in exported PNG (ncc=${p.ncc}): ${p.url}`
          );
        }
      }
    }
    report.ok = report.errors.length === 0;
  } catch (e) {
    report.errors.push(String(e && e.stack || e));
  } finally {
    // Restore the user's notes root (and image context) if they had one.
    if (getState().dir) {
      await api.setNotesRoot(getState().dir).catch(() => {});
    }
    setImageContext(getState().dir, getState().current);
  }
  report.finishedAt = new Date().toISOString();
  try {
    await api.writeText(`${SELFTEST_OUT_DIR}/report.json`, JSON.stringify(report, null, 2));
    console.log('[selftest] report written', report.ok ? 'OK' : 'FAILED');
  } catch (e) {
    console.error('[selftest] failed to write report:', e);
  }
}
