# 只读时隐藏编辑页签（#298 第二步）

接 [2026-11-02-readonly-toolbar-state.md](2026-11-02-readonly-toolbar-state.md)。第一步用 vendor 的
`editing:disable` 给整条工具栏加遮罩，按钮变灰了，但还在。用户反馈里写的是"隐藏或明显禁用"，
而遮罩还有一个副作用：它盖住每一个页签，连 View 页签里的缩放、导航也一起灰掉了。

## 做法

`lib/onlyoffice/readonly.ts` 往编辑器 frame 注入一条 CSS，只读时在 `<html>` 上挂 `readonly-chrome` 类：

- **页签只留 File 和 View**（`READONLY_TABS`）。四个编辑器实测页签：
  - word：file / home / ins / draw / layout / links / review / view，外加 plugins、headerfooter；
  - cell：file / home / ins / draw / layout / formula / data / review / view，外加 pivot、tabledesign；
  - slide：file / home / ins / draw / design / transit / animate / review / view，外加 slideMaster；
  - pdf：file / home / comment / review / view。

  File 和 View 在四个编辑器里都有，所以用"保留名单"而不是"隐藏名单"。规则写成 CSS
  （`.ribtab:not(:has(> a[data-tab="file"])):not(...)`）而不是调 vendor 的 `toolbar.setVisible`：
  vendor 会在选区移动时自己把上下文页签（表格设计、页眉页脚）显示出来，CSS 不受这个影响。

- **隐藏页签之外的编辑控件**（`READONLY_HIDDEN_SLOTS`，按 vendor 的 `#slot-*` 容器 id）：
  - 各页签共用的剪贴板组里的粘贴、剪切、格式刷（复制保留）；
  - View 页签里的宏三件（宏、录制、暂停）；
  - 表格的新建/关闭工作表视图、冻结窗格（会改文件）；
  - 演示文稿的幻灯片母版；
  - PDF 的 Edit PDF；
  - word/pdf 顶栏的编辑模式切换。
- **切到 View 页签**：上锁时如果当前页签不在保留名单里，记下它并点 View；解锁时点回去。
- `editing:disable` 不再传 `toolbar`。遮罩会盖掉 View，而该藏的已经藏了。
  右侧面板、右键菜单、修订、评论预览、单元格编辑栏、顶栏撤销/重做照旧由它锁。
  `viewMode` 仍跟着开关走，因为顶栏的撤销/重做靠它锁。

只读状态下仍可见、可用的是：File、View 页签里的查看工具（缩放、适应页面/宽度、导航、主题、
标尺、网格线、备注、PDF 的抓手/选择）、复制、全选、左侧搜索/导航/缩略图、状态栏。
右侧面板那排图标是灰的，没有藏。

## 验证

- `test/e2e/readonly-chrome.spec.ts` 改为断言：只读时可见页签恰好是 `['file','view']`、当前页签是 view、
  粘贴不可见、搜索和放大可用；运行时解锁后 home 回来、当前页签回到 home、粘贴可见；再锁回到只读状态。四种格式各一条。
- **反向验证**：注释掉 `syncReadonlyTabs` 后 4 条全红，多出 home / ins / review 等页签；
  只清空 `READONLY_HIDDEN_SLOTS` 后 4 条全红（`paste: true`）；恢复后全绿。
- 只读相关的已有用例（format-parity、embed-regression、pdf-roundtrip）加上新用例共 13 条全过（本地 vite dev）。
- `vendor-contract.test.ts` 去掉了对 `DisableToolbar` 的钉子（不再用工具栏遮罩），保留 `editing:disable` 与 `stackDisableActions`。
