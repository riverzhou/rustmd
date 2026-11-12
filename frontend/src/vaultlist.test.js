import test from 'node:test';
import assert from 'node:assert/strict';

import {
  RECENT_DIRS_MAX,
  addRecentDir,
  dirDisplayName,
  isPinnedDir,
  normalizeDirPath,
  orderRecentDirs,
  parseRecentDirs,
  pinnedDirs,
  removeRecentDir,
  sameDir,
  togglePinnedDir,
} from './vaultlist.js';

const entry = (dir, pinned = false) => ({ dir, pinned });

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

test('addRecentDir is MRU, deduped and capped at 20', () => {
  let list = addRecentDir([], 'D:\\One');
  assert.deepEqual(list, [entry('D:\\One')]);

  list = addRecentDir(list, 'D:\\Two');
  assert.deepEqual(list, [entry('D:\\Two'), entry('D:\\One')]);

  list = addRecentDir(list, 'd:\\one\\', { windows: true });
  assert.deepEqual(list, [entry('d:\\one'), entry('D:\\Two')]);

  for (let i = 0; i < RECENT_DIRS_MAX + 3; i += 1) {
    list = addRecentDir(list, `D:\\vault-${i}`);
  }
  assert.equal(RECENT_DIRS_MAX, 20);
  assert.equal(list.length, RECENT_DIRS_MAX);
  assert.equal(list[0].dir, `D:\\vault-${RECENT_DIRS_MAX + 2}`);

  assert.deepEqual(addRecentDir(['D:\\A'], ''), [entry('D:\\A')]);
  assert.deepEqual(addRecentDir(['D:\\A'], 'D:\\B', { max: 1 }), [
    entry('D:\\B'),
  ]);
});

test('pinned entries survive the cap and keep their flag when reopened', () => {
  let list = addRecentDir([], 'D:\\Pinned');
  list = togglePinnedDir(list, 'D:\\Pinned');
  assert.deepEqual(list, [entry('D:\\Pinned', true)]);

  for (let i = 0; i < RECENT_DIRS_MAX + 5; i += 1) {
    list = addRecentDir(list, `D:\\vault-${i}`);
  }
  assert.equal(list.length, RECENT_DIRS_MAX);
  assert.ok(
    list.some((item) => item.dir === 'D:\\Pinned' && item.pinned),
    'the pinned vault must never be evicted'
  );

  // Re-opening a pinned vault keeps it pinned.
  list = addRecentDir(list, 'D:\\Pinned');
  assert.deepEqual(list[0], entry('D:\\Pinned', true));
});

test('togglePinnedDir moves the entry to the front and flips the pin', () => {
  const list = [entry('D:\\One'), entry('D:\\Two'), entry('D:\\Three')];
  const pinned = togglePinnedDir(list, 'd:\\two', { windows: true });
  assert.deepEqual(pinned, [
    entry('d:\\two', true),
    entry('D:\\One'),
    entry('D:\\Three'),
  ]);
  assert.equal(isPinnedDir(pinned, 'D:\\Two', { windows: true }), true);

  const unpinned = togglePinnedDir(pinned, 'D:\\Two', { windows: true });
  assert.deepEqual(unpinned, [
    entry('D:\\Two'),
    entry('D:\\One'),
    entry('D:\\Three'),
  ]);
  assert.equal(isPinnedDir(unpinned, 'D:\\Two'), false);
});

test('orderRecentDirs shows pinned entries first and pinnedDirs lists them', () => {
  const list = [
    entry('D:\\New', false),
    entry('D:\\Pinned2', true),
    entry('D:\\Old', false),
    entry('D:\\Pinned1', true),
  ];
  assert.deepEqual(
    orderRecentDirs(list).map((item) => item.dir),
    ['D:\\Pinned2', 'D:\\Pinned1', 'D:\\New', 'D:\\Old']
  );
  assert.deepEqual(pinnedDirs(list), ['D:\\Pinned2', 'D:\\Pinned1']);
});

test('removeRecentDir only drops the matching entry', () => {
  const list = [entry('D:\\One'), entry('D:\\Two'), entry('D:\\Three')];
  assert.deepEqual(removeRecentDir(list, 'd:\\two', { windows: true }), [
    entry('D:\\One'),
    entry('D:\\Three'),
  ]);
  assert.deepEqual(removeRecentDir(list, 'D:\\missing'), list);
  assert.deepEqual(removeRecentDir(null, 'D:\\One'), []);
});

test('parseRecentDirs tolerates bad input, legacy strings and duplicates', () => {
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
        { dir: 'd:\\TWO', pinned: true },
        'D:\\Three',
        { dir: 'D:\\Two\\', pinned: false },
      ]),
      { max: 2, windows: true }
    ),
    [entry('D:\\One'), entry('d:\\TWO', true)]
  );
  // The newest entry plus pinned entries win when the cap is tight.
  assert.deepEqual(
    parseRecentDirs(
      [
        { dir: '/new', pinned: false },
        { dir: '/a', pinned: false },
        { dir: '/pinned', pinned: true },
        { dir: '/old', pinned: false },
      ],
      { max: 2 }
    ),
    [entry('/new'), entry('/pinned', true)]
  );
  // An array is accepted too, which keeps the helper easy to call in tests.
  assert.deepEqual(parseRecentDirs(['/a', '/b']), [entry('/a'), entry('/b')]);
});

test('a full list of pinned entries stays capped without evicting them', () => {
  let list = [];
  for (let i = 0; i < RECENT_DIRS_MAX; i += 1) {
    list = togglePinnedDir(list, `D:\\pin-${i}`);
  }
  assert.equal(list.length, RECENT_DIRS_MAX);
  list = addRecentDir(list, 'D:\\just-opened');
  assert.equal(list.length, RECENT_DIRS_MAX);
  assert.equal(
    list.filter((item) => item.pinned).length,
    RECENT_DIRS_MAX,
    'pinned entries are never evicted, even when the quota is full'
  );
  assert.equal(
    list.some((item) => item.dir === 'D:\\just-opened'),
    false,
    'the cap still wins over an unpinned newcomer'
  );
});
