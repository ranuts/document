# v9 行为矩阵（测试覆盖台账）

方法论见 [2026-08-15-v9-test-coverage-strategy.md](superpowers/plans/2026-08-15-v9-test-coverage-strategy.md)。
**"全覆盖"的定义 = 本表没有空白格。** 每格写用例位置；⬜ 表示已知未覆盖；
🌙 表示由夜间语料矩阵（`corpus.spec.ts`，私有语料 + POI 公开语料）覆盖而
非固定用例；所有格子隐含 L0 判据（`test/e2e/lib/l0.ts` 自动生效）。

图例：`ER` = embed-regression.spec、`OF` = open-failure.spec、`SD` =
embed-save-default.spec、`HX` = html-as-xls.spec、`FN` = filename-matrix.spec、
`EA` = embed-api.spec、`AS` = app-smoke.spec、`CO` = corpus.spec、`SW` = sw-warm.spec、
`RI` = resave-idempotence.spec、`FP` = format-parity.spec。

## A. 格式 × 操作（合成语料 = PR 档；真实语料 = 🌙）

| 操作 \ 格式                 | docx       | doc | xlsx                  | xls             | pptx | ppt       | csv | pdf                                                                 |
| --------------------------- | ---------- | --- | --------------------- | --------------- | ---- | --------- | --- | ------------------------------------------------------------------- |
| 打开（合成）                | ER, FN, SD | ⬜  | ER, FN                | HX（HTML 伪装） | ⬜   | ⬜        | ER  | ER                                                                  |
| 打开（真实）                | 🌙         | 🌙  | 🌙                    | 🌙（POI）       | 🌙   | 🌙（POI） | 🌙  | `PR` = pdf-roundtrip.spec（编辑器导出的真 PDF；注释 + 存回 + 只读） |
| 键盘编辑                    | 🌙         | 🌙  | ER(Ctrl+S) 🌙         | 🌙              | 🌙   | 🌙        | 🌙  | ⬜                                                                  |
| 保存往返（L1 结构）         | ER, SD, FN | 🌙  | ER, FN, HX            | 🌙              | 🌙   | 🌙        | ER  | ⬜                                                                  |
| 保存往返（L2 内容比对）     | ⬜         | ⬜  | ER, FN, HX（SheetJS） | HX              | ⬜   | ⬜        | ER  | —                                                                   |
| 导出 PDF                    | ⬜         | ⬜  | ER                    | ⬜              | ⬜   | ⬜        | ⬜  | —                                                                   |
| 只读打开 / 运行时切换       | ⬜         | ⬜  | ER                    | ⬜              | ⬜   | ⬜        | ⬜  | ⬜                                                                  |
| 插图后保存                  | ER         | ⬜  | ⬜                    | ⬜              | ⬜   | ⬜        | —   | —                                                                   |
| 评论                        | ⬜         | ⬜  | ⬜                    | ⬜              | ⬜   | ⬜        | —   | ⬜                                                                  |
| 再打开→再保存（幂等）       | ⬜         | ⬜  | ⬜                    | ⬜              | ⬜   | ⬜        | ⬜  | ⬜                                                                  |
| 打开失败可见 + 保存快速拒绝 | —          | —   | OF                    | —               | —    | —         | —   | ⬜                                                                  |
| 裸 `document:save` 默认格式 | SD         | ⬜  | FN                    | HX（→xlsx）     | ⬜   | ⬜        | ER  | ⬜                                                                  |

## B. 输入特征

| 特征                                                                  | 覆盖                                        |
| --------------------------------------------------------------------- | ------------------------------------------- |
| 文件名：ASCII / CJK / 空格括号 / 全角标点 / emoji / `&%'!` / 180 字符 | FN（xlsx 全部；docx CJK+空格）；pptx ⬜     |
| 体积：KB 级                                                           | 全部合成用例                                |
| 体积：MB～60MB                                                        | 🌙（EMP deck 6.5MB 产物）；固定用例 ⬜      |
| 编码：GBK CSV / GBK HTML 表                                           | 单测（document-converter.test）；E2E ⬜     |
| HTML 伪装 .xls/.xlsx                                                  | HX + 单测                                   |
| 垃圾字节 / 截断                                                       | OF（垃圾）；截断 ⬜                         |
| 多 sheet                                                              | ER                                          |
| 合并单元格 / 冻结窗格 / 公式 / 图表 / 页眉页脚 / 修订 / 嵌入对象      | 🌙（取决于语料）；参数化生成 ⬜             |
| 图片（URL 插入）                                                      | ER                                          |
| 密码保护                                                              | 显式排除（CORPUS_EXCLUDE）；期望行为用例 ⬜ |

