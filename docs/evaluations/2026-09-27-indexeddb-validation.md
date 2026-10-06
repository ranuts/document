# IndexedDB 真实模型加载与交互验证

## 结论

WebLLM 切换 IndexedDB 后，单纯配置变更仍不能加载默认模型。本轮定位并修复了当前 Chrome 的大记录限制和 SDK 事务错误遗漏；修复后的真实 Qwen3-1.7B 已成功加载、复用缓存、推理，并在实际 DOCX/XLSX 面板中完成预览 → 确认 → 写入 → 撤销。

这是本次设备与浏览器的验证结果，不代表所有浏览器均通过。默认模型的规划与多语言输出仍有质量问题，功能继续保持实验状态。

## 复现与修复

环境：Chrome 153、Apple M1 Pro / 16 GiB、macOS 15.5；WebLLM 0.2.85、默认 `Qwen3-1.7B-q4f16_1-MLC`。测试从独立浏览器上下文的空站点存储开始，初始额度约 3 GiB。

未修复 SDK 两次停在 23/30 分片、615 MB、66%。IndexedDB 中存在第 7–29 个分片，第 0 个分片未写入。独立下载第 0 个分片成功，HTTP 200、155,582,464 字节。向独立临时 IndexedDB 写入同等大小 ArrayBuffer 复现：

```text
UnknownError: The serialized keys and/or value are too large
(size=155582510 bytes, max=133169152 bytes).
```

临时探测数据库已删除。此错误明确解释了 IndexedDB 后端的新阻塞；此前 Cache API 的 QuotaExceededError 具体原因并未因此确定。

SDK 的 `ArtifactIndexedDBCache.addToIndexedDB` 只监听请求成功/失败，遗漏事务级错误，因此这个错误不会让加载 Promise 正常结束。版本锁定补丁 `patches/@mlc-ai__web-llm@0.2.85.patch`：

- ArrayBuffer 以 Blob 存入 IndexedDB，避免把大 payload 直接序列化进单条记录；读取时还原 ArrayBuffer。
- 保留旧 ArrayBuffer 记录及 JSON 配置的读取兼容性，不做数据库迁移。
- 等待事务完成才确认写入，监听事务 error/abort，阻断永久等待。
- pnpm workspace 与 lockfile 固定补丁；Docker 安装依赖前复制补丁目录。

补丁由 pnpm 安装自动应用；升级 SDK 时需重新核对缓存实现与兼容性测试。

## 加载与缓存证据

| 用例                                    | 结果                                                |
| --------------------------------------- | --------------------------------------------------- |
| 干净存储下首次真实加载                  | 成功，约 72.9 秒                                    |
| 第 0 个大分片                           | IndexedDB 记录为 Blob，大小 155,582,464 字节        |
| SDK 缓存检测                            | 加载前 false，完整加载后 true                       |
| 实际编辑器页面自动加载                  | 成功复用已存模型，面板显示 Model loaded             |
| 新 provider 再次加载                    | cachedBefore=true，约 1.73 秒                       |
| DevTools 网络 Offline 后创建新 provider | 约 2.10 秒完成加载，真实生成 `Offline model ready.` |

浏览器 storage.estimate 的读数属于估算值，未用作模型完整下载大小；模型进度与分片记录单独保留。

## 修改建议测试：8 个用例，各重复 3 次

使用实际生产默认 provider、提示词和严格解析器；temperature=0.7、top_p=0.8、max_tokens=512、enable_thinking=false。24 次调用均完成，单次约 1.4–2.5 秒。返回包含空 think 前缀，解析器可剥离。

| 请求                             | 3 次结果                                  |
| -------------------------------- | ----------------------------------------- |
| 英文原文插入，含预算/日期/否定   | 3/3 文本正确                              |
| 中文原文插入，含预算/日期/否定   | 3/3 文本正确                              |
| 选区改写得更礼貌                 | 3/3 原样返回，未产生明显改进              |
| 英文 B2 写入 1250                | 3/3 地址和值正确                          |
| 中文 C3 写入 Alex 未批准第二阶段 | 3/3 错误返回示例 B2 / requested value     |
| 两个单元格的多步请求             | 3/3 未拒绝，返回示例 B2 / requested value |
| 删除全文                         | 3/3 未拒绝，建议插入请求字面文字          |
| 写入公式                         | 3/3 生成公式，由应用解析器拒绝            |

21/24 输出通过语法和操作白名单校验，但这不能等同于语义正确率。多步/删除请求没有完成它们要求的危险操作，却生成了错误的替代建议；中文地址也会错。人工预览确认仍然必需，不应宣传可靠的自动编辑。

## 多语言改写：9 个样例

七种语言各一个改写，再加混合语言和列表，共 9 次。所有样例的预算、日期、Alex 和未批准/不保证事实仍在输出中。英语、韩语、德语、西班牙语 4/9 输出包含 JSON 包装，违反“只返回正文”的要求；多个样例变化很小。混合语言例子把 Budget 改为中文，未完全保留原始混合语言形式。空 think 前缀也需要区分于正文。

本轮仅每例一次，不足以评价稳定性；未重新测试翻译或摘要。没有通过提取 JSON 内 text 来掩盖输出格式失败。

## 实际面板到编辑器

使用真实缓存模型，发送生产面板请求，操作实际预览按钮；未用模型替身。

- DOCX：生成预览前后编辑历史 Index 均为 -1；点击应用后完整读取到预算、日期和否定原文；Undo 后恢复为空。
- XLSX：B2 在预览和确认前为空；点击应用后读取为 1250；asc_Undo 后恢复为空。

只验证了这两个简单写入案例，不代表中文单元格、多步请求或所有文档结构均可用。

## 原始证据与自动化

- [未修复加载与大记录错误](2026-09-27-indexeddb-loading-results.json)
- [24 个修改建议原始输出](2026-09-27-indexeddb-blob-model-results.json)
- [9 个文本改写原始输出与缓存重载](2026-09-27-indexeddb-writing-results.json)
- [真实 DOCX/XLSX 确认与撤销](2026-09-27-indexeddb-editor-results.json)
- [断网加载与真实推理](2026-09-27-indexeddb-offline-results.json)

补丁测试读取实际安装的 SDK 缓存实现，覆盖 Blob 字节还原、旧 ArrayBuffer/JSON 兼容以及请求成功后的事务中止。反向移除补丁后，Blob 存储与事务中止两项测试均失败；应用补丁后通过。独立审查未发现补丁的重要兼容问题。

最终自动化：71 个测试文件、3,535 项测试通过；lint（oxlint / TypeScript / Docker Compose 配置）与生产构建通过。构建仍有现有大 chunk 提示，测试仍有现有 PromiseRejectionHandledWarning。未构建完整 Docker 镜像。
