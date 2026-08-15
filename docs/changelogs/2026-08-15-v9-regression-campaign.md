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
