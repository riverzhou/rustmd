import { marked } from 'marked';
import hljs from 'highlight.js';

marked.setOptions({ gfm: true, breaks: true });

export function renderPreview(markdownSource, container) {
  container.innerHTML = marked.parse(markdownSource);
  for (const el of container.querySelectorAll('pre code')) {
    hljs.highlightElement(el);
  }
}

// Standalone HTML document for export.
export function buildExportHtml(title, markdownSource, theme) {
  const body = marked.parse(markdownSource);
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
