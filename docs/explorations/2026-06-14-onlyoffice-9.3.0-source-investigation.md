# OnlyOffice 9.x 升级路径终极调查

**日期：** 2026-06-14  
**分支：** `upgrade/onlyoffice-9.3.0`  
**状态：** ✅ 调查完成 — 路径 A（维持 7.4.1）已生效；路径 C（v8.1.1）实测失败；路径 D 理论可行待验证

---

## 调查背景

[上一篇文档](./2026-05-31-onlyoffice-9.3.0-upgrade.md)确认：
- Docker `documentserver:9.3.0` 无法离线（当时误认为 code.js 需服务器 — **此结论已修正，见下**）
- Desktop Mode Mock 卡在 `Ec.Ms` 初始化，放弃（当时使用的是 Docker 构建的 sdkjs，非 Desktop 构建）
- 推测 Desktop Editors 安装包可能包含离线构建

本篇记录对以下来源的逐一验证，以及对 `build_tools` 构建流程和 JS 包内部结构的深度研究。

---

## 验证结果：所有 9.x 来源均为服务端架构

### 测试 1：macOS Desktop Editors 9.4（ONLYOFFICE-arm.dmg）

```
路径：/Volumes/ONLYOFFICE/ONLYOFFICE.app/Contents/Resources/editors/
app.js：  2.1MB
code.js： 存在 ✅ → 服务端架构
版本：    9.4.0-{{HASH_POSTFIX}}
```

### 测试 2：Linux Desktop Editors 9.3.0（官方 GitHub Release tarball）

```
来源：https://github.com/ONLYOFFICE/DesktopEditors/releases/download/v9.3.0/
      onlyoffice-desktopeditors-x64.tar.xz（250MB）
路径：opt/onlyoffice/desktopeditors/editors/web-apps/apps/documenteditor/main/
app.js：  2.1MB
code.js： 存在 ✅ → 服务端架构
```

### 汇总对比

| 来源 | 版本 | app.js | code.js | 直接可用 |
|------|------|--------|---------|------|
| Docker `documentserver:9.3.0` | 9.3.0 | 2.1MB | ✅ | ❌（需服务器）|
| macOS Desktop Editors DMG | 9.4.0 | 2.1MB | ✅ | ❌（需 native bridge）|
| Linux Desktop Editors tarball | 9.3.0 | 2.1MB | ✅ | ❌（需 native bridge）|
| **main 分支（build:1）** | **7.4.1** | **5.2MB** | **❌** | **✅（独立离线）** |

> ⚠️ **重要修正**：`code.js` 存在并不等于「需要服务器」。
> 详细分析见下方「JS 包内部架构深度分析」章节。

---

## JS 包内部架构深度分析（重要修正）

### 方法

对 Linux Desktop Editors 9.3.0 tarball 中的每个 JS 文件进行关键词扫描，确认 socket.io 的实际位置。

```
tar -xJOf tarball.tar.xz "path/to/file.js" > /tmp/file.js
python3 -c "d=open('/tmp/file.js',errors='replace').read(); print(d.count('keyword'))"
```

### 各文件关键词分布（9.3.0 Desktop tarball）

| 文件 | 大小 | `socket` | `authChanges` | `io.connect` | `AscDesktopEditor` | `nativeOpenFile` |
|------|------|----------|---------------|--------------|-------------------|-----------------|
| `web-apps/.../app.js` | 2.1MB | 4 | 0 | 0 | 4 | 0 |
| `web-apps/.../code.js` | 1.1MB | **0** | **0** | **0** | **0** | **0** |
| `sdkjs/word/sdk-all-min.js` | 1.2MB | 7 | 2 | 0 | **202** | **2** |

### 结论：socket.io 在 `sdk-all-min.js`，`code.js` 与网络无关

