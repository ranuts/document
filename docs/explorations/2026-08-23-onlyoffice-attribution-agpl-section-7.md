# ONLYOFFICE 署名合规：AGPL §7(b) 保留 logo 与 §7(e) 商标声明

2026-08-23

## 问题

用户问：OnlyOffice 要求衍生作品保留 ONLYOFFICE 的 logo（§7(b)）与商标权声明（§7(e)），
本项目有没有做到。

答案是两条都没做到，而且第一条是我们主动去掉的。

## 现场取证

vendor 源码头（`public/web-apps/apps/common/main/lib/util/fix-ie-compat.js`，
是包里少数没被压缩、还带完整 header 的文件）写着：

> Pursuant to Section 7(b) of the License you must retain the original Product
> logo when distributing the program. Pursuant to Section 7(e) we decline to
> grant you any rights under trademark law for use of our trademarks.

而我们做了三件事把它抹掉：

1. `lib/onlyoffice/guards/chrome.ts` 往编辑器 iframe 注入
   `#header-logo, .btn-current-user, #tlb-box-users { display: none !important }`。
   线上实测 edit.chaxus.com：`#header-logo` 计算样式确为 `display: none`；手动放出来
   是官方 logo（背景图 `web-apps/apps/common/main/resources/img/header/header-logo_s.svg`，
   86×20），资源一直在，只是不显示。
2. `lib/onlyoffice-editor.ts` 的 DocEditor 配置里 `customization.about: false`。
   线上实测左栏 `#left-btn-about` 也是 `display: none`——**这条本以为无效**：vendor
   的 `hidePreloader` 里有一句
   `this.appOptions.canBrandingExt || (this.appOptions.customization.about = true)`，
   即没有商用 branding 授权时把 about 强行扳回 true。但这个离线包 `canBrandingExt`
   为真（没有 license 校验），兜底没起作用，所以我们确实关掉了它。
   对照组：同一行左栏里 `left-btn-searchbar/comments/navigation` 都是 `block`，
   只有 `support`（`help: false`）与 `about` 是 `none`，能排除"只是文件菜单没展开"。
3. 全仓 grep 不到 trademark / 商标；readme 的 License 一节只有一行 `AGPL-3.0`，
   没有 NOTICE / THIRD-PARTY 文件（只有管字体的 `docs/font-licenses.md`）。

于是界面上一处 ONLYOFFICE 标识都没有，只有 JS 文件头那 5 行注释里还有
`Copyright (C) Ascensio System SIA`。

值得记一笔的是**它是怎么变成这样的**：两处都不是疏忽，是刻意的"界面净化"需求，
见 [2026-08-12-v9-pure-ui-and-issue-regression-sweep.md](2026-08-12-v9-pure-ui-and-issue-regression-sweep.md)
开头那句"需求：去掉编辑器头部的 ONLYOFFICE logo（`#header-logo`）"。下一次净化会
再做一遍，而当时套件里没有任何东西会红。

## 改动

- `guards/chrome.ts` 选择器里删掉 `#header-logo`。`.btn-current-user` /
  `#tlb-box-users` 留着——那是协作会话的 UI，无服务器版本根本没有，与 7(b) 无关。
- `onlyoffice-editor.ts` 删掉 `about: false`（默认即 true）。`help: false` 与授权
  无关，保留（vendor 的 help 内容本来就从包里裁掉了）。
- 新增守卫 12 `guards/about-source.ts`：往 About 面板末尾追加两行——"这是 ONLYOFFICE
  编辑器的修改版本，不是官方产品；ONLYOFFICE 是 Ascensio System SIA 的商标"，以及
  AGPL §13 要的源码地址。**只增不改**，vendor 渲染的内容一个字不动。
  实现上要注意：`#about-menu-panel` 从启动起就在 DOM 里，但**内容是首次打开时才渲染
  的**（实测 `children.length === 0`），所以不能一次性写入，要用 MutationObserver 等
  内容到齐；往被观察节点里 append 会再次触发回调，靠 id 判重收敛。
- 新增根目录 `NOTICE`：逐字引用 vendor 那三段（AGPL + 7(a) 免责 + 7(b)/7(e)）、写明
  vendor 版本 9.3.0.133 与上游仓库、以及 §5(a) 要求的**我们对 vendor 树做过的全部改动**
  （x2t_helper 的 instantiateWasm 补丁、x2t.wasm 只发 gzip、locale 补键、help 裁剪、
  字体 catalog 换成开源字体），并声明商标归属与"非官方、无隶属"。
- 8 份 readme 的 License 一节补上同样的两段（指向 NOTICE + 商标免责）。
- 站点 7 种语言的两个页脚（首页 hero 页脚与生成页 `.page-foot`）都渲染一行商标声明，
  词条在 `bin/build-pages.mjs` 的 `UI` 表里，样式 `.tm` 在 `landing.css` / `home.css`。

## 用例固化与反向验证

- 单测 `test/unit/branding-notice.test.ts`（17 条）：钉住两处抑制不能回来、守卫已挂载、
  NOTICE 逐字包含 7(b)/7(e) 那段**且 vendor 文件里那段仍然存在**（vendor 升级后引文要
  重新核对）、8 份 readme 都指向 NOTICE、154 个生成页每页都有 `.tm` 且中文页说中文。
- E2E `test/e2e/vendor-branding.spec.ts`（6 条）：真实编辑器里断言 header logo 可见且
  真的被画出来（背景图 + 尺寸，不只是"元素存在"）、About 入口在左栏且面板含
  `Ascensio System SIA`、面板里有我们的源码声明；再加三个页面的页脚商标行。
- **反向验证**（两轮，都做了）：
  - 把 `#header-logo` 加回 chrome.ts、`about: false` 加回配置、守卫从
    `iframe-guards.ts` 摘掉 → 编辑器那 3 条全红，页脚那 3 条仍绿（正确，它们测的是
    另一半）。
  - 把两个模板里的 `<p class="tm">` 删掉 → 页脚那 3 条全红。
  - 恢复后 6 条全绿。

## 没做的事

- **没有改产品名**。readme 的 H1 已经是 "Online Document Editor"，站点也没用
  ONLYOFFICE 当自己的名字，7(e) 层面不需要动。
- **没有去动 vendor 的 About 面板内容本身**（版本号、版权行、链接），只在末尾追加。
  改它是另一种风险：那正是 §5 要显示的 Appropriate Legal Notices。
- **没有把 corresponding source 打包进仓库**。vendor 是第三方编译的 9.3.0.133 离线包，
  对应源码在 ONLYOFFICE 的公开仓库，NOTICE 里写了版本与地址；真要更严格，可以在
  release 里附一份 written offer。
