# 模型来源、自托管与兼容 API

## 当前来源

默认模型仍为 `Qwen3-1.7B-q4f16_1-MLC`，默认引擎为 WebLLM 0.2.85。
未配置自托管时，模型目录来自 `https://huggingface.co/mlc-ai/Qwen3-1.7B-q4f16_1-MLC`，配套 WASM 来自 WebLLM SDK 内置的 GitHub binary-mlc-llm-libs 地址。两类资源均需要可访问，首次使用会下载，之后通过 IndexedDB 缓存。

缓存不能替代稳定的下载源；浏览器可能清理缓存。自托管完成前，默认仍依赖远程源。

## 项目内自托管

新增 `bin/prepare-local-model.mjs`：默认仅获取模型元数据，输出固定 Hugging Face commit 和资源清单；带 `--download` 才下载权重、分词器、配置、README/许可证文件（上游提供时）和配套 WASM。

```sh
node bin/prepare-local-model.mjs
node bin/prepare-local-model.mjs --download
# 也可选择安装的 WebLLM catalog 中的其他模型：
node bin/prepare-local-model.mjs --model=Qwen3-4B-q4f16_1-MLC --download
```

资源保存到 `public/models/<model-id>/`，已加入 `.gitignore`。下载采用流式写入和 `.part` 临时文件，完成后重命名；失败会终止，不自动回退到另一来源。运行该命令会下载较大的资源，脚本目前不支持断点续传或独立哈希校验。`source-manifest.json` 记录模型 revision 和 WASM 来源；SDK WASM 地址仍依赖上游 catalog，发布时应保留已下载资源并记录自己的校验值。

在本地 `.env.local` 或部署构建配置中设置：

```dotenv
VITE_LOCAL_MODEL_ID=Qwen3-1.7B-q4f16_1-MLC
VITE_LOCAL_MODEL_URL=/models/Qwen3-1.7B-q4f16_1-MLC/
VITE_LOCAL_MODEL_LIB_URL=/models/Qwen3-1.7B-q4f16_1-MLC/model.wasm
```

重新构建部署。这些是公开资源地址，不是密钥。模型目录应以 `/` 结尾。部署需实际包含完整模型目录；也可将地址改为自有静态资源域名并允许应用来源的 CORS。检查托管平台单文件和总容量限制后选择静态主机或对象存储。模型资源不要预缓存进 Service Worker，继续按需加载到 IndexedDB。

也可以在 AI 设置面板配置 Custom MLC model ID、MLC model directory URL、Compatible model WASM URL；用户设置覆盖构建默认值，地址保存到当前站点 localStorage。清空用户设置后使用部署默认值。加载与缓存检查使用同一配置，保留 SDK 已知模型的设备要求。

自定义模型必须已经转换为 WebLLM 支持的 MLC 格式并提供匹配的 WASM；仅输入 Hugging Face 名称、GGUF 或任意 WASM 不会自动转换。未知模型 ID 必须同时提供模型目录和 WASM。模型权重及运行库的许可证分别检查并保留相应声明。GGUF 文件或 URL 继续使用已有 wllama 设置。

## Base URL + Key + 模型名

在设置中选择 OpenAI provider，填写 API Key、API Base URL 和 API model ID。该入口使用兼容 Chat Completions 的接口，不限定 OpenAI 模型：例如自己的推理服务器或兼容服务。

Base URL 填完整 API 前缀（例如 `https://inference.example/v1`），不要填写 `/chat/completions`；程序追加该路径，并去除 Base URL 尾部斜杠。模型名由服务端定义。留空继续使用现有默认值。地址和模型名保存到当前站点 localStorage，Key 使用已有的密钥存储逻辑；请求直接从浏览器发到配置的服务，文档上下文可能随请求发送。

服务需要支持浏览器 CORS、Bearer Key 和本应用发送的工具定义。兼容接口不保证模型工具调用质量，需对候选模型重新测试。Ollama 保留原有无需 Key 的本地连接方式。不要把服务端共享 Key 写进 `VITE_*` 环境变量或提交到仓库；公共部署若需要共享凭证，应单独实现带鉴权的服务端代理。

## 验证范围

已实际获取默认模型的远程元数据，固定 revision 为 `80b3abcec6c3b3f5355dc0cc99cc4fb578f192bc`。本次没有重新下载整套权重，也没有声称完成自托管真实推理测试。

自动化测试覆盖自托管 URL 解析、协议约束、模型设备要求保留、未知模型缺少资源时拒绝、兼容 API 的地址/Key/模型请求，以及现有面板和 provider 回归。

完整回归为 83 个测试文件、3,651 项通过；随后补充的设置显隐用例及相关测试共 19 项通过。`lint:ts` 和生产构建通过。代码审查未发现重要问题。

参考：[WebLLM 模型加载文档](https://webllm.mlc.ai/docs/user/basic_usage.html)。
