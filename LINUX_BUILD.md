# Linux 编译手册

本文说明如何在 Linux 上从源码构建 rustmd，并产出一个可直接拷贝的绿色二进制。
构建基线：Ubuntu 26.04 x86_64 / Rust 1.99.1 / Node.js 24 / Tauri 2.12。

## 1. 产物

```text
target/release/rustmd          约 11 MB，单文件
```

它是一个动态链接的可执行文件：自身的 Rust 代码和前端资源都嵌在二进制里，
GTK 3 / WebKitGTK 4.1 使用系统库（和 Windows 版依赖系统 WebView2 是同一思路）。
拷贝到任意目录即可运行，不需要安装器。

不要把 GTK/WebKit 全部打包进去：AppImage 解压后约 300 MB，压缩后约 90 MB，
和“小巧、绿色”的目标相反。本仓库的 `/release/` 只放最终二进制，且被 gitignore。

## 2. 环境要求

| 项目 | 要求 |
| --- | --- |
| 系统 | Ubuntu 24.04+ x86_64（本项目在 26.04 上构建/验证） |
| glibc | ≥ 2.39；要在 22.04 上运行，请在 22.04 上重新构建 |
| Rust | stable，≥ 1.85（项目使用 edition 2024） |
| Node.js | ≥ 20（Vite 6；本项目用 24） |
| 桌面 | GTK 3 + WebKitGTK 4.1 运行库 |

先确认工具链：

```bash
node -v
npm -v
rustc --version
cargo --version
pkg-config --version
```

如果提示 `cargo: command not found`：

```bash
source "$HOME/.cargo/env"
```

## 3. 安装系统依赖（推荐，需 sudo）

```bash
sudo apt update
sudo apt install -y \
  build-essential pkg-config curl file \
  libwebkit2gtk-4.1-dev \
  libgtk-3-dev \
  libsoup-3.0-dev \
  libjavascriptcoregtk-4.1-dev
```

Tauri 官方列表里还有几个可选包；本项目没有托盘，不需要它们：

```bash
# 可选：托盘图标 / SVG 图标支持
sudo apt install -y libayatana-appindicator3-dev librsvg2-dev
```

验证 pkg-config 能找到依赖：

```bash
pkg-config --modversion gtk+-3.0
pkg-config --modversion webkit2gtk-4.1
```

> 注意：`webkit2gtk-4.1` 的 `4.1` 是 WebKit API 版本，不是 GTK 4。
> Tauri 2 的 Linux 后端（wry）使用的就是 GTK 3，详见第 8 节。

## 4. 安装 Rust 和前端依赖

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \
  | sh -s -- -y --profile minimal
source "$HOME/.cargo/env"
rustup default stable

npm ci
```

国内网络如果下载 Rust 很慢，可以让 rustup 走镜像：

```bash
export RUSTUP_DIST_SERVER=https://rsproxy.cn
export RUSTUP_UPDATE_ROOT=https://rsproxy.cn/rustup
```

crates.io 也可以用 source replacement（写入 `~/.cargo/config.toml`）：

```toml
[source.crates-io]
replace-with = "rsproxy-sparse"

[source.rsproxy-sparse]
registry = "sparse+https://rsproxy.cn/index/"
```

## 5. 构建

```bash
npx tauri build --no-bundle
```

Tauri CLI 会先执行 `npm run build`（Vite 产物写入 `frontend/dist`），
再以 release + `tauri/custom-protocol` 编译 Rust，并嵌入前端资源。

```text
Finished `release` profile [optimized] target(s)
Built application at: .../target/release/rustmd
```

`--no-bundle` 表示不生成 `.deb` / AppImage / 安装器，只产出二进制。
当前 `tauri.conf.json` 的 bundle target 是 Windows NSIS，在 Linux 上也不需要它。

## 6. 验证

```bash
# 动态库是否都能解析（不应有 "not found"）
ldd target/release/rustmd | grep 'not found' || echo 'all shared libs resolved'

