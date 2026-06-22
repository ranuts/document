# @bybrowser/editor-v9

[bybrowser](https://bybrowser.com) 文档编辑器的 OnlyOffice **9.3.0** 实现——完全在浏览器端运行，无服务器，保护用户隐私。

## 安装

```bash
pnpm add @bybrowser/editor-v9
```

> **仅限浏览器环境。** 本包使用 DOM API、WebAssembly 和 `window` 全局对象，不适用于服务端或 Node.js 环境。

## 包含内容

| 模块                    | 说明                                                |
| ----------------------- | --------------------------------------------------- |
| `onlyoffice-editor.ts`  | 编辑器实例生命周期、只读模式、保存流程              |
| `document-converter.ts` | x2t WASM 封装，负责 DOCX/XLSX/PPTX 与内部格式的互转 |
| `document-utils.ts`     | 纯工具函数：文件类型检测、MIME 映射、路径处理       |
| `document-types.ts`     | x2t/Emscripten 相关 TypeScript 类型定义             |
| `docx-zip.ts`           | 纯浏览器 ZIP 解析器，用于 OOXML 预处理              |
| `empty_bin.ts`          | 新建空文档时使用的最小 OOXML 二进制模板             |
| `i18n.ts`               | 国际化字符串（中/英/日/韩/德/法/西/葡/俄）          |
| `media-player.ts`       | PPTX 嵌入视频/音频的浏览器原生叠加播放器            |

## 主要导出

```ts
import {
  // 编辑器生命周期
  createEditorInstance,
  loadEditorApi,
  setReadonlyMode,
  getReadonlyMode,
  requestSaveDocument,
  setConverterCallbacks,
  setDocumentStateGetter, // 注入应用层 store getter

  // 格式转换
  X2TConverter,

  // 工具函数
  getDocumentType,
  getMimeTypeFromExtension,
  BASE_PATH,
  DOCUMENT_TYPE_MAP,

  // 国际化
  t,
  getLanguage,
  setLanguage,
  LanguageCode,

  // 空文档模板
  g_sEmpty_bin,
  g_sEmpty_ooxml,
} from '@bybrowser/editor-v9';
```

## OnlyOffice 9.3.0 关键变更

- `DocEditor.sendCommand` 已改名为 `serviceCommand`——所有调用通过 `editorSendCommand()` helper 路由，保持双版本兼容。
- 权限初始化有严格时序要求：`onEditorPermissions` 必须在 `onDocumentContentReady` 之前运行。
- 三个门控函数（`Shc`/`Mrc`/`K8b`）在运行时被 patch，强制走 Web 渲染路径而非 Desktop 路径。

详细分析见 [docs/explorations/2026-06-21-shc-brj-web-path-patch.md](../../docs/explorations/2026-06-21-shc-brj-web-path-patch.md)。

## Store 解耦设计

本包**不直接引用**应用层 store。需在应用启动时注入 getter：

```ts
import { setDocumentStateGetter } from '@bybrowser/editor-v9';
import { getDocmentObj } from '../store';

setDocumentStateGetter(() => getDocmentObj());
```

## 许可证

AGPL-3.0，详见 [LICENSE](../../LICENSE)。
