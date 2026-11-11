import test from 'node:test';
import assert from 'node:assert/strict';
import {
  protectMath,
  sourceHasMath,
  splitCodeSegments,
} from './markdown.js';

test('splitCodeSegments separates fenced code', () => {
  const segments = splitCodeSegments('a\n```js\nx\n```\nb\n');
  assert.deepEqual(
    segments.map((s) => s.code),
    [false, true, false]
  );
  assert.equal(segments[1].text, '```js\nx\n```');
});

test('splitCodeSegments respects the opening fence length', () => {
  const nl = String.fromCharCode(10);
  const segments = splitCodeSegments(['a', '````', '```', '````', 'b'].join(nl));
  assert.deepEqual(
    segments.map((s) => s.code),
    [false, true, false]
  );
  assert.equal(segments[1].text, ['````', '```', '````'].join(nl));
});

test('sourceHasMath ignores math inside fences', () => {
  assert.equal(sourceHasMath('$x$'), true);
  assert.equal(sourceHasMath('plain'), false);
  assert.equal(sourceHasMath('```\n$x$\n```'), false);
});

test('protectMath replaces every display block (g-flag regression)', () => {
  const md = '$$\n\\begin{matrix}a & b \\\\ c & d\\end{matrix}\n$$\n\ntext\n\n$$\nx = y\n$$\n';
  const store = [];
  const out = protectMath(md, store);
  assert.equal(store.length, 2);
  assert.ok(!out.includes('$$'));
  assert.ok(store[0].includes('\\\\'));
  assert.ok(store[1].includes('x = y'));
});

test('protectMath leaves mid-sentence $$ alone', () => {
  const md = '使用双 $$ 包裹公式\n\n$$\nx\n$$\n';
  const store = [];
  const out = protectMath(md, store);
  assert.equal(store.length, 1);
  assert.ok(out.includes('使用双 $$ 包裹公式'));
});

test('protectMath protects inline math and leaves code alone', () => {
  const md = 'inline $x+y$ and `$code$`\n\n```\n$fenced$\n```\n';
  const store = [];
  const out = protectMath(md, store);
  assert.equal(store.length, 1);
  assert.ok(store[0].includes('$x+y$'));
  assert.ok(out.includes('`$code$`'));
  assert.ok(out.includes('$fenced$'));
});
