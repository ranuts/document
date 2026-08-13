# v9 纯净 UI（去 logo/用户徽章）+ GitHub issue 回归排查：发现并修复 CSV 打开回归，其余 v7 已修问题均未复现

日期：2026-08-12
分支：feat/v9-web-mode
状态：**两项任务完成**。发现一个真实回归（CSV 打开，对应 #13/#33）并修复 +
现场验证闭环；其余排查项均未复现。lint / 302 单测 / format / `build:v9`
全部通过。

## 一、纯净文档 UI

需求：去掉编辑器头部的 ONLYOFFICE logo（`#header-logo`）和右上角当前用户
徽章（`.btn-current-user`），只保留文档功能。

这套构建没有对应的 DocEditor 配置开关，但编辑器 iframe 同源——在
`lib/onlyoffice-editor.ts` 新增 `hideEditorBrandingChrome()`：往编辑器
iframe 注入一段样式（`#header-logo, .btn-current-user, #tlb-box-users
{ display: none !important; }`），在 `onAppReady` 和 `onDocumentReady`
各调一次（幂等，按 style 元素 id 去重）。三类编辑器共用同一套 header
组件，Excel/Word 截图确认生效；embed 模式同样生效。

## 二、issue 回归排查结果（v9 vs v7 已修问题）

### 🔴 发现并修复：CSV 打开失败（#13/#33 会复现）

- **现象**：v9 打开 .csv 弹 "An error has occurred while opening the file."
- **根因**：新 vendor 编辑器的内部 x2t 导入 CSV 需要分隔符/编码参数，
  x2t_helper 不传 → 转换失败。v7 不受影响是因为它在页面层先用 SheetJS 把
  CSV 转成 XLSX（`convertCsvToXlsx`）。
- **修复**（复用 v7 已验证方案）：
  1. `packages/converter`：`convertCsvToXlsx` / `xlsxToCsvBytes` 从 private
     改 public。
  2. `lib/converter.ts` `handleDocumentOperation` v9 分支：csv → SheetJS 转
     XLSX 后以 xlsx 打开（`openFileType`），文件名保持 .csv。
  3. `lib/onlyoffice-editor.ts` `handleFileStreamMessage`：原文件是 .csv 且
     无显式非 CSV 请求时，把保存流（xlsx）用 SheetJS 转回 CSV——CSV 进 CSV
     出；embed 显式 `targetExt:'CSV'` 同样转（新增 `routeSavedFile` 提取
     公共路由）。
  4. `triggerPersonalDownloadAs`：CSV 导出请求改为向编辑器要 XLSX——直接请求
     CSV 会弹编辑器的分隔符选项对话框，无头保存永久卡死（现场实测
     document:save 超时）。
- **验证**：`csv-test.csv`（name/score 两列）打开数据正确渲染；embed
  `document:save {targetExt:'CSV'}` 返回 `csv-test.csv` / text/csv /
  `name,score\nalice,90\nbob,85` 逐字正确。

### ✅ 未复现（逐项验证）

| Issue   | 内容                                   | v9 结果                                                                                                           | 验证方式                                            |
| ------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| #113    | embed open-buffer 打不开（错误码 -85） | **正常**，v9 走 blob URL 根本不经过出问题的 postMessage 字节通道                                                  | embed demo `document:open-buffer` 打开 3-sheet xlsx |
| #31     | 多 sheet 只显示一个                    | **正常**，First/Second/Third 三个 tab 都在                                                                        | 同上                                                |
| —       | embed 保存闭环（本次迁移遗留项）       | **通过**，`document:save` 返回 File，SheetJS 解析 3 sheet 内容逐字节正确                                          | embed demo 保存往返                                 |
| #87/#25 | 只读预览崩溃（getInitials）            | **正常**，view 模式界面精简、无崩溃、get-state 正确                                                               | embed readonly:true 打开                            |
| #85     | 预览隐藏菜单栏                         | **正常**，readonly 时只剩 File/View                                                                               | 同上截图                                            |
| #37/#32 | UI 中文                                | **正常**，文件/开始/插入/绘图                                                                                     | `?locale=zh-CN&new=xlsx`                            |
| #84     | Safari requestIdleCallback 崩溃        | **不会复现**：新 sdkjs 不再裸调该 API（仅 Monaco 引用且自带特性检测）；v7 的 polyfill 在 v7 专属 patch 里继续生效 | 静态 grep                                           |
| #20     | SmartArts.bin 缺失                     | **不会复现**：新 vendor 自带完整 `sdkjs/common/SmartArts/`（9.x 新目录结构）                                      | 静态检查                                            |
| #3      | Firefox "chrome is not defined"        | **不会复现**：新 api.js 无 chrome 引用                                                                            | 静态 grep                                           |
| #28     | 另存为 PDF 有问题                      | **v9 直接解决**（前两篇探索文档的主题）                                                                           | 已验证                                              |
| #15     | 高分屏图标模糊                         | 预期解决：新 web-apps 自带 @2.5x SVG 图标（网络面板见 iconssmall@2.5x.svg）                                       | 加载观察，未逐像素验证                              |

### 未排查 / 不适用

- #72（粘贴图片保存报错）、#19（导出图片丢失）：新底座媒体管线完全在编辑器
  内部（x2t_helper 自带 media 读写 + MIME 嗅探），架构上不再走 v7 出问题的
  路径，但**未做粘贴图片的端到端验证**（自动化难触发真实粘贴）。
- #92（Excel 光标）、#12（光标位置）、#64（右对齐文本不显示）：OPEN 状态的
  引擎级问题（v7 也没修），非回归排查范围；v9.3 引擎可能自带修复，待人工
  体验确认。
- #62（日期不显示）、#63/#35/#24（字体相关）：新 vendor 换成 327MB 索引字体
  体系（Arial/Calibri/SimSun 等真实字体按需加载），字体能力比 v7 的
  font-map 方案强得多，安装字体的文档需要按新体系重写。

## 与上一篇的衔接

本篇建立在 [2026-08-11-v9-vendor-swap-onlyoffice-personal.md](2026-08-11-v9-vendor-swap-onlyoffice-personal.md)
之上；上一篇遗留项中 "embed 保存链路未验证" 本篇已闭环（含数据完整性），
"PDF 打开未接入"、"运行时只读切换（processRightsChange）未验证"、
"三端插图/粘贴深度回归" 仍待后续。
