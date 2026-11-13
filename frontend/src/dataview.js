// DOM renderers for the CSV / TXT / JSON previews. All note text reaches the
// document through textContent (never innerHTML), so a data note cannot inject
// markup even though it bypasses the Markdown sanitizer.
import { t } from './i18n.js';
import DATA_VIEW_CSS from './dataview.css?raw';
import {
  analyzeJson,
  buildTextRows,
  columnAlignments,
  columnWidthHints,
  delimiterKey,
  detectDelimiter,
  jsonTypeOf,
  parseDelimited,
} from './dataformat.js';

export { DATA_VIEW_CSS };

const MAX_CSV_DATA_ROWS = 2000;
const MAX_CSV_COLS = 100;
const MAX_TXT_LINES = 5000;
const MAX_TXT_COLS = 80;
const MAX_JSON_NODES = 6000;

const KIND_LABEL = { csv: 'CSV', txt: 'TXT', json: 'JSON' };

function make(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function addHead(view, kind, stats) {
  const head = make('div', 'data-view-head');
  head.appendChild(make('span', `data-kind-chip ${kind}`, KIND_LABEL[kind]));
  const meta = make('span', 'data-view-stats');
  meta.textContent = stats.filter(Boolean).join(' · ');
  head.appendChild(meta);
  view.appendChild(head);
}

function addNotice(view, text, tone = 'info') {
  if (!text) return;
  view.appendChild(make('div', `data-note ${tone}`, text));
}

function createView(container, kind, stats) {
  container.replaceChildren();
  const view = make('div', `data-view data-view-${kind}`);
  addHead(view, kind, stats);
  container.appendChild(view);
  return view;
}

function createScroll() {
  const scroll = make('div', 'data-table-scroll');
  scroll.tabIndex = 0;
  scroll.setAttribute('role', 'region');
  return scroll;
}

function alignmentClass(align) {
  if (align === 'right') return 'align-right';
  if (align === 'center') return 'align-center';
  return 'align-left';
}

function tableCell(tag, text, align = 'left', widthHint = 'auto') {
  const classes = [alignmentClass(align)];
  if (widthHint !== 'auto') classes.push(`col-${widthHint}`);
  const cell = make(tag, classes.join(' '));
  cell.textContent = text === '' ? '\u00a0' : text;
  return cell;
}

function renderEmpty(container, kind) {
  const view = createView(container, kind, [t('data.empty')]);
  view.appendChild(make('p', 'data-empty', t('data.emptyHint')));
  return view;
}

function typeLabel(type) {
  const key = `data.type${type.charAt(0).toUpperCase()}${type.slice(1)}`;
  return t(key);
}

function renderCsv(container, source) {
  const delimiter = detectDelimiter(source);
  const parsed = parseDelimited(source, delimiter);
  const rows = parsed.rows;
  if (!rows.length) {
    const view = renderEmpty(container, 'csv');
    if (parsed.unclosedQuote) {
      addNotice(view, t('data.csvUnclosedQuote'), 'warning');
    }
    return;
  }
  // Do not spread every row into Math.max: a CSV with tens of thousands of
  // records would exceed the argument limit and throw before rendering.
  let totalColumns = 1;
  for (const row of rows) {
    if (row.length > totalColumns) totalColumns = row.length;
  }
  const columns = Math.min(totalColumns, MAX_CSV_COLS);
  const header = rows[0];
  const body = rows.slice(1, MAX_CSV_DATA_ROWS + 1);
  const align = columnAlignments(
    body.map((row) => row.slice(0, columns)),
    columns
  );
  const widthHints = columnWidthHints(header, body, columns, align);
  const dkey = delimiterKey(delimiter);
  const stats = [
    t('data.csvSummary', {
      rows: Math.max(0, rows.length - 1),
      cols: totalColumns,
      delimiter: t(`data.delimiter${dkey.charAt(0).toUpperCase()}${dkey.slice(1)}`),
    }),
  ];
  const view = createView(container, 'csv', stats);
  const scroll = createScroll();
  scroll.setAttribute('aria-label', t('data.tableLabel'));
  const table = make('table', 'data-table');
  table.style.setProperty('--data-cols', String(columns));
  const thead = make('thead');
  const headRow = make('tr');
  for (let i = 0; i < columns; i += 1) {
    const cell = tableCell(
      'th',
      String(header[i] ?? ''),
      align[i],
      widthHints[i]
    );
    cell.scope = 'col';
    headRow.appendChild(cell);
  }
  thead.appendChild(headRow);
  table.appendChild(thead);
  const tbody = make('tbody');
  for (let r = 0; r < body.length; r += 1) {
    const tr = make('tr');
    for (let c = 0; c < columns; c += 1) {
      tr.appendChild(
        tableCell('td', String(body[r][c] ?? ''), align[c], widthHints[c])
      );
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  scroll.appendChild(table);
  view.appendChild(scroll);
  if (rows.length - 1 > body.length) {
    addNotice(
      view,
      t('data.truncatedRows', { shown: body.length, total: rows.length - 1 })
    );
  }
  if (totalColumns > columns) {
    addNotice(
      view,
      t('data.truncatedColumns', { shown: columns, total: totalColumns })
    );
  }
  if (parsed.unclosedQuote) addNotice(view, t('data.csvUnclosedQuote'), 'warning');
}

function renderTxt(container, source) {
  const viewData = buildTextRows(source, {
    maxLines: MAX_TXT_LINES,
    maxCols: MAX_TXT_COLS,
  });
  if (!viewData.rows.length) {
    renderEmpty(container, 'txt');
    return;
  }
  const columns = viewData.columns;
  // The first tab-separated row is normally the column header. There may be
  // introductory prose rows before it (and those are rendered as colspan
  // lines), so find the first row with multiple cells and skip only that
  // header row for type inference. The header then takes the same alignment
  // as its data (numbers right, booleans centered) instead of forcing text.
  const firstMultiCell = viewData.rows.findIndex((row) => row.length > 1);
  const alignRows =
    firstMultiCell >= 0
      ? viewData.rows.slice(firstMultiCell + 1)
      : viewData.rows;
  const align = columnAlignments(alignRows, columns);
  // Rows with one cell are rendered as a colspan line (prose paragraph), not
  // as a value in column 0; exclude them from column width inference.
  const widthRows =
    columns > 1 ? viewData.rows.filter((row) => row.length > 1) : viewData.rows;
  const widthHints = columnWidthHints([], widthRows, columns, align);
  const stats = [t('data.txtSummary', { lines: viewData.totalLines })];
  if (columns > 1) stats.push(t('data.txtColumns', { cols: columns }));
  const view = createView(container, 'txt', stats);
  const scroll = createScroll();
  scroll.setAttribute('aria-label', t('data.tableLabel'));
  const table = make('table', 'txt-table');
  table.style.setProperty('--data-cols', String(columns));
  const tbody = make('tbody');
  for (let r = 0; r < viewData.rows.length; r += 1) {
    const row = viewData.rows[r];
    const tr = make('tr');
    const headerRow = r === firstMultiCell;
    for (let c = 0; c < row.length; c += 1) {
      const last = c === row.length - 1;
      const span = last ? columns - row.length + 1 : 1;
      const cell = tableCell(
        headerRow ? 'th' : 'td',
        String(row[c] ?? ''),
        span === 1 ? align[c] : 'left',
        span === 1 ? widthHints[c] : 'auto'
      );
      if (headerRow) cell.scope = 'col';
      if (span > 1) cell.colSpan = span;
      tr.appendChild(cell);
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  scroll.appendChild(table);
  view.appendChild(scroll);
  if (viewData.truncatedLines) {
    addNotice(
      view,
      t('data.truncatedLines', {
        shown: viewData.rows.length,
        total: viewData.totalLines,
      })
    );
  }
  if (viewData.truncatedColumns) {
    addNotice(
      view,
      t('data.truncatedColumns', {
        shown: columns,
        total: viewData.totalColumns,
      })
    );
  }
}

function jsonEntries(value) {
  return Array.isArray(value)
    ? value.map((item, index) => ({ key: null, index, value: item }))
    : Object.entries(value).map(([key, item]) => ({ key, index: null, value: item }));
}

function jsonKeyCell(key, index, caret = false) {
  const cell = make('span', index !== null ? 'json-key-cell index' : 'json-key-cell');
  if (caret) cell.appendChild(make('span', 'json-caret'));
  if (index !== null) cell.appendChild(make('span', 'json-index', String(index)));
  else cell.appendChild(make('span', 'json-key', String(key ?? '')));
  return cell;
}

function jsonTypeChip(type) {
  return make('span', `json-type ${type}`, typeLabel(type));
}

function jsonCountLabel(type, count) {
  return t(type === 'object' ? 'data.jsonKeys' : 'data.jsonItems', { n: count });
}

function jsonDisplay(value, type) {
  if (type === 'string') return JSON.stringify(value);
  if (type === 'null') return 'null';
  return String(value);
}

function jsonPreview(value, type) {
  if (type === 'object') {
    const preferred = ['name', 'title', 'id', 'label', 'version'];
    for (const key of preferred) {
      const item = value[key];
      const itemType = jsonTypeOf(item);
      if (item !== undefined && itemType !== 'object' && itemType !== 'array') {
        return `${key}: ${jsonDisplay(item, itemType)}`;
      }
    }
    return '';
  }
  if (type === 'array') {
    const primitives = value
      .filter((item) => {
        const itemType = jsonTypeOf(item);
        return itemType !== 'object' && itemType !== 'array';
      })
      .slice(0, 4)
      .map((item) => jsonDisplay(item, jsonTypeOf(item)));
    return primitives.join(', ');
  }
  return '';
}

function jsonScalarRow(value, type, key, index) {
  const row = make('div', 'json-row');
  if (key !== null || index !== null) row.appendChild(jsonKeyCell(key, index));
  const text = make('span', `json-value ${type}`, jsonDisplay(value, type));
  row.appendChild(text);
  return row;
}

function jsonEmptyRow(type, key, index) {
  const row = make('div', 'json-row json-empty-row');
  if (key !== null || index !== null) row.appendChild(jsonKeyCell(key, index));
  row.appendChild(jsonTypeChip(type));
  row.appendChild(
    make(
      'span',
      'json-empty',
      t(type === 'object' ? 'data.jsonEmptyObject' : 'data.jsonEmptyArray')
    )
  );
  return row;
}

function buildJsonNode(value, key, index, ctx) {
  if (ctx.built >= MAX_JSON_NODES) {
    ctx.truncated = true;
    return null;
  }
  const type = jsonTypeOf(value);
  if (type !== 'object' && type !== 'array') {
    ctx.built += 1;
    return jsonScalarRow(value, type, key, index);
  }
  const entries = jsonEntries(value);
  ctx.built += 1;
  if (!entries.length) return jsonEmptyRow(type, key, index);

  const details = document.createElement('details');
  details.className = `json-group ${type}`;
  details.open = true;
  const summary = make('summary', `json-group-head ${type}`);
  summary.appendChild(jsonKeyCell(key, index, true));
  summary.appendChild(jsonTypeChip(type));
  summary.appendChild(make('span', 'json-count', jsonCountLabel(type, entries.length)));
  const preview = jsonPreview(value, type);
  if (preview) summary.appendChild(make('span', 'json-preview', preview));
  details.appendChild(summary);

  const body = make('div', `json-group-body ${type}`);
  const fields = make('div', 'json-fields');
  for (let i = 0; i < entries.length; i += 1) {
    if (ctx.built >= MAX_JSON_NODES) {
      ctx.truncated = true;
      break;
    }
    const entry = entries[i];
    const child = buildJsonNode(entry.value, entry.key, entry.index, ctx);
    if (child) fields.appendChild(child);
  }
  body.appendChild(fields);
  details.appendChild(body);
  return details;
}

function renderJson(container, source) {
  const data = analyzeJson(source);
  if (data.empty) {
    renderEmpty(container, 'json');
    return;
  }
  if (!data.ok) {
    const view = createView(container, 'json', [t('data.invalidShort')]);
    addNotice(view, t('data.jsonInvalid', { msg: data.error || '' }), 'error');
    const pre = make('pre', 'data-raw');
    pre.textContent = source;
    view.appendChild(pre);
    return;
  }
  const stats = [typeLabel(data.rootType)];
  if (data.rootType === 'object' || data.rootType === 'array') {
    stats.push(
      t(data.rootType === 'object' ? 'data.jsonKeys' : 'data.jsonItems', {
        n: data.rootCount,
      })
    );
  }
  stats.push(t('data.jsonNodes', { n: data.nodes }));
  const view = createView(container, 'json', stats);
  const inspector = make('div', 'json-inspector');
  const ctx = { built: 0, truncated: false };
  if (data.rootType === 'object' || data.rootType === 'array') {
    const entries = jsonEntries(data.value);
    if (!entries.length) {
      inspector.appendChild(jsonEmptyRow(data.rootType, null, null));
    } else {
      const fields = make('div', 'json-fields');
      for (const entry of entries) {
        if (ctx.built >= MAX_JSON_NODES) {
          ctx.truncated = true;
          break;
        }
        const child = buildJsonNode(entry.value, entry.key, entry.index, ctx);
        if (child) fields.appendChild(child);
      }
      inspector.appendChild(fields);
    }
  } else {
    inspector.appendChild(jsonScalarRow(data.value, data.rootType, null, null));
  }
  view.appendChild(inspector);
  if (ctx.truncated) {
    addNotice(view, t('data.jsonTruncated', { n: MAX_JSON_NODES }), 'warning');
  }
}

/** Render one of the data note kinds into a preview/export container. */
export function renderDataView(container, kind, source) {
  const text = String(source ?? '');
  if (kind === 'csv') renderCsv(container, text);
  else if (kind === 'txt') renderTxt(container, text);
  else renderJson(container, text);
}
