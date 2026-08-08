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

## 第三轮：v9 也有同一个 bug，但根因是完全不同、更深的一条链路（进行中，未修复）

v9 用的是同一套 SDK 家族（更新版本），`AddImageUrl` 同样调用一个 G2 等价物
（`AscCommon.lU`），同样传了悬空 undefined 参数——**但 v9 的 `AddImageUrl`
根本不会走到 `lU` 这条路**，因为 v9 为了伪装成"桌面版编辑器"而注入的
`window.AscDesktopEditor` polyfill（`public-v9/onlyoffice-iframe-patch.js`
第 2 节）会让 SDK 在初始化时把 `AddImageUrl` **整个换成一个桌面模式专用实现**，
这个实现走的是完全不同的代码路径，v7 没有这层。

### 已确认的三层问题（从浅到深）

**第一层**：桌面模式的 `AddImageUrl` 同步调用
`AscDesktopEditor.LocalFileGetImageUrl(url)`，这个方法只认识我们自己
`OpenFilenameDialog`/`DownloadFiles` 生成的 key，对生 URL 直接原样返回——跟
v7 的病根本质一样（"同步 API 处理不了异步 fetch"），但表现完全不同。

**第二层**（第一次修复尝试，已确认无效）：改造 `AddImageUrl`，用已经在用的
`DownloadFiles` 先把 URL 抓下来、注册成本地 key，再交给原始实现处理——实测
`DownloadFiles` 确实正确抓取并解析出 key，但下一步 `AscCommon.Ys.KS(url)`
会**不由分说地在传入值前面拼一个 `/media/`**，如果传的是完整 `blob:` URL
就会拼出 `/media/blob:http://host/xxxx` 这种没有意义的路径。

**第三层**（第二次修复尝试，已确认无效）：绕开 `Ys.KS()`，改成自己拼
`/media/<key>` 路径 + 把真实 blob URL 注册进 `window.parent.__mediaCache`
（这正是本项目已有的"Image URL redirect"补丁——第 6 节——用来把 `<img>.src`
里的 `/media/<file>` 重定向到真实 blob 的机制）。实测 `uHa()`（真正把图片写入
文档模型的方法）确实收到了这个路径、正常返回、不报错——**但文档里还是什么都
没有**，屏幕上不显示，保存的 docx 里也没有 `word/media/`。进一步测试：哪怕
完全跳过 `Ys.KS()`、直接把真实可用的 `blob:` URL 传给 `uHa()`，结果一样。

这说明"传给 uHa 的字符串格式对不对"根本不是关键——**`uHa()` 内部还有一层
条件判断，不满足就什么都不做**，读到的相关代码（压缩名，未完全展开）：

```js
uHa = function (N, ba) {
  // ba 是 undefined 时跳过这整个 if 块
  if (ba) { ... }
  if (this.ep) {
    var za = this;
    this.ep.Tba(N, function () {
      var M = za.BJe(),
        Ba = AscCommon.Oe.Ug(M);
      if (Ba && Ba.Xp() && N && N.length) za.Dzc(N[0], M);
      else /* 还没追到这里，可能是失败兜底或者别的分支 */ ...
    });
  }
};
```

`za.Dzc(N[0], M)` 看起来才是真正"把图片放进文档"的调用，但它被
`Ba && Ba.Xp()` 这个条件挡着——`Ba` 是 `AscCommon.Oe.Ug(za.BJe())` 算出来的,
`BJe()`、`Oe.Ug`、`Xp`、`Dzc` 这四个都还没有查过，是下一步要追的链路。

### 已经排除的假设（不用再测一遍）

- ❌ 不是 URL/路径格式问题——`/media/<key>` 和裸 `blob:` URL 两种格式喂给
  `uHa` 结果完全一样（都不生效）。
- ❌ 不是"直接调 API 绕过了工具栏状态"的测试假象——**同样在真实工具栏点击
  "Insert → Image → Image from URL"、填网址、点确定，结果完全一样**（本地
  v9 环境是可以正常点击工具栏的，不像 v7 那次卡住）。
- ❌ 不是网络请求问题——给 `iwin.fetch`/`XMLHttpRequest.prototype.open` 都
  挂了 spy，`uHa()` 调用前后**没有任何**指向 `/media/...` 的网络请求，说明
  `ep.Tba()` 不是在等一个真实的网络抓取。
- ❌ `AddImageUrl` 补丁本身没被 SDK 覆盖掉——用 `Object.defineProperty` 的
  getter/setter 方式打的补丁，实测在多次重新打开文档后依然生效（这是第二轮
  修复时就解决的一个子问题：普通函数引用赋值会被 SDK 自己的初始化逻辑在每次
  打开文档时重新覆盖回原始实现，getter 能扛住）。