# 需要桌面会话（Wayland 或 X11）
./target/release/rustmd

# Rust 单测；网络测试离线时会自动跳过
cargo test
```

前端改动可以先在浏览器里验证（Tauri API 会自动切到内存 mock）：

```bash
npm run dev
# http://127.0.0.1:5173
```

## 7. 打包绿色版

```bash
mkdir -p release

install -m 755 target/release/rustmd release/rustmd

sha256sum release/rustmd > release/SHA256SUMS

tar -C release -czf release/rustmd-1.0.0-linux-x86_64.tar.gz rustmd
```

目标机器只需要 GTK 3 + WebKitGTK 4.1 运行库。Ubuntu 桌面版通常已自带；
如果缺少：

```bash
sudo apt install -y libwebkit2gtk-4.1-0 libgtk-3-0t64
# Ubuntu 22.04 等旧版把 libgtk-3-0t64 写成 libgtk-3-0
```

`/release/` 已在 `.gitignore` 中，构建产物不要提交到 git。

## 8. GTK3 还是 GTK4？

Tauri 2 稳定版的 Linux 后端只有 GTK 3：

| 组件 | 实际依赖 |
| --- | --- |
| `libwebkit2gtk-4.1.so.0` | GTK 3（WebKit API 4.1） |
| `libwebkitgtk-6.0.so.4` | GTK 4（WebKit API 6.0，Tauri 2 不用） |
| `libgtk-3.so.0` | GTK 3 |
| `libgtk-4.so.1` | GTK 4（GNOME 应用用） |

系统可以同时安装 GTK 3 和 GTK 4；GNOME 桌面本身用 GTK 4，但 GTK 3 兼容库
仍然存在，所以本程序能正常运行。

Tauri 2 / wry 的 GTK4 + WebKitGTK 6.0 迁移仍在进行中（wry issue #1474）；
下一代 alpha 的 CEF runtime 使用 GTK4，但那是 Chromium/CEF，不是 WebKitGTK。
不建议在 Tauri 2 进程里额外初始化 GTK 4——GTK 3 和 GTK 4 不能在同一进程共存。

## 9. 常见问题

| 现象 | 原因 / 处理 |
| --- | --- |
| `cargo: command not found` | `source "$HOME/.cargo/env"`，或用 `$HOME/.cargo/bin/cargo` |
| `pkg-config: command not found` | `sudo apt install pkg-config` |
| `Package 'webkit2gtk-4.1' ... not found` | 缺 `libwebkit2gtk-4.1-dev` |
| `webkit2gtk-sys` 自定义构建失败 | 同上，确认 `.pc` 能被 `pkg-config` 找到 |
| 运行时 `libwebkit2gtk-4.1.so.0: cannot open ...` | 目标机缺运行库：`libwebkit2gtk-4.1-0` |
| `Rollup failed to resolve import "katex"` | mermaid 12 的可选动态 import；本项目已用 `frontend/shims/katex.js` alias 到 204 B stub，数学公式仍由 MathJax 渲染。删掉 alias 会让构建失败 |
| 启动后白窗口 | 前端模块初始化抛错；用 `npm run dev` 在浏览器里看 console |
| `.AppImage` 运行报 FUSE 错误 | 本项目不产 AppImage；如确实需要，装 `libfuse2`（24.04+ 为 `libfuse2t64`）或加 `--appimage-extract-and-run` |
| 旧系统报 `GLIBC_2.39 not found` | 在旧系统上重新构建（glibc 向下不兼容） |

## 附录 A：没有 sudo / 缺 dev 包时

如果目标机器是公司/受控环境，拿不到 root，但运行库已经安装，可以把 `-dev`
包解压到本地 sysroot，只用于构建。以下方法在 Ubuntu 26.04 上验证过。

```bash
SYSROOT=$HOME/.cache/rustmd-build/sysroot
mkdir -p "$SYSROOT" /tmp/rustmd-debs
cd /tmp/rustmd-debs

