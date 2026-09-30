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

function ensureMathJax() {
  if (!mathJaxPromise) {
    window.MathJax = MATHJAX_CONFIG;
    mathJaxPromise = import('mathjax/tex-svg.js')
      .then(() => window.MathJax.startup.promise)
      .then(() => {
        // NB: in MathJax 4 startup.promise resolves with undefined (unlike
        // v3, which resolved with the MathJax object) — read the global.
        const MathJax = window.MathJax;
        disableMathJaxA11y(MathJax);
        return MathJax;
      })
      .catch((err) => {
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
async function typesetMath(container) {
  try {
    const MathJax = await ensureMathJax();
    disableMathJaxA11y(MathJax);
    await MathJax.typesetPromise([container]);
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
  container.innerHTML = marked.parse(preprocessDetails(markdownSource));
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
    jobs.push(typesetMath(container));
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
