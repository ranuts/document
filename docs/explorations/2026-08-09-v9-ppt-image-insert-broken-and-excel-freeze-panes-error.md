# v9："Image from file"（本地插入图片）在 Word / Excel / PPT 三个编辑器里全部静默失效（已定位根因并修复，Word/Excel 已通过可视化验证，PPT 通过 API 级别验证）；Excel Freeze Panes 抛控制台错误（未修复，影响小）

日期：2026-08-09
分支：feat/v9-web-mode
状态：**本地图片插入 bug（三个编辑器都有，各自独立的内部实现、同一类根因）已定位根因并修复**；
Word 和 Excel 已经用真实图片出现在文档里这种最直接的方式验证通过；PPT 的底层
修复逻辑已通过直接 API 级别测试确认正确，但受这次会话已知的浏览器自动化局限，
没能把"真的点鼠标"这条路完整走通。Excel Freeze Panes 的控制台报错已确认存在，
未修复（影响评估为小，见下文）。

## 背景

继续沿着"继续检查还有哪些问题，没问题就可以把 v7 换成 v9 上线"这个方向，
把 Excel 剩下的 Freeze Panes、更多公式类型测完，再转去测 PPT 的动画、图片
插入、形状插入。图片插入这一项挖出了这次会话目前为止影响面最广的一个 bug，
而且排查过程中发现影响范围比最初判断的还要大——不是只有 PPT，Word 和 Excel
各自都有一份独立的、同一类根因的坏代码。

## Excel：Freeze Panes 应用时会抛一次性的控制台错误（真实存在，未修复）

在一个有数据的工作表上，View 标签页 -> Freeze Panes 图标 -> 选中的那一项，
应用后控制台立刻刷出：

```
Uncaught TypeError: element.getBoundingClientRect is not a function [48 times]
```

排查结论：

- 这是**一次性的错误突发**，不是持续报错的死循环——等几秒重新检查，
  错误计数没有继续增长，还是停在 48 次。
- Freeze Panes 的核心功能没有被这个报错破坏：重新打开菜单能看到从
  "Freeze Panes" 变成了 "Unfreeze panes"（状态确实生效了），点 Unfreeze
  panes 能正常恢复，取消冻结过程中也没有新增报错。
- 冻结生效期间，正常输入文字（`D10` 单元格测试）完全正常，`asc_getCanUndo()`
  行为正常，没有复现这次会话前面遇到的"看起来正常但其实文档已经锁死"那种
  静默故障模式。

判定为**真实存在但影响较小的 bug**——某个跟冻结分隔线阴影渲染相关的代码
路径，在给冻结线相关的 DOM 元素做位置计算时，传入的不是一个真正的 DOM
元素，调用了它不存在的 `getBoundingClientRect` 方法。48 次一次性报错、不
影响核心功能——评估为**低优先级，暂不修复**，记录下来供以后需要时参考。

## Excel：IF 公式——正常

按照这次会话已经确认过的方法论（用 `press_key` 逐字符输入，不用一次性的
`type_text`，避免测试工具本身的假阳性），输入 `=IF(B2>80,"High","Low")`，
`B2` 为 `92`，正确算出 `"High"`。逐字符输入过程中没有触发任何自动补全
干扰。

## "Image from file"（本地图片插入）——三个编辑器全部静默失效，已定位根因并修复

### 复现（以 PPT 为例，最先发现）

新建 `?new=pptx`，Insert（或 Home）标签页 -> Image -> **Image from file**，
选一张本地图片。结果：

- 控制台**零报错、零警告**。
- 幻灯片上什么都没出现，`Select All`、`Tab` 循环选中幻灯片上的对象，
  只有原有的标题和副标题占位符，插入的图片完全不存在。
- 网络面板能看到一个奇怪的请求：`GET http://localhost:5183/media/blob:
http://localhost:5183/<uuid>`，返回 200——这是本地 dev server 的 SPA
  兜底路由返回的 `index.html`，不是真正的图片字节。

这是这次会话遇到的**影响面最广的一类 bug**：一个核心编辑功能完全失效，而且
是彻底静默的，用户唯一能感知到的信号就是"点了插入图片，什么都没发生"。

### 根因：三个编辑器（word / cell / slide）各自独立的同一类 bug

`public-v9/onlyoffice-iframe-patch.js` 里已有的、给 "Image from URL"
（`AddImageUrl`）打的 #72 修复只覆盖了 `AddImageUrl` 这一个入口。现场
分别读取三个编辑器的 `api` 对象，确认"Image from file"走的是**完全独立
的第三条入口**，每个编辑器各自有一份：

| 编辑器 | 入口方法       | 内部路径解析（有 bug 的那步）                                           | 提交方法                                |
| ------ | -------------- | ----------------------------------------------------------------------- | --------------------------------------- |
| slide  | `AddImage`     | `AscCommon.uu.IR`：`a=this.nda+"/media/"+a`                             | `F4d`（有稳定别名 `AddImageUrlAction`） |
| word   | `AddImage`     | 同一个 `OpenFilenameDialog` 内联写法（现场验证确认，跟 slide 结构相同） | `uHa`（有稳定别名 `AddImageUrlAction`） |
| cell   | `asc_addImage` | `AscCommon.Hw.Z1`：`a=this.Dpa+"/media/"+a`                             | `P6a`（**没有**稳定别名）               |

