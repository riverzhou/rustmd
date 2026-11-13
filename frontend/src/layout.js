// Pure width calculations for the two draggable layout axes. Kept separate
// from main.js so the clamps can be unit-tested without a DOM.

export const SIDEBAR_DEFAULT_WIDTH = 320;
export const SIDEBAR_MIN_WIDTH = 220;
export const SIDEBAR_MAX_WIDTH = 680;
export const SIDEBAR_MAX_VIEWPORT_RATIO = 0.42;

export const SPLIT_DEFAULT_RATIO = 0.5;
export const SPLIT_MIN_RATIO = 0.2;
export const SPLIT_MAX_RATIO = 0.8;

/** Upper bound for the sidebar at the current viewport width. */
export function sidebarWidthMax(viewportWidth) {
  const viewport = Number(viewportWidth);
  if (!Number.isFinite(viewport) || viewport <= 0) return SIDEBAR_MAX_WIDTH;
  return Math.max(
    SIDEBAR_MIN_WIDTH,
    Math.min(SIDEBAR_MAX_WIDTH, Math.floor(viewport * SIDEBAR_MAX_VIEWPORT_RATIO))
  );
}

/** Clamp a sidebar width in px. Invalid input falls back to the default. */
export function clampSidebarWidth(value, viewportWidth) {
  const number = Number(value);
  const max = sidebarWidthMax(viewportWidth);
  if (!Number.isFinite(number)) {
    return Math.min(SIDEBAR_DEFAULT_WIDTH, max);
  }
  return Math.min(max, Math.max(SIDEBAR_MIN_WIDTH, Math.round(number)));
}

/** Clamp the editor share of the split workspace to 20–80%. */
export function clampSplitRatio(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return SPLIT_DEFAULT_RATIO;
  return Math.min(SPLIT_MAX_RATIO, Math.max(SPLIT_MIN_RATIO, number));
}

/** Accepts `"42.5%"`, `"0.425"` or `42.5`; always returns a 0–1 ratio. */
export function parseStoredSplit(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  const number = Number.parseFloat(String(raw));
  if (!Number.isFinite(number)) return null;
  return clampSplitRatio(number > 1 ? number / 100 : number);
}
