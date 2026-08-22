# PR #192 的 Lint 红：单测还在磁盘上找那些"不再入库"的页面

日期：2026-08-22
分支：`landing-generated`（PR #192）
现象：只有 `Lint and Validate` 红，三条用例挂，E2E 全绿。

## 挂的是哪三条

```
generated-pages.test.ts  has no committed page that a fresh render would change
                         → ['ja/index.html', 'help.html', …(62)] 不等于 []
design-contract.test.ts  finds the pages (sanity) → expected 5 to be greater than 15
landing-pages.test.ts    the WebMCP page lists exactly the tools the adapter registers
                         → ENOENT public/webmcp-document-editor.html
```

三条是同一个原因：这个 PR 把落地页改成"由 `bin/build-pages.mjs` 在 build/dev 时
渲染进 public/，产物不入库"，而这三个用例还在从磁盘读那些产物。本地全绿只是因为
本地跑过 dev/build——CI 是干净 checkout，public/ 下根本没有这些文件。

也就是说：**它们过去测的是"我这台机器上一次构建的残留"**。

## 改法：谁生成的就问谁要

`generate({ outDir: null })` 已经能在内存里渲染出全部页面（`landing-pages.test.ts`
的主体早就这么做了），把剩下三处也换过去：

- `design-contract.test.ts` 的 page chrome：磁盘只留手写页（`404.html`、
  `embed-demo.html`、`history.html`），生成页走内存渲染。
- `landing-pages.test.ts` 的 WebMCP 用例：改成遍历所有 `webmcp-document-editor.html`
  的渲染结果，不再只查 en/zh 两个写死路径。
- `sw-register.test.ts` 的两条首页策略用例：同理改成遍历 `kind === 'home'` 的渲染，
  新增一个语言自动被覆盖（这条本轮还没红，但下一步会红，见下）。

## 顺手拔掉的一根刺：`public/zh-CN/index.html` 还在库里

`check()` 原本拿**每一个**输出去比磁盘，而"入库"的其实只该有一个——仓库根的
`index.html`，因为它是 Rollup 的构建入口，构建不能依赖插件先跑过。`ja/index.html`
上一个提交已经进了 `.gitignore`，`zh-CN/index.html` 却漏了，于是同一类文件一半入库
一半不入库。

现在 `bin/build-pages.mjs` 里显式写出 `COMMITTED = new Set(['index.html'])`，`check()`
只看它；`public/zh-CN/index.html` 从索引里删掉并进 `.gitignore`。落地页的语言从此
真的只是 `content/<locale>/` 一个目录。

## 反向验证（三条都做了）

| 拆掉什么                                        | 应该红的用例                                                   | 结果 |
| ----------------------------------------------- | -------------------------------------------------------------- | ---- |
| 往 `index.html` 尾部追加一行注释                | generated-pages「committed page…」                             | 红   |
| 生成器 shell 的 `<header class="bar">` 改成 nav | design-contract「carries the site header」（每个生成页各一条） | 红   |
| `lib/web-mcp.ts` 的 `get_document_state` 改名   | landing-pages「WebMCP page lists…」                            | 红   |

跑法：在 `scratchpad/` 建一个干净 worktree（软链 `node_modules`），那里 public/ 下
没有任何生成页，正是 CI 的样子。修完 47 个测试文件 1255 条全绿。

## 教训

产物不入库是对的（不会过期），但**用例得跟着换水源**。判断标准很简单：这个文件
`.gitignore` 里有没有？有，就不能 `readFileSync`。
