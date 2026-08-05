# v7 / v9 单 Monorepo 拆分与共享包规划

> **状态（2026-08-05）：已废弃，改用更轻量的方案。** 阶段 1-3（`packages/agent-core`/
> `shared`/`converter` 抽包）已经落地，但 `apps/web-v7` + `apps/web-v9` 双 app
> 这条路线判定太重（合并已分叉分支、git 资源翻倍、Agent 接口适配都是硬骨头），
> 阶段 4-6 没有执行。v9 集成改成了"单一 app 的构建变体"（`vite --mode v9` 切
> `publicDir`/`outDir`，不新建 `apps/` 目录），详见
> [2026-08-05-v9-web-mode-build-variant.md](../../explorations/2026-08-05-v9-web-mode-build-variant.md)。
> 本文档保留作为决策过程的历史记录，不要按下面的实施阶段继续推进。
>
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 OnlyOffice **v7** 与 **v9** 两条长期维护线收敛进**单一 monorepo、同一分支**，让"版本无关"的能力（Agent、格式互转、工具/i18n）抽成共享包，做到**修一次、两个版本都生效**；"版本相关"的部分（编辑器壳、SDK/WASM/字体资源、Agent 编辑器适配层）按 v7/v9 各自独立。

**Architecture:** `apps/web-v7` + `apps/web-v9` 两个应用壳，共享 `packages/agent-core`、`packages/converter`、`packages/shared`、`packages/agent-onlyoffice`；版本相关的 `packages/editor-v7`、`packages/editor-v9` 各自封装对应 DocsAPI 与资源。依赖图为无环 DAG，共享包是叶子。

**Tech Stack:** pnpm workspace、TypeScript project references、Vite（每个 app 一份配置）、Vitest、现有 OnlyOffice v7.5 / v9.3 WASM 资源。

---

## 背景与决策（2026-06-28）

### 分支现状

同一 repo 内多条长期分支：

- `main` → 将来是 **v9** 线
- `release/v0.0.4` → **v7** 线（当前 `feat/agent-collab` 合入此线）
- `upgrade/onlyoffice-9.3.0` → v9 升级工作
- `feat/agent-collab` → 本分支，v7 上的 Agent 协同编辑（monorepo 之前的扁平结构）

### 核心矛盾与决策

**同一 repo 的两条分支是独立快照**：把共享代码分别提交到两条分支，会得到两份独立副本，一边修 bug 另一边不会自动同步。用户目标"两个版本都维护、都解决问题"与"两条发散分支"直接冲突。

**决策（用户确认）：合并为单 monorepo，v7/v9 同树，共享 `packages/*`。** 这样修一次共享包，两个 app 自动生效；放弃"npm 发布共享包""独立 repo + submodule"两条备选路。

### 关键事实（已核验）

- 当前 `feat/agent-collab` 分支**不是真正的 workspace**：`pnpm-workspace.yaml` 无 `packages:` 字段，只有 `allowBuilds` 和 `ranui` 的本地 link override。
- 全部源码在根目录扁平结构：`lib/`（~3500 行）、`lib/agent-plugin/`（~2856 行）、`store/`、`index.ts`。
- OnlyOffice 静态资源**已进 git**：`public/` 下 328 个被跟踪文件，`.git` 已 423MB（`public/` 工作区 288MB：fonts 139M、wasm 74M、sdkjs 55M、web-apps 19M）。两版同树会让资源与历史接近翻倍——**必须在迁移中处理**（见风险 R2）。

---

## 模块的版本相关性分类

抽包边界沿 **v7/v9 差异线** 切，而非单纯按功能。

