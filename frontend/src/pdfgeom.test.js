import test from 'node:test';
import assert from 'node:assert/strict';
import { pdfPageOrientation } from './pdfgeom.js';

test('PDF pages follow their actual width/height aspect', () => {
  assert.equal(pdfPageOrientation(2126.25, 711), 'l');
  assert.equal(pdfPageOrientation(711, 1005), 'p');
  assert.equal(pdfPageOrientation(800, 800), 'p');
  assert.equal(pdfPageOrientation('bad', 100), 'p');
});
