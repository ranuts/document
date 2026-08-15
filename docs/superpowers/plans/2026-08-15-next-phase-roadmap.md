# 下一阶段规划：内容补齐、SEO/GEO/LLM 友好、WebMCP、工程与产品线

日期：2026-08-15
前置状态：v9 已转正并即将替换 main 部署（main 备份为 backup 分支）；
CLAUDE.md 代码侧待办已清零；E2E 17 条全绿。

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
2. **CSV 中文乱码长尾强化**：zh-CN 侧价值最高的词是"CSV 乱码/GBK 乱码
   修复"。在 convert/csv-to-xlsx 中文页增补一节"为什么别的工具打开中文
   CSV 会乱码、本工具如何检测编码"，FAQ 加对应问答；评估独立页
   `/fix/csv-garbled`（zh 优先，en 后补）。
3. **只读/预览模式说明**：embed 落地页增补 runtime read-only 一节
   （含 `document:set-readonly` 示例）；docs/embed-api.md 同步。
4. **收尾同步**：index.html 页脚补齐缺失的 6 条内链（private、
   edit-without-account、embed、csv-to-xlsx 等）；sitemap 加新页并刷
   lastmod；llms.txt Pages 段加 /open/pdf。
5. **README**：功能列表已加 PDF（本轮完成）；落地新页后同步 Pages 链接。

## 方向二：SEO / GEO 卫生与运营（playbook 遗留）

1. **爬虫卫生**：`public/_headers` 给 `web-apps/*`、`sdkjs/*`、
   `fonts/*` 加 `X-Robots-Tag: noindex`——60 秒改动，防止 vendor 内部
   HTML 稀释抓取预算，一直没做。
2. **GSC / Bing Webmaster 提交**：部署后提交 sitemap、验证覆盖率，
   看 /open/* /convert/* 的收录与点击基线（需要站长权限，用户操作）。
3. **外链启动**：v9 转正 + PDF 支持是一个像样的"发布事件"，掘金/V2EX/
   HN Show/Product Hunt 各发一稿（playbook 第 3 杠杆，从未启动）。
4. **更多语言落地页**（/ja/ /de/ 等）：app i18n 已具备（9 语言），
   playbook 的前提已满足；建议先看 GSC 中非中英流量占比再决定。

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

## 建议执行顺序（2026-08-15 更新：加入方向六，第 1 项已完成）

| 序  | 事项                                            | 体量      | 状态               |
| --- | ----------------------------------------------- | --------- | ------------------ |
| 1   | 部署后 issue 验证清单（方向四 3）               | 半天      | ✅ 已完成，关 6 个 |
| 2   | /open/pdf 落地页 + 内容收尾同步（方向一）       | 半天~1 天 |                    |
| 3   | vendor noindex + GSC 提交（方向二 1/2）         | 1 小时    |                    |
| 4   | embed-demo 对齐 ran 设计体系（方向六 1）        | 半天      |                    |
| 5   | PPT E2E（方向四 1）                             | 小时级    |                    |
| 6   | 性能基线审计（方向四 2 前半）                   | 半天      |                    |
| 7   | 首页/编辑器路由拆分（方向六 2，基线之后做）     | 1~2 天    |                    |
| 8   | 预取/SW 预缓存决策（方向四 2 后半，拆分后再测） | 1 天      |                    |
| 9   | WebMCP 薄适配 + origin trial（专节）            | 1 天      |                    |
| 10  | 外链发布稿（方向二 3，配合 v9+PDF 发布点）      | 用户主导  |                    |
| 11  | agent-collab（方向五）                          | 大周期    |                    |

排序理由：2/3 是纯内容与卫生、零风险先清掉；4 小而独立（改样式不改
行为）；6/7/8 构成"测量 → 结构性优化 → 再测量"的闭环，路由拆分放在
基线之后是为了量化收益；WebMCP 排在路由拆分后，因为工具注册的入口
（顶层窗口判断）会受路由形态影响，拆完再接少返工。
