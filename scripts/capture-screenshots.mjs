// Regenerate the README screenshots from the browser mock UI.
//
// Usage (Windows, Edge WebView2 runtime installed):
//   1) npm run dev                       # http://127.0.0.1:5173
//   2) start Edge headless with CDP:
//      msedge --headless=new --disable-gpu --hide-scrollbars \
//        --remote-debugging-port=9333 --user-data-dir=<temp dir> \
//        --window-size=1440,900 http://127.0.0.1:5173/
//   3) node scripts/capture-screenshots.mjs
//
// Outputs docs/screenshots/{overview,dark,sidebar,multi-vault,vault-switcher,
// html-note,csv-note,txt-note,json-note,json-note-dark}.png and the .en
// variants. The script drives the mock vault that ships in
// frontend/src/api.js, so it works without the Rust backend. CDP/APP can be
// overridden with env vars.
import { writeFileSync } from 'node:fs';

const CDP = process.env.CDP || 'http://127.0.0.1:9333';
const APP = process.env.APP || 'http://127.0.0.1:5173/';
const OUT = 'docs/screenshots';
const NOTE = 'work/数学与图表.md';
const VAULT = 'D:\\Notes';
const RECENT_VAULTS = [
  { dir: VAULT, pinned: true },
  { dir: 'D:\\Knowledge', pinned: true },
  { dir: 'D:\\Writing', pinned: false },
];

const targets = await (await fetch(`${CDP}/json/list`)).json();
const target = targets.find((t) => t.type === 'page' && t.url.startsWith(APP));
if (!target) {
  throw new Error(
    `no page target for ${APP}: ${targets.map((t) => t.url).join(', ')}`
  );
}

const ws = new globalThis.WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = reject;
});

let seq = 0;
const pending = new Map();
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(JSON.stringify(msg.error)));
    else resolve(msg.result);
  }
};

function send(method, params = {}) {
  const id = ++seq;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function js(expression) {
  const res = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (res.exceptionDetails) {
    throw new Error(`page error: ${JSON.stringify(res.exceptionDetails)}`);
  }
  return res.result?.value;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(expression, timeout = 20000) {
  const ok = await js(`new Promise((resolve) => {
    const started = Date.now();
    const tick = () => {
      try { if (${expression}) return resolve(true); } catch (e) {}
      if (Date.now() - started > ${timeout}) return resolve(false);
      setTimeout(tick, 100);
    };
    tick();
  })`);
  if (!ok) throw new Error(`timeout waiting for: ${expression}`);
}

async function setTheme(theme) {
  await js(`(async () => {
    if (document.body.dataset.theme !== '${theme}') {
      document.querySelector('#btn-theme').click();
      await new Promise((r) => setTimeout(r, 400));
    }
    return document.body.dataset.theme;
  })()`);
}

async function setLang(lang) {
  await js(`(async () => {
    const sel = document.querySelector('#language-select');
    if (sel && sel.value !== '${lang}') {
      sel.value = '${lang}';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 500));
    }
    return sel ? sel.value : 'x';
  })()`);
}

async function capture(name, clip) {
  await sleep(700);
  const params = {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: false,
  };
  if (clip) params.clip = { ...clip, scale: 1 };
  const { data } = await send('Page.captureScreenshot', params);
  const path = `${OUT}/${name}.png`;
  writeFileSync(path, Buffer.from(data, 'base64'));
  console.log('wrote', path);
}

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width: 1440,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false,
});

// Seed the recent-vault list (the mock vault is D:/Notes) so the switcher
// screenshot shows multiple folders, then reboot into onboarding.
await js(`localStorage.setItem(
  'rustmd-recent-dirs',
  ${JSON.stringify(JSON.stringify(RECENT_VAULTS))}
);
localStorage.setItem('rustmd-sort-key', 'mtime');
localStorage.setItem('rustmd-sort-dir', 'desc');
localStorage.setItem('rustmd-view', 'split');
localStorage.setItem('rustmd-wrap', 'on');
localStorage.setItem('rustmd-theme', 'light');
localStorage.setItem('rustmd-lang', 'zh-CN');
localStorage.removeItem('rustmd-split');
localStorage.removeItem('rustmd-dir');
localStorage.removeItem('rustmd-multi-vault');
localStorage.removeItem('rustmd-nav-height');
localStorage.removeItem('rustmd-collapsed-vaults');
localStorage.removeItem('rustmd-sidebar');
localStorage.removeItem('rustmd-expanded-folders');
true`);
await send('Page.reload');
await sleep(400);
await waitFor(
  "!document.getElementById('onboarding').classList.contains('hidden')",
  30000
);

