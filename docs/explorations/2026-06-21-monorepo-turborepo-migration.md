# Turborepo Monorepo 迁移记录（2026-06-21）

## 背景与动机

原先所有代码（OnlyOffice v9.3.0 编辑器逻辑、UI 层、工具函数）混在单一 `src/lib/` 目录下，难以区分"v7 还是 v9 专属"和"通用层"。

迁移目标：把代码按职责分层到多个 pnpm workspace 包，为将来同时维护 v7 / v9 两个编辑器版本做好铺垫。

## 最终目录结构

```
apps/
  web/                    # 主 Web 应用（Vite + TypeScript）
    src/lib/              # 应用层（UI、事件、嵌入 API，6 个文件）
      converter.ts        # 门面：组合 x2t + 编辑器，供 document.ts/embed-api.ts 用
      document.ts         # 文件打开/新建/URL 加载（依赖 store）
      embed-api.ts        # iframe postMessage 协议
      events.ts           # 桌面端 RENDER_OFFICE / CLOSE_EDITOR 事件
      loading.ts          # 加载态 UI
      ui.ts               # 控制面板、菜单、版本选择器等
    public/               # OnlyOffice v9.3.0 静态资产（web-apps/sdkjs/wasm）
    test/

packages/
  core/                   # @doc/core — 纯接口 + 共享常量
    src/
      editor-adapter.ts   # EditorAdapter 接口（v7/v9 共用的契约）
      file-types.ts       # oAscFileType / c_oAscFileType2 常量
      index.ts            # barrel export

  editor-v9/              # @doc/editor-v9 — OnlyOffice 9.3.0 实现
    src/
      onlyoffice-editor.ts   # 编辑器实例生命周期（核心）
      document-converter.ts  # x2t WASM 转换
      document-types.ts      # Emscripten / 转换类型
      document-utils.ts      # 纯工具函数（类型判断、MIME、路径）
      docx-zip.ts            # DOCX/XLSX/PPTX ZIP 预处理
      empty_bin.ts           # 空文档模板二进制（OOXML ZIP）
      i18n.ts                # 国际化字符串
      media-player.ts        # PPTX 媒体叠加播放器
      index.ts               # barrel export

  editor-v7/              # @doc/editor-v7 — 骨架，待填充 v7 实现
  document-renderer/      # 骨架，待填充
```

## 关键设计决策

### Vite vs Turborepo 的分工
- **Vite**：单个 app 的 bundler（编译 TS、HMR、资产优化）
- **Turborepo**：跨包任务编排（正确顺序、并行化、增量缓存）

两者解决不同层的问题，不互斥。

### web-apps / sdkjs 不能共用
每个 OnlyOffice 版本需要独立的静态资产：
- `apps/web/public/` → v9.3.0（当前）
- 未来 `apps/v7/public/` → v7（计划）

静态资产不放 `packages/`，只有 TypeScript 逻辑在 packages 之间共享。

### Store 解耦：setDocumentStateGetter
`onlyoffice-editor.ts` 原先直接 `import { getDocmentObj } from '../store'`，这是跨层依赖（editor 包依赖 app 层 store）。

修复方案：在 editor 包内维护一个可注入的 getter：
```typescript
let _getDocumentState: () => { fileName?: string; file?: File } | null = () => null;
export function setDocumentStateGetter(getter: typeof _getDocumentState): void {
  _getDocumentState = getter;
}
```

`apps/web/src/index.ts` 在启动时注入：
```typescript
setDocumentStateGetter(() => getDocmentObj());
```

这与现有 `setConverterCallbacks` 模式完全一致。

### tsconfig 路径别名（非 project references）
使用 paths 别名而非 TypeScript project references，因为：
- Vite 构建不用 tsc emit，所以移除了 `apps/web/tsconfig.json` 里的 `outDir` 和 `declaration`
- 去掉 `outDir` 后 TypeScript 不再强制 `rootDir` 边界，可以在 paths 里直接指向 `packages/*/src/index.ts`
- vitest.config.ts 也配置了相同的 alias，确保测试也能解析

## 单测更新要点

测试迁移到 `@doc/editor-v9` 路径后需要注意：

1. **`ranuts/utils` mock 必须完整**：`@doc/editor-v9` 通过 `i18n.ts` 传递依赖了 `getQuery`、`getCookie`、`localStorageGetItem` 等，原先只 mock `createObjectURL` 会报错
2. **`embed-api.test.ts` mock 路径**：`vi.mock('../../src/lib/onlyoffice-editor', ...)` → `vi.mock('@doc/editor-v9', ...)`
3. **`onlyoffice-editor.test.ts` store mock 移除**：改为调用 `setDocumentStateGetter(() => ({ fileName: '...', file: undefined }))` 在 `beforeEach` 注入

## 提交列表

- `c2e5e46` refactor: migrate to monorepo structure under apps/web (Step 1)
- `5d0f328` feat: add version picker CSS styles
- `c840cda` feat: extract packages/core with EditorAdapter interface and file-types (Step 2)
- `91dcecf` feat: extract packages/editor-v9 with full v9.3.0 implementation (Steps 3+4)
