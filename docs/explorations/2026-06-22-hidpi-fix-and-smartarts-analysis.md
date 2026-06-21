# HiDPI 修复 & SmartArts.bin 分析

**日期**：2026-06-22  
**关联 Issue**：[#15 Blurry icons on HiDPI](https://github.com/ranuts/document/issues/15)、[#92 Excel cursor not moving](https://github.com/ranuts/document/issues/92)、[#12 Cursor position offset](https://github.com/ranuts/document/issues/12)、[#20 SmartArts.bin missing](https://github.com/ranuts/document/issues/20)

---

## HiDPI 修复（#15 / #92 / #12）

### 根因

v9 的 `onlyoffice-iframe-patch.js` 中：

```js
// 修复前
GetSupportedScaleValues: noopArr,  // returns []
```

SDK 代码逻辑（三种编辑器 `app.js` 中均存在）：

```js
r = [1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.5, 4, 4.5, 5];  // 默认值
c = 0 !== (r =
  l.AscDesktopEditor && l.AscDesktopEditor.GetSupportedScaleValues
    ? l.AscDesktopEditor.GetSupportedScaleValues()
    : r).length
  && ...
```

当 polyfill 定义了 `AscDesktopEditor.GetSupportedScaleValues` 但返回 `[]` 时：
- `r = []`（空数组）
- `c = 0 !== 0` → `c = false`
- `AscCommon.checkDeviceScale()` 判定 `correct: false`
- 跳过所有 DPR（Device Pixel Ratio）校正
- 结果：图标模糊（#15）、光标位置偏移（#12）、Excel 光标不移动（#92）

### v7 为何不受影响

v7 中 `window.AscDesktopEditor` 根本不存在，SDK 的条件判断 `l.AscDesktopEditor && ...` 为 false，直接使用默认值 `[1, 1.25, ..., 5]`，HiDPI 正常工作。

### 修复

`apps/web/public-v9/onlyoffice-iframe-patch.js` line 115：

```js
// 修复后：返回完整的缩放比例数组，与 SDK 默认值一致
GetSupportedScaleValues: function () { return [1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.5, 4, 4.5, 5]; },
```

---

## SmartArts.bin 分析（#20）

### 问题

v7 SDK（`sdk-all-min.js`，word/cell/slide 三个编辑器）在加载 SmartArt 形状时发起 HTTP 请求：

```js
'../../../../sdkjs/common/SmartArts/SmartArts.bin'
// 解析为：/sdkjs/common/SmartArts/SmartArts.bin
```

`public-v7/sdkjs/common/SmartArts/` 目录和 `SmartArts.bin` 文件均不存在 → 404 → SmartArt 形状不渲染。

### 调查过程

**Docker 镜像对比**（测试了 v7.5.0 和 v7.5.1）：

官方 Docker 镜像的 `sdkjs/common/SmartArts/` 使用 **目录结构**：
```
SmartArts/
  SmartArtData/     ← 151 个独立 .bin 文件（每种 SmartArt 类型一个）
  SmartArtDrawing/
    SmartArtDrawings.bin
```

而我们本地 v7 的 `sdk-all-min.js` 请求的是 **单一文件** `SmartArts.bin`。两种格式完全不同：
- Docker SDK 的代码不引用 `SmartArts.bin`（使用目录结构加载）
- 我们的 SDK 引用 `SmartArts.bin`（单文件格式）

这意味着我们的 v7 `sdk-all-min.js` 来自一个与 Docker 镜像不同的特殊构建版本，两者的 SmartArt 加载机制不同。

**二进制格式分析**（v7 word `sdk-all-min.js`）：

```js
t = AscCommon.mDc(t);  // 将 XHR response 转为 Uint8Array
AscCommon.kjb = { PWe: {}, stream: t };
(t = new AscCommon.dta(t, t.length)).gb();   // 读 1 字节（格式版本）
const o = t.Dd();                             // 读 4 字节 LE int（条目数）
while (o + 4 > t.Sb) {                       // 循环读取索引表
  const e = t.gb();                           // 读 1 字节：SmartArt 类型 ID
  const o = t.Dd();                           // 读 4 字节：数据偏移量
  AscCommon.kjb.PWe[e] = o;
}
e && e();  // 成功回调
```

### 临时修复

创建最小有效的 `SmartArts.bin`（5 字节全零）：

- 字节 0：`0x00`（格式版本字节，被 `gb()` 读取后丢弃）
- 字节 1-4：`0x00 0x00 0x00 0x00`（`Dd()` 读为 int32 = 0 = 条目数）
- while 条件：`0 + 4 > 5` → `false` → 循环不执行
- 成功回调 `e()` 被调用

效果：SDK 不再 404、不触发错误回调、SmartArt 形状静默失败（不渲染）而非报错。

文件路径：`apps/web/public-v7/sdkjs/common/SmartArts/SmartArts.bin`（5 bytes, 全零）

### 已知限制

SmartArt 形状**仍然不会渲染**（空数据）。要真正修复此问题，需要：
1. 获取与我们本地 v7 `sdk-all-min.js` 同一构建版本的 `SmartArts.bin` 文件
2. 或将 v7 SDK 替换为与 Docker 镜像完全对齐的版本（使用目录结构）

**v9 状态**：v9 使用独立文件格式（`SmartArtData/*.bin` + `SmartArtDrawing/SmartArtDrawings.bin`），文件已存在于 `public-v9/`，SmartArt 功能正常。

---

## 结论

| Issue | 版本 | 状态 |
|---|---|---|
| #15 图标模糊（HiDPI）| v9 | ✅ 已修复（`GetSupportedScaleValues` 返回正确数组）|
| #12 光标位置偏移 | v9 | ✅ 已修复（同上，DPR 校正启用）|
| #92 Excel 光标不移动 | v9 | ✅ 已修复（同上）|
| #15/#12/#92 | v7 | ✅ 本就正常（无 polyfill，SDK 自用默认值）|
| #20 SmartArts.bin | v7 | ⚠️ 部分修复（404 消除，形状仍不渲染）|
| #20 SmartArts | v9 | ✅ 文件存在，功能正常 |