- **`app.js`（UI 外壳）**：仅包含 RequireJS 路径配置，定义 `socketio` 路径为 `"../vendor/socketio/socket.io.min"`，但无任何 `io.connect` 或实际建连代码。
- **`code.js`（UI 对话框/工具栏懒加载包）**：完全没有 socket、网络或服务器相关代码。`code.js` 是纯 UI 组件懒加载优化，与服务端通信无关。
- **`sdk-all-min.js`（渲染引擎核心）**：socket.io 协议实现在这里。同时也有 **202 个** `AscDesktopEditor` 引用，说明渲染引擎有完整的 Desktop 模式分支。

### Desktop 模式的执行路径（绕过 socket.io）

当 `window.AscDesktopEditor` 存在时，`sdk-all-min.js` 取完全不同的代码路径：

```
[index.html 检测到 window.AscDesktopEditor]
  → desktop.execCommand("webapps:entry", features)  ← 通知 C++ 侧准备文件
  → C++ 侧调用 docs_api.asc_nativeOpenFile(fileData)
  → nativeOpenFile() {
        this.jre();  ← 创建 AscCommonWord.e2 渲染引擎（存入 ta.Ga）
        this.T_f(N) 或 wKa.wt(N)  ← 加载文档数据
    }
  → 渲染管线启动（通过 ta.Ga，不经过 socket.io）
```

`nativeOpenFile` 的实现（从 `sdk-all-min.js` 提取）：
```javascript
asc_nativeOpenFile = function(N, ba) {
    this.ta.U3 = false;
    this.ta.Tm();
    this.jre();  // 创建渲染引擎，存入 this.ta.Ga（非 Ec.Ms）
    this.DocumentType = 2;
    (this.OOa = this.asc_isSupportFeature("ooxml") && AscCommon.cac(N))
        ? this.T_f(N)  // 加载 OOXML 格式
        : (new AscCommonWord.wKa(this.ta.Ga, {})).wt(N);  // 备用格式
}
```

### 对之前「Desktop Mode Mock 失败」的重新解释

[Desktop Mode Mock 文档](./2026-05-31-onlyoffice-desktop-mode-mock.md) 记录的失败原因是「`Ec.Ms` 未初始化，画布黑屏」。现在可以确认失败的真实原因：

1. **使用了错误的文件**：当时 mock 使用的是 Docker `documentserver` 的 sdkjs（服务端构建），该版本没有正确实现 Desktop 模式代码路径。
2. **从未调用 `nativeOpenFile`**：mock 只是注入了 `window.AscDesktopEditor`，但没有在初始化完成后调用 `docs_api.asc_nativeOpenFile(data)` 传入实际文档数据。
3. **`Ec.Ms` vs `ta.Ga`**：`Ec.Ms` 是 PDF viewer 路径（`qYg()` → `AscCommon.Xxh`），Word 编辑器路径是 `ta.Ga`（`jre()` → `AscCommonWord.e2`）。检查 `Ec.Ms` 是对 Word 文档的错误预期。

---

## build_tools 构建流程研究

### 仓库结构

```
ONLYOFFICE/build_tools
  configure.py          # 解析 CLI 参数，生成配置文件
  make.py               # 顶层构建编排
  tools/linux/
    automate.py         # Linux 构建入口
    deps.py             # 依赖下载（Node.js、Qt 等）
  scripts/
    build_js.py         # JS-only 构建逻辑
    deploy_desktop.py   # 桌面打包
  Dockerfile            # Docker 构建支持（Ubuntu 24.04）
```

### `--desktop` flag 在 9.x 的实际作用

经过验证，`--desktop` 在 9.x 的作用已与 7.x 时期**不同**：

**7.x 时期（产出离线单体包）：**
- `index.html.desktop` 替换 `index.html`，去掉 socket.io 运行时依赖
- requirejs optimizer 将所有模块合并为单体 `app.js`（~5MB）
- 无 `code.js`

**9.x 时期（Desktop App 内嵌服务器，但 sdkjs 有 Desktop 绕过路径）：**
- Desktop App 内嵌 Node.js，启动本地 Document Server
- `--desktop` 切换连接目标（localhost 而非远程服务器）
- sdkjs 同时包含两条路径：① socket.io 服务端路径（默认）② AscDesktopEditor 路径（202 个引用，绕过 socket.io）
- `code.js` 本身无网络代码（0 socket 引用）— 是纯 UI 懒加载包

