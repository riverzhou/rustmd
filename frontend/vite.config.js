import { defineConfig } from 'vite';
import { createRequire } from 'node:module';
import { copyFileSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

const require = createRequire(import.meta.url);

// MathJax v4 is NOT self-contained: it fetches optional font data
// (calligraphic, double-struck, fraktur, script, …) from cdn.jsdelivr.net at
// typeset time, and autoloads TeX extension modules the same way. This app is
// offline-first and its Tauri CSP allows scripts from 'self' only, so those
// fetches fail; MathJax then rejects the WHOLE typeset batch and every formula
// in the note stays raw `$…$` text (reproduced with 数学公式全面测试.md — 0/34
// formulas rendered in the installed app). Serve the font package and the TeX
// extensions from the app origin instead. MATHJAX_CONFIG in preview.js points
// MathJax at these paths with `loader.paths`.
const MATHJAX_FONT_PACKAGE = '@mathjax/mathjax-newcm-font';
const MATHJAX_FONT_URL = '/mathjax-fonts/mathjax-newcm-font';
// Optional font data for TeX extensions (`\ce`, `\mathbbm`, `\mathds`, …).
// Each package ships its SVG glyph data in a single svg.js; their extension
// modules add `[fonts]/<package>` loader paths and request `<path>/svg.js`.
const MATHJAX_FONT_EXTENSIONS = ['mhchem', 'bbm', 'bboldx', 'dsfont'];
const TEX_EXTENSIONS_URL = '/mathjax/tex-extensions';

function mathjaxOfflineAssets() {
  /** @type {Map<string, string>} url path -> absolute file */
  const files = new Map();
  let outDir = '';

  const collect = () => {
    const fontRoot = dirname(require.resolve(`${MATHJAX_FONT_PACKAGE}/package.json`));
    // The base font is bundled inside mathjax/tex-svg.js, but serve it too: a
    // future MathJax build may ask for it, and the copy is cheap.
    files.set(`${MATHJAX_FONT_URL}/svg.js`, join(fontRoot, 'svg.js'));
    const dynamicDir = join(fontRoot, 'svg', 'dynamic');
    for (const name of readdirSync(dynamicDir)) {
      if (name.endsWith('.js')) {
        files.set(`${MATHJAX_FONT_URL}/svg/dynamic/${name}`, join(dynamicDir, name));
      }
    }

    for (const name of MATHJAX_FONT_EXTENSIONS) {
      const pkg = `@mathjax/mathjax-${name}-font-extension`;
      const pkgRoot = dirname(require.resolve(`${pkg}/package.json`));
      files.set(`/mathjax-fonts/mathjax-${name}-font-extension/svg.js`, join(pkgRoot, 'svg.js'));
    }

    // TeX extensions are autoload-only components: `\cancel`, `\ce`,
    // `\qty`, `\bbox`, … are fetched on first use unless bundled. A failed
    // fetch takes down the whole formula batch, so mirror them all (≈320 KB).
    const texRoot = dirname(require.resolve('mathjax/package.json'));
    const extensionsDir = join(texRoot, 'input', 'tex', 'extensions');
    for (const name of readdirSync(extensionsDir)) {
      if (name.endsWith('.js')) {
        files.set(`${TEX_EXTENSIONS_URL}/${name}`, join(extensionsDir, name));
      }
    }
  };

  return {
    name: 'rustmd-mathjax-offline-assets',
    configResolved(config) {
      // In Vite 8 config.build.outDir is relative to the project root.
      outDir = resolve(config.root, config.build.outDir);
      collect();
    },
    // Dev server: answer MathJax's runtime URLs directly from node_modules.
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url || '').split('?')[0];
        const file = files.get(path);
        if (!file) return next();
        res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        res.end(readFileSync(file));
      });
    },
    // Build: emit the lazily fetched files into dist. They cannot go through
    // the bundler (MathJax loads them with plain <script> tags), so a
    // post-build copy is the accurate model of what a hosted package serves.
    closeBundle() {
      for (const [urlPath, file] of files) {
        const dest = join(outDir, urlPath.slice(1));
        mkdirSync(dirname(dest), { recursive: true });
        copyFileSync(file, dest);
      }
    },
  };
}

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [mathjaxOfflineAssets()],
  server: {
    port: 5173,
    strictPort: true,
    // Bind IPv4 explicitly: Vite 6 defaults to IPv6-only (::1) on some
    // machines, and Tauri's WebView2 fails to connect to that, which shows
    // as a white window on startup.
    host: '127.0.0.1',
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
  },
  resolve: {
    alias: {
      // Mermaid 12 lazily imports KaTeX for math inside diagrams. Note math
      // uses MathJax, so point KaTeX at a tiny stub instead of bundling the
      // unused ~260 KB package.
      katex: fileURLToPath(new URL('./shims/katex.js', import.meta.url)),
    },
  },
  optimizeDeps: {
    // MathJax is a browser IIFE bundle loaded lazily via dynamic import only
    // when a note contains math. Without an explicit entry the dev server
    // does not pre-bundle it and the bare specifier fails to resolve in the
    // browser at runtime ("Failed to resolve module specifier").
    include: ['mathjax/tex-svg.js'],
  },
});
