// High-res PNG / PDF export.
//
// Strategy: render the note into an off-screen stage styled like the in-app
// preview, rasterize it with html2canvas at 3x scale (~288 DPI, crisp on
// HiDPI screens), then hand back PNG bytes or slice the raster into pages
// and wrap it in a multi-page PDF with lossless PNG images (288 DPI without
// JPEG artifacts — the old 2x/JPEG single page looked blurry and fuzzy).

import { renderPreview, isRmdUrl, rmdUrlPath } from './preview.js';
import { api } from './api.js';
import { bytesToDataUrl, guessImageMime } from './imgutil.js';

const CONTENT_WIDTH = 860; // matches .markdown-body max-width
const PAD_TOP = 48; // .export-stage top padding (48px 44px 64px)
const SCALE = 3; // 3 * 96 px/in ≈ 288 DPI
const MAX_CANVAS_HEIGHT = 30000; // device-px cap; below WebView canvas limits
const MIN_SCALE = 0.25; // very long notes stay usable instead of failing
const PDF_PAGE_HEIGHT = 1340; // css px per PDF page (A4-ish aspect at 948 px wide)

/// Export raster scale, reduced for very long notes to keep the canvas under
/// MAX_CANVAS_HEIGHT device pixels.
function exportScale(cssHeight) {
  return cssHeight * SCALE > MAX_CANVAS_HEIGHT
    ? Math.max(MIN_SCALE, MAX_CANVAS_HEIGHT / cssHeight)
    : SCALE;
}

function buildStage(source, kind) {
  const stage = document.createElement('div');
  stage.className = 'export-stage';
  const article = document.createElement('article');
  article.className = 'markdown-body';
  stage.appendChild(article);
  document.body.appendChild(stage);
  // renderPreview is async (mermaid diagrams render in the background);
  // awaiting it before rasterizing guarantees the SVGs are in the DOM.
  const ready = renderPreview(source, article, kind);
  return { stage, ready };
}

/// html2canvas on WebKitGTK tries to parse the computed style of native
/// `<input type="checkbox">` nodes (task lists) and can throw on Linux-only
/// computed values such as `color(srgb ...)`. Replace them with plain spans
/// in the off-screen export stage; the preview keeps real checkboxes.
function normalizeTaskCheckboxes(root) {
  for (const input of root.querySelectorAll('input[type="checkbox"]')) {
    const checked = input.checked || input.hasAttribute('checked');
    const box = document.createElement('span');
    box.className = `task-checkbox${checked ? ' checked' : ''}`;
    box.textContent = checked ? '✓' : '';
    box.setAttribute('aria-hidden', 'true');
    input.replaceWith(box);
  }
}

// ---------------- Non-same-origin images ----------------

/// html2canvas cannot draw cross-origin images into its canvas (CORS taint),
/// which is why such pictures came out blank in exports. Two kinds:
///   - remote http(s) images (no CORS on most hosts) → fetch through the
///     backend (no CORS restriction there);
///   - vault images served by the `rmd` protocol (a foreign origin to the
///     export stage) → read from the open notes root.
/// Either way the src is swapped for an inline data: URL before rasterizing.
///
/// Why data: and not blob: — the selftest pipeline probe proved that in
/// this app's WebView2, `<img src="blob:...">` fires `error` and never
/// decodes (complete=true, naturalWidth=0) even for a typed blob, while
/// the SAME bytes load fine from the original https URL. Data URLs are
/// same-origin by definition: no CORS taint, no blob-URL quirk, and
/// html2canvas rasterizes them reliably.
///
/// NB: the load wait uses `load`/`error` events, NOT img.decode() — in
/// Chromium/WebView2, decode() never settles for object/data URLs (the
/// image itself is fully loaded), which hung the whole export.
/// Run async tasks with a small concurrency cap. A note with dozens of
/// remote images must not occupy every blocking Rust worker at once.
async function mapLimit(items, limit, task) {
  let next = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (next < items.length) {
        const index = next;
        next += 1;
        await task(items[index], index);
      }
    }
  );
  await Promise.all(workers);
}

async function inlineRemoteImages(stage) {
  const remotes = [...stage.querySelectorAll('img')].filter((img) => {
    const src = img.currentSrc || img.getAttribute('src') || '';
    return isRmdUrl(src) || /^https?:\/\//i.test(src);
  });
  await mapLimit(remotes, 4, async (img) => {
    const src = img.currentSrc || img.getAttribute('src');
    try {
      const image = isRmdUrl(src)
        ? await api.readLocalImage(rmdUrlPath(src))
        : await api.fetchImageBytes(src);
      img.removeAttribute('srcset');
      img.src = bytesToDataUrl(
        image.bytes,
        image.mime || guessImageMime(image.bytes)
      );
      await waitImageLoad(img);
    } catch (err) {
      console.warn('图片拉取失败，导出中该位置将为空白：', src, err);
    }
  });
}

function isSvgDataUrl(src) {
  return /^data:image\/svg\+xml(?:[;,]|$)/i.test(String(src));
}

