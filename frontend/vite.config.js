import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
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
  optimizeDeps: {
    // MathJax is a browser IIFE bundle loaded lazily via dynamic import only
    // when a note contains math. Without an explicit entry the dev server
    // does not pre-bundle it and the bare specifier fails to resolve in the
    // browser at runtime ("Failed to resolve module specifier").
    include: ['mathjax/tex-svg.js'],
  },
});
