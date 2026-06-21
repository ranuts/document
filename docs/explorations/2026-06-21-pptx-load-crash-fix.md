# PPTX 加载崩溃修复：三个并发 Bug 的根因分析

**日期：** 2026-06-21  
**分支：** `explore/path-d-desktop-mock`  
**提交：** `d46d3be`  
**影响文件：** `src/lib/docx-zip.ts`、`src/lib/onlyoffice-editor.ts`

---

## 一、问题现象

用户的 7 个 PPTX 文件中，以下 3 个无法加载，控制台抛出 `Uncaught (in promise) TypeError`：

| 文件 | 大小 | 有 app.xml | 有 core.xml |
|------|------|-----------|------------|
| `GoldVideo.pptx` | 1.5 MB | ❌ | ✅ |
| `2022_09_06_TypeScript_Primer_by_Bosn.pptx` | 34 MB | ❌ | ✅ |
| `EMP 微前端解决方案.pptx` | 6.3 MB | ❌ | ❌ |

共同特征：均由非 Microsoft Office 工具导出（Keynote / WPS / Impress），且所有 ZIP 条目均使用 **data descriptor 模式**写入（local header 中 crc=0、sizes=0，bit 3 标志位置 1）。

另外 4 个文件（HTTP3分享、述职PPT 等）能正常打开，它们都有 `docProps/app.xml`。

---

## 二、崩溃栈分析

### 第一个崩溃（预处理前）

```
Uncaught (in promise) TypeError: this.l8a is not a function
  at rd.Zf (sdk-all.js:17523:272)
```

**定位：** `sdk-all.js` 第 17523 行，`rd.prototype.Zf` 是 notes slide（备注页）的 XML 属性处理器。当遇到 `showMasterPhAnim` 属性时，它调用 `this.l8a(K$(Ea))`，但 `l8a()` 只定义在 `Slide` 和 `SlideLayout` 的原型链上，**notes 类没有这个方法**。

```javascript
// sdk-all.js line 17523（notes slide 解析器）
rd.prototype.Zf = function(Ea) {
  // ...
  case "showMasterPhAnim": this.l8a(K$(Ea)); break;  // ← 崩溃：l8a 未定义
}

// sdk-all.js line 11242（只在 Slide/SlideLayout 上定义）
v.l8a = function(a) {
  History.ha(new AscDFH.nh(this, AscDFH.h2e, this.q_, a));
  this.q_ = a;
};
```

`showMasterPhAnim` 控制备注视图中是否显示母版动画，纯视觉属性，删除不影响文档内容。

**关键陷阱：** notes slide XML 在 ZIP 里是 DEFLATE 压缩（method=8），在原始 ZIP 字节中无法找到 `showMasterPhAnim` 明文字符串——必须先解压才能扫描。

### 第二个崩溃（修复第一个崩溃后暴露）

```
Uncaught (in promise) TypeError: Cannot read properties of null (reading 'Ty')
  at f.$Nf (sdk-all-min.js:1815:146)
  at f.FJh (sdk-all-min.js:1816:133)
  at f.uwb (sdk-all-min.js:1898:457)
```

**定位：** `f.$Nf` 执行 `oa = S.Ty()`，其中 `S = H.DH(ha.kh.t_c.Bh)`。

- `ha.kh.t_c` 是 `extended-properties` 关系类型描述符
- `ha.kh.t_c.Bh = "docProps/app.xml"` — SDK 期望从 ZIP 读取这个文件
- `H.DH("docProps/app.xml")` 返回 `null`，因为**文件根本不存在于 ZIP 中**

```python
# 验证：用 Python 检查崩溃文件
with zipfile.ZipFile('GoldVideo.pptx') as z:
    print('docProps/app.xml' in z.namelist())  # → False
```

`docProps/app.xml` 在 OOXML 规范中是**可选**文件，但 OnlyOffice 9.3.0 SDK 假定它总是存在。

同时，`_rels/.rels` 中也没有指向 `app.xml` 的关系条目：

```xml
<!-- GoldVideo.pptx 的 _rels/.rels（只有 2 个关系，无 extended-properties） -->
<Relationships>
  <Relationship Id="rId1" Type=".../core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId2" Type=".../officeDocument" Target="ppt/presentation.xml"/>
</Relationships>
```