/// Chromium interprets the source rectangle of
/// `ctx.drawImage(svgImg, sx, sy, sw, sh, …)` in the SVG's user (viewBox)
/// units, not in decoded pixels. html2canvas always passes a source rectangle
/// (`naturalWidth` × `naturalHeight`), so a viewBox-only SVG gets cropped to
/// its top-left corner and its text is blown up in the raster output (the
/// QuantV5 charts showed a giant title and no plot). A plain bitmap has no
/// such quirk: rasterize SVG `<img>` elements at the export resolution and
/// let html2canvas draw a normal PNG whose source rectangle is the whole
/// surface.
const MAX_SVG_RASTER_PIXELS = 24_000_000; // per image: bounds transient memory

async function rasterizeSvgImages(stage, scale) {
  const images = [...stage.querySelectorAll('img')].filter((img) =>
    isSvgDataUrl(img.currentSrc || img.getAttribute('src') || '')
  );
  await mapLimit(images, 2, async (img) => {
    try {
      await waitImageLoad(img);
      const rect = img.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      // Freeze the layout box: swapping the src must not reflow the stage
      // (page breaks and canvas height are measured afterwards).
      img.style.width = `${rect.width}px`;
      img.style.height = `${rect.height}px`;
      const rawWidth = rect.width * scale;
      const rawHeight = rect.height * scale;
      const fit = Math.min(
        1,
        Math.sqrt(MAX_SVG_RASTER_PIXELS / (rawWidth * rawHeight))
      );
      const width = Math.max(1, Math.round(rawWidth * fit));
      const height = Math.max(1, Math.round(rawHeight * fit));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('2D canvas context unavailable');
      // No source rectangle here: that would crop in viewBox units again.
      ctx.drawImage(img, 0, 0, width, height);
      img.removeAttribute('srcset');
      img.src = canvas.toDataURL('image/png');
      await waitImageLoad(img);
    } catch (err) {
      console.warn('SVG 图片栅格化失败，导出中该位置可能为空白：', err);
    }
  });
}

/// Resolve once `img` has loaded its current src (or reject on error /
/// 20 s timeout). Event-based because img.decode() hangs on blob: URLs.
function waitImageLoad(img, timeoutMs = 20000) {
  if (img.complete) {
    return img.naturalWidth > 0
      ? Promise.resolve()
      : Promise.reject(new Error('image load error'));
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => { cleanup(); reject(new Error('image load timeout')); },
      timeoutMs
    );
    function cleanup() {
      clearTimeout(timer);
      img.removeEventListener('load', onLoad);
      img.removeEventListener('error', onError);
    }
    function onLoad() { cleanup(); resolve(); }
    function onError() { cleanup(); reject(new Error('image load error')); }
    img.addEventListener('load', onLoad, { once: true });
    img.addEventListener('error', onError, { once: true });
  });
}

// ---------------- Rasterization ----------------

async function renderToCanvas(source, kind = 'markdown') {
  const { default: html2canvas } = await import('html2canvas');
  const { stage, ready } = buildStage(source, kind);
  try {
    await ready;
    normalizeTaskCheckboxes(stage);
    // Pin the article width explicitly (defensive): the stage lives outside
    // .content, so don't rely on the cascade — CONTENT_WIDTH matches
    // .markdown-body's CSS max-width, and 948 = 860 + 2*44 padding.
    stage.firstElementChild.style.maxWidth = `${CONTENT_WIDTH}px`;
    // Remote images are swapped for inline data: URLs (nothing to revoke).
    await inlineRemoteImages(stage);
    // SVG images must be bitmaps before html2canvas draws them (see above).
    // Rasterize at the scale the canvas will use; the frozen image boxes keep
    // the stage height unchanged, but measure again in case of rounding.
    await rasterizeSvgImages(stage, exportScale(stage.offsetHeight));
    const cssWidth = stage.offsetWidth;
    const cssHeight = stage.offsetHeight;
    // Keep the canvas bounded for very long notes (scale may drop below 3).
    const scale = exportScale(cssHeight);
    const canvas = await html2canvas(stage, {
      scale,
      backgroundColor: getComputedStyle(stage).backgroundColor,
      useCORS: true,
      logging: false,
    });
    return {
      canvas,
      scale,
      cssWidth,
      cssHeight,
      pageCuts: computePageCuts(stage),
    };
  } finally {
    stage.remove();
  }
}

/// Page-break positions for PDF export, in css px relative to the stage.
/// Breaks only happen at block boundaries (PAD_TOP above a block top), so
/// paragraphs/tables/images are never split mid-way. Blocks taller than a
/// page's content area are hard-split at fixed intervals.
function computePageCuts(stage) {
  const article = stage.firstElementChild;
  const stageTop = stage.getBoundingClientRect().top;
  const total = stage.offsetHeight;
  const content = PDF_PAGE_HEIGHT - PAD_TOP; // room a block gets before a break
  const cuts = [];
  let pageStart = 0; // stage-relative css px where the current page begins
  let prevBottom = 0; // bottom of the last block — a cut must never land
  //                       INSIDE a block, so when the inter-block gap is
  //                       smaller than PAD_TOP (collapsed margins) the cut
  //                       is clamped to prevBottom instead of top - PAD_TOP.
  for (const el of article.children) {
    const rect = el.getBoundingClientRect();
    const top = rect.top - stageTop;
    const height = rect.height;
    if (height > content) {
      for (let t = top + content; t < top + height; t += PDF_PAGE_HEIGHT) {
        cuts.push(t);
      }
      pageStart = cuts[cuts.length - 1];
      prevBottom = top + height;
    } else if (top - pageStart > content) {
      const cut = Math.max(top - PAD_TOP, prevBottom);
      cuts.push(cut);
      pageStart = cut;
      prevBottom = top + height;
    } else {
      prevBottom = top + height;
    }
  }
  return { cuts, total };
}

