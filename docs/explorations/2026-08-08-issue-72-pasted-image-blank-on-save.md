# Issue #72：复制/插入带链接的图片保存不了、在线 URL 图片不显示

## 背景

用户要求检查 GitHub issue 并继续修复。仓库里最新的 issue #113（`document:open-buffer`
打不开 docx，见下方"顺带排查：#113 的 base64 修复实际有效，问题在 Qt WebEngine 侧"）
排查到一半发现缺一个 Qt WebEngine 环境没法继续验证，遂搁置，转向另一个同样是"图片"
相关但**在普通 Chrome 里就能从代码层面确认根因**的 issue：#72。

**这篇文档记录了两轮排查，第一轮方向错了，第二轮才找到真正的根因——完整保留下来，
避免以后重复踩同一个坑。**

## 第一轮：只看了评论，方向错了（已保留修复，但未必是真正生效的那个）

一开始只用 `gh issue view --comments` 看到 reporter 的追加留言：

> 截图粘贴后，显示正常；但是保存下载的文件中，图片是空白的只有占位

当时理解为"剪贴板截图粘贴保存后空白"，据此定位到一个**真实存在、但后来证明不是
本次报告场景**的架构缺口，并已修复（细节见下方"第一轮修复"）：粘贴图片在编辑
视图里只以内存 `blob:` URL 形式存在，x2t（负责把编辑器内部 `.bin` 格式转换成
最终 docx/xlsx/pptx 的 WASM 转换器）跑在沙盒虚拟文件系统里，理论上没有能力访问
浏览器的 Blob URL Store。

**后来在生产环境（`edit.chaxus.com`）实测发现：这个"剪贴板截图粘贴 → 立刻保存"
的简单场景，在修复前的旧代码上就已经工作正常**——用合成 `paste` 事件模拟纯字节
截图粘贴，保存后图片是好的、尺寸和像素内容都对。这说明第一轮的假设不成立：
SDK 在处理 `writeFile` 回调时，很可能已经把图片字节直接写进了 `.bin` 内部格式
本身（而不是只存一个 URL 引用），所以 x2t 转换时根本不需要再去抓取 `blob:` URL。
第一轮的修复因此更像是一个"防御性但未必触发得到"的补丁，不是错的，但没有对应上
一个真正坏掉的场景。

## 第二轮：把 issue 正文读全了，才找到真正复现的场景

`gh issue view --comments` 只给评论，不给正文。用 `gh issue view --json body`
把原始 issue body 补读一遍，原话是：

> 截图粘贴和插入的保存都可以，就是**复制带链接的图片**保存有问题，还有**插入在线
> url 图片也不显示**

标题也是"复制进来的图片保存的时候报错"，不是"截图粘贴"。维护者最早那条"CORS
限制"的回复，其实针对的正是这两种场景——只是后续 `keepfighting` 那条追加评论把
话题带偏到了"截图粘贴"上，第一轮也跟着排查错了方向。

### 结论

根因确认，已修复：**"Insert → Image → Image from URL"（以及网页复制"带链接的
图片"很可能走的同一条路径）不是 CORS 问题，是 SDK 内部指望有一个真实的 OnlyOffice
Document Server 帮忙抓图，这个项目没有这个服务器。**

## 第一轮排查过程

- `lib/onlyoffice-editor.ts` 的 `handleWriteFile`（处理粘贴图片的 SDK `writeFile`
  事件）把图片字节包成 `Blob` → `createObjectURL()` 得到一个 `blob:` URL → 存进模块级
  `media` 映射表 → 通过 `asc_setImageUrls`/`asc_writeFileCallback` 回传给 SDK，用于
  **实时编辑视图里的显示**。这一步本身没问题，也解释了为什么"显示正常"。
