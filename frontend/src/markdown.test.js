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

test('protectMath handles display math inside blockquotes', () => {
  const nl = String.fromCharCode(10);
  const md = [
    '> $$',
    '> \\begin{pmatrix}',
    '> a & b \\',
    '> c & d',
    '> \\end{pmatrix}',
    '> $$',
  ].join(nl);
  const store = [];
  const out = protectMath(md, store);
  assert.equal(store.length, 1);
  assert.ok(sourceHasMath(md));
  assert.ok(store[0].includes('\\'), 'row separator must survive');
  assert.ok(!store[0].includes('> '), 'quote markers must be stripped');
  assert.match(out, /^> RMDMATH[0-9A-Z]+0X$/);
});

test('protectMath handles display math inside list items', () => {
  const nl = String.fromCharCode(10);
  const md = [
    '- $$',
    '  \\begin{aligned}',
    '  x &= 1 \\',
    '  y &= 2',
    '  \\end{aligned}',
    '  $$',
  ].join(nl);
  const store = [];
  const out = protectMath(md, store);
  assert.equal(store.length, 1);
  assert.ok(store[0].includes('\\'));
  assert.match(out, /^- RMDMATH[0-9A-Z]+0X$/);
});

test('protectMath handles same-line display math in a quote', () => {
  const store = [];
  const out = protectMath('> $$x = y$$', store);
  assert.equal(store.length, 1);
  assert.equal(store[0], '$$x = y$$');
  assert.match(out, /^> RMDMATH[0-9A-Z]+0X$/);
});

test('protectMath leaves quoted prose containing $$ alone', () => {
  const nl = String.fromCharCode(10);
  const md = ['> 使用双 $$ 包裹公式', '', '> $$', '> x', '> $$'].join(nl);
  const store = [];
  protectMath(md, store);
  assert.equal(store.length, 1);
});

test('protectMath hides escaped dollars from marked and MathJax', () => {
  const store = [];
  const out = protectMath('price \\$5 and \\$6 only', store);
  assert.equal(store.length, 2);
  assert.deepEqual(store, [{ escape: '$' }, { escape: '$' }]);
  assert.ok(!out.includes('\\$'));
});

test('escaped dollars coexist with real inline math', () => {
  const store = [];
  const out = protectMath('price \\$5 and $x + y$', store);
  assert.equal(store.length, 2);
  assert.equal(store[0], '$x + y$');
  assert.deepEqual(store[1], { escape: '$' });
  assert.ok(!out.includes('\\$'));
});

test('an escaped dollar inside math is kept for MathJax', () => {
  const store = [];
  protectMath('$\\$5$ tail', store);
  assert.equal(store.length, 1);
  assert.equal(store[0], '$\\$5$');
});
