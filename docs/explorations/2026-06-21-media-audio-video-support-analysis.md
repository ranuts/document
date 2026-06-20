# OnlyOffice 9.3.0 音视频支持分析：Web Mode 的边界

**日期：** 2026-06-20  
**分支：** `explore/path-d-desktop-mock`  
**前置文档：** [2026-06-21-resource-audit.md](2026-06-21-resource-audit.md)

---

## 背景与问题

资源审计完成后，提出了一个关键问题：PPTX 中嵌入的视频和音频能否在当前 Web Mode 下播放？

初始假设（错误的）：基于对 `sdk-all-min.js` 的搜索（无 `video`/`audio` 关键词命中），得出"SDK 不支持媒体"的结论。

**纠正**：`sdk-all-min.js`（1.1MB）与 `sdk-all.js`（9.4MB）是不同文件；minified 版是精简包，不包含完整功能。正确做法是在 `sdk-all.js`（unminified）中验证。

---

## 一、版本确认

项目使用的 OnlyOffice 版本：

```
Version: 9.3.0 (build:140)
Copyright (C) Ascensio System SIA 2012-2026
```

CLAUDE.md 中记录的"7.5.0 (build: 2024-10-16)"为**过期信息**，已于本轮更新。

---

## 二、SDK 层分析（sdkjs/slide/sdk-all.js）

### 2.1 SDK 确实解析音视频

在 `sdk-all.js`（9.3.0 unminified）中，音视频相关代码明确存在：

```javascript
// 资源类型注册（line 9787）
this.$Z.register(h.RM.Image,   "image");
this.$Z.register(h.RM.Audio,   "audio");
this.$Z.register(h.RM.DTc,     "video");

// 播放控制命令路由（line 10764-10765）
if (-1 !== W.indexOf("play") || "pause" === W || "resume" === W
    || "stop" === W || "togglePause" === W) {
  var Ka = this.Zsb();
  Ka && Asc.editor.gqc(W, Ka);   // 把 play/pause/stop 转发给 editor API
}

// 选中媒体元素时显示控制面板（line 1648）
V ? Asc.editor.gqc("showMediaControl", V) : Asc.editor.MKb();

// MIME 类型映射（line 16815-16816）
wav:"audio/wav", wma:"audio/x-wma", mp3:"audio/mpeg",
mp4:"video/unknown", mov:"video/unknown", mkv:"video/unknown",
avi:"video/avi", webm:"video/webm", wmv:"video/x-wmv" ...

// 添加视频/音频（line 18622-18623）
asc_AddVideo = function(a) {
  window.AscDesktopEditor.OpenFilenameDialog("video", false, ...);
};
asc_AddAudio = function(a) {
  window.AscDesktopEditor.OpenFilenameDialog("audio", false, ...);
};
```

SDK 可以：
- 解析 PPTX 中的 `<p:audio>`、`<p:video>` 动画节点
- 保留音视频结构数据（MIME 类型、媒体路径、播放参数）
- 路由 play/pause/stop 命令到 editor API

SDK **不**包含：
- `createElement("video")` — 0 处
- `createElement("audio")` — 0 处
- `HTMLVideoElement` / `HTMLAudioElement` — 0 处
- `new Audio()` — 0 处

SDK 自身不负责实际播放，播放能力由上层（web-apps UI 层或桌面宿主）实现。

### 2.2 sdk-all-min.js 不代表完整功能

| 文件 | 大小 | 说明 |
|------|------|------|
| `sdk-all-min.js` | 1.1 MB | 精简包，不含完整音视频逻辑 |
| `sdk-all.js` | 9.4 MB | 完整 unminified SDK，含音视频解析 |

实际运行时加载的是 `sdk-all.js`（或其压缩版 `sdk-all.bin`），不是 `sdk-all-min.js`。
**以后分析 SDK 能力时应以 `sdk-all.js` 为准。**

---

## 三、Web Apps UI 层分析（web-apps/apps/presentationeditor/main/app.js）

### 3.1 插入音视频：Desktop 专属

```javascript
// app.js line ~832530（9.3.0）
Common.Controllers.Desktop.isActive() &&
Common.Controllers.Desktop.isFeatureAvailable("IsSupportMedia") &&
Common.Controllers.Desktop.call("IsSupportMedia") &&
(n.btnInsAudio = new Common.UI.Button({ id: "tlbtn-insaudio", ... }),
 n.btnInsVideo = new Common.UI.Button({ id: "tlbtn-insvideo", ... }))
```

Insert Audio / Insert Video 工具栏按钮仅在满足以下三个条件时出现：

