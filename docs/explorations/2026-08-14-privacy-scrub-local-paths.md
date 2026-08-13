# 隐私清理：移除文档中的本地绝对路径与用户名（2026-08-14）

## 背景

仓库是公开的，`docs/explorations/` 里若干历史文档写入了本机绝对路径
（含 macOS 用户名、桌面目录结构），存在隐私暴露。本次全量排查并清理。

## 排查方法

```bash
git grep -n -i 'ranzhouhang|/Users/|~/Desktop|~/Documents'
```

排除项：`AscDesktopEditor`、`Common.Controllers.Desktop` 等 vendor API 名、
Playwright 的 `devices['Desktop Chrome']`、`public/` 下 vendor 自带内容
（字体二进制内的匹配是字体元数据，`api.js` 里的 `support@gmail.com` 是
OnlyOffice 官方默认值）——均非隐私。

## 清理清单（5 处，涉及 5 个文件）

| 文件                                                             | 原内容                                                                  | 改为                                                 |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------- |
| `2026-08-11-v9-pdf-export-root-cause-and-onlyoffice-personal.md` | `/Users/<用户名>/Desktop/OnlyofficePersonal-9.3.0.133/`                 | "本地解压的 OnlyofficePersonal 9.3.0.133 离线静态包" |
| `2026-08-11-v9-vendor-swap-onlyoffice-personal.md`               | 同上路径 + `9.3.0.133-*/vendor/`                                        | "本地解压的包的 `9.3.0.133-*/vendor/` 目录"          |
| `2026-06-28-agent-panel-ranui.md`                                | `pnpm link /Users/<用户名>/Documents/code/ran/...` 及 override 相对路径 | `<本地 ran 仓库路径>/packages/ranui` 占位写法        |
| `2026-07-04-ranui-a11y-fixes.md`                                 | `~/Documents/code/ran/packages/ranui`                                   | "chaxus/ran 的 `packages/ranui`"                     |
| `2026-07-09-seo-geo-traffic-playbook.md`                         | `~/Desktop/survival`（2 处）                                            | "chaxus/survival 仓库"                               |

## 保留决策

- **`OnlyofficePersonal` 项目名保留**：它是 fernfei 的公开 GitHub 项目，
  且 vendor 采用其 AGPL-3.0 产物，归属说明需要点名来源；隐私风险在于
  "本机绝对路径"，不在项目名本身。若后续决定连名称也匿名化，需同步改
  CLAUDE.md 与三篇 v9 探索文档的标题/正文。
- `chaxus` 作为公开 GitHub handle 在指向公开仓库（chaxus/ran、
  chaxus/survival）时保留；仅移除其出现在本机绝对路径中的形式。

## 遗留事项

- **git 历史中旧版本文件仍含这些路径**。彻底抹除需重写历史
  （`git filter-repo`）并强推，破坏性大；鉴于泄露内容仅为用户名与目录
  结构（非凭据），默认不重写。如需彻底清除可另行操作。
- 后续写探索文档时，本机路径一律用 `<本地路径>` 占位或仓库名指代。
