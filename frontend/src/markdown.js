// Pure Markdown preprocessing helpers. Kept DOM-free so they can be tested
// with `node --test`; preview.js owns the rendering and MathJax parts.

/** Split Markdown into alternating fenced-code / text segments. */
export function splitCodeSegments(md) {
  const segments = [];
  const lines = String(md).split('\n');
  let text = [];
  let code = [];
  let fence = null; // null outside a fence, otherwise the fence char ` or ~
  let fenceLen = 0;
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
        new RegExp(
          '^\\s*' + (fence === '`' ? '`' : '~') + '{' + fenceLen + ',}\\s*$'
        )
      );
      if (m) {
        flushCode();
        fence = null;
        fenceLen = 0;
      }
      continue;
    }
    const m = line.match(/^\s*(`{3,}|~{3,})/);
    if (m) {
      flushText();
      fence = m[1][0];
      fenceLen = m[1].length;
      code = [line];
      continue;
    }
    text.push(line);
  }
  flushCode();
  flushText();
  return segments;
}

/** Split a text run into inline-code / plain segments. */
export function splitInlineCode(text) {
  const parts = [];
  let i = 0;
  while (i < text.length) {
    const start = text.indexOf('`', i);
    if (start < 0) break;
    let run = 1;
    while (text[start + run] === '`') run += 1;
    const close = text.indexOf('`'.repeat(run), start + run);
    if (close < 0) break;
    if (start > i) parts.push({ code: false, text: text.slice(i, start) });
    parts.push({ code: true, text: text.slice(start, close + run) });
    i = close + run;
  }
  if (i < text.length) parts.push({ code: false, text: text.slice(i) });
  return parts;
}

/** True when a line has `$…$` outside fenced and inline code. */
export function sourceHasMath(md) {
  return splitCodeSegments(md).some(
    (segment) =>
      !segment.code &&
      splitInlineCode(segment.text).some(
        (part) => !part.code && mdSourceHasMath(part.text)
      )
  );
}

export function mdSourceHasMath(text) {
  // `$$` block delimiter, or an inline `$x$` pair.
  if (text.includes('$$')) return true;
  const re = /(^|[^\\$])\$[^\n]*?[^\s$\\]\$(?!\$)/;
  return re.test(text);
}

// A random prefix makes the opaque token collision-proof against a note that
// literally contains the token text (the old fixed `RMDMATH3X` namespace).
const MATH_TOKEN_PREFIX = `RMDMATH${Math.random()
  .toString(36)
  .slice(2, 10)
  .toUpperCase()}`;

export const mathToken = (index) => `${MATH_TOKEN_PREFIX}${index}X`;

// Display-math delimiters must be *standalone*: the opening `$$` starts a
// line (after optional indentation) and the closing `$$` ends a line. A stray
// `$$` quoted mid-sentence — e.g. a syntax guide writing `使用双 $$ 包裹` —
// must not pair up with the next real delimiter and swallow the surrounding
// prose into a bogus "formula" (which then makes MathJax reject the note).
//
// NB: the `g` flag is load-bearing — String.replace with a non-global
// regex only replaces the FIRST match, so without it only the first
// $$…$$ block of the note would be protected and every later display
// formula (matrices, align, cases …) would hit marked's escaping
// (`\\` row separators collapse) and render as a single squashed line.
// The capture group (not lookbehind) keeps the whitespace prefix and
// stays readable in every WebKit version Tauri targets.
export const DISPLAY_MATH_RE = /^([ \t]*)\$\$(?!\$)([\s\S]*?)\$\$[ \t]*$/gm;

export function protectMathInText(text, store) {
  // Display math first ($$...$$, may span lines), then inline $...$.
  // Same inline-math heuristics as mdSourceHasMath above.
  let out = text.replace(DISPLAY_MATH_RE, (match, prefix) => {
    store.push(match.slice(prefix.length));
    return prefix + mathToken(store.length - 1);
  });
  out = out.replace(/(^|[^\\$])\$[^\n]*?[^\s$\\]\$(?!\$)/g, (match, prefix) => {
    store.push(match.slice(prefix.length));
    return prefix + mathToken(store.length - 1);
  });
  return out;
}

/** Protect math outside fenced and inline code; returns opaque tokens. */
export function protectMath(md, store) {
  return splitCodeSegments(md)
    .map((segment) => {
      if (segment.code) return segment.text;
      return splitInlineCode(segment.text)
        .map((part) =>
          part.code ? part.text : protectMathInText(part.text, store)
        )
        .join('');
    })
    .join('\n');
}
