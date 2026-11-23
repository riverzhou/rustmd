// SPDX-License-Identifier: MIT OR Apache-2.0
// Pure parsers for the CSV / TXT / JSON previews. Kept DOM-free so
// `node --test` can cover quoting, delimiter sniffing, tab alignment and
// JSON stats directly (the renderer lives in dataview.js).

export const DELIMITERS = [
  { char: ',', key: 'comma' },
  { char: '\t', key: 'tab' },
  { char: ';', key: 'semicolon' },
  { char: '|', key: 'pipe' },
];

const BOM = '\uFEFF';

export function stripBom(text) {
  const value = String(text ?? '');
  return value.startsWith(BOM) ? value.slice(1) : value;
}

export function normalizeNewlines(text) {
  return String(text ?? '').replace(/\r\n?/g, '\n');
}

function parseDelimitedInternal(text, delimiter, { rowLimit = Infinity } = {}) {
  const src = normalizeNewlines(stripBom(text));
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let unclosedQuote = false;
  let fieldQuoted = false;
  let i = 0;

  const endField = () => {
    row.push(field);
    field = '';
    fieldQuoted = false;
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };

  while (i < src.length) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"' && field.length === 0) {
      inQuotes = true;
      fieldQuoted = true;
      i += 1;
      continue;
    }
    if (ch === delimiter) {
      endField();
      i += 1;
      continue;
    }
    if (ch === '\n') {
      endRow();
      i += 1;
      if (rows.length >= rowLimit) {
        return { rows: rows.slice(0, rowLimit), unclosedQuote, truncated: true };
      }
      continue;
    }
    field += ch;
    i += 1;
  }
  if (inQuotes) unclosedQuote = true;
  // A quoted empty field (`""`) has no content and no preceding delimiter, so
  // the old `field.length || row.length` test dropped the entire record. Keep
  // it (and an unclosed quote's partial field) so the renderer can warn.
  if (field.length || row.length || fieldQuoted) endRow();
  return {
    rows: rows.slice(0, rowLimit),
    unclosedQuote,
    truncated: rows.length > rowLimit,
  };
}

/**
 * RFC 4180-ish parser: quoted fields may contain delimiters, doubled quotes
 * and newlines. A trailing newline does not create a phantom final row.
 */
export function parseDelimited(text, delimiter = ',') {
  const { rows, unclosedQuote } = parseDelimitedInternal(text, delimiter);
  return {
    rows,
    delimiter,
    unclosedQuote,
  };
}

/// Cells that still contain a quote are evidence that this candidate
/// mangled quoting (the real separator would not leave stray quotes behind).
function quoteGarbage(rows) {
  let garbage = 0;
  for (const row of rows) {
    for (const cell of row) {
      if (cell.includes('"')) garbage += 1;
    }
  }
  return garbage;
}

/// Tabs left inside cells of a non-tab parse are only suspicious when the tab
/// reading actually has MORE columns (a TSV whose text contains commas). A
/// comma CSV with a tab inside a text cell parses to the same column count,
/// so it must not be pushed toward the tab delimiter.
function tabGarbage(rows) {
  let garbage = 0;
  for (const row of rows) {
    for (const cell of row) {
      if (cell.includes('	')) garbage += 1;
    }
  }
  return garbage;
}

function modeFieldCount(rows) {
  const counts = new Map();
  let best = 0;
  let bestCount = 0;
  for (const row of rows) {
    const n = row.length;
    if (n < 2) continue;
    const next = (counts.get(n) || 0) + 1;
    counts.set(n, next);
    if (next > bestCount) {
      best = n;
      bestCount = next;
    }
  }
  return { fields: best, count: bestCount };
}

/**
 * Sniff the delimiter from the first few records. Consistency of the column
 * count matters more than raw occurrence count, so a tab file whose text
 * fields contain commas still picks tabs.
 */
