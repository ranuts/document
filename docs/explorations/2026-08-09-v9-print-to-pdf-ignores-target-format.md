# v9："Print to PDF" 等格式转换类保存曾悄悄按原格式保存（已修复并验证）；修复后暴露出 x2t 转 PDF 本身会失败（未修复，新问题）；开真实文件验证通过

日期：2026-08-09 ～ 2026-08-10
分支：feat/v9-web-mode
状态：**"请求的格式被忽略"这个 bug 已修复并现场验证**（Excel 上确认
`Saving v9 binary ... as PDF format`，不再是 XLSX）；**修复过程中意外暴露出
一个更深层、此前完全没被触发过的问题**——x2t 把 v9 引擎序列化出的 `.bin`
实际转换成 PDF 时会失败（错误码 80），这个新问题**未修复**，需要单独排查。
开真实文件（不是新建文档）这一项验证通过，无问题。

## 背景

用户问"还有其他问题吗"，继续排查。先验证了一直没测过的"打开真实文件"
（而不是每次都用 `?new=xlsx` 这种全新空白文档），然后顺手测了一下打印
预览里的 "Print to PDF" 按钮，发现它悄悄按原格式保存，不是真的转成 PDF。
用户要求继续修复，这次的记录就是修复过程和修复后暴露出的新问题。

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

## "Print to PDF" 悄悄按原格式保存——已定位根因并修复

### 复现（修复前）

打开一个有数据的 xlsx 文件，File -> Print -> 点 "Print to PDF"。控制台
打出：

```
Save document event: [object Object]
Saving v9 binary 5539 bytes as XLSX format
```

明明点的是"Print to PDF"，日志却说存成了 "XLSX format"。Word 上模拟同样
操作（直接调用 `api.asc_DownloadAs({...请求 PDF...})`）也复现：
`Saving v9 binary 34424 bytes as DOCX format`。用户点了"导出 PDF"，实际
拿到的是一个换了皮的原格式文件，而且**没有任何报错提示**——比"完全不
工作"更危险的失败模式。

### 根因

`lib/onlyoffice-editor.ts` 里 `handleSaveDocument` 的 v9 分支，`targetFormat`
完全是从**原始文件名的扩展名**推出来的，跟用户实际点了哪个按钮
（Print to PDF / Save / 普通 Print）毫无关系。往上追一层，发现是早前为修
"Excel 新建文档零操作就无限保存循环"那个 bug 加的补丁（详见
[2026-08-09 excel-autosave-infinite-loop 文档](2026-08-09-v9-excel-autosave-infinite-loop.md)）
的一个副作用：`asc_DownloadAs`（真实 SDK 里本该带着"转成什么格式"这个
参数的方法）被整个换成了一个不接受任何参数的通用保存触发器，导致"转成
PDF"这个请求在半路就被丢弃了。

### 修复

在 `handleSaveDocument` 里新增一个模块级状态 `pendingDownloadAsFormat`，
由 `asc_DownloadAs` 的包装函数在触发保存**之前**设置，v9 分支的
`targetFormat` 计算优先读取这个值（读到就清空，避免残留污染下一次不相关
的保存；`asc_Save`——纯保存、从不携带格式请求——也会主动清空它，防止一次
被取消的 `asc_DownloadAs` 请求残留下来污染后面一次普通 Save）。

难点在于**怎么从 `asc_DownloadAs(options)` 的 `options` 参数里读出真正
请求的格式**。`Asc.asc_CDownloadOptions` 这个类完全没有公开的 getter
（现场确认整条原型链只有 `asc_set*` 方法），数值存在一个内部属性上，而且
**这个内部属性名在不同调用路径下不一样**——现场直接构造一个实例得到
`{oV: 513, ...}`，但 Print 面板自己内部构造的实例（同一个类，`instanceof`
确认过）却是 `{V_: 513, ...}`——大概率是 Print 面板的 UI 代码跟 SDK 主体
分属不同的压缩产物分片，各自独立压缩出了不同的属性名。读任何一个具体
属性名都不可靠。

最终方案：不读内部字段，改成**包一层构造函数**——`asc_CDownloadOptions`
被替换成一个包装类，`Reflect.construct` 出真正的实例后，把构造函数收到
的**第一个参数**（现场从 app.js 里 grep 到的每一处调用都是
`new Asc.asc_CDownloadOptions(fileType, ...)`，格式常量永远是第一个参数）
打到实例自己控制的属性上——彻底绕开"内部字段叫什么名字"这个问题，也不怕
压缩器以后再改名字。

### 验证

现场用真实的 "File -> Print -> Print to PDF" 完整走了一遍：

- 修复前：`Saving v9 binary 5539 bytes as XLSX format`。
- 修复后：`Saving v9 binary 4003 bytes as PDF format`——**格式识别本身
  已经完全正确**。
- 中途排查用的临时调试手段（直接监视真实点击触发的 `asc_DownloadAs`
  调用、打印 `options` 对象的自有属性）确认了上面提到的属性名不一致这个
  现象是真实存在的，不是猜测。
