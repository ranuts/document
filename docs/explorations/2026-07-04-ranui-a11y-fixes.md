# ranui 组件库 a11y 修复（2026-07-04）

> 改动在 **ran 仓库**（chaxus/ran 的 `packages/ranui`），非本项目。记录于此
> 便于统一追溯。审计结论见对话；本轮按优先级修了 P0/P1 若干项。

## 背景

对 ranui 做 a11y 审计后发现系统性缺口:`aria-live`=0、`formAssociated`=0、image 无
alt、checkbox 无键盘/label 关联。本轮修复。

## 已修（均含单测，jsdom 环境）

### P0 message —— toast 变成可朗读的 live region

- `message/container.ts`:持久 `.ranui-message` 容器加 `aria-live="polite"` +
  `aria-atomic="false"`(在 toast 加入前就存在,新 toast 一 append 就被朗读)。
- `message/index.ts`:单条 toast `aria-atomic="true"`;`type` 为 error/warning 时
  `role="alert"`(assertive 打断),success/info 为 `role="status"`(polite)。
- 顺带修 bug:原先误在 constructor `setAttribute` 触发"自定义元素构造时不得加属性"
  规范错误,移到 `connectedCallback`。测试 30/30。

### P1 image —— alt 支持

- `image/index.ts`:新增 `alt` 属性透传到原生 `<img>`;未设时默认空 `alt=""`
  (装饰性,读屏跳过而非念 URL)。测试 12/12。

### P0 表单控件 —— ElementInternals 表单参与 + 无障碍(用户选"完整方案")

关键前提:ranui `<r-form>` 用原生 `new FormData(this._form)` 收集值,而各控件的
原生 input 在 shadow DOM 里、FormData 收不到 → 必须 `formAssociated` + `setFormValue`。

- **checkbox**:`static formAssociated`+`attachInternals`;把**宿主**设为唯一可达
  checkbox(`role=checkbox`+`aria-checked`+`tabindex`+Space/Enter 键盘+`aria-disabled`),
  原生 input 降级为装饰(`aria-hidden`+`tabindex=-1`);`setFormValue`(选中报值、未选
  报 null)。名字来自插槽 label。测试 13/13。
- **input**:`formAssociated`+`attachInternals`;`value` setter/连接时 `setFormValue`;
  给内部 `<input>` 生成 id、渲染的 `<label>` 设 `htmlFor`(原生关联,读屏报名+点击聚焦)。
  测试 35/35。
- **select**:`formAssociated`+`attachInternals`;`value` setter 与用户选中
  (`selectOptionElement`)都 `syncFormValue`。测试 57/57(含 form)。

## 兼容性要点

- jsdom 29 **有 `attachInternals` 但无 `setFormValue`**。所有调用用可选链
  `this._internals?.setFormValue?.(...)` 防止 jsdom 抛错;真实浏览器有该方法。
  单测里用 `el._internals.setFormValue = vi.fn()` 打桩观察调用。
- `attachInternals()` 在 constructor 调用(规范允许),用 try/catch 兜 SSR/老环境。
- 设属性到**宿主**必须在 `connectedCallback`(不能 constructor);设到 shadow 子元素
  可在 constructor。

## 验证

- `npm run tsc`:零错误。
- 7 个受影响测试文件合跑:**147/147**。相邻组件(icon/button/modal)79/79 无回归。
- 全量 unit suite 在本机内存下偶发 OOM(环境问题,非改动),故用受影响文件定向验证。

### P1 tab —— WAI-ARIA tabs 模式(第二次提交 47aa217bd)

难点:tab 头部是 `r-button`,其 `role=button`/`tabindex` 在 button 的**内层 shadow
`_btn`** 上。若给 r-button 宿主设 role=tab 会得到嵌套 role。解法:操作 `_btn`(button
把它暴露为公开字段,upgrade 后可达)。

- 头部行 `_nav` = `role=tablist`;每个头部 `_btn` = `role=tab`+`aria-selected`+
  `aria-controls`+roving tabindex(仅激活项 0,其余 -1)。
- 面板(slotted pane)= `role=tabpanel`+`aria-labelledby`+非激活 `aria-hidden`。
- 键盘:方向键 + Home/End 在标签间移动,自动激活并移焦点。测试 64/64。

### P2 prefers-reduced-motion —— 全局(同上提交)

组件是 shadow DOM,光 DOM 全局样式进不去。解法:`ensureShadowRoot` 里把
`REDUCED_MOTION_CSS` 追加到每个 root 的采用样式(排组件 CSS 之后以覆盖),
同时覆盖 constructable 与 `<style>` 降级两条路径。component.helpers 9/9,回归 400/400。

## ⚠️ 过程事故:未提交改动被回滚

做完 tab + reduced-motion(源码+测试,已跑通 400/400)后,一次外部操作(linter/git)
把**本轮未提交**的 tab、component.ts 及其测试回滚到了上一次 commit 状态;而先前已
commit 的 checkbox/input/select/message/image 完好。教训:**ran 仓库这类多轮改动,
每完成一组就立即 commit**,别攒着。已按此重做并即时提交(47aa217bd)。

### P2 colorpicker —— 键盘化(第三次提交 ed779d20d)

- hue/alpha 滑块:`role=slider`+`tabindex`+`aria-label`+`aria-valuemin/max`,方向键
  调整(Shift 粗调、Home/End 到端),`aria-valuenow`/`valuetext` 在 setupEffects 里随
  值实时更新。此前仅鼠标拖拽。
- 触发色块:`role=button`+`aria-haspopup=dialog`+`aria-label`+`tabindex`,Enter/Space
  打开面板(此前键盘无法打开取色器)。
- 2D 饱和度/明度面板未处理(双轴 slider 特殊),留待后续。
- **测试坑**:colorpicker 单测在本沙箱因重依赖挂起跑不出(`methods.test` 还与源码字段
  名脱节,属既有问题);已补正确用例,tsc 零错误,交 CI 跑。另:macOS 无 `timeout`
  命令(要用 `gtimeout`),别再用 `timeout` 包裹。

## 未做(留待后续)

- colorpicker 的 2D 饱和度/明度面板 a11y。
- 浏览器实测:checkbox 的 FACE 已验(`FormData.get`→"true");tab/reduced-motion/
  colorpicker 未在浏览器实测(需重建 dist)。
- colorpicker 单测在 CI/正常环境跑一遍确认绿。