### 完整构建命令（仅供参考，预期产出仍含 code.js）

```bash
# 全量构建（含 C++，需 2-4 小时）
git clone https://github.com/ONLYOFFICE/build_tools.git
cd build_tools/tools/linux
python3 ./automate.py desktop --branch v9.3.0.140

# JS-only 构建（无需 C++，仍预期产出 code.js）
git clone --branch v9.3.0.140 https://github.com/ONLYOFFICE/sdkjs.git
git clone --branch v9.3.0.140 https://github.com/ONLYOFFICE/web-apps.git

cd sdkjs/build && python3 build.py --desktop
cd web-apps/build && npm install && grunt --desktop default
```

构建产出路径：
- `web-apps/deploy/web-apps/`
- `sdkjs/deploy/sdkjs/`

> ⚠️ **注意**：基于 Linux tarball 的验证，预期编译产出与官方发布一致，仍含 `code.js`。
> 除非找到明确的 "standalone/offline" 构建 target，否则编译路径意义有限。

### 7.5 build:1 的真实来源

main 分支中 `app.js` 版本注释为 `7.4.1 (build:1)`，官方从未使用 `build:1` 这一编译号。
推测该文件由项目早期维护者**手动编译**，使用了彼时（7.x 时代）的 `--desktop` standalone 模式。
该模式在 8.x 时期随架构变迁被废弃。

---

## 架构变迁时间线

```
OnlyOffice ≤7.x（某版本，已知 7.4.1 build:1 可用）
  └── 纯前端单体包架构
        app.js ~5MB（单体，含完整渲染引擎），无 code.js
        socket.io：requirejs path 中有，但 Desktop 构建中 "empty:"（不加载）
        Desktop App = 浏览器内嵌 + 独立渲染引擎，纯离线
        文档加载：sendCommand({ command: 'asc_openDocument', data: { buf: binData } })

OnlyOffice 8.x（已验证 v8.1.1）
  └── 仍有 socket.io 依赖（实际测试确认）
        app.js 为单体包（无 code.js），但 sdkjs 仍向 /doc/{key}/c/?EIO=4 发请求
        ❌ 不可离线使用（与 7.4.1 不同）
        socket.io 引入时间：早于 v8.1.1（确切版本号待考）

OnlyOffice 8.2.0+ 到 9.x
  └── 拆分包架构（2024-10-21 引入 code.js，commit c860ceec）
        app.js ~2MB（UI 外壳）+ code.js ~1MB（UI 对话框懒加载，非网络相关）
        sdk-all-min.js：含 socket.io 协议 AND AscDesktopEditor 分支（202 个引用）
        Desktop App = 内嵌 Node.js Document Server（服务端模式）
                      OR 用 AscDesktopEditor mock 绕过（需正确实现，理论可行）
```

**注意**：`v8.1.1` 是最后一个无 `code.js` 的版本（`v8.2.0` 引入拆分包架构），但这与是否依赖 socket.io 无关。**实际测试证实 v8.1.1 仍然依赖 socket.io**，因此无 code.js ≠ 可离线。socket.io 引入发生在 7.4.1 之后、8.1.1 之前的某个版本。

---

## Chrome DevTools MCP 验证：`asc_openDocumentFromBytes` 输入格式

- **验证日期：** 2026-06-14
- **本地页面：** `http://127.0.0.1:5177/`
- **当前 sdkjs：** `public/sdkjs/word/sdk-all-min.js`，`Version: 9.3.0 (build:140)`

### 工具状态

尝试使用 Chrome DevTools MCP 直接打开本地页面时，MCP 专用 Chrome profile 已被一个遗留实例占用：

```
The browser is already running for ~/.cache/chrome-devtools-mcp/chrome-profile.
Use --isolated to run multiple browser instances.
```

