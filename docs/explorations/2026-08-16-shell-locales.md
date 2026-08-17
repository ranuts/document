# 站点壳 i18n 扩到 8 种语言（多语言方向八·第 2 层）

路线图方向八第 2 层。第 1 层（编辑器 UI 跟随访客语言，45 个 vendor 语言包）
见 [2026-08-16-editor-ui-locale-passthrough.md](2026-08-16-editor-ui-locale-passthrough.md)；
这一层补的是**我们自己的壳文案**（FAB 菜单、toast、错误提示）。

## 语言与覆盖策略

用户给的参考菜单是 8 种：English / 简体中文 / 日本語 / Español / Português /
한국어 / Deutsch / فارسی。现在 `SHELL_LOCALES` 正是这 8 种。

关键设计是**完整表 + 部分表**：

```ts
const completeMessages: Record<ZH | EN, I18nMessages> = { … };            // 47 键，必须齐全
const partialMessages: Record<其余 6 种, Partial<I18nMessages>> = { … };   // 核心 19 键
const messages = { ...completeMessages, ...partialMessages };
t(key) => messages[cur]?.[key] || completeMessages.en[key] || key;         // 逐键回落
```

为什么不要求 8 种全齐：一是加一个新 UI 字符串会变成"八语同步"的负担，
现实里必然拖成半吊子；二是没译到的键回落英文，比露出 `agentSend` 这种
原始 key 好得多。**实验性的 AI 面板（`agent*`，`?agent=1` 才出现）刻意
只保留 en/zh**——那批文案长且技术性强，机翻质量风险大，等有人 review 再补。
核心 19 键（打开/新建/菜单/主题/保存提示/四类错误）六种语言全部译到。

## RTL（فارسی）

- `RTL_LANGUAGES` + `isRtlLanguage()`；新增 `applyDocumentLanguage()`，在
  `index.ts` 启动时把 `<html lang>` 与 `dir` 写好（zh 写成 `zh-CN`）。
  副作用留在应用入口而不是共享包里，包本身保持纯函数可测。
- 真浏览器实测 `/editor?locale=fa&new=docx`：`dir=rtl`，FAB 菜单文字右对齐、
  主题三档镜像排列，编辑器 iframe 不受影响（它是独立 document，vendor 无 fa
  语言包，按既有规则回落英文界面）。截图核对无破版。
- 静态落地页仍是 LTR：它们的 `lang`/`dir` 写死在 HTML 里，多语言落地页是
  方向八第 3 层的事，届时 landing.css 要改用逻辑属性（margin-inline 等）。

## 检测链

不变（`?locale=` → cookie → localStorage → `navigator.languages`），只是
`normalizeLanguage` 从"只认 zh/en"改成"认 `SHELL_LOCALES` 里的主子标签"。
`?locale=ja` 现在壳与编辑器**都是**日语（此前只有编辑器是）；`?locale=fa`
壳是波斯语、编辑器回落英语。存储的语言（`document-lang`）也走同一归一化，
所以选过韩语刷新后仍是韩语。

## 用例

- `test/unit/i18n-locales.test.ts`（12 条）：8 种语言清单、每种语言核心 19 键
  逐键断言"非空 / 不是原始 key / 与英文不同"（`SAME_AS_ENGLISH` 白名单放行
  德语 `System`、葡语 `Menu` 这类同形词——它们是正确翻译而非漏译）、
  未译键回落英文、只有 fa 是 RTL、`applyDocumentLanguage` 的 lang/dir、
  存储语言跨刷新。
- `test/unit/i18n.test.ts` 更新了 `?locale=ja` 的断言（壳也变日语），新增
  `?locale=fa` 用例。

## 后续

- 第 3 层多语言落地页：靠 `bin/build-pages.mjs` 的 locale × page 模型批量
  生成，`LOCALES` 表加语言即可；fa 需要 RTL 版 landing.css。建议先看 GSC
  的非中英流量占比再决定首批语言。
- 语言切换器目前仍只有 EN/中文——它切的是**落地页**，没有落地页的语言不该
  出现在里面；等第 3 层再扩。
- 若要给 fa 也配上母语编辑器界面，只能等 vendor 出 fa 语言包（当前 45 个里没有）。
