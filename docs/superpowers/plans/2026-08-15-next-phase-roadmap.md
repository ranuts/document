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

## 建议执行顺序

| 序  | 事项                                       | 体量      |
| --- | ------------------------------------------ | --------- |
| 1   | 部署后 issue 验证清单（方向四 3）          | 半天      |
| 2   | /open/pdf 落地页 + 内容收尾同步（方向一）  | 半天~1 天 |
| 3   | vendor noindex + GSC 提交（方向二 1/2）    | 1 小时    |
| 4   | PPT E2E（方向四 1）                        | 小时级    |
| 5   | WebMCP 薄适配 + origin trial（专节）       | 1 天      |
| 6   | 性能基线审计 → 预取/SW 决策（方向四 2）    | 1 天      |
| 7   | 外链发布稿（方向二 3，配合 v9+PDF 发布点） | 用户主导  |
| 8   | agent-collab（方向五）                     | 大周期    |
