# 发布与签名

三端发布由 [`.github/workflows/release.yml`](../.github/workflows/release.yml) 完成。签名策略参考同作者的 pythontdx 项目：

- **Windows**：自签名 Authenticode（可选真实 PFX），绿色 zip；
- **macOS**：仅 Apple Silicon（arm64），ad-hoc 整包签名（可选 Developer ID + 公证），arm64 DMG；
- **Linux**：deb + AppImage，SHA256 校验（Linux 桌面没有统一的发行者签名，校验和就是完整性凭证）。

## 1. 版本与发布说明

一次发布需要以下版本一致（`npm run check:version` 校验 8 个值）：

- `package.json` 的 `version`
- `Cargo.toml` 的 `[package] version`
- `crates/rustmd-core/Cargo.toml` 的 `[package] version`
- `tauri.conf.json` 的 `version`
- `Cargo.lock` 的 `rustmd` 与 `rustmd-core` 两个包条目
- `package-lock.json` 的根包（`packages[""]`）与顶层 `version`
- git tag：`v<version>`

`npm run check:version` 会校验以上 8 个版本值（6 个文件，两个 lockfile 各查两处）与 tag。建议用
`npm version <version> --no-git-tag-version` 同步 `package.json` /
`package-lock.json`，手动改根 `Cargo.toml`、`crates/rustmd-core/Cargo.toml` 和
`tauri.conf.json`，再在 `cargo check` / `cargo build` 时确认 `Cargo.lock` 的两个包版本；提交前用
`git diff` 复核。release workflow 会再校验 tag。

**Release 正文是必需产物**：新增 `release-notes/RELEASE_NOTES-<version>.md`（发布说明统一
放在 `release-notes/` 目录，不要散落在仓库根目录），并在
`CHANGELOG.md` 中补对应小节（项目实践两者都写；`scripts/release/release-notes.mjs`
接受任一，找不到才失败）。如果本版改动了 UI 或 mock 笔记库，先用
`node scripts/dev/capture-screenshots.mjs` 重新生成 `docs/assets/screenshots/`（含 HTML/CSV/TXT/JSON 格式截图与中英文/深色变体），并把
README/AGENTS/CHANGELOG/RELEASE_NOTES/AUDIT_REPORT 中的版本号、测试计数和截图描述一起核对
（`scripts/checks/check-repo.mjs` 会校验当前版本的 `release-notes/RELEASE_NOTES-<version>.md` 存在）。发布前先跑：

```bash
node scripts/checks/check-version.mjs v1.11.1
node scripts/release/release-notes.mjs v1.11.1 >/dev/null
```

```bash
npm run check
npm run selftest        # 有真实 WebView 的机器上跑完整 E2E
git add -A
git commit -m "release: v1.11.1"
git tag v1.11.1

# GitHub（remote 名 github）与 GitLab（remote 名 origin）都要推送
git push github master
git push github v1.11.1
git push origin master
git push origin v1.11.1
```

推 GitHub tag 会自动触发 `release` workflow；也可以在 Actions 里手动触发并填入
`v1.11.1`。GitLab 是镜像仓库，不负责构建，但必须同步 commit + tag。

`ci.yml` 会在每个 PR/push 上提前执行 Windows 签名 + 绿色 zip 和 macOS app bundle +
ad-hoc 签名的打包 dry run，并把 selftest 报告校验放在发布前；打包脚本的回归不应等到
tag 之后才暴露。

## 2. Workflow 结构

```
verify (Ubuntu 26.04, npm run check + Xvfb E2E + tag/version/release notes)
  ├─ windows  → target/release/rustmd.exe → 签名 → green zip → artifacts
  ├─ macos    → arm64 .app → ad-hoc 签名 → dmg → artifacts
  └─ linux    → Ubuntu 26.04 上构建 deb + AppImage → SHA256SUMS-linux.txt → artifacts
publish (下载全部 artifacts → 合并 SHA256SUMS.txt → GitHub Release)
```