export function detectDelimiter(text) {
  const sample = normalizeNewlines(stripBom(text)).slice(0, 20000);
  if (!sample) return ',';
  const stats = [];
  for (const candidate of DELIMITERS) {
    const { rows } = parseDelimitedInternal(sample, candidate.char, {
      rowLimit: 20,
    });
    const scoredRows = rows.filter((row) => row.some((cell) => cell.length > 0));
    const { fields, count } = modeFieldCount(scoredRows);
    if (!fields) continue;
    stats.push({ char: candidate.char, scoredRows, fields, count });
  }
  const tabFields = stats.find((stat) => stat.char === '	')?.fields || 0;
  let best = ',';
  let bestScore = -1;
  for (const stat of stats) {
    const usable = stat.scoredRows.filter((row) => row.length > 1).length;
    // Coverage matters: commas inside one text field may yield more columns
    // than the real delimiter, but they are missing from the header row (and
    // often other rows). A delimiter that appears in every meaningful row is
    // the structural one.
    const coverage = usable / Math.max(1, stat.scoredRows.length);
    const consistency = stat.count / Math.max(1, usable);
    const garbage =
      quoteGarbage(stat.scoredRows) +
      (stat.char !== '	' && stat.fields < tabFields
        ? tabGarbage(stat.scoredRows)
        : 0);
    // Only on a full coverage/consistency tie does the field count decide:
    // structural delimiters normally produce fewer fields than punctuation
    // embedded inside text fields (e.g. decimal commas in a semicolon file).
    const score =
      coverage * 1000 +
      consistency * 500 +
      Math.min(usable, 20) -
      stat.fields -
      garbage * 2;
    if (score > bestScore) {
      bestScore = score;
      best = stat.char;
    }
  }
  return best;
}

export function delimiterKey(delimiter) {
  const entry = DELIMITERS.find((d) => d.char === delimiter);
  return entry ? entry.key : 'comma';
}

export function normalizeText(text) {
  return normalizeNewlines(stripBom(text));
}

/**
 * Split a plain-text note into display rows at tab stops. Rows never lose
 * content: columns beyond `maxCols` are folded into the last visible cell.
 * Returns all source counts so the renderer can show a truncation notice.
 */
export function buildTextRows(text, { maxLines = 5000, maxCols = 80 } = {}) {
  const normalized = normalizeText(text);
  if (!normalized) {
    return {
      rows: [],
      totalLines: 0,
      columns: 1,
      totalColumns: 1,
      truncatedLines: false,
      truncatedColumns: false,
    };
  }
  const lines = normalized.split('\n');
  if (normalized.endsWith('\n')) lines.pop();
  const totalLines = lines.length;
  let totalColumns = 1;
  for (const line of lines) {
    const count = line.split('\t').length;
    if (count > totalColumns) totalColumns = count;
  }
  const shown = lines.slice(0, maxLines);
  const rows = shown.map((line) => {
    let cells = line.split('\t');
    if (cells.length > maxCols) {
      cells = [...cells.slice(0, maxCols - 1), cells.slice(maxCols - 1).join('\t')];
    }
    return cells;
  });
  return {
    rows,
    totalLines,
    columns: Math.min(totalColumns, maxCols),
    totalColumns,
    truncatedLines: totalLines > maxLines,
    truncatedColumns: totalColumns > maxCols,
  };
}

const MISSING_CELL = /^(?:-|--|–|—|n\/a|na|null|nil|none|无|空)$/i;
const DATE_CELL =
  /^(?:\d{4}[-/.]\d{1,2}[-/.]\d{1,2}(?:[ T]\d{1,2}:\d{2}(?::\d{2})?)?|\d{1,2}:\d{2}(?::\d{2})?)$/;
const BOOLEAN_CELL = /^(?:true|false|yes|no|on|off|是|否)$/i;

export function isMissingCell(value) {
  return MISSING_CELL.test(String(value ?? '').trim());
}

export function isNumericCell(value) {
  const s = String(value ?? '').trim();
  if (!s) return false;
  return (
    /^[-+]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?%?$/.test(s) ||
    /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?%?$/.test(s) ||
    /^[-+]?[$€£¥￥]\s?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?%?$/.test(s) ||
    /^\((?:(?:\d{1,3}(?:,\d{3})+)|\d+)(?:\.\d+)?\)$/.test(s)
  );
}

export function isDateCell(value) {
  return DATE_CELL.test(String(value ?? '').trim());
}

export function isBooleanCell(value) {
  return BOOLEAN_CELL.test(String(value ?? '').trim());
}

/**
 * Column alignment inferred from the data rather than the header text:
 * numbers and dates right, booleans centered, everything else left. Empty
 * cells and common missing markers (`-`, `N/A`, `无`) are ignored so a sparse
 * numeric column still lines up. Renderers apply the SAME class to `<th>` and
 * `<td>` so a header never disagrees with its column.
 */
const WIDE_CHAR =
  /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︐-︙︰-﹯＀-｠￠-￦]/;

/** Rough terminal-cell width: CJK characters count as two columns. */
export function displayWidth(value) {
  let width = 0;
  for (const ch of String(value ?? '')) width += WIDE_CHAR.test(ch) ? 2 : 1;
  return width;
}

