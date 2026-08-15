# v9 上线后 issue 验证清单实测（线上）

日期：2026-08-15
对象：https://edit.chaxus.com/ （main 已替换为 v9，`a4a58d5`）
方法：chrome-devtools MCP 驱动真实浏览器 + 隔离 profile（模拟首次访问），
经线上 embed-demo.html 的 postMessage API 与编辑器 iframe 内部 API 验证。

## 结论总览

7 个待验证 issue：**6 个确认修复并关闭，1 个（#94）留言待重测**。
open issue 从 16 降到 5（剩余 4 个为功能请求 + #94）。

| Issue | 症状（旧版）                | 验证方式                                                                        | 结论                                |
| ----- | --------------------------- | ------------------------------------------------------------------------------- | ----------------------------------- |
| #49   | .doc 预览报 code 88         | textutil 生成真实 Word 97 CFB .doc，本地 CORS 服务器喂给线上 open-buffer        | ✅ 完整渲染，关闭                   |
| #21   | 问：有无批注 + 生命周期回调 | pluginMethod_AddComment 添加成功、锚点高亮、面板角标；asc_onAddComment 回调触发 | ✅ 关闭（embed 事件透出进规划）     |
| #12   | Word 光标错位               | 键入验证：光标精确渲染在插入点后（XYZQ\|）                                      | ✅ 关闭（引擎/字体链路已换）        |
| #92   | Excel 单元格编辑光标不动    | F2 编辑，方向键移动：cursorPos 4→1→2 与绘制元素 #ce-cursor left 11px→19px 同步  | ✅ 关闭                             |
| #64   | 右对齐文字编辑后消失        | A1 右对齐 → A5 输入回车 → 右对齐文字仍在                                        | ✅ 关闭                             |
| #15   | 2k/4k 工具栏图标糊          | emulate DPR 2：加载 iconssmall@2x.png / @2.5x.svg，截图清晰                     | ✅ 关闭                             |
| #94   | PPT GIF 转 PNG / 多动画合并 | 需带动画时间线的 pptx，自动化构造成本高                                         | ⏳ 留言请重测（保存链路已保留 GIF） |

## 验证技巧记录（复用价值）

1. **给线上页面喂本地二进制**：本地 node 起一个带
   `Access-Control-Allow-Origin: *` 的静态服务器（127.0.0.1），线上页面
   （https）可以直接 fetch http://127.0.0.1 —— localhost 属于
   potentially trustworthy origin，不算 mixed content。比 base64 分片
   注入省事得多。
2. **生成真实 .doc**：macOS `textutil -convert doc` 产出真实 CFB 格式
   Word 97 文档（file 确认 Composite Document File V2），无需找样例。
3. **Excel 光标断言不靠截图**：cell SDK 的 `cellEditor.cursorPos`（逻辑）
   与 `#ce-cursor` DOM 元素的 `style.left`（绘制）都未混淆，两者同步
   变化即证明 #92 修复——比抓闪烁的光标像素可靠。
4. **合成鼠标事件放不了光标**（再次确认既有教训）：dispatch 的
   mousedown/mouseup 在画布上不会移动插入点（overlay 吞掉），但
   **键盘路径完全可靠**：`area_id` textarea 聚焦后 press_key 全部生效
   （F2、方向键、字符、Ctrl+Home）。
5. **批注验证走 API 面**：`pluginMethod_AddComment` /
   `pluginMethod_GetAllComments` / `asc_registerCallback('asc_onAddComment')`
   在 v9 vendor 全部可用——与 2026-08-14 参考实现研究的结论一致，
   feat/agent-collab 可以直接建立在这套 API 上。
6. 工具栏等 DOM 层 UI 用 snapshot uid 点击可靠（对齐按钮、Got it 弹窗）；
   canvas 内交互一律走键盘或 API。

## 遗留

- #94 待报告者重测；若复现需构造带 <p:timing> 时间线 + GIF 的 pptx
  深入排查（GIF 保留逻辑在 packages/converter 的媒体合并路径）。
- 剩余 open：#53（多文档合并）、#50（WebDAV）、#34（RTL）、#27（插件）
  ——均为功能请求，处置见下一阶段规划文档。
