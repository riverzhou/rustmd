// SPDX-License-Identifier: MIT OR Apache-2.0
//
// Host bridge for the shared renderer.
//
// Everything in `frontend/src/shared/` is licensed MIT OR Apache-2.0 and must
// stay free of Tauri and of desktop-only assumptions so it can be reused
// outside the desktop app. The shell (`api.js`, or any other transport)
// installs its implementation here before rendering.
//
// Contract (all optional except `isDesktop`):
//   isDesktop: boolean
//   openExternal(url)                        -> Promise<void>
//   readLocalImage(root, path)               -> Promise<{ bytes, mime }>
//   readLocalAsset(root, path)               -> Promise<{ bytes, mime }>
//   setHtmlPreview({ html, token })          -> Promise<string>  (iframe URL)
//   htmlIsolationScript: string              -> injected into the preview iframe
//                                               to drop the shell's bridge globals
//
// `npm run check:license` fails if a file in this directory imports
// `@tauri-apps/*`, reads `__TAURI_INTERNALS__`, or calls `invoke(` directly.

function notConfigured(name) {
  return () => {
    throw new Error(`host bridge not configured: ${name}`);
  };
}

/** Mutable bridge object; shells install their implementation into it. */
export const host = {
  isDesktop: false,
  openExternal: notConfigured('openExternal'),
  readLocalImage: notConfigured('readLocalImage'),
  readLocalAsset: notConfigured('readLocalAsset'),
  setHtmlPreview: notConfigured('setHtmlPreview'),
  htmlIsolationScript: '',
};

/** Install a shell implementation. Later calls override individual methods. */
export function configureHost(impl) {
  Object.assign(host, impl);
  return host;
}
