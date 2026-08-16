# Changelog — v9 回归战役（测试全覆盖）第 1～2 天

日期：2026-08-15 · 分支：`main`（v9 唯一路径）· 参与：两个并行 Claude 会话
（本文作者负责测试体系 / 语料 / CI / 转换器；另一会话负责编辑器守卫与 API 枚举）

给新开会话看的一页纸：**发生了什么、现状数字、东西在哪、怎么跑、下一步。**
方法论见 [策略文档](../superpowers/plans/2026-08-15-v9-test-coverage-strategy.md)，
覆盖台账见 [docs/test-matrix.md](../test-matrix.md)，逐步细节见
`docs/explorations/2026-08-15-*.md`。

## 一句话结论

**v9 在真实文档上是稳的**：私有语料 31/31（docx/doc/xlsx/pptx/csv，含用户报
致命弹窗的 35 页 EMP deck）打开 + 键盘编辑 + 保存往返 + L0 零发现；公开语料
（Apache POI test-data）探针 97/100；WebKit 全套 E2E 全绿，Firefox 45/46。
第 1 天"25/25 全灭 / 中文文件名 P0"是**跑道自身的 bug**，已作废。用户报的
PPT 致命弹窗在当前构建**未复现**，证据指向其浏览器 SW 缓存的旧构建。

## 时间线（当天）

1. 采纳测试策略（行为矩阵 / 三层语料 / L0–L4 判据 / 类用例 / 两项指标）。
2. 落地 **L0 全局 fixture**（`test/e2e/lib/l0.ts`）——所有 E2E 自动把
   `asc_onError`、厂商致命弹窗、iframe 内未处理拒绝、pageerror、非白名单
   console.error 判失败。第一件事就抓出"打开失败永久转圈"。
3. 复现"中文文件名 P0"失败 → 追到 x2t 收到的是 20 KB 的 `<!doctype`：
   corpus 用 `page.route` 投递字节，被页面 Service Worker 击穿，vite preview
   兜底返回 index.html。跑道随后又踩两坑（未等 `isLoadFullApi`、跨 realm
   `instanceof ArrayBuffer`），三坑都把"成功"伪装成"超时"。全部修掉。
4. 修真缺陷：打开失败可见 + 保存快速拒绝（`installOpenFailureGuard`）、
   embed `document:save` 默认格式、HTML 伪装 .xls、PPTX 主题库 404、
   Firefox SW `update()` 未处理拒绝；另一会话修 Save 按钮常灰（守卫 5）、
   长操作计数器泄漏、默认经典主题。
5. 铺覆盖：文件名 × 格式类用例、幂等再保存、docx/pptx PDF 与只读、xlsx 特性
   （合并/公式/2 万行）、GBK CSV、SW 热、主站真实路径、跨浏览器、
   无基线视觉往返、vendor 契约哨兵、corpus L2 内容比对与 L4 耗时。
6. 夜间 CI：`.github/workflows/nightly-corpus.yml`（POI 公开语料 + WebKit/Firefox）。

## 现状数字（2026-08-15 收工）

| 项                                | 数字                                                        |
| --------------------------------- | ----------------------------------------------------------- |
| 单测                              | 311 通过                                                    |
| PR 档 E2E（Chromium）             | 49 通过 / 3 跳过（API 枚举 opt-in）/ 0 失败，约 2.3 分钟    |
| 私有语料（`~/Documents`，本地跑） | 31/31，L0/L1/L2 全绿                                        |
| POI 公开语料探针                  | 97/100（3 个 Word 6/95 老格式 .doc 打开失败并正确浮出 -82） |
| WebKit / Firefox                  | 全绿 / 45 通过 + 1 负载 flaky                               |
| 视觉往返差异                      | docx 0.006%、pptx 0、xlsx 0                                 |

## 缺陷清单（合并两个会话）

