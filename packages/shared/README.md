# @ranuts/shared

Shared primitives for the document app: file-type utilities, shared types, i18n,
and the global document store. Internal package — app-specific (the i18n table and
store shape belong to this product), consumed by the editor, converter, and agent
layers so they all speak the same types and language.

## Install

```bash
pnpm add @ranuts/shared
```

## Subpath imports

Prefer subpaths; `.` is a barrel that re-exports all of them.

```ts
import { getDocumentType, parseReadonly, BASE_PATH } from '@ranuts/shared/document-utils';
import type { DocumentType, ConversionResult } from '@ranuts/shared/document-types';
import { t, getLanguage, setLanguage, getOnlyOfficeLang } from '@ranuts/shared/i18n';
import { getDocmentObj, setDocmentObj } from '@ranuts/shared/store';
```

## Modules

| Subpath            | Exports                                                                                                                                         |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `./document-utils` | `getDocumentType`, `getDocumentMimeType`, `getDocumentExtension`, `getBasePath`, `BASE_PATH`, `DOCUMENT_TYPE_MAP`, `parseReadonly`              |
| `./document-types` | `DocumentType`, `ConversionResult`, `BinConversionResult`, `SaveEvent`, `EmscriptenModule`, `EmscriptenFileSystem`                              |
| `./i18n`           | `t`, `getLanguage`, `setLanguage`, `getOnlyOfficeLang`, `Language`, `I18nMessages` (en/zh-CN/ja/ko/de/es/pt; non-English tables load on demand) |
| `./store`          | `getDocmentObj`, `setDocmentObj` (ranuts signal over `{ fileName, file?, url? }`)                                                               |

Depends on `ranuts` (createSignal, cookie/query/localStorage helpers).
Builds to `dist/` via `prepare` on install.