### 潜在的第三个问题：ZIP data descriptor 导致 local header 尺寸为 0

```python
# 检查第一个 local file header
flags = struct.unpack_from('<H', data, 6)[0]
crc   = struct.unpack_from('<I', data, 14)[0]
csz   = struct.unpack_from('<I', data, 18)[0]
# → flags=0x0808 (bit 3 set)  crc=0  csz=0
```

**所有 124 个 ZIP 条目**的 local file header 都有 `crc=0, compressedSize=0, uncompressedSize=0`。这是 ZIP 流式写入模式（general purpose bit 3）：实际尺寸附在数据之后的 data descriptor 中，不在 local header 里。

旧版 `rewriteZipEntries` 对**未修改条目**直接复制原始字节（包含 crc=0 的 local header），对已修改条目写新 local header。这在 bit 3 的情况下会产生矛盾结构：

```
重建后的 ZIP：
  未修改条目: [local header: csz=0, bit3=1] [压缩数据] [没有 data descriptor！]
  已修改条目: [local header: csz=正确, bit3=0] [未压缩数据]
```

ZIP 阅读器看到 bit3=1 后会期待 data descriptor，但数据之后直接是下一个条目的 `PK\x03\x04`，解析失败。

---

## 三、修复方案

所有修复合并为 `preprocessPptx()` 函数，在 `asc_openDocumentFromBytes` 之前对 PPTX 进行单次 ZIP 重建。

### 3.1 修复一：剥离 showMasterPhAnim

从 `ppt/notesSlides/*.xml` 和 `ppt/notesMasters/*.xml` 中删除该属性：

```typescript
(xml) => {
  if (!xml.includes('showMasterPhAnim')) return null;
  const next = xml.replace(/ showMasterPhAnim="[^"]*"/g, '');
  return next !== xml ? next : null;
}
```

注意：检查必须在 DEFLATE 解压后进行，不能对原始 ZIP 字节扫描。

### 3.2 修复二：注入 docProps/app.xml 并更新 _rels/.rels

检测 `docProps/app.xml` 是否存在：

```typescript
function checkZipHasEntry(bytes: Uint8Array, targetName: string): boolean {
  // 扫描 central directory，O(n) 遍历条目名
}
```

若不存在：

1. 注入最小有效 `app.xml`：

```xml
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
  <Application>Microsoft Office PowerPoint</Application>
</Properties>
```

2. 修改 `_rels/.rels`，追加 `extended-properties` 关系（自动选择不冲突的 rId）：

```typescript
let n = 1;
while (xml.includes(`"rId${n}"`)) n++;
const rel =
  `<Relationship Id="rId${n}" ` +
  `Type=".../extended-properties" ` +
  `Target="docProps/app.xml"/>`;
return xml.slice(0, lastClosingTag) + rel + xml.slice(lastClosingTag);
```

### 3.3 修复三：重建 ZIP 时写正确的 local file header

**核心改动**：对所有条目（含未修改）都写全新的 local file header，尺寸和 CRC 取自 central directory（CD 在流式写入完成后填入了正确值）。

```typescript
// 旧代码（有问题）：直接复制原始字节（含 bit3=1 的 local header）
const end = entry.dataStart + entry.compressedSize;
chunks.push(bytes.slice(entry.localOffset, end));

// 新代码（正确）：用 CD 中的值写新的 local file header
const hdr = new Uint8Array(30 + entry.nameBytes.length);
const dv = new DataView(hdr.buffer);
dv.setUint32(0, 0x04034b50, true);
dv.setUint16(6, 0, true);                    // bit 3 清零
dv.setUint16(8, entry.compression, true);    // 保留原始压缩方式（0 或 8）
dv.setUint16(10, entry.modTime, true);       // 时间戳（从 CD 读取）
dv.setUint16(12, entry.modDate, true);
dv.setUint32(14, entry.crc, true);           // 正确的 CRC（从 CD 读取）
dv.setUint32(18, entry.compressedSize, true);
dv.setUint32(22, entry.uncompressedSize, true);
dv.setUint16(26, entry.nameBytes.length, true);
// extra field length = 0（省略，CD 中的额外字段与 local 无关）
hdr.set(entry.nameBytes, 30);
chunks.push(hdr);
chunks.push(bytes.slice(entry.dataStart, entry.dataStart + entry.compressedSize));
```

