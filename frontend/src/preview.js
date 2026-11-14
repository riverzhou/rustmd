import { marked } from 'marked';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js';
import mermaid from 'mermaid';
import { api } from './api.js';
import { bytesToDataUrl, guessImageMime } from './imgutil.js';
import { getLanguage, t } from './i18n.js';
import { DATA_VIEW_CSS, renderDataView } from './dataview.js';
import { isDataKind } from './notelist.js';
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
    // Only $-delimiters are supported: Markdown consumes/re-emits the
    // backslashes of \( … \) and \[ … \], so markdown.js cannot protect them
    // before marked parses (it detects/protects the $ forms only).
    inlineMath: [['$', '$']],
    displayMath: [['$$', '$$']],
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
async function typesetMath(container, spans, isCurrent = () => true) {
  try {
    const MathJax = await ensureMathJax();
    // A slow first MathJax load can finish after the user switched notes;
    // typesetting at that point would mutate the NEXT note's DOM.
    if (!isCurrent()) return;
    disableMathJaxA11y(MathJax);
    try {
      await MathJax.typesetPromise([container]);
    } catch (err) {
      console.error('MathJax 批量渲染失败，回退为逐公式渲染：', err);
      for (const span of spans) {
        if (!isCurrent()) return;
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
// Rust serves strictly from the REGISTERED notes roots (see `serve_rmd` /
// `set_notes_root` / `set_notes_roots` in main.rs; multi-vault mode registers
// every open vault).
//
// On Windows Tauri/wry serve custom schemes under the WebView2
// workaround origin `http://<scheme>.localhost` (same form as the asset
// protocol); elsewhere it is `<scheme>://localhost`. Rust always
// receives the reverted `rmd://localhost/…` URI.
//
// The context is set by main.js per open note (root = the vault dir the note
// belongs to, notePath = the note's root-relative path). In browser mock mode
// it stays null: local files are unreachable there, so srcs are left untouched
// (broken as before, no regression).

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
/// `ctx` can be passed explicitly for an export that must keep the note it
/// started with even if the user switches notes while assets are inlined.
function localImageAbsPath(src, ctx = imageCtx) {
  if (!ctx || !src) return null;
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
  if (src.startsWith('/')) return ctx.root + src; // vault-root-relative
  const dir = ctx.notePath.includes('/')
    ? ctx.notePath.slice(0, ctx.notePath.lastIndexOf('/'))
    : '';
  return ctx.root + (dir ? `/${dir}` : '') + `/${src}`;
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

/// Inline local images, stylesheets and classic scripts before sending an
/// HTML note to the hidden WebView renderer or the native preview iframe.
///
/// WebKitGTK/WKWebView send `Origin: null` for cross-origin classic scripts and
/// stylesheets; the strict `rmd` origin allowlist intentionally rejects
/// note-controlled origins. Inlining makes the page independent of those
/// requests and works identically on WebView2/WebKitGTK/WKWebView.
export async function inlineLocalAssetsInHtml(source, ctx = imageCtx) {
  const raw = String(source || '');
  // Parse the WHOLE document (DOMParser keeps <html lang>, <head>, <body
  // class> and their attributes). A <template> round-trip flattened those
  // wrappers and made deferred head scripts run before <body> existed.
  const doc = new DOMParser().parseFromString(raw, 'text/html');
  // Only a doctype at the very start of the source is a doctype; the same
  // text inside a leading comment or script must not be re-emitted.
  const doctypeMatch = /^\s*<!doctype[^>]*>/i.exec(raw);
  const doctype = doctypeMatch ? doctypeMatch[0].trim() : '<!doctype html>';
  const decode = (bytes) => new TextDecoder().decode(new Uint8Array(bytes));

  // Snapshot the context for the whole operation: a per-asset read of the
  // global context could mix two notes if the user switches mid-inline.
  const context = ctx;
  const TEXT_ASSET = /.(?:css|js|mjs)$/i;
  // The element kind decides the command: <img> may only read images, while
  // <link>/<script> may only read CSS/JS. Choosing by extension alone would
  // let <img src="secret.js"> inline text that the note's scripts can read.
  const resolveAndRead = async (url, kind) => {
    const abs = localImageAbsPath(url, context);
    if (!abs) return null;
    try {
      if (kind === 'asset') {
        if (!TEXT_ASSET.test(abs)) return null;
        return await api.readLocalAsset(abs);
      }
      return await api.readLocalImage(abs);
    } catch {
      return null;
    }
  };

  for (const link of [...doc.querySelectorAll('link[rel~="stylesheet"][href]')]) {
    const file = await resolveAndRead(link.getAttribute('href') || '', 'asset').catch(
      () => null
    );
    if (!file) continue;
    const style = doc.createElement('style');
    style.textContent = decode(file.bytes).replace(/<\/style/gi, '<\\/style');
    link.replaceWith(style);
  }

  // A deferred/async external script becomes an inline script; inline scripts
  // ignore defer, so keep it at the end of <body> (deferred scripts run after
  // parsing anyway) instead of running it in <head> before the body exists.
  const deferred = [];
  for (const script of [...doc.querySelectorAll('script[src]')]) {
    const src = script.getAttribute('src') || '';
    const file = await resolveAndRead(src, 'asset').catch(() => null);
    if (!file) continue;
    const inline = doc.createElement('script');
    for (const attr of [...script.attributes]) {
      if (attr.name.toLowerCase() !== 'src') inline.setAttribute(attr.name, attr.value);
    }
    inline.textContent = decode(file.bytes).replace(/<\/script/gi, '<\\/script');
    if (script.hasAttribute('defer') || script.hasAttribute('async')) {
      deferred.push(inline);
      script.remove();
    } else {
      script.replaceWith(inline);
    }
  }
  // A <frameset> note has no <body>; append deferred scripts to the root
  // element instead of throwing and forcing the static fallback.
  for (const inline of deferred) (doc.body || doc.documentElement).appendChild(inline);

  for (const img of [...doc.querySelectorAll('img[src]')]) {
    const src = img.getAttribute('src') || '';
    const file = await resolveAndRead(src, 'image').catch(() => null);
    if (!file) continue;
    img.removeAttribute('srcset');
    img.setAttribute(
      'src',
      bytesToDataUrl(file.bytes, file.mime || guessImageMime(file.bytes))
    );
  }

  return doctype + '\n' + doc.documentElement.outerHTML;
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
function rewriteLocalImageHtml(html, ctx = imageCtx) {
  if (!ctx) return html;
  const template = document.createElement('template');
  template.innerHTML = html;
  for (const img of template.content.querySelectorAll('img')) {
    const abs = localImageAbsPath(img.getAttribute('src') || '', ctx);
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
/// Render every `<pre><code class="language-mermaid">` block into a diagram,
/// falling back to the source plus an error note. Shared by Markdown and
/// HTML notes (HTML pages may embed Mermaid code blocks too).
async function renderMermaidBlocks(container) {
  const blocks = [...container.querySelectorAll('pre code.language-mermaid')];
  await Promise.all(
    blocks.map(async (el) => {
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
        note.textContent =
          t('preview.mermaidFailed') + (err && err.message ? err.message : err);
        host.appendChild(note);
      }
    })
  );
}

// Per-container render generation: a slow render must not sanitize/mutate a
// container that a NEWER render (of any kind) has since taken over. Scoping
// this to the container (instead of one editor-wide counter) keeps an
// off-screen export stage from cancelling the app preview's sanitize/typeset.
function nextRenderSeq(container) {
  const seq = (Number(container.__rmdRenderSeq) || 0) + 1;
  container.__rmdRenderSeq = seq;
  return seq;
}
function isCurrentRender(container, seq) {
  return container.__rmdRenderSeq === seq;
}

async function renderMarkdownInto(container, markdownSource) {
  const renderSeq = nextRenderSeq(container);
  disposeNativeHtmlPreview(container);
  disposeHtmlControl(container);
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
  const jobs = [renderMermaidBlocks(container)];
  if (sourceHasMath(markdownSource)) {
    jobs.push(typesetMath(container, mathSpans, () => isCurrentRender(container, renderSeq)));
  }
  await Promise.all(jobs);
  // The user may have switched notes while MathJax/Mermaid was loading; a
  // stale sanitize pass would delete the new preview (e.g. an HTML iframe).
  if (!isCurrentRender(container, renderSeq)) return;
  sanitizeRenderedDom(container);
}

// ---------------- Sandboxed HTML notes ----------------
//
// Full HTML notes (reports, dashboards) need their own CSS/JS. Tauri builds
// preview them in a sandboxed native iframe (null origin); exports use a
// hidden Tauri WebView window and return only a PNG. Browser dev (no Rust
// bridge) falls back to an iframe that captures itself with html2canvas.

const HTML_IPC_GUARD = `
(function () {
  var blocked = false;
  function drop(name) {
    try { delete window[name]; } catch (e) {}
    try {
      if (Object.prototype.hasOwnProperty.call(window, name)) blocked = true;
    } catch (e) { blocked = true; }
  }
  drop('__TAURI_INTERNALS__');
  drop('__TAURI__');
  drop('ipc');
  // If the global is non-configurable, at least neuter invoke.
  try {
    if (window.__TAURI_INTERNALS__) {
      window.__TAURI_INTERNALS__.invoke = function () {
        return Promise.reject(new Error('HTML preview IPC blocked'));
      };
    }
  } catch (e) {}
  window.__RMD_HTML_IPC_BLOCKED__ = blocked;
  if (blocked) {
    try { window.stop(); } catch (e) {}
    var show = function () {
      document.body.innerHTML =
        '<div style="font:14px/1.6 sans-serif;padding:24px;color:#b42318">' +
        'HTML preview disabled: app IPC could not be isolated.</div>';
    };
    if (document.readyState === 'loading') {
      window.addEventListener('DOMContentLoaded', show);
    } else {
      show();
    }
  }
})();
`;

const HTML_CAPTURE_SCRIPT = `
(function () {
  function post(msg) {
    try {
      parent.postMessage(Object.assign({ __rmdHtml: true }, msg), '*');
    } catch (e) {}
  }
  function pageSize() {
    var d = document.documentElement;
    var b = document.body || d;
    // Prefer the body's content box: documentElement.clientHeight is the
    // iframe viewport and would capture a large blank area for short pages.
    return {
      width: Math.max(b.scrollWidth, b.offsetWidth, d.clientWidth, 1),
      height: Math.max(b.scrollHeight, b.offsetHeight, 1)
    };
  }
  function ready() {
    var size = pageSize();
    post({
      type: 'ready',
      width: size.width,
      height: size.height,
      blocked: !!window.__RMD_HTML_IPC_BLOCKED__
    });
  }
  if (document.readyState === 'complete') setTimeout(ready, 1200);
  else window.addEventListener('load', function () { setTimeout(ready, 1200); });
  window.addEventListener('message', function (event) {
    var data = event.data || {};
    if (data.__rmdHtml !== true || data.type !== 'capture') return;
    var id = data.id;
    var size = pageSize();
    var scale = Math.max(1, Math.min(3, Number(data.scale) || 2));
    if (typeof html2canvas !== 'function') {
      post({ type: 'error', id: id, message: 'html2canvas is unavailable' });
      return;
    }
    var bg = getComputedStyle(document.body).backgroundColor || '#ffffff';
    if (!bg || bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') bg = '#ffffff';
    try {
      html2canvas(document.body, {
        scale: scale,
        useCORS: true,
        allowTaint: false,
        logging: false,
        backgroundColor: bg,
        width: size.width,
        height: size.height,
        windowWidth: size.width,
        windowHeight: size.height,
        scrollX: 0,
        scrollY: 0
      }).then(function (canvas) {
        post({
          type: 'png',
          id: id,
          dataUrl: canvas.toDataURL('image/png'),
          cssWidth: size.width,
          cssHeight: size.height
        });
      }).catch(function (err) {
        post({ type: 'error', id: id, message: String((err && err.stack) || err) });
      });
    } catch (err) {
      post({ type: 'error', id: id, message: String((err && err.stack) || err) });
    }
  });
})();
`;

function inlineScript(source) {
  return `<script>${String(source).replace(/<\/script/gi, '<\\/script')}</script>`;
}

function escapeAttr(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[ch]);
}

/// Absolute vault-folder base so relative images/assets in the HTML resolve
/// through the existing `rmd` protocol.
function htmlPreviewBaseHref(ctx = imageCtx) {
  if (!api.isTauri || !ctx) return '';
  const root = ctx.root.replace(/\/+$/, '');
  const dir = ctx.notePath.includes('/')
    ? ctx.notePath.slice(0, ctx.notePath.lastIndexOf('/'))
    : '';
  const abs = `${root}${dir ? `/${dir}` : ''}/`;
  // Keep literal `/` separators; encode only each path segment, otherwise
  // the base URL becomes a single segment and relative assets resolve to the
  // origin root.
  return (
    RMD_ORIGIN +
    abs
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/')
  );
}

function injectHtmlHead(html, injection) {
  let out = String(html || '');
  out = out.replace(/<base\b[^>]*>/gi, '');
  const head = /<head\b[^>]*>/i.exec(out);
  if (head) {
    const at = head.index + head[0].length;
    return out.slice(0, at) + '\n' + injection + '\n' + out.slice(at);
  }
  const htmlTag = /<html\b[^>]*>/i.exec(out);
  if (htmlTag) {
    const at = htmlTag.index + htmlTag[0].length;
    return out.slice(0, at) + '\n' + injection + '\n' + out.slice(at);
  }
  const doctype = /<!doctype[^>]*>/i.exec(out);
  if (doctype) {
    const at = doctype.index + doctype[0].length;
    return out.slice(0, at) + '\n' + injection + '\n' + out.slice(at);
  }
  return injection + '\n' + out;
}

async function buildHtmlPreviewDocument(source, ctx = imageCtx) {
  // Browser dev only (no app CSP): inline the UMD bundle so the iframe can
  // capture itself without a second origin.
  const mod = await import('html2canvas/dist/html2canvas.min.js?raw');
  const html2canvasTag = inlineScript(mod.default);
  const base = htmlPreviewBaseHref(ctx);
  const injection = [
    base ? `<base href="${escapeAttr(base)}">` : '',
    inlineScript(HTML_IPC_GUARD),
    html2canvasTag,
    inlineScript(HTML_CAPTURE_SCRIPT),
  ]
    .filter(Boolean)
    .join('\n');
  return injectHtmlHead(source, injection);
}

function createHtmlFrame(url) {
  const iframe = document.createElement('iframe');
  iframe.className = 'html-preview-frame';
  // Browser-dev only: `allow-same-origin` is required for html2canvas (it
  // creates its own iframe). The Tauri preview uses a null-origin sandbox
  // instead and does not capture with html2canvas.
  iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
  iframe.setAttribute('referrerpolicy', 'no-referrer');
  iframe.setAttribute('title', t('preview.htmlTitle'));
  iframe.src = url;
  return iframe;
}

/// Ready/capture protocol for one iframe. The message sender is checked, and
/// only PNG data URLs are accepted from the untrusted document.
function controlHtmlFrame(iframe, timeoutMs = 30000) {
  let id = 0;
  const pending = new Map();
  let readySettled = false;
  let state = null;
  let resolveReady;
  let rejectReady;
  const ready = new Promise((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  const timer = setTimeout(() => {
    if (readySettled) return;
    readySettled = true;
    rejectReady(new Error('HTML preview timed out'));
  }, timeoutMs);
  const settle = (next) => {
    if (readySettled) return;
    readySettled = true;
    state = next;
    clearTimeout(timer);
    resolveReady(next);
  };
  const onMessage = (event) => {
    if (!iframe.contentWindow || event.source !== iframe.contentWindow) return;
    const data = event.data;
    if (!data || data.__rmdHtml !== true) return;
    if (data.type === 'ready') {
      settle({
        width: Math.max(1, Number(data.width) || 0),
        height: Math.max(1, Number(data.height) || 0),
        blocked: !!data.blocked,
      });
      return;
    }
    if (!data.id || !pending.has(data.id)) return;
    const waiter = pending.get(data.id);
    pending.delete(data.id);
    if (data.type === 'png') {
      const dataUrl = String(data.dataUrl || '');
      if (!dataUrl.startsWith('data:image/png;base64,')) {
        waiter.reject(new Error('HTML preview returned a non-PNG image'));
        return;
      }
      waiter.resolve({
        dataUrl,
        cssWidth: Math.max(1, Number(data.cssWidth) || state?.width || 1),
        cssHeight: Math.max(1, Number(data.cssHeight) || state?.height || 1),
      });
    } else if (data.type === 'error') {
      waiter.reject(new Error(String(data.message || 'HTML capture failed')));
    }
  };
  window.addEventListener('message', onMessage);
  const capture = (scale = 2) => {
    if (!readySettled) return ready.then(() => capture(scale));
    if (!state || state.blocked) {
      return Promise.reject(new Error(t('preview.htmlBlocked')));
    }
    const captureId = ++id;
    return new Promise((resolve, reject) => {
      const captureTimer = setTimeout(() => {
        pending.delete(captureId);
        reject(new Error('HTML capture timed out'));
      }, 120000);
      pending.set(captureId, {
        resolve: (value) => {
          clearTimeout(captureTimer);
          resolve(value);
        },
        reject: (err) => {
          clearTimeout(captureTimer);
          reject(err);
        },
      });
      iframe.contentWindow.postMessage(
        { __rmdHtml: true, type: 'capture', id: captureId, scale },
        '*'
      );
    });
  };
  const dispose = () => {
    clearTimeout(timer);
    window.removeEventListener('message', onMessage);
    for (const waiter of pending.values()) {
      waiter.reject(new Error('HTML preview closed'));
    }
    pending.clear();
  };
  return { ready, capture, dispose, getState: () => state };
}

function disposeHtmlControl(container) {
  if (container._rmdHtmlControl) {
    container._rmdHtmlControl.dispose();
    container._rmdHtmlControl = null;
  }
  container.classList.remove('html-mode');
  const holder = container.closest('.preview-holder');
  if (holder) holder.classList.remove('html-mode');
}

/// Tear down the native (Tauri) HTML preview listener/iframe when the same
/// container is reused for a Markdown note or another HTML note.
function disposeNativeHtmlPreview(container) {
  if (container._rmdPreviewCleanup) {
    container._rmdPreviewCleanup();
    container._rmdPreviewCleanup = null;
  }
}

const HTML_NATIVE_HEIGHT_SCRIPT = `<script>
(function () {
  function send() {
    var b = document.body;
    var d = document.documentElement;
    parent.postMessage({
      __rmdPreview: true,
      height: Math.max(
        b ? b.scrollHeight : 0,
        b ? b.offsetHeight : 0,
        d ? d.scrollHeight : 0,
        d ? d.offsetHeight : 0
      ),
      localScript: b && b.dataset ? b.dataset.localScript || '' : '',
      scriptRan: b && b.dataset ? b.dataset.scriptRan || '' : '',
      bodyClass: b ? b.className || '' : '',
      htmlLang: d ? d.getAttribute('lang') || '' : '',
      headDefer: b && b.dataset ? b.dataset.headDefer || '' : ''
    }, '*');
  }
  if (document.readyState === 'complete') setTimeout(send, 300);
  else window.addEventListener('load', function () { setTimeout(send, 300); });
  window.addEventListener('resize', send);
})();
</script>`;

const HTML_NATIVE_LINK_SCRIPT = `<script>
(function () {
  // Keep note links from navigating the sandboxed preview to an arbitrary
  // remote page: hand http(s)/mailto to the trusted parent, which opens it in
  // the system browser. Internal anchors and non-web links are left alone.
  document.addEventListener('click', function (event) {
    var a = event.target && event.target.closest
      ? event.target.closest('a')
      : null;
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (!href || href.charAt(0) === '#') return;
    var url;
    try { url = new URL(href, document.baseURI); } catch (e) { return; }
    if (url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'mailto:') {
      event.preventDefault();
      parent.postMessage({ __rmdPreviewLink: url.href }, '*');
    }
  }, true);
})();
</script>`;

async function buildNativeHtmlPreviewDocument(source, ctx = imageCtx) {
  const prepared = await inlineLocalAssetsInHtml(source, ctx);
  const base = htmlPreviewBaseHref(ctx);
  const injection = [
    base ? `<base href="${escapeAttr(base)}">` : '',
    HTML_NATIVE_LINK_SCRIPT,
    HTML_NATIVE_HEIGHT_SCRIPT,
  ]
    .filter(Boolean)
    .join('\n');
  return injectHtmlHead(prepared, injection);
}

/// Tauri path: render the note natively in a sandboxed iframe. This is fast
/// and sharp (the WebView lays out text/charts itself); note scripts are
/// isolated from the app DOM by the sandbox.
async function renderHtmlNativeInto(container, htmlSource) {
  const renderSeq = nextRenderSeq(container);
  // Snapshot the note context so a note switch during the async build cannot
  // mix assets from one vault with the base href of another.
  const ctx = imageCtx;
  disposeNativeHtmlPreview(container);
  container.innerHTML = '';
  container.classList.add('html-mode');
  const holder = container.closest('.preview-holder');
  if (holder) holder.classList.add('html-mode');
  let url;
  try {
    url = await api.setHtmlPreview(
      await buildNativeHtmlPreviewDocument(htmlSource, ctx)
    );
  } catch (err) {
    if (isCurrentRender(container, renderSeq)) {
      renderHtmlStaticFallback(container, htmlSource, err.message || err);
    }
    return;
  }
  // A newer note/preview won the race while the Rust-side document was being
  // registered; do not append a stale iframe.
  if (!isCurrentRender(container, renderSeq)) return;
  const iframe = document.createElement('iframe');
  iframe.className = 'html-preview-frame';
  iframe.setAttribute('sandbox', 'allow-scripts allow-forms');
  iframe.setAttribute('referrerpolicy', 'no-referrer');
  iframe.setAttribute('title', t('preview.htmlTitle'));
  iframe.style.height = '600px';
  let received = false;
  let warning = null;
  let resolveReady;
  const ready = new Promise((resolve) => {
    resolveReady = resolve;
  });
  const onMessage = (event) => {
    if (event.source !== iframe.contentWindow) return;
    const data = event.data;
    if (data && typeof data.__rmdPreviewLink === 'string') {
      api.openExternal(data.__rmdPreviewLink).catch(() => {});
      return;
    }
    if (!data || data.__rmdPreview !== true) return;
    if (warning) {
      warning.remove();
      warning = null;
    }
    const height = Math.max(240, Math.min(Number(data.height) || 0, 60000));
    iframe.style.height = `${height}px`;
    if (data.localScript) iframe.dataset.localScript = String(data.localScript);
    if (data.scriptRan) iframe.dataset.scriptRan = String(data.scriptRan);
    if (data.bodyClass) iframe.dataset.bodyClass = String(data.bodyClass);
    if (data.htmlLang) iframe.dataset.htmlLang = String(data.htmlLang);
    if (data.headDefer) iframe.dataset.headDefer = String(data.headDefer);
    if (!received) {
      received = true;
      iframe.dataset.ready = '1';
      resolveReady(true);
    }
  };
  window.addEventListener('message', onMessage);
  const cleanup = () => {
    window.removeEventListener('message', onMessage);
    if (!received) {
      received = true;
      iframe.dataset.ready = '0';
      resolveReady(false);
    }
    if (warning) {
      warning.remove();
      warning = null;
    }
    iframe.remove();
  };
  const timer = setTimeout(() => {
    if (!received) {
      received = true;
      iframe.dataset.ready = '0';
      warning = document.createElement('p');
      warning.className = 'html-preview-warning';
      warning.textContent = t('preview.htmlTimeout');
      iframe.before(warning);
      resolveReady(false);
    }
  }, 20000);
  container._rmdPreviewCleanup = () => {
    clearTimeout(timer);
    cleanup();
  };
  container.appendChild(iframe);
  iframe.src = url;
  await ready;
}

/// Browser-dev fallback: sandboxed iframe + self-capture. Tauri builds use
/// `renderHtmlNativeInto` (native iframe); this path uses html2canvas.

async function renderHtmlIframeInto(container, htmlSource) {
  const renderSeq = nextRenderSeq(container);
  const ctx = imageCtx;
  disposeHtmlControl(container);
  let url;
  try {
    url = await api.setHtmlPreview(await buildHtmlPreviewDocument(htmlSource, ctx));
  } catch (err) {
    console.error('HTML preview registration failed:', err);
    if (!isCurrentRender(container, renderSeq)) return;
    container.innerHTML = '';
    const p = document.createElement('p');
    p.className = 'html-preview-error';
    p.textContent = t('preview.htmlFailed', { msg: err.message || err });
    container.appendChild(p);
    return;
  }
  if (!isCurrentRender(container, renderSeq)) return;
  container.innerHTML = '';
  container.classList.add('html-mode');
  const holder = container.closest('.preview-holder');
  if (holder) holder.classList.add('html-mode');
  const iframe = createHtmlFrame(url);
  const control = controlHtmlFrame(iframe);
  container._rmdHtmlControl = control;
  container.appendChild(iframe);
  iframe.src = url;
  try {
    const state = await control.ready;
    if (container._rmdHtmlControl !== control) return;
    if (state.blocked) {
      iframe.title = t('preview.htmlBlocked');
      return;
    }
    const height = Math.min(Math.max(240, state.height), 60000);
    iframe.style.height = `${height}px`;
    iframe.dataset.ready = '1';
  } catch (err) {
    if (container._rmdHtmlControl === control) {
      console.error('HTML preview failed:', err);
      container.innerHTML = '';
      const p = document.createElement('p');
      p.className = 'html-preview-error';
      p.textContent = t('preview.htmlFailed', { msg: err.message || err });
      container.appendChild(p);
    }
  }
}

/// Last-resort static preview when the built-in WebView renderer fails: the
/// note's shadow body is sanitized exactly like Markdown-authored HTML.
/// Scripts and charts are missing, so a warning is shown above it.
function renderHtmlStaticFallback(container, source, message) {
  container.classList.add('html-mode');
  container.innerHTML = '';
  const banner = document.createElement('p');
  banner.className = 'html-preview-warning';
  banner.textContent = t('preview.htmlNoRenderer', { msg: message });
  const body = document.createElement('div');
  body.className = 'html-static-body';
  body.innerHTML = sanitizeHtml(rewriteLocalImageHtml(htmlBodySource(source)));
  container.append(banner, body);
}

/// Render the current HTML source in a hidden 948 px-wide iframe and return a
/// full-page PNG data URL. The visible preview may be narrower; exports use a
/// deterministic width so page breaks and chart layout are stable.
export async function captureHtmlPreview(source) {
  const ctx = imageCtx;
  const url = await api.setHtmlPreview(await buildHtmlPreviewDocument(source, ctx));
  const iframe = createHtmlFrame(url);
  iframe.classList.add('html-capture-frame');
  iframe.style.cssText =
    'position:fixed;left:-100000px;top:0;width:948px;height:1200px;' +
    'border:0;visibility:visible;';
  const control = controlHtmlFrame(iframe, 45000);
  try {
    document.body.appendChild(iframe);
    iframe.src = url;
    const state = await control.ready;
    if (state.blocked) throw new Error(t('preview.htmlBlocked'));
    // Let ECharts / CSS transitions settle before rasterizing.
    await new Promise((resolve) => setTimeout(resolve, 1400));
    // Keep the canvas under the WebView's practical limits for long reports.
    const scale = Math.max(1, Math.min(2.5, 16000 / Math.max(1, state.height)));
    return await control.capture(scale);
  } finally {
    control.dispose();
    iframe.remove();
  }
}

/**
 * Render a note into a container. Markdown goes through marked + DOMPurify.
 * HTML notes go through the sandboxed native preview iframe (or a
 * browser-dev iframe fallback); their scripts never run in the main document.
 */
/// Release a data view's listeners/observers before the container is reused
/// by a Markdown/HTML render (createView also does this for data-to-data).
function disposeDataView(container) {
  if (typeof container.__dataTeardown === 'function') {
    container.__dataTeardown();
    container.__dataTeardown = null;
  }
}

export function renderPreview(source, container, kind = 'markdown') {
  disposeDataView(container);
  ensureMermaid();
  container.classList.remove('data-mode');
  if (kind === 'html') {
    return api.isTauri
      ? renderHtmlNativeInto(container, source)
      : renderHtmlIframeInto(container, source);
  }
  if (isDataKind(kind)) {
    // A slow HTML iframe/native preview may still be in flight: invalidate it
    // before replacing the container with the data view.
    nextRenderSeq(container);
    disposeNativeHtmlPreview(container);
    disposeHtmlControl(container);
    // Data notes are the one view that should consume the whole preview pane:
    // on a 4K display an 18-column table otherwise wastes most of the window.
    // Narrow tables still shrink to content via `.data-view { width: fit-content }`.
    container.classList.add('data-mode');
    renderDataView(container, kind, source);
    return undefined;
  }
  container.classList.remove('data-mode');
  return renderMarkdownInto(container, source);
}

/// Sanitized `<body>` HTML, used only by the standalone-HTML fallback export.
function htmlBodySource(source) {
  const html = String(source || '');
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body ? doc.body.innerHTML : html;
  } catch {
    return html;
  }
}

// Standalone HTML document for export. Diagrams are rendered to inline SVG
// with the export theme so the file is self-contained. (The app's HTML-note
// export writes the note source verbatim instead; this is the Markdown path.)
export async function buildExportHtml(title, source, theme, kind = 'markdown') {
  const prev = mermaidTheme;
  setPreviewTheme(theme);
  const stage = document.createElement('div');
  stage.style.cssText = 'position:fixed;left:-100000px;top:0;width:860px;';
  document.body.appendChild(stage);
  let body;
  try {
    if (kind === 'html') {
      // Safe fallback for direct callers; the app exports HTML notes verbatim.
      stage.innerHTML = sanitizeHtml(
        rewriteLocalImageHtml(htmlBodySource(source))
      );
    } else if (isDataKind(kind)) {
      renderDataView(stage, kind, source);
    } else {
      await renderMarkdownInto(stage, source);
    }
    // The exported HTML is a standalone file: the rmd scheme only exists
    // in-app, so vault images must be inlined as data: URLs here.
    await inlineLocalImagesForHtml(stage);
    body = stage.innerHTML;
  } finally {
    stage.remove();
    if (prev !== null) setPreviewTheme(prev);
  }
  const isDark = theme === 'dark';
  const dataExport = isDataKind(kind);
  // The app gets highlight.js colors from the /hljs/*.css <link>; a standalone
  // export must carry them too or code blocks lose their colours.
  let hljsCss = '';
  try {
    const res = await fetch(
      isDark ? '/hljs/github-dark.css' : '/hljs/github.css',
      { cache: 'no-store' }
    );
    if (res.ok) hljsCss = await res.text();
  } catch {
    // Export still works without colours.
  }
  const css = `
 :root {
   color-scheme: ${isDark ? 'dark' : 'light'};
   --font-body: "Segoe UI", "Microsoft YaHei", "PingFang SC", system-ui, -apple-system, sans-serif;
   --font-mono: "Cascadia Code", "JetBrains Mono", "Fira Code", Consolas, monospace;
   --border: ${isDark ? '#262a33' : '#e2e5ec'};
   --card: ${isDark ? '#1a1d23' : '#ffffff'};
   --code-bg: ${isDark ? '#22262e' : '#f2f3f8'};
   --text: ${isDark ? '#e7eaf0' : '#1f2430'};
   --text-dim: ${isDark ? '#99a0af' : '#69707f'};
   --text-faint: ${isDark ? '#6b7280' : '#9aa1b0'};
   --accent: ${isDark ? '#7c8cff' : '#4f6df5'};
   --accent-soft: ${isDark ? 'rgba(124,140,255,.12)' : 'rgba(79,109,245,.1)'};
   --accent-soft-2: ${isDark ? 'rgba(124,140,255,.2)' : 'rgba(79,109,245,.16)'};
   --hover: ${isDark ? 'rgba(255,255,255,.055)' : 'rgba(20,24,40,.05)'};
   --danger: ${isDark ? '#ff6369' : '#e5484d'};
   --hl-var: ${isDark ? '#56b6c2' : '#2f8fa3'};
   --hl-string: ${isDark ? '#7bd88f' : '#177a4b'};
   --hl-number: ${isDark ? '#e5a34d' : '#c26a2e'};
   --hl-keyword: ${isDark ? '#c678dd' : '#a626a4'};
   --hl-comment: ${isDark ? '#6f7686' : '#8b93a7'};
   --kind-csv: ${isDark ? '#e9a95f' : '#a15d00'};
   --kind-csv-soft: ${isDark ? 'rgba(233,169,95,.14)' : 'rgba(161,93,0,.1)'};
   --kind-txt: ${isDark ? '#aab4c5' : '#5c6675'};
   --kind-txt-soft: ${isDark ? 'rgba(170,180,197,.13)' : 'rgba(92,102,117,.1)'};
   --kind-json: ${isDark ? '#b79cff' : '#7048c8'};
   --kind-json-soft: ${isDark ? 'rgba(183,156,255,.14)' : 'rgba(112,72,200,.1)'};
   --data-row-even: ${isDark ? 'rgba(255,255,255,.027)' : 'rgba(20,24,40,.028)'};
   --data-ink-1: ${isDark ? '#e7eaf0' : '#1f2430'};
   --data-ink-2: ${isDark ? '#9ec7ff' : '#235c94'};
   --data-ink-3: ${isDark ? '#f2c37d' : '#8a4b0f'};
   --data-ink-4: ${isDark ? '#cbb1ff' : '#663a99'};
   --json-key: ${isDark ? '#a7b8ff' : '#4859c6'};
   --json-object: ${isDark ? '#7aa9ff' : '#1f63c9'};
   --json-object-soft: ${isDark ? 'rgba(122,169,255,.14)' : 'rgba(31,99,201,.11)'};
   --json-object-wash: ${isDark ? 'rgba(122,169,255,.08)' : 'rgba(31,99,201,.06)'};
   --json-array: ${isDark ? '#c3a4ff' : '#6a3bc0'};
   --json-array-soft: ${isDark ? 'rgba(195,164,255,.14)' : 'rgba(106,59,192,.11)'};
   --json-array-wash: ${isDark ? 'rgba(195,164,255,.08)' : 'rgba(106,59,192,.06)'};
   --json-string: ${isDark ? '#78d6a8' : '#0f7a55'};
   --json-number: ${isDark ? '#f0b562' : '#b35c00'};
   --json-boolean: ${isDark ? '#ff91b8' : '#c0266b'};
   --json-null: ${isDark ? '#aab4c8' : '#5f6b7f'};
   --data-warning: ${isDark ? '#e9a95f' : '#8a4b0f'};
   --data-danger: ${isDark ? '#ff9ea2' : '#b42318'};
   --data-grid: ${isDark ? 'rgba(255,255,255,.07)' : 'rgba(20,24,40,.07)'};
 }
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
 body.data-export {
   max-width: none;
   padding: 28px 32px 56px;
 }
 /* Data cards keep their content width (narrow tables stay narrow); a wide
    table's max-width:100% makes the card consume the full viewport instead of
    the 820px reading column used by Markdown. */
 body.data-export .data-table-scroll {
   max-height: none;
   overflow-x: auto;
   overflow-y: visible;
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
  const lang = getLanguage();
  const date = new Date().toLocaleString(lang === 'zh-CN' ? 'zh-CN' : 'en-US', {
    hour12: false,
  });
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(title)}</title>
<style>${css}
${hljsCss}
${DATA_VIEW_CSS}</style>
</head>
<body class="rmd-export${dataExport ? ' data-export' : ''}">
${body}
<footer>${escapeHtml(t('export.footer', { date }))}</footer>
</body>
</html>
`;
}

/// The app decodes HTML notes to a JavaScript string, then exports UTF-8
/// bytes. A `<meta charset="gbk">` copied from the original file would make a
/// browser decode those UTF-8 bytes as GBK, so normalize the declaration when
/// saving a standalone HTML file.
export function ensureUtf8HtmlCharset(source) {
  const html = String(source ?? '');
  const metaTag = '<meta charset="utf-8">';
  if (
    typeof DOMParser !== 'undefined' &&
    /<html[\s>]|<!doctype|<head[\s>]/i.test(html)
  ) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const head = doc.head || doc.documentElement.insertBefore(
      doc.createElement('head'),
      doc.body
    );
    for (const node of [...head.querySelectorAll('meta')]) {
      const equiv = String(node.getAttribute('http-equiv') || '').toLowerCase();
      if (node.hasAttribute('charset') || equiv === 'content-type') {
        node.remove();
      }
    }
    const meta = doc.createElement('meta');
    meta.setAttribute('charset', 'utf-8');
    head.prepend(meta);
    return `<!doctype html>\n${doc.documentElement.outerHTML}`;
  }

  // A bare fragment has no head to parse; insert the declaration after any
  // doctype (never before it) and avoid touching body script text.
  let normalized = html.replace(
    /<meta\b[^>]*\bcharset\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)[^>]*>/gi,
    ''
  );
  normalized = normalized.replace(
    /<meta\b[^>]*\bhttp-equiv\s*=\s*(?:"content-type"|'content-type'|content-type)[^>]*>/gi,
    ''
  );
  if (/^\s*<!doctype[^>]*>/i.test(normalized)) {
    return normalized.replace(
      /^(\s*<!doctype[^>]*>)/i,
      `$1\n<head>${metaTag}</head>`
    );
  }
  return `${metaTag}\n${normalized}`;
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
