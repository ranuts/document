# 同类浏览器端静态 SDK 集成方案研究（参考实现拆解）

日期：2026-08-14
分支：feat/v9-web-mode

## 背景

拿到一份同类开源项目的源码（浏览器端 OnlyOffice 集成模板，基于官方
`onlyoffice/documentserver-de:9.4.0` Docker 镜像导出的静态 SDK + Next.js
demo 站，下称「参考实现」），做了一次完整拆解，目的是对照我们 v9 底座
（fernfei OnlyofficePersonal 9.3.0.133 + x2t 9.4 wasm）找可借鉴点。
本文记录其关键机制、与我们方案的差异、以及由此落地的优化项。

## 参考实现的总体架构

一句话：**不 patch SDK 源码，而是在编辑器 iframe 的 window 上替换三样东西
——socket.io 客户端、XMLHttpRequest、fetch——把编辑器对 Document Server
的全部协作消息和 HTTP 请求路由到父页面内存里的一个 mock `EditorServer`，
由 Web Worker 里的 x2t.wasm 完成格式转换。**

与我们的差异：

| 维度        | 我们（v9 现行）                             | 参考实现                                                               |
| ----------- | ------------------------------------------- | ---------------------------------------------------------------------- |
| vendor 来源 | fernfei OnlyofficePersonal 编译产物（AGPL） | 官方 documentserver-de 9.4.0-develop 镜像导出（DE，商业版）            |
| 文档喂入    | blob URL + 公开 DocEditor 配置              | mock 协作握手 `documentOpen` 下发 urlsMap，XHR 代理回放                |
| 保存通道    | `onlyoffice-file-stream` postMessage        | 劫持 `/downloadas/` 分片 POST，内存拼片                                |
| x2t 位置    | 编辑器内部（保存路径）                      | 独立 module Web Worker，主线程零阻塞                                   |
| wasm 压缩   | gzip 9.4MB，客户端 DecompressionStream 解压 | brotli 9.2MB，DecompressionStream("br") + vendored JS 解码器双通道兜底 |
| vendor 体积 | 裁剪后入库                                  | **1.1 GB 未裁剪**（web-apps 695MB、fonts 182MB）                       |
| 并发防护    | editorOperationQueue 操作队列               | 无队列，loadSession 令牌失效丢弃旧初始化                               |
| Connector   | 未启用                                      | mock license `advancedApi: true` 解锁官方 Connector                    |

## 关键机制记录

### 1. 运行时只读切换（不重建编辑器）— 我们 v9 待办的直接答案

- 挂载时**始终**给完整编辑权限（`permissions.edit: true`），
  `onDocumentReady` 之后才施加 `asc_setRestriction(128 /* VIEW */)`；
  恢复编辑用 `asc_removeRestriction(128)` + `asc_setRestriction(0)`。
- 踩过的坑（其代码注释明确记录）：**挂载期直接 edit=false 会导致 xlsx
  打开时样式异常**，所以必须"先编辑权限挂载、ready 后再锁"。
- 切到只读前先 `downloadAs("bin")` 抓一次快照，防止之后导出旧内容。
- SDK 实例不可用时的降级：进入只读走 `denyEditingRights("")`（PPT 例外），
  恢复编辑走 `refreshFile`。
- PPT 需要额外拦截幻灯片结构编辑并用 DisableToolbar 二次锁。

### 2. 批注 / 修订 API 完整路径（feat/agent-collab 直接可用）

不走插件框架、不需要 Developer Edition Connector，直接拿 iframe 内
`Asc.editor` 实例：

- **批注**：主路径 `pluginMethod_AddComment` / `pluginMethod_GetAllComments`
  / `pluginMethod_ChangeComment`；降级路径 `asc_addComment`，需先用 iframe
  内构造器 `Asc.asc_CCommentDataWord` 把 plain object 包装成 SDK 对象。
  事件用 `asc_registerCallback('asc_onAddComment' | ...)`。
- **修订**：`asc_SetGlobalTrackRevisions` 开启 → 混淆符号 `Wq.wih()`
  （9.3+ 的修订管理器索引；v7 是 `Um.yif()`）枚举 → 公开
  `asc_AcceptChanges(raw)` / `asc_RejectChanges(raw)` 逐条处理。
- **两个关键坑**：
  1. 审阅展示要强制 `pluginMethod_SetDisplayModeInReview("markup")`，
     **禁止调 `asc_BeginViewModeInReview`**——SDK 切 original/final 视图
     会批量处理掉全部修订；
  2. 接受/拒绝前必须从索引**重新取最新 raw 对象**，用旧缓存对象会误伤
     其它修订。
- 代价：为 v7/v9 混淆符号做了 400+ 行双轨兼容层，且该部分零 E2E 覆盖
  ——这是它最脆的地方，我们如果借鉴必须配 E2E。

### 3. mock license `advancedApi: true` 解锁官方 Connector

- mock 协作握手的 license 包里带 `advancedApi: true`，编辑器即允许
  `editor.createConnector()`（官方 Automation API：`executeMethod` /
  `callCommand`），Connector 跑在父页面、纯 postMessage，跨域可用。