### 下一步该怎么查（给下一个接手的会话）

1. 同样用"同源 iframe 访问 + 包一层 spy 打日志"的手法，依次追
   `this.ep.Tba`、`za.BJe()`、`AscCommon.Oe.Ug`、`Ba.Xp()`、`za.Dzc` 这五个
   函数的输入输出，找到 `Ba.Xp()` 返回 false（或者 `Ba`/`M` 本身就是
   falsy）的真正原因。
2. 一个值得优先测的猜测：`BJe()`（"get current xxx"画风的命名）可能是在拿
   "当前选区/光标位置"之类的编辑器状态，而不是拿"待插入图片"本身——如果这个
   猜测对，那么问题可能出在"文档里没有一个有效的插入光标位置"，需要在调用
   `AddImageUrl` 之前，先确保光标/选区状态是通过真实用户交互建立的（哪怕是
   通过 `api.asc_SetCursorPosition` 之类的方法模拟一次）。这个猜测**目前没
   有验证**，只是读了两次 `uHa` 源码后的直觉，优先级最高，建议下一步先测。
3. 如果第 2 点排除了，再老老实实按第 1 点的顺序一层层剥。
4. 备选策略（如果 1-3 耗时过长）：不再尝试修好 v9 桌面模式的
   `AddImageUrl`，改成让它**完全不检测到 `AscDesktopEditor`**（只对这一个
   方法查找时临时隐藏这个全局变量），逼 SDK 走回它自己原生的非桌面分支
   （`AscCommon.lU`，跟 v7 的 `AscCommon.G2` 是同一种机制），然后复用 v7 那
   一套"拦截服务器请求、浏览器自己 fetch"的成熟解法。这条路线理论上更可控，
   因为 `lU`/`G2` 这条链路已经通过 v7 那次修复摸清楚了实际形状（回调期待
   `{url, path}` 数组）；缺点是还没验证 v9 的 `lU` 实际行为是否跟 v7 的
   `G2` 完全一致（大概率一致，因为压缩名不同但逻辑读起来几乎一样，见第二轮
   排查记录里贴的 `yPc`/`lU` 源码）。

### 复现/测试脚本片段（供下次直接复用，不用重新摸索）

```js
// 1. 等编辑器 API 就绪（New Word 点击后）
const iframe = document.querySelector('iframe');
const api = iframe.contentWindow.Asc.editor;

// 2. 直接调用触发（跳过工具栏，效果跟工具栏一致，已验证）
api.AddImageUrl(['https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Example.jpg/120px-Example.jpg']);

// 3. 判定是否真正插入成功（比 canUndo 更可靠的做法是直接存盘检查 zip，
//    参考本文档"第二轮验证"里 downloadAs + 抓 blob: URL 的写法）
api.asc_getCanUndo(); // 目前恒为 false，说明没有真正插入
```

测试用的外部图片 URL（真实存在、无 CORS 限制，用来排除"是不是 CORS"这个
变量）：`https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Example.jpg/120px-Example.jpg`

## 第四轮：真正根因找到了，v9 现已修复并验证（截至本节写作时最新状态）

延续第三轮"继续深挖，不设时间上限"的指示，用 chrome-devtools MCP 对
`this.ep.Tba` → `za.BJe()` → `AscCommon.Oe.Ug(M)` → `Ba.Xp()` → `za.Dzc()`
这条链路逐层加 spy 实测，找到了两个独立的真根因（都已确认、都已修复、都已
用"保存 → 解压 zip → 校验图片字节签名"的方式验证到底）。

### 根因 A：`uHa` 的插入分支被一个"协作编辑锁"检查挡住了

`uHa(N, ba)`（真正把图片提交进文档模型的方法，压缩名，来自
`public-v9/sdkjs/word/sdk-all-min.js`）完整反混淆后长这样：

```js
g.prototype.uHa = function (N, ba) {
  if (ba) {
    /* ...几个特殊场景的分支，ba 是 undefined 时都不走... */
  }
  if (this.ep) {
    var za = this;
    this.ep.Tba(
      N,
      function () {
        var M = za.BJe(),
          Ba = AscCommon.Oe.Ug(M);
        if (Ba && Ba.Xp() && N && N.length) {
          za.Dzc(N[0], M); // 有"当前选中的图片对象"时走这条（正常场景不会有）
        } else if (ba instanceof AscCommon.AGh) {
          /* ... */
        } else if (this.Zk() && ba && ba.ic() === AscPDF.$e.button) {
          /* PDF 场景 */
        } else if (false === this.ta.Ga.Cf(W)) {
          // ★ 这才是我们要走的分支：没有特殊 ba、没有已选中对象，
          //   "普通地在光标处插入新图片" 的兜底路径。
          M = [];
          for (Ba = 0; Ba < N.length; ++Ba) {
            var O = za.ep.NG(N[Ba], 1);
            O && M.push(O);
          }
          M.length && (za.ta.Ga.Dd(AscDFH.QMg, void 0, void 0, M), za.ta.Ga.VX(M), za.ta.Ga.sd());
        }
      },
      [],
    );
  }
};
```

