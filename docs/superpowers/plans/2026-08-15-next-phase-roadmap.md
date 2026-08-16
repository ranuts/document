# 下一阶段规划：内容补齐、SEO/GEO/LLM 友好、WebMCP、工程与产品线

日期：2026-08-15
前置状态：v9 已转正并即将替换 main 部署（main 备份为 backup 分支）；
CLAUDE.md 代码侧待办已清零；E2E 17 条全绿。

## 方向零：v9 全面回归战役（最高优先级，压倒其余全部方向）

**背景（2026-08-15 用户实测判定）**：v9 上线后用真实文档实测，稳定性与
可用性**不如 v7**。已确认的 P0 现场：一份真实的 35 页 PPTX
（含主题、图片、代码截图）在编辑幻灯片标题时弹出
"An error occurred during the work with the document. Use the
'Download as' option to save the file backup copy to a drive."
（OnlyOffice 的文档致命错误对话框）。同日刚修掉的"插图保存假死"
也属于同类——**合成最小文档全绿，真实文档踩雷**。

**根因反思（决定战役设计）**：现有 18 条 E2E 的 fixture 全部是页内手拼
的最小 OOXML/最小 PDF——它们证明管线通，但真实文档的复杂度
（主题、母版、动画、嵌图、大文件、多字体、修订痕迹）一点都没覆盖。
两次教训同构：只验 embed-demo 漏掉主站路径；只验合成文档漏掉真实
文档。**测试语料必须真实化**。

**执行方法论**：见
[2026-08-15-v9-test-coverage-strategy.md](2026-08-15-v9-test-coverage-strategy.md)
（行为矩阵、三层语料、五层判据、类用例制度、分级执行、两项度量指标）。

### 战役内容

1. **建立真实文档语料库**（前置，需要决策）：
   - 来源：自制"复杂度全开"文档（每种格式一份：多页/主题/嵌图/表格/
     动画/公式/修订/中英混排）、用户可提供的实际踩雷文件（如那份
     EMP PPTX，仅本地测试不入库）、公开可再分发的样例。
   - **仓库约束决策**：现行"不放二进制 fixture"规则与真实语料冲突。
     建议：`test/fixtures/corpus/` 允许小体积（<2MB/个）自制真实文档
     入库；大文件与版权不明文件走本地目录 + CI 缓存，不入库。
2. **系统化测试矩阵**：三编辑器 × {打开、渲染无错、编辑（文字/图片/
   格式）、保存往返、导出 PDF} × 语料库全量。判定不只看"不崩"：
   拦截编辑器内 `asc_onError` 与 `Common.UI.warning`（正是本次 PPT
   弹窗的通道）作为硬失败信号，console error 白名单化。
3. **P0 缺陷清单驱动**：战役第一目标是复现并修复 PPTX 编辑致命错误
   （需要那份 PPT 或等复杂度替代品）；每修一个，固化一条 E2E。
4. **用例固化为制度**（用户要求）：
   - 战役产出的每个缺陷修复**必须**带一条真实语料回归用例；
   - 语料库测试作为独立 E2E project（`test/e2e/corpus-*.spec.ts`），
     进 CI（体量大可设 nightly / 手动触发档）；
   - 制度写入 CLAUDE.md：新功能/新修复没有对应用例不算完成。
5. **发布门槛**：v9 的对外 release 公告（方向七 3）冻结，直到战役
   通过——"稳定性达到或超过 v7"由语料矩阵全绿定义。

### 与 v7 的关系

backup/main-pre-v9 保留完整 v7。若战役发现 v9 有结构性不可修问题，
回滚路径存在；但当前证据（图片保存已修、根因均为"无服务器适配缺口"
而非引擎本体）支持"逐个补适配层"优先于回滚。

## 现状诊断（2026-08-15 页面盘点结论）

存量 24 页落地矩阵（12 en + 12 zh-CN）的 SEO 工程质量很高：TDK、
canonical、双向 hreflang、JSON-LD（WebApplication / FAQPage / HowTo /
Breadcrumb）、页脚互链全齐；robots.txt / sitemap.xml / llms.txt 三件套
存在且结构良好。**真正的债是"内容没跟上代码"**：

- PDF 打开（刚接入）在 index.html、llms.txt、README、sitemap 中零覆盖；
- 运行时只读、CSV 编码嗅探（GBK 不乱码）没有独立着墨；
- llms.txt 与 sitemap lastmod 停在 7 月（llms.txt/README 已随本轮部署
  同步，落地页仍缺）；
