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
  let best = ',';
  let bestScore = -1;
  for (const candidate of DELIMITERS) {
    const { rows } = parseDelimitedInternal(sample, candidate.char, {
      rowLimit: 20,
    });
    const scoredRows = rows.filter((row) => row.some((cell) => cell.length > 0));
    const { fields, count } = modeFieldCount(scoredRows);
    if (!fields) continue;
    const usable = scoredRows.filter((row) => row.length > 1).length;
    // Coverage matters: commas inside one text field may yield more columns
    // than the real delimiter, but they are missing from the header row (and
    // often other rows). A delimiter that appears in every meaningful row is
    // the structural one.
    const coverage = usable / Math.max(1, scoredRows.length);
    const consistency = count / Math.max(1, usable);
    // On a coverage/consistency tie, prefer the candidate with fewer
    // columns: structural delimiters normally produce fewer fields than
    // punctuation embedded inside text fields. Without this, a 4-column
    // comma reading of a 2-column TSV wins only because it has more columns.
    const score =
      coverage * 1000 +
      consistency * 500 +
      Math.min(usable, 20) -
      fields;
    if (score > bestScore) {
      bestScore = score;
      best = candidate.char;
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
 * Per-column width target in `ch`, including a little breathing room. This is
 * shared by CSV and TXT so the same content gets the same table geometry.
 * Compact numeric/date/boolean columns cap tighter than prose columns.
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
    const compact = alignments[i] === 'right' || alignments[i] === 'center';
    const cap = compact ? compactMax : textMax;
    const floor = compact ? Math.min(min, cap) : Math.max(6, min);
    // `ch` is content width; add room for the 10px horizontal cell padding so
    // codes and numbers like SZ300473 / 0.8607 never wrap into two lines.
    widths.push(Math.max(floor, Math.min(max + paddingCh, cap)));
  }
  return widths;
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
