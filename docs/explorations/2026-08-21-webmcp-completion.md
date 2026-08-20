# WebMCP 补齐：两个新工具、一处格式漂移，以及一次实测出来的引擎缺口

日期：2026-08-21
分支：`feat/webmcp-completion`

## 起点：文档说的和代码做的不一样

CLAUDE.md 的「技术方向评估」里，WebMCP 一节写着**「结论：技术可行，时机过早，暂缓实现」**，
连示例工具名都是 `open_document_from_url`。而实际上 `lib/web-mcp.ts` 已经 249 行、
5 个工具、10 个单测，2026-08-16 就接进去了。

这类过时最贵的地方不在于读者被误导一次，而在于下一个人会**基于「还没做」去做决策**。
本节已按现状重写。

## 一、格式清单手写，已经落后于引擎

`open_document_url` 的描述写死了 `(docx, doc, xlsx, xls, pptx, ppt, csv, pdf)`。
而 `DOCUMENT_TYPE_MAP` 里一直有 **odt / ods / odp / rtf / txt**——也就是说，
Agent 被明确告知这些格式不支持，而引擎一直读得了。

（上一个 PR 刚把这批格式补进文件选择器的 `accept`，同样的漂移在 WebMCP 这一侧也存在，
只是没人去对。）

改成派生：

```ts
export const OPENABLE_EXTENSIONS: string[] = Object.keys(DOCUMENT_TYPE_MAP).sort();
```

单测钉住两者相等，且显式列举 odt/ods/odp/rtf/txt 必须在内。以后引擎多支持一个格式，
描述当天就跟上。

**注意**：`@ranuts/shared/document-utils` 里还有一个 `getDocumentType()`，它只认 8 个格式
（不认 ODF），与 `DOCUMENT_TYPE_MAP` 的 13 个不一致。我一开始用了它来判断文档类型，
是错的；已改用 map。**这两套判断并存本身是个隐患**，本次没有合并它们（超出范围），记在这里。

## 二、实测：agent 工具在 v9 下的真实状态

`lib/agent-plugin/tools.ts` 的注释写着「All over editor methods verified live against
the **v7.5** SDK」。现在引擎是 v9。要把这些工具桥接到 WebMCP，先得知道它们还活着没有。

手拼 docx / xlsx / pptx 三种文档，在真实编辑器里逐个探测：

|                                                      | docx           | xlsx                   | pptx           |
| ---------------------------------------------------- | -------------- | ---------------------- | -------------- |
| `asc_EditSelectAll` + `pluginMethod_GetSelectedText` | ✓ 返回真实文本 | **✗ 空字符串**         | **✗ 空字符串** |
| `asc_RemoveSelection`                                | ✓              | undefined              | undefined      |
| `pluginMethod_PasteHtml`                             | ✓ 真的插入了   | 调用不报错但**没插入** | 同左           |
| `pluginMethod_AddComment`                            | ✓              | ✓                      | ✓              |
| `asc_SetTrackRevisions`                              | ✓              | **undefined**          | **undefined**  |
| `asc_setCellValue`                                   | undefined      | **undefined**          | undefined      |
| `asc_getCellInfo`                                    | undefined      | ✓                      | undefined      |

三条结论：

1. **全文读取只在文字文档可用**，表格和演示返回空字符串——而且是**静默**的，不报错。
2. **`set_cell` 在 v9 下彻底坏了**：它依赖的 `asc_setCellValue` 在表格编辑器里也不存在。
3. **`set_review_mode` 只在 word 可用**：`asc_SetTrackRevisions` 在另外两个编辑器里没有。

2 和 3 是 agent 面板的既有缺陷（v7.5 → v9 迁移遗留），**本次没有修**——那是另一件事，
且面板的调用上下文和这里不同。记在这里，也写进了 CLAUDE.md。

## 三、静默的空字符串是不能直接暴露的

第 1 条决定了 `get_document_text` 怎么接。

对调用方来说，「文档是空的」和「这个引擎读不出来」返回的是同一个东西：空字符串。
Agent 拿到它会得出前一个结论，然后**自信地基于「这是一份空文档」回答**。这比报错糟得多。

所以 WebMCP 这一层显式区分：

