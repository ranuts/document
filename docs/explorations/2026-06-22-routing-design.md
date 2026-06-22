# 路由系统最终设计方案

**日期**：2026-06-22  
**范围**：`apps/web` MPA + SPA 混合路由，覆盖 v7 / v9 两个版本

---

## 一、核心约束

| 约束 | 说明 |
|------|------|
| 静态托管 | GitHub Pages，无服务端路由，路径必须对应真实 HTML 文件 |
| 两个版本 | v7 部署于 `/`，v9 部署于 `/9.3.0/` |
| 本地文件 | `File` 对象是内存引用，**无法跨真实页面导航传递** |
| 远程 URL | 可以放在 query string 里，支持真实页面导航和刷新恢复 |
| 后退按钮 | 所有场景都要支持 |

---

## 二、URL 结构

```
/{version?}/{type}/
  │           │
  │           └── docx | xlsx | pptx | csv
  └── (省略 = v7 根路径，9.3.0 = v9)
```

### 完整路由表

| URL（v7 示例） | 对应 v9 | 场景 |
|---------------|---------|------|
| `/` | `/9.3.0/` | 首页（落地页 + 控制面板） |
| `/docx/` | `/9.3.0/docx/` | Word 编辑器 |
| `/xlsx/` | `/9.3.0/xlsx/` | Excel 编辑器 |
| `/pptx/` | `/9.3.0/pptx/` | PowerPoint 编辑器 |
| `/csv/` | `/9.3.0/csv/` | CSV 编辑器 |

编辑器路由支持以下 query 参数：

| 参数 | 来源 | 刷新恢复 | 示例 |
|------|------|---------|------|
| `?src=<url>` | 远程 URL | ✅ 重新 fetch | `/docx/?src=https://example.com/a.docx` |
| `?file=<name>` | 本地文件（仅标注文件名） | ❌ 数据丢失 | `/docx/?file=report.docx` |
| （无参数） | 新建空文档 | ✅ 再次新建 | `/docx/` |

---

## 三、导航方式：混合策略

不同场景采用不同导航方式，原因取决于数据能否随 URL 传递：

### 场景 A：新建文档 → **MPA 真实导航**

```
首页 /  ──[点击"新建 Word"]──→  真实跳转  →  /docx/
                                              ↓
                               编辑器自动创建空文档
浏览器后退 ← 真实页面返回 ← /docx/
```

原因：无需传数据，真实跳转最干净，刷新 = 再次新建（可接受）。

### 场景 B：打开本地文件 → **pushState（SPA 伪导航）**

```
首页 /  ──[选择 report.docx]──→  pushState  →  URL 变 /docx/?file=report.docx
                                                 页面不重载，File 留在内存
                                                 编辑器在当前页面打开
浏览器后退 ← popstate 触发 ← 恢复首页视图
```

原因：`File` 对象无法跨真实页面导航，pushState 是唯一不引入 IndexedDB 的方案。  
刷新行为：URL 有 `?file=report.docx` 但数据丢失 → 显示提示"本地文件无法从 URL 恢复，请重新打开"。

### 场景 C：打开远程 URL → **MPA 真实导航**

```
首页 /  ──[粘贴 URL 打开]──→  真实跳转  →  /docx/?src=https://example.com/a.docx
                                             ↓
                              编辑器读取 ?src 参数，fetch 文档
浏览器后退 ← 真实页面返回 ← /docx/?src=...
```

优势：URL 可分享、可书签、刷新自动恢复（重新 fetch）。

### 场景 D：embed 模式 → **不参与路由**

URL 含 `?embed=1` 或页面在 iframe 中时，路由逻辑完全跳过，行为由 `embed-api.ts` 的 postMessage 协议控制。

---

## 四、编辑器页面启动逻辑（`src/index.ts`）

```
启动
  │
  ├─ 是否为编辑器路由？（pathname 以 /docx/ 等结尾）
  │    NO → 显示首页控制面板，监听 popstate（本地文件打开后的后退）
  │
  └─ YES（编辑器路由）
       │
       ├─ 有 ?src= 参数 → fetch 远程文档并打开
       ├─ 有 ?file= 参数 → 数据已通过 sessionFile 传入（见下方），若无则提示错误
       └─ 无参数 → 按路径对应的扩展名新建空文档
```

---

## 五、本地文件跨页传递方案（当前不实现，备忘）

若未来需要支持"打开本地文件后可刷新恢复"，可使用 IndexedDB：

```
1. 用户选文件 → 读取 ArrayBuffer → 存入 IndexedDB key = "pending:{ext}:{ts}"
2. MPA 真实跳转到 /docx/?session={ts}
3. /docx/ 页面读取 ?session 参数 → 从 IndexedDB 取字节 → 打开 → 删除 key
4. 刷新 /docx/?session={ts} → key 已删 → 提示错误
```

当前选择 pushState 方案（场景 B）是为了避免 IndexedDB 的异步复杂度和错误处理。

---

## 六、从编辑器页切换文档（FAB 菜单）

用户在编辑器路由（如 `/docx/`）中，通过 FAB 菜单打开新文件：

| 操作 | 目标类型与当前相同 | 目标类型与当前不同 |
|------|------------------|------------------|
| 新建 | `onCreateNew(ext)` 原地重建编辑器，replaceState 清除 ?file/?src | MPA 跳转到对应路由 `/xlsx/` |
| 打开本地文件 | pushState 更新 ?file=，原地重建 | pushState 到 `/xlsx/?file=`，原地更换编辑器 |
| 打开远程 URL | MPA 跳转 `/docx/?src=...`（可刷新恢复） | MPA 跳转 `/xlsx/?src=...` |

---

## 七、后退按钮完整行为

| 当前 URL | 到达方式 | 后退结果 |
|---------|---------|---------|
| `/docx/` | MPA 新建 | 真实返回 `/` |
| `/docx/?src=...` | MPA 远程打开 | 真实返回 `/` |
| `/docx/?file=report.docx` | pushState 本地打开 | popstate 触发 → 首页视图，URL 回 `/` |
| `/docx/?file=...`（编辑器内切换） | pushState/replaceState | popstate → 上一个编辑器或首页 |

---

## 八、MPA HTML 入口文件

v7 和 v9 共用同一套 `pages/` 目录下的 HTML（通过 `rollupInputs`），Vite 构建时分别产出到各自的输出目录。

```
pages/
  index.html          → /  (v7) 或 /9.3.0/ (v9)
  docx/index.html     → /docx/ 或 /9.3.0/docx/
  xlsx/index.html     → /xlsx/ 或 /9.3.0/xlsx/
  pptx/index.html     → /pptx/ 或 /9.3.0/pptx/
  csv/index.html      → /csv/  或 /9.3.0/csv/
```

---

## 九、当前实现状态（2026-06-22）

| 功能 | 状态 |
|------|------|
| 编辑器路由 HTML 页面（docx/xlsx/pptx/csv） | ✅ 已完成 |
| `vite.shared.ts` rollupInputs | ✅ 已完成 |
| `src/index.ts` 路径检测 + 自动新建 | ✅ 已完成 |
| 首页"新建"按钮 MPA 导航 | ✅ 已完成 |
| 打开本地文件 pushState（场景 B） | ⬜ 待实现 |
| 远程 URL MPA 导航（场景 C） | ⬜ 待实现 |
| 编辑器内 FAB 切换文档路由更新 | ⬜ 待实现 |
| 刷新 `?file=` 时的错误提示 | ⬜ 待实现 |
| popstate 处理器（本地文件后退） | ⬜ 待实现 |