同时，Codex Chrome Extension 通道也不可用，但排查结果显示普通 Chrome 已运行，扩展和 native host 均安装且启用。由于无法在本轮可靠接管 DevTools 页面，以下结论采用两类证据交叉确认：

1. 源码定位：`sdk-all-min.js` 中 `asc_openDocumentFromBytes` 的实际实现；
2. 等价运行时探针：按 9.3.0 的 `AscCommon.a9c(data, "DOCY")` 逻辑，对当前 `empty_bin.ts` 中的 `DOCY;v5;7372;...` 输入做格式判定。

### 关键源码路径

9.3.0 中 `asc_openDocumentFromBytes` 并不是“任意 bytes 打开文档”的通用入口，它只是包装输入并调用 `Shc`：

```javascript
d.prototype.r1i = function(r) {
  var t = new AscCommon.WYc;
  t.data = r;
  t.PQb = AscCommon.a9c(t.data, AscCommon.SHa.xH);
  this.Shc(t);
};
q.asc_openDocumentFromBytes = q.r1i;
```

其中：

- `AscCommon.SHa.xH` 是 `"DOCY"`；
- `AscCommon.a9c(data, "DOCY")` 会逐 byte 比较 `data[0..3]` 是否等于 `D/O/C/Y` 的 char code；
- 因此输入必须像 byte array 一样暴露数值索引，普通 JS string 不满足该比较方式。

### 输入格式探针结果

对当前 `src/lib/empty_bin.ts` 的 Word 空文档模板：

```
DOCY;v5;7372;{base64}
```

执行等价探针后的结果：

| 输入 | 长度 | 前 4 字节/字符 | `a9c(data, "DOCY")` | 结论 |
|------|------|----------------|---------------------|------|
| JS string：完整 `DOCY;v5;7372;...` | 9845 | `DOCY` | `false` | string 索引返回字符，不是数字 char code，不能通过 9.3 的签名判断 |
| `Uint8Array(atob(base64))`：当前传入的 7372 bytes | 7372 | `[9, 0, 128, 2]` | `false` | 解码后丢失 `DOCY;v5;7372;` envelope，必然不被识别为 DOCY |
| `TextEncoder().encode("DOCY;v5;7372;...")` | 9845 | `[68, 79, 67, 89]` | `true` | 只有“完整 envelope 的 UTF-8 bytes”能通过 DOCY 签名检查 |
| 普通 `.docx` ZIP bytes | 8+ | `PK\\x03\\x04` | `false` | raw OOXML ZIP 不属于 `asc_openDocumentFromBytes` 的 DOCY 分支 |

### 对当前实现的影响

当前 `src/lib/onlyoffice-editor.ts` 有两条 9.3 打开路径：

1. 新建文档时，把 `DOCY;v5;7372;{base64}` 解码成 7372 bytes 存到 `window.__pendingBinary`；
2. `onAppReady` 中如果拿到 iframe 的 `__desktopApi.asc_openDocumentFromBytes`，对 string 直接传 string，否则传 `pendingCopy`。

这两条都存在问题：

- **传 string：** 9.3 的 `a9c` 对 string 返回 `false`；
- **传 decoded 7372 bytes：** 丢掉了 `DOCY` envelope，`a9c` 也返回 `false`；
- 因此看到 `Asc.c_oAscError.ID.ConvertationOpenFormat` 和 generic `errorInconsistentExt` 是符合源码逻辑的，不是偶发 UI 报错。

### 结论

`asc_openDocumentFromBytes` 在 9.3.0 中至少要求输入能通过 `DOCY` byte 签名检查；当前项目的 7.4.1 `DOCY;v5` 空文档数据与调用方式都不满足 9.3 的直接打开路径。

下一步不应继续把 `asc_openDocumentFromBytes` 当作万能入口反复试参，而应二选一：