// ---------------- Exports ----------------

/** @returns {Promise<{data: Uint8Array, ext: 'png', mime: string}>} */
export async function exportPng(source, kind = 'markdown') {
  const { canvas } = await renderToCanvas(source, kind);
  const blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas.toBlob failed'))), 'image/png')
  );
  const data = new Uint8Array(await blob.arrayBuffer());
  return { data, ext: 'png', mime: 'image/png' };
}

/** @returns {Promise<{data: Uint8Array, ext: 'pdf', mime: string}>} */
export async function exportPdf(source, kind = 'markdown') {
  const { canvas, cssWidth, pageCuts } = await renderToCanvas(source, kind);
  const { jsPDF } = await import('jspdf');
  // CSS px -> PDF points (96 px/in, 72 pt/in).
  const wPt = cssWidth * 0.75;
  const pxPerCss = canvas.width / cssWidth; // ≈ scale (guard against rounding)
  const { cuts, total } = pageCuts;
  const bounds = [0, ...cuts, total];
  const doc = new jsPDF({
    orientation: 'p',
    unit: 'pt',
    format: [wPt, (bounds[1] - bounds[0]) * 0.75],
    // jsPDF defaults to compress:false, which stores image streams raw —
    // a full-page canvas would bloat the PDF by 30x. Flate keeps it sane.
    compress: true,
  });
  for (let i = 0; i + 1 < bounds.length; i++) {
    const y0 = bounds[i];
    const y1 = bounds[i + 1];
    const hPx = Math.max(1, Math.round((y1 - y0) * pxPerCss));
    const slice = document.createElement('canvas');
    slice.width = canvas.width;
    slice.height = hPx;
    const ctx = slice.getContext('2d');
    if (!ctx) throw new Error('2D canvas context unavailable');
    ctx.drawImage(
      canvas,
      0,
      Math.round(y0 * pxPerCss),
      canvas.width,
      hPx,
      0,
      0,
      slice.width,
      slice.height
    );
    const hPt = (y1 - y0) * 0.75;
    if (i > 0) doc.addPage([wPt, hPt]);
    // PNG (not JPEG): no compression halo around text.
    doc.addImage(slice.toDataURL('image/png'), 'PNG', 0, 0, wPt, hPt);
  }
  const data = new Uint8Array(doc.output('arraybuffer'));
  return { data, ext: 'pdf', mime: 'application/pdf' };
}

function loadDataUrlImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('could not decode captured HTML image'));
    img.src = dataUrl;
  });
}

/// Multi-page PDF from the full-page PNG captured in the sandboxed HTML
/// renderer. The raster is already at a fixed CSS width (948 px), so pages
/// are simple horizontal slices at the same A4-ish ratio as the DOM exporter.
/** @returns {Promise<{data: Uint8Array, ext: 'pdf', mime: string}>} */
export async function pdfFromPngDataUrl(dataUrl, cssWidth) {
  const width = Number(cssWidth);
  if (!dataUrl || !(width > 0)) {
    throw new Error('invalid captured HTML image');
  }
  const img = await loadDataUrlImage(dataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');
  ctx.drawImage(img, 0, 0);
  const pageCssHeight = width * (PDF_PAGE_HEIGHT / 948);
  const pxPerCss = canvas.width / width;
  const pagePx = Math.max(1, Math.round(pageCssHeight * pxPerCss));
  const { jsPDF } = await import('jspdf');
  const wPt = width * 0.75;
  const doc = new jsPDF({
    orientation: 'p',
    unit: 'pt',
    format: [wPt, pageCssHeight * 0.75],
    compress: true,
  });
  let page = 0;
  for (let y = 0; y < canvas.height; y += pagePx, page += 1) {
    const height = Math.min(pagePx, canvas.height - y);
    const slice = document.createElement('canvas');
    slice.width = canvas.width;
    slice.height = height;
    const sliceCtx = slice.getContext('2d');
    if (!sliceCtx) throw new Error('2D canvas context unavailable');
    sliceCtx.drawImage(canvas, 0, y, canvas.width, height, 0, 0, canvas.width, height);
    const hPt = (height / pxPerCss) * 0.75;
    if (page > 0) doc.addPage([wPt, hPt]);
    doc.addImage(
      slice.toDataURL('image/png'),
      'PNG',
      0,
      0,
      wPt,
      hPt
    );
  }
  const data = new Uint8Array(doc.output('arraybuffer'));
  return { data, ext: 'pdf', mime: 'application/pdf' };
}