```ts
if (!text && kind !== 'word') {
  return ok({
    ok: true,
    text: '',
    supported: false,
    note: '... this is a cell document. Use save_document (targetExt TXT, CSV or PDF) ...',
  });
}
```

诚实，而且给了可执行的替代路径。空的 word 文档仍然是 `supported: true` 且没有 note——
那是真的空，不该被说成读不出来。

工具实现本身**复用** `agent-plugin/tools.ts` 的 `getDocumentTextTool`，没有另写一份：
`@ranuts/agent-core` 的类型注释里写明工具是 transport-agnostic 的，而 `editor-bridge.ts`
零 import，所以复用不带来 bundle 成本。

## 四、新增两个工具

- **`create_document`** — 新建空白 document / spreadsheet / presentation。
  `?new=docx` 一直是真实能力，只是工具层没有出口，Agent 只能靠打开一个已有文件起步。
- **`get_document_text`** — 见上。

工具顺序重排为：打开 → 新建 → 导出 → 读取 → 模式 → 状态。之前 `set_readonly` 夹在
`save_document` 和新工具中间，纯粹是插入位置的偶然。

## 五、E2E：这个适配器此前只有单测

单测把它调用的每个编辑器函数都 mock 了，所以它们证明的是接线，**完全没有证明任何一个
工具真的做到了它描述里承诺的事**。

新增 `test/e2e/webmcp.spec.ts`：用 `addInitScript` 在任何脚本之前注入
`document.modelContext`（正是浏览器会做的事），然后完全通过工具驱动真实编辑器：

- 注册顺序、每个工具都有 object schema 和像样的描述
- **只用工具**完成 打开 buffer → 读正文 → 导出 PDF，断言 blob URL / data URL 可序列化
- `create_document` 三种类型 + 未知类型被拒
- 表格文档的 `get_document_text` 返回 `supported: false` 且提示 `save_document`
- 嵌入 iframe 里**不**注册（顶层限制）

一个时序坑：`get_document_state` 的 `hasDocument` 只看 `window.editor` 存在，
而它在文档加载完成**之前**就为 true。据此就去读正文，工具内部会抛错走 isError，
断言看到的不是「格式不支持」而是异常。改用 `waitForEditorReady`。

## 六、反向验证（约定 3）

| 拆掉什么                                         | 哪个用例变红                                                                              |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| 去掉 `supported: false` 分支（退回静默空字符串） | `webmcp.spec.ts` → `no full text` 用例                                                    |
| 把 `create_document` 改名                        | `landing-pages.test.ts` → `the WebMCP page lists exactly the tools the adapter registers` |

## 七、SEO / GEO

- 新落地页 `/webmcp-document-editor`（en + zh）。这是个竞争极低的新兴词，而本站是
  少数真正实现了的站点之一——对 GEO 尤其有意义：LLM 被问到「哪个在线编辑器能被浏览器
  Agent 调用」时，需要有一个说清楚了的页面可引。页面同时写清了两条刻意的限制
  （顶层限制、全文读取限制），理由和上一个 PR 给 llms.txt 加 Limitations 一样。
- `llms.txt` 里原本那行 WebMCP 描述已过时（工具清单不全），替换为准确版本，并把
  「全文读取仅 word」加进 Limitations 一节。
- sitemap 42 → 44，两个首页页脚加入口。
- **新契约**：`landing-pages.test.ts` 断言落地页与 llms.txt 提到的工具名必须与
  `buildTools()` 实际注册的完全一致。工具改名而页面没跟上，等于让 Agent 去调一个
  不存在的东西——比不列出来更糟。
- `content/{en,zh-CN}/help.md` 加「浏览器 AI 助手（WebMCP）」一节，四个问题：
  能不能用、哪些浏览器、嵌入时能不能用、能不能读正文。

## 顺带

同一会话里 #162 的 `Lint and Validate` 红了：那份探索文档是在 `pnpm run format` **之后**
才写的，提交前只补跑了 lint 和测试，没重跑格式检查，于是没对齐的 markdown 表格进了库。
教训是提交前应固定跑完整的 CI lint job 三件套（`format:check` + `lint:ts` + `test:coverage`），
而不是挑着跑。