## C. 运行环境

| 环境                                                                                         | 覆盖                                                                                                                                                                                                                                              |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 全新 profile 冷启动                                                                          | 每个 Playwright 用例即冷 profile                                                                                                                                                                                                                  |
| SW 已控制页面（老用户）                                                                      | `SW` = sw-warm.spec（第二次加载由 SW 控制页面与编辑器 frame，打开+保存往返）；"SW 缓存旧构建"升级路径：策略改为新 SW 等待、无文档时才 SKIP_WAITING + 重载（`lib/sw-update.ts`，单测 `test/unit/sw-update.test.ts` + sw.js 契约）；双构建端到端 ⬜ |
| standalone 主站                                                                              | AS（加载 / manifest）；编辑器路径 ⬜                                                                                                                                                                                                              |
| 入口路径：`?file=<url>` / embed `document:open-url` / 落地页 `?open=local`（IndexedDB 交接） | `EP` = entry-paths.spec（另起本地 HTTP 源做跨域真实 fetch）                                                                                                                                                                                       |
| embed（iframe）                                                                              | ER / EA / 其余全部                                                                                                                                                                                                                                |
| Docker 镜像                                                                                  | 同套 E2E（`test:e2e:docker`）                                                                                                                                                                                                                     |
| **线上站（edit.chaxus.com）**                                                                | `playwright.prod.config.ts` + `.github/workflows/prod-smoke.yml`（**每次 push main 等部署上线后即冒烟** + 每日 04:47 + 手动；核心 spec，1 worker）；也可 `E2E_BASE_URL=<站点>` 跑任意 spec；首跑发现慢链路首存超时与线上 PDF 打不开（均已修）     |
| **托管语义（CF Pages 模拟）**                                                                | `playwright.pages.config.ts` + CI job `e2e-pages`：`bin/build.sh` 真部署构建 + `wrangler pages dev`（复现 index.html→目录 308、`_headers`、`_redirects`），全套 PR 档 spec；托管契约单测 `test/unit/hosting-contract.test.ts`                     |
| 字体交付（缓存）                                                                             | `FC` = font-cache.spec：同页第二次打开所有 `/fonts/NNN` 必须 SW 缓存或 CDN HIT 且 <60s（线上曾无缓存头 + SWR 每次重下 → PPT 打开数分钟；另一会话修 `_headers`/sw.js）；本地与线上冒烟都跑                                                         |
| Chromium                                                                                     | 全部                                                                                                                                                                                                                                              |
| WebKit / Firefox                                                                             | ⬜                                                                                                                                                                                                                                                |
| 视觉基线（L3）                                                                               | ⬜                                                                                                                                                                                                                                                |
| 性能预算（L4）                                                                               | corpus 报告按格式输出 open/save p50/p95；`SN` = slow-network.spec（`SLOW_NET=1`，CDP 节流 4 Mbps/150 ms、禁 SW：冷启动+首存 < 150 s，实测首存约 44 s；夜间 job `budgets`）；xlsx-features 2 万行 60 s 预算                                        |

## D. 交互入口（策略第 9 节）