三处路径解析函数是同一类 bug 的三份独立拷贝：无条件把 `'/media/'` 拼到
传入的字符串前面，假设输入永远是一个裸文件名，但实际传进来的是一个完整的
`blob:http://...` URL，拼接结果是彻底无意义的 `.../media/blob:http://
localhost:5183/<uuid>`，提交方法拿到这个乱码路径后原样静默丢弃：不报错、
不插入、什么都不做。

**关于 word 的一个纠正**：最初以为 word 的 `AddImage` 走一条完全不同的
内部事件分发架构（`Lfb -> OTa -> mrb`，静态 grep 找到的），判断"没有证据
表明有问题，不去动它"。后续现场直接读取运行中的 `api.AddImage.toString()`
发现它其实跟 slide 是**同一种结构**（`OpenFilenameDialog` 内联写法），
静态 grep 找到的 `Lfb`/`OTa` 是压缩后单/双字母命名冲突撞到的另一个不相关
的函数——**现场运行时内省比静态 grep 可靠**，这是这次排查过程里一个值得
记住的教训。

### 额外发现：`AddImageUrl` 已有修复对 slide 编辑器本身就是坏的

在验证过程中，直接调用 `api.AddImageUrl(['some-key'])` 现场测试已有的 #72
修复时，抛出了 `TypeError: self.uHa is not a function`。原因：`uHa` 这个
提交方法名**只在 word 的打包结果里叫这个名字**，slide 打包结果里
`AddImageUrl` 最终调的是 `F4d`。也就是说 #72 修复自 2026-06 写下以来，
**"Image from URL"（真实远程 http(s) 链接）这个功能在 PPT 上从来没有真正
被验证过**（之前的验证用 `data:` URI，被对话框自己的 URL 格式校验挡住，
从没跑到过这行代码）。

修复：改用两个编辑器都存在的、未被混淆的稳定别名 `AddImageUrlAction`
（现场验证：word 的 `g.prototype.AddImageUrlAction` 存在，slide 的
`f.prototype.AddImageUrlAction === f.prototype.F4d`），提交时优先用这个
别名，`uHa`/`F4d` 作为兜底。

### 修复

新增一个通用的 `patchLocalImageInsertMethod(methodName, commitNames)`，
`AddImage`（word / slide）和 `asc_addImage`（cell）各调用一次：

- 用特征匹配（`realImpl.toString()` 里有没有 `OpenFilenameDialog`）而不是
  判断 `window.PE`/`DE`/`SSE` 是否存在来决定要不要接管——这几个全局变量在
  这段补丁脚本执行的时候（比 SDK 自己的 bundle 早注入）还不存在，一次性
  判断永远拿不到，必须放进重试循环（下面"我自己踩的坑"一节详细写了这个
  教训）。这个检查天然只会命中真正匹配这个已知坏形状的实现，所以可以对
  三个编辑器都跑，不需要按编辑器类型分别写判断——word 的 `AddImage` 因此
  也被这份通用补丁正确接管了（见上面的纠正）。
- 拿到本地文件 key 后，跳过坏掉的 `uu.IR`/`Hw.Z1` 解析链路，直接把
  `blob:` URL 注册进 `window.parent.__mediaCache` / `__registerSaveMedia`
  （跟 `AddImageUrl` 修复用的是同一个 `registerMedia` 辅助函数），拼出
  正确的 `/media/<key>` 路径。
- 提交方法优先用 `AddImageUrlAction` 稳定别名，`uHa`/`F4d` 作为兜底
  （word/slide 都有这个别名，直接命中）；`cell` 没有这个别名，显式兜底到
  现场确认过的 `P6a`。

**调用签名不统一，这是修复过程中踩的第二个坑**：`P6a` 期待第一个参数是
一个**数组**（`g.P6a([path], options)`，2 个参数），而 `uHa`/`F4d` 期待
一个**裸字符串**（`editor.F4d(path, void 0, options)`，3 个参数）。第一版
修复对所有提交方法都用了字符串式调用，套到 `P6a` 上时，`P6a` 把字符串当
数组用（`K[0]` 变成了字符串的第一个字符），现场复现出一个非常容易误导人
的弹窗：

```
Warning
Image URL is incorrect
```

这个弹窗看起来像是"用户输入的 URL 格式不对"，实际上是内部调用签名传错了
参数类型——花了一点时间才意识到跟"图片是本地文件、根本没有 URL"这件事对
不上。修复：按提交方法名区分调用方式（`P6a` 用数组式，其它用字符串式）。

### 我自己在这次修复过程中踩的一个坑（也顺手修了）

`patchLocalImageInsertMethod` 最初的写法（针对 slide 单独写的第一版）是：

```js
if (!window.PE) return; // 一次性判断，不重试
```

