# v9："Print to PDF" / "Export to PDF" 等格式转换类保存全部悄悄变成原格式保存（未修复，架构性问题）；开真实文件验证通过

日期：2026-08-09
分支：feat/v9-web-mode
状态：**已定位根因，未修复，已在 Excel 和 Word 两个编辑器上现场复现**——
根因在于早前为修 Excel 无限保存循环而加的离线保存补丁，这次发现它有一个
之前没预料到的副作用；修复涉及区分"纯保存"和"转换成别的格式"两种语义
完全不同的调用，属于需要谨慎设计的架构性改动，这次只记录、不动手改。
开真实文件（不是新建文档）这一项验证通过，无问题。

## 背景

用户问"还有其他问题吗"，继续排查。先验证了一直没测过的"打开真实文件"
（而不是每次都用 `?new=xlsx` 这种全新空白文档），然后顺手测了一下打印
预览里的 "Print to PDF" 按钮，意外发现了这个问题。

## 开真实文件——验证通过，无问题

从落地页点 "Open a file"，上传仓库里已有的 `.scratch/sheetjs-upload-test.xlsx`
（真实的、包含实际数据的文件，不是 `?new=` 生成的空白模板）。结果：

- 标题栏正确显示 `sheetjs-upload-test.xlsx`（不是 "New_Document.xlsx"）。
- `asc_openDocumentFromBytes 15873 bytes` —— 跟磁盘上文件的真实字节数
  （`ls -la` 确认为 15873 字节）精确一致，确认真的加载了完整的原始文件，
  不是走了新建文档那条路径。
- A1 单元格正确显示 "sheetjs upload test"，B1 正确显示 `1`，跟文件内容
  相符。
- 控制台全程干净，没有任何报错。

这条路径没有问题。

## "Print to PDF" 等格式转换类保存——会悄悄按原文件格式保存，不是用户要的格式

### 复现

打开上面那个真实的 xlsx 文件，File -> Print，弹出打印预览面板（面板本身
渲染正常，预览内容跟工作表数据一致），点 **"Print to PDF"** 按钮。

控制台打出：

```
Save document event: [object Object]
Saving v9 binary 5539 bytes as XLSX format
```

**注意最后一行——明明点的是"Print to PDF"，日志却说存成了 "XLSX format"**。
连续点了两次，两次都是同样的 5539 字节、同样的 "XLSX format"，第二次还
额外触发了一条 `Uncaught (in promise)`。用 `URL.createObjectURL` 拦截确认
（虽然这次没直接抓到这条特定调用用的哪种下载机制，但字节数和格式标签本身
已经是决定性证据）：**"Print to PDF" 产出的不是 PDF，是原始 xlsx 格式的
文件**，用户点了"导出 PDF"，实际拿到的是一个换了皮的 Excel 文件。

### 根因

顺着 `Saving v9 binary ... as XLSX format` 这行日志找到
`lib/onlyoffice-editor.ts` 里 `handleSaveDocument` 的 v9 分支
（约 665-669 行）：

```ts
if (event.data instanceof ArrayBuffer) {
  binaryData = new Uint8Array(event.data);
  const ext = (fileName?.split('.').pop() || 'docx').toUpperCase();
  targetFormat = fileName?.toLowerCase().endsWith('.csv') ? 'CSV' : ext;
  // ...
}
```

`targetFormat` 完全是从**原始文件名的扩展名**推出来的，跟用户实际点了
哪个按钮（Print to PDF / Save / 普通 Print）毫无关系。对照 v7 的分支
（676 行）：

```ts
targetFormat = fileName?.toLowerCase().endsWith('.csv') ? 'CSV' : c_oAscFileType2[option.outputformat];
```

v7 是从事件自带的 `option.outputformat` 读取真正的目标格式——v7 的
`onSave` 事件本身就带着这个信息。v9 的 `onSaveDocument` 事件只传一个裸
`ArrayBuffer`，**没有任何格式信息**，所以 v9 这边只能靠猜（用原文件的
扩展名当替身），猜的结果自然跟用户实际请求的格式对不上。

再往上追一层，找到为什么 v9 的 `onSaveDocument` 会丢失格式信息——同一个
文件里稍早的 `runWebModeOnAppReady`（就是这次会话早前为了修 Excel"新建
文档零操作就无限保存循环"那个 bug 加的补丁，详见
[2026-08-09 excel-autosave-infinite-loop 文档](2026-08-09-v9-excel-autosave-infinite-loop.md)）：

```ts
const triggerSave = () => {
  if (documentContentReady) {
    return a[triggerName]?.call(a, true);
  }
  // ...
};
if (typeof a.asc_Save === 'function') a.asc_Save = triggerSave;
if (typeof a.asc_DownloadAs === 'function') a.asc_DownloadAs = triggerSave;
```

