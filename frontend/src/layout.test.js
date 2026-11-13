import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SIDEBAR_DEFAULT_WIDTH,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  SPLIT_DEFAULT_RATIO,
  clampSidebarWidth,
  clampSplitRatio,
  parseStoredSplit,
  sidebarWidthMax,
} from './layout.js';

test('sidebar width is bounded by the current viewport and the 680px cap', () => {
  assert.equal(sidebarWidthMax(1440), 604);
  assert.equal(sidebarWidthMax(1920), SIDEBAR_MAX_WIDTH);
  assert.equal(sidebarWidthMax(900), 378);
  assert.equal(clampSidebarWidth(500, 1440), 500);
  assert.equal(clampSidebarWidth(900, 1440), 604);
  assert.equal(clampSidebarWidth(100, 1440), SIDEBAR_MIN_WIDTH);
  assert.equal(
    clampSidebarWidth(undefined, 1440),
    SIDEBAR_DEFAULT_WIDTH
  );
});

test('split ratio is clamped to 20-80% and accepts stored percentages', () => {
  assert.equal(clampSplitRatio(0.5), 0.5);
  assert.equal(clampSplitRatio(0.05), 0.2);
  assert.equal(clampSplitRatio(0.95), 0.8);
  assert.equal(clampSplitRatio('nope'), SPLIT_DEFAULT_RATIO);
  assert.equal(parseStoredSplit('37.5%'), 0.375);
  assert.equal(parseStoredSplit('0.6'), 0.6);
  assert.equal(parseStoredSplit('70'), 0.7);
  assert.equal(parseStoredSplit(null), null);
  assert.equal(parseStoredSplit('bad'), null);
});
