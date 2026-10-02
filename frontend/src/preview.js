import { marked } from 'marked';
import hljs from 'highlight.js';
import mermaid from 'mermaid';

marked.setOptions({ gfm: true, breaks: true });

// ---------------- MathJax (LaTeX math) ----------------
// MathJax is a heavy (~1 MB) browser build, so it is loaded lazily — only
// when the note source actually contains math delimiters outside code
// fences. The dynamic import (rather than a static one) guarantees the
// window.MathJax config below is in place before the library boots.
// SVG output is used so exported HTML files are fully self-contained
// (no web-font files to inline), and rendering stays theme-agnostic
// (glyphs inherit currentColor).

const MATHJAX_CONFIG = {
  tex: {
    inlineMath: [
      ['$', '$'],
      ['\\(', '\\)'],
    ],
    displayMath: [
      ['$$', '$$'],
      ['\\[', '\\]'],
    ],
    processEscapes: true,
  },
  svg: { fontCache: 'local' },
  startup: { typeset: false },
  options: {
    enableMenu: false,
    // The a11y document class re-applies these switches from its menu
    // settings during startup, which would spawn a speech-rules web worker
    // (MathJax option `options.worker`). In this bundled webview app the
    // worker URL is unreachable and its never-settling promise hangs
    // typesetPromise forever, so disable enrichment at the source.
    menuOptions: {
      settings: {
        enrich: false,
        speech: false,
        braille: false,
        assistiveMml: false,
      },
    },
  },
};

/// Belt-and-braces: force the a11y switches off on the live document right
/// before typesetting (covers the case where the a11y class re-applies its
/// menu defaults after our config was consumed).
function disableMathJaxA11y(MathJax) {
  const opts = MathJax.startup.document && MathJax.startup.document.options;
  if (opts) {
    opts.enableEnrichment = false;
    opts.enableSpeech = false;
    opts.enableBraille = false;
  }
}

let mathJaxPromise = null;

// TeX extensions imported statically so their macros work OFFLINE. The full
// tex-svg bundle registers most commands, but a handful (below) are only
// "CheckAutoload" placeholders: on first use MathJax fetches
// `input/tex/extensions/<name>.js` from the network. In this bundled app that
// URL 404s/502s, the fetch fails, and MathJax aborts the WHOLE typeset batch
// (leaving raw `$...$` source or "Extension … failed to load" in the preview
// — seen with `\textcolor{red}{E}` in the math-formula guide). Importing the
// modules registers them, and `loader.preLoaded` tells MathJax's require
// registry they are already loaded so no fetch is ever attempted.
// If you add macros here that are still autoload-only, add them to this map
// (static specifiers on purpose: Vite must see each one to bundle it).
const MATHJAX_EXT_MODULES = {
  // [\textcolor \color \definecolor \colorbox \fcolorbox]
  color: () => import('mathjax/input/tex/extensions/color.js'),
  // [\href \data \class \style \cssId]
  html: () => import('mathjax/input/tex/extensions/html.js'),
  // [\unicode \U \char]
  unicode: () => import('mathjax/input/tex/extensions/unicode.js'),
};

function ensureMathJax() {
  if (!mathJaxPromise) {
    window.MathJax = MATHJAX_CONFIG;
    mathJaxPromise = (async () => {
      await import('mathjax/tex-svg.js');
      await Promise.all(Object.values(MATHJAX_EXT_MODULES).map((load) => load()));
      for (const name of Object.keys(MATHJAX_EXT_MODULES)) {
        try {
          window.MathJax.loader.preLoaded(`[tex]/${name}`);
        } catch (err) {
          console.warn(`MathJax preLoaded(${name}) 失败：`, err);
        }
      }
      await window.MathJax.startup.promise;
      // NB: in MathJax 4 startup.promise resolves with undefined (unlike
      // v3, which resolved with the MathJax object) — read the global.
      const MathJax = window.MathJax;
      disableMathJaxA11y(MathJax);
      return MathJax;
    })().catch((err) => {
      mathJaxPromise = null; // allow a retry on the next render
      throw err;
    });
  }
  return mathJaxPromise;
}