- 保存方向（`packages/converter/src/document-converter.ts` 的
  `convertBinToDocument`）直接把编辑器吐出来的 `.bin` 写进 x2t 的虚拟文件系统
  （`FS.writeFile`）就跑转换，**全程没有一行代码读取过 `media` 映射表，也没有把任何
  URL 对应的字节写回 `/working/media/` 目录**。
- 反向确认："打开"方向反而有对称的读取逻辑——`readMediaFiles()`
  在文档转换完成后 `FS.readdir('/working/media/')`，把 x2t 解压 docx/xlsx/pptx 时
  自动产生的媒体文件读出来做成 blob URL 供实时编辑用。保存方向本该有个对称的"写入"
  步骤，但完全缺失。
- `lib/converter.ts` 导出的 `convertBinToDocument`/`convertBinToDocumentAndDownload`
  签名只有 `(bin, fileName, targetExt)`，`onlyoffice-editor.ts` 里的 `media` 映射表
  从未被传进去过——从函数签名这一层就能看出这条链路根本不通，不需要跑真实环境就能
  确认。

## 第一轮修复（保留，但真正生效与否未知）

- `packages/converter/src/document-converter.ts`：新增私有方法 `writeMediaFiles(media)`，
  对 `media` 映射表里的每个 `[相对路径, URL]`，`fetch(url)` 取字节后写入
  `/working/${相对路径}`（`/working/media/` 目录已经在 `WORKING_DIRS` 里预先创建好，
  不需要额外 `mkdir`）。`convertBinToDocument` 在写 `.bin` 文件、跑转换之前先调用它；
  `convertBinToDocumentAndDownload` 透传 `media` 参数。单个 URL fetch 失败只警告、
  跳过，不阻塞其余图片或抛出异常。
- `lib/converter.ts`：导出的 `convertBinToDocument`/`convertBinToDocumentAndDownload`
  包装函数新增可选 `media?: Record<string, string>` 参数并透传给 `X2TConverter`。
- `lib/onlyoffice-editor.ts`：`setConverterCallbacks` 的回调类型统一成
  `ConvertBinFn`（新增 `media` 形参）；`handleSaveDocument` 里两处调用
  （`embeddedSaveRequest` 分支的 `convertBinToDocumentFn`、本地下载分支的
  `convertBinToDocumentAndDownloadFn`）都把模块级 `media` 对象传进去。

**这条修复现在的定位**：不是错的（`.bin` 是否任何时候都自包含图片字节这件事没有
反向证明过），保留作为一层防御性兜底；但生产环境实测显示它对"截图粘贴 → 保存"
这个场景不是必需的（旧代码在这个场景下已经工作正常）。真正复现、真正需要修的是
下面第二轮的场景。

- **静态/单元测试**：`test/unit/document-converter.test.ts` 新增
  `writeMediaFiles (private)` 一组用例（4 条）：无 `media` 时不触碰 FS；正常 fetch
  并按 `media/<file>` 路径写入；key 不带 `media/` 前缀时自动补上；单个 URL fetch
  失败时跳过该条、不影响其余条目也不抛异常。

## 第二轮排查过程：真正定位到 `AscCommon.G2`

在生产环境（`edit.chaxus.com`，未部署本次任何修复的旧代码）用 chrome-devtools
MCP 实测复现：

1. 工具栏 "Insert → Image → Image from URL"，填一个真实外部图片 URL（Wikimedia，
   无 CORS 限制，用来排除"这是不是 CORS 问题"这个变量）。
2. 图片本身**抓取成功**：`GET https://upload.wikimedia.org/.../Example.jpg` →
   **200**。控制台也打出了 `Write file event`/`Successfully processed image`，
   说明我们自己这边的 `handleWriteFile` 跑过了。
3. 但文档里**什么都没插入**，光标停在原地。控制台額外出现 **3 次 404**：
   ```
   GET https://edit.chaxus.com/web-apps/apps/documenteditor/main/undefined
   ```
   路径里字面意义上的 `undefined`，说明代码某处该填真实路径的变量传成了
   `undefined`。

