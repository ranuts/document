# 首页禁掉了缩放、没有 main、绿字看不清；llms.txt 里"没有链接"（2026-08-27）

给中文首页跑了一次 Lighthouse（mobile），四条不及格。四条都不是中文特有的，
七种语言的首页一样，只是没人量过。**Accessibility 88 → 100，Agentic Browsing 67 → 83。**

## 1. 首页禁止缩放（WCAG 1.4.4）

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
```

七张首页与 `editor.html` 都带这一行，卫星页、`/history`、`/404` 都不带。
编辑器留着是对的（它自己有缩放，画布上的捏合是另一个意思）；**首页留着就是把
放大功能从访客第一眼看到的页面上拿走**，而那正是低视力用户第一个会做的动作。
去掉后 `bin/pages/render-home.mjs` 与 `render-page.mjs` 的 viewport 一致。

## 2. 首页没有 `<main>`

卫星页一直有 `main.wrap`，首页把所有内容裹在 `<section id="landing-hero">` 里，
于是"跳到主内容"没有落点，agent 的阅读顺序也没有主区。在 `</header>` 与
`<footer>` 之间补上 `<main>`。`#landing-hero` 是普通块（不是 flex/grid），
CSS 全是后代选择器，插一层不影响布局——逐像素比对过。

## 3. 绿色小字对比度 3.06:1

`--ran-color-success` = ranui green-700 `#28a948`，在白底上 3.06:1。
7px 的状态点用它没问题；**四处 10–12px 的小字用它就不够 AA 的 4.5**：
chip 里的"开源"、文档窗口的"已保存到本地"徽章、批注块的标题、步骤的位置标签。

`#landing-hero` 里加一个 `--success-text: var(--ran-green-900)`（同色相往下两档，
白底 5.2:1；深色模式下 green-900 反而更亮），四处文字改用它，**填充仍用基础 token**。
没有去改 ranui 的 `--ran-color-success`——那是"成功"的语义色，不是"文本级绿"。

## 4. llms.txt 被判定为"没有链接"

文件内容一直是全的，但每条写成 `- Title: https://url`。llmstxt.org 的格式是
`- [Title](url): 说明`，Lighthouse 的 agentic-browsing 因此报
"File does not appear to contain any links"。改成 markdown 链接列表，顺手把括号里的
补充说明挪到冒号后（`[Convert XLSX to CSV locally](url): no upload`）。
内容一个字没删。Docker 那条仍是纯文本——`ghcr.io/ranuts/document` 是 pull 目标，不是网页。

## 用例

- `test/unit/landing-pages.test.ts`：**每个页面**（不只首页）viewport 不得含
  `user-scalable=no` / `maximum-scale=1`；**每个页面**恰好一个 `<main>`；
  llms.txt 的 Links/Pages 两节除 Docker 那条外必须是 markdown 链接，且链到的
  站内路径必须存在。
- `test/unit/design-contract.test.ts`：`--success-text` 必须定义为 green-900；
  home.css 里任何声明了 <14px 字号的规则都不得把 `--ran-color-success` 用作 `color`。
  （这条不是"检查一遍现状"，是把规则本身钉住：下一个 10px 的绿标签会红。）

反向验证：撤掉 render-home 的两处改动 → 7 张首页的 zoom 与 main 两条全红；
撤掉 llms.txt → 那两条红；撤掉 home.css → design-contract 两条红，并点名
`.dw-badge` / `.dw-note b` / `.step .loc`。

## 还剩一条：CLS 0.25

Agentic Browsing 卡在 83 是因为首页 CLS 0.25（阈值 0.1）。这是性能项、且是在
dev server 上量的（未压缩、字体加载时序与线上不同），要判断得对线上量一次。
本轮没动它。