| 模块                                                      | 版本无关（共享）            | 版本相关（每版一份）                                        | 现位置                                                            |
| --------------------------------------------------------- | --------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------- |
| Agent LLM/runtime 核心                                    | ✅ 纯逻辑，不碰编辑器       | —                                                           | `lib/agent-plugin/llm/`、`runtime.ts`、`types.ts`                 |
| Agent editor-bridge + tools                               | 工具逻辑可共享              | ⚠️ `asc_*`/`pluginMethod_*` 接口 v7/v9 可能不同，靠注入适配 | `lib/agent-plugin/tools.ts`、`editor-bridge.ts`                   |
| Agent UI 面板                                             | ✅ 基本共享（依赖 ranui）   | —                                                           | `lib/agent-plugin/ui/`                                            |
| 格式互转 JS 逻辑                                          | ✅ 若 x2t JS API 跨版本稳定 | x2t **WASM 二进制**每版不同（注入）                         | `lib/document-converter.ts`、`docx-zip.ts`                        |
| utils / i18n / types / store                              | ✅                          | —                                                           | `lib/document-utils.ts`、`i18n.ts`、`document-types.ts`、`store/` |
| 编辑器壳（onlyoffice-editor / converter / document / ui） | —                           | ✅ 绑死各版本 DocsAPI                                       | `lib/onlyoffice-editor.ts` 等                                     |
| SDK/WASM/字体资源                                         | —                           | ✅ 完全版本相关                                             | `public/sdkjs`、`public/wasm`、`public/fonts`、`public/web-apps`  |

> 已核验的耦合事实：
>
> - `agent-plugin` 对主项目唯一耦合是 `ui/controller.ts` 与 `ui/storage.ts` 的 `import { t } from '../../i18n'`（2 处）。LLM/runtime 层零跨模块耦合。
> - `agent-plugin` 外部依赖：`@anthropic-ai/sdk`、`ranuts/utils`（localStorage helper）、`ranui/builder`、`ranui`（Web Components）。
> - `document-converter.ts` 外部依赖：`ranuts/utils`、`ranui/message`（**UI 泄漏，需剥离**）；运行时读 `window.Module`（x2t 全局，**需改注入**）；混入 DOM 下载逻辑（`createElement('a')`）。
> - 编辑器核心强内聚：converter ↔ onlyoffice-editor 循环依赖（靠 `setConverterCallbacks` 解），几乎人人依赖 `store`/`i18n`；onlyoffice-editor 30+ 处、ui 21 处直接摸 `window`/DOM/`DocsAPI`。**它是"应用核心"，不是可复用库**，只做 app 内部，不对外暴露为库。

---

## 目标结构

```
apps/
  web-v7/                # v7 应用壳（集成基底：release/v0.0.4 + feat/agent-collab）
    public/              # v7 sdkjs/wasm/fonts/web-apps（资源策略见 R2）
    src/                 # 入口、装配 editor-v7 + 共享包
    vite.config.ts
  web-v9/                # v9 应用壳（来自 main / upgrade/onlyoffice-9.3.0）
    public/              # v9 资源
    src/
    vite.config.ts
packages/
  agent-core/            # ✅ LLM providers + runtime + 通用 types（叶子，零编辑器依赖）
  agent-onlyoffice/      # ⚠️ editor-bridge + tools + UI 面板，依赖注入的 EditorApi 适配
  converter/             # ✅ x2t JS 封装（WASM 由 app 注入）
  shared/                # ✅ document-utils / i18n / types / store
  editor-v7/             # ❌ v7 编辑器壳 + DocsAPI 绑定
  editor-v9/             # ❌ v9 编辑器壳
```

### 依赖 DAG（无环）

```
apps/web-v7 ─┬─> editor-v7 ─┬─> converter ─> shared
             ├─> agent-onlyoffice ─> agent-core
             ├─> agent-onlyoffice ─> shared (i18n)
             └─> shared
apps/web-v9 ─┬─> editor-v9 ──┘（同结构，换 editor-v9）
             ├─> agent-onlyoffice ─> agent-core
             └─> shared
```

- `agent-core` 是叶子：只依赖 `@anthropic-ai/sdk`、`ranuts/utils`。任何包都不向它反向依赖。
- `editor-v7` / `editor-v9` 是仅有的"版本相关代码包"；app 通过依赖不同 editor 包决定版本。