- `pnpm run lint:ts`、`pnpm run format:check`、`pnpm run build:v9`
  全部通过。
- 新增的两个纯函数（`patchDownloadOptionsFileTypeCapture`、
  `extractRequestedDownloadFormat`）已导出并补了单元测试（覆盖：正常打标签
  取值、不破坏原构造行为、重复打补丁不会套娃、各种异常输入都优雅回退到
  `null`），`pnpm run test:coverage` 310 个测试全过，覆盖率阈值达标。

## 修复后暴露出的新问题：x2t 把 v9 的 `.bin` 转成 PDF 时会失败（错误码 80，未修复）

### 现象

格式识别修好之后，"Print to PDF" 不再静默存错格式了，但也没能真的产出
PDF——控制台紧接着报出：

```
Conversion failed. Parameters XML: ...
  <m_sFileFrom>/working/New_Document.bin</m_sFileFrom>
  <m_sFileTo>/working/New_Document.pdf</m_sFileTo>
  <m_sFontDir>/working/fonts/</m_sFontDir>
...
Uncaught (in promise)
```

直接重放同一份 `params.xml` 调用 `x2tModule.ccall('main1', ...)`，拿到的
返回码是 **80**（`packages/converter/src/document-converter.ts` 里
`executeConversion` 已知的错误码提示表只覆盖了 88/55/1，不包含 80，
这次没能查到 80 具体对应什么原因）。

### 这不是这次修复引入的新 bug，是一个此前从未被真正触发过的既有问题

在这次修复之前，"Print to PDF"（以及任何"转换成别的格式"的保存）从来没有
真的把 v9 序列化出的 `.bin` 送进 x2t 转换成目标格式过——因为 `targetFormat`
一直被错误地设成"原格式"，而"转成同一种格式"这种转换要么走了另一条更简单
的路径、要么本来就是 x2t 擅长的场景，从未失败过，所以这个更深层的问题一直
被那个格式识别的 bug 挡在外面，没人见过。这次修复让格式识别对了，"转成
PDF"这个请求第一次真的被送到 x2t 面前，才第一次暴露出 x2t 本身处理不了
v9 引擎输出的这份 `.bin`。

从积极的角度看：**这次修复让失败方式变得诚实了**——以前是"什么都不说，
悄悄给你一个换皮的错误文件"，现在是"明确地转换失败，产生一个可以在控制台
看到的报错"（虽然目前还是一个未被前端妥善捕获的 uncaught rejection，用户
界面上不会弹出提示，这也是一个可以顺手改进但这次没有动手的点）。

### 遗留（下一步排查方向）

- 错误码 80 具体代表什么，需要进一步排查（x2t 是 OnlyOffice 官方的转换
  引擎，理论上会有一份错误码对照表，这次没有找到/查证）。
- 没有确认这个转换失败是 v9 特有的（比如 v9 引擎序列化出的 `.bin` 内部
  格式跟 v7/x2t 原生预期的 `.bin` 有细微差异），还是 x2t 转 PDF 这条路径
  本身存在更通用的问题（比如字体目录 `/working/fonts/` 里实际有的字体
  文件不够、某种资源缺失）——网络面板确认了 `DejaVuSans.ttf` /
  `DejaVuSans-Bold.ttf` / `LiberationSans-Regular.ttf` 这几个核心字体
  确实成功加载了，所以"完全没有字体"不是原因，但没有进一步排查是不是
  缺了某个更具体的资源。
- 没有测试 Word/PPT 上是否复现同样的错误码 80（Excel 上已确认复现，
  架构上 bin->PDF 转换这条路径是三个编辑器共用的同一段 x2t 代码，没有
  理由例外，但没有逐一验证）。
- `handleSaveDocument` 调用 `convertBinToDocumentAndDownloadFn` 时没有
  自己的 try/catch，转换失败会变成一个未被捕获的 promise rejection——
  这是修复之前就存在的既有行为（任何转换失败都会这样，不是这次新引入
  的），只是之前从未被触发过。给这里补一层错误处理、在界面上给用户一个
  提示（而不是静默的控制台报错），是一个值得做但这次没有顺手做的改进。

## 对"v9 是否可以直接替换 v7 上线"这个问题的当前判断

**这次修复本身是纯粹的改进**（消除了"用户以为导出了 PDF、实际拿到错误
格式文件"这种最危险的静默失败模式），但同时也说明**"Print to PDF"这个
功能在 v9 上实际还是不能用**——只是从"悄悄给错文件"变成了"明确转换失败"。
如果这个功能对用户重要，仍然需要先排查清楚错误码 80 的真正原因才能真正
可用；如果这个功能使用频率很低，可以考虑在 UI 上先临时隐藏"转换成 PDF/
其它格式"这一类按钮（仅保留"另存为原格式"），把这次的格式识别修复保留
下来（消除了静默给错文件的风险），但把"格式转换"这个功能本身标记为
"v9 上暂不可用"，避免用户遇到一个不明不白的失败。建议跟用户确认这个功能
的实际重要程度、以及是否值得投入时间继续排查错误码 80。