- 9.4 的 bug：DocsAPI 把 Connector 消息固定发到
  `frameEditorId: "iframeEditor"`，需重写 `connector.sendMessage` 换成
  真实 frameEditorId。
- **许可注意**：`advancedApi` 是 DE 付费能力，参考实现的 vendor 也来自
  DE 镜像，mock license 解锁在合规上是灰色的。我们的 AGPL 社区编译底座
  路线更干净；若未来要 Connector，需评估许可，不能直接抄。

### 4. x2t PDF 导出字体注入

- 转 PDF 前把 TTF 写进 Emscripten FS `/working/fonts/`，params.xml 给
  `m_sFontDir: "/working/fonts/"`，x2t 按文件名匹配。
- 字体清单"一份字节、多个别名文件名"复用：
  - Carlito 四款 → 别名 `Calibri*.ttf`（含粗斜体）；
  - Arial 四款保留本名，**不可映射到 DroidSansFallback，否则西文/数字乱码**；
  - DroidSansFallback → 别名 `宋体.ttf`、`SimSun.ttf`、
    `Microsoft YaHei.ttf`、`微软雅黑.ttf`、`PingFang SC.ttf` 等中文常用名。
- 我们接 pdfeditor（PDF 打开/导出待办）时可直接抄这份 manifest。

### 5. CSV 三级策略（比"一律 SheetJS 转 xlsx"更保真）

1. 多行引号 CSV（物理行数明显多于逻辑行数）才走 ExcelJS/SheetJS 转 xlsx；
2. 其余先 sanitize——把**以数字结尾的单元格**包成 `="value"`，绕过 x2t
   DateReader 的崩溃 bug——再自动嗅探编码（UTF-8/GBK）与分隔符
   （逗号/分号/Tab），写入 params.xml 的 `m_nCsvTxtEncoding` /
   `m_nCsvDelimiter`，直接喂 x2t；
3. x2t 失败再兜底 xlsx 路径。

我们的 `convertCsvToXlsx` 一律 SheetJS，对 GBK 编码和分号/Tab 分隔的
CSV 会乱码或整行进一格。**编码/分隔符嗅探这块已借鉴落地**（见下文
"落地项"）；`="v"` 包装是 x2t 直喂路径专属的 workaround，我们走 SheetJS
不需要。

### 6. 自定义字体的官方 catalog 线格式（docs/fonts.md 重写素材）

- 所谓 catalog 字体文件就是**裸 TTF/OTF 前 32 字节与一个 16 字节固定
  XOR key 异或**，对称可逆，输出无扩展名的 `fonts/{id}`。
- 注册机制：`AllFonts.js` 末尾挂 `window["__custom_font_registry__"] =
{ "{id}": ["FamilyName", "别名1", ...] }`，随后 IIFE 在 SDK 初始化前
  把 registry 同步进 `__fonts_files` / `__fonts_infos`（每个别名一行
  info 指向同一 fileIndex）。
- 坑：Word SDK 初始化后会 `delete __fonts_files`，Cell SDK 后加载需靠
  快照（`__custom_font_catalog_snapshot__`）重建。

### 7. vendor 升级管道（值得学的工程化）

一条脚本从 Docker 镜像导出 SDK（容器内先跑官方
`documentserver-generate-allfonts.sh`），然后以幂等 patch 应用全部接入层
改动：禁 ServiceWorker、注入跨域桥、粘贴 XSS 过滤（剥 `<script>` 与
`on*=` 属性）、字体 registry、演示者视图 bridge。脚本头部注释即升级
checklist。我们的 `public/` 是手工整理产物，未来升级底座时应把
vendor 改动脚本化成同样的"导出 + 自动 patch"管道。

### 8. 其它零散点

- 预压缩资产的鲁棒加载：先魔数嗅探（wasm magic / JS 源码正则），已明文
  直接用；否则原生 DecompressionStream，失败落 vendored JS 解码器。
  Safari 的 `DecompressionStream("br")` 构造成功但运行才报错，必须 catch
  运行期。
- `preload.html` 隐藏 iframe 预热 SDK 静态资源缓存。
- 多实例隔离：vendor socket.io 替换为 shim，按 iframe URL 的
  `frameEditorId` 参数到 `parent.__ONLYOFFICE_SCOPED_IO__[id]` 取工厂。
- 主题/语言切换只能"抓快照 + 重建 DocEditor"（两者被写进 iframe URL）。
- E2E fixture 用零依赖手写 ZIP（自实现 CRC32 + local/central header），
  拒绝引入 zip 依赖；negative fixture（xlsx 伪装 docx、超大 XML）思路
  可借鉴。

## 不学的部分（反面清单）

- 1.1 GB 未裁剪 vendor 全量入库；
- 无操作队列，宿主不 await 连续 open 可能交错（我们的
  editorOperationQueue 更稳）；
- 语言状态模块级全局，多实例互相污染；
- 批注/修订逆向层零 E2E。

## 本次落地项

1. **CSV 编码/分隔符嗅探**（`packages/converter`）：GBK 检测 + 逗号/分号/
   Tab 嗅探，进 SheetJS 前先解码为字符串，配单测。
2. **运行时只读切换**（`lib/onlyoffice-editor.ts`）：验证并接入
   `asc_setRestriction` 路径（细节与结果见当日后续记录/commit）。