### Agent 版本接缝（最棘手处）

v7 经验证为直调 `window.editor.pluginMethod_*/asc_*`；v9.2 扩展了正式 Plugin API，两版编辑器接口可能不同。处理：

1. `agent-core` 完全不碰编辑器（100% 共享）。
2. `agent-onlyoffice` 的 tools 不写死全局，改为依赖**注入的 `EditorApi` 适配器**（`editor-bridge.ts` 已有该抽象雏形）。
3. v7/v9 各自的 app（或 editor 包）提供对应版本的适配器实现；tools 逻辑共享，差异落在薄适配层。

---

## 实施阶段

> 顺序原则：从耦合最低、共享价值最高的叶子包开始；每步保持 `pnpm run lint:ts` + `pnpm run test` 全绿；编辑器壳与 app 合并放最后（最难）。

### 阶段 0：建立 workspace 骨架

- [ ] 选定集成基底分支（建议从 `release/v0.0.4` 切出新分支 `chore/monorepo-v7-v9`，先承载 v7，再把 v9 并入）
- [ ] 在 `pnpm-workspace.yaml` 增加 `packages:` glob（`apps/*`、`packages/*`），保留现有 `allowBuilds` 与 `ranui` override
- [ ] 配置根 `tsconfig.json` 使用 project references；各包独立 `tsconfig.json`
- [ ] 决定包命名 scope（如 `@ranuts/agent-core`），统一 `package.json` 的 `exports`/`types` 字段约定
- [ ] 确认根脚本（lint/test/format）能跨包运行（`pnpm -r`）

### 阶段 1：抽 `packages/agent-core`（最安全，先验证可行性）

- [ ] 迁移 `lib/agent-plugin/llm/`、`runtime.ts`、`types.ts` 到 `packages/agent-core/src/`
- [ ] 砍掉对 `../../i18n` 的 2 处依赖（文案改为构造参数注入，或暂留占位由上层传入）
- [ ] 定义 `package.json` exports：`agent-core`（runtime+types）、`agent-core/llm`（providers）
- [ ] 迁移对应单测（`test/unit/agent-runtime.test.ts`、`agent-llm-*.test.ts`）到包内并跑绿
- [ ] 根项目 `index.ts` 改为从包导入，验证 v7 app 行为不变

### 阶段 2：抽 `packages/shared`

- [ ] 迁移 `document-utils.ts`、`i18n.ts`、`document-types.ts`、`store/`
- [ ] 暴露 `t()` 给 agent 层使用，回填阶段 1 注入的文案
- [ ] 迁移 `document-utils.test.ts`、`i18n.test.ts`，跑绿

### 阶段 3：抽 `packages/converter`

- [ ] 迁移 `document-converter.ts`、`docx-zip.ts`
- [ ] 剥离 `ranui/message`（错误改为抛异常/回调上报，由 app 决定如何提示）
- [ ] 把 `window.Module`（x2t）改为**注入式**：导出 `createConverter({ x2tModule })`，由各 app 提供对应版本 WASM
- [ ] 把 DOM 下载逻辑（`createElement('a')`）从转换逻辑中分离
- [ ] 迁移转换相关测试，跑绿

### 阶段 4：抽 `packages/agent-onlyoffice`

- [ ] 迁移 `tools.ts`、`editor-bridge.ts`、`ui/`
- [ ] 把 tools 改为依赖注入的 `EditorApi` 适配器，不写死 `window.editor`
- [ ] 依赖 `agent-core`（类型/runtime）与 `shared`（i18n）
- [ ] 迁移 `agent-tools.test.ts`、`agent-editor-bridge.test.ts`、`agent-ui-*.test.ts`，跑绿

### 阶段 5：v7 编辑器壳 + app 落地