- vendor 内部 HTML（web-apps/\*、sdkjs/\*）没有 noindex 卫生；
- 7 月 SEO playbook 的外链造势、GSC 提交等运营项从未启动。

## 方向一：功能说明页与内容补齐（优先级最高，纯内容工作）

1. **`/open/pdf` 落地页（en + zh-CN）**：与现有 /open/docx 同构
   （TDK + FAQPage + HowTo + 页脚互链 + hreflang 互指），目标词
   "open pdf in browser without upload / 在线打开 PDF 不上传"。
   这是与代码能力直接对应的最大内容缺口。
   ✅ 2026-08-16 完成：`public/open/pdf.html` + `public/zh-CN/open/pdf.html`；
   文案只承诺已被 `pdf-roundtrip.spec.ts` 验证的能力（打开/阅读/评论与
   文字批注/另存回 PDF），明确"不能像 Word 一样改写正文"，把改正文引流到
   /open/docx；同时新增 `test/unit/landing-pages.test.ts` 钉住全部落地页的
   canonical/hreflang/JSON-LD/sitemap/双语互指契约，见
   docs/explorations/2026-08-16-pdf-landing-and-landing-contract.md。
2. **CSV 中文乱码长尾强化**：zh-CN 侧价值最高的词是"CSV 乱码/GBK 乱码
   修复"。在 convert/csv-to-xlsx 中文页增补一节"为什么别的工具打开中文
   CSV 会乱码、本工具如何检测编码"，FAQ 加对应问答；评估独立页
   `/fix/csv-garbled`（zh 优先，en 后补）。
3. **只读/预览模式说明**：embed 落地页增补 runtime read-only 一节
   （含 `document:set-readonly` 示例）；docs/embed-api.md 同步。
4. **收尾同步**：index.html 页脚补齐缺失的 6 条内链（private、
   edit-without-account、embed、csv-to-xlsx 等）；sitemap 加新页并刷
   lastmod；llms.txt Pages 段加 /open/pdf。
   ✅ 2026-08-16：sitemap / llms.txt / 双首页 .PDF 卡片 / 全部落地页页脚
   "Open PDF" 已同步；顺手修正 zh-CN 各"打开你的 XLSX/PPTX/CSV" CTA 原本
   指向 `/?locale=zh-CN&new=docx`（落到一份空白 Word）的问题，改指
   `/zh-CN/`。index.html 页脚 6 条内链仍待补。
5. **README**：功能列表已加 PDF（本轮完成）；落地新页后同步 Pages 链接。

## 方向二：SEO / GEO 卫生与运营（playbook 遗留）

1. **爬虫卫生**：`public/_headers` 给 `web-apps/*`、`sdkjs/*`、
   `fonts/*` 加 `X-Robots-Tag: noindex`——60 秒改动，防止 vendor 内部
   HTML 稀释抓取预算，一直没做。