实测：`M = za.BJe()` 恒为 `null`（`BJe` 源码是
`function(){var N=this.ta.Ga;return N?(N=N.uN())&&!N.Hba()?N.fc():null:null}`——
`Ga.uN()` 在没有"当前选中对象"时本来就该返回 null，这是正常的，不是 bug）。
`AscCommon.Oe.Ug(null)` 于是也返回 falsy，第一个分支 `Ba&&Ba.Xp()` 不成立——
这也都符合预期，真正该走的是最后那个 `else if (false === this.ta.Ga.Cf(W))`
兜底分支。**问题出在 `Cf(W)` 本身**：实测 `W` 求值为 `1`，`Cf(1)` 恒返回
`true`（该分支需要它返回 `false` 才会执行）。

继续往下挖 `Cf`（LogicDocument 原型上的方法，反混淆后）：

```js
// Cf(a=类型, b, d, e, f, h)
if (this.Bd.vb && this.Bd.Rh) return !1;
if (!this.ugb(e, a, b, !0, h)) return f && f(!0), !0;   // ★ ugb 返回 falsy 时 Cf 直接判定"受限"
...
```

`ugb`（同样是 LogicDocument 原型方法）反混淆后：

```js
// ugb(a, b, d, e, f)
if (this.Uc.Tra() || this.zb.gDb()) return !1;
d = xK(this, b, d, f); // xK 是一个未暴露到全局的闭包内自由函数，没法从外部直接调
return d || this.gAa() || a;
```

实测两层都失败：`AscCommon.Uc.Tra()`（"是否有一个未配对的 start/end-action，
即 `Uc.l5d` 计数器非 0"，通过 `asc_onStartAction`/`asc_onEndAction` 也就是
`Zx`/`Xo` 方法对维护）一开始确实是 `true`（`l5d=1`，某次操作的"开始"调用了
`Uc.PZ(!0)` 但配对的"结束" `Uc.PZ(!1)` 没有被调用到，具体是哪次操作没有再往下
查，因为下一步发现**就算强制把 `l5d` 清零，`ugb` 依然返回 falsy**——`xK(...)`
和 `this.gAa()` 两者也都是 falsy。`xK` 是彻底的黑盒（自由函数，反混淆后在文件
里搜不到定义体，可能在另一个 IIFE 闭包作用域里，标准 grep 找不到），`gAa`
大概率是"当前是否持有协作编辑锁"一类的状态查询。

**结论（不再深挖 `xK`/`gAa` 内部实现，工程上没必要）**：`Cf(1)` 本质上是一个
"我是否持有这次插入操作所需的协作编辑锁"检查——这在有真实 Document Server、
真实多人协作的场景下才有意义；我们的 v9 Web Mode 压根没有真服务器，这个锁永远
拿不到，检查永远失败。**修复思路和 v7 的 #72 修复同一个精神：跳过一个"为多人
协作服务器场景设计、单机离线场景下天然满足不了也不需要满足"的检查**，而不是
真的去实现一套假的锁协议。

**已实测验证**（monkeypatch `Cf`，`type===1` 时直接返回 `false`，其余类型原样
委托给原实现——只影响图片/媒体插入这一种受限类型，不碰 track changes、
content-control 等其它用途的 `Cf` 调用）：用真实工具栏"插入 → 图片 → 来自 URL
地址的图片"走一遍，图片**从完全不出现，变成正常显示在文档里**（截图确认）。

已落地到 `public-v9/onlyoffice-iframe-patch.js`（第 3 节新增
`patchImageInsertRestrictionCheck`，在 `wrapped()` 调用 `uHa` 之前对
`self.ta.Ga` 所在的原型链路懒patch，用 `hasOwnProperty` 找到真正拥有 `Cf` 的
那一层原型再替换，保证只 patch 一次）。

### 根因 B：图片显示出来了，但保存的 docx 里是一段 HTML，不是真图片字节

根因 A 修完后，**画面上图片正常显示**，但用"保存 → 解压检查 `word/media/`"
这个更可靠的验证方式一测，发现保存出来的 `word/media/image1.jpg` 内容签名是
`<!doctype ht`（HTML），不是 JPEG 的 `\xff\xd8\xff\xdb`。

