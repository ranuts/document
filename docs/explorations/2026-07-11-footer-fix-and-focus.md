# 页脚布局修复 + 信息聚焦（去掉 @ranui/preview 展示）

日期：2026-07-11
分支：feat/seo-landing-hero
涉及：`index.html`、`public/zh-CN/index.html`、`public/home.css`

## 页脚无样式的根因（用户报告"底部只有文本"）

标记是 `<footer class="foot wrap">`（同一元素两个类），而 home.css 写的是
`#landing-hero .foot .wrap`（**后代**选择器）——从未匹配，页脚的 flex 布局
（© 左 / 导航中 / AGPL 右）一直没生效，退化为裸文本流。该 bug 在重设计
之前就存在（原版 CSS 同样写法），这次改为复合选择器 `.foot.wrap` 修复，
并留了注释说明。

顺带审计了其余 `.wrap` 相关选择器：`.bar .wrap`、`.eco .wrap` 都有真实
嵌套结构，`.hero`/`.section` 直接用单类命中复合元素，无同类问题。

## 信息聚焦（用户要求）

@ranui/preview 的展示信息删除（"信息太多不够聚焦"）：

- hero 下方的 crosslink 行（"只想预览或嵌入…→ @ranui/preview"）英/中两处删除，
  对应的 `.crosslink` CSS 一并移除
- 生态条（.eco）里的 "@ranui/preview 嵌入文件预览" 芯片删除，
  现在只剩 edit.chaxus.com（当前站）+ ran.chaxus.com（组件库）
- head 里 JSON-LD 的 `sameAs` npm 链接保留（不可见元数据，利于实体关联）

## 验证

- zh 首页实测：页脚三段 flex 布局正常、生态条两芯片、hero 无 crosslink
- 注意 dev 验证 public/ 下 CSS 改动前先清 SW 缓存（再次踩坑确认）
- format / lint:ts 通过