2. **GSC / Bing Webmaster 提交**：部署后提交 sitemap、验证覆盖率，
   看 /open/* /convert/* 的收录与点击基线（需要站长权限，用户操作）。
3. **外链启动**：v9 转正 + PDF 支持是一个像样的"发布事件"，掘金/V2EX/
   HN Show/Product Hunt 各发一稿（playbook 第 3 杠杆，从未启动）。
4. **更多语言落地页**（/ja/ /de/ 等）：见方向八（2026-08-16 评估）。
   注意此前"app i18n 已具备 9 语言"的说法不实：`packages/shared/src/i18n.ts`
   只有 en / zh-CN 两套词条；vendor 编辑器 UI 倒是自带 45 个语言包。

## 方向三：agent / LLM 友好

分层策略：先"boring layers"（内容与结构化数据，方向一/二），再协议层。

1. **llms.txt 持续对齐**（已随本轮部署更新：PDF、只读、CSV 编码、
   Docker 镜像）。新增能力时与 CLAUDE.md 同等待遇——改代码必改 llms.txt。
2. **embed API 的机器可读描述**：docs/embed-api.md 增补一份 JSON 格式的
   消息目录（message type / payload schema / response），既是人类文档
   也是 agent 可直接消费的工具定义——同时就是 WebMCP 工具注册的单一
   数据源。
3. **WebMCP 接入**（见下节）。

## WebMCP 评估与接入方案（2026-08 复评）

**现状**（较 CLAUDE.md 5 月评估已实质变化）：

- Chrome 149–156 公开 **origin trial**，可注册 token 面向生产流量；
  Chrome 146（2026-03）起 stable 带 flag。
- **API 已迁移**：2026-07-21 起规范从 `navigator.modelContext` 迁到
  `document.modelContext`，Chrome 150 废弃旧位置（origin trial 仍兼容
  发货）。接入必须双位置特性检测。
- Edge 实验性支持（flag）；Firefox/Safari 参与讨论、无实现承诺。
- 社区共识：先做好可读内容 + 结构化数据 + 爬虫可达，再上 WebMCP。

**结论：从"暂缓"升级为"低成本接入"。** 理由：我们的 embed-api.ts 已经
是一套完整的消息式工具层，适配是纯映射；无 API 环境静默降级，零风险。

### 这项技术具体能用来做什么

WebMCP 改变的是**浏览器里的 AI agent 与网页的交互方式**：过去 agent 要
"看截图、找按钮、模拟点击"（脆弱、慢、易错），有了 WebMCP，网页可以
直接把自己的能力注册成结构化工具，agent 像调 API 一样调用。

**为什么这件事对本项目的契合度高于绝大多数网站**：多数站点是"名词型"
（内容、商品），agent 只需要读；我们是**"动词型"工具站**——价值就是
"打开 / 转换 / 导出 / 只读预览"这些操作，正是 agent 想调用的东西。而且
我们不需要*发明*工具层：`embed-api.ts` 已经是一套消息式工具协议，
WebMCP 接入本质是把同一批能力换个注册方式暴露出来。

典型场景：

1. **文档格式转换的自然语言入口**：用户对浏览器 agent 说"把这个 CSV
   转成 Excel""这份 docx 导出成 PDF"。agent 发现本站注册了工具，直接
   `open_document_url` + `save_document(targetExt)`，全程无需用户理解
   界面。这是我们最可能被真实调用的场景。
2. **隐私是这里的真差异化**：agent 处理文档的常规路径都要把文件传到
   某个服务端。我们的转换发生在用户浏览器内，agent 只是编排者，
   **数据不出设备**。"可被 agent 调用、又不拿走你的文件的文档工具"
   是一个别人不好复制的定位，也正好接上站点既有的隐私叙事。
3. **与 agent-collab（方向五）合流**：批注/修订 API 打通后，工具集可
   扩展出"给这段加批注""以修订模式改写"——届时站内 agent 面板与
   浏览器外部 agent 共用同一套工具定义，一份实现两处受益。

**接入时要想清楚的两个实际约束**（写在这里免得实现时才发现）：

- **文件怎么进、结果怎么出**：agent 无法直接把用户本地文件塞给网页，
  所以 `open_document_url`（URL 入参）才是真正对 agent 可用的入口；
  而 `save_document` 的返回必须是 JSON 可序列化的，不能直接回 `File`
  ——要返回 blob URL / data URL，或触发下载并回执行结果。这与
  embed-api 现有语义有差别，映射层要处理。
- **只在顶层窗口注册**：跨域 iframe 需父页 `allow`，与 embed 场景冲突；
  首版限定 `window.parent === window`。

**关于现在做的价值**：origin trial 阶段真实用户覆盖接近零，收益不在
即时流量，而在于（a）成本极低（一天，单文件隔离），（b）早期站点会
进入 agent 生态的发现与训练数据，(c) 与方向三的 llms.txt / 结构化数据
是同一个"对机器友好"的连续投资，不是赌一个孤立技术。

**实施设计**（预计一天内）：

1. 新建 `lib/web-mcp.ts`：
   - 特性检测 `document.modelContext ?? navigator.modelContext`，
     不存在直接 return（不引入任何 polyfill）；
   - 注册 5 个工具，复用 embed-api 的现有 handler（不是 postMessage
     自转发，直接调内部函数）：

     | WebMCP 工具            | 复用逻辑                          |
     | ---------------------- | --------------------------------- |
     | `open_document_url`    | openDocumentFromUrl               |
     | `open_document_buffer` | embed open-buffer 同款 handleOpen |
     | `save_document`        | requestSaveDocument               |
     | `set_readonly`         | setReadonlyMode                   |
     | `get_document_state`   | getReadonlyMode + getDocmentObj   |

   - inputSchema 与"方向三 2"的机器可读消息目录同源，避免两份定义。

2. **Origin trial 注册**：edit.chaxus.com 注册 token，经
   `public/_headers` 下发 `Origin-Trial` 头（CF Pages 支持）。
3. **验证**：Chrome 带 flag/token 手测 5 个工具；E2E 暂不覆盖
   （API 在 CI Chromium 不可用，用单测覆盖注册逻辑的降级分支即可）。
4. **风险**：origin trial API 仍可能改形；把全部 WebMCP 依赖收在
   lib/web-mcp.ts 单文件内，改形时只动一处。跨域 iframe 限制
   （需父页 `allow`）与 embed 场景的冲突保持观察，首版只在顶层窗口
   注册（`window.parent === window` 时）。

## 方向四：工程质量线（已定项，此处归档）

1. **PPT E2E 空洞**：页内手拼最小 pptx（复用 docx 的零依赖 zip 手法），
   补打开/保存往返——历史上 PPT 坑最多却是唯一没有 E2E 的主格式。
2. **性能基线审计**：chrome-devtools 对线上跑 LCP/TBT 基线，再决定
   预取（落地页 idle 时 prefetch sdk-all 等核心资产）与 SW 预缓存
   （离线秒开，与隐私定位天然契合）的投入。先测量后优化。

   **基线（2026-08-16，chrome-devtools 打线上，无节流，冷 profile）**：
   - 首页 `/`：LCP 774 ms（TTFB 205 + render delay 569），CLS 0。渲染阻塞
     5 个请求里 4 个是 CSS，1 个是 `web-apps/apps/api/documents/api.js`
     （同步 `<script>`，479 ms）——首页读者根本用不到它。**首刀**：删掉
     该同步标签，`handleDocumentOperation` 入口统一 `await loadEditorApi()`
     （幂等），首页只留 `<link rel="prefetch">`。
   - `?new=docx` 冷打开到 `isDocumentLoadComplete && isLoadFullApi`：
     **≈16 s**。瀑布：app 壳 0.5–0.9 s → `sdk-all-min.js` 424 KB 1.2–1.9 s
     → **`sdk-all.js` 2.95 MB（br）2.0–8.6 s** → 字体 14 个文件 8.9–15.0 s
     → 就绪。总计 61 请求 / 4.2 MB。两个瓶颈：sdk-all.js 纯带宽（边缘已
     REVALIDATED/br，无法再压）；字体仍 `cf-cache-status: DYNAMIC`（CF
     Cache Rule 待用户在面板加）+ 空白 docx 竟拉 14 个字体文件（值得查
     fonts_loading 为何这么多——字体线归战役字体专项）。
   - **预取决策（第 11 项）**：不做无差别 idle 预取——sdk-all.js 3 MB 对
     只读落地页的访客是纯浪费；改为"意图触发"：hover/focus 到 Open/New
     按钮、文件选择框弹出时 `<link rel=prefetch>` sdk-all-min.js + sdk-all.js
     - app.js（同源、SWR 缓存会接住），零成本覆盖 80% 的真实打开。SW
       离线预缓存等路由拆分后按新首页再测。

   **2026-08-16 已落地的第一批（由用户"线上 PPT 永久 Loading、本地正常"
   报障驱动，全部有线上冷/热 profile 实测数字）**：
   - `_headers`：`/fonts/*` 与 `x2t.wasm.gz` immutable（`a2a4010`）；
   - `sw.js`：索引字体与 wasm cache-first（同上）；
   - 守卫 8（`0e063d4`）：文档字体**并行**预取（vendor 是逐族串行）+
     关闭 `IsNeedDefaultFonts`（12 文件 / 3.2MB 无用预载）；
   - 线上实测（EMP 35 页 deck，30 字体 / 40MB）：首开 **4 分钟+ 未完成 →
     61s（缓存）→ 45s（+并行）**；第二次打开 **3s**。
   - 剩余瓶颈：单个 4.7MB 字体在冷 CF 路径 32s + **CF 边缘对无扩展名
     路径不缓存**（`cf-cache-status: DYNAMIC`）。

   **待用户在 Cloudflare 控制台操作（代码做不到）**：Pages 项目 →
   Caching → Cache Rules → 新建：`URI Path starts with /fonts/` OR
   `URI Path ends with .wasm.gz` → Cache eligibility: Eligible for cache，
   Edge TTL: 1 year（respect origin 亦可，origin 已给 immutable）。生效后
   每个地区**首位**用户拉一次、后续用户走边缘，首开预计降到 10–20s
   量级（受用户带宽）。

   **下一步候选**：（a）按文档实际引用裁字体加载（把 `LoadDocumentFonts`
   的 NeedStyles=15 全面加载收窄到文档 run 属性真用到的面）；（b）字体
   子集化/拆分大 CJK 字体（4–5MB 的 Noto KR/宋体/Droid 是最大头）；
   （c）落地页 idle 时预热 sdk-all + wasm（与 SW cache-first 配合，
   编辑器首开可提前）。

3. **部署后 issue 验证清单**：#92、#12、#64、#15、#94、#49、#21 逐个
   线上实测，预计可再关一半以上。

## 方向五：产品线（大周期）

**agent-collab 批注/修订**：API 配方与坑位见
[2026-08-14-peer-static-sdk-integration-study.md](../../explorations/2026-08-14-peer-static-sdk-integration-study.md)
第 2 节。原则：薄封装 + 每个能力配真实编辑器 E2E（参考实现零 E2E 的
逆向层是反面教材）。WebMCP 工具层落地后，agent 面板与外部 agent
（浏览器侧）共用同一套工具定义。

## 方向六：站点体验与路由架构（2026-08-15 追加）

1. **embed-demo 页对齐 ran 设计体系**（小，半天）：
   `public/embed-demo.html` 目前是游离于主站风格外的手写样式，但它是
   embed 集成方的第一印象页。用 ranui 组件 + `--ran-*` 设计 token 重做，
   与主站落地页同一视觉语言。已在 CLAUDE.md 重要约定中落成硬规则：
   **所有用户可见页面（含 demo 页、404）必须使用 ranui/ranuts 体系**，
   后续新页面不允许再出现游离样式。E2E 依赖 embed-demo 的 `post()` 全局
   与按钮语义，重做时保住这些契约（改样式不改行为）。
2. **首页与编辑器路由拆分**（中，1~2 天，建议配合性能基线做）：
   现状 `/` 同时承担 SEO 落地页、新建、编辑三个角色，问题：首屏被编辑器
   资产拖累、URL 不可分享、刷新/后退语义混乱。目标形态：
   - `/` 纯静态落地页（现有 SEO hero 保留，不加载编辑器栈）；
   - `/editor` 编辑器入口：`?new=docx|xlsx|pptx` 新建、`?src=` 打开，
     embed 场景改挂 `/editor?embed=1`（参考实现同形态：`/editor?new=`）；
   - Vite 已是多入口 MPA，新增 editor.html 入口即可，无需路由框架。

   **向后兼容是硬约束**：存量外部链接 `/?src=`、`/?file=`、`/?embed=1`
   （外部嵌入方在用）必须继续工作——`/` 检测到这些参数时带参跳转
   `/editor`（或直接双通道处理）；sitemap/canonical/hreflang 同步更新；
   embed-api、E2E（baseURL 与 embed-demo iframe src）全量回归。
   收益与"性能基线审计"（方向四 2）直接挂钩：先测基线，拆分本身就是
   首页 LCP 的结构性优化，拆完再测收益。

## 方向七：帮助中心与 Release Notes（2026-08-15 追加）

两个真实缺口：**站点没有任何面向用户的帮助内容**（docs/ 下只有开发者向的
embed-api / fonts，且不发布到站点），**也没有公开的版本记录**——GitHub
release 停在 v0.0.5（2026-07-12），v9 这一整轮（引擎更换、PDF 打开、
运行时只读、CSV 编码、字体体系）至今**未发布任何 release**。

### 1. 先补一个 markdown → HTML 生成器（前置，两页共用）

现有落地页是手写静态 HTML（`public/*.html`，无打包器，build 时注入
ran token + ranui IIFE）。帮助中心是"多页 × 双语"、release notes 是
"每次发版都改"，继续手写 HTML 不可持续。方案：`bin/` 加一个小生成器，
把 markdown 渲染进与落地页**同一套外壳**（相同 head/meta/canonical/
hreflang/JSON-LD/页脚互链 + ranui 设计体系），产出静态 HTML。

收益不止省事：`docs/embed-api.md`、`docs/fonts.md` 可以直接发布到站点，
消灭"仓库里有文档、站点上没有"的割裂，且保持单一数据源。

### 2. 帮助中心 `/help`（en + zh-CN）

内容面向真实用户问题，而不是营销词：如何打开/新建/导出、CSV 中文乱码
怎么办、PDF 能做什么不能做什么、只读与嵌入怎么用、离线与 PWA 安装、
隐私边界（为什么文件不上传、什么情况下会联网）、快捷键、常见错误码
（-85 等，与新加的 toast 提示对应）、自托管（Docker）。

三重价值：用户自助（降低 issue 噪音，#49/#113 那类报障本可自助定位）、
SEO（how-to 长尾）、GEO/LLM（帮助内容正是 LLM 最爱引用的形态，与
llms.txt 形成互补）。结构化数据用 FAQPage / HowTo，并入 sitemap。

### 3. Release Notes `/changelog`（en + zh-CN）

单一数据源 `CHANGELOG.md`（人工撰写、面向用户的语言，**不是** commit
日志的转储——`fix(v9): enhance Docker E2E testing` 这类对用户无意义），
同时喂三处：站点 `/changelog` 页、GitHub release body、llms.txt 的
"最近更新"。

**立即要做的一件事**：v9 这轮该发一个正式 release（v0.1.0 或 v1.0.0，
版本号语义由用户定）。它同时是方向二 3「外链发布事件」的弹药——发稿
时有一个正经的 release notes 页可以指向，比空口说"升级了"有力得多。

## 方向八：多语言站点（2026-08-16 追加，用户提出）

参照的产品语言菜单：English / 简体中文 / 日本語 / Español / Português /
한국어 / Deutsch / فارسی（8 种）。

### 现状盘点（2026-08-16 实测）

| 层                        | 现状                                                                                                                                                                     | 备注                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| 落地页 / 首页（SEO 主体） | en + zh-CN 两套静态 HTML（各 12 页），hreflang 互指，`landing-pages.test.ts` 钉契约                                                                                      | 每种新语言 = 再复制 12 页，纯内容工作量最大                              |
| 站点 App 壳 i18n          | `packages/shared/src/i18n.ts` **仅 en / zh-CN**（≈40 个 key：菜单、toast、agent 面板）；`?locale=` / cookie / navigator 检测链已具备                                     | 词条量小，加语言便宜                                                     |
| 编辑器 UI（OnlyOffice）   | vendor 自带 45 个语言包（ar bg cs da de el es fi fr he hu id it ja ko nl pl pt pt-pt ro ru sv tr uk vi zh zh-tw …），`editorConfig.lang` 已由 `getOnlyOfficeLang()` 传入 | **无 fa（波斯语）**，fa 会回落 en；`lang` 目前只会产出 en / zh-CN 两个值 |
| 编辑器帮助 / 拼写         | 帮助已裁剪；拼写关闭                                                                                                                                                     | 无需处理                                                                 |
| RTL（fa / ar / he）       | 落地页样式未考虑 `dir="rtl"`；编辑器 UI 侧 OnlyOffice 9 支持 RTL 界面（`Common.UI.isRTL`），文档内容 RTL 本就支持                                                        | fa 要单独做 RTL 布局验收                                                 |

### 方案（分三层、可独立交付）

1. **编辑器 UI 语言跟随（1 小时，零内容成本，收益最大）**：把
   `getOnlyOfficeLang()` 从"只认 en/zh-CN"扩成"任何 vendor 有语言包的
   BCP-47 都透传"（`navigator.languages` → 匹配 45 包，`?locale=` 优先），
   这样日/韩/德/西/葡用户打开文档时编辑器菜单已是母语，站点壳的 40 个词条
   暂时回落 en 也可接受。同时把 `zh-TW`→`zh-tw`、`pt-BR`→`pt` 之类的映射
   写成表 + 单测。
2. **站点壳 i18n 补齐 6 种（半天）**：`i18n.ts` 词条 ≈40 个，一次性补
   ja / es / pt / ko / de / fa；`Language` 类型从二选一改成联合；
   `?locale=` 与 `<r-select>` 语言切换器改数据驱动（一份 locale 清单供
   落地页语言菜单、lang-switch.js、sitemap 生成共用）。
3. **多语言落地页（每语言 1～2 天，按流量决定顺序）**：不再手写 12 页
   × N。前置是方向七 1 的"markdown→HTML 生成器"——把落地页也纳入生成：
   `content/<locale>/open/pdf.md`（frontmatter：title/description/faq/
   howto）→ 同一套 landing 壳渲染 → 自动生成 hreflang 全集、sitemap、
   语言菜单、llms.txt。**这决定了生成器不能只考虑 help/changelog，
   要按"任意 locale × 任意页"设计。** 首批语言按 GSC 非中英流量选
   （建议 ja、es、pt 先行，fa 需额外 RTL 验收）；机器初译 + 人工校对，
   `landing-pages.test.ts` 自动覆盖新 locale（遍历 public/ 时按目录
   识别 locale，改动很小）。
4. **RTL 验收（fa 前置，半天）**：landing.css 用逻辑属性
   （margin-inline / padding-inline / text-align: start）替换左右属性；
   `<html dir="rtl">`；编辑器 iframe 侧确认 OnlyOffice RTL 界面开关。

### 与其它方向的耦合

- 生成器（方向七 1）先做且按 locale × page 设计 → 方向八 3 才不返工。
- 语言菜单：与截图一致的形态（当前语言在顶、其它带外链箭头）用 ranui
  `<r-select>` 现有 lang-switch 扩展即可，不另写组件。
- 首页/编辑器路由拆分（方向六 2）时把 `/<locale>/` 目录约定一并定死。

## 深色 / 亮色模式现状（2026-08-16 评估 + 修补）

- **站点层已支持**：首页、全部落地页、embed-demo 都挂 ranui
  `<r-theme-switch>`（light / dark / system），token 层 `--ran-*` 随
  `<html data-ran-theme>` 翻转，`index.html` 有 no-flash 恢复脚本。
- **编辑器层此前不跟随**：编辑器主题固定 `theme-classic-light`
  （或用户在编辑器内选过的 `ui-theme-id`），深色站点打开的是亮色编辑器。
  2026-08-16 修补：新增 `lib/editor-theme.ts`——挂载时 dark 站点 →
  `theme-dark`、light → classic；文档打开期间监听 `data-ran-theme` 与
  OS 媒体查询实时 `Common.UI.Themes.setTheme`；用户在编辑器内手选的
  主题优先（用 `ui-theme-site-driven` 标记区分"我们驱动的"与"用户选的"）。
  单测 `test/unit/editor-theme.test.ts`；真浏览器验证 dark 挂载 +
  双向实时切换。
- ✅ 2026-08-16 补齐：右下角 FAB Menu 末行加了 `<r-theme-switch>`
  （i18n 四个词条），文档打开期间可切换，编辑器实时跟随。
  文档正文的"深色画布"（OnlyOffice `asc_setContentDarkMode`）刻意不
  跟随——那是编辑器内的用户偏好，且会改变文档观感。

## 方向九：ranui / ranuts 版本对齐与 IIFE 防漂移（2026-08-16 追加，用户要求）

**背景**：静态页（落地页、demo、404、changelog/help 生成页）没有 bundler，通过
`public/ranui-iife/<comp>.iife.js` 使用 ranui；这些文件由 `bin/build.sh` 从已安装的
ranui 复制并**入库**。用户指出仍在用"历史有问题的版本"。

**审计（2026-08-16）**：`public/ranui-iife/*` 与安装的 ranui 0.5.0-alpha.2 逐字节一致，
且 0.5.0-alpha.2 = npm `latest`；但源仓库 `chaxus/ran` 的 ranui 有 8-13 之后**未发布**
的修复（colorpicker、player、math 字体等），dist 也是 8-13 构建。结论：落后的是
**npm 上的发布**，不是本仓的复制。

**分级实施**：

1. **L1 防漂移哨兵（已做）**：`test/unit/ranui-vendor-sync.test.ts`——每个入库 IIFE 与
   `node_modules/ranui/dist/iife` 逐字节一致、页面引用的每个 IIFE 都已 vendored、
   workspace 各包 ranui/ranuts 版本与根一致（双份 ranui 会让自定义元素先到先得、图标静默丢）。
2. **L2 发版对齐（需用户在 ran 仓库操作）**：从 `chaxus/ran` 发布 ranui `0.5.0-alpha.3`
   （含 8-13 后的修复），本仓 `package.json` + 三个 workspace 包同步 bump，
   `pnpm install` 后 `bin/build.sh` 自动重拷 IIFE；提交前用 L1 哨兵与 E2E
   （embed-demo、主站落地页）验证。发版是外部动作，由用户执行或授权。
3. **L3 上游可用性提醒（自动化）**：夜间任务加一步 `npm view ranui version` 与
   `package.json` 比对，落后即在 step summary 提示（不失败）。
4. **L4 反向修复**：ranui IIFE 若发现缺陷，按"ran 生态优先"改 `chaxus/ran` 再发版，
   不在本仓打补丁。

## 建议执行顺序（2026-08-15 三修：方向零插入为最高优先级）

**方向零（全面回归战役）压倒下表所有事项**；表内条目在战役期间仅在
等待复现/等待用户提供语料的空档穿插推进。CHANGELOG.md 已建立
（方向七 3 前半完成），但 v9 release 公告冻结至战役通过。

## 原执行顺序（2026-08-15 更新：加入方向六、七，第 1 项已完成）

| 序  | 事项                                             | 体量      | 状态                                                                                                                                          |
| --- | ------------------------------------------------ | --------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 部署后 issue 验证清单（方向四 3）                | 半天      | ✅ 已完成，关 6 个                                                                                                                            |
| 2   | CHANGELOG.md + 发布 v9 release（方向七 3 前半）  | 1 小时    |                                                                                                                                               |
| 3   | /open/pdf 落地页 + 内容收尾同步（方向一）        | 半天~1 天 | ✅ 2026-08-16 落地页 + sitemap/llms/首页卡片/页脚互链 + `landing-pages.test.ts` 契约；方向一 2/3（CSV 乱码长文、只读说明）待做                |
| 4   | vendor noindex + GSC 提交（方向二 1/2）          | 1 小时    | ✅ 2026-08-16 noindex 已上（`_headers` + hosting-contract 钉住）；GSC/Bing 提交需站长权限，待用户                                             |
| 5   | embed-demo 对齐 ran 设计体系（方向六 1）         | 半天      | ✅ 2026-08-16 r-button/r-input/r-checkbox/r-card/r-theme-switch + token；E2E 契约不变，见 explorations/2026-08-16-embed-demo-ranui-restyle.md |
| 6   | markdown→HTML 生成器（方向七 1，后两项的前置）   | 半天~1 天 | ✅ 2026-08-16 `bin/build-pages.mjs`（locale × page，marked，FAQ/TOC 自动，输出入库 + `--check` 单测）                                         |
| 7   | /help 帮助中心 + /changelog 页（方向七 2/3）     | 1~2 天    | ✅ 2026-08-16 /help、/help/embed-api、/changelog（en + zh-CN）；CHANGELOG 中文版待补                                                          |
| 8   | PPT E2E（方向四 1）                              | 小时级    | ✅ 已由战役覆盖：format-parity / embed-save-default / resave-idempotence / visual-roundtrip / corpus 均含 pptx 打开-编辑-保存-导 PDF          |
| 9   | 性能基线审计（方向四 2 前半）                    | 半天      | ✅ 2026-08-16 线上基线已测（见方向四 2 的"基线"小节）+ 首刀：api.js 改按需加载（PR）                                                          |
| 10  | 首页/编辑器路由拆分（方向六 2，基线之后做）      | 1~2 天    |                                                                                                                                               |
| 11  | 预取/SW 预缓存决策（方向四 2 后半，拆分后再测）  | 1 天      | ↻ 决策已给：不做无差别 idle 预取，改"意图触发预取"（见方向四 2）；SW 预缓存待路由拆分后测                                                     |
| 12  | WebMCP 薄适配 + origin trial（专节）             | 1 天      |                                                                                                                                               |
| 13  | 外链发布稿（方向二 3，指向 /changelog 与新功能） | 用户主导  |                                                                                                                                               |
| 14  | agent-collab（方向五）                           | 大周期    |                                                                                                                                               |

排序理由：

- **2 提到最前**：v9 早该有个 release，1 小时的事，且它是后面外链发稿
  的前提；CHANGELOG.md 先落地，`/changelog` 页等生成器就绪后再补。
- 3/4 是纯内容与卫生、零风险先清掉；5 小而独立（改样式不改行为）。
- **6 必须在 7 之前**：生成器是帮助中心与 changelog 页的共同前置，
  先有它才不会写出一堆手工 HTML。
- 9/10/11 构成"测量 → 结构性优化 → 再测量"的闭环，路由拆分放在基线
  之后是为了量化收益。
- WebMCP（12）排在路由拆分之后：工具注册入口（顶层窗口判断）会受
  路由形态影响，拆完再接少返工。
- 13 放在内容与 release 都就位之后——发稿时手上要有能指的东西。