1. **如果继续实验 direct bytes 路径：** 先用 9.3 对应的转换链生成 9.3 可识别的 DOCY envelope，并以 `Uint8Array(TextEncoder(...))` 传入；但 7.4.1 的 `DOCY;v5` 即使通过签名，也仍可能在后续解析阶段因内部格式版本不兼容失败。
2. **更合理的 9.3 路径：** 回到 9.x 的 server-mode 协议，做最小 `window.io`/socket.io mock，通过 `auth` + `documentOpen` 把 OOXML Blob URL 或服务端期望的数据对象交给 9.3 初始化流程，而不是绕过协议直接调用 `asc_openDocumentFromBytes`。

---

## 资产来源与缺口：不是简单缺一个 `bin.ts`

当前升级问题容易被简化为“缺少 9.3 版本的 wasm 和 bin.ts”。更准确的拆分如下：

### 1. `sdkjs` / `web-apps`

主分支可用的是旧版 standalone 前端包。仓库文档里曾写作 `7.5.0`，但当前文件头和历史调查显示实际核心版本更接近 `7.4.1 (build:1)`。

9.3 的 `sdkjs` / `web-apps` 已经可以获取，来源包括：

```bash
docker run -d --name oo onlyoffice/documentserver:9.3.0
docker cp oo:/var/www/onlyoffice/documentserver/web-apps ./public/web-apps
docker cp oo:/var/www/onlyoffice/documentserver/sdkjs ./public/sdkjs
docker rm -f oo
```

或从 Desktop Editors 的 tarball / dmg 中提取。但这些 9.x 产物默认是 server-mode 架构，不等价于 7.x 的纯前端 standalone 包。

### 2. `x2t.wasm`

项目内已有：

```text
public/wasm/x2t/x2t.js
public/wasm/x2t/x2t.wasm
```

历史记录显示它最早随 `29a472a feat: add document preview editor` 引入，后续有压缩格式、加载方式和一次 9.3 升级提交调整。它不是 Docker `web-apps/sdkjs` 自动带出的资源，而是单独处理的转换器。

项目文档里的获取说明是：

```text
x2t WASM 需单独处理（社区维护）
参考：https://github.com/cryptpad/onlyoffice-x2t-wasm
```

因此，若要严格对齐 9.3，需要确认当前 `public/wasm/x2t` 是否真的是基于 9.3 x2t 构建，而不是旧版本或社区混合版本。

### 3. `empty_bin.ts`

当前空文档模板在 `src/lib/empty_bin.ts`：

```text
.docx -> DOCY;v5;7372;...
.xlsx -> XLSY;v2;6160;...
.pptx -> PPTY;v1;47829;...
```

这些是旧版 OnlyOffice 内部格式模板，不是普通 OOXML 文件，也不是 x2t wasm 自动生成的源码文件。

9.3 静态包中已经能看到新版内部模板迹象，例如 slide 侧出现 `PPTY;v10;...`。这说明 9.3 的内部空文档模板版本已经变化，当前 `DOCY;v5` / `XLSY;v2` / `PPTY;v1` 不能假设继续兼容。

获取 9.3 empty template 的可行方式：

1. 从 9.3 的 `sdkjs` / `web-apps` 构建产物里搜索 `DOCY;`、`XLSY;`、`PPTY;` 并提取对应空文档常量；
2. 用 9.3 同代的 x2t 转换链生成空 `.docx/.xlsx/.pptx` 的内部格式；
3. 从 ONLYOFFICE 源码构建流程中定位生成 empty template 的脚本或常量来源。

### 判断

缺口不只是“缺少 9.3 wasm 和 bin.ts”，而是三件事需要同代匹配：

| 资产 | 当前状态 | 9.3 升级要求 |
|------|----------|--------------|
| `sdkjs/web-apps` | 7.x standalone 可用；9.3 已能提取但走 server-mode | 需要决定走 server-mode mock，还是找到/构建真正 standalone 路径 |
| `x2t.wasm` | 已存在，来源为单独引入/社区构建链 | 需要确认是否与 9.3 内部格式同代 |
| `empty_bin.ts` | 旧版 `DOCY;v5` / `XLSY;v2` / `PPTY;v1` | 需要替换为 9.3 同代 empty template，或改为由 9.3 x2t 动态生成 |

