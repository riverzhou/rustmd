import test from 'node:test';
import assert from 'node:assert/strict';

import {
  RECENT_DIRS_MAX,
  addRecentDir,
  dirDisplayName,
  normalizeDirPath,
  parseRecentDirs,
  removeRecentDir,
  sameDir,
} from './vaultlist.js';

test('normalizeDirPath trims and strips trailing separators, keeping roots', () => {
  assert.equal(normalizeDirPath('  D:\\Notes\\  '), 'D:\\Notes');
  assert.equal(normalizeDirPath('/srv/notes///'), '/srv/notes');
  assert.equal(normalizeDirPath('C:\\'), 'C:\\');
  assert.equal(normalizeDirPath('C:/'), 'C:/');
  assert.equal(normalizeDirPath('/'), '/');
  assert.equal(normalizeDirPath(''), '');
  assert.equal(normalizeDirPath(null), '');
});

test('sameDir is platform-aware', () => {
  assert.equal(sameDir('D:\\Notes', 'D:\\Notes\\'), true);
  assert.equal(sameDir('D:/Notes', 'D:\\Notes'), false);
  assert.equal(sameDir('D:/Notes', 'D:\\Notes', true), true);
  assert.equal(sameDir('D:\\Notes', 'd:\\notes', true), true);
  assert.equal(sameDir('D:\\Notes', 'd:\\notes'), false);
  assert.equal(sameDir('', ''), false);
});

test('dirDisplayName uses the last segment', () => {
  assert.equal(dirDisplayName('D:\\Notes\\work\\'), 'work');
  assert.equal(dirDisplayName('/srv/notes'), 'notes');
  assert.equal(dirDisplayName('C:\\'), 'C:\\');
  assert.equal(dirDisplayName('\\\\nas\\share\\'), 'share');
  assert.equal(dirDisplayName('/'), '/');
  assert.equal(dirDisplayName(''), '');
});

test('addRecentDir is MRU, deduped and capped', () => {
  let list = addRecentDir([], 'D:\\One');
  assert.deepEqual(list, ['D:\\One']);

  list = addRecentDir(list, 'D:\\Two');
  assert.deepEqual(list, ['D:\\Two', 'D:\\One']);

  list = addRecentDir(list, 'd:\\one\\', { windows: true });
  assert.deepEqual(list, ['d:\\one', 'D:\\Two']);

  for (let i = 0; i < RECENT_DIRS_MAX + 3; i += 1) {
    list = addRecentDir(list, `D:\\vault-${i}`);
  }
  assert.equal(list.length, RECENT_DIRS_MAX);
  assert.equal(list[0], `D:\\vault-${RECENT_DIRS_MAX + 2}`);

  assert.deepEqual(addRecentDir(['D:\\A'], ''), ['D:\\A']);
  assert.deepEqual(addRecentDir(['D:\\A'], 'D:\\B', { max: 1 }), ['D:\\B']);
});

test('removeRecentDir only drops the matching entry', () => {
  const list = ['D:\\One', 'D:\\Two', 'D:\\Three'];
  assert.deepEqual(removeRecentDir(list, 'd:\\two', { windows: true }), [
    'D:\\One',
    'D:\\Three',
  ]);
  assert.deepEqual(removeRecentDir(list, 'D:\\missing'), list);
  assert.deepEqual(removeRecentDir(null, 'D:\\One'), []);
});

test('parseRecentDirs tolerates bad input and removes duplicates', () => {
  assert.deepEqual(parseRecentDirs('not json'), []);
  assert.deepEqual(parseRecentDirs('{"a":1}'), []);
  assert.deepEqual(parseRecentDirs(null), []);
  assert.deepEqual(
    parseRecentDirs(
      JSON.stringify([
        'D:\\One\\',
        42,
        '',
        'D:\\One',
        'd:\\TWO',
        'D:\\Three',
      ]),
      { max: 2, windows: true }
    ),
    ['D:\\One', 'd:\\TWO']
  );
  // An array is accepted too, which keeps the helper easy to call in tests.
  assert.deepEqual(parseRecentDirs(['/a', '/b']), ['/a', '/b']);
});
