import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SORT_ASC,
  SORT_DESC,
  SORT_MTIME,
  SORT_NAME,
  ancestorFolders,
  buildFolderTree,
  countTags,
  defaultSortDir,
  fileNameOf,
  filterNotes,
  flattenFolderTree,
  folderInScope,
  folderMatches,
  normalizeSort,
  normalizeSortState,
  noteKindOf,
  noteStemOf,
  sortNotes,
} from './notelist.js';

const notes = [
  { path: 'work/note10.md', folder: 'work', tags: ['工作'], mtime: 100 },
  { path: 'work/sub/note2.md', folder: 'work/sub', tags: ['工作', '会议'], mtime: 300 },
  { path: 'work/alpha.md', folder: 'work', tags: [], mtime: 200 },
  { path: 'ideas.md', folder: '', tags: ['灵感'], mtime: 400 },
];

test('fileNameOf handles forward and back slashes', () => {
  assert.equal(fileNameOf('a/b/c.md'), 'c.md');
  assert.equal(fileNameOf('a\\b\\c.md'), 'c.md');
  assert.equal(fileNameOf('c.md'), 'c.md');
  assert.equal(fileNameOf(''), '');
});

test('normalizeSort defaults to mtime', () => {
  assert.equal(normalizeSort('name'), SORT_NAME);
  assert.equal(normalizeSort('mtime'), SORT_MTIME);
  assert.equal(normalizeSort('bogus'), SORT_MTIME);
});

test('default directions and state normalization', () => {
  assert.equal(defaultSortDir(SORT_MTIME), SORT_DESC);
  assert.equal(defaultSortDir(SORT_NAME), SORT_ASC);
  assert.deepEqual(normalizeSortState('name'), { key: SORT_NAME, dir: SORT_ASC });
  assert.deepEqual(normalizeSortState({ key: 'mtime', dir: 'asc' }), {
    key: SORT_MTIME,
    dir: SORT_ASC,
  });
  assert.deepEqual(normalizeSortState({ key: 'name', dir: 'bogus' }), {
    key: SORT_NAME,
    dir: SORT_ASC,
  });
});

test('sort by mtime is newest first and by file name is numeric-aware', () => {
  assert.deepEqual(
    sortNotes(notes, SORT_MTIME).map((n) => n.path),
    ['ideas.md', 'work/sub/note2.md', 'work/alpha.md', 'work/note10.md']
  );
  assert.deepEqual(
    sortNotes(notes, SORT_NAME).map((n) => fileNameOf(n.path)),
    ['alpha.md', 'ideas.md', 'note2.md', 'note10.md']
  );
});

test('both sort keys support ascending and descending', () => {
  assert.deepEqual(
    sortNotes(notes, { key: SORT_MTIME, dir: SORT_ASC }).map((n) => n.path),
    ['work/note10.md', 'work/alpha.md', 'work/sub/note2.md', 'ideas.md']
  );
  assert.deepEqual(
    sortNotes(notes, { key: SORT_MTIME, dir: SORT_DESC }).map((n) => n.path),
    ['ideas.md', 'work/sub/note2.md', 'work/alpha.md', 'work/note10.md']
  );
  assert.deepEqual(
    sortNotes(notes, { key: SORT_NAME, dir: SORT_ASC }).map((n) => fileNameOf(n.path)),
    ['alpha.md', 'ideas.md', 'note2.md', 'note10.md']
  );
  assert.deepEqual(
    sortNotes(notes, { key: SORT_NAME, dir: SORT_DESC }).map((n) => fileNameOf(n.path)),
    ['note10.md', 'note2.md', 'ideas.md', 'alpha.md']
  );
});

test('sorting is deterministic for equal paths in different vaults', () => {
  const duplicated = [
    { vault: '/b', path: 'same.md', folder: '', tags: [], mtime: 1 },
    { vault: '/a', path: 'same.md', folder: '', tags: [], mtime: 1 },
  ];
  assert.deepEqual(
    sortNotes(duplicated, SORT_MTIME).map((n) => n.vault),
    ['/a', '/b']
  );
  assert.deepEqual(
    sortNotes(duplicated, SORT_NAME).map((n) => n.vault),
    ['/a', '/b']
  );
});

test('folder scope is direct-only unless subfolders are included', () => {
  assert.equal(folderInScope('work/sub', 'work'), false);
  assert.equal(folderInScope('work/sub', 'work', true), true);
  assert.equal(folderInScope('', null), true);
  assert.equal(folderInScope('work', null), false);
  assert.equal(folderInScope('work', null, true), true);
  assert.equal(folderMatches('work/sub', 'work'), true);
  assert.equal(folderMatches('workshop', 'work'), false);
  assert.equal(folderMatches('', null), true);
  assert.deepEqual(
    filterNotes(notes, { folder: 'work' }).map((n) => n.path),
    ['work/note10.md', 'work/alpha.md']
  );
  assert.deepEqual(
    filterNotes(notes, { folder: 'work', includeSubfolders: true }).map(
      (n) => n.path
    ),
    ['work/note10.md', 'work/sub/note2.md', 'work/alpha.md']
  );
  assert.deepEqual(
    filterNotes(notes, { folder: 'work', tag: '会议' }).map((n) => n.path),
    []
  );
  assert.deepEqual(
    filterNotes(notes, {
      folder: 'work',
      tag: '会议',
      includeSubfolders: true,
    }).map((n) => n.path),
    ['work/sub/note2.md']
  );
});