排查过程：先怀疑是本项目自己的 x2t 转换管线（`packages/converter` 的
`writeMediaFiles`，见"第一轮"）没吃到我们注册进 `window.parent.__mediaCache`
的 blob，加了一条桥接（`window.__registerSaveMedia`，把 blob 也写进
`lib/onlyoffice-editor.ts` 里 `handleWriteFile` 用的那个模块级 `media` 映射）
——**结果保存出来的还是 HTML，说明这条路径压根没生效**。

用 XHR/fetch spy 直接实测 `window.editor.downloadAs()`/工具栏"保存"按钮触发的
真实网络请求，发现：**v9 独立 app 场景下（非 embed 模式），"保存"走的根本不是
本项目的 x2t 转换管线**，而是 OnlyOffice SDK **自己内部的导出器**（在 iframe
里跑，大概率是 WASM 内部逻辑）——这个导出器在打包图片进 zip 时，会对每张图片
发起一次**真实的 `XMLHttpRequest` GET 请求**到 `/media/<file>`，指望这是一个
服务器上真实存在的静态文件。`convertBinToDocumentFn`/`media` 映射桥接只对
"embed 模式下父页面发起的 `document:save`"这条路径有效，跟这里完全是两套
独立的保存路径。

由于 `/media/asc-dl-...` 这种路径在开发/生产环境都不是真实存在的文件
（它只活在我们自己维护的 `window.__mediaCache` 里，只被 `<img src>` 的
setter 拦截读取过，见 patch 第 6 节），这个 XHR 落到 Vite dev server /
生产环境的 SPA fallback，拿到的是 `index.html`，尺寸固定（约 20KB），正好
解释了为什么两次保存拿到的"图片"字节完全一样。

**修复**：在 patch 第 6 节旁边新增第 6b 节，跟已有的 `<img src>` setter 重定向
同一个思路，改成拦截 `XMLHttpRequest.prototype.open`——请求路径命中
`/media/<file>` 且 `__mediaCache` 里有对应 blob 时，直接把 `open()` 的 URL
参数改写成那个 `blob:` URL（浏览器原生 XHR 可以直接读 `blob:` URL 的内容，
不需要手工伪造 response）。

**已实测验证到底**（这是本次调查里第一次真正做到"保存 → 解压 → 校验字节"
全绿）：

```
word/media/image1.jpg 3949 bytes, sig: b'\xff\xd8\xff\xdb\x00C\x00\x04\x03\x03\x04\x03'
```

`\xff\xd8\xff\xdb` 是标准 JPEG 文件头（SOI + 量化表标记），3949 字节跟
Wikipedia 那张 120px 缩略图的真实大小对得上。

### 现状小结

v9 版本 "Insert → Image → From URL" 的完整链路（工具栏点击 → 弹窗填 URL →
下载 → 显示在文档里 → 保存 → docx 里是真图片字节）**已经端到端跑通并验证**，
用的是真实工具栏点击（不是绕开 UI 直接调 API）加上"保存后解压校验"这个本文档
反复强调的、比 `canUndo`/截图更可靠的验证方式（`canUndo()` 在这个场景下全程
返回 `false`，是个误导性指标，不要依赖它判断插入是否成功）。

代码改动：

- `public-v9/onlyoffice-iframe-patch.js`：新增 `patchImageInsertRestrictionCheck`
  （第 3 节内），新增第 6b 节 XHR 重定向。
- `lib/onlyoffice-editor.ts`：`runWebModeOnAppReady` 里新增
  `window.__registerSaveMedia` 桥接（为 embed/agent 驱动的保存路径准备；
  独立 app 的"保存"按钮本身不需要它，走的是根因 B 修的 XHR 重定向路径，但
  两条保存路径都应该拿到正确的媒体数据，留着无害）。

尚未做但不阻塞部署的收尾项：

- 没有为这条链路写自动化单测——原因和 `onlyoffice-editor.ts` 里其它
  SDK-事件驱动代码一样（见 CLAUDE.md"为什么 onlyoffice-editor.ts 覆盖率低"）:
  这里 patch 的是压缩后 SDK 内部方法（`Cf`/`ugb`/`uHa`/`BJe`），jsdom 环境
  根本没有这些对象，mock 出来的测试只会测试 mock 本身，没有实际价值。
  已有的验证方式（真实浏览器 + chrome-devtools MCP + 保存解压校验）比单测
  更可信，本次改动前后都是这样验证的。
- v7 是否也有同款"XHR 兜底路径拿不到真图片字节"的问题没有专门验证过——v7
  没有 `AscDesktopEditor` polyfill，不会触发桌面模式的 `AddImageUrl`，图片
  URL 解析走的是完全不同的 `AscCommon.G2` 路径（见"第二轮"），大概率不受
  影响，但如果之后 v7 那边也报"在线图片保存后打不开"，可以从这里的根因 B
  开始查起。

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