| #   | 缺陷                                                                             | 状态                                                          |
| --- | -------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 1   | 非 ASCII 文件名 → -82 永久转圈                                                   | **作废**（跑道 SW 击穿 page.route）                           |
| 2   | 特定 CSV 被 SheetJS 误判 HTML                                                    | **作废**（同上，误吃了 index.html）                           |
| 3   | 打开失败遮罩不终止、无可见错误、保存等满 60s                                     | 已修 `installOpenFailureGuard` + `open-failure.spec`          |
| 4   | 用户报 PPT 编辑致命弹窗                                                          | 未复现（EMP deck 全通）；疑旧构建 SW 缓存，等用户硬刷新复测   |
| 5   | HTML 伪装 .xls/.xlsx → x2t abort（缺 CHtmlFile2）                                | 已修：`isHtmlDocument` + SheetJS 转 XLSX + `html-as-xls.spec` |
| 6   | Save 按钮/Ctrl+S 常灰（coauthoring autosave 假提交）                             | 已修（另一会话，守卫 5）                                      |
| 7   | embed 裸 `document:save` 默认 XLSX                                               | 已修：默认当前文档格式，xls/doc/ppt→OOXML                     |
| 8   | PPTX 主题库为空（vendor 缺 themes.js/theme.bin）                                 | 404 已消除（空目录声明）；主题库生成待做（P2）                |
| 9   | 长操作计数器泄漏（图表编辑器入口失败后不能保存）                                 | 已修（另一会话）+ E2E                                         |
| 10  | Firefox：SW `update()` 未处理拒绝                                                | 已修                                                          |
| 11  | Firefox：2 万行表往返偶发 -25 EditingError（仅负载下）                           | 待复现                                                        |
| 12  | `asc_stopSaving()` 永久禁保存；cell 某方法组合致渲染进程崩溃；slide 某方法杀保存 | API 枚举中（另一会话，台账 F 表）                             |

## 东西在哪

| 用途                                                  | 位置                                                                                                                                                                                                            |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L0 fixture（所有 spec 从这里 import `test`/`expect`） | `test/e2e/lib/l0.ts`                                                                                                                                                                                            |
| 页外 OOXML 生成器 / zip 解包 / 文本提取               | `test/e2e/lib/ooxml.ts`（docx、pptx；xlsx 用页内 SheetJS）                                                                                                                                                      |
| 真实语料矩阵                                          | `test/e2e/corpus.spec.ts`，报告合并 `bin/corpus-report.mjs`                                                                                                                                                     |
| 类用例                                                | `filename-matrix` / `resave-idempotence` / `format-parity` / `xlsx-features` / `csv-encoding` / `html-as-xls` / `embed-save-default` / `open-failure` / `sw-warm` / `main-site` / `visual-roundtrip` `.spec.ts` |
| vendor 契约哨兵                                       | `test/unit/vendor-contract.test.ts`                                                                                                                                                                             |
| 跨浏览器配置                                          | `playwright.browsers.config.ts`                                                                                                                                                                                 |
| 夜间 CI                                               | `.github/workflows/nightly-corpus.yml`（两个 job：corpus、browsers）                                                                                                                                            |
| 覆盖台账 / 策略 / 逐日记录                            | `docs/test-matrix.md` / `docs/superpowers/plans/2026-08-15-v9-test-coverage-strategy.md` / `docs/explorations/2026-08-15-corpus-*.md`                                                                           |

## 怎么跑

```bash
pnpm run test:e2e                                   # PR 档（Chromium）
E2E_PORT=4174 pnpm run test:e2e                     # 多会话同机时各占端口
CORPUS_DIR=~/Documents pnpm run test:e2e:corpus     # 私有语料（不入库）
node bin/corpus-report.mjs test-results             # 合并报告 + markdown 摘要
E2E_PORT=4175 pnpm exec playwright test -c playwright.browsers.config.ts   # WebKit + Firefox
API_SWEEP=1 pnpm exec playwright test test/e2e/api-surface.spec.ts        # asc_* 枚举（另一会话）
gh workflow run nightly-corpus.yml -f limit=300     # 手动触发夜间
```

## 跑道教训（写进 CLAUDE.md，别再踩）

1. 给被 SW 控制的页面喂字节别用 `page.route`；走 `setInputFiles` + `document:open-file` 或 `page.evaluate` 传入。
2. 直接调 `asc_DownloadAs` 前同时等 `isDocumentLoadComplete && isLoadFullApi`。
3. 别在 `page.evaluate` 里给别的 frame 挂 `instanceof ArrayBuffer` 的监听；在本窗口监听、`Object.prototype.toString` 判型。
4. Firefox 复用 iframe Window：init script 里的轮询不要在 `pagehide` 清理。
5. 任何"全灭"先怀疑跑道：拿一份已知能开的文件做对照。

