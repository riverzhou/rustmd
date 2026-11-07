import { marked } from 'marked';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js';
import mermaid from 'mermaid';
import { api } from './api.js';
import { bytesToDataUrl, guessImageMime } from './imgutil.js';
import {
  splitCodeSegments,
  splitInlineCode,
  sourceHasMath,
  protectMath,
  mathToken,
} from './markdown.js';

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
  // The cache key includes the theme, so no clear() here: switching theme
  // must not throw away the other theme's rendered diagrams.
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
    .map((segment) => {
      if (segment.code) return segment.text;
      return splitInlineCode(segment.text)
        .map((part) =>
          part.code ? part.text : renderDetailsBlocks(part.text)
        )
        .join('');
    })
    .join('\n');
}

// ---------------- Local image resolution ----------------
//
// The webview page origin (tauri://localhost in release, the Vite dev
// server in dev) cannot read the filesystem: a relative <img> src like
// `chart.png` resolves against the APP URL and 404s, and file:///… is
// blocked for an http origin. Notes reference vault files by path, so
// local sources are rewritten to the `rmd` custom URI scheme, which
// Rust serves strictly from the CURRENTLY OPEN notes root (see
// `serve_rmd` / `set_notes_root` in main.rs).
//
// On Windows Tauri/wry serve custom schemes under the WebView2
// workaround origin `http://<scheme>.localhost` (same form as the asset
// protocol); elsewhere it is `<scheme>://localhost`. Rust always
// receives the reverted `rmd://localhost/…` URI.
//
// The context is set by main.js per open note (root = the vault dir the
// user opened, notePath = the note's root-relative path). In browser
// mock mode it stays null: local files are unreachable there, so srcs
// are left untouched (broken as before, no regression).

const RMD_ORIGIN = /windows/i.test(navigator.userAgent)
  ? 'http://rmd.localhost/'
  : 'rmd://localhost/';

export const isRmdUrl = (src) => (src || '').startsWith(RMD_ORIGIN);
export const rmdUrlPath = (src) => decodeURIComponent(src.slice(RMD_ORIGIN.length));

let imageCtx = null; // { root, notePath }

export function setImageContext(root, notePath) {
  imageCtx = root
    ? { root: String(root).replace(/\\/g, '/'), notePath: notePath || '' }
    : null;
}