/**
 * Suggest a display width for each column. Compact columns (numbers, dates,
 * booleans, short labels) shrink to their content; long text columns are
 * marked wide. The renderer also computes a table minimum width from the
 * column count, so many-column data scrolls horizontally instead of squeezing
 * every cell into an unreadable strip.
 */
export function columnWidthHints(
  header,
  rows,
  columns,
  alignments,
  { compactMax = 12, wideMin = 28 } = {}
) {
  const hints = [];
  for (let i = 0; i < columns; i += 1) {
    if (alignments[i] === 'right' || alignments[i] === 'center') {
      hints.push('compact');
      continue;
    }
    let max = 0;
    let multiline = false;
    const consider = (value) => {
      const text = String(value ?? '');
      if (text.includes('\n')) multiline = true;
      for (const line of text.split('\n')) {
        const width = displayWidth(line);
        if (width > max) max = width;
      }
    };
    consider(header[i]);
    for (const row of rows) consider(row[i]);
    if (multiline) hints.push('wide');
    else if (!max || max <= compactMax) hints.push('compact');
    else if (max >= wideMin) hints.push('wide');
    else hints.push('auto');
  }
  return hints;
}

export function columnAlignments(rows, columns) {
  const out = [];
  for (let i = 0; i < columns; i += 1) {
    const kinds = new Set();
    for (const row of rows) {
      const raw = String(row[i] ?? '').trim();
      if (!raw || isMissingCell(raw)) continue;
      if (isNumericCell(raw) || isDateCell(raw)) kinds.add('number');
      else if (isBooleanCell(raw)) kinds.add('boolean');
      else kinds.add('text');
    }
    if (!kinds.size) out.push('left');
    else if (kinds.size === 1 && kinds.has('number')) out.push('right');
    else if (kinds.size === 1 && kinds.has('boolean')) out.push('center');
    else out.push('left');
  }
  return out;
}

/**
 * Numeric face value of a cell for sorting. Accepts the same shapes as
 * `isNumericCell` (thousands separators, currency, percent, accounting
 * parentheses) and returns null when the cell is not numeric. Percentages keep
 * their face value ("12%" → 12): within one column the scale is the same, so
 * multiplying by 0.01 would only matter when percent and plain numbers are
 * mixed.
 */
export function numericCellValue(value) {
  const s = String(value ?? '').trim();
  if (!s || !isNumericCell(s)) return null;
  let text = s;
  let sign = 1;
  if (text.startsWith('(') && text.endsWith(')')) {
    sign = -1;
    text = text.slice(1, -1);
  }
  text = text.replace(/[$€£¥￥\s,]/g, '');
  if (text.endsWith('%')) text = text.slice(0, -1);
  const number = Number(text);
  return Number.isFinite(number) ? sign * number : null;
}

const DATE_PARTS =
  /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;
const TIME_PARTS = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;

/**
 * Comparable timestamp for a date/time cell, or null when the text is not a
 * date. Calendar dates are built in UTC so the result never shifts with the
 * viewer's timezone; time-only cells (a schedule column) compare as seconds
 * since midnight.
 */
export function dateCellValue(value) {
  const s = String(value ?? '').trim();
  if (!s || !isDateCell(s)) return null;
  const date = DATE_PARTS.exec(s);
  if (date) {
    const year = Number(date[1]);
    const month = Number(date[2]);
    const day = Number(date[3]);
    const hour = Number(date[4] ?? 0);
    const minute = Number(date[5] ?? 0);
    const second = Number(date[6] ?? 0);
    if (
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > 31 ||
      hour > 23 ||
      minute > 59 ||
      second > 59
    ) {
      return null;
    }
    const stamp = new Date(0);
    stamp.setUTCFullYear(year, month - 1, day);
    stamp.setUTCHours(hour, minute, second, 0);
    // Reject impossible dates such as 2026-02-31 instead of letting them roll
    // into March and silently reorder the table.
    if (stamp.getUTCMonth() !== month - 1 || stamp.getUTCDate() !== day) {
      return null;
    }
    return stamp.getTime();
  }
  const time = TIME_PARTS.exec(s);
  if (!time) return null;
  const hour = Number(time[1]);
  const minute = Number(time[2]);
  const second = Number(time[3] ?? 0);
  if (hour > 23 || minute > 59 || second > 59) return null;
  return hour * 3600 + minute * 60 + second;
}

const TRUE_CELL = /^(?:true|yes|on|是)$/i;
const FALSE_CELL = /^(?:false|no|off|否)$/i;

