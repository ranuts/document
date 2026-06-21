# @bybrowser/core

Shared interfaces and constants for the [bybrowser](https://bybrowser.com) document editor monorepo.

## Installation

```bash
pnpm add @bybrowser/core
```

## Exports

### `EditorAdapter`

The contract that every editor implementation must satisfy. Allows `apps/web` to swap between editor versions without changing application code.

```ts
import type { EditorAdapter } from '@bybrowser/core';

const adapter: EditorAdapter = {
  load:          () => Promise<void>,
  openNew:       (ext) => Promise<void>,
  openPicker:    () => void,
  openFromUrl:   (url, fileName?) => Promise<void>,
  openFromBytes: (data, fileName) => Promise<void>,
  setReadonly:   (value) => void,
  getReadonly:   () => boolean,
  save:          (targetExt) => Promise<File>,
  setCallbacks:  (callbacks) => void,
};
```

### `oAscFileType`

Numeric file-type constants used by the OnlyOffice SDK (shared across v7 and v9).

```ts
import { oAscFileType } from '@bybrowser/core';

oAscFileType.DOCX  // 65
oAscFileType.XLSX  // 257
oAscFileType.PPTX  // 129
```

### `c_oAscFileType2`

Reverse map from numeric code back to extension name.

```ts
import { c_oAscFileType2 } from '@bybrowser/core';

c_oAscFileType2[65]  // "DOCX"
```

### `DocumentType`

Union type for the three editor modes.

```ts
import type { DocumentType } from '@bybrowser/core';

type DocumentType = 'word' | 'cell' | 'slide';
```

## Design

This package has **zero runtime dependencies** and no browser API usage. It is safe to import in any environment (Node.js, browser, test runner).

Editor implementations live in separate packages (`@bybrowser/editor-v9`, etc.) and declare `@bybrowser/core` as a peer or regular dependency.

## License

AGPL-3.0 — see [LICENSE](../../LICENSE).
