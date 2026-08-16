# 编辑器 UI 语言跟随访客（多语言方向八·第 1 层，2026-08-16）

用户给了一张 8 语言菜单（English / 简体中文 / 日本語 / Español /
Português / 한국어 / Deutsch / فارسی）要求评估多语言。评估写在路线图
方向八；本文是其中最便宜、收益最大的一层的落地记录。

## 现状

`packages/shared/src/i18n.ts` 的 `getOnlyOfficeLang()` 只会返回 `en` 或
`zh-CN`——因为它是从站点壳的语言（只有 en/zh 两套词条）映射出来的。而
vendored 的 web-apps 自带 45 个语言包
（`public/web-apps/apps/<app>/main/locale/*.json`）；一个日语浏览器的
访客拿到的却是英文编辑器。

vendor 加载器的解析规则（app.js）：`lang` 参数小写、按 `-`/`_` 拆分，
`pt-pt` / `zh-tw` / `sr-cyrl` 三个保留四字码，其余取主子标签；
`locale/<code>.json` 404 时回落 `en`。所以任何 BCP-47 标签传进去都安全。

## 改动

- 新增 `EDITOR_UI_LOCALES`（45 个）与纯函数 `resolveEditorLocale(tag)`：
  `ja-JP`→`ja`、`pt-BR`→`pt`、`pt-PT`→`pt-PT`、`zh-Hant-HK`→`zh-TW`、
  `zh`/`zh_CN`→`zh-CN`、`sr-Cyrl-RS`→`sr-Cyrl`、`nb`→`no`、旧标签
  `in`/`iw` 归一；vendor 没有的（如 `fa`）返回 null。
- 检测链不变（URL `?locale` → cookie → localStorage `document-lang` →
  `navigator.languages`），但同一条链现在产出两个结果：壳语言（en/zh）
  与编辑器 locale（任意 vendor 支持的标签），各自取第一个命中的来源。
  `?locale=ja` = 英文壳 + 日文编辑器；`?locale=fa` 找不到则继续看浏览器
  语言列表的下一项。`setLanguage()`（用户显式选壳语言）同时把编辑器
  语言定为 zh-CN / en。
- `getOnlyOfficeLang()` 直接返回该 locale；`lib/onlyoffice-editor.ts` 的
  `editorConfig.lang` 已经用它，零改动。

## 验证

- `test/unit/i18n.test.ts` 新增 24 条：映射表逐项、45 个 locale 自映射、
  `?locale=ja` 分裂结果、`fa` 回落、显式选择覆盖。
- 真浏览器 `?locale=ja&new=docx`：iframe `lang=ja`，功能区标签
  ファイル / ホーム / 挿入 / 描画 / レイアウト / 参考資料 / 共同編集 / 表示。
- 坑：vitest 跑的是 `packages/shared/dist`，改源码后必须
  `pnpm --filter @ranuts/shared run prepare`，否则 "not a function"
  （CLAUDE.md 已记过同类问题）。

## 未做（方向八后续层）

- 壳的 ≈40 个词条补 ja/es/pt/ko/de/fa（半天）；语言切换器数据驱动。
- 多语言落地页走 #116 的生成器；fa 需 RTL 验收。
