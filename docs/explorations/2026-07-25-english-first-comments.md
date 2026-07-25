# 注释/代码内文案统一英文（i18n 与语言切换器除外）

日期：2026-07-25
分支：feat/premium-ui
涉及：`packages/converter/src/docx-zip.ts`、`test/unit/docx-zip.test.ts`、
`packages/agent-core/src/llm/webllm.ts`、`lib/agent-plugin/ui/panel.ts`、
`public/embed-demo.html`、`CLAUDE.md`

## 问题（用户指出）

项目注释应优先使用英文，主体是英文，只有真正的多语言内容才用其他语言。
实际扫描发现代码里残留中文的地方有三类，其中两类是真问题。

扫描方式（后续复查同样可用）：

```bash
rg -l '[\p{Han}]' -g '*.{ts,tsx,js,mjs,cjs,css,sh,html,yml,yaml}' \
  -g '!public/{sdkjs,web-apps,wasm,libs}/**'
# 全角标点单独查一遍（em-dash 会误报，要排除）
rg -n '[（）「」，。、：；！？]' -g '*.{ts,tsx,js,html}' ...
```

## 三类中文，只有前两类要改

**1. 纯中文注释 —— 改**

- `packages/converter/src/docx-zip.ts`：文件头 ZIP/OOXML 说明、`rewriteXmlEntries`
  的 JSDoc、媒体目录与 `readZipEntry` 返回 null 的两处行内注释
- `test/unit/docx-zip.test.ts`：文件头测试策略说明、`FixtureEntry` 字段 JSDoc、
  `buildZip` 说明、流式写入器注释、`beforeAll` 里的 jsdom 说明，以及 **12 个
  `it()` 标题**（测试标题是失败输出里的开发者可读文案，同样算注释范畴）

**2. 硬编码进代码的中文 UI 文案 —— 改（这是真 bug，不只是风格）**

- `packages/agent-core/src/llm/webllm.ts`：`WEBLLM_MODELS` 的两个 label 带
  `（推荐，工具最佳）`/`（最小）`。这些没走 i18n，**所有语言的用户**在 agent
  面板的模型下拉里都会看到中文注解。改为 `(recommended, best at tools)` /
  `(smallest)`。
- `lib/agent-plugin/ui/panel.ts:174`：拼接下拉 label 时用了全角括号
  `${model.label}（${model.size}）`，同理改 ASCII 括号。
- `public/embed-demo.html`：整页中文，但它是**英文落地页和中文落地页共用的同一个
  demo**（`public/embed-document-editor.html` 的 "Open the live demo →" 和
  `public/zh-CN/embed-document-editor.html` 的"打开在线 demo →"都指向它）。
  英文用户点进来看到满屏中文。整页改英文并把 `<html lang>` 从 `zh-CN` 改成 `en`，
  示例 Excel 数据（表头/客户名/状态/sheet 名）一并英文化。

**3. 合法的多语言内容 —— 不动**

- `packages/shared/src/i18n.ts` 的 zh-CN 词条、`test/unit/i18n.test.ts` 里断言
  zh-CN 译文的那一行
- 各页面语言切换器里的 `<r-option value="zh-CN">中文</r-option>`（含
  `public/lang-switch.js` 注释里的示例 markup）——语言名用其自身写法（endonym）
  是正确做法，翻成 "Chinese" 反而是退步
- `public/404.html`：刻意的双语兜底页（英文为主体 + 一行 `.nf-zh` 中文），
  因为单个 404 同时服务两个 locale
- `docs/**`、`CLAUDE.md`：中文文档是项目约定（与"对话中文、commit 英文"一致），
  本轮不在范围内

## 规范落地

在 `CLAUDE.md` 的「代码规范」里补了一条，避免下次又漂回去：注释与代码内字符串
默认英文；中文只出现在 i18n 词条、`public/zh-CN/**`、语言切换器 endonym、
双语 404 与 `docs/**`。

## 验证

- `format:check` / `lint:ts` 全过
- 20 个测试文件 252 个单测全过（改的是 `it()` 标题与注释，无行为变更）
- 逐一复查残留中文：只剩 12 处语言切换器的 `中文` 标签，全部符合预期