Linux 发布构建固定使用 `ubuntu-26.04`（最新 Ubuntu，与 `docs/LINUX_BUILD.md` 的
构建基线一致），产物的运行基线是 Ubuntu 24.04+ / glibc 2.39；普通 CI 仍保留
Ubuntu 22.04 的编译与 Xvfb E2E，覆盖旧发行版。`publish` 不构建，固定
`ubuntu-24.04`，不跟随 `ubuntu-latest` 标签迁移。普通 CI 另有一个
`wayland-smoke` job（sway headless + grim，`continue-on-error`），只做
Wayland 前向兼容提示，不进入发布门禁。

只有 `publish` 需要 `contents: write`；build job 都是只读。`verify` 在 Ubuntu 上还会用
`node scripts/dev/run-selftest.mjs` 跑自测（先删除旧 `report.json`/`progress.log`）并用 `--require-html --require-data` 校验报告；HTML/隐藏 WebView 与 CSV/TXT/JSON 数据视图回归会阻止发布。校验器会核对报告里每个 PNG/PDF/HTML 产物位于输出目录内、不早于本次运行、字节数一致，并要求报告里的 `examplesDir` 存在，避免复用/伪造绿色结果。完整自测在离线环境可能因远程图片超时变慢，步骤上限为 1200 秒。

Windows 的 `Stage flat release assets` 步骤在缺少 zip 或 `.sha256` 时直接失败；`.cer` 是可选项，缺少时打印 `No self-signed certificate (real PFX build); skipping` 并继续（真实证书构建不应附带自签名 `.cer`）。`publish` 在发布前逐一断言三端资产（zip、DMG、deb、AppImage、各校验文件、LICENSE）都存在，避免只带证书的残缺 Release。

## 3. 产物

| 平台 | 文件 | 说明 |
| --- | --- | --- |
| Windows | `rustmd-<version>-win-x64-portable.zip` | 解压即用（zip 根目录直接是文件，没有外层目录）；含 `rustmd.exe`、README/CHANGELOG/文档与截图、`CONTRIBUTING.md`、`SECURITY.md`、`LICENSE`、`packaging/README.md`、`scripts/README.md`（脚本索引）；自签名构建还含 `rustmd-selfsigned.cer` |
| Linux | `rustmd_<version>_amd64.deb` | Debian/Ubuntu 安装包 |
| Linux | `rustmd_<version>_amd64.AppImage` | 便携包（需要 FUSE，或 `--appimage-extract-and-run`） |
| macOS | `rustmd-<version>-macos-arm64.dmg` | 仅 Apple Silicon（arm64）；不支持 Intel Mac |
| 全部 | `SHA256SUMS.txt`；Windows/macOS 另有同名 `.sha256`，Linux 另有 `SHA256SUMS-linux.txt` | 完整性校验 |

DMG 在卷根目录附加 `LICENSE`、README/CHANGELOG、`AGENTS.md`、
`CONTRIBUTING.md`、`packaging/README.md`、`docs/`（含审计报告、Linux 构建指南、
截图与营销文案）和 `.github/workflows/`（并带 `/Applications` 快捷方式）；
Windows 绿色 zip 由脚本复制 `LICENSE`、`SECURITY.md`、
README/CHANGELOG、`CONTRIBUTING.md`、`packaging/README.md`、`docs/`（含截图）
和 `.github/workflows/`，保证离线 README
的仓库链接不失效。deb/AppImage 的包内许可证由 Tauri bundler 处理；为确保每个
Release 都能拿到许可证，publish job 还会把仓库根目录的 `LICENSE` 作为独立资产
上传。

Windows zip 的目录结构（zip 根就是绿色目录，没有 `rustmd-<version>-win-x64/` 这一层）：

```
rustmd.exe
README.md / README.en.md
CHANGELOG.md
AGENTS.md
CONTRIBUTING.md
SECURITY.md
LICENSE
rustmd-selfsigned.cer      # 仅自签名构建；真实 PFX 构建不含
packaging/README.md
.github/workflows/*.yml
docs/
├── ARCHITECTURE.md / AUDIT_REPORT.md / CONVENTIONS.md / LICENSING.md
├── LINUX_BUILD.md / RELEASING.md / SECURITY.md / TESTING.md
├── assets/screenshots/*.png + demo.gif
└── marketing/{GITHUB_PROJECT_COPY,PROMOTION}.md
```

