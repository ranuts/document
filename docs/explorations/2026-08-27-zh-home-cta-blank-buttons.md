# 中文首页四个 CTA 按钮是空白药丸（2026-08-27）

## 现象

`/zh-CN/` 的 hero 区，"打开文件 / 新建 Word / 新建 Excel / 新建 PPT" 四个按钮渲染成
四个没有文字的圆角块——按钮本身、布局、点击行为都在，只是没有标签。英文首页正常。

## 根因

`73b460b`（refactor(landing): generate the homepages from data too）把两张手写首页
改成由 `content/<locale>/home.json` 驱动，迁移 zh-CN 时 `cta` 四个键留成了空串：

```json
"cta": { "open": "", "docx": "", "xlsx": "", "pptx": "" }
```

而 `render-home.mjs` 忠实地把空串写进 `<r-button>`，于是按钮有壳无字。
迁移前那版 `public/zh-CN/index.html` 里写的是"打开文件 / 新建 Word / 新建 Excel /
新建 PPT"，现已按原文填回。

七种语言里只有 zh-CN 有空串（脚本全量扫过），所以这是一次性的迁移遗漏，不是机制问题。

## 为什么没有测试拦住

`test/unit/landing-pages.test.ts` 钉的是 canonical / hreflang / JSON-LD / sitemap /
双语互指这些**结构**契约。空串在这些维度上完全合法：键在、页面在、链接在，只是没有
文字。渲染出的 HTML 也仍然是合法的 `<r-button></r-button>`。

## 补的用例

同一个文件末尾加 `homepage content data` 两条：

1. **每个 locale 的 home.json 不得有空串**（递归到每个叶子，报出路径如 `cta.docx`）。
   反向验证：把四个 cta 值改回空串，这条立刻红；改回来即绿。
2. **每个 locale 的槽位集合必须与 en 相同**（数组下标折叠成 `[]`）——键少了就是少一
   个位置。下标必须折叠：`foot.links` 是按"该语言真正存在哪些页面"列的，ONLYOFFICE
   那页只有 en 和 zh-CN 有，ja/de/es/ko/pt 就少一条，那是对的。

第 1 条管"有键没内容"，第 2 条管"没有键"，两种都会在页面上表现为缺一块东西。
