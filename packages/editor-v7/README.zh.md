# @bybrowser/editor-v7

[bybrowser](https://bybrowser.com) 文档编辑器的 OnlyOffice **7.x** 适配层——规划中。

## 状态

> **开发中。** 本包目前是骨架，待 monorepo 结构稳定后，将从主分支提取 v7 的实现代码。

## 规划范围

- 兼容 OnlyOffice 7.4.x SDK 的编辑器生命周期
- 实现 `@bybrowser/core` 定义的 `EditorAdapter` 接口
- 相比 v9.3.0，所需 polyfill 更少（无需 `Shc`/`Mrc`/`K8b` 门控函数 patch）
- 对应部署在 `https://bybrowser.com/` 的稳定版本

## 与 `@bybrowser/editor-v9` 的差异

| 特性 | v7 | v9.3.0 |
|------|----|--------|
| 保存命令 | `sendCommand` | `serviceCommand` |
| 字节打开 | 不支持 | `asc_openDocumentFromBytes` |
| 权限初始化 | 较简单 | 有严格时序要求 |
| 门控函数 patch | 不需要 | 必须 patch `Shc`/`Mrc`/`K8b` |

## 许可证

AGPL-3.0，详见 [LICENSE](../../LICENSE)。
