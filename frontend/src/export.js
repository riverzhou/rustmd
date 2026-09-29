// High-res PNG / PDF export.
//
// Strategy: render the note into an off-screen stage styled like the in-app
// preview (theme-aware, via CSS variables), rasterize it with html2canvas at
// 2x scale (~192 DPI), then hand back PNG bytes or wrap the raster into a
// single-page PDF with jsPDF sized exactly to the content.

import { renderPreview } from './preview.js';

const CONTENT_WIDTH = 860; // matches .markdown-body max-width
const PAD_X = 44;
const PAD_Y = 48;
const STAGE_WIDTH = CONTENT_WIDTH + PAD_X * 2;
const MAX_CANVAS_HEIGHT = 14000; // keep canvas memory bounded for long notes

function buildStage(markdownSource) {
  const stage = document.createElement('div');
  stage.className = 'export-stage';
  const article = document.createElement('article');
  article.className = 'markdown-body';
  stage.appendChild(article);
  document.body.appendChild(stage);
  renderPreview(markdownSource, article);
  return stage;
}

async function renderToCanvas(markdownSource) {
  const { default: html2canvas } = await import('html2canvas');
  const stage = buildStage(markdownSource);
  try {
    // Drop the max-width so the article fills the stage at STAGE_WIDTH - 2*PAD_X.
    const article = stage.firstElementChild;
    article.style.maxWidth = `${CONTENT_WIDTH}px`;
    const cssHeight = stage.offsetHeight;
    let scale = 2;
    if (cssHeight * scale > MAX_CANVAS_HEIGHT) {
      scale = Math.max(1, MAX_CANVAS_HEIGHT / cssHeight);
    }
    const canvas = await html2canvas(stage, {
      scale,
      backgroundColor: getComputedStyle(stage).backgroundColor,
      useCORS: true,
      logging: false,
    });
    return {
      canvas,
      scale,
      cssWidth: stage.offsetWidth,
      cssHeight,
    };
  } finally {
    stage.remove();
  }
}

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
  const { canvas, cssWidth, cssHeight } = await renderToCanvas(markdownSource);
  const { jsPDF } = await import('jspdf');
  // CSS px -> PDF points (96 px/in, 72 pt/in).
  const w = cssWidth * 0.75;
  const h = cssHeight * 0.75;
  const doc = new jsPDF({
    orientation: w > h ? 'l' : 'p',
    unit: 'pt',
    format: [w, h],
  });
  // JPEG keeps PDF size sane for long notes; q0.95 is visually lossless.
  doc.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, w, h);
  const data = new Uint8Array(doc.output('arraybuffer'));
  return { data, ext: 'pdf', mime: 'application/pdf' };
}
