# 语料战役第 1 天：中文文件名打断 v9 打开转换（P0 根因锁定）

> **2026-08-15 晚更正：本文根因结论已作废。** 25/25 全灭与"改 ASCII 名即
> 成功"都是跑道自身的 bug——`page.route` 投递被页面 Service Worker 击穿，
> x2t 收到的是 SPA 兜底 index.html。文件名与之无关。完整推翻过程与真正
> 修掉的缺陷（打开失败永久转圈）见
> [第 2 天记录](2026-08-15-corpus-harness-sw-route-bug-and-open-failure-guard.md)。
> 下文按原样保留作为决策记录。

日期：2026-08-15
前情：用户实测判定 v9 稳定性不如 v7（[规划方向零](../superpowers/plans/2026-08-15-next-phase-roadmap.md)），
提供 ~/Documents 作为真实语料（25 个 Office 文件，仅本地测试不入库）。

## 全量矩阵结果：25/25 全灭，且同一死法

corpus 跑道（test/e2e/corpus.spec.ts）首轮全量：**每一个文件**都停在
`isDocumentLoadComplete` 永假（180s 上限），UI 永久转圈
"Loading spreadsheet/presentation"，部分状态栏出现
"Connection is restored"。有头模式同样复现（排除无头工件），且捕获到
**`asc_onError: id=-82`（打开转换失败）**——错误发生了但 UI 不终止
转圈，用户看到的是永久加载。

## 判别实验（一锤定音）

| 变量                                        | 结果                        |
| ------------------------------------------- | --------------------------- |
| `公司工作作息时间.xlsx`（208KB，中文名）    | 卡死 180s+，asc_onError -82 |
| **同一字节流**，fileName 改 `schedule.xlsx` | **2.1 秒加载成功**          |

回看全部证据完全自洽：语料 25 个文件全是中文/空格/括号文件名 → 全灭；
所有通过的合成 E2E 文件名全 ASCII；我交互式复跑 EMP deck 时手滑用了
`EMP.pptx`（ASCII）→ 50 秒加载成功——当时误判为"间歇性"，实为
**文件名决定论**。

**结论：非 ASCII 文件名使 v9 编辑器内部 docx/xlsx/pptx → bin 打开转换
失败（-82），且失败后加载遮罩不终止，表现为永久转圈。**

这也大概率解释用户对 v9 的整体负面评价：真实用户的文件几乎都是中文名。
（用户手动会话中该 deck 曾加载成功过一次，与本地 25/25 全灭存在一处
未解释的不一致，修复时一并查清打开链路里文件名的传递路径。）

## 附带发现

- `addresses.csv`（真实 CSV）打开报
  "Failed to convert CSV to XLSX: Invalid HTML: could not find table"
  ——SheetJS `XLSX.read(csvText, {type:'string'})` 把该文件误判成 HTML
  解析了。converter 的 CSV 解析选项需要显式声明（战役缺陷清单 #2）。
- 用户报告的 PPT 编辑致命弹窗在当前构建未复现；嫌疑其一是用户浏览器
  SW 缓存的旧构建（图片管线修复前），已请用户硬刷新重测。

## 修复方向（下一步，未动手）

打开链路中文件名的消费点：`createPersonalEditorInstance` 的
`document.title` / `fileType`，以及 vendor 内部转换对 title 的使用
（x2t_helper `sanitizeFileName` 只管保存路径，打开路径疑似有别的
消费点）。修复原则：**内部转换用 sanitize 后的 ASCII 名，UI 标题保留
原始名**；修复必须配 corpus 级 E2E（中文名真实文件打开+保存往返）。

## 战役缺陷清单（截至第 1 天）

| #   | 缺陷                                            | 级别 | 状态                            |
| --- | ----------------------------------------------- | ---- | ------------------------------- |
| 1   | 非 ASCII 文件名 → 打开转换 -82 + 永久转圈       | P0   | 根因锁定，待修                  |
| 2   | 特定 CSV 被 SheetJS 误判为 HTML                 | P1   | 已定位方向                      |
| 3   | 打开失败（-82）时加载遮罩不终止、无用户可见错误 | P1   | 待修（错误 toast 已有管道可挂） |
| 4   | 用户报告的 PPT 编辑致命弹窗                     | P0?  | 未复现，等用户清 SW 后反馈      |