`ZipEntry` 接口新增三个字段（从 CD 读取）：

```typescript
interface ZipEntry {
  // 新增
  uncompressedSize: number; // CD offset 24
  modTime: number;          // CD offset 12
  modDate: number;          // CD offset 14
  // 原有字段...
}
```

### 3.4 rewriteZipEntries API 扩展

新增 `inject` 参数，支持向 ZIP 末尾追加全新条目（STORED 方式存储）：

```typescript
async function rewriteZipEntries(
  bytes: Uint8Array,
  shouldProcess: (name: string) => boolean,
  transform: (rawXml: string, name: string) => string | null,
  inject?: Array<{name: string; data: Uint8Array}>,
): Promise<Uint8Array>
```

`inject` 里的条目同样写入 central directory，EOCD 中的条目数相应增加。

---

## 四、效果验证

| 文件 | 修复前 | 修复后 |
|------|--------|--------|
| `GoldVideo.pptx` | ❌ TypeError: this.l8a is not a function | ✅ 18 张幻灯片正常显示 |
| `TypeScript_Primer_by_Bosn.pptx` | ❌ TypeError | ✅ 110 张幻灯片正常显示 |
| `EMP 微前端解决方案.pptx` | ❌ TypeError | ✅ 70 张幻灯片 + CJK 中文正确渲染 |

控制台关键日志序列（正常加载）：
```
[OO] PPTX preprocessed (showMasterPhAnim stripped, docProps/app.xml injected if missing)
[OO] asc_openDocumentFromBytes 1574255 bytes
[OO vite-patch] image redirect image1.png -> blob:...
[OO] presentation openedAt gate after 100 ms
Document loaded: test-gold.pptx
```

---

## 五、为何只有部分 PPTX 受影响

| 特征 | Keynote / WPS / Impress 导出 | Microsoft PowerPoint 导出 |
|------|------------------------------|--------------------------|
| `docProps/app.xml` | 常常缺失（规范允许省略） | 总是存在 |
| `_rels/.rels` 关系数 | 1–2 个 | 3 个（含 extended-properties）|
| ZIP 写入方式 | 流式写入（bit3=1，data descriptor）| 随机写入（bit3=0，local header 有正确尺寸）|
| `showMasterPhAnim` | 备注母版上常见 | 通常不写这个属性 |

---

## 六、与 `preprocessXlsxLineBreaks` 的关系

两个函数共用同一个 `rewriteZipEntries` 底层。XLSX 函数处于只读路径（不需要 inject），但同样受益于新版本对 data descriptor 的正确处理——若有 bit3=1 的 XLSX 文件，重建结果现在也是合法的 ZIP。

---

## 七、后续注意事项

1. **`docProps/core.xml` 也可能缺失**：`EMP 微前端解决方案.pptx` 连 `core.xml` 也没有，但 SDK 没有崩溃——说明 `core.xml`（核心属性）缺失时 SDK 有防御性处理，`app.xml` 缺失则没有。如果将来发现有 PPTX 在 `core.xml` 缺失时也崩溃，可以用同样的 inject 机制补。

2. **只处理 `.pptx`**：`preprocessPptx` 仅在 `fileType === 'pptx'` 时调用。DOCX 和 XLSX 没有这两个问题（SDK 对它们的 `docProps/app.xml` 缺失有不同处理路径）。

3. **ZIP64**：`rewriteZipEntries` 不支持 ZIP64（文件 > 4GB 或条目 > 65535 个）。实际中 PPTX 不会触到这个边界。

4. **data descriptor 签名差异**：ZIP 规范中 data descriptor 可以有签名 `PK\x07\x08`（4 字节）也可以没有，旧代码没有跳过它们（对未修改条目直接复制到 end = dataStart + compressedSize，不包含 data descriptor）。新代码完全不依赖 data descriptor，彻底绕过这个问题。
