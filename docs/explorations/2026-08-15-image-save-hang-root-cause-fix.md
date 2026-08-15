# 图片保存卡死：根因定位与修复（serverless image pipeline）

日期：2026-08-15
前情：[2026-08-15-image-save-hang-and-verification-gap.md](2026-08-15-image-save-hang-and-verification-gap.md)
（现象确认：文档含图片时保存令主线程永久阻塞，线上 4 次复现）

## 根因链（每一环都有实证）

1. **SDK 期望服务器完成图片登记**：外链/粘贴图片本应经
   `AscCommon.sendImgUrls` 发 `c:"imgurls"` 命令给 Document Server，
   服务器下载图片、返回 `media/imageN.png` 本地名，SDK 注册进
   `g_oDocumentUrls`。我们无服务器，这条命令发进虚空，注册表恒空
   （实测 `g_oDocumentUrls.urls = {}`）。
2. **DOCY 写入器落进裸 URL**：序列化时写入器调
   `g_oDocumentUrls.getImageLocal(RasterImageId)`——未注册 → 返回 null →
   **把原始外部 URL 原样写进 DOCY**（对捕获的 DOCY 二进制做 utf16
   字符串扫描，找到 `http://127.0.0.1:4173/img/64.png`）。另外
   `getImageLocal` 对 data:URL 有硬性 null 守卫，data 形态一样落裸串。
3. **x2t.wasm 对外部 URL 图片路径死循环**：离线复现（见下）确认同一个
   DOCY——裸 URL 路径永不返回；把该字符串**等长替换**为
   `media/xxx.png` 后 **100ms 转换成功**。媒体文件缺失时也只是优雅
   降级（100ms 完成、图片缺失），不会卡死。
4. 空的 `medias`（保存胶水层传 `medias: []`）是并发的第二处缺口：
   即便 DOCY 正确，字节也进不了 x2t 的 FS。

## 离线复现方法（本次最值钱的调试资产）

浏览器内迭代一轮 3 分钟且主线程死锁难观测，改为：

1. **捕获现场**：E2E 里 wrap `AscCommon.x2t.convertFromBin`，拿到
   DOCY 二进制与 medias 后返回永不 resolve 的 Promise（故意弃养保存），
   页面保持存活，payload base64 导出到文件。
2. **Node 复现台**（scratchpad `x2t-node-repro.mjs`）：gunzip
   `x2t.wasm.gz` → 以同一份 glue（拷为 .cjs）+ 同一 params.xml 跑
   `main1`。坑：glue 里 `Module` 不是 globalThis.Module（模块作用域
   遮蔽），需在拷贝里改一行采用注入对象。
3. **等长字符串替换实验**：DOCY 字符串带长度前缀，替换必须等长；
   借此做"只改图片路径、其余全同"的对照，10 秒一轮迭代出结论。

## 修复（lib/onlyoffice-editor.ts，prepareEditorIframe 第 4 号守卫）

三个协同 patch，全部页面侧运行时注入，vendor 零改动：

- **4a 自愈 getImageLocal**：查不到且 id 是外部形态
  （http/https/blob/data）→ 当场 `addImageUrl` 注册 → 返回新本地名。
  写入器调它的时机恰好拿到模型真实 RasterImageId，因此覆盖一切写入
  路径（word/cell/slide 共用），不需要遍历文档模型。
- **4b 无服务器 sendImgUrls**：按服务器响应契约（`{url, path}`）本地
  实现，粘贴等主动调它的流程直接走通。
- **4c convertFromBin medias 兜底**：胶水层传空 medias 时从
  `g_oDocumentUrls` 注册表重建，x2t_helper 的 `writeMediaFiles` 负责
  把 data:URL 解码 / blob、http fetch 成字节写入 WASM FS。

首版曾用"保存前扫 `ImageLoader.map_image_index` 注册"的方案，被实测
推翻：ImageLoader 的 key 是展示用 data:URL，而模型里的 RasterImageId
是原始 http URL——注册错了对象，DOCY 依旧落裸串。教训：**注册点必须
选在拿得到"将被写入的那个 id"的位置**，即 getImageLocal 本身。

## 验证

- 原卡死场景（打开 docx → URL 插图 → 保存）：**129ms 完成**，产物含
  `word/media/image1.png`（字节完整）。
- 新增 E2E 永久守护：embed-regression "saves a docx after inserting an
  image by URL"（校验产物 zip 的 media 条目与体积）。
- 全套：oxlint + tsc、单测 298 全绿、E2E 18 全绿。

## 遗留与后续

- **Save 按钮灰色之谜**（用户报告）已解释一半：插图后
  `isDocumentModified` 为 false，按钮语义为"无未保存修改"。修复后
  插入链路走通，按钮行为待部署后顺手复核；不阻塞本修复。
- 粘贴带链接图片（#72 原始场景）与本地文件插图共享同一序列化管线，
  理论上同时修复；粘贴路径无法自动化，部署后人工确认再更新 #72。
- x2t.wasm"外部 URL 路径 → 死循环"本身是引擎级问题，我们只能在喂入
  侧保证不出现该形态；换底座时此守卫必须保留并重验。