/// True when the source has `$`/`$$` math delimiters outside fenced code
/// blocks (cheap gate so the MathJax bundle is never loaded for math-free
/// notes). Inline-code spans are ignored; MathJax itself skips <code> and
/// <pre> elements during typesetting, so a stray `$` there is harmless.
function sourceHasMath(md) {
  return splitCodeSegments(md).some((s) => !s.code && mdSourceHasMath(s.text));
}

function mdSourceHasMath(text) {
  // `$$` block delimiter, or an inline `$x$` pair.
  if (text.includes('$$')) return true;
  const re = /(^|[^\\$])\$[^\n]*?[^\s$\\]\$(?!\$)/;
  return re.test(text);
}

/// Typeset all math in a rendered container. Resolves even when typesetting
/// fails: the raw `$...$` source stays visible instead of a blank page.
///
/// `spans` are the per-formula wrapper elements from restoreMath(). The
/// batch pass is fast, but a single invalid formula makes MathJax reject
/// the WHOLE batch — which is how one typo can leave an entire note full of
/// raw `$...$` text. On failure we re-typeset each formula individually:
/// the broken one keeps its raw source, the rest render.
async function typesetMath(container, spans) {
  try {
    const MathJax = await ensureMathJax();
    disableMathJaxA11y(MathJax);
    try {
      await MathJax.typesetPromise([container]);
    } catch (err) {
      console.error('MathJax 批量渲染失败，回退为逐公式渲染：', err);
      for (const span of spans) {
        if (span.querySelector('mjx-container')) continue; // done in the batch pass
        try {
          await MathJax.typesetPromise([span]);
        } catch (e) {
          console.error('MathJax 公式渲染失败（保留原文）：', e);
        }
      }
    }
  } catch (err) {
    console.error('MathJax 渲染失败：', err);
  }
}

// ---------------- Mermaid theme ----------------

let mermaidTheme = null;

export function setPreviewTheme(theme) {
  mermaidTheme = theme;
  mmdCache.clear(); // rendered SVGs are theme-dependent
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: theme === 'dark' ? 'dark' : 'default',
  });
}

function ensureMermaid() {
  if (mermaidTheme === null) {
    setPreviewTheme(document.body.dataset.theme === 'dark' ? 'dark' : 'light');
  }
}

// ---------------- Raw-HTML <details> support ----------------
// marked treats <details>...</details> as a raw HTML block, so markdown
// written between <summary> and </details> would show up as literal text.
// Pre-render that inner markdown; the resulting HTML passes through the
// outer parse untouched. Fenced code segments are skipped so samples that
// contain <details> are not transformed.

