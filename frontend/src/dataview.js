// DOM renderers for the CSV / TXT / JSON previews. All note text reaches the
// document through textContent (never innerHTML), so a data note cannot inject
// markup even though it bypasses the Markdown sanitizer.
import { t } from './i18n.js';
import DATA_VIEW_CSS from './dataview.css?raw';
import {
  analyzeJson,
  buildTextRows,
  columnAlignments,
  columnWidthPlan,
  delimiterKey,
  detectDelimiter,
  jsonTypeOf,
  looksLikeHeaderRow,
  parseDelimited,
} from './dataformat.js';

export { DATA_VIEW_CSS };

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
  // Tear down the previous render's listeners/observers before its DOM goes
  // away (a large table must not stay reachable after switching to Markdown).
  if (typeof container.__dataTeardown === 'function') {
    container.__dataTeardown();
    container.__dataTeardown = null;
  }
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

function tableCell(tag, text, align = 'left') {
  const cell = make(tag, alignmentClass(align));
  cell.textContent = text === '' ? '\u00a0' : text;
  return cell;
}

/**
 * Shared CSV/TXT table geometry. Both kinds use the same alignment inference,
 * the same per-column `ch` width plan, the same colgroup/fixed layout, the
 * same sticky header and the same scroll container. Headerless TXT rows are
 * data, not a synthetic bold first row.
 */
