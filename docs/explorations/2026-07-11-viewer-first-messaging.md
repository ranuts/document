# 首页叙事重构：查看优先（viewer-first），编辑兜底

## 问题

用户指出的严重定位问题：首页从 `<title>` 到 hero 文案全是"文档编辑器"叙事，
但产品的最高频场景是**拿到一个 docx/pptx/xlsx、没装 Office，想直接在浏览器
里打开看**。这个场景在页面上完全没有体现——查看类卫星页（/open/docx 等）
只有页脚一个不起眼的入口，搜索意图（"怎么打开 docx"、"docx viewer online"）
与页面关键词严重错位。

## 改动

**Hero 文案换叙事主语**（EN + zh-CN 镜像）：
- H1：Edit → **Open** Word, Excel & PowerPoint files…（中文：在浏览器里直接
  打开 Word、Excel 和 PPT）
- 副标题以"No Office installed? View any DOCX, XLSX or PPTX instantly"开头，
  编辑降为"and edit it when you need to"。

**新增"打开文件"区**（hero 与 Why it's different 之间）：四张
`r-card hoverable` 卡片直达卫星页——/open/docx、/open/xlsx、/open/pptx、
/convert/xlsx-to-csv（zh 链接到 /zh-CN/ 镜像）。每卡 mono 格式标签 + 标题 +
一句话 + 蓝色 mono 箭头链接。这同时把此前只有页脚入口的卫星页提升为一级
信息架构，内链权重也顺带改善。

**SEO 层同步**：`<title>`/description/OG/Twitter 改为
"Open DOCX, XLSX & PPTX in Your Browser — Free Document Viewer & Editor"
（中文"在浏览器打开 DOCX、XLSX、PPT 文件——免装 Office 的在线查看与编辑
器"）；JSON-LD WebApplication 的 description 与 featureList 首条加入
"Open and view … without Microsoft Office"。

**样式**（public/home.css）：新增 `.formats` 四列网格（900px 两列、560px 单
列）、`.fmt-go` 蓝色 mono 链接；`:not(:defined)` 卡片兜底选择器扩展覆盖
`.formats`。全部走既有 token/组件模式，无新调色。

## 验证

- EN/zh 首页截图核对（新区块、hover、蓝色入口链接正常）
- 240 个单测、lint:ts、format:check、生产构建全绿

## 备注

品牌名（Document Editor / 文档编辑器）保持不变，只换叙事重心；卫星页本身
文案已是查看优先，无需改动。
