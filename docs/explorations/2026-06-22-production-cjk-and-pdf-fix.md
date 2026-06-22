# 生产环境 CJK 字体修复 & PDF CJK 支持

**日期**：2026-06-22  
**关联**：#28（PDF 空白）、#62（日期不显示）、#64（右对齐不显示）

---

## 问题一：生产环境 CJK 字体仍然乱码

### 根因

`fontRemapMiddleware`（`apps/web/vite-plugins/font-remap.ts`）只在 Vite dev/preview 服务器运行时有效，通过 `configureServer`/`configurePreviewServer` Hook 拦截 HTTP 请求，把 `DejaVuSans.ttf` 等请求重定向到 `NotoSansSC-Regular.ttf`。

**GitHub Pages 是纯静态托管，没有中间件层**。生产构建产物 `dist/fonts/dejavusans.ttf` 仍然是原始 DejaVuSans（739KB），导致 split-brain 乱码问题在线上复现。

### 修复：`generateBundle` Rollup Hook

在 `fontRemapMiddleware` 中新增 `generateBundle()` 钩子，在构建阶段直接把映射后的字体内容写入 `dist/fonts/`：

```typescript
async generateBundle() {
  const map = await loadMap();
  const contentCache = new Map<string, Buffer>();
  for (const [src, dst] of Object.entries(map)) {
    if (dst.toLowerCase() === src) continue;
    let data = contentCache.get(dst);
    if (!data) {
      data = await fs.readFile(path.join(publicDir, 'fonts', dst));
      contentCache.set(dst, data);
    }
    this.emitFile({
      type: 'asset',
      fileName: `fonts/${src}`,
      source: new Uint8Array(data),
    });
  }
},
```

**效果**：`dist/fonts/dejavusans.ttf` 从 739KB（DejaVuSans 原文件）变为 10.1MB（NotoSansSC-Regular 内容），与 dev 环境行为完全一致。

---

## 问题二：PDF 导出 CJK 字体缺失

### 根因

`loadFontsForPdf()`（`packages/editor-v7/src/document-converter.ts` 和 `packages/editor-v9/src/document-converter.ts`）只加载了三个拉丁字体：

```typescript
const fontNames = ['DejaVuSans.ttf', 'DejaVuSans-Bold.ttf', 'LiberationSans-Regular.ttf'];
```

PDF 转换由 x2t WASM 完成，WASM 虚拟 FS 中没有 CJK 字体，导出的 PDF 中 CJK 文字显示为方块或不可见。

### 修复

在两个包的 `loadFontsForPdf()` 中追加 `NotoSansSC-Regular.ttf`：

```typescript
const fontNames = [
  'DejaVuSans.ttf',
  'DejaVuSans-Bold.ttf',
  'LiberationSans-Regular.ttf',
  'NotoSansSC-Regular.ttf',   // ← 新增，修复 CJK PDF 导出
];
```

PDF 转换时 `NotoSansSC-Regular.ttf`（10.1MB）通过 `fontRemapMiddleware` 透明转发，WASM 内部用此字体渲染 CJK 字符。

---

## 问题三：v7 字体映射使用 VF（可变字体）

### 根因

`apps/web/public-v7/font-map.json` 中 CJK 字体映射目标是 `NotoSansSC-VF.ttf`（可变字体，16.9MB）。FreeType 对可变字体的渲染稳定性较低，在某些文档场景下会有字形抖动。

v7 的 `public-v7/fonts/` 目录原本也没有 `NotoSansSC-Regular.ttf`（只有 v9 有）。

### 修复

1. 从 `public-v9/fonts/NotoSansSC-Regular.ttf`（10.1MB，静态字体，`indexToLocFormat=1 LONG loca`）复制到 `public-v7/fonts/`
2. 更新 `public-v7/font-map.json`，将所有 `NotoSansSC-VF.ttf` 目标替换为 `NotoSansSC-Regular.ttf`：

```json
"dejavusans.ttf": "NotoSansSC-Regular.ttf",
"liberationsans-regular.ttf": "NotoSansSC-Regular.ttf",
"notosc-regular.ttf": "NotoSansSC-Regular.ttf"
```

日韩字体（NotoSansJP、NotoSansKR 等）暂时保留 VF，因为 v7 无对应 Regular 静态版本。

---

## v7 / v9 修复覆盖对比

| 修复项 | v7 | v9 |
|--------|----|----|
| 生产环境 CJK（generateBundle） | ✅ | ✅ |
| PDF CJK（NotoSansSC 加入 WASM FS） | ✅ | ✅ |
| 编辑器内 CJK 渲染（font-map → Regular） | ✅ | ✅（已是 Regular）|
| HiDPI 修复 | — v7 从未有此 bug | ✅ |
