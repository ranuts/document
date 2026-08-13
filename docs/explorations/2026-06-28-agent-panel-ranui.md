# 2026-06-28 Agent 面板改用 ranui 组件 + 本地 link 调试

把 agent 面板里的原生表单控件换成自家 ranui Web Components(dogfooding),并用本地 link 边用边调 ranui。

## 本地 link(调试用，不进版本库)

`ranui@0.1.10-alpha-27` 本就是依赖且已在用 (`import 'ranui/button'` 等)。把它指到本地源码：

```bash
pnpm link <本地 ran 仓库路径>/packages/ranui
```

- pnpm 把链接记录为 `pnpm-workspace.yaml` 的 override：`ranui: link:<指向本地 ran 仓库的相对路径>/packages/ranui`，并更新 `pnpm-lock.yaml`。
- **这两个文件是 link 标记，不要提交**(CI 解析不到本地路径)。
- 验证:Vite 把 `import 'ranui/button'` 解析为 `/@fs/.../ran/packages/ranui/dist/button.js`,实时服务本地源 (非预打包),Vite 8 自动放行符号链接真实路径，无需改 vite.config。
- 调试循环：改 ranui 源 → 在 ran 仓库 `pnpm build` 重建 dist → 刷新本项目。
- 还原：`pnpm unlink ranui && pnpm install`(或 `git checkout pnpm-workspace.yaml pnpm-lock.yaml && pnpm install`)。

## 面板重构 (panel.ts)

原生 `createElement` → ranui 自定义元素 (import 各组件即注册):

| 原生                         | ranui                 | 说明                              |
| ---------------------------- | --------------------- | --------------------------------- |
| `<select>`+`<option>`        | `r-select`+`r-option` | provider 选择、WebLLM 模型选择    |
| `<input type=password/text>` | `r-input`             | API Key、Ollama 模型名            |
| `<button>`                   | `r-button`            | Load model / Quote / Clear / Send |
| `<input type=checkbox>`      | `r-checkbox`          | 修订模式开关                      |

保留原生：浮动 launcher(自定义浮层样式)、关闭 ×、`<textarea>`(ranui 无多行输入组件)。

**踩坑点 (已查源码确认):**

- `r-select` 选中时 `setAttribute('value')`,`.value` getter 读属性 → 面板多处同步读 `.value` 安全。
- `r-checkbox` 的 `.checked` getter 返回**字符串** `'true'/'false'`(非 boolean);改用 `change` 事件 `detail.checked`(真 boolean),初始值用 `setAttribute('checked', String(bool))`、禁用用 `setAttribute('disabled','')`。
- `import 'ranui/select'` 会连带注册 `r-option`。
- 语言切换时重译 `r-option` 的 textContent，并 `setAttribute('value', 当前值)` 触发显示标签重译。

加了类型别名 `ValueEl`/`InputEl`(`HTMLElement & {value/placeholder}`) 和 `ranButton`/`ranSelect`/`ranInput` 工厂，保持 tsc 严格通过。

## 验证

- tsc / oxlint / prettier:通过;单测：**237 通过**(panel 无单测，靠 tsc + 浏览器冒烟)
- 浏览器冒烟 (`?agent=1`,chrome-devtools):
  - 面板渲染:provider/model r-select 标签正确、Load/Quote/Clear/Send r-button、r-checkbox 在位、Send 蓝色主按钮
  - 切 Claude → key 输入框显示 (占位 `sk-ant-...`、type=password)、model row 隐藏;切 Ollama → 模型名输入框 + 本地提示
  - `r-input` 值写入再读回一致
  - Send(有文本、无 key)→ 渲染错误 turn「Please enter an API Key first.」
  - 实时切中文 → 5 个 provider 选项 + 按钮全部重译，选中值保持
  - 控制台无报错 (仅 Lit dev-mode 提示)

CI/生产:ranui 发布版 exports 含 button/input/select/checkbox,subpath 正常解析，panel.ts 不依赖 link。
