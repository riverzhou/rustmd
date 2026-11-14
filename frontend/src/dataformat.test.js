import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeJson,
  buildTextRows,
  columnAlignments,
  columnWidthHints,
  columnWidthPlan,
  detectDelimiter,
  displayWidth,
  formatBytes,
  isNumericCell,
  jsonStats,
  looksLikeHeaderRow,
  parseDelimited,
} from './dataformat.js';

test('CSV parser handles quotes, doubled quotes and embedded newlines', () => {
  const parsed = parseDelimited(
    'name,note,price\r\n"苹果, 红富士","line 1\nline 2",12.5\r\n"quote ""x""",plain,3\r\n'
  );
  assert.equal(parsed.rows.length, 3);
  assert.deepEqual(parsed.rows[1], ['苹果, 红富士', 'line 1\nline 2', '12.5']);
  assert.deepEqual(parsed.rows[2], ['quote "x"', 'plain', '3']);
  assert.equal(parsed.unclosedQuote, false);
});

test('CSV parser keeps ragged rows and drops one trailing empty row', () => {
  const parsed = parseDelimited('a,b,c\n1,2\n,,\n');
  assert.deepEqual(parsed.rows, [
    ['a', 'b', 'c'],
    ['1', '2'],
    ['', '', ''],
  ]);
});

test('delimiter sniffing follows consistent columns, not raw commas', () => {
  const tsv = 'name\tnote\tqty\nalpha\tred, green, blue\t2\nbeta\tx, y\t3\n';
  assert.equal(detectDelimiter(tsv), '\t');
  assert.equal(detectDelimiter('a;b;c\n1;2;3\n'), ';');
  assert.equal(detectDelimiter('a,b,c\n1,2,3\n'), ',');
  assert.equal(detectDelimiter('one,two\nthree,four\n'), ',');
  assert.equal(detectDelimiter('single column\nsecond line\n'), ',');
});

test('plain-text rows align at tab stops and preserve long columns', () => {
  const text = '名称\t数量\t备注\n苹果\t2\t第一行\n\t\t续行\n';
  const view = buildTextRows(text);
  assert.equal(view.totalLines, 3);
  assert.equal(view.columns, 3);
  assert.deepEqual(view.rows[0], ['名称', '数量', '备注']);
  assert.deepEqual(view.rows[2], ['', '', '续行']);
  assert.equal(view.truncatedLines, false);

  const wide = buildTextRows(`a\t${'b\t'.repeat(4)}c`, { maxCols: 3 });
  assert.equal(wide.columns, 3);
  assert.equal(wide.rows[0][2], 'b\tb\tb\tc');
  assert.equal(wide.truncatedColumns, true);
});

test('plain-text row limits are reported', () => {
  const text = Array.from({ length: 8 }, (_, i) => `line ${i}`).join('\n');
  const view = buildTextRows(text, { maxLines: 3 });
  assert.equal(view.rows.length, 3);
  assert.equal(view.totalLines, 8);
  assert.equal(view.truncatedLines, true);
});

test('numeric columns are aligned only when every value is numeric', () => {
  assert.equal(isNumericCell('1,234.50'), true);
  assert.equal(isNumericCell('-12%'), true);
  assert.equal(isNumericCell('1.2.3'), false);
  assert.deepEqual(columnAlignments([['x', '1'], ['y', '2.5'], ['z', '']], 2), [
    'left',
    'right',
  ]);
  assert.deepEqual(columnAlignments([['1', '2'], ['x', '3']], 2), [
    'left',
    'right',
  ]);
});

test('column alignment understands dates, money, missing values and booleans', () => {
  const rows = [
    ['2026-01-02', '$1,200.50', 'true', '-'],
    ['2026-02-03', '€30', 'no', 'N/A'],
    ['2026-03-04', '¥8', '是', '无'],
  ];
  assert.deepEqual(columnAlignments(rows, 4), [
    'right',
    'right',
    'center',
    'left',
  ]);
  assert.deepEqual(columnAlignments([['a'], ['待定']], 1), ['left']);
});

test('JSON analysis reports validity and structure without recursion', () => {
  const object = analyzeJson('{"a":1,"b":[true,null,{"c":"x"}]}');
  assert.equal(object.ok, true);
  assert.equal(object.rootType, 'object');
  assert.equal(object.rootCount, 2);
  assert.equal(object.nodes, 7);
  assert.equal(object.maxDepth, 3);
  const array = analyzeJson('[1,2,3]');
  assert.equal(array.rootType, 'array');
  assert.equal(array.rootCount, 3);
  assert.equal(analyzeJson('').empty, true);
  const invalid = analyzeJson('{"a": }');
  assert.equal(invalid.ok, false);
  assert.ok(invalid.error);
  assert.deepEqual(jsonStats('root'), {
    nodes: 1,
    maxDepth: 0,
    rootType: 'string',
    rootCount: 0,
  });
});

test('byte formatting is compact', () => {
  assert.equal(formatBytes(12), '12 B');
  assert.equal(formatBytes(1536), '1.5 KB');
  assert.equal(formatBytes(2 * 1024 * 1024), '2.0 MB');
});