/** Boolean value for sorting, or null when the cell is not a known boolean. */
export function booleanCellValue(value) {
  const s = String(value ?? '').trim();
  if (!s) return null;
  if (TRUE_CELL.test(s)) return true;
  if (FALSE_CELL.test(s)) return false;
  return null;
}

/**
 * How a column should be compared when its header is clicked. Numeric, date
 * and boolean columns sort by value; anything mixed or textual falls back to a
 * natural, case-insensitive text collation (so "item2" precedes "item10").
 */
export function columnSortKind(rows, column) {
  let kind = null;
  for (const row of rows) {
    const raw = String(row?.[column] ?? '').trim();
    if (!raw || isMissingCell(raw)) continue;
    let next;
    if (numericCellValue(raw) !== null) next = 'number';
    else if (dateCellValue(raw) !== null) next = 'date';
    else if (booleanCellValue(raw) !== null) next = 'boolean';
    else return 'text';
    if (kind && kind !== next) return 'text';
    kind = next;
  }
  return kind || 'text';
}

const collators = new Map();

function textCollator(locale) {
  const key = locale ? String(locale) : '';
  let collator = collators.get(key);
  if (!collator) {
    try {
      collator = new Intl.Collator(locale || undefined, {
        numeric: true,
        sensitivity: 'base',
      });
    } catch {
      collator = null;
    }
    collators.set(key, collator);
  }
  return collator;
}

function sortKey(value, kind) {
  if (kind === 'number') return numericCellValue(value);
  if (kind === 'date') return dateCellValue(value);
  if (kind === 'boolean') return booleanCellValue(value);
  const s = String(value ?? '').trim();
  return !s || isMissingCell(s) ? null : s;
}