用同源 iframe 访问，追进 `sdkjs/word/sdk-all-min.js`：

- 工具栏 "Image from URL" 调用的是 SDK 内部方法 `AddImageUrl`（压缩名 `cNd`）：

  ```js
  cNd = function (t, o, s, c) {
    // t = 传入的 URL 数组
    AscCommon.G2(
      this,
      o, // 待抓取的 URL 列表
      function (e) {
        /* e 是抓取结果数组，用 e[i].url 填回 t */
      },
      e, // ← cNd 自己的形参列表里根本没有 e，这是个悬空引用
      s,
    );
  };
  ```

- `AscCommon.G2(z, C, P, S, X)` 在没有真实 desktop/native 宿主时，会把 `S`/`X`
  （对应上面那个悬空的 `e` 和 `s`）打包进一个 `{c: 'imgurls', tokenDownload: X,
data: C, ...}` 的命令对象，通过 `AscCommon.bJc(z, null, ha)` 发出去——这是
  期待一个**真实的 OnlyOffice Document Server** 在服务端把 URL 抓下来（这样能
  绕开浏览器的同源策略限制），再把本地路径传回来的协议。这个项目没有这个服务器，
  于是这个"发给服务器"的请求，实际上打到了当前 iframe 自己的源上，且因为
  `S`/`X` 是 `undefined`，请求路径里带出了字面量 `undefined`，产生上面看到的
  3 次 404。
- 实测确认（同源 patch + spy）：`AscCommon.G2` 的 4/5 号参数在这次调用里确实
  是 `undefined`——`{argCount:5, arg3:"undefined", arg3Value:"undefined",
arg4:"undefined"}`。

## 第二轮修复：`AscCommon.G2` 客户端直接接管

- `public/onlyoffice-v7-iframe-patch.js`（本来就是专门给 v7 iframe 打"没有真实
  服务器"系列补丁的地方，字体 XHR 拦截也在这个文件里）新增 `patchAddImageUrl()`：
  轮询等 `window.AscCommon.G2` 出现（这个脚本比 `sdk-all-min.js` 先加载，
  `AscCommon` 一开始不存在），替换成浏览器直接 `fetch(url)` 的实现——拿到
  `Blob` 后用原生 `URL.createObjectURL()` 生成本地引用，按 `AddImageUrl`/`G2`
  原本期待的 `{url, path}` 数组形状回调，单个 URL 失败就返回
  `{url:'error', path:'error'}`（跟 `G2` 自己在原生编辑器分支/服务器出错分支
  已经在用的形状一致，SDK 会走它自己已有的报错 UI，而不是像现在这样静默失败）。
- 这个修法完全绕开了"发给不存在的服务器"这一步，改成浏览器自己发起请求——
  对能正常跨域的图片主机（大部分公开图床，包括这次用来复现的 Wikimedia）能修好；
  对真正设了严格 CORS 策略、明确拒绝浏览器直接访问的主机，`fetch` 依然会失败，
  但至少能让用户看到一个真实的报错，而不是无声无息什么都不做。

## 第二轮验证

- **单元测试**：`test/unit/iframe-patch.test.ts` 新增 `AscCommon.G2 "Image from
URL" patch (#72)` 一组用例（4 条）：`AscCommon` 尚未定义时轮询等待、之后正确
  替换 `G2`；正常 fetch 时返回的 `{url, path}` 形状对（`path` 匹配
  `media/image<时间戳><随机串>.<扩展名>`）；fetch 失败时返回
  `{url:'error', path:'error'}` 而不是抛异常；已经打过补丁的 `G2` 不会被重复
  替换。`pnpm run lint:ts && pnpm run format:check && pnpm run test:coverage`
  全绿（296 个单测）。
- **生产环境（未修复的旧代码）复现**：如上，`edit.chaxus.com` 上确认了
  "Image from URL" 图片不显示、且有 3 次 `.../documenteditor/main/undefined`
  404，同时确认目标图片 URL 本身 200（排除 CORS 是这次复现的原因）。