// Boot → open the mock vault → expand work/ → open the math + Mermaid note.
await waitFor("document.querySelector('#open-dir-btn')", 30000);
await js(`(async () => {
  const input = document.querySelector('#dir-input');
  input.value = ${JSON.stringify(VAULT)};
  input.dispatchEvent(new Event('input', { bubbles: true }));
  document.querySelector('#open-dir-btn').click();
  await new Promise((r) => setTimeout(r, 500));
})()`);
await waitFor("!document.getElementById('main').classList.contains('hidden')", 30000);
// Screenshots show the whole demo vault, so opt into the subfolder scope
// (the app's default is the current folder only).
await js(`(async () => {
  const cb = document.querySelector('#include-subfolders');
  if (cb && !cb.checked) {
    cb.checked = true;
    cb.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 400));
  }
})()`);
await waitFor("document.querySelectorAll('.note-item').length >= 5", 20000);
await js(`(async () => {
  const rows = [...document.querySelectorAll('.sidebar .nav-item')];
  const work = rows.find((row) => row.querySelector('.nav-label')?.textContent === 'work');
  const toggle = work?.querySelector('.nav-toggle');
  if (toggle && toggle.classList.contains('collapsed')) toggle.click();
  await new Promise((r) => setTimeout(r, 300));
  const item = [...document.querySelectorAll('.note-item')].find(
    (el) => el.dataset.path === '${NOTE}'
  );
  item?.click();
  await new Promise((r) => setTimeout(r, 500));
})()`);
await waitFor("document.querySelectorAll('.mermaid-diagram svg').length > 0", 20000);
await waitFor("document.querySelectorAll('mjx-container').length > 0", 20000);
await sleep(800);

async function openNote(path, kind) {
  await js(`(() => {
    const item = [...document.querySelectorAll('.note-item')].find(
      (el) => el.dataset.path === ${JSON.stringify(path)}
    );
    item?.click();
    return !!item;
  })()`);
  await waitFor(
    `(() => {
      const active = document.querySelector('.note-item.active');
      return active && active.dataset.path === ${JSON.stringify(path)};
    })()`
  );
  if (kind === 'html') {
    await waitFor("!!document.querySelector('iframe.html-preview-frame')");
    await sleep(1800);
  } else if (kind === 'csv' || kind === 'txt' || kind === 'json') {
    await waitFor(`!!document.querySelector('.data-view-${kind}')`);
    await sleep(500);
  } else {
    await waitFor("document.querySelectorAll('.mermaid-diagram svg').length > 0");
    await waitFor("document.querySelectorAll('mjx-container').length > 0");
  }
  await js(
    "document.querySelector('.note-item.active')?.scrollIntoView({ block: 'center' })"
  );
  await sleep(350);
}

async function captureFormats(suffix) {
  await setTheme('light');
  await openNote('guides/html-page.html', 'html');
  await capture(`html-note${suffix}`, null);
  await openNote('data/示例数据.csv', 'csv');
  await capture(`csv-note${suffix}`, null);
  await openNote('data/说明.txt', 'txt');
  await capture(`txt-note${suffix}`, null);
  await openNote('data/配置.json', 'json');
  await capture(`json-note${suffix}`, null);
  await setTheme('dark');
  await capture(`json-note-dark${suffix}`, null);
  await setTheme('light');
}

await setLang('zh-CN');
await setTheme('light');
await capture('overview', null);
await capture('sidebar', { x: 0, y: 0, width: 320, height: 900 });
await setTheme('dark');
await capture('dark', null);

await setTheme('light');
await captureFormats('');
await setLang('en');
await openNote(NOTE, 'markdown');
await capture('overview.en', null);
await capture('sidebar.en', { x: 0, y: 0, width: 320, height: 900 });
await setTheme('dark');
await capture('dark.en', null);
await setTheme('light');
await captureFormats('.en');

// Recent-vault switcher (640×460 crop keeps the popover readable in the
// README without another full-window screenshot).
async function captureVaultSwitcher(name) {
  await js("document.getElementById('btn-change-dir').click(); true");
  await waitFor("!!document.querySelector('.vault-menu')");
  await js('document.activeElement?.blur(); true');
  await sleep(250);
  await capture(name, { x: 0, y: 0, width: 640, height: 460 });
  await js(`window.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
  ); true`);
  await sleep(100);
}

// Multi-vault view: the two pinned demo vaults are shown together, with one
// folder section per vault and the aggregated note list.
await setTheme('light');
await setLang('zh-CN');
await openNote(NOTE, 'markdown');
await js("document.getElementById('btn-multi-vault').click(); true");
await waitFor("document.querySelectorAll('.nav-vault').length === 2");
await sleep(700);
await capture('multi-vault', { x: 0, y: 0, width: 900, height: 900 });
await setLang('en');
await sleep(300);
await capture('multi-vault.en', { x: 0, y: 0, width: 900, height: 900 });

// The switcher screenshot also shows the pinned group and the multi-vault hint.
await setLang('zh-CN');
await captureVaultSwitcher('vault-switcher');
await setLang('en');
await captureVaultSwitcher('vault-switcher.en');

ws.close();
console.log('done');
