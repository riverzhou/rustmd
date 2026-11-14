# 包管理器清单

这里放的是可以直接提交到各包管理器 / 软件源的分发清单。它们让 rustmd 出现在
`winget search markdown`、`scoop search rustmd`、`yay -Ss rustmd`、`brew search rustmd`
这类**长期搜索入口**中——这是 GitHub 之外最稳定的新用户来源。

> 状态（2026-11-14）：**Scoop 与 Homebrew 已发布**（自建 bucket / tap，可直接安装）；
> winget PR [#479911](https://github.com/microsoft/winget-pkgs/pull/479911) 已通过 validation，等待 review；AUR 清单已就绪，
> 待有 AUR 账号后提交。每个版本发布后需要更新下面的版本号、URL 和 SHA256。

## 目录

| 目录 | 目标 | 用法 | 状态 |
| --- | --- | --- | --- |
| `winget/` | [microsoft/winget-pkgs](https://github.com/microsoft/winget-pkgs) | `winget install RiverZhou.rustmd` | PR [#479911](https://github.com/microsoft/winget-pkgs/pull/479911)；validation 通过，等待 review |
| `scoop/` | [riverzhou/scoop-bucket](https://github.com/riverzhou/scoop-bucket) | `scoop install rustmd` | ✅ 已发布 |
| `aur/` | AUR（`rustmd-bin`） | `yay -S rustmd-bin` | 待提交（需 AUR 账号） |
| `homebrew/Casks/` | [riverzhou/homebrew-tap](https://github.com/riverzhou/homebrew-tap) | `brew install --cask riverzhou/tap/rustmd` | ✅ 已发布 |

## 版本更新清单

发布新版本（例如 `1.10.5`）后：

1. 从 Release 资产读取版本与 SHA256（GitHub 的 asset digest 就是 SHA256）：

   ```bash
   gh release view v1.10.5 -R riverzhou/rustmd \
     --json tagName,assets \
     --jq '.assets[] | "\(.name)\t\(.digest)"'
   ```

2. 更新本目录中所有 `1.10.5` / `v1.10.5` / SHA256 出现的位置；
3. 运行校验：

   ```bash
   winget validate --manifest packaging/winget
   node -e "JSON.parse(require('fs').readFileSync('packaging/scoop/rustmd.json','utf8'))"
   bash -n packaging/aur/PKGBUILD
   ruby -c packaging/homebrew/Casks/rustmd.rb
   ```

## winget

三个文件（version / installer / defaultLocale）必须放在
`manifests/r/RiverZhou/rustmd/<version>/` 下提交。`RiverZhou.rustmd.locale.zh-CN.yaml`
是可选的第二语言清单。当前 Windows 资产是**绿色 zip**，因此使用
`InstallerType: zip` + `NestedInstallerType: portable`，安装后命令别名是 `rustmd`。

`winget validate` 的已知坑：默认语言清单必须是 `ManifestType: defaultLocale`（不是
`locale`），否则会报 “multi file manifest is incomplete”。

## Scoop

`rustmd.json` 可以放进自建 bucket（仓库名形如 `scoop-bucket`，用户执行
`scoop bucket add riverzhou https://github.com/riverzhou/scoop-bucket` 后安装），
也可以向 [ScoopInstaller/Extras](https://github.com/ScoopInstaller/Extras) 提 PR。
`autoupdate` 使用 Release 里的 `.sha256` 边车文件。

## AUR

`PKGBUILD` 的包名是 `rustmd-bin`，从 AppImage 中解出 `usr/` 安装，因此**不依赖
FUSE**。提交时把 `PKGBUILD` 放到 AUR 的 `rustmd-bin` 仓库，并用
`makepkg --printsrcinfo > .SRCINFO` 生成 `.SRCINFO` 一起推送。

## Homebrew

`Casks/rustmd.rb` 按 Homebrew tap 布局存放（仓库 `homebrew-tap`，文件
`Casks/rustmd.rb`）。官方 `homebrew/cask` 的知名度门槛目前不够（需要较多 star/fork），
所以先走自建 tap；等社区规模上来后再提官方仓库。

## 注意

- 清单中的 SHA256 必须对应**已上传**的 Release 资产，不要用本地重新构建的产物
  （本地构建的 zip 与已发布资产可能不同）。
- 包管理器清单是“长期入口”，不追求发布当天就提交；先把版本稳定下来，再提交一次，
  后续每个版本按上面的清单更新。