apt-get download \
  pkgconf pkgconf-bin libpkgconf7 \
  libgtk-3-dev libgio-2.0-dev libsoup-3.0-dev \
  libjavascriptcoregtk-4.1-dev libwebkit2gtk-4.1-dev

for f in *.deb; do
  dpkg-deb -x "$f" "$SYSROOT"
done
```

设置构建环境：

```bash
export PATH="$SYSROOT/usr/bin:$PATH"
export PKG_CONFIG_PATH="$SYSROOT/usr/lib/x86_64-linux-gnu/pkgconfig:$SYSROOT/usr/share/pkgconfig"
export PKG_CONFIG_SYSROOT_DIR="$SYSROOT"
export LD_LIBRARY_PATH="$SYSROOT/usr/lib/x86_64-linux-gnu${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
```

然后反复运行：

```bash
pkg-config --libs webkit2gtk-4.1
```

根据报错补齐包。常见映射：

| 缺失的 `.pc` | 包 |
| --- | --- |
| `glib-2.0` / `gobject-2.0` / `gio-2.0` | `libgio-2.0-dev`（`libglib2.0-dev` 是元包，不含 `.pc`） |
| `gtk+-3.0` / `gdk-3.0` | `libgtk-3-dev` |
| `webkit2gtk-4.1` | `libwebkit2gtk-4.1-dev` |
| `javascriptcoregtk-4.1` | `libjavascriptcoregtk-4.1-dev` |
| `libsoup-3.0` | `libsoup-3.0-dev` |
| `harfbuzz` / `libpng` / `fontconfig` / `freetype2` | `libharfbuzz-dev` / `libpng-dev` / `libfontconfig-dev` / `libfreetype-dev` |
| `x11` / `xext` / `xrender` / `xcb` / `pixman-1` | X11 相关 `libx11-dev`、`libxext-dev`、`libxrender-dev`、`libxcb1-dev`、`libpixman-1-dev` |
| `xi` / `xrandr` / `xcursor` / `xfixes` / `xcomposite` / `xdamage` / `xinerama` | 对应 `libxi-dev` 等 |
| `wayland-client` / `xkbcommon` / `epoxy` | `libwayland-dev` / `libxkbcommon-dev` / `libepoxy-dev` |

`-dev` 包里的 `.so` 符号链接指向 sysroot 里不存在的运行库，需要指回系统：

```bash
for l in "$SYSROOT"/usr/lib/x86_64-linux-gnu/*.so; do
  if [ -L "$l" ] && [ ! -e "$l" ]; then
    t=$(basename "$(readlink "$l")")
    [ -e "/usr/lib/x86_64-linux-gnu/$t" ] \
      && ln -sfn "/usr/lib/x86_64-linux-gnu/$t" "$l"
  fi
done
```

说明：

- `PKG_CONFIG_SYSROOT_DIR` 让链接参数里的 `-L` 指向 sysroot，因此链接能找到
  `.so`；产物运行时仍然使用系统库（二进制没有 rpath）。
- 这套办法只解决“构建时缺头文件/pkg-config”，目标机仍然需要 GTK3/WebKitGTK
  运行时。若目标机也没有运行库，只能做体积大得多的自包含包。
- 依赖闭包比较长（本机约 60 个包）；用 `pkg-config` 的报错逐个补齐即可。
  更省事的替代方案是用 Ubuntu 24.04 容器，在容器里 `sudo apt install` 后构建。

## 附录 B：构建环境记录

```text
OS            Ubuntu 26.04 LTS (glibc 2.43)
Rust          1.99.1
Node.js       24.22.2
Tauri         2.12.0
WebKitGTK     2.52.6
产物          11,670,752 bytes (11.1 MiB), stripped
```
