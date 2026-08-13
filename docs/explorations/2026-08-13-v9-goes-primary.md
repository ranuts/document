# v9 转正：public/ 即 v9、v7 全面移除；ranui/ranuts 升级到最新；全量测试通过

日期：2026-08-13
分支：feat/v9-web-mode
状态：**完成**。v9 成为唯一路径（不再有构建变体），v7 引擎资源与全部 v7 代码
删除；ranui 0.5.0-alpha.2 / ranuts 0.4.0-alpha.4 升级完成且 workspace 版本
归一；289 单测、覆盖率 48%/53%/49%、lint、format、合并后的 14 个 E2E、
生产构建、浏览器全流程（冷 profile 落地页 → New Excel → 编辑器）全部通过。

## 一、资源层切换

- `public/` 删除 v7 引擎（sdkjs/web-apps/wasm/fonts/font-map.json/
  onlyoffice-v7-iframe-patch.js），迁入 v9 vendor（sdkjs / web-apps /
  索引字体 / plugins.json / themes.json / document_editor_service_worker.js），
  `public-v9/` 整目录删除。现在 `public/` 626MB / 2681 文件 / 0 超限。
- **sw.js 合并**：保留 v7 站点版为基底（卫星页 DEPLOY_COUPLED 全集），
  移除 v7 patch 条目，`MAX_RUNTIME_ITEMS` 600→2000，加入拼写检查引擎放行
  （冷启动挂起防护）。`_headers` 移除 v7 patch 条目；**v9 时代的 noindex
  没有带过来**（现在就是生产站点）。
- embed-demo.html 保留 public/ 的英文版（共用页面英文约定）。

## 二、代码层删除（v7 退役）

- `OO_VARIANT` 及全部分支删除；`lib/onlyoffice-editor.ts` 987 → 约 700 行：
  v7 的 DocEditor 配置分支、`handleSaveDocument`（onSave）、`handleWriteFile`、
  `handleDownloadAs`、`toBase64`、converter 回调注入（`setConverterCallbacks`）
  全部移除。
- `binData` 语义简化：`ArrayBuffer | string` → `ArrayBuffer | undefined`
  （undefined = 新建文档，SDK 自建空白），**`lib/empty_bin.ts`（内嵌 base64
  空模板大文件）整个删除**。
- `lib/converter.ts` 重写：不再加载页面级 x2t（loadScript/initX2T 及
  document.ts/events.ts 的调用点全删），只保留 SheetJS 用途的 CSV 打开转换。
- 顺手修复：就绪门上限从 60s 调到 45s——与请求自身 60s 超时相同会在同 tick
  竞争，导出可能永远不发（单测暴露的真实边界）。
- 单测适配 v9 语义（v7 形状用例删除；`requestSaveDocument` 用真实 iframe 模拟
  编辑器帧断言数字格式常量；`createEditorInstance` 断言 blob URL/key/
  documentType/spellcheck 配置），`iframe-patch.test.ts`（v7 专属）删除，
  `sw-routing.test.ts` 同步新的 DEPLOY_COUPLED 与 spell 放行。289 个用例。

## 三、构建/CI 去双轨化

- vite.config.ts 移除 mode 切换；bin/build.sh 移除 VARIANT；package.json 删
  `dev:v9/build:v9/preview:v9/test:e2e:v9`；`playwright.v9.config.ts` 删除，
  `embed-regression.spec.ts` 并入 `test/e2e/`（describe 级 120s 超时）；CI 回到
  单一 `test:e2e` 步骤；.gitignore 清理 dist-v9 条目。
- `.prettierignore`：v7 时代曾把 vendor 文件也格式化过；现在按目录整体忽略
  `public/sdkjs|web-apps|fonts` 等 vendor 产物。

## 四、ranui / ranuts 升级

- 根依赖（用户已升）：ranui `0.5.0-alpha.2`、ranuts `0.4.0-alpha.4`。
- **workspace 包版本归一**（shared/converter/chat-ui/agent-core 原来还在
  0.4.x）——否则重蹈"双份 ranui、自定义元素先到先得、仅 build 复现"的已知坑；
  `pnpm why ranui` 确认只剩一个版本。