- [ ] 建 `packages/editor-v7`：迁移 `onlyoffice-editor.ts`、`converter.ts`、`document.ts`、`ui.ts`、`loading.ts`、`file-types.ts`、`empty_bin.ts`、`embed-api.ts`、`events.ts`
- [ ] 建 `apps/web-v7`：`index.ts`/`index.html`/`styles/`，装配 editor-v7 + agent-onlyoffice + 共享包，提供 v7 的 EditorApi 适配器与 x2t WASM
- [ ] v7 资源迁入 `apps/web-v7/public/`（资源策略见 R2）
- [ ] E2E（`app-smoke.spec.ts`）迁移并跑绿；构建脚本 `bin/build.sh` 适配 app 路径

### 阶段 6：并入 v9

- [ ] 从 `main` / `upgrade/onlyoffice-9.3.0` 取 v9 app 与资源，建 `apps/web-v9` + `packages/editor-v9`
- [ ] 提供 v9 的 `EditorApi` 适配器（处理 v9.2 Plugin API 差异）
- [ ] v9 app 接入共享包（agent 协同能力**首次在 v9 上可用**——红利兑现点）
- [ ] 两个 app 各跑 lint/test/e2e 全绿
- [ ] 更新 CI：matrix 跑 v7/v9 两套；更新 `CLAUDE.md` 与部署（gh-pages）路径

---

## 风险与对策

| 编号 | 风险                                                                     | 对策                                                                                                                                                                                               |
| ---- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1   | **合并两条发散分支是真·merge**，`release/v0.0.4` 与 `main` 的 app 已分叉 | 选 v7 为集成基底先建 monorepo，再把 v9 作为新 app 并入（阶段 6）；不试图自动 merge 两套 app 源码，而是按目标结构重新落位                                                                           |
| R2   | **资源体积翻倍**：`public/` 已进 git，`.git` 423MB，两版同树历史膨胀     | 借迁移把 `sdkjs/wasm/fonts/web-apps` **移出 git**：改 git-lfs，或 postinstall/build 脚本从 docker 镜像按版本提取（参考 CLAUDE.md 升级章节的 `docker cp` 流程）。先评估再动，避免破坏 gh-pages 部署 |
| R3   | **Agent 工具 v7/v9 接口差异**                                            | `agent-onlyoffice` 用注入式 `EditorApi`，差异封在各版本适配器；阶段 6 前先在 v9 上验证 `asc_*`/Plugin API 可用性                                                                                   |
| R4   | **循环依赖**（converter ↔ onlyoffice-editor）随迁移带入包边界            | 这对在 `editor-v7` 包内部，保留现有 `setConverterCallbacks` 解法，不跨包暴露                                                                                                                       |
| R5   | **ranuts/ranui 本地 link override** 在 monorepo 下的解析                 | 保留 `pnpm-workspace.yaml` 的 override；确认各包都能解析到同一份 ranui                                                                                                                             |
| R6   | 迁移期主线（v7 修 bug）与重构并行                                        | monorepo 重构在独立分支推进，期间 v7 紧急修复仍走 `release/v0.0.4`，重构完成后一次性切换                                                                                                           |

---

## 验收标准

- [ ] `apps/web-v7` 与 `apps/web-v9` 均可独立 `dev`/`build`/`preview`
- [ ] 共享包（agent-core/converter/shared/agent-onlyoffice）各有独立 `package.json` + exports，被两个 app 复用
- [ ] 在共享包改一处 bug，v7、v9 两个 app 同时生效（无需复制）
- [ ] Agent 协同能力在 v7、v9 上均可用
- [ ] 全部既有单测/E2E 迁移后跑绿；CI matrix 覆盖两版
- [ ] git 资源体积有明确策略（R2 落地），仓库不因双版本失控

---

## 暂不在本计划范围

- 把共享包发布到 npm（当前选定单 monorepo 内部共享，不发布）
- 编辑器核心作为对外可复用库（它是应用核心，仅作 app 内部包）
- 引入第三个 OnlyOffice 版本
