# PPTX GIF 动画无法播放的根因分析

**日期**：2026-06-21  
**关联 Issue**：[#94 Two animation-related bugs in PPTX](https://github.com/ranuts/document/issues/94)  
**影响版本**：v7.5.0 (stable) / v9.3.0 (beta)

---

## 现象

在包含嵌入 GIF 图片的 PPTX 中（如 `Copy of HTTP3分享.pptx`），第1页的 `image10.GIF`、`image11.GIF` 在编辑器中显示为静态图片，动画不播放。

---

## 根因

### SDK 内部 PNG 缓存机制

在 `sdkjs/slide/sdk-all.js` 中，SDK 加载图片时会做一次 canvas 中转：

```js
D = document.createElement("canvas")
D.width = w.width
D.height = w.height
D.getContext("2d").drawImage(w, 0, 0, D.width, D.height)
w = D.toDataURL("image/png")   // ← GIF 动画在此处被永久转为 PNG
```

完整渲染链路：

```
blob URL (image/gif)
  → HTMLImageElement.src = blob URL        ← 我们提供了正确的 GIF blob
  → SDK 创建临时 canvas
  → ctx.drawImage(gifImg, 0, 0, w, h)     ← 只捕获当前帧（第 0 帧）
  → canvas.toDataURL("image/png")          ← 转成静态 PNG data URL
  → 缓存进 SDK 图片池（this.OU.Qx）
  → 主 canvas.drawImage(缓存的 PNG)        ← 所有后续渲染使用 PNG
```

`canvas.drawImage()` 是标准 HTML5 Canvas 行为：它只捕获动画 GIF 在调用瞬间的当前帧，不会持续刷新。加上 SDK 主动调用 `toDataURL("image/png")`，GIF 第一次被读取时就永久丢失了动画信息。

这不是我们的 polyfill 或 blob URL 映射的问题。即使提供完全正确的 `image/gif` MIME 类型的 blob URL，SDK 也会在内部把它转为静态 PNG。

### v7 额外问题：x2t 也可能转换 GIF

v7 在打开 PPTX 时先经过 x2t（WASM）将 PPTX 转为内部 PPSY 格式：

```
原始 PPTX (含 image10.GIF)
  → x2t WASM 转换
  → /working/media/ 中可能产出 image10.png（GIF 被 x2t 转成 PNG）
  → asc_setImageUrls 映射
  → SDK 渲染（同上，canvas.drawImage）
```

x2t 是否转换 GIF 取决于 PPSY 格式是否支持 GIF，目前未能直接验证，但已通过「先从原始 PPTX ZIP 提取 GIF → 按 basename 覆盖 x2t 输出」来绕过这层风险。

---

## 已实施的修复

**v7 `packages/editor-v7/src/document-converter.ts`（commit a1694f0）：**

1. `readMediaFiles()` 新增 MIME 类型：`new Blob([data], { type: 'image/gif' })`，确保 GIF 文件有正确 MIME 类型。
2. 对 PPTX 文件，在 x2t 转换**前**先用 `extractDocxMediaUrls()` 从原始 ZIP 提取所有 GIF，转换**后**按 basename 覆盖（若 x2t 把 `image10.GIF` 改名为 `image10.png`，仍能将正确 GIF blob 提供给 SDK）。

这两个修复解决了数据层的问题（blob 有正确 MIME、GIF 数据不被 x2t 丢失），但无法解决 SDK 渲染层的限制。

---

## 理论上可行的进一步修复

### 方案 A：双重拦截 drawImage + toDataURL（高风险）

在 `onlyoffice-iframe-patch.js` 中：

```js
// 1. 拦截 drawImage，记录哪些 canvas 画过 GIF
const gifCanvases = new WeakMap(); // canvas → { img, args }

const origDraw = CanvasRenderingContext2D.prototype.drawImage;
CanvasRenderingContext2D.prototype.drawImage = function(src, ...args) {
  if (src instanceof HTMLImageElement && isGifSrc(src.src)) {
    gifCanvases.set(this.canvas, { img: src, args });
  }
  origDraw.apply(this, [src, ...args]);
};

// 2. 拦截 toDataURL，对来自 GIF 的 canvas 返回原始 GIF blob URL
const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
HTMLCanvasElement.prototype.toDataURL = function(type) {
  const info = gifCanvases.get(this);
  if (type === 'image/png' && info) {
    return info.img.src; // 返回原始 GIF blob URL，阻止 PNG 转换
  }
  return origToDataURL.apply(this, arguments);
};
```

**风险**：SDK 在许多地方合法调用 `toDataURL`（缩略图、裁剪、主题），误判会导致其他图片损坏。需要谨慎限定条件（如只在临时创建的、尺寸精确匹配 img 的 canvas 上生效）。

### 方案 B：验证演示模式（Slideshow）是否用 img 渲染

OnlyOffice 的 slideshow 播放模式可能走不同渲染路径（DOM `<img>` 而非 canvas），GIF 会自动动。待实际测试验证。

### 方案 C：不修（设计取舍）

大多数主流文档编辑器（Word、Google Docs）在编辑视图中也不播放 GIF，只在演示/预览模式播放。若 slideshow 模式能播放，这属于合理的设计边界。

---

## Bug #2：多动画合并为单次播放

PPTX 中多个 `<p:seq>` 动画序列在 v7 中被合并为一次点击触发。

**根因**：x2t 在 PPTX → PPSY 转换时可能合并 `<p:seq>` 节点。v9 因直接使用 `asc_openDocumentFromBytes` 读取原始 OOXML，不经过 x2t，动画序列由 SDK 按 PPTX XML 原始结构处理，理论上更准确。

**当前状态**：v7 无法在 JS 层修复（x2t WASM 内部行为）；v9 待验证。

---

## 结论

| 问题 | v7 状态 | v9 状态 | 可修复性 |
|---|---|---|---|
| GIF 转 PNG（blob 层） | 已修复 | 原本就正确 | ✅ 已修 |
| GIF 不动画（SDK canvas 渲染） | 未修复 | 未修复 | ⚠️ 需 SDK patch（方案 A）|
| 多动画序列合并 | x2t 限制，无法修 | 待验证 | ❌ v7 / ? v9 |