## 下一步

- 真实语料 L3 视觉往返（`CORPUS_VISUAL`，opt-in）；"SW 缓存旧构建→升级"路径用例；
  冻结窗格/图表生成器；POI 语料逐步抬到全量；Firefox -25 复现。
- 另一会话：API 枚举二分（cell 崩溃、slide 保存杀手）→ 台账 D/F 表 + 禁区列表。
- 用户侧：硬刷新 / 注销 SW 后复测 PPT 致命弹窗；仍复现则给文件 + 步骤。

## 追记（当天晚间）

- **L3 进语料矩阵**：`CORPUS_VISUAL=1` 在保存后把原始与产物各以只读重开、
  `#editor_sdk` 截图逐像素比对（`test/e2e/lib/visual.ts` 共用给
  `visual-roundtrip.spec`）；私有 4 文件（xlsx/pptx/docx/doc）差异 0.03～0.32%。
  夜间 workflow 默认开启（可 dispatch 关闭）。
- **corpus 报告改 JSONL 逐条追加**（`test-results/corpus-rows-<worker>.jsonl`）：
  afterAll 落盘在 worker 重启时会丢行；`bin/corpus-report.mjs [dir]` 合并。
- **多会话隔离**：`E2E_PORT` 非默认时 Playwright 同时使用 `dist-e2e-<port>/`
  与 `test-results-<port>/`——两会话共用 dist/test-results 会互相清空
  （这就是本晚"页面 60s 起不来 / 报告少行"的来源，非产品缺陷）。
- 跨浏览器与视觉部分见上文"现状数字"。
- **SW 升级策略（用户 P0 的最可能机制）**：原 sw.js `install` 即 `skipWaiting()`，
  `activate` 立刻删旧缓存并 claim；页面开着文档时不重载（保护未保存编辑），
  但此后懒加载的 sdk-all.js / x2t.wasm.gz / 字体 / 拼写引擎全来自**新构建**，
  与已加载的旧构建混装——今天连续部署几十次，"编辑标题时弹致命框"与此吻合。
  改为：新 SW 等待；页面无文档时发 `SKIP_WAITING` → controllerchange → 重载一次；
  有文档时保持旧 SW 直到下次访问（`lib/sw-update.ts` + `test/unit/sw-update.test.ts`
  含 sw.js 契约哨兵）。CHANGELOG 已记为用户可见修复。
- 新增 `buildXlsx`（手拼 OOXML，含冻结窗格 / 自动筛选）与 `xlsx-panes.spec`：
  文件自带冻结+筛选往返保留；`asc_freezePane` API 切换干净且保存保留
  （8-09 记录的 UI 冻结报错在 API 路径未复现）。
- **API 交互面枚举落地（`api-surface.spec.ts`，`API_SWEEP=1` 夜间档）**：
  三编辑器全部零参 `asc_*`（word 218 / cell 218 / slide 161）逐个调用，
  每次查 L0、保存开关与状态向量（`isLongAction` / `isOpenedFrameEditor` /
  restriction…），异常路径也比对漂移；`SWEEP_ONLY` 二分、`SWEEP_PROBE_EVERY`
  真保存探针、`SWEEP-ORDER` 流式输出供崩溃取证。首轮结果：三格式全绿 45s
  （修复前 xlsx 15 分钟死于渲染进程崩溃）。抓出并修掉两个**UI 可达**缺陷：
  - **守卫 6（长操作计数器泄漏）**：`asc_editChartInFrameEditor` /
    `asc_editOleTableInFrameEditor` / `asc_runAutostartMacroses` 在
    `sync_StartAction(BlockInteraction)` 后抛错或返回，`isLongAction()`
    永真 → 之后每次 `asc_DownloadAs` 静默丢弃、**永远不能保存且无提示**。
    图表右键/双击可达。二分至单方法（pptx）后包裹入口在失败路径
    `sync_EndAction` 复位。
  - **守卫 7（全表序列设置）**：cell 上 `asc_EditSelectAll` →
    `asc_GetSeriesSettings`（插入图表对话框数据源）对 1048576×16384 建序列，
    主线程卡死至 "Array buffer allocation failed"，渲染进程崩。Ctrl+A →
    插入图表可达。调用期把选区钳到已用区域（10ms），事后恢复选区。
  - 禁区表 F 补齐：`asc_stopSaving` 一次性开关（配对 `asc_continueSaving`）；
    `asc_SetSilentMode` 洗清（空函数）。
  - 动作库 `test/e2e/actions/{editor,fixtures}.ts`：ready 门控 / 聚焦 /
    可信输入 / 保存捕获（同 realm 监听）/ 健康快照 / xlsx-pptx 最小构造。
  - 跑道坑（新增）：`page.evaluate` 内 `new Function`/`eval` 重建的定位器
    捕获的是 utility 世界的 `window`——页面侧逻辑必须**内联**在 evaluate 里。