- 适配一个 breaking change：ranuts 移除 `getQuery` → `getAllQueryString`
  （packages/shared/src/i18n.ts）。
- `pnpm run build` 用新版 ranui 重新同步并指纹化 ran-tokens
  （ran-tokens.41db9165.css，23 个页面重写），落地页视觉验证无漂移。

### 可沉淀到 ranuts 的候选（建议，未实施——需改 chaxus/ran 仓库）

1. `saveFileToDisk(data, fileName, mimeType?)`（现在在 @ranuts/converter）：
   File System Access API + anchor 兜底，纯 BOM 工具，适合 ranuts/utils。
2. "fetch 可能被 gzip 的资源"helper：fetch + 魔数嗅探 + DecompressionStream
   （converter 的 prepareWasmBinary 与 x2t_helper 里各有一份同型实现）。
3. `getDocumentMimeType` 文档 MIME 表：ranuts 现有 getMime 偏图片，可合并成
   完整的 MIME 模块。
4. `isZipContainer`：ranuts 已有 readZipEntries/zipHasEntry 等 zip 工具，
   这个嗅探函数适合并入同一模块。
5. 反向采用：ranuts 新版已有 `PostMessageBridge`/`MessageCodec`/`withTimeout`/
   `deferred`/`readFileAsArrayBuffer` 等——embed-api 的 id/pending/timeout
   手写模式未来可换成 ranuts bridge，进一步删代码。

## 五、全量验证

- 单测 289 通过；覆盖率 48.7%/53.1%/49.6%（阈值 34/25/35）。
- lint:ts、format:check 通过；`pnpm run build` 成功（dist 无超限文件）。
- E2E 合并后 14 用例全过（冒烟 4 + embed API 6 + 真实编辑器回归 4，11.7s）。
- 浏览器（全新隔离 profile，等价首次访问）：落地页（新 token 渲染正常）→
  "New Excel" → v9 编辑器正常打开，纯净 UI，控制台零报错；zh-CN 落地页、
  卫星页、embed-demo 均 200。

## 六、Docker 验证（用户追问"对 docker 有影响吗"）

- **镜像方案不受 v9 影响**：多阶段构建（node 内跑 `pnpm run build`）+
  `joseluisq/static-web-server` 纯静态托管 dist，没有 nginx 配置、没有任何
  v7 专属条目。x2t.wasm.gz 靠魔数嗅探兼容"服务器发原始 gzip 字节"与
  "Content-Encoding 已解压"两种情况，静态服务器怎么发都对；无扩展名的索引
  字体走 XHR arraybuffer，MIME 无关。
- **发现并修复一个与 v9 无关的既有问题**：Dockerfile 在
  `pnpm install --frozen-lockfile` 前只拷根 package.json——monorepo 化之后
  workspace 包的 manifest 缺失，安装必然失败；CI 只跑 `docker compose config`
  和 hadolint、从不真正 build，所以一直没暴露。修复：安装前补拷四个
  `packages/*/package.json`（`--ignore-scripts` 保住依赖层缓存），拷完源码后
  `pnpm -r run prepare` 再构建。`.dockerignore` 顺带排除测试产物与 docs。
- **实测**：`docker build` 成功；容器起在 8091，根页/卫星页/x2t.wasm.gz/
  索引字体全部 200；**在容器服务的站点上完整走通编辑器往返**（全新 profile：
  多 sheet open-buffer → 保存 xlsx 两 sheet 完整 → 导出 PDF `%PDF-` 魔数
  30KB）。hadolint 零告警、compose 校验通过。
- **代价**：镜像 662MB（v7 时代约 250MB）——v9 vendor 体积所致，与 CF Pages
  部署同源；后续可裁剪 `ie/` legacy bundle、mobile 变体等再瘦身。

## 文档同步

- README / readme.zh：字体章节改写（旧文案称"不含专有字体"，与新 vendor 的
  索引字体库相反）；docs/fonts.md 标记待重写。
- CLAUDE.md：开发命令、E2E 说明、CI 流程、v9 章节全部改为单轨现状。