/// Absolute vault path for a local image src, or null when the src is not
/// a vault file we can map (remote/data URLs, fragments, no context).
function localImageAbsPath(src) {
  if (!imageCtx || !src) return null;
  if (isRmdUrl(src)) return null; // already resolved
  if (/^(https?:|data:|blob:)/i.test(src)) return null;
  if (/^file:\/\//i.test(src)) {
    try {
      const url = new URL(src);
      let pathname = decodeURIComponent(url.pathname);
      // file://C:/x (the drive letter is parsed as the URL host)
      if (/^[a-zA-Z]$/.test(url.host)) pathname = `/${url.host}${pathname}`;
      // On Windows a file URL pathname for a drive looks like /C:/x.
      if (/^\/[a-zA-Z]:[\\/]/.test(pathname)) pathname = pathname.slice(1);
      if (
        url.host &&
        url.host.toLowerCase() !== 'localhost' &&
        !/^[a-zA-Z]$/.test(url.host)
      ) {
        // UNC share: file://server/share/x → //server/share/x
        pathname = `//${url.host}${pathname}`;
      }
      return pathname.replace(/\\/g, '/');
    } catch {
      return null;
    }
  }
  if (/[?#]/.test(src)) return null; // fragment/query — leave untouched
  if (/^[a-zA-Z]:[\\/]/.test(src)) return src.replace(/\\/g, '/'); // drive path
  if (src.startsWith('/')) return imageCtx.root + src; // vault-root-relative
  const dir = imageCtx.notePath.includes('/')
    ? imageCtx.notePath.slice(0, imageCtx.notePath.lastIndexOf('/'))
    : '';
  return imageCtx.root + (dir ? `/${dir}` : '') + `/${src}`;
}

/// Swap rmd:-served local images for inline data: URLs so an exported
/// HTML file is self-contained — the rmd scheme only exists in-app
/// (remote images stay remote, as before).
async function inlineLocalImagesForHtml(stage) {
  const locals = [...stage.querySelectorAll('img')].filter((img) =>
    isRmdUrl(img.getAttribute('src') || '')
  );
  await Promise.all(
    locals.map(async (img) => {
      const src = img.getAttribute('src');
      try {
        const image = await api.readLocalImage(rmdUrlPath(src));
        img.removeAttribute('srcset');
        img.src = bytesToDataUrl(
          image.bytes,
          image.mime || guessImageMime(image.bytes)
        );
      } catch (err) {
        console.warn('本地图片内联失败，导出 HTML 中该位置将为空白：', src, err);
      }
    })
  );
}

// ---------------- HTML sanitization / links ----------------

// Note HTML is rendered by marked without sanitization. The webview holds the
// full Tauri IPC surface (notes, exports, image fetch), so raw HTML from a
// note must never reach innerHTML unsanitized. DOMPurify uses a static config
// (no hooks, no IN_PLACE, no custom elements) and strips scripts, event
// handlers, javascript: URLs, <style>/<iframe>/<object> and similar vectors.
// Mermaid SVGs are generated locally with securityLevel 'strict' AFTER this
// pass and are not part of the untrusted note text.
const SANITIZE_CONFIG = {
  FORBID_TAGS: [
    'style',
    'link',
    'meta',
    'base',
    'iframe',
    'object',
    'embed',
    'form',
    'textarea',
    'select',
    'option',
    'button',
  ],
  FORBID_ATTR: ['srcdoc'],
  ALLOW_UNKNOWN_PROTOCOLS: false,
  // DOMPurify's default allowlist plus the `rmd` custom scheme used for
  // vault images on Linux/macOS. `file:` stays blocked: local images are
  // rewritten to `rmd` BEFORE this sanitize pass, so the webview never
  // receives a file: URL from a note.
  ALLOWED_URI_REGEXP:
    /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|matrix|rmd):|[^a-z]|[a-z+.-]+(?:[^a-z+.:-]|$))/i,
};

function sanitizeHtml(html) {
  return DOMPurify.sanitize(html, SANITIZE_CONFIG);
}

/// Rewrite vault image sources BEFORE DOMPurify sees the HTML. DOMPurify's
/// URI allowlist intentionally rejects `file:`; local images must already be
/// `http://rmd.localhost/…` (Windows) or `rmd://localhost/…` (others) by the
/// time the sanitizer runs. The detached <template> never executes scripts.
function rewriteLocalImageHtml(html) {
  if (!imageCtx) return html;
  const template = document.createElement('template');
  template.innerHTML = html;
  for (const img of template.content.querySelectorAll('img')) {
    const abs = localImageAbsPath(img.getAttribute('src') || '');
    if (!abs) continue;
    img.removeAttribute('srcset');
    img.setAttribute('src', RMD_ORIGIN + encodeURIComponent(abs));
  }
  return template.innerHTML;
}

/// External links must open in the system browser, not replace the app page.
/// The listener is installed once per container; renderMarkdownInto reuses
/// the same preview element across renders.
function installLinkHandler(container) {
  if (container.dataset.linkHandler === '1') return;
  container.dataset.linkHandler = '1';
  container.addEventListener('click', (event) => {
    const target = event.target;
    const anchor =
      target && typeof target.closest === 'function'
        ? target.closest('a[href]')
        : null;
    if (!anchor || !container.contains(anchor)) return;
    const href = anchor.getAttribute('href') || '';
    if (href.startsWith('#')) return; // in-document anchor
    event.preventDefault();
    if (/^https?:\/\//i.test(href) || /^mailto:/i.test(href)) {
      api.openExternal(href).catch((err) => {
        console.warn('打开外部链接失败：', href, err);
      });
    } else {
      console.warn('不支持打开该链接：', href);
    }
  });
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
    if (pos < value.length) {
      frag.appendChild(document.createTextNode(value.slice(pos)));
    }
    node.parentNode.replaceChild(frag, node);
  }
  return spans;
}

