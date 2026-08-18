# issue #145：安卓 Chrome 幻灯片初始缩放 31%、改几次缩放后变白 —— 手机版式 + 画布上下文丢失守卫

日期：2026-08-18
相关 issue：[#145](https://github.com/ranuts/document/issues/145)

## 一、现象

- 安卓 Chrome 打开幻灯片，**初始缩放只有 31%**（幻灯片缩成屏幕中间一小块）；
- **反复改几次缩放之后"报错"**，用户截图是一张几乎全白、只剩滚动条与两个占位框的页面。

## 二、复现（Playwright Pixel 5 模拟，本地生产构建）

| 量                     | 修复前     |
| ---------------------- | ---------- |
| 视口宽                 | 393 px     |
| 画布区 `#id_viewer` 宽 | **191 px** |
| 打开后的缩放           | **12%**    |

版式实测（截图见 PR）：左侧图标栏 40 px + 幻灯片缩略图面板 ~105 px +
右侧图标栏 ~38 px + 底部备注栏，**三分之二以上的宽度给了侧边面板**，
留给幻灯片的只有一条 191 px 的窄缝，"适应幻灯片"于是算出 12%。
用户设备更宽（或横屏），同样机制下算出 31%。

根因不是缩放算法，而是**手机上跑的是桌面版编辑器**：厂商确实带了移动版
bundle（`web-apps/apps/presentationeditor/mobile/`），但**只有 `main`
（桌面）bundle 带这套离线 x2t 补丁**（`grep convertToBin` 在 mobile bundle 里
0 命中，`window.isOffline` 同样只在 main 里），所以 `type: 'mobile'` 一旦切过去，
本地文件根本打不开。移动版要能用，得先把离线补丁移植进去 —— 属于 vendor
层的独立工作，本轮不做。

## 三、修复一：紧凑版式（≤600 px 视口）

`compactViewportCustomization()` + `applyCompactSlideLayout()`：

- `layout.rightMenu: false`（对象设置面板在 393 px 上本来就没法用）；
- `hideNotes: true`、`hideRulers: true`、`compactHeader: true`；
- `zoom: -2`（适应宽度，而不是适应整页）；
- 文档就绪后对**幻灯片文档**调 `api.ShowThumbnails(false)` 收起缩略图面板，
  再 `zoomFitToWidth()` 重新适配 —— **左侧图标栏刻意保留**，用户可以从那里
  把缩略图面板叫回来；翻页也不依赖它（主视图直接滚动，状态栏有页码）。

Pixel 5 实测：画布 191 → **337 px**，初始缩放 12% → **24%**（一半的提升来自
收起缩略图：只关面板时 245 px / 17%）。桌面视口完全不受影响。

顺带的收益：缩略图面板每张幻灯片一个 canvas，收起后 frame 里的 canvas 数量
大幅下降 —— 这直接关系到下面第二个问题。

## 四、修复二：画布上下文丢失守卫（守卫 9）

用户截图里"全白 + 滚动条还在"是 **2D canvas backing store 被丢弃**的典型形态：
移动版 Chrome 在内存紧张时会丢弃 canvas 内容，每次改缩放都会按 devicePixelRatio
（安卓常见 2.75～3.5）重新分配大块 canvas，反复改缩放正是最容易触发的操作。

而这份 vendor 构建**完全没监听** `contextlost` / `contextrestored`
（`grep -rl contextlost public/sdkjs public/web-apps` 只命中无关的 monaco 文件），
所以一旦丢弃，编辑器就永远停在白屏。

`prepareEditorIframe` 新增守卫 9：在编辑器 frame 的 document 上以**捕获阶段**
（这两个事件不冒泡）监听 `contextlost` / `contextrestored` / `webglcontextrestored`，
触发时调 `Asc.editor.WordControl.OnResize()` 强制重绘。

重绘手段是实测挑出来的（把 `#id_viewer` 涂白后逐个试）：

| 调用                         | 是否重绘                     |
| ---------------------------- | ---------------------------- |
| `window` 派发 `resize` 事件  | 否（尺寸没变，SDK 直接跳过） |
| `api.Resize()`               | 否                           |
| `WordControl.UpdateHorRuler` | 否                           |
| **`WordControl.OnResize()`** | **是**                       |
| `WordControl.OnScroll()`     | 是（兜底）                   |

注意 `contextlost` **不能 `preventDefault()`**：按 HTML 规范，事件未被取消时
浏览器才会恢复上下文并派发 `contextrestored`。

## 五、用例

`test/e2e/mobile-slide.spec.ts`（新，Pixel 5 模拟，仅 chromium）：

1. 版式：画布宽 > 视口的 75%、初始缩放 ≥ 20%、右侧面板宽度为 0；
2. 缩放连打（in/out/fit/100 共 8 次）：无 `asc_onError`、无厂商弹框、
   画布仍有内容（逐像素统计非白像素）；
3. 上下文丢失恢复：涂白画布 → 派发 `contextlost` + `contextrestored` →
   断言画面被重绘回来。**去掉守卫 9 后该用例确实变红**（已实测验证）。

单测补 `isCompactViewport` / `compactViewportCustomization` 两组断言。

## 六、诚实的边界

- 第 3 条用例用的是**合成事件**：真实的 backing store 丢弃无法按需触发，
  所以它钉住的是"丢弃后能恢复"的接线，而不是"安卓一定不再丢弃"。
- 桌面模拟里**没能复现**用户说的"报错"（8 次缩放连打无任何错误），
  所以不排除用户遇到的是渲染进程被系统回收（Aw, Snap）之类的更粗暴的失败；
  真是那样的话，紧凑版式带来的 canvas 数量下降与内存占用下降仍然有帮助。
- 真正的解法是把离线补丁移植到 vendor 的移动版 bundle，让手机跑触摸 UI；
  已记在待办里，需要单独一轮。