`asc_DownloadAs` 在真实的 SDK 里是一个**接受目标格式参数**的方法
（比如 `asc_DownloadAs({fileType: AscCommon.c_oAscFileType.PDF})`），是
"Print to PDF"/"Export to PDF"这些功能内部实际调用的入口。这个补丁把
`asc_DownloadAs` 整个换成了一个**不接受、也不透传任何参数**的
`triggerSave`——不管调用方传了什么目标格式，`triggerSave` 一律只调用
`a[triggerName]?.call(a, true)`（`Ncj`/`DOj`/`mTi`，各引擎自己的"离线
保存触发器"），而这几个触发器只会把文档序列化成**它自己引擎原生的格式**
（word 引擎序列化出 docx，cell 引擎序列化出 xlsx，slide 引擎序列化出
pptx），从设计上就不支持"序列化成别的格式"这件事。

**这不是一个孤立的新 bug，是早前那次修复的一个副作用，当时没有预料到**：
那次修复的注释里明确写了"Deliberately does NOT also override the raw
low-level names... Overriding only the public asc_Save/asc_DownloadAs
entry points still covers every user-facing save path"——**当时验证的
"every user-facing save path"指的是"保存成原格式"这条路（工具栏 Save
按钮、`requestSaveDocument()`），没有覆盖到"转换成别的格式再保存"这条
语义完全不同的路**（Print to PDF、Export to PDF，大概率也包括"另存为其它
格式"）。

### 影响范围

- **确认受影响**：Excel 的 "Print to PDF"（现场复现两次，稳定复现，
  5539 字节，标记为 XLSX）。**Word 也已现场复现**：直接调用
  `api.asc_DownloadAs({...请求 PDF...})` 模拟"Export to PDF"，日志显示
  `Saving v9 binary 34424 bytes as DOCX format`——同样完全忽略了请求的
  PDF 格式，按原格式（DOCX）保存。两个编辑器复现出的现象完全一致，印证了
  "`asc_DownloadAs` 补丁是三个编辑器共用同一段代码"这个根因判断。
- **推测同样受影响，未逐一验证**：PPT 的 Print to PDF / Export to PDF
  （用的是同一段共用补丁代码，Word 和 Excel 都已复现，没有理由 PPT
  例外）；如果存在"另存为其它格式"这类功能，理论上也会受影响。
- **确认不受影响**：落地页上独立的".XLSX → .CSV Convert between formats"
  这类功能——那些是应用自己的、走 `document-converter.ts`/x2t 转换器的
  独立页面，不经过编辑器内的 `asc_DownloadAs`，是完全不同的代码路径。

### 为什么这次没有动手修

这不是一个可以像其它这次会话里发现的 bug 一样"改一行、验证一下"就能
解决的小问题——需要重新设计 `asc_DownloadAs` 的补丁，让它能区分"这是一次
普通保存"和"这是一次要求转换成 PDF/别的格式的保存"两种语义完全不同的
调用，前者继续走现有的 `triggerSave`（保留 Excel 无限循环那个已验证的
修复），后者需要一条全新的、真正支持格式转换的路径（可能需要复用应用
自己已有的 x2t 转换器逻辑，把 v9 引擎序列化出的原生二进制转换成目标格式，
类似 `document-converter.ts` 现在做的事，但触发时机和调用约定都不一样）。
这次判断为"发现问题、记录清楚根因，不在这轮排查里现场设计和验证一个新的
架构性修复"，留给下一轮专门处理。

### 遗留

- Word 已复现（见上文"影响范围"），PPT 还没有单独复现，但架构上没有理由
  例外。
- 没有验证"Export to PDF"（File 菜单里那个，跟 Print 面板里的 "Print to
  PDF" 是不是同一个入口）是否受影响——大概率是，但没有单独点一遍确认。
- 没有检查这个问题在 v7 是否存在——从代码看 v7 的 `onSave` 事件本身就带
  `option.outputformat`，理论上不会有这个问题，但没有专门在 v7 上复现
  "Print to PDF"操作来交叉确认。
- 第二次点击 "Print to PDF" 时出现的 `Uncaught (in promise)` 没有深入
  排查具体原因（可能是连续触发保存时某个 promise 链没有被正确处理，
  也可能是这次测试环境本身在长时间会话后偶尔出现的干扰噪声）。

## 对"v9 是否可以直接替换 v7 上线"这个问题的当前判断

**新增一个需要认真权衡的因素**：如果 "Export to PDF" 这类功能对用户来说
是常用/重要的功能，这个问题应该在替换上线前修复或者至少明确下线（不建议
让用户点一个"导出 PDF"的按钮，实际却悄悄拿到一个换皮的原格式文件——这是
一种比"完全不工作、报错"更危险的失败模式，因为它不会让用户第一时间意识到
出了问题）。如果这个功能使用频率很低、或者可以先在 UI 上临时隐藏/禁用
相关按钮，则不必阻塞这次的上线决定。建议跟用户确认这个功能的实际重要程度
再做决定。
