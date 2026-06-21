# @bybrowser/core

[bybrowser](https://bybrowser.com) 文档编辑器 monorepo 的共享接口与常量。

## 安装

```bash
pnpm add @bybrowser/core
```

## 导出内容

### `EditorAdapter`

所有编辑器实现必须满足的契约接口。`apps/web` 通过该接口切换不同编辑器版本，无需修改应用层代码。

```ts
import type { EditorAdapter } from '@bybrowser/core';

const adapter: EditorAdapter = {
  load:          () => Promise<void>,          // 加载 SDK 脚本
  openNew:       (ext) => Promise<void>,       // 新建空文档
  openPicker:    () => void,                   // 打开系统文件选择框
  openFromUrl:   (url, fileName?) => Promise<void>,  // 从 URL 打开
  openFromBytes: (data, fileName) => Promise<void>,  // 从字节打开（嵌入 API）
  setReadonly:   (value) => void,              // 切换只读模式
  getReadonly:   () => boolean,                // 获取只读状态
  save:          (targetExt) => Promise<File>, // 触发保存，返回 File
  setCallbacks:  (callbacks) => void,          // 注册应用层回调
};
```

### `oAscFileType`

OnlyOffice SDK 使用的文件类型数字常量（v7 和 v9 共用）。

```ts
import { oAscFileType } from '@bybrowser/core';

oAscFileType.DOCX  // 65
oAscFileType.XLSX  // 257
oAscFileType.PPTX  // 129
```

### `c_oAscFileType2`

数字代码到扩展名的反向映射表。

```ts
import { c_oAscFileType2 } from '@bybrowser/core';

c_oAscFileType2[65]  // "DOCX"
```

### `DocumentType`

编辑器的三种工作模式。

```ts
import type { DocumentType } from '@bybrowser/core';

type DocumentType = 'word' | 'cell' | 'slide';
```

## 设计原则

本包**无任何运行时依赖**，不使用任何浏览器 API，可在任何环境（Node.js、浏览器、测试框架）中安全引用。

编辑器实现在各自的包中（`@bybrowser/editor-v9` 等），将 `@bybrowser/core` 声明为依赖。

## 许可证

AGPL-3.0，详见 [LICENSE](../../LICENSE)。
