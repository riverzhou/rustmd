# 发布与签名

三端发布由 [`.github/workflows/release.yml`](../.github/workflows/release.yml) 完成。签名策略参考同作者的 pythontdx 项目：

- **Windows**：自签名 Authenticode（可选真实 PFX），绿色 zip；
- **macOS**：仅 Apple Silicon（arm64），ad-hoc 整包签名（可选 Developer ID + 公证），arm64 DMG；
- **Linux**：deb + AppImage，SHA256 校验（Linux 桌面没有统一的发行者签名，校验和就是完整性凭证）。

## 1. 版本与发布说明

一次发布需要以下版本一致：

- `package.json` 的 `version`
- `Cargo.toml` 的 `[package] version`
- `tauri.conf.json` 的 `version`
- `Cargo.lock` 与 `package-lock.json` 的根包版本
- git tag：`v<version>`

`npm run check:version` 会校验以上五个版本文件（含两个 lockfile 的根包版本）。建议用
`npm version <version> --no-git-tag-version` 同步 `package.json` /
`package-lock.json`，手动改 `Cargo.toml` / `tauri.conf.json`，再在
`cargo check` / `cargo build` 时确认 `Cargo.lock` 的根包版本；提交前用
`git diff` 复核。release workflow 会再校验 tag。

**Release 正文是必需产物**：新增 `RELEASE_NOTES-<version>.md`，并在
`CHANGELOG.md` 中补对应小节（项目实践两者都写；`scripts/release-notes.mjs`
接受任一，找不到才失败）。如果本版改动了 UI 或 mock 笔记库，先用
`node scripts/capture-screenshots.mjs` 重新生成 `docs/screenshots/`（含 HTML/CSV/TXT/JSON 格式截图与中英文/深色变体），并把
README/AGENTS/CHANGELOG/RELEASE_NOTES/AUDIT_REPORT 中的版本号、测试计数和截图描述一起核对。发布前先跑：

```bash
node scripts/check-version.mjs v1.10.3
node scripts/release-notes.mjs v1.10.3 >/dev/null
```

```bash
npm run check
npm run selftest        # 有真实 WebView 的机器上跑完整 E2E
git add -A
git commit -m "release: v1.10.3"
git tag v1.10.3

# GitHub（remote 名 github）与 GitLab（remote 名 origin）都要推送
git push github master
git push github v1.10.3
git push origin master
git push origin v1.10.3
```

推 GitHub tag 会自动触发 `release` workflow；也可以在 Actions 里手动触发并填入
`v1.10.3`。GitLab 是镜像仓库，不负责构建，但必须同步 commit + tag。

## 2. Workflow 结构

```
verify (Ubuntu, npm run check + Xvfb E2E + tag/version/release notes)
  ├─ windows  → target/release/rustmd.exe → 签名 → green zip → artifacts
  ├─ macos    → arm64 .app → ad-hoc 签名 → dmg → artifacts
  └─ linux    → deb + AppImage → SHA256SUMS-linux.txt → artifacts
publish (下载全部 artifacts → 合并 SHA256SUMS.txt → GitHub Release)
```

只有 `publish` 需要 `contents: write`；build job 都是只读。`verify` 在 Ubuntu 上还会运行
`npm run selftest` 并用 `--require-html --require-data` 校验报告；HTML/隐藏 WebView 与 CSV/TXT/JSON 数据视图回归会阻止发布。完整自测在离线环境可能因远程图片超时变慢，步骤上限为 1200 秒。

## 3. 产物

| 平台 | 文件 | 说明 |
| --- | --- | --- |
| Windows | `rustmd-<version>-win-x64-portable.zip` | 解压即用；含 `rustmd.exe`、README/CHANGELOG/文档与截图、`SECURITY.md`、`LICENSE`；自签名构建还含 `rustmd-selfsigned.cer` |
| Linux | `rustmd_<version>_amd64.deb` | Debian/Ubuntu 安装包 |
| Linux | `rustmd_<version>_amd64.AppImage` | 便携包（需要 FUSE，或 `--appimage-extract-and-run`） |
| macOS | `rustmd-<version>-macos-arm64.dmg` | 仅 Apple Silicon（arm64）；不支持 Intel Mac |
| 全部 | `SHA256SUMS.txt`；Windows/macOS 另有同名 `.sha256`，Linux 另有 `SHA256SUMS-linux.txt` | 完整性校验 |

DMG 在卷根目录附加 `LICENSE`、README/CHANGELOG、AGENTS/AUDIT/LINUX_BUILD、
`docs/`（含截图）和 `.github/workflows/`（并带 `/Applications` 快捷方式）；
Windows 绿色 zip 由脚本复制 `LICENSE`、`SECURITY.md`、
README/CHANGELOG、`docs/`（含截图）和 `.github/workflows/`，保证离线 README
的仓库链接不失效。deb/AppImage 的包内许可证由 Tauri bundler 处理；为确保每个
Release 都能拿到许可证，publish job 还会把仓库根目录的 `LICENSE` 作为独立资产
上传。

Windows zip 的目录结构：

```
rustmd-1.10.3-win-x64/
├── rustmd.exe
├── README.md / README.en.md
├── CHANGELOG.md
├── AUDIT_REPORT.md / AGENTS.md / LINUX_BUILD.md
├── SECURITY.md
├── LICENSE
├── rustmd-selfsigned.cer      # 仅自签名构建；真实 PFX 构建不含
├── .github/workflows/*.yml
└── docs/
    ├── ARCHITECTURE.md / TESTING.md / RELEASING.md / SECURITY.md / ...
    └── screenshots/*.png
```

## 4. Windows 签名

`scripts/sign-win.ps1`：

1. 前提：先运行 `npx tauri build --no-bundle` 生成 `target/release/rustmd.exe`（脚本只签名，不构建）；
2. 如果设置了 `RUSTMD_WIN_CERT_BASE64` / `RUSTMD_WIN_CERT_PASSWORD`，导入真实 PFX 并带时间戳签名；
3. 否则查找/创建 10 年有效的自签名代码签名证书（`CN=rustmd Self-Signed (integrity only)`），导出公钥 `.cer`；
4. `Set-AuthenticodeSignature`，拒绝 `HashMismatch` / `NotSigned`；
5. 再次 `Get-AuthenticodeSignature` 校验。

`scripts/build-win-zip.ps1` 复制签名后的 exe、README、CHANGELOG/文档与截图、SECURITY.md、LICENSE、证书并压缩，检查 zip 内确实有 `rustmd.exe` 且没有临时文件，最后生成 `.zip.sha256`。

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
- publish job 再对所有资产生成合并的 `SHA256SUMS.txt`；
- Linux 没有 Windows/macOS 那种系统级发行者签名；如需 GPG，可在 workflow 中增加 `gpg --detach-sign`，但当前未启用。

AppImage 运行依赖 FUSE；无 FUSE 时用 `--appimage-extract-and-run`。

## 7. 校验发布产物

```bash
# Linux
sha256sum -c SHA256SUMS-linux.txt

# macOS
shasum -a 256 -c rustmd-1.10.3-macos-arm64.dmg.sha256

# Windows PowerShell
(Get-FileHash .\rustmd-1.10.3-win-x64-portable.zip -Algorithm SHA256).Hash
Get-Content .\rustmd-1.10.3-win-x64-portable.zip.sha256
```

Windows 签名检查：

```powershell
Get-AuthenticodeSignature .\rustmd-1.10.3-win-x64\rustmd.exe | Format-List
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
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/sign-win.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-win-zip.ps1
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