function splitCodeSegments(md) {
  const segments = [];
  const lines = md.split('\n');
  let text = [];
  let code = [];
  let fence = null; // null outside a fence, otherwise the fence char ` or ~
  const flushText = () => {
    if (text.length) {
      segments.push({ code: false, text: text.join('\n') });
      text = [];
    }
  };
  const flushCode = () => {
    if (code.length) {
      segments.push({ code: true, text: code.join('\n') });
      code = [];
    }
  };
  for (const line of lines) {
    if (fence) {
      code.push(line);
      const m = line.match(
        new RegExp('^\\s*' + (fence === '`' ? '`{3,}' : '~{3,}') + '\\s*$')
      );
      if (m) {
        flushCode();
        fence = null;
      }
      continue;
    }
    const m = line.match(/^\s*(`{3,}|~{3,})/);
    if (m) {
      flushText();
      fence = m[1][0];
      code = [line];
      continue;
    }
    text.push(line);
  }
  flushCode();
  flushText();
  return segments;
}

function renderDetailsBlocks(md) {
  return md.replace(/<details\b[^>]*>([\s\S]*?)<\/details>/gi, (full, inner) => {
    const m = inner.match(/^\s*(<summary\b[^>]*>[\s\S]*?<\/summary>)([\s\S]*)$/i);
    if (!m) return full;
    const rendered = marked.parse(m[2]);
    return full.replace(inner, () => m[1] + '\n' + rendered + '\n');
  });
}

function preprocessDetails(md) {
  return splitCodeSegments(md)
    .map((s) => (s.code ? s.text : renderDetailsBlocks(s.text)))
    .join('\n');
}

// ---------------- Math protection ----------------
// marked applies markdown escaping to plain text, which mangles TeX:
// `\\` (the matrix row separator) collapses to a lone `\`, and spacing
// commands like `\,` lose their backslash entirely. Every matrix /
// align / cases block is destroyed before MathJax ever sees it.
//
// Fix: swap math segments for opaque word tokens *before* marked.parse
// (tokens survive markdown untouched — no backslashes, no line breaks,
// so no `\<br>` either) and restore the raw TeX into the DOM afterwards.
// MathJax then typesets the pristine source.

const mathToken = (i) => `RMDMATH${i}X`;

// Display-math delimiters must be *standalone*: the opening `$$` starts at
// the beginning of a line (or after whitespace) and the closing `$$` ends
// the line (or is followed by whitespace). Otherwise a stray `$$` quoted
// mid-sentence — e.g. a syntax guide writing `使用双 $$ 包裹` — pairs up
// with the next real delimiter and swallows the surrounding prose into a
// bogus "formula" (which then makes MathJax reject the whole note).
// NB: the `g` flag is load-bearing — String.replace with a non-global
// regex only replaces the FIRST match, so without it only the first
// $$…$$ block of the note would be protected and every later display
// formula (matrices, align, cases …) would hit marked's escaping
// (`\\` row separators collapse) and render as a single squashed line.
const DISPLAY_MATH_RE = /(?<=^|\s)\$\$([\s\S]*?)\$\$(?=\s|$)/gm;

function protectMathInText(text, store) {
  // Display math first ($$...$$, may span lines), then inline $...$.
  // Same inline-math heuristics as mdSourceHasMath above.
  let out = text.replace(DISPLAY_MATH_RE, (m) => {
    store.push(m);
    return mathToken(store.length - 1);
  });
  out = out.replace(/(^|[^\\$])\$[^\n]*?[^\s$\\]\$(?!\$)/g, (m, pre) => {
    store.push(m.slice(pre.length));
    return pre + mathToken(store.length - 1);
  });
  return out;
}

function protectMath(md, store) {
  // Fenced code is left alone so samples that *show* math syntax stay literal.
  return splitCodeSegments(md)
    .map((s) => (s.code ? s.text : protectMathInText(s.text, store)))
    .join('\n');
}

/// Swap each token for a dedicated <span class="rm-math"> holding the raw
/// TeX, and return the spans. Tokens are plain alphanumeric words, so
/// marked never splits one across text nodes. Per-formula spans let
/// typesetMath typeset (and fall back) formula by formula — one bad formula
/// must not take down the rest of the note.
function restoreMath(container, store) {
  const spans = [];
  if (!store.length) return spans;
  const nodes = [];
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    const value = node.nodeValue;
    const hits = [];
    for (let i = 0; i < store.length; i++) {
      const p = value.indexOf(mathToken(i));
      if (p !== -1) hits.push([p, i]);
    }
    if (!hits.length) continue;
    hits.sort((a, b) => a[0] - b[0]);
    const frag = document.createDocumentFragment();
    let pos = 0;
    for (const [p, i] of hits) {
      if (p > pos) frag.appendChild(document.createTextNode(value.slice(pos, p)));
      const span = document.createElement('span');
      span.className = 'rm-math';
      span.textContent = store[i];
      frag.appendChild(span);
      spans.push(span);
      pos = p + mathToken(i).length;
    }
    if (pos < value.length) frag.appendChild(document.createTextNode(value.slice(pos)));
    node.parentNode.replaceChild(frag, node);
  }
  return spans;
}

// ---------------- Rendering ----------------

let mmdCounter = 0;

// Rendered-diagram cache, keyed by theme + source. Re-rendering an unchanged
// diagram (debounced per-keystroke preview updates, the off-screen export
// stage) must not re-run mermaid's layout engine — it copies the cached SVG
// instead. Without this, a note with several diagrams exhausts the WebView2
// renderer on typing and on export ("Page crashed!").
const mmdCache = new Map();
const MMD_CACHE_MAX = 128;

/// Render markdown into a container: GFM + code highlighting + mermaid
/// diagrams. Resolves when every diagram has rendered (or fallen back to
/// its source). Each diagram block is swapped for a host div, so stale
/// renders of a previously-opened note only ever write into detached DOM.
async function renderMarkdownInto(container, markdownSource) {
  const mathStore = [];
  const guarded = protectMath(markdownSource, mathStore);
  container.innerHTML = marked.parse(preprocessDetails(guarded));
  const mathSpans = restoreMath(container, mathStore);
  for (const el of container.querySelectorAll('pre code')) {
    if (el.classList.contains('language-mermaid')) continue;
    hljs.highlightElement(el);
  }
  const blocks = [...container.querySelectorAll('pre code.language-mermaid')];
  const jobs = blocks.map(async (el, i) => {
      const host = document.createElement('div');
      host.className = 'mermaid-diagram';
      el.parentElement.replaceWith(host);
      try {
        const source = el.textContent;
        const key = mermaidTheme + '\u0000' + source;
        let svg = mmdCache.get(key);
        if (svg === undefined) {
          ({ svg } = await mermaid.render('mmd-' + ++mmdCounter, source));
          if (mmdCache.size >= MMD_CACHE_MAX) {
            mmdCache.delete(mmdCache.keys().next().value); // drop oldest entry
          }
          mmdCache.set(key, svg);
        }
        host.innerHTML = svg;
      } catch (err) {
        const codeEl = document.createElement('code');
        codeEl.className = 'language-mermaid';
        codeEl.textContent = el.textContent;
        host.appendChild(codeEl);
        const note = document.createElement('div');
        note.className = 'mermaid-error';
        note.textContent = 'Mermaid 渲染失败：' + (err && err.message ? err.message : err);
        host.appendChild(note);
      }
  });
  if (sourceHasMath(markdownSource)) {
    jobs.push(typesetMath(container, mathSpans));
  }
  await Promise.all(jobs);
}

export function renderPreview(markdownSource, container) {
  ensureMermaid();
  return renderMarkdownInto(container, markdownSource);
}

// Standalone HTML document for export. Diagrams are rendered to inline SVG
// with the export theme so the file is self-contained.
export async function buildExportHtml(title, markdownSource, theme) {
  const prev = mermaidTheme;
  setPreviewTheme(theme);
  const stage = document.createElement('div');
  stage.style.cssText = 'position:fixed;left:-100000px;top:0;width:860px;';
  document.body.appendChild(stage);
  let body;
  try {
    await renderMarkdownInto(stage, markdownSource);
    body = stage.innerHTML;
  } finally {
    stage.remove();
    if (prev !== null) setPreviewTheme(prev);
  }
  const isDark = theme === 'dark';
  const css = `
 :root { color-scheme: ${isDark ? 'dark' : 'light'}; }
 * { box-sizing: border-box; }
 body {
   margin: 0 auto;
   max-width: 820px;
   padding: 48px 28px 80px;
   font-family: "Segoe UI", "Microsoft YaHei", "PingFang SC", system-ui, sans-serif;
   font-size: 15.5px;
   line-height: 1.75;
   color: ${isDark ? '#e7eaf0' : '#1f2430'};
   background: ${isDark ? '#14161b' : '#ffffff'};
   word-wrap: break-word;
 }
 h1, h2, h3, h4 { font-weight: 700; line-height: 1.35; margin: 1.5em 0 0.6em; }
 h1 { font-size: 1.9em; padding-bottom: .3em; border-bottom: 1px solid ${isDark ? '#262a33' : '#e2e5ec'}; }
 h2 { font-size: 1.5em; padding-bottom: .25em; border-bottom: 1px solid ${isDark ? '#262a33' : '#e2e5ec'}; }
 h3 { font-size: 1.25em; }
 a { color: ${isDark ? '#6ea8ff' : '#2f6fdb'}; text-decoration: none; }
 a:hover { text-decoration: underline; }
 code {
   font-family: "Cascadia Code", "JetBrains Mono", Consolas, monospace;
   font-size: .86em;
   background: ${isDark ? '#22262e' : '#f2f3f8'};
   border: 1px solid ${isDark ? '#2c313b' : '#e4e6ee'};
   border-radius: 5px;
   padding: .12em .4em;
 }
 pre {
   background: ${isDark ? '#22262e' : '#f2f3f8'};
   border: 1px solid ${isDark ? '#2c313b' : '#e4e6ee'};
   border-radius: 10px;
   padding: 14px 16px;
   overflow-x: auto;
   line-height: 1.6;
 }
 pre code { background: none; border: none; padding: 0; font-size: .88em; }
 blockquote {
   margin: 1em 0; padding: 4px 16px;
   border-left: 3px solid ${isDark ? '#7c8cff' : '#4f6df5'};
   background: ${isDark ? 'rgba(124,140,255,.1)' : 'rgba(79,109,245,.07)'};
   border-radius: 0 8px 8px 0; color: ${isDark ? '#99a0af' : '#69707f'};
 }
 ul, ol { padding-left: 1.6em; }
 li { margin: .3em 0; }
 input[type="checkbox"] { margin-right: 6px; accent-color: ${isDark ? '#7c8cff' : '#4f6df5'}; }
 table { border-collapse: collapse; width: 100%; font-size: .94em; }
 th, td { border: 1px solid ${isDark ? '#262a33' : '#e2e5ec'}; padding: 7px 13px; text-align: left; }
 th { background: ${isDark ? '#22262e' : '#f2f3f8'}; font-weight: 600; }
 img { max-width: 100%; border-radius: 8px; }
 hr { border: none; border-top: 1px solid ${isDark ? '#262a33' : '#e2e5ec'}; margin: 1.8em 0; }
 .mermaid-diagram {
   background: ${isDark ? '#22262e' : '#f2f3f8'};
   border: 1px solid ${isDark ? '#2c313b' : '#e4e6ee'};
   border-radius: 10px;
   padding: 14px 16px;
   margin: 1em 0;
   overflow-x: auto;
   text-align: center;
 }
 .mermaid-diagram svg { max-width: 100%; height: auto; }
 .mermaid-error { margin-top: 8px; font-size: 12px; color: ${isDark ? '#ff6369' : '#e5484d'}; text-align: left; }
 mjx-container { color: inherit; }
 mjx-container[display="true"] {
   display: block; margin: 1.2em 0; text-align: center;
   overflow-x: auto; overflow-y: hidden; max-width: 100%;
 }
 details {
   border: 1px solid ${isDark ? '#262a33' : '#e2e5ec'};
   border-radius: 8px;
   background: ${isDark ? 'rgba(255,255,255,.055)' : 'rgba(20,24,40,.05)'};
   padding: 4px 14px 10px;
   margin: 1em 0;
 }
 summary { cursor: pointer; font-weight: 600; padding: 6px 0; }
 summary:hover { color: ${isDark ? '#6ea8ff' : '#2f6fdb'}; }
 footer { margin-top: 56px; padding-top: 16px; border-top: 1px solid ${isDark ? '#262a33' : '#e2e5ec'}; font-size: 12px; color: ${isDark ? '#6b7280' : '#9aa1b0'}; }
 `;
  const date = new Date().toLocaleString('zh-CN', { hour12: false });
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(title)}</title>
<style>${css}</style>
</head>
<body>
${body}
<footer>由 rustmd 导出 · ${date}</footer>
</body>
</html>
`;
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}
