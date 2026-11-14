import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_CANVAS_AREA,
  MAX_CANVAS_HEIGHT,
  MAX_CANVAS_WIDTH,
  PDF_PAGE_HEIGHT,
  SCALE,
  computePageCuts,
  exportScale,
  trimSliverCuts,
} from './exportgeom.js';

test('exportScale uses 3x for ordinary notes', () => {
  assert.equal(exportScale(900, 948), SCALE);
  assert.equal(exportScale(0, 0), SCALE);
});

test('exportScale bounds height, width and total canvas area', () => {
  const tall = exportScale(48000, 948);
  assert.ok(tall * 948 <= MAX_CANVAS_WIDTH + 1);
  assert.ok(tall * 48000 <= MAX_CANVAS_HEIGHT + 1);
  assert.ok(Math.abs(tall - 0.625) < 0.001);

  const wideTable = exportScale(9000, 5400);
  assert.ok(wideTable * 9000 <= MAX_CANVAS_HEIGHT + 1);
  assert.ok(wideTable * 5400 <= MAX_CANVAS_WIDTH + 1);
  // 3x would be 437 MP; the area cap brings it to ~2.2x.
  assert.ok(
    (wideTable * 9000) * (wideTable * 5400) <= MAX_CANVAS_AREA + 1,
    `canvas area ${(wideTable * 9000) * (wideTable * 5400)} exceeds the cap`
  );
  assert.ok(wideTable < SCALE && wideTable > 2);
});

test('exportScale may go below 0.25 for absurd content instead of overflowing', () => {
  const extreme = exportScale(400000, 400000);
  assert.ok(extreme > 0);
  assert.ok(extreme < 0.25);
});

test('computePageCuts never produces a page taller than the page height', () => {
  const blocks = [
    { top: 0, height: 400 },
    { top: 420, height: 900 },
    // A tall table that must be hard-split.
    { top: 1350, height: 5000 },
    // The block right after the tall one must not share its tail page.
    { top: 6400, height: 300 },
    { top: 6700, height: 200 },
  ];
  const total = 6900;
  const { cuts } = computePageCuts(blocks, total);
  const bounds = [0, ...cuts, total];
  for (let i = 0; i + 1 < bounds.length; i += 1) {
    const height = bounds[i + 1] - bounds[i];
    assert.ok(
      height <= PDF_PAGE_HEIGHT + 1,
      `page ${i} is ${height}px (max ${PDF_PAGE_HEIGHT})`
    );
    assert.ok(height > 0);
  }
  // The tall block's hard splits are present.
  assert.ok(cuts.some((cut) => cut > 1350 && cut < 6350));
  // A cut ends the tall block so the following 300px block starts fresh.
  assert.ok(cuts.includes(6350));
});

test('computePageCuts breaks normal blocks at the previous block bottom', () => {
  const blocks = [
    { top: 0, height: 600 },
    { top: 620, height: 600 },
    { top: 1240, height: 600 },
  ];
  const { cuts, total } = computePageCuts(blocks, 1840);
  assert.equal(total, 1840);
  assert.deepEqual(cuts, [1220]);
});

test('trimSliverCuts folds a tiny last page into the previous one', () => {
  const cuts = [1292, 2584];
  trimSliverCuts(cuts, 2700);
  assert.deepEqual(cuts, [1292]);
  const keep = [1292];
  trimSliverCuts(keep, 1400);
  assert.deepEqual(keep, []);
});
