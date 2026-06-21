# @bybrowser/editor-v7

OnlyOffice **7.x** editor adapter for [bybrowser](https://bybrowser.com) — planned implementation.

## Status

> **Work in progress.** This package is a skeleton. The v7 implementation will be extracted from the main branch once the monorepo structure is stable.

## Planned scope

- Editor lifecycle compatible with OnlyOffice 7.4.x SDK
- Implements `EditorAdapter` from `@bybrowser/core`
- Lighter polyfill requirements compared to v9.3.0 (no `Shc`/`Mrc`/`K8b` patches needed)
- Suitable for the stable deployment at `https://bybrowser.com/`

## Differences from `@bybrowser/editor-v9`

| Feature          | v7            | v9.3.0                            |
| ---------------- | ------------- | --------------------------------- |
| Save command     | `sendCommand` | `serviceCommand`                  |
| Open bytes       | Not available | `asc_openDocumentFromBytes`       |
| Permissions init | Simpler       | Strict ordering required          |
| Gatekeeper patch | Not needed    | `Shc`/`Mrc`/`K8b` must be patched |

## License

AGPL-3.0 — see [LICENSE](../../LICENSE).