function renderTable(
  container,
  kind,
  { header, body, columns, stats, prose = [], notices = [] }
) {
  // TXT prose/blank rows are rendered as full-width cells (colspan), not as a
  // huge first column. Keep them out of width/alignment inference; otherwise
  // a long prose line makes 名称 hundreds of px wider than its data.
  const measureRows =
    kind === 'txt' ? body.filter((row) => row.length >= columns) : body;
  const align = columnAlignments(
    measureRows.map((row) => row.slice(0, columns)),
    columns
  );
  const widths = columnWidthPlan(header || [], measureRows, columns, align);
  const view = createView(container, kind, stats);
  for (const line of prose) {
    view.appendChild(make('div', 'data-txt-prose', line));
  }
  if (!body.length && !header) {
    view.appendChild(make('p', 'data-empty', t('data.emptyHint')));
  } else {
    const scroll = createScroll();
    scroll.setAttribute('aria-label', t('data.tableLabel'));
    // A second, always-visible horizontal scrollbar above the table. The
    // native bottom bar of a 24-row table is still on-screen now, but when a
    // table is taller than its card the top bar removes the "scroll to the
    // bottom first" discovery problem.
    const topScroll = make('div', 'data-hscroll');
    topScroll.tabIndex = 0;
    topScroll.hidden = true;
    topScroll.setAttribute('aria-label', t('data.tableScroll'));
    const topSpacer = make('div', 'data-hscroll-spacer');
    topScroll.appendChild(topSpacer);
    view.appendChild(topScroll);
    const table = make('table', 'data-table');
    table.style.setProperty('--data-cols', String(columns));
    const colgroup = make('colgroup');
    for (const width of widths) {
      const col = document.createElement('col');
      col.style.width = `${width}ch`;
      colgroup.appendChild(col);
    }
    table.appendChild(colgroup);
    if (header) {
      const thead = make('thead');
      const tr = make('tr');
      for (let c = 0; c < columns; c += 1) {
        const cell = tableCell('th', String(header[c] ?? ''), align[c]);
        cell.scope = 'col';
        tr.appendChild(cell);
      }
      thead.appendChild(tr);
      table.appendChild(thead);
    }
    const tbody = make('tbody');
    for (const row of body) {
      if (!row.length) continue;
      // A blank physical line in a TXT note is a separator, not a table row
      // with an invisible full-width cell.
      if (row.every((cell) => !String(cell ?? '').trim())) continue;
      const tr = make('tr');
      if (kind === 'txt' && row.length < columns) {
        for (let c = 0; c < row.length; c += 1) {
          const last = c === row.length - 1;
          const span = last ? columns - row.length + 1 : 1;
          const cell = tableCell(
            'td',
            String(row[c] ?? ''),
            span === 1 ? align[c] : 'left'
          );
          if (span > 1) cell.colSpan = span;
          tr.appendChild(cell);
        }
      } else {
        for (let c = 0; c < columns; c += 1) {
          tr.appendChild(tableCell('td', String(row[c] ?? ''), align[c]));
        }
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    scroll.appendChild(table);
    view.appendChild(scroll);
    const syncTopScroll = () => {
      const wasHidden = topScroll.hidden;
      const overflow = scroll.scrollWidth - scroll.clientWidth > 1;
      topScroll.hidden = !overflow;
      // The upper bar has no vertical scrollbar, so matching its box to the
      // table viewport (not the full card) keeps both max scrollLeft values
      // identical; otherwise the last ~10px can never be reached.
      if (overflow && scroll.clientWidth > 0) {
        topScroll.style.width = `${scroll.clientWidth}px`;
      }
      topSpacer.style.width = `${scroll.scrollWidth}px`;
      if (!overflow && topScroll.scrollLeft !== 0) topScroll.scrollLeft = 0;
      return wasHidden !== topScroll.hidden;
    };
    topScroll.addEventListener('scroll', () => {
      if (scroll.scrollLeft !== topScroll.scrollLeft) {
        scroll.scrollLeft = topScroll.scrollLeft;
      }
    });
    scroll.addEventListener('scroll', () => {
      if (topScroll.scrollLeft !== scroll.scrollLeft) {
        topScroll.scrollLeft = scroll.scrollLeft;
      }
    });
    // The card, not the viewport, owns the scroll area: a fixed
    // `100vh - Npx` guess ignored the card head, the top scrollbar, the
    // preview padding and the bottom margin, so an 18-row table that filled
    // the pane still showed a vertical scrollbar (and the padding below it
    // overflowed the preview holder).
    const measureAvailable = () => {
      const holder = container.closest('.preview-holder');
      if (!holder || !table.offsetHeight || holder.clientHeight === 0) {
        return null;
      }
      const holderStyle = getComputedStyle(holder);
      const viewStyle = getComputedStyle(view);
      const paddingTop = parseFloat(holderStyle.paddingTop) || 0;
      const paddingBottom = parseFloat(holderStyle.paddingBottom) || 0;
      const marginBottom = parseFloat(viewStyle.marginBottom) || 0;
      const borderBottom = parseFloat(viewStyle.borderBottomWidth) || 0;
      const holderRect = holder.getBoundingClientRect();
      const scrollRect = scroll.getBoundingClientRect();
      const contentTop = holderRect.top + paddingTop - holder.scrollTop;
      // Notices are appended after the scroll box; keep them inside the pane.
      let after = 0;
      let seenScroll = false;
      for (const child of view.children) {
        if (seenScroll) after += child.getBoundingClientRect().height;
        else if (child === scroll) seenScroll = true;
      }
      return Math.max(
        120,
        holder.clientHeight -
          paddingTop -
          paddingBottom -
          (scrollRect.top - contentTop) -
          marginBottom -
          borderBottom -
          after
      );
    };

    const fitRows = () => {
      const available = measureAvailable();
      if (available === null) return;
      // Use the real space below the card head/top bar. Do not add a
      // tolerance here: even 2-3px past the content edge re-creates the
      // outer preview scrollbar this measurement exists to remove.
      const maxHeight = Math.floor(available);
      scroll.style.maxHeight = `${maxHeight}px`;
      const rows = [...tbody.children];
      // Re-measure from natural row heights every time; the previous stretch
      // must not compound.
      for (const tr of rows) tr.style.removeProperty('height');
      if (body.length < 18) return;
      const horizontalBar = Math.max(
        0,
        scroll.offsetHeight - scroll.clientHeight
      );
      const target = maxHeight - horizontalBar;
      const extra = target - table.offsetHeight;
      if (extra > 0 && rows.length) {
        const add = extra / rows.length;
        for (const tr of rows) {
          // Fractional row heights keep the total on target; Math.ceil used
          // to add up to one extra pixel per row and re-create the scrollbar.
          tr.style.height = `${tr.getBoundingClientRect().height + add}px`;
        }
      }
    };

    const layoutTable = () => {
      syncTopScroll();
      fitRows();
    };
    container.addEventListener('rustmd:layout', layoutTable);
    // Window resizing changes the clamp()-based font/table width; keep the
    // top bar geometry in sync on both 1440×900 and 4K/200% viewports.
    let observer = null;
    let holderObserver = null;
    const holder = container.closest('.preview-holder');
    const onScrollResize = () =>
      requestAnimationFrame(() => {
        // fitRows also resizes the scroll box; only re-fit when the top bar
        // visibility changed, so the observer cannot feed itself.
        if (syncTopScroll()) fitRows();
      });
    const onHolderResize = () => requestAnimationFrame(layoutTable);
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(onScrollResize);
      observer.observe(scroll);
      if (holder) {
        holderObserver = new ResizeObserver(onHolderResize);
        holderObserver.observe(holder);
      }
    } else {
      window.addEventListener('resize', onHolderResize);
    }
    container.__dataTeardown = () => {
      container.removeEventListener('rustmd:layout', layoutTable);
      if (observer) observer.disconnect();
      if (holderObserver) holderObserver.disconnect();
      if (typeof ResizeObserver === 'undefined') {
        window.removeEventListener('resize', onHolderResize);
      }
      scroll.style.removeProperty('max-height');
    };
    requestAnimationFrame(layoutTable);
  }
  for (const notice of notices) addNotice(view, notice.text, notice.tone);
}

function renderPlainText(container, kind, rows, stats) {
  const view = createView(container, kind, stats);
  for (const row of rows) {
    view.appendChild(make('div', 'data-txt-prose', row.join('\t')));
  }
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
  let totalColumns = 1;
  for (const row of rows) {
    if (row.length > totalColumns) totalColumns = row.length;
  }
  const header = rows[0];
  const body = rows.slice(1);
  const dkey = delimiterKey(delimiter);
  const stats = [
    t('data.csvSummary', {
      rows: Math.max(0, rows.length - 1),
      cols: totalColumns,
      delimiter: t(`data.delimiter${dkey.charAt(0).toUpperCase()}${dkey.slice(1)}`),
    }),
  ];
  const notices = parsed.unclosedQuote
    ? [{ text: t('data.csvUnclosedQuote'), tone: 'warning' }]
    : [];
  renderTable(container, 'csv', {
    header,
    body,
    columns: totalColumns,
    stats,
    notices,
  });
}

function renderTxt(container, source) {
  const viewData = buildTextRows(source, {
    maxLines: Infinity,
    maxCols: Infinity,
  });
  if (!viewData.rows.length) {
    renderEmpty(container, 'txt');
    return;
  }
  const rows = viewData.rows;
  const columns = viewData.columns;
  const stats = [t('data.txtSummary', { lines: viewData.totalLines })];
  if (columns > 1) stats.push(t('data.txtColumns', { cols: columns }));
  if (columns <= 1) {
    renderPlainText(container, 'txt', rows, stats);
    return;
  }
  const firstMulti = rows.findIndex((row) => row.length > 1);
  const headerIndex =
    firstMulti >= 0 && looksLikeHeaderRow(rows, firstMulti, columns)
      ? firstMulti
      : -1;
  const header = headerIndex >= 0 ? rows[headerIndex] : null;
  const proseEnd = headerIndex >= 0 ? headerIndex : firstMulti;
  const prose = rows
    .slice(0, proseEnd)
    .filter((row) => row.length === 1)
    .map((row) => String(row[0] ?? ''));
  const body = rows.slice(headerIndex >= 0 ? headerIndex + 1 : firstMulti);
  renderTable(container, 'txt', {
    header,
    body,
    columns,
    stats,
    prose,
  });
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
  else {
    const keyEl = make('span', 'json-key', String(key ?? ''));
    keyEl.title = String(key ?? '');
    cell.appendChild(keyEl);
  }
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

/// Build one JSON row/group shell without descending. `buildJsonNode` walks
/// these shells with an explicit queue so deeply nested documents cannot
/// overflow the JS call stack after the node cap was removed.
function jsonNodeShell(value, key, index) {
  const type = jsonTypeOf(value);
  if (type !== 'object' && type !== 'array') {
    return { el: jsonScalarRow(value, type, key, index), entries: null };
  }
  const entries = jsonEntries(value);
  if (!entries.length) {
    return { el: jsonEmptyRow(type, key, index), entries: null };
  }

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
  body.appendChild(fields);
  details.appendChild(body);
  return { el: details, entries, fields };
}

function buildJsonNode(value, key, index) {
  const root = jsonNodeShell(value, key, index);
  if (!root.entries) return root.el;
  const queue = [root];
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const frame = queue[cursor];
    for (const entry of frame.entries) {
      const child = jsonNodeShell(entry.value, entry.key, entry.index);
      frame.fields.appendChild(child.el);
      if (child.entries) queue.push(child);
    }
  }
  return root.el;
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
  if (data.rootType === 'object' || data.rootType === 'array') {
    const entries = jsonEntries(data.value);
    if (!entries.length) {
      inspector.appendChild(jsonEmptyRow(data.rootType, null, null));
    } else {
      const fields = make('div', 'json-fields');
      for (const entry of entries) {
        fields.appendChild(buildJsonNode(entry.value, entry.key, entry.index));
      }
      inspector.appendChild(fields);
    }
  } else {
    inspector.appendChild(jsonScalarRow(data.value, data.rootType, null, null));
  }
  view.appendChild(inspector);
}

/** Render one of the data note kinds into a preview/export container. */
export function renderDataView(container, kind, source) {
  const text = String(source ?? '');
  if (kind === 'csv') renderCsv(container, text);
  else if (kind === 'txt') renderTxt(container, text);
  else renderJson(container, text);
}
