// Pure PDF page geometry helpers. The raster exporter creates custom-sized
// pages; jsPDF swaps an explicit landscape `format` back to portrait when the
// orientation is hard-coded to 'p', which squeezed wide data tables into a
// tall page. Keep the choice explicit and testable.
export function pdfPageOrientation(widthPt, heightPt) {
  const width = Number(widthPt);
  const height = Number(heightPt);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return 'p';
  return width > height ? 'l' : 'p';
}
