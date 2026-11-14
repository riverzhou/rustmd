// Pure geometry for the raster PNG / PDF exporters. Kept DOM-free so the
// adaptive scale and page-break rules are unit-tested (`exportgeom.test.js`).

export const CONTENT_WIDTH = 860; // matches .markdown-body max-width
export const PAD_TOP = 48; // .export-stage top padding (48px 44px 64px)
export const SCALE = 3; // 3 * 96 px/in ≈ 288 DPI
export const MAX_CANVAS_HEIGHT = 30000; // device px
export const MAX_CANVAS_WIDTH = 30000;
// Chromium/WebView2 reject canvases above ~268M pixels total. Stay below it
// with a margin: width and height caps alone allow 900M pixels.
export const MAX_CANVAS_AREA = 240_000_000;
export const MIN_SCALE = 0.25; // normal floor for very long notes
export const PDF_PAGE_HEIGHT = 1340; // css px per PDF page (A4-ish at 948 px)

/// Export raster scale. Bounds the device-pixel width, height AND total area;
/// an extreme note may go below MIN_SCALE so html2canvas never receives an
/// impossible canvas (the documented range is "normally 0.25–3×").
export function exportScale(cssHeight, cssWidth = 0) {
  let scale = SCALE;
  if (cssHeight > 0) scale = Math.min(scale, MAX_CANVAS_HEIGHT / cssHeight);
  if (cssWidth > 0) scale = Math.min(scale, MAX_CANVAS_WIDTH / cssWidth);
  if (cssWidth > 0 && cssHeight > 0) {
    scale = Math.min(
      scale,
      Math.sqrt(MAX_CANVAS_AREA / (cssWidth * cssHeight))
    );
  }
  // Keep a positive scale; only absurd (>1.2M css px) content reaches this.
  return Math.max(0.01, Math.min(SCALE, scale));
}

/// Page-break positions for the raster PDF, in css px relative to the stage.
/// Breaks only happen at block boundaries, so paragraphs/tables/images are
/// never split mid-way. A block taller than a page is hard-split; every page
/// produced here fits in `pageHeight` (a trailing gap between blocks may be
/// included, but no block content overflows its page).
export function computePageCuts(blocks, total, { pageHeight = PDF_PAGE_HEIGHT } = {}) {
  const cuts = [];
  let pageStart = 0;
  let prevBottom = 0;
  const breakAt = (top) =>
    prevBottom > pageStart && prevBottom <= top ? prevBottom : top;
  for (const block of blocks) {
    const { top, height } = block;
    if (!Number.isFinite(top) || !Number.isFinite(height) || height <= 0) continue;
    if (height > pageHeight) {
      if (top > pageStart) {
        const cut = breakAt(top);
        cuts.push(cut);
        pageStart = cut;
      }
      for (let t = pageStart + pageHeight; t < top + height; t += pageHeight) {
        cuts.push(t);
      }
      const blockEnd = top + height;
      if (cuts[cuts.length - 1] !== blockEnd) cuts.push(blockEnd);
      pageStart = blockEnd;
      prevBottom = blockEnd;
    } else if (top + height - pageStart > pageHeight && top > pageStart) {
      const cut = breakAt(top);
      cuts.push(cut);
      pageStart = cut;
      prevBottom = top + height;
    } else {
      prevBottom = top + height;
    }
  }
  return { cuts, total };
}

/// Drop a trailing page break when the final page would be a sliver, folding
/// it into the previous page (shared by both raster PDF exporters).
export function trimSliverCuts(
  cuts,
  total,
  { pageHeight = PDF_PAGE_HEIGHT, ratio = 0.25 } = {}
) {
  if (cuts.length && total - cuts[cuts.length - 1] < pageHeight * ratio) {
    cuts.pop();
  }
  return cuts;
}
