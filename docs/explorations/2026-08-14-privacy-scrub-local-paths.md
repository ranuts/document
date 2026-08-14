# 隐私清理：移除入库文件中的本地路径与个人信息（2026-08-14）

## 背景

仓库是公开的，`docs/explorations/` 与 CLAUDE.md 里若干历史内容写入了
本机绝对路径（含 macOS 用户名、桌面目录结构）以及第三方个人的网名/
个人仓库名，存在隐私暴露。本次分两轮全量排查并清理，并把规范固化进
CLAUDE.md 的"代码规范 → 隐私红线"。

## 排查方法

```bash
# 第一轮：本机路径与用户名
git grep -n -i '<用户名>|/Users/|~/Desktop|~/Documents'
# 第二轮：人名/网名/个人仓库名、个人邮箱
git grep -n -E '[a-zA-Z0-9._%+-]+@(gmail|qq|163|outlook)\.[a-z]+'
```

排除项（非隐私，不动）：`AscDesktopEditor`、`Common.Controllers.Desktop`
等 vendor API 名、Playwright 的 `devices['Desktop Chrome']`、平台名
（掘金/V2EX/知乎/HN 等）、`public/` 下 vendor 自带内容（字体二进制内的
匹配是字体元数据，`api.js` 里的 `support@gmail.com` 是 OnlyOffice 官方
默认值）。

## 第一轮：本机路径（5 处，5 个文件）

| 文件                                     | 原内容                                     | 改为                                 |
| ---------------------------------------- | ------------------------------------------ | ------------------------------------ |
| v9 PDF 根因文档（2026-08-11）            | `/Users/<用户名>/Desktop/<离线包目录>/`    | "本地解压的第三方离线静态包"         |
| v9 vendor 换底座文档（2026-08-11）       | 同上路径 + `9.3.0.133-*/vendor/`           | "本地解压的离线包的 `vendor/` 目录"  |
| `2026-06-28-agent-panel-ranui.md`        | `pnpm link /Users/<用户名>/...` 及相对路径 | `<本地 ran 仓库路径>/packages/ranui` |
| `2026-07-04-ranui-a11y-fixes.md`         | `~/<本地目录>/ran/packages/ranui`          | "chaxus/ran 的 `packages/ranui`"     |
| `2026-07-09-seo-geo-traffic-playbook.md` | `~/<本地目录>/survival`（2 处）            | "chaxus/survival 仓库"               |

## 第二轮：第三方个人信息（网名、个人仓库名）

- **vendor 编译者的网名与其个人仓库名全部移除**（CLAUDE.md 1 处 +
  探索文档 10 余处），统一改为中性描述"第三方编译的 OnlyOffice
  9.3.0.133 离线静态包 / 离线包"。AGPL 合规靠 LICENSE 与源码可得性
  保障，不依赖在文档里点名个人。
- **两个文件名含该项目名的探索文档 `git mv` 重命名**：
  - `...-pdf-export-root-cause-and-onlyoffice-personal.md` →
    [2026-08-11-v9-pdf-export-root-cause-and-offline-vendor.md](2026-08-11-v9-pdf-export-root-cause-and-offline-vendor.md)
  - `...-vendor-swap-onlyoffice-personal.md` →
    [2026-08-11-v9-vendor-swap-offline-vendor.md](2026-08-11-v9-vendor-swap-offline-vendor.md)
  - 同步更新了 2026-08-11/08-12 两篇文档里的交叉链接。
- **SEO 文档中方法论原作者的网名移除**（标题 + 正文共 3 处），改为
  "「出海做站」系列文章/方法论"的中性说法。

## 保留决策

- `chaxus` / `ranuts` 作为项目所有者自己的公开 GitHub handle、组织名
  及其公开仓库名保留——这是项目署名，不是泄露。
- 官方产品名（OnlyOffice、documentserver-de）保留。

## 规范固化

CLAUDE.md"代码规范"新增 **隐私红线** 条目：入库内容禁止本机路径、
机器用户名、个人邮箱/凭据、第三方个人姓名/网名/社交账号/个人仓库名；
引用第三方来源用中性描述；`chaxus`/`ranuts` 公开身份除外。

## 遗留事项

- **git 历史中旧版本文件仍含上述信息**。彻底抹除需重写历史
  （`git filter-repo`）并强推，破坏性大；鉴于泄露内容为路径/网名
  （非凭据），默认不重写。如需彻底清除可另行操作。