- **corpus L2 扩到 docx/pptx**：Node 侧解 zip 取 `<w:t>/<a:t>` 文本，输入 vs
  产物 20 字分片覆盖率 ≥ 98% 判通过；忽略 `hidden="1"` 形状（模板站隐形指纹，
  OnlyOffice 保存即丢，用户不可见）与字段块（页码字段占位 `‹#›` 保存后写成
  缓存值 `11`，结构保留）。**corpus 改为两次保存**：打开后先存（L1/L2/L3 都
  基于它），再键盘编辑后存第二次（仅 L1）——此前 L2 差额其实是跑道自己的双击
  选词被 "QA" 替换造成的。
- **私有语料全量：31/31，L1 + L2 + L3 全绿**，视觉差异全部 0.000%（pptx save
  p95 1.8s，xlsx save p95 5.7s）。
- 另一会话落地守卫 6（长操作计数器泄漏 → 保存被静默丢弃）与守卫 7（cell
  `asc_EditSelectAll` 后 `asc_GetSeriesSettings` 全表建序列 → OOM 崩渲染进程），
  三格式 API 枚举 45s 全绿（原 15 分钟崩死）；详见其在本文件的追记与台账 D/F。
- **线上冒烟**（此前从未自动化验证过线上）：`E2E_BASE_URL` 可把任意 spec 打到
  部署站；`playwright.prod.config.ts` + `prod-smoke.yml` 每日跑核心 8 个 spec。
  首跑发现：线上功能正常、构建为当晚最新，但从大陆链路首次拉 x2t.wasm.gz
  （9.86 MB）要 26～50 s，`requestSaveDocument` 的 45 s 就绪 / 60 s 硬超时会把
  "慢但活着"的首存判为超时（产物稍后才到）→ 放宽为 150 s / 180 s
  （`SAVE_READY_WAIT_MS` 等常量），打开失败仍由 `documentOpenError` 立即拒绝；
  demo 页 `post()` 超时同步到 200 s。CHANGELOG 已记。
- **线上冒烟第一条真缺陷（P0，仅线上复现）：PDF 在 edit.chaxus.com 打不开**。
  api.js 对 pdf 先挂 `web-apps/apps/common/index.html`（嗅探是否表单的加载器），
  CF Pages 把 `index.html` 308 到目录 URL，加载器 `href.match(/common\/index.html/)`
  失配、永远停在空白页；本地无重定向所以全绿。修法：pdf 配置传
  `document.isForm:false` 让 api.js 直接选 pdfeditor（`lib/onlyoffice-editor.ts`），
  单测 + `pdf-route.spec.ts`（断言不经过 `/apps/common/`）。GitHub runner 上的
  prod-smoke 22/23，唯一失败正是它；部署后复跑应全绿。
- **线上冒烟部署后复跑：23/23 全绿**（GitHub runner → edit.chaxus.com，含 PDF）。
- **公开语料 150 文件（含 L2/L3）：142/150**；跨浏览器 job（WebKit + Firefox）CI 全绿。
  8 条发现：4 个 Word 6/95 老 `.doc` 打开失败并正确浮出 -82（`47950_lower/upper.doc`、
  `Bug51944.doc`、`Fuzzed.doc`，非缺陷）；4 个 docx L2 文本覆盖率不达标待查
  （`61470.docx` 7→0 字、`Bug66263-paragraph.docx` 87→81、
  `ExternalEntityInText.docx` 58→49（外部实体不展开是对的）、
  `HeaderFooterUnicode.docx` 391→401）——**明日第一件事**：逐个判定是真丢文本
  还是提取口径（sdt / 文本框 / 字段 / 页眉），并决定是否把老格式 .doc 加进
  `CORPUS_EXCLUDE`。

