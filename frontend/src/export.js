// High-res PNG / PDF export.
//
// Strategy: render the note into an off-screen stage styled like the in-app
// preview, rasterize it with html2canvas at 3x scale (~288 DPI, crisp on
// HiDPI screens), then hand back PNG bytes or slice the raster into pages
// and wrap it in a multi-page PDF with lossless PNG images (288 DPI without
// JPEG artifacts — the old 2x/JPEG single page looked blurry and fuzzy).

import { renderPreview } from './preview.js';
import { api } from './api.js';

const CONTENT_WIDTH = 860; // matches .markdown-body max-width
const PAD_TOP = 48; // .export-stage top padding (48px 44px 64px)
const SCALE = 3; // 3 * 96 px/in ≈ 288 DPI
const MAX_CANVAS_HEIGHT = 14000; // device-px cap: keeps canvas memory bounded
const PDF_PAGE_HEIGHT = 1340; // css px per PDF page (A4-ish aspect at 948 px wide)

function buildStage(markdownSource) {
  const stage = document.createElement('div');
  stage.className = 'export-stage';
  const article = document.createElement('article');
  article.className = 'markdown-body';
  stage.appendChild(article);
  document.body.appendChild(stage);
  // renderPreview is async (mermaid diagrams render in the background);
  // awaiting it before rasterizing guarantees the SVGs are in the DOM.
  const ready = renderPreview(markdownSource, article);
  return { stage, ready };
}

// ---------------- Remote images ----------------

/// html2canvas cannot draw cross-origin images into its canvas (CORS taint),
/// which is why external pictures came out blank in exports. Fetch them
/// through the backend (no CORS restriction there) and swap the src for a
/// blob URL before rasterizing. Returns the blob URLs to revoke later.
async function inlineRemoteImages(stage) {
  const remotes = [...stage.querySelectorAll('img')].filter((img) => {
    const src = img.currentSrc || img.getAttribute('src') || '';
    return /^https?:\/\//i.test(src);
  });
  const blobUrls = [];
  await Promise.all(
    remotes.map(async (img) => {
      const src = img.currentSrc || img.getAttribute('src');
      try {
        const bytes = await api.fetchImageBytes(src);
        const url = URL.createObjectURL(
          new Blob([bytes], { type: guessImageMime(bytes) })
        );
        blobUrls.push(url);
        img.removeAttribute('srcset');
        img.src = url;
        await img.decode();
      } catch (err) {
        console.warn('外链图片拉取失败，导出中该位置将为空白：', src, err);
      }
    })
  );
  return blobUrls;
}

function guessImageMime(bytes) {
  if (bytes.length > 3 && bytes[0] === 0x89 && bytes[1] === 0x50) return 'image/png';
  if (bytes.length > 2 && bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg';
  if (bytes.length > 5 && bytes[0] === 0x47 && bytes[1] === 0x49) return 'image/gif';
  if (
    bytes.length > 11 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 &&
    bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45
  )
    return 'image/webp';
  if (bytes.length > 3 && bytes[0] === 0x42 && bytes[1] === 0x4d) return 'image/bmp';
  return 'application/octet-stream';
}

// ---------------- Rasterization ----------------

async function renderToCanvas(markdownSource) {
  const { default: html2canvas } = await import('html2canvas');
  const { stage, ready } = buildStage(markdownSource);
  try {
    await ready;
    // Drop the max-width so the article fills the stage at STAGE_WIDTH - 2*44.
    stage.firstElementChild.style.maxWidth = `${CONTENT_WIDTH}px`;
    const blobUrls = await inlineRemoteImages(stage);
    try {
      const cssWidth = stage.offsetWidth;
      const cssHeight = stage.offsetHeight;
      // Keep the canvas bounded for very long notes (scale may drop below 3).
      const scale =
        cssHeight * SCALE > MAX_CANVAS_HEIGHT
          ? Math.max(1, MAX_CANVAS_HEIGHT / cssHeight)
          : SCALE;
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
      blobUrls.forEach((u) => URL.revokeObjectURL(u));
    }
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
  for (const el of article.children) {
    const rect = el.getBoundingClientRect();
    const top = rect.top - stageTop;
    const height = rect.height;
    if (height > content) {
      for (let t = top + content; t < top + height; t += PDF_PAGE_HEIGHT) {
        cuts.push(t);
      }
      pageStart = cuts[cuts.length - 1];
    } else if (top - pageStart > content) {
      const cut = top - PAD_TOP;
      cuts.push(cut);
      pageStart = cut;
    }
  }
  return { cuts, total };
}

// ---------------- Exports ----------------

/** @returns {Promise<{data: Uint8Array, ext: 'png', mime: string}>} */
export async function exportPng(markdownSource) {
  const { canvas } = await renderToCanvas(markdownSource);
  const blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas.toBlob failed'))), 'image/png')
  );
  const data = new Uint8Array(await blob.arrayBuffer());
  return { data, ext: 'png', mime: 'image/png' };
}

/** @returns {Promise<{data: Uint8Array, ext: 'pdf', mime: string}>} */
export async function exportPdf(markdownSource) {
  const { canvas, cssWidth, pageCuts } = await renderToCanvas(markdownSource);
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
    slice.getContext('2d').drawImage(
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
