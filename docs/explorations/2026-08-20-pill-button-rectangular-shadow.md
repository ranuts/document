# 药丸按钮底下那条线：阴影画在方盒子上

2026-08-20

## 现象

用户截图：首页 hero 的 `New Word` / `New Excel` / `New PowerPoint` 三个白色药丸按钮，
底部各有一条横线，而且**超出了圆角的范围**——线在两端直直地伸到圆弧外面。

## 排查

先怀疑 `<a>` 的下划线（markup 确实是 `<a href="/editor?new=docx"><r-button>…</r-button></a>`，
而没有 `<a>` 包裹的 `Open a file` 看着没这条线）。但 `home.css` 里早就有
`#landing-hero .cta a { text-decoration: none; }`，computed style 也确认
`text-decoration-line: none`。不是它。

也不是 `border-bottom`（`0px none`），不是 `<a>` 的阴影（`none`）。

直接量宿主元素：

```
#hero-new-docx (r-button 宿主)
  box-shadow:    rgba(0,0,0,.04) 0 1px 2px, rgba(0,0,0,.05) 0 2px 4px -2px
  border-radius: 0px          ← 就是它
```

## 根因

ranui 的按钮把 **raised shadow 画在 `:host` 上**：

```css
:host {
  box-shadow: var(--ran-btn-box-shadow, var(--ran-skin-raised-shadow, …));
}
```

而**圆角在 shadow DOM 内部的 part 上**：

```css
border-radius: var(--ran-btn-border-radius, var(--ran-radius-sm, 6px));
```

`:host` 自己没有任何 border-radius。站点这边只覆盖了 part：

```css
#landing-hero .cta r-button::part(button) {
  border-radius: var(--ran-radius-full);
}
#landing-hero .cta r-button::part(content) {
  border-radius: var(--ran-radius-full);
}
```

于是圆角药丸外面套着一个**直角矩形**的阴影。阴影本身是柔和的（`0 1px 2px` +
`0 2px 4px -2px`），但它的轮廓是方的，所以在药丸下沿露出一条贴着直边的线，两端还
越过圆弧。

**为什么以前没人发现**：ranui 默认圆角只有 6px，方阴影和圆按钮的错位小到看不出来。
hero 的 CTA 用了 `--ran-radius-full`（药丸），错位一下子放大到肉眼可见。

## 修法

宿主也给同样的圆角——`public/home.css` 与 `public/landing.css` 各一处：

```css
#landing-hero .cta r-button,
#landing-hero .cta r-button::part(button) {
  border-radius: var(--ran-radius-full);
}
```

Playwright 实测：`hostRadius` 从 `0px` 变成 `9999px`，截图里那条线和方角都消失了。

## 用例

`test/unit/landing-pages.test.ts` 新增契约：**任何给 `r-button::part(button)` 设圆角的
规则，同一张表里必须有规则给对应的裸宿主选择器设同一个圆角值**。这条比"检查某个字符串
存在"强，因为它是从 CSS 里解析出来的选择器/属性对应关系。

**反向验证三种改坏方式，全部变红**：

| 改坏                               | 结果 |
| ---------------------------------- | ---- |
| home.css 去掉宿主选择器            | 红   |
| landing.css 去掉宿主选择器         | 红   |
| 宿主圆角写成 6px（与 part 不一致） | 红   |

**第一版是假保护**：最初那条断言用了 `selector.replace(...)` 去和自己派生出来的字符串
比对，恒真——把修复整个删掉它照样绿。重写成"解析出所有规则，再去找宿主规则"才真的红。
第二次栽在同一处（当天早些时候 apt 那条断言也是假的），教训是：**断言里出现"从被测字符串
自己派生出来的期望值"，基本就是恒真**。

顺带还踩到解析细节：`([^{}]+)\{([^}]*)\}` 会把规则前面的 CSS 注释吃进选择器，导致
`selectors.includes(host)` 永远匹配不上。解析前先剥注释。

## 留给生态的

真正的根因在 ranui：`:host` 画阴影却不带圆角，任何通过 `::part` 改圆角的使用方都会
撞上。上游的修法是让 `:host` 也读 `--ran-btn-border-radius`。这需要在 `chaxus/ran`
改并发新版本，不在本次范围内——本仓的修法（使用方同时设宿主圆角）无论上游改不改都是
对的。