GitHub Release 资产就绪后，再从资产 URL + SHA256 更新
`packaging/` 的 winget / Scoop / Homebrew / AUR 清单（不要用本地重新构建的产物），
然后运行 `npm run check:packaging`。这是**发布后**步骤：清单与 `package.json`
的版本可以短暂相差一个版本，检查器只把它当作警告；资产名、URL 与 SHA256 必须彼此一致。

## 4. Windows 签名

`scripts/release/sign-win.ps1`：

1. 前提：先运行 `npx tauri build --no-bundle` 生成 `target/release/rustmd.exe`（脚本只签名，不构建）；
2. 如果设置了 `RUSTMD_WIN_CERT_BASE64` / `RUSTMD_WIN_CERT_PASSWORD`，导入真实 PFX 并带时间戳签名；
3. 否则查找/创建 10 年有效的自签名代码签名证书（`CN=rustmd Self-Signed (integrity only)`），导出公钥 `.cer`；
4. `Set-AuthenticodeSignature`，拒绝 `HashMismatch` / `NotSigned`；
5. 再次 `Get-AuthenticodeSignature` 校验。

`scripts/release/build-win-zip.ps1` 复制签名后的 exe、README/CHANGELOG、`CONTRIBUTING.md`、`packaging/README.md`、SECURITY.md、LICENSE、`docs/`（含截图）、workflow 文件和证书并压缩，检查 zip 内确实有 `rustmd.exe` 且没有临时文件，最后生成 `.zip.sha256`。

### 边界

- 自签名**只证明文件在签名后未被改动**，不能消除 SmartScreen 的“未知发布者”。每个 runner 生成的自签名证书也不同；跨版本比对请用 SHA256。
- 想消除 SmartScreen 需要真实 Authenticode 证书。把 `.pfx` 转成 base64 放入 `RUSTMD_WIN_CERT_BASE64`，密码放入 `RUSTMD_WIN_CERT_PASSWORD` 即可；脚本会走真实证书 + DigiCert 时间戳。
- 若要给 NSIS 安装包签名，需要让 Tauri 在打包前调用签名（`bundle.windows.signCommand`），或改成本项目一样的“绿色 zip”交付；Windows 当前只提供绿色版，避免“安装包内 exe 未签名”的假签名。

## 5. macOS 签名

macOS 只构建 `aarch64-apple-darwin`（Apple Silicon），不构建 Intel/universal。Tauri 配置 `bundle.macOS.signingIdentity: "-"` → ad-hoc 签名。workflow 在构建 `.app` 后再次：

```bash
codesign --force --deep --sign - "$APP"
codesign --verify --deep --strict --verbose=2 "$APP"
```

然后 `hdiutil create` 生成 DMG 并校验。

### Gatekeeper 行为

- 未签名：浏览器下载后可能直接报“已损坏”，没有放行入口。
- **ad-hoc（当前）**：提示“Apple 无法验证…”，用户可在系统设置 → 隐私与安全性中“仍要打开”，或 `xattr -dr com.apple.quarantine`。
- Developer ID + 公证：双击无警告，需要付费 Apple Developer 账号。

### 可选：真实签名 + 公证

当前 workflow 默认 ad-hoc。要启用真实签名：

1. 配置 secret：`APPLE_CERTIFICATE`（.p12 base64）、`APPLE_CERTIFICATE_PASSWORD`、`KEYCHAIN_PASSWORD`、`APPLE_SIGNING_IDENTITY`；
2. 在 macos job 中导入证书到临时 keychain（Tauri 官方文档的 `security import` 步骤）；
3. 构建时让 `APPLE_SIGNING_IDENTITY` 生效（Tauri CLI 会优先使用环境变量）；
4. 公证：配置 `APPLE_ID`、`APPLE_PASSWORD`（app-specific password）、`APPLE_TEAM_ID`，在 DMG 生成后执行：
   ```bash
   xcrun notarytool submit "$DMG" --apple-id "$APPLE_ID" \
     --password "$APPLE_PASSWORD" --team-id "$APPLE_TEAM_ID" --wait
   xcrun stapler staple "$DMG"
   ```