function compareText(a, b, locale) {
  const collator = textCollator(locale);
  if (collator) return collator.compare(a, b);
  return a.localeCompare(b, locale || undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

/**
 * Original row indexes in display order for one column. The input array is
 * never mutated, empty/missing cells always sink to the bottom (also in
 * descending order), and ties keep the source order so a click cannot shuffle
 * equal rows. `direction` is 'asc' (default) or 'desc'.
 */
export function sortRowOrder(rows, column, direction = 'asc', { locale = '' } = {}) {
  const list = Array.isArray(rows) ? rows : [];
  const index = Number.isInteger(column) ? column : -1;
  const kind = columnSortKind(list, index);
  const keys = list.map((row) => sortKey(row?.[index], kind));
  const descending = direction === 'desc';
  const order = list.map((_, i) => i);
  order.sort((a, b) => {
    const left = keys[a];
    const right = keys[b];
    // Missing cells stay at the end whichever way the column is sorted.
    if (left === null || right === null) {
      if (left === right) return a - b;
      return left === null ? 1 : -1;
    }
    let cmp;
    if (kind === 'number' || kind === 'date') {
      cmp = left - right;
    } else if (kind === 'boolean') {
      cmp = Number(left) - Number(right);
    } else {
      cmp = compareText(String(left), String(right), locale);
    }
    if (cmp) return descending ? -cmp : cmp;
    return a - b;
  });
  return order;
}

/** A sorted copy of `rows` (see `sortRowOrder`). */
export function sortTableRows(rows, column, direction = 'asc', options = {}) {
  const list = Array.isArray(rows) ? rows : [];
  return sortRowOrder(list, column, direction, options).map((i) => list[i]);
}

/**
 * Cap and floor (in `ch`) for one column. Compact numeric/date/boolean columns
 * cap tighter than prose columns; both floor at roughly a header's width so a
 * sparse column does not collapse. Shared by the `ch` plan and the renderer's
 * measured widths so both apply the same limits.
 */
export function columnWidthLimit(
  alignment,
  { compactMax = 22, textMax = 64, min = 5 } = {}
) {
  const compact = alignment === 'right' || alignment === 'center';
  return {
    compact,
    cap: compact ? compactMax : textMax,
    floor: compact ? Math.min(min, compactMax) : Math.max(6, min),
  };
}

/**
 * Per-column width target in `ch`, including a little breathing room. This is
 * shared by CSV and TXT so the same content gets the same table geometry.
 * Compact numeric/date/boolean columns cap tighter than prose columns.
 *
 * `ch` is only the width of "0", so this plan is an estimate: the renderer
 * measures the same rows with the real font and only falls back to these
 * values when text measurement is unavailable.
 */
export function columnWidthPlan(
  header,
  rows,
  columns,
  alignments,
  { compactMax = 22, textMax = 64, min = 5, paddingCh = 3 } = {}
) {
  const widths = [];
  for (let i = 0; i < columns; i += 1) {
    let max = 0;
    const consider = (value) => {
      for (const line of String(value ?? '').split('\n')) {
        const width = displayWidth(line);
        if (width > max) max = width;
      }
    };
    consider(header[i]);
    for (const row of rows) consider(row[i]);
    const limit = columnWidthLimit(alignments[i], { compactMax, textMax, min });
    // `ch` is content width; add room for the 10px horizontal cell padding so
    // codes and numbers like SZ300473 / 0.8607 never wrap into two lines.
    widths.push(Math.max(limit.floor, Math.min(max + paddingCh, limit.cap)));
  }
  return widths;
}

/**
 * Rough advance weight per display unit, used only to rank measurement
 * candidates: Latin glyphs are wider than the "0" that defines a `ch`, while a
 * CJK glyph is not quite two digits. "XD阿拉丁" is wider on screen than the
 * 4-CJK-char names it ties with at `displayWidth` 8, so ranking candidates by
 * bare character count would miss it and the renderer would under-measure.
 */
const LATIN_WEIGHT = 1.15;

function weightedWidth(value) {
  let width = 0;
  for (const ch of String(value ?? '')) {
    width += WIDE_CHAR.test(ch) ? 2 : LATIN_WEIGHT;
  }
  return width;
}

/**
 * The widest cell text per column, so a renderer that can measure real glyph
 * widths can size a column to fit instead of trusting the `ch` estimate.
 * Candidates are ranked by weighted display width (not string length: a
 * 4-CJK-char name is wider than a 5-char mixed label), keeping up to `limit`
 * distinct strings at the column's maximum so a different-script string of the
 * same nominal width is still measured.
 */
export function columnWidthSamples(rows, columns, { limit = 3 } = {}) {
  const samples = Array.from({ length: columns }, () => []);
  const widest = new Array(columns).fill(-1);
  for (const row of rows) {
    for (let i = 0; i < columns; i += 1) {
      const text = String(row[i] ?? '');
      if (!text) continue;
      let width = 0;
      for (const line of text.split('\n')) {
        const lineWidth = weightedWidth(line);
        if (lineWidth > width) width = lineWidth;
      }
      if (width > widest[i]) {
        widest[i] = width;
        samples[i] = [text];
      } else if (
        width === widest[i] &&
        samples[i].length < limit &&
        !samples[i].includes(text)
      ) {
        samples[i].push(text);
      }
    }
  }
  return samples;
}

/**
 * TXT has no formal header row. Detect a conservative one: every cell must be
 * text (not a number/date/boolean) and at least one later row must contain a
 * typed cell. The stock-signal logs have a numeric score in their first data
 * row, so they correctly render without a synthetic bold header.
 */
export function looksLikeHeaderRow(rows, index, columns) {
  const header = rows[index];
  if (!header || header.length < 2) return false;
  const cells = header.slice(0, columns).map((cell) => String(cell ?? '').trim());
  if (!cells.some(Boolean)) return false;
  if (cells.some((cell) => isNumericCell(cell) || isDateCell(cell) || isBooleanCell(cell))) {
    return false;
  }
  return rows.slice(index + 1).some((row) =>
    row
      .slice(0, columns)
      .some((cell) => isNumericCell(cell) || isDateCell(cell) || isBooleanCell(cell))
  );
}

export function jsonTypeOf(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

/** Iterative stats so deeply nested JSON cannot overflow the call stack. */
export function jsonStats(value) {
  let nodes = 0;
  let maxDepth = 0;
  const stack = [[value, 0]];
  while (stack.length) {
    const [current, depth] = stack.pop();
    nodes += 1;
    if (depth > maxDepth) maxDepth = depth;
    if (Array.isArray(current)) {
      for (const item of current) stack.push([item, depth + 1]);
    } else if (current && typeof current === 'object') {
      for (const item of Object.values(current)) stack.push([item, depth + 1]);
    }
  }
  const type = jsonTypeOf(value);
  return {
    nodes,
    maxDepth,
    rootType: type,
    rootCount:
      type === 'array'
        ? value.length
        : type === 'object'
          ? Object.keys(value).length
          : 0,
  };
}

export function analyzeJson(text) {
  const source = stripBom(String(text ?? '')).trim();
  if (!source) return { ok: false, empty: true };
  try {
    const value = JSON.parse(source);
    return { ok: true, empty: false, value, ...jsonStats(value) };
  } catch (error) {
    return {
      ok: false,
      empty: false,
      error: error && error.message ? error.message : String(error),
    };
  }
}

export function formatBytes(bytes) {
  const n = Math.max(0, Number(bytes) || 0);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