- **本地 dev server（应用了本次修复）部分验证**：同源拿到 iframe 内的
  `Asc.editor`，直接调用 `api.AddImageUrl([wikimedia图片URL])`（绕开工具栏
  UI，因为本地 dev/preview 环境有一个跟这次改动无关的、更早排查中就发现的
  "New Word 卡在 Loading 遮罩、工具栏 disabled" 的老问题，见下方"未解决的环境
  限制"）：
  - `iframe.contentWindow.AscCommon.__g2Patched === true`，补丁确认生效。
  - 调用过程中**没有任何 XHR/fetch 请求带 `undefined`**，也没有抛异常——
    本次要修的那个具体 bug 机制（悬空参数 → 打给不存在的服务器 → undefined
    路径 404）在补丁生效后不再出现。
  - **没能验证到"图片真的插入文档模型 + 保存后能在 zip 里看到"这一步**：
    `api.asc_getCanUndo()` 调用前后都是 `false`，`window.editor.downloadAs()`
    在这个环境下也没能走完（没有 `Save document event` 日志）——这看起来是
    前面提到的"本地环境卡住"问题的另一种表现形式（连编辑操作本身都应用不到
    文档模型上），不是这次补丁引入的新问题，但也没法在本地环境里排除。

## 未解决的环境限制：本地 dev/preview 环境卡在 "Loading document"

跟这次改动无关的一个更早发现、仍未解决的问题：`vite dev`/`vite preview` 在
本地跑 v7（documenteditor + spreadsheeteditor 都试过）时，编辑器会永久停在
SDK 自己的 `Common.UI.LoadMask` 遮罩上（`asc-loadmask-body`，`z-index:1151`，
真的挡住点击，不是纯装饰），`asc_onDocumentContentReady` 从不触发（挂监听器
实测等了 85 秒以上都没来）。排除过 Service Worker/缓存脏了、全新隔离浏览器
上下文、生产构建 `preview` 服务器（三种环境现象一致）。**已确认线上
`edit.chaxus.com` 完全正常**，所以这不是会影响部署的产品 bug，只是这次没能
在本地环境里做完整的"点工具栏 → 看到图片 → 保存 → 检查 zip"端到端验证，
只能退而求其次用同源 API 直调的方式验证到"补丁本身跑起来没问题"这一层。

如果以后要在本地环境彻底验证这类 v7 图片/保存相关的改动，需要先解决这个
"Loading document 卡死"问题——留给下一轮。

## 后续

如果部署后用户反馈这条修复没有生效，下一步应该优先在生产环境（而不是本地）
用工具栏真实点击走一遍"Insert Image from URL → 保存 → 打开检查"，因为本地
dev/preview 环境目前没法完整验证到这一步。

## 顺带排查：#113 的 base64 修复实际有效，问题在 Qt WebEngine 侧

这次顺带也确认了一个之前遗留的疑点：`document:open-buffer` 报错 -85 的官方修复
（PR #115，`asc_openDocument` 的 `buf` 改传 base64 字符串）在真实 Chrome
里用同样的 embed API 路径**实测正常**，没有复现 -85。曾经怀疑是
`sdk-all-min.js` 里 `AscCommon.Mwg()` 格式检测函数把 base64 字符串当字节数组逐位
比对导致误判——用同源 iframe 访问 + 包一层 spy 的手法直接 patch 了 `Mwg`，
结果证明整个 `asc_openDocument` 打开流程里**这个函数根本没被调用过**，说明之前的
推测（"Mwg 检测失败默认归类成 pdf 从而报错"）大概率不是这条消息实际走的代码路径。
目前判断问题确实在 Qt WebEngine 环境本身（可能是其 postMessage/结构化克隆对长
字符串的处理有别于标准 Chromium），已跟用户对齐先搁置这条 issue，不在本文档
展开进一步分析。