test('column width hints compact numbers/short labels and widen text', () => {
  assert.equal(displayWidth('ab'), 2);
  assert.equal(displayWidth('数据'), 4);
  assert.equal(displayWidth('a数'), 3);
  const header = ['名称', '数量', '启用', '备注'];
  const rows = [
    ['苹果', '12', 'true', '红富士，脆甜'],
    ['香蕉', '8', 'false', ''],
  ];
  assert.deepEqual(
    columnWidthHints(header, rows, 4, ['left', 'right', 'center', 'left']),
    ['compact', 'compact', 'compact', 'compact']
  );
  assert.deepEqual(
    columnWidthHints([], [['正常长度的文字']], 1, ['left']),
    ['auto']
  );
  assert.deepEqual(
    columnWidthHints(['说明'], [['这一列的内容明显更长一些，需要更多空间。']], 1, ['left']),
    ['wide']
  );
  assert.deepEqual(
    columnWidthHints([], [['a\nb']], 1, ['left']),
    ['wide']
  );
});

test('column width plan pads content and caps prose columns', () => {
  const header = ['代码', '名称', '价格', '信号'];
  const rows = [
    ['SZ300473', '德尔股份', '0.8607', '20日+63.2% · 截面·成交额95% · 成交额14.4亿'],
    ['SH688585', '上纬新材', '0.8701', '日内低点-11.4% · 截面·股价95% · 成交额33.5亿'],
  ];
  const widths = columnWidthPlan(header, rows, 4, [
    'left',
    'left',
    'right',
    'left',
  ]);
  assert.equal(widths.length, 4);
  assert.ok(widths[0] >= displayWidth('SZ300473') + 2);
  assert.ok(widths[1] >= displayWidth('德尔股份') + 2);
  assert.ok(widths[2] <= 22);
  assert.ok(widths[3] <= 64);
  assert.ok(widths[3] >= 20);
});

test('compact numeric/date columns fit long header labels and timestamps', () => {
  const header = ['累计成交额（亿元）', '更新时间'];
  const rows = [
    ['123.45', '2026-11-13 10:42:31'],
    ['98.7', '2026-11-12 23:59:59'],
  ];
  const widths = columnWidthPlan(header, rows, 2, ['right', 'right']);
  assert.ok(widths[0] >= displayWidth(header[0]) + 1);
  assert.ok(widths[1] >= displayWidth(rows[0][1]) + 1);
  assert.ok(widths.every((width) => width <= 22));
});

test('TXT header detection ignores stock data but recognizes a text header', () => {
  const stock = [
    ['SZ300473', '德尔股份', '0.8607', 'xgboost'],
    ['SH688585', '上纬新材', '0.8701', 'lightgbm'],
  ];
  assert.equal(looksLikeHeaderRow(stock, 0, 4), false);
  const table = [
    ['名称', '数量', '启用'],
    ['苹果', '12', 'true'],
    ['香蕉', '8', 'false'],
  ];
  assert.equal(looksLikeHeaderRow(table, 0, 3), true);
  assert.equal(
    looksLikeHeaderRow(
      [
        ['甲', '乙'],
        ['丙', '丁'],
      ],
      0,
      2
    ),
    false
  );
});

test('delimiter sniffing prefers the structural separator over embedded text', () => {
  // A 3-column TSV whose text fields contain commas: the comma candidate also
  // yields a consistent field count, and used to win the "fewer fields"
  // tie-break, leaving tabs inside cells.
  const tsv = 'name,en\tnote\tqty\nalpha\tred, green\t2\nbeta\tx, y\t3\n';
  assert.equal(detectDelimiter(tsv), '\t');
  assert.equal(parseDelimited(tsv, detectDelimiter(tsv)).rows[0].length, 3);

  // Quoted semicolon fields containing commas: comma parsing leaves stray
  // quotes behind, which is now evidence against it.
  const semicolon = '"x,y";"1,2"\n"a,b";"3,4"\n';
  assert.equal(detectDelimiter(semicolon), ';');
  assert.equal(parseDelimited(semicolon, detectDelimiter(semicolon)).rows[0].length, 2);

  // Decimal commas with a semicolon separator and no header.
  const decimal = 'a;b\n1,5;2,5\n2,5;3,5\n';
  assert.equal(detectDelimiter(decimal), ';');
  assert.equal(parseDelimited(decimal, detectDelimiter(decimal)).rows[0].length, 2);
});

test('a tab inside a comma CSV cell does not flip the delimiter', () => {
  // Both comma and tab readings are 2x2 here; the tab-in-cell evidence must
  // only count when the tab reading has MORE columns (a real TSV).
  assert.equal(detectDelimiter('a,hello\tworld\nb,foo\tbar\n'), ',');
  assert.equal(detectDelimiter('name,desc\na,hello\tworld\nb,foo\tbar\n'), ',');
  assert.equal(detectDelimiter('a\tb\nx,y\tz\n'), '\t');
});