## 明日待办（2026-08-16）

1. 上面 4 个 docx L2 发现的判定；定时夜间（03:17，300 文件）与线上冒烟（04:47）结果复盘。
2. A 表剩余：评论、xlsx/pptx 插图、docx/pptx 运行时只读切换、PDF 编辑/保存。
3. 入口路径：`?file=<url>` / `document:open-url` / 落地页 `?open=local`。
4. 用户侧：硬刷新后复测 PPT 致命弹窗；若复现给文件 + 步骤。
5. 另一会话：seeded monkey → UI 爬取。

## 2026-08-16

- 定时夜间（POI 300 文件，含 L2/L3）：280/300；跨浏览器 105 通过 / 1 flaky；
  线上冒烟 23/23。
- 36 条发现复盘：**真缺陷 1 条**——`<w:ruby>`（注音/拼音标注）被 vendor 导入整体
  丢弃、底文一起消失（`61470.docx` 7→0 字）。修：`preprocessDocxRuby`（打开前把
  ruby 展开为底文 run；`packages/converter` docx-zip，走 ranuts `rewriteZip`），
  单测 3 条 + `docx-ruby.spec.ts`；CHANGELOG 记为"注音本身仍丢失"的已知限制。
  其余：fuzz/损坏样本正确 -82（8 个 `open=pending` 本地不复现，继续观察）；
  5 个 docx 覆盖率不达标全是提取口径（`'`→`&apos;` 未解实体、无 preserve 的空白
  run、外部实体不展开）→ 提取器解实体、忽略空白、去 `<w:rt>`；
  `ExternalEntityInText.docx` 保留为预期项。旧 `.ppt/.doc` 的 L3 视觉差异待看截图。
- 新增：docx/pptx 运行时只读切换（format-parity）、入口路径 `?file=`/`open-url`/`?open=local`
  （entry-paths.spec，跨域真实 fetch）；corpus 视觉失败时落盘两张截图，旧二进制输入
  阈值 10% 标 `ok-legacy`（.ppt→pptx 行距略紧，目测内容一致，P3）。
- 新增 image-insert.spec（xlsx/pptx URL 插图后保存含 media）、font-cache.spec（第二次打开
  字体全部走缓存，回归守护另一会话修的线上字体无缓存问题；进线上冒烟集）；
  pdf-route.spec 也进线上冒烟集。
- **（08-16 晨）线上"PPT 永久 Loading、本地正常"根因**：索引字体
  `/fonts/NNN`（无扩展名）没有任何 Cache-Control 规则 → Pages 给
  `max-age=0` / `cf-cache-status: DYNAMIC`；sw.js 里字体跳过规则按
  `.ttf/.woff` 扩展名匹配、索引字体漏网落进 SWR，其 `cache:'no-cache'`
  重验证每次完整重下。SDK 字体加载是串行队列，EMP deck 拉 32 文件 /
  37.6MB（其中 20 个是 Word/Slide `IsNeedDefaultFonts` 强制的
  Arial/Times/Courier ×4 面，文档根本没用），逐文件耗时 3s→89s→165s→
  214s+，`isDocumentLoadComplete` 一直 false。修法 `a2a4010`：`_headers`
  把 `/fonts/*` 与 `x2t.wasm.gz` 设 immutable（sdkjs/web-apps 故意不设，
  含我们的 patch 与 iframe HTML），sw.js 对这两种形状 cache-first。线上
  实测：首开 4 分钟+未完成 → 61s 完成；**第二次打开 4s**（30 字体全缓存）。
  **待用户在 CF 控制台做**：Pages 对无扩展名路径边缘不缓存
  （`cf-cache-status` 仍 DYNAMIC），需加 Cache Rule `/fonts/*` → eligible
  for cache，才能让**首次**打开也从边缘命中。更长期：SDK 默认字体全家桶
  （20 文件）对纯浏览器版本是纯浪费，可评估在 `prepareEditorIframe`
  里关闭 `IsNeedDefaultFonts` 或裁减为文档实际引用的字体。