5. 把 DMG 重新上传（workflow 需要在签名/公证后再 `shasum`）。

在完成这一步之前，Release 文案必须明确写出“ad-hoc、未公证、需手动放行”，不要写成“已签名/可信任”。

## 6. Linux

- `npx tauri build --bundles deb,appimage` 生成 deb 与 AppImage；
- `SHA256SUMS-linux.txt` 覆盖两个文件；
- publish job 再对全部发布资产（含独立上传的 `LICENSE`）生成合并的 `SHA256SUMS.txt`；
  各平台自己的 `.sha256` 与 `SHA256SUMS-linux.txt` 不包含在内，避免校验文件自引用。
- Linux 没有 Windows/macOS 那种系统级发行者签名；如需 GPG，可在 workflow 中增加 `gpg --detach-sign`，但当前未启用。

AppImage 运行依赖 FUSE；无 FUSE 时用 `--appimage-extract-and-run`。

## 7. 校验发布产物

```bash
# Linux
sha256sum -c SHA256SUMS-linux.txt

# macOS
shasum -a 256 -c rustmd-1.11.1-macos-arm64.dmg.sha256

# Windows PowerShell
(Get-FileHash .\rustmd-1.11.1-win-x64-portable.zip -Algorithm SHA256).Hash
Get-Content .\rustmd-1.11.1-win-x64-portable.zip.sha256
```

Windows 签名检查（解压 zip 后 `rustmd.exe` 就在当前目录，zip 无外层文件夹）：

```powershell
Get-AuthenticodeSignature .\rustmd.exe | Format-List
```

macOS 签名检查：

```bash
codesign --verify --deep --strict /Applications/rustmd.app
spctl -a -vv /Applications/rustmd.app   # ad-hoc 仍会被拒绝，属预期
```

## 8. 本机构建（不上传）

```bash
npm ci
npm run check
npx tauri build --no-bundle       # 当前平台可执行文件
# macOS:
npx tauri build --target aarch64-apple-darwin --bundles app
# Linux:
npx tauri build --bundles deb,appimage
```

Windows 绿色包：

```powershell
npx tauri build --no-bundle
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/release/sign-win.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/release/build-win-zip.ps1
```

## 9. 回滚

- 构建失败：修复后重新推 tag（或删除远端 tag 后重推）通常最省事；`publish` 只在所有 build job 成功后运行。
- 资产错误：保留 tag，重新跑 `release` workflow（`overwrite_files: true` 会覆盖同名资产）。
- 已发布的 tag 不要移动到不同提交；如需重发，使用新的 patch 版本。

## 10. Secrets 一览

| Secret | 必需 | 用途 |
| --- | --- | --- |
| `GITHUB_TOKEN` | 自动 | 创建 Release（workflow 内置） |
| `RUSTMD_WIN_CERT_BASE64` | 否 | 真实 Windows Authenticode PFX（base64） |
| `RUSTMD_WIN_CERT_PASSWORD` | 否 | PFX 密码 |
| `APPLE_CERTIFICATE` | 否 | macOS Developer ID .p12（base64） |
| `APPLE_CERTIFICATE_PASSWORD` | 否 | .p12 密码 |
| `KEYCHAIN_PASSWORD` | 否 | CI 临时 keychain 密码 |
| `APPLE_SIGNING_IDENTITY` | 否 | codesign 身份名称 |
| `APPLE_ID` / `APPLE_PASSWORD` / `APPLE_TEAM_ID` | 否 | 公证 |

没有这些 secret 时，Windows 回退自签名、macOS 回退 ad-hoc，发布仍可完成。
