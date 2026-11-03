# Firefox 夜间 4 条红：Tab 跑出页面末尾

`agent-interface-affordances.spec.ts` 的 "text controls and import fields remain recognizable"
（360/1280 × light/dark 共 4 条）从 2026-10-21 起在夜间 Firefox 上每次都红，与 11-03 的
runner 换 26.04 无关（那之前就红；夜间是信号不是门禁，一直没人看）。

## 现象

```
expect(locator).toBeFocused() failed  — "Import structured result" 按钮 inactive
```

用例为了让按钮进入键盘焦点态（`:focus-visible`，断言 2px 实线 outline），先 `focus()`，
再 `Tab`、`Shift+Tab` 回来。

## 根因

本地 macOS Firefox 复现，探针打印 `document.activeElement`：

- `focus()` 之后：Import structured result
- `Tab` 之后：**仍是** Import structured result
- `Shift+Tab` 之后：`.agent-view-back`

这个按钮是**整页最后一个可 Tab 的元素**。Chromium 从末尾 Tab 出去再 Shift+Tab 会回到它；
Firefox 在没有浏览器外壳可去时把焦点留在原地，于是 Shift+Tab 退到了前一个控件。用例假设
"后面还有东西"，产品行为本身没错（末尾 Tab 离开页面是正常的）。

## 改动

改成从前一个控件进来：`focus()` → `Shift+Tab` → `Tab`。前面一定有可聚焦控件（返回按钮），
各引擎行为一致，outline 的断言不变。

## 验证

- 本地 Firefox：改前 4/4 红（复现），改后 4/4 绿。
- 本地 macOS WebKit 改前改后都红：macOS 默认 Tab 不聚焦按钮（系统"键盘导航"设置），是本机
  环境，CI 上的 Linux WPE WebKit 原本就是绿的；以分支上手动触发的 nightly 为准。
