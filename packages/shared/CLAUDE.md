# @ranuts/shared — AI usage guide

App-specific shared primitives: file-type utils, shared types, i18n, document
store. **Internal package** — the i18n table and store shape are this product's,
not generic. Editor / converter / agent layers all import from here.

## Import (prefer subpaths)

```ts
import {
  getDocumentType,
  getMimeTypeFromExtension,
  parseReadonly,
  BASE_PATH,
  DOCUMENT_TYPE_MAP,
} from '@ranuts/shared/document-utils';
import type {
  DocumentType,
  ConversionResult,
  BinConversionResult,
  SaveEvent,
  EmscriptenModule,
} from '@ranuts/shared/document-types';
import { t, getLanguage, setLanguage, getOnlyOfficeLang } from '@ranuts/shared/i18n';
import type { Language, I18nMessages } from '@ranuts/shared/i18n';
import { getDocmentObj, setDocmentObj } from '@ranuts/shared/store';
```

## What each module is for

- **document-utils** — pure helpers: classify a file (`getDocumentType`), MIME from
  extension, the deployment `BASE_PATH` (handles `/document/` on GitHub Pages vs `/`),
  and `parseReadonly` for the `?readonly` query flag.
- **document-types** — shared interfaces, incl. x2t/Emscripten module shapes.
- **i18n** — `t(key)` over the 8 shell locales in `SHELL_LOCALES`
  (en/zh complete, the rest core-only with per-key English fallback);
  `getLanguage/setLanguage`; `getOnlyOfficeLang()` resolves the _editor_ locale
  (any of the 45 the vendor ships, `resolveEditorLocale`); `applyDocumentLanguage()`
  sets `<html lang/dir>` (fa is RTL). Keys are typed via `I18nMessages`.
- **store** — `[getDocmentObj, setDocmentObj]`, a ranuts signal over
  `{ fileName: string; file?: File; url?: string | URL }` (the current document).

## Gotchas

- `t(key)` is typed against `I18nMessages` — a new UI string must be added to the two
  **complete** tables (en + zh) or `t` won't type-check; the other locales are
  `Partial` and fall back to English per key, so translating them can come later.
- `store` holds a `File`/`Blob` — don't serialize it to localStorage.
- This package depends on `ranuts`; keep it that way (it's the app's shared layer,
  not a zero-dep generic lib).

## Testing

`document-utils` and `i18n` are pure → unit-test directly. When mocking in consumers,
mock the subpath you import (e.g. `vi.mock('@ranuts/shared/i18n', …)`), not a relative path.