test('the default vault scope shows root notes only', () => {
  assert.deepEqual(
    filterNotes(notes).map((n) => n.path),
    ['ideas.md']
  );
  assert.deepEqual(
    filterNotes(notes, { includeSubfolders: true }).map((n) => n.path),
    ['work/note10.md', 'work/sub/note2.md', 'work/alpha.md', 'ideas.md']
  );
});

test('vault scoping keeps equal folder paths from different vaults apart', () => {
  const multi = [
    { vault: '/a', path: 'work/x.md', folder: 'work', tags: [], mtime: 1 },
    { vault: '/a', path: 'root.md', folder: '', tags: [], mtime: 2 },
    { vault: '/b', path: 'work/x.md', folder: 'work', tags: [], mtime: 3 },
    { vault: '/b', path: 'root.md', folder: '', tags: [], mtime: 4 },
  ];
  assert.deepEqual(
    filterNotes(multi, { vault: '/a', folder: 'work' }).map((n) => n.path),
    ['work/x.md']
  );
  assert.deepEqual(
    filterNotes(multi, { vault: '/b', folder: 'work', includeSubfolders: true })
      .map((n) => n.path),
    ['work/x.md']
  );
  assert.deepEqual(
    filterNotes(multi, { vault: '/a', folder: null, includeSubfolders: true })
      .map((n) => n.path),
    ['work/x.md', 'root.md']
  );
  assert.deepEqual(filterNotes(multi, { includeSubfolders: true }).length, 4);
});

test('tag counts follow the scoped notes', () => {
  assert.deepEqual(countTags(filterNotes(notes)), [{ name: '灵感', count: 1 }]);
  assert.deepEqual(countTags(filterNotes(notes, { folder: 'work' })), [
    { name: '工作', count: 1 },
  ]);
  assert.deepEqual(
    countTags(filterNotes(notes, { includeSubfolders: true })),
    [
      { name: '工作', count: 2 },
      { name: '会议', count: 1 },
      { name: '灵感', count: 1 },
    ]
  );
});

test('folder tree aggregates counts and keeps empty folders', () => {
  const tree = buildFolderTree(['work', 'work/sub', 'empty'], notes);
  assert.deepEqual(
    tree.map((n) => n.path),
    ['empty', 'work']
  );
  const work = tree.find((n) => n.path === 'work');
  assert.equal(work.count, 3);
  assert.equal(work.direct, 2);
  assert.equal(work.children[0].path, 'work/sub');
  assert.equal(work.children[0].count, 1);
  const empty = tree.find((n) => n.path === 'empty');
  assert.equal(empty.count, 0);
  assert.equal(empty.children.length, 0);
});

test('flattenFolderTree respects collapsed nodes', () => {
  const tree = buildFolderTree(['work', 'work/sub'], notes);
  const expanded = (path) => path !== 'work';
  assert.deepEqual(
    flattenFolderTree(tree, expanded).map((n) => n.path),
    ['work']
  );
  assert.deepEqual(
    flattenFolderTree(tree, () => true).map((n) => n.path),
    ['work', 'work/sub']
  );
});

test('ancestorFolders lists only ancestors', () => {
  assert.deepEqual(ancestorFolders('a/b/c'), ['a', 'a/b']);
  assert.deepEqual(ancestorFolders('a'), []);
  assert.deepEqual(ancestorFolders(''), []);
});

test('noteKindOf follows the extension', () => {
  assert.equal(noteKindOf('a/b/page.html'), 'html');
  assert.equal(noteKindOf('a/b/PAGE.HTM'), 'html');
  assert.equal(noteKindOf('a/b/note.md'), 'markdown');
  assert.equal(noteKindOf('a/b/note.txt'), 'txt');
});

test('noteStemOf strips only note extensions', () => {
  assert.equal(noteStemOf('a/b/page.html'), 'page');
  assert.equal(noteStemOf('a/b/page.htm'), 'page');
  assert.equal(noteStemOf('a/b/note.md'), 'note');
  assert.equal(noteStemOf('a/b/note.md.backup'), 'note.md.backup');
});


test('noteKindOf and noteStemOf cover every supported note format', () => {
  assert.equal(noteKindOf('a.md'), 'markdown');
  assert.equal(noteKindOf('a.HTML'), 'html');
  assert.equal(noteKindOf('a.htm'), 'html');
  assert.equal(noteKindOf('a.csv'), 'csv');
  assert.equal(noteKindOf('a.TXT'), 'txt');
  assert.equal(noteKindOf('a.json'), 'json');
  assert.equal(noteKindOf('a.bin'), 'markdown');
  assert.equal(noteStemOf('data/示例数据.csv'), '示例数据');
  assert.equal(noteStemOf('data/config.JSON'), 'config');
});