// MathJax and Mermaid run AFTER the DOMPurify pass, so a second targeted
// pass removes anything executable they could introduce (notably MathJax's
// `\href{javascript:...}` macro). It is intentionally narrow: generated SVG
// styling and anchors must survive.
function compactUrl(value) {
  return String(value || '')
    .split('')
    .filter((ch) => ch.charCodeAt(0) > 0x20)
    .join('')
    .toLowerCase();
}

function isSafeLinkHref(href) {
  const value = compactUrl(href);
  if (!value) return false;
  if (value.startsWith('#')) return true;
  if (/^(https?:|mailto:|tel:)/.test(value)) return true;
  if (/^[a-z][a-z0-9+.-]*:/.test(value)) return false; // javascript:, data:, file:, …
  return true; // relative path
}

function sanitizeRenderedDom(container) {
  for (const el of container.querySelectorAll('script, iframe, object, embed')) {
    el.remove();
  }
  // Mermaid embeds a <style> block in its SVG. Keep local marker/fill
  // references, but drop @import and external CSS URLs (themeCSS is
  // user-influenced).
  for (const style of container.querySelectorAll('style')) {
    const css = style.textContent || '';
    if (
      /@import|url\s*\(\s*['"]?\s*(?:https?:|javascript:|data:text\/html)/i.test(css)
    ) {
      style.textContent = css
        .replace(/@import[^;]*;?/gi, '')
        .replace(
          /url\s*\(\s*['"]?\s*(?:https?:|javascript:|data:text\/html)[^)]*\)/gi,
          'none'
        );
    }
  }
  for (const el of container.querySelectorAll('*')) {
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase();
      const value = attr.value;
      if (name.startsWith('on')) {
        el.removeAttribute(attr.name);
        continue;
      }
      if (name === 'href' || name === 'xlink:href') {
        if (!isSafeLinkHref(value)) el.removeAttribute(attr.name);
        continue;
      }
      if (name === 'src' || name === 'xlink:href') {
        const compact = compactUrl(value);
        if (/^(javascript:|vbscript:|data:text\/html)/.test(compact)) {
          el.removeAttribute(attr.name);
        }
        continue;
      }
      if (name === 'style') {
        if (
          /(?:expression\s*\(|url\s*\(\s*['"]?\s*(?:https?:|javascript:|data:text\/html))/i.test(
            value
          )
        ) {
          el.removeAttribute(attr.name);
          continue;
        }
        // A note must not be able to overlay the app UI with a fake dialog.
        // Remove positioning from inline styles; normal typography survives.
        if (/position\s*:\s*(?:fixed|sticky|absolute)/i.test(value)) {
          el.style.removeProperty('position');
        }
      }
    }
  }
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
  const html = marked.parse(preprocessDetails(guarded));
  container.innerHTML = sanitizeHtml(rewriteLocalImageHtml(html));
  installLinkHandler(container);
  const mathSpans = restoreMath(container, mathStore);
  for (const el of container.querySelectorAll('pre code')) {
    if (el.classList.contains('language-mermaid')) continue;
    hljs.highlightElement(el);
  }
  const blocks = [...container.querySelectorAll('pre code.language-mermaid')];
  const jobs = blocks.map(async (el) => {
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
  sanitizeRenderedDom(container);
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
    // The exported HTML is a standalone file: the rmd scheme only exists
    // in-app, so vault images must be inlined as data: URLs here.
    await inlineLocalImagesForHtml(stage);
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
