# @bybrowser/editor-v9

OnlyOffice **9.3.0** editor implementation for [bybrowser](https://bybrowser.com) — a local-first, serverless document editor that runs entirely in the browser.

## Installation

```bash
pnpm add @bybrowser/editor-v9
```

> **Browser only.** This package uses DOM APIs, WebAssembly, and `window` globals. It is not suitable for server-side or Node.js environments.

## What this package contains

| Module                  | Description                                                               |
| ----------------------- | ------------------------------------------------------------------------- |
| `onlyoffice-editor.ts`  | Editor instance lifecycle, readonly mode, save flow                       |
| `document-converter.ts` | x2t WASM wrapper — converts DOCX/XLSX/PPTX to OnlyOffice internal format  |
| `document-utils.ts`     | Pure utilities: file type detection, MIME mapping, path helpers           |
| `document-types.ts`     | TypeScript types for x2t/Emscripten interfaces                            |
| `docx-zip.ts`           | In-browser ZIP parser for OOXML preprocessing                             |
| `empty_bin.ts`          | Minimal OOXML binaries used when creating new blank documents             |
| `i18n.ts`               | Internationalization strings (EN / ZH / JA / KO / DE / FR / ES / PT / RU) |
| `media-player.ts`       | Browser-native overlay player for PPTX embedded video/audio               |

## Key exports

```ts
import {
  // Editor lifecycle
  createEditorInstance,
  loadEditorApi,
  setReadonlyMode,
  getReadonlyMode,
  requestSaveDocument,
  setConverterCallbacks,
  setDocumentStateGetter, // inject app-level store getter

  // Conversion
  X2TConverter,

  // Utilities
  getDocumentType,
  getMimeTypeFromExtension,
  BASE_PATH,
  DOCUMENT_TYPE_MAP,

  // i18n
  t,
  getLanguage,
  setLanguage,
  LanguageCode,

  // Templates
  g_sEmpty_bin,
  g_sEmpty_ooxml,
} from '@bybrowser/editor-v9';
```

## Breaking changes from OnlyOffice 9.3.0

- `DocEditor.sendCommand` renamed to `serviceCommand` — all calls are routed through the `editorSendCommand()` helper for dual-version compatibility.
- Permissions initialisation order matters: `onEditorPermissions` must fire before `onDocumentContentReady`.
- Three gatekeeper functions (`Shc`/`Mrc`/`K8b`) are patched at runtime to force the Web rendering path instead of the Desktop path.

See [docs/explorations/2026-06-21-shc-brj-web-path-patch.md](../../docs/explorations/2026-06-21-shc-brj-web-path-patch.md) for full analysis.

## Store decoupling

This package does **not** import from the application store. Instead, inject a getter at startup:

```ts
import { setDocumentStateGetter } from '@bybrowser/editor-v9';
import { getDocmentObj } from '../store';

setDocumentStateGetter(() => getDocmentObj());
```

## License

AGPL-3.0 — see [LICENSE](../../LICENSE).