1. `Common.Controllers.Desktop.isActive()` — 当前在桌面 App 宿主中运行
2. `isFeatureAvailable("IsSupportMedia")` — 桌面 App 声明支持媒体
3. `Desktop.call("IsSupportMedia")` — 桌面 App 实时确认

Web Mode（无 `AscDesktopEditor`）下三个条件均不满足，**Insert Audio/Video 按钮根本不会渲染到 DOM 中。**

### 3.2 浏览器原生媒体播放：未实现

对 `app.js`（9.3.0）的全文搜索：

| 模式 | 命中数 |
|------|--------|
| `createElement("video")` / `createElement("audio")` | 0 |
| `HTMLVideoElement` / `HTMLAudioElement` | 0 |
| `new Audio(` | 0 |
| `MediaPlayer` / `mediaPlayer` | 0 |
| `.play()` / `.pause()` | 各 1，但均来自宏录制器（macro recorder），与音视频无关 |

**9.3.0 的 Web Apps UI 层没有任何浏览器原生 `<video>`/`<audio>` 播放实现。**

---

## 四、结论

### 4.1 当前版本（9.3.0）Web Mode 的音视频边界

| 能力 | Web Mode（本项目）| Desktop App |
|------|----------------|------------|
| 解析 PPTX 中的音视频元素 | ✅ SDK 保留结构数据 | ✅ |
| 在画布上显示视频封面/占位形状 | ✅（作为静态图形渲染）| ✅ |
| 插入新视频/音频 | ❌ 需要 `AscDesktopEditor` | ✅ |
| 播放已有视频/音频 | ❌ 无浏览器播放器实现 | ✅ 通过 OS 媒体 API |
| 音视频触发 SPA fallback 崩溃 | ✅ 不会（SDK 不发 HTTP 请求加载媒体字节）| — |

### 4.2 为什么 Web Mode 不会因音视频崩溃

SDK 识别到音视频元素后，把控制权交给 `Asc.editor.gqc()`。
在无 Desktop Controller 的 Web Mode 下，该调用是无操作（no-op）或被 app.js 静默忽略。
SDK **不会**主动通过 HTTP 请求 `.mp4`、`.mp3` 等媒体字节——这些请求在桌面模式下由 Desktop App 发起，Web Mode 中该代码路径根本不会触发。

因此，PPTX 中包含音视频的文档可以正常打开和编辑（文字、图形、动画等），只是点击播放按钮无效。**不需要像图片那样额外修复。**

### 4.3 升级到 9.4.0 是否会改变这一状况？

查阅 OnlyOffice 9.4.0 changelog（截至 2026-05 发布说明），未见"浏览器端音视频播放"相关条目。9.4.0 的主要新增是演示主题、切换动画、表格深色模式和单进程架构，并不包含 Web Mode 的媒体播放能力。

**结论：升级到 9.4.0 预计不会解锁音视频播放，该限制是架构性的**（播放实现在桌面宿主层），不是某个版本 bug。

---

## 五、后续可能的方向（备忘）

若未来需要在 Web Mode 支持音视频播放，可行的技术路径：

**方案 A：Service Worker 拦截 + blob URL**

类似图片的修复思路：在 SW 中拦截 `/media/ppt/media/*.mp4` 请求，从 `__mediaCache` 中返回 blob URL。问题：SDK 当前不发出这些 HTTP 请求，需先研究是否有办法触发 SDK 使用 `<video>` 元素播放。

**方案 B：覆盖 `Asc.editor.gqc` 方法**

在 `onAppReady` 之后，hook `Asc.editor.gqc("showMediaControl", mediaInfo)`，在父页面动态创建 `<video>` 或 `<audio>` overlay，用 `__mediaCache` 中的 blob URL 作为 src。
优点：不修改 SDK，仅在应用层扩展。
缺点：需要研究 `mediaInfo` 对象结构，确定如何定位 overlay 的位置（需要从 SDK 获取元素的画布坐标）。

**方案 C：等待 OnlyOffice 官方支持**

OnlyOffice 官方路线图中有 Document Server 的 Web 端音视频播放计划。届时只需升级静态文件。

---

## 六、附：正确的 SDK 分析方法论

本次调查的一个教训：

| 错误做法 | 正确做法 |
|---------|---------|
| 搜索 `sdk-all-min.js` | 搜索 `sdk-all.js`（unminified）|
| 只看 `createElement` 调用 | 同时查 SDK → UI 层的回调链（`gqc` 等）|
| 看不到关键词就认为"不支持" | 区分"SDK 解析层"和"宿主实现层" |
| 以 minified 缺失判断功能不存在 | 以 unminified 完整版为准 |
