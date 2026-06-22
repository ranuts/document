# OnlyOffice 升级探索：7.5.0 → 9.3.0

**日期：** 2026-05-31 → 2026-06-14（持续更新）  
**分支：** `upgrade/onlyoffice-9.3.0`  
**状态：** ❌ 暂停 — 文件来源问题无解，见[最终结论](#最终结论2026-06-14)

---

## 背景与动机

原项目使用 OnlyOffice 7.5.0（build: 2024-10-16），包含三个独立组件：

| 组件 | 路径 | 作用 |
|------|------|------|
| sdkjs | `public/sdkjs/` | 文档渲染引擎（word/cell/slide/common） |
| web-apps | `public/web-apps/` | 编辑器 UI 外壳（工具栏、菜单、API） |
| x2t WASM | `public/wasm/x2t/` | 格式转换器（docx↔bin，xlsx↔bin 等） |

升级目标：v9.3.0（2026-04-24），主要收益是 v9.2 的 Plugin API 扩展（Agent 协同开发所需）。

---

## 执行过程

### 阶段一：资源来源确认

在决定升级路径前，首先确认了各组件是否有对应的 9.3.0 版本：

```
cryptpad/onlyoffice-x2t-wasm releases：
  v9.3.0+0  (2026-04-24)  ✅ 有现成构建
  v8.3.0+0
  v7.3+1

onlyoffice/documentserver releases：
  v9.4.0  (2026-05-19)
  v9.3.1
  v9.3.0
  v9.3.0
```

结论：x2t WASM 有 9.3.0 版本可用；为保持版本对齐，选择升到 9.3.0 而非 9.4.0。

### 阶段二：从 Docker 提取静态文件

```bash
docker pull onlyoffice/documentserver:9.3.0
docker run -d --name oo930 onlyoffice/documentserver:9.3.0

# 打包后复制（docker cp 对有权限的目录报错）
docker exec oo930 tar czf /tmp/sdkjs.tar.gz -C /var/www/onlyoffice/documentserver sdkjs
docker cp oo930:/tmp/sdkjs.tar.gz /tmp/sdkjs.tar.gz
# 同理处理 web-apps
```

Docker 镜像内文件布局：`/var/www/onlyoffice/documentserver/{sdkjs,web-apps}`

**裁剪策略**（Docker 全量 → 项目实际需要）：

| 删除内容 | 原因 |
|---------|------|
| `sdkjs/pdf/`、`sdkjs/visio/` | 项目不支持这两种格式 |
| `web-apps/apps/pdfeditor/`、`visioeditor/` | 同上 |
| 各编辑器的 `mobile/`、`embed/`、`forms/` | 项目不使用这些变体 |
| 各编辑器的 `resources/help/` | 382+75+47=504MB 内置帮助文档 |
| `ie/` 目录 | IE 兼容层 |
| 所有 `*.gz` 文件 | GitHub Pages / Vite dev 不使用预压缩文件 |

裁剪后体积：sdkjs 90MB（原 47MB），web-apps 94MB（原 19MB）。体积增加来自新增的 `.bin` 数据文件（SmartArt 预设等运行时资产）。

### 阶段三：x2t WASM 替换

从 `cryptpad/onlyoffice-x2t-wasm@v9.3.0+0` 下载并替换：

```bash
curl -L "https://github.com/cryptpad/onlyoffice-x2t-wasm/releases/download/v9.3.0%2B0/x2t.zip" \
  -o /tmp/x2t-9.3.0.zip
unzip /tmp/x2t-9.3.0.zip -d public/wasm/x2t/
```

新版文件：`x2t.js`（133KB）、`x2t.wasm`（34MB）、`x2t.wasm.br`（6.5MB）。
旧版：`x2t.wasm` 55MB（wasm 体积缩小 38%）。

**注意**：新版用 `.br`（Brotli）替换了旧版的 `.gz` 压缩格式。项目代码只引用 `x2t.js`，路径未变，无需修改业务代码。

### 阶段四：代码 breaking changes 检查

CLAUDE.md 中列出三处潜在 breaking changes，全部在项目代码中**无引用**：

| 改动 | 版本 | 影响评估 |
|------|------|---------|
| `CreateTable(rows, cols)` 参数顺序变更 | v8.0 | 项目代码无调用 |
| `commentAuthorOnly` 参数移除 | v8.x | 项目配置无此项 |
| `installDeveloperPlugin` shim 移除 | v9.3.1 | 项目无插件加载逻辑 |

### 阶段五：发现 x2t.js URL 构造问题

**错误：**
```
x2t.js:24 Uncaught TypeError: Failed to construct 'URL': Invalid URL
```

**原因：** 新版 x2t.js 的 pre-js 代码在初始化时会执行：
```javascript
const mySrc = myScript.getAttribute("src");
suffix = new URL(mySrc).search;  // 根相对路径无 base → 报错
```

旧版没有这段 pre-js。新版 Emscripten 构建要求脚本以绝对 URL 加载。

**修复（`lib/document-converter.ts`）：**
```typescript
// 修复前
await scriptOnLoad([this.SCRIPT_PATH]);

// 修复后
const absolutePath = new URL(this.SCRIPT_PATH, window.location.href).href;
await scriptOnLoad([absolutePath]);
```

### 阶段六：发现版本哈希前缀问题

**现象：** 编辑器 iframe 加载的 URL 带有版本哈希前缀：
```
http://localhost:5174/9.3.0-e8849642d4e0376767bff939a16123a4/web-apps/apps/documenteditor/main/index.html
```

**原因：** 9.3.0 的 `api.js` 中硬编码了版本前缀：
```javascript
const ver = '/9.3.0-e8849642d4e0376767bff939a16123a4';
// 所有编辑器路径都会被插入这个前缀
```

该前缀用于 Service Worker 的作用域隔离。但 Vite 只在 `/web-apps/...` 提供文件，带前缀的路径返回 SPA fallback HTML（200）。

**修复（`vite.config.ts`）：**
```typescript
function onlyofficeVersionRewrite(): Plugin {
  return {
    name: 'onlyoffice-version-rewrite',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url) return next();
        // 对 socket.io 连接路径返回 404，避免收到 HTML 误判为成功
        if (/\/doc\/[^/]+\/c\//.test(req.url)) {
          res.statusCode = 404;
          res.end();
          return;
        }
        // 剥离版本前缀
        if (/^\/\d+\.\d+\.\d+-[a-f0-9]+\//.test(req.url)) {
          req.url = req.url.replace(/^\/\d+\.\d+\.\d+-[a-f0-9]+\//, '/');
        }
        next();
      });
    },
  };
}
```

---

## 根本问题：两种不同的 OnlyOffice 构建

经过以上修复后，编辑器 iframe 和所有静态资源（require.js、app.js、sdkjs、socket.io 等）均正常加载（HTTP 200）。但 `onAppReady` 始终未触发，文档无法打开。

### 问题分析

通过对比两个版本的架构，发现根本差异：

**7.5.0（原项目，Desktop Editors 离线构建）：**
- `app.js`：5.2MB，单一完整包，包含所有编辑器逻辑
- 有 `loading.js`（UI loading 动画）
- 无 `code.js`
- `onAppReady` 在 RequireJS 模块初始化完成后直接触发
- socket.io 作为可选依赖加载，连接失败不阻塞编辑器

**9.3.0（Docker documentserver，服务端连接版本）：**
- `app.js`：2.1MB（UI 外壳 + socket.io 客户端）
- `code.js`：1.1MB（实际编辑器引擎，动态加载）
- **`code.js` 在 socket.io 握手成功后才被动态加载**
- 无法离线使用——没有后端就没有 `onAppReady`

```
9.3.0 加载流程：
  index.html → require.js → app.js
    → socket.io 连接 /doc/{id}/c/?EIO=4&transport=polling
    → 服务器响应 → 动态加载 code.js
    → onAppReady 触发
    → （收到 asc_openDocument 命令 → 渲染文档）

7.5.0 加载流程：
  index.html → require.js → app.js（含完整引擎）
    → 初始化完成
    → onAppReady 触发（不依赖服务器）
    → （收到 asc_openDocument 命令 → 渲染文档）
```

### 验证方式

通过网络请求日志确认：在 9.3.0 下，`code.js` 从未被请求，即便等待 40+ 秒。`sdk-all.js` 不含任何 socket.io 代码，连接逻辑完全在 `app.js` 中。

### 正确的文件来源（原始判断，后被推翻）

原本判断：7.5.0 文件来自 **OnlyOffice Desktop Editors** 的内嵌 web 组件。
**此判断于 2026-06-14 被证伪，见[最终结论](#最终结论2026-06-14)。**

| 产品 | 文件来源 | 是否需要服务器 |
|------|---------|-------------|
| Document Server | Docker `onlyoffice/documentserver` | ✅ 必须 |
| Desktop Editors 9.x（内嵌 web） | macOS DMG / AppImage 内部 | ⚠️ 内嵌本地服务器 |
| Desktop Editors ≤7.x 某版本 | 特殊离线编译 | ❌ 完全离线 |

---

## 结论与建议

### 已成功的部分

**x2t WASM 升级（✅ 可保留）：**
- 版本：7.5.0 → 9.3.0+0
- wasm 体积：55MB → 34MB（-38%）
- 代码修复：`document-converter.ts` 改用绝对 URL 加载脚本

**Vite 插件（✅ 可保留，用于未来升级）：**
- `onlyofficeVersionRewrite`：处理版本哈希前缀路径重写
- 对当前 7.5.0 无副作用

### 需要回滚的部分

**sdkjs 和 web-apps（❌ 需回滚到 7.5.0）：**
- Docker 9.3.0 版本无法离线使用
- 正确路径：从 Desktop Editors 9.3.0 的安装包中提取

### 未来升级的正确路径

要获得 9.3.0 的 Desktop Editors 离线文件，可行方案：

1. **从 Desktop App 提取**
   ```bash
   # Linux AppImage
   ./ONLYOFFICE_DesktopEditors-x86_64.AppImage --appimage-extract
   # 文件在 squashfs-root/opt/onlyoffice/desktopeditors/
   ```

2. **检查是否有独立分发**
   - 查看 `ONLYOFFICE/desktop-sdk` 仓库的 release artifacts
   - 查看 `ONLYOFFICE/web-apps` 是否有 offline build CI 产物

3. **对比两种构建的关键差异**
   - Desktop 版 `app.js` 应是单一完整包（类似 7.5.0 的 5.2MB）
   - 不应有 `code.js` 动态加载机制
   - socket.io 应为可选而非必须

### 当前建议（2026-05-31，已过时）

~~在找到正确的 9.3.0 Desktop 离线文件之前，回滚 sdkjs/web-apps，只合并 x2t WASM 升级。~~

**已由最终结论取代，见下文。**

---

## 最终结论（2026-06-14）

### 关键发现：7.5 文件的真实来源

通过检查 main 分支中 `app.js` 的版本注释：

```
Version: 7.4.1 (build:1)
```

`build:1` 是**自定义编译号**，官方任何 release（Desktop Editors 或 Document Server）均不使用此格式。**7.5.0 的 sdkjs/web-apps 是从 ONLYOFFICE 开源仓库手动编译的**，启用了 offline/standalone 标志，并非从任何安装包提取。

### 关键发现：Desktop Editors 9.x 也是服务端架构

实测 macOS Desktop Editors（ONLYOFFICE-arm.dmg，版本 9.4.0）：

```
app.js:   2.1MB  ← 与 Docker documentserver 完全相同
code.js:  存在   ← 服务端架构标志
```

Desktop 9.x 的"离线"体验是通过 App 内嵌本地 document server 实现的，不是纯前端。

### 架构变迁时间线

| 时期 | 架构 | app.js | code.js |
|------|------|--------|---------|
| ≤7.x（某次） | 纯前端单体包 | ~5MB | 不存在 |
| 8.x 开始 | 内嵌/外部服务器 | ~2MB | 存在 |

变迁点推测在 7.x 后期到 8.0 之间，尚未精确定位。

### 三条可行路径

**路径 A：从源码编译（最彻底，工作量最大）**
- ONLYOFFICE `web-apps` + `sdkjs` 均开源（MIT/Apache）
- 需要找到 7.4.1 build:1 使用的 Grunt 编译配置，复现 standalone 模式
- 目标：编译出 9.3.0 版本的 offline 单体包
- 参考仓库：`ONLYOFFICE/web-apps`、`ONLYOFFICE/sdkjs`

**路径 B：实现最小 socket.io 协议服务（技术挑战高）**
- 不改前端文件，在 Vite 旁边起一个 tiny Node.js 服务
- 实现足够让 `code.js` 加载 + `Ec.Ms` 初始化的最小协议子集
- Document Server 开源（`ONLYOFFICE/server`），协议可逆向
- Desktop Mode Mock 已验证了除渲染引擎初始化之外的全部环节，路径 B 可以从这里接续

**路径 C：维持 7.5.0，仅合并已成功的升级（最稳，推荐优先）**
- x2t WASM 升级（7.5 → 9.3.0）✅ 独立可用
- `document-converter.ts` absolutePath 修复 ✅ 独立可用
- sdkjs / web-apps 继续使用 7.5（`build:1` 编译版）
- 等有资源再攻路径 A 或 B

### 当前状态

`upgrade/onlyoffice-9.3.0` 分支中 sdkjs/web-apps 来自 Docker 9.3.0，**导致功能完全不可用**（`code.js` 需要服务器，在纯前端环境下编辑器无法打开文档）。

**立即需要做的事**：将 sdkjs/web-apps 回滚到 main 分支的 7.5.0（`build:1`），恢复可用状态。

---

## 相关文件变更

```
修改（保留，可合并到 main）：
  src/lib/document-converter.ts    # absolutePath 修复（兼容新旧版 x2t.js）
  vite.config.ts                   # onlyofficeVersionRewrite 插件（对 7.5 无副作用）

需回滚：
  public/sdkjs/                    # 从 9.3.0 Docker → 恢复 7.5.0 (build:1)
  public/web-apps/                 # 从 9.3.0 Docker → 恢复 7.5.0 (build:1)

可保留（与 sdkjs/web-apps 版本无关）：
  public/wasm/x2t/                 # 9.3.0+0（cryptpad 构建）
```