由于这个补丁脚本注入执行的时机比 SDK 自己定义 `window.PE` 早，这个判断
第一次执行时几乎总是 `false`，而且**没有重试**，导致补丁实际上从来没有
真正装上过（现场验证 `proto.__addImagePatched` 一直是 `false`）。改成了
不依赖 `window.PE`、而是直接检测方法的真实实现是否已经变成"最终形态"
（带重试，最多约 20 秒）。

### 验证

**Word：完整可视化验证通过。** 用真实的 `File` + `DataTransfer` 构造一次
"选中本地文件"的等价操作（塞进 `OpenFilenameDialog` 生成的
`<input type=file>`，触发 `change` 事件），调用 `api.AddImage(undefined)`
走完整流程：控制台零报错，`asc_getCanUndo()` 变成 `true`，**截图确认图片
真的出现在文档里**（带完整的缩放手柄和旋转手柄，是一个正常的、已选中的
图片对象，不是什么占位符或残缺状态）。

**Excel：完整可视化验证通过（过程中还额外揪出了参数类型这个坑）。**
同样的模拟操作，调用 `api.asc_addImage(undefined)`。第一版修复（字符串式
调用 `P6a`）复现出上面提到的"Image URL is incorrect"弹窗；改成数组式调用
后，重新测试：控制台零报错，`asc_getCanUndo()` 为 `true`，**截图确认图片
真的出现在工作表里**（一个约 A1:C11 大小的黑色方块，名称框正确显示
"Picture 62942..."，带完整的缩放手柄）。

**PPT：底层修复逻辑通过直接 API 调用确认正确，但真实鼠标点击这条路没能
完整走通。** 用同样的模拟操作，调用 `api.AddImage(undefined)`：控制台零
报错，幻灯片缩略图上出现了一个新对象的标记。但用真实的"点 Image 按钮 ->
点 Image from file -> 选文件"这条完整 UI 路径反复测试了十几次，全部卡在
"点击菜单项，菜单关闭但没有触发任何图片相关方法"这个状态——专门加了一个
调用计数器直接证实：点击这条路径时，`AddImage` 的调用次数是 **0**，跟
Word/Excel 用完全一样的补丁代码、完全一样的操作步骤能稳定成功形成鲜明对比。
判断为这次会话已经反复记录过的"自动化工具的合成鼠标事件对这套自定义菜单
组件的目标定位不稳定"这一类问题（跟形状插入需要真实拖拽手势、以前多次
"点错菜单项"是同一类根因），不是这次修复本身的问题——但**这一判断没有被
"真的用鼠标点一下、看到图片出现在幻灯片上"这种最直观的方式覆盖到**，
建议上线前找一台真实设备/真实鼠标手动确认一遍。

- `pnpm run lint:ts`、`pnpm exec prettier --check`、`pnpm run build:v9`
  全部通过，确认修复后的代码语法正确、能正常打包进 `dist-v9/`，三个编辑器
  的补丁代码字符串都能在打包产物里找到。

### 遗留

- PPT 的"真实鼠标点击"这条路径没有 100% 走通，建议上线前人工验证一次
  （见上文）。
- 三个编辑器的修复都只验证了"图片出现在文档模型里、能撤销"，没有验证
  "保存下来的文件重新打开后图片依然存在"这个完整往返——之前 Excel 那次
  无限保存循环 bug 修复时验证过 `registerMedia` 用的 `__registerSaveMedia`
  这条路径的设计意图就是覆盖保存场景，理论上应该没问题，但没有专门针对
  这次的图片插入场景重新走一遍保存 - 重新打开的往返验证。
- PPT 插入图片后处于"待放置"的交互状态（类似插入形状时观察到的现象），
  这次没有确认这是不是 PPT 本来就有的正常 UX（需要用户在画布上点一下才能
  把图片放到具体位置，跟 PowerPoint/Google Slides 的常见交互一致），还是
  也需要额外处理——Word 和 Excel 都是"选完文件立刻出现在文档里"，不需要
  额外点击，PPT 这次因为鼠标点击路径本身没跑通，没能进一步确认这一点。

## 对"v9 是否可以直接替换 v7 上线"这个问题的当前判断

**不建议现在直接替换，但比上一轮判断更接近可以上线。** 这次发现的本地
图片插入 bug 影响面比最初判断的还要大——不是只有 PPT，Word 和 Excel 各自
都有独立的同一类 bug，属于"每一个尝试插入本地图片的用户，不管用哪个编辑器
都会碰到"这个级别，是这次会话至今发现的严重程度最高的问题之一。好消息是：

1. 三个编辑器的修复都已经完成，Word 和 Excel 已经用"图片真的出现在文档
   里"这种最直接的方式完整验证过，可信度很高。
2. PPT 的底层逻辑也验证正确，只是最后一步"真实鼠标点击"没能在这次的
   自动化环境里跑通，大概率是测试工具本身的局限，不是产品缺陷。

建议：找时间用真实鼠标在 PPT 里点一遍 "Insert > Image > Image from file"
确认图片真的能插入，同时对三个编辑器都做一次"插入图片 -> 保存 ->
重新打开"的往返验证，确认没问题后可以认为这一类问题已经妥善解决。