| 层                                          | 覆盖                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API 层 `asc_*` 枚举                         | ✅ `api-surface.spec.ts`（`API_SWEEP=1`，夜间档）：三编辑器全部零参 `asc_*`（word 218 / cell 218 / slide 161）逐个调用，每次查 L0 + 保存开关 + 状态向量（longAction/frameEditor/…）；`SWEEP_ONLY` 二分、`SWEEP_PROBE_EVERY` 真保存探针。首轮抓出禁区表 F 三条 + 守卫 6/7                                                                                                                    |
| UI 工具栏 / 菜单爬取                        | ⬜                                                                                                                                                                                                                                                                                                                                                                                          |
| 高频旅程动作库 `test/e2e/actions/`          | 部分：`actions/editor.ts`（waitForEditorReady / focusEditor / typeIntoDocument / saveAndCapture / editorHealth）+ `actions/fixtures.ts`（buildXlsx / buildPptx）；旅程本体（插表/图/图表、查找替换、评论…）⬜                                                                                                                                                                               |
| seeded monkey                               | ✅ `monkey.spec.ts`（`MONKEY=1`，`MONKEY_SEED`/`MONKEY_STEPS`）：三编辑器各 150 步随机组合（快捷键 / 含 CJK 输入 / 导航 / 安全 asc_\*），每步查致命框 / 加载态 / 主线程响应（15s 上限）/ longAction（8s 去抖）；asc_onError 逐步归因、仅 Critical 判失败；末尾真保存；失败输出 seed+doc+step 与精确回放命令。首轮 150×3 干净；跑道教训：CJK 输入触发 2.8MB 字体加载期间 longAction 合法为真 |
| 快捷键 / 右键                               | 快捷键 ✅ `shortcut-surface.spec.ts`（`SHORTCUT_SWEEP=1`）：三编辑器 word 83 / cell 125 / slide 107 个真实键盘快捷键逐个按下，每次查致命框/asc_onError/longAction/加载态，末尾真保存；首轮全绿，唯一记录 cell `Cmd+Shift+L`（无数据区切筛选）报提示级 asc_onError。右键菜单 ⬜                                                                                                              |
| vendor 契约哨兵（hook 函数存在、wasm 哈希） | ⬜                                                                                                                                                                                                                                                                                                                                                                                          |

## E. escape 表（用户报出而矩阵未抓）

| 日期       | 现象                             | 缺的维度                   | 处置                                                                                                                                                     |
| ---------- | -------------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-15 | 真实 35 页 PPTX 编辑标题弹致命框 | C. SW 已控制页面（旧构建） | 未复现于当前构建；最可能机制=部署时页面开着文档、旧 SW 被立即替换、旧页面懒加载到新构建分片（新旧混装）——已改 SW 等待策略；sw-warm.spec 覆盖 SW 控制页面 |
| 2026-08-15 | 插图后保存主线程假死             | A. 插图后保存              | 已修 + ER 用例                                                                                                                                           |
| 2026-08-15 | Save 按钮常灰                    | A. 键盘编辑→Save 按钮      | 已修 + ER 用例                                                                                                                                           |

## F. 集成禁区（API 枚举发现，任何集成路径都不得调用）

| API                                                                                                   | 后果                                                                                                                                                  | 来源                                                                                                                                    |
| ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `asc_stopSaving()`                                                                                    | 本会话内永久禁用保存（word / cell 均确认）；配对信号是 `asc_continueSaving`（decrementCounterLongAction）                                             | api-surface 枚举（2026-08-15）；SKIP-with-note                                                                                          |
| `asc_editChartInFrameEditor()` / `asc_editOleTableInFrameEditor()`（无图表选区 / 无 frame editor 时） | `sync_StartAction(BlockInteraction)` 后抛错，`isLongAction()` 永真 → 之后所有 `asc_DownloadAs` 静默丢弃、永远不能保存。**UI 可达**（图表右键 / 双击） | 二分至单方法（pptx）；已修：`prepareEditorIframe` **守卫 6** 复位计数器 + ER 用例 "a failed chart-editor entry does not disable saving" |
| `asc_runAutostartMacroses()`                                                                          | 同类计数器泄漏（三编辑器均见 longAction 卡 true，碰巧被后续 undoAllChanges/startEditCrop 复位）                                                       | 守卫 6 一并覆盖（returnOnRelease）                                                                                                      |
| `asc_EditSelectAll()` → `asc_GetSeriesSettings()`（cell）                                             | 全表 1048576×16384 选区建图表序列 → 主线程卡死 → "Array buffer allocation failed" → 渲染进程崩 / 再不能保存。**UI 可达**（Ctrl+A → 插入图表）         | 二分至最小二元组合；已修：**守卫 7** 调用期把选区钳到已用区域（10ms 完成）+ ER 用例 "select-all then chart series settings…"            |
| `asc_SetSilentMode`                                                                                   | 洗清：slide/cell 上是空函数，不是保存杀手                                                                                                             | 已从 SKIP 移除                                                                                                                          |
