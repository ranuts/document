# 迁移到 ranui 官方按组件 IIFE：撤掉本地打包配置

日期：2026-07-11
分支：feat/seo-landing-hero
涉及：`package.json`（ranui 0.2.0-alpha.1 → 0.2.0-alpha.2）、`bin/build.sh`、
`public/ranui-iife/`（新增 vendored 产物）、17 个静态页、`pnpm-workspace.yaml`、
删除 `vite.ranui-iife.config.ts` / `bin/ranui-iife.entry.ts` / `public/ranui.iife.js`

## 背景

ranui 0.2.0-alpha.2 发布了官方按组件 IIFE（`dist/iife/<name>.iife.js`，
上游 chaxus/ran 提交 2e7aab6f8），本仓库自打组合包的过渡方案完成使命，切换
到官方产物。

## 改动

- **build.sh**：删除本地 vite 打包步骤，改为从 `node_modules/ranui/dist/iife`
  复制到 `public/ranui-iife/`（与 ran-tokens.css 同一"每次构建重新同步"模式）。
  **复制清单从页面的 `<script src="/ranui-iife/...">` 标签派生**（grep 全部
  public/*.html），页面是唯一事实来源——以后某页新增组件引用，同步自动跟上，
  不存在 cp 清单与页面漂移的问题（code review 发现的风险，已消除）。
- **按页面裁剪**：16 个卫星页只用 r-button + r-card，现在只加载
  `button.iife.js`(30K) + `card.iife.js`(23K)；只有 zh 首页额外加载
  `select.iife.js`(80K)。旧方案是所有页面统一 94K 组合包。
- **产物入库**：`public/ranui-iife/` 与 ran-tokens.css 一样提交进仓库
  （fresh clone 下 `pnpm run dev` 不跑 build.sh 也能用），prettier 忽略。
- **供应链策略**：pnpm 11 默认的 minimumReleaseAge 会拒绝发布不满 24h 的包，
  拦住了刚发的 alpha.2。`pnpm update` 自动写入的 `ranui@0.2.0-alpha.2`
  （带版本号）条目对 pre-run 校验不生效；改为裸包名 `ranui` / `ranuts`
  （与用户全局 pnpm 配置的既有形式一致，都是自有包）。

## 验证

- 官方包下两态几何仍逐像素一致（卫星页 CTA 183×48、oss 卡 608×116）
- zh 首页三组件注册正常、语言切换事件跳转正常、控制台干净
- 英文首页（应用 bundle 走新版 ranui）无回归；`::part(button)`/`::part(content)`
  与 `.ran-btn-content` 默认值（padding 4px 15px、line-height 22px）在
  alpha.2 均未变化（review agent 核对过 dist）
- format / lint:ts 通过；高强度 code review 跑了 8 个角度，除注释陈旧和
  cp 清单漂移风险（均已修复）外无正确性问题

## 备注

- alpha.2 的 select 已导出 part（`select`/`selection`/`icon`/`selection-item`/
  `search`），日后可穿透定制语言选择器
- ranui select 内部搜索框缺 id/name 有一条无障碍 issue 提示，候选反哺上游
- `minimumReleaseAgeExclude` 用裸包名意味着 ranui/ranuts 的所有未来版本都
  跳过冷静期——它们是自有包，风险可接受；如要收紧可改回逐版本豁免