即使补齐 9.3 的 `x2t.wasm` 和 empty template，也只能解决输入格式兼容的一部分；9.3 编辑器初始化路径默认依赖 server-mode/socket.io 仍然是主问题。

---

## 当前可行路径

### 路径 A：维持 7.5.0（立即可行，推荐）

- 回滚 `public/sdkjs` 和 `public/web-apps` 到 main 的 7.5 版本
- 保留 x2t WASM 9.3.0 升级（独立可用）
- 保留 `src/lib/document-converter.ts` absolutePath 修复

### 路径 B：实现最小 socket.io 协议服务（技术攻坚）

在 Vite dev server 旁边运行一个 tiny Node.js 服务，使用 Docker 镜像的 sdkjs（服务端构建），实现够用的 OnlyOffice 协议子集：

```
目标协议流程（使用 Docker 服务端 sdkjs）：
  1. socket.io 握手（EIO4 handshake）
  2. 服务端发送 authChanges 响应
  3. code.js 被加载（纯 UI，无需服务器即可完成）
  4. 渲染引擎通过服务端协议路径初始化
  5. 文档渲染管线启动
```

参考：
- `ONLYOFFICE/server`（开源，MIT）— 协议实现参考

### 路径 C：升级到 v8.1.1（❌ 已验证失败）

据 sdkjs commit 分析，`v8.1.1`（2024-07-17）是最后一个无 `code.js` 的版本（app.js 仍为单体包），理论上沿用 7.x 的离线架构。

**实际测试结果（2026-06-14）：**
- 下载 Linux Desktop Editors v8.1.1 tarball，提取并替换 `public/web-apps/` 和 `public/sdkjs/`
- 浏览器网络面板观察到请求：`/doc/{key}/c/?shardkey=...&EIO=4&transport=polling` → 404
- **结论：v8.1.1 仍依赖 socket.io**，与无 `code.js` 无关
- 已用 `git checkout main -- public/web-apps public/sdkjs` 回滚到 7.4.1

**教训：** 无 `code.js` ≠ 可离线。socket.io 依赖位于 `sdk-all-min.js`，与 `code.js` 是否存在无关。

### 路径 D：Desktop tarball + 正确 AscDesktopEditor Mock（重新评估）

之前 Desktop Mode Mock 失败是因为：① 使用了 Docker 服务端 sdkjs（非 Desktop 版），② 从未实际传入文档数据。

**使用 Desktop tarball 的正确 mock 流程：**

```typescript
// 1. 注入 AscDesktopEditor mock
window.AscDesktopEditor = {
    execCommand: (cmd: string, param: string) => {
        if (cmd === "webapps:entry") {
            // webapps:entry = 编辑器就绪，等待文件
            initDocumentAfterReady();
        }
    },
    // ... 其他 Desktop API
};

// 2. 等待 docs_api 初始化完成后，用 x2t WASM 转换文件并传入
async function initDocumentAfterReady() {
    const fileData = await x2tConvert(userFile);  // ArrayBuffer
    const docsApi = window.DocsAPI.DocEditor.instances["editor"];
    docsApi.asc_nativeOpenFile(new Uint8Array(fileData));
}
```

**使用的文件来源：** Linux Desktop Editors 9.3.0 tarball（非 Docker 镜像），因为 Desktop tarball 的 sdkjs 才有完整的 AscDesktopEditor 代码路径（202 个引用）。

**预期渲染路径：** `nativeOpenFile` → `jre()` → `AscCommonWord.e2`（存入 `ta.Ga`）→ 画布渲染。

**尚未验证：** 此路径仅基于代码分析推断，需实际测试。

---

## 相关文档

- [升级探索总览](./2026-05-31-onlyoffice-9.3.0-upgrade.md)
- [Desktop Mode Mock 详细记录](./2026-05-31-onlyoffice-desktop-mode-mock.md)
- [离线能力架构对比](./2026-06-07-offline-architecture-comparison.md)
- [Codex 复核：OnlyOffice 9.3.0 升级探索结论](./2026-06-14-codex-9.3.0-upgrade-review.md)
